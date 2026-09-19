# Velco v0.3.2 — Terminology Harmonization, Fluid Transitions & Performance Polish

<p align="center">
  <img src="https://raw.githubusercontent.com/hernataramadhan79-bit/Velco/main/docs/assets/logo.png" width="120" height="120" alt="Velco Logo" />
</p>

<p align="center">
  <a href="https://github.com/hernataramadhan79-bit/Velco/releases/tag/v0.3.2">
    <img src="https://img.shields.io/badge/Release-v0.3.2-blue?style=for-the-badge&logo=github" alt="Version 0.3.2">
  </a>
  <img src="https://img.shields.io/badge/Status-Production%20Ready-emerald?style=for-the-badge" alt="Production Ready">
  <img src="https://img.shields.io/badge/Release%20Date-September%2020%2C%202026-black?style=for-the-badge" alt="Date">
</p>

---

## 🌟 Executive Release Summary

Velco **v0.3.2** delivers a complete architectural overhaul of feature terminology, buttery-smooth transition physics, and key scrolling performance fixes:
1. **Unified Feature Naming & Codebase Cleansing**: Eradicated legacy and mixed nomenclatures (*Foundry*, *Studio Workbench*, *Context Workstation*, *The Bridge*, *Context Hub*, *Chat Canvas*) in favor of three definitive pillars: **Workbench**, **Capsules**, and **Playground**. Updated all files, directories, store states, actions, UI labels, and shortcuts accordingly.
2. **Smooth Workbench Drawer Transition**: Replaced abrupt conditional unmounting with hardware-accelerated CSS width, opacity, and transform transitions (`transition-[width,opacity,transform]`), matching the fluid opening and closing animation of the main sidebar.
3. **Workbench Header & Icon Harmonization**: Standardized the trigger and panel iconography to the unified lightning bolt (`Zap`) icon, and removed redundant AI model indicators already present in the primary top bar.
4. **List Scrolling & Virtualization Performance**: Eliminated cascading re-render bottlenecks during item list scrolling by memoizing item selection callbacks (`handleSelectItem`) and stabilizing inline action handlers in `ItemCard` and `CapsulesView`.
5. **UI & Keyboard Shortcuts Polish**: Cleaned up the shortcut cheat sheet modal, Onboarding Overlay, and settings views to ensure a clutter-free, consistent user experience.

---

## 💾 Native Platform Installers & Binaries (v0.3.2)

| Operating System | Target Architecture | Distribution Type | File Size | Direct Download |
| :--- | :--- | :--- | :--- | :--- |
| **macOS Apple Silicon** | M1 / M2 / M3 / M4 (`aarch64`) | Apple Disk Image (`.dmg`) | **4.9 MB** | [Download `.dmg`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.2/Velco_0.3.2_aarch64.dmg) |
| **macOS Intel** | 64-bit Intel Core (`x86_64`) | Apple Disk Image (`.dmg`) | **5.3 MB** | [Download `.dmg`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.2/Velco_0.3.2_x64.dmg) |
| **Windows 10 / 11** | 64-bit (`x86_64`) | Setup Installer (`.exe`) | **3.9 MB** | [Download Setup `.exe`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.2/Velco_0.3.2_x64-setup.exe) |
| **Windows 10 / 11** | 64-bit (`x86_64`) | Enterprise Installer (`.msi`) | **5.3 MB** | [Download `.msi`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.2/Velco_0.3.2_x64_en-US.msi) |
| **Windows 10 / 11** | 64-bit (`x86_64`) | **Portable Standalone** (`velco.exe`) | **11.7 MB** | [Download `velco.exe`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.2/velco.exe) |
| **Linux (Universal)** | 64-bit (`x86_64`) | Standalone Package (`.AppImage`) | **82 MB** | [Download `.AppImage`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.2/Velco_0.3.2_amd64.AppImage) |
| **Linux (Debian / Ubuntu)** | 64-bit (`amd64`) | Debian Package (`.deb`) | **6.6 MB** | [Download `.deb`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.2/Velco_0.3.2_amd64.deb) |
| **Linux (Fedora / RHEL)** | 64-bit (`x86_64`) | RedHat Package (`.rpm`) | **6.6 MB** | [Download `.rpm`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.2/Velco-0.3.2-1.x86_64.rpm) |

---

# Velco v0.3.1 — Playground UI/UX Overhaul & Minimalist Navigation

<p align="center">
  <img src="https://raw.githubusercontent.com/hernataramadhan79-bit/Velco/main/docs/assets/logo.png" width="120" height="120" alt="Velco Logo" />
</p>

<p align="center">
  <a href="https://github.com/hernataramadhan79-bit/Velco/releases/tag/v0.3.1">
    <img src="https://img.shields.io/badge/Release-v0.3.1-blue?style=for-the-badge&logo=github" alt="Version 0.3.1">
  </a>
  <img src="https://img.shields.io/badge/Status-Production%20Ready-emerald?style=for-the-badge" alt="Production Ready">
  <img src="https://img.shields.io/badge/Release%20Date-September%2017%2C%202026-black?style=for-the-badge" alt="Date">
