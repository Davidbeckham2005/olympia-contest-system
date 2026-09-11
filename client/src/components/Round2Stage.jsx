import { Fragment } from "react";
import { isOpen, isLocked } from "../lib/cnv.js";
import { activeTeamIds } from "../lib/teams.js";
import { optimizeVideoUrl } from "../lib/media.js";

// Khung ô chữ Vòng 2: bên trái các hàng ngang (ô chữ tròn), bên phải số mảnh ghép dọc.
// Dùng chung cho màn hình Khán giả và Thí sinh.
// Vòng có ĐÚNG 4 câu hỏi HÀNG NGANG (mở 4 mảnh góc). Vị trí index 4 là CÂU HỎI MẢNH
// GHÉP TRUNG TÂM — một câu hỏi cuối RIÊNG để mở mảnh giữa, KHÔNG phải hàng ngang thứ 5
// nên KHÔNG hiển thị ô chữ/số ký tự ở đây (slice 0..4); MC mở nó qua khối riêng.
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

// Header ngữ cảnh Vòng 2 cho các màn sân khấu (khán giả + thí sinh): luôn cho biết rõ
// "Vòng 2", câu/hàng đang thi (X/5) và trạng thái nhận bài (đang nhận / đã đóng / đã
// chốt / sẵn sàng / cửa sổ từ khóa) — người xem không phải tự suy từ ô chữ. Kèm thẻ đỏ
// đội đang GIỮ QUYỀN đoán TỪ KHÓA (persistent — không chỉ thoáng qua như hiệu ứng chuông).
function Round2Context({ g, state, title, showStatus = true }) {
  const p = g.puzzle || {};
  const idx = p.currentRow ?? 0;
  // Index 4 = CÂU HỎI MẢNH GHÉP TRUNG TÂM (câu hỏi cuối) — không phải "hàng 5".
  const isCenter = idx === 4;
  const row = idx + 1;
  const submitted = Object.keys(p.submissions || {}).length;
  const hasRow = p.rowPhase === "open" || p.rowPhase === "scored" || (p.rowPhase === "closed" && submitted > 0);
  const claim = !p.keywordSolved ? p.keywordClaim : null;
  const claimTeam = claim ? (state?.teams || []).find((t) => t.id === claim) : null;

  let status = "SẴN SÀNG";
  let tone = "";
  if (p.keywordSolved) {
    status = "ĐÃ GIẢI TỪ KHÓA";
    tone = "ok";
  } else if (p.rowPhase === "open") {
    status = g.timer?.running ? "ĐANG NHẬN BÀI" : "MỞ CÂU HỎI — CHỜ GIỜ";
    tone = "warn";
  } else if (p.rowPhase === "scored") {
    status = "ĐÃ CHỐT ĐIỂM";
    tone = "ok";
  } else if (p.rowPhase === "closed" && submitted > 0) {
    status = "ĐÃ ĐÓNG NHẬN BÀI — ĐANG CHẤM";
    tone = "warn";
  }
  const keywordPhase = p.keywordWindow && !p.keywordSolved && p.rowPhase !== "open";

  return (
    <div className="mb-6 text-center flex flex-col items-center gap-2">
      <div className="kicker tracking-[0.28em]">VÒNG 2 · VƯỢT CHƯỚNG NGẠI VẬT</div>
      {showStatus && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {hasRow && (isCenter
            ? <span className="badge badge-warn">CÂU HỎI MẢNH GHÉP TRUNG TÂM</span>
            : <span className="badge">HÀNG {row}/4</span>
          )}
          <span className={`badge ${tone}`}>{status}</span>
          {keywordPhase && <span className="badge badge-warn">ĐOÁN TỪ KHÓA</span>}
        </div>
      )}
      {claim && (
        <div className="flex items-center gap-2 rounded-full border border-[#ff465e]/70 bg-[#ff465e]/15 px-3.5 py-1">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: claimTeam?.color || "#fff" }} />
          <span className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#ffb3c1]">
            Giữ quyền đoán từ khóa
          </span>
          <span className="font-display font-black text-[clamp(15px,1.8vw,24px)] leading-none text-white">
            {claimTeam?.name || ""}
          </span>
        </div>
      )}
      {title && (
        <div className="text-xs font-semibold tracking-[0.2em] uppercase text-mist">{title}</div>
      )}
    </div>
  );
}

