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

    let broadcast_addr: SocketAddr = "255.255.255.255:42426"
        .parse()
        .expect("valid broadcast addr literal");

    let mut interval = tokio::time::interval(Duration::from_millis(1500));

    loop {
        tokio::select! {
            _ = stop_rx.recv() => { break; }
            _ = interval.tick() => {
                let inner = p2p_state.inner.read().await;
                if !inner.is_active {
                    break;
                }

                if let (Some(ref cap_id), Some(ref mac_key)) = (&inner.active_capsule_id, &inner.beacon_mac_key) {
                    use std::time::{SystemTime, UNIX_EPOCH};
                    let beacon_ts = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs();

                    let beacon_mac = super::sign_beacon(mac_key, cap_id, beacon_ts);

                    let beacon = PeerBeacon {
                        peer_id: inner.peer_id.clone(),
                        capsule_id: cap_id.clone(),
                        beacon_mac,
                        beacon_ts,
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
            _ = stop_rx.recv() => { break; }
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
    let (my_peer_id, active_cap, beacon_mac_key) = {
        let inner = p2p_state.inner.read().await;
        if !inner.is_active {
            return;
        }
        (
            inner.peer_id.clone(),
            inner.active_capsule_id.clone(),
            inner.beacon_mac_key,
        )
    };

    // Ignore our own beacon
    if beacon.peer_id == my_peer_id {
        return;
    }

    // ── Strict capsule + HMAC-MAC verification (AND, not OR) ─────────────────
    //
    // Old code used:  beacon.key_hash == *my_hash || beacon.capsule_id == *my_cap
    //
    // This was a CRITICAL bug: knowing the capsule_id alone (e.g. from a .vctx export)
    // was enough to bypass the "key" check.
    //
    // New code: capsule_id must match AND beacon_mac must be cryptographically valid.
    // An attacker who only knows the capsule_id cannot forge a valid beacon_mac without
    // also knowing the vault key (from which beacon_mac_key is derived via HKDF).
    if let (Some(ref my_cap), Some(ref mac_key)) = (active_cap, beacon_mac_key) {
        // 1. capsule_id must match
        if beacon.capsule_id != *my_cap {
            return;
        }

        // 2. HMAC-SHA256 must verify (also validates timestamp for replay protection)
        if !super::verify_beacon(mac_key, &beacon.capsule_id, beacon.beacon_ts, &beacon.beacon_mac) {
            eprintln!(
                "[P2P Discovery] Beacon from {} rejected: invalid MAC or timestamp",
                sender_addr
            );
            return;
        }

        // ── Passed — connect if not already connected ─────────────────────────
        let mut target_addr = sender_addr;
        target_addr.set_port(beacon.port);

        let already_connected = {
            let inner = p2p_state.inner.read().await;
            inner.connected_peers.contains_key(&beacon.peer_id)
        };

        if !already_connected {
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
                )
                .await;
            });
        }
    }
}
