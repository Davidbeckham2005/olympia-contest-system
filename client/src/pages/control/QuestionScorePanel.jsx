import { formatTime } from "../../lib/format.js";

export default function QuestionScorePanel({ ctx }) {
  const { isKd, q, d, revealed, showing, pts, act, g, remaining, running } = ctx;
  const kdIdle = isKd && g?.questionStatus === "idle";
  const fallbackImg = isKd
    ? `https://picsum.photos/seed/${g?.currentTeam}-${(g?.khoiDong?.memberIndex ?? 0) + 1}-${(g?.questionIndex || 0) + 1}/800/600`
    : "";
  return (
    <>
      {/* CÂU HỎI & ĐÁP ÁN */}
      <div className={`panel !rounded-2xl !shadow-[0_10px_40px_rgba(0,0,0,0.45)] ${isKd ? "!bg-[#0e1830]/60 !border-[rgba(255,214,10,0.18)]" : ""}`}>
        {!isKd && (
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="kicker text-xs tracking-[0.18em] uppercase">Câu hỏi &amp; đáp án</div>
          </div>
        )}
        {kdIdle && (
          <div className="text-mist">Chuyển đội để bắt đầu lượt.</div>
        )}
        {!q && !kdIdle && (
          <div className="text-mist">
            {isKd
              ? "Chuyển đội để bắt đầu lượt."
              : g.round === "ve_dich"
                ? "Chưa có câu nào được chọn — hãy chọn mức 20/30/40 cho đội đang thi ở panel bên dưới."
                : "Chưa có câu hỏi — chọn hàng ngang (Vượt CNV) hoặc bấm Câu sau."}
          </div>
        )}
        {q && !isKd && (
          <>
            {q.mediaUrl && <img src={q.mediaUrl} className="max-h-[150px] mx-auto rounded-lg mb-2" />}
            <div className="font-display text-xl leading-snug">{q.question}</div>
            <div
              className={`mt-2 rounded-lg border border-line bg-night/60 px-3 py-2 ${
                revealed ? "text-ok font-semibold" : "tracking-[0.3em] text-mist"
              }`}
            >
              Đáp án: {revealed ? q.answer : "••••••"} • {pts} điểm
              {!!q.letterCount && <span className="text-mist tracking-normal"> • {q.letterCount} chữ cái</span>}
            </div>
          </>
        )}
        {q && isKd && !kdIdle && (
          <div className="flex flex-col items-stretch gap-2">
            <span className={`self-center inline-flex items-center justify-center rounded-xl border border-[rgba(255,214,10,0.45)] bg-[#0e1830]/70 px-4 py-0.5 timer-xl text-2xl ${remaining <= 5 && running ? "timer-danger" : "text-gold"}`}>
              {formatTime(remaining)}
            </span>
            <div className="font-display text-base leading-snug text-white text-center">{q.answer}</div>
            <div className="flex-1 min-w-0">
              <div className="w-full max-h-[240px] rounded-xl bg-[#0e1830] overflow-hidden grid place-items-center">
                <img src={q.mediaUrl || fallbackImg} className="w-full h-full max-h-[240px] object-contain" />
              </div>
            </div>
          </div>
        )}
        {!isKd && !(g.round === "ve_dich" && !q) && (
          <>
            <div className="flex flex-wrap gap-2 mt-4">
              <button type="button" className="btn" disabled={showing && !revealed} onClick={() => act("question.show")}>
                Hiện câu hỏi
              </button>
              <button type="button" className="btn btn-ghost" disabled={!showing} onClick={() => act("question.hide")}>
                Ẩn câu hỏi
              </button>
              <button type="button" className="btn btn-ok" disabled={!showing || revealed} onClick={() => act("question.reveal")}>
                Lật đáp án
              </button>
              <button type="button" className="btn btn-ghost" disabled={!showing || !revealed} onClick={() => act("question.hideAnswer")}>
                Che đáp án
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => act("question.prev")}>← Câu trước</button>
              <button type="button" className="btn btn-ghost" onClick={() => act("question.next")}>Câu sau →</button>
            </div>
            <div className="text-mist text-xs mt-2.5">
              Trình tự: Chọn câu → Hiện câu hỏi → Lật đáp án → Chấm điểm. "Ẩn câu hỏi" đưa màn hình về bảng.
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function KdScorePanel({ ctx }) {
  const { isKd, q, saiText, act, cnvRowPhase, g, pts } = ctx;
  const ttscoring = g?.round === "tang_toc";
  const mi = g?.khoiDong?.memberIndex ?? 0;
  const kdCurMark = isKd ? g?.khoiDong?.history?.[g.currentTeam]?.[mi]?.[g.questionIndex] : undefined;
  const alreadyScored = isKd && typeof kdCurMark === "boolean";
  // Round 2 chấm theo bảng "Bài nộp tự luận" riêng (trong RoundVuotCnv) — ẩn nút chấm chung này.
  // Round 1 khi chưa chiếu ảnh nào (chưa Bắt đầu / đang nghỉ) cũng không cho chấm.
  if (isKd && g?.questionStatus === "idle") return null;
  if (ttscoring || g?.round === "vuot_cnv" || g.round === "ve_dich") return null;
  return (
    <div className="px-3 py-2.5">
      <div className="flex gap-2 w-[70%] mx-auto">
        <button type="button" className="btn btn-ok !rounded-none flex-1" disabled={!q || alreadyScored} onClick={() => act("answer.mark", { correct: true })}>
          ĐÚNG +{pts}{cnvRowPhase ? " • mở mảnh" : ""}
        </button>
        <button type="button" className="btn btn-danger !rounded-none flex-1" disabled={!q || alreadyScored} onClick={() => act("answer.mark", { correct: false })}>
          SAI {saiText !== "không trừ" ? `• ${saiText}` : ""}
        </button>
      </div>
    </div>
  );
}