// MÀN KẾT QUẢ TRẢ LỜI — Vòng 2: luôn hiện đủ các đội đang thi (top 4). Mỗi đội 1 hàng,
// không bọc trong border. AN TOÀN: chỉ hiện đáp án sau khi giai đoạn đã đóng nhận bài
// (rowPhase closed/scored) — xong là HIỂN THỊ TOÀN BỘ bài nộp + điểm luôn (không mở
// dần). Trong lúc còn nhận bài (open) màn này chỉ hiện khung trống — phòng MC bấm nhầm
// sang "Đáp án" khi các đội vẫn đang nộp (lộ đáp án đối thủ).
export function RowResults({ state, g }) {
  const p = g.puzzle || {};
  const teams = state.teams || [];
  const active = activeTeamIds(g, teams);
  const subs = p.submissions || {};
  const corr = p.corrections || {};
  const ranked = p.ranked || [];
  const canReveal = p.rowPhase === "closed" || p.rowPhase === "scored";
  // Màn Đáp án LUÔN hiện đầy đủ đáp án từng thí sinh ngay khi đóng/đã chốt nhận bài
  // (không còn mở dần theo revealedRows) — khán giả thấy toàn bộ bài nộp + điểm.
  const revealed = canReveal ? Object.keys(subs).length : 0;
  // Thứ tự hiển thị bài nộp theo độ nhanh: nộp nhanh nhất đứng trước.
  const revealedIds = Object.entries(subs)
    .sort((a, b) => (a[1].elapsed ?? Infinity) - (b[1].elapsed ?? Infinity))
    .slice(0, revealed)
    .map(([id]) => id);
  // Nhãn màn kết quả theo loại câu hỏi đang xử lý (4 hàng ngang / câu hỏi cuối mảnh giữa).
  const isCenter = (p.currentRow ?? 0) === 4;
  const title = isCenter ? "KẾT QUẢ CÂU HỎI CUỐI" : `KẾT QUẢ HÀNG NGANG ${(p.currentRow ?? 0) + 1}`;
  const cards = active.map((id) => {
    const t = teams.find((x) => x.id === id);
    const s = subs[id];
    const shown = revealedIds.includes(id);
    const rank = ranked.find((r) => r.teamId === id);
    return {
      teamId: id,
      team: t,
      submitted: !!s,
      answer: shown ? s?.answer : null,
      elapsed: shown ? s?.elapsed : null,
      ok: corr[id] === true,
      ng: corr[id] === false,
      pts: rank?.points ?? 0,
      revealed: shown,
    };
  });

  return (
    <div className="w-full max-w-[1100px] mx-auto">
      <Round2Context g={g} state={state} title={title} showStatus={false} />
      {p.rowPhase === "scored" && p.lastResult && (
        <ResultBanner lastResult={p.lastResult} />
      )}
      <R2AnswersTimeline cards={cards} />
    </div>
  );
}

// Định dạng thời gian trả lời kiểu game show: "01.28s" — phần giây + phần lẻ 2 chữ số
// (font mono, màu mờ) để khán giả dễ so sánh tốc độ.
function formatAnswerTime(sec) {
  if (sec == null) return null;
  let s = Math.floor(sec);
  let cs = Math.round((sec - s) * 100);
  if (cs === 100) {
    s += 1;
    cs = 0;
  }
  return { ss: String(s).padStart(2, "0"), cs: String(cs).padStart(2, "0") };
}

