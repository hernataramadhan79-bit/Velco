# Velco UI/UX Comprehensive Review & Design System Audit

> **Document Version**: 2.0.0  
> **Target Release**: Velco Multi-Platform (Windows, macOS, Linux)  
> **Design Philosophy**: Industrial Minimalism &bull; Zero-Slop Ergonomics &bull; Local-First Context Preservation

---

## 1. Executive Summary

Velco is designed as a **high-density, context-bound AI workstation**. Unlike conventional web wrappers and "AI wrappers" plagued by gratuitous gradients, chat-bubble slop, and bloated decorative components, Velco adheres to the strict tenets of **industrial minimalism**:

1. **High Information Density**: Screen real-estate is prioritized for actionable artifacts (notes, Kanban cards, code snippets, synthesis recipes) rather than marketing fluff or decorative whitespace.
2. **Context-Bounded Workflows**: Switching between personal ad-hoc captures and team/project context is structural and instant (via the Dual-Mode header switch).
3. **Zero Compositor Friction**: Heavy GPU-bound filters (such as overlapping `backdrop-filter: blur()`) have been eliminated in favor of hardware-accelerated solid/alpha scrims with `transform-gpu` to guarantee rock-solid 120Hz performance on macOS WebKit, Windows WebView2, and Linux WebKitGTK.

---

