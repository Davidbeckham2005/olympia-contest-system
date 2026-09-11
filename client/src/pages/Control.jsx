import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sendControl, getCurrentQuestion } from "../lib/api/control.js";
import { getPin } from "../lib/session.js";
import { formatTime } from "../lib/format.js";
import { on } from "../lib/socket.js";
import { useGameState } from "../lib/useGame.js";
import { activeTeamIds } from "../lib/teams.js";
import {
  isOpen,
  isLocked,
  isRowPhase,
  keywordGuessOpen,
  cornersDone as allCornersDone,
} from "../lib/cnv.js";
import QuestionScorePanel, { KdScorePanel } from "./control/QuestionScorePanel.jsx";
import RoundKhoiDong from "./control/RoundKhoiDong.jsx";
import RoundVuotCnv from "./control/RoundVuotCnv.jsx";
import RoundTangToc from "./control/RoundTangToc.jsx";
import RoundVeDich from "./control/RoundVeDich.jsx";
import RoundTieBreak from "./control/RoundTieBreak.jsx";

export default function Control() {
  const nav = useNavigate();
  const { state, timer } = useGameState();
  const [current, setCurrent] = useState(null);
  const [customScore, setCustomScore] = useState({});
  const [sortScore, setSortScore] = useState(false);
  const [resetRound, setResetRound] = useState(null);
  const [resetPin, setResetPin] = useState("");
  // Thanh bật/tắt từng nhóm nút trên sidebar (mặc định: mở; nhóm NGUY HIỂM đóng sẵn
  // để tránh vô tình bấm Khóa đội).
  const [groups, setGroups] = useState({ vong: true, manhinh: true, doi: true, nguyhiem: false });
  function toggleGroup(key) {
    setGroups((s) => ({ ...s, [key]: !s[key] }));
  }

  async function refreshQ() {
    try {
      setCurrent(await getCurrentQuestion());
    } catch {
      nav("/dang-nhap?next=/mc");
    }
  }

  useEffect(() => {
    if (!getPin()) {
      nav("/dang-nhap?next=/mc");
      return;
    }
    refreshQ();
    return on("game:state", () => {
      refreshQ();
    });
  }, [nav]); // eslint-disable-line react-hooks/exhaustive-deps

  function act(action, body) {
    return sendControl(action, body).catch((e) => alert(e.message));
  }

  if (!state) return <div className="min-h-screen grid place-items-center text-mist">Đang tải bàn điều khiển…</div>;

  const g = state.game || {};
  const q = current?.question;
  const d = g.display || {};
  const p = g.puzzle || {};
  const cnv = state.cnv;
  const isKd = g.round === "khoi_dong";

  const solved = [0, 1, 2, 3, 4].map((i) => isOpen(p, i));
  const locked = [0, 1, 2, 3, 4].map((i) => isLocked(p, i));
  const cornersDone = allCornersDone(p);
  const cnvRowPhase = g.round === "vuot_cnv" && isRowPhase(p);
  const cnvKeywordPhase = g.round === "vuot_cnv" && keywordGuessOpen(p);

  const showing = d.mode === "question";
  const revealed = !!d.answerRevealed;
  const remaining = timer?.remaining ?? 0;
  const running = timer?.running ?? false;

  function requestRound(id, label) {
    // Bấm vòng khác → chuyển ngay, không cần xác nhận.
    // Bấm lại vòng ĐANG CHẠY = RESET vòng đó từ đầu → cần mật khẩu admin.
    if (g.round === id) {
      setResetPin("");
      setResetRound({ id, label });
      return;
    }
    act("round.start", { round: id });
  }

  const winner = state.teams.find((t) => t.id === g.buzzer?.winner);
  const cur = state.teams.find((t) => t.id === g.currentTeam);
  const answering = winner || cur;

  const rankedById = [...(state.teams || [])]
    .slice()
    .sort((a, b) => b.score - a.score)
    .reduce((acc, t, i) => {
      acc[t.id] = i + 1;
      return acc;
    }, {});
  const maxScore = Math.max(1, ...(state.teams || []).map((t) => t.score));
  const rankBadge = (rank) =>
    rank === 1 ? "1" : rank === 2 ? "2" : rank === 3 ? "3" : `#${rank}`;

  const firstValidIndex = (teamId) => {
    const hist = g.khoiDong?.history?.[teamId] || {};
    const clusters = state.questions?.main?.khoiDong?.[teamId];
    const clustersArr = Array.isArray(clusters) ? clusters : [];
    for (let m = 0; m < clustersArr.length; m++) {
      const cl = Array.isArray(clustersArr[m]) ? clustersArr[m] : [clustersArr[m]];
      const h = hist[m] || {};
      for (let i = 0; i < cl.length; i++) {
        if (typeof h[i] !== "boolean") return { memberIndex: m, questionIndex: i };
      }
    }
    return { memberIndex: 0, questionIndex: 0 };
  };

  // Đội vượt quá 4 hạng (đồng điểm ở ranh giới top 4) — cần vòng phụ để loại.
  const calcExcess = (() => {
    const notEliminated = (state.teams || []).filter((t) => !t.eliminated);
    const all = notEliminated.slice().sort((a, b) => b.score - a.score || 0);
    if (all.length <= 4) return [];
    const fourthScore = all[3]?.score ?? 0;
    return all.filter((t, i) => i >= 4 && t.score >= fourthScore).map((t) => t.id);
  })();
  const excessTeams = calcExcess;

  let pts = q?.points || current?.keywordPoints || 10;
  const veStar = g.round === "ve_dich" && g.veDich?.starQuestion === (g.veDich?.pickIndex ?? 0);
  if (g.round === "ve_dich") {
    pts = (q?.points || g.veDich?.packagePoints || 20) * (veStar ? 2 : 1);
  }

  let status = { cls: "", text: "BẢNG CHÍNH" };
  const kdPhase = isKd ? (g.khoiDong?.phase || "play") : null;
  if (isKd && kdPhase === "done") status = { cls: "ok", text: "KẼT THÚC" };
  else if (isKd && kdPhase === "break") status = { cls: "warn", text: "KHOÀNG NGHỉ — TIẾP" };
  else if (isKd && kdPhase === "countdown") status = { cls: "warn", text: "ĐẾM NGƯỢC 3 • 2 • 1" };
  else if (isKd && showing) status = { cls: "ok", text: "ĐANG THI" };
  else if (isKd) status = { cls: "", text: "CHỰA BẦT DỈ" };
  else if (p.keywordSolved && g.round === "vuot_cnv") status = { cls: "ok", text: "ĐÃ XUẤT TỪ KHÓA" };
  else if (g.round === "vuot_cnv" && p.keywordWindow && !p.keywordSolved && !showing)
    status = p.lastResult
      ? { cls: p.lastResult.correct ? "ok" : "warn", text: p.lastResult.correct ? `ĐÚNG +${p.lastResult.pts} • HÀNG ${p.lastResult.row + 1} MỞ` : `SAI −${Math.abs(p.lastResult.pts || 0)} • HÀNG ${p.lastResult.row + 1} KHÓA` }
      : { cls: "warn", text: "CHỜ CÂU HỎI KẾ TIẾP — CHỌN Ô HOẶC ĐOÁN TỪ KHÓA" };
  else if (showing && revealed) status = { cls: "warn", text: "ĐÃ LẬT ĐÁP ÁN" };
  else if (showing) status = { cls: "ok", text: "ĐANG HIỆN CÂU HỎI" };

  let progress = "";
  if (isKd) {
    const mi = g.khoiDong?.memberIndex ?? 0;
    const clusters = state.questions?.main?.khoiDong?.[g.currentTeam] || [];
    const memberTotal = clusters.length || 1;
    progress = kdPhase === "countdown"
      ? `Đội ${cur?.name || ""} chuẩn bị thi — đếm ngược ${remaining}s`
      : kdPhase === "break"
        ? (g.khoiDong?.breakInfo?.kind === "member"
          ? `Đội ${cur?.name || ""} — thí sinh ${mi + 1} hết. Chuẩn bị thí sinh ${(g.khoiDong?.breakInfo?.nextMember || mi + 1) + 1}.`
          : g.khoiDong?.breakInfo?.kind === "team"
            ? `Đội ${cur?.name || ""} hết. Chuẩn bị đội ${state.teams.find((t) => t.id === g.khoiDong?.breakInfo?.nextTeamId)?.name || ""}.`
            : "Khoàng nghỉ.")
        : `Thí sinh ${mi + 1}/${memberTotal} • Ảnh ${g.questionIndex + 1}/5 • ${cur?.name || ""}`;
  } else if (g.round === "tang_toc") progress = `Câu ${(g.questionIndex || 0) + 1}/4`;
  else if (g.round === "vuot_cnv") {
    const doneCount = solved.filter(Boolean).length;
    const isCenter = (p.currentRow ?? 0) === 4;
    progress = cnvKeywordPhase
      ? `Đoán từ khóa • ${doneCount}/5 mảnh mở`
      : isCenter
        ? `Câu hỏi mảnh ghép trung tâm • ${doneCount}/5 mảnh xong`
        : `Hàng ngang ${(p.currentRow ?? 0) + 1}/4 • ${cornersDone ? 5 : doneCount}/5 mảnh xong`;
  } else if (g.round === "ve_dich") {
    const picked = ((g.veDich?.picked || {})[cur?.id] || []);
    progress = `Câu ${(g.veDich?.pickIndex || 0) + 1}/${picked.length || 4} • ${q?.points || g.veDich?.packagePoints || 20}đ${veStar ? " • Sao ×2" : ""} • ${cur?.name || ""}`;
  }

  const saiText = cnvRowPhase
    ? "không trừ — chấm qua Bài nộp tự luận"
    : g.round === "ve_dich" && veStar
      ? `−${(q?.points || g.veDich?.packagePoints || 20) * 2}`
      : "không trừ";

  const ctx = {
    state,
    g,
    q,
    current,
    d,
    p,
    cnv,
    isKd,
    timer,
    solved,
    locked,
    cornersDone,
    cnvRowPhase,
    cnvKeywordPhase,
    showing,
    revealed,
    remaining,
    running,
    winner,
    cur,
    answering,
    rankedById,
    maxScore,
    firstValidIndex,
    pts,
    status,
    progress,
    saiText,
    act,
    pickTeam: cur?.id || "a",
  };

  return (
    <>
    <div
      className="grid gap-4 px-4 py-5 mx-auto max-w-[1600px] lg:grid-cols-[var(--col-l,240px)_minmax(0,1fr)_var(--col-r,280px)] items-start"
    >
      {/* CỘT TRÁI — Vòng thi / đội, nhóm theo loại nút (mỗi nhóm có thanh bật/tắt) */}
      <aside className="aside-col panel">
        {/* NHÓM 1 · ĐIỀU HƯỚNG — chuyển vòng thi */}
        <SideGroup title="Vòng thi" open={groups.vong} onToggle={() => toggleGroup("vong")}>
          {[
            ["khoi_dong", "Khởi động"],
            ["vuot_cnv", "Vượt CNV"],
            ["tang_toc", "Tăng tốc"],
            ["ve_dich", "Về đích"],
            ["tie_break", "Vòng phụ"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`flex items-center justify-between gap-2 border border-[rgba(255,255,255,0.15)] px-3 py-2.5 text-left transition ${
                g.round === id
                  ? "bg-white/20 ring-1 ring-white/40 text-white"
                  : "bg-[#7d90b8] hover:bg-white/20 text-black/90"
              }`}
              onClick={() => requestRound(id, label)}
            >
              <span className="font-semibold text-sm">{label}</span>
              {g.round === id && (
                <span className="ml-auto text-[10px] tracking-wide text-white/50 uppercase">bấm lại: reset</span>
              )}
            </button>
          ))}
        </SideGroup>

        {/* NHÓM 2 · THAO TÁC PHỤ — hiển thị luật/kết quả trên màn hình lớn */}
        {/* TẠM ẨN theo yêu cầu: nút "Hiện bảng điểm" (scores.show) và "Kết quả cuối"
            (contest.finish) — khôi phục bằng cách bỏ comment 2 dòng button bên dưới. */}
        <SideGroup title="Màn hình" open={groups.manhinh} onToggle={() => toggleGroup("manhinh")}>
          {/*<button type="button" className="border border-[rgba(255,255,255,0.25)] bg-[#7d90b8] px-3 py-2.5 font-semibold text-sm text-black/90 hover:bg-white/20 transition" onClick={() => act("scores.show")}>Hiện bảng điểm</button>*/}
          {/*<button type="button" className="border border-[rgba(255,255,255,0.25)] bg-[#7d90b8] px-3 py-2.5 font-semibold text-sm text-black/90 hover:bg-white/20 transition" onClick={() => act("contest.finish")}>Kết quả cuối</button>*/}
          <button type="button" className={`border px-3 py-2.5 font-semibold text-sm transition ${d.mode === "rules" ? "bg-gold/20 text-white ring-1 ring-gold/50" : "border-[rgba(255,255,255,0.25)] bg-[#7d90b8] text-black/90 hover:bg-white/20"}`} onClick={() => act("screen.rules", { show: d.mode !== "rules" })}>
            {d.mode === "rules" ? "Ẩn luật chơi" : "Chiếu luật chơi"}
          </button>
          <button type="button" className={`border px-3 py-2.5 font-semibold text-sm transition ${d.mode === "roundResult" ? "bg-gold/20 text-white ring-1 ring-gold/50" : "border-[rgba(255,255,255,0.25)] bg-[#7d90b8] text-black/90 hover:bg-white/20"}`} onClick={() => act("screen.roundResult", { show: d.mode !== "roundResult" })}>
            {d.mode === "roundResult" ? "Ẩn kết quả vòng" : "Chiếu kết quả vòng"}
          </button>
        </SideGroup>
{
          // "Đội đang thi" chỉ có nghĩa ở vòng có lượt đội riêng: Vòng 1 (jump câu đội)
          // và Vòng 4 (chuyển lượt trả lời). Vòng 2 / Tăng tốc / Vòng phụ là vòng chung
          // — ẩn hẳn danh sách nút để tránh bấm nhầm đổi currentTeam.
          (isKd || g.round === "ve_dich") && (
        <SideGroup title="Đội đang thi" open={groups.doi} onToggle={() => toggleGroup("doi")}>
          {// Vòng 4: chỉ hiện các đội ĐANG THI (chưa bị khóa vĩnh viễn) — ẩn các đội đã block.
            // Vòng 1 giữ nguyên: MC cần thấy mọi đội trong bảng "Đội đang thi".
            state.teams.filter((t) => g.round !== "ve_dich" || activeTeamIds(g, state.teams).includes(t.id)).map((t) => {
            const active = g.currentTeam === t.id;
            const eliminated = g.round !== "khoi_dong" && !activeTeamIds(g, state.teams).includes(t.id);
            // Vòng 4: chỉ được chuyển đội khi đội đang ở màn soạn câu ("soan"); đang
            // trình/trả lời (prep/countdown/answering) thì khóa các nút.
            const lockedSwitch = g.round === "ve_dich" && !!g.veDich?.phase && g.veDich.phase !== "soan";
            return (
              <button
                key={t.id}
                type="button"
                disabled={eliminated || lockedSwitch}
                onClick={() => {
                  if (isKd) {
                    // Vòng 1: click đội chỉ CHỌN + chuẩn bị; nút "Bắt đầu" mới show
                    // câu hỏi đầu tiên và chạy đồng hồ.
                    act("team.set", { teamId: t.id });
                  } else {
                    act("team.set", { teamId: t.id });
                  }
                }}
                className={`flex items-center gap-3 border border-[rgba(255,255,255,0.15)] px-3 py-2.5 text-left transition ${
                  eliminated
                    ? "bg-[#3a4356] opacity-55 cursor-not-allowed"
                    : lockedSwitch
                      ? "bg-[#3a4356] opacity-70 cursor-not-allowed"
                      : active
                        ? "bg-white/25 ring-1 ring-white/50"
                        : "bg-[#64769e] hover:bg-white/20"
                }`}
              >
                <span className={`flex-1 min-w-0 font-semibold text-sm truncate ${active ? "text-white" : eliminated || lockedSwitch ? "text-black/40" : "text-black/80"}`}>
                  {t.name}
                </span>
                {t.eliminated && (
                  <span className="rounded border border-red-400/50 bg-red-500/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-red-200 uppercase">
                    Bị loại
                  </span>
                )}
                {lockedSwitch && !eliminated && (
                  <span className="rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-100 uppercase">
                    Đang trả lời
                  </span>
                )}
                <span className={`font-display text-lg font-bold ${active ? "text-white" : eliminated || lockedSwitch ? "text-black/40" : "text-black/80"}`}>
                  {t.score}
                </span>
              </button>
            );
          })}
        </SideGroup>
          )}

        {/* NHÓM 4 · NGUY HIỂM — Khóa/Mở khóa đội (LOẠI VĨNH VIỄN), tách khỏi nút chọn
            đội để tránh bấm nhầm. Mặc định ĐÓNG sẵn + mọi thao tác có hộp xác nhận. */}
        {isKd && (
          <SideGroup
            title="Quản lý loại đội — vĩnh viễn"
            danger
            open={groups.nguyhiem}
            onToggle={() => toggleGroup("nguyhiem")}
          >
          {state.teams.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`flex items-center gap-2 border px-3 py-2 text-left transition ${
                t.eliminated
                  ? "border-gold/50 bg-gold/10 hover:bg-gold/20"
                  : "border-danger/40 bg-danger/10 hover:bg-danger/20"
              }`}
              onClick={() => act(t.eliminated ? "tiebreak.restore" : "tiebreak.eliminate", { teamId: t.id })}
            >
              <span className={`flex-1 min-w-0 font-semibold text-sm truncate ${t.eliminated ? "text-gold" : "text-danger"}`}>
                {t.name}
              </span>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ${
                t.eliminated ? "border-gold/50 bg-gold/15 text-gold" : "border-danger/50 bg-danger/20 text-red-200"
              }`}>
                {t.eliminated ? "Bị loại" : "Khóa"}
              </span>
            </button>
          ))}
        </SideGroup>
        )}
      <p className="mt-5">
        <Link to="/admin" className="text-gold underline">Mở trang quản trị</Link>
      </p>
      </aside>

      {/* CỘT GIỮA */}
      <main className="flex flex-col gap-3.5 min-w-0">
        {/* Cảnh báo ngoại lệ đồng điểm top-4 */}
        {excessTeams.length > 0 && (
          <div className="panel border-l-4 border-danger/70 bg-danger/10">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-danger text-base">⚠️</span>
                <div>
                  <div className="text-sm font-semibold text-white">Đồng điểm ranh giới top 4 — cần vòng phụ</div>
                  <div className="text-xs text-mist">
                    Đội cần phân định: {excessTeams.map((id) => state.teams.find((t) => t.id === id)?.name).join(", ")}
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-ghost text-xs py-1!" onClick={() => requestRound("tie_break", "Vòng phụ")}>
                Mở vòng phụ
              </button>
            </div>
          </div>
        )}

        {/* 1 · HIỂN THỊ CÂU HỎI — thời gian · đáp án · ảnh (Round 1) — trên đầu trang */}
        {isKd && g.questionStatus === "idle" && !!g.khoiDong?.ready && kdPhase !== "countdown" && (
          <div className="panel border-gold/40 bg-gold/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">
                Đội {state.teams.find((x) => x.id === g.currentTeam)?.name || "…"} đã sẵn sàng.
              </div>
              <button
                type="button"
                className="btn btn-ok"
                onClick={() => {
                  act("khoi_dong.start", { teamId: g.currentTeam });
                }}
              >
                ▶ Bắt đầu câu hỏi đầu tiên
              </button>
            </div>
          </div>
        )}
        {g.round === "khoi_dong" && <QuestionScorePanel ctx={ctx} />}

        {/* 2 · TRẠNG THÁI (không phải Round 1 — Round 1 gộp đồng hồ vào ô Câu hỏi & đáp án).
           Vòng 2 và Vòng 3 đã gộp đồng hồ + trạng thái vào thanh điều khiển riêng (không hiện panel này).
           Ở đây chỉ hiện đồng hồ lớn khi đang đếm (running). */}
        {g.round !== "khoi_dong" && g.round !== "vuot_cnv" && g.round !== "tang_toc" && running && (
          <div className="panel flex items-center justify-center py-3">
            <span className={`inline-flex items-center justify-center rounded-xl border border-[rgba(255,214,10,0.45)] bg-[#0e1830]/60 px-6 py-2 timer-xl text-4xl ${remaining <= 5 ? "timer-danger" : "text-gold"}`}>
              {formatTime(remaining)}
            </span>
          </div>
        )}

        {/* 3 · QUẢN LÝ CÂU HỎI theo vòng */}
        <RoundVuotCnv ctx={ctx} />
        <RoundVeDich ctx={ctx} />
        <RoundKhoiDong ctx={ctx} />
        <RoundTangToc ctx={ctx} />
        <RoundTieBreak ctx={ctx} />

        {/* 4 · CHẤM ĐIỂM — dưới cùng */}
        <KdScorePanel ctx={ctx} />
      </main>

      {/* CỘT PHẢI — Bảng điểm (gọn, tham khảo cột vòng thi bên trái) */}
      <aside className="aside-col panel">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs tracking-[0.18em] text-mist uppercase">Bảng điểm</div>
          <button
            type="button"
            onClick={() => setSortScore((v) => !v)}
            className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border transition ${
              sortScore
                ? "border-gold/60 text-gold bg-gold/10"
                : "border-[rgba(255,255,255,0.15)] text-mist hover:text-white hover:border-white/30"
            }`}
          >
            Sort
          </button>
        </div>
        <div className="grid gap-1.5">
          {state.teams
            .filter((t) => (isKd ? true : activeTeamIds(g, state.teams).includes(t.id)))
            .slice()
            .sort((a, b) => (sortScore ? b.score - a.score : 0))
            .map((t) => {
              const rank = rankedById[t.id];
              const top = rank <= 3;
              const isBuzzer = g.buzzer?.winner === t.id;
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 border border-[rgba(255,255,255,0.15)] px-2.5 py-1.5 transition ${
                    g.currentTeam === t.id ? "ring-1 ring-white/40" : ""
                  } ${top ? "bg-gold/10 border-gold/40" : "bg-[#7d90b8]/30"}`}
                >
                  <span className={`w-6 shrink-0 text-center font-display font-bold text-sm ${top ? "text-gold" : "text-mist"}`}>
                    {rankBadge(rank)}
                  </span>
                  <span className="w-2.5 h-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
                  <b className={`min-w-0 flex-1 truncate text-sm ${top ? "text-white" : "text-white/85"}`}>{t.name}</b>
                  <span className={`shrink-0 font-display font-bold text-base tabular-nums ${top ? "text-gold" : "text-white/90"}`}>
                    {t.score}
                  </span>
                  {isBuzzer && <span className="badge badge-ok shrink-0 px-1.5! py-0! text-[10px]!">chuông</span>}
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-danger px-1.5! py-0.5! text-xs!"
                      onClick={() => act("score.add", { teamId: t.id, points: -(Number(customScore[t.id] ?? 10) || 0) })}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      className="w-11! rounded border border-line bg-panel-solid px-1 py-0.5! text-center text-xs! tabular-nums"
                      value={customScore[t.id] ?? 10}
                      onChange={(e) => setCustomScore({ ...customScore, [t.id]: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-ok px-1.5! py-0.5! text-xs!"
                      onClick={() => act("score.add", { teamId: t.id, points: Number(customScore[t.id] ?? 10) || 0 })}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </aside>

      {resetRound && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setResetRound(null)}>
          <div className="panel w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold">Reset vòng {resetRound.label}?</h3>
            <p className="text-mist mt-2 text-sm">Toàn bộ trạng thái vòng sẽ được đặt lại. Nhập mật khẩu admin để xác nhận.</p>
            <input
              autoFocus
              type="password"
              placeholder="Mật khẩu admin"
              value={resetPin}
              onChange={(e) => setResetPin(e.target.value)}
              className="mt-3 w-full!"
              onKeyDown={(e) => {
                if (e.key === "Enter" && resetPin) {
                  act("round.start", { round: resetRound.id, pin: resetPin });
                  setResetRound(null);
                  setResetPin("");
                }
              }}
            />
            <div className="flex gap-2 mt-4">
              <button type="button" className="btn flex-1" onClick={() => setResetRound(null)}>Hủy</button>
              <button
                type="button"
                disabled={!resetPin}
                className="btn btn-danger flex-1"
                onClick={() => {
                  act("round.start", { round: resetRound.id, pin: resetPin });
                  setResetRound(null);
                  setResetPin("");
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}

// Thanh bật/tắt (accordion) cho từng nhóm nút trên sidebar — phân loại rõ: điều hướng
// (vòng thi), hiển thị (màn hình), thao tác chính (đội đang thi) và nguy hiểm (loại đội).
function SideGroup({ title, open, onToggle, danger = false, children }) {
  return (
    <section className={danger ? "rounded-sm border border-danger/40 px-2 pt-1.5 pb-2" : "border-b border-line/70 pb-3"}>
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-2 py-1 text-left transition ${
          danger ? "text-danger hover:text-red-200" : "text-mist hover:text-white"
        }`}
        title={open ? "Thu gọn nhóm" : "Mở rộng nhóm"}
      >
        <span className="text-xs tracking-[0.18em] uppercase font-semibold">{title}</span>
        <span className={`shrink-0 text-[10px] transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
      </button>
      {open && <div className="grid gap-2">{children}</div>}
    </section>
  );
}
