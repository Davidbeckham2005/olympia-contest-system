// Suite R2-?D: TIMER LOOP SỐNG SAU RESET (hồi quy bug đồng hồ round 2 lag/không chuyển màn đáp án).
// Bug cũ: resetMainRoundState() gọi stopTimerLoop() mà không start lại → mọi đồng hồ (round 2,
// tang_toc, ve_dich, tie_break) chết hẳn cho tới khi khởi động lại server.
// Chạy: node server/tests/round2/r2_timeout_reset.test.js
import { getDb, saveDbSync } from "../../models/store.js";
import * as game from "../../services/game.service.js";
import { createHarness } from "./r2_helper.js";

const t = createHarness();
let snapshot = null;
try {
  await t.setup();
  snapshot = JSON.stringify({ game: getDb().game, teams: getDb().teams });

  // 1. Dựng trạng thái nguyên gốc: round 2, ô đang mở, giờ chạy, sắp hết giờ.
  getDb().game.round = "vuot_cnv";
  getDb().game.questionStatus = "showing";
  getDb().game.display = { mode: "question", title: "", question: "Hỏi gì?", options: [], mediaUrl: "", mediaType: "", answer: "A", answerRevealed: false, note: "Hàng ngang 1 • 3 chữ" };
  getDb().game.puzzle = {
    rowsSolved: [false, false, false, false, false],
    rowsLocked: [false, false, false, false, false],
    keywordSolved: false,
    keywordWindow: false,
    keywordClaim: null,
    currentRow: 0,
    rowPhase: "open",
    submissions: {},
    corrections: {},
    ranked: [],
    lastResult: null,
    revealedRows: 0,
  };
  getDb().game.buzzer = { open: false, locked: false, winner: null, order: [], blocked: [] };
  getDb().game.timer = { duration: 30, remaining: 30, running: true, endsAt: Date.now() + 1500 };

  // 2. Reset câu hỏi (con đường cũ từng giết timer loop) rồi chạy giờ mới.
  await game.resetMainRoundState();
  getDb().game.puzzle.currentRow = 1;
  getDb().game.puzzle.rowPhase = "open";
  getDb().game.display.mode = "question";
  getDb().game.timer = { duration: 30, remaining: 30, running: true, endsAt: Date.now() + 1500 };

  await new Promise((res) => setTimeout(res, 2000));
  t.ok(getDb().game.display.mode === "answers", "SAU reset câu hỏi → hết giờ tự chuyển màn đáp án");
  t.ok(getDb().game.timer.running === false, "SAU reset → hết giờ timer dừng");
  t.ok(getDb().game.puzzle.rowPhase === "closed", "SAU reset → hết giờ khóa nộp bài");

  console.log(`\n${t.summary() === 0 ? "R2-07 OK" : "R2-07 FAIL"}`);
} finally {
  if (snapshot) {
    const s = JSON.parse(snapshot);
    getDb().game = s.game;
    getDb().teams = s.teams;
    await saveDbSync();
  }
  await t.teardown();
}
if (t.fail > 0) process.exit(1);