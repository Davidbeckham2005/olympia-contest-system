  import { getDb, saveDb, resetContest, normalizeMainKhoiDong, normalizeMainVeDich, normalizeMainTieBreak } from "../models/store.js";
  import { SOUND_SLOTS, emptySounds } from "../models/Sound.js";
  import { publicState, adminState } from "../services/state.service.js";
  import * as exam from "../services/exam.service.js";
  import * as vedich from "../services/rounds/veDich.service.js";
  import * as quickImport from "../services/rounds/quickImport.service.js";
  import * as game from "../services/game.service.js";
  import { emitEvent } from "../config/io.js";
  import { uploadToCloudinary, utf8Name } from "../middleware/upload.js";

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
    db.questions.main = normalizeMainKhoiDong(normalizeMainVeDich(normalizeMainTieBreak(req.body.main || db.questions.main)));
    saveDb();
    // Đẩy game:state đi để mọi màn hình (đặc biệt bàn MC — danh sách câu hỏi
    // Tăng tốc 1·2·3·4) cập nhật NGAY sau khi lưu/upload câu hỏi, không cần click lại.
    game.emit();
    return db.questions.main;
  }

  export async function importQuickQuestions(req) {
    // Nhập nhanh Vòng 1 Khởi động / Vòng phụ từ Excel/CSV; chỉ TRẢ dữ liệu đã parse
    // (ảnh được dò trong db.media đã upload), client ghép vào bản nháp rồi Lưu vòng chính.
    const file = req.files?.file?.[0];
    if (!file) {
      const err = new Error("Không có tệp.");
      err.status = 400;
      throw err;
    }
    const round = req.body.round || req.query.round || "";
    const teamId = (req.body.teamId || req.query.teamId || "").toString();
    if (round === "khoi_dong" && !teamId) {
      const err = new Error("Thiếu đội cần nhập cho Vòng 1 Khởi động.");
      err.status = 400;
      throw err;
    }
    // Ảnh chọn kèm từ thư mục máy cá nhân: upload toàn bộ lên server rồi mới resolve,
    // để các ô Ảnh ghi tên file khớp với db.media.
    const picked = req.files?.images || [];
    for (const img of picked) {
      const origName = utf8Name(img.originalname);
      try {
        const up = await uploadToCloudinary(img.buffer, {
          folder: "cuoc-thi/media",
          resourceType: "image",
          originalname: origName,
          mimetype: img.mimetype || "image/png",
        });
        const db = getDb();
        if (!db.media.some((m) => m.url === up.url && m.name === origName)) {
          db.media.push({
            id: crypto.randomUUID(),
            name: origName,
            url: up.url,
            type: "image",
            createdAt: Date.now(),
          });
          saveDb();
        }
      } catch {
        // Ảnh không upload được → bỏ qua; câu dùng ảnh đó sẽ báo lỗi ở phần resolve.
      }
    }
    const parsed = quickImport.parseQuickImport(file.buffer, file.originalname || "", round);
    if (round === "khoi_dong") {
      parsed.clusters = parsed.units.map((u) => quickImport.buildKhoiDongCluster(u.items, teamId));
    } else if (round === "tie_break") {
      parsed.questions = parsed.questions.map(quickImport.buildTieBreakQuestion);
    }
    return { round, teamId, ...parsed };
  }

  export async function importKhoiDongImages(req) {
    // Nhập nhanh Vòng 1 Khởi động CHỈ bằng ảnh (không Excel): cứ 5 ảnh (theo tên
    // file) = 1 thí sinh, đáp án lấy từ tên file. Chỉ TRẢ dữ liệu đã parse, client
    // ghép vào bản nháp rồi Lưu vòng chính.
    const teamId = (req.body.teamId || req.query.teamId || "").toString();
    if (!teamId) {
      const err = new Error("Thiếu đội cần nhập cho Vòng 1 Khởi động.");
      err.status = 400;
      throw err;
    }
    const images = req.files?.images || [];
    if (!images.length) {
      const err = new Error("Không có ảnh.");
      err.status = 400;
      throw err;
    }
    // Sắp xếp theo tên file (nhận biết số) để thứ tự ảnh ổn định qua các lần nhập.
    const sorted = [...images].sort((a, b) => utf8Name(a.originalname).localeCompare(utf8Name(b.originalname), "vi", { numeric: true }));
    const entries = [];
    const errors = [];
    for (const img of sorted) {
      const origName = utf8Name(img.originalname);
      try {
        const up = await uploadToCloudinary(img.buffer, {
          folder: "cuoc-thi/media",
          resourceType: "image",
          originalname: origName,
          mimetype: img.mimetype || "image/png",
        });
        const db = getDb();
        if (!db.media.some((m) => m.url === up.url && m.name === origName)) {
          db.media.push({
            id: crypto.randomUUID(),
            name: origName,
            url: up.url,
            type: "image",
            createdAt: Date.now(),
          });
          saveDb();
        }
        entries.push({
          media: { mediaUrl: up.url, mediaType: "image", hint: "" },
          answer: quickImport.answerFromImageName(origName),
        });
      } catch {
        // Ảnh không upload được → giữ trống ô ảnh nhưng vẫn giữ đúng vị trí thứ tự.
        entries.push({
          media: { mediaUrl: "", mediaType: "", hint: origName },
          answer: quickImport.answerFromImageName(origName),
        });
        errors.push(`Ảnh "${origName}" không upload được — câu này bỏ trống ảnh.`);
      }
    }
    return {
      teamId,
      added: entries.length,
      clusters: quickImport.buildKhoiDongImageClusters(entries, teamId),
      errors,
    };
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
    const origName = utf8Name(req.file.originalname);
    const up = await uploadToCloudinary(req.file.buffer, {
      folder: "cuoc-thi/media",
      resourceType: isVideo ? "video" : "image",
      originalname: origName,
      mimetype: req.file.mimetype,
    });
    const item = {
      id: crypto.randomUUID(),
      name: origName,
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
