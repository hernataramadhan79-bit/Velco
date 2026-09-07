# Velco

<p align="center">
  <strong>The Local-First, Context-Bound AI Workstation &amp; Knowledge OS</strong><br>
  <em>Grounded synthesis. Local SQLite storage. Zero-emoji industrial minimalist design.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square" alt="Platform">
  <img src="https://img.shields.io/badge/Tauri-v2-orange?style=flat-square" alt="Tauri v2">
  <img src="https://img.shields.io/badge/Rust-2021-black?style=flat-square" alt="Rust">
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square" alt="TypeScript">
  <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square" alt="Tailwind CSS v4">
  <img src="https://img.shields.io/badge/Database-SQLite%20(FTS5)-003b57?style=flat-square" alt="SQLite">
</p>

---

## 1. Overview

**Velco** is a high-performance desktop workstation designed for developers, researchers, and power users who demand total privacy, instantaneous responsiveness, and deliberate, context-bound AI interactions.

Inspired by the design standards of **LM Studio, Linear, Raycast, and Cursor**, Velco replaces visual clutter, cartoonish widgets, and decorative emojis with a razor-sharp, whisper-quiet industrial minimalist interface. All data remains 100% on your physical machine in an optimized SQLite database with FTS5 full-text indexing.

---

## 2. Core Capabilities

### ⚡ Context-Bound Grounded Intelligence
- **Context Cart & Queue**: Multi-select notes, tasks, documents, and web links into an active context staging deck with real-time token budgeting (~4 characters/token heuristic).
- **Studio Workbench (The Foundry)**: Execute structured AI recipes against staged context:
  - **Synthesize & Cross-Examine**: Unify disparate notes and documents into structured markdown briefings.
  - **Task Mining & Extraction**: Automatically detect deliverables, deadlines, and priorities from freeform thoughts.
  - **Taxonomy Triage**: Suggest high-density categorized tags and organize library clutter.
  - **Custom Bespoke Instructions**: Direct the AI engine with tailored analytical prompts.
- **Relational Entity Write-Back**: Synthesis artifacts write back directly into SQLite tables (`items`, `tasks`, `tags`, `item_tags`, `items_fts`) via native Rust commands.

### 🛡️ Ironclad AI Toggle & Defense-in-Depth
- **Strict Master Switch**: When AI features are toggled off in Settings or the header telemetry badge, **no network calls or IPC requests are dispatched to any model**.
- **Offline Heuristic Fail-Safe**: When AI is offline or disabled, task extraction and tagging seamlessly fall back to deterministic offline regex heuristics without disrupting your workflow.

### 🤖 Bring Your Own AI (Local + Cloud)
- **100% On-Device Private Inference**:
  - **Ollama** (Default port `11434`) — completely air-gapped, zero external egress.
  - **LM Studio** (Default port `1234`) — local OpenAI-compatible inference server.
- **Cloud AI via Native Rust Streaming**:
  - **OpenRouter**: Access hundreds of models with live pricing, context window metrics, and curated free tiers.
  - **Google Gemini, OpenAI, Anthropic Claude**, and arbitrary OpenAI-compatible custom endpoints.

### 📥 Universal Fast Capture
- **Rapid Ingestion Dock**: Capture notes, tasks, links, and binary files with zero AI blocking.
- **Rule-Based Heuristic Classifier**: Instantly detects markdown checkboxes, task directives, and URLs without waiting for cloud round-trips.
- **File Dropzone**: Drag-and-drop file attachments directly into your local library.

### 🎨 Dual-Theme Industrial Minimalist Design
- **Obsidian Dark & Crisp Light**: Deep obsidian layering (`#09090b`, `#0d0d10`, `#141418`) paired with a high-contrast, clean light mode.
- **Tailwind CSS v4 Native Engine**: Powered by `@custom-variant dark` and custom 5px dual-theme scrollbars.
- **Zero-Emoji Architecture**: 100% vector iconography via `lucide-react`, monospaced token badges, and structured typographic hierarchy.

### 🔍 Instant Full-Text Search (FTS5)
- Tokenized, zero-latency full-text search across all titles, notes, task contents, and metadata.
- Triggerable globally with `Ctrl+K` / `Cmd+K`.

