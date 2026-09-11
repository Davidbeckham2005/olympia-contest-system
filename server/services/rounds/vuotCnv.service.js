// MODULE VÒNG 2 — Vượt chướng ngại vật (vuot_cnv).
//
// Tách riêng toàn bộ logic xử lý bảng mảnh ghép / hàng ngang / chướng ngại vật ra khỏi
// game.service.js để tăng tính tái sử dụng và dễ bảo trì.
//
// Module này TỰ chứa các helper nội bộ (cornersResolved, keywordPoints, openKeywordWindow,
// lockRow, cnvView) và chỉ nhận các hàm dùng chung (emit, addScore, pauseTimer,
// resetDisplayToBoard, showQuestion, resetBuzzer) qua hàm init() — tránh import vòng (circular).
//
// Cách dùng (từ game.service.js):
//   import * as cnv from "./rounds/vuotCnv.service.js";
//   cnv.init({ emit, addScore, pauseTimer, resetDisplayToBoard, showQuestion, resetBuzzer });
//   cnv.selectRow(0); cnv.revealRow(1); ...

import { getDb, saveDb } from "../../models/store.js";
import { TEAM_ORDER } from "../../config/constants.js";
import { emitEvent } from "../../config/io.js";

// Team hợp lệ = có trong TEAM_ORDER (round 2 chỉ chạy với top-4, nhưng đội "e"/"f"
// cũng là team hợp lệ khi đạt top-4).
function isKnownTeam(id) {
  return TEAM_ORDER.includes(id);
}

// Các hàm dùng chung được game.service.js tiêm vào khi khởi động module.
let emit = () => {};
let addScore = () => {};
let pauseTimer = () => {};
let setTimer = () => {};
let resetDisplayToBoard = () => {};
let showQuestion = () => {};
let resetBuzzer = () => {};

export function init(deps) {
  if (!deps) return;
  if (deps.emit) emit = deps.emit;
  if (deps.addScore) addScore = deps.addScore;
  if (deps.pauseTimer) pauseTimer = deps.pauseTimer;
  if (deps.setTimer) setTimer = deps.setTimer;
  if (deps.resetDisplayToBoard) resetDisplayToBoard = deps.resetDisplayToBoard;
  if (deps.showQuestion) showQuestion = deps.showQuestion;
  if (deps.resetBuzzer) resetBuzzer = deps.resetBuzzer;
}

function g() {
  return getDb().game;
}

// Các đội còn thi trong vòng 2: MC tự quyết định ai loại bằng nút Khóa (khóa vĩnh viễn,
// team.eliminated trên DB) — hệ thống không tự loại/chọn ai.
function activeOrder() {
  return getDb()
    .teams.filter((t) => !t.eliminated)
    .map((t) => t.id);
}

// === HELPER NỘI BỘ ============================================================

// Góc nhìn Vòng 2 cho thí sinh/khán giả: số ô chữ mỗi hàng + từ chỉ khi đã mở
export function cnvView(db) {
  const p = db.game.puzzle || {};
  const cnv = db.questions.main.vuotCnv;
  return {
    rows: (cnv.rows || []).map((r, i) => ({
      letterCount: r.letterCount || String(r.answer || "").replace(/\s/g, "").length,
      status: p.rowsSolved?.[i] ? "open" : p.rowsLocked?.[i] ? "locked" : "hidden",
      word: p.rowsSolved?.[i] ? r.answer : "",
    })),
    keywordLetterCount: cnv.letterCount || String(cnv.keyword || "").replace(/\s/g, "").length,
    keyword: p.keywordSolved ? cnv.keyword : "",
    media: cnv.media && cnv.media.url ? { type: cnv.media.type || "image", url: cnv.media.url } : null,
    // Câu hỏi hiện tại hiển thị CÙNG bảng mảnh (vòng 2: 4 câu hỏi hàng ngang mở 4 mảnh góc
    // + CÂU HỎI MẢNH GHÉP TRUNG TÂM (index 4) mở mảnh giữa; mở đủ 5 mảnh → hiện nguyên
    // bức ảnh; từ khóa chỉ nhìn hình, không có câu hỏi riêng).
    currentRow: p.currentRow ?? 0,
    rowPhase: p.rowPhase || "idle",
    question: p.rowPhase === "open" && cnv.rows?.[p.currentRow]
      ? (cnv.rows[p.currentRow].question || "")
      : "",
  };
}