## 2. Dual-Mode Architecture Review

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VELCO DUAL-MODE CORE                            │
├───────────────────────────────────┬────────────────────────────────────┤
│   MODE 1: PERSONAL WORKSTATION    │      MODE 2: THE BRIDGE (CONTEXT)  │
│                                   │                                    │
│ • Inbox Quick Capture             │ • Project-Scoped Capsules          │
│ • Universal Search (Cmd+K)        │ • 3-Column Kanban Board            │
│ • Virtualized Item Feeds          │ • Split-Pane Markdown Specs        │
│ • Due Date Reminders (Native OS)  │ • AI Synthesis Recipes             │
│ • Studio Workbench (The Foundry)  │ • Air-Gapped P2P LAN Collaboration │
│ • Global Multi-Select Bar         │ • Portable Encrypted .vctx Bundles │
└───────────────────────────────────┴────────────────────────────────────┘
```

### 2.1 Mode 1: Personal Workstation
- **Sidebar Ergonomics**: Collapsible with smooth transition (`Cmd+B` / `Ctrl+B`), displaying exact numeric badges for Inbox, Tasks, Notes, Links, Files, Overdue, and custom tags.
- **Virtualized Rendering**: Uses `@tanstack/react-virtual` to handle 10,000+ items smoothly with zero DOM thrashing.
- **Selection Action Bar**:
  - Automatically floats at the bottom viewport when one or more items are selected.
  - One-click actions: **Attach to AI Chat Context**, **Stage to Workbench**, and **Batch Trash**.
  - Engineered with unconditional hook execution and isolated within an `ErrorBoundary` for crash-resilience.
- **The Foundry (Studio Workbench)**:
  - Collapsible side-drawer (`Cmd+J` / `Ctrl+J`) for multi-item synthesis.
  - Allows selecting AI models (OpenAI, Gemini, Anthropic, Ollama, OpenRouter, DeepSeek) with deterministic parameter controls (Temperature, Top-P, Context Limit).

---

### 2.2 Mode 2: Context Hub (The Bridge)
- **Problem Solved**: Eliminates context fragmentation where project tasks, technical specifications, and AI notes live in separate disjointed tools.
- **Capsule Navigator (Left Pane)**:
  - Clean project list showing name, role (Host/Member), item count, and encryption key status.
  - **Explicit Actions**: Clear **`Join`** button (with icon and text) placed immediately next to **`+ New`**, removing any ambiguity on how to connect to peer projects.
- **3-Column Kanban Workflow (Center/Right Pane)**:
  - Columns: **To-Do**, **In Progress**, **Completed**.
  - Interactive status badges, inline task creation, priority tags (Urgent, High, Medium, Low), and quick date selectors.
  - Task completion state synchronizes instantly with SQLite.
- **Split-Pane Markdown Editor**:
  - Live preview alongside editor for technical documentation, architectural specs, and meeting minutes.
  - High-contrast typography with monospace code blocks and syntax clarity.
- **AI Synthesis Recipes**:
  - Pre-engineered prompts (Sprint Planner, Architecture Audit, Bug Triage, Executive Summary) executing against active capsule context.

---

## 3. P2P LAN Collaboration & Handshake UX Review

Velco features air-gapped, zero-cloud peer collaboration designed for teams working on local networks (LAN / Wi-Fi) without leaking data to third-party cloud servers.

### 3.1 The Handshake Flow
1. **Host (Sharer)**:
   - Clicks **`Share`** on any active capsule.
   - The **Share Capsule Modal** presents:
     * **Peer Invitation Key** (e.g. `vctx_live_a8f9c1...`): Cryptographic secret key.
     * **Export .vctx Bundle**: Complete portable archive with notes and tasks.
   - Clicks **`Go Live`** in the toolbar $\rightarrow$ Starts UDP broadcast on port `42426` and TCP listener.
2. **Peer (Joiner)**:
   - Clicks the prominent **`Join`** button in the Capsules sidebar.
   - The redesigned **Join or Import Modal** offers two distinct pathways:
     * **Tab 1: Peer Invitation Key**: Paste the shared key and click **`Join Capsule`**.
     * **Tab 2: File .vctx**: Drag-and-drop or select the `.vctx` file.
   - Clicks **`Go Live`** in the toolbar.
3. **Auto-Discovery & Session Link**:
   - Both devices discover each other automatically via UDP beacon matching either the shared `key_hash` (SHA-256 fingerprint) or `capsule_id`.
   - Visual Feedback: The header status turns **`Live (1 peers)`** with a pulsing emerald dot and active listening port.
   - Any card moved on Kanban or note edited is broadcast via length-prefixed framed TCP packets in real-time.

---

## 4. UI Design System & Component Audit

| Component | Design Pattern | Visual Styling | Ergonomic Benefit |
| :--- | :--- | :--- | :--- |
| **Theme / Canvas** | Obsidian Industrial | Dark: `#09090b` / Light: `#f8fafc` | Ultra-low eye strain during long coding/synthesis sessions |
| **Borders & Dividers** | Hairline Subtle | `border-slate-200` / `dark:border-white/[0.08]` | Clear boundary definition without visual clutter |
| **Typography** | Dual-Font Hierarchy | Inter/System Sans for UI &bull; JetBrains/Geist Mono for Data & Dates | Instant cognitive separation between interface and data |
| **Modals & Overlays** | GPU-Accelerated Scrim | `bg-black/75 transform-gpu select-none` | Zero WebKit blur glitches; prevents background clicks |
| **Action Buttons** | Flat Micro-Interactive | `rounded-md text-xs font-medium transition-all` | Tactile hover states with clear disabled indicators |
| **Toasts & Alerts** | Bottom-Right Floating | Solid dark card with colored status border | Non-modal notification that never blocks main workspace |

---

## 5. Multi-Platform Compliance

- **macOS (Sonoma / Sequoia)**:
  - Hardened runtime entitlements configured (`com.apple.security.cs.allow-jit`, `com.apple.security.cs.allow-unsigned-executable-memory`, `com.apple.security.cs.disable-library-validation`).
  - WebKit compositing bug resolved (no blackscreen on modal opening or toast trigger).
  - Packaged as clean drag-and-drop `.dmg` disk image.
- **Windows (10 / 11)**:
  - WebView2 integration with GPU rasterization.
  - Packaged as standard installer (`.msi` / `.exe`) and standalone portable executable (`velco.exe`).
- **Linux (Ubuntu / Debian / Fedora)**:
  - WebKitGTK integration with native system indicator support.
  - Packaged as `.deb` package and portable `.AppImage`.