// MÀN ĐÁP ÁN VÒNG 2 — thiết kế game show kiểu timeline dọc: khung giữa màn hình có viền
// trắng mảnh, nền navy-có-chiều-sâu với bokeh blur; ở trung tâm một đường kết nối màu nâu
// đồng/vàng tối chạy dọc. Đáp án/người chơi là các THANH NGANG đặt XEN KẼ trái/phải đường
// dọc, nối bằng node tròn xanh sáng viền vàng. Các thanh xuất hiện lần lượt từ trên xuống.
function R2AnswersTimeline({ cards }) {
  return (
    <div className="relative mx-auto w-[min(820px,95%)] rounded-[1.25rem] border border-white/10 bg-panel-solid px-4 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      {/* Đường timeline dọc — mảnh 1px, vàng nhạt */}
      <div className="absolute left-1/2 top-6 bottom-6 w-px -translate-x-1/2 bg-[rgba(255,214,10,0.28)]" aria-hidden />
      {/* Các thanh ngang xen kẽ trái/phải đường dọc */}
      <div className="relative flex flex-col py-5">
        {cards.map((c, i) => (
          <R2TimelineRow key={c.teamId} c={c} i={i} />
        ))}
      </div>
    </div>
  );
}

// Một mốc trên timeline: node tròn nhỏ (điểm nối với đường dọc) + thanh ngang xen kẽ
// trái/phải. Hai nửa cùng độ rộng (flex-1) nên căn luôn đối xứng quanh đường trung tâm.
function R2TimelineRow({ c, i }) {
  const left = i % 2 === 0;
  return (
    <div className="r2-row-in relative flex min-h-[76px] items-center" style={{ animationDelay: `${i * 220}ms` }}>
      {/* Node nối đường timeline — xanh nhạt viền vàng, chỉ phát sáng khi đúng */}
      <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <span
          className={`block h-[11px] w-[11px] rounded-full border ${
            c.ok
              ? "border-gold bg-ok shadow-[0_0_8px_rgba(128,237,153,0.5)]"
              : "border-[rgba(255,214,10,0.35)] bg-[#31415f]"
          }`}
        />
      </span>
      {left ? (
        <>
          <div className="flex min-w-0 flex-1 justify-end pr-8">
            <R2TimelineBar c={c} />
          </div>
          <span className="flex-1" aria-hidden />
        </>
      ) : (
        <>
          <span className="flex-1" aria-hidden />
          <div className="flex min-w-0 flex-1 justify-start pl-8">
            <R2TimelineBar c={c} />
          </div>
        </>
      )}
    </div>
  );
}

