// Test Vòng 1 (khoi_dong): khi MC chấm Đúng/Sai thì đáp án lóe lên (set
// display.answerRevealed + emit ngay), nhưng KHÔNG pause đồng hồ 60s và KHÔNG chờ
// answerSeconds — tự sang ảnh kế NGAY, thí sinh vẫn phải trả lời trong 1 phút.
// Chạy: node server/tests/khoiDongReveal.test.js
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
let captured = null;
try {
  await connectDb();
  await loadDb();

  const db = getDb();
  snapshot = JSON.stringify({ game: db.game, teams: db.teams });
  game.setBroadcast((event, payload) => {
    if (event === "khoi_dong:mark") captured = payload;
  });

  // Dựng trạng thái tối thiểu: đang thi ảnh 1/5 của đội A, tab 60s đang chạy.
  const seed = () => {
    db.game.round = "khoi_dong";
    db.game.currentTeam = "a";
    db.game.questionIndex = 0;
    db.game.questionStatus = "showing";
    db.game.display = {
      mode: "question",
      question: "Ảnh này là gì?",
      options: [],
      mediaUrl: "",
      mediaType: "",
      answer: "ĐÁP ÁN A",
      answerRevealed: false,
      note: "",
      title: "",
    };
    db.game.khoiDong = {
      submissions: {},
      timerSeconds: 60,
      answerSeconds: 4,
      history: {},
      memberIndex: 0,
      timerStarted: 0,
      phase: "play",
      breakInfo: null,
    };
    db.game.timer = { duration: 60, remaining: 60, running: true, endsAt: Date.now() + 60000 };
    // Đội A: thí sinh 0 → 5 ảnh (id/answer đủ để currentQuestion() trả về câu).
    db.questions.main.khoiDong.a = [
      Array.from({ length: 5 }, (_, i) => ({ id: `a0-${i}`, answer: `ĐÁP ÁN ${i + 1}`, points: 10, mediaUrl: "", mediaType: "" })),
    ];
    for (const t of db.teams) t.score = 0;
  };

  // ---------- Trường hợp 1: chấm ĐÚNG → +điểm, đáp án lóe, sang ảnh NGAY, timer chạy tiếp ----------
  seed();
  captured = null;
  game.markAnswer(true, "a");
  ok(captured && captured.teamId === "a" && captured.correct === true, "Broadcast khoi_dong:mark gửi teamId + correct");
  ok(captured && captured.answer === "ĐÁP ÁN A", "Broadcast khoi_dong:mark gửi kèm answer của ảnh đang hiển thị");
  ok(db.game.khoiDong.history.a[0][0] === true, "Lưu history thí sinh 0 / ảnh 0 = ĐÚNG");
  ok((db.teams.find((t) => t.id === "a").score || 0) === 10, "Đội A +10 điểm");
  ok(db.game.questionIndex === 1, "Sang ẢNH KẾ NGAY (questionIndex 0→1), không chờ answerSeconds");
  ok(db.game.display.answerRevealed === false, "Ảnh mới hiển thị, chưa lật đáp án");
  ok(db.game.questionStatus === "showing", "Ảnh mới đang hiển thị để trả lời");
  ok(db.game.timer.running === true, "Đồng hồ 60s CHẠY TIẾP (không bị pause trong lúc hiện đáp án)");
  ok(Math.abs(db.game.timer.remaining - 60) <= 1, `Không trừ thời gian thi, giữ remaining ~60s (hiện ${db.game.timer.remaining})`);

  // ---------- Trường hợp 2: chấm SAI → không cộng điểm, vẫn sang ảnh kế ----------
  seed();
  game.markAnswer(false, "a");
  ok(db.game.khoiDong.history.a[0][0] === false, "Lưu history thí sinh 0 / ảnh 0 = SAI");
  ok((db.teams.find((t) => t.id === "a").score || 0) === 0, "Đội A không cộng điểm khi sai");
  ok(db.game.questionIndex === 1, "Chấm SAI cũng sang ảnh kế NGAY");

  // ---------- Trường hợp 2b: chấm SAI vẫn broadcast (ring + đáp án flash chạy) ----------
  seed();
  captured = null;
  game.markAnswer(false, "a");
  ok(captured && captured.correct === false && captured.answer === "ĐÁP ÁN A", "Chấm SAI vẫn broadcast khoi_dong:mark kèm answer cho hiệu ứng");

  // ---------- Trường hợp 2c: answer rỗng (data chưa nhập) → broadcast vẫn chạy, client flash fallback ----------
  seed();
  db.game.display.answer = "";
  db.questions.main.khoiDong.a[0][0].answer = "";
  captured = null;
  game.markAnswer(false, "a");
  ok(captured && captured.answer === "" && captured.mediaUrl === "", "Answer rỗng vẫn broadcast (client dựa mediaUrl/fallback để flash)");

  // ---------- Trường hợp 3: chấm lại ảnh đã chấm → bỏ qua, không advance/đổi điểm ----------
  seed();
  db.game.khoiDong.history = { a: { 0: { 0: true } } };
  (db.teams.find((t) => t.id === "a").score = 10);
  const qIdx = db.game.questionIndex;
  game.markAnswer(true, "a");
  ok(db.game.questionIndex === qIdx, "Chấm lại ảnh đã chấm → bỏ qua, không nhảy");
  ok((db.teams.find((t) => t.id === "a").score || 0) === 10, "Chấm lại không cộng điểm đúp");
} catch (err) {
  fail += 1;
  console.error("ERROR:", err.message);
} finally {
  if (snapshot) {
    const s = JSON.parse(snapshot);
    getDb().game = s.game;
    getDb().teams = s.teams;
    await saveDbSync();
    console.log("Đã khôi phục DB về trạng thái ban đầu.");
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);