<div align="center">

# 🇩🇪 Deutsch Learn

### Practice German by building sentences, having conversations, and reading any text aloud.

<p>
  <a href="https://deutsch-learn-omega.vercel.app/">
    <img src="https://img.shields.io/badge/Live_Demo-10B981?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" />
  </a>
  <a href="https://github.com/kusaisssd/deutsch-learn/stargazers">
    <img src="https://img.shields.io/github/stars/kusaisssd/deutsch-learn?style=for-the-badge&color=10B981" alt="Stars" />
  </a>
  <img src="https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge" alt="MIT License" />
</p>

<p>
  <img src="https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular&logoColor=white" alt="Angular 21" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Signals-✓-10B981?style=flat-square" alt="Signals" />
  <img src="https://img.shields.io/badge/Standalone-✓-10B981?style=flat-square" alt="Standalone" />
</p>

<sub>Built with ❤️ by <a href="https://pro-sss.com/">Pro S; team</a></sub>

</div>

---

## ✨ Features

| | Feature | Description |
|---|---------|-------------|
| 🎮 | **Sentence builder** | 400 German sentences across A1–B2. Drag & drop or tap words into the right order. |
| 💡 | **Grammar tips** | In-context explanations for common patterns (Perfekt, Konjunktiv, Wechselpräpositionen…) |
| 🆘 | **Help button** | Reveals the answer without marking it as completed — encourages real practice. |
| 💬 | **Real conversations** | 10 multi-turn dialogues across 7 contexts: doctor, café, work, transport, bureaucracy… |
| 🎙️ | **Speech practice** | Speak your answers — the browser checks pronunciation against the expected German. |
| 🔊 | **Read aloud (TTS)** | German text-to-speech with adjustable speed (0.5×–2×). |
| 📖 | **Smart reader** | Paste any German text. Click any word for translation (with all alternate meanings). |
| 🌐 | **Full-text translation** | Side-by-side panel with English/Arabic translation of the entire text. |
| 📰 | **Live news** | Fetches recent tech articles from heise.de for fresh reading material. |
| 📊 | **Progress tracking** | All progress saved locally — sentences mastered + conversations completed. |
| 📱 | **Mobile-first** | Floating popups, compact layout, tap targets ≥ 44 px. |

---

## 🌐 Live Demo

👉 **https://deutsch-learn-omega.vercel.app/**

Deployed on Vercel · auto-redeployed on every `main` push.

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| **Framework** | Angular 21 (standalone components, no NgModules) |
| **Reactivity** | Signals + `computed` + `linkedSignal` + `effect` |
| **Routing** | `@angular/router` with lazy-loaded routes |
| **Styling** | Tailwind CSS 4 |
| **DnD** | `@angular/cdk/drag-drop` |
| **Speech** | Web Speech API (`SpeechSynthesis` + `SpeechRecognition`) |
| **Translation** | [MyMemory API](https://mymemory.translated.net/) |
| **News** | [heise.de](https://www.heise.de/) RSS via [rss2json](https://rss2json.com/) |
| **Persistence** | `localStorage` (no backend needed) |
| **Hosting** | Vercel (SPA rewrites in `vercel.json`) |

---

## 🏛️ Architecture

The project follows the **Core / Shared / Features** pattern with strict dependency rules:

```
features  ──uses──>  shared  ──uses──>  core
features  ──uses──>  core
features  ✗  features    (never)
```

```
src/app/
├── core/                          ← models + services (singletons)
│   ├── models/                    ← Level, Sentence, Conversation
│   └── services/                  ← Levels, Sentences, Conversations, Progress,
│                                     Speech, SpeechRecognition, Translation, News
│
├── shared/                        ← reusable across features
│   ├── components/word-tile/      ← input()/output() pattern
│   └── utils/                     ← shuffle, similarity (Levenshtein)
│
├── features/                      ← pages
│   ├── home/                      ← landing + learning roadmap
│   ├── levels/                    ← A1–B2 level picker
│   ├── sentences/                 ← sentence list per level
│   ├── practice/                  ← drag/drop sentence builder
│   ├── conversations/             ← list + multi-turn dialogue player
│   └── reader/                    ← TTS + word translation + full-text translate
│
├── app.ts / app.html              ← layout shell + <router-outlet />
├── app.config.ts                  ← providers (Router, HttpClient, etc.)
└── app.routes.ts                  ← lazy-loaded routes
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

### Installation

```bash
# Clone
git clone https://github.com/kusaisssd/deutsch-learn.git
cd deutsch-learn

# Install dependencies
npm install

# Start the dev server (http://localhost:4200)
npm start
```

### Other commands

| Command | What it does |
|---------|--------------|
| `npm start` | Run the dev server with hot-reload |
| `npm run build` | Production build → `dist/deutsch-learn/browser/` |
| `npm test` | Run unit tests with Vitest |
| `ng generate component features/<name>` | Scaffold a new component |
| `ng generate service core/services/<name>` | Scaffold a new service |

---

## 🗺️ Roadmap

- [x] Sentence builder (A1–B2, 400 sentences)
- [x] Conversations (10 scenarios, 7 contexts, 112 turns)
- [x] Speech recognition for pronunciation feedback
- [x] Full-text translation in Reader (EN / AR)
- [x] Mobile-first floating word popup
- [x] Live tech news from heise.de
- [ ] Spaced repetition for sentences user struggles with
- [ ] Streaks & weekly goals
- [ ] Custom user-added sentences
- [ ] Backend API (Node + Express) replacing JSON files

---

## 🤝 Contributing

This is primarily a learning project. PRs welcome but expect light review.

If you spot a typo in a German sentence or grammar tip — please open an issue. German learners thank you. 🙏

---

## 📄 License

MIT © [Kosay Alassaf](https://github.com/kusaisssd)

---

<div align="center">

### Built with ❤️ by <a href="https://pro-sss.com/">Pro S; team</a>

<sub><em>"As Smart As Simple."</em></sub>

</div>
