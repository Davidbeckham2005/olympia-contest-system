// Test Vòng phụ (tie_break): nút "Bắt đầu vòng phụ" từ setup → đếm ngược 3-2-1
// (phase countdown + timer 3s, chưa lộ câu) → hết giờ timer loop mở câu hỏi +
// mở chuông (phase running, questionStatus showing).
// Chạy: node server/tests/tieBreakCountdown.test.js
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

  const seed = () => {
    db.game.round = "tie_break";
    db.game.questionIndex = 0;
    db.game.questionStatus = "idle";
    db.game.tieBreak = {
      teams: ["a", "b"],
      questionIndex: 0,
      questions: [
        { id: "tb-1", question: "Đội nào vô địch?", answer: "A", options: [], mediaUrl: "", mediaType: "", note: "" },
      ],
      phase: "setup",
      winner: null,
    };
    db.game.display = { mode: "idle", title: "", question: "", options: [], mediaUrl: "", mediaType: "", answer: "", answerRevealed: false, note: "" };
    db.game.buzzer = { open: false, locked: false, winner: null, blocked: [] };
    db.game.timer = { duration: 0, remaining: 0, running: false, endsAt: null };
  };

  // ---------- Trường hợp 1: từ setup → ấn Bắt đầu → countdown 3s, chưa lộ câu ----------
  seed();
  game.showTieBreakQuestion();
  ok(db.game.tieBreak.phase === "countdown", "Ấn Bắt đầu → phase = countdown (3-2-1)");
  ok(db.game.timer.running === true, "Timer đang chạy khi đếm ngược");
  ok(db.game.tieBreak.questions.length === 1, "Giữ nguyên câu hỏi đã chọn");
  ok(db.game.questionStatus === "idle", "Chưa lộ câu hỏi (questionStatus idle)");
  ok(db.game.buzzer.open === false, "Chuông CHƯA mở trong lúc đếm ngược");

  // ---------- Trường hợp 2: không chọn đội → từ chối ----------
  seed();
  db.game.tieBreak.teams = [];
  const r = game.showTieBreakQuestion();
  ok(r?.reason === "no-teams", "Chưa chọn đội → chặn không cho bắt đầu");

  // ---------- Trường hợp 3: hết giờ countdown → mở câu + mở chuông (simulate timer loop) ----------
  seed();
  game.showTieBreakQuestion();
  // Giả lập timer loop đã đếm về 0: đặt lại remain=0 rồi chạy nhánh như loop thật.
  game.startTimerLoop();
  db.game.timer.endsAt = Date.now() - 1;
  db.game.timer.remaining = 0;
  db.game.timer.running = true;
  await new Promise((res) => setTimeout(res, 400));
  ok(db.game.tieBreak.phase === "running", "Hết 3-2-1 → phase = running (bắt đầu trả lời)");
  ok(db.game.questionStatus === "showing", "Hết 3-2-1 → câu hỏi hiện ra");
  ok(db.game.display.mode === "question", "display hiển thị dạng câu hỏi");
  ok(db.game.buzzer.open === true, "Hết 3-2-1 → mở chuông cho các đội giành quyền");

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