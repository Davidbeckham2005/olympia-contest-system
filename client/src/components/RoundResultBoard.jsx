// Màn hình TỔNG KẾT ĐIỂM — kết quả cuối vòng. MC bật/tắt THỦ CÔNG qua "screen.roundResult"
// (cơ chế giống "screen.rules"). Dùng chung cho khán giả (Audience) và thí sinh (Team).
// Phong cách "Đường lên đỉnh Olympia" cổ điển: nền xanh đậm + bokeh sáng nhẹ, tiêu đề xanh
// ngọc trong biển kim loại, mỗi đội một thanh xám đậm (điểm trong ô cam/nâu bên trái, tên
// trắng căn giữa, chi tiết kim loại bên phải). Dòng xuất hiện lần lượt từ trên xuống
// (tái sử dụng .r2-row-in), đội dẫn đầu được tô sáng.
export default function RoundResultBoard({ state, g, className = "" }) {
  const ranked = [...(state.teams || [])].sort((a, b) => b.score - a.score);
  const topScore = ranked[0]?.score ?? 0;
  const roundName = (g.display?.title || "").toUpperCase();

  return (
    <div className={`relative isolate min-h-screen overflow-hidden text-center ${className}`}>
      {/* Nền xanh đậm + hiệu ứng ánh sáng/bokeh nhẹ */}
      <div className="fixed inset-0 z-0 bg-[#081a33]" />
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(900px 460px at 12% -8%, rgba(46,230,200,0.14), transparent 55%), radial-gradient(760px 420px at 94% 6%, rgba(255,214,10,0.10), transparent 50%), radial-gradient(900px 520px at 50% 108%, rgba(38,90,160,0.22), transparent 55%)",
        }}
      />
      <div className="fixed -top-24 -left-24 z-0 h-[420px] w-[420px] rounded-full bg-[#2ee6c8]/10 blur-3xl" />
      <div className="fixed top-1/3 -right-32 z-0 h-[380px] w-[380px] rounded-full bg-[#ff9f40]/10 blur-3xl" />
      <div className="fixed -bottom-32 left-1/4 z-0 h-[360px] w-[360px] rounded-full bg-[#2463b8]/20 blur-3xl" />

      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-6 py-12">
        {roundName && <div className="kicker mb-3 opacity-70">• {roundName} •</div>}

        {/* Biển tiêu đề kim loại — chữ xanh ngọc nổi bật */}
        <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-white/30 shadow-[0_16px_40px_rgba(0,0,0,0.55)]">
          <div className="w-5 bg-gradient-to-b from-[#b8c4d0] via-[#7d8a98] to-[#4b5560]" />
          <div className="relative bg-gradient-to-b from-[#1c2530] via-[#232e3c] to-[#141b26] px-12 py-3">
            <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10 pointer-events-none" />
            <div className="absolute inset-[2px] border border-white/15 pointer-events-none" />
            <span className="relative font-display font-black uppercase tracking-[0.18em] text-[#58f0da] text-[clamp(26px,4vw,56px)] drop-shadow-[0_0_22px_rgba(46,230,200,0.55)]">
              TỔNG KẾT ĐIỂM
            </span>
          </div>
          <div className="w-5 bg-gradient-to-b from-[#b8c4d0] via-[#7d8a98] to-[#4b5560]" />
        </div>

        {/* Bảng xếp hạng dọc — mỗi đội một thanh */}
        <div className="mt-10 flex w-[min(920px,94vw)] flex-col gap-4">
          {ranked.map((t, i) => {
            const isTop = topScore > 0 && t.score === topScore;
            return (
              <div key={t.id} className="r2-row-in" style={{ animationDelay: `${300 + i * 190}ms` }}>
                <div
                  className={`flex items-stretch overflow-hidden rounded-xl ${
                    isTop
                      ? "ring-2 ring-[#ffd60a]/70 shadow-[0_0_34px_rgba(255,214,10,0.35)]"
                      : "shadow-[0_12px_28px_rgba(0,0,0,0.45)]"
                  }`}
                  style={{ background: "linear-gradient(180deg,#2a3340,#242c38)" }}
                >
                  <div className="relative flex flex-1 items-stretch">
                    {/* Mặt bóng phía trên thanh */}
                    <div className="absolute inset-x-0 top-0 h-1/2 bg-white/5 pointer-events-none" />

                    {/* Ô ĐIỂM cam/nâu — bên trái, lớn và nổi bật */}
                    <div
                      className="relative flex items-center justify-center px-7"
                      style={{
                        background: "linear-gradient(180deg,#ff9f40,#d25a12)",
                        boxShadow:
                          "inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -3px 0 rgba(0,0,0,0.28), 0 6px 18px rgba(178,82,10,0.5)",
                      }}
                    >
                      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/20 pointer-events-none" />
                      <span className="relative font-display font-black text-[clamp(36px,5vw,58px)] text-white/95 tabular-nums drop-shadow-[0_3px_0_rgba(0,0,0,0.35)]">
                        {t.score}
                      </span>
                    </div>

                    {/* Tên đội — trắng, căn giữa */}
                    <div className="relative flex flex-1 items-center justify-center px-6">
                      <span className="font-display font-bold text-[clamp(26px,3.4vw,44px)] text-white truncate drop-shadow-[0_2px_0_rgba(0,0,0,0.4)]">
                        {t.name}
                      </span>
                      {isTop && (
                        <span className="ml-4 shrink-0 font-display font-black text-[clamp(14px,1.4vw,20px)] tracking-widest text-[#ffd60a]">
                          ★
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chi tiết kim loại phía bên phải mỗi thanh */}
                  <div
                    className="relative flex w-8 shrink-0 items-center justify-center"
                    style={{ background: "linear-gradient(180deg,#b8c4d0,#7d8a98 55%,#4b5560)" }}
                  >
                    <div className="absolute left-0 inset-y-1 w-px bg-black/30" />
                    <div className="h-3 w-3 rounded-full bg-[#2b3340] shadow-[inset_0_2px_3px_rgba(255,255,255,0.55)]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}