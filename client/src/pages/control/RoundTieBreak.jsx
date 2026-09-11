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

  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");

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

  return (
    <div className="panel">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-mist uppercase tracking-wider">Vòng phụ</h3>
        {phase === "done" && winner && (
          <span className="badge badge-ok">
            Thắng: {teams.find((t) => t.id === winner)?.name || winner}
          </span>
        )}
      </div>

      {/* Chọn đội tham gia */}
      <div className="mb-3">
        <div className="text-xs text-mist mb-1.5">Đội tham gia</div>
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

      {/* Ngân hàng câu hỏi */}
      <div className="mb-3">
        <div className="text-xs text-mist mb-1.5">Câu hỏi ({questions.length})</div>
        <div className="flex flex-col gap-1.5 mb-2">
          {questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-mist shrink-0">{i + 1}.</span>
              <span className="flex-1 truncate">{q.question}</span>
              <span className="text-gold shrink-0">({q.answer})</span>
              <button type="button" className="text-red-400 hover:text-red-300 shrink-0" onClick={() => removeQuestion(i)}>x</button>
            </div>
          ))}
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

      {/* Điều khiển */}
      <div className="flex flex-wrap gap-1.5">
        <RulesToggle d={d} act={act} className="btn btn-ghost text-xs py-1!" />
        <button
          type="button"
          className="btn btn-ghost text-xs py-1!"
          disabled={questions.length === 0}
          onClick={() => act("tiebreak.show")}
        >
          Chiếu câu {g.questionIndex + 1}
        </button>
        <button
          type="button"
          className="btn btn-ghost text-xs py-1!"
          onClick={() => act("buzzer.reset", { open: false })}
        >
          Reset chuông
        </button>
        <button
          type="button"
          className="btn btn-ghost text-xs py-1!"
          onClick={() => act("buzzer.open")}
        >
          Mở chuông
        </button>
        <button
          type="button"
          className="btn btn-ghost text-xs py-1!"
          onClick={() => act("tiebreak.next")}
        >
          Câu tiếp
        </button>
        <button
          type="button"
          className="btn btn-ghost text-xs py-1!"
          onClick={() => act("tiebreak.reveal")}
        >
          Hiện đáp án
        </button>
      </div>

      {/* Chấm điểm */}
      {g.buzzer.winner && phase !== "done" && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="text-xs text-mist mb-1.5">
            Chuông: <b style={{ color: teams.find((t) => t.id === g.buzzer.winner)?.color }}>{teams.find((t) => t.id === g.buzzer.winner)?.name}</b>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              className="btn btn-ok text-xs py-1!"
              onClick={() => act("tiebreak.mark", { teamId: g.buzzer.winner, correct: true })}
            >
              Dung
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

      {/* Chọn tay` công */}
      {phase !== "done" && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="text-xs text-mist mb-1.5">Chon tay thang</div>
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

      {/* Loại đội (VĨNH VIỄN — MC tự bấm, sau vòng phụ) */}
      <div className="mt-3 border-t border-line pt-3">
        <div className="text-xs text-danger mb-1.5">Khoa - Loat doi VINH VIEN</div>
        <div className="flex flex-wrap gap-1.5">
          {teams.filter((t) => !t.eliminated).map((t) => (
            <button
              key={t.id}
              type="button"
              className="px-2.5 py-1 text-xs font-semibold border border-line bg-panel hover:bg-danger/20 hover:text-danger transition"
              style={{ borderColor: t.color, color: t.color }}
              onClick={() => act("tiebreak.eliminate", { teamId: t.id })}
            >
              Khoa {t.name}
            </button>
          ))}
        </div>
        {teams.filter((t) => t.eliminated).length > 0 && (
          <>
            <div className="text-xs text-gold mb-1.5 mt-2">Da khoa VINH VIEN</div>
            <div className="flex flex-wrap gap-1.5">
              {teams.filter((t) => t.eliminated).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="px-2.5 py-1 text-xs font-semibold border border-line bg-panel hover:bg-white/10 transition"
                  style={{ borderColor: t.color, color: t.color }}
                  onClick={() => act("tiebreak.restore", { teamId: t.id })}
                >
                  Mo khoa {t.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
