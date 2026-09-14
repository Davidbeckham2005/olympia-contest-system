let pack = { correct: { url: "" }, wrong: { url: "" }, bg: { url: "" }, wait: { url: "" }, buzz: { url: "" }, answers: { url: "" }, khoi_dong: { url: "" }, result: { url: "" } };
let unlocked = false;
let bedKind = null;
let sfxEl = null;
let bedEl = null;
// Slot sfx đang phát qua phần tử sfx chung — để cắt dứt điểm tệp cũ trước khi phát tệp
// mới và chỉ trả volume nhạc nền đúng khi phần tử phát HẾT trạng thái này.
let currentSfxSlot = null;
// Chống "chồng chéo âm thanh" khi MC bật màn Tổng kết: slot "result" chỉ được phát lại
// sau cửa sổ ngắn (chặn click đúp / event gửi trùng kích chuỗi replay chồng nhau).
// Các slot khác (đúng/sai/đáp án…) KHÔNG áp dụng — MC có thể chấm nhiều lần liên tiếp.
const lastSlotPlay = new Map();
const SLOT_COOLDOWN_MS = 2500;

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

// Hạ/trả volume nhạc nền trong lúc phát âm hiệu (giữ nhạc nền chạy nhưng lặng xuống để
// âm hiệu không đè chồng lên nhạc — tránh cảm giác "hai bài lồng nhau").
function duckBed(on) {
  const { bed } = els();
  if (bed && !bed.paused) bed.volume = on ? 0.1 : 0.4;
}

export function playSfx(slot) {
  const url = pack[slot]?.url;
  const { sfx, bed } = els();
  if (!unlocked) return;
  // Cùng slot "result" trong cửa sổ ngắn (MC bấm đúp / event trùng) → bỏ qua, không
  // replay chồng chất. Các slot khác vẫn phát bình thường (ngắt lẫn nhau là hợp lý).
  const now = Date.now();
  if (slot === "result" && now - (lastSlotPlay.get(slot) || 0) < SLOT_COOLDOWN_MS) return;
  lastSlotPlay.set(slot, now);
  // Slot "result" chưa upload file → tự tổng hợp tiếng "lộ bảng tổng kết" để MC luôn
  // có âm hiệu khi bật màn Tổng kết điểm (upload file trong Admin sẽ thay thế).
  if (!url) {
    if (slot === "result") playResultSting();
    return;
  }
  if (!sfx) return;
  // Âm thanh slot khác đang phát → cắt dứt điểm + trả volume nhạc nền TRƯỚC khi phát
  // tiếng mới; nếu không tiếng cũ vẫn ngân trong lúc tiếng mới đang nổi.
  if (currentSfxSlot && currentSfxSlot !== slot) {
    duckBed(false);
    try {
      sfx.pause();
      sfx.currentTime = 0;
      sfx.onended = null;
    } catch {
      /* ignore */
    }
  }
  currentSfxSlot = slot;
  sfx.src = url;
  sfx.currentTime = 0;
  duckBed(true);
  sfx.onended = () => {
    if (currentSfxSlot === slot) {
      currentSfxSlot = null;
      duckBed(false);
    }
  };
  sfx.play().catch(() => {});
}

// Tiếng hiệu "lộ kết quả" tổng hợp bằng Web Audio (hợp âm rải đi lên, kiểu chương
// trình truyền hình) — dùng làm âm thanh mặc định cho màn TỔNG KẾT ĐIỂM. Dùng CHUNG
// MỘT AudioContext và luôn dừng các nốt cũ còn réo trước khi phát nốt mới — nếu mỗi
// lần bật màn Tổng kết lại tạo context riêng thì các âm rải cũ chưa tắt sẽ chồng nhau
// thành "loạn". Đồng thời hạ nhạc nền xuống như âm hiệu file để không lồng hai bài.
let stingCtx = null;
let stingOscs = [];
let stingEndTimer = null;

function stopSting() {
  for (const osc of stingOscs) {
    try {
      osc.stop();
    } catch {
      /* đã dừng */
    }
  }
  stingOscs = [];
}

function playResultSting() {
  try {
    clearTimeout(stingEndTimer);
    stopSting();
    duckBed(true);
    if (!stingCtx || stingCtx.state === "closed") stingCtx = new AudioContext();
    if (stingCtx.state === "suspended") {
      stingCtx.resume().catch(() => {});
    }
    const ctx = stingCtx;
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
      stingOscs.push(osc);
    });
    // Trả volume nhạc nền sau khi âm rải kết thúc (âm dài ~1.5s).
    stingEndTimer = setTimeout(() => {
      duckBed(false);
      stingOscs = [];
    }, 1500);
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
  const want = bedKind || null;
  const url = want ? pack[want]?.url : "";
  // Màn chờ đầu vòng chưa upload file "wait" → dùng nhạc chờ MẶC ĐỊNH tự tổng hợp (WAV)
  // để màn chờ không bao giờ im lặng; admin upload file trong Admin→Âm thanh sẽ thay thế.
  const effective = want === "wait" && !url ? defaultWaitWav() : url;
  if (!effective) {
    bed.pause();
    bed.removeAttribute("data-kind");
    return;
  }
  if (bed.dataset.kind === want && !bed.paused) return;
  bed.dataset.kind = want;
  if (!bed.src.endsWith(effective)) bed.src = effective;
  bed.volume = 0.4;
  bed.play().catch(() => {});
}

