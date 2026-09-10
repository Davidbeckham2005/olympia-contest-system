  import { getDb, saveDb, defaultGame, emptyPuzzle, ROUNDS, roundsView } from "../models/store.js";
  import { TEAM_ORDER } from "../config/constants.js";
  import * as cnv from "./rounds/vuotCnv.service.js";
  import * as vedich from "./rounds/veDich.service.js";

  // Số giây đếm ngược "chuẩn bị chiếu" trước khi video tăng tốc được phát (đồng bộ
  // trên mọi màn hình — MC + khán giả + đội).
  export const TANG_TOC_PREP_SECONDS = 3;
  // Số giây đếm ngược "3-2-1" trước khi tự hiện câu đầu tiên của đội (Vòng Về đích).
  export const VEDICH_COUNTDOWN_SECONDS = 3;
  // Số giây đếm ngược "3-2-1" trước TỪNG lượt thi của đội ở Vòng 1 (Bắt đầu & Sang đội).
  export const KHOI_DONG_PREP_SECONDS = 3;

  // Trạng thái mặc định cho mỗi câu hỏi vòng 3 (reset khi đổi câu / vào vòng).
  // startedAt: thời điểm đoạn chiếu hiện tại bắt đầu — mốc 0s để ghi nhận đáp án.
  function freshTangToc() {
    return {
      submissions: {},
      ranked: [],
      phase: "video",
      corrections: {},
      settled: false,
      resumeFrom: null,
      elapsedBase: 0,
      startedAt: null,
      // Trình tự bật mở trên màn hình khán giả trong giai đoạn chấm điểm (tạo hồi hộp):
      //   ""       → chưa hiện gì (màn chờ "HẾT GIỜ")
      //   "scores" → LỘ KẾT QUẢ CHẤM ĐIỂM (+40/30/20/10) + đáp án đúng
      reveal: "",
    };
  }

  let timerHandle = null;
  let khoiDongTimer = null;
  // Handle tự động bắt đầu tính giờ trả lời Vòng Về đích (nếu MC không bấm kịp trong X giây).
  let vedichAutoTimer = null;
  let broadcast = () => {};

  export function setBroadcast(fn) {
    broadcast = fn;
  }

  export function emit() {
    broadcast("game:state", publicGame());
  }

  export function getTimer() {
    return g().timer;
  }
  // lấy dữ liệu game hiện tại hiển thị ra màng hình
  export function publicGame() {
    const db = getDb();
    const state = {
      teams: db.teams.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        accent: t.accent,
        score: t.score,
        eliminated: !!t.eliminated,
        members: t.memberIds.map((id) => {
          const c = db.contestants.find((x) => x.id === id);
          return c ? { id: c.id, name: c.name } : null;
        }).filter(Boolean),
      })),
      // Gộp timer vào CÙNG game:state để phase + trạng thái đồng hồ LUÔN nhất quán trong
      // một sự kiện socket. Trước đây timer bị lược bỏ ở đây → client phải khớp riêng lẻ
      // hai luồng "game:state" (phase) và "game:timer" (running) -> dễ bị lệch nhịp 1 nhịp
      // và hiện sai "Video chưa phát" dù video đang chiếu (vd màn hình đội D).
      game: db.game,
      questions: db.questions,
      settings: {
        title: db.settings.title,
        subtitle: db.settings.subtitle,
        audienceBg: db.settings.audienceBg || "dark",
        audienceBgUrl: db.settings.audienceBgUrl || "",
      },
      sounds: db.sounds || { buzz: { url: "", name: "" } },
      // Luật thi từng vòng — ưu tiên bản admin đã chỉnh trong DB (roundsView)
      rounds: roundsView(db.rules),
    };
    if (db.game.round === "vuot_cnv") {
      state.cnv = cnv.cnvView(db);
    }
    return state;
  }

  export const cnvView = (db) => cnv.cnvView(db);

  function g() {
    return getDb().game;
  }

  function team(id) {
    return getDb().teams.find((t) => t.id === id);
  }

  // Danh sách id đầy đủ đội vòng 1 (theo thứ tự lượt thi).
  function allTeamIds() {
    return TEAM_ORDER;
  }

  // Đội còn thi (chưa bị MC khóa vĩnh viễn). MC tự quyết định loại đội bằng nút Khóa
  // — hệ thống không tự loại ai. Nguồn sự thật duy nhất: team.eliminated trên DB.
  function activeTeamIds() {
    return getDb().teams.filter((t) => !t.eliminated).map((t) => t.id);
  }

  function isTopTeam(id) {
    return activeTeamIds().includes(id);
  }

  export function startTimerLoop() {
    stopTimerLoop();
    timerHandle = setInterval(() => {
      const game = g();
      if (!game.timer.running || !game.timer.endsAt) return;
      const remaining = Math.max(0, Math.ceil((game.timer.endsAt - Date.now()) / 1000));
      game.timer.remaining = remaining;
      if (remaining <= 0) {
        game.timer.running = false;
        game.timer.endsAt = null;
        if (game.round === "tang_toc") {
          const ph = game.tangToc?.phase;
          if (ph === "preparing") {
            // Hết đếm ngược chuẩn bị → chuyển sang CHIẾU VIDEO thật:
            // nếu đang ở lần phát lại sau khi MC dừng (có resumeFrom) thì tiếp tục
            // từ vị trí đã dừng, còn không thì phát lại từ đầu câu hiện tại.
            game.tangToc.phase = "video";
            const resumeFrom = game.tangToc.resumeFrom || 0;
            game.tangToc.resumeFrom = null;
            // Mốc bắt đầu đoạn chiếu này: bài nộp tính elapsed = elapsedBase + (now - startedAt)/1000
            // → đồng hồ ghi đáp án đếm TỪ 0S cho mỗi lần phát (fresh: 0; resume: nối tiếp chính xác).
            game.tangToc.startedAt = Date.now();
            if (resumeFrom > 0) {
              setTimer(resumeFrom, true);
            } else {
              const q = getDb().questions.main.tangToc[game.questionIndex];
              setTimer(q?.duration || q?.timeLimit || 120, true);
            }
          } else if (ph === "video") {
            // Hết video: tự đóng nhận bài, chuyển sang giai đoạn chấm điểm —
            // khán giả mặc định ở MÀN CHỜ (reveal="") chờ MC mở kết quả chấm điểm.
            game.tangToc.resumeFrom = null;
            game.tangToc.elapsedBase = 0;
            game.tangToc.startedAt = null;
            game.tangToc.reveal = "";
            game.tangToc.phase = "answers";
          }
        } else if (game.round === "ve_dich") {
          const ved = game.veDich;
          if (ved.phase === "countdown") {
            // Hết đếm ngược 3-2-1 → tự hiện câu hỏi đầu tiên và bắt đếm giờ trả lời.
            ved.phase = "answering";
            showQuestion();
          } else if (ved.phase === "answering" && !ved.stealOpen) {
            // Hết thời gian trả lời của đội đang thi → mở chuông cho các đội khác
            // giành quyền trả lời. Đội vừa hết giờ bị CHẶN (cướp lại chính mình).
            ved.stealOpen = true;
            game.buzzer = game.buzzer || {};
            game.buzzer.blocked = game.buzzer.blocked || [];
            if (!game.buzzer.blocked.includes(game.currentTeam)) game.buzzer.blocked.push(game.currentTeam);
            resetBuzzer(true);
          }
        } else if (
          game.round === "vuot_cnv" &&
          !game.puzzle.keywordSolved &&
          !cnv.cornersResolved() &&
          !game.puzzle.keywordWindow
        ) {
          // Hết thời gian trả lời HÀNG NGANG: đóng nhận bài để MC chấm các đội.
          // (Round 2 giờ là trả lời TỰ LUẬN gửi về MC — không còn mở chuông cướp
          // như trước. MC sẽ chấm từng đội rồi bấm Chốt.)
          cnv.closeRowSubmissions();
        } else if (game.round === "khoi_dong") {
          if (game.khoiDong?.phase === "countdown") {
            // Hết đếm ngược 3-2-1 → bắt đầu thi thật: hiện ảnh đầu + chạy đồng hồ 60s.
            game.khoiDong.phase = "play";
            if (currentQuestion()) showQuestion();
          } else {
            // Hết thời giác thành véna → oznaczenie niezodpowiedzianych jako sai
            // i automatyczne przejście do przerwy (nie pokazujemy już câu hỏi).
            markKhoiDongUnanswered();
            enterKhoiDongBreak();
          }
        }
        broadcast("game:timer", game.timer);
        emit();
        saveDb();
        return;
      }
      broadcast("game:timer", game.timer);
    }, 250);
  }

  export function stopTimerLoop() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

  export function setTimer(seconds, running = true) {
    const game = g();
    const duration = Math.max(0, Number(seconds) || 0);
    game.timer.duration = duration;
    game.timer.remaining = duration;
    game.timer.running = running && duration > 0;
    game.timer.endsAt = game.timer.running ? Date.now() + duration * 1000 : null;
    saveDb();
    broadcast("game:timer", game.timer);
    emit();
  }

  export function pauseTimer() {
    const game = g();
    if (game.timer.running && game.timer.endsAt) {
      game.timer.remaining = Math.max(0, Math.ceil((game.timer.endsAt - Date.now()) / 1000));
    }
    game.timer.running = false;
    game.timer.endsAt = null;
    saveDb();
    broadcast("game:timer", game.timer);
    emit();
  }

  export function resumeTimer() {
    const game = g();
    if (game.timer.remaining > 0) {
      game.timer.running = true;
      game.timer.endsAt = Date.now() + game.timer.remaining * 1000;
    }
    saveDb();
    broadcast("game:timer", game.timer);
    emit();
  }

  export function addScore(teamId, points) {
    const t = team(teamId);
    if (!t) return;
    t.score = Math.max(0, t.score + Number(points || 0));
    saveDb();
    emit();
  }

  // Xác thực mật khẩu đội (dùng cho API login và các sự kiện socket của đội)
  export function checkTeamPass(teamId, pass) {
    const t = team(teamId);
    if (!t) return false;
    return String(pass ?? "") === String(t.pass ?? "");
  }

  export function setScore(teamId, score) {
    const t = team(teamId);
    if (!t) return;
    t.score = Math.max(0, Number(score) || 0);
    saveDb();
    emit();
  }

