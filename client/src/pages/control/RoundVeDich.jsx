import CurrentQuestionCard from "./CurrentQuestionCard.jsx";
import RulesToggle from "../../components/RulesToggle.jsx";

const PACKAGES = {
  60: [10, 10, 20, 20],
  80: [10, 20, 20, 30],
  100: [20, 20, 30, 30],
};

export default function RoundVeDich({ ctx }) {
  const { g, state, act, remaining, q, pts, revealed, running, d } = ctx;
  if (g.round !== "ve_dich") return null;

  const activeTeam = state.teams.find((t) => t.id === g.currentTeam);
  // Danh sách câu CHUNG trong DB — mỗi câu gắn teamId/pkg/order.
  const bank = Array.isArray(state.questions?.main?.veDich) ? state.questions.main.veDich : [];
  const pickedIds = (g.veDich?.picked || {})[g.currentTeam] || [];
  const picked = pickedIds
    .map((id) => bank.find((x) => x.id === id))
    .filter(Boolean)
    .map((q) => ({ id: q.id, points: q.points }));
  const locked = !!g.veDich?.locked;
  const phase = g.veDich?.phase || "soan";
  const curIndex = g.veDich?.pickIndex || 0;
  const star = g.veDich?.starQuestion === curIndex;
  const starUsed = g.veDich?.starQuestion !== null;
  const stealOpen = !!g.veDich?.stealOpen;
  const pending = g.veDich?.stealPending || null;
  const winner = g.buzzer?.winner || null;
  const base = q?.points || g.veDich?.packagePoints || 20;
  const stealCorrectPts = !pending ? base : (pending.star ? pending.base * 2 : pending.base);
  const stealWrongPts = pending ? pending.base : base;
  const pkg = g.veDich?.packagePoints;
  const hasPackage = pkg === 60 || pkg === 80 || pkg === 100;

  // Tình trạng 3 gói CỐ ĐỊNH của đội hiện tại (từ bank, không phụ thuộc runtime).
  const teamPkgStatus = (() => {
    const teamQs = bank.filter((x) => x.teamId === g.currentTeam);
    const result = {};
    for (const [total, structure] of Object.entries(PACKAGES)) {
      const target = Number(total);
      const qs = teamQs.filter((x) => x.pkg === target).sort((a, b) => (a.order || 0) - (b.order || 0));
      const expectedCounts = {};
      for (const lv of structure) expectedCounts[lv] = (expectedCounts[lv] || 0) + 1;
      const haveCounts = {};
      for (const x of qs) {
        const lv = Number(x.points);
        haveCounts[lv] = (haveCounts[lv] || 0) + 1;
      }
      const ok = qs.length === 4 && structure.every((lv) => expectedCounts[lv] === haveCounts[lv]);
      result[target] = { count: qs.length, ok, points: qs.map((x) => x.points) };
    }
    return result;
  })();

  const PACKAGE_LABEL = { 60: "60đ", 80: "80đ", 100: "100đ" };

  function selectPackage(packagePoints) {
    act("vedich.pick", { packagePoints });
  }

  return (
    <div className="panel divide-y divide-line">
      {/* CHỌN GÓI */}
      <section className="py-4">
        <div className="flex justify-between items-center mb-3">
          <b className="text-sm" style={{ color: activeTeam?.color }}>{activeTeam?.name || g.currentTeam?.toUpperCase()}</b>
          <span className="text-ok text-xs">Đã chọn {picked.length}/4 câu{hasPackage ? ` • gói ${PACKAGE_LABEL[pkg]}` : ""}</span>
        </div>
        <RulesToggle d={d} act={act} className="btn btn-ghost text-xs py-1! w-full mb-3" />

        <div className="grid gap-1.5">
          {Object.entries(PACKAGES).map(([total, structure]) => {
            const totalVal = Number(total);
            const isCurrent = hasPackage && pkg === totalVal;
            const st = teamPkgStatus[totalVal];
            const ready = !!st?.ok;
            const points = st?.points?.length ? st.points.map((p) => `${p}đ`).join(" · ") : "chưa gán câu";
            return (
              <button
                key={total}
                type="button"
                disabled={locked}
                onClick={() => selectPackage(totalVal)}
                className={`border px-3 py-2 text-xs text-left transition ${isCurrent
                    ? "border-ok bg-ok/10"
                    : "border-dashed border-line hover:border-gold/50"
                  }`}
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="text-base font-bold text-gold">Gói {totalVal}đ</span>
                  <span className={ready ? "text-ok" : "text-danger"}>
                    {ready ? `✓ ${structure.join(" + ")}` : `✗ ${st?.count || 0}/4 câu`}
                  </span>
                  {isCurrent && <span className="text-ok text-xs shrink-0">● ĐANG CHỌN</span>}
                </div>
                <div className="text-mist mt-1 flex items-center gap-2 flex-wrap">
                  <span className="text-xs">{points}</span>
                  {!ready && <span className="text-danger text-xs">Bổ sung trong mục Quản trị → Về đích</span>}
                </div>
              </button>
            );
          })}
        </div>

        {hasPackage && (
          <div className="grid gap-1 mt-3 pt-3 border-t border-line">
            {[0, 1, 2, 3].map((idx) => {
              const cand = picked[idx];
              const isCurrent = locked && idx === curIndex && cand;
              return (
                <div
                  key={idx}
                  className={`border px-3 py-2 text-xs flex justify-between items-center gap-2 ${isCurrent ? "border-gold bg-gold/10" : "border-line"
                    }`}
                >
                  <span>
                    <span className="text-gold font-bold">Câu {idx + 1}</span>{" "}
                    <span className="text-mist">
                      {cand ? `${cand.points} điểm` : "…"}
                    </span>
                  </span>
                  {isCurrent && <span className="text-gold text-xs shrink-0">● ĐANG HIỆN</span>}
                </div>
              );
            })}
          </div>
        )}

        {!locked && (
          <button
            type="button"
            className="btn btn-ghost text-xs py-1! mt-3"
            onClick={() => act("vedich.clear", { teamId: activeTeam?.id })}
          >
            Xóa hết (chọn lại gói)
          </button>
        )}
        <p className="text-mist text-xs mt-2">
          {Object.entries(teamPkgStatus).map(([total, st]) => (
            <span key={total} className="mr-2">
              Gói {total}đ {st?.ok ? "✓" : `✗ (${st?.count || 0}/4)`}
            </span>
          ))}
          <span>— {activeTeam?.name || g.currentTeam?.toUpperCase()}</span>
          {!Object.values(teamPkgStatus).some((s) => s?.ok) && (
            <span className="text-danger"> • chưa đủ gói, cần nhập Excel</span>
          )}
        </p>
      </section>

      {/* CÂU HỎI & ĐÁP ÁN */}
      <section className="py-4">
        <CurrentQuestionCard q={q} />
      </section>

      {/* ĐIỀU KHIỂN */}
      <section className="pt-4">
        {locked ? (
          <div className="flex flex-wrap gap-2 items-center">
            {phase === "ready" && (
              <div className="flex flex-wrap gap-2 items-center">
                <button type="button" className="btn btn-ok flex-1 min-w-[180px]" onClick={() => act("vedich.start")}>
                  Bắt đầu thi (3 • 2 • 1)
                </button>
                <button
                  type="button"
                  className={`btn ${star ? "btn-ok" : ""}`}
                  onClick={() => act("vedich.star", { star: !star })}
                >
                  Ngôi sao hy vọng {star ? "×2 (ON)" : "OFF"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => act("vedich.unlock")}>
                  Sửa lại
                </button>
              </div>
            )}
            {phase === "countdown" && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-gold font-display text-xl">Chuẩn bị thi — {remaining >= 0 ? remaining : 3}…</span>
                <button type="button" className="btn btn-ghost" onClick={() => act("vedich.unlock")}>Hủy</button>
              </div>
            )}
            {phase === "prep" && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={starUsed && !star}
                  className={`btn ${star ? "btn-ok" : ""}`}
                  onClick={() => act("vedich.star", { star: !star })}
                >
                  Ngôi sao hy vọng {star ? "×2 (ON)" : starUsed ? "(đã dùng)" : "OFF"}
                </button>
                <span className="text-mist text-xs flex-1">Câu {(curIndex || 0) + 1} đã sẵn sàng — chọn sao (nếu muốn) rồi trình câu hỏi cho đội {activeTeam?.name}.</span>
                <button type="button" className="btn btn-ok px-3!" onClick={() => act("question.show")}>
                  Hiện câu hỏi
                </button>
              </div>
            )}
            {phase === "answering" && (
              <div className="flex flex-wrap items-center gap-2">
                {!running && remaining > 0 && !revealed && !stealOpen && (
                  <>
                    <span className="text-mist text-xs flex-1">
                      Đã hiện câu hỏi — MC đọc xong rồi bắt đầu tính giờ
                    </span>
                    <button type="button" className="btn btn-ok px-3!" onClick={() => act("vedich.startAnswer")}>
                      Bắt đầu tính giờ ({remaining}s)
                    </button>
                  </>
                )}
                {(running || remaining > 0) && (
                  <span className="text-gold text-sm font-display">
                    {running ? `⏱ Đang trả lời… ${remaining >= 0 ? remaining : "–"}s` : `⏱ Sẵn sàng — ${remaining}s`}
                  </span>
                )}
                {!running && remaining <= 0 && !revealed && !stealOpen && (
                  <>
                    <span className="text-mist text-xs flex-1">
                      {activeTeam?.name} hết giờ — chấm kết quả
                    </span>
                    <button type="button" className="btn btn-danger px-3!" onClick={() => act("answer.mark", { correct: false })}>
                      Sai
                    </button>
                    <button type="button" className="btn btn-ok px-3!" onClick={() => act("answer.mark", { correct: true })}>
                      Đúng +{pts}
                    </button>
                  </>
                )}
                {!running && remaining <= 0 && !revealed && stealOpen && !winner && (
                  <>
                    <span className="text-mist text-xs flex-1">Cửa sổ cướp quyền — chờ đội bấm chuông</span>
                    <button type="button" className="btn btn-ok px-3!" onClick={() => act("vedich.revealAnswer")}>
                      Hiện đáp án
                    </button>
                  </>
                )}
                {!revealed && stealOpen && winner && (
                  <>
                    <span className="text-mist text-xs flex-1">Đội {winner} giành chuông trả lời</span>
                    <button type="button" className="btn btn-danger px-3!" onClick={() => act("answer.mark", { correct: false })}>
                      Sai −{stealWrongPts}
                    </button>
                    <button type="button" className="btn btn-ok px-3!" onClick={() => act("answer.mark", { correct: true })}>
                      Đúng +{stealCorrectPts}
                    </button>
                  </>
                )}
                {revealed && (
                  <button type="button" className="btn px-3!" onClick={() => act("question.next")}>
                    Câu tiếp →
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              disabled={!hasPackage || picked.length < 4}
              className="btn btn-ok flex-1 min-w-[180px]"
              onClick={() => act("vedich.lock")}
            >
              {hasPackage ? `Xác nhận bộ câu (gói ${PACKAGE_LABEL[pkg]}, ${picked.length}/4)` : "Chọn gói để chốt"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}