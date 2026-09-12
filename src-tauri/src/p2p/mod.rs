use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;

pub mod discovery;
pub mod session;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerBeacon {
    pub peer_id: String,
    pub capsule_id: String,
    pub key_hash: String,
    pub port: u16,
    pub device_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncMessage {
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
    pub key_hash: Option<String>,
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
                key_hash: None,
                listen_port: 0,
                connected_peers: HashMap::new(),
                stop_sender: None,
            })),
        }
    }
}

pub fn compute_key_hash(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    hex::encode(hasher.finalize())[..16].to_string()
}
