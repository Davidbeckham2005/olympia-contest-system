// Suite R2-04: MÀN HÌNH (setScreenMode) + auto-chain sau chốt.
// Chạy: node server/tests/round2/r2_screen.test.js
import { getDb, saveDbSync } from "../../models/store.js";
import * as cnv from "../../services/rounds/vuotCnv.service.js";
import * as game from "../../services/game.service.js";
import { createHarness } from "./r2_helper.js";
const t = createHarness();
let snapshot = null;
try {
  await t.setup({}, { captureTimers: true });
  snapshot = JSON.stringify({ game: getDb().game, teams: getDb().teams });
  t.resetPuzzle({ row: 1, phase: "closed", running: false });
  game.setScreenMode("answers");
  t.ok(getDb().game.display.mode === "answers", "setScreenMode answers");
  game.setScreenMode("question");
  t.ok(getDb().game.display.mode === "question", "setScreenMode question");
  game.setScreenMode("puzzle");
  t.ok(getDb().game.display.mode === "puzzle", "setScreenMode puzzle");
  game.setScreenMode("weird");
  t.ok(getDb().game.display.mode === "puzzle", "mode la -> fallback puzzle (v2)");
  getDb().game.round = "khoi_dong";
  getDb().game.display.mode = "idle";
  game.setScreenMode("answers");
  t.ok(getDb().game.display.mode === "idle", "vong khac -> setScreenMode no-op");
  getDb().game.round = "vuot_cnv";
  t.resetPuzzle({ row: 1, phase: "closed", running: false });
  getDb().game.puzzle.submissions = { a: { answer: "A", elapsed: 2 } };
  cnv.markRowAnswer("a", true);
  getDb().game.display.mode = "answers";
  cnv.settleRow();
  // Lọc đúng timer auto-chain (5000ms), bỏ qua timer saveDb(80ms).
  const auto = t.timers.filter((x) => x.ms === 5000);
  t.ok(auto.length >= 1, "settle hen auto-chain 5s");
  const step1 = auto[0].fn;
  getDb().game.display.mode = "answers";
  step1();
  t.ok(getDb().game.display.mode === "question", "auto b1: answers -> question");
  t.ok(getDb().game.display.answerRevealed === true, "auto b1: lat dap an");
  const auto2 = t.timers.filter((x) => x.ms === 3000);
  t.ok(auto2.length >= 1, "b1 hen tiep b2 (3000ms)");
  const step2 = auto2[auto2.length - 1].fn;
  getDb().game.display.mode = "question";
  step2();
  t.ok(getDb().game.display.mode === "puzzle", "auto b2: question -> puzzle");
  t.resetPuzzle({ row: 0, phase: "closed", running: false });
  getDb().game.puzzle.submissions = { a: { answer: "A", elapsed: 1 } };
  cnv.markRowAnswer("a", true);
  t.timers.length = 0;
  getDb().game.display.mode = "answers";
  cnv.settleRow();
  const mcAuto = t.timers.filter((x) => x.ms === 5000);
  t.ok(mcAuto.length >= 1, "settle lan 2 van hen auto");
  const mcStep = mcAuto[0].fn;
  getDb().game.display.mode = "puzzle";
  mcStep();
  t.ok(getDb().game.display.mode === "puzzle", "MC doi tay -> auto bi huy");
  console.log(`\n${t.summary() === 0 ? "R2-04 OK" : "R2-04 FAIL"}`);
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
