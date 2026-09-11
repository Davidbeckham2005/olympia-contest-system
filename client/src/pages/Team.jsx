import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { socket, on } from "../lib/socket.js";
import { loginTeam } from "../lib/api/team.js";
import { formatTime } from "../lib/format.js";
import { useGameState } from "../lib/useGame.js";
import { optimizeVideoUrl } from "../lib/media.js";
import RulesBoard from "../components/RulesBoard.jsx";
import RoundResultBoard from "../components/RoundResultBoard.jsx";
import { activeTeamIds } from "../lib/teams.js";
import { Round2Board, Round2Question, RowResults, StaggeredRow } from "../components/Round2Stage.jsx";
import { KhoiDongAudience } from "./Audience.jsx";

const SESSION_KEY = "team_session";

// Lý do server từ chối bài nộp hàng ngang Vòng 2 (ack vuotcnv:submit) → thông báo
// rõ cho thí sinh thay vì im lặng mất bài.
const CNV_REASON_MSG = {
  closed: "Đã đóng nhận bài — không gửi được nữa.",
  "row-banned": "Đội bạn đã mất quyền trả lời hàng ngang.",
  "not-open": "Câu hỏi chưa mở — chờ MC hiện câu hỏi.",
  "not-started": "MC chưa chạy đồng hồ — chờ bấm ▶ Bắt đầu giờ.",
  auth: "Phiên đăng nhập hết hạn — hãy đăng nhập lại.",
}

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