export function setKhoiDongTimer(seconds) {
  const game = g();
  if (game.round !== "khoi_dong") return;
  game.khoiDong = game.khoiDong || { submissions: {} };
  game.khoiDong.timerSeconds = Math.max(5, Number(seconds) || 60);
  setTimer(game.khoiDong.timerSeconds, false);
}

export function setKhoiDongAnswerSeconds(seconds) {
  const game = g();
  game.khoiDong = game.khoiDong || { submissions: {} };
  game.khoiDong.answerSeconds = Math.max(0, Number(seconds) || 0);
  saveDb();
  emit();
}

export function setKhoiDongTimerSeconds(seconds) {
  const game = g();
  game.khoiDong = game.khoiDong || { submissions: {} };
  game.khoiDong.timerSeconds = Math.max(5, Number(seconds) || 60);
  saveDb();
  emit();
}

// Reset trạng thái trả lời vòng Khởi động (đưa các câu về "chưa trả lời")
export function resetKhoiDong(teamId = null) {
  const game = g();
  if (game.round !== "khoi_dong") return;
  game.khoiDong = game.khoiDong || { submissions: {}, timerSeconds: 60, history: {}, memberIndex: 0, timerStarted: -1 };
  game.khoiDong.history = game.khoiDong.history || {};
  game.khoiDong.submissions = game.khoiDong.submissions || {};
  game.khoiDong.phase = "play";
  game.khoiDong.breakInfo = null;
  if (teamId) {
    game.khoiDong.history[teamId] = {};
    delete game.khoiDong.submissions[teamId];
  } else {
    game.khoiDong.history = {};
    game.khoiDong.submissions = {};
  }
  saveDb();
  emit();
}

  export function startRound(roundId) {
    const game = g();
    if (khoiDongTimer) {
      clearTimeout(khoiDongTimer);
      khoiDongTimer = null;
    }
    game.phase = "main";
    game.round = roundId;
    game.questionIndex = 0;
    game.currentTeam = "a";
    game.questionStatus = "idle";
    game.finished = false;
    game.roundStarted = true;
    game.display = {
      mode: "idle",
      title: ROUNDS.find((r) => r.id === roundId)?.name || "",
      question: "",
      options: [],
      mediaUrl: "",
      mediaType: "",
      answer: "",
      answerRevealed: false,
      note: "",
    };
    resetBuzzer();
    g().buzzer.blocked = [];
    // Dọn đồng hồ của vòng trước: đồng hồ cũ vẫn chạy có thể đếm ngược sang vòng mới
    // (và tới 0 sẽ vô tình mở chuông "chờ cướp" dù chưa có câu hỏi nào đang thi)
    setTimer(0, false);
    if (roundId === "vuot_cnv") {
      game.puzzle = emptyPuzzle();
      // MC tự quyết định ai tiếp tục bằng nút Khóa (khóa vĩnh viễn) — hệ thống không
      // tự loại/chọn đội nào cả.
      // Không còn thứ tự chọn ô (pick-order): MC chọn trực tiếp ô nào cũng được.
      // Mở vòng ở màn hình BẢNG MẢNH GHÉP — chưa chọn/chiếu câu hỏi nào cả.
      game.display.mode = "puzzle";
    }
    if (roundId === "tang_toc") {
      game.tangToc = freshTangToc();
    }
    if (roundId === "khoi_dong") {
      game.khoiDong = { submissions: {}, timerSeconds: game.khoiDong?.timerSeconds || 60, answerSeconds: game.khoiDong?.answerSeconds, history: {}, memberIndex: 0, timerStarted: -1 };
      setTimer(game.khoiDong.timerSeconds, false);
    }
    if (roundId === "ve_dich") {
      // Đảm bảo ngân hàng câu chung ở dạng chuẩn (mảng); KHÔNG tự tạo câu nháp.
      vedich.ensureBank();
      game.veDich = vedich.defaultState();
      // Chỉ 4 đội điểm cao thi vòng 4; bắt đầu từ đội điểm cao nhất.
      const top = activeTeamIds();
      const first = top[0] || game.currentTeam;
      game.currentTeam = first;
      game.veDich.answeringTeam = first;
    }
    if (roundId === "tie_break") {
      game.tieBreak = { teams: [], questionIndex: 0, questions: [], phase: "setup", winner: null };
    }
    saveDb();
    emit();
  }

  function currentQuestion() {
    const db = getDb();
    const game = db.game;
    const main = db.questions.main;
    if (game.round === "khoi_dong") {
      const clusters = main.khoiDong[game.currentTeam] || [];
      const cluster = clusters[game.khoiDong?.memberIndex || 0] || [];
      return cluster[game.questionIndex] || null;
    }
    if (game.round === "vuot_cnv") {
      return main.vuotCnv.rows[game.puzzle.currentRow] || null;
    }
    if (game.round === "tang_toc") {
      return main.tangToc[game.questionIndex] || null;
    }
    if (game.round === "ve_dich") {
      return vedich.findQuestion(game);
    }
    return null;
  }

  // Đưa màn hình về bảng chính, xóa sạch câu hỏi/đáp án đang hiển thị
  function resetDisplayToBoard() {
    const game = g();
    game.display.mode = game.round === "vuot_cnv" ? "puzzle" : "idle";
    game.display.question = "";
    game.display.options = [];
    game.display.answer = "";
    game.display.answerRevealed = false;
    game.display.note = "";
    game.questionStatus = "idle";
  }

  export function showQuestion() {
    const game = g();
    const q = currentQuestion();
    if (!q) {
      const err = new Error("Chưa có câu hỏi phù hợp — hãy chọn đội/gói câu hỏi trước khi hiện.");
      err.status = 400;
      throw err;
    }
    game.questionStatus = "showing";
    game.display.mode = "question";
    game.display.question = game.round === "khoi_dong" ? "Ảnh này là gì?" : q.question || (q.mediaUrl || q.mediaType ? "Ảnh này là gì?" : "");
    game.display.options = q.options || [];
    game.display.answer = q.answer;
    game.display.answerRevealed = false;
    game.display.mediaUrl = q.mediaUrl || "";
    game.display.mediaType = q.mediaType || "";
    game.display.note = q.note || "";
    game.display.title = ROUNDS.find((r) => r.id === game.round)?.name || "";
    if (game.round === "vuot_cnv" && !cnv.cornersResolved()) {
      game.display.note = `Hàng ngang ${game.puzzle.currentRow + 1} • ${q.letterCount || ""} chữ`;
      setTimer(game.vuotCnv?.answerSeconds || 30, true);
    }
    if (game.round === "tang_toc") {
      // Không tự phát — chỉ "sẵn sàng chiếu": MC bấm "Chiếu video" để chạy đếm ngược
      // 3 giây rồi mới phát (tangTocPlay).
      game.tangToc = freshTangToc();
      const ttDur = q.duration || q.timeLimit || 120;
      game.display.note = `Câu ${game.questionIndex + 1} — bấm “Bắt đầu đếm giờ” để chiếu video (đếm ngược ${TANG_TOC_PREP_SECONDS}s rồi phát).`;
      setTimer(ttDur, false);
    }
    if (game.round === "khoi_dong") {
      // Bắt đầu show câu hỏi (nút "Bắt đầu" hoặc jump) → hết trạng thái "chờ bắt đầu".
      game.khoiDong = game.khoiDong || {};
      game.khoiDong.ready = false;
      game.khoiDong.submissions = {};
      game.khoiDong.memberIndex = game.khoiDong.memberIndex ?? 0;
      // Mỗi thí sinh có TỔNG 1 phút cho cả 5 ảnh: chỉ reset đồng hồ khi bắt đầu
      // thí sinh mới (timerStarted !== memberIndex), không reset khi đổi ảnh 2–5.
      const timerSec = game.khoiDong?.timerSeconds || 60;
      const mi = game.khoiDong.memberIndex ?? 0;
      if (game.khoiDong.timerStarted !== mi || !game.timer.running) {
        game.khoiDong.timerStarted = mi;
        setTimer(timerSec, true);
      }
      const clusters = getDb().questions.main.khoiDong?.[game.currentTeam] || [];
      const memberTotal = clusters.length || 1;
      const memberName = getDb().teams.find((t) => t.id === game.currentTeam)?.memberIds?.[mi];
      game.display.note = `${team(game.currentTeam)?.name || ""} • Thí sinh ${mi + 1}/${memberTotal}${memberName ? ` (${memberName})` : ""} • Ảnh ${game.questionIndex + 1}/5 • 10 điểm`;
    }
    if (game.round === "ve_dich") {
      game.veDich.phase = "answering";
      const star =
        game.veDich.starQuestion === (game.veDich.pickIndex ?? 0)
          ? " • Ngôi sao hy vọng"
          : "";
      game.display.note = `${team(game.currentTeam)?.name || ""} • ${q?.points || 20} điểm${star}`;
      // Không tự chạy timer — MC đọc câu hỏi xong rồi bấm "Bắt đầu tính giờ"
      // (vedich.startAnswer). Chỉ đặt duration/remaining theo điểm câu, running = false.
      setTimer(vedich.getAnswerSeconds(game), false);
      // Nếu MC không bấm kịp trong X giây (settings.veDichAutoAnswerSeconds) → tự bắt đầu.
      scheduleVedichAutoStart();
    }
    saveDb();
    emit();
  }

  export function revealAnswer() {
    const game = g();
    // Vòng 2 dùng 1 màn hình duy nhất (bảng mảnh + câu hỏi), không có chế độ
    // "question" riêng — cho phép lật đáp án trực tiếp trên màn hình chung.
    if (game.round !== "vuot_cnv" && game.display.mode !== "question") {
      const err = new Error("Chưa hiện câu hỏi — bấm “Hiện câu hỏi” trước khi lật đáp án.");
      err.status = 400;
      throw err;
    }
    game.display.answerRevealed = true;
    game.questionStatus = "revealed";
    saveDb();
    emit();
  }

  export function hideAnswer() {
    const game = g();
    if (!game.display.answerRevealed) return;
    game.display.answerRevealed = false;
    game.questionStatus = "showing";
    saveDb();
    emit();
  }

  // Ẩn câu hỏi, đưa màn hình về bảng chính (Vòng 2 quay về bảng mảnh ghép)
  export function hideQuestion() {
    const game = g();
    if (!game.round) return;
    game.display.mode = game.round === "vuot_cnv" ? "puzzle" : "idle";
    game.display.answerRevealed = false;
    game.questionStatus = "idle";
    saveDb();
    emit();
  }

  // Bật/tắt màn hình hiển thị trên màn hình lớn (chỉ dùng cho Vòng 2) — 3 màn hình
  // riêng biệt do MC điều khiển, đồng bộ cả Khán giả lẫn Thí sinh:
  //   mode === "question" → MÀN HÌNH CÂU HỎI
  //   mode === "answers"  → MÀN HÌNH ĐÁP ÁN CÁC ĐỘI GỬI VỀ (MC mở dần từng đáp án)
  //   còn lại             → MÀN HÌNH ẢNH GHÉP + HÀNG NGANG
  // Giữ nguyên dữ liệu câu hỏi (display.question/answer...) để MC chuyển qua lại thoải mái.
  // ✓ Vòng 3 (Tăng tốc) dùng CHUNG cơ chế này: "question" → chiếu video, "answers" → đáp án
  //   các đội (2 màn riêng, tab trên bàn MC).
  export function setScreenMode(mode) {
    const game = g();
    if (game.round !== "vuot_cnv" && game.round !== "tang_toc") return;
    game.display.mode =
      mode === "question" || mode === "answers"
        ? mode
        : game.round === "tang_toc"
          ? "question"
          : "puzzle";
    saveDb();
    emit();
  }

  // Điểm thưởng theo độ nhanh cho Vòng 2 (round2Points) / Vòng 3 (round3Points).
  // Đọc từ game state; fallback về mặc định [40, 30, 20, 10] nếu DB cũ chưa có.
  function roundPoints(round) {
    const pts = round === "vuot_cnv" ? g().round2Points : g().round3Points;
    return Array.isArray(pts) && pts.length ? pts.map((n) => Number(n) || 0) : [40, 30, 20, 10];
  }

  // Admin/MC chỉnh bộ điểm thưởng của một vòng (vuot_cnv / tang_toc).
  export function setRoundPoints(round, points) {
    const game = g();
    if (round !== "vuot_cnv" && round !== "tang_toc") return;
    const arr = Array.isArray(points)
      ? points.map((n) => Math.max(0, Number(n) || 0))
      : [40, 30, 20, 10];
    if (round === "vuot_cnv") game.round2Points = arr;
    else game.round3Points = arr;
    saveDb();
    emit();
  }

  export function getRoundPoints(round) {
    return roundPoints(round);
  }

  // markAnswer dùng chung: vòng 2 (vuot_cnv) chấm qua luồng riêng (puzzle.mark + puzzle.settle) nên bỏ qua.
  export function markAnswer(correct, teamId = null) {
    const game = g();
    const q = currentQuestion();
    const tid = teamId || game.currentTeam;
    if (!q) {
      // Chưa chọn câu hỏi: vẫn chấm điểm thủ công (+10 mặc định / không trừ)
      if (correct) addScore(tid, 10);
      saveDb();
      emit();
      return;
    }
    let points = q.points || 10;
    if (game.round === "ve_dich") {
      // === VÒNG VỀ ĐÍCH: chấm Đúng/Sai riêng cho vòng này rồi return. ===
      // Mọi tình huống tính từ điểm GỐC P qua vedich.calculateAnswerScore (không hard-code
      // 10/20/30; NSHV x2 theo P). Điểm cập nhật NGAY sau khi có kết quả trả lời.
      const ved = game.veDich;
      const base = vedich.getBasePoints(game);
      const star = ved.starQuestion === (ved.pickIndex ?? 0);
      if (ved.stealOpen) {
        // Đang ở "cửa sổ cướp quyền".
        const winner = game.buzzer?.winner;
        if (!winner) {
          // Không có đội nào giành quyền trả lời → áp dụng trường hợp "không ai trả lời được":
          // đội chọn câu bị trừ P/2 (NSHV) hoặc 0 (câu thường). Đóng cửa sổ và hiện đáp án
          // để MC chiếu cho khán giả rồi sang câu kế.
          const pend = ved.stealPending || { teamId: tid, base, star };
          ved.stealPending = null;
          ved.stealOpen = false;
          closeBuzzer();
          const adj = vedich.calculateAnswerScore({ questionPoints: pend.base, isStarOfHope: pend.star, outcome: "no-answer" });
          addScore(pend.teamId, adj.selecting);
          game.display.answerRevealed = true;
          game.questionStatus = "revealed";
          pauseTimer();
          saveDb();
          emit();
          return;
        }
        closeBuzzer();
        ved.stealOpen = false;
        const pend = ved.stealPending;
        ved.stealPending = null;
        if (pend) {
          // Đội chọn câu đã trả lời SAI → chấm theo bảng luật có đội giành quyền.
          const outcome = correct ? "steal-correct" : "steal-wrong";
          const adj = vedich.calculateAnswerScore({ questionPoints: pend.base, isStarOfHope: pend.star, outcome });
          addScore(pend.teamId, adj.selecting);
          addScore(winner, adj.stealing);
        } else {
          // Hết giờ (đội chủ câu KHÔNG trả lời) rồi mới mở chuông → giữ nguyên quy tắc đang
          // có: đội giành quyền được ±P (không kế thừa NSHV), đội chủ câu không bị trừ.
          addScore(winner, correct ? base : -base);
        }
        game.display.answerRevealed = true;
        game.questionStatus = "revealed";
        pauseTimer();
        saveDb();
        emit();
        return;
      }
      if (correct) {
        // Đội đang thi trả lời ĐÚNG → +P (hoặc +2P nếu câu là Ngôi sao hy vọng).
        const adj = vedich.calculateAnswerScore({ questionPoints: base, isStarOfHope: star, outcome: "selecting-correct" });
        addScore(tid, adj.selecting);
        game.display.answerRevealed = true;
        game.questionStatus = "revealed";
        pauseTimer();
        saveDb();
        emit();
        return;
      }
      // Đội đang thi trả lời SAI: CHƯA trừ điểm ai ngay — điểm trừ của đội chọn câu được quyết
      // định theo kết quả cửa sổ cướp quyền (bảng luật 2.2/2.3/3.2). Mở chuông cho các đội còn
      // lại giành quyền trả lời và lưu ngữ cảnh (stealPending) để chấm đúng khi cướp kết thúc.
      ved.stealPending = { teamId: tid, base, star };
      ved.stealOpen = true;
      game.buzzer = game.buzzer || {};
      game.buzzer.blocked = game.buzzer.blocked || [];
      if (!game.buzzer.blocked.includes(tid)) game.buzzer.blocked.push(tid);
      resetBuzzer(true);
      pauseTimer();
      saveDb();
      emit();
      return;
    }
    // Vòng 2 (Vượt chướng ngại vật) chấm điểm qua bảng "Bài nộp tự luận" riêng:
    // puzzle.mark (MC chấm từng đội) + puzzle.settle (chốt điểm theo tốc độ nộp).
    // markAnswer chung không còn vai trò gì ở vòng này → bỏ qua hoàn toàn để không
    // cộng/trừ điểm lẫn với cơ chế chấm theo tốc độ của vòng 2.
    if (game.round === "vuot_cnv") {
      saveDb();
      emit();
      return;
    }
    // Vòng Khởi động: chấm xong chuyển NGAY sang ảnh kế
    if (game.round === "khoi_dong" && game.display.mode === "question") {
      // Câu đã zostało chấm điểm — kliknięcie nie chấmуje go ponownie.
      if (typeof game.khoiDong?.history?.[tid]?.[game.khoiDong?.memberIndex ?? 0]?.[game.questionIndex] === "boolean") {
        saveDb();
        emit();
        return;
      }
      // Lưu lịch sử đúng/sai theo thí sinh (member) → chỉ số ảnh
      game.khoiDong.history = game.khoiDong.history || {};
      game.khoiDong.history[tid] = game.khoiDong.history[tid] || {};
      const mi = game.khoiDong.memberIndex ?? 0;
      game.khoiDong.history[tid][mi] = game.khoiDong.history[tid][mi] || {};
      game.khoiDong.history[tid][mi][game.questionIndex] = !!correct;
      // Báo màn hình Khán giả: hiệu ứng stamp ĐÚNG/SAI ngay khi MC vừa chấm điểm.
      broadcast("khoi_dong:mark", { teamId: tid, correct: !!correct });
      // Vòng 1: câu ĐÚNG được cộng điểm (10 điểm/ảnh); câu SAI không trừ.
      // Guard chống cộng trùng đã xử lý ở đầu branch, nên mỗi ảnh chỉ cộng đúng 1 lần.
      if (correct) addScore(tid, points);
      // Chấm xong → chuyển NGAY sang ảnh kế. Không hiện/giữ màn hình đáp án
      // (thí sinh có tổng 1 phút cho cả 5 ảnh, không chờ đáp án).
      const before = `${game.currentTeam}:${game.questionIndex}`;
      nextQuestion();
      const moved = `${game.currentTeam}:${game.questionIndex}` !== before;
      if (moved && currentQuestion()) {
        showQuestion();
      }
      return;
    }
    // Chỉ lật đáp án khi câu hỏi đang thực sự hiển thị trên màn hình.
    if (game.display.mode === "question") {
      game.display.answerRevealed = true;
      game.questionStatus = "revealed";
    }
    saveDb();
    emit();
  }

  // Oznacz wszystkie niezodpowiedziane câu aktualnego thành véna jako sai (false)
  function markKhoiDongUnanswered() {
    const game = g();
    const tid = game.currentTeam;
    const mi = game.khoiDong?.memberIndex ?? 0;
    const clusters = getDb().questions.main.khoiDong[tid] || [];
    if (!Array.isArray(clusters[mi])) return;
    game.khoiDong.history = game.khoiDong.history || {};
    game.khoiDong.history[tid] = game.khoiDong.history[tid] || {};
    game.khoiDong.history[tid][mi] = game.khoiDong.history[tid][mi] || {};
    for (let i = 0; i < clusters[mi].length; i++) {
      if (typeof game.khoiDong.history[tid][mi][i] !== "boolean") {
        game.khoiDong.history[tid][mi][i] = false;
      }
    }
  }

  // Przejście do khoàng nghỉ (break) między thành véna/đội albo do kết thúc (done)
  function enterKhoiDongBreak() {
    const game = g();
    // Kết thúc lượt của thí sinh/đội → dừng đồng hồ cũ; đồng hồ 60s mới sẽ do
    // showQuestion() khởi động khi MC bấm Tiếp tục / nhảy sang thí sinh kế.
    pauseTimer();
    const order = allTeamIds();
    const teamIdx = order.indexOf(game.currentTeam);
    const memberTotal = (getDb().questions.main.khoiDong[game.currentTeam] || []).length || 1;
    const mi = game.khoiDong?.memberIndex ?? 0;
    // Tránh lỗi hiển thị: khi sang break (chờ MC chuyển thí sinh/đội), không để
    // questionStatus = "idle" (vì nextQuestion → resetDisplayToBoard đã đưa về idle),
    // nếu không MC tưởng là "chưa bắt đầu — chọn đội" còn khán giả bị màn nền.
    game.questionStatus = "showing";
    if (mi + 1 < memberTotal) {
      game.khoiDong.phase = "break";
      game.khoiDong.breakInfo = { kind: "member", teamId: game.currentTeam, nextMember: mi + 1, memberTotal };
    } else if (teamIdx < order.length - 1) {
      game.khoiDong.phase = "break";
      game.khoiDong.breakInfo = { kind: "team", teamId: game.currentTeam, nextTeamId: order[teamIdx + 1] };
    } else {
      game.khoiDong.phase = "done";
      game.khoiDong.breakInfo = { kind: "done" };
    }
  }

  export function nextQuestion() {
    const game = g();
    resetDisplayToBoard();
    resetBuzzer();
if (game.round === "khoi_dong") {
      if (game.questionIndex + 1 < 5) {
        // Cùng thành véna, sang ảnh kế — không nghỉ
        game.questionIndex += 1;
      } else {
        // Hết 5 ảnh của thành véna hiện aktualnego → oznaczyć niezodpowiedziane
        // jako sai i przejść do khoàng nghỉ (break) między thành véna/đội.
        markKhoiDongUnanswered();
        enterKhoiDongBreak();
      }
    } else if (game.round === "vuot_cnv") {
      // Hàng ngang do đội chọn trực tiếp (puzzle.select), không tự tăng
    } else if (game.round === "tang_toc") {
      game.questionIndex = Math.min(3, game.questionIndex + 1);
      game.tangToc = freshTangToc();
      setTimer(0, false);
    } else if (game.round === "ve_dich") {
      clearVedichAuto();
      // Cửa sổ cướp quyền còn treo chưa được chấm (không đội nào giành/trả lời) → áp luật
      // "không ai trả lời được" cho đội chọn câu trước khi sang câu kế.
      const pend = game.veDich.stealPending;
      if (pend) {
        const adj = vedich.calculateAnswerScore({ questionPoints: pend.base, isStarOfHope: pend.star, outcome: "no-answer" });
        addScore(pend.teamId, adj.selecting);
        game.veDich.stealPending = null;
      }
      game.veDich.stealOpen = false;
      // Điều hướng giữa các câu ĐÃ CHỐT của đội đang thi.
      const picked = game.veDich.picked?.[game.currentTeam] || [];
      if (game.veDich.pickIndex < picked.length - 1) {
        game.veDich.pickIndex += 1;
        game.veDich.phase = "prep";
        // Ẩn câu cũ — màn hình quay về chờ trung gian trước khi trình câu mới.
        game.display.mode = game.display.mode === "question" ? "" : game.display.mode;
        game.display.question = "";
        game.display.options = [];
        game.display.answer = "";
        game.display.answerRevealed = false;
        game.display.note = "";
        game.questionStatus = "idle";
        setTimer(0, false);
      } else if (picked.length >= 4) {
        // Đã trả lời hết 4 câu → chuyển sang đội kế tiếp trong top 4; đội mới tự soạn bộ câu.
        const order = activeTeamIds();
        const i = order.indexOf(game.currentTeam);
        if (i >= 0 && i < order.length - 1) {
          const next = order[i + 1];
          game.currentTeam = next;
          game.veDich.pickIndex = 0;
          game.veDich.answeringTeam = next;
          game.veDich.picked = { ...(game.veDich.picked || {}), [next]: game.veDich.picked?.[next] || [] };
          game.veDich.locked = false;
          game.veDich.starQuestion = null;
          game.veDich.phase = "soan";
          // Ẩn câu cũ khi chuyển đội.
          game.display.mode = game.display.mode === "question" ? "" : game.display.mode;
          game.display.question = "";
          game.display.options = [];
          game.display.answer = "";
          game.display.answerRevealed = false;
          game.display.note = "";
          game.questionStatus = "idle";
          setTimer(0, false);
        }
      }
    }
    saveDb();
    emit();
  }

  export function continueKhoiDong() {
    const game = g();
    // Nếu đang thi mà MC bấm "Kết thúc thí sinh này" → chuyển thẳng sang thí sinh kế.
    // Đánh dấu các ảnh chưa trả lời của thí sinh này là sai rồi đặt vào break member
    // để dòng "Tiếp tục" phía dưới xử lý nhất quán (giữ nguyên đội).
    if (game.round === "khoi_dong" && game.khoiDong?.phase === "play") {
      markKhoiDongUnanswered();
      enterKhoiDongBreak();
      return;
    }
    if (game.round !== "khoi_dong" || game.khoiDong?.phase !== "break") return;
    const b = game.khoiDong.breakInfo;
    if (b?.kind === "member") {
      game.khoiDong.memberIndex = Math.min(b.nextMember, b.memberTotal - 1);
      game.questionIndex = 0;
      game.khoiDong.phase = "play";
      game.khoiDong.breakInfo = null;
      setTimer(game.khoiDong?.timerSeconds || 60, false);
      // Hiện câu hỏi đầu tiên của thành viên mới sau khoảng nghỉ (không đếm ngược —
      // đếm ngược chỉ dành cho LƯỢT tới của một ĐỘI mới).
      if (currentQuestion()) showQuestion();
      saveDb();
      emit();
      return;
    }
    if (b?.kind === "team" && b.nextTeamId) {
      // Hết lượt đội này → sang đội kế như một lượt MỚI: quay về trạng thái "SẴN SÀNG"
      // (giống lúc MC chọn đội đầu tiên) để hiện lại nút "▶ Bắt đầu". Bấm Bắt đầu rồi mới
      // chạy đếm ngược 3-2-1 → hiện ảnh + chạy 60s.
      setCurrentTeam(b.nextTeamId);
    } else if (b?.kind === "done") {
      // Đội CUỐI CÙNG đã xong — màn khán giả đã ở tổng kết điểm; chỉ refresh trạng thái.
      saveDb();
      emit();
    }
  }

  export function prevQuestion() {
    const game = g();
    resetDisplayToBoard();
    if (game.round === "khoi_dong") {
      const mi = game.khoiDong?.memberIndex ?? 0;
      if (game.questionIndex > 0) {
        game.questionIndex -= 1;
      } else if (mi > 0) {
        game.khoiDong.memberIndex = mi - 1;
        game.questionIndex = 4;
      }
    } else if (game.round === "vuot_cnv") {
      if (game.puzzle.currentRow > 0) game.puzzle.currentRow -= 1;
    } else if (game.round === "tang_toc") {
      game.questionIndex = Math.max(0, game.questionIndex - 1);
      // Reset trạng thái Tăng tốc khi quay về câu trước — đồng bộ với jump/next:
      // nếu không, submissions/phase/settled của câu cũ còn sót lại, thí sinh
      // không trả lời lại được cho câu đang chọn.
      game.tangToc = freshTangToc();
      setTimer(0, false);
    } else if (game.round === "ve_dich") {
      if ((game.veDich.pickIndex || 0) > 0) game.veDich.pickIndex -= 1;
    }
    saveDb();
    emit();
  }

  export function setCurrentTeam(teamId) {
    const game = g();
    // Chỉ các đội còn thi (chưa bị MC khóa vĩnh viễn) được chọn làm đội đang thi.
    if (game.round && game.round !== "khoi_dong" && !isTopTeam(teamId)) {
      saveDb();
      emit();
      return;
    }
    game.currentTeam = teamId;
    game.questionIndex = 0;
    if (game.round === "khoi_dong") {
      // Chọn đội = CHUẨN BỊ lượt (chưa hiện câu hỏi): MC bấm nút "Bắt đầu" để show
      // câu hỏi đầu tiên + chạy đồng hồ 60s (question.jump → showQuestion).
      const timerSec = game.khoiDong?.timerSeconds || 60;
      const history = game.khoiDong?.history || {};
      game.khoiDong = { submissions: {}, timerSeconds: timerSec, answerSeconds: game.khoiDong?.answerSeconds, history, memberIndex: 0, timerStarted: -1 };
      game.khoiDong.ready = true;
      game.khoiDong.phase = "play";
      game.khoiDong.breakInfo = null;
      setTimer(timerSec, false);
      resetDisplayToBoard();
      saveDb();
      emit();
      return;
    }
    if (game.round === "ve_dich") {
      vedich.setAnsweringTeam(teamId);
      return;
    }
    saveDb();
    emit();
  }

  // Bắt đầu lượt thi của đội ở Vòng 1 bằng ĐẾM NGƯỢC 3-2-1: màn khán giả hiện số lớn +
  // tên đội, 60s CHƯA chạy (không tính 3s này vào thời gian thi). Hết đếm, timer loop
  // tự chuyển phase "play" + showQuestion() để hiện ảnh đầu và chạy đồng hồ thật.
  function kdCountdown(teamId, memberIndex = 0) {
    const game = g();
    const timerSec = game.khoiDong?.timerSeconds || 60;
    const history = game.khoiDong?.history || {};
    game.currentTeam = teamId;
    game.questionIndex = 0;
    game.khoiDong = {
      submissions: {},
      timerSeconds: timerSec,
      answerSeconds: game.khoiDong?.answerSeconds,
      history,
      memberIndex,
      timerStarted: -1,
    };
    game.khoiDong.phase = "countdown";
    game.khoiDong.ready = false;
    game.khoiDong.breakInfo = null;
    resetDisplayToBoard();
    game.display.note = `${team(teamId)?.name || ""} — Chuẩn bị thi`;
    setTimer(KHOI_DONG_PREP_SECONDS, true);
    saveDb();
    emit();
  }

  // MC bấm "▶ Bắt đầu" cho đội đang chờ ở Vòng 1 → chạy đếm ngược chuẩn bị.
  export function startKhoiDongTeam(teamId) {
    kdCountdown(teamId);
  }

  export function jumpToQuestion(teamId, questionIndex, memberIndex = undefined) {
    const game = g();
    const prevTeam = game.currentTeam;
    game.currentTeam = teamId;
    game.questionIndex = Math.max(0, questionIndex);
    if (game.round === "khoi_dong") {
      const timerSec = game.khoiDong?.timerSeconds || 60;
      const prevMember = game.khoiDong?.memberIndex ?? 0;
      if (teamId !== prevTeam) {
        // Chuyển sang ĐỘI MỚI = lượt thi mới → đếm ngược 3-2-1 trước khi hiện ảnh + chạy 60s.
        kdCountdown(teamId, memberIndex ?? 0);
        return;
      }
      if (memberIndex !== undefined) {
        game.khoiDong.memberIndex = memberIndex;
      }
      // Nhảy trực đến thành viên/ảnh cùng đội — thoát khoảng nghỉ, quay sang thi.
      game.khoiDong.phase = "play";
      game.khoiDong.breakInfo = null;
      // Reset đồng hồ chỉ khi ĐỔI thí sinh; giữ đồng hồ khi đổi ảnh trong cùng thí sinh
      // (mỗi thí sinh tổng 1 phút cho cả 5 ảnh).
      const memberChanged = memberIndex !== undefined && game.khoiDong.memberIndex !== prevMember;
      if (memberChanged) {
        // Đặt timerStarted = -1 để showQuestion() phía dưới KHỞI ĐỘNG đồng hồ chạy
        // (running = true). Nếu set timerStarted = memberIndex, showQuestion sẽ tưởng
        // đã khởi động rồi → đồng hồ đứng yên ở running=false → "đứng giữa lượt".
        game.khoiDong.timerStarted = -1;
        setTimer(timerSec, false);
      }
      if (currentQuestion()) showQuestion();
      saveDb();
      emit();
      return;
    }
    if (game.round === "tang_toc") {
      const q = getDb().questions.main.tangToc[Math.max(0, questionIndex)] || null;
      // Chọn câu KHÔNG tự phát — chỉ đưa về trạng thái "sẵn sàng chiếu"; MC bấm
      // "Chiếu video" để chạy đếm ngược 3 giây rồi mới phát.
      game.tangToc = freshTangToc();
      game.questionStatus = "showing";
      game.display.mode = "question";
      game.display.question = q?.question || "";
      game.display.options = q?.options || [];
      game.display.answer = q?.answer || "";
      game.display.answerRevealed = false;
      game.display.mediaUrl = q?.mediaUrl || "";
      game.display.mediaType = q?.mediaType || "";
      game.display.title = ROUNDS.find((r) => r.id === game.round)?.name || "";
      game.display.note = `Câu ${Math.max(0, questionIndex) + 1} — bấm “Bắt đầu đếm giờ” để chiếu video (đếm ngược ${TANG_TOC_PREP_SECONDS}s rồi phát).`;
      setTimer(q?.duration || q?.timeLimit || 120, false);
      saveDb();
      emit();
      return;
    }
    saveDb();
    emit();
  }

  export const vedichSelectPackage = (packagePoints) => vedich.selectPackage(packagePoints);
  export const vedichSetStar = (star) => vedich.setStar(!!star);
  export const vedichClearPicked = (teamId) => vedich.clearPicked(teamId);
  export const vedichLockPackage = () => vedich.lockPackage();
  export const vedichUnlockPackage = () => vedich.unlockPackage();
  export const vedichStartGame = () => {
    clearVedichAuto();
    vedich.startGame();
    setTimer(VEDICH_COUNTDOWN_SECONDS, true);
  };

  // Bắt đầu tính giờ trả lời Vòng Về đích — MC bấm sau khi đọc xong câu hỏi.
  // Chỉ chạy khi: phase == "answering", có câu hiện tại, timer chưa chạy.
  // Nếu timer đang chạy hoặc phase chưa đúng → reject (không tạo thêm countdown).
  export function startVedichAnswerTimer() {
    const game = g();
    if (game.round !== "ve_dich") {
      const err = new Error("Không ở Vòng Về đích.");
      err.status = 400;
      throw err;
    }
    const ved = game.veDich;
    if (ved.phase !== "answering") {
      const err = new Error("Chưa hiện câu hỏi — chỉ bắt đầu tính giờ khi đang trả lời.");
      err.status = 400;
      throw err;
    }
    if (!vedich.findQuestion(game)) {
      const err = new Error("Không có câu hỏi hiện tại để bắt đầu tính giờ.");
      err.status = 400;
      throw err;
    }
    if (ved.stealOpen) {
      const err = new Error("Cửa sổ cướp quyền đang mở — không bắt đầu tính giờ lúc này.");
      err.status = 400;
      throw err;
    }
    if (game.timer.running) {
      const err = new Error("Đồng hồ đang chạy — không thể bắt đầu lại.");
      err.status = 400;
      throw err;
    }
    clearVedichAuto();
    setTimer(vedich.getAnswerSeconds(game), true);
  }

  // Lên lịch TỰ bắt đầu đếm giờ trả lời Vòng Về đích sau X giây (settings.veDichAutoAnswerSeconds)
  // nếu MC chưa bấm "Bắt đầu tính giờ". Hủy tự động khi MC bấm sớm hoặc rời phase answering.
  function clearVedichAuto() {
    if (vedichAutoTimer) {
      clearTimeout(vedichAutoTimer);
      vedichAutoTimer = null;
    }
  }

  function scheduleVedichAutoStart() {
    clearVedichAuto();
    const sec = Number(getDb().settings?.veDichAutoAnswerSeconds) || 0;
    if (sec <= 0) return;
    vedichAutoTimer = setTimeout(() => {
      vedichAutoTimer = null;
      const game = g();
      const ved = game.veDich;
      if (game.round !== "ve_dich" || !ved || ved.phase !== "answering" || ved.stealOpen || game.timer.running) {
        return;
      }
      if (!vedich.findQuestion(game)) return;
      setTimer(vedich.getAnswerSeconds(game), true);
    }, sec * 1000);
  }

  export function resetBuzzer(open = false) {
    const game = g();
    game.buzzer = { open, locked: false, winner: null, order: [], blocked: game.buzzer?.blocked || [] };
    saveDb();
    emit();
  }

  export function openBuzzer() {
    const game = g();
    game.buzzer.open = true;
    game.buzzer.locked = false;
    game.buzzer.winner = null;
    game.buzzer.order = [];
    saveDb();
    emit();
  }

  export function closeBuzzer() {
    const game = g();
    game.buzzer.open = false;
    saveDb();
    emit();
  }

  export function pressBuzzer(teamId, intent = "row") {
    const game = g();
    // Chỉ 4 đội điểm cao (top-4) được dùng chuông/từ khóa cho các vòng 2–4.
    if (!isTopTeam(teamId)) return { ignored: true };
    // === ĐOÁN TỪ KHÓA (nút vàng TỪ KHÓA) — ghi danh được bất kỳ lúc nào trong
    // vòng 2, kể cả đang thi hàng ngang. Dùng puzzle.keywordClaim riêng (KHÔNG dùng
    // game.buzzer.winner) để không làm lẫn với chuông trả lời hàng ngang. ===
    const kwIntent = intent === "keyword";
    if (kwIntent) {
      if (game.round !== "vuot_cnv" || game.puzzle?.keywordSolved) return { ignored: true };
      if (game.puzzle?.keywordClaim) return { ignored: true, reason: "already-claimed" };
      if (game.puzzle?.keywordBlocked?.includes(teamId)) return { ignored: true, blocked: true };
      game.puzzle.keywordClaim = teamId;
      saveDb();
      broadcast("buzzer:press", { teamId, winner: teamId, kind: "keyword", order: [teamId] });
      emit();
      return { winner: teamId, kind: "keyword" };
    }
    // === CHUÔNG TRẢ LỜI HÀNG NGANG / giành quyền cướp (nút CHUÔNG to) ===
    // Chuông này CHỈ dành cho hàng ngang: chỉ có hiệu lực khi MC mở chuông
    // (game.buzzer.open). Hoàn toàn tách biệt với nút TỪ KHÓA (keywordClaim).
    // Không còn nhánh "kwActive" — trước đây khi cửa sổ từ khóa mở hoặc đủ 4 góc,
    // chuông chính bị coi là đoán từ khóa gây dính logic. Giờ mọi chuyện đoán từ
    // khóa đều đi qua nút TỪ KHÓA riêng (intent === "keyword").
    if (!game.buzzer.open || game.buzzer.locked) return { ignored: true };
    // Đội bị chặn cướp hàng ngang (đã trả lời sai / hết giờ) không được cướp lại
    if (game.buzzer.blocked?.includes(teamId)) return { ignored: true, blocked: true };
    // Đội đoán TỪ KHÓA sai → bị cấm trả lời hàng ngang: không được cướp ô nào nữa
    if ((game.puzzle?.rowBanned || []).includes(teamId)) return { ignored: true, banned: true };
    if (game.buzzer.order?.includes(teamId)) return { ignored: true };
    game.buzzer.order = game.buzzer.order || [];
    game.buzzer.order.push(teamId);
    if (!game.buzzer.winner) {
      game.buzzer.winner = teamId;
      game.buzzer.locked = true;
      game.buzzer.open = false;
      // Cướp quyền trả lời vòng Về đích → đếm ngược THIẾT LẬP LẠI TỪ ĐẦU cho đội mới.
      if (game.round === "ve_dich" && game.veDich?.stealOpen) {
        setTimer(vedich.getAnswerSeconds(game), true);
      }
    }
    saveDb();
    broadcast("buzzer:press", {
      teamId,
      winner: game.buzzer.winner,
      order: game.buzzer.order,
    });
    emit();
    return { winner: game.buzzer.winner, order: game.buzzer.order };
  }

  export function blockBuzzerTeam(teamId) {
    const game = g();
    if (!game.buzzer.blocked.includes(teamId)) game.buzzer.blocked.push(teamId);
    saveDb();
    emit();
  }

  export function clearBuzzerBlocks() {
    g().buzzer.blocked = [];
    saveDb();
    emit();
  }

  export const revealPiece = (index, value = true) => cnv.revealPiece(index, value);
  export const selectRow = (rowIndex) => cnv.selectRow(rowIndex);
  export const deselectRow = () => cnv.deselectRow();
  export const startRowTimer = () => cnv.startRowTimer();
  export const revealRow = (rowIndex) => cnv.revealRow(rowIndex);
  export const revealAllPuzzle = () => cnv.revealAllPuzzle();
  export const solveKeyword = (teamId, correct) => cnv.solveKeyword(teamId, correct);
  export const showPuzzle = () => cnv.showPuzzle();
  export const submitRowAnswer = (teamId, answer) => cnv.submitRowAnswer(teamId, answer);
  export const markRowAnswer = (teamId, correct) => cnv.markRowAnswer(teamId, correct);
  export const closeRowSubmissions = () => cnv.closeRowSubmissions();
  export const settleRow = () => cnv.settleRow();

  export function showScores() {
    const game = g();
    game.display.mode = "scores";
    saveDb();
    emit();
  }

  // Màn hình hiển thị LUẬT THI của vòng hiện tại trên màn hình khán giả/thí sinh.
  // MC bật/tắt bằng nút; khi tắt trở về màn hình chính của vòng (bảng/phờ đúng theo vòng).
  export function showRules() {
    const game = g();
    const round = ROUNDS.find((r) => r.id === game.round);
    if (!round) {
      const err = new Error("Chưa có vòng thi đang diễn ra.");
      err.status = 400;
      throw err;
    }
    game.display.mode = "rules";
    game.display.title = round.name;
    saveDb();
    emit();
  }

  export function hideRules() {
    const game = g();
    if (game.display.mode !== "rules") return;
    // Về đúng màn hình gốc của vòng: vòng 2/3 về "question" hoặc "puzzle" hiện tại.
    game.display.mode = game.round === "vuot_cnv" ? "puzzle" : "idle";
    saveDb();
    emit();
  }

  // Màn hình KẾT QUẢ CUỐI VÒNG — MC bật/tắt THỦ CÔNG bằng nút (giống "screen.rules").
  // Hiển thị trên khán giả + thí sinh ở MỌI vòng; nội dung lấy theo round đang diễn ra.
  // Thiết kế cụ thể đang chờ user gửi — component phía client (RoundResultBoard.jsx)
  // chỉ là bảng xếp hạng tạm để chạy cơ chế, sẽ được thay bằng design chính thức sau.
  export function showRoundResult() {
    const game = g();
    const round = ROUNDS.find((r) => r.id === game.round);
    if (!round) {
      const err = new Error("Chưa có vòng thi đang diễn ra.");
      err.status = 400;
      throw err;
    }
    game.display.mode = "roundResult";
    game.display.title = round.name;
    game.display.roundResult = game.round;
    saveDb();
    emit();
  }

  export function hideRoundResult() {
    const game = g();
    if (game.display.mode !== "roundResult") return;
    // Tắt → về màn chính của vòng (giống hideRules).
    game.display.mode = game.round === "vuot_cnv" ? "puzzle" : "idle";
    game.display.roundResult = null;
    saveDb();
    emit();
  }

  export function showMedia(url, type = "image") {
    const game = g();
    game.display.mode = "media";
    game.display.mediaUrl = url;
    game.display.mediaType = type;
    saveDb();
    emit();
  }

  export function submitKhoiDong(teamId, answer) {
    const game = g();
    if (game.round !== "khoi_dong") {
      return { ok: false, reason: "wrong-round" };
    }
    if (game.questionStatus !== "showing" || game.display.mode !== "question") {
      return { ok: false, reason: "not-open" };
    }
    if (game.currentTeam !== teamId) {
      return { ok: false, reason: "not-your-turn" };
    }
    if (!game.khoiDong) game.khoiDong = { submissions: {} };
    if (game.khoiDong.submissions[teamId]) {
      return { ok: false, reason: "already" };
    }
    game.khoiDong.submissions[teamId] = {
      answer: String(answer || "").trim(),
      at: Date.now(),
      elapsed: Math.max(0, game.timer.duration - game.timer.remaining),
    };
    saveDb();
    emit();
    return { ok: true };
  }

  export function submitTangToc(teamId, answer) {
    const game = g();
    // Chỉ 4 đội điểm cao thi vòng 3.
    if (!isTopTeam(teamId)) return { ok: false, reason: "not-open" };
    // Chỉ nhận bài khi đang trong giai đoạn chiếu video, đồng hồ còn chạy.
    if (game.round !== "tang_toc" || game.tangToc?.phase !== "video" || !game.timer.running) {
      return { ok: false, reason: "not-open" };
    }
    if (game.tangToc?.settled) {
      return { ok: false, reason: "closed" };
    }
    // Cho phép gửi NHIỀU lần: nếu đội đã nộp trước đó thì ghi đè bằng đáp án mới nhất
    // (thí sinh có thể sửa/làm rõ đáp án nhiều lần trong cửa sổ trả lời — cùng cơ chế Vòng 2).
    // Ghi nhận đáp án theo đồng hồ riêng đếm TỪ 0S (giây thập phân, tuyệt đối chính xác):
    //   elapsed = elapsedBase (đã tích lũy trước những lần MC dừng) + (Date.now() - startedAt)/1000
    // Không dùng timer.remaining (số nguyên, chỉ cập nhật mỗi 250ms) nên không bao giờ lệch tới ~1s.
    const now = Date.now();
    const base = Number(game.tangToc.elapsedBase) || 0;
    const startedAt = Number(game.tangToc.startedAt) || 0;
    const dur = game.timer.duration || 0;
    const played = startedAt
      ? Math.max(0, (now - startedAt) / 1000)
      : game.timer.endsAt
        ? Math.max(0, Math.min(dur, (game.timer.endsAt - now) / 1000))
        : Math.max(0, dur - (game.timer.remaining || 0));
    const elapsed = base + played;

    game.tangToc.submissions[teamId] = {
      answer: String(answer || "").trim(),
      at: now,
      elapsed,
    };
    saveDb();
    emit();
    return { ok: true };
  }

  // Liệt kê bài nộp (theo thứ tự thời gian thấp → cao) kèm nhận định đúng/sai của MC
  // và điểm dự kiến. Điểm chỉ được cộng thật khi MC bấm "Chốt điểm" (settleTangToc).
  // QUY TẮC: chỉ đội TRẢ LỜI ĐÚNG mới được điểm, xếp theo độ nhanh GIỮA CÁC ĐỘI ĐÚNG
  // (nhất 40, nhì 30, ba 20, tư 10). Đội sai = 0 điểm, KHÔNG bị trừ.
  function computeTangTocRanked() {
    const game = g();
    const subs = Object.entries(game.tangToc.submissions || {}).map(([teamId, sub]) => ({
      teamId,
      answer: sub.answer,
      elapsed: sub.elapsed,
      at: sub.at,
    }));
    const corr = game.tangToc.corrections || {};
    const byElapsed = [...subs].sort((a, b) => a.elapsed - b.elapsed);
    const pts = roundPoints("tang_toc");
    const correct = byElapsed
      .filter((s) => corr[s.teamId] === true)
      .map((s, i) => ({ ...s, place: i + 1, points: pts[i] ?? pts[pts.length - 1] ?? 10 }));
    const correctMap = {};
    correct.forEach((s) => (correctMap[s.teamId] = s));
    return byElapsed.map((s) => {
      const c = correctMap[s.teamId];
      return {
        teamId: s.teamId,
        answer: s.answer,
        elapsed: s.elapsed,
        correct: corr[s.teamId] === true ? true : corr[s.teamId] === false ? false : null,
        points: c ? c.points : 0,
        place: c ? c.place : null,
      };
    });
  }

  // MC chuyển màn hình khán giả: "video" (đang chiếu) / "answers" (liệt kê đáp án).
  export function tangTocSetPhase(phase) {
    const game = g();
    if (game.round !== "tang_toc") return;
    if (phase === "video" || phase === "answers") {
      game.tangToc.phase = phase;
    }
    saveDb();
    emit();
  }

  // MC điều khiển màn hình khán giả để CHẤM ĐIỂM tạo kịch tính: khi đang ở giai đoạn
  // liệt kê, bấm "Hiện điểm" → lộ luôn đánh giá đúng/sai + điểm (+40/30/20/10) của
  // từng đội. KHÔNG hiện bước "đáp án" trung gian trên màn hình khán giả.
  export function tangTocReveal(step) {
    const game = g();
    if (game.round !== "tang_toc") return;
    if (game.tangToc?.phase !== "answers") return;
    if (step === "scores") {
      game.tangToc.reveal = "scores";
    }
    saveDb();
    emit();
  }

  // MC bấm "▶ Chiếu video": hiện câu hỏi/video lên màn hình nhưng CHƯA chạy timer —
  // chuyển sang phase "ready" (video dừng, timer = duration của câu, running = false).
  // MC bấm "▶ Bắt đầu đếm giờ" (tangTocStartCountdown) mới chạy đếm ngược chuẩn bị
  // TANG_TOC_PREP_SECONDS rồi timer loop tự chuyển phase "video" và phát + đếm giờ trả lời.
  // KHÔNG xóa bài đã nộp, nên nếu MC đã dừng giữa chừng (tangTocStop) thì lần phát sau
  // vẫn tiếp tục từ vị trí cũ.
  export function tangTocPlay() {
    const game = g();
    if (game.round !== "tang_toc") return;
    const ph = game.tangToc?.phase;
    if (ph === "answers" || ph === "preparing" || (ph === "video" && game.timer.running)) return;
    if (!game.tangToc) game.tangToc = freshTangToc();
    game.tangToc.phase = "ready";
    const q = currentQuestion();
    game.questionStatus = "showing";
    game.display.mode = "question";
    game.display.question = q?.question || "";
    game.display.options = q?.options || [];
    game.display.answer = q?.answer || "";
    game.display.answerRevealed = false;
    game.display.mediaUrl = q?.mediaUrl || "";
    game.display.mediaType = q?.mediaType || "";
    game.display.title = ROUNDS.find((r) => r.id === game.round)?.name || "";
    const dur = q?.duration || q?.timeLimit || 120;
    game.display.note = `Câu ${game.questionIndex + 1} — video đã hiện; MC bấm “Bắt đầu đếm giờ” để chiếu (đếm ngược ${TANG_TOC_PREP_SECONDS}s rồi phát).`;
    setTimer(dur, false);
  }

  // MC bấm "▶ Bắt đầu đếm giờ" (btn khích hoạt countdown): chỉ được chạy khi câu hỏi
  // đã hiện sẵn sàng (phase "ready" hoặc "video" đang tạm dừng sau khi Dừng) và timer
  // chưa chạy. Chạy đếm ngược chuẩn bị → timer loop tự phát video + đếm thời gian trả lời.
  export function tangTocStartCountdown() {
    const game = g();
    if (game.round !== "tang_toc") return;
    const ph = game.tangToc?.phase;
    if (ph === "preparing" || ph === "answers" || (ph === "video" && game.timer.running)) return;
    if (ph !== "ready" && ph !== "video") return;
    game.tangToc.phase = "preparing";
    setTimer(TANG_TOC_PREP_SECONDS, true);
  }

  // MC bấm "Dừng" video trong lúc đang chiếu: PHẢI nhập mật khẩu admin. Dừng nhớ vị trí
  // (resumeFrom) để bấm "Chiếu video" lần sau sẽ đếm ngược rồi phát tiếp từ chỗ cũ.
  export function tangTocStop(pin) {
    const db = getDb();
    if (String(pin ?? "") !== String(db.settings.pin)) {
      const err = new Error("Mật khẩu không đúng — không được phép dừng video.");
      err.status = 401;
      throw err;
    }
    const game = db.game;
    if (game.round !== "tang_toc") return;
    if (game.tangToc?.phase === "video" && game.timer.running) {
      // Giữ CHÍNH XÁC vị trí dừng theo đồng hồ 0s (giây thập phân): startedAt là mốc đoạn
      // chiếu hiện tại, cộng dồn vào elapsedBase → khi phát lại vẫn nối tiếp đúng từ mốc 0s.
      const now = Date.now();
      const dur = game.timer.duration || 0;
      const base = Number(game.tangToc.elapsedBase) || 0;
      const startedAt = Number(game.tangToc.startedAt) || 0;
      const played = startedAt
        ? Math.max(0, (now - startedAt) / 1000)
        : game.timer.endsAt
          ? Math.max(0, Math.min(dur, (game.timer.endsAt - now) / 1000))
          : Math.max(0, dur - (game.timer.remaining || 0));
      game.tangToc.resumeFrom = Math.max(0, dur - played);
      game.tangToc.elapsedBase = base + played;
      game.tangToc.startedAt = null;
      pauseTimer();
    }
  }

  // MC chấm đúng/sai "tay" từng đội. KHÔNG phụ thuộc phase: không chờ video chiếu xong
  // (phase "answers") nữa — cứ có bài nộp là MC chấm được luôn. Đúng → tính điểm theo
  // hạng độ nhanh (sẽ cộng khi Chốt điểm); sai → 0 điểm, không trừ.
  export function tangTocMark(teamId, correct) {
    const game = g();
    if (game.round !== "tang_toc" || game.tangToc.settled) {
      return;
    }
    if (!game.tangToc.submissions?.[teamId]) return;
    if (game.tangToc.corrections[teamId] !== undefined) {
      // đã chấm đội này rồi — cho phép sửa lại
    }
    game.tangToc.corrections[teamId] = !!correct;
    game.tangToc.ranked = computeTangTocRanked();
    saveDb();
    emit();
  }

  export function settleTangToc() {
    const game = g();
    if (game.round !== "tang_toc") return;
    if (game.tangToc.settled) return; // tránh cộng điểm trùng
    if (!game.tangToc.ranked || game.tangToc.ranked.length === 0) {
      game.tangToc.ranked = computeTangTocRanked();
    }
    game.tangToc.ranked
      .filter((r) => r.correct === true && r.points > 0)
      .forEach((r) => addScore(r.teamId, r.points));
    game.tangToc.settled = true;
    // Chốt điểm = tự động mở giai đoạn HIỂN THỊ ĐIỂM ngay trên màn hình khán giả.
    game.tangToc.reveal = "scores";
    // Chỉ hiện đáp án khi đã sang giai đoạn liệt kê — nếu mới chốt trong lúc video
    // đang phát thì không giật ngang màn hình (để video chạy nốt trước).
    if (game.tangToc.phase === "answers") {
      const q = getDb().questions.main.tangToc[game.questionIndex];
      game.display.answerRevealed = true;
      game.display.answer = q ? q.answer : "";
    }
    saveDb();
    emit();
  }

  export function finishContest() {
    const db = getDb();
    const ranked = [...db.teams].sort((a, b) => b.score - a.score);
    db.game.phase = "finished";
    db.game.round = "finished";
    db.game.finished = true;
    db.game.winnerTeamId = ranked[0]?.id || null;
    db.game.display.mode = "winner";
    db.game.display.title = "Kết quả chung cuộc";
    saveDb();
    emit();
  }

  export function resetGameKeepTeams() {
    const db = getDb();
    db.teams.forEach((t) => {
      t.score = 0;
    });
    db.game = defaultGame();
    db.game.phase = "teams_ready";
    saveDb();
    emit();
  }

  // Reset trạng thái trả lời vòng chính (Khởi động + round 2) để chạy demo lại.
  // Giữ nguyên vòng hiện tại, câu hỏi và điểm số của các đội.
  export function resetMainRoundState() {
    const game = g();
    if (khoiDongTimer) {
      clearTimeout(khoiDongTimer);
      khoiDongTimer = null;
    }
    stopTimerLoop();
    setTimer(0, false);
    game.currentTeam = "a";
    game.questionIndex = 0;
    game.questionStatus = "idle";
    game.finished = false;
    game.buzzer = { open: false, locked: false, winner: null, order: [], blocked: [] };
    game.display = {
      mode: "idle",
      title: ROUNDS.find((r) => r.id === game.round)?.name || "",
      question: "",
      options: [],
      mediaUrl: "",
      mediaType: "",
      answer: "",
      answerRevealed: false,
      note: "",
    };
    game.khoiDong = game.khoiDong || {};
    game.khoiDong.history = {};
    game.khoiDong.submissions = {};
    game.tangToc = freshTangToc();
    game.puzzle = emptyPuzzle();
    game.veDich = vedich.defaultState();
    if (game.round === "vuot_cnv") game.display.mode = "puzzle";
    saveDb();
    emit();
  }

  // === TIE-BREAK ===
  export function setTieBreakTeams(teamIds) {
    const game = g();
    if (game.round !== "tie_break") return { ignored: true };
    game.tieBreak.teams = teamIds;
    saveDb();
    emit();
  }

  export function setTieBreakQuestions(questions) {
    const game = g();
    if (game.round !== "tie_break") return { ignored: true };
    game.tieBreak.questions = questions;
    saveDb();
    emit();
  }

  export function showTieBreakQuestion() {
    const game = g();
    if (game.round !== "tie_break") return { ignored: true };
    const q = game.tieBreak.questions[game.questionIndex];
    if (!q) return { ignored: true, reason: "no-question" };
    game.questionStatus = "showing";
    game.display = {
      mode: "question",
      title: `Phụ phuc — Câu ${game.questionIndex + 1}`,
      question: q.question || "",
      options: q.options || [],
      mediaUrl: q.mediaUrl || "",
      mediaType: q.mediaType || "",
      answer: "",
      answerRevealed: false,
      note: q.note || "",
    };
    resetBuzzer();
    openBuzzer();
    saveDb();
    emit();
  }

  export function nextTieBreakQuestion() {
    const game = g();
    if (game.round !== "tie_break") return { ignored: true };
    if (game.questionIndex + 1 < game.tieBreak.questions.length) {
      game.questionIndex += 1;
      showTieBreakQuestion();
    }
  }

  export function markTieBreakAnswer(teamId, correct) {
    const game = g();
    if (game.round !== "tie_break") return { ignored: true };
    if (correct) {
      game.tieBreak.winner = teamId;
      game.tieBreak.phase = "done";
      game.display.answerRevealed = true;
      game.display.answer = game.tieBreak.questions[game.questionIndex]?.answer || "";
    }
    saveDb();
    emit();
  }

  export function setTieBreakWinner(teamId) {
    const game = g();
    if (game.round !== "tie_break") return { ignored: true };
    game.tieBreak.winner = teamId;
    game.tieBreak.phase = "done";
    saveDb();
    emit();
  }

  export function revealTieBreakAnswer() {
    const game = g();
    if (game.round !== "tie_break") return { ignored: true };
    game.display.answerRevealed = true;
    game.display.answer = game.tieBreak.questions[game.questionIndex]?.answer || "";
    saveDb();
    emit();
  }

  // Kiểm tra ngoại lệ: có >4 đội CHƯA BỊ LOẠI đồng điểm ở ranh giới top 4
  export function getExcessTeams() {
    const teams = getDb().teams.filter((t) => !t.eliminated).slice().sort((a, b) => b.score - a.score || 0);
    if (teams.length <= 4) return [];
    const fourthScore = teams[3]?.score ?? 0;
    const excess = teams.filter((t) => t.score >= fourthScore && teams.indexOf(t) >= 4);
    return excess.map((t) => t.id);
  }

  // MC loại đội VĨNH VIỄN: ghi eliminated=true trực tiếp vào team trong DB.
  // MC có toàn quyền khóa bất kỳ đội nào chưa bị khóa.
  export function eliminateTeam(teamId) {
    const t = getDb().teams.find((x) => x.id === teamId);
    if (!t) return { ignored: true, reason: "not-found" };
    if (t.eliminated) return { ignored: true, reason: "already-eliminated" };
    t.eliminated = true;
    saveDb();
    emit();
    return { ok: true, teamId };
  }

  // MC mở khoá đội: ghi eliminated=false trực tiếp vào team trong DB (khôi phục đội đã loại).
  export function restoreTeam(teamId) {
    const t = getDb().teams.find((x) => x.id === teamId);
    if (!t) return { ignored: true, reason: "not-found" };
    t.eliminated = false;
    saveDb();
    emit();
  }

  const keywordPoints = cnv.keywordPoints;
  export { currentQuestion, keywordPoints };

  cnv.init({ emit, addScore, pauseTimer, setTimer, resetDisplayToBoard, showQuestion, resetBuzzer });
  vedich.init({ emit });
