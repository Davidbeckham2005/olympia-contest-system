// Test CỔNG NỘP BÀI VÒNG 2 (hàng ngang tự luận) sau khi hợp nhất "nguồn sự thật"
// về game.timer.running (bỏ cờ timingStarted riêng) — chống tái phát 2 bug đồng hồ
// song song lệch nhau:
//   • Admin bấm "Bắt đầu giờ"/"Tiếp" (timer.set/resume) → thí sinh MỞ được nộp bài;
//   • MC dừng đồng hồ (timer.pause) → thí sinh KHÓA nộp ngay (không còn nộp "lọt");
//   • Đóng nhận bài (closeRowSubmissions) → DỪNG đồng hồ luôn (không chạy tiếp).
// Test tự khôi phục DB về trạng thái trước khi chạy.
import { connectDb } from "../config/database.js";
import { loadDb, getDb, saveDbSync } from "../models/store.js";
import * as cnv from "../services/rounds/vuotCnv.service.js";

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
let isInit = false;

function install(stubs = {}) {
  cnv.init({
    emit: () => {},
    addScore: () => {},
    pauseTimer: () => {
      getDb().game.timer.running = false;
      getDb().game.timer.endsAt = null;
    },
    setTimer: () => {},
    resetDisplayToBoard: () => {},
    showQuestion: () => {},
    resetBuzzer: () => {},
    ...stubs,
  });
  isInit = true;
}

function resetPuzzle() {
  const db = getDb();
  db.game.round = "vuot_cnv";
  db.game.questionStatus = "showing";
  // Đồng hồ CHƯA chạy (MC chưa bấm "Bắt đầu giờ").
  db.game.timer = { duration: 30, remaining: 30, running: false, endsAt: null };
  db.game.puzzle = {
    currentRow: 0,
    rowPhase: "open",
    submissions: {},
    corrections: {},
    ranked: [],
    revealedRows: 0,
    rowsSolved: [],
    rowsLocked: [],
    rowBanned: [],
    keywordSolved: false,
    keywordWindow: false,
    keywordClaim: null,
  };
}

try {
  await connectDb();
  await loadDb();
  install();
  snapshot = JSON.stringify(getDb().game);

  // 1. Đồng hồ chưa chạy → từ chối "not-started" (dù rowPhase open + question showing).
  resetPuzzle();
  let r = cnv.submitRowAnswer("a", "ABC");
  ok(r.ok === false && r.reason === "not-started", "chưa chạy giờ → từ chối not-started");

  // 2. Đồng hồ chạy (bất kỳ đường nào: puzzle.startTimer / timer.set / timer.resume) → nhận bài.
  getDb().game.timer.running = true;
  getDb().game.timer.endsAt = Date.now() + 30 * 1000;
  r = cnv.submitRowAnswer("a", "ABC");
  ok(r.ok === true, "đồng hồ chạy → nhận bài");
  ok(getDb().game.puzzle.submissions["a"]?.answer === "ABC", "lưu đáp án + elapsed hợp lệ");
  ok(typeof getDb().game.puzzle.submissions["a"]?.elapsed === "number" && getDb().game.puzzle.submissions["a"].elapsed >= 0, "elapsed ghi nhận số >= 0");

  // 3. Tạm dừng (timer.pause) → từ chối ngay, dù trước đó đang mở nhận bài.
  getDb().game.timer.running = false;
  getDb().game.timer.endsAt = null;
  r = cnv.submitRowAnswer("b", "XYZ");
  ok(r.ok === false && r.reason === "not-started", "dừng giờ giữa chừng → khóa nộp (not-started)");

  // 4. BỎ CỜ CŨ: chỉ cần timer.running, không phụ thuộc timingStarted (giả lập vẫn false).
  resetPuzzle();
  getDb().game.puzzle.timingStarted = false;
  getDb().game.timer.running = true;
  getDb().game.timer.endsAt = Date.now() + 30 * 1000;
  r = cnv.submitRowAnswer("c", "OK");
  ok(r.ok === true, "timer.running là đủ — cờ timingStarted không còn chặn nộp");

  // 5. Đóng nhận bài → DỪNG đồng hồ + rowPhase "closed" + từ chối "closed".
  resetPuzzle();
  getDb().game.timer.running = true;
  getDb().game.timer.endsAt = Date.now() + 30 * 1000;
  cnv.closeRowSubmissions();
  ok(getDb().game.puzzle.rowPhase === "closed", "đóng nhận bài → rowPhase closed");
  ok(getDb().game.timer.running === false, "đóng nhận bài → đồng hồ bị dừng (pauseTimer)");
  r = cnv.submitRowAnswer("a", "LATE");
  ok(r.ok === false && r.reason === "closed", "đã đóng → từ chối closed");

  // 6. startRowTimer: chưa từng chạy → setTimer(answerSeconds, running true);
  //    nếu đồng hồ còn giây dư (MC Dừng giữa chừng) → tiếp tục từ remaining.
  resetPuzzle();
  let captured = null;
  install({
    setTimer: (sec, running) => {
      captured = { sec, running };
    },
  });
  cnv.startRowTimer();
  ok(captured && captured.sec === 30 && captured.running === true, "startRowTimer lần đầu → setTimer(30, chạy)");
  resetPuzzle();
  getDb().game.timer = { duration: 30, remaining: 7, running: false, endsAt: null };
  captured = null;
  cnv.startRowTimer();
  ok(captured && captured.sec === 7 && captured.running === true, "startRowTimer khi còn giây dư → tiếp tục từ 7s (không reset về 0)");

  console.log(`\n${pass} passed, ${fail} failed`);
} finally {
  // Khôi phục DB về trạng thái trước khi chạy (chạy :reset nếu chưa cài).
  if (snapshot) {
    getDb().game = JSON.parse(snapshot);
    await saveDbSync();
  }
}

if (fail > 0) process.exit(1);