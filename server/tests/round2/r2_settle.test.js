// Suite R2-03b: CHỐT ĐIỂM (settleRow) + auto-chain + idempotent.
// Chạy: node server/tests/round2/r2_settle.test.js
import { getDb, saveDbSync } from "../../models/store.js";
import * as cnv from "../../services/rounds/vuotCnv.service.js";
import { createHarness } from "./r2_helper.js";
const t = createHarness();
let snapshot = null;
try {
  await t.setup({}, { captureTimers: true });
  snapshot = JSON.stringify({ game: getDb().game, teams: getDb().teams });
  t.resetPuzzle({ row: 1, phase: "closed", running: false });
  getDb().game.round2Points = [40, 30, 20, 10];
  const p6 = getDb().game.puzzle;
  p6.submissions = { a: { answer: "A", elapsed: 5 }, b: { answer: "B", elapsed: 1 } };
  const before = Object.fromEntries(getDb().teams.map((x) => [x.id, x.score]));
  cnv.markRowAnswer("b", true);
  cnv.markRowAnswer("a", true);
  cnv.settleRow();
  const after = getDb().game.puzzle;
  t.ok(after.rowPhase === "scored", "settle -> scored");
  t.ok(after.rowsSolved[1] === true, "co dung -> mo manh");
  t.ok(after.keywordWindow === true, "settle -> mo keywordWindow");
  t.ok(after.lastResult?.correct === true && after.lastResult?.row === 1, "lastResult ghi o vua chot");
  t.ok(getDb().teams.find((x) => x.id === "b").score === before.b + 40, "nhat +40");
  // saveDb() cũng dùng setTimeout(80ms) nên timers bị lẫn: lọc đúng auto-chain 5000ms.
  const auto5 = t.timers.filter((x) => x.ms === 5000);
  t.ok(auto5.length >= 1, "settle -> hen auto 5s (loc giua cac timer saveDb 80ms)");
  t.resetPuzzle({ row: 2, phase: "closed", running: false });
  getDb().game.puzzle.submissions = { a: { answer: "SAI", elapsed: 2 } };
  cnv.markRowAnswer("a", false);
  const sB = getDb().teams.find((x) => x.id === "a").score;
  cnv.settleRow();
  t.ok(getDb().game.puzzle.rowsLocked[2] === true, "tat ca sai -> khoa manh");
  t.ok(getDb().teams.find((x) => x.id === "a").score === sB, "sai -> khong cong diem");
  const sc0 = getDb().teams.reduce((s, x) => s + x.score, 0);
  cnv.settleRow();
  t.ok(getDb().teams.reduce((s, x) => s + x.score, 0) === sc0, "settle lan 2 (scored) -> no-op");
  for (const ph of ["idle", "open"]) {
    t.resetPuzzle({ row: 0, phase: ph, running: false });
    const sig = JSON.stringify(getDb().game.puzzle.rowsSolved);
    cnv.settleRow();
    t.ok(JSON.stringify(getDb().game.puzzle.rowsSolved) === sig, `settle phase=${ph} -> no-op`);
  }
  t.resetPuzzle({ row: 0, phase: "closed", running: false });
  getDb().game.puzzle.currentRow = null;
  cnv.settleRow();
  t.ok(getDb().game.puzzle.rowPhase === "closed", "currentRow null -> no-op");
  t.resetPuzzle({ row: 0, phase: "closed", running: false });
  getDb().game.puzzle.keywordSolved = true;
  cnv.settleRow();
  t.ok(getDb().game.puzzle.rowPhase === "closed", "da giai tu khoa -> no-op");
  t.resetPuzzle({ row: 0, phase: "closed", running: false });
  getDb().game.puzzle.submissions = { a: { answer: "A", elapsed: 1 }, b: { answer: "B", elapsed: 2 } };
  cnv.markRowAnswer("a", true);
  cnv.markRowAnswer("b", true);
  const tb = getDb().teams.find((x) => x.id === "a");
  const was = !!tb.eliminated;
  tb.eliminated = true;
  // computeRowRanked KHÔNG lọc eliminated (vuotCnv.service.js: filter activeOrder
  // nhưng activeOrder = TEAM_ORDER gốc, không check team.eliminated) → đội vừa
  // eliminate VẪN có trong ranked/được điểm. Ghi nhận hành vi thực tế.
  cnv.settleRow();
  t.ok(getDb().game.puzzle.ranked.some((r) => r.teamId === "a"), "eliminate van trong ranked (activeOrder khong loc eliminated)");
  tb.eliminated = was;
  console.log(`\n${t.summary() === 0 ? "R2-03b OK" : "R2-03b FAIL"}`);
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