export default function Team() {
  const { state, timer } = useGameState();
  const [session, setSession] = useState(loadSession());
  const [pickId, setPickId] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [answer, setAnswer] = useState("");
  const [cnvMsg, setCnvMsg] = useState("");

  const g = state?.game || {};
  const d = g.display || {};
  const team = (state?.teams || []).find((t) => t.id === session?.teamId);

  useEffect(() => {
    if (!session) return undefined;
    loginTeam(session.teamId, session.pass).catch(() => {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
      setErr("Phiên đăng nhập hết hạn — hãy đăng nhập lại.");
    });
    return undefined;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return on("team:error", () => {
      localStorage.removeItem(SESSION_KEY);
      setSession(null);
      setPass("");
      setErr("Phiên đăng nhập không hợp lệ — hãy đăng nhập lại.");
    });
  }, []);

  // Reset ô đáp án Tăng tốc khi MC đổi câu hỏi: câu vòng 3 là video nên d.question
  // có thể KHÔNG đổi giữa các câu → đáp án cũ bị giữ nguyên trong ô, dễ nộp nhầm
  // cho câu mới. Gộp thêm g.questionIndex để luôn reset đúng mỗi lần đổi câu.
  useEffect(() => {
    setAnswer("");
  }, [d.question, g.questionIndex]);

  // Nhấn phím INSERT để giành quyền trả lời chướng ngại vật — bất kỳ lúc nào
  // (không còn bị chặn khi MC đang hiển thị câu hỏi hàng ngang; server tự quyết
  // thời điểm hợp lệ). Bỏ qua khi thí sinh đang gõ vào ô nhập đáp án.
  useEffect(() => {
    if (g.round !== "vuot_cnv") return undefined;
    const enabled =
      !g.puzzle?.keywordSolved &&
      !g.puzzle?.keywordClaim &&
      !(g.puzzle?.keywordBlocked || []).includes(team?.id);
    function onKey(e) {
      if (!enabled) return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const c = e.code || "";
      const k = e.key || "";
      if (c === "Insert" || c === "NumpadInsert" || k === "Insert") {
        e.preventDefault();
        buzz("keyword");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [g.round, g.puzzle?.keywordSolved, g.puzzle?.keywordClaim, g.puzzle?.keywordBlocked, team?.id, buzz]);

  // Nhấn phím INSERT để giành quyền trả lời vòng Về đích khi đối thủ sai (chuông mở).
  useEffect(() => {
    if (g.round !== "ve_dich") return undefined;
    const ved = g.veDich || {};
    const myTeamEliminated = !!state?.teams?.find((t) => t.id === team?.id)?.eliminated;
    const enabled =
      !!g.buzzer?.open &&
      !!ved.stealOpen &&
      !(g.buzzer?.blocked || []).includes(team?.id) &&
      !g.buzzer?.winner &&
      !myTeamEliminated;
    function onKey(e) {
      if (!enabled) return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const c = e.code || "";
      const k = e.key || "";
      if (c === "Insert" || c === "NumpadInsert" || k === "Insert") {
        e.preventDefault();
        buzz("row");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    g.round,
    g.buzzer?.open,
    g.buzzer?.winner,
    g.buzzer?.blocked,
    g.veDich?.stealOpen,
    state?.teams,
    team?.id,
    buzz,
  ]);

  function doLogin(e) {
    e.preventDefault();
    if (!pickId) {
      setErr("Hãy chọn đội của bạn trước.");
      return;
    }
    setErr("");
    loginTeam(pickId, pass)
      .then(() => {
        const s = { teamId: pickId, pass };
        localStorage.setItem(SESSION_KEY, JSON.stringify(s));
        setSession(s);
        setPass("");
      })
      .catch((ex) => {
        if (ex.status === 404) {
          setErr("Server đang chạy bản cũ — hãy dừng (Ctrl+C) rồi chạy lại npm run dev.");
        } else if (/fetch/i.test(ex.message || "")) {
          setErr("Không gọi được máy chủ — hãy chắc chắn server đang chạy (cổng 3001).");
        } else {
          setErr(ex.message || "Đăng nhập thất bại.");
        }
      });
  }

  function buzz(intent = "row") {
    socket.emit("buzzer:press", { teamId: session.teamId, pass: session.pass, intent });
    const url = state?.sounds?.buzz?.url;
    if (url) {
      try {
        const a = new Audio(url);
        a.volume = 1;
        a.play().catch(() => {});
      } catch {
        /* bỏ qua lỗi phát âm thanh */
      }
    }
  }

  function submitTt(e) {
    e.preventDefault();
    if (!answer.trim()) return;
    socket.emit("tangtoc:submit", { teamId: session.teamId, pass: session.pass, answer });
    setAnswer("");
  }

  function submitCnv(e) {
    e.preventDefault();
    if (!answer.trim()) return;
    const val = answer;
    setCnvMsg("");
    // Chỉ được gửi khi server xác nhận (ack) — không xóa ô đáp án nếu bị từ chối,
    // để thí sinh giữ nguyên bài khi MC đóng nhận bài / chưa chạy giờ.
    socket.emit(
      "vuotcnv:submit",
      { teamId: session.teamId, pass: session.pass, answer: val },
      (res) => {
        if (res && res.ok !== false) {
          setAnswer("");
          setCnvMsg("");
        } else {
          setCnvMsg(CNV_REASON_MSG[res?.reason] || "Bài chưa được gửi — thử lại.");
        }
      }
    );
  }

  function quit() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setErr("");
  }

  if (!state) {
    return (
      <div className="min-h-screen grid place-items-center text-mist">
        <div className="text-center">
          <p>Đang kết nối máy chủ…</p>
          <p className="text-sm mt-2">Nếu kéo dài, hãy chắc chắn server đang chạy (cổng 3001).</p>
        </div>
      </div>
    );
  }

  if (!session || !team) {
    return (
      <div className="mx-auto w-[min(720px,calc(100%-24px))] py-8 text-center">
        <Link to="/" className="text-mist hover:text-gold">← Trang chủ</Link>
        <h2 className="font-display text-3xl font-bold mt-3">Giao diện thí sinh</h2>
        <p className="text-mist mt-1">Chọn đội rồi nhập mật khẩu đội để vào phòng thi.</p>

        <div className="grid gap-4 sm:grid-cols-2 mt-6">
          {(state.teams || []).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPickId(t.id)}
              style={{ borderColor: pickId === t.id ? "var(--color-gold)" : t.color }}
              className={`panel text-left cursor-pointer transition hover:-translate-y-0.5 ${
                pickId === t.id ? "shadow-[0_0_0_2px_rgba(255,214,10,0.35)]" : ""
              }`}
            >
              <b style={{ color: t.color }}>{t.name}</b>
              <div className="text-mist text-sm mt-1">
                {t.score} điểm • {(t.members || []).length} thành viên
              </div>
            </button>
          ))}
        </div>

        <form onSubmit={doLogin} className="grid gap-3.5 w-[min(360px,90vw)] mx-auto mt-7 text-left">
          <label className="label-grid">
            Mật khẩu đội
            <input
              type="password"
              autoComplete="off"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Nhập mật khẩu đội…"
            />
          </label>
          <button className="btn disabled:opacity-45" type="submit" disabled={!pickId || !pass}>
            Vào phòng thi
          </button>
        </form>
        {err && <p className="badge badge-no inline-block mt-4">{err}</p>}
      </div>
    );
  }

  const winner = g.buzzer?.winner === team.id;
  const remaining = timer?.remaining ?? g.timer?.remaining ?? 0;
  const running = timer?.running ?? g.timer?.running;
  const canBuzz = !!g.buzzer?.open && !(g.buzzer.blocked || []).includes(team.id) && !g.buzzer.winner;
  const isKd = g.round === "khoi_dong";

  // Đội bị MC loại vĩnh viễn (team.eliminated, nguồn sự thật duy nhất trên DB):
  // MC tự tay khóa — hệ thống không tự loại ai cả.
  if (team.eliminated) {
    return (
      <TeamLayout state={state} team={team} remaining={remaining} running={running} onLogout={quit}>
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="round-badge">ĐÃ BỊ LOẠI</div>
          <p className="text-3xl font-display font-bold text-mist">Đội bạn đã bị loại</p>
          <p className="text-mist">MC đã khóa đội bạn vĩnh viễn khỏi cuộc thi. Quan sát diễn biến trên màn hình lớn.</p>
          <ScoreList teams={state.teams} me={team.id} />
        </div>
      </TeamLayout>
    );
  }

  let body;
  if (d.mode === "rules") {
    // Màn hình LUẬT THI (MC bật qua "screen.rules") — HIỆN FULL-SCREEN giống màn hình
    // MC: RulesBoard giữa màn + nền đồng bộ khán giả + ONLY nút đăng xuất (không header,
    // không sidebar). Khớp 100% giao diện MC để thí sinh xem luật đúng như khán giả.
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center px-5 py-8 text-center isolate overflow-hidden">
        <TeamBackground settings={state?.settings} />
        <div className="absolute top-4 left-4 z-40">
          <button type="button" className="btn btn-ghost py-2! px-3! text-sm" onClick={quit}>
            ← Đăng xuất
          </button>
        </div>
        <RulesBoard state={state} g={g} className="relative z-10" />
      </div>
    );
  } else if (d.mode === "roundResult") {
    // Màn KẾT QUẢ CUỐI VÒNG (MC bật/tắt thủ công qua "screen.roundResult") — full-screen
    // giống màn luật, đồng bộ khán giả.
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center px-5 py-8 text-center isolate overflow-hidden">
        <div className="absolute top-4 left-4 z-40">
          <button type="button" className="btn btn-ghost py-2! px-3! text-sm" onClick={quit}>
            ← Đăng xuất
          </button>
        </div>
        <RoundResultBoard
          state={state}
          g={g}
          bg={state?.settings?.audienceBg}
          bgUrl={state?.settings?.audienceBgUrl}
          className="relative z-10"
        />
      </div>
    );
  } else if (g.phase === "finished") {
    body = <FinalBoard teams={[...state.teams].sort((a, b) => b.score - a.score)} me={team.id} />;
  } else if (isKd) {
    // Round 1 — đồng bộ 100% với màn hình khán giả (cùng component, cùng dữ liệu server).
    body = <KhoiDongAudience state={state} timer={timer} flash={null} />;
  } else if (g.round === "vuot_cnv") {
    body = (
      <Round2Status
        state={state}
        g={g}
        d={d}
      />
    );
} else if (g.round === "tang_toc") {
    const tt = g.tangToc || {};
    const phase = tt.phase || "video";
    // THÍ SINH đồng bộ với KHÁN GIẢ theo ĐÚNG display.mode do MC điều khiển (cộng phase):
    //   1. d.mode "answers" → màn đáp án các đội (hàng so le 4 đội) — giống khán giả
    //   2. phase "preparing" (d.mode question) → đếm ngược 3·2·1
    //   3. phase "answers" → hết giờ nộp bài, chờ MC chốt
    //   4. d.mode khác "question" → chờ MC chiếu
    //   5. còn lại (phase video, d.mode question) → video + danh sách nộp
    const ttAnswers = d.mode === "answers";
    const ttPrep = phase === "preparing" && d.mode === "question";
    const ttGotime = phase === "answers"; // hết video, chờ MC mở kết quả
    const ttWaiting = d.mode !== "question";
    let t3;
    if (ttAnswers) {
      t3 = (
        <>
          <div className="round-badge">TĂNG TỐC — ĐÁP ÁN CÁC ĐỘI</div>
          <TeamTangTocAnswers state={state} g={g} />
        </>
      );
    } else if (ttPrep) {
      t3 = (
        <div className="flex flex-col items-center gap-4">
          <div className="round-badge">TĂNG TỐC — CHUẨN BỊ CHIẾU</div>
          <div className="font-display font-black leading-none text-gold text-[clamp(80px,16vw,160px)]">
            {Math.max(0, remaining)}
          </div>
          <p className="text-mist max-w-md">
            Đếm ngược rồi video sẽ được chiếu trên màn hình lớn. Quan sát thật kỹ, ghi đáp án rồi gửi khi video bắt đầu.
          </p>
        </div>
      );
    } else if (ttGotime) {
      t3 = (
        <>
          <div className="round-badge">TĂNG TỐC — HẾT GIỜ NỘP BÀI</div>
          <p className="text-mist max-w-md">
            Các đội đã gửi đáp án — chờ MC chốt điểm từng đội trên màn hình lớn.
          </p>
        </>
      );
    } else if (ttWaiting) {
      t3 = (
        <>
          <div className="round-badge">TĂNG TỐC</div>
          <p className="text-mist max-w-md">
            Đang chờ MC mở câu hỏi và chiếu video…
          </p>
        </>
      );
    } else {
      // MÀN 1 — CHIẾU VIDEO: chỉ video (đồng bộ khán giả). Đáp án các đội là MÀN RIÊNG
      // (d.mode "answers", MC bấm "Đáp án các đội") — không hiện cùng lúc với video.
      t3 = (
        <>
          <div className="round-badge">TĂNG TỐC — ĐANG CHIẾU VIDEO</div>
          <p className="text-mist max-w-md">
            Quan sát video trên màn hình lớn, ghi đáp án (dạng tự luận) rồi gửi. Nộp nhanh sẽ được cộng nhiều điểm hơn.
          </p>
          <TeamVideo d={d} g={g} timer={timer} />
        </>
      );
    }
    body = <div className="flex flex-col items-center gap-5 w-full max-w-lg">{t3}</div>;
  } else if (g.round === "ve_dich") {
    body = (
      <VeDichBody
        g={g}
        d={d}
        teams={state.teams}
        me={team.id}
        remaining={remaining}
        running={running}
        onBuzz={buzz}
        winnerId={g.buzzer?.winner}
      />
    );
  } else if (g.round === "tie_break") {
    const tb = g.tieBreak || {};
    const isParticipant = (tb.teams || []).includes(team.id);
    const hasBuzzer = g.buzzer?.open && !g.buzzer?.locked && !g.buzzer?.blocked?.includes(team.id) && !g.buzzer?.winner;
    const isWinner = g.buzzer?.winner === team.id;
    body = (
      <div className="flex flex-col items-center gap-5 w-full max-w-lg">
        <div className="round-badge">VÒNG PHỤ</div>
        {!isParticipant ? (
          <p className="text-mist">Đội bạn không tham gia vòng phụ.</p>
        ) : g.questionStatus !== "showing" ? (
          <p className="text-mist">Đang chờ MC mở câu hỏi…</p>
        ) : (
          <>
            <div className="panel w-full text-left">
              <p className="text-ink text-lg">{g.display?.question}</p>
              {g.display?.mediaUrl && (
                <img src={g.display.mediaUrl} alt="" className="mt-2 max-h-48 object-contain" />
              )}
            </div>
            {hasBuzzer && (
              <button type="button" className="btn" onClick={() => buzz("row")}>
                BAM CHUONG
              </button>
            )}
            {isWinner && <p className="badge badge-ok">Ban da bam truoc — cho MC cham</p>}
            {g.buzzer?.winner && !isWinner && (
              <p className="text-mist">Doi <b style={{ color: state.teams.find((t) => t.id === g.buzzer.winner)?.color }}>{state.teams.find((t) => t.id === g.buzzer.winner)?.name}</b> da bam truoc.</p>
            )}
            {g.display?.answerRevealed && (
              <div className="panel w-full">
                <p className="text-mist text-sm">Dap an: <b className="text-gold">{g.display.answer}</b></p>
              </div>
            )}
            {tb.winner && (
              <div className="panel w-full">
                <p className="text-mist text-sm">Thang: <b style={{ color: state.teams.find((t) => t.id === tb.winner)?.color }}>{state.teams.find((t) => t.id === tb.winner)?.name}</b></p>
              </div>
            )}
          </>
        )}
      </div>
    );
  } else {
    body = (
      <>
        <div className="round-badge">Chờ MC bắt đầu</div>
        <p className="text-mist mt-3">Giao diện sẽ tự chuyển theo từng vòng thi.</p>
        <ScoreList teams={state.teams} me={team.id} />
      </>
    );
  }

  // === Khung bố cục thống nhất giữa các vòng (nội dung từng vòng thiết kế sau) ===
  // Round 1: render TRỰC TIẾP màn khán giả (giống hệt — nền, thanh đội, vòng thời gian),
  // chỉ thêm nút đăng xuất nhỏ góc để thí sinh không lẫn màn hình.
  if (isKd) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute top-4 left-4 z-[70]">
          <button type="button" className="btn btn-ghost py-2! px-3! text-sm" onClick={quit}>
            ← Đăng xuất
          </button>
        </div>
        <KhoiDongAudience state={state} timer={timer} flash={null} />
        <TeamsSidebar teams={state.teams || []} currentTeamId={team.id} />
        <div className={`absolute top-4 right-4 z-[80] inline-flex items-center justify-center rounded-xl border border-[rgba(255,214,10,0.45)] bg-[#0e1830]/70 px-5 py-1.5 timer-xl text-4xl ${remaining <= 5 && running ? "timer-danger" : "text-gold"}`}>
          {formatTime(remaining)}
        </div>
      </div>
    );
  }

  // Vòng 2: giao diện riêng — KHÔNG header, đồng hồ đặt bên TRÁI + khung báo ấn CHUÔNG
  // để giành quyền trả lời chướng ngại vật (thay cho nút TỪ KHÓA).
  if (g.round === "vuot_cnv") {
    const waitingBetween = !g.puzzle?.keywordSolved && !!g.puzzle?.keywordWindow && g.questionStatus !== "showing";
    // Bắt đầu đếm giờ (MC bấm "Bắt đầu giờ") thì mới được nhập đáp án tự luận.
    // Đội đoán từ khóa SAI (MC chấm Sai) đã mất quyền → không gõ được nữa.
    const cnvBanned = (g.puzzle?.rowBanned || []).includes(team.id);
    // Cửa nộp bài mở = ô ĐANG MỞ + câu đang hiện + ĐỒNG HỒ ĐANG CHẠY. Dùng timer.running
    // (luồng game:timer realtime) làm nguồn sự thật duy nhất — không còn cờ
    // timingStarted riêng nên MC bấm đồng hồ bằng nút nào cũng đồng bộ với thí sinh
    // (Admin "Bắt đầu giờ"/"Tiếp", nút "▶ Bắt đầu giờ" Vòng 2, hết giờ tự đóng).
    const timerRunning = !!(timer?.running ?? g.timer?.running);
    const r2CanType =
      !cnvBanned &&
      !g.puzzle?.keywordSolved &&
      g.questionStatus === "showing" &&
      g.puzzle?.rowPhase === "open" &&
      timerRunning;
    const r2Submitted = g.puzzle?.submissions?.[team.id];
    const cnvClaimOpen =
      !g.puzzle?.keywordSolved &&
      !g.puzzle?.keywordClaim &&
      !(g.puzzle?.keywordBlocked || []).includes(team.id) &&
      !cnvBanned &&
      g.questionStatus !== "showing";
    const answerBar = cnvBanned ? (
      <div className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-danger">Đoán từ khóa chưa đúng — đội bạn đã mất quyền trả lời hàng ngang.</p>
      </div>
    ) : (
      <div>
        <form onSubmit={submitCnv} className={`flex items-center gap-2 rounded-2xl border px-4 py-3 ${r2CanType ? "border-gold/40" : "border-line"}`}>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={r2CanType ? "Gõ đáp án của đội bạn… (Enter để gửi)" : "Chờ MC bắt đầu đếm giờ…"}
            readOnly={!r2CanType}
            disabled={!r2CanType}
            className="flex-1"
          />
          <button className="btn" type="submit" disabled={!r2CanType || !answer.trim()}>Gửi</button>
        </form>
        {cnvMsg && (
          <div className="mt-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-center text-sm font-semibold text-danger">
            {cnvMsg}
          </div>
        )}
        {r2Submitted && (
          <div className="text-center text-mist text-sm mt-2">
            Đã gửi: <span className="text-gold">{r2Submitted.answer}</span>
          </div>
        )}
      </div>
    );
    return (
      <Round2Layout
        state={state}
        timerCaption={
          waitingBetween && g.display?.mode !== "question"
            ? "CHỜ"
            : formatTime(remaining)
        }
        timerRunning={running}
        timerRemaining={remaining}
        onLogout={quit}
        answerBar={answerBar}
        cnvGuide={cnvClaimOpen}
        currentTeamId={team.id}
        onInsert={() => buzz("keyword")}
        insertEnabled={cnvClaimOpen}
      >
        {body}
      </Round2Layout>
    );
  }

  if (g.round === "tang_toc") {
    const tt = g.tangToc || {};
    const phase = tt.phase || "video";
    const ttSub = tt.submissions?.[team.id];
    // Ô nhập đáp án Tăng tốc — khu vực nộp bài dưới màn hình, giống Vòng 2.
    // Cho phép gửi NHIỀU lần: mỗi lần gửi ghi đè đáp án mới nhất (thí sinh có thể
    // sửa/làm rõ trong cửa sổ trả lời), chỉ chặn khi không còn chiếu video.
    const r3CanType = phase === "video" && !!running;
    const answerBar = (
      <div>
        <form
          onSubmit={submitTt}
          className={`flex items-center gap-2 rounded-2xl border px-4 py-3 ${r3CanType ? "border-gold/40" : "border-line"}`}
        >
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder={
              r3CanType
                ? "Gõ đáp án Tăng tốc… (Enter để gửi)"
                : "Chờ MC chiếu video…"
            }
            readOnly={!r3CanType}
            disabled={!r3CanType}
            className="flex-1"
          />
          <button className="btn" type="submit" disabled={!r3CanType || !answer.trim()}>
            Gửi
          </button>
        </form>
        {ttSub && (
          <div className="text-center text-mist text-sm mt-2">
            Đã gửi: <span className="text-gold">{ttSub.answer}</span>
          </div>
        )}
      </div>
    );
    return (
      <Round2Layout
        state={state}
        timerCaption={running ? formatTime(remaining) : "CHỜ"}
        timerRunning={running}
        timerRemaining={remaining}
        onLogout={quit}
        answerBar={answerBar}
        currentTeamId={team.id}
      >
        {body}
      </Round2Layout>
    );
  }

  if (g.round === "ve_dich") {
    return (
      <Round4Layout state={state} team={team} onLogout={quit} insertHint={d.mode === "question" && !!d.question && !team?.eliminated}>
        {body}
      </Round4Layout>
    );
  }

  return (
    <TeamLayout state={state} team={team} remaining={remaining} running={running} onLogout={quit}>
      {body}
    </TeamLayout>
  );
}

