// kĩ thuật In-Memory Caching (Bộ nhớ đệm trên RAM) kết hợp với Debounced Persistence (Ghi đệm xuống Database).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getConnection } from "../config/database.js";
import {
  TEAM_DEFS,
  TEAM_ORDER,
  ROUNDS,
  emptyPuzzle,
  defaultGame,
  defaultSettings,
} from "../config/constants.js";
import * as Setting from "./Setting.js";
import * as Team from "./Team.js";
import * as Contestant from "./Contestant.js";
import * as Question from "./Question.js";
import * as Media from "./Media.js";
import * as Sound from "./Sound.js";
import * as RoundRules from "./RoundRules.js";
import * as GameState from "./GameState.js";
import { migrateSoundsToUrls } from "../middleware/upload.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "../data");
const DB_JSON_PATH = path.join(DATA_DIR, "db.json");
const SK_PATH = path.join(DATA_DIR, "questions-so-khao.json");
const MAIN_PATH = path.join(DATA_DIR, "questions-main.json");

let db = null;
let writeTimer = null;
// dữ liệu ban đầu của CSDL (nếu chưa có dữ liệu nào được nạp từ file db.json)
export function defaultDb() {
  const soKhao = JSON.parse(fs.readFileSync(SK_PATH, "utf8"));
  const main = JSON.parse(fs.readFileSync(MAIN_PATH, "utf8"));
  return {
    settings: defaultSettings(),
    contestants: [],
    teams: TEAM_DEFS.map((t) => ({ ...t, memberIds: [], score: 0 })),
    questions: { soKhao, main },
    media: [],
    sounds: Sound.emptySounds(),
    rules: {},
    game: defaultGame(),
  };
}

// Rozsiance danych main: khoiDong zwana płuska (câu/�nh lluık) → zjednoluc új boki (thí sinh × 5 caih).
// Odporność na stare dane w BD, aby nowa UI (boki thí sinha) i server działały poprawnie.
function normalizeMainKhoiDong(main) {
  if (!main) return main;
  const fixed = { ...main };
  const normQ = (q) => ({ id: q.id || (q.id ? q.id : ""), answer: q.answer || "", points: q.points || 10, mediaUrl: q.mediaUrl || "", mediaType: q.mediaType || "", ...q });
  const fixedKd = {};
  for (const tid of TEAM_ORDER) {
    const raw = fixed.khoiDong?.[tid] || [];
    if (!Array.isArray(raw) || raw.length === 0) { fixedKd[tid] = []; continue; }
    const asMod = (x) => Array.isArray(x) ? x.filter((q) => q && typeof q === "object") : [];
    let clusters;
    if (Array.isArray(raw[0])) {
      clusters = raw.map((mod) => {
        const qs = asMod(mod);
        return Array.from({ length: 5 }, (_, i) => qs[i] ? normQ(qs[i]) : { id: `kd-${tid}-${i}`, answer: "", points: 10, mediaUrl: "", mediaType: "" });
      });
    } else {
      const flat = asMod(raw);
      clusters = [];
      for (let m = 0; m < 4; m++) {
        const cl = [];
        for (let i = 0; i < 5; i++) cl.push(flat[m * 5 + i] ? normQ(flat[m * 5 + i]) : { id: `kd-${tid}-${m}-${i}`, answer: "", points: 10, mediaUrl: "", mediaType: "" });
        clusters.push(cl);
      }
    }
    fixedKd[tid] = clusters;
  }
  fixed.khoiDong = fixedKd;
  return fixed;
}

// Chuẩn mức điểm câu veDich về mức hợp lệ (10/20/30); dữ liệu cũ có thể là 40đ.
function normalizeVeDichPoints(p) {
  const n = Number(p) || 20;
  if (n <= 10) return 10;
  if (n <= 20) return 20;
  return 30;
}

