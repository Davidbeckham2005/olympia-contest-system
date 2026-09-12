  import { getDb, saveDb, resetContest, normalizeMainKhoiDong, normalizeMainVeDich } from "../models/store.js";
  import { SOUND_SLOTS, emptySounds } from "../models/Sound.js";
  import { publicState, adminState } from "../services/state.service.js";
  import * as exam from "../services/exam.service.js";
  import * as vedich from "../services/rounds/veDich.service.js";
  import * as game from "../services/game.service.js";
  import { emitEvent } from "../config/io.js";
  import { uploadToCloudinary } from "../middleware/upload.js";

  export function login(req) {
    if (req.body.pin !== getDb().settings.pin) {
      const err = new Error("Sai mã PIN.");
      err.status = 401;
      throw err;
    }
    return { ok: true };
  }

  export function getState() {
    return adminState();
  }

  export function saveSettings(req) {
    // lấy dữ liệu đang cài đặt trên Ram
    Object.assign(getDb().settings, req.body || {});
    saveDb();
    emitEvent("prelim:update", publicState());
    game.emit();
    return getDb().settings;
  }

  // BTC chỉnh sửa luật chơi từng vòng (danh sách dòng luật theo round id)
  export function saveRoundRules(req) {
    const db = getDb();
    const incoming = (req.body && req.body.rules) || {};
    for (const [round, lines] of Object.entries(incoming)) {
      if (!Array.isArray(lines) || typeof round !== "string") continue;
      const cleaned = lines.map((x) => String(x).trim()).filter(Boolean);
      // Rỗng → trả về luật mặc định của vòng (xoá override trong DB)
      if (cleaned.length) db.rules[round] = cleaned;
      else delete db.rules[round];
    }
    saveDb();
    game.emit();
    emitEvent("prelim:update", publicState());
    return db.rules;
  }

  // BTC nhập trực tiếp thí sinh vào cuộc thi
  export function createContestant(req) {
    const c = exam.registerContestant(req.body || {});
    emitEvent("prelim:update", publicState());
    game.emit();
    return c;
  }

  export function importContestants(req) {
    if (!req.file) {
      const err = new Error("Không có tệp.");
      err.status = 400;
      throw err;
    }
    const name = req.file.originalname || "";
    const buf = req.file.buffer;
    const isXlsx = /\.xlsx?$/i.test(name) || (buf[0] === 0x50 && buf[1] === 0x4b);
    const rows = isXlsx
      ? exam.parseContestantXlsx(buf)
      : exam.parseContestantFile(buf.toString("utf8"), name);
    if (!rows.length) {
      const err = new Error("Không tìm thấy thí sinh trong tệp.");
      err.status = 400;
      throw err;
    }
    const result = exam.importContestants(rows);
    emitEvent("prelim:update", publicState());
    game.emit();
    return result;
  }

  export function deleteContestant(req) {
    const res = exam.deleteContestant(req.params.id);
    emitEvent("prelim:update", publicState());
    game.emit();
    return res;
  }

  export function deleteContestants(req) {
    const res = exam.deleteContestants(req.body.ids || []);
    emitEvent("prelim:update", publicState());
    game.emit();
    return res;
  }

  // Chia đều tất cả thí sinh vào các đội
  export function divideTeams() {
    const teams = exam.divideAllTeams();
    emitEvent("prelim:update", publicState());
    game.emit();
    return teams;
  }

  export function assignTeams(req) {
    const teams = exam.assignTeams(req.body.assignments || []);
    game.emit();
    return teams;
  }

  export async function reset(req) {
    await resetContest(req.body.keepQuestions !== false);
    game.emit();
    emitEvent("prelim:update", publicState());
    return { ok: true };
  }

  export function saveTeams(req) {
    const db = getDb();
    (req.body.teams || []).forEach((patch) => {
      const t = db.teams.find((x) => x.id === patch.id);
      if (!t) return;
      if (patch.name) t.name = patch.name;
      if (patch.color) t.color = patch.color;
      if (patch.pass !== undefined) t.pass = String(patch.pass);
    });
    saveDb();
    game.emit();
    return db.teams;
  }

  export function saveMainQuestions(req) {
    const db = getDb();
    db.questions.main = normalizeMainKhoiDong(normalizeMainVeDich(req.body.main || db.questions.main));
    saveDb();
    // Đẩy game:state đi để mọi màn hình (đặc biệt bàn MC — danh sách câu hỏi
    // Tăng tốc 1·2·3·4) cập nhật NGAY sau khi lưu/upload câu hỏi, không cần click lại.
    game.emit();
    return db.questions.main;
  }

  export function importVeDichQuestions(req) {
    if (!req.file) {
      const err = new Error("Không có tệp.");
      err.status = 400;
      throw err;
    }
    const result = vedich.importVeDichFile(req.file.buffer, req.file.originalname || "");
    // Đẩy trạng thái để màn Admin + bàn MC hiển thị ngay câu vừa import.
    game.emit();
    return result;
  }

  export async function uploadMedia(req) {
    if (!req.file) {
      const err = new Error("Không có tệp.");
      err.status = 400;
      throw err;
    }
    const isVideo = req.file.mimetype.startsWith("video");
    const up = await uploadToCloudinary(req.file.buffer, {
      folder: "cuoc-thi/media",
      resourceType: isVideo ? "video" : "image",
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
    });
    const item = {
      id: crypto.randomUUID(),
      name: req.file.originalname,
      url: up.url,
      type: isVideo ? "video" : "image",
      createdAt: Date.now(),
    };
    getDb().media.push(item);
    saveDb();
    return item;
  }

  export function deleteMedia(req) {
    const db = getDb();
    db.media = db.media.filter((m) => m.id !== req.params.id);
    saveDb();
    return db.media;
  }

  export async function uploadSound(req) {
    const slot = req.params.slot;
    if (!SOUND_SLOTS.includes(slot)) {
      const err = new Error("Slot âm thanh không hợp lệ.");
      err.status = 400;
      throw err;
    }
    if (!req.file) {
      const err = new Error("Không có tệp.");
      err.status = 400;
      throw err;
    }
    // Lưu URL (Cloudinary khi cấu hình, fallback file /uploads) thay vì base64 trong DB
    // → payload state mỗi lần broadcast chỉ là vài trăm byte thay vì hàng MB base64.
    const up = await uploadToCloudinary(req.file.buffer, {
      folder: "cuoc-thi/sounds",
      resourceType: "audio",
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
    });
    const db = getDb();
    db.sounds = { ...emptySounds(), ...(db.sounds || {}) };
    db.sounds[slot] = { name: req.file.originalname, url: up.url };
    saveDb();
    game.emit();
    emitEvent("prelim:update", publicState());
    return db.sounds;
  }

  export function deleteSound(req) {
    const slot = req.params.slot;
    if (!SOUND_SLOTS.includes(slot)) {
      const err = new Error("Slot âm thanh không hợp lệ.");
      err.status = 400;
      throw err;
    }
    const db = getDb();
    db.sounds = { ...emptySounds(), ...(db.sounds || {}) };
    db.sounds[slot] = { url: "", name: "" };
    saveDb();
    game.emit();
    emitEvent("prelim:update", publicState());
    return db.sounds;
  }

  export function setKhoiDongAnswerSeconds(req) {
    const v = Math.max(0, Number(req.body.seconds) || 0);
    game.setKhoiDongAnswerSeconds(v);
    return { ok: true, seconds: v };
  }

  export function setKhoiDongTimerSeconds(req) {
    const v = Math.max(5, Number(req.body.seconds) || 60);
    game.setKhoiDongTimerSeconds(v);
    return { ok: true, seconds: v };
  }
