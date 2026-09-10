import { formatTime } from "../../lib/format.js";
import RulesToggle from "../../components/RulesToggle.jsx";

// 3 màn hình riêng biệt của vòng 2 (Khán giả + Thí sinh đồng bộ), MC bấm nút để chuyển.
const SCREEN_LABEL = { question: "Câu hỏi", puzzle: "Bảng mảnh", answers: "Đáp án" };

export default function RoundVuotCnv({ ctx }) {
  const { g, d, p, cnv, state, solved, locked, cnvRowPhase, revealed, showing, remaining, running, act } = ctx;
  if (g.round !== "vuot_cnv") return null;

  const screenMode = showing ? "question" : d.mode === "answers" ? "answers" : "puzzle";

  const rows = state.questions?.main?.vuotCnv?.rows || [];
  // Index 4 không phải hàng ngang — là CÂU HỎI MẢNH GHÉP TRUNG TÂM (câu hỏi cuối mở mảnh giữa).
  const isCenterActive = (p.currentRow ?? 0) === 4;
  // Được đánh giá "Đoán từ khóa": CHỈ khi có đội GHI DANH qua nút TỪ KHÓA
  // (puzzle.keywordClaim). Tách hoàn toàn khỏi chuông trả lời hàng ngang
  // (buzzer.winner) để không lẫn 2 chuông — tránh chấm nhầm điểm từ khóa cho
  // đội chỉ mới giành quyền trả lời hàng ngang.
  const kwClaim = p.keywordClaim;
  const kwGuessable = !p.keywordSolved && !!kwClaim;
  const kwWinner = kwClaim || null;
  const findTeam = (id) => state.teams?.find((t) => t.id === id);

  return (
    <div className="grid gap-3.5">
      {/* ĐIỀU KHIỂN — 3 nút chuyển màn hình (Câu hỏi / Bảng mảnh / Đáp án) gộp với đồng hồ.
          Đồng bộ cả màn Khán giả lẫn Thí sinh. */}
      <div className="panel">
        <div className="flex flex-wrap items-center gap-2">
          {/* 3 nút riêng: Câu hỏi / Bảng mảnh / Đáp án — bấm trực tiếp để chuyển màn hình.
              Nút đang hiển thị được tô sáng để MC dễ quản lý. */}
          {["question", "puzzle", "answers"].map((m) => {
            // Trong lúc còn nhận bài (rowPhase "open") mà đã có đội nộp, bấm "Đáp án"
            // là thao tác DỄ BẤM NHẦM (đặt cùng hàng "Câu hỏi"/"Bảng mảnh") — tô màu
            // cảnh báo và bắt xác nhận trước khi chuyển màn trên sân khấu.
            const answersWhileAccepting = m === "answers" && p.rowPhase === "open" && Object.keys(p.submissions || {}).length > 0;
            return (
            <button
              key={m}
              type="button"
              className={`btn text-sm! py-0! h-10 w-[7rem]! justify-center text-center ${
                screenMode === m
                  ? answersWhileAccepting
                    ? "bg-[#ff465e]/25 ring-1 ring-[#ff465e]/60 text-white"
                    : "bg-white/20 ring-1 ring-white/40 text-white"
                  : answersWhileAccepting
                    ? "btn-ghost ring-1 ring-[#ff465e]/50 text-[#ffb3c1]"
                    : "btn-ghost"
              }`}
              title={
                answersWhileAccepting
                  ? "Các đội đang nộp bài — cần xác nhận trước khi hiện màn này"
                  : `Màn hình: ${SCREEN_LABEL[m]}`
              }
              onClick={() => {
                if (answersWhileAccepting) {
                  const n = Object.keys(p.submissions || {}).length;
                  if (
                    !window.confirm(
                      `Các đội đang nộp bài (${n} đội đã gửi, chưa hết giờ). Chuyển màn "Đáp án" lúc này sẽ che câu hỏi đang thi trên sân khấu — thường chỉ nên mở màn này sau khi đóng nhận bài. Xác nhận chuyển?`
                    )
                  )
                    return;
                }
                act("screen.set", { mode: m });
              }}
            >
              {SCREEN_LABEL[m]}
            </button>
            );
          })}
          <RulesToggle d={d} act={act} className="btn btn-ghost text-sm! py-0! h-10 w-[7rem]! justify-center text-center" />
          <span className="text-mist text-xs">
            Đang hiện: <b className="text-gold">{SCREEN_LABEL[screenMode]}</b>
          </span>
          {showing && !revealed && (
            <button type="button" className="btn btn-ghost text-sm! py-1.5!" onClick={() => act("question.reveal")}>
              Lật đáp án
            </button>
          )}
          {showing && revealed && (
            <button type="button" className="btn btn-ghost text-sm! py-1.5!" onClick={() => act("question.hideAnswer")}>
              Che đáp án
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {/* Đồng hồ của ô đang thi — gộp vào thanh điều khiển. KHÔNG hiện gì khi
                chưa đếm giờ (chưa bấm "Bắt đầu giờ"); chỉ hiện khi đồng hồ đang chạy. */}
            {running && (
              <span
                className={`inline-flex items-center justify-center rounded-xl border border-[rgba(255,214,10,0.45)] bg-[#0e1830]/60 px-4 py-1.5 timer-xl text-3xl ${
                  remaining <= 5 ? "timer-danger" : "text-gold"
                }`}
              >
                {formatTime(remaining)}
              </span>
            )}
            {/* Nút bắt đầu giờ — CHỈ hiện khi đang chọn 1 câu (rowPhase === "open") và chưa chạy */}
            {cnvRowPhase && p.rowPhase === "open" && !p.timingStarted && (
              <button
                type="button"
                className="btn btn-ok text-sm! py-1.5! px-3!"
                onClick={() => act("puzzle.startTimer")}
              >
                ▶ Bắt đầu giờ
              </button>
            )}
            {/* Nút bỏ chọn — hoàn tác ô đang mở: không hiện câu hỏi nữa */}
            {p.rowPhase === "open" && (
              <button
                type="button"
                className="btn btn-ghost text-sm! py-1.5! px-3!"
                title="Bỏ chọn ô hiện tại — quay về trạng thái chưa chọn câu hỏi nào"
                onClick={() => act("puzzle.deselect")}
              >
                Bỏ chọn
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ẢNH CHƯỚNG NGẠI VẬT — bảng chính, chỉ hiện ở chế độ Bảng mảnh */}
      {screenMode === "puzzle" && (
      <div className="rounded-lg border border-[rgba(255,214,10,0.2)] bg-[#2a3d63] px-3 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col items-center justify-center">
          {/* Ảnh ghép: 5 mảnh CHÍNH LÀ 1 bức ảnh hoàn chỉnh bị cắt. Nền đặt sẵn ảnh;
              mảnh MỞ → gỡ lớp che (hiện phần ảnh), mảnh chưa mở → phủ đục với "?".
              Bấm từng mảnh để mở. */}
          <div className="relative w-[min(420px,82%)] aspect-[16/10] rounded-md overflow-hidden ring-1 ring-line bg-night">
            {cnv?.media?.url && cnv.media.type !== "video" && (
              <img src={cnv.media.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            )}
            {/* 4 mảnh góc (hàng 0-3) — bấm để mở, đồng bộ lên màn hình khán giả */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              {[0, 1, 2, 3].map((r) => {
                const isImage = cnv?.media?.url && cnv.media.type !== "video";
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => !solved[r] && act("puzzle.piece", { index: r })}
                    title={!solved[r] ? "Mở mảnh ghép này (đồng bộ lên màn hình khán giả)" : "Mảnh ghép đã mở"}
                    disabled={locked[r] || p.keywordSolved}
                    className={`relative flex items-start ${r % 2 === 0 ? "justify-start" : "justify-end"} font-display font-bold text-xl transition ${
                      isImage && solved[r]
                        ? "pointer-events-none bg-transparent"
                        : locked[r]
                          ? "bg-black pointer-events-none cursor-not-allowed"
                          : solved[r]
                            ? "bg-[#ffd60a]/80 text-[#1a1400]"
                            : "bg-[#0e1830] text-mist hover:bg-[#2a3d63] hover:text-gold cursor-pointer"
                    }`}
                  >
                    {isImage && solved[r] ? "" : <span className={`px-3 ${r < 2 ? "pt-2" : "pb-2"}`}>{locked[r] ? "" : r + 1}</span>}
                  </button>
                );
              })}
            </div>
            {/* Ô TRUNG TÂM — nằm chồng lên điểm gặp nhau của 4 mảnh; được MỞ bằng
                "CÂU HỎI MẢNH GHÉP TRUNG TÂM" (câu hỏi cuối) — không phải hàng ngang thứ 5. */}
            <button
              type="button"
              onClick={() => !solved[4] && act("puzzle.piece", { index: 4 })}
              title={!solved[4] ? "Mở ô trung tâm — mở qua câu hỏi mảnh ghép trung tâm" : "Ô trung tâm đã mở"}
              disabled={locked[4] || p.keywordSolved}
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[52%] h-[60%] rounded border-2 grid place-items-center font-display font-bold text-xl transition ${
                cnv?.media?.url && cnv.media.type !== "video" && solved[4]
                  ? "pointer-events-none bg-transparent border-transparent"
                  : locked[4]
                    ? "bg-black pointer-events-none border-transparent cursor-not-allowed"
                    : solved[4]
                      ? "bg-[#ffd60a] text-[#1a1400] border-gold shadow-[0_0_26px_rgba(255,214,10,0.45)]"
                      : "bg-[#0e1830] text-mist border-line hover:bg-[#2a3d63] hover:text-gold cursor-pointer"
              }`}
            >
              {locked[4] ? "" : cnv?.media?.url && cnv.media.type !== "video" && solved[4] ? "" : 5}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* MỞ Ô — list dọc: TÁCH RÕ 4 HÀNG NGANG (có số kí tự) với CÂU HỎI MẢNH GHÉP
          TRUNG TÂM (câu hỏi cuối — KHÔNG số kí tự, nổi bật riêng). Tránh MC lẫn 2 loại. */}
      {showing && (
      <div className="rounded-lg border border-[rgba(255,214,10,0.2)] bg-[#2a3d63] px-3 py-2.5 shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs tracking-[0.18em] text-mist uppercase">Hàng ngang — 4 câu hỏi mở 4 mảnh góc</span>
          <span className="text-mist text-[10px] uppercase tracking-wide">Số mảnh ghép</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {rows.slice(0, 4).map((row, i) => {
            const isCurrent = i === (p.currentRow ?? 0);
            const count = row.letterCount || String(row.answer || "").replace(/\s/g, "").length;
            const canOpen = !solved[i] && !locked[i] && !p.keywordSolved;
            const label = solved[i] ? "Đã mở" : locked[i] ? "Đã khóa" : isCurrent ? "Đang thi" : "Chưa mở";
            return (
              <button
                key={row.id}
                type="button"
                disabled={!canOpen}
                title={canOpen ? "Mở câu hỏi hàng ngang cho các đội cùng trả lời tự luận" : undefined}
                onClick={() => act("puzzle.select", { row: i })}
                className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition ${
                  isCurrent
                    ? "border-gold bg-gold/15"
                    : solved[i]
                      ? "border-[rgba(255,214,10,0.6)] bg-[#ffd60a]/15"
                      : locked[i]
                        ? "border-[rgba(255,70,94,0.4)] bg-[#ff465e]/10 opacity-70"
                        : "border-[rgba(255,214,10,0.2)] bg-[#1d2c4a] hover:border-gold hover:bg-gold/10"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display font-bold text-xl leading-none text-white">{count}</span>
                    <span className="text-mist text-xs whitespace-nowrap">kí tự</span>
                  </div>
                  {isCurrent && (
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-xs text-mist whitespace-nowrap">Đáp án:</span>
                      <span className="text-sm font-bold text-gold">{row.answer || "—"}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-semibold ${
                      solved[i] ? "text-[#ffd60a]" : locked[i] ? "text-[#ff465e]/80" : isCurrent ? "text-gold" : "text-mist"
                    }`}
                  >
                    {label}
                  </span>
                  <span
                    className={`flex items-center justify-center w-8 h-8 rounded font-display font-bold text-lg ${
                      solved[i] || isCurrent
                        ? "bg-[#ffd60a] text-[#1a1400]"
                        : locked[i]
                          ? "bg-[#ff465e]/20 text-[#ff465e]/80"
                          : "border border-[rgba(255,214,10,0.3)] text-white/80"
                    }`}
                  >
                    {locked[i] ? "✕" : i + 1}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* NGĂN RIÊNG — Câu hỏi mảnh ghép trung tâm (câu hỏi cuối): giao diện khác biệt,
            KHÔNG hiển thị số kí tự, để MC không nhầm là hàng ngang. */}
        <div className="flex items-center gap-3 mt-4 mb-1.5">
          <span className="h-px flex-1 bg-[rgba(255,214,10,0.18)]" />
          <span className="text-xs font-bold tracking-[0.18em] uppercase text-gold">Câu hỏi mảnh ghép trung tâm</span>
          <span className="h-px flex-1 bg-[rgba(255,214,10,0.18)]" />
        </div>
        <div className="flex flex-col gap-1.5">
          {(() => {
            const i = 4;
            const row = rows[4];
            if (!row) return null;
            const isCurrent = isCenterActive;
            const canOpen = !solved[i] && !locked[i] && !p.keywordSolved;
            const label = solved[i] ? "Đã mở" : locked[i] ? "Đã khóa" : isCurrent ? "Đang thi" : "Chưa mở";
            return (
              <button
                key={row.id}
                type="button"
                disabled={!canOpen}
                title={canOpen ? "Mở CÂU HỎI MẢNH GHÉP TRUNG TÂM (câu hỏi cuối) cho các đội cùng trả lời tự luận" : undefined}
                onClick={() => act("puzzle.select", { row: i })}
                className={`flex items-center justify-between gap-3 rounded-md border-2 px-3 py-2.5 text-left transition ${
                  isCurrent
                    ? "border-gold bg-gold/20 shadow-[0_0_18px_rgba(255,214,10,0.25)]"
                    : solved[i]
                      ? "border-[rgba(255,214,10,0.7)] bg-[#ffd60a]/15"
                      : locked[i]
                        ? "border-[rgba(255,70,94,0.4)] bg-[#ff465e]/10 opacity-70"
                        : "border-[rgba(255,214,10,0.35)] bg-[#1d2c4a] hover:border-gold hover:bg-gold/10"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold text-white">Mảnh ghép trung tâm</span>
                  {isCurrent && (
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xs text-mist whitespace-nowrap">Đáp án:</span>
                      <span className="text-sm font-bold text-gold">{row.answer || "—"}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-semibold ${
                      solved[i] ? "text-[#ffd60a]" : locked[i] ? "text-[#ff465e]/80" : isCurrent ? "text-gold" : "text-mist"
                    }`}
                  >
                    {label}
                  </span>
                  <span
                    className={`flex items-center justify-center w-9 h-9 rounded font-display font-bold text-lg ${
                      solved[i] || isCurrent
                        ? "bg-[#ffd60a] text-[#1a1400]"
                        : locked[i]
                          ? "bg-[#ff465e]/20 text-[#ff465e]/80"
                          : "border-2 border-gold text-gold"
                    }`}
                  >
                    {locked[i] ? "✕" : 5}
                  </span>
                </div>
              </button>
            );
          })()}
        </div>
      </div>
      )}

      {/* BÀI NỘP TỰ LUẬN — MC chấm từng đội rồi Chốt điểm (cơ chế giống cho hàng ngang
          lẫn CÂU HỎI MẢNH GHÉP TRUNG TÂM, chỉ khác nhãn hiển thị) */}
      {cnvRowPhase && (
        <div className="panel border-line/80">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="text-xs tracking-[0.18em] text-mist uppercase">Bài nộp {isCenterActive ? "câu hỏi mảnh ghép trung tâm" : "hàng ngang"}</span>
            {p.rowPhase === "open" && (
              <span className="badge badge-warn text-xs!">Đang nhận bài — các đội gõ đáp án gửi về</span>
            )}
            {p.rowPhase === "closed" && (
              <span className="badge badge-warn text-xs!">Đã đóng — hãy chấm từng đội rồi Chốt</span>
            )}
            {p.rowPhase === "scored" && (
              <span className="badge badge-ok text-xs!">Đã chốt điểm ô này</span>
            )}
            {p.rowPhase === "open" && <span className="text-mist text-xs ml-auto">Đã nộp: {Object.keys(p.submissions || {}).length}</span>}
            {(p.rowPhase === "closed" || p.rowPhase === "scored") &&
              Object.keys(p.submissions || {}).length > 0 && (
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="text-mist text-xs">
                    Màn Đáp án: {Math.min(p.revealedRows || 0, Object.keys(p.submissions || {}).length)}/
                    {Object.keys(p.submissions || {}).length}
                  </span>
                  <button type="button" className="btn btn-ghost text-xs! py-1!" onClick={() => act("puzzle.nextAnswer")}>
                    Mở đáp án tiếp
                  </button>
                  <button type="button" className="btn btn-ghost text-xs! py-1!" onClick={() => act("puzzle.allAnswers")}>
                    Mở tất cả
                  </button>
                </span>
              )}
          </div>

          {p.rowPhase !== "open" && (
            <div className="grid gap-1.5">
              {(p.ranked?.length && (p.rowPhase === "scored" || p.rowPhase === "closed")
                ? p.ranked
                : Object.entries(p.submissions || {})
                    .map(([teamId, s]) => ({ teamId, answer: s.answer, elapsed: s.elapsed, correct: p.corrections?.[teamId] ?? null, points: 0, place: null }))
                    .sort((a, b) => a.elapsed - b.elapsed)
              ).map((r) => {
                const t = findTeam(r.teamId);
                if (!t) return null;
                const ok = r.correct === true;
                const bad = r.correct === false;
                return (
                  <div key={r.teamId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/60 px-2.5 py-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.color }} />
                    <b className="text-sm w-28 truncate">{t.name}</b>
                    <span className="text-mist text-xs font-mono shrink-0">{r.elapsed != null ? r.elapsed.toFixed(2) + "s" : "—"}</span>
                    <span className="text-sm flex-1 min-w-[120px] truncate" title={r.answer}>“{r.answer || "—"}”</span>
                    {p.rowPhase !== "scored" && (
                      <div className="flex gap-1 items-center">
                        <button
                          type="button"
                          className={`btn px-2! py-1! text-xs! ${ok ? "btn-ok" : ""}`}
                          onClick={() => act("puzzle.mark", { teamId: r.teamId, correct: true })}
                        >
                          Đúng
                        </button>
                        <button
                          type="button"
                          className={`btn px-2! py-1! text-xs! ${bad ? "btn-danger" : ""}`}
                          onClick={() => act("puzzle.mark", { teamId: r.teamId, correct: false })}
                        >
                          Sai
                        </button>
                      </div>
                    )}
                    <span className={`w-14 text-right font-display font-bold text-sm ${ok ? "text-ok" : ""}`}>
                      {ok ? `+${r.points}` : ""}
                    </span>
                    {r.place != null && <span className={`badge text-xs! ${r.place === 1 ? "badge-ok" : ""}`}>#{r.place}</span>}
                  </div>
                );
              })}
              {Object.keys(p.submissions || {}).length === 0 && (
                <p className="text-mist text-xs">Chưa có đội nào nộp bài.</p>
              )}
            </div>
          )}

          {p.rowPhase === "closed" && (
            <div className="flex items-center gap-2 mt-2.5 border-t border-line/50 pt-2.5">
              <button type="button" className="btn btn-ok text-sm!" onClick={() => act("puzzle.settle")}>
                Chốt điểm (tính theo tốc độ)
              </button>
              <span className="text-mist text-xs">
                Chỉ đội ĐÚNG được điểm: {(g.round2Points || [40, 30, 20, 10]).join(" · ")} (theo độ nhanh). Có ≥1 đội đúng → mở mảnh, ngược lại khóa.
              </span>
            </div>
          )}
        </div>
      )}

      {/* ĐOÁN TỪ KHÓA — đơn giản: ai đã giải / ai giữ quyền + nút Đúng/Sai */}
      <div className="panel">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs tracking-[0.18em] text-mist uppercase">Từ khóa</span>
          {p.keywordSolved ? (
            <span className={`badge ${p.keywordWinner ? "badge-ok" : ""}`}>
              {p.keywordWinner
                ? `${findTeam(p.keywordWinner)?.name || ""} ĐÃ GIẢI`
                : "ĐÃ MỞ — không ai giải"}
            </span>
          ) : kwWinner ? (
            <span className="flex items-center gap-1.5 text-sm text-mist">
              Giữ quyền:
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: findTeam(kwWinner)?.color }}
              />
              <b>{findTeam(kwWinner)?.name}</b>
            </span>
          ) : (
            <span className="text-sm text-mist">Chờ đội bấm nút TỪ KHÓA</span>
          )}
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              className="btn btn-ok text-sm! py-1.5!"
              disabled={!kwGuessable || !kwWinner}
              title="Đúng: cộng điểm từ khóa cho đội đang giữ quyền và kết thúc vòng"
              onClick={() => act("keyword.solve", { teamId: kwWinner, correct: true })}
            >
              Đúng +{ctx.current?.keywordPoints ?? "?"}
            </button>
            <button
              type="button"
              className="btn btn-danger text-sm! py-1.5!"
              disabled={!kwGuessable || !kwWinner}
              title="Sai: chặn đội này, các đội khác tiếp tục giành quyền"
              onClick={() => act("keyword.solve", { teamId: kwWinner, correct: false })}
            >
              Sai
            </button>
          </div>
        </div>
        {(p.rowBanned || []).length > 0 && (
          <div className="mt-2.5 border-t border-line/50 pt-2 text-mist text-xs flex flex-wrap items-center gap-1.5">
            <span className="text-danger font-semibold">Mất quyền trả lời hàng ngang:</span>
            {p.rowBanned.map((id) => findTeam(id)?.name || id).join(" • ")}
          </div>
        )}
      </div>
    </div>
  );
}