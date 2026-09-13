// Suite TT-1: MÀN HÌNH TĂNG TỐC — setScreenMode("answers") bị CHẶN khi video đang chiếu.
// Audit: 🔴 Rò rỉ đáp án — tab "Đáp án các đội" trong lúc phase "video" && running vẫn mở
// được (khán giả + các đội đọc bài nộp của nhau realtime). Fix: server trả 400.
// Suite TT-3: "Chốt điểm Tăng tốc" cũng bị CHẶN giữa lúc video chiếu (không khóa điểm sớm).
// Chạy: node server/tests/round2/r2_screen_tt.test.js
import { getDb } from "../../models/store.js";
import * as game from "../../services/game.service.js";
import { createHarness } from "./r2_helper.js";
const t = createHarness();

function ttSetup(phase, running) {
  const db = getDb();
  db.game.round = "tang_toc";
  db.game.display = db.game.display || {};
  db.game.display.mode = "question";
  db.game.tangToc = {
    phase,
    submissions: { a: { answer: "MAU", elapsed: 1.5 } },
    corrections: {},
    ranked: [],
    settled: false,
    reveal: "",
    elapsedBase: 0,
    startedAt: Date.now(),
    resumeFrom: null,
  };
  db.game.timer = {
    duration: 120,
    remaining: running ? 100 : 120,
    running,
    endsAt: running ? Date.now() + 100 * 1000 : null,
  };
}

function modeNow() {
  return getDb().game.display?.mode;
}