// 5 mảnh đã được xử lý hết (4 hàng ngang mở mảnh góc + câu hỏi cuối mở mảnh trung tâm)
export function cornersResolved(p = g().puzzle) {
  return [0, 1, 2, 3, 4].every((i) => p.rowsSolved?.[i] || p.rowsLocked?.[i]);
}

export function keywordPoints() {
  const p = g().puzzle;
  const opened = p.rowsSolved.filter(Boolean).length;
  // Điểm khi đoán TRÚNG từ khóa CNV theo giai đoạn (chỉ nhìn hình):
  //   sau 4 hàng ngang (mảnh góc) + câu hỏi mảnh ghép trung tâm → 60·50·40·30·20
  const OPEN_POINTS = [60, 50, 40, 30, 20];
  return OPEN_POINTS[Math.max(0, Math.min(opened, 5) - 1)] ?? 20;
}

// Mở CỬA SỔ đoán TỪ KHÓA: chạy sau MỖI hàng ngang vừa xử lý xong (mở hoặc khóa).
// CHỈ bật cờ keywordWindow (dùng để hiện hướng dẫn / ghi danh). Không mở chuông
// chính — vì đoán từ khóa giờ đi qua nút TỪ KHÓA riêng (puzzle.keywordClaim).
// Cửa sổ được đóng lại khi MC chọn ô kế tiếp (selectRow).
function openKeywordWindow() {
  const game = g();
  const p = game.puzzle;
  if (!p || p.keywordSolved) return;
  p.keywordWindow = true;
  game.buzzer = { open: false, locked: false, winner: null, order: [], blocked: [] };
}

// Trả lời sai lần 2 / tất cả sai: khóa mảnh vĩnh viễn (không mở lại, không ai được chấm ô này nữa)
export function lockRow(rowIndex) {
  const game = g();
  const i = Number(rowIndex);
  if (!(i >= 0 && i <= 4)) return;
  pauseTimer();
  game.puzzle.rowsLocked[i] = true;
  // Vừa xử lý xong một hàng ngang (khóa) → mở cửa sổ đoán từ khóa cho mốc này
  openKeywordWindow();
  saveDb();
  emit();
}

// === THAO TÁC CÔNG KHAI =======================================================

export function revealPiece(index, value = true) {
  const game = g();
  const i = Number(index);
  if (!(i >= 0 && i <= 4)) return;
  game.puzzle.rowsSolved[i] = !!value;
  if (value) game.puzzle.rowsLocked[i] = false;
  // Mỗi mốc vừa mở mảnh → mở cửa sổ đoán từ khóa (không xóa danh sách đội đã đoán sai)
  if (value) openKeywordWindow();
  saveDb();
  emit();
}

