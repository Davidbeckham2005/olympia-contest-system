import { useEffect, useRef, useState } from "react";
import { activeTeamIds } from "../../lib/teams.js";
import RulesToggle from "../../components/RulesToggle.jsx";

// Giao diện bàn MC Vòng 3 (Tăng tốc) — kế thừa TƯ TƯỞNG Vòng 2:
//   1. Panel ĐIỀU KHIỂN đầu trang: nút chuyển màn hình khán giả + "Đang hiện" +
//      nút hành động chính + đồng hồ.
//   2. Các panel có ngữ cảnh đi sau: chọn câu/video, bài nộp + chấm điểm.
// MỌI MÀN HÌNH đồng bộ qua display.mode (screen.set) — đúng cơ chế Round 2.
export default function RoundTangToc({ ctx }) {
  const { g, act, state } = ctx;
  const vidRef = useRef(null);
  // Modal nhập mật khẩu admin khi MC bấm "Dừng video" hoặc đổi câu giữa lúc đang chiếu.
  const [prompt, setPrompt] = useState(null); // { kind: "stop" } | { kind: "jump", index }
  const [promptPin, setPromptPin] = useState("");
  const tt = g.tangToc || {};
  const phase = tt.phase || "video";
  const settled = !!tt.settled;
  // CÁC hook KHÔNG được đặt sau return sớm (Rules of Hooks) — g.round từ khoi_dong
  // đổi sang tang_toc vẫn phải chạy hook ổn định.

  function closePrompt() {
    setPrompt(null);
    setPromptPin("");
  }
  function confirmPrompt() {
    if (!prompt) return;
    if (prompt.kind === "stop") {
      act("tangtoc.stop", { pin: promptPin });
    } else if (prompt.kind === "jump") {
      act("question.jump", { teamId: g.currentTeam, questionIndex: prompt.index, pin: promptPin });
    }
    closePrompt();
  }
  function selectQuestion(i) {
    if (phase === "video" && running) {
      if (i === curIdx) return; // đang chiếu chính câu này — bấm lại không làm gì (tránh xóa bài đã nộp)
      setPrompt({ kind: "jump", index: i });
      setPromptPin("");
      return;
    }
    act("question.jump", { teamId: g.currentTeam, questionIndex: i });
  }
  const qs = state.questions?.main?.tangToc || [];
  const curIdx = g.questionIndex || 0;
  const subs = tt.submissions || {};
  const ranked = tt.ranked || [];
  const corrections = tt.corrections || {};
  const teams = state.teams || [];
  // Đồng hồ CHÍNH THỨC là game:timer trực tiếp (ctx.timer); state.game.timer được publicGame
  // gửi kèm trong game:state (cập nhật mỗi nửa giây) nên chỉ dùng làm fallback.
  const timer = ctx.timer || {};
  const running = !!timer.running;
  const shown = (g.display?.mode === "question") && (g.display?.mediaType === "video" || phase === "video");
  const screenMode = g.display?.mode === "answers" ? "answers" : "question";
  const remaining = timer.remaining ?? 0;
  const subCount = Object.keys(subs).length;
  // ĐỒNG BỘ VIDEO + THỜI GIAN với màn hình khán giả: mọi màn hình SnAP video theo cùng
  // đồng hồ server (duration - remaining) mỗi 250ms → cùng vị trí, cùng lúc.
  useEffect(() => {
    const v = vidRef.current;
    if (!v) return;
    const apply = () => {
      if (phase !== "video" || !shown) {
        v.pause();
        return;
      }
      if (!running || !timer.duration) {
        v.pause();
        return;
      }
      // elapsedBase: đoạn đã chiếu trước khi MC dừng (để resume giữa chừng vẫn đúng vị trí)
      const elapsed = Math.max(0, timer.duration - remaining) + (tt.elapsedBase || 0);
      const finiteDur = v.duration && isFinite(v.duration) && v.duration > 0;
      const target = Math.min(elapsed, finiteDur ? v.duration : timer.duration);
      // Chỉ seek khi lệch NHIẾU (>1.2s): đồng hồ server trả remaining là số nguyên làm
      // mới mỗi giây → bám 0.15s sẽ seek giật liên tục (video tự dừng rồi phát lại).
      // Trong lúc phát bình thường chỉ cần giữ nguyên rồi play() — không reset vị trí.
      if (v.readyState >= 1 && Math.abs(v.currentTime - target) > 1.2) {
        v.currentTime = target;
        v.pause();
        return;
      }
      v.play().catch(() => {});
    };
    apply();
    // Nạp xong / đổi duration / seek xong / phát được → căn ngay (không chờ nhịp 250ms kế).
    v.addEventListener("loadedmetadata", apply);
    v.addEventListener("durationchange", apply);
    v.addEventListener("canplay", apply);
    v.addEventListener("seeked", apply);
    return () => {
      v.removeEventListener("loadedmetadata", apply);
      v.removeEventListener("durationchange", apply);
      v.removeEventListener("canplay", apply);
      v.removeEventListener("seeked", apply);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, running, remaining, timer.duration, shown, g.display?.mediaUrl, tt.elapsedBase]);

  if (g.round !== "tang_toc") return null;

  const rows = teams
    .filter((t) => activeTeamIds(g, teams).includes(t.id))
    .map((t) => {
      const sub = subs[t.id];
      const r = ranked.find((x) => x.teamId === t.id);
      const corr = r
        ? r.correct
        : corrections[t.id] === true
          ? true
          : corrections[t.id] === false
            ? false
            : null;
      return {
        teamId: t.id,
        name: t.name,
        color: t.color,
        answer: r?.answer ?? sub?.answer ?? null,
        elapsed: r?.elapsed ?? sub?.elapsed ?? null,
        submitted: !!sub,
        correct: corr,
        points: r?.points ?? 0,
        place: r?.place ?? null,
      };
    })
    .sort((a, b) => (a.elapsed ?? Infinity) - (b.elapsed ?? Infinity));

  return (
    <div className="grid gap-3.5">
      {/* ĐIỀU KHIỂN — TAB chuyển màn khán giả (2 màn RIÊNG) + nút hành động + đồng hồ */}
      <div className="panel">
        <div className="grid grid-cols-2 gap-1.5 mb-2.5">
          <button
            type="button"
            className={`flex items-center justify-center h-10 rounded-lg border text-sm font-semibold transition ${
              screenMode === "question"
                ? "border-gold bg-gold/15 text-gold"
                : "border-line bg-night/40 text-mist hover:border-gold/40 hover:text-white"
            }`}
            onClick={() => act("screen.set", { mode: "question" })}
          >
            Chiếu video
          </button>
          <button
            type="button"
            className={`flex items-center justify-center h-10 rounded-lg border text-sm font-semibold transition ${
              screenMode === "answers"
                ? "border-gold bg-gold/15 text-gold"
                : "border-line bg-night/40 text-mist hover:border-gold/40 hover:text-white"
            }`}
            onClick={() => act("screen.set", { mode: "answers" })}
          >
            Đáp án các đội
          </button>
          <RulesToggle
            d={g.display || {}}
            act={act}
            className={`flex items-center justify-center h-10 rounded-lg border text-sm font-semibold transition ${
              g.display?.mode === "rules"
                ? "border-gold bg-gold/15 text-gold"
                : "border-line bg-night/40 text-mist hover:border-gold/40 hover:text-white"
            }`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {phase === "preparing" ? (
            <button type="button" className="btn btn-ok text-sm! py-1.5! disabled:opacity-60" disabled>
              Chuẩn bị chiếu… {Math.max(0, remaining)}s
            </button>
          ) : phase === "video" && running ? (
            <button
              type="button"
              className="btn btn-danger text-sm! py-1.5!"
              onClick={() => setPrompt({ kind: "stop" })}
            >
              ⏸ Dừng video
            </button>
          ) : shown && !running ? (
            <button
              type="button"
              className="btn btn-ok text-sm! py-1.5! disabled:opacity-45"
              disabled={settled || phase === "answers"}
              onClick={() => act("tangtoc.countdown")}
            >
              ▶ Bắt đầu đếm giờ (Câu {curIdx + 1})
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ok text-sm! py-1.5! disabled:opacity-45"
              disabled={settled || phase === "answers"}
              onClick={() => act("tangtoc.play")}
            >
              ▶ Chiếu video (Câu {curIdx + 1})
            </button>
          )}
          <span className="text-mist text-sm ml-2">
            Đã nộp <b className="text-white">{subCount}</b>/4
          </span>
          {running && (
            <span
              className={`ml-auto inline-flex items-center justify-center rounded-lg border border-[rgba(255,214,10,0.45)] bg-[#0e1830]/60 px-3 py-1 timer-xl text-2xl ${
                remaining <= 5 ? "timer-danger" : "text-gold"
              }`}
            >
              {remaining}s
            </span>
          )}
        </div>
      </div>

      {/* CÂU HỎI + VIDEO — chọn câu để chiếu, xem trước video đang phát (đồng bộ) */}
      <div className="panel">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-xs tracking-[0.18em] text-mist uppercase">Câu hỏi</div>
          <span className="text-mist text-xs ml-auto">
            {g.display?.mediaUrl ? (
              phase === "video" && running
                ? "Đang chiếu ⏺"
                : shown && !running
                  ? "Sẵn sàng chiếu — chờ bắt đầu đếm giờ"
                  : "Sẵn sàng chiếu"
            ) : "Chưa cài video"}
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-4 mb-2">
          {qs.map((qd, i) => {
            const isCurrent = i === curIdx;
            const switching = running && phase === "video";
            return (
              <button
                key={qd.id}
                type="button"
                onClick={() => selectQuestion(i)}
                className={`rounded-lg border px-2.5 py-1.5 text-left transition ${
                  isCurrent ? "border-gold bg-gold/10 text-gold" : "border-line text-mist hover:border-gold/50"
                }`}
              >
                <div className="font-bold text-sm">
                  Câu {i + 1}{isCurrent ? " ●" : ""}
                  {switching && i !== curIdx ? <span className="ml-1 text-xs">🔒</span> : ""}
                </div>
                <div className="text-xs text-mist">{qd.duration}s</div>
              </button>
            );
          })}
        </div>
        <video
          ref={vidRef}
          src={g.display?.mediaUrl || undefined}
          controls
          muted
          playsInline
          preload="auto"
          className="w-full max-h-[38vh] rounded-xl border border-line bg-black object-contain"
        />
      </div>

      {/* BÀI NỘP — chấm Đúng/Sai từng đội + điểm dự kiến + Chốt điểm (như "Bài nộp" Vòng 2) */}
      <div className="panel">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs tracking-[0.18em] text-mist uppercase">Bài nộp Tăng tốc</span>
          {!settled && phase === "video" && running && (
            <span className="badge badge-warn text-xs!">Đang nhận bài</span>
          )}
          {!settled && phase !== "video" && (
            <span className="badge badge-warn text-xs!">Hết giờ — chờ Chốt</span>
          )}
          {settled && <span className="badge badge-ok text-xs!">Đã chốt điểm ✓</span>}
          <span className="text-mist text-xs ml-auto">Đã nộp: {subCount}</span>
        </div>

        <div className="grid gap-1.5">
          {rows.map((r) => {
            const ok = r.correct === true;
            const bad = r.correct === false;
            return (
              <div key={r.teamId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line/60 px-2.5 py-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                <b className="text-sm w-28 truncate">{r.name}</b>
                <span className="text-mist text-xs font-mono shrink-0">{r.submitted && r.elapsed != null ? r.elapsed.toFixed(2) + "s" : "—"}</span>
                <span className="text-sm flex-1 min-w-[120px] truncate" title={r.answer}>“{r.answer || "chưa nộp"}”</span>
                {!settled && r.submitted && (
                  <div className="flex gap-1 items-center">
                    <button
                      type="button"
                      className={`btn px-2! py-1! text-xs! ${ok ? "btn-ok" : ""}`}
                      onClick={() => act("tangtoc.mark", { teamId: r.teamId, correct: true })}
                    >
                      Đúng {ok ? "✓" : ""}
                    </button>
                    <button
                      type="button"
                      className={`btn px-2! py-1! text-xs! ${bad ? "btn-danger" : ""}`}
                      onClick={() => act("tangtoc.mark", { teamId: r.teamId, correct: false })}
                    >
                      Sai {bad ? "✕" : ""}
                    </button>
                  </div>
                )}
                <span className={`w-14 text-right font-display font-bold text-sm ${ok ? "text-ok" : bad ? "text-danger" : "text-mist"}`}>
                  {ok ? `+${r.points}` : bad ? "0" : "—"}
                </span>
                {r.place != null && <span className={`badge text-xs! ${r.place === 1 ? "badge-ok" : ""}`}>#{r.place}</span>}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3 border-t border-line/50 pt-3">
          <button
            type="button"
            className="btn btn-ok text-sm! py-1.5!"
            disabled={settled || Object.keys(corrections).length === 0}
            onClick={() => act("tangtoc.settle")}
          >
            {settled ? "Đã chốt điểm ✓" : "Chốt điểm Tăng tốc"}
          </button>
        </div>
      </div>

      {prompt && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4"
          onClick={closePrompt}
        >
          <div className="panel w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-danger">
              <span className="text-2xl">🔒</span>
              <h3 className="font-display font-bold">
                {prompt.kind === "stop" ? "Dừng video Tăng tốc?" : "Đổi câu giữa lúc chiếu?"}
              </h3>
            </div>
            <p className="text-mist mt-3 leading-relaxed">
              {prompt.kind === "stop"
                ? "Nhập mật khẩu admin để dừng video."
                : `Nhập mật khẩu admin để đổi sang Câu ${prompt.index + 1}.`}
            </p>
            <input
              autoFocus
              type="password"
              placeholder="Nhập mật khẩu admin"
              value={promptPin}
              onChange={(e) => setPromptPin(e.target.value)}
              className="mt-3 w-full!"
              onKeyDown={(e) => {
                if (e.key === "Enter" && promptPin) confirmPrompt();
              }}
            />
            <div className="flex gap-2 mt-5">
              <button type="button" className="btn flex-1" onClick={closePrompt}>
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-danger flex-1"
                disabled={!promptPin}
                onClick={confirmPrompt}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}