</p>

---

## 🌟 Executive Release Summary

Velco **v0.3.1** introduces a major UI/UX overhaul of the **Playground** environment and a streamlined desktop header navigation architecture:
1. **Symmetrical & Centered Empty State**: Eliminates the massive vertical void on new chats by uniting greeting, AI indicators, input dock, and prompt cards into a focused center stage.
2. **Minimalist & Adaptive Input Dock**: Redesigned chat input card with compact initial height (24px single-line), auto-expanding dynamically up to 220px for multi-line prompts, and pixel-aligned action buttons (`h-7` / 28px).
3. **Double Header Elimination**: Merged chat session history dropdown and quick New Chat controls directly into the top main header, saving vertical screen real estate.
4. **Streamlined Page Titles**: Replaced verbose file-explorer path breadcrumbs (`VELCO / WORKSTATION / ...`) with clean, elegant page titles (`Inbox`, `Playground`, `Tasks`, `Notes`, `Files`, `Settings`).

---

## 💾 Native Platform Installers & Binaries (v0.3.1)

| Operating System | Target Architecture | Distribution Type | File Size | Direct Download |
| :--- | :--- | :--- | :--- | :--- |
| **macOS Apple Silicon** | M1 / M2 / M3 / M4 (`aarch64`) | Apple Disk Image (`.dmg`) | **4.9 MB** | [Download `.dmg`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco_0.3.1_aarch64.dmg) |
| **macOS Intel** | 64-bit Intel Core (`x86_64`) | Apple Disk Image (`.dmg`) | **5.3 MB** | [Download `.dmg`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco_0.3.1_x64.dmg) |
| **Windows 10 / 11** | 64-bit (`x86_64`) | Setup Installer (`.exe`) | **3.9 MB** | [Download Setup `.exe`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco_0.3.1_x64-setup.exe) |
| **Windows 10 / 11** | 64-bit (`x86_64`) | Enterprise Installer (`.msi`) | **5.3 MB** | [Download `.msi`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco_0.3.1_x64_en-US.msi) |
| **Windows 10 / 11** | 64-bit (`x86_64`) | **Portable Standalone** (`velco.exe`) | **11.7 MB** | [Download `velco.exe`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/velco.exe) |
| **Linux (Universal)** | 64-bit (`x86_64`) | Standalone Package (`.AppImage`) | **82 MB** | [Download `.AppImage`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco_0.3.1_amd64.AppImage) |
| **Linux (Debian / Ubuntu)** | 64-bit (`amd64`) | Debian Package (`.deb`) | **6.6 MB** | [Download `.deb`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco_0.3.1_amd64.deb) |
| **Linux (Fedora / RHEL)** | 64-bit (`x86_64`) | RedHat Package (`.rpm`) | **6.6 MB** | [Download `.rpm`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.3.1/Velco-0.3.1-1.x86_64.rpm) |

---

# Velco v0.2.0 — Production Multi-Platform Release

<p align="center">
  <img src="https://raw.githubusercontent.com/hernataramadhan79-bit/Velco/main/docs/assets/logo.png" width="120" height="120" alt="Velco Logo" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Release-v0.2.0-blue?style=for-the-badge&logo=github" alt="Version 0.2.0">
  <img src="https://img.shields.io/badge/Status-Production%20Ready-emerald?style=for-the-badge" alt="Production Ready">
  <img src="https://img.shields.io/badge/Release%20Date-September%2013%2C%202026-black?style=for-the-badge" alt="Date">
</p>

---

## 🌟 Executive Release Summary

Velco **v0.2.0** marks the transition to a unified multi-platform desktop workstation. This release delivers native builds for **macOS** (both Apple Silicon M-Series and Intel Core), **Windows 10/11** (MSI, NSIS Setup, and standalone portable executable), and **Linux** (universal AppImage, Debian `.deb`, and RedHat `.rpm`).

In addition to universal binaries, v0.2.0 introduces a dedicated **P2P Join & Handshake interface**, addresses critical React 19 hook order constraints on multi-selection, enables macOS Hardened Runtime JIT compliance, and enhances horizontal scroll containment across all modal dialogs.

---

## 💾 Native Platform Installers & Binaries

