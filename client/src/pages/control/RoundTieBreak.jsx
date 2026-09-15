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
  const submissions = tb.submissions || {};
  const corrections = tb.corrections || {};
  const exhausted = phase === "exhausted";
  const running = phase === "running";
  const counting = phase === "countdown";
  const currentQ = questions[g.questionIndex];
  const answersScreen = d.mode === "answers";

  const [showQuestions, setShowQuestions] = useState(false);
  // Ngân hàng câu hỏi do Admin quản lý (tab Câu hỏi → Vòng phụ) — MC chỉ chọn câu, không thêm.
  const bank = Array.isArray(state.questions?.main?.tieBreak) ? state.questions.main.tieBreak : [];

  function toggleQuestion(q) {
    if (questions.some((x) => x.id === q.id)) return;
    act("tiebreak.questions", { questions: [...questions, q] });
  }

  function toggleTeam(teamId) {
    if (selectedTeams.includes(teamId)) return;
    act("tiebreak.teams", { teams: [...selectedTeams, teamId] });
  }

  const canStart = selectedTeams.length > 0 && questions.length > 0 && phase === "setup";

  return (
    <div className="panel space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-mist uppercase tracking-wider">Vòng phụ</h3>
        <span className="text-[10px] text-mist/70 uppercase tracking-wider">Trả lời đồng thời — chỉ Đúng/Sai</span>
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
              disabled={selectedTeams.includes(t.id) || phase !== "setup"}
              onClick={() => toggleTeam(t.id)}
              className={`px-2.5 py-1 text-xs font-semibold border transition ${selectedTeams.includes(t.id)
                ? "border-ok/60 bg-ok/10 text-ok cursor-not-allowed"
                : phase !== "setup"
                  ? "border-line bg-panel text-mist/40 cursor-not-allowed"
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

      {phase !== "setup" && phase !== "countdown" && (
        <div className="flex gap-2 border-t border-line pt-3">
          <button type="button" className={`btn flex-1 text-xs ${!answersScreen ? "btn-ok" : "btn-ghost"}`} onClick={() => act("screen.set", { mode: "question" })}>
            Màn câu hỏi
          </button>
          <button type="button" className={`btn flex-1 text-xs ${answersScreen ? "btn-ok" : "btn-ghost"}`} onClick={() => act("screen.set", { mode: "answers" })}>
            Màn đáp án
          </button>
        </div>
      )}

      {/* Câu hỏi hiện tại */}
      {currentQ && phase !== "setup" && (
        <div className="p-3 rounded-lg border border-line bg-night/40">
          <div className="text-xs text-mist mb-1">Câu {g.questionIndex + 1} / {questions.length}</div>
          <div className="text-sm text-white mb-1">{currentQ.question}</div>
          {currentQ.mediaUrl && (
            <img src={currentQ.mediaUrl} alt="" className="mt-2 max-h-32 object-contain rounded" />
          )}
          {phase === "running" && g.questionIndex < questions.length - 1 && (
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

      {/* Bài nộp và chấm từng đội, giống màn chấm Vòng 3 */}
      {phase !== "setup" && !exhausted && (
        <div className="p-3 rounded-lg border border-line bg-night/40 space-y-2">
          <div className="text-xs text-mist mb-2">Đáp án các đội</div>
          {selectedTeams.map((id) => {
            const t = teams.find((x) => x.id === id);
            const submission = submissions[id];
            const marked = corrections[id];
            return (
              <div key={id} className="flex items-center gap-2 border-b border-line/50 pb-2 last:border-b-0">
                <span className="w-24 truncate text-xs font-semibold" style={{ color: t?.color }}>{t?.name || id}</span>
                <span className="flex-1 truncate text-sm">{submission?.answer || "Chưa gửi"}</span>
                {submission && <button type="button" className={`btn ${marked === true ? "btn-ok" : ""} text-xs py-1!`} onClick={() => act("tiebreak.mark", { teamId: id, correct: true })}>Đúng</button>}
                {submission && <button type="button" className={`btn ${marked === false ? "btn-danger" : ""} text-xs py-1!`} onClick={() => act("tiebreak.mark", { teamId: id, correct: false })}>Sai</button>}
              </div>
            );
          })}
          {currentQ && <button type="button" className="btn btn-ghost text-xs py-1!" onClick={() => act("tiebreak.reveal")}>Hiện đáp án</button>}
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
                    disabled={picked || phase !== "setup"}
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