export function selectRow(rowIndex) {
  const game = g();
  const p = game.puzzle;
  const i = Number(rowIndex);
  if (!(i >= 0 && i <= 4)) return;
  if (p.rowsSolved?.[i] || p.rowsLocked?.[i] || p.keywordSolved) return;
  p.currentRow = i;
  // Giữ nguyên màn hình người dùng đang xem (câu hỏi hoặc bảng mảnh) khi mở ô mới
  const prevMode = game.display.mode;
  // Bắt đầu ô mới: đóng cửa sổ đoán từ khóa giữa vòng (keywordBlocked vẫn giữ nguyên),
  // dọn chuông của ô trước, xóa hiệu ứng trả lời vừa rồi
  p.keywordWindow = false;
  p.lastResult = null;
  // Mở ô mới → chuẩn bị nhận bài tự luận của các đội. KHÔNG tự đếm giờ: MC cần thời
  // gian đọc câu hỏi trước, rồi mới bấm nút "Bắt đầu giờ" (startRowTimer). Trước khi
  // đồng hồ chạy (timer.running === false) các đội chưa thể nộp đáp án.
  p.rowPhase = "open";
  p.submissions = {};
  p.corrections = {};
  p.ranked = [];
  p.revealedRows = 0;
  game.buzzer = { open: false, locked: false, winner: null, order: [], blocked: [] };
  game.questionStatus = "idle";
  game.display.answerRevealed = false;
  // Thiết lập câu hỏi hiện tại cho bài nộp tự luận (questionStatus "showing") NHƯNG
  // KHÔNG tự đổi màn hình — giữ nguyên trạng thái màn hình đang xem (bảng mảnh hoặc
  // câu hỏi). Đồng hồ được tạm dừng: MC bấm "Bắt đầu giờ" thì mới chạy.
  // Đồng hồ được đặt ở trạng thái TẠM DỪNG với đủ số giây (không chạy): MC bấm
  // "Bắt đầu giờ" thì mới chạy. Dùng skipTimer để showQuestion không auto-start rồi
  // pause ngay (gây đồng hồ nháy lên rồi biến mất), và setTimer(…, false) chỉ phát
  // DUY NHẤT một broadcast trạng thái running=false.
  showQuestion({ skipTimer: true });
  setTimer(game.vuotCnv?.answerSeconds || 30, false);
  // Ô mới bắt đầu → không ở lại màn ĐÁP ÁN của ô trước (quay về bảng mảnh).
  // Màn CHỜ ĐẦU VÒNG (display.mode "idle") → MC vừa chọn hàng → HIỆN CÂU HỎI
  // (không giữ nguyên idle, nếu không khán giả sẽ kẹt ở màn chờ).
  game.display.mode =
    prevMode === "answers"
      ? "puzzle"
      : prevMode === "idle"
        ? "question"
        : prevMode || "puzzle";
  game.display.answerRevealed = false;
  // CHỈ PHÁT MỘT LẦN DUY NHẤT ở cuối — trước đây phát 2 lần (lần đầu TRƯỚC khi
  // showQuestion) khiến khán giả/MC nhận trạng thái trung gian (câu cũ + highlight cũ)
  // rồi mới tới trạng thái thật → vẽ 2 lần liền → màn hình BỊ GIẬT khi chuyển câu.
  saveDb();
  emit();
}

// MC bấm "Bỏ chọn" cho ô đang mở: quay về trạng thái CHƯA chọn câu hỏi nào —
// không đếm giờ, không hiện câu hỏi, xóa sạch bài nộp của ô đó. (Hoàn tác selectRow.)
// GIỮ NGUYÊN tab khán giả đang xem (câu hỏi / bảng mảnh) — chỉ xóa nội dung câu hỏi,
// không nhảy màn hình.
export function deselectRow() {
  const game = g();
  const p = game.puzzle;
  if (game.round !== "vuot_cnv") return;
  if (p.rowPhase !== "open") return;
  // Giữ nguyên màn hình người dùng đang xem (câu hỏi hoặc bảng mảnh)
  const prevMode = game.display.mode;
  p.rowPhase = "closed";
  p.submissions = {};
  p.corrections = {};
  p.ranked = [];
  p.revealedRows = 0;
  game.buzzer = { open: false, locked: false, winner: null, order: [], blocked: [] };
  setTimer(0, false);
  resetDisplayToBoard();
  game.display.mode = prevMode === "answers" ? "puzzle" : prevMode || "puzzle";
  saveDb();
  emit();
}

// MC bấm "Bắt đầu giờ" cho ô đang mở: bắt đầu/cố đếm thời gian cho bài nộp tự luận.
// Đến lúc này các đội mới có thể gửi đáp án (xem submitRowAnswer — gate bằng
// timer.running, nguồn sự thật duy nhất, không còn cờ timingStarted riêng).
export function startRowTimer() {
  const game = g();
  const p = game.puzzle;
  if (game.round !== "vuot_cnv" || p.keywordSolved) return;
  if (p.rowPhase !== "open") return;
  // MC "Dừng" đồng hồ giữa chừng rồi bấm lại → tiếp tục từ giây còn lại, không quay
  // về mốc 0; chưa từng bắt đầu → chạy đủ answerSeconds.
  const sec = game.timer?.remaining > 0 ? game.timer.remaining : game.vuotCnv?.answerSeconds || 30;
  setTimer(sec, true);
}

