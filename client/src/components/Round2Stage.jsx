import { Fragment } from "react";
import { isOpen, isLocked } from "../lib/cnv.js";
import { activeTeamIds } from "../lib/teams.js";

// Khung ô chữ Vòng 2: bên trái các hàng ngang (ô chữ tròn), bên phải số mảnh ghép dọc.
// Dùng chung cho màn hình Khán giả và Thí sinh.
// Thiết kế chỉ HÌNH 4 câu hỏi đầu: hàng ngang thứ 5 (index 4) VẪN GIỮ trong dữ liệu/vòng
// chơi nhưng KHÔNG hiển thị (slice 0..4) — MC vẫn thấy/điều khiển đủ 5 qua màn hình riêng.
export function CnvRowsFrame({ state, g }) {
  const p = g.puzzle || {};
  const cnv = state.cnv;
  return (
    <div className="grid grid-cols-[auto_2.5rem] gap-x-4 gap-y-2.5 w-fit mx-auto">
      {(cnv?.rows || []).slice(0, 4).map((row, i) => (
        <Fragment key={i}>
          <div className="flex gap-1.5 self-center">
            {row.status === "open"
              ? row.word.replace(/\s/g, "").split("").map((ch, j) => (
                  <span key={j} className="ltr ltr-open">{ch}</span>
                ))
              : row.status === "locked"
                ? Array.from({ length: row.letterCount }, (_, j) => (
                    <span key={j} className="ltr ltr-locked">✕</span>
                  ))
                : Array.from({ length: row.letterCount }, (_, j) => (
                    <span key={j} className={`ltr ${i === p.currentRow ? "r2-current" : ""}`} />
                  ))}
          </div>
          <span className="text-sm w-10 justify-self-start font-display font-bold tabular-nums text-gold self-center">
            {i + 1}
          </span>
        </Fragment>
      ))}
    </div>
  );
}