// Bố cục riêng Vòng 2 (thí sinh): KHÔNG header; nền cố định đồng bộ màn khán giả; đồng hồ
// tối giản góc dưới trái; nội dung ở giữa; phía dưới khung báo + nút CHUÔNG giành quyền.
function Round2Layout({ state, timerCaption, timerRunning, timerRemaining, onLogout, answerBar, cnvGuide, currentTeamId, onInsert, insertEnabled, children }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <TeamBackground settings={state?.settings} />
      <div className="absolute top-4 left-4 z-40">
        <button type="button" className="btn btn-ghost py-2! px-3! text-sm" onClick={onLogout}>
          ← Đăng xuất
        </button>
      </div>
      <div className="absolute bottom-4 left-4 z-40">
        <span className={`timer-xl leading-none ${timerRemaining <= 5 && timerRunning ? "timer-danger" : ""}`} style={{ fontSize: "clamp(32px,5vw,64px)" }}>
          {timerCaption}
        </span>
      </div>
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {children}
      </div>
      {answerBar && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(560px,94vw)]">
          {answerBar}
        </div>
      )}
      {onInsert && (
        <div className="absolute bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={insertEnabled ? onInsert : undefined}
            disabled={!insertEnabled}
            title={insertEnabled ? "Giành quyền trả lời chướng ngại vật" : "Chưa thể giành quyền lúc này"}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition active:scale-95 ${
              insertEnabled
                ? "border-gold/60 bg-gold/15 cursor-pointer"
                : "border-white/15 bg-[#0b1120]/85 cursor-not-allowed opacity-60"
            }`}
          >
            <span className={`inline-grid h-8 w-8 place-items-center rounded-md border text-[11px] font-bold ${
              insertEnabled
                ? "border-white/25 bg-gold text-[#1a1400] shadow-[0_0_14px_rgba(255,214,10,0.45)]"
                : "border-white/20 bg-[#13203a] text-white/60"
            }`}>
              INSERT
            </span>
            <span className={`text-sm font-semibold ${insertEnabled ? "text-gold" : "text-white/60"}`}>Giành quyền trả lời</span>
          </button>
        </div>
      )}
      <TeamsSidebar teams={state?.teams || []} currentTeamId={currentTeamId} />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-50 w-px bg-gradient-to-b from-transparent via-white/25 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-50 w-px bg-gradient-to-b from-transparent via-white/25 to-transparent" />
    </div>
  );
}

// Khung báo hướng dẫn ấn CHUÔNG để giành quyền trả lời chướng ngại vật.
function Round2BellFrame({ bell }) {
  let label;
  let hint;
  if (bell.solved) {
    label = "CHƯỚNG NGẠI VẬT ĐÃ CÓ ĐÁP ÁN";
    hint = "Chờ MC chuyển vòng tiếp theo.";
  } else if (bell.claimed) {
    label = "CÓ ĐỘI ĐANG GIỮ QUYỀN TRẢ LỜI";
    hint = "Chờ đội kia nêu đáp án — quan sát màn hình lớn.";
  } else if (bell.blocked) {
    label = "ĐỘI BẠN ĐOÁN CHƯA ĐÚNG";
    hint = "Đã đoán chưa đúng nên không được giành quyền tiếp.";
  } else if (bell.enabled) {
    label = "ẤN NÚT CHUÔNG (HOẶC PHÍM CÁCH) ĐỂ GIÀNH QUYỀN TRẢ LỜI";
    hint = "Khi đã nhìn rõ hình và biết đáp án chướng ngại vật, hãy bấm phím INSERT thật nhanh.";
  } else {
    label = "CHƯA MỞ QUYỀN TRẢ LỜI";
    hint = "Chờ MC mở chuông giành quyền trả lời chướng ngại vật.";
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(560px,94vw)]">
      <div className={`flex items-center gap-4 rounded-2xl border px-5 py-4 ${
        bell.enabled
          ? "bg-gold/15 border-gold/50"
          : "bg-panel-solid border-line"
      }`}>
        <button
          type="button"
          onClick={bell.enabled ? bell.onPress : undefined}
          disabled={!bell.enabled}
          aria-label="Giành quyền trả lời chướng ngại vật"
          className={`grid h-16 w-16 shrink-0 place-items-center rounded-full text-3xl transition active:scale-90 ${
            bell.enabled
              ? "bg-gold text-[#1a1400] shadow-[0_0_28px_rgba(255,214,10,0.55)] animate-pulse"
              : "bg-panel-solid text-mist/45 border border-line cursor-not-allowed"
          }`}
        >
          🔔
        </button>
        <div className="min-w-0 flex-1 text-left">
          <div className={`font-display font-bold tracking-wide ${bell.enabled ? "text-gold" : "text-mist"}`}>
            {label}
          </div>
          <div className="text-mist text-sm mt-0.5">{hint}</div>
        </div>
      </div>
    </div>
  );
}

// Nền cố định đồng bộ MÀN KHÁN GIẢ cho thí sinh (nền tối + ảnh mờ theo cài đặt) —
// dùng chung cho mọi vòng để các màn thí sinh thống nhất.
function TeamBackground({ settings }) {
  const bg = settings?.audienceBg || "dark";
  const bgUrl = settings?.audienceBgUrl || "";
  return (
    <>
      <div className="fixed inset-0 z-0 bg-[#070b16]" />
      {bg === "blur" && bgUrl && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center scale-110"
          style={{ backgroundImage: `url(${bgUrl})`, filter: "blur(14px) brightness(0.5)" }}
        />
      )}
      <div className="fixed inset-0 z-0 bg-[#070b16]/45" />
    </>
  );
}

// Bảng điểm cạnh phải DÙNG CHUNG cho mọi vòng: CHỈ hiện các đội ĐANG THI
// (chưa bị MC khóa vĩnh viễn). Giao diện đen–trắng tối giản: đội mình là ô trắng
// chữ đen, các đội còn lại mờ cùng tông, không màu mè.
function TeamsSidebar({ teams, currentTeamId }) {
  const live = (teams || []).filter((t) => !t.eliminated);
  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-40 min-w-[130px] max-w-[180px]">
      <div className="rounded-xl border border-white/20 bg-[#0b1120]/80 px-2.5 py-1.5">
        {live.map((t) => {
          const isMe = t.id === currentTeamId;
          return (
            <div
              key={t.id}
              className={`flex items-center gap-2 py-1.5 px-2 -mx-2 text-sm whitespace-nowrap rounded transition ${
                isMe
                  ? "bg-white text-black my-0.5"
                  : "border-b border-white/10 last:border-b-0"
              }`}
            >
              <span className={`h-2 w-2 rounded-full shrink-0 ${isMe ? "bg-black" : "bg-white/40"}`} />
              <span className={`font-semibold truncate leading-tight ${isMe ? "text-black" : "text-white/85"}`}>
                {t.name}
              </span>
              <span className={`ml-auto tabular-nums leading-tight ${isMe ? "text-black font-bold" : "text-white/65"}`}>
                {t.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Bố cục tổng thể thống nhất: nút đăng xuất + header + vùng nội dung (có background
// đồng bộ màn khán giả như Vòng 2 — áp dụng cho mọi vòng).
function TeamLayout({ state, team, remaining, running, onLogout, children }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center px-4 py-5 text-center">
      <TeamBackground settings={state?.settings} />
      <div className="absolute top-4 left-4 z-40">
        <button type="button" className="btn btn-ghost py-2! px-3! text-sm" onClick={onLogout}>
          ← Đăng xuất
        </button>
      </div>
      <div className="relative z-10 flex w-full flex-col items-center">
        <Header team={team} remaining={remaining} running={running} />
        <TeamsSidebar teams={state.teams || []} currentTeamId={team.id} />
        <div className="flex-1 flex flex-col items-center justify-center w-full min-w-0">
          {children}
        </div>
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-50 w-px bg-gradient-to-b from-transparent via-white/25 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-50 w-px bg-gradient-to-b from-transparent via-white/25 to-transparent" />
    </div>
  );
}

// Bố cục riêng Vòng 4 (Về đích) — KHÔNG header; vẫn giữ list đội cạnh phải; nền đồng bộ
// khán giả + nút đăng xuất + nội dung ở giữa.
function Round4Layout({ state, team, onLogout, insertHint, children }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center px-4 py-5 text-center">
      <TeamBackground settings={state?.settings} />
      <div className="absolute top-4 left-4 z-40">
        <button type="button" className="btn btn-ghost py-2! px-3! text-sm" onClick={onLogout}>
          ← Đăng xuất
        </button>
      </div>
      <div className="relative z-10 flex w-full flex-col items-center justify-center flex-1">
        {children}
      </div>
      {insertHint && (
        <div className="absolute bottom-4 right-4 z-40 max-w-[260px]">
          <div className="rounded-xl border border-gold/40 bg-[#0b1120]/85 px-4 py-2.5 text-left">
            <p className="text-sm font-semibold text-gold">ĐỐI THỦ SAI — BẤM INSERT</p>
            <p className="text-xs text-mist mt-0.5">Bấm phím INSERT thật nhanh để giành quyền trả lời.</p>
          </div>
        </div>
      )}
      <TeamsSidebar teams={state?.teams || []} currentTeamId={team?.id} />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-50 w-px bg-gradient-to-b from-transparent via-white/25 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-50 w-px bg-gradient-to-b from-transparent via-white/25 to-transparent" />
    </div>
  );
}

// Header thống nhất giữa các vòng: tên đội • điểm • đồng hồ
function Header({ team, remaining, running }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <div className="font-display text-lg font-bold" style={{ color: team.color }}>{team.name}</div>
      <span className="text-mist text-sm">•</span>
      <span className="text-mist text-sm">{team.score} điểm</span>
      <span className={`timer-xl ml-4 text-3xl ${remaining <= 5 && running ? "timer-danger" : ""}`}>
        {formatTime(remaining)}
      </span>
    </div>
  );
}

// Header thống nhất giữa các vòng: tên đội • điểm • đồng hồ
// về MC trong thời gian cho phép (ghi nhận thời gian nộp). Chuông cướp, giành quyền
// cho hàng ngang đã bỏ. Đoán TỪ KHÓA vẫn dùng nút vàng TỪ KHÓA + MC chấm như cũ.
// Giao diện đồng bộ với màn hình Khán giả — 3 màn hình riêng biệt do MC điều khiển
// qua d.mode: câu hỏi (question) / bảng mảnh ghép (puzzle) / đáp án các đội gửi về
// (answers) — thí sinh còn kèm ô nhập đáp án.
function Round2Status({ state, g, d }) {
  const keywordDone = !!g.puzzle?.keywordSolved;

  // Màn hình giống Khán giả, theo d.mode do MC chọn.
  // Phòng MC bấm nhầm sang "Đáp án" giữa lúc còn nhận bài (rowPhase === "open"): thí sinh
  // vẫn ở màn câu hỏi để tiếp tục nộp đáp án, không lộ bài của các đội khác.
  const stillOpen = g.puzzle?.rowPhase === "open";
  const questionMode = (d.mode === "question" || (d.mode === "answers" && stillOpen)) && !keywordDone;
  const answersMode = d.mode === "answers" && !keywordDone && !stillOpen;

  // MÀN CHỜ ĐẦU VÒNG (display.mode "idle"): MC chưa mở câu hỏi nào — KHÔNG tự hiện bảng
  // mảnh ghép. Chờ MC chọn hàng ngang mới có câu hỏi.
  if (d.mode === "idle") {
    return (
      <div className="flex flex-col items-center gap-5 w-full max-w-lg">
        <div className="round-badge">VÒNG 2 — VƯỢT CHƯỚNG NGẠI VẬT</div>
        <p className="text-mist max-w-md">
          Đang chờ MC mở câu hỏi hàng ngang…
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full min-w-0">
      {questionMode ? (
        <Round2Question state={state} d={d} g={g} />
      ) : answersMode ? (
        <RowResults state={state} g={g} />
      ) : (
        <Round2Board state={state} g={g} minimal />
      )}
    </div>
  );
}

// Màn hình ĐỘI — Vòng 4 (Về đích): đồng bộ với MC và khán giả từ cùng g.display + g.veDich.
// Hiện câu hỏi, thông tin ngôi sao, lật đáp án, và nút giành quyền trả lời khi đối thủ trả lời sai.
function VeDichBody({ g, d, teams, me, remaining, running, onBuzz, winnerId }) {
  const ved = g.veDich || {};
  const phase = ved.phase || "soan";
  const cur = teams.find((t) => t.id === g.currentTeam);
  const myTeam = teams.find((t) => t.id === me);
  const eliminated = !!myTeam?.eliminated;
  const star = ved.starQuestion === (ved.pickIndex ?? 0);
  const inQuestion = d.mode === "question" && !!d.question;
  const blocked = (g.buzzer?.blocked || []).includes(me);
  const open = !!g.buzzer?.open;
  const won = winnerId === me;

  // Có thể bấm chuông giành quyền: đang mở chuông (stealOpen), mình chưa bị chặn, chưa có
  // người thắng. Đội ĐÃ BỊ LOẠI không tham gia (server loại bỏ ngay từ đầu khi bấm chuông)
  // nên ẩn luôn nút để không bị tưởng chuông hỏng.
  const canSteal = open && !!ved.stealOpen && !blocked && !winnerId && !eliminated;

  let inner;
  if (phase === "countdown") {
    const n = remaining > 0 ? remaining : 3;
    inner = (
      <div className="text-center">
        <div className="round-badge">Về đích — {cur?.name || g.currentTeam?.toUpperCase()}</div>
        <div className={`font-display font-black text-[clamp(72px,16vw,160px)] leading-none mt-4 ${running ? "text-gold" : "text-mist"}`}>{n}</div>
        <p className="text-mist mt-2">Chuẩn bị thi…</p>
      </div>
    );
  } else if (!inQuestion) {
    inner = (
      <div className="text-center">
        <div className="round-badge">Về đích — {cur?.name || g.currentTeam?.toUpperCase()}</div>
        <p className="text-mist mt-4 text-[clamp(16px,2.4vw,24px)]">
          {phase === "ready"
            ? "Bộ câu đã xác nhận — sẵn sàng thi"
            : phase === "prep"
              ? "Chuẩn bị câu hỏi kế tiếp …"
              : "MC đang soạn bộ câu hỏi… Quan sát màn hình lớn."}
        </p>
      </div>
    );
  } else {
    inner = (
      <div className="flex flex-col items-center w-full max-w-xl">
        <div className="round-badge">Về đích — {cur?.name || g.currentTeam?.toUpperCase()}</div>
        {star && (
          <div className="badge badge-ok text-base! px-4 py-2 mt-3">Ngôi sao hy vọng — điểm ×2</div>
        )}
        <div
          className={`mt-4 inline-flex items-center rounded-xl border border-[rgba(255,214,10,0.45)] bg-[#0e1830]/60 px-5 py-1 timer-xl ${running && remaining <= 5 ? "timer-danger" : "text-gold"}`}
          style={{ fontSize: "clamp(36px,6vw,64px)" }}
        >
          {formatTime(remaining)}
        </div>
        <p className="text-mist text-sm mt-3 max-w-md">
          {running ? "Đang trả lời — đọc kỹ câu hỏi dưới đây." : "Chờ MC bắt đầu đếm giờ trả lời."}
        </p>
        {d.mediaUrl && d.mediaType === "image" && (
          <img src={d.mediaUrl} alt="" className="max-h-[24vh] mx-auto rounded-2xl mt-3 object-contain border border-line" />
        )}
        {d.question && <div className="stage-q mt-3">{d.question}</div>}
        {ved.stealOpen && (
          <div className="badge badge-warn text-base! px-4 py-2 mt-5 animate-pulse">
            {eliminated
              ? "Đội đã bị loại — không giành quyền được"
              : won
                ? "BẠN GIÀNH ĐƯỢC QUYỀN — hãy trả lời!"
                : "Mở chuông giành quyền trả lời"}
          </div>
        )}
        {d.answerRevealed && <div className="stage-answer mt-5">Đáp án: {d.answer}</div>}
        {d.note && <div className="stage-note mt-4">{d.note}</div>}
        {canSteal && (
          <button
            type="button"
            className="mt-7 px-8 py-4 rounded-2xl font-display font-black text-2xl text-[#140d00] bg-gold shadow-[0_0_30px_rgba(255,214,10,0.4)] active:scale-95 transition"
            onClick={() => onBuzz("row")}
          >
            BẤM GIÀNH QUYỀN TRẢ LỜI
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full min-w-0">
      {inner}
    </div>
  );
}

function ScoreList({ teams, me }) {
  return (
    <div className="grid gap-2 w-[min(420px,92%)] mt-5">
      {[...teams].sort((a, b) => b.score - a.score).map((t) => (
        <div
          key={t.id}
          className={`flex justify-between items-center rounded-xl bg-panel-solid border border-line px-4 py-2.5 ${
            t.id === me ? "!border-gold shadow-[0_0_12px_rgba(255,214,10,0.2)]" : ""
          }`}
        >
          <b>{t.name}</b>
          <span>{t.score} điểm</span>
        </div>
      ))}
    </div>
  );
}

// Video Tăng tốc trên màn hình thí sinh: đồng bộ vị trí theo đồng hồ server (giống màn
// khán giả) để thí sinh xem được video trong khi MC chiếu. Muted để không trùng âm thanh
// với màn hình lớn.
function TeamVideo({ d, g, timer }) {
  const ref = useRef(null);
  const tt = g.tangToc || {};
  const running = !!timer?.running;
  const duration = timer?.duration || 0;
  const remaining = timer?.remaining ?? 0;
  const src = optimizeVideoUrl(d.mediaUrl);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const apply = () => {
      if (g.tangToc?.phase !== "video" || d.mode !== "question") {
        v.pause();
        return;
      }
      if (!running || !duration) {
        v.pause();
        return;
      }
      const elapsed = Math.max(0, duration - remaining) + (tt.elapsedBase || 0);
      const finiteDur = v.duration && isFinite(v.duration) && v.duration > 0;
      const target = Math.min(elapsed, finiteDur ? v.duration : duration);
      if (v.readyState >= 1 && Math.abs(v.currentTime - target) > 1.2) {
        v.currentTime = target;
        v.pause();
        return;
      }
      v.play().catch(() => {});
    };
    apply();
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
  }, [src, g.tangToc?.phase, d.mode, running, duration, remaining, tt.elapsedBase]);

  if (!src || d.mediaType !== "video") return null;
  return (
    <video
      ref={ref}
      src={src}
      muted
      playsInline
      preload="auto"
      className="w-full max-w-2xl rounded-2xl border border-line bg-black object-contain shadow-[0_10px_40px_rgba(0,0,0,0.4)]"
    />
  );
}

// Vòng 3 (Tăng tốc): danh sách 4 đội đang thi, mỗi đội một hàng so le (● + tên + đáp án +
// thời gian). Dấu ● là ô TRỐNG: đậm/mờ tùy đội sáng/tối, vị trí lệch trái-phải theo index —
// đúng thiết kế màn đáp án thí sinh.
function TeamTangTocAnswers({ state, g }) {
  const teams = state.teams || [];
  const active = activeTeamIds(g, teams);
  const subs = g.tangToc?.submissions || {};
  return (
    <div className="w-[min(680px,94%)] mx-auto mt-2">
      <div className="kicker text-center mb-3">ĐÁP ÁN CÁC ĐỘI</div>
      <div className="mx-auto w-full">
        {active.map((id, i) => {
          const t = teams.find((x) => x.id === id);
          const s = subs[id];
          return (
            <StaggeredRow
              key={id}
              team={t}
              index={i}
              answer={s?.answer}
              elapsed={s?.elapsed}
            />
          );
        })}
      </div>
    </div>
  );
}

function FinalBoard({ teams, me }) {
  return (
    <div className="grid gap-2 w-[min(420px,92%)] mt-5">
      {teams.map((t, i) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 justify-between rounded-xl bg-panel-solid border border-line px-4 py-2.5 ${
            t.id === me ? "!border-gold shadow-[0_0_12px_rgba(255,214,10,0.2)]" : ""
          }`}
        >
          <span className="text-mist">#{i + 1}</span>
          <b>{t.name}</b>
          <span>{t.score} điểm</span>
        </div>
      ))}
    </div>
  );
}
