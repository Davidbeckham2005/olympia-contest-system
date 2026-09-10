// Nút bật/tắt màn hình LUẬT THI của vòng đang diễn ra — đặt trong panel MC mỗi vòng.
// Gửi action "screen.rules" để game.service đổi display.mode = "rules" / về màn vòng đó.
export default function RulesToggle({ d, act, className = "" }) {
  const shown = d?.mode === "rules";
  return (
    <button
      type="button"
      className={className || `btn ${shown ? "btn-ok" : "btn-ghost"}`}
      onClick={() => act("screen.rules", { show: !shown })}
      title={shown ? "Tắt màn hình luật — về màn vòng đang thi" : `Hiển thị luật thi của vòng này (g.${d?.mode})`}
    >
      {shown ? "Ẩn luật chơi" : "Chiếu luật chơi"}
    </button>
  );
}