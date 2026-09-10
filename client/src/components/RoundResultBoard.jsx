// Màn hình TỔNG KẾT ĐIỂM — kết quả cuối vòng. MC bật/tắt THỦ CÔNG qua "screen.roundResult"
// (cơ chế giống "screen.rules"). Dùng chung cho khán giả (Audience) và thí sinh (Team).
// Phong cách đồ họa truyền hình: nền xanh đậm, tiêu đề xanh ngọc đơn giản, mỗi đội một
// thanh xám đậm bọc viền kim loại (điểm trong ô cam/nâu bên trái, tên trắng căn giữa,
// đầu nối kim loại bên phải). Bo góc hẹp, gần như không glow/neon.
// Ở vòng 2/3/4 chỉ liệt kê các đội CHƯA bị MC block (team.eliminated).
export default function RoundResultBoard({ state, g, className = "", bg = "dark", bgUrl = "" }) {
  const top4Rounds = ["vuot_cnv", "tang_toc", "ve_dich"];
  const sourceTeams = (state.teams || []).filter(
    (t) => !top4Rounds.includes(g.round) || !t.eliminated
  );
  const ranked = [...sourceTeams].sort((a, b) => b.score - a.score);
  // Vòng 1 hiện cả đội đã bị MC khóa (đánh dấu "BỊ LOẠI") — vạch vàng highlight chỉ
  // dành cho đội dẫn đầu CÒN thi (không bao giờ rơi vào đội đã bị loại).
  const leaderScore = ranked.find((t) => !t.eliminated)?.score ?? -1;

  return (
    <div className={`relative isolate min-h-screen overflow-hidden text-center ${className}`}>
      {/* Nền đồng bộ màn hình khán giả: xanh đậm + (nếu có) ảnh nền làm mờ như các màn khác */}
      <div className="fixed inset-0 z-0 bg-[#0a1d3a]" />
      {bg === "blur" && bgUrl && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center scale-110"
          style={{ backgroundImage: `url(${bgUrl})`, filter: "blur(14px) brightness(0.5)" }}
        />
      )}
      <div className="fixed inset-0 z-0 bg-[#0a1d3a]/45" />

      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-6 py-12">
        {/* Tiêu đề — xanh ngọc, đơn giản, không glow */}
        <h1 className="font-display font-black uppercase tracking-[0.18em] text-[#3fd6c2] text-[clamp(30px,4.4vw,62px)]">
          TỔNG KẾT ĐIỂM
        </h1>
        <span
          className="mt-3 h-[3px] w-[200px]"
          style={{ background: "linear-gradient(90deg, transparent, #6d7a8a 30%, #8e9bb0 50%, #6d7a8a 70%, transparent)" }}
        />

        {/* Bảng xếp hạng dọc — mỗi đội một thanh ngang, viền kim loại mỏng.
            Xuất hiện CHẬM rãi từng dòng (broadcast): delay 450 + i*320ms, mỗi dòng 0.9s. */}
        <div className="mt-9 flex w-[min(860px,92vw)] flex-col gap-3.5">
          {ranked.map((t, i) => {
            const isOut = !!t.eliminated;
            const isTop = !isOut && t.score === leaderScore && leaderScore >= 0;
            return (
              <div
                key={t.id}
                className="r2-row-in"
                style={{ animationDelay: `${450 + i * 320}ms`, animationDuration: "0.9s" }}
              >
                <div className={isOut ? "opacity-55 saturate-50" : ""}>
                <div
                  className="flex items-stretch overflow-hidden rounded-[4px] p-[3px]"
                  style={{ background: "linear-gradient(180deg,#a4aeba,#646e7b 45%,#414a57)" }}
                >
                  <div className="relative flex flex-1 items-stretch overflow-hidden rounded-[2px] bg-gradient-to-b from-[#333d4c] to-[#212a37] shadow-[0_8px_18px_rgba(0,0,0,0.5)]">
                    {/* Đội dẫn đầu: vạch vàng mỏng bên trái — chỉ accent, không glow */}
                    {isTop && <span className="absolute left-0 inset-y-0 w-[5px] bg-[#e5b83c]" />}

                    {/* Ô ĐIỂM cam/nâu — bên trái */}
                    <div
                      className="relative flex shrink-0 items-center justify-center px-8 border-r border-black/35"
                      style={{
                        background: "linear-gradient(180deg,#f79b3c,#c9641c)",
                        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.22)",
                      }}
                    >
                      <span className="font-display font-black text-[clamp(36px,4.8vw,58px)] leading-none text-white tabular-nums drop-shadow-[0_2px_0_rgba(0,0,0,0.4)]">
                        {t.score}
                      </span>
                    </div>

                    {/* Tên đội — trắng, căn giữa thanh }, nhãn BỊ LOẠI khi bị MC khóa */}
                    <div className="relative flex flex-1 items-center justify-center px-8">
                      <span className="font-display font-bold text-[clamp(24px,3.2vw,40px)] text-white truncate drop-shadow-[0_2px_0_rgba(0,0,0,0.45)]">
                        {t.name}
                      </span>
                      {isOut && (
                        <span className="ml-3 shrink-0 rounded-sm border border-red-400/50 bg-red-500/20 px-2 py-0.5 text-[11px] font-bold tracking-widest text-red-200 uppercase">
                          Bị loại
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Đầu nối kim loại — bên phải mỗi thanh */}
                  <div
                    className="relative flex w-8 shrink-0 items-center justify-center"
                    style={{ background: "linear-gradient(180deg,#a4aeba,#414a57)" }}
                  >
                    <div className="absolute left-0 inset-y-1 w-px bg-black/35" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#232b38] shadow-[inset_0_1px_2px_rgba(255,255,255,0.5)]" />
                  </div>
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