use tauri::State;
use tokio::sync::broadcast;

use crate::database::Database;
use crate::p2p::{compute_key_hash, P2PState, P2PStatus, SyncMessage};

#[tauri::command]
pub async fn start_p2p_session(
    app: tauri::AppHandle,
    p2p_state: State<'_, P2PState>,
    db: State<'_, Database>,
    capsule_id: String,
) -> Result<P2PStatus, String> {
    // Cari encryption_key dari kapsul di SQLite
    let key: String = {
        let conn = db.read_pool.get().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT encryption_key FROM capsules WHERE id = ?1",
            rusqlite::params![capsule_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Capsule not found: {}", e))?
    };

    let key_hash = compute_key_hash(&key);

    // Hentikan sesi lama jika ada
    {
        let mut inner = p2p_state.inner.write().await;
        if let Some(ref sender) = inner.stop_sender {
            let _ = sender.send(());
        }
        inner.connected_peers.clear();
    }

    let (stop_tx, stop_rx1) = broadcast::channel::<()>(16);
    let stop_rx2 = stop_tx.subscribe();
    let stop_rx3 = stop_tx.subscribe();

    {
        let mut inner = p2p_state.inner.write().await;
        inner.is_active = true;
        inner.active_capsule_id = Some(capsule_id.clone());
        inner.encryption_key = Some(key);
        inner.key_hash = Some(key_hash);
        inner.stop_sender = Some(stop_tx);
    }

    // 1. Jalankan TCP listener
    let state_clone1 = p2p_state.inner.clone();
    let app_clone1 = app.clone();
    let _listen_port = crate::p2p::session::start_tcp_listener(
        app_clone1,
        P2PState { inner: state_clone1 },
        stop_rx1,
    )
    .await?;

    // 2. Jalankan UDP Beacon
    let state_clone2 = p2p_state.inner.clone();
    tokio::spawn(async move {
        crate::p2p::discovery::start_discovery_beacon(
            P2PState { inner: state_clone2 },
            stop_rx2,
        )
        .await;
    });

    // 3. Jalankan UDP Discovery Listener
    let state_clone3 = p2p_state.inner.clone();
    let app_clone2 = app.clone();
    tokio::spawn(async move {
        crate::p2p::discovery::start_discovery_listener(
            app_clone2,
            P2PState { inner: state_clone3 },
            stop_rx3,
        )
        .await;
    });

    get_p2p_status(p2p_state).await
}

#[tauri::command]
pub async fn stop_p2p_session(
    p2p_state: State<'_, P2PState>,
) -> Result<(), String> {
    let mut inner = p2p_state.inner.write().await;
    inner.is_active = false;
    inner.active_capsule_id = None;
    inner.encryption_key = None;
    inner.key_hash = None;
    if let Some(ref sender) = inner.stop_sender {
        let _ = sender.send(());
    }
    inner.connected_peers.clear();
    inner.stop_sender = None;
    Ok(())
}

#[tauri::command]
pub async fn get_p2p_status(
    p2p_state: State<'_, P2PState>,
) -> Result<P2PStatus, String> {
    let inner = p2p_state.inner.read().await;
    Ok(P2PStatus {
        is_active: inner.is_active,
        active_capsule_id: inner.active_capsule_id.clone(),
        peer_id: inner.peer_id.clone(),
        device_name: inner.device_name.clone(),
        listen_port: inner.listen_port,
        connected_peers: inner.connected_peers.values().cloned().collect(),
    })
}

#[tauri::command]
pub async fn broadcast_p2p_item_upsert(
    p2p_state: State<'_, P2PState>,
    capsule_id: String,
    item_id: String,
    item_type: String,
    title: String,
    content: String,
    priority: Option<String>,
    completed: Option<bool>,
    due_date: Option<String>,
) -> Result<(), String> {
    let inner = p2p_state.inner.read().await;
    if !inner.is_active || inner.active_capsule_id.as_deref() != Some(&capsule_id) {
        return Ok(());
    }

    let msg = SyncMessage::ItemUpserted {
        capsule_id,
        item_id,
        item_type,
        title,
        content,
        priority,
        completed,
        due_date,
    };

    drop(inner);
    crate::p2p::session::broadcast_to_peers(&p2p_state, &msg).await;
    Ok(())
}

#[tauri::command]
pub async fn broadcast_p2p_task_toggle(
    p2p_state: State<'_, P2PState>,
    capsule_id: String,
    item_id: String,
    completed: bool,
) -> Result<(), String> {
    let inner = p2p_state.inner.read().await;
    if !inner.is_active || inner.active_capsule_id.as_deref() != Some(&capsule_id) {
        return Ok(());
    }

    let msg = SyncMessage::TaskToggled {
        capsule_id,
        item_id,
        completed,
    };

    drop(inner);
    crate::p2p::session::broadcast_to_peers(&p2p_state, &msg).await;
    Ok(())
}

#[tauri::command]
pub async fn broadcast_p2p_item_removed(
    p2p_state: State<'_, P2PState>,
    capsule_id: String,
    item_id: String,
) -> Result<(), String> {
    let inner = p2p_state.inner.read().await;
    if !inner.is_active || inner.active_capsule_id.as_deref() != Some(&capsule_id) {
        return Ok(());
    }

    let msg = SyncMessage::ItemRemoved {
        capsule_id,
        item_id,
    };

    drop(inner);
    crate::p2p::session::broadcast_to_peers(&p2p_state, &msg).await;
    Ok(())
}
