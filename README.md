# Velco

<p align="center">
  <strong>The Local-First, Context-Bound AI Workstation &amp; Knowledge OS</strong><br>
  <em>Grounded synthesis. Local SQLite storage. P2P air-gapped sync. Zero-emoji industrial minimalist design.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Tauri-v2-orange?style=flat-square" alt="Tauri v2">
  <img src="https://img.shields.io/badge/Rust-2021-black?style=flat-square" alt="Rust">
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square" alt="TypeScript">
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square" alt="Tailwind CSS v4">
  <img src="https://img.shields.io/badge/Database-SQLite%20(FTS5)-003b57?style=flat-square" alt="SQLite">
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License">
</p>

---

## 1. Overview

**Velco** is a high-performance desktop workstation engineered for developers, researchers, and technical power users who require total data privacy, instantaneous responsiveness, and deliberate, context-bound AI interaction.

Inspired by the precision aesthetics of **Linear, Cursor, Raycast, and LM Studio**, Velco replaces web-bloat, decorative emojis, and generic chatbots with a focused, industrial minimalist desktop experience. All data remains 100% local on your physical drive in an embedded SQLite database optimized with FTS5 tokenized full-text indexing, WAL mode, and connection pooling.

Velco operates in two dedicated modes:
1. **Personal Workspace**: Rapid-capture inbox, date-partitioned streams, task triage, markdown documentation, and drag-and-drop file vaulting.
2. **Context Hub (The Bridge)**: Project-scoped context encapsulation via **Capsules**, 3-column Kanban workflow boards, split-pane Markdown documentation, AI synthesis recipes, encrypted `.vctx` packaging, and local P2P LAN collaboration.

---

## 2. Core Capabilities

### 🌉 Context Hub (The Bridge)
- **Isolated Project Capsules**: Encapsulate notes, deliverables, files, and intelligence into self-contained project units with role boundaries and encryption keys.
- **Kanban Board & High-Density Task Lists**:
  - 3-column board (`To Do`, `Priority / In Progress`, `Completed`) or unified list view.
  - Granular priority management (`Low`, `Medium`, `High`, `Urgent`) with inline quick-add, due date pickers, and instant completion toggles.
- **Briefs & Docs (Split Reader & Full Editor)**:
  - Dual-pane navigation with real-time markdown rendering and split full editor.
  - Zero content truncation: displays and edits complete markdown specifications with syntax-highlighted code blocks, tables, and task lists.
- **Capsule Intelligence Recipes**:
  - **Multi-Perspective Synthesis**: Synthesizes all staged capsule assets into structured executive briefings.
  - **Action Matrix Extraction**: Mines deliverables, milestones, and dependencies across all capsule items.
  - **Gap Analysis**: Detects blindspots, unassigned requirements, and technical inconsistencies.
  - Direct 1-click writeback as a permanent note inside the active capsule.
- **Lossless Encrypted Capsules (`.vctx`)**:
  - Export and import standalone `.vctx` bundles with ChaCha20-Poly1305 / Argon2 encryption.
  - Retains 100% fidelity: full note contents, task states, due dates, priority tiers, and attachments without data loss.
- **Air-Gapped P2P LAN Collaboration**:
  - Zero-cloud local mesh sync powered by native Rust UDP multicast discovery and encrypted TCP session streaming.
  - Real-time peer counter and port telemetry for private team sessions.

### ⚡ Context-Bound Grounded Intelligence
- **Context Cart & Staging Deck**: Multi-select any combination of notes, tasks, files, and web links into an active staging tray with real-time token budgeting (~4 chars/token heuristic).
- **Studio Workbench (The Foundry)**:
  - Dockable or expandable dual-pane workbench (`Ctrl+J`) for continuous AI collaboration.
  - Run structured recipes (Synthesis, Task Mining, Taxonomy Triage, Custom Prompts) bounded exclusively to staged context.
- **Relational Entity Write-Back**: Generated tasks, notes, and tags write back directly into SQLite tables (`items`, `tasks`, `tags`, `items_fts`) via native Rust commands.

### 🤖 Bring Your Own AI (Local + Cloud + Multimodal)
- **100% On-Device Private Inference**:
  - **Ollama** (`http://127.0.0.1:11434`) — completely air-gapped, zero external egress.
  - **LM Studio** (`http://127.0.0.1:1234`) — OpenAI-compatible local server.