// Chuẩn hóa dữ liệu câu Về đích về NGÂN HÀNG CHUNG dạng mảng — KHÔNG phụ thuộc số đội.
// Dữ liệu cũ (object { teamId: [câu...] }) được dẹp phẳng thành mảng chung, khử trùng theo id,
// để server (Vòng 4) với bất kỳ số đội nào cũng lấy câu từ cùng một ngân hàng.
export function normalizeMainVeDich(main) {
  if (!main) return main;
  const fixed = { ...main };
  const normQ = (q) => {
    const base = (q && typeof q === "object") ? q : {};
    const points = normalizeVeDichPoints(base.points);
    return { ...base, id: base.id || `vd-migrate-${Math.random().toString(36).slice(2, 8)}`, points, auto: !!base.auto };
  };
  const raw = main.veDich;
  if (Array.isArray(raw)) {
    fixed.veDich = raw.map(normQ);
    return fixed;
  }
  if (raw && typeof raw === "object") {
    const seen = new Set();
    const out = [];
    for (const tid of Object.keys(raw)) {
      const arr = Array.isArray(raw[tid]) ? raw[tid] : [];
      for (const q of arr) {
        if (!q || typeof q !== "object") continue;
        const id = q.id || `vd-migrate-${out.length}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(normQ(q));
      }
    }
    fixed.veDich = out;
    return fixed;
  }
  fixed.veDich = [];
  return fixed;
}

export { normalizeMainKhoiDong };

// roundsView(): danh sách vòng thi HOÀN CHỈNH dùng để gửi client. Luật của từng vòng
// ưu tiên bản admin đã chỉnh (db.rules), không có thì lấy mặc định từ ROUNDS.
export function roundsView(rules = null) {
  const overrides = rules || getDb().rules || {};
  return ROUNDS.map((r) => ({
    ...r,
    rules: Array.isArray(overrides[r.id]) && overrides[r.id].length ? overrides[r.id] : r.rules,
  }));
}

async function persist(data) {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    await Setting.save(conn, data.settings);
    await Team.saveAll(conn, data.teams);
    await Contestant.saveAll(conn, data.contestants);
    await Question.saveSoKhao(conn, data.questions.soKhao);
    await Question.saveMain(conn, data.questions.main);
    await Media.saveAll(conn, data.media || []);
    await Sound.saveAll(conn, data.sounds || Sound.emptySounds());
    await RoundRules.saveAll(conn, data.rules || {});
    await GameState.save(conn, data.game);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
// assemble() sẽ nạp dữ liệu từ CSDL (SQLite / MySQL) và trả về cấu trúc dữ liệu chuẩn của CSDL. 
// Nếu chưa có dữ liệu nào trong CSDL, nó sẽ trả về null.
async function assemble() {
  const conn = await getConnection();
  try {
    const settings = await Setting.load(conn);
    if (!settings) return null;
    const teams = await Team.loadAll(conn);
    const contestants = await Contestant.loadAll(conn);
    const soKhao = await Question.loadSoKhao(conn);
    const main = await Question.loadMain(conn);
    const media = await Media.loadAll(conn);
    const sounds = await Sound.loadAll(conn);
    const rules = await RoundRules.loadAll(conn);
    const game = await GameState.load(conn);
    const fallback = defaultDb();
    // Hợp nhất đội: giữ dữ liệu đội đã có trong DB, tự bổ sung đội mới (e/f) từ TEAM_DEFS.
    const baseTeams = teams.length ? teams : fallback.teams;
    const mergedTeams = fallback.teams.map((def) => {
      const existing = baseTeams.find((t) => t.id === def.id);
      if (existing) return existing;
      return { ...def, memberIds: [], score: 0 };
    });
    // Hợp nhất câu hỏi main: giữ dữ liệu đã lưu, bổ sung khối dữ liệu đội mới (khoiDong e/f)
    // từ JSON để vòng 1 chạy được với 6 đội. veDich là NGÂN HÀNG CHUNG (mảng), không theo đội.
    const dbMain = main || fallback.questions.main;
    const freshMain = fallback.questions.main;
    const mergedMain = { ...dbMain };
    if (!mergedMain.khoiDong) mergedMain.khoiDong = {};
    for (const tid of TEAM_ORDER) {
      if (!mergedMain.khoiDong[tid] && freshMain?.khoiDong?.[tid]) mergedMain.khoiDong[tid] = freshMain.khoiDong[tid];
    }
    if (!mergedMain.veDich) mergedMain.veDich = freshMain?.veDich || [];
    return {
      settings: { ...fallback.settings, ...settings },
      teams: mergedTeams,
      contestants,
      questions: {
        soKhao: soKhao.length ? soKhao : fallback.questions.soKhao,
        main: normalizeMainKhoiDong(normalizeMainVeDich(mergedMain)),
      },
      media,
      sounds,
      rules,
      game: game || defaultGame(),
    };
  } finally {
    conn.release();
  }
}
// loadDb() sẽ nạp dữ liệu từ CSDL (SQLite / MySQL) hoặc từ file db.json (nếu chưa có dữ liệu trong CSDL).
export async function loadDb() {
  const existing = await assemble();
  if (existing) {
    db = existing;
    db.sounds = await migrateSoundsToUrls(db.sounds);
    saveDb();
    return db;
  }
  if (fs.existsSync(DB_JSON_PATH)) {
    const json = JSON.parse(fs.readFileSync(DB_JSON_PATH, "utf8"));
    db = {
      ...defaultDb(),
      ...json,
      settings: { ...defaultDb().settings, ...(json.settings || {}) },
      sounds: { ...Sound.emptySounds(), ...(json.sounds || {}) },
      rules: { ...(json.rules || {}) },
      questions: {
        soKhao: json.questions?.soKhao || defaultDb().questions.soKhao,
        main: normalizeMainKhoiDong(normalizeMainVeDich(json.questions?.main || defaultDb().questions.main)),
      },
    };
    if (!db.game) db.game = defaultGame();
  } else {
    db = defaultDb();
  }
  db.sounds = await migrateSoundsToUrls(db.sounds);
  await persist(db);
  return db;
}

export function getDb() {
  if (!db) throw new Error("CSDL chưa được nạp. Hãy gọi loadDb() khi khởi động.");
  return db;
}

export function saveDb() {
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    persist(db).catch((err) => console.error("Lỗi ghi CSDL:", err.message));
  }, 80);
}

export async function saveDbSync() {
  await persist(db);
}

export async function resetContest(keepQuestions = true) {
  const prev = getDb();
  const next = defaultDb();
  if (keepQuestions) next.questions = prev.questions;
    next.media = prev.media || [];
    next.sounds = prev.sounds || Sound.emptySounds();
    next.rules = prev.rules || {};
    next.settings = { ...next.settings, ...prev.settings, prelimOpen: false };
  db = next;
  await persist(db);
  return db;
}

export { emptyPuzzle, TEAM_DEFS, ROUNDS, defaultGame };
