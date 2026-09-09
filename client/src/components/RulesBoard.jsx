// Màn hình hiển thị LUẬT THI của vòng đang diễn ra — dùng chung cho màn hình khán
// giả (Audience) và màn hình thí sinh (Team). MC bật/tắt qua action "screen.rules".
// Nội dung mỗi vòng nằm trong rounds[*].rules trên server (config/constants.js).
export default function RulesBoard({ state, g, className = "" }) {
  const round = (state.rounds || []).find((r) => r.id === g.round);
  const rules = round?.rules || [];
  return (
    <div className={`w-[min(980px,94vw)] mx-auto text-center ${className}`}>
      <div className="kicker text-gold">Luật thi</div>
      <div className="font-display font-bold text-[clamp(34px,6vw,64px)] leading-tight text-white drop-shadow-[0_0_28px_rgba(255,214,10,0.25)]">
        {round?.name || g.display?.title || ""}
      </div>
      <div className="mt-7 grid gap-3 text-left">
        {rules.map((line, i) => (
          <div
            key={i}
            className="rounded-xl border border-[rgba(255,214,10,0.22)] bg-[#13203a]/85 px-5 py-4 flex items-start gap-4"
          >
            <span className="mt-1 flex-none grid place-items-center w-8 h-8 rounded-full bg-[#ffd60a] font-display font-bold text-[#1a1400]">
              {i + 1}
            </span>
            <p className="text-[clamp(17px,2vw,24px)] leading-snug text-white/95" style={{ whiteSpace: "pre-line" }}>
              {line}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}