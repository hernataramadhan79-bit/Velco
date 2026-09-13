# Velco Release Notes

## [v0.2.0] — Multi-Platform Production Release

**Release Date**: September 13, 2026  
**Platforms**: Windows (x64), macOS (Apple Silicon M-Series & Intel), Linux (Debian/Ubuntu/AppImage)

---

### Highlights

- **Universal Multi-Platform Support**: Official native installers and binaries for **Windows** (`.exe` / `.msi` & portable `velco.exe`), **macOS** (`.dmg` for Apple Silicon M1-M4 and Intel), and **Linux** (`.deb` and `.AppImage`).
- **P2P Collaboration Revamped**: Dedicated **`Join`** button in Context Hub, dual-tab join modal (Invitation Key handshake vs `.vctx` file import), and auto-discovery across local Wi-Fi / LAN without cloud servers.
- **Hook Order Stability (React 19)**: Eliminated Minified React Error #310 on multi-selection by enforcing strict, unconditional hook execution in `SelectionActionBar` and defensive `ErrorBoundary` containment.
- **Zero WebKit Glitches**: Full macOS Sonoma & Sequoia compliance with Hardened Runtime JIT entitlements and GPU-accelerated compositing scrims replacing buggy WebKit backdrop blurs.
- **Industrial Minimalist UI/UX**: Cleaned from decorative slop, redundant buttons, and excessive spacing. Ultra-high information density for engineering and AI synthesis workflows.

---

### Downloads by Operating System

| Platform | Architecture | Installer Type | Direct File |
| :--- | :--- | :--- | :--- |
| **Windows 10 / 11** | 64-bit (x86_64) | Setup Installer | `Velco_0.2.0_x64-setup.exe` / `.msi` |
| **Windows 10 / 11** | 64-bit (x86_64) | Standalone Portable | `velco.exe` |
| **macOS (Apple Silicon)** | M1 / M2 / M3 / M4 (`aarch64`) | Apple Disk Image | `Velco_0.2.0_aarch64.dmg` |
| **macOS (Intel)** | Intel Core (`x86_64`) | Apple Disk Image | `Velco_0.2.0_x64.dmg` |
| **Linux (Ubuntu/Debian)** | 64-bit (`x86_64`) | Debian Package | `velco_0.2.0_amd64.deb` |
| **Linux (Universal)** | 64-bit (`x86_64`) | Standalone AppImage | `Velco_0.2.0_amd64.AppImage` |

---

### Detailed Changelog

#### Context Hub (The Bridge) & P2P LAN Collaboration
- **Explicit Join UI**: Added visible `Join` button in the Capsules sidebar header alongside `+ New`.
- **Dual-Mode Handshake**:
  - `Invitation Key`: Paste secret peer key (`vctx_live_...`) to connect instantly.
  - `File Import`: Select or drag-and-drop `.vctx` portable project archives.
- **Cryptographic Key Fingerprinting**: Backend discovery beacon matches on `key_hash` or `capsule_id`, enabling immediate automatic pairing when both peers click **Go Live**.
- **Real-Time Kanban Sync**: Framed TCP sockets synchronize card moves, task completions, and markdown documentation notes with zero cloud telemetry.

#### Performance & Stability
- **React Hook Order Fix**: Moved `useMemo` above conditional early returns in `SelectionActionBar.tsx` to satisfy React 19's Rules of Hooks.
- **Defensive Error Boundaries**: Wrapped `SelectionActionBar`, `ItemDetailModal`, `GlobalSearchModal`, and view roots with isolated error boundaries.
- **macOS JIT Entitlements**: Added `com.apple.security.cs.allow-jit` and memory unprotection flags in `Entitlements.plist` for JavaScriptCore WebKit engine stability.
- **Safe Date Formatter**: Protected date parsing with fallback routines against WebKit `RangeError: Invalid time value`.

#### User Experience
- High-contrast obsidian dark theme (`#09090b`) and clean slate light theme.
- Keyboard-first command palette (`Cmd+K` / `Ctrl+K`), Studio Workbench drawer (`Cmd+J` / `Ctrl+J`), and collapsible sidebar (`Cmd+B` / `Ctrl+B`).
- Native system notification chime for scheduled due date alerts.
