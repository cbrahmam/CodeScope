# CodeScope

**AI-powered code reviews that catch what humans miss.**

## The Problem

Code reviews are time-consuming, inconsistent, and often miss critical security and performance issues. Junior developers wait hours for senior review. Security vulnerabilities slip through. The review quality depends entirely on who's reviewing and how much time they have.

## The Solution

CodeScope uses AI to perform comprehensive code reviews in seconds. It catches security vulnerabilities, performance bottlenecks, code smells, and complexity issues, then generates actual fix suggestions with diffs. Teams can collaborate in real-time, discuss findings, and track resolution.

## Features

- **AI Code Review** across 10+ languages (Python, JavaScript, TypeScript, Go, Rust, Java, Ruby, C/C++, SQL, HTML/CSS)
- **Security Vulnerability Detection** — SQL injection, XSS, hardcoded secrets, path traversal, command injection (OWASP Top 10)
- **Performance Analysis** — O(n^2+) algorithms, memory leaks, blocking I/O, N+1 queries
- **Complexity Metrics** — Cyclomatic complexity, nesting depth, maintainability scoring
- **Fix Suggestions with Diffs** — Side-by-side diff viewer with one-click fix application
- **Real-Time Collaboration** — Live presence, inline comments, activity feed via Socket.IO
- **GitHub PR Import** — Import and review pull requests directly from GitHub
- **Re-Review Comparison** — Track improvement by comparing original vs updated code
- **Export** — Copy as Markdown or GitHub PR comment format
- **Code Quality Scoring** — 0-100 score with severity-weighted calculations
- **Keyboard Shortcuts** — Navigate findings (J/K), accept (A), dismiss (D), apply fix (F)

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18, Vite 6, TailwindCSS v3 | Fast dev experience, utility-first styling |
| Editor | Monaco Editor (via CDN) | VS Code-quality editing, syntax highlighting for 10+ languages |
| State | Zustand | Minimal boilerplate, React 18 compatible |
| Backend | FastAPI (Python) | Async-first, auto-generated API docs, Pydantic validation |
| Database | SQLite (aiosqlite) | Zero-config, async, WAL mode for concurrent reads |
| AI | Claude API (Anthropic) | Advanced code understanding, structured JSON output |
| Real-time | Socket.IO (python-socketio) | WebSocket with polling fallback, room-based collaboration |
| HTTP | axios (frontend), httpx (backend) | Promise-based requests, async HTTP client |

## Architecture

```
Code Input (Monaco) → Language Detection → Code Parser (regex)
                                              ↓
                                    AI Review (Claude API)
                                              ↓
                              Findings + Fix Suggestions + Diffs
                                              ↓
                           Review Dashboard ← Socket.IO → Collaborators
                             (Score, Findings, Diff Viewer, Comments)
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- Anthropic API key ([get one here](https://console.anthropic.com/))

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/cbrahmam/CodeScope.git
   cd CodeScope/code-review
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your Anthropic API key
   ```

3. **Backend**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```

4. **Frontend** (in a new terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Open** [http://localhost:5173](http://localhost:5173)

> **Note:** Monaco Editor is loaded from CDN automatically — no extra install needed.
>
> **Note:** GitHub integration requires a personal access token (optional). Add `GITHUB_TOKEN` to `.env`.

## Security Analysis Categories

CodeScope checks for issues across these categories:

- **Security** — SQL injection, XSS, CSRF, hardcoded secrets, insecure dependencies, missing auth, path traversal, command injection
- **Performance** — O(n^2+) algorithms, unnecessary re-renders, memory leaks, blocking I/O, missing indexes, N+1 queries
- **Bug Risk** — Null pointer risks, race conditions, off-by-one errors, unhandled exceptions, type mismatches
- **Code Quality** — Code duplication, dead code, overly complex functions, magic numbers, poor naming
- **Style** — Inconsistent formatting, missing docstrings, comment quality, import organization
- **Architecture** — Tight coupling, missing error boundaries, no separation of concerns, hardcoded config

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reviews` | Create a new review |
| GET | `/api/reviews` | List all reviews |
| GET | `/api/reviews/:id` | Get review details |
| DELETE | `/api/reviews/:id` | Delete a review |
| POST | `/api/reviews/:id/analyze` | Run AI analysis |
| GET | `/api/reviews/:id/findings` | Get findings (filterable) |
| GET | `/api/reviews/:id/complexity` | Get complexity report |
| GET | `/api/reviews/:id/summary` | Get AI-generated summary |
| GET | `/api/reviews/:id/export` | Export as Markdown/GitHub |
| PUT | `/api/reviews/:id/findings/:fid` | Update finding status |
| POST | `/api/reviews/:id/findings/:fid/apply` | Apply fix |
| POST | `/api/reviews/:id/re-review` | Re-review with comparison |
| POST | `/api/reviews/:id/comments` | Add comment |
| GET | `/api/reviews/:id/comments` | Get comments |
| POST | `/api/github/import-pr` | Import GitHub PR |
| GET | `/api/github/pr-info` | Get PR info |
| GET | `/api/reviews/stats/dashboard` | Dashboard stats |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `J` / `K` | Navigate between findings |
| `A` | Accept current finding |
| `D` | Dismiss current finding |
| `F` | View fix for current finding |
| `C` | Open comment on current finding |
| `Cmd+Enter` | Start review (from input page) |
| `Escape` | Close panels/modals |
| `?` | Show shortcuts help |

## License

MIT