// Đội trả lời đúng: mở đúng 1 mảnh góc tương ứng hàng ngang
export function revealRow(rowIndex) {
  const game = g();
  const i = Number(rowIndex);
  if (!(i >= 0 && i <= 4)) return;
  if (game.puzzle.rowsLocked?.[i]) return; // khóa vĩnh viễn, không mở lại
  pauseTimer();
  game.puzzle.rowsSolved[i] = true;
  // Vừa xử lý xong một hàng ngang → mở cửa sổ đoán từ khóa cho mốc này
  openKeywordWindow();
  saveDb();
  emit();
}

export function revealAllPuzzle() {
  const game = g();
  game.puzzle.rowsSolved = [true, true, true, true, true];
  game.puzzle.rowsLocked = [false, false, false, false, false];
  // "Mở hết" dùng sớm khi chưa đủ 5 mảnh cũng cần mở cửa sổ đoán từ khóa
  openKeywordWindow();
  saveDb();
  emit();
}

export function solveKeyword(teamId, correct) {
  const game = g();
  if (game.round !== "vuot_cnv" || game.puzzle?.keywordSolved) return;
  // Được đoán từ khóa BẤT KỲ LÚC NÀO đội đã ghi danh (nút TỪ KHÓA), hoặc trong
  // cửa sổ giữa vòng / sau khi đủ 4 góc. Không còn bị cấm chờ giải hàng ngang.
  const pts = keywordPoints();
  // Đội đang nắm quyền đoán: ưu tiên người đã ghi danh (puzzle.keywordClaim),
  // fallback về đội truyền vào (đủ 4 góc thường MC chọn trực tiếp).
  const tid = game.puzzle?.keywordClaim || teamId;
  if (correct) {
    game.puzzle.keywordSolved = true;
    game.puzzle.keywordWinner = tid;
    game.puzzle.keywordPointsAwarded = pts;
    game.puzzle.keywordWindow = false;
    game.puzzle.keywordClaim = null;
    addScore(tid, pts);
    revealAllPuzzle();
    game.display.mode = "puzzle";
    game.display.answerRevealed = true;
    game.display.answer = getDb().questions.main.vuotCnv.keyword;
  } else {
    // Đoán sai: đội này bị CHẶN khỏi đoán từ khóa cho tới khi ra từ khóa,
    // và nhả quyền nắm giữ (keywordClaim) để đội khác có thể ghi danh tiếp.
    const kb = game.puzzle.keywordBlocked || [];
    if (!kb.includes(tid)) game.puzzle.keywordBlocked = [...kb, tid];
    // Thêm quy tắc: đoán TỪ KHÓA (chướng ngại vật) SAI → đội này bị cấm ghi danh
    // đoán từ khóa tiếp theo cho tới hết vòng.
    const rb = game.puzzle.rowBanned || [];
    if (!rb.includes(tid)) game.puzzle.rowBanned = [...rb, tid];
    game.puzzle.keywordClaim = null;
    // Không mở chuông chính khi đoán từ khóa SAI — đội đoán từ khóa dùng lại nút
    // TỪ KHÓA riêng (puzzle.keywordClaim), chuông chính chỉ dành cho cướp quyền Về đích.
    resetBuzzer(false);
    // Cả 4 đội đã đoán sai → không còn ai được đoán: tự mở đáp án (không tính điểm)
    const active = activeOrder();
    const allBlocked = active.every((id) =>
      game.puzzle.keywordBlocked.includes(id)
    );
    if (allBlocked) {
      game.puzzle.keywordSolved = true;
      game.puzzle.keywordWinner = null;
      game.puzzle.keywordWindow = false;
      game.display.mode = "puzzle";
      game.display.answerRevealed = true;
      game.display.answer = getDb().questions.main.vuotCnv.keyword;
      revealAllPuzzle();
      game.buzzer.open = false;
    }
  }
  saveDb();
  emit();
}

