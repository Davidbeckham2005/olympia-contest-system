import { useState } from "react";
import RulesToggle from "../../components/RulesToggle.jsx";

export default function RoundKhoiDong({ ctx }) {
  const { isKd, act, state, g, d } = ctx;
  const [showAll, setShowAll] = useState(false);
  if (!isKd) return null;
  const order = (state.teams || []).map((x) => x.id);
  const curIdx = order.indexOf(g.currentTeam);
  const curTeamId = order[curIdx] || g.currentTeam;
  const t = (state.teams || []).find((x) => x.id === curTeamId);
  const clusters = Array.isArray(state.questions?.main?.khoiDong?.[curTeamId])
    ? state.questions.main.khoiDong[curTeamId]
    : [];
  const mi = g.khoiDong?.memberIndex ?? 0;
  if (g.questionStatus === "idle") {
    return (
      <div className="panel">
        <div className="text-xs text-mist">Chưa bắt đầu — hãy chọn đội để bắt đầu lượt.</div>
      </div>
    );
  }
  const cluster = Array.isArray(clusters[mi]) ? clusters[mi] : [];
  const hist = g.khoiDong?.history?.[curTeamId] || {};
  const memberHist = hist[mi] || {};
  return (
    <div className="panel">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t?.color }} />
          <b className="text-base truncate" style={{ color: t?.color }}>{t?.name}</b>
          <span className={`badge ${g.khoiDong?.phase === "break" ? "badge-warn" : "badge-ok"} text-xs! shrink-0`}>
            {g.khoiDong?.phase === "break" ? "Khoảng nghỉ" : g.khoiDong?.phase === "done" ? "Kết thúc" : "Đang thi"}
          </span>
          {!showAll && <span className="text-xs font-semibold text-mist">Thí sinh {mi + 1}</span>}
        </div>
        <button type="button" className="btn btn-ghost text-xs py-1!" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Thu gọn" : "Hiện 5 thí sinh"}
        </button>
        <RulesToggle d={d} act={act} className="btn btn-ghost text-xs py-1!" />
      </div>

      {clusters.length > 1 && mi + 1 < clusters.length && (
        <button
          type="button"
          className={`btn text-xs py-1! w-full mt-2 ${g.khoiDong?.phase === "break" ? "btn-ok" : "btn-ghost"}`}
          onClick={() => act("question.jump", { teamId: curTeamId, memberIndex: mi + 1, questionIndex: 0 })}
        >
          Chuyển sang thí sinh {mi + 2}
        </button>
      )}
      {g.khoiDong?.phase === "break" && g.khoiDong?.breakInfo?.kind === "team" && (
        <button
          type="button"
          className="btn btn-ghost text-xs py-1! w-full mt-2"
          onClick={() => act("khoi_dong.continue")}
        >
          Sang đội {state.teams.find((x) => x.id === g.khoiDong?.breakInfo?.nextTeamId)?.name || g.khoiDong?.breakInfo?.nextTeamId}
        </button>
      )}
      {g.khoiDong?.phase === "break" && g.khoiDong?.breakInfo?.kind === "done" && (
        <button type="button" className="btn btn-ok text-xs py-1! w-full mt-2" onClick={() => act("khoi_dong.continue")}>
          Sang tổng kết
        </button>
      )}

      <div className="flex flex-col gap-1.5">
        {!clusters.length ? (
          <div className="text-xs text-mist">Chưa có ảnh cho {t?.name || curTeamId}.</div>
        ) : showAll ? (
          clusters.map((cluster, m) => {
            const memberCluster = Array.isArray(cluster) ? cluster : [];
            const memberHist = hist[m] || {};
            return (
              <div key={`${curTeamId}-m${m}`} className={`rounded-lg border px-2 py-1 ${m === mi ? "border-gold bg-gold/8" : "border-line"}`}>
                <button
                  type="button"
                  className="text-xs font-semibold text-mist hover:text-ink"
                  onClick={() => act("question.jump", { teamId: curTeamId, memberIndex: m, questionIndex: 0 })}
                >
                  Thí sinh {m + 1}
                  {m === mi ? " \u25CF" : ""}
                </button>
                <div className="grid grid-cols-5 gap-1">
                  {memberCluster.map((qd, i) => {
                    const isCurrent = m === mi && i === (g.questionIndex || 0);
                    const mark = memberHist[i];
                    const correct = mark === true;
                    const wrong = mark === false;
                    return (
                      <button
                        key={qd.id}
                        type="button"
                        onClick={() => act("question.jump", { teamId: curTeamId, memberIndex: m, questionIndex: i })}
                        className={`rounded-md border px-1 py-1 text-xs font-semibold transition truncate ${
                          isCurrent
                            ? "border-gold bg-gold/15 text-gold"
                            : correct
                              ? "border-ok/30 bg-ok/8 text-ok/70"
                              : wrong
                                ? "border-danger/40 bg-danger/8 text-danger/80"
                                : "border-line text-mist hover:border-gold/50 hover:text-ink"
                        }`}
                        title={qd.answer || qd.question}
                      >
                        {i + 1}{qd.mediaUrl ? " \u25C9" : ""}{isCurrent ? " \u25CF" : correct ? " \u2713" : wrong ? " \u2715" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-lg border border-gold/50 bg-gold/8 px-2 py-1">
            <div className="grid grid-cols-5 gap-1">
              {cluster.map((qd, i) => {
                const isCurrent = i === (g.questionIndex || 0);
                const mark = memberHist[i];
                const correct = mark === true;
                const wrong = mark === false;
                return (
                  <button
                    key={qd.id}
                    type="button"
                    onClick={() => act("question.jump", { teamId: curTeamId, memberIndex: mi, questionIndex: i })}
                    className={`rounded-md border px-1 py-1 text-xs font-semibold transition truncate ${
                      isCurrent
                        ? "border-gold bg-gold/15 text-gold"
                        : correct
                          ? "border-ok/30 bg-ok/8 text-ok/70"
                          : wrong
                            ? "border-danger/40 bg-danger/8 text-danger/80"
                            : "border-line text-mist hover:border-gold/50 hover:text-ink"
                    }`}
                    title={qd.answer || qd.question}
                  >
                    {i + 1}{qd.mediaUrl ? " \u25C9" : ""}{isCurrent ? " \u25CF" : correct ? " \u2713" : wrong ? " \u2715" : ""}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex justify-end">
        <button
          type="button"
          className="btn btn-ghost text-[11px] py-1! px-2! text-danger/80 hover:text-danger"
          title="Reset trạng thái (cần mật khẩu admin)"
          onClick={async () => {
            const pin = window.prompt("Nhập mật khẩu admin để reset trạng thái đội này:");
            if (pin == null) return;
            try {
              await act("khoi_dong.reset", { teamId: curTeamId, pin });
            } catch {}
          }}
        >
          Reset trạng thái {t?.name || curTeamId}
        </button>
      </div>
    </div>
  );
}