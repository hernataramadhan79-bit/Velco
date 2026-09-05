# Velco

> **The Local-First Context-Bound AI Workstation**  
> Bring everything in. Bring your own AI.

Velco is a high-performance desktop context workstation built with Tauri v2, Rust, React, TypeScript, and SQLite. It provides offline-first capture, multi-item context staging, structured LLM recipe orchestration directly in Rust, and relational entity write-back to SQLite.

---

## ✨ Features

- 📥 **Offline-First Instant Capture**: Capture notes, tasks, links, files, and attachments with zero AI blocking.
- ⚡ **Context Cart**: Multi-select notes, tasks, and bookmarks into an active context staging cart with real-time token budgeting (~4 chars/token heuristic).
- 🛠️ **The Foundry (Workstation Deck)**: Dispatch structured AI recipes across your staged context:
  - ⚡ **Synthesize & Cross-Examine**: Unify multiple notes and files into a cohesive briefing.
  - 📋 **Extract Actionable Tasks**: Mine context for deliverables, deadlines, and priorities.
  - 🏷️ **Triage & Auto-Tag**: Discover taxonomy and organize workspace items.
  - ✍️ **Custom Prompt**: Execute arbitrary user instructions against staged context.
- 💾 **Structured Entity Write-Back**: AI outputs write back directly into SQLite tables (`items`, `tasks`, `tags`, `item_tags`, `items_fts`) via native Rust commands.
- 🤖 **Bring Your Own AI (BYOK & Local)**:
  - **Local Offline Engines**: Ollama & LM Studio (100% private, zero data egress).
  - **Cloud AI via Rust**: OpenRouter (with 400+ models), Google Gemini, OpenAI, Anthropic Claude, or any custom OpenAI-compatible endpoint.
- 🔍 **Instant Full-Text Search (FTS5)**: Fast tokenized search across all items and attachments.
- 🔒 **Privacy by Default**: Your SQLite database (`velco.db`) and files (`Velco/`) remain 100% on your local machine.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Zustand
- **Backend & Native Core**: Tauri v2, Rust (reqwest, rusqlite)
- **Database**: SQLite (via Rusqlite with FTS5 virtual tables)
- **Tooling**: Vite, Cargo

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or newer)
- [Rust](https://rustup.rs/) (latest stable toolchain)

### Development

```bash
# Install dependencies
npm install

# Run application in desktop development mode
npm run tauri dev
```

### Production Build

```bash
# Build standalone Windows executable (velco.exe)
npm run build:exe
```

---

## 📄 License

MIT License.
