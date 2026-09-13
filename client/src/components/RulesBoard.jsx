// Màn hình hiển thị LUẬT THI của vòng đang diễn ra — dùng chung cho màn hình khán
// giả (Audience) và màn hình thí sinh (Team). MC bật/tắt qua action "screen.rules".
// Nội dung mỗi vòng nằm trong rounds[*].rules trên server — admin chỉnh được ở tab
// "Luật thi" (lưu vào DB, roundsView() gộp override vào ROUNDS).
// Giao diện: khung câu hỏi kiểu gameshow truyền hình VN — thanh tiêu đề đỏ kiểu
// biển hiệu kim loại, khung chính gradient xanh đậm → xanh dương, viền ngoài cyan
// phát sáng nhẹ. Không dùng card trắng / shadow SaaS. Nội dung là các đoạn luật
// không đánh số, bo vừa khung để không tràn màn hình.
export default function RulesBoard({ state, g, className = "" }) {
  const round = (state.rounds || []).find((r) => r.id === g.round);
  const rules = round?.rules || [];
  const title = (round?.name || g.display?.title || "").toUpperCase();

  return (
    <div className={`w-[min(1200px,94vw)] mx-auto text-center ${className}`}>
      {/* Thanh tiêu đề vòng — giống biển hiệu truyền hình: đỏ, hai đầu nối xám tròn */}
      <div className="inline-flex items-stretch rounded-xl overflow-hidden border border-white/40 shadow-[0_14px_40px_rgba(0,0,0,0.55)] rules-banner-in">
        <div className="w-[18px] bg-gradient-to-b from-[#9aa4b0] via-[#6b7480] to-[#3e454f]" />
        <div className="relative bg-gradient-to-b from-[#ff7a45] via-[#e8442f] to-[#b91c1c] px-10 py-2">
          <div className="absolute inset-x-0 top-0 h-1/2 bg-white/20" />
          <span className="relative font-display font-black text-white text-[clamp(18px,2.2vw,32px)] tracking-[0.18em] whitespace-nowrap drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">
            {title}
          </span>
        </div>
        <div className="w-[18px] bg-gradient-to-b from-[#9aa4b0] via-[#6b7480] to-[#3e454f]" />
      </div>

      {/* Khung câu hỏi chính */}
      <div className="relative mt-5 rules-frame-in">
        {/* Halo ngoài: viền cyan mờ phát sáng nhẹ */}
        <div className="absolute -inset-[5px] rounded-[28px] border-2 border-[#4cc9f0]/60 blur-[9px]" />
        <div className="absolute -inset-[2px] rounded-[28px] bg-[#4cc9f0]/25" />

        {/* Khung: viền sáng trắng/xám, bên trong gradient xanh đậm → xanh dương */}
        <div className="relative rounded-[24px] bg-gradient-to-b from-[#0a1c40] via-[#0e2f62] to-[#144883] overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/[0.14] to-transparent" />
          <div className="absolute inset-[3px] rounded-[21px] border border-white/25 pointer-events-none" />

          {/* Nội dung luật — các đoạn không đánh số, giãn line thoáng, vừa khung */}
          <div className="relative px-8 py-8 max-h-[calc(100vh-260px)] overflow-hidden flex flex-col items-center justify-center gap-4">
            {rules.length === 0 ? (
              <p
                className="rules-line-in text-white/75 text-[clamp(16px,1.8vw,26px)]"
                style={{ animationDelay: "640ms" }}
              >
                Đang cập nhật luật chơi…
              </p>
            ) : rules.length === 1 ? (
              <p
                className="rules-line-in max-w-[860px] text-center text-[clamp(18px,2vw,28px)] leading-relaxed text-white/95"
                style={{ whiteSpace: "pre-line", animationDelay: "640ms" }}
              >
                {rules[0]}
              </p>
            ) : (
              rules.map((line, i) => (
                <p
                  key={i}
                  className="rules-line-in w-full max-w-[880px] text-left text-[clamp(16px,1.8vw,26px)] leading-relaxed text-white/95"
                  style={{ whiteSpace: "pre-line", animationDelay: `${640 + i * 150}ms` }}
                >
                  {line}
                </p>
              ))
            )}
          </div>

          {/* Chi tiết góc dưới — nhỏ, không gây chú ý */}
          <div className="absolute bottom-3 left-5 text-[10px] tracking-[0.28em] uppercase text-white/30">
            Cuộc thi tri thức
          </div>
          <div className="absolute bottom-3 right-5 text-[10px] tracking-[0.28em] text-white/30">• • •</div>
        </div>
      </div>
    </div>
  );
}