| Operating System | Target Architecture | Distribution Type | File Size | Direct Download |
| :--- | :--- | :--- | :--- | :--- |
| **macOS Apple Silicon** | M1 / M2 / M3 / M4 (`aarch64`) | Apple Disk Image (`.dmg`) | **4.9 MB** | [Download `.dmg`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.2.0/Velco_0.2.0_aarch64.dmg) |
| **macOS Intel** | 64-bit Intel Core (`x86_64`) | Apple Disk Image (`.dmg`) | **5.3 MB** | [Download `.dmg`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.2.0/Velco_0.2.0_x64.dmg) |
| **Windows 10 / 11** | 64-bit (`x86_64`) | Setup Installer (`.exe`) | **3.9 MB** | [Download Setup `.exe`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.2.0/Velco_0.2.0_x64-setup.exe) |
| **Windows 10 / 11** | 64-bit (`x86_64`) | Enterprise Installer (`.msi`) | **5.3 MB** | [Download `.msi`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.2.0/Velco_0.2.0_x64_en-US.msi) |
| **Windows 10 / 11** | 64-bit (`x86_64`) | **Portable Standalone** (`velco.exe`) | **11.7 MB** | [Download `velco.exe`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.2.0/velco.exe) |
| **Linux (Universal)** | 64-bit (`x86_64`) | Standalone Package (`.AppImage`) | **82 MB** | [Download `.AppImage`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.2.0/Velco_0.2.0_amd64.AppImage) |
| **Linux (Debian / Ubuntu)** | 64-bit (`amd64`) | Debian Package (`.deb`) | **6.6 MB** | [Download `.deb`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.2.0/Velco_0.2.0_amd64.deb) |
| **Linux (Fedora / RHEL)** | 64-bit (`x86_64`) | RedHat Package (`.rpm`) | **6.6 MB** | [Download `.rpm`](https://github.com/hernataramadhan79-bit/Velco/releases/download/v0.2.0/Velco-0.2.0-1.x86_64.rpm) |

---

## 📸 Real UI Feature Highlights

### 1. Mode 1: Personal Workstation Stream
<p align="center">
  <img src="https://raw.githubusercontent.com/hernataramadhan79-bit/Velco/main/docs/assets/screenshots/01-personal-workstation.png" alt="Personal Workstation" width="100%" />
</p>

- High-throughput ingestion stream with keyboard shortcuts (`Cmd+K` for FTS5 search, `Cmd+J` for AI workbench).
- Virtualized list rendering maintaining a smooth 120 FPS experience across large databases.
- Due date reminder engine with native audio chime notifications.

### 2. Mode 2: Context Hub & Technical Kanban
<p align="center">
  <img src="https://raw.githubusercontent.com/hernataramadhan79-bit/Velco/main/docs/assets/screenshots/02-context-hub-kanban.png" alt="Context Hub Kanban" width="100%" />
</p>

- 3-column Kanban board (`To Do`, `Priority / In Progress`, `Completed`) with inline priority adjustments and instant SQLite status sync.
- Split-pane markdown documentation editor for technical specifications and architecture briefs.
- Active Capsule navigation with encryption key copy button and status chips.

### 3. P2P Collaboration & Join Handshake
<p align="center">
  <img src="https://raw.githubusercontent.com/hernataramadhan79-bit/Velco/main/docs/assets/screenshots/03-p2p-join-modal.png" alt="P2P Join Modal" width="100%" />
</p>

- Dual-tab connection modal supporting both **Invitation Key** tokens (`vctx_live_...`) and standalone `.vctx` file imports.
- Zero cloud servers required: automatic UDP multicast peer discovery on port `42426`.
- Real-time peer counter badge with pulsing status telemetry in the top header.

### 4. Floating Multi-Selection Action Bar
<p align="center">
  <img src="https://raw.githubusercontent.com/hernataramadhan79-bit/Velco/main/docs/assets/screenshots/04-selection-action-bar.png" alt="Selection Action Bar" width="100%" />
</p>

- Fixed hook execution order in `SelectionActionBar.tsx`, resolving Minified React Error #310.
- One-click actions to attach selected items to active AI chat context or stage to Studio Workbench.

---

## 🛠️ Detailed Changelog

### Context Hub & Air-Gapped P2P Collaboration
- **Explicit Join Button**: Placed prominent `Join` action button next to `+ New` in the Capsules navigation header.
- **Dual-Mode Handshake**:
  - `Invitation Key`: Paste secret peer key to immediately establish session link.
  - `File Import`: Drag-and-drop portable encrypted `.vctx` project archives.
- **Cryptographic Key Fingerprinting**: Backend discovery beacon matches on SHA-256 `key_hash` or `capsule_id`, enabling automatic pairing when peers click **Go Live**.
- **Framed TCP Sockets**: Zero-cloud synchronization of cards, task states, and markdown notes.

### Performance & Engine Stability
- **React 19 Hook Order Fix**: Moved `useMemo` above conditional returns in `SelectionActionBar.tsx` to satisfy React 19's Rules of Hooks.
- **macOS JIT Entitlements**: Configured `com.apple.security.cs.allow-jit` in `Entitlements.plist` to eliminate JavaScriptCore WebKit crashes on macOS Sonoma and Sequoia.
- **Safe Date Parsing**: Protected date formatting with fallback routines against WebKit `RangeError: Invalid time value`.
- **Viewport Lockdown**: Enforced strict horizontal scroll containment (`overflow-x-hidden` and `w-full max-w-full`) across all views and modals.

---

## 🔐 Verification & Security
- Embedded SQLite with Write-Ahead Logging (WAL) and `r2d2` connection pool.
- Air-gapped master AI kill switch prevents unauthorized IPC and network egress.
- Encrypted export bundles (`.vctx`) with ChaCha20-Poly1305 and Argon2 key derivation.