// Nhạc chờ mặc định (slot "wait" chưa có file): tự tổng hợp 1 file WAV nhẹ nhàng chạy lặp —
// kiểu nhạc chờ chương trình truyền hình. Blob URL tạo 1 lần, dùng lại cho mọi màn chờ.
let waitWavUrl = "";

function defaultWaitWav() {
  if (!waitWavUrl) waitWavUrl = synthWaitWav();
  return waitWavUrl;
}

function synthWaitWav() {
  try {
    const sr = 22050;
    // Nốt chờ: rải hợp âm Đô trưởng lên xuống nhẹ, tần số 0 = nghỉ.
    const seq = [
      [261.63, 1.2], [329.63, 1.2], [392.0, 1.2], [523.25, 1.2],
      [392.0, 0.9], [329.63, 0.9], [261.63, 1.6], [0, 0.8],
      [293.66, 1.2], [369.99, 1.2], [440.0, 1.2],
      [369.99, 0.9], [293.66, 0.9], [261.63, 1.6], [0, 1.2],
    ];
    let total = 0;
    for (const [, d] of seq) total += d;
    const n = Math.ceil(total * sr);
    const buf = new Float32Array(n);
    let pos = 0;
    for (const [f, d] of seq) {
      const len = Math.floor(d * sr);
      if (f > 0) {
        const attack = Math.min(len, Math.floor(sr * 0.12));
        const release = Math.min(len, Math.floor(sr * 0.35));
        for (let i = 0; i < len && pos + i < n; i++) {
          const t = i / sr;
          let sample = 0.3 * Math.sin(2 * Math.PI * f * t) + 0.07 * Math.sin(2 * Math.PI * f * 2 * t);
          let env = 1;
          if (i < attack) env = i / attack;
          else if (i > len - release) env = Math.max(0, (len - i) / release);
          buf[pos + i] += sample * env;
        }
      }
      pos += len;
    }
    const bytes = new DataView(new ArrayBuffer(44 + n * 2));
    const writeStr = (off, s) => {
      for (let i = 0; i < s.length; i++) bytes.setUint8(off + i, s.charCodeAt(i));
    };
    writeStr(0, "RIFF");
    bytes.setUint32(4, 36 + n * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    bytes.setUint32(16, 16, true);
    bytes.setUint16(20, 1, true);
    bytes.setUint16(22, 1, true);
    bytes.setUint32(24, sr, true);
    bytes.setUint32(28, sr * 2, true);
    bytes.setUint16(32, 2, true);
    bytes.setUint16(34, 16, true);
    writeStr(36, "data");
    bytes.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const v = Math.max(-1, Math.min(1, buf[i])) * 0x7fff;
      bytes.setInt16(44 + i * 2, v);
    }
    const blob = new Blob([bytes], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  } catch {
    return "";
  }
}

export function bedKindFromGame(g) {
  if (!g) return "wait";
  // Màn hình LUẬT THI: nếu đã upload nhạc luật (slot "khoi_dong") thì phát nhạc luật cho
  // LUẬT THI CỦA MỌI VÒNG (màn "Chiếu luật chơi" dùng chung qua screen.rules).
  // KHÔNG fallback sang nhạc nền "bg": chưa upload nhạc luật thì màn luật IM LẶNG —
  // tránh cảm giác "nhạc nền vẫn đang phát" trong màn luật (chỉ là fallback, rất dễ
  // tưởng nhầm là hai bài đang lồng nhau).
  if (g.display?.mode === "rules") return pack["khoi_dong"]?.url ? "khoi_dong" : null;
  if (
    g.round === "tang_toc" &&
    (g.tangToc?.phase === "preparing" || g.tangToc?.phase === "video") &&
    g.display?.mode === "question" &&
    g.display?.mediaUrl
  ) {
    return null;
  }
  // MÀN CHỜ (chưa vào vòng / chưa chọn hoạt động / vừa mở vòng chưa chiếu câu hỏi) →
  // nhạc chờ slot "wait" cho MỌI vòng — MC vừa bấm mở vòng là có nhạc nền ngay.
  // Kiểm tra TRƯỚC nhánh khoi_dong vì vòng 1 lúc chờ đội (chưa chọn đội / sẵn sàng /
  // đếm lượt / nghỉ giữa vòng) cũng là trạng thái chờ.
  if (!g.round || g.phase === "setup" || g.phase === "finished" || g.questionStatus === "idle") return "wait";
  if (g.round === "khoi_dong") {
    // Khi thí sinh thi (đang trả lời / đang chạy đồng hồ) → nhạc nền chung "bg" như cũ,
    // nhạc hiệu khoi_dong chỉ phát trên màn hình Luật chơi (đã xử lý ở trên).
    return "bg";
  }
  if (g.round === "vuot_cnv") {
    const p = g.puzzle || {};
    if (p.keywordWindow && g.questionStatus !== "showing") return "wait";
  }
  return "bg";
}
