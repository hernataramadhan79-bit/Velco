use chacha20poly1305::{
    XChaCha20Poly1305, Key, XNonce,
    aead::{Aead, KeyInit},
};
use rand::RngCore;
use std::net::SocketAddr;
use tauri::{Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use tokio::time::{timeout, Duration};

use super::{ConnectedPeer, P2PState, SyncMessage, compute_auth_response};
use crate::database::Database;

// ─────────────────────────────────────────────────────────────────────────────
// Wire format constants
// ─────────────────────────────────────────────────────────────────────────────

/// Maximum frame payload size (10 MB). Prevents OOM from malicious peers.
const MAX_FRAME_BYTES: usize = 10 * 1024 * 1024;

/// XChaCha20 nonce size (24 bytes). Fresh random nonce per frame.
const NONCE_LEN: usize = 24;

/// Poly1305 authentication tag appended to ciphertext.
const TAG_LEN: usize = 16;

/// Seconds to complete auth handshake before dropping connection.
const HANDSHAKE_TIMEOUT_SECS: u64 = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Encrypted framing  [4-byte BE length | 24-byte nonce | ciphertext+tag]
// ─────────────────────────────────────────────────────────────────────────────

/// Serialise `msg` to JSON, encrypt with XChaCha20-Poly1305, write as a
/// length-prefixed frame: `[4 bytes len BE][24 bytes nonce][ciphertext + 16-byte tag]`.
async fn send_encrypted_frame(
    stream: &mut TcpStream,
    msg: &SyncMessage,
    session_key: &[u8; 32],
) -> Result<(), String> {
    let plaintext = serde_json::to_vec(msg).map_err(|e| e.to_string())?;

    let cipher = XChaCha20Poly1305::new(Key::from_slice(session_key));
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = XNonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_ref())
        .map_err(|e| format!("Encrypt error: {}", e))?;

    // Frame = nonce (24) + ciphertext (plaintext.len + 16 tag)
    let frame_len = NONCE_LEN + ciphertext.len();
    let len_u32 = frame_len as u32;

    stream
        .write_all(&len_u32.to_be_bytes())
        .await
        .map_err(|e| e.to_string())?;
    stream
        .write_all(&nonce_bytes)
        .await
        .map_err(|e| e.to_string())?;
    stream
        .write_all(&ciphertext)
        .await
        .map_err(|e| e.to_string())?;
    stream.flush().await.map_err(|e| e.to_string())?;

    Ok(())
}

/// Read one encrypted frame, decrypt it, and deserialise into `SyncMessage`.
/// Returns `None` on clean EOF or oversized frame.
async fn recv_encrypted_frame(
    stream: &mut TcpStream,
    session_key: &[u8; 32],
) -> Option<SyncMessage> {
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf).await.ok()?;
    let frame_len = u32::from_be_bytes(len_buf) as usize;

    if frame_len < NONCE_LEN + TAG_LEN || frame_len > MAX_FRAME_BYTES {
        return None; // Reject malformed or oversized frames
    }

    let mut frame_buf = vec![0u8; frame_len];
    stream.read_exact(&mut frame_buf).await.ok()?;

    let nonce = XNonce::from_slice(&frame_buf[..NONCE_LEN]);
    let ciphertext = &frame_buf[NONCE_LEN..];

    let cipher = XChaCha20Poly1305::new(Key::from_slice(session_key));
    let plaintext = cipher.decrypt(nonce, ciphertext).ok()?;

    serde_json::from_slice::<SyncMessage>(&plaintext).ok()
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth handshake helpers (plaintext — sent before encrypted channel opens)
// ─────────────────────────────────────────────────────────────────────────────

