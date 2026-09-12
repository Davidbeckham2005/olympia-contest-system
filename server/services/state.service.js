import { getDb, roundsView } from "../models/store.js";
import { cnvView } from "./game.service.js";

export function publicState() {
  const d = getDb();
  const state = {
    // các cài đặt chung của giải 
    settings: {
      title: d.settings.title,
      subtitle: d.settings.subtitle,
      // thời lượng vòng loại. 
      prelimDuration: d.settings.prelimDuration,
      // số câu hỏi ???
      prelimQuestionCount: d.settings.prelimQuestionCount,
      // số đội thí sinh được vào vòng trong ???
      topN: d.settings.topN,
      // trạng thái mở đề
      prelimOpen: d.settings.prelimOpen,
      // có show bảng xếp hạng trực tiếp hay không  
      showLiveRanking: d.settings.showLiveRanking,
      // kiểu nền + ảnh nền của màn hình khán giả (vòng khởi động)
      audienceBg: d.settings.audienceBg || "dark",
      audienceBgUrl: d.settings.audienceBgUrl || "",
    },
    // danh sách các đội thi
    teams: d.teams.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      accent: t.accent,
      score: t.score,
      eliminated: !!t.eliminated,
      members: t.memberIds.map((id) => {
        const c = d.contestants.find((x) => x.id === id);
        return c ? { id: c.id, name: c.name } : null;
      }).filter(Boolean),
    })),
    // tổng số thí sinh đã đăng ký?
    contestantCount: d.contestants.length,
    // tổng số thí sinh đã nộp bài
    submittedCount: d.contestants.filter((c) => c.submittedAt).length,
    // trạng thái game hiện tại
    game: d.game,
    // danh sách câu hỏi các vòng — BẮT BUỘC gửi cùng lúc game:state để bàn MC hiện NGAY
    // danh mục câu hỏi (vd Tăng tốc 1·2·3·4) khi mở lần đầu, không cần đợi click để có
    // sự kiện game:state. (Cùng dữ liệu socket game:state đã gửi từ trước.)
    questions: d.questions,
    media: d.media,
    sounds: d.sounds || { correct: { url: "" }, wrong: { url: "" }, bg: { url: "" }, wait: { url: "" }, buzz: { url: "" }, answers: { url: "" }, khoi_dong: { url: "" }, result: { url: "" } },
    // định nghĩa cấu trúc vòng thi — luật do admin chỉnh trong DB (ưu tiên hơn mặc định)
    rounds: roundsView(d.rules),
  };
  if (d.game.round === "vuot_cnv") {
    state.cnv = cnvView(d);
  }
  // B5: giống game.publicGame — không gửi display.answer cho vòng 2 trước khi lật đáp án
  // (answerRevealed), tránh thí sinh đọc được đáp án qua state socket.
  if (d.game.round === "vuot_cnv" && !d.game.display?.answerRevealed) {
    state.game = { ...state.game, display: { ...state.game.display, answer: "" } };
  }
  return state;
}

export function adminState() {
  const d = getDb();
  return {
    ...publicState(),
    settings: d.settings,
    // BTC xem được mật khẩu đội để phát cho thí sinh
    teams: d.teams.map((t) => ({ ...t })),
    contestants: d.contestants.map(stripAnswersForList),
    questions: d.questions,
  };
}

function stripAnswersForList(c) {
  return {
    id: c.id,
    name: c.name,
    studentId: c.studentId,
    school: c.school,
    className: c.className,
    score: c.score,
    correctCount: c.correctCount,
    timeSpent: c.timeSpent,
    submittedAt: c.submittedAt,
    rank: c.rank,
    qualified: c.qualified,
    teamId: c.teamId,
    startedAt: c.startedAt,
  };
}
