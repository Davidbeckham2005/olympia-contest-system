// Màn hình KẾT QUẢ CUỐI VÒNG — dùng chung cho khán giả (Audience) và thí sinh (Team).
// MC bật/tắt THỦ CÔNG qua action "screen.roundResult" (cơ chế giống "screen.rules").
// BẢNG XẾP HẠNG TẠM để vận hành cơ chế — thiết kế chính thức sẽ được thay KHI user gửi.
export default function RoundResultBoard({ state, g, className = "" }) {
  const ranked = [...(state.teams || [])].sort((a, b) => b.score - a.score);
  const title = (g.display?.title || "").toUpperCase() || "KẾT QUẢ VÒNG";

  return (
    <div className={`w-[min(1000px,94vw)] mx-auto text-center ${className}`}>
      <div className="kicker tracking-[0.35em] text-[#ffd60a]">{title}</div>
      <div className="font-display font-bold text-[clamp(36px,5vw,64px)] leading-tight text-white mt-2">
        KẾT QUẢ VÒNG
      </div>

      <div className="mt-8 w-full mx-auto rounded-2xl border border-[rgba(255,214,10,0.3)] bg-[#2a3d63] shadow-[0_10px_50px_rgba(0,0,0,0.5)] px-6 py-6">
        <div className="flex flex-col gap-2.5">
          {ranked.map((t, i) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-4 px-5 py-3 rounded-xl border border-[rgba(255,214,10,0.2)] bg-[#1d2c4a]"
            >
              <div className="flex items-center gap-3">
                <span className="font-display font-bold text-[clamp(20px,2.4vw,32px)] text-white/80">{i + 1}</span>
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color }} />
                <span className="font-display font-bold text-[clamp(22px,2.6vw,36px)] text-white truncate">{t.name}</span>
              </div>
              <span className="font-display font-bold text-[clamp(22px,2.6vw,36px)] text-[#ffd60a]">{t.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}