/// Write a raw (plaintext) JSON-framed `SyncMessage`. Only used for the two
/// handshake messages (AuthChallenge / AuthResponse) before the encrypted
/// channel is established.
async fn send_raw_frame(stream: &mut TcpStream, msg: &SyncMessage) -> Result<(), String> {
    let bytes = serde_json::to_vec(msg).map_err(|e| e.to_string())?;
    let length = bytes.len() as u32;
    stream
        .write_all(&length.to_be_bytes())
        .await
        .map_err(|e| e.to_string())?;
    stream.write_all(&bytes).await.map_err(|e| e.to_string())?;
    stream.flush().await.map_err(|e| e.to_string())?;
    Ok(())
}

/// Read a raw (plaintext) JSON-framed `SyncMessage`. Only used during handshake.
async fn recv_raw_frame(stream: &mut TcpStream) -> Option<SyncMessage> {
    let mut len_buf = [0u8; 4];
    stream.read_exact(&mut len_buf).await.ok()?;
    let length = u32::from_be_bytes(len_buf) as usize;
    if length > 1024 { // Handshake messages are tiny — cap at 1 KB
        return None;
    }
    let mut buf = vec![0u8; length];
    stream.read_exact(&mut buf).await.ok()?;
    serde_json::from_slice::<SyncMessage>(&buf).ok()
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: TCP listener
// ─────────────────────────────────────────────────────────────────────────────

pub async fn start_tcp_listener(
    app: tauri::AppHandle,
    p2p_state: P2PState,
    mut stop_rx: broadcast::Receiver<()>,
) -> Result<u16, String> {
    let listener = TcpListener::bind("0.0.0.0:0")
        .await
        .map_err(|e| e.to_string())?;
    let local_addr = listener.local_addr().map_err(|e| e.to_string())?;
    let port = local_addr.port();

    {
        let mut inner = p2p_state.inner.write().await;
        inner.listen_port = port;
    }

    let app_handle = app.clone();
    let state_clone = p2p_state.clone();

    tokio::spawn(async move {
        loop {
            tokio::select! {
                _ = stop_rx.recv() => { break; }
                res = listener.accept() => {
                    match res {
                        Ok((stream, addr)) => {
                            let app_sub = app_handle.clone();
                            let state_sub = state_clone.clone();
                            tokio::spawn(async move {
                                listener_handle_incoming(app_sub, state_sub, stream, addr).await;
                            });
                        }
                        Err(e) => {
                            eprintln!("[P2P TCP] Accept error: {}", e);
                        }
                    }
                }
            }
        }
    });

    Ok(port)
}

// ─────────────────────────────────────────────────────────────────────────────
// Listener side: sends AuthChallenge → verifies AuthResponse
// ─────────────────────────────────────────────────────────────────────────────

async fn listener_handle_incoming(
    app: tauri::AppHandle,
    p2p_state: P2PState,
    mut stream: TcpStream,
    addr: SocketAddr,
) {
    // Retrieve session_key before handshake — drop the lock immediately
    let session_key = {
        let inner = p2p_state.inner.read().await;
        match inner.session_key {
            Some(k) => k,
            None => {
                eprintln!("[P2P Auth] No session key — P2P not active, dropping {}", addr);
                return;
            }
        }
    };

    // ── Handshake with timeout ────────────────────────────────────────────────
    let handshake_result = timeout(
        Duration::from_secs(HANDSHAKE_TIMEOUT_SECS),
        perform_listener_handshake(&mut stream, &session_key),
    )
    .await;

    match handshake_result {
        Ok(true) => {} // Auth OK — proceed
        Ok(false) => {
            eprintln!("[P2P Auth] Handshake failed from {} — dropping connection", addr);
            return;
        }
        Err(_elapsed) => {
            eprintln!("[P2P Auth] Handshake timeout from {} — dropping connection", addr);
            return;
        }
    }

    // ── Encrypted session ─────────────────────────────────────────────────────
    handle_peer_stream(app, p2p_state, stream, addr, &session_key).await;
}

/// Returns `true` if the remote peer correctly proves it holds `session_key`.
async fn perform_listener_handshake(
    stream: &mut TcpStream,
    session_key: &[u8; 32],
) -> bool {
    // 1. Generate random 32-byte nonce and send as AuthChallenge (plaintext — no key yet)
    let mut nonce_bytes = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce_hex = hex::encode(nonce_bytes);

    let challenge = SyncMessage::AuthChallenge { nonce: nonce_hex.clone() };
    if send_raw_frame(stream, &challenge).await.is_err() {
        return false;
    }

    // 2. Receive AuthResponse and verify HMAC
    match recv_raw_frame(stream).await {
        Some(SyncMessage::AuthResponse { hmac_hex }) => {
            let expected = compute_auth_response(session_key, &nonce_hex);
            // Constant-time comparison: MAC both strings under session_key
            // so timing doesn't leak whether the prefix matched.
            use hmac::{Hmac, Mac};
            use chacha20poly1305::aead::KeyInit;
            use sha2::Sha256;
            type HmacSha256 = Hmac<Sha256>;
            let mut m1 = <HmacSha256 as KeyInit>::new_from_slice(session_key).expect("hmac key");
            m1.update(expected.as_bytes());
            let t1 = m1.finalize().into_bytes();
            let mut m2 = <HmacSha256 as KeyInit>::new_from_slice(session_key).expect("hmac key");
            m2.update(hmac_hex.as_bytes());
            let t2 = m2.finalize().into_bytes();
            t1 == t2
        }
        _ => false,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Initiator side: receives AuthChallenge → sends AuthResponse
// ─────────────────────────────────────────────────────────────────────────────

pub async fn connect_to_peer(
    app: tauri::AppHandle,
    p2p_state: P2PState,
    peer_id: String,
    device_name: String,
    addr: SocketAddr,
) {
    let stream = match TcpStream::connect(addr).await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[P2P Connect] Could not connect to peer {} at {}: {}", peer_id, addr, e);
            return;
        }
    };

    // Retrieve session_key
    let session_key = {
        let inner = p2p_state.inner.read().await;
        match inner.session_key {
            Some(k) => k,
            None => {
                eprintln!("[P2P Connect] No session key — P2P not active");
                return;
            }
        }
    };

    let mut peer_stream = stream;

    // ── Handshake with timeout ────────────────────────────────────────────────
    let hs = timeout(
        Duration::from_secs(HANDSHAKE_TIMEOUT_SECS),
        perform_initiator_handshake(&mut peer_stream, &session_key),
    )
    .await;

    match hs {
        Ok(true) => {} // Auth OK
        Ok(false) => {
            eprintln!("[P2P Connect] Auth rejected by peer {} at {} — wrong vault key?", peer_id, addr);
            return;
        }
        Err(_) => {
            eprintln!("[P2P Connect] Handshake timeout with {}", addr);
            return;
        }
    }

    // ── Send Hello over encrypted channel ────────────────────────────────────
    let (my_peer_id, active_cap, my_device_name) = {
        let inner = p2p_state.inner.read().await;
        (
            inner.peer_id.clone(),
            inner.active_capsule_id.clone().unwrap_or_default(),
            inner.device_name.clone(),
        )
    };

    let hello_msg = SyncMessage::Hello {
        peer_id: my_peer_id,
        capsule_id: active_cap,
        device_name: my_device_name,
    };

    if let Err(e) = send_encrypted_frame(&mut peer_stream, &hello_msg, &session_key).await {
        eprintln!("[P2P Connect] Failed to send hello to {}: {}", addr, e);
        return;
    }

    {
        let mut inner = p2p_state.inner.write().await;
        inner.connected_peers.insert(
            peer_id.clone(),
            ConnectedPeer {
                peer_id: peer_id.clone(),
                device_name: device_name.clone(),
                addr,
                connected_at: chrono::Utc::now().to_rfc3339(),
            },
        );
    }

    let _ = app.emit("velco://p2p-peer-joined", serde_json::json!({
        "peer_id": peer_id,
        "device_name": device_name,
        "addr": addr.to_string(),
    }));

    handle_peer_stream(app, p2p_state, peer_stream, addr, &session_key).await;
}

/// Initiator: receive challenge, respond with HMAC proof.
async fn perform_initiator_handshake(
    stream: &mut TcpStream,
    session_key: &[u8; 32],
) -> bool {
    match recv_raw_frame(stream).await {
        Some(SyncMessage::AuthChallenge { nonce }) => {
            let hmac_hex = compute_auth_response(session_key, &nonce);
            let response = SyncMessage::AuthResponse { hmac_hex };
            send_raw_frame(stream, &response).await.is_ok()
        }
        _ => false,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared: encrypted message loop (post-handshake)
// ─────────────────────────────────────────────────────────────────────────────

async fn handle_peer_stream(
    app: tauri::AppHandle,
    p2p_state: P2PState,
    mut stream: TcpStream,
    addr: SocketAddr,
    session_key: &[u8; 32],
) {
    let mut current_peer_id: Option<String> = None;

    loop {
        let msg = match recv_encrypted_frame(&mut stream, session_key).await {
            Some(m) => m,
            None => break, // Connection closed or decryption failed (tampered data)
        };

        match msg {
            SyncMessage::Hello { peer_id, capsule_id: _, device_name } => {
                current_peer_id = Some(peer_id.clone());
                let mut inner = p2p_state.inner.write().await;
                inner.connected_peers.insert(
                    peer_id.clone(),
                    ConnectedPeer {
                        peer_id: peer_id.clone(),
                        device_name: device_name.clone(),
                        addr,
                        connected_at: chrono::Utc::now().to_rfc3339(),
                    },
                );
                drop(inner);

                let _ = app.emit("velco://p2p-peer-joined", serde_json::json!({
                    "peer_id": peer_id,
                    "device_name": device_name,
                    "addr": addr.to_string(),
                }));
            }
            SyncMessage::ItemUpserted {
                capsule_id,
                item_id,
                item_type,
                title,
                content,
                priority,
                completed,
                due_date,
            } => {
                // Only accept messages for the active capsule
                let active_cap = {
                    let inner = p2p_state.inner.read().await;
                    inner.active_capsule_id.clone()
                };
                if active_cap.as_deref() != Some(&capsule_id) {
                    eprintln!("[P2P Sync] ItemUpserted for wrong capsule — ignoring");
                    continue;
                }
                if let Some(db) = app.try_state::<Database>() {
                    apply_remote_item_upsert(
                        &db,
                        &capsule_id,
                        &item_id,
                        &item_type,
                        &title,
                        &content,
                        priority.as_deref(),
                        completed,
                        due_date.as_deref(),
                    );
                }
                let _ = app.emit("velco://items-changed", ());
                let _ = app.emit("velco://capsules-changed", ());
            }
            SyncMessage::TaskToggled { capsule_id, item_id, completed } => {
                // Capsule guard
                let active_cap = {
                    let inner = p2p_state.inner.read().await;
                    inner.active_capsule_id.clone()
                };
                if active_cap.as_deref() != Some(&capsule_id) {
                    continue;
                }
                if let Some(db) = app.try_state::<Database>() {
                    if let Ok(conn) = db.write_conn.lock() {
                        let completed_val = if completed { 1 } else { 0 };
                        let completed_at = if completed { Some(chrono::Utc::now().to_rfc3339()) } else { None };
                        let _ = conn.execute(
                            "UPDATE tasks SET completed = ?1, completed_at = ?2 WHERE item_id = ?3",
                            rusqlite::params![completed_val, completed_at, item_id],
                        );
                    }
                }
                let _ = app.emit("velco://items-changed", ());
                let _ = app.emit("velco://capsules-changed", ());
            }
            SyncMessage::ItemRemoved { capsule_id, item_id } => {
                // Capsule guard
                let active_cap = {
                    let inner = p2p_state.inner.read().await;
                    inner.active_capsule_id.clone()
                };
                if active_cap.as_deref() != Some(&capsule_id) {
                    continue;
                }
                if let Some(db) = app.try_state::<Database>() {
                    if let Ok(conn) = db.write_conn.lock() {
                        let _ = conn.execute(
                            "DELETE FROM capsule_items WHERE capsule_id = ?1 AND item_id = ?2",
                            rusqlite::params![capsule_id, item_id],
                        );
                    }
                }
                let _ = app.emit("velco://items-changed", ());
                let _ = app.emit("velco://capsules-changed", ());
            }
            // Handshake messages must not appear after handshake completes
            SyncMessage::AuthChallenge { .. } | SyncMessage::AuthResponse { .. } => {
                eprintln!("[P2P Sync] Unexpected handshake message in data phase — dropping peer");
                break;
            }
            _ => {}
        }
    }

    // Peer disconnected — cleanup
    if let Some(pid) = current_peer_id {
        let mut inner = p2p_state.inner.write().await;
        inner.connected_peers.remove(&pid);
        drop(inner);

        let _ = app.emit("velco://p2p-peer-left", serde_json::json!({
            "peer_id": pid,
        }));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: broadcast to all connected peers (encrypted)
// ─────────────────────────────────────────────────────────────────────────────

pub async fn broadcast_to_peers(p2p_state: &P2PState, msg: &SyncMessage) {
    let (peers, session_key) = {
        let inner = p2p_state.inner.read().await;
        let addrs: Vec<SocketAddr> = inner.connected_peers.values().map(|p| p.addr).collect();
        let key = inner.session_key;
        (addrs, key)
    };

    let session_key = match session_key {
        Some(k) => k,
        None => {
            eprintln!("[P2P Broadcast] No session key — cannot send encrypted frame");
            return;
        }
    };

    for addr in peers {
        let msg_clone = msg.clone();
        tokio::spawn(async move {
            if let Ok(mut stream) = TcpStream::connect(addr).await {
                // Outbound broadcast: we are the initiator side — complete handshake first
                let hs = timeout(
                    Duration::from_secs(HANDSHAKE_TIMEOUT_SECS),
                    perform_initiator_handshake(&mut stream, &session_key),
                )
                .await;
                if matches!(hs, Ok(true)) {
                    let _ = send_encrypted_frame(&mut stream, &msg_clone, &session_key).await;
                }
            }
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// DB write helper (unchanged logic, same parameterized queries)
// ─────────────────────────────────────────────────────────────────────────────

fn apply_remote_item_upsert(
    db: &Database,
    capsule_id: &str,
    item_id: &str,
    item_type: &str,
    title: &str,
    content: &str,
    priority: Option<&str>,
    completed: Option<bool>,
    due_date: Option<&str>,
) {
    let conn = match db.write_conn.lock() {
        Ok(c) => c,
        Err(_) => return,
    };
    let now = chrono::Utc::now().to_rfc3339();

    let _ = conn.execute(
        r#"
        INSERT INTO items (id, type, title, content, source, status, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, 'p2p_sync', 'inbox', ?5, ?5)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            content = excluded.content,
            updated_at = excluded.updated_at
        "#,
        rusqlite::params![item_id, item_type, title, content, now],
    );

    if item_type == "task" {
        let task_id = uuid::Uuid::new_v4().to_string();
        let prio = priority.unwrap_or("medium");
        let comp = if completed.unwrap_or(false) { 1 } else { 0 };

        let _ = conn.execute(
            r#"
            INSERT INTO tasks (id, item_id, due_date, priority, completed, notified)
            VALUES (?1, ?2, ?3, ?4, ?5, 0)
            ON CONFLICT(item_id) DO UPDATE SET
                priority = excluded.priority,
                completed = excluded.completed,
                due_date = excluded.due_date
            "#,
            rusqlite::params![task_id, item_id, due_date, prio, comp],
        );
    }

    let _ = conn.execute(
        r#"
        INSERT OR IGNORE INTO capsule_items (capsule_id, item_id, added_at)
        VALUES (?1, ?2, ?3)
        "#,
        rusqlite::params![capsule_id, item_id, now],
    );
}