// Thanh thông tin một người chơi: tên đội + đáp án bên trái, thời gian trả lời đến mili
// giây (giây cỡ lớn trắng, phần lẻ nhỏ mờ) bên phải. Chỉ nhấn mạnh bằng viền vàng + glow
// xanh nhạt khi ĐÚNG — các trạng thái còn lại màu trung tính, không thêm màu rực.
function R2TimelineBar({ c }) {
  const { team, submitted, answer, elapsed, ok, ng, pts, revealed } = c;
  const answered = revealed && !!answer && answer !== "";
  const time = answered && elapsed != null ? formatAnswerTime(elapsed) : null;

  let status;
  if (!submitted) {
    status = <span className="text-mist/55">Không nộp bài</span>;
  } else if (!revealed) {
    status = <span className="text-mist">Đã nộp</span>;
  } else if (ok) {
    status = <span className="text-white">“{answer}”</span>;
  } else if (ng) {
    status = <span className="text-[#ffb3c1]">“{answer}”</span>;
  } else {
    status = <span className="text-white/85">“{answer}”</span>;
  }

  const frame = ok
    ? "border-gold/70 bg-[#121b33] r2-tl-glow"
    : ng
      ? "border-[rgba(255,77,109,0.35)] bg-[#131024]"
      : submitted
        ? "border-line bg-[#121b33]"
        : "border-white/10 bg-[#0d1424]/80";

  return (
    <div className="w-full max-w-[460px]">
      <div className={`rounded-xl border px-4 py-2.5 ${frame}`}>
        <div className="flex items-baseline gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[clamp(12px,1.3vw,16px)] font-bold leading-tight text-white">
                {team?.name || ""}
              </span>
              {ok && pts > 0 && (
                <span className="shrink-0 text-[clamp(12px,1.3vw,15px)] font-bold text-gold">+{pts}đ</span>
              )}
            </div>
            <div className="mt-0.5 truncate text-[clamp(13px,1.5vw,18px)] leading-snug">{status}</div>
          </div>
          {time ? (
            <span className="shrink-0 whitespace-nowrap font-mono tabular-nums">
              <span className="text-[clamp(14px,1.5vw,18px)] font-bold leading-tight text-white">{time.ss}</span>
              <span className="text-[clamp(9px,1vw,11px)] font-semibold text-mist">.{time.cs}s</span>
            </span>
          ) : (
            <span className="shrink-0 text-sm text-white/25">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Hàng ô đội theo thiết kế so le: ● (ô trống phía cạnh ngắn) + tên đội + đáp án + thời gian.
// Dấu ● biểu thị ô TRỐNG — hiện mờ/đậm tùy đội sáng/tối, vị trí so lệch trái-phải theo index.
// Màn kết quả Vòng 2 truyền thêm trạng thái: chưa nộp → "Không nộp bài"; đã nộp chưa lật →
// "? · Đã nộp"; đã lật + chấm Đúng → viền vàng + "+Xđ"; chấm Sai → viền đỏ + "0đ".
// Các màn khác (vd Tăng tốc) không truyền → giữ hành vi cũ (đáp án / "—").
export function StaggeredRow({ team, index, answer, elapsed, resultLabel /* unused */, submitted, ok, ng, pts, revealed }) {
  const left = index % 2 === 0;
  // isR2: màn kết quả Vòng 2 truyền "revealed" (boolean) — bật các trạng thái chuyên biệt.
  const isR2 = typeof revealed === "boolean";
  const answered = isR2 ? revealed && !!answer && answer !== "" : !!answer && answer !== "";
  let center;
  let right;
  let tone = "";
  if (isR2 && !submitted) {
    center = <span className="text-[#ffb3c1]/75">Không nộp bài</span>;
    right = <span className="text-[#ffb3c1]/60">✕</span>;
    tone = "ring-1 ring-[#ff465e]/20 bg-[#ff465e]/5";
  } else if (isR2 && !revealed) {
    center = <span className="text-white/45">? <span className="text-white/30">·</span> Đã nộp</span>;
    right = <span className="text-ok">✓</span>;
    tone = "";
  } else if (isR2 && ok) {
    center = <span className="text-gold">“{answer}”</span>;
    right = <span className="font-bold text-ok">+{pts}đ</span>;
    tone = "ring-1 ring-[#ffd60a]/45 bg-[#ffd60a]/12";
  } else if (isR2 && ng) {
    center = <span className="text-[#ff8fa3]">“{answer}”</span>;
    right = <span className="font-bold text-[#ff8fa3]">0đ</span>;
    tone = "ring-1 ring-[#ff465e]/35 bg-[#ff465e]/10";
  } else {
    center = answered ? `“${answer}”` : "—";
    right = answered && elapsed != null ? elapsed.toFixed(2) + "s" : "";
  }
  return (
    <div className="flex items-center px-4 py-3.5 justify-center">
      <div
        className={`flex items-center gap-4 ${left ? "pr-10 pl-2" : "pl-10 pr-2"} w-full max-w-xl rounded-xl py-2.5 transition ${tone}`}
      >
        <span
          className={`text-[clamp(14px,1.6vw,20px)] ${answered ? "" : "text-mist/40"}`}
          aria-hidden
        >
          ●
        </span>
        <span
          className="w-40 shrink-0 font-bold text-[clamp(16px,1.6vw,22px)] truncate"
          style={{ color: team?.color || "#fff" }}
        >
          {team?.name || ""}
        </span>
        <span
          className={`flex-1 text-center font-semibold text-[clamp(15px,1.8vw,22px)] leading-snug px-2 ${
            answered ? "" : "text-mist/40"
          }`}
        >
          {center}
        </span>
        <span className="w-24 shrink-0 text-right text-mist font-mono tabular-nums text-sm">
          {right}
        </span>
      </div>
    </div>
  );
}

// DẢI CÂU HỎI — Vòng 2 (thiết kế tham khảo Round4Footer của Vòng 4): hiện câu hỏi/note/
// đáp án thành dải ngang gọn ĐẶT DƯỚI THANH TÊN ĐỘI trên màn khán giả, vùng chính ở giữa
// chỉ giữ khung ô chữ + ảnh. `children` (vd ô nhập đáp án thí sinh) được chèn dưới đáp án.
export function Round2QuestionStrip({ state, d, g, children }) {
  const p = g.puzzle || {};
  const cnv = state.cnv || {};
  const question = cnv.question || d.question || "";
  if (!(question || d.note || d.answerRevealed || children)) return null;
  return (
    <div className="border-t border-[rgba(255,214,10,0.15)] flex items-stretch">
      <div className="flex-1 min-w-0 px-5 py-4 flex items-center justify-center">
        <div className="w-full">
          {question && (
            <div className="stage-q text-[clamp(20px,2.6vw,32px)]">{question}</div>
          )}
          {d.note && (
            <div className="text-mist mt-1.5 text-[clamp(13px,1.7vw,17px)] tracking-wide">
              {d.note}
            </div>
          )}
          {d.answerRevealed && (
            <div className="stage-answer mt-2 text-[clamp(17px,2.2vw,26px)]">Đáp án: {d.answer}</div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

// MÀN CÂU HỎI — Vòng 2: khung hàng ngang + ảnh/video là nội dung chính ở giữa. Trên màn
// khán giả dùng `strip={false}` và đưa dải câu hỏi xuống DƯỚI THANH TÊN ĐỘI (giống Vòng 4);
// màn thí sinh giữ `strip` mặc định (true) để câu hỏi nằm ngay dưới nội dung trong thân màn.
// Nhận children để chèn ô nhập đáp án của thí sinh.
// Với CÂU HỎI MẢNH GHÉP TRUNG TÂM (index 4): không hiển thị ô chữ/số ký tự hàng ngang —
// chỉ hiện chip vàng đánh số 5 (mảnh trung tâm) làm mục tiêu + câu hỏi cuối.
export function Round2Question({ state, d, g, strip = true, children }) {
  const p = g.puzzle || {};
  const cnv = state.cnv || {};
  const isCenter = (p.currentRow ?? 0) === 4;
  return (
    <div className="w-full max-w-[1200px] min-h-[60vh] mx-auto text-center flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center justify-center">
        <Round2Context g={g} state={state} />
        {isCenter ? (
          <div className="mb-6 flex flex-col items-center gap-2.5">
            <div className="relative grid place-items-center w-[clamp(88px,12vw,130px)] aspect-square rounded-2xl border-2 border-gold bg-night text-gold shadow-[0_0_30px_rgba(255,214,10,0.5)] animate-pulse">
              <span className="font-display font-black text-[clamp(40px,6vw,64px)] leading-none">5</span>
            </div>
            <div className="text-[11px] font-bold tracking-[0.22em] uppercase text-mist">Mảnh ghép trung tâm — câu hỏi cuối</div>
          </div>
        ) : (
          <div className="r2-rows mb-6 rounded-2xl border border-[rgba(255,214,10,0.28)] px-6 py-4">
            <CnvRowsFrame state={state} g={g} />
          </div>
        )}
        {d.mediaUrl && d.mediaType === "image" && (
          <img src={d.mediaUrl} alt="" className="max-h-[30vh] mx-auto rounded-2xl object-contain border border-line shadow-[0_10px_40px_rgba(0,0,0,0.4)]" />
        )}
        {d.mediaUrl && d.mediaType === "video" && (
          <video src={optimizeVideoUrl(d.mediaUrl)} autoPlay controls className="max-h-[30vh] mx-auto rounded-2xl" />
        )}
      </div>

      {strip && <Round2QuestionStrip state={state} d={d} g={g}>{children}</Round2QuestionStrip>}
    </div>
  );
}

// Tên hiển thị của mảnh vừa xử lý: 4 hàng ngang → số 1..4, câu hỏi cuối → MẢNH TRUNG TÂM.
function pieceLabel(row) {
  return (row ?? 0) === 4 ? "MẢNH TRUNG TÂM" : `MẢNH ${(row ?? 0) + 1}`;
}

// Banner hệ quả ngay trên MÀN ĐÁP ÁN sau khi MC "Chốt điểm" (Nhịp 1): khán giả đã thấy
// từng đội Đúng/Sai + bao nhiêu điểm, giờ biết ô vừa được MỞ hay bị KHÓA — chưa cần
// chuyển sang bảng mảnh. Chỉ hiện khi ô đã chốt (rowPhase "scored") và tồn tại đến khi
// MC chọn ô kế tiếp (lastResult bị xóa).
function ResultBanner({ lastResult }) {
  return (
    <div className={`mx-auto w-[min(680px,92%)] mb-4 rounded-2xl border-2 px-6 py-3.5 text-center ${
      lastResult.correct
        ? "border-[rgba(128,237,153,0.6)] bg-[rgba(128,237,153,0.14)]"
        : "border-[rgba(255,77,109,0.6)] bg-[rgba(255,77,109,0.14)]"
    }`}>
      <div className={`font-display font-black text-[clamp(26px,3.8vw,46px)] leading-none tracking-wide ${
        lastResult.correct ? "text-[#80ed99]" : "text-[#ff8fa3]"
      }`}>
        {lastResult.correct ? `MỞ ${pieceLabel(lastResult.row)}` : `KHÓA ${pieceLabel(lastResult.row)}`}
      </div>
      <div className="text-mist text-[clamp(13px,1.6vw,17px)] mt-1.5 font-semibold">
        {lastResult.correct
          ? "Ô vừa được mở — MC chuyển sang bảng mảnh để xem mảnh ghép mới."
          : "Không đội nào đúng — mảnh vừa bị khóa vĩnh viễn."}
      </div>
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
  // Câu hỏi MẢNH GHÉP TRUNG TÂM (index 4) đang thi → mảnh số 5 là mục tiêu: nổi bật/
  // nhấp nháy vàng để khán giả biết câu hỏi cuối đang nhắm tới mảnh chính giữa.
  const centerTarget = p.currentRow === 4 && p.rowPhase === "open" && !solved[4] && !locked[4];
  return (
    <div className="relative w-full max-w-[1200px] min-h-[60vh] mx-auto flex flex-col items-center justify-center">
      <Round2Context g={g} state={state} />
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
          {/* Mảnh trung tâm — MỞ bằng "Câu hỏi mảnh ghép trung tâm" (câu hỏi cuối), không
              phải hàng ngang thứ 5. Đang thi câu hỏi cuối → mảnh nhấp nháy vàng làm mục
              tiêu. Mở mảnh → lộ ảnh gốc (hoặc hiện vàng nếu vòng không có ảnh); khóa → ô đen. */}
          <div
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[52%] h-[60%] rounded-xl border-2 grid place-items-center font-display font-black text-[clamp(26px,3.4vw,52px)] tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)] transition ${
              solved[4]
                ? media?.url && media.type !== "video"
                  ? "border-transparent"
                  : "bg-gold text-[#1a1400] border-gold shadow-[0_0_26px_rgba(255,214,10,0.45)]"
                : locked[4]
                  ? "bg-black border-transparent"
                  : centerTarget
                    ? "bg-[#0e1830] text-gold border-gold shadow-[0_0_34px_rgba(255,214,10,0.6)] animate-pulse"
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