// === TRẢ LỜI TỰ LUẬN GỬI VỀ MC (tham khảo vòng 3 Tăng tốc) ====================
// Mọi đội cùng nộp đáp án cho câu hàng ngang hiện tại; hệ thống ghi nhận thời gian
// nộp (elapsed, giây thập phân tính từ lúc hiện câu). MC chấm đúng/sai từng đội rồi
// bấm "Chốt" — điểm theo độ nhanh giữa các đội đúng (mặc định: nhất 40 · nhì 30 ·
// ba 20 · tư 10, admin có thể thay đổi qua game.round2Points).
// Trả lời sai = 0 điểm (KHÔNG bị trừ). Có ≥1 đội đúng → mở mảnh; tất cả sai → khóa.

// Số giây miễn phí để bấm chấm: rowChấm không dùng chuông cướp nên không cần.
function rowElapsed() {
  const game = g();
  const dur = game.timer.duration || 0;
  const now = Date.now();
  if (game.timer.running && game.timer.endsAt) {
    return Math.max(0, Math.min(dur, (now - (game.timer.endsAt - dur * 1000)) / 1000));
  }
  return Math.max(0, dur - (game.timer.remaining || 0));
}

// Đội gửi đáp án tự luận về MC (ghi nhận thời gian nộp).
export function submitRowAnswer(teamId, answer) {
  const game = g();
  const p = game.puzzle;
  if (game.round !== "vuot_cnv" || p.keywordSolved) return { ok: false, reason: "closed" };
  // Đoán TỪ KHÓA sai (MC chấm Sai) → đội mất quyền trả lời các câu hỏi HÀNG NGANG
  // còn lại trong vòng (rowBanned) — không được nộp đáp án tự luận nữa.
  if ((p.rowBanned || []).includes(teamId)) return { ok: false, reason: "row-banned" };
  // Các đội còn thi (chưa bị MC khóa vĩnh viễn) được nộp đáp án hàng ngang vòng 2.
  const active = activeOrder();
  if (!active.includes(teamId)) return { ok: false, reason: "not-open" };
  if (p.rowPhase !== "open") return { ok: false, reason: "closed" };
  if (game.questionStatus !== "showing") return { ok: false, reason: "not-open" };
  // Chỉ nộp được đáp án khi đồng hồ ĐANG CHẠY (timer.running) — nguồn sự thật duy
  // nhất. MC bấm "Bắt đầu giờ" (puzzle.startTimer / timer.set/resume) đều bật; dừng
  // (timer.pause), hết giờ hoặc đóng nhận bài đều khóa nộp bài.
  if (!game.timer.running) return { ok: false, reason: "not-started" };
  // Cho phép gửi NHIỀU lần: nếu đội đã nộp trước đó thì ghi đè bằng đáp án mới nhất
  // (thí sinh có thể sửa/làm rõ đáp án nhiều lần trong cửa sổ trả lời).
  p.submissions[teamId] = {
    answer: String(answer || "").trim(),
    elapsed: rowElapsed(),
  };
  saveDb();
  emit();
  return { ok: true };
}

// MC chấm đúng/sai một đội (cho phép sửa lại trước khi chốt).
export function markRowAnswer(teamId, correct) {
  const game = g();
  if (!game.puzzle?.submissions?.[teamId]) return;
  game.puzzle.corrections[teamId] = !!correct;
  // Tính sẵn xếp hạng + điểm dự kiến sau mỗi lần chấm, để màn hình MC hiện "+40/+30/..."
  // thay vì "+0" trong lúc chấm. Điểm chính thức vẫn chỉ được cộng khi MC "Chốt điểm".
  if (game.puzzle.rowPhase === "closed" || game.puzzle.rowPhase === "scored") {
    game.puzzle.ranked = computeRowRanked();
  }
  saveDb();
  emit();
}

