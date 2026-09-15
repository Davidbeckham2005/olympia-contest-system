// Test Vòng phụ (tie_break) — flow mới do MC điều khiển:
//   setup → chọn đội → "Bắt đầu vòng" (selecting: mở màn LỰA CÂU HỎI, chưa chiếu gì) →
//   MC bấm "Chọn" lên một câu → chiếu câu ngay (ready, CHƯA tính giờ) →
//   "Bắt đầu tính giờ" (running, mở nhận đáp án) → hết giờ/đóng sớm (answers) →
//   MC chấm Đúng/Sai → "Lật đáp án": đội đúng + nhanh nhất thắng (done).
// Vòng phụ quyết định bằng 1 câu.
// Chạy: node server/tests/tieBreakFlow.test.js
import { connectDb } from "../config/database.js";
import { loadDb, getDb, saveDbSync } from "../models/store.js";
import * as game from "../services/game.service.js";

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) {
    pass += 1;
    console.log("PASS:", msg);
  } else {
    fail += 1;
    console.error("FAIL:", msg);
  }
}

let snapshot = null;
try {
  await connectDb();
  await loadDb();

  const db = getDb();
  snapshot = JSON.stringify({ game: db.game, teams: db.teams });
  game.setBroadcast(() => {});

  const tick = (ms = 400) => new Promise((res) => setTimeout(res, ms));
  function forceTimerExpired(durationSec = 0) {
    db.game.timer.duration = durationSec;
    db.game.timer.remaining = 0;
    db.game.timer.running = true;
    db.game.timer.endsAt = Date.now() - 1;
  }

  const seed = () => {
    db.game.round = "tie_break";
    db.game.questionIndex = 0;
    db.game.questionStatus = "idle";
    db.game.tieBreak = {
      teams: ["a", "b", "c"],
      questionIndex: 0,
      questions: [
        { id: "tb-1", question: "Đội nào vô địch?", answer: "Olympia", options: [], mediaUrl: "", mediaType: "", note: "" },
        { id: "tb-2", question: "Câu thứ hai?", answer: "Đáp án 2", options: [], mediaUrl: "", mediaType: "", note: "" },
      ],
      phase: "setup",
      winner: null,
      submissions: {},
      corrections: {},
      fastest: null,
    };
    db.game.display = { mode: "idle", title: "", question: "", options: [], mediaUrl: "", mediaType: "", answer: "", answerRevealed: false, note: "" };
    db.game.buzzer = { open: false, locked: false, winner: null, blocked: [] };
    db.game.timer = { duration: 0, remaining: 0, running: false, endsAt: null };
  };

  // ---------- Bước 1: "Bắt đầu vòng" → mở màn LỰA CÂU HỎI, CHƯA chiếu câu ----------
  seed();
  const r = game.beginTieBreak();
  ok(r?.ok === true, "Bấm Bắt đầu vòng phụ → ok");
  ok(db.game.tieBreak.phase === "selecting", "phase = selecting (mở màn lựa câu hỏi)");
  ok(db.game.questionStatus === "idle", "Chưa chiếu câu hỏi lên màn hình");
  ok(db.game.display.mode === "idle", "display vẫn ở dạng idle");
  ok(db.game.timer.running === false, "Timer CHƯA chạy");

  // Chưa chọn đội → không bắt đầu vòng.
  seed();
  db.game.tieBreak.teams = [];
  const rb = game.beginTieBreak();
  ok(rb?.reason === "no-teams", "Chưa chọn đội → chưa bắt đầu vòng được");

  // ---------- Bước 1b: MC bấm "Chọn" lên một câu → CHIẾU CÂU NGAY (ready) ----------
  seed();
  game.beginTieBreak();
  const q1 = { id: "tb-1", question: "Đội nào vô địch?", answer: "Olympia", options: [], mediaUrl: "", mediaType: "", note: "" };
  const pick = game.pickTieBreakQuestion(q1);
  ok(pick?.ok === true, "Bấm Chọn trên một câu → ok");
  ok(db.game.tieBreak.questions.length === 1, "Vòng phụ giữ đúng 1 câu đã chọn");
  ok(db.game.tieBreak.phase === "ready", "Chiếu câu ngay → phase ready");
  ok(db.game.questionStatus === "showing", "Câu hỏi hiện ra trên màn hình");
  ok(db.game.display.mode === "question", "display ở dạng câu hỏi");
  ok(db.game.display.question === "Đội nào vô địch?", "Nội dung câu hỏi chính xác");
  ok(db.game.timer.running === false, "Timer CHƯA chạy khi chỉ chiếu câu hỏi");
  ok(db.game.tieBreak.fastest === null, "Chưa có đội thắng tạm thời");

  // Không truyền câu → từ chối.
  seed();
  game.beginTieBreak();
  const pickNoQ = game.pickTieBreakQuestion();
  ok(pickNoQ?.reason === "no-question", "Không truyền câu hỏi → bị chặn");
  // Chọn câu khi vòng đang chạy/nhận bài (đã chiếu câu) → từ chối.
  seed();
  game.beginTieBreak();
  game.pickTieBreakQuestion(q1);
  const pickAgain = game.pickTieBreakQuestion(q1);
  ok(pickAgain?.reason === "already-started", "Chọn lại câu khi câu đã chiếu → bị chặn");

  // ---------- Bước 2: "Bắt đầu tính giờ trả lời" → đếm ngược 3·2·1 rồi mới mở nhận đáp án ----------
  seed();
  game.beginTieBreak();
  game.pickTieBreakQuestion({ id: "tb-1", question: "Đội nào vô địch?", answer: "Olympia", options: [], mediaUrl: "", mediaType: "", note: "" });
  game.startTieBreakTimer();
  ok(db.game.tieBreak.phase === "countdown", "Bấm Bắt đầu tính giờ → đếm ngược 3·2·1 (phase countdown)");
  ok(db.game.timer.duration === 3, "Đồng hồ chuẩn bị chạy 3 giây");
  ok(db.game.tieBreak.startAt == null, "Mốc tính tốc độ CHƯA đặt trong lúc đếm");
  const s0 = game.submitTieBreak("a", "sớm");
  ok(s0?.reason === "not-open", "Đang đếm 3·2·1 → chưa nộp đáp án được");
  game.startTimerLoop();
  forceTimerExpired();
  await tick();
  ok(db.game.tieBreak.phase === "running", "Hết đếm 3·2·1 → phase running");
  ok(db.game.timer.running === true, "Đồng hồ trả lời chạy sau đếm ngược");
  ok(db.game.tieBreak.startAt > 0, "Ghi nhận mốc bắt đầu để tính tốc độ");

  // ---------- Bước 2b: tính giờ khi chưa chiếu câu → từ chối ----------
  seed();
  game.beginTieBreak();
  const r3 = game.startTieBreakTimer();
  ok(r3?.reason === "not-ready", "Chưa chiếu câu hỏi thì không bấm giờ được");

  // ---------- Bước 3: nộp đáp án khi đang tính giờ (đồng thời + nhiều lần) ----------
  seed();
  game.beginTieBreak();
  game.pickTieBreakQuestion({ id: "tb-1", question: "Đội nào vô địch?", answer: "Olympia", options: [], mediaUrl: "", mediaType: "", note: "" });
  game.startTieBreakTimer();
  game.startTimerLoop();
  forceTimerExpired();
  await tick();
  ok(db.game.tieBreak.phase === "running", "Hết đếm 3·2·1 → mở nhận đáp án (running)");
  const s1 = game.submitTieBreak("a", "Olympia");
  ok(s1?.ok === true, "Đội A nộp được khi đang tính giờ");
  ok(Number(db.game.tieBreak.submissions.a.elapsed) >= 0, "Bài nộp có ghi thời gian elapsed");

  // Gửi lại (nhiều lần) → ghi đè đáp án + elapsed mới.
  await new Promise((res) => setTimeout(res, 30));
  const s2 = game.submitTieBreak("a", "Olympia (sửa)");
  ok(s2?.ok === true, "Đội A gửi lại lần 2 được (ghi đè)");
  ok(db.game.tieBreak.submissions.a.answer === "Olympia (sửa)", "Đáp án bị ghi đè bởi lần gửi mới");

  // Đội chưa được chọn → không nộp.
  const s3 = game.submitTieBreak("d", "hack");
  ok(s3?.reason === "not-participant", "Đội không tham gia → không nộp được");

  // ---------- Bước 4: đóng nhận bài (chờ chốt đáp án) ----------
  game.closeTieBreak();
  ok(db.game.tieBreak.phase === "answers", "Đóng nhận bài → phase = answers");
  ok(db.game.timer.running === false, "Đồng hồ dừng khi đóng nhận bài");
  const s4 = game.submitTieBreak("b", "muộn");
  ok(s4?.reason === "not-open", "Sau khi đóng → không nộp thêm được");

  // ---------- Bước 4b: hết giờ (timer loop) cũng tự đóng nhận bài ----------
  seed();
  game.beginTieBreak();
  game.pickTieBreakQuestion({ id: "tb-1", question: "Đội nào vô địch?", answer: "Olympia", options: [], mediaUrl: "", mediaType: "", note: "" });
  game.startTieBreakTimer();
  game.startTimerLoop();
  // Hết đếm ngược 3·2·1 → running.
  forceTimerExpired(3);
  await tick();
  ok(db.game.tieBreak.phase === "running", "Đếm ngược xong → mở nhận đáp án (running)");
  // Hết giờ trả lời thật → tự đóng nhận bài.
  forceTimerExpired();
  await tick();
  ok(db.game.tieBreak.phase === "answers", "Hết giờ → tự đóng nhận bài (phase answers)");
  ok(db.game.questionStatus === "showing", "Câu hỏi vẫn hiện để MC chấm");

  // ---------- Bước 5: MC chấm Đúng/Sai + đội nhanh nhất được chọn ----------
  seed();
  db.game.tieBreak.phase = "answers";
  db.game.tieBreak.submissions = {
    a: { answer: "Olympia", elapsed: 3.0 },
    b: { answer: "Olympia", elapsed: 1.5 },
    c: { answer: "Sai cmnr", elapsed: 0.5 },
  };
  game.markTieBreakAnswer("a", true);
  game.markTieBreakAnswer("b", true);
  ok(db.game.tieBreak.fastest === "b", "Trong các đội ĐÚNG, đội nhanh nhất (b) được chọn");
  game.markTieBreakAnswer("a", false);
  ok(db.game.tieBreak.fastest === "b", "Bỏ chấm sai đội a → vẫn còn b là nhanh nhất");

  // ---------- Bước 5b: không được chấm khi chưa đóng nhận bài ----------
  seed();
  db.game.tieBreak.phase = "running";
  db.game.tieBreak.submissions = { a: { answer: "x", elapsed: 1 } };
  const m1 = game.markTieBreakAnswer("a", true);
  ok(m1?.reason === "not-closed", "Chấm sớm khi còn nhận bài → bị chặn");

  // ---------- Bước 6: "Lật đáp án" công bố đội thắng (đúng + nhanh nhất) ----------
  seed();
  db.game.tieBreak.phase = "answers";
  db.game.tieBreak.submissions = {
    a: { answer: "Olympia", elapsed: 4.0 },
    b: { answer: "Olympia", elapsed: 1.2 },
    c: { answer: "hi hi", elapsed: 0.5 },
  };
  db.game.tieBreak.corrections = { a: true, b: true, c: false };
  const reveal = game.revealTieBreakAnswer();
  ok(reveal?.winner === "b", "Lật đáp án → đội B (đúng + nhanh nhất) thắng");
  ok(db.game.tieBreak.phase === "done", "Có người thắng → vòng phụ done");
  ok(db.game.display.answerRevealed === true, "Đáp án được lật trên màn hình");

  // ---------- Bước 6a: "Hiện đáp án của câu hỏi" — chỉ lật đáp án, CHƯA công bố đội thắng ----------
  seed();
  db.game.tieBreak.phase = "answers";
  db.game.tieBreak.submissions = {
    a: { answer: "Olympia", elapsed: 4.0 },
    b: { answer: "Olympia", elapsed: 1.2 },
  };
  db.game.tieBreak.corrections = { a: true, b: true };
  const showAns = game.showTieBreakAnswer();
  ok(showAns?.ok === true, "Bấm Hiện đáp án của câu hỏi → ok");
  ok(db.game.display.answerRevealed === true, "Đáp án câu hỏi hiện ra");
  ok(db.game.display.answer === "Olympia", "Nội dung đáp án đúng được đưa lên màn hình");
  ok(db.game.tieBreak.phase === "answers", "Vẫn ở phase answers — chưa công bố đội thắng");
  ok(db.game.tieBreak.winner === null, "Chưa có đội thắng khi chỉ hiện đáp án");

  seed();
  db.game.tieBreak.phase = "running";
  const showAns2 = game.showTieBreakAnswer();
  ok(showAns2?.reason === "not-closed", "Còn nhận bài thì không hiện đáp án được");

  // ---------- Bước 6b: không ai đúng → không có người thắng ----------
  seed();
  db.game.tieBreak.phase = "answers";
  db.game.tieBreak.submissions = { a: { answer: "sai", elapsed: 1 } };
  db.game.tieBreak.corrections = { a: false };
  const reveal2 = game.revealTieBreakAnswer();
  ok(reveal2?.winner === null, "Không đội nào đúng → chưa có người thắng");
  ok(db.game.tieBreak.phase === "answers", "Vẫn ở phase answers chờ MC xử lý");

  // ---------- Bước 7: vòng phụ 1 câu → bấm Câu tiếp sau khi chốt = hết câu (exhausted) ----------
  seed();
  game.beginTieBreak();
  game.pickTieBreakQuestion({ id: "tb-1", question: "Đội nào vô địch?", answer: "Olympia", options: [], mediaUrl: "", mediaType: "", note: "" });
  game.startTieBreakTimer();
  game.startTimerLoop();
  forceTimerExpired(3);
  await tick();
  game.closeTieBreak();
  const nx = game.nextTieBreakQuestion();
  ok(nx?.ok === true, "Sau khi chốt xong → bấm được Câu tiếp");
  ok(db.game.tieBreak.phase === "exhausted", "Vòng phụ cho 1 câu → Câu tiếp = hết câu (exhausted)");

  // Không được sang câu giữa chừng câu đang thi.
  seed();
  game.beginTieBreak();
  game.pickTieBreakQuestion({ id: "tb-1", question: "Đội nào vô địch?", answer: "Olympia", options: [], mediaUrl: "", mediaType: "", note: "" });
  game.startTieBreakTimer();
  const nx2 = game.nextTieBreakQuestion();
  ok(nx2?.reason === "not-closed", "Còn nhận bài → không sang câu được");

  // ---------- Bước 8: hết câu hỏi → exhausted, MC chọn tay ----------
  seed();
  db.game.tieBreak.questions = [{ id: "tb-1", question: "q?", answer: "a", options: [], mediaUrl: "", mediaType: "", note: "" }];
  game.beginTieBreak();
  game.pickTieBreakQuestion({ id: "tb-1", question: "Đội nào vô địch?", answer: "Olympia", options: [], mediaUrl: "", mediaType: "", note: "" });
  game.startTieBreakTimer();
  game.startTimerLoop();
  forceTimerExpired(3);
  await tick();
  game.closeTieBreak();
  const nx3 = game.nextTieBreakQuestion();
  ok(db.game.tieBreak.phase === "exhausted", "Hết câu hỏi → phase exhausted");
  game.setTieBreakWinner("b");
  ok(db.game.tieBreak.winner === "b" && db.game.tieBreak.phase === "done", "MC chọn tay đội thắng → done");

  // ---------- Bước 9: làm lại vòng phụ ----------
  const rr = game.resetTieBreak();
  ok(rr?.ok === undefined || rr?.ok === true, "Làm lại vòng phụ không lỗi");
  ok(db.game.tieBreak.phase === "setup", "Làm lại → quay về setup");

  await import("../services/game.service.js").then((m) => m.stopTimerLoop());
} catch (e) {
  console.error("ERROR:", e);
  fail += 1;
} finally {
  if (snapshot) {
    const db = getDb();
    const prev = JSON.parse(snapshot);
    db.game = prev.game;
    db.teams = prev.teams;
    saveDbSync();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}