- **Cloud AI Providers**:
  - **OpenRouter**: Access hundreds of models with live pricing, context metrics, and curated free models.
  - **OpenAI, Google Gemini, Anthropic Claude, Groq**, or any custom OpenAI-compatible endpoint.
- **Multimodal Vision AI**:
  - Drag and drop images or paste clipboard screenshots directly into chat for visual context analysis.
- **Defense-in-Depth Privacy Switch**:
  - Hardware-level AI Master Switch in Settings and header telemetry badge.
  - When disabled, **zero IPC requests or outbound network packets** are dispatched to any model.
  - Deterministic offline heuristics automatically take over task extraction and URL parsing.

### 📥 Universal Fast Capture
- **Rapid Ingestion Dock**: Capture notes, tasks, code snippets, links, and binary attachments without waiting for AI processing.
- **Heuristic Classifier**: Instantly detects markdown checkboxes, task deadlines, and URLs locally via regex before database insertion.
- **File Vault**: Drag-and-drop file attachments with automatic file-hash verification, size tracking, and local storage isolation.

### 🔍 Instant Full-Text Search (FTS5)
- Zero-latency, tokenized full-text search across titles, notes, task contents, and tag taxonomy.
- Global trigger via `Ctrl+K` / `Cmd+K`.

### 🎨 Dual-Theme Industrial Minimalist Design
- **Obsidian Dark & Crisp Light**: Deep obsidian palette (`#09090b`, `#0d0d10`, `#141418`) paired with a high-contrast, clean light mode.
- **Tailwind CSS v4 Native Engine**: Modern `@custom-variant dark`, minimalist 5px scrollbars, and zero-emoji vector iconography via `lucide-react`.
- **Viewport & Scroll Lockdown**: Strict horizontal overflow containment across all views and modals prevents layout shifting or horizontal wobble during vertical scroll.

---

