export const TEAM_DEFS = [
  { id: "a", name: "Đội A", color: "#ff4d6d", accent: "#ff8fa3", pass: "dragon", eliminated: false },
  { id: "b", name: "Đội B", color: "#4cc9f0", accent: "#90e0ef", pass: "phoenix", eliminated: false },
  { id: "c", name: "Đội C", color: "#80ed99", accent: "#b7efc5", pass: "tiger", eliminated: false },
  { id: "d", name: "Đội D", color: "#ffd60a", accent: "#ffe566", pass: "turtle", eliminated: false },
  { id: "e", name: "Đội E", color: "#c084fc", accent: "#e0aaff", pass: "eagle", eliminated: false },
  { id: "f", name: "Đội F", color: "#f97316", accent: "#fdba74", pass: "falcon", eliminated: false },
];

// Danh sách id đầy đủ (thứ tự lượt thi vòng 1); các vòng 2-4 dùng top 4 điểm cao.
export const TEAM_ORDER = ["a", "b", "c", "d", "e", "f"];

export const ROUNDS = [
  {
    id: "khoi_dong",
    name: "Khởi động",
    rules: [
      "Trong vòng 60 giây, mỗi học sinh khởi động với tối đa 12 câu hỏi thuộc các lĩnh vực Toán, Lý, Hóa, Sinh, Văn, Sử, Địa, Tiếng Anh, Thể thao, Nghệ thuật, Hiểu biết chung và các lĩnh vực khác. Mỗi câu trả lời đúng được 10 điểm. Trả lời sai không bị trừ điểm.",
    ],
  },
  {
    id: "vuot_cnv",
    name: "Vượt chướng ngại vật",
    rules: [
      "Hình ảnh chướng ngại vật bị che bởi 5 mảnh ghép (4 ô góc + 1 ô trung tâm).",
      "Thứ tự chọn mảnh ghép theo điểm vòng 1 — đội cao nhất chọn trước.",
      "Giải đáp 4 câu hỏi tương ứng 4 mảnh ghép, 30 giây/câu.",
      "Mở đủ 4 góc mà chưa có đáp án → BTC cung cấp 1 câu hỏi để mở ô trung tâm.",
      "Điểm theo trả lời đúng và nhanh nhất: 40 · 30 · 20 · 10 — sai không điểm.",
      "Tất cả trả lời sai → mảnh ghép bị khóa vĩnh viễn.",
      "Các đội bấm chuông bất kỳ lúc nào để đoán từ khóa; trả lời sai sẽ mất quyền tiếp tục vòng thi.",
      "Điểm giải đáp từ khóa: mở 1 mảnh = 60 · mở 2 mảnh = 50 · mở 3 mảnh = 40 · mở 4 mảnh = 30 · mở ô trung tâm = 20.",
    ],
  },
  {
    id: "tang_toc",
    name: "Tăng tốc",
    rules: [
      "Các đội xem 4 clip, mỗi clip 30 giây.",
      "Trả lời các gợi ý từ tổng quát (hình ảnh, dữ liệu bao quát) đến trực tiếp (đáp án); tấm ảnh cuối là đáp án.",
      "Điểm theo tốc độ trả lời đúng: đội sớm nhất 40 · thứ hai 30 · thứ ba 20 · thứ tư 10.",
      "Đội trả lời bằng thời gian sẽ bằng điểm.",
      "Trả lời sai không bị trừ điểm.",
    ],
  },
  {
    id: "ve_dich",
    name: "Về đích",
    rules: [
      "Mỗi đội chọn 1 gói từ ngân hàng: 60 (10+10+20+20), 80 (10+20+20+30) hoặc 100 (20+20+30+30) — mỗi gói 4 câu.",
      "Các thành viên tự sắp xếp, mỗi người trả lời 1 câu trong gói 4 câu.",
      "Vừa đọc câu hỏi vừa trả lời: câu 10đ = 30s · 20đ = 45s · 30đ = 60s.",
      "Mỗi đội có 1 ngôi sao hy vọng, đặt ở bất kỳ câu hỏi nào trước khi câu hỏi đưa ra.",
      "Đội chọn gói — Đúng: hưởng điểm câu hỏi. Sai: không ai trả lời được thì không trừ điểm.",
      "Sai mà đội khác trả lời đúng: đội đang thi trừ đúng số điểm, đội trả lời đúng nhận số điểm đó.",
      "Ngôi sao hy vọng — Đúng: x2 điểm.",
      "Sao sai, không ai trả lời: trừ phân nửa số điểm.",
      "Sao sai mà đội khác trả lời đúng: đội đang thi trừ gấp đôi, đội đúng nhận x2 số điểm.",
      "Đội giành quyền trả lời sai: trừ đúng số điểm câu hỏi, đội chọn ngôi sao trừ phân nửa số điểm.",
    ],
  },
  { id: "tie_break", name: "Vòng phụ", rules: [] },
];

