import { useState } from "react";

export default function RoundTieBreak({ ctx }) {
  const { act, state, g, d } = ctx;
  if (g.round !== "tie_break") return null;

  const tb = g.tieBreak || {};
  const teams = state.teams || [];
  const selectedTeams = tb.teams || [];
  const questions = tb.questions || [];
  const phase = tb.phase || "setup";
  const winner = tb.winner;
  const exhausted = phase === "exhausted";
  const running = phase === "running";
  const counting = phase === "countdown";
  const currentQ = questions[g.questionIndex];

  const [showQuestions, setShowQuestions] = useState(false);
  // Ngân hàng câu hỏi do Admin quản lý (tab Câu hỏi → Vòng phụ) — MC chỉ chọn câu, không thêm.
  const bank = Array.isArray(state.questions?.main?.tieBreak) ? state.questions.main.tieBreak : [];

  function toggleQuestion(q) {
    const has = questions.some((x) => x.id === q.id);
    const updated = has
      ? questions.filter((x) => x.id !== q.id)
      : [...questions, q];
    act("tiebreak.questions", { questions: updated });
  }

  function toggleTeam(teamId) {
    const updated = selectedTeams.includes(teamId)
      ? selectedTeams.filter((id) => id !== teamId)
      : [...selectedTeams, teamId];
    act("tiebreak.teams", { teams: updated });
  }

  const canStart = selectedTeams.length > 0 && questions.length > 0 && phase === "setup";

  return (
    <div className="panel space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-mist uppercase tracking-wider">Vòng phụ</h3>
        <span className="text-[10px] text-mist/70 uppercase tracking-wider">Không tính điểm — chỉ Đúng/Sai</span>
        {phase === "done" && winner && (
          <span className="badge badge-ok">
            Thắng: {teams.find((t) => t.id === winner)?.name || winner}
          </span>
        )}
        {exhausted && (
          <span className="badge badge-warn">
            Hết câu — chọn tay công
          </span>
        )}
        {counting && (
          <span className="badge badge-warn">
            Đang đếm 3-2-1…
          </span>
        )}
        {running && (
          <span className="badge badge-ok">
            Đang thi
          </span>
        )}
        {phase === "setup" && selectedTeams.length > 0 && (
          <span className="badge">
            Đã chọn {selectedTeams.length} đội
          </span>
        )}
      </div>

      {/* Chọn đội tham gia - luôn hiện */}
      <div>
        <div className="text-xs text-mist mb-1.5">Đội tham gia (chọn ít nhất 1 đội để bắt đầu)</div>
        <div className="flex flex-wrap gap-1.5">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTeam(t.id)}
              className={`px-2.5 py-1 text-xs font-semibold border transition ${
                selectedTeams.includes(t.id)
                  ? "border-white/40 bg-white/20 text-white"
                  : "border-line bg-panel text-mist hover:bg-white/10"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Nút bắt đầu - chỉ hiện khi chưa bắt đầu và đã chọn đội */}
      {canStart && (
        <button
          type="button"
          className="btn btn-ok w-full"
          onClick={() => act("tiebreak.show")}
        >
          Bắt đầu vòng phụ
        </button>
      )}
      {!canStart && phase !== "setup" && (
        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => {
            if (window.confirm("Bắt đầu lại vòng phụ từ đầu? (giữ đội + câu hỏi đã chọn)")) {
              act("tiebreak.reset");
            }
          }}
        >
          ↺ Bắt đầu lại vòng phụ
        </button>
      )}

      {/* Câu hỏi hiện tại */}
      {currentQ && phase !== "setup" && (
        <div className="p-3 rounded-lg border border-line bg-night/40">
          <div className="text-xs text-mist mb-1">Câu {g.questionIndex + 1} / {questions.length}</div>
          <div className="text-sm text-white mb-1">{currentQ.question}</div>
          {currentQ.mediaUrl && (
            <img src={currentQ.mediaUrl} alt="" className="mt-2 max-h-32 object-contain rounded" />
          )}
          {running && g.questionIndex < questions.length - 1 && !g.buzzer.winner && (
            <button
              type="button"
              className="btn btn-ghost text-xs py-1! w-full mt-2"
              onClick={() => act("tiebreak.next")}
            >
              Câu tiếp →
            </button>
          )}
        </div>
      )}

      {/* Chấm đúng/sai - không cộng điểm */}
      {g.buzzer.winner && phase !== "done" && !exhausted && (
        <div className="p-3 rounded-lg border border-line bg-night/40">
          <div className="text-xs text-mist mb-2">
            Đội bấm chuông: <b style={{ color: teams.find((t) => t.id === g.buzzer.winner)?.color }}>{teams.find((t) => t.id === g.buzzer.winner)?.name}</b>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="btn btn-ok text-xs py-1!"
              onClick={() => act("tiebreak.mark", { teamId: g.buzzer.winner, correct: true })}
            >
              Đúng
            </button>
            <button
              type="button"
              className="btn btn-danger text-xs py-1!"
              onClick={() => act("tiebreak.mark", { teamId: g.buzzer.winner, correct: false })}
            >
              Sai
            </button>
          </div>
        </div>
      )}

      {/* Chọn tay thắng */}
      {phase !== "done" && selectedTeams.length > 0 && (
        <div className="p-3 rounded-lg border border-line bg-night/40">
          <div className="text-xs text-mist mb-2">Chọn tay thắng</div>
          <div className="flex flex-wrap gap-1.5">
            {selectedTeams.filter((id) => id !== winner).map((id) => {
              const t = teams.find((x) => x.id === id);
              return (
                <button
                  key={id}
                  type="button"
                  className="px-2.5 py-1 text-xs font-semibold border border-line bg-panel hover:bg-white/10 transition"
                  style={{ borderColor: t?.color, color: t?.color }}
                  onClick={() => act("tiebreak.winner", { teamId: id })}
                >
                  {t?.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chọn câu hỏi vòng phụ (ngân hàng do Admin quản lý) */}
      <div className="border-t border-line pt-3">
        <button
          type="button"
          className="flex items-center gap-2 text-xs text-mist hover:text-white transition mb-2 w-full"
          onClick={() => setShowQuestions((v) => !v)}
        >
          <span className={`transition ${showQuestions ? "rotate-90" : ""}`}>▶</span>
          Chọn câu hỏi vòng phụ ({questions.length}/{bank.length})
        </button>
        {bank.length === 0 ? (
          <p className="text-mist text-xs">Ngân hàng câu hỏi trống — Admin thêm ở tab Câu hỏi → Vòng phụ.</p>
        ) : null}
        {showQuestions && (
          <div className="space-y-1.5">
            {bank.map((q, i) => {
              const picked = questions.some((x) => x.id === q.id);
              return (
                <label
                  key={q.id || i}
                  className={`flex items-center gap-2 text-xs cursor-pointer transition ${picked ? "text-white" : "text-mist"}`}
                >
                  <input
                    type="checkbox"
                    className="accent-[#ffd60a]"
                    checked={picked}
                    onChange={() => toggleQuestion(q)}
                  />
                  <span className="flex-1 truncate">{q.question}</span>
                  <span className="text-gold shrink-0">({q.answer})</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
