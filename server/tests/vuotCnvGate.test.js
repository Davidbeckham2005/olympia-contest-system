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

  // 7. selectRow KHÔNG cho chọn đè ô ĐÃ XỬ LÝ (solved/locked): no-op, giữ nguyên
  //    ranked/lastResult — MC bấm nhầm ô đã mở/khóa không hủy bài cũ.
  resetPuzzle();
  getDb().game.puzzle.rowPhase = "scored";
  getDb().game.puzzle.currentRow = 0;
  getDb().game.puzzle.rowsSolved[1] = true;
  getDb().game.puzzle.rowsLocked[2] = true;
  getDb().game.puzzle.ranked = [{ teamId: "a", correct: true, points: 40 }];
  getDb().game.puzzle.lastResult = { correct: true, row: 0, pts: 40 };
  cnv.selectRow(1);
  ok(
    getDb().game.puzzle.currentRow === 0 && getDb().game.puzzle.rowPhase === "scored" && getDb().game.puzzle.ranked.length === 1,
    "selectRow ô đã MỞ (solved) → no-op, không reset bài/ranked"
  );
  cnv.selectRow(2);
  ok(
    getDb().game.puzzle.currentRow === 0 && getDb().game.puzzle.rowPhase === "scored" && getDb().game.puzzle.lastResult?.row === 0,
    "selectRow ô đã KHÓA (locked) → no-op, không xóa lastResult"
  );

  // 8. selectRow đang XỬ LÝ một ô (open/closed) → CHẶN chuyển sang ô khác, không xóa
  //    submissions đang nhận dở (bảo vệ bài nộp khi MC bấm nhầm ô khác).
  resetPuzzle();
  getDb().game.puzzle.rowPhase = "open";
  getDb().game.puzzle.currentRow = 0;
  getDb().game.puzzle.submissions = { a: { answer: "X", elapsed: 2.5 } };
  let threw = false;
  try {
    cnv.selectRow(1);
  } catch (e) {
    threw = true;
  }
  ok(
    threw && !!getDb().game.puzzle.submissions.a && getDb().game.puzzle.currentRow === 0,
    "selectRow sang ô khác khi đang nhận bài → chặn (throw), giữ nguyên submissions/currentRow"
  );
  // Sau khi đóng nhận bài (chấm dở) cũng không cho đổi ô ngang — phải Chốt/Bỏ chọn trước.
  getDb().game.puzzle.rowPhase = "closed";
  threw = false;
  try {
    cnv.selectRow(3);
  } catch (e) {
    threw = true;
  }
  ok(threw && getDb().game.puzzle.rowPhase === "closed", "selectRow khi đang chấm (closed) → chặn đổi ô");

  // 9. ĐỔI HÀNG sau khi ô cũ đã xử lý xong → đặt lại đồng hồ ô mới (đủ giây, DỪNG), không
  //    vác giờ (elapsed) cũ sang câu mới.
  resetPuzzle();
  getDb().game.puzzle.rowPhase = "idle";
  getDb().game.puzzle.currentRow = null;
  getDb().game.timer = { duration: 30, remaining: 12, running: true, endsAt: Date.now() + 12000 };
  captured = null;
  install({
    setTimer: (sec, running) => {
      captured = { sec, running };
    },
  });
  cnv.selectRow(3);
  ok(
    captured && captured.sec === 30 && captured.running === false,
    "đổi hàng khi timer cũ đang chạy → setTimer(30, dừng) để câu mới tính elapsed từ 0"
  );

  // 10. BỎ CHỌN (puzzle.deselect): rowPhase → "idle" + currentRow → null + xóa bài nộp.
  //     Sau đó thí sinh KHÔNG nộp được và settleRow KHÔNG khóa nhầm hàng.
  resetPuzzle();
  getDb().game.puzzle.rowPhase = "open";
  getDb().game.puzzle.currentRow = 2;
  getDb().game.puzzle.submissions = { a: { answer: "ABC", elapsed: 1 } };
  captured = null;
  install({
    setTimer: (sec, running) => {
      captured = { sec, running };
    },
  });
  cnv.deselectRow();
  ok(getDb().game.puzzle.rowPhase === "idle", "Bỏ chọn → rowPhase idle (không còn ô đang nhận)");
  ok(getDb().game.puzzle.currentRow === null, "Bỏ chọn → currentRow null");
  ok(Object.keys(getDb().game.puzzle.submissions).length === 0, "Bỏ chọn → xóa bài nộp cũ của ô đó");
  ok(captured && captured.sec === 0 && captured.running === false, "Bỏ chọn → đặt lại đồng hồ 0 (không chạy)");
  // Chốt điểm sau Bỏ chọn phải no-op — không được khóa nhầm hàng 2 chưa chơi.
  cnv.settleRow();
  ok(
    getDb().game.puzzle.rowPhase === "idle" && !getDb().game.puzzle.rowsLocked[2],
    "settleRow sau Bỏ chọn → no-op (không khóa nhầm hàng vừa bỏ)"
  );
  // Cổng nộp: ô đã bỏ chọn không nhận bài nữa.
  getDb().game.timer.running = true;
  getDb().game.timer.endsAt = Date.now() + 30 * 1000;
  const late = cnv.submitRowAnswer("a", "LATE");
  ok(late.ok === false, "sau Bỏ chọn → submitRowAnswer từ chối (closed)");

  console.log(`\n${pass} passed, ${fail} failed`);
} finally {
  // Khôi phục DB về trạng thái trước khi chạy (chạy :reset nếu chưa cài).
  if (snapshot) {
    getDb().game = JSON.parse(snapshot);
    await saveDbSync();
  }
}

if (fail > 0) process.exit(1);