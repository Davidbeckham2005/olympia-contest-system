import { useState } from "react";
import RulesToggle from "../../components/RulesToggle.jsx";

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
  const currentQ = questions[g.questionIndex];

  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [showBank, setShowBank] = useState(false);

  function addQuestion() {
    if (!newQuestion.trim()) return;
    const updated = [...questions, { question: newQuestion.trim(), answer: newAnswer.trim() }];
    act("tiebreak.questions", { questions: updated });
    setNewQuestion("");
    setNewAnswer("");
  }

  function removeQuestion(idx) {
    const updated = questions.filter((_, i) => i !== idx);
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

      {/* Câu hỏi hiện tại */}
      {currentQ && phase !== "setup" && (
        <div className="p-3 rounded-lg border border-line bg-night/40">
          <div className="text-xs text-mist mb-1">Câu {g.questionIndex + 1} / {questions.length}</div>
          <div className="text-sm text-white mb-1">{currentQ.question}</div>
          {currentQ.mediaUrl && (
            <img src={currentQ.mediaUrl} alt="" className="mt-2 max-h-32 object-contain rounded" />
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

      {/* Ngân hàng câu hỏi */}
      <div className="border-t border-line pt-3">
        <button
          type="button"
          className="flex items-center gap-2 text-xs text-mist hover:text-white transition mb-2"
          onClick={() => setShowBank((v) => !v)}
        >
          <span className={`transition ${showBank ? "rotate-90" : ""}`}>▶</span>
          Ngân hàng câu hỏi ({questions.length})
        </button>
        {showBank && (
          <div className="space-y-2">
            <div className="flex flex-col gap-1.5">
              {questions.map((q, i) => (
                <div key={q.id || i} className="flex items-center gap-2 text-xs">
                  <span className="text-mist shrink-0 w-6">{i + 1}.</span>
                  <span className="flex-1 truncate">{q.question}</span>
                  <span className="text-gold shrink-0">({q.answer})</span>
                  <button type="button" className="text-red-400 hover:text-red-300 shrink-0" onClick={() => removeQuestion(i)}>x</button>
                </div>
              ))}
              {questions.length === 0 && (
                <p className="text-mist text-xs">Chưa có câu hỏi nào.</p>
              )}
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Câu hỏi..."
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addQuestion()}
                className="flex-1 bg-panel border border-line px-2 py-1.5 text-xs text-white placeholder:text-mist/50"
              />
              <input
                type="text"
                placeholder="Đáp án"
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addQuestion()}
                className="w-24 bg-panel border border-line px-2 py-1.5 text-xs text-white placeholder:text-mist/50"
              />
              <button type="button" className="btn btn-ghost text-xs py-1!" onClick={addQuestion}>+</button>
            </div>
          </div>
        )}
      </div>

      {/* Quản lý đội vĩnh viện */}
      <div className="border-t border-line pt-3">
        <div className="text-xs text-danger mb-1.5">Loại đội (vĩnh viễn)</div>
        <div className="flex flex-wrap gap-1.5">
          {teams.filter((t) => !t.eliminated).map((t) => (
            <button
              key={t.id}
              type="button"
              className="px-2.5 py-1 text-xs font-semibold border border-line bg-panel hover:bg-danger/20 hover:text-danger transition"
              style={{ borderColor: t.color, color: t.color }}
              onClick={() => act("tiebreak.eliminate", { teamId: t.id })}
            >
              Khóa {t.name}
            </button>
          ))}
        </div>
        {teams.filter((t) => t.eliminated).length > 0 && (
          <div className="mt-2">
            <div className="text-xs text-gold mb-1.5">Đã khóa</div>
            <div className="flex flex-wrap gap-1.5">
              {teams.filter((t) => t.eliminated).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="px-2.5 py-1 text-xs font-semibold border border-line bg-panel hover:bg-white/10 transition"
                  style={{ borderColor: t.color, color: t.color }}
                  onClick={() => act("tiebreak.restore", { teamId: t.id })}
                >
                  Mở khóa {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
