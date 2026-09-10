let pack = { correct: { url: "" }, wrong: { url: "" }, bg: { url: "" }, wait: { url: "" }, buzz: { url: "" }, answers: { url: "" }, khoi_dong: { url: "" } };
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
  if (!url || !sfx || !unlocked) return;
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
  // Màn hình LUẬT THI: phát nhạc nền (slot "bg") tương tự khi đang thi để không lặng im.
  if (g.display?.mode === "rules") return "bg";
  if (
    g.round === "tang_toc" &&
    (g.tangToc?.phase === "preparing" || g.tangToc?.phase === "video") &&
    g.display?.mode === "question" &&
    g.display?.mediaUrl
  ) {
    return null;
  }
  if (g.round === "khoi_dong") {
    const p = g.khoiDong?.phase || "play";
    // Khi MC mở màn hình KHỞI ĐỘNG (đang chơi / chờ giữa câu): ưu tiên nhạc nền riêng
    // slot "khoi_dong"; chưa có file thì dùng nhạc nền chung "bg".
    if (p === "break" || p === "done" || g.questionStatus === "idle") return pack["khoi_dong"]?.url ? "khoi_dong" : "wait";
    return pack["khoi_dong"]?.url ? "khoi_dong" : "bg";
  }
  if (!g.round || g.phase === "setup" || g.phase === "finished" || g.questionStatus === "idle") return "wait";
  if (g.round === "vuot_cnv") {
    const p = g.puzzle || {};
    if (p.keywordWindow && g.questionStatus !== "showing") return "wait";
  }
  return "bg";
}
