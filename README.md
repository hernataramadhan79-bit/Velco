<p align="center">
  <img src="docs/assets/logo.png" width="120" height="120" alt="Velco Logo" />
</p>

<h1 align="center">Velco</h1>

<p align="center">
  <strong>The Local-First, Context-Bound AI Workstation &amp; Knowledge OS</strong><br>
  <em>Grounded context synthesis &bull; Embedded SQLite storage &bull; Air-gapped LAN collaboration &bull; Zero cloud telemetry</em>
</p>

<p align="center">
  <a href="https://github.com/hernataramadhan79-bit/Velco/releases/latest">
    <img src="https://img.shields.io/badge/Release-v0.3.1-blue?style=for-the-badge&logo=github" alt="Version 0.3.1">
  </a>
  <a href="#-multi-platform-downloads-v031">
    <img src="https://img.shields.io/badge/Platforms-Windows%20%7C%20macOS%20%7C%20Linux-10b981?style=for-the-badge&logo=apple" alt="Platforms">
  </a>
  <a href="https://v2.tauri.app">
    <img src="https://img.shields.io/badge/Tauri-v2-f97316?style=for-the-badge&logo=tauri" alt="Tauri v2">
  </a>
  <a href="https://www.rust-lang.org">
    <img src="https://img.shields.io/badge/Rust-2021-000000?style=for-the-badge&logo=rust" alt="Rust">
  </a>
  <a href="https://react.dev">
    <img src="https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react" alt="React 19">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-gray?style=for-the-badge" alt="License">
  </a>
</p>

---

## 💾 Multi-Platform Downloads (v0.3.1)

Official signed packages and portable binaries compiled via automated multi-architecture GitHub Actions:

| Platform | Architecture | Format | Size | Direct Download |
| :--- | :--- | :--- | :--- | :--- |
| **macOS (Apple Silicon)** | M1 / M2 / M3 / M4 (`aarch64`) | Apple Disk Image (`.dmg`) | **4.9 MB** | [Download `.dmg`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco_0.3.1_aarch64.dmg) |
| **macOS (Intel Core)** | Intel 64-bit (`x86_64`) | Apple Disk Image (`.dmg`) | **5.3 MB** | [Download `.dmg`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco_0.3.1_x64.dmg) |
| **Windows 10 / 11** | 64-bit (`x86_64`) | Setup Installer (`.exe`) | **3.9 MB** | [Download Setup `.exe`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco_0.3.1_x64-setup.exe) |
| **Windows 10 / 11** | 64-bit (`x86_64`) | Enterprise Installer (`.msi`) | **5.3 MB** | [Download `.msi`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco_0.3.1_x64_en-US.msi) |
| **Windows 10 / 11** | 64-bit (`x86_64`) | **Portable Standalone** (`velco.exe`) | **11.7 MB** | [Download `velco.exe`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/velco.exe) |
| **Linux (Universal)** | 64-bit (`x86_64`) | Standalone Package (`.AppImage`) | **82 MB** | [Download `.AppImage`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco_0.3.1_amd64.AppImage) |
| **Linux (Ubuntu / Debian)** | 64-bit (`amd64`) | Debian Package (`.deb`) | **6.6 MB** | [Download `.deb`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco_0.3.1_amd64.deb) |
| **Linux (Fedora / RHEL)** | 64-bit (`x86_64`) | RedHat Package (`.rpm`) | **6.6 MB** | [Download `.rpm`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco-0.3.1-1.x86_64.rpm) |

> 📖 **Deep-Dive Audits & Technical Documentation**:
> - [Comprehensive UI/UX Review & Design System Audit](docs/UI_UX_REVIEW.md)
> - [Official Release Notes & Technical Changelog](RELEASE_NOTES.md)

---

## 📸 Visual Interface Previews

All screenshots are captured directly from live desktop builds running the obsidian industrial dark theme (`#09090b`):

### 1. Mode 1: Personal Workstation (Instant Capture & Virtualized Stream)
High-density knowledge stream featuring rapid capture docks, automatic markdown parsing, priority chips, tag taxonomy, due dates, and virtualized scrolling handling 10,000+ items with zero compositor lag:

<p align="center">
  <img src="docs/assets/screenshots/01-personal-workstation.png" alt="Velco Personal Workstation UI" width="100%" />
</p>

### 2. Mode 2: The Bridge Context Hub (3-Column Technical Kanban)
Project-scoped encapsulation via **Capsules**. Features an integrated 3-column Kanban board (`To Do`, `In Progress`, `Completed`), live peer connection badges, vault keys, and split-pane markdown specification documentation:

<p align="center">
  <img src="docs/assets/screenshots/02-context-hub-kanban.png" alt="Velco The Bridge Context Hub Kanban" width="100%" />
</p>

### 3. Air-Gapped P2P Collaboration & Join Handshake
Zero-cloud peer synchronization over local Wi-Fi / LAN. Connect via **Peer Invitation Key** (`vctx_live_...`) or import encrypted `.vctx` project bundles with automatic UDP beacon discovery:

<p align="center">
  <img src="docs/assets/screenshots/03-p2p-join-modal.png" alt="Velco P2P Join Modal" width="100%" />
</p>

### 4. Floating Multi-Selection & AI Staging Dock
Select one or more items to reveal the floating action bar. Attach artifacts directly into active LLM prompt context or stage to Studio Workbench (`The Foundry`) with unconditional React 19 hook safety:

