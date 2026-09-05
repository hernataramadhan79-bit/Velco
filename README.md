# Velco

> **Local-First Personal Information Inbox**  
> Capture first, organize later. 100% private, offline-first, and empowered by local & cloud AI.

Velco (formerly Life Inbox) is a desktop personal information organizer built with high-performance desktop technologies. It combines local SQLite storage with instant search, intelligent tag management, full JSON/Markdown backup export, and an AI layer supporting both offline LLMs (LM Studio, Ollama) and cloud providers (OpenRouter with 400+ dynamic models & free tier filter, Google Gemini, OpenAI, Anthropic Claude).

---

## ✨ Features

- 📥 **Universal Capture**: Quickly capture notes, thoughts, tasks, code snippets, and ideas without context switching.
- ⚡ **Local-First Architecture**: Powered by SQLite directly on your device. Zero internet required for core operations.
- 🏷️ **Tag Management & Realtime Counts**: Custom colors, quick filtering, and live counter synchronization across sidebar tags.
- 🤖 **Flexible AI Layer**:
  - **Local Offline Engines**: LM Studio & Ollama (runs 100% private with zero data egress).
  - **Cloud AI Platforms**: OpenRouter (with real-time model catalog & free model detection), Google Gemini, OpenAI ChatGPT, Anthropic Claude.
  - **Smart Summarization & Auto-Tagging**: Generate concise summaries and suggest relevant tags.
- 💾 **Data Ownership & Backup**: Complete one-click export and import in JSON or Markdown format.
- 🎨 **Adaptive Theme**: Dark and light modes with custom modern styling and high-contrast typography.
- 🔒 **Privacy by Default**: Your API keys and notes are stored strictly on your local machine.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend & Native Core**: Tauri v2, Rust
- **Database**: SQLite (via Rusqlite with local file storage)
- **Tooling**: Vite, Oxlint

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
# Build standalone Windows executable (life-inbox.exe / velco.exe)
npm run build:exe
```

---

## 📄 License

MIT License.
