import { useState } from "react";

const PHASE_LABEL = {
  setup: "CHỌN ĐỘI & CÂU HỎI",
  ready: "HIỆN CÂU HỎI — CHỜ BẮT ĐẦU GIỜ",
  running: "ĐANG NHẬN ĐÁP ÁN",
  answers: "CHỜ CHỐT ĐÁP ÁN",
  done: "ĐÃ CÓ NGƯỜI THẮNG",
  exhausted: "HẾT CÂU — CHỌN ĐỘI THẮNG",
};

export default function RoundTieBreak({ ctx }) {
  const { act, state, g, d, running, remaining } = ctx;
  if (g.round !== "tie_break") return null;

  const tb = g.tieBreak || {};
  const teams = state.teams || [];
  const selectedTeams = tb.teams || [];
  const questions = tb.questions || [];
  const phase = tb.phase || "setup";
  const winner = tb.winner;
  const fastest = tb.fastest;
  const submissions = tb.submissions || {};
  const corrections = tb.corrections || {};
  const answersScreen = d.mode === "answers";
  const currentQ = questions[g.questionIndex];
  const isCounting = running && phase === "running";
  const hasMore = (g.questionIndex || 0) + 1 < questions.length;

  const [showQuestions, setShowQuestions] = useState(false);
  // Ngân hàng câu hỏi do Admin quản lý (tab Câu hỏi → Vòng phụ) — MC chỉ chọn câu, không thêm.
  const bank = Array.isArray(state.questions?.main?.tieBreak) ? state.questions.main.tieBreak : [];

  function toggleQuestion(q) {
    if (questions.some((x) => x.id === q.id)) return;
    act("tiebreak.questions", { questions: [...questions, q] });
  }

  function toggleTeam(teamId) {
    const updated = selectedTeams.includes(teamId)
      ? selectedTeams.filter((id) => id !== teamId)
      : [...selectedTeams, teamId];
    act("tiebreak.teams", { teams: updated });
  }

  const canStart = selectedTeams.length > 0 && questions.length > 0 && phase === "setup";
  const canReveal = phase === "answers";

  return (
    <div className="panel space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-mist uppercase tracking-wider">Vòng phụ</h3>
        <span className="badge">{PHASE_LABEL[phase] || phase}</span>
        {phase === "done" && winner && (
          <span className="badge badge-ok">
            Thắng: {teams.find((t) => t.id === winner)?.name || winner}
          </span>
        )}
        {phase === "exhausted" && (
          <span className="badge badge-warn">Hết câu — chọn tay công</span>
        )}
        {isCounting && (
          <span className="badge badge-warn">Giờ trả lời: {formatRemain(remaining)}</span>
        )}
      </div>

      {/* Chọn đội tham gia - always visible, editable chỉ ở setup */}
      <div>
        <div className="text-xs text-mist mb-1.5">Đội tham gia (chọn ít nhất 1 đội để bắt đầu)</div>
        <div className="flex flex-wrap gap-1.5">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={phase !== "setup"}
              onClick={() => toggleTeam(t.id)}
              className={`px-2.5 py-1 text-xs font-semibold border transition ${selectedTeams.includes(t.id)
                ? phase === "setup"
                  ? "border-ok/60 bg-ok/10 text-ok"
                  : "border-ok/60 bg-ok/10 text-ok cursor-not-allowed"
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

      {/* Điều khiển theo phase */}
      {phase === "setup" && canStart && (
        <button type="button" className="btn btn-ok w-full" onClick={() => act("tiebreak.show")}>
          ▶ Bắt đầu vòng phụ — hiện câu hỏi
        </button>
      )}

      {phase === "ready" && (
        <div className="flex gap-2">
          <button type="button" className="btn btn-ok w-full" onClick={() => act("tiebreak.start")}>
            ⏱ Bắt đầu tính giờ trả lời
          </button>
        </div>
      )}

      {phase === "running" && (
        <div className="flex gap-2">
          <button type="button" className="btn flex-1" onClick={() => act("tiebreak.close")}>
            ⛔ Đóng nhận bài (chốt)
          </button>
        </div>
      )}

      {/* Màn hình khán giả: câu hỏi / đáp án */}
      {!["setup"].includes(phase) && (
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
        </div>
      )}

      {/* Bài nộp + chấm từng đội (giống màn chấm Vòng 3) */}
      {phase === "running" && (
        <div className="p-3 rounded-lg border border-line bg-night/40 space-y-2">
          <div className="text-xs text-mist mb-2">Đáp án các đội (real-time)</div>
          {selectedTeams.map((id) => {
            const t = teams.find((x) => x.id === id);
            const submission = submissions[id];
            return (
              <div key={id} className="flex items-center gap-2 border-b border-line/50 pb-2 last:border-b-0">
                <span className="w-24 truncate text-xs font-semibold" style={{ color: t?.color }}>{t?.name || id}</span>
                <span className="flex-1 truncate text-sm">{submission?.answer || "Chưa gửi"}</span>
                {submission && (
                  <span className="badge shrink-0 px-1.5! py-0! text-[10px]!">
                    {submission.elapsed != null ? `${submission.elapsed.toFixed(1)}s` : "đã gửi"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {phase === "answers" && (
        <div className="p-3 rounded-lg border border-line bg-night/40 space-y-2">
          <div className="text-xs text-mist mb-2">Chốt đáp án — chấm Đúng/Sai từng đội</div>
          {selectedTeams.map((id) => {
            const t = teams.find((x) => x.id === id);
            const submission = submissions[id];
            const marked = corrections[id];
            const isFastest = fastest === id;
            return (
              <div key={id} className="flex items-center gap-2 border-b border-line/50 pb-2 last:border-b-0">
                <span className="w-24 truncate text-xs font-semibold" style={{ color: t?.color }}>{t?.name || id}</span>
                <span className="flex-1 truncate text-sm">{submission?.answer || "Không gửi"}</span>
                {isFastest && <span className="badge badge-ok shrink-0 px-1.5! py-0! text-[10px]!">NHANH NHẤT</span>}
                {submission && (
                  <>
                    <button type="button" className={`btn ${marked === true ? "btn-ok" : ""} text-xs py-1!`} onClick={() => act("tiebreak.mark", { teamId: id, correct: true })}>Đúng</button>
                    <button type="button" className={`btn ${marked === false ? "btn-danger" : ""} text-xs py-1!`} onClick={() => act("tiebreak.mark", { teamId: id, correct: false })}>Sai</button>
                  </>
                )}
              </div>
            );
          })}
          {canReveal && (
            <button type="button" className="btn btn-ghost text-xs py-1.5! w-full" onClick={() => act("tiebreak.showAnswer")}>
              Hiện đáp án của câu hỏi
            </button>
          )}
          {canReveal && (
            <button type="button" className="btn btn-ghost text-xs py-1.5! w-full" onClick={() => act("tiebreak.reveal")}>
              Lật đáp án — công bố đội thắng (đúng + nhanh nhất)
            </button>
          )}
        </div>
      )}

      {phase === "exhausted" && (
        <div className="p-3 rounded-lg border border-danger/40 bg-danger/10 space-y-2">
          <div className="text-xs text-danger">Hết câu hỏi — không có đội nào thắng. MC chọn đội thắng:</div>
          {selectedTeams.map((id) => {
            const t = teams.find((x) => x.id === id);
            return (
              <button
                key={id}
                type="button"
                className="btn btn-ghost w-full text-xs py-1!"
                onClick={() => act("tiebreak.winner", { teamId: id })}
              >
                {t?.name || id}
              </button>
            );
          })}
        </div>
      )}

      {/* Sau khi công bố: sang câu tiếp / làm lại */}
      {(phase === "done") && (
        <div className="flex gap-2 border-t border-line pt-3">
          {hasMore && (
            <button type="button" className="btn flex-1" onClick={() => act("tiebreak.next")}>
              Câu tiếp →
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost flex-1"
            onClick={() => {
              if (window.confirm("Bắt đầu lại vòng phụ từ đầu? (giữ đội + câu hỏi đã chọn)")) {
                act("tiebreak.reset");
              }
            }}
          >
            ↺ Làm lại vòng phụ
          </button>
        </div>
      )}

      {phase === "answers" && (
        <div className="flex gap-2 border-t border-line pt-3">
          <button type="button" className="btn flex-1" onClick={() => act("tiebreak.next")}>
            Câu tiếp →
          </button>
          <button
            type="button"
            className="btn btn-ghost flex-1"
            onClick={() => {
              if (window.confirm("Bắt đầu lại vòng phụ từ đầu? (giữ đội + câu hỏi đã chọn)")) {
                act("tiebreak.reset");
              }
            }}
          >
            ↺ Làm lại
          </button>
        </div>
      )}

      {phase === "ready" && currentQ && (
        <div className="text-xs text-mist border-t border-line pt-3">
          Câu hỏi đã hiện trên màn hình. Bấm <b className="text-white">"Bắt đầu tính giờ trả lời"</b> để các đội bắt đầu gửi đáp án.
        </div>
      )}

      {/* Chọn câu hỏi vòng phụ (setup only) */}
      {phase === "setup" && (
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
      )}
    </div>
  );
}

function formatRemain(s) {
  const n = Math.max(0, Math.ceil(s || 0));
  return `${n}s`;
}