try {
  await t.setup({}, { captureTimers: true });

  // 1. Đang CHIẾU video (phase "video" + running): mở answers → THROW 400, giữ nguyên mode.
  ttSetup("video", true);
  let threw = false;
  let status = null;
  try {
    game.setScreenMode("answers");
  } catch (e) {
    threw = true;
    status = e.status;
  }
  t.ok(threw && status === 400, "video running -> setScreenMode(answers) throw 400");
  t.ok(modeNow() === "question", "video running -> mode giữ question (không lộ bài)");

  // 2. Video chạy: chuyển question vẫn OK (chiếu lại / giữ màn video).
  ttSetup("video", true);
  game.setScreenMode("question");
  t.ok(modeNow() === "question", "video running -> setScreenMode(question) vẫn OK");

  // 3. HẾT video (phase tự chuyển "answers"): mở answers OK.
  ttSetup("answers", false);
  game.setScreenMode("answers");
  t.ok(modeNow() === "answers", "hết video (phase answers) -> mở màn đáp án OK");

  // 4. MC ĐÃ DỪNG video (phase vẫn "video" nhưng timer không chạy): mở answers OK.
  ttSetup("video", false);
  game.setScreenMode("answers");
  t.ok(modeNow() === "answers", "đã dừng video (running=false) -> mở màn đáp án OK");

  // 5. Đang đếm ngược chuẩn bị (preparing + running): video chưa chiếu, chưa ai nộp —
  //    cho phép mở answers (không rò rỉ), nhưng ngầm kiểm tra setScreenMode chạy không lỗi.
  ttSetup("preparing", true);
  game.setScreenMode("answers");
  t.ok(modeNow() === "answers", "preparing -> mở answers không lỗi (chưa ai nộp)");

  // ===== TT-3: "Chốt điểm Tăng tốc" bị CHẶN giữa lúc video chiếu (không khóa điểm sớm).
  // 6. Video đang chiếu có submission + corrections: settle → THROW 400, không khóa điểm.
  ttSetup("video", true);
  getDb().game.tangToc.corrections = { a: true };
  getDb().game.tangToc.ranked = [{ teamId: "a", answer: "MAU", correct: true, points: 40, elapsed: 1.5, place: 1 }];
  threw = false;
  status = null;
  try {
    game.settleTangToc();
  } catch (e) {
    threw = true;
    status = e.status;
  }
  t.ok(threw && status === 400, "video running -> settleTangToc throw 400");
  t.ok(getDb().game.tangToc.settled === false, "video running -> settled giữ false (không khóa điểm sớm)");
  t.ok(getDb().game.tangToc.reveal === "", "video running -> reveal không bị bật điểm");

  // 7. Hết video (phase answers) có corrections → chốt điểm OK.
  ttSetup("answers", false);
  getDb().game.tangToc.corrections = { a: true };
  getDb().game.tangToc.ranked = [{ teamId: "a", answer: "MAU", correct: true, points: 40, elapsed: 1.5, place: 1 }];
  game.settleTangToc();
  t.ok(getDb().game.tangToc.settled === true, "hết video (phase answers) -> chốt điểm OK");
  t.ok(getDb().game.tangToc.reveal === "scores", "hết video -> chốt điểm bật reveal scores");

  // 8. MC đã Dừng video (running=false) có corrections → chốt điểm OK.
  ttSetup("video", false);
  getDb().game.tangToc.corrections = { a: true };
  getDb().game.tangToc.ranked = [{ teamId: "a", answer: "MAU", correct: true, points: 40, elapsed: 1.5, place: 1 }];
  game.settleTangToc();
  t.ok(getDb().game.tangToc.settled === true, "đã dừng video (running=false) -> chốt điểm OK");

  // 9. Đã settle → gọi lại no-op (không cộng điểm trùng).
  const before = getDb().teams.find((x) => x.id === "a")?.score || 0;
  game.settleTangToc();
  game.settleTangToc();
  const after = getDb().teams.find((x) => x.id === "a")?.score || 0;
  t.ok(after === before, "settle lan 2,3 -> khong cong diem trung");

  // ===== TT-3 mở rộng: chấm Đúng/Sai tay (tangTocMark) cũng bị CHẶN khi video còn chiếu.
  // 9a. Video running + có bài nộp: mark → THROW 400, corrections giữ nguyên.
  ttSetup("video", true);
  getDb().game.tangToc.submissions = { a: { answer: "MAU", elapsed: 5 } };
  threw = false;
  status = null;
  try {
    game.tangTocMark("a", true);
  } catch (e) {
    threw = true;
    status = e.status;
  }
  t.ok(threw && status === 400, "video running -> tangTocMark throw 400");
  t.ok(getDb().game.tangToc.corrections?.a === undefined, "video running -> chưa chấm (corrections trống)");

  // 9b. Hết video (phase answers): chấm Đúng/Sai OK (corrections ghi nhận).
  ttSetup("answers", false);
  getDb().game.tangToc.submissions = { a: { answer: "MAU", elapsed: 5 } };
  game.tangTocMark("a", true);
  t.ok(getDb().game.tangToc.corrections?.a === true, "hết video -> chấm Đúng OK");
  t.ok(getDb().game.tangToc.ranked[0]?.points === 40, "hết video -> ranked tính điểm 40 cho đội đúng");

  // 9c. Đã Dừng video (running=false): chấm được.
  ttSetup("video", false);
  getDb().game.tangToc.submissions = { a: { answer: "MAU", elapsed: 5 } };
  game.tangTocMark("a", false);
  t.ok(getDb().game.tangToc.corrections?.a === false, "đã dừng video -> chấm Sai OK");

  // ===== TT-4: nextQuestion()/prevQuestion() ở Vòng 3 phải tải lại màn hình (jumpToQuestion),
  // ===== KHÔNG được tự tăng index rồi để display.answer/mediaUrl của câu cũ sót lại.
  // 10. Sang câu kế (index 0 -> 1): display phải chỉ về câu MỚI (mode question + media),
  //     tangToc được reset (không giữ settled/submissions của câu cũ).
  ttSetup("video", false);
  getDb().game.tangToc.ranked = [{ teamId: "a", answer: "OLD", correct: true, points: 40, elapsed: 1, place: 1 }];
  getDb().game.tangToc.settled = true;
  getDb().game.display.mediaUrl = "old-q0-video.mp4";
  getDb().game.display.mode = "answers";
  const q1 = getDb().questions.main.tangToc[0];
  const q2 = getDb().questions.main.tangToc[1];
  getDb().game.display.answer = q1.answer;
  getDb().game.questionIndex = 0;
  game.nextQuestion();
  const dbAfterNext = getDb();
  t.ok(dbAfterNext.game.questionIndex === 1, "nextQuestion tang_toc -> questionIndex 1");
  t.ok(dbAfterNext.game.display.mode === "question", "nextQuestion -> display về màn question (không kẹt answers cũ)");
  t.ok(dbAfterNext.game.display.mediaUrl === (q2.mediaUrl || ""), "nextQuestion -> mediaUrl tải đúng câu mới");
  t.ok(dbAfterNext.game.display.answer === (q2.answer || ""), "nextQuestion -> answer tải đúng câu mới");
  t.ok(!dbAfterNext.game.tangToc.settled, "nextQuestion -> tangToc được reset (settled=false)");

  // 11. Quay câu trước (index 1 -> 0): tương tự, display về câu 0.
  ttSetup("video", false);
  getDb().game.questionIndex = 1;
  getDb().game.display.mode = "answers";
  getDb().game.display.answer = q2.answer;
  getDb().game.display.mediaUrl = "STALE.mp4";
  game.prevQuestion();
  const dbAfterPrev = getDb();
  t.ok(dbAfterPrev.game.questionIndex === 0, "prevQuestion tang_toc -> questionIndex 0");
  t.ok(dbAfterPrev.game.display.mode === "question", "prevQuestion -> display về màn question");
  t.ok(dbAfterPrev.game.display.answer === (q1.answer || ""), "prevQuestion -> answer tải đúng câu trước");
  t.ok(dbAfterPrev.game.display.mediaUrl === (q1.mediaUrl || ""), "prevQuestion -> mediaUrl tải đúng câu trước");

  // ===== TT-5: showQuestion() Vòng 3 KHÔNG reset tangToc (không xóa bài nộp/điểm đang chấm).
  // 12. Đang chiếu video có submissions/corrections/settled: showQuestion giữ nguyên
  //     submissions + reveal, chỉ setup "sẵn sàng chiếu" (mode question, note, timer running=false).
  ttSetup("video", true);
  const db12 = getDb();
  db12.game.tangToc.submissions = { a: { answer: "MAU", elapsed: 5 } };
  db12.game.tangToc.corrections = { a: true };
  db12.game.tangToc.reveal = "scores";
  db12.game.tangToc.settled = true;
  db12.game.display.mode = "answers";
  game.showQuestion();
  const dbShow = getDb();
  t.ok(dbShow.game.tangToc.submissions.a?.answer === "MAU", "showQuestion -> giữ nguyên submissions (không reset)");
  t.ok(dbShow.game.tangToc.settled === true, "showQuestion -> giữ nguyên settled");
  t.ok(dbShow.game.tangToc.reveal === "scores", "showQuestion -> giữ nguyên reveal");
  t.ok(dbShow.game.display.mode === "question", "showQuestion -> mode question (sẵn sàng chiếu)");
  t.ok(dbShow.game.timer.running === false, "showQuestion tang_toc -> timer dừng (chờ bắt đầu giờ)");

  console.log(`\n${t.summary() === 0 ? "TT-1 OK" : "TT-1 FAIL"}`);
} finally {
  await t.teardown();
}
if (t.fail > 0) process.exit(1);