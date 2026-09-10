import { getDb } from "../models/store.js";
import * as game from "../services/game.service.js";
import { emitEvent } from "../config/io.js";

const actions = {
  // Reset vòng 2 (Vượt chướng ngại vật) yêu cầu nhập mật khẩu admin để xác nhận.
  "round.start": (p) => {
    if (p.round === "vuot_cnv" && getDb().game.round === "vuot_cnv") {
      if (!p.pin || p.pin !== getDb().settings.pin) {
        const err = new Error("Vui lòng nhập mật khẩu admin để reset vòng Vượt chướng ngại vật.");
        err.status = 401;
        throw err;
      }
    }
    return game.startRound(p.round);
  },
  "timer.set": (p) => game.setTimer(p.seconds, p.running !== false),
  "timer.pause": () => game.pauseTimer(),
  "timer.resume": () => game.resumeTimer(),
  "question.show": () => game.showQuestion(),
  "question.hide": () => game.hideQuestion(),
  "question.next": () => game.nextQuestion(),
  "question.prev": () => game.prevQuestion(),
  "question.reveal": () => game.revealAnswer(),
  "question.hideAnswer": () => game.hideAnswer(),
  "screen.set": (p) => {
    const r = game.setScreenMode(p.mode);
    if (p.mode === "answers") emitEvent("sound:play", { slot: "answers" });
    return r;
  },
  "screen.rules": (p) => (p.show ? game.showRules() : game.hideRules()),
  "question.jump": (p) => {
    const db = getDb();
    const gg = db.game;
    // Trong vòng Tăng tốc, đang chiếu video: đổi sang câu khác phải nhập mật khẩu
    // admin (ngăn MC bấm nhầm làm gián đoạn lượt chiếu cho khán giả).
    if (
      gg.round === "tang_toc" &&
      gg.tangToc?.phase === "video" &&
      gg.timer?.running &&
      Number(p.questionIndex) !== Number(gg.questionIndex)
    ) {
      if (String(p.pin ?? "") !== String(db.settings.pin)) {
        const err = new Error("Đang chiếu video Tăng tốc — cần mật khẩu admin để đổi câu.");
        err.status = 401;
        throw err;
      }
    }
    return game.jumpToQuestion(p.teamId, p.questionIndex, p.memberIndex);
  },
  "answer.mark": (p) => {
    const r = game.markAnswer(!!p.correct, p.teamId);
    emitEvent("sound:play", { slot: p.correct ? "correct" : "wrong" });
    return r;
  },
  "score.add": (p) => game.addScore(p.teamId, p.points),
  "score.set": (p) => game.setScore(p.teamId, p.score),
  "khoi_dong.timer": (p) => game.setKhoiDongTimer(p.seconds),
  "khoi_dong.answerSeconds": (p) => game.setKhoiDongAnswerSeconds(p.seconds),
  "khoi_dong.reset": (p) => {
    // Reset trạng thái (điểm/history) của thí sinh trong vòng Khởi động là thao tác
    // DESTRUCTIVE — mỗi ADMIN mới được lưu lượng. Yêu cầu mật khẩu admin mỗi lần.
    const db = getDb();
    if (String(p.pin ?? "") !== String(db.settings.pin)) {
      const err = new Error("Reset trạng thái Khởi động cần mật khẩu admin để xác nhận.");
      err.status = 401;
      throw err;
    }
    return game.resetKhoiDong(p.teamId);
  },
  "khoi_dong.continue": () => game.continueKhoiDong(),
  "khoi_dong.start": (p) => game.startKhoiDongTeam(p.teamId),
  "team.set": (p) => game.setCurrentTeam(p.teamId),
  "buzzer.open": () => game.openBuzzer(),
  "buzzer.close": () => game.closeBuzzer(),
  "buzzer.reset": (p) => game.resetBuzzer(!!p.open),
  "buzzer.press": (p) => game.pressBuzzer(p.teamId, p.intent),
  "puzzle.piece": (p) => game.revealPiece(p.index, p.value !== false),
  "puzzle.select": (p) => game.selectRow(p.row),
  "puzzle.deselect": () => game.deselectRow(),
  "puzzle.startTimer": () => game.startRowTimer(),
  "puzzle.row": (p) => game.revealRow(p.row),
  "puzzle.all": () => game.revealAllPuzzle(),
  "puzzle.show": () => game.showPuzzle(),
  "puzzle.close": () => game.closeRowSubmissions(),
  "puzzle.mark": (p) => game.markRowAnswer(p.teamId, !!p.correct),
  "puzzle.settle": () => game.settleRow(),
  "puzzle.nextAnswer": () => game.revealNextRowAnswer(),
  "puzzle.allAnswers": () => game.revealAllRowAnswers(),
  "keyword.solve": (p) => {
    const r = game.solveKeyword(p.teamId, !!p.correct);
    emitEvent("sound:play", { slot: p.correct ? "correct" : "wrong" });
    return r;
  },
  "media.show": (p) => game.showMedia(p.url, p.type),
  "scores.show": () => game.showScores(),
  "vedich.pick": (p) => game.vedichSelectPackage(p.packagePoints),
  "vedich.star": (p) => game.vedichSetStar(!!p.star),
  "vedich.clear": (p) => game.vedichClearPicked(p.teamId),
  "vedich.lock": () => game.vedichLockPackage(),
  "vedich.unlock": () => game.vedichUnlockPackage(),
  "vedich.start": () => game.vedichStartGame(),
  "vedich.startAnswer": () => game.startVedichAnswerTimer(),
  "tangtoc.submit": (p) => game.submitTangToc(p.teamId, p.answer),
  "tangtoc.play": () => game.tangTocPlay(),
  "tangtoc.countdown": () => game.tangTocStartCountdown(),
  "tangtoc.stop": (p) => game.tangTocStop(p.pin),
  "tangtoc.settle": () => game.settleTangToc(),
  "tangtoc.phase": (p) => game.tangTocSetPhase(p.phase),
  "tangtoc.mark": (p) => {
    const r = game.tangTocMark(p.teamId, !!p.correct);
    emitEvent("sound:play", { slot: p.correct ? "correct" : "wrong" });
    return r;
  },
  "tangtoc.reveal": (p) => game.tangTocReveal(p.step),
  // Đổi bộ điểm thưởng theo độ nhanh của Vòng 2 / Vòng 3 (admin).
  "round.points": (p) => game.setRoundPoints(p.round, p.points),
  "tiebreak.teams": (p) => game.setTieBreakTeams(p.teams),
  "tiebreak.questions": (p) => game.setTieBreakQuestions(p.questions),
  "tiebreak.show": () => game.showTieBreakQuestion(),
  "tiebreak.next": () => game.nextTieBreakQuestion(),
  "tiebreak.mark": (p) => {
    const r = game.markTieBreakAnswer(p.teamId, !!p.correct);
    emitEvent("sound:play", { slot: p.correct ? "correct" : "wrong" });
    return r;
  },
  "tiebreak.winner": (p) => game.setTieBreakWinner(p.teamId),
  "tiebreak.reveal": () => game.revealTieBreakAnswer(),
  "tiebreak.eliminate": (p) => game.eliminateTeam(p.teamId),
  "tiebreak.restore": (p) => game.restoreTeam(p.teamId),
  "contest.finish": () => game.finishContest(),
  "contest.resetGame": () => game.resetGameKeepTeams(),
  "main.resetQuestions": (p) => {
    if (p.pin !== getDb().settings.pin) {
      const err = new Error("Sai PIN ban tổ chức — không thể reset câu hỏi.");
      err.status = 401;
      throw err;
    }
    return game.resetMainRoundState();
  },
};

export function runAction(req) {
  const fn = actions[req.params.action];
  if (!fn) {
    const err = new Error("Hành động không hợp lệ.");
    err.status = 400;
    throw err;
  }
  const result = fn(req.body || {});
  return result === undefined ? { ok: true } : result;
}

export function currentQuestion() {
  const q = game.currentQuestion();
  return {
    question: q,
    keywordPoints: game.keywordPoints(),
    game: getDb().game,
  };
}
