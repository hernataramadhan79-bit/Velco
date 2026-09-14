use serde::{Deserialize, Serialize};
use sha2::Sha256;
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;

pub mod discovery;
pub mod session;

// ─────────────────────────────────────────────────────────────────────────────
// Wire types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerBeacon {
    pub peer_id: String,
    pub capsule_id: String,
    /// HMAC-SHA256(beacon_mac_key, capsule_id || ":" || beacon_ts), hex-encoded.
    /// Replaces the old `key_hash` truncated-SHA256 fingerprint.
    pub beacon_mac: String,
    /// Unix timestamp (seconds) when beacon was signed. Used for replay protection.
    pub beacon_ts: u64,
    pub port: u16,
    pub device_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncMessage {
    /// Step 1 of handshake: listener → initiator. 32-byte random hex nonce.
    AuthChallenge {
        nonce: String,
    },
    /// Step 2 of handshake: initiator → listener. HMAC-SHA256(session_key, nonce) hex.
    AuthResponse {
        hmac_hex: String,
    },
    Hello {
        peer_id: String,
        capsule_id: String,
        device_name: String,
    },
    ItemUpserted {
        capsule_id: String,
        item_id: String,
        item_type: String,
        title: String,
        content: String,
        priority: Option<String>,
        completed: Option<bool>,
        due_date: Option<String>,
    },
    ItemRemoved {
        capsule_id: String,
        item_id: String,
    },
    TaskToggled {
        capsule_id: String,
        item_id: String,
        completed: bool,
    },
    RequestFullSync {
        capsule_id: String,
    },
    FullSyncPayload {
        capsule_id: String,
        items_json: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectedPeer {
    pub peer_id: String,
    pub device_name: String,
    pub addr: SocketAddr,
    pub connected_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct P2PStatus {
    pub is_active: bool,
    pub active_capsule_id: Option<String>,
    pub peer_id: String,
    pub device_name: String,
    pub listen_port: u16,
    pub connected_peers: Vec<ConnectedPeer>,
}

#[derive(Clone)]
pub struct P2PState {
    pub inner: Arc<RwLock<P2PInner>>,
}

pub struct P2PInner {
    pub is_active: bool,
    pub peer_id: String,
    pub device_name: String,
    pub active_capsule_id: Option<String>,
    pub encryption_key: Option<String>,
    /// 32-byte AEAD key derived via HKDF from vault key. Used to encrypt/decrypt TCP frames.
    pub session_key: Option<[u8; 32]>,
    /// 32-byte MAC key derived via HKDF from vault key. Used to sign/verify UDP beacons.
    pub beacon_mac_key: Option<[u8; 32]>,
    pub listen_port: u16,
    pub connected_peers: HashMap<String, ConnectedPeer>,
    pub stop_sender: Option<tokio::sync::broadcast::Sender<()>>,
}

impl Default for P2PState {
    fn default() -> Self {
        let peer_id = uuid::Uuid::new_v4().to_string()[..8].to_string();
        let device_name = match std::env::var("COMPUTERNAME").or_else(|_| std::env::var("HOSTNAME")) {
            Ok(name) => name,
            Err(_) => format!("Peer-{}", peer_id),
        };

        Self {
            inner: Arc::new(RwLock::new(P2PInner {
                is_active: false,
                peer_id,
                device_name,
                active_capsule_id: None,
                encryption_key: None,
                session_key: None,
                beacon_mac_key: None,
                listen_port: 0,
                connected_peers: HashMap::new(),
                stop_sender: None,
            })),
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cryptographic helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Derives a 32-byte session key from the vault's `encryption_key` using HKDF-SHA256.
///
/// `info` differentiates the two derived keys so that session_key ≠ beacon_mac_key
/// even though they share the same IKM.
pub fn derive_key(vault_key: &str, info: &[u8]) -> [u8; 32] {
    let hk = Hkdf::<Sha256>::new(
        Some(b"velco-p2p-v1"), // salt — fixed, domain-separates Velco from other uses
        vault_key.as_bytes(),
    );
    let mut okm = [0u8; 32];
    hk.expand(info, &mut okm).expect("HKDF expand: 32 bytes always fits");
    okm
}

/// Derives the 32-byte key used to encrypt/decrypt TCP sync frames.
pub fn derive_session_key(vault_key: &str) -> [u8; 32] {
    derive_key(vault_key, b"velco-session-cipher-key")
}

/// Derives the 32-byte key used to sign/verify UDP discovery beacons.
pub fn derive_beacon_mac_key(vault_key: &str) -> [u8; 32] {
    derive_key(vault_key, b"velco-beacon-mac-key")
}

/// Signs a beacon with HMAC-SHA256. Returns lowercase hex.
///
/// Message = `capsule_id || ":" || beacon_ts_decimal`
pub fn sign_beacon(beacon_mac_key: &[u8; 32], capsule_id: &str, beacon_ts: u64) -> String {
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(beacon_mac_key)
        .expect("HMAC accepts any key size");
    mac.update(capsule_id.as_bytes());
    mac.update(b":");
    mac.update(beacon_ts.to_string().as_bytes());
    hex::encode(mac.finalize().into_bytes())
}

/// Verifies a beacon MAC. Returns `false` if invalid or if timestamp is too old.
///
/// Allows ±30 seconds of clock skew.
pub fn verify_beacon(
    beacon_mac_key: &[u8; 32],
    capsule_id: &str,
    beacon_ts: u64,
    beacon_mac: &str,
) -> bool {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // Replay protection: reject beacons older than 30 seconds or from the future
    let age = now.saturating_sub(beacon_ts);
    let ahead = beacon_ts.saturating_sub(now);
    if age > 30 || ahead > 5 {
        return false;
    }

    let expected = sign_beacon(beacon_mac_key, capsule_id, beacon_ts);
    // Constant-time comparison
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(beacon_mac_key)
        .expect("HMAC accepts any key size");
    mac.update(expected.as_bytes());
    let tag_a = mac.finalize().into_bytes();
    let mut mac2 = HmacSha256::new_from_slice(beacon_mac_key)
        .expect("HMAC accepts any key size");
    mac2.update(beacon_mac.as_bytes());
    let tag_b = mac2.finalize().into_bytes();
    tag_a == tag_b
}

/// Computes HMAC-SHA256(session_key, challenge_nonce) for the TCP auth handshake.
pub fn compute_auth_response(session_key: &[u8; 32], nonce: &str) -> String {
    type HmacSha256 = Hmac<Sha256>;
    let mut mac = HmacSha256::new_from_slice(session_key)
        .expect("HMAC accepts any key size");
    mac.update(nonce.as_bytes());
    hex::encode(mac.finalize().into_bytes())
}
