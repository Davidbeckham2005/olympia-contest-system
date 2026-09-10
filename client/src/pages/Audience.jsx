import { useEffect, useRef, useState } from "react";
import { useAudienceAudio } from "../lib/useAudio.js";
import { formatTime } from "../lib/format.js";
import { on } from "../lib/socket.js";
import { useGameState } from "../lib/useGame.js";
import { activeTeamIds } from "../lib/teams.js";
import { CnvRowsFrame, Round2Board, Round2Question, RowResults } from "../components/Round2Stage.jsx";
import RulesBoard from "../components/RulesBoard.jsx";

function playBuzz() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    /* ignore */
  }
}

export default function Audience() {
  const { state, timer } = useGameState();
  const [flash, setFlash] = useState(null);
  const { audioOn, enableAudio } = useAudienceAudio(state);

  useEffect(() => {
    return on("buzzer:press", (p) => {
      setFlash(p.winner);
      playBuzz();
      setTimeout(() => setFlash(null), 1200);
    });
  }, []);

  if (!state) {
    return <div className="min-h-screen grid place-items-center text-mist">Đang kết nối màn hình…</div>;
  }

  // Không còn chặn toàn màn hình để "mở âm thanh": màn khán giả hiển thị ngay, chỉ có
  // nút nhỏ góc trái dưới để kích hoạt âm thanh lần đầu (trình duyệt bắt buộc 1 cử chỉ).

  const g = state.game || {};
  const d = g.display || {};
  const remaining = timer?.remaining ?? g.timer?.remaining ?? 0;
  const running = timer?.running ?? g.timer?.running;

  // Màn hình LUẬT THI (MC bật qua "screen.rules") — hiển thị trên mọi vòng.
  // Nền đồng bộ với màn khán giả (audienceBg / audienceBgUrl) để không bị lệch giao diện.
  if (d.mode === "rules") {
    const bg = state.settings?.audienceBg || "dark";
    const bgUrl = state.settings?.audienceBgUrl || "";
    const bgLayer = (
      <>
        <div className="fixed inset-0 z-0 bg-[#070b16]" />
        {bg === "blur" && bgUrl && (
          <>
            <div
              className="fixed inset-0 z-0 bg-cover bg-center scale-110"
              style={{ backgroundImage: `url(${bgUrl})`, filter: "blur(14px) brightness(0.5)" }}
            />
            <div className="fixed inset-0 z-0 bg-[#070b16]/45" />
          </>
        )}
      </>
    );
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5 py-8 relative isolate overflow-hidden">
        {bgLayer}
        <RulesBoard state={state} g={g} className="relative z-10" />
        <AudioUnlock audioOn={audioOn} onEnable={enableAudio} />
      </div>
    );
  }
  // Vòng 3: đang chiếu video → ƯU TIÊN giao diện CHỈ CÓ VIDEO, ẩn hết header/bảng điểm
  // (khi MC đã mở câu hỏi + có video để chiếu). Chuẩn bị/liệt kê đáp án vẫn dùng layout đủ.
  const ttVideoOnly =
    g.round === "tang_toc" &&
    (g.tangToc?.phase || "video") === "video" &&
    d.mode === "question" &&
    !!d.mediaUrl;
  // "Chờ giữa các câu hỏi" (vòng 2) — đồng hồ hiển thị chữ CHỜ khi không đếm giờ.
  const p = g.puzzle || {};

  // Khi đang chiếu video round 3: màn hình chỉ còn MỖI video, chiếm trọn màn hình.
  if (ttVideoOnly) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center overflow-hidden">
        <Stage state={state} timer={timer} />
        <AudioUnlock audioOn={audioOn} onEnable={enableAudio} />
      </div>
    );
  }

  if (g.round === "khoi_dong") {
    return (
      <>
        <KhoiDongAudience state={state} timer={timer} flash={flash} />
        <AudioUnlock audioOn={audioOn} onEnable={enableAudio} />
      </>
    );
  }

  if (g.round === "tie_break") {
    const tb = g.tieBreak || {};
    const tbTeams = (tb.teams || []).map((id) => state.teams.find((t) => t.id === id)).filter(Boolean);
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-4 gap-6">
        <div className="round-badge">PHỤ PHUC</div>
        {g.buzzer?.winner && (
          <div className="round-badge">
            Quyền trả lời: {state.teams.find((t) => t.id === g.buzzer.winner)?.name}
          </div>
        )}
        {g.questionStatus === "showing" && g.display?.question && (
          <div className="panel w-full max-w-3xl text-center">
            <p className="text-ink text-2xl font-semibold">{g.display.question}</p>
            {g.display?.mediaUrl ? (
              <img src={g.display.mediaUrl} alt="" className="mt-4 max-h-64 mx-auto object-contain" />
            ) : (
              <NoMediaFallback className="w-[min(320px,54vw)] aspect-[4/3] mt-4" />
            )}
          </div>
        )}
        {g.display?.answerRevealed && (
          <div className="panel w-full max-w-3xl text-center">
            <p className="text-gold text-xl font-semibold">Dap an: {g.display.answer}</p>
          </div>
        )}
        {tb.winner && (
          <div className="panel w-full max-w-3xl text-center">
            <p className="text-mist">Thang: <b style={{ color: state.teams.find((t) => t.id === tb.winner)?.color }}>{state.teams.find((t) => t.id === tb.winner)?.name}</b></p>
          </div>
        )}
        <TeamsRow teams={tbTeams} state={state} flash={flash} currentTeam={g.buzzer?.winner} />
        <BuzzOverlay state={state} flash={flash} />
        <AudioUnlock audioOn={audioOn} onEnable={enableAudio} />
      </div>
    );
  }

  // Tạo đội hiển thị: trừ các đội bị MC khóa vĩnh viễn (hệ thống không tự loại ai).
  const top4Rounds = ["vuot_cnv", "tang_toc", "ve_dich"];
  const outTeams = top4Rounds.includes(g.round)
    ? (state.teams || []).filter((t) => activeTeamIds(g, state.teams || []).includes(t.id))
    : g.round === "khoi_dong" && (g.khoiDong?.phase === "done" || g.phase === "finished")
      ? [...(state.teams || [])].sort((a, b) => b.score - a.score).slice(0, 4)
      : state.teams;

  // Background đồng bộ cho MỌI VÒNG trên màn khán giả (nền tối #070b16 + ảnh mờ blur theo
  // cài đặt nếu có) — áp dụng luôn cho khung chính để màn khán giả không bao giờ trống nền.
  const cnvAudienceBg = state.settings?.audienceBg || "dark";
  const cnvBgUrl = state.settings?.audienceBgUrl || "";
  const cnvUseBlur = cnvAudienceBg === "blur" && cnvBgUrl;

  return (
    <div className="min-h-screen flex flex-col px-6 py-4 gap-3 relative isolate overflow-hidden">
      <div className="fixed inset-0 z-0 bg-[#070b16]" />
      {cnvUseBlur && (
        <>
          <div
            className="fixed inset-0 z-0 bg-cover bg-center scale-110"
            style={{ backgroundImage: `url(${cnvBgUrl})`, filter: "blur(14px) brightness(0.5)" }}
          />
          <div className="fixed inset-0 z-0 bg-[#070b16]/45" />
        </>
      )}
      <div className="relative flex items-start justify-end gap-4 z-10">
        <div className="flex flex-col items-end">
          {!(g.round === "vuot_cnv" && !running) && (
            <div className={`timer-xl mt-2 ${remaining <= 5 && running ? "timer-danger" : ""}`}>
              {formatTime(remaining)}
            </div>
          )}
        </div>
      </div>

      <div className="relative flex-1 grid place-items-center min-h-[52vh] z-10">
        {g.buzzer?.winner && (
          <div className="round-badge absolute top-2 left-1/2 -translate-x-1/2 z-10">
            Quyền trả lời: {state.teams.find((t) => t.id === g.buzzer.winner)?.name}
          </div>
        )}
        <Stage state={state} timer={timer} />
      </div>

      <div className="relative z-10">
        <TeamsRow teams={outTeams} state={state} flash={flash} currentTeam={g.currentTeam}>
          {g.round === "ve_dich" && <Round4Footer state={state} g={g} />}
        </TeamsRow>
      </div>
      <BuzzOverlay state={state} flash={flash} />
      <AudioUnlock audioOn={audioOn} onEnable={enableAudio} />
    </div>
  );
}

