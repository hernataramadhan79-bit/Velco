use std::net::SocketAddr;
use tauri::{Emitter, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;

use super::{ConnectedPeer, P2PState, SyncMessage};
use crate::database::Database;

pub async fn start_tcp_listener(
    app: tauri::AppHandle,
    p2p_state: P2PState,
    mut stop_rx: broadcast::Receiver<()>,
) -> Result<u16, String> {
    let listener = TcpListener::bind("0.0.0.0:0").await.map_err(|e| e.to_string())?;
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
                _ = stop_rx.recv() => {
                    break;
                }
                res = listener.accept() => {
                    match res {
                        Ok((stream, addr)) => {
                            let app_sub = app_handle.clone();
                            let state_sub = state_clone.clone();
                            tokio::spawn(async move {
                                handle_peer_stream(app_sub, state_sub, stream, addr).await;
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

    // Kirim pesan HELLO
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

    let mut peer_stream = stream;
    if let Err(e) = send_message_framed(&mut peer_stream, &hello_msg).await {
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

    handle_peer_stream(app, p2p_state, peer_stream, addr).await;
}

async fn handle_peer_stream(
    app: tauri::AppHandle,
    p2p_state: P2PState,
    mut stream: TcpStream,
    addr: SocketAddr,
) {
    let mut current_peer_id: Option<String> = None;

    loop {
        // Baca length-prefixed frame (4 bytes BE length)
        let mut len_buf = [0u8; 4];
        if let Err(_) = stream.read_exact(&mut len_buf).await {
            break; // Koneksi terputus
        }
        let length = u32::from_be_bytes(len_buf) as usize;
        if length > 10 * 1024 * 1024 { // max 10MB safety
            break;
        }

        let mut payload_buf = vec![0u8; length];
        if let Err(_) = stream.read_exact(&mut payload_buf).await {
            break;
        }

        if let Ok(msg) = serde_json::from_slice::<SyncMessage>(&payload_buf) {
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
                SyncMessage::TaskToggled { capsule_id: _, item_id, completed } => {
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
                _ => {}
            }
        }
    }

    // Peer disconnected cleanup
    if let Some(pid) = current_peer_id {
        let mut inner = p2p_state.inner.write().await;
        inner.connected_peers.remove(&pid);
        drop(inner);

        let _ = app.emit("velco://p2p-peer-left", serde_json::json!({
            "peer_id": pid,
        }));
    }
}

async fn send_message_framed(stream: &mut TcpStream, msg: &SyncMessage) -> Result<(), std::io::Error> {
    let bytes = serde_json::to_vec(msg)?;
    let length = bytes.len() as u32;
    stream.write_all(&length.to_be_bytes()).await?;
    stream.write_all(&bytes).await?;
    stream.flush().await?;
    Ok(())
}

pub async fn broadcast_to_peers(p2p_state: &P2PState, msg: &SyncMessage) {
    let peers: Vec<SocketAddr> = {
        let inner = p2p_state.inner.read().await;
        inner.connected_peers.values().map(|p| p.addr).collect()
    };

    for addr in peers {
        let msg_clone = msg.clone();
        tokio::spawn(async move {
            if let Ok(mut stream) = TcpStream::connect(addr).await {
                let _ = send_message_framed(&mut stream, &msg_clone).await;
            }
        });
    }
}

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
