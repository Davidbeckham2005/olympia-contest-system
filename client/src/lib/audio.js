let pack = { correct: { url: "" }, wrong: { url: "" }, bg: { url: "" }, wait: { url: "" }, buzz: { url: "" }, answers: { url: "" }, khoi_dong: { url: "" }, result: { url: "" } };
let unlocked = false;
let bedKind = null;
let sfxEl = null;
let bedEl = null;

function els() {
  if (typeof Audio === "undefined") return {};
  if (!sfxEl) sfxEl = new Audio();
  if (!bedEl) {
    bedEl = new Audio();
    bedEl.loop = true;
    bedEl.volume = 0.4;
  }
  return { sfx: sfxEl, bed: bedEl };
}

export function setSoundPack(sounds) {
  pack = { ...pack, ...(sounds || {}) };
}

export function isAudioUnlocked() {
  return unlocked;
}

export function unlockAudio() {
  unlocked = true;
  const { sfx, bed } = els();
  if (sfx) {
    sfx.muted = true;
    sfx.play().then(() => {
      sfx.pause();
      sfx.muted = false;
      sfx.currentTime = 0;
    }).catch(() => {
      sfx.muted = false;
    });
  }
  applyBed();
  return true;
}

export function playSfx(slot) {
  const url = pack[slot]?.url;
  const { sfx, bed } = els();
  if (!unlocked) return;
  // Slot "result" chưa upload file → tự tổng hợp tiếng "lộ bảng tổng kết" để MC luôn
  // có âm hiệu khi bật màn Tổng kết điểm (upload file trong Admin sẽ thay thế).
  if (!url) {
    if (slot === "result") playResultSting();
    return;
  }
  if (!sfx) return;
  sfx.src = url;
  sfx.currentTime = 0;
  if (bed && !bed.paused) {
    bed.volume = 0.1;
    sfx.onended = () => {
      bed.volume = 0.4;
    };
  }
  sfx.play().catch(() => {});
}

// Tiếng hiệu "lộ kết quả" tổng hợp bằng Web Audio (hợp âm rải đi lên, kiểu chương
// trình truyền hình) — dùng làm âm thanh mặc định cho màn TỔNG KẾT ĐIỂM.
function playResultSting() {
  try {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.1);
    master.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.7);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4);
    master.connect(ctx.destination);
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.14;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      osc.connect(g);
      g.connect(master);
      osc.start(t);
      osc.stop(t + 0.85);
    });
  } catch {
    /* ignore */
  }
}

export function setBed(kind) {
  bedKind = kind || null;
  applyBed();
}

function applyBed() {
  const { bed } = els();
  if (!bed || !unlocked) return;
  const url = bedKind ? pack[bedKind]?.url : "";
  if (!url) {
    bed.pause();
    bed.removeAttribute("data-kind");
    return;
  }
  if (bed.dataset.kind === bedKind && !bed.paused) return;
  bed.dataset.kind = bedKind;
  if (!bed.src.endsWith(url)) bed.src = url;
  bed.volume = 0.4;
  bed.play().catch(() => {});
}

export function bedKindFromGame(g) {
  if (!g) return "wait";
  // Màn hình LUẬT THI: vòng Khởi động phát nhạc hiệu riêng (slot "khoi_dong" — nhạc luật
  // chơi), các vòng khác phát nhạc nền chung "bg" để không lặng im.
  if (g.display?.mode === "rules") return g.round === "khoi_dong" && pack["khoi_dong"]?.url ? "khoi_dong" : "bg";
  if (
    g.round === "tang_toc" &&
    (g.tangToc?.phase === "preparing" || g.tangToc?.phase === "video") &&
    g.display?.mode === "question" &&
    g.display?.mediaUrl
  ) {
    return null;
  }
  if (g.round === "khoi_dong") {
    // Khi thí sinh thi (mở vòng / trả lời / nghỉ / kết thúc) → dùng nhạc nền chung "bg",
    // nhạc hiệu khoi_dong chỉ phát trên màn hình Luật chơi (đã xử lý ở trên).
    return "bg";
  }
  if (!g.round || g.phase === "setup" || g.phase === "finished" || g.questionStatus === "idle") return "wait";
  if (g.round === "vuot_cnv") {
    const p = g.puzzle || {};
    if (p.keywordWindow && g.questionStatus !== "showing") return "wait";
  }
  return "bg";
}
