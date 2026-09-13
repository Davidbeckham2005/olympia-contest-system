// Suite R2-02: ĐỒNG HỒ + NỘP BÀI (submitRowAnswer gate).
// Chạy: node server/tests/round2/r2_timer_submit.test.js
import { getDb, saveDbSync } from "../../models/store.js";
import * as cnv from "../../services/rounds/vuotCnv.service.js";
import { createHarness } from "./r2_helper.js";

const t = createHarness();
let snapshot = null;
try {
  await t.setup();
  snapshot = JSON.stringify({ game: getDb().game, teams: getDb().teams });

  // 1. Chưa chạy giờ → not-started (dù rowPhase open + showing).
  t.resetPuzzle({ row: 0, phase: "open", running: false });
  let r = cnv.submitRowAnswer("a", "ABC");
  t.ok(r.ok === false && r.reason === "not-started", "chưa chạy giờ → not-started");

  // 2. Chạy giờ → nhận + overwrite + elapsed là số >= 0.
  getDb().game.timer.running = true;
  getDb().game.timer.endsAt = Date.now() + 30000;
  r = cnv.submitRowAnswer("a", "ABC");
  t.ok(r.ok === true && getDb().game.puzzle.submissions.a?.answer === "ABC", "chạy giờ → nhận bài");
  t.ok(typeof getDb().game.puzzle.submissions.a?.elapsed === "number", "elapsed là số");
  getDb().game.timer.running = true;
  r = cnv.submitRowAnswer("a", "SỬA");
  t.ok(r.ok === true && getDb().game.puzzle.submissions.a?.answer === "SỬA", "nộp lại → ghi đè đáp án mới");

  // 3. Pause giữa chừng → khóa nộp ngay.
  getDb().game.timer.running = false;
  getDb().game.timer.endsAt = null;
  r = cnv.submitRowAnswer("b", "XYZ");
  t.ok(r.ok === false && r.reason === "not-started", "pause → khóa nộp");

  // 4. startRowTimer: lần đầu setTimer(30,chạy); còn giây dư → tiếp tục remaining.
  t.resetPuzzle({ row: 1, phase: "open", running: false });
  let captured = null;
  t.install({ setTimer: (sec, running) => { captured = { sec, running }; } });
  cnv.startRowTimer();
  t.ok(captured?.sec === 30 && captured?.running === true, "startRowTimer lần đầu → (30,chạy)");
  getDb().game.timer = { duration: 30, remaining: 7, running: false, endsAt: null };
  captured = null;
  cnv.startRowTimer();
  t.ok(captured?.sec === 7 && captured?.running === true, "còn 7s dư → tiếp tục 7s");
  t.install();

  // 5. closeRowSubmissions: open→closed + dừng giờ + submit sau → closed.
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  cnv.closeRowSubmissions();
  t.ok(getDb().game.puzzle.rowPhase === "closed", "close → closed");
  t.ok(getDb().game.timer.running === false, "close → dừng giờ");
  t.ok(getDb().game.display.mode === "answers", "close → sang màn đáp án");
  t.ok(cnv.submitRowAnswer("a", "LATE").ok === false, "sau close → từ chối");

  // 6. Từ chối: sai vòng / rowPhase!=open / questionStatus!=showing / keywordSolved.
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  getDb().game.round = "tang_toc";
  t.ok(cnv.submitRowAnswer("a", "X").reason === "closed", "sai vòng → closed");
  getDb().game.round = "vuot_cnv";
  getDb().game.puzzle.rowPhase = "idle";
  t.ok(cnv.submitRowAnswer("a", "X").ok === false, "phase idle → từ chối");
  getDb().game.puzzle.rowPhase = "open";
  getDb().game.timer.running = true;
  getDb().game.questionStatus = "idle";
  t.ok(cnv.submitRowAnswer("a", "X").ok === true, "MC ẩn câu hỏi (questionStatus idle) nhưng rowPhase open + giờ chạy → vẫn nhận nộp");
  getDb().game.questionStatus = "showing";
  getDb().game.puzzle.keywordSolved = true;
  t.ok(cnv.submitRowAnswer("a", "X").reason === "closed", "đã giải từ khóa → closed");

  // 7. Đội bị cấm / ngoài cuộc: rowBanned → row-banned; eliminated → not-open.
  t.resetPuzzle({ row: 0, phase: "open", running: true });
  getDb().game.puzzle.rowBanned = ["b"];
  t.ok(cnv.submitRowAnswer("b", "X").reason === "row-banned", "rowBanned → row-banned");
  const teamB = getDb().teams.find((x) => x.id === "b");
  const wasElim = !!teamB.eliminated;
  teamB.eliminated = true;
  t.ok(cnv.submitRowAnswer("b", "X").reason !== undefined && cnv.submitRowAnswer("c", "Y").ok === true, "eliminated → loại, đội khác vẫn nộp");
  teamB.eliminated = wasElim;
  t.ok(cnv.submitRowAnswer("zzz", "X").reason === "not-open", "team lạ → not-open");

  // 8. Puzzle null (vòng khác/dữ liệu hỏng) → rejected, không crash.
  getDb().game.puzzle = null;
  getDb().game.round = "khoi_dong";
  r = cnv.submitRowAnswer("a", "X");
  t.ok(r.ok === false, "puzzle null → từ chối an toàn");
  getDb().game.round = "vuot_cnv";

  console.log(`\n${t.summary() === 0 ? "R2-02 OK" : "R2-02 FAIL"}`);
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
