# Quiz Contest (Cuộc thi tri thức)

Full-featured web platform for organizing and running a live quiz competition:
an online preliminary exam, team management, a real-time MC control desk,
buzzers, a knowledge-puzzle board, live scoreboards and final standings.

## Tech stack

- **Backend**: Node.js (ES modules) + Express, real-time over Socket.IO.
- **Database**: SQLite via built-in `node:sqlite` by default; MySQL also
  supported (switch with `DB_CLIENT=mysql` + `.env`). Data is cached in memory
  and persisted with debounced writes.
- **Frontend**: React 18 + Vite 6, React Router, Tailwind CSS 4, Socket.IO client.
  All screens update live from `game:state` / `game:timer` events.
- **Other tools**: `multer` (media uploads), `xlsx` (contestant Excel import),
  `dotenv`, `concurrently` (dev runner).

The server is the single source of truth for the game state and countdown
timers; it runs one shared timer loop and broadcasts to every screen.

## Run locally

Requires [Node.js](https://nodejs.org/) **22.5+** (the server uses the built-in
`node:sqlite` module, which is only available from Node 22.5 onward).

```bash
cd cuoc-thi
npm run setup
npm run dev
```

- MC / Contestant web UI: http://localhost:5173
- API / Socket.IO server: http://localhost:3001
- Organizer PIN (default): `2026`

## Run with Docker

Requires [Docker](https://www.docker.com/) (with Docker Compose).

```bash
docker compose up -d --build
```

- App / API / Socket.IO: http://localhost:3001
- Data (SQLite) is persisted on the host at `server/data/`; uploaded media at
  `server/uploads/`. Both are bind-mounted into the container, so nothing is
  lost on restart or redeploy.

```bash
docker compose down   # stop (data is kept on the host)
```

## Screens & access

| Role | Route | Access |
|---|---|---|
| Contestant (team) | `/thi-sinh` | Team password |
| Audience / LED screen | `/man-hinh` | none |
| MC control desk | `/mc` | Organizer PIN |
| Admin | `/admin` | Organizer PIN |

Default team passwords (changeable in **Admin → Teams**):

| Team | Password |
|---|---|
| A | `dragon` |
| B | `phoenix` |
| C | `tiger` |
| D | `turtle` |
| E | `eagle` |
| F | `falcon` |

The contestant page switches its content automatically according to the
current round (controlled by the MC).

## Contest flow

### 1. Preliminary round (contestants)

- Contestants self-register (name, student code, school, class).
- 30 multiple-choice questions, 15 minutes, live countdown, each answer saved.
- Auto-submitted when time runs out. Ranked by score (higher first), then by
  shorter completion time.
- Top 16 contestants are flagged as qualified.

### 2. Admin / organizers

- Open / close the preliminary exam.
- Review scores, build the **Top 16**, and auto-split into teams (snake draft).
- Rename teams, reassign members, mark a team eliminated (eliminated teams are
  excluded from later rounds and cannot press the buzzer).
- Edit preliminary + main-round questions, import contestants (JSON/Excel).
- Upload hint images / videos.
- Configure the speed-scoring points for Rounds 2 and 3 (default `40 · 30 · 20 · 10`).
- **Create demo contestant** button for quick testing when fewer than 16 real
  people register.

### 3. Contest day — main rounds

The MC drives: **Khởi động (Warm-up) → Vượt chướng ngại vật (Obstacle
Course) → Tăng tốc (Speed-up) → Về đích (Finish)**.

#### Round 1 — Khởi động (Warm-up)

Each team member does **5 images in one 60-second window**; every member has
their own 60s turn. Contestants type answers live on `/thi-sinh`, the MC marks
each image right/wrong. **+10 points per correct image**, no penalty for wrong.

#### Round 2 — Vượt chướng ngại vật (Obstacle Course / “Puzzle board”)

The keyword is hidden behind **5 puzzle pieces** (4 corners + 1 center), with a
letter-count hint. Each corner corresponds to one horizontal row.

- The MC selects a row, reveals its question, then starts the answer window.
- **All teams answer simultaneously** — free-text, submitted live from
  `/thi-sinh` (multiple submissions allowed, exact elapsed time is recorded).
- The MC marks each team right/wrong, then settles the row: **only correct
  teams score, ranked by speed** (1st `40` · 2nd `30` · 3rd `20` · 4th `10`,
  admin-configurable). Wrong answers score 0.
- A settled **correct row opens its corner piece**; the center piece opens only
  when all 4 corners are solved.
- **Keyword**: teams may claim it at any time via the gold **TỪ KHÓA** button;
  points depend on how many pieces are already open — `60 / 50 / 40 / 30 / 20`.
  MC marks the guess: correct → team scores and the keyword is revealed; wrong →
  that team is blocked from guessing the keyword (and its row submissions) for
  the round. If every team guesses wrong, the keyword is revealed with no winner.

#### Round 3 — Tăng tốc (Speed-up)

- The MC shows a video per question through a **3-second countdown** (manual
  start), then teams answer during playback.
- Contestants type answers live during the video; submissions are timestamped
  precisely (pauses/resumes are tracked exactly).
- After the video, the MC marks each answer, then settles: **only correct teams
  score, ranked by speed** — `40 · 30 · 20 · 10` (admin-configurable). Wrong = 0.

#### Round 4 — Về đích (Finish)

Each team takes turns at the podium and the MC picks **one fixed question
package** live:

| Package | Question structure |
|---|---|
| 60 | 10 + 10 + 20 |
| 80 | 10 + 20 + 20 |
| 100 | 20 + 20 + 30 |

- Every team has its own question bank (12×10, 24×20, 12×30 = 48 questions);
  the server auto-picks 3 questions per package, never duplicates, and never
  reuses a previously used question. Locking a package blocks changes.
- **Ngôi sao hy vọng (Star of Hope)**: each team may mark one question ×2.
- Per-question answering time depends on its points: **10 → 30s, 20 → 45s,
  30 → 60s**. The MC reads the question, then presses **“Bắt đầu tính giờ”** to
  start the countdown (timer is server-authoritative).
- If the answering team is wrong, a **steal window opens** and the other teams
  race on the buzzer. The winning team answers with a fresh timer.

Scoring is centralized (`calculateAnswerScore`) and applied immediately when a
result is known (let `P` = the question’s base points):

##### Normal question

| Situation | Selecting team | Stealing team |
|---|---:|---:|
| Selecting team answers correctly | `+P` | — |
| Wrong, nobody steals / answers | `0` | — |
| Wrong, another team steals & answers correctly | `-P` | `+P` |
| Wrong, another team steals & answers wrongly | `0` | `-P` |

##### Star of Hope question

| Situation | Star team | Stealing team |
|---|---:|---:|
| Star team answers correctly | `+2P` | — |
| Wrong, nobody steals / answers | `-P/2` | — |
| Wrong, another team steals & answers correctly | `-2P` | `+2P` |
| Wrong, another team steals & answers wrongly | `-P/2` | `-P` |

After the 3 questions the team’s turn ends and play moves to the next top team.

#### Tie-break (Phụ phuc)

Sudden-death buzzer round used to break ties.

## Data

Stored under `server/data/`:

- `db.json` — initial seed (teams, questions, game state).
- `questions-so-khao.json` — 30 preliminary questions.
- `questions-main.json` — main-round questions (round 1–4).
- `cuoc_thi.sqlite` — SQLite database (created/updated automatically).

Uploaded media goes to `server/uploads/`.