// Nút nhỏ bật âm thanh lần đầu (trình duyệt bắt buộc 1 cử chỉ người dùng) — hiển thị
// ở góc, KHÔNG chặn màn hình. Ẩn đi ngay khi đã kích hoạt.
function AudioUnlock({ audioOn, onEnable }) {
  if (audioOn) return null;
  return (
    <button
      type="button"
      onClick={onEnable}
      className="fixed bottom-4 left-4 z-[60] flex items-center gap-2 rounded-full border border-gold/50 bg-[#0b1120]/85 px-4 py-2 text-sm font-semibold text-gold shadow-[0_0_20px_rgba(255,214,10,0.25)] transition hover:bg-gold/15 cursor-pointer select-none"
    >
      🔇 Mở âm thanh
    </button>
  );
}

function BuzzOverlay({ state, flash }) {
  if (!flash) return null;
  const team = (state.teams || []).find((t) => t.id === flash);
  if (!team) return null;
  return (
    <div className="absolute right-1 top-1/2 -translate-y-1/2 z-30">
      <div className="animate-pulse rounded-lg border-2 border-white bg-white px-3 py-2 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/60">
          Giành quyền
        </div>
        <div className="mt-0.5 font-display font-black text-[clamp(20px,2.2vw,34px)] leading-none text-black">
          {team.name}
        </div>
      </div>
    </div>
  );
}

