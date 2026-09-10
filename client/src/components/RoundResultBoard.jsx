// Màn hình TỔNG KẾT ĐIỂM — kết quả cuối vòng. MC bật/tắt THỦ CÔNG qua "screen.roundResult"
// (cơ chế giống "screen.rules"). Dùng chung cho khán giả (Audience) và thí sinh (Team).
// Bảng điểm chương trình truyền hình: nền navy có texture ánh sáng + vùng blur nhẹ, tiêu đề
// cyan vuông (Chakra Petch), mỗi đội một thanh ngang ~70% màn hình — ô điểm CAM bên trái
// (~170px, số trắng rất lớn), thân thanh xám xanh gradient (sáng trên/tối dưới), đầu kim
// loại bạc bên phải có chấm xanh đen. Bo góc hẹp, shadow nhẹ, không glow/neon/glassmorphism.
// Đội dẫn đầu: viền vàng rất nhẹ. Đội bị MC khóa: mờ + nhãn "BỊ LOẠI".
// Vòng 2/3/4 chỉ liệt kê đội CHƯA bị block; vòng 1 hiện đủ kèm đánh dấu loại.
export default function RoundResultBoard({ state, g, className = "", bg = "dark", bgUrl = "" }) {
  const top4Rounds = ["vuot_cnv", "tang_toc", "ve_dich"];
  const sourceTeams = (state.teams || []).filter(
    (t) => !top4Rounds.includes(g.round) || !t.eliminated
  );
  const ranked = [...sourceTeams].sort((a, b) => b.score - a.score);
  // Viền vàng highlight CHỈ cho đội dẫn đầu còn thi (không rơi vào đội đã bị loại).
  const leaderScore = ranked.find((t) => !t.eliminated)?.score ?? -1;

  return (
    <div className={`relative isolate min-h-screen overflow-hidden text-center ${className}`}>
      {/* Background navy — ánh sáng mờ + các vùng blur nhẹ (không phẳng), vẫn tôn trọng
          ảnh nền khán giả (bg==="blur") nếu admin đặt. */}
      <div className="fixed inset-0 z-0 bg-[#081426]" />
      {bg === "blur" && bgUrl && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center scale-110"
          style={{ backgroundImage: `url(${bgUrl})`, filter: "blur(14px) brightness(0.5)" }}
        />
      )}
      <div
        className="fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(900px 480px at 26% -5%, rgba(52,120,190,0.16), transparent 55%), radial-gradient(700px 420px at 80% 6%, rgba(60,140,205,0.10), transparent 60%), radial-gradient(1100px 560px at 50% 115%, rgba(6,18,40,0.75), transparent 62%)",
        }}
      />
      <div className="fixed -top-24 left-[16%] z-0 h-[420px] w-[520px] rounded-full bg-[#1d4a7c]/18 blur-3xl" />
      <div className="fixed -bottom-28 right-[10%] z-0 h-[380px] w-[460px] rounded-full bg-[#123a66]/25 blur-3xl" />
      <div className="fixed inset-0 z-0 bg-[#0a1d3a]/25" />

      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-6 py-[2.5vh]">
        {/* Tiêu đề — cyan sáng, font vuông kỹ thuật, in hoa, không neon */}
        <h1 className="font-display font-black uppercase tracking-[0.16em] text-[#45dfcb] text-[clamp(28px,4vw,56px)]">
          TỔNG KẾT ĐIỂM
        </h1>
        <span
          className="mt-[1.4vh] h-[3px] w-[clamp(140px,16vw,220px)]"
          style={{ background: "linear-gradient(90deg, transparent, #6d7a8a 30%, #8e9bb0 50%, #6d7a8a 70%, transparent)" }}
        />

        {/* Bảng xếp hạng — 6 đội, thanh ~70% màn hình, lộ dần từng dòng từ trên xuống */}
        <div className="mt-[3vh] flex w-[min(960px,76vw)] flex-col gap-[clamp(10px,1.6vh,15px)]">
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
                    className={`flex h-[clamp(50px,6.2vh,60px)] items-stretch overflow-hidden rounded-[4px] ring-1 ring-black/40 shadow-[0_7px_16px_rgba(0,0,0,0.5)] ${
                      isTop ? "ring-1 ring-[#e5b83c]/40" : ""
                    }`}
                  >
                    {/* Ô ĐIỂM cam — ~170px, số trắng rất lớn */}
                    <div
                      className="relative flex w-[clamp(120px,13vw,170px)] shrink-0 items-center justify-center border-r-2 border-black/35"
                      style={{
                        background: "linear-gradient(180deg,#f89a3c,#c8651c)",
                        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.32), inset 0 -2px 0 rgba(0,0,0,0.2)",
                      }}
                    >
                      <span className="font-display font-black text-[clamp(30px,2.8vw,44px)] leading-none text-white tabular-nums drop-shadow-[0_2px_0_rgba(0,0,0,0.4)]">
                        {t.score}
                      </span>
                    </div>

                    {/* Thân thanh xám xanh — gradient sáng trên → tối dưới, tên trắng căn giữa */}
                    <div className="relative flex flex-1 items-center justify-center bg-gradient-to-b from-[#38445a] to-[#222b3a] px-6">
                      <span className="font-display font-bold text-[clamp(20px,2vw,34px)] text-white truncate drop-shadow-[0_1px_0_rgba(0,0,0,0.5)]">
                        {t.name}
                      </span>
                      {isOut && (
                        <span className="ml-3 shrink-0 rounded-sm border border-red-400/50 bg-red-500/20 px-2 py-0.5 text-[11px] font-bold tracking-widest text-red-200 uppercase">
                          Bị loại
                        </span>
                      )}
                    </div>

                    {/* Đầu kim loại bạc — ~30px, chấm tròn xanh đen */}
                    <div
                      className="relative flex w-[clamp(24px,2vw,30px)] shrink-0 items-center justify-center"
                      style={{ background: "linear-gradient(180deg,#aeb8c6,#5d6673 52%,#3b434f)" }}
                    >
                      <div className="absolute left-0 inset-y-1.5 w-[2px] bg-black/30" />
                      <div className="h-3 w-3 rounded-full bg-[#0e1c30] shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)]" />
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