<p align="center">
  <img src="docs/assets/screenshots/04-selection-action-bar.png" alt="Velco Floating Selection Action Bar" width="100%" />
</p>

---

## ⚡ Key Architectural Capabilities

### 🌉 Dual-Mode Core Architecture
- **Personal Workstation**: Ad-hoc ingestion stream, quick capture (`todo: ...`, URLs, notes, files), full-text search (`Cmd+K`), and overdue notification chimes.
- **The Bridge (Context Hub)**: Structured project capsules, technical Kanban boards, live P2P mesh sockets, and AI synthesis recipes.

### 🔒 Air-Gapped P2P LAN Collaboration
- **Zero Cloud Servers**: Synchronization happens directly between peer machines over local Wi-Fi or wired ethernet.
- **UDP Discovery + Framed TCP Streaming**: Automatic peer discovery on UDP port `42426`, followed by bidirectional length-prefixed TCP socket synchronization.
- **Cryptographic Frame Encryption**: All TCP sync traffic is encrypted with **XChaCha20-Poly1305** AEAD (fresh 24-byte nonce per frame). Keys are derived from the vault key via **HKDF-SHA256** — a peer without the correct vault key cannot decrypt any frame.
- **Challenge-Response Auth Handshake**: Before any data is exchanged, a 5-second HMAC-SHA256 challenge-response proves mutual possession of the vault key. Unauthenticated TCP connections are dropped immediately.
- **Signed UDP Beacons**: Discovery beacons are signed with HMAC-SHA256 and include a timestamp. Beacons older than 30 seconds (replay attacks) or with invalid MACs are silently rejected.

### 🤖 Grounded Studio Workbench (The Foundry)
- **Bounded Context Synthesis**: Run AI recipes exclusively bounded to staged notes and tasks.
- **Bring Your Own Model**: Connect directly to local air-gapped runtimes (**Ollama**, **LM Studio**) or cloud APIs (**OpenRouter**, **OpenAI**, **Anthropic**, **Gemini**, **Groq**).
- **Master AI Kill-Switch**: Disable AI globally with one toggle in the header or settings — zero network egress or IPC calls when turned off.

### 💾 Local-First Embedded SQLite Engine
- Native SQLite database with **WAL mode (Write-Ahead Logging)** and connection pooling.
- **FTS5 Tokenized Full-Text Search**: Instant search across titles, notes, task contents, and metadata in under 2ms.

---

## 🛠️ Installation & Setup Guide

### macOS (Apple Silicon & Intel)
1. Download the `.dmg` corresponding to your Mac:
   - **M1 / M2 / M3 / M4**: `Velco_0.3.1_aarch64.dmg`
   - **Intel Core**: `Velco_0.3.1_x64.dmg`
2. Open the disk image and drag **Velco** to your **Applications** folder.
3. *First Launch Note*: If macOS displays a Gatekeeper prompt ("cannot be opened because the developer cannot be verified"), right-click the app and choose **Open**, or run the following command in Terminal:
   ```bash
   xattr -cr /Applications/Velco.app
   ```

### Windows 10 / 11
- **Setup Installer**: Run `Velco_0.3.1_x64-setup.exe` or `Velco_0.3.1_x64_en-US.msi`.
- **Portable Standalone**: Download `velco.exe` and run it directly without any installation or administrator privileges.

### Linux (Ubuntu, Debian, Fedora, Arch)
- **Standalone AppImage**:
  ```bash
  chmod +x Velco_0.3.1_amd64.AppImage
  ./Velco_0.3.1_amd64.AppImage
  ```
- **Debian / Ubuntu Package**:
  ```bash
  sudo dpkg -i Velco_0.3.1_amd64.deb
  ```
- **Fedora / RHEL Package**:
  ```bash
  sudo rpm -i Velco-0.3.1-1.x86_64.rpm
  ```

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>K</kbd> | Toggle Global Full-Text Search (FTS5) | Global |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>J</kbd> | Toggle Studio Workbench (The Foundry) | Global |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>B</kbd> | Toggle Left Navigation Sidebar | Workstation |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>,</kbd> | Open Settings & AI Configuration | Global |
| <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Enter</kbd> | Save Quick Capture Note / Task | Capture Dock |
| <kbd>Esc</kbd> | Dismiss Active Modal / Clear Staging | Global |

---

## 🏗️ Technical Stack

| Layer | Technology | Function |
| :--- | :--- | :--- |
| **Desktop Shell** | [Tauri v2](https://v2.tauri.app/) (Rust 2021) | Native OS integration, minimal memory overhead (~35MB idle) |
| **UI Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Concurrent rendering, strict hook safety, type soundness |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | Native CSS engine, obsidian industrial tokens, zero-lag scrims |
| **Icons** | [Lucide React](https://lucide.dev/) | Consistent 1.5px stroke geometric iconography |
| **Local Storage** | [SQLite](https://sqlite.org/) + [Rusqlite](https://github.com/rusqlite/rusqlite) | Local-first persistence, FTS5 tokenizer, WAL concurrency |
| **P2P Networking** | Native Rust UDP & TCP | Port 42426 multicast beacon, length-prefixed framed streams |
| **Crypto / P2P** | XChaCha20-Poly1305 + HKDF-SHA256 + HMAC-SHA256 | Frame encryption, key derivation, beacon auth, challenge-response handshake |

---

## 📄 License

Velco is released under the open-source **[MIT License](LICENSE)**. Designed for private, context-bound engineering workflows.
