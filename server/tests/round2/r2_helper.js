// Helper dùng chung cho suite kiểm thử tự động Round 2 (vuot_cnv).
// Mỗi file test import helper này nên chạy độc lập: tự connectDb + loadDb,
// snapshot game/teams/round2Points, stub cnv.init, restore sau khi xong.
import { connectDb } from "../../config/database.js";
import { loadDb, getDb, saveDbSync } from "../../models/store.js";
import * as cnv from "../../services/rounds/vuotCnv.service.js";

export function createHarness() {
  let pass = 0;
  let fail = 0;
  let snapshot = null;
  const timers = [];
  const realSetTimeout = globalThis.setTimeout;

  function ok(cond, msg) {
    if (cond) {
      pass += 1;
      console.log("PASS:", msg);
    } else {
      fail += 1;
      console.error("FAIL:", msg);
    }
  }

  // capture=true: chặn setTimeout thật (auto-chain answers->question->puzzle của
  // settleRow) để test không treo 8s; vẫn lưu callback để assert thủ công.
  function install(stubs = {}, { captureTimers = false } = {}) {
    timers.length = 0;
    if (captureTimers) {
      globalThis.setTimeout = (fn, ms, ...rest) => {
        timers.push({ fn, ms });
        return timers.length;
      };
    } else if (globalThis.setTimeout !== realSetTimeout) {
      globalThis.setTimeout = realSetTimeout;
    }
    cnv.init({
      emit: () => {},
      addScore: (teamId, points) => {
        const t = getDb().teams.find((x) => x.id === teamId);
        if (t) t.score = Math.max(0, Number(t.score || 0) + Number(points || 0));
      },
      pauseTimer: () => {
        getDb().game.timer.running = false;
        getDb().game.timer.endsAt = null;
      },
      setTimer: (sec, running) => {
        const g = getDb().game;
        g.timer.duration = sec;
        g.timer.remaining = sec;
        g.timer.running = !!running && sec > 0;
        g.timer.endsAt = g.timer.running ? Date.now() + sec * 1000 : null;
      },
      resetDisplayToBoard: () => {
        getDb().game.display.mode = "puzzle";
      },
      showQuestion: () => {
        const g = getDb().game;
        g.questionStatus = "showing";
        g.display.mode = "question";
      },
      resetBuzzer: () => {
        getDb().game.buzzer = { open: false, locked: false, winner: null, order: [], blocked: [] };
      },
      ...stubs,
    });
  }

  // Dựng trạng thái puzzle tối thiểu cho 1 ô đang nhận bài.
  function resetPuzzle({ row = 0, phase = "open", running = false } = {}) {
    const db = getDb();
    db.game.round = "vuot_cnv";
    db.game.questionStatus = phase === "open" || phase === "closed" || phase === "scored" ? "showing" : "idle";
    db.game.display = db.game.display || {};
    db.game.display.mode = "question";
    db.game.timer = {
      duration: 30,
      remaining: 30,
      running,
      endsAt: running ? Date.now() + 30 * 1000 : null,
    };
    db.game.buzzer = { open: false, locked: false, winner: null, order: [], blocked: [] };
    db.game.puzzle = {
      rowsSolved: [false, false, false, false, false],
      rowsLocked: [false, false, false, false, false],
      keywordSolved: false,
      keywordWinner: null,
      keywordPointsAwarded: 0,
      currentRow: row,
      keywordWindow: false,
      keywordBlocked: [],
      keywordClaim: null,
      lastResult: null,
      rowBanned: [],
      rowPhase: phase,
      submissions: {},
      corrections: {},
      ranked: [],
      revealedRows: 0,
    };
  }

  async function setup(stubs, opts) {
    await connectDb();
    await loadDb();
    install(stubs, opts);
    snapshot = JSON.stringify({ game: getDb().game, teams: getDb().teams });
  }

  async function teardown() {
    globalThis.setTimeout = realSetTimeout;
    try {
      await import("../../services/game.service.js").then((m) => m.stopTimerLoop());
    } catch {}
    if (snapshot) {
      const s = JSON.parse(snapshot);
      getDb().game = s.game;
      getDb().teams = s.teams;
      await saveDbSync();
    }
  }

  function summary() {
    console.log(`\n${pass} passed, ${fail} failed`);
    return fail;
  }

  return { ok, install, resetPuzzle, setup, teardown, summary, timers, get fail() { return fail; } };
}