export function emptyPuzzle() {
  return {
    rowsSolved: [false, false, false, false, false],
    rowsLocked: [false, false, false, false, false],
    keywordSolved: false,
    keywordWinner: null,
    keywordPointsAwarded: 0,
    currentRow: 0,
    // Cửa sổ giành quyền đoán TỪ KHÓA giữa vòng: mở sau mỗi hàng ngang, đóng khi chọn ô mới
    keywordWindow: false,
    // Các đội đã đoán TỪ KHÓA sai (giữ nguyên tới khi ra từ khóa, không được đoán lại)
    keywordBlocked: [],
    // Đội đang ghi danh (nắm giữ quyền) đoán TỪ KHÓA qua nút TỪ KHÓA — bất kỳ lúc nào trong vòng
    keywordClaim: null,
    // Kết quả hàng ngang vừa xử lý xong (đúng/sai) để hiển thị hiệu ứng phản hồi,
    // tự động xóa khi chọn ô kế tiếp (selectRow)
    lastResult: null,
    // Các đội đoán TỪ KHÓA (chướng ngại vật) SAI → bị cấm đoán từ khóa tiếp theo
    // (không ghi danh lại được) cho tới hết vòng.
    rowBanned: [],
    // === Trả lời TỰ LUẬN gửi về MC (tham khảo vòng 3 Tăng tốc) phân bố trong vòng 2.
    // Mọi đội cùng nộp đáp án cho câu hàng ngang hiện tại, kèm thời gian nộp (elapsed).
    // rowPhase: "open" | "closed" | "scored" — đang nhận bài / đã đóng / đã chấm xong ô.
    // Khởi tạo "closed": vào vòng 2 CHƯA mở/chiếu câu hỏi nào (mở ở bảng mảnh ghép).
    // Phải bấm chọn 1 ô (selectRow → "open") thì mới có câu hỏi và mới hiện nút
    // "Bắt đầu giờ".
    rowPhase: "closed",
    submissions: {},   // teamId -> { answer, elapsed }
    corrections: {},   // teamId -> true|false (MC chấm từng đội)
    ranked: [],        // danh sách xếp hạng tính điểm theo tốc độ (đã chốt)
  };
}

export function defaultGame() {
  return {
    phase: "setup",
    round: null,
    currentTeam: "a",
    questionIndex: 0,
    questionStatus: "idle",
    display: {
      mode: "idle",
      title: "",
      question: "",
      options: [],
      mediaUrl: "",
      mediaType: "",
      answer: "",
      answerRevealed: false,
      note: "",
    },
    timer: { remaining: 0, running: false, endsAt: null, duration: 0 },
    buzzer: { open: false, locked: false, winner: null, order: [], blocked: [] },
    puzzle: emptyPuzzle(),
    veDich: { packagePoints: null, starQuestion: null, answeringTeam: null, stealOpen: false, stealPending: null, locked: false, phase: "soan", picked: {}, pickIndex: 0, usedQuestionIds: [] },
    tangToc: { submissions: {}, ranked: [] },
    khoiDong: { submissions: {}, history: {}, timerSeconds: 60, answerSeconds: 4 },
    tieBreak: { teams: [], questionIndex: 0, questions: [], phase: "setup", winner: null },
    // Điểm thưởng theo độ nhanh khi trả lời ĐÚNG câu hàng ngang Vòng 2 (Vượt CNV) và
    // Tăng tốc Vòng 3 — admin có thể thay đổi (mặc định 40 · 30 · 20 · 10 cho 4 đội).
    round2Points: [40, 30, 20, 10],
    round3Points: [40, 30, 20, 10],
    roundStarted: false,
    finished: false,
    winnerTeamId: null,
  };
}

export function defaultSettings() {
  return {
    title: "CUỘC THI TRI THỨC 2026",
    subtitle: "Hành trình kiến thức — 6 đội tranh tài",
    pin: "2026",
    prelimDuration: 15 * 60,
    prelimQuestionCount: 30,
    topN: 16,
    prelimOpen: false,
    showLiveRanking: false,
    audienceBg: "dark",
    audienceBgUrl: "",
    // Số giây MC được phép đọc câu hỏi trước khi hệ thống TỰ bắt đầu đếm giờ trả lời
    // ở Vòng Về đích (0 = tắt, bắt buộc MC bấm thủ công "Bắt đầu tính giờ").
    veDichAutoAnswerSeconds: 5,
  };
}