function TeamsRow({ teams, state, flash, currentTeam, ranked, children }) {
  const displayTeams = teams || ranked || (state && state.teams) || [];
  return (
    <div className="w-[min(1200px,100%)] mx-auto rounded-2xl border border-[rgba(255,214,10,0.18)] bg-[#2a3d63] shadow-[0_10px_40px_rgba(0,0,0,0.45)] overflow-hidden">
      {/* Thanh ngang 4 đội — đồng bộ với round 1 */}
      <div className="flex w-full">
        {displayTeams.map((t) => {
          const active = currentTeam === t.id;
          return (
            <div
              key={t.id}
              className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 px-2 border-r border-[rgba(255,214,10,0.1)] last:border-r-0 transition-colors ${
                flash === t.id ? "team-buzz" : active ? "bg-[#ffd60a]/12" : ""
              }`}
            >
              <span
                className={`font-bold text-[15px] truncate ${
                  active ? "text-white" : "text-white/85"
                }`}
              >
                {t.name}
              </span>
              <span
                className={`font-display font-bold text-xl tabular-nums shrink-0 ${
                  active ? "text-[#ffd60a]" : "text-[#ffd60a]/85"
                }`}
              >
                {t.score}
              </span>
            </div>
          );
})}
      </div>
      {children}
    </div>
  );
}

function Stage({ state, timer }) {
  const g = state.game;
  const d = g.display || {};

  if (g.phase === "finished" || d.mode === "winner") {
    const ranked = [...(state.teams || [])].sort((a, b) => b.score - a.score);
    return (
      <div className="text-center">
        <div className="kicker">Đội quán quân</div>
        <div className="font-display font-bold text-[clamp(40px,8vw,96px)] text-gold drop-shadow-[0_0_30px_rgba(255,214,10,0.35)]">
          {ranked[0]?.name || "—"}
        </div>
        <div className="text-mist mt-2">Tổng điểm {ranked[0]?.score ?? 0}</div>
        <div className="mt-7 w-[min(900px,92%)] mx-auto">
          <TeamsRow state={state} flash={null} currentTeam="" ranked={ranked} />
        </div>
      </div>
    );
  }

  if (d.mode === "media" && d.mediaUrl) {
    return d.mediaType === "video" ? (
      <video src={d.mediaUrl} autoPlay controls className="max-w-[90%] max-h-[50vh]" />
    ) : (
      <img src={d.mediaUrl} alt="" className="max-w-[90%] max-h-[50vh] rounded-2xl" />
    );
  }

  if (d.mode === "scores") {
    return (
      <div className="w-[90%]">
        <TeamsRow state={state} flash={null} currentTeam="" />
      </div>
    );
  }

  // Vòng 3 (Tăng tốc): vùng 1 chiếu video (đồng bộ với MC — hiện sau khi MC mở câu hỏi),
  // vùng 2 liệt kê đáp án theo thứ tự nộp bài khi server chuyển phase "answers".
  if (g.round === "tang_toc") {
    return <TangTocStage state={state} g={g} timer={timer} />;
  }

  // Vòng 2 (Vượt CNV): 3 màn hình riêng biệt, MC điều khiển bằng nút trên bàn MC (display.mode):
  //   - "question" → màn câu hỏi: khung hàng ngang + câu hỏi hiện tại
  //   - "answers"  → màn đáp án các đội gửi về (MC mở dần từng đáp án qua revealedRows)
  //   - "puzzle"/khác → màn bảng mảnh ghép (bộ 5 mảnh: 4 góc + ô trung tâm mở cuối)
  // Chọn ô (selectRow) giữ nguyên màn đang xem — không tự nhảy sang bảng mảnh.
  if (g.round === "vuot_cnv") {
    // Màn Đáp án hiển thị BẤT KỲ lúc nào MC muốn (không phụ thuộc keywordSolved).
    // Nếu chưa có đáp án cho hàng nào, RowResults tự hiển thị trạng thái trống.
    if (d.mode === "answers") {
      return <RowResults state={state} g={g} />;
    }
    return d.mode === "question"
      ? <Round2Question state={state} d={d} g={g} />
      : <Round2Board state={state} g={g} />;
  }

  // Vòng 4 (Về đích): màn hình chuyên dụng — chờ chuẩn bị / đếm ngược 3-2-1 / câu hỏi + đáp án.
  if (g.round === "ve_dich") {
    return <Round4Stage state={state} g={g} timer={timer} />;
  }

  if (d.mode === "question") {
    const isKd = g.round === "khoi_dong";
    if (isKd && d.answerRevealed) {
      return (
        <div className="text-center">
          {d.mediaUrl && (
            <img src={d.mediaUrl} alt="" className="max-h-[26vh] max-w-[42vw] mx-auto rounded-2xl object-contain" />
          )}
          <div className="kicker mt-3">ĐÁP ÁN</div>
          <div className="stage-answer mt-3">{d.answer}</div>
          <div className="text-mist mt-2 text-sm">{state.teams.find((t) => t.id === g.currentTeam)?.name || ""} • Thí sinh {(g.khoiDong?.memberIndex ?? 0) + 1}/{Array.isArray(state.questions?.main?.khoiDong?.[g.currentTeam]) ? state.questions.main.khoiDong[g.currentTeam].length : 1} • Ảnh {(g.questionIndex || 0) + 1}/5</div>
        </div>
      );
    }
    return (
      <div className="text-center">
        {isKd ? (
          <>
            {d.mediaUrl ? (
              <img src={d.mediaUrl} alt="" className="max-h-[30vh] max-w-[60vw] mx-auto rounded-2xl object-contain" />
            ) : (
              <NoMediaFallback />
            )}
            {d.question && <div className="stage-q mt-3 text-[clamp(18px,2.4vw,30px)]">{d.question}</div>}
          </>
        ) : (
          <>
            {d.mediaUrl ? (
              d.mediaType === "video" ? (
                <video src={d.mediaUrl} autoPlay controls className="max-h-[260px] mb-4" />
              ) : (
                <img src={d.mediaUrl} alt="" className="max-h-[220px] rounded-xl mb-4 inline-block" />
              )
            ) : (
              <NoMediaFallback className="w-[min(360px,60vw)] aspect-[4/3] mb-4" />
            )}
          </>
        )}
        {!isKd && d.question && <div className="stage-q">{d.question}</div>}
        {!isKd && d.options?.length > 0 && (
          <div className="grid gap-2.5 mt-5 text-left w-[min(720px,90%)] mx-auto">
            {d.options.map((o) => (
              <div key={o} className="opt cursor-default">{o}</div>
            ))}
          </div>
        )}
        {!isKd && <div className="stage-note">{d.note}</div>}
        {!isKd && d.answerRevealed && <div className="stage-answer">Đáp án: {d.answer}</div>}
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="kicker">Sẵn sàng</div>
      <div className="stage-q mt-2">Chào mừng đến với cuộc thi</div>
      <div className="text-mist mt-4">
        Đã đăng ký {state.contestantCount || 0} thí sinh • Nộp bài {state.submittedCount || 0}
      </div>
      {state.leaderboard?.length > 0 && (
        <div className="text-mist mt-4">
          Dẫn đầu:{" "}
          {state.leaderboard.slice(0, 3).map((c) => `${c.rank}. ${c.name} (${c.score})`).join(" • ")}
        </div>
      )}
    </div>
  );
}

// VÒNG 3 — TĂNG TỐC: màn hình khán giả.
//   • phase "video": CHIỀU VIDEO LÀM TRUNG TÂM (toàn màn hình), không hiện kết quả.
//   • phase "answers" → hiện kết quả (danh sách đáp án + điểm của từng đội).
//     Khán giả dựa TRÊN CÙNG phase của server như màn hình MC để luôn đồng bộ.
// MÀN ĐÁP ÁN — VÒNG 3 (Tăng tốc): dựa theo thiết kế màn đáp án VÒNG 2 — mỗi đội một hàng
// so le (● + tên + đáp án + thời gian) với hiệu ứng xuất hiện r2-row-in. Giữ thứ tự nộp bài
// + thứ hạng (#) và điểm Đúng/Sai như màn chấm — đồng bộ giữa màn khán giả và bàn MC.
function TangTocList({ items, teams, settled, judge }) {
  return (
    <div className="w-full max-w-[1100px] mx-auto">
      <div className="kicker text-center mb-6">
        {judge ? "ĐÁP ÁN CÁC ĐỘI — THEO THỨ TỰ NỘP BÀI" : "ĐÁP ÁN ĐÃ GỬI — THEO THỨ TỰ NỘP BÀI"}
      </div>
      <div className="mx-auto w-[min(900px,94%)]">
        {(items || []).map((it, i) => {
          const t = teams.find((x) => x.id === it.teamId);
          const ok = it.correct === true;
          const bad = it.correct === false;
          const left = i % 2 === 0;
          const answered = !!it.answer && it.answer !== "";
          return (
            <div key={it.teamId} className="r2-row-in" style={{ animationDelay: `${i * 280}ms` }}>
              <div className="flex items-center px-4 py-3.5 justify-center">
                <div className={`flex items-center gap-4 ${left ? "pr-10 pl-2" : "pl-10 pr-2"} w-full max-w-xl`}>
                  <span
                    className={`text-[clamp(14px,1.6vw,20px)] ${it.place ? "!text-gold" : answered ? "" : "text-mist/40"}`}
                    aria-hidden
                  >
                    {it.place ? it.place : "●"}
                  </span>
                  <span
                    className="w-40 shrink-0 font-bold text-[clamp(16px,1.6vw,22px)] truncate"
                    style={{ color: t?.color }}
                  >
                    {t?.name || it.teamId}
                  </span>
                  <span
                    className={`flex-1 text-center font-semibold text-[clamp(15px,1.8vw,22px)] leading-snug px-2 ${
                      answered ? "text-white" : "text-mist/40"
                    }`}
                  >
                    {answered ? `“${it.answer}”` : "—"}
                  </span>
                  <span className="w-24 shrink-0 text-right text-mist font-mono tabular-nums text-sm">
                    {answered && it.elapsed != null ? it.elapsed.toFixed(2) + "s" : ""}
                  </span>
                  {judge && (
                    <span
                      className={`font-display font-bold text-[clamp(18px,2.4vw,30px)] w-14 shrink-0 text-right ${
                        ok ? "text-ok" : bad ? "text-danger" : "text-mist"
                      }`}
                    >
                      {ok ? `+${it.points}` : bad ? "0" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// MÀN HÌNH CHUYÊN DỤNG — Vòng 4 (Về đích): chờ chuẩn bị / đếm ngược / câu hỏi + đáp án.
function Round4Stage({ state, g, timer }) {
  const d = g.display || {};
  const ved = g.veDich || {};
  const phase = ved.phase || "soan";
  const activeTeam = state.teams.find((t) => t.id === g.currentTeam);
  const remaining = timer?.remaining ?? g.timer?.remaining ?? 0;
  const running = timer?.running ?? g.timer?.running;
  const inQuestion = d.mode === "question";
  const teamName = activeTeam?.name || g.currentTeam?.toUpperCase();
  const isStar = ved.starQuestion === (ved.pickIndex ?? 0);

  // ĐẾM NGƯỢC 3 • 2 • 1: chỉ giữ con số đếm lớn + tên đội.
  if (phase === "countdown") {
    return (
      <div className="text-center">
        <div className="font-display font-bold text-[clamp(26px,4vw,52px)]" style={{ color: activeTeam?.color }}>
          {teamName}
        </div>
        <div className={`font-display font-black text-[clamp(80px,20vw,220px)] leading-none mt-2 ${running && remaining <= 3 ? "text-gold" : "text-mist"}`}>
          {remaining > 0 ? remaining : 3}
        </div>
      </div>
    );
  }

  // CHỜ CHUẨN BỊ (soan / ready): chỉ tên đội + trạng thái ngắn gọn.
  if (!inQuestion || !d.question) {
    return (
      <div className="text-center">
        <div className="font-display font-bold text-[clamp(34px,5vw,64px)]" style={{ color: activeTeam?.color }}>
          {teamName}
        </div>
        <div className="text-mist mt-4 text-[clamp(18px,2.6vw,30px)]">
          {phase === "ready" ? "Sẵn sàng thi" : phase === "prep" ? "Chuẩn bị câu kế tiếp" : "Đang chuẩn bị"}
        </div>
      </div>
    );
  }

  // ĐANG TRẢ LỜI: trung tâm chỉ giữ tên đội + ngôi sao; phần câu hỏi + đáp án chuyển
  // xuống khung dưới thanh bar đội (Round4Footer, bố cục tham khảo round 1).
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-3">
        <div className="font-display font-bold text-[clamp(30px,5vw,60px)]" style={{ color: activeTeam?.color }}>
          {teamName}
        </div>
        {isStar && (
          <span className="font-display font-black text-[clamp(22px,3.4vw,42px)] text-ok">★ ×2</span>
        )}
      </div>
    </div>
  );
}

// MÀN CÂU HỎI VÒNG 4 — nằm DƯỚI thanh bar đội: bên trái câu hỏi + đáp án, bên phải ô
// ĐIỂM (phía trên là GÓI CÂU đội đã chọn). Bố cục tham khảo khung dưới round 1.
function Round4Footer({ state, g }) {
  const d = g.display || {};
  const ved = g.veDich || {};
  const activeTeam = state.teams.find((t) => t.id === g.currentTeam);
  const pkg = ved.packagePoints;
  const hasPackage = pkg === 60 || pkg === 80 || pkg === 100;
  const phase = ved.phase || "soan";
  const inQuestion = d.mode === "question" && !!d.question;
  const phaseLabel =
    phase === "countdown"
      ? "Chuẩn bị thi (3 • 2 • 1)…"
      : phase === "prep"
        ? "Chuẩn bị câu hỏi kế tiếp…"
        : phase === "ready"
          ? "Sẵn sàng thi"
          : phase === "answering"
            ? "Chờ MC chiếu câu hỏi…"
            : "MC đang soạn bộ câu…";
  return (
    <div className="flex items-stretch border-t border-[rgba(255,214,10,0.1)]">
      <div className="flex-1 min-w-0 px-5 py-4 text-center flex items-center justify-center border-r border-[rgba(255,214,10,0.1)]">
        {inQuestion ? (
          <div className="w-full">
            {d.question && <div className="stage-q text-[clamp(20px,2.6vw,32px)]">{d.question}</div>}
            {d.options?.length > 0 && (
              <div className="grid gap-2 mt-3 text-left w-[min(560px,100%)] mx-auto">
                {d.options.map((o) => (
                  <div key={o} className="opt cursor-default">{o}</div>
                ))}
              </div>
            )}
            {ved.stealOpen && (
              <div className="font-display font-bold text-[clamp(15px,1.8vw,22px)] text-danger mt-2 animate-pulse">
                Mở chuông giành quyền trả lời!
              </div>
            )}
            {d.answerRevealed && <div className="stage-answer mt-2 text-[clamp(17px,2.2vw,26px)]">Đáp án: {d.answer}</div>}
          </div>
        ) : (
          <div className="font-display text-white/70 text-[clamp(14px,2vw,20px)]">{phaseLabel}</div>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-center justify-center gap-0.5 px-6 py-2.5 bg-[#ffd60a]/15">
        {hasPackage && (
          <div className="kicker text-[10px] tracking-[0.2em] text-white/70">GÓI {pkg}Đ</div>
        )}
        <div className="font-display font-black text-[clamp(28px,3.4vw,44px)] leading-none text-[#ffd60a]">
          {activeTeam?.score ?? 0}
        </div>
        <div className="text-[10px] tracking-[0.2em] text-white/50">ĐIỂM</div>
      </div>
    </div>
  );
}

// Placeholder ĐỒNG BỘ khi câu hỏi đang chiếu nhưng không có ảnh (media) — dùng chung
// cho mọi vòng để màn khán giả thống nhất thay vì mỗi vòng mỗi kiểu/để trống.
function NoMediaFallback({ className = "w-[min(380px,60vw)] aspect-[4/3]" }) {
  return (
    <div className={`mx-auto rounded-2xl bg-panel-solid border border-line grid place-items-center ${className}`}>
      <div className="text-4xl text-mist/40">?</div>
    </div>
  );
}

export function KhoiDongAudience({ state, timer, flash }) {
  const g = state.game || {};
  const d = g.display || {};
  const activeTeam = state.teams.find((t) => t.id === g.currentTeam);
  const bg = state.settings?.audienceBg || "dark";
  const bgUrl = state.settings?.audienceBgUrl || "";
  const useBlur = bg === "blur";
  const rawClusters = state.questions?.main?.khoiDong?.[g.currentTeam];
  const memberTotal = (Array.isArray(rawClusters) ? rawClusters.length : 0) || 1;
  const memberNo = (g.khoiDong?.memberIndex ?? 0) + 1;
  const phase = g.khoiDong?.phase || "play";
  const fallbackImg = `https://picsum.photos/seed/${g.currentTeam}-${memberNo}-${(g.questionIndex || 0) + 1}/800/600`;
  const t = timer || {};
  const kdDur = t.duration || g.khoiDong?.timerSeconds || 60;
  const kdRem = t.remaining ?? kdDur;
  // Progress mượt: gộp dữ liệu server (đếm theo giây) với đồng hồ real-time (rAF) để
  // viền conic chạy liên tục, không giật theo nấc 1 giây. Chốt MỘT LẦN mốc kết thúc
  // (endsAt tuyệt đối từ server, hoặc tính từ remaining) khi đồng hồ vừa chạy; sau đó
  // chỉ đọc Date.now() trong rAF — không re-anchor lại theo từng broadcast game:timer
  // (mỗi 250ms/1s) nên tốc độ luôn đều chứ không bị "nhảy/nghẹt" do khởi động lại.
  const running = !!timer?.running;
  const rawProgress = Math.max(0, Math.min(1, (kdDur - kdRem) / kdDur));
  const [smoothProgress, setSmoothProgress] = useState(rawProgress);
  const [anchor, setAnchor] = useState(null);
  const lastRunning = useRef(false);
  const lastEndsAtRef = useRef(timer?.endsAt);
  useEffect(() => {
    // Không chạy (pause/break/done): dừng rAF, đứng yên theo giá trị server.
    if (phase !== "play" || !running) {
      lastRunning.current = running;
      setAnchor(null);
      setSmoothProgress(rawProgress);
      return;
    }
    // Chỉ chốt lại mốc kết thúc khi đồng hồ VỪA chạy (running false→true) hoặc bắt đầu
    // đồng hồ mới (endsAt mới) — KHÔNG chốt lại mỗi lần broadcast game:timer, nên vòng
    // rAF bên dưới chạy liền mạch cả 60s với tốc độ đều.
    const started = running && (!lastRunning.current || timer?.endsAt !== lastEndsAtRef.current);
    lastRunning.current = running;
    if (started) {
      setAnchor(timer?.endsAt ?? Date.now() + kdRem * 1000);
      lastEndsAtRef.current = timer?.endsAt;
    }
  }, [phase, running, timer?.endsAt, kdRem, rawProgress]);
  useEffect(() => {
    if (!anchor) return;
    let raf = 0;
    const durMs = kdDur * 1000;
    const loop = () => {
      const remMs = Math.max(0, anchor - Date.now());
      const p = Math.max(0, Math.min(1, (durMs - remMs) / durMs));
      setSmoothProgress(p);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [anchor, kdDur]);
  // Hiển thị theo real-time nhưng vẫn bám giá trị server nếu nó nhảy (MC đổi ảnh).
  const timeProgress = phase === "play" ? smoothProgress : 0;

  // Lớp nền dùng CHUNG cho mọi phase — fixed phủ toàn viewport, nằm dưới mọi nội dung
  // (container dùng isolate để tạo stacking context riêng) nên không bao giờ bị mất.
  const bgLayer = (
    <>
      <div className="fixed inset-0 z-0 bg-[#070b16]" />
      {useBlur && bgUrl && (
        <>
          <div
            className="fixed inset-0 z-0 bg-cover bg-center scale-110"
            style={{ backgroundImage: `url(${bgUrl})`, filter: "blur(14px) brightness(0.5)" }}
          />
          <div className="fixed inset-0 z-0 bg-[#070b16]/45" />
        </>
      )}
    </>
  );

  // Chưa bắt đầu lượt (MC chưa chọn đội): khán giả chỉ giữ nền, không hiển thị đội/ảnh mặc định
  if (g.questionStatus === "idle") {
    return <div className="relative isolate min-h-screen overflow-hidden">{bgLayer}</div>;
  }

  // Ring 1 kết thúc — tổng điểm toàn đội
  if (phase === "done") {
    const ranked = (state.teams || []).slice().sort((a, b) => b.score - a.score);
    return (
      <div className="relative isolate min-h-screen overflow-hidden">
        {bgLayer}
        <div className="relative flex flex-col items-center justify-center min-h-screen px-6 z-10">
          <div className="w-full max-w-[1100px] mx-auto rounded-3xl border border-[rgba(255,214,10,0.3)] bg-[#2a3d63]/95 shadow-[0_10px_50px_rgba(0,0,0,0.5)] px-10 py-12">
            <div className="kicker text-center">VÒNG 1 · KHỘIDỌNG</div>
            <div className="font-display font-bold text-[clamp(36px,5vw,64px)] leading-tight text-white text-center mb-8">
              KẼT THÚC — TÔNG ĐIỂM
            </div>
            <div className="flex flex-col gap-4">
              {ranked.map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl border border-[rgba(255,214,10,0.2)] bg-[#1d2c4a]"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display font-bold text-[clamp(22px,2.6vw,34px)] text-white/80">{i + 1}</span>
                    <span className="w-5 h-5 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="font-display font-bold text-[clamp(24px,2.8vw,38px)] text-white truncate">{t.name}</span>
                  </div>
                  <span className="font-display font-bold text-[clamp(24px,2.8vw,38px)] text-[#ffd60a]">{t.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "break") {
    const b = g.khoiDong?.breakInfo || {};
    const inviteTeamId = b.kind === "team" ? b.nextTeamId : b.teamId;
    const inviteTeam = (state.teams || []).find((x) => x.id === inviteTeamId);
    const memberNo = (b.nextMember ?? 0) + 1;
    return (
      <div className="relative isolate min-h-screen overflow-hidden">
        {bgLayer}
        <div className="relative flex flex-col items-center justify-center min-h-screen px-6 z-10 text-center">
          <div className="kicker tracking-[0.35em] text-[#ffd60a]">VÒNG 1 · KHỞI ĐỘNG</div>
          <div className="font-display font-bold text-[clamp(28px,4vw,56px)] text-white/75 mt-6">Mời</div>
          {b.kind === "member" ? (
            <>
              <div className="font-display font-black text-[clamp(44px,7vw,96px)] leading-none text-[#ffd60a] mt-3">
                Thành viên {memberNo}
              </div>
              <div className="font-display font-bold text-[clamp(28px,4vw,56px)] text-white mt-5">
                của đội {inviteTeam?.name || ""}
              </div>
            </>
          ) : (
            <div
              className="font-display font-black text-[clamp(48px,8vw,110px)] leading-none mt-3"
              style={{ color: inviteTeam?.color || "#ffd60a" }}
            >
              Đội {inviteTeam?.name || ""}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate h-screen flex flex-col overflow-hidden">
      {bgLayer}

      {/* Header — tên đội đang thi */}
      <div className="relative flex-none pt-5 pb-2 px-6 text-center z-10">
        <div className="font-display font-bold text-[clamp(28px,4vw,52px)] leading-tight text-white">
          {activeTeam?.name || "…"}
        </div>
      </div>

      {/* Giữa — hình ảnh chiếm to nhất (zachowany margines od viển) */}
      <div className="relative flex flex-col items-center justify-center px-8 min-h-0 flex-1 z-10">
        {d.answerRevealed ? (
          <div className="text-center">
            {(d.mediaUrl || fallbackImg) && (
              <img
                src={d.mediaUrl || fallbackImg}
                alt=""
                className="max-h-full max-w-[80vw] mx-auto rounded-2xl object-contain"
              />
            )}
            <div className="kicker mt-4">ĐÁP ÁN</div>
            <div className="stage-answer mt-3">{d.answer}</div>
            <div className="text-mist mt-2 text-sm">
              {activeTeam?.name || ""} • Thí sinh {memberNo}/{memberTotal} • Ảnh {(g.questionIndex || 0) + 1}/5
            </div>
          </div>
        ) : (
          <div className="text-center">
            {d.mediaUrl ? (
              <img
                src={d.mediaUrl}
                alt=""
                className="max-h-full max-w-[85vw] mx-auto rounded-2xl object-contain"
              />
            ) : (
              <img
                src={fallbackImg}
                alt=""
                className="max-h-full max-w-[85vw] mx-auto rounded-2xl object-contain"
              />
            )}
          </div>
        )}
      </div>

      {/* Dưới — khối tách riêng: thanh bar tên đội + câu hỏi (tách rõ so với ảnh phía trên, margines od viển).
          Chạy thành viền obwódki: conic-gradient złota od góry zgodnie z przez biegiem czasu khi thí sinh trả lời. */}
      <div className="relative flex-none z-10 px-8 pb-5 pt-20">
        <div
          className="rounded-2xl w-full max-w-[1200px] mx-auto"
          style={{
            padding: 4,
            background: phase === "play"
              ? `conic-gradient(from 0deg, #ffd60a calc(${timeProgress * 360}deg), transparent calc(${timeProgress * 360}deg))`
              : "transparent",
          }}
        >
          <div className="w-full rounded-2xl border border-[rgba(255,214,10,0.18)] bg-[#2a3d63] shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
          <div className="flex w-full">
            {(state.teams || []).map((t) => {
              const active = g.currentTeam === t.id;
              return (
                <div
                  key={t.id}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-2 border-r border-[rgba(255,214,10,0.1)] last:border-r-0 transition-colors ${flash === t.id ? "team-buzz" : ""}`}
                >
                  <span
                    className={`font-bold text-[15px] truncate ${
                      active ? "text-white" : "text-black/80"
                    }`}
                  >
                    {t.name}
                  </span>
                  {active && t.score > 0 && (
                    <span className="font-display font-bold text-sm shrink-0 text-white">
                      ({t.score})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-stretch border-t border-[rgba(255,214,10,0.1)]">
            <div className="flex-1 px-4 py-1 text-center flex items-center justify-center border-r border-[rgba(255,214,10,0.1)]">
              <div className="font-display font-bold text-[clamp(20px,2.6vw,34px)] text-white">
                Đây là tế bào/cấu trúc/cơ quan gì?
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-center justify-center gap-0.5 px-6 py-2 bg-[#ffd60a]/15">
              <div className="kicker text-[10px] tracking-[0.2em] text-white/70">{activeTeam?.name || "—"}</div>
              <div className="font-display font-black text-[clamp(28px,3.4vw,44px)] leading-none text-[#ffd60a]">
                {activeTeam?.score ?? 0}
              </div>
              <div className="text-[10px] tracking-[0.2em] text-white/50">ĐIỂM</div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TangTocStage({ state, g, timer }) {
  const d = g.display || {};
  const tt = g.tangToc || {};
  const phase = tt.phase || "video";
  // Đồng hồ CHÍNH THỨC là game:timer trực tiếp (prop timer); state.game.timer được publicGame
  // gửi kèm trong game:state (cập nhật mỗi nửa giây) nên chỉ dùng làm fallback.
  const vidRef = useRef(null);
  // timer có thể null/undefined ngay khi màn hình vừa nạp (game:timer về sau một nhịp).
  // Fallback an toàn tránh crash và tránh chiếu video tự do lệch nhịp.
  const t = timer || {};
  const timerRunning = !!t.running;
  const timerDuration = t.duration || 0;
  const timerRemaining = t.remaining ?? 0;
// ĐỒNG BỘ VIDEO + THỜI GIAN với màn hình MC: mọi màn hình SnAP video theo cùng đồng
      // hồ server (duration - remaining + elapsedBase). Bám khi lệch lớn (>1.2s) để khán
      // giả không lệch so với MC; bám ngay khi video vừa nạp xong (loadedmetadata/canplay)
      // để không bị lệch lúc bắt đầu chiếu. KHÔNG bám sát từng giây (0.15s) vì remaining
      // là số nguyên cập nhật mỗi giây → seek giật làm video tự dừng rồi phát lại.
      // Mở trang muộn (giữa lúc video đang chiếu): QUAN TRỌNG — chưa đúng vị trí thì seek
      // trước rồi MỚI phát (không autoPlay từ 0s rồi nhảy vọt), nên khi vào sau video sẽ hiện
      // đúng đoạn đang chiếu thay vì chạy lại từ đầu / nhảy lung tung.
      useEffect(() => {
        const v = vidRef.current;
        if (!v) return;
        // Video mở ở chế độ muted để trình duyệt cho phép phát; khi video ĐÃ phát được thì
        // bật âm thanh tự động (không cần nút bấm, vẫn hợp autoplay policy).
        const unmute = () => {
          if (v.muted) v.muted = false;
        };
        const apply = () => {
          // Chỉ phát trong phase "video". Phase "preparing" (đếm ngược 3·2·1), "answers"
          // (liệt kê đáp án) hay trước khi MC chiếu → mọi màn hình giữ video dừng lại.
          if (phase !== "video" || d.mode !== "question") {
            v.pause();
            return;
          }
          if (!timerRunning || !timerDuration) {
            v.pause();
            return;
          }
          const elapsed = Math.max(0, timerDuration - timerRemaining) + (tt.elapsedBase || 0);
          const finiteDur = v.duration && isFinite(v.duration) && v.duration > 0;
          const target = Math.min(elapsed, finiteDur ? v.duration : timerDuration);
          // Lệch nhiều (vào giữa lúc đang chiếu / vừa resume): seek + dừng, chờ seeked/canplay.
          if (v.readyState >= 1 && Math.abs(v.currentTime - target) > 1.2) {
            v.currentTime = target;
            v.pause();
            return;
          }
          v.play().then(unmute).catch(() => {});
        };
        apply();
        // Nạp xong / đổi duration / seek xong / phát được → căn ngay (không chờ nhịp 250ms kế).
        v.addEventListener("loadedmetadata", apply);
        v.addEventListener("durationchange", apply);
        v.addEventListener("canplay", apply);
        v.addEventListener("seeked", apply);
        v.addEventListener("playing", unmute);
        return () => {
          v.removeEventListener("loadedmetadata", apply);
          v.removeEventListener("durationchange", apply);
          v.removeEventListener("canplay", apply);
          v.removeEventListener("seeked", apply);
          v.removeEventListener("playing", unmute);
        };
      }, [phase, timerRunning, timerDuration, timerRemaining, d.mediaUrl, d.mode, tt.elapsedBase]);
  // MÀN KHÁN GIẢ chỉ theo d.mode (MC điều khiển, giống Round 2):
  //   • d.mode === "question" → CHIẾU VIDEO
  //   • d.mode === "answers"  → ĐÁP ÁN CÁC ĐỘI
  //   • còn lại               → màn chờ
  const showAnswers = d.mode === "answers";
  const showPrep = phase === "preparing" && d.mode === "question";
  const mcShown = d.mode === "question";
  const submissions = tt.submissions || {};
  const ranked = tt.ranked || [];
  const teams = state.teams || [];
  const active = activeTeamIds(g, teams);
  const hasVideo = !!d.mediaUrl && d.mediaType === "video";

  // Màn đáp án VÒNG 3 giống VÒNG 2 (RowResults): LUÔN hiện đủ các đội đang thi, kể cả đội
  // chưa gửi đáp án (hiển thị "—"). Dữ liệu đáp án gộp từ ranked (ưu tiên, có nhận định của
  // MC) hoặc submissions; đội đã nộp xếp trước theo thời gian thấp → cao, đội chưa nộp ở sau.
  const rankedByTeam = {};
  (ranked || []).forEach((r) => (rankedByTeam[r.teamId] = r));
  const ordered = active
    .map((id) => {
      const t = teams.find((x) => x.id === id);
      const r = rankedByTeam[id];
      const s = submissions[id];
      const answer = r?.answer ?? s?.answer ?? null;
      const answered = !!answer && answer !== "";
      const correct = r
        ? r.correct
        : tt.corrections?.[id] === true
          ? true
          : tt.corrections?.[id] === false
            ? false
            : null;
      return {
        teamId: id,
        answer,
        elapsed: r?.elapsed ?? s?.elapsed ?? null,
        answered,
        correct,
        points: r?.points ?? 0,
        place: r?.place ?? null,
        team: t,
      };
    })
    .sort((a, b) => {
      if (a.answered !== b.answered) return a.answered ? -1 : 1;
      return (a.elapsed ?? Infinity) - (b.elapsed ?? Infinity);
    });

  if (showAnswers) {
    return (
      <div className="w-full">
        <TangTocList items={ordered} teams={teams} settled={tt.settled} judge={true} />
        {tt.settled && d.answer && (
          <div className="kicker text-center mt-6">
            ĐÁP ÁN: <span className="text-white text-[clamp(22px,3vw,36px)]">{d.answer}</span>
          </div>
        )}
        {d.question && <div className="stage-note text-center mt-4">{d.question}</div>}
      </div>
    );
  }

  // Đếm ngược "chuẩn bị chiếu" (3·2·1) — MC chọn câu rồi bấm Chiếu video; đồng bộ trên
  // mọi màn hình nhờ chính đồng hồ server (game:timer, đang đếm TANG_TOC_PREP_SECONDS).
  if (showPrep) {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-4 min-h-[60vh]">
        <div className="kicker text-gold">CHUẨN BỊ CHIẾU VIDEO</div>
        <div className="font-display font-black leading-none text-gold text-[clamp(90px,16vw,190px)]">
          {Math.max(0, timerRemaining)}
        </div>
        <div className="text-mist text-[clamp(16px,2.4vw,28px)] text-center">
          Đếm ngược rồi video sẽ được chiếu — hãy sẵn sàng! Hết video, các đội nộp đáp án theo độ nhanh.
        </div>
      </div>
    );
  }

  // Video đã chiếu xong (phase tự chuyển "answers", nhưng màn khán giả vẫn chưa được MC
  // mở bảng đáp án): hiện MÀN CHỜ chứ KHÔNG tự nhảy sang đáp án.
  if (phase === "answers") {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-5 min-h-[50vh]">
        <div className="kicker text-gold">HẾT GIỜ NỘP BÀI</div>
        <div className="text-mist text-[clamp(16px,2.2vw,26px)] text-center">
          Các đội đã gửi đáp án — chờ MC mở kết quả chấm điểm.
        </div>
      </div>
    );
  }

  // Đang chiếu video — VIDEO LÀM TRUNG TÂM, không hiện kết quả.
  // Chỉ hiện video sau khi MC ĐÃ CHIẾU (display.mode === "question") để màn hình khán giả
  // đồng bộ với MC — trước đó hiện màn chờ.
  if (!mcShown) {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-4 min-h-[50vh]">
        <div className="font-display font-bold text-[clamp(28px,5vw,58px)] text-gold text-center">
          VÒNG 3 — TĂNG TỐC
        </div>
        <div className="text-mist text-[clamp(16px,2.4vw,28px)] text-center">
          Đang chờ MC mở câu hỏi và chiếu video…
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {hasVideo ? (
        <video
          ref={vidRef}
          src={d.mediaUrl}
          muted
          playsInline
          preload="auto"
          className="w-full h-[100vh] object-contain bg-black"
        />
      ) : (
        <div className="w-full aspect-video rounded-2xl bg-panel-solid border border-line grid place-items-center">
          <div className="text-center">
            <div className="text-6xl text-mist/40">▶</div>
            <div className="text-mist mt-2">Chưa có video cho câu này</div>
          </div>
        </div>
      )}
    </div>
  );
}