### 🌉 The Bridge (Preview)
- Context capsule bundling, team action matrices, peer review protocol, and local isolation verification.

---

## 3. Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Desktop Shell** | [Tauri v2](https://v2.tauri.app/) (Rust 2021) |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Styling & Design** | [Tailwind CSS v4](https://tailwindcss.com/) + Custom Design Tokens |
| **Icons & Symbols** | [Lucide React](https://lucide.dev/) (Zero Emoji Standard) |
| **State Management** | [Zustand](https://zustand-demo.pmnd.rs/) with persistent storage |
| **Embedded Database** | SQLite via [Rusqlite](https://github.com/rusqlite/rusqlite) with FTS5 |
| **HTTP & Streaming** | [Reqwest](https://github.com/seanmonstar/reqwest) with Server-Sent Events (SSE) |
| **Build & Bundler** | [Vite](https://vite.dev/) + [Cargo](https://doc.rust-lang.org/cargo/) |

---

## 4. Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Open Global Search | Global |
| <kbd>Ctrl</kbd> + <kbd>N</kbd> | Universal Quick Capture | Global |
| <kbd>Ctrl</kbd> + <kbd>,</kbd> | Open Settings & Workstation | Global |
| <kbd>Esc</kbd> | Close Modal / Return to Workspace | Modal / Settings |
| <kbd>Enter</kbd> | Send Chat Prompt / Confirm Dialog | Chat / Input |
| <kbd>Shift</kbd> + <kbd>Enter</kbd> | Newline in Multiline Textarea | Chat / Editor |

---

## 5. Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0 or newer)
- [Rust](https://rustup.rs/) (latest stable toolchain)
- Build tools (e.g. Visual Studio C++ Build Tools on Windows)

### Installation & Development

```bash
# Clone the repository
git clone https://github.com/hernataramadhan79-bit/Velco.git
cd Velco

# Install dependencies
npm install

# Run application in desktop development mode (Tauri v2 + Vite HMR)
npm run tauri dev
```

### Production Builds

```bash
# Type check and build frontend assets
npm run build

# Build standard desktop production installer
npm run tauri build

# Build portable standalone Windows executable (velco.exe)
npm run build:exe
```

The compiled standalone release binary is generated directly at the project root as `velco.exe`.

---

## 6. Project Structure

```
Velco/
├── src/                          # React + TypeScript Frontend
│   ├── components/               # Reusable UI components & layouts
│   │   ├── capture/              # Universal Capture Dock
│   │   ├── chat/                 # Landing Hero AI Chat
│   │   ├── common/               # Modals, buttons, badges, markdown viewer
│   │   ├── inbox/                # Date-grouped inbox & filter views
│   │   ├── items/                # Item cards, detail modal, tag recommender
│   │   ├── layout/               # Header, Sidebar, AIPrivacyBadge
│   │   ├── tasks/                # Task extraction modal, due date picker
│   │   └── workstation/          # The Foundry (Studio Workbench)
│   ├── features/                 # Modular feature views (Notes, Tasks, Settings, etc.)
│   ├── services/                 # Database, AI service IPC, Reminder service
│   ├── stores/                   # Zustand stores (items, context, chat, settings)
│   ├── types/                    # Domain data contracts & interfaces
│   ├── utils/                    # AI provider config, date formatters, token heuristics
│   ├── index.css                 # Design tokens, @custom-variant dark, scrollbars
│   └── App.tsx                   # Main workstation application layout
├── src-tauri/                    # Rust Native Core
│   ├── src/
│   │   ├── ai/                   # Ollama & OpenRouter HTTP clients
│   │   ├── commands/             # Tauri IPC commands (ai, items, search, tags)
│   │   ├── db/                   # SQLite Rusqlite schema & migrations (FTS5)
│   │   └── lib.rs                # Application runtime setup & command registration
│   ├── Cargo.toml                # Rust dependencies (rusqlite, reqwest, tauri)
│   └── tauri.conf.json           # Tauri window, security & build configuration
├── velco.exe                     # Portable standalone production executable
└── package.json                  # Node.js project manifest & scripts
```

---

## 7. License

Distributed under the **MIT License**. See `LICENSE` for details.
