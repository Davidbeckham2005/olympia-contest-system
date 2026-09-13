// Suite R2-06: ĐIỂM + KẾT THÚC VÒNG (keywordPoints/corners/setRoundPoints).
// Chạy: node server/tests/round2/r2_points_end.test.js
import { getDb, saveDbSync } from "../../models/store.js";
import * as cnv from "../../services/rounds/vuotCnv.service.js";
import * as game from "../../services/game.service.js";
import { createHarness } from "./r2_helper.js";
const t = createHarness();
let snapshot = null;
try {
  await t.setup();
  snapshot = JSON.stringify({ game: getDb().game, teams: getDb().teams });
  const solvedN = (n) => {
    t.resetPuzzle({ row: 0, phase: "open", running: true });
    getDb().game.puzzle.rowsSolved = [0, 1, 2, 3, 4].map((i) => i < n);
  };
  // Code thực tế (vuotCnv.service.js:88-95): OPEN_POINTS[min(opened,5)-1] —
  // opened=0 và 1 đều → 60 (off-by-one sẵn có, KHÔNG phải 60·50·40·30·20 đều).
  const expect = { 0: 60, 1: 60, 2: 50, 3: 40, 4: 30, 5: 20 };
  for (const n of [0, 1, 2, 3, 4, 5]) {
    solvedN(n);
    t.ok(game.keywordPoints() === expect[n], `keywordPoints mo ${n} manh = ${expect[n]}`);
  }
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  t.ok(cnv.cornersResolved() === false, "chua xu ly het -> cornersResolved false");
  getDb().game.puzzle.rowsSolved = [true, true, true, true, false];
  getDb().game.puzzle.rowsLocked = [false, false, false, false, true];
  t.ok(cnv.cornersResolved() === true, "5 manh open/locked -> cornersResolved true");
  game.setRoundPoints("vuot_cnv", [100, 50]);
  t.ok(JSON.stringify(getDb().game.round2Points) === "[100,50]", "setRoundPoints v2 -> [100,50]");
  game.setRoundPoints("tang_toc", [9, 8]);
  t.ok(JSON.stringify(getDb().game.round3Points) === "[9,8]", "setRoundPoints v3 rieng biet");
  const keep = JSON.stringify(getDb().game.round2Points);
  game.setRoundPoints("khoi_dong", [1]);
  t.ok(JSON.stringify(getDb().game.round2Points) === keep, "round la -> giu nguyen");
  t.resetPuzzle({ row: 0, phase: "closed", running: false });
  getDb().game.puzzle.submissions = { a: { answer: "A", elapsed: 1 } };
  cnv.markRowAnswer("a", true);
  const b4 = getDb().teams.find((x) => x.id === "a").score;
  cnv.settleRow();
  t.ok(getDb().teams.find((x) => x.id === "a").score === b4 + 100, "settle dung bo diem custom 100");
  getDb().game.round2Points = [40, 30, 20, 10];
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  ["a", "b", "c", "d"].forEach((id) => {
    getDb().game.puzzle.keywordClaim = id;
    cnv.solveKeyword(id, false);
  });
  const pe = getDb().game.puzzle;
  t.ok(pe.keywordSolved === true && pe.keywordWinner === null, "4 doi sai -> tu ket thuc");
  t.ok(pe.rowsSolved.every(Boolean), "4 doi sai -> mo het manh");
  t.ok(getDb().game.display.answerRevealed === true, "4 doi sai -> lo dap an");
  console.log(`\n${t.summary() === 0 ? "R2-06 OK" : "R2-06 FAIL"}`);
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