// Đóng nhận bài (MC bấm hoặc tự động khi hết giờ): chuyển sang giai đoạn chấm.
export function closeRowSubmissions() {
  const game = g();
  const p = game.puzzle;
  if (p.rowPhase !== "open") return;
  p.rowPhase = "closed";
  // Đóng nhận bài → DỪNG đồng hồ: nếu không, giờ vẫn đếm ngược trên mọi màn hình dù
  // thí sinh đã bị khóa (gây chữ "đôi khi" — MC tưởng cửa nộp còn mở).
  pauseTimer();
  // Đóng nhận bài → tự chuyển màn hình lớn + thí sinh sang MÀN ĐÁP ÁN để MC chấm
  // và mở dần từng đáp án (MC vẫn chuyển tay sang Câu hỏi/Bảng mảnh được).
  game.display.mode = "answers";
  emitEvent("sound:play", { slot: "answers" });
  saveDb();
  emit();
}

// Xếp hạng các bài nộp theo độ nhanh + nhận định đúng/sai + điểm dự kiến.
export function computeRowRanked() {
  const game = g();
  const p = game.puzzle;
  // Điểm thưởng theo độ nhanh — admin có thể thay đổi qua game.round2Points
  // (fallback [40, 30, 20, 10] nếu DB cũ chưa có).
  const ptsAll = game.round2Points;
  const pts = Array.isArray(ptsAll) && ptsAll.length ? ptsAll.map((n) => Number(n) || 0) : [40, 30, 20, 10];
  const subs = Object.entries(p.submissions || {}).map(([teamId, s]) => ({
    teamId,
    answer: s.answer,
    elapsed: s.elapsed,
  }));
  const byElapsed = [...subs].sort((a, b) => a.elapsed - b.elapsed);
  const corr = p.corrections || {};
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

// MC điều khiển MÀN KẾT QUẢ TRẢ LỜI trên khán giả: mở LẦN LƯỢT từng câu trả lời
// (revealedRows đếm số đáp án đã hiện, 0 = chưa mở gì). Chỉ có hiệu lực trong giai đoạn
// chấm (closed) hoặc đã chốt (scored).
export function revealNextRowAnswer() {
  const game = g();
  const p = game.puzzle;
  if (game.round !== "vuot_cnv") return;
  if (p.rowPhase !== "closed" && p.rowPhase !== "scored") return;
  const total = Object.keys(p.submissions || {}).length;
  const cur = p.revealedRows || 0;
  p.revealedRows = Math.min(cur + 1, Math.max(total, 1));
  saveDb();
  emit();
}

// MC mở TẤT CẢ các câu trả lời cùng lúc (rút gọn khi không cần hồi hộp).
export function revealAllRowAnswers() {
  const game = g();
  const p = game.puzzle;
  if (game.round !== "vuot_cnv") return;
  if (p.rowPhase !== "closed" && p.rowPhase !== "scored") return;
  p.revealedRows = Object.keys(p.submissions || {}).length;
  saveDb();
  emit();
}

// MC "Chốt điểm" cho ô hiện tại: cộng điểm theo tốc độ, mở/khóa mảnh, sang đội kế.
export function settleRow() {
  const game = g();
  const p = game.puzzle;
  if (game.round !== "vuot_cnv" || p.keywordSolved || p.rowPhase === "scored") return;
  const ranked = computeRowRanked();
  p.ranked = ranked;
  p.rowPhase = "scored";
  // Cộng điểm cho các đội ĐÚNG theo độ nhanh (sai = 0, không trừ).
  ranked.filter((r) => r.correct === true && r.points > 0).forEach((r) => addScore(r.teamId, r.points));
  // Phản hồi kết quả ô vừa xử lý (cho màn Đội & Khán giả).
  const anyCorrect = ranked.some((r) => r.correct === true);
  p.lastResult = {
    correct: anyCorrect,
    teamId: anyCorrect ? (ranked.find((r) => r.correct === true && r.place === 1)?.teamId ?? null) : null,
    row: p.currentRow,
    pts: anyCorrect ? (ranked.find((r) => r.correct === true && r.place === 1)?.points || 0) : 0,
    // Mốc thời gian chốt — client dùng để nổi tổng điểm mới trên TeamsRow một lúc ngắn.
    at: Date.now(),
  };
  // Có ≥1 đội đúng → mở mảnh; tất cả sai → khóa vĩnh viễn. Cả hai đều mở cửa sổ từ khóa.
  if (anyCorrect) {
    revealRow(p.currentRow);
  } else {
    lockRow(p.currentRow);
  }
  // Tiếng hiệu ĐÚNG/SAI của ô vừa chốt — khán giả nghe kết quả ngay trên màn Đáp án.
  emitEvent("sound:play", { slot: anyCorrect ? "correct" : "wrong" });
  // CHUỖI TỰ ĐỘNG sau chốt điểm (MC không cần bấm gì):
  //   t+5s → màn Đáp án (đang hiện điểm từng đội) chuyển sang màn CÂU HỎI + tự lật đáp án
  //   t+8s → chuyển sang BẢNG MẢNH thấy mảnh vừa mở/khóa
  // MC bấm bất kỳ nút chuyển màn trong lúc này là HỦY các bước còn lại (mỗi bước chỉ chạy
  // khi màn vẫn đúng vị trí trung gian chương trình đặt) — MC toàn quyền can thiệp.
  scheduleRowReveal(p.currentRow);
  saveDb();
  emit();
}

// Chuỗi màn hình tự động chạy sau "Chốt điểm" (xem chi tiết ở settleRow):
//   bước 1 (t+ANSWER_STAY_MS)  → màn Đáp án → màn CÂU HỎI + lật đáp án
//   bước 2 (tầm thêm QUESTION_STAY_MS) → màn CÂU HỎI → BẢNG MẢNH (mảnh đã mở/khóa)
// Mỗi bước chỉ tự chuyển khi: chưa giải từ khóa, vẫn ở đúng ô được chốt (currentRow khớp
// + rowPhase "scored"), và màn hình đang nằm đúng chỗ chương trình đặt — MC bấm nút đổi
// màn là các bước tiếp theo bị bỏ qua (không chồng lấn với thao tác tay của MC).
function scheduleRowReveal(row) {
  const ANSWER_STAY_MS = 5000;   // giữ màn Đáp án (hiển thị điểm từng đội) trước khi đi tiếp
  const QUESTION_STAY_MS = 3000; // giữ màn câu hỏi + đáp án rồi mới sang bảng mảnh
  setTimeout(() => {
    const gm = g();
    const pp = gm.puzzle;
    if (gm.round !== "vuot_cnv" || pp?.currentRow !== row || pp?.rowPhase !== "scored" || pp?.keywordSolved) return;
    if (gm.display.mode !== "answers") return;
    gm.display.mode = "question";
    gm.display.answerRevealed = true;
    gm.questionStatus = "revealed";
    saveDb();
    emit();
    setTimeout(() => {
      const gm2 = g();
      const pp2 = gm2.puzzle;
      if (gm2.round !== "vuot_cnv" || pp2?.currentRow !== row || pp2?.rowPhase !== "scored" || pp2?.keywordSolved) return;
      if (gm2.display.mode !== "question") return;
      gm2.display.mode = "puzzle";
      gm2.display.answerRevealed = false;
      gm2.questionStatus = "showing";
      saveDb();
      emit();
    }, QUESTION_STAY_MS);
  }, ANSWER_STAY_MS);
}

export function showPuzzle() {
  const game = g();
  game.display.mode = "puzzle";
  game.display.answerRevealed = game.puzzle.keywordSolved;
  game.display.answer = game.puzzle.keywordSolved
    ? getDb().questions.main.vuotCnv.keyword
    : "";
  game.display.question = getDb().questions.main.vuotCnv.hint;
  game.display.note = `Từ khóa: ${getDb().questions.main.vuotCnv.letterCount} chữ cái (không tính dấu cách)`;
  saveDb();
  emit();
}
