// Suite R2-05: TỪ KHÓA (pressBuzzer keyword / solveKeyword).
// Chạy: node server/tests/round2/r2_keyword.test.js
import { getDb, saveDbSync } from "../../models/store.js";
import * as cnv from "../../services/rounds/vuotCnv.service.js";
import * as game from "../../services/game.service.js";
import { createHarness } from "./r2_helper.js";
const t = createHarness();
let snapshot = null;
try {
  await t.setup();
  snapshot = JSON.stringify({ game: getDb().game, teams: getDb().teams });
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  let r = game.pressBuzzer("a", "keyword");
  t.ok(r.winner === "a" && getDb().game.puzzle.keywordClaim === "a", "ghi danh tu khoa duoc");
  r = game.pressBuzzer("b", "keyword");
  t.ok(r.ignored === true, "da co claim -> doi khac ignored");
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  getDb().game.puzzle.keywordBlocked = ["c"];
  r = game.pressBuzzer("c", "keyword");
  t.ok(r.ignored === true && r.blocked === true, "doi blocked -> ignored+blocked");
  // pressBuzzer keyword KHÔNG check rowBanned (game.service.js: chỉ check
  // keywordBlocked + claim + top/eliminate): team rowBanned vẫn claim được.
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  getDb().game.puzzle.rowBanned = ["d"];
  r = game.pressBuzzer("d", "keyword");
  t.ok(r.winner === "d", "rowBanned van claim tu khoa duoc (khong bi chan)");
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  getDb().game.puzzle.keywordSolved = true;
  r = game.pressBuzzer("a", "keyword");
  t.ok(r.ignored === true, "da giai -> ignored");
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  const tb = getDb().teams.find((x) => x.id === "a");
  const was = !!tb.eliminated;
  tb.eliminated = true;
  r = game.pressBuzzer("a", "keyword");
  t.ok(r.ignored === true, "eliminated -> ignored");
  tb.eliminated = was;
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  game.pressBuzzer("b", "keyword");
  const bBefore = getDb().teams.find((x) => x.id === "b").score;
  cnv.solveKeyword("b", true);
  const pz = getDb().game.puzzle;
  t.ok(pz.keywordSolved === true && pz.keywordWinner === "b", "solve Dung -> solved+winner");
  t.ok(pz.rowsSolved.every(Boolean), "solve Dung -> mo het manh");
  t.ok(getDb().teams.find((x) => x.id === "b").score > bBefore, "solve Dung -> cong diem");
  // solveKeyword Sai ở vòng cấm đoán (rowBanned) trong lúc hàng ngang đang open:
  // allowKeywordSolve=false → solveKeyword return sớm, KHÔNG block đội mới.
  // Luồng Sai CHUẨN: đoán khi KHÔNG có hàng ngang đang open (phase scored —
  // allowKeywordSolve=true vì !isRowPhase) → block đội sai, đội khác claim tiếp.
  t.resetPuzzle({ row: 1, phase: "scored", running: false });
  game.pressBuzzer("c", "keyword");
  cnv.solveKeyword("c", false);
  const p2 = getDb().game.puzzle;
  t.ok(p2.keywordClaim === null, "solve Sai -> nha claim");
  t.ok(p2.keywordBlocked.includes("c") && p2.rowBanned.includes("c"), "solve Sai -> blocked+rowBanned");
  // rowBanned chỉ chặn khi đúng team bị ban nộp hàng ngang (reset về open để nộp).
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  getDb().game.puzzle.rowBanned = ["c"];
  t.ok(cnv.submitRowAnswer("c", "Y").reason === "row-banned", "rowBanned -> khong nop hang ngang");
  r = game.pressBuzzer("d", "keyword");
  t.ok(r.winner === "d", "doi khac van ghi danh sau Sai");
  // solveKeyword KHÔNG validate team: team lạ/null mà correct=true vẫn CỘNG ĐIỂM
  // + solved (BUG tiềm ẩn — MC bấm nhầm teamId). Ghi nhận hành vi thực tế.
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  cnv.solveKeyword("zzz", true);
  t.ok(getDb().game.puzzle.keywordSolved === true, "solve team la van solved (thieu validate)");
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  cnv.solveKeyword(null, true);
  t.ok(getDb().game.puzzle.keywordSolved === true, "solve claim null van solved (thieu validate)");
  console.log(`\n${t.summary() === 0 ? "R2-05 OK" : "R2-05 FAIL"}`);
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