// MÀN KẾT QUẢ TRẢ LỜI — Vòng 2: luôn hiện đủ các đội đang thi (top 4). Mỗi đội 1 hàng,
// không bọc trong border; đội đã nộp hiện đáp án + thời gian nộp, đội chưa nộp để trống.
// Không còn duyệt qua revealedRows — MC mở màn này là thấy hết luôn.
export function RowResults({ state, g }) {
  const p = g.puzzle || {};
  const teams = state.teams || [];
  const active = activeTeamIds(g, teams);
  const subs = p.submissions || {};
  const corr = p.corrections || {};
  const cards = active.map((id) => {
    const t = teams.find((x) => x.id === id);
    const s = subs[id];
    return {
      teamId: id,
      team: t,
      answer: s?.answer,
      elapsed: s?.elapsed,
      ok: corr[id] === true,
      ng: corr[id] === false,
    };
  });

  return (
    <div className="w-full max-w-[1100px] mx-auto">
      <div className="kicker text-center mb-6">
        KẾT QUẢ TRẢ LỜI — HÀNG {p.currentRow + 1}
      </div>
      <div className="mx-auto w-[min(900px,94%)]">
        {cards.map((c, i) => (
          <div key={c.teamId} className="r2-row-in" style={{ animationDelay: `${i * 280}ms` }}>
            <StaggeredRow team={c.team} index={i} answer={c.answer} elapsed={c.elapsed} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Hàng ô đội theo thiết kế so le: ● (ô trống phía cạnh ngắn) + tên đội + đáp án + thời gian.
// Dấu ● biểu thị ô TRỐNG — hiện mờ/đậm tùy đội sáng/tối, vị trí so lệch trái-phải theo index.
export function StaggeredRow({ team, index, answer, elapsed, resultLabel /* unused */ }) {
  const left = index % 2 === 0;
  const answered = !!answer && answer !== "";
  return (
    <div className="flex items-center px-4 py-3.5 justify-center">
      <div
        className={`flex items-center gap-4 ${left ? "pr-10 pl-2" : "pl-10 pr-2"} w-full max-w-xl`}
      >
        <span
          className={`text-[clamp(14px,1.6vw,20px)] ${answered ? "" : "text-mist/40"}`}
          aria-hidden
        >
          ●
        </span>
        <span
          className="w-40 shrink-0 font-bold text-[clamp(16px,1.6vw,22px)] truncate"
          style={{ color: team?.color }}
        >
          {team?.name || ""}
        </span>
        <span
          className={`flex-1 text-center font-semibold text-[clamp(15px,1.8vw,22px)] leading-snug px-2 ${
            answered ? "text-white" : "text-mist/40"
          }`}
        >
          {answered ? `“${answer}”` : "—"}
        </span>
        <span className="w-24 shrink-0 text-right text-mist font-mono tabular-nums text-sm">
          {answered && elapsed != null ? elapsed.toFixed(2) + "s" : ""}
        </span>
      </div>
    </div>
  );
}

// MÀN CÂU HỎI — Vòng 2: khung hàng ngang + câu hỏi/ảnh hiện tại. Nhận children để chèn
// ô nhập đáp án của thí sinh.
export function Round2Question({ state, d, g, children }) {
  const p = g.puzzle || {};
  const cnv = state.cnv || {};
  const question = cnv.question || d.question || "";
  return (
    <div className="w-full max-w-[1200px] min-h-[60vh] mx-auto text-center flex flex-col items-center justify-center">
      <div className="r2-rows mb-6 rounded-2xl border border-[rgba(255,214,10,0.28)] px-6 py-4">
        <CnvRowsFrame state={state} g={g} />
      </div>
      {d.mediaUrl && d.mediaType === "image" && (
        <img src={d.mediaUrl} alt="" className="max-h-[30vh] mx-auto rounded-2xl object-contain border border-line shadow-[0_10px_40px_rgba(0,0,0,0.4)]" />
      )}
      {d.mediaUrl && d.mediaType === "video" && (
        <video src={d.mediaUrl} autoPlay controls className="max-h-[30vh] mx-auto rounded-2xl" />
      )}
      {question && <div className="stage-q mt-4">{question}</div>}
      {d.note && <div className="stage-note">{d.note}</div>}
      {d.answerRevealed && <div className="stage-answer mt-3">Đáp án: {d.answer}</div>}
      {children}
    </div>
  );
}

// MÀN BẢNG MẢNH GHÉP — Vòng 2: bộ 5 mảnh (4 góc + ô trung tâm) ghép thành 1 bức ảnh.
// Prop `minimal` (màn hình thí sinh): ẩn các khung thông báo hiệu ứng (ĐÚNG!/SAI,
// "đang chờ", "đang giành quyền") — chỉ giữ bảng mảnh ghép.
export function Round2Board({ state, g, minimal }) {
  const p = g.puzzle || {};
  const cnv = state.cnv;
  const solved = [0, 1, 2, 3, 4].map((i) => isOpen(p, i));
  const locked = [0, 1, 2, 3, 4].map((i) => isLocked(p, i));
  const media = cnv?.media;
  return (
    <div className="relative w-full max-w-[1200px] min-h-[60vh] mx-auto flex flex-col items-center justify-center">
      {!minimal && p.keywordClaim && !p.keywordSolved && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 z-30">
          <div className="animate-pulse rounded-lg border-2 border-red-500 bg-red-600/90 px-3 py-2 text-center">
            <div className="font-display font-black text-[clamp(20px,2.2vw,34px)] leading-none text-white">
              {state.teams.find((t) => t.id === p.keywordClaim)?.name}
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="relative w-[clamp(300px,40vw,680px)] aspect-[16/10] rounded-2xl overflow-hidden ring-1 ring-line bg-night">
          {media?.url && media.type !== "video" && (
            <img src={media.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
            {[0, 1, 2, 3].map((r) => (
              <div
                key={r}
                className={`relative flex ${r % 2 === 0 ? "justify-start" : "justify-end"} ${r < 2 ? "items-start" : "items-end"} font-display font-black text-[clamp(26px,3.4vw,52px)] tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] transition-colors ${
                  solved[r]
                    ? (media?.url && media.type !== "video")
                      ? "pointer-events-none"
                      : "bg-gold/90 text-[#1a1400]"
                    : locked[r]
                      ? "bg-black pointer-events-none"
                      : "bg-[#0e1830] text-mist"
                }`}
              >
                {locked[r] ? (
                  ""
                ) : solved[r] && media?.url && media.type !== "video" ? (
                  ""
                ) : (
                  <span className={`px-3 ${r < 2 ? "pt-2" : "pb-2"}`}>{r + 1}</span>
                )}
              </div>
            ))}
          </div>
          {/* Mảnh trung tâm (hàng 5) — thiết kế y hệt màn MC: ô đen bo viền, số 5 ở giữa.
              Mở mảnh → lộ ảnh gốc (hoặc hiện vàng nếu vòng không có ảnh); khóa → ô đen. */}
          <div
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[52%] h-[60%] rounded-xl border-2 grid place-items-center font-display font-black text-[clamp(26px,3.4vw,52px)] tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] transition ${
              solved[4]
                ? media?.url && media.type !== "video"
                  ? "border-transparent"
                  : "bg-gold text-[#1a1400] border-gold shadow-[0_0_26px_rgba(255,214,10,0.45)]"
                : locked[4]
                  ? "bg-black border-transparent"
                  : "bg-[#0e1830] text-mist border-line"
            }`}
          >
            {locked[4] ? "" : solved[4] && media?.url && media.type !== "video" ? "" : 5}
          </div>
        </div>
      </div>
    </div>
  );
}
