import CurrentQuestionCard from "./CurrentQuestionCard.jsx";
import RulesToggle from "../../components/RulesToggle.jsx";

const PACKAGES = {
  60: [10, 10, 20, 20],
  80: [10, 20, 20, 30],
  100: [20, 20, 30, 30],
};

const ANSWER_SECONDS = { 10: 30, 20: 45, 30: 60 };

export default function RoundVeDich({ ctx }) {
  const { g, state, act, remaining, q, pts, revealed, running, d } = ctx;
  if (g.round !== "ve_dich") return null;

  const activeTeam = state.teams.find((t) => t.id === g.currentTeam);
  // Ngân hàng câu CHUNG — không gắn đội.
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
  // Điểm team giành chuông NHẬN khi cướp quyền (khớp server calculateAnswerScore):
  //   - Đúng: +P, NSHV +2P; hết giờ mở chuông (không có stealPending) chỉ +P.
  //   - Sai: luôn −P (không nhân đôi).
  const stealCorrectPts = stealOpen && !pending ? base : (pending?.star ? pending.base * 2 : pending.base);
  const stealWrongPts = pending ? pending.base : base;
  const pkg = g.veDich?.packagePoints;
  const hasPackage = pkg === 60 || pkg === 80 || pkg === 100;
  const bankCounts = [10, 20, 30].map((lv) => bank.filter((x) => Number(x.points) === lv).length);

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
            return (
              <button
                key={total}
                type="button"
                disabled={locked}
                onClick={() => selectPackage(totalVal)}
                className={`border px-3 py-2 text-xs text-left transition ${
                  isCurrent
                    ? "border-ok bg-ok/10"
                    : "border-dashed border-line hover:border-gold/50"
                }`}
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="text-base font-bold text-gold">Gói {totalVal}đ</span>
                  <span className={isCurrent ? "text-ok" : "text-mist"}>
                    {structure.join(" + ")} điểm
                  </span>
                  {isCurrent && <span className="text-ok text-xs shrink-0">● ĐANG CHỌN</span>}
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
                  className={`border px-3 py-2 text-xs flex justify-between items-center gap-2 ${
                    isCurrent ? "border-gold bg-gold/10" : "border-line"
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
          Ngân hàng chung: {bankCounts[0]} câu 10đ • {bankCounts[1]} câu 20đ • {bankCounts[2]} câu 30đ
          {g.veDich?.usedQuestionIds?.length ? ` • đã dùng ${g.veDich.usedQuestionIds.length} câu` : ""}
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
                <span className="text-mist text-xs flex-1">
                  {stealOpen ? `Cửa sổ cướp quyền — ${winner ? "đội giành chuông trả lời" : "chờ đội bấm chuông"}` : `${activeTeam?.name} (${g.currentTeam?.toUpperCase()}) trả lời`}
                </span>
                {!revealed && !stealOpen && !running && (
                  <button type="button" className="btn btn-ok px-3!" onClick={() => act("vedich.startAnswer")}>
                    ▶ Bắt đầu tính giờ ({ANSWER_SECONDS[q?.points] ?? 30}s)
                  </button>
                )}
                {revealed && (
                  <button type="button" className="btn px-3!" onClick={() => act("question.next")}>
                    Câu tiếp →
                  </button>
                )}
                {!revealed && !stealOpen && (
                  <>
                    <button type="button" className="btn btn-danger px-3!" onClick={() => act("answer.mark", { correct: false })}>
                      Sai → mở cướp
                    </button>
                    <button type="button" className="btn btn-ok px-3!" onClick={() => act("answer.mark", { correct: true })}>
                      Đúng +{pts}
                    </button>
                  </>
                )}
                {!revealed && stealOpen && !winner && (
                  <button type="button" className="btn btn-ghost px-3!" onClick={() => act("answer.mark", { correct: false })}>
                    Không ai trả lời → chốt đáp án
                  </button>
                )}
                {!revealed && stealOpen && winner && (
                  <>
                    <button type="button" className="btn btn-danger px-3!" onClick={() => act("answer.mark", { correct: false })}>
                      Sai −{stealWrongPts}
                    </button>
                    <button type="button" className="btn btn-ok px-3!" onClick={() => act("answer.mark", { correct: true })}>
                      Đúng +{stealCorrectPts}
                    </button>
                  </>
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