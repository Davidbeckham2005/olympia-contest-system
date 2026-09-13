// Suite R2-03a: CHẤM + XẾP HẠNG (mark/compute/reveal).
// Chạy: node server/tests/round2/r2_mark.test.js
import { getDb, saveDbSync } from "../../models/store.js";
import * as cnv from "../../services/rounds/vuotCnv.service.js";
import { createHarness } from "./r2_helper.js";
const t = createHarness();
let snapshot = null;
try {
  await t.setup();
  snapshot = JSON.stringify({ game: getDb().game, teams: getDb().teams });
  const seedClosed = () => {
    t.resetPuzzle({ row: 1, phase: "closed", running: false });
    const p = getDb().game.puzzle;
    p.submissions = {
      a: { answer: "A", elapsed: 3 },
      b: { answer: "B", elapsed: 1 },
      c: { answer: "C", elapsed: 2 },
    };
    p.corrections = {};
    p.revealedRows = 0;
  };
  seedClosed();
  cnv.markRowAnswer("b", true);
  cnv.markRowAnswer("a", false);
  t.ok(getDb().game.puzzle.corrections.b === true, "mark Dung doi b");
  t.ok(getDb().game.puzzle.corrections.a === false, "mark Sai doi a");
  cnv.markRowAnswer("b", false);
  t.ok(getDb().game.puzzle.corrections.b === false, "sua cham truoc chot duoc");
  cnv.markRowAnswer("zzz", true);
  t.ok(getDb().game.puzzle.corrections.zzz === undefined, "team chua nop -> no-op");
  seedClosed();
  cnv.markRowAnswer("b", true);
  cnv.markRowAnswer("c", true);
  cnv.markRowAnswer("a", false);
  const ranked = cnv.computeRowRanked();
  const byId = Object.fromEntries(ranked.map((r) => [r.teamId, r]));
  t.ok(byId.b.points === 40 && byId.b.place === 1, "nhanh nhat dung -> 40/place 1");
  t.ok(byId.c.points === 30 && byId.c.place === 2, "nhi dung -> 30/place 2");
  t.ok(byId.a.points === 0 && byId.a.correct === false, "sai -> 0 diem");
  // Code KHÔNG đồng hạng: xếp place theo thứ tự elapsed tuyệt đối
  // (computeRowRanked map place=i+1, vuotCnv.service.js:404-406).
  // elapsed 1.004 vs 1.005 khác nhau → place 1/2, điểm 40/30.
  seedClosed();
  getDb().game.puzzle.submissions.b.elapsed = 1.004;
  getDb().game.puzzle.submissions.a.elapsed = 1.005;
  cnv.markRowAnswer("b", true);
  cnv.markRowAnswer("a", true);
  cnv.markRowAnswer("c", false);
  const rk2 = cnv.computeRowRanked();
  const pa = rk2.find((r) => r.teamId === "a");
  const pb = rk2.find((r) => r.teamId === "b");
  t.ok(pb.points === 40 && pb.place === 1, "nhanh hon 1ms -> place 1 +40");
  t.ok(pa.points === 30 && pa.place === 2, "cham hon 1ms -> place 2 +30 (khong dong hang)");
  seedClosed();
  getDb().game.round2Points = [100, 50];
  cnv.markRowAnswer("b", true);
  cnv.markRowAnswer("c", true);
  const rk3 = cnv.computeRowRanked();
  t.ok(rk3.find((r) => r.teamId === "b").points === 100, "custom points[0]=100");
  t.ok(rk3.find((r) => r.teamId === "c").points === 50, "custom points[1]=50");
  getDb().game.round2Points = [40, 30, 20, 10];
  seedClosed();
  cnv.revealNextRowAnswer();
  t.ok(getDb().game.puzzle.revealedRows === 1, "revealNext +1");
  cnv.revealAllRowAnswers();
  t.ok(getDb().game.puzzle.revealedRows === 3, "revealAll = tong bai");
  cnv.revealNextRowAnswer();
  t.ok(getDb().game.puzzle.revealedRows === 3, "revealNext kep tran");
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  cnv.revealNextRowAnswer();
  t.ok((getDb().game.puzzle.revealedRows || 0) === 0, "dang open -> reveal no-op");
  console.log(`\n${t.summary() === 0 ? "R2-03a OK" : "R2-03a FAIL"}`);
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
