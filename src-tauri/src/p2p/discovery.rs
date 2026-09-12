use std::net::SocketAddr;
use std::time::Duration;
use tokio::net::UdpSocket;
use tokio::sync::broadcast;

use super::{PeerBeacon, P2PState};

pub const UDP_DISCOVERY_PORT: u16 = 42426;

pub async fn start_discovery_beacon(
    p2p_state: P2PState,
    mut stop_rx: broadcast::Receiver<()>,
) {
    let socket = match UdpSocket::bind("0.0.0.0:0").await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[P2P Beacon] Failed to bind UDP socket: {}", e);
            return;
        }
    };

    if let Err(e) = socket.set_broadcast(true) {
        eprintln!("[P2P Beacon] Failed to enable UDP broadcast: {}", e);
        return;
    }

    let broadcast_addr: SocketAddr = format!("255.255.255.255:{}", UDP_DISCOVERY_PORT)
        .parse()
        .unwrap();

    let mut interval = tokio::time::interval(Duration::from_millis(1500));

    loop {
        tokio::select! {
            _ = stop_rx.recv() => {
                break;
            }
            _ = interval.tick() => {
                let inner = p2p_state.inner.read().await;
                if !inner.is_active {
                    break;
                }

                if let (Some(ref cap_id), Some(ref k_hash)) = (&inner.active_capsule_id, &inner.key_hash) {
                    let beacon = PeerBeacon {
                        peer_id: inner.peer_id.clone(),
                        capsule_id: cap_id.clone(),
                        key_hash: k_hash.clone(),
                        port: inner.listen_port,
                        device_name: inner.device_name.clone(),
                    };

                    if let Ok(bytes) = serde_json::to_vec(&beacon) {
                        let _ = socket.send_to(&bytes, broadcast_addr).await;
                    }
                }
            }
        }
    }
}

pub async fn start_discovery_listener(
    app: tauri::AppHandle,
    p2p_state: P2PState,
    mut stop_rx: broadcast::Receiver<()>,
) {
    let socket = match UdpSocket::bind(format!("0.0.0.0:{}", UDP_DISCOVERY_PORT)).await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[P2P Discovery] Failed to bind discovery listener port {}: {}", UDP_DISCOVERY_PORT, e);
            return;
        }
    };

    let mut buf = [0u8; 2048];

    loop {
        tokio::select! {
            _ = stop_rx.recv() => {
                break;
            }
            res = socket.recv_from(&mut buf) => {
                match res {
                    Ok((len, sender_addr)) => {
                        if let Ok(beacon) = serde_json::from_slice::<PeerBeacon>(&buf[..len]) {
                            handle_incoming_beacon(&app, &p2p_state, beacon, sender_addr).await;
                        }
                    }
                    Err(e) => {
                        eprintln!("[P2P Discovery] Receive error: {}", e);
                    }
                }
            }
        }
    }
}

async fn handle_incoming_beacon(
    app: &tauri::AppHandle,
    p2p_state: &P2PState,
    beacon: PeerBeacon,
    sender_addr: SocketAddr,
) {
    let (my_peer_id, active_cap, my_key_hash) = {
        let inner = p2p_state.inner.read().await;
        if !inner.is_active {
            return;
        }
        (inner.peer_id.clone(), inner.active_capsule_id.clone(), inner.key_hash.clone())
    };

    // Abaikan beacon dari diri sendiri
    if beacon.peer_id == my_peer_id {
        return;
    }

    // Pastikan capsule dan key fingerprint cocok
    if let (Some(ref my_cap), Some(ref my_hash)) = (active_cap, my_key_hash) {
        if beacon.capsule_id == *my_cap && beacon.key_hash == *my_hash {
            let mut target_addr = sender_addr;
            target_addr.set_port(beacon.port);

            let already_connected = {
                let inner = p2p_state.inner.read().await;
                inner.connected_peers.contains_key(&beacon.peer_id)
            };

            if !already_connected {
                // Sambungkan TCP session
                let app_clone = app.clone();
                let state_clone = p2p_state.clone();
                let peer_id_clone = beacon.peer_id.clone();
                let device_name_clone = beacon.device_name.clone();

                tokio::spawn(async move {
                    super::session::connect_to_peer(
                        app_clone,
                        state_clone,
                        peer_id_clone,
                        device_name_clone,
                        target_addr,
                    ).await;
                });
            }
        }
    }
}