## 3. Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Desktop Shell** | [Tauri v2](https://v2.tauri.app/) (Rust 2021) | Native OS wrapper, low memory footprint, zero Chromium overhead |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | Concurrent rendering, type safety, modular component hierarchy |
| **Styling & Design** | [Tailwind CSS v4](https://tailwindcss.com/) | Native CSS engine, design tokens, dual-theme dark/light variants |
| **Icons & Symbols** | [Lucide React](https://lucide.dev/) | Consistent, crisp 1.5px stroke vector icons (Zero Emoji standard) |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) | Lightweight, decoupled global stores with local persistence |
| **Database & Search** | [SQLite](https://sqlite.org/) via [Rusqlite](https://github.com/rusqlite/rusqlite) | Embedded local storage with FTS5 tokenization, WAL mode, r2d2 pool |
| **Networking & Streaming** | [Reqwest](https://github.com/seanmonstar/reqwest) + [Tokio](https://tokio.rs/) | Async runtime, Server-Sent Events (SSE) AI streaming |
| **P2P Collaboration** | Native Rust UDP & TCP | Multicast LAN peer discovery and encrypted socket communication |
| **Security & Vault** | [Keyring](https://crates.io/crates/keyring) + ChaCha20 | OS credential storage and encrypted `.vctx` archive packaging |
| **Bundler & Tooling** | [Vite](https://vite.dev/) + [Cargo](https://doc.rust-lang.org/cargo/) | Instant HMR development and optimized production compilation |

---

## 4. Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> / <kbd>Cmd</kbd> + <kbd>K</kbd> | Toggle Global Search (FTS5) | Global |
| <kbd>Ctrl</kbd> + <kbd>J</kbd> / <kbd>Cmd</kbd> + <kbd>J</kbd> | Toggle Studio Workbench (The Foundry) | Global |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> / <kbd>Cmd</kbd> + <kbd>B</kbd> | Toggle Left Sidebar | Personal Mode |
| <kbd>Ctrl</kbd> + <kbd>,</kbd> | Open Settings & Workstation | Global |
| <kbd>Esc</kbd> | Close Modal / Return to Workspace | Global |
| <kbd>Enter</kbd> | Send Chat Prompt / Confirm Action | Inputs & Chat |
| <kbd>Shift</kbd> + <kbd>Enter</kbd> | Insert Newline | Multiline Editors |

---

## 5. Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0 or newer)
- [Rust](https://rustup.rs/) (latest stable toolchain)
- Platform C++ build tools (e.g., Visual Studio C++ Build Tools on Windows, Xcode Command Line Tools on macOS)

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/hernataramadhan79-bit/Velco.git
cd Velco

# Install dependencies
npm install

# Run in desktop development mode (Tauri v2 + Vite HMR)
npm run tauri dev
```

### Production Compilation

```bash
# Type check and build frontend assets
npm run build

# Build standard desktop production installer (MSI / NSIS / DMG / AppImage)
npm run tauri build

# Build standalone portable Windows binary (generates ./velco.exe)
npm run build:exe
```

The compiled standalone executable is emitted at the project root as `velco.exe`.

---

## 6. Architecture & Directory Structure

```
Velco/
├── src/                          # React 19 + TypeScript Frontend
│   ├── components/               # Modular UI components
│   │   ├── capture/              # Universal Capture Dock & Spotlight
│   │   ├── chat/                 # Landing Hero AI Chat & streaming UI
│   │   ├── common/               # Modals, MarkdownViewer, FocusTrap, EmptyStates
│   │   ├── inbox/                # Date-grouped inbox stream & filters
│   │   ├── items/                # Item cards, detail modal, tag recommender
│   │   ├── layout/               # Header, Sidebar, AIPrivacyBadge, AppLayout
│   │   ├── tasks/                # Task extraction modal, due date pickers
│   │   └── workstation/          # The Foundry (Studio Workbench context deck)
│   ├── features/                 # Flagship workstation views
│   │   ├── archive/              # Archived items browser
│   │   ├── bridge/               # Context Hub (The Bridge): Capsules, Kanban, Notes
│   │   ├── files/                # File vault & lightbox viewer
│   │   ├── inbox/                # Ingestion view & chat stream
│   │   ├── notes/                # Long-form markdown notes view
│   │   ├── playground/           # Unbound AI playground canvas
│   │   ├── search/               # Global FTS5 search modal
│   │   ├── settings/             # Settings, BYOK keys, model selector
│   │   ├── tags/                 # Tag taxonomy manager
│   │   └── trash/                # Soft-delete trash manager
│   ├── hooks/                    # Custom React hooks (useDebounce, useFocusTrap)
│   ├── services/                 # AI streaming service, reminders, IPC callers
│   ├── stores/                   # Zustand stores (items, capsule, chat, settings)
│   ├── types/                    # Domain data contracts (capsule, item, provider)
│   ├── utils/                    # Date formatters, token heuristics, sanitizers
│   ├── index.css                 # Design tokens, scroll containment, Tailwind v4
│   └── App.tsx                   # Workstation root application shell
├── src-tauri/                    # Rust Native Core
│   ├── src/
│   │   ├── ai/                   # Multi-provider streaming HTTP engine & state
│   │   ├── commands/             # Tauri IPC command controllers
│   │   │   ├── ai.rs             # AI prompt execution & model listing
│   │   │   ├── backup.rs         # Database backup & restore routines
│   │   │   ├── capsules.rs       # Capsule SQLite schema & .vctx packaging
│   │   │   ├── filesystem.rs     # Local file attachments & path resolution
│   │   │   ├── items.rs          # Items CRUD, transactions, batch operations
│   │   │   ├── p2p.rs            # P2P session & discovery command bindings
│   │   │   ├── search.rs         # SQLite FTS5 query runner
│   │   │   ├── tags.rs           # Taxonomy management
│   │   │   └── tasks.rs          # Task status & due-date triggers
│   │   ├── database/             # SQLite connection pooling & schema migrations
│   │   ├── filesystem/           # Secure local file storage management
│   │   ├── p2p/                  # UDP discovery & TCP peer session sync engine
│   │   └── lib.rs                # Tauri runtime bootstrap & plugin registration
│   ├── Cargo.toml                # Rust crate definitions & profile optimizations
│   └── tauri.conf.json           # Tauri security capabilities & build config
├── velco.exe                     # Standalone portable Windows executable
├── package.json                  # Node.js project manifest & scripts
└── README.md
```

---

## 7. License

Velco is open-source software licensed under the **[MIT License](LICENSE)**.
