// MODULE VÒNG 4 — Về đích (ve_dich).
//
// Dữ liệu câu hỏi được Admin GÁN CỐ ĐỊNH theo đội + gói NGAY KHI NHẬP TỪ EXCEL —
// không phải chia ngẫu nhiên lúc thi. Mỗi câu trong db.questions.main.veDich mang:
//   teamId ("a".."f") — câu thuộc đội nào;
//   pkg (60 | 80 | 100) — câu thuộc gói nào của đội đó;
//   order (1..4) — vị trí câu trong gói.
// Mỗi đội được chuẩn bị 3 GÓI (60/80/100), mỗi gói ĐÚNG 4 câu theo cấu trúc cố định:
//   Gói 60  = câu 10 + 10 + 20 + 20
//   Gói 80  = câu 10 + 20 + 20 + 30
//   Gói 100 = câu 20 + 20 + 30 + 30
// Vì vậy mỗi đội có sẵn 12 câu = 3×10 + 6×20 + 3×30 (đủ mọi tổ hợp). Lúc thi, MC chọn
// 1 trong 3 gói ĐÃ DỰNG SẴN của đội; server load đúng 4 câu cố định đó — không bốc
// ngẫu nhiên, không khử trùng qua usedQuestionIds (mỗi đội dùng câu riêng của mình,
// không giao cho đội khác). Câu KHÔNG có teamId/pkg là câu spare (không đưa ra thi).
//
// Câu hỏi thuộc các mức 10đ/20đ/30đ; thời gian trả lời theo ANSWER_SECONDS.
// Hệ thống KHÔNG tự tạo câu nháp (auto) — Admin phải nhập/import cho đủ; khi thiếu,
// MC báo lỗi rõ khi chọn gói. Giữ cơ chế Ngôi sao hy vọng (x2 điểm, sai trừ gấp đôi).
//
// Tách riêng logic này khỏi game.service.js để giảm phức tạp và tránh lỗi phát sinh
// (giống vuotCnv.service.js cho Vòng 2). Module này TỰ quản lý saveDb/emit và nhận
// các hàm dùng chung qua init() — tránh import vòng (circular).
//
// Cách dùng (từ game.service.js):
//   import * as vedich from "./rounds/veDich.service.js";
//   vedich.init({ emit });
//   vedich.selectPackage(80); vedich.setStar(true); ...

import { getDb, saveDb } from "../../models/store.js";
import XLSX from "xlsx";

// Các hàm dùng chung được game.service.js tiêm vào khi khởi động module.
let emit = () => { };

export function init(deps) {
  if (!deps) return;
  if (deps.emit) emit = deps.emit;
}

function g() {
  return getDb().game;
}

// Mức điểm câu hỏi → số giây trả lời (Vòng 4):
//   10đ → 20s, 20đ → 30s, 30đ → 40s.
export const ANSWER_SECONDS = { 10: 20, 20: 30, 30: 40 };

// Các gói câu hỏi hợp lệ của Vòng 4 (tổng điểm gói → cấu trúc 4 câu).
export const PACKAGES = {
  60: [10, 10, 20, 20],
  80: [10, 20, 20, 30],
  100: [20, 20, 30, 30],
};

// Trạng thái mặc định khi vào vòng / reset.
export function defaultState() {
  return {
    packagePoints: null,
    // Ngôi sao hy vọng: mỗi đội được chọn đúng 1 câu duy nhất. starQuestion = vị trí câu
    // (pickIndex) được gắn sao; null = chưa chọn. Chọn TRƯỚC khi hiện câu (ready/prep),
    // khi đang trả lời không đổi được.
    starQuestion: null,
    answeringTeam: "a",
    stealOpen: false,
    // Ngữ cảnh đội chọn câu đã trả lời SAI (đang chờ kết quả cướp quyền): điểm trừ của đội
    // chọn câu chỉ được quyết định khi cửa sổ cướp quyền kết thúc. null = không treo.
    stealPending: null,
    // Đã chốt bộ 4 câu cho đội hiện tại chưa? (false = MC đang soạn/chỉnh, true = đưa cho thí sinh thi)
    locked: false,
    // Giai đoạn thi: "soan" (chưa chốt) | "countdown" (đang đếm 3-2-1) | "answering" (đang trả lời)
    phase: "soan",
    // Các câu hỏi ĐÃ CHỌN cho từng đội (mỗi đội đúng 1 gói = 4 câu, mảng các id tham chiếu
    // đến câu đã gán teamId/pkg trong db.questions.main.veDich). Khóa được tạo động khi đội
    // chọn gói — không hard-code số đội.
    picked: {},
    // Câu đang thi trong danh sách picked của đội hiện tại.
    pickIndex: 0,
    // (Giữ field để tương thích dữ liệu cũ.) Không còn dùng để khử trùng: câu đã GÁN CỐ ĐỊNH
    // theo đội/gói từ Excel nên không bao giờ bị chọn trùng cho đội khác.
    usedQuestionIds: [],
  };
}

// Nhu cầu câu của MỘT đội theo mức điểm trong 1 bộ 12 câu CỐ ĐỊNH (3 gói 60/80/100):
//   gói 60 (10,10,20,20) + gói 80 (10,20,20,30) + gói 100 (20,20,30,30)
//   → 3×10 + 6×20 + 3×30.
export const TEAM_PACKAGE_LEVELS = { 10: 3, 20: 6, 30: 3 };
// Cần đủ cho 4 đội thi vòng 4: 12×10 + 24×20 + 12×30 = 48 câu (2 đội còn lại nếu rơi
// vào top 4 sẽ cần Admin bổ sung từ Excel). Giữ hằng này để hiển thị/kiểm tra nhanh.
export const BANK_REQUIREMENTS = { 10: 12, 20: 24, 30: 12 };
export const BANK_TOTAL = Object.values(BANK_REQUIREMENTS).reduce((a, b) => a + b, 0);

// Chuẩn mức điểm câu về mức hợp lệ của vòng 4 (10/20/30). Dữ liệu cũ có thể để 40đ.
function normalizePoints(p) {
  const n = Number(p) || 20;
  if (n <= 10) return 10;
  if (n <= 20) return 20;
  return 30;
}

// Chuyển ngân hàng câu veDich về mảng chuẩn, GIỮ NGUYÊN teamId/pkg/order.
// Dữ liệu cũ (object { teamId: [câu...] }) được dẹp phẳng thành mảng chung, khử trùng theo id
// và chuẩn mức điểm về 10/20/30. Nếu đã là mảng thì giữ nguyên (chỉ chuẩn từng câu).
export function normalizeBank(list) {
  if (list && typeof list === "object" && !Array.isArray(list)) {
    const seen = new Set();
    const out = [];
    for (const tid of Object.keys(list)) {
      const arr = Array.isArray(list[tid]) ? list[tid] : [];
      for (const q of arr) {
        if (!q || typeof q !== "object") continue;
        const id = q.id || `vd-migrate-${out.length}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const rest = { ...q };
        delete rest.auto;
        out.push({
          id,
          question: q.question || "",
          answer: q.answer || "",
          ...rest,
          points: normalizePoints(q.points),
          teamId: q.teamId || undefined,
          pkg: [60, 80, 100].includes(Number(q.pkg)) ? Number(q.pkg) : undefined,
          order: Number.isInteger(Number(q.order)) && Number(q.order) > 0 ? Number(q.order) : undefined,
        });
      }
    }
    return out;
  }
  const arr = Array.isArray(list) ? list : [];
  return arr.map((q) => {
    if (!q || typeof q !== "object") return q;
    const rest = { ...q };
    delete rest.auto;
    return {
      ...rest,
      points: normalizePoints(q.points),
      pkg: [60, 80, 100].includes(Number(q.pkg)) ? Number(q.pkg) : q.pkg,
      order: Number.isInteger(Number(q.order)) && Number(q.order) > 0 ? Number(q.order) : q.order,
    };
  });
}

// Tham chiếu mảng veDich trong db.questions.main (mảng có teamId/pkg/order).

// Kiểm tra & chuẩn hóa dữ liệu veDich — KHÔNG tự tạo câu nháp.
// normalize + giữ dữ liệu cũ. Trả về trạng thái thiếu theo MỨC ĐIỂM cho 4 đội top 4
// (để hiển thị thông tin, KHÔNG dùng để quyết định vận hành — lỗi thiếu câu được báo
// rõ khi selectPackage.
export function ensureBank() {
  const db = getDb();
  const prev = db.questions.main.veDich;
  const b = normalizeBank(prev);
  db.questions.main.veDich = b;
  if (JSON.stringify(prev) !== JSON.stringify(b)) saveDb();
  const shortage = {};
  for (const [pts, need] of Object.entries(BANK_REQUIREMENTS)) {
    const level = Number(pts);
    const have = b.filter((x) => Number(x.points) === level).length;
    if (have < need) shortage[level] = need - have;
  }
  return { shortage, created: 0 };
}

// Thống kê tình trạng gói của từng đội: each (teamId, pkg) có đủ 4 câu đúng cấu trúc chưa.
// Trả về mảng [{ teamId, teamName, ok, packages: {60: {have, need, points}, ...} }]
export function validateTeamPackages() {
  const db = getDb();
  const arr = normalizeBank(db.questions.main.veDich);
  const teamIds = new Set(arr.filter((q) => q.teamId).map((q) => q.teamId));
  const results = [];
  for (const tid of teamIds) {
    const team = (db.teams || []).find((t) => t.id === tid);
    const pkgs = {};
    let allOk = true;
    for (const [total, structure] of Object.entries(PACKAGES)) {
      const target = Number(total);
      const questions = arr
        .filter((q) => q.teamId === tid && q.pkg === target)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      const expectedCounts = {};
      for (const lv of structure) expectedCounts[lv] = (expectedCounts[lv] || 0) + 1;
      const haveCounts = {};
      for (const q of questions) {
        const lv = Number(q.points);
        haveCounts[lv] = (haveCounts[lv] || 0) + 1;
      }
      const ok = questions.length === 4 && structure.every((lv) => expectedCounts[lv] === haveCounts[lv]);
      if (!ok) allOk = false;
      pkgs[target] = {
        have: questions.length,
        need: 4,
        points: questions.map((q) => q.points),
        ok,
      };
    }
    results.push({ teamId: tid, teamName: team?.name || tid.toUpperCase(), ok: allOk, packages: pkgs });
  }
  return results;
}

// Lay 4 câu theo thứ tự order của 1 gói cho 1 đội.
function fixedPackageQuestions(teamId, pkg) {
  const arr = normalizeBank(getDb().questions.main.veDich);
  return arr
    .filter((q) => q.teamId === teamId && q.pkg === pkg)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

// ---------- NHẬP CÂU HỎI TỪ FILE EXCEL / CSV ----------
// Cột nhận diện linh hoạt tiếng Việt / tiếng Anh, không phân biệt hoa thường/dấu:
//   Đội    (doikhau/nhom/team)                       → câu thuộc đội nào (gán teamId).
//   Gói    (goi/package/pkg)                         → câu thuộc gói 60/80/100 nào.
//   Điểm   (points/diem/sodiem/score/muc)            → điểm câu (ưu tiên cột đầu).
//   Câu hỏi (question/cauhoi/noidung/text)           → nội dung câu hỏi.
//   Đáp án (answer/dapan/traloi/key)                 → đáp án.
// Với tiêu đề đầy đủ: Đội,Gói,Điểm,Câu hỏi,Đáp án. Không tiêu đề: giữ quy ước cũ (3-4 cột
// điểm/câu/đáp án) → câu thành SPARE (không gán đội/gói).

const KEY_POINTS = new Set(["diem", "points", "diemso", "sodiem", "score", "muc", "mucdiem", "level"]);
const KEY_QUESTION = new Set(["cauhoi", "question", "cau", "noidung", "text", "comment"]);
const KEY_ANSWER = new Set(["dapan", "answer", "keys", "key", "traloi", "ketqua"]);
const KEY_TEAM = new Set(["doi", "doitra", "doikhau", "doikhauthi", "nhom", "team", "tennhan", "tenbinh", "tenbang", "bang"]);
const KEY_PACKAGE = new Set(["goi", "goicau", "goicauhoi", "package", "pkg", "mucgoi", "goidiem"]);

function normImportKey(k) {
  return String(k || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "")
    .replace(/[_\-\u0028\u0029]/g, "");
}

function matchesImportKey(value, keys) {
  const normalized = normImportKey(value);
  return keys.has(normalized) || [...keys].some((key) => normalized.startsWith(key));
}

function pickImportField(obj, keys) {
  for (const k of Object.keys(obj)) {
    if (matchesImportKey(k, keys)) return String(obj[k] ?? "").trim();
  }
  return "";
}

// Chuyển mảng row (object) thành danh sách { team, pkg, points, question, answer }.
// team (tên đội thô, chưa resolve) và pkg (số) đọc từ cột Đội/Gói nếu có; thiếu → để trống
// (câu spare). Chấp nhận dòng trống cột điểm → mặc định 20đ; thiếu câu hỏi → để trống (bỏ khi import).
export function parseVeDichRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => r && typeof r === "object").map((row, i) => {
    let points = pickImportField(row, KEY_POINTS);
    let question = pickImportField(row, KEY_QUESTION);
    let answer = pickImportField(row, KEY_ANSWER);
    let team = pickImportField(row, KEY_TEAM);
    let pkg = pickImportField(row, KEY_PACKAGE);
    if (!points && !question && !answer && !team && !pkg) {
      const vals = Object.values(row).map((v) => String(v ?? "").trim());
      const n0 = /^\d+$/.test(vals[0] || "");
      const n1 = /^\d+$/.test(vals[1] || "");
      if (vals.length >= 4 && n0 && n1) {
        // 4 cột trở lên, cột đầu là số thứ tự + cột 2 là điểm → STT, Điểm, Câu hỏi, Đáp án.
        points = vals[1];
        question = vals[2];
        answer = vals[3];
      } else {
        points = vals[0];
        question = vals[1];
        answer = vals[2];
      }
    }
    return {
      team: String(team || "").trim(),
      pkg: /^[0-9]+$/.test(String(pkg || "").trim()) ? Number(pkg) : undefined,
      points: normalizePoints(Number(points) || 20),
      question: String(question || "").trim(),
      answer: String(answer || "").trim(),
      row: i + 1,
    };
  });
}

// Tách CSV (tự nhận biết dấu phẩy / chấm phẩy / tab) thành mảng object theo header.
function parseCsvTable(text) {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || "";
  const sc = (first.match(/;/g) || []).length;
  const cc = (first.match(/,/g) || []).length;
  const tc = (first.match(/\t/g) || []).length;
  let delim = ",";
  if (tc > sc && tc > cc) delim = "\t";
  else if (sc > cc) delim = ";";

  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const nonempty = rows.filter((r) => r.some((c) => String(c).trim()));
  if (!nonempty.length) return [];
  const headers = nonempty[0].map((h) => String(h || "").trim());
  const lookLikeHeader = headers.some((h) =>
    KEY_POINTS.has(normImportKey(h)) ||
    KEY_QUESTION.has(normImportKey(h)) ||
    KEY_ANSWER.has(normImportKey(h)) ||
    KEY_TEAM.has(normImportKey(h)) ||
    KEY_PACKAGE.has(normImportKey(h))
  );
  if (!lookLikeHeader) {
    // Không có tiêu đề → quy ước vị trí; gán khóa số để parseVeDichRows đọc theo cột.
    return nonempty.map((r) => {
      const o = {};
      r.forEach((v, i) => {
        o[String(i)] = String(v ?? "").trim();
      });
      return o;
    });
  }
  return nonempty.slice(1).map((r) => {
    const o = {};
    headers.forEach((h, i) => {
      if (h) o[h] = r[i] ?? "";
    });
    return o;
  });
}

export function parseVeDichText(text) {
  const raw = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!raw) return [];
  return parseVeDichRows(parseCsvTable(raw));
}

export function parseVeDichXlsx(buffer) {
  let wb;
  try {
    wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  } catch {
    const err = new Error("Tệp Excel không hợp lệ.");
    err.status = 400;
    throw err;
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: "",
    raw: false,
  });
  const headerIndex = matrix.findIndex((row) =>
    [KEY_TEAM, KEY_PACKAGE, KEY_POINTS, KEY_QUESTION, KEY_ANSWER].every((keys) =>
      row.some((cell) => matchesImportKey(cell, keys))
    )
  );
  if (headerIndex < 0) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "", raw: false });
    return parseVeDichRows(rows);
  }
  const headers = matrix[headerIndex].map((header) => String(header || "").trim());
  const rows = matrix
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .filter((row) => {
      const first = String(row[0] || "").trim();
      const second = String(row[1] || "").trim();
      if (/^đội\b/i.test(first) && row.slice(1).every((cell) => !String(cell ?? "").trim())) return false;
      if (/^gói\b/i.test(first) && /cấu trúc/i.test(second)) return false;
      return true;
    })
    .map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        if (header) obj[header] = row[index] ?? "";
      });
      return obj;
    });
  return parseVeDichRows(rows);
}

// Resolve tên đội (đã nhập từ cột Đội) → teamId. Nhận cả mã đội trực tiếp ("a"./"b",...),
// tên hiển thị ("Đội A", "đội a") hoặc tên đầy đủ do Admin đổi. Bỏ dấu/hoa thường khi so.
// Trả về undefined nếu không khớp.
function resolveTeamId(raw) {
  const v = String(raw || "").trim();
  if (!v) return undefined;
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/\s+/g, "")
      .replace(/đội/g, "");
  const nv = norm(v);
  const team = (getDb().teams || []).find((t) => t.id === nv || norm(t.name) === nv);
  return team?.id;
}

// Import câu hỏi từ tệp (xlsx/xls hoặc CSV) — gán CỐ ĐỊNH theo đội + gói.
// Cột tiêu đề khuyến nghị: Đội,Gói,Điểm,Câu hỏi,Đáp án. Không có cột Đội/Gói → câu trở
// thành SPARE (không gán, không được chọn lúc thi). order của câu trong gói = thứ tự xuất
// hiện trong file (tính tiếp từ order lớn nhất đã có của cùng đội+gói trong ngân hàng).
// Bỏ qua câu không có nội dung và câu trùng (theo nội dung) với câu đã có trong ngân hàng.
// Trả về { added, skipped, errors, questions, total, teams } (không làm thay đổi nếu tệp không hợp lệ).
export function importVeDichFile(buf, name = "") {
  const isXlsx = /\.xlsx?$/i.test(name) || (buf[0] === 0x50 && buf[1] === 0x4b);
  const parsed = isXlsx ? parseVeDichXlsx(buf) : parseVeDichText(buf.toString("utf8"));
  if (!parsed.length) {
    const err = new Error("Không tìm thấy câu hỏi hợp lệ trong tệp. Cần cột Điểm / Câu hỏi / Đáp án (tệp không tiêu đề: 3 cột theo thứ tự đó).");
    err.status = 400;
    throw err;
  }
  const db = getDb();
  const bank = normalizeBank(db.questions.main.veDich);
  const existing = new Set(bank.map((q) => normImportKey(q.question || "")));
  // order kế tiếp của từng (teamId, pkg) đã có trong ngân hàng.
  const nextOrder = {};
  for (const q of bank) {
    if (!q.teamId || !q.pkg) continue;
    const k = `${q.teamId}:${q.pkg}`;
    nextOrder[k] = Math.max(nextOrder[k] || 0, Number(q.order) || 0);
  }
  let added = 0;
  let skipped = 0;
  const errors = [];
  const questions = [];
  for (const p of parsed) {
    if (!p.question) {
      errors.push(`Dòng ${p.row}: thiếu nội dung câu hỏi`);
      continue;
    }
    const key = normImportKey(p.question);
    if (existing.has(key)) {
      skipped += 1;
      continue;
    }
    existing.add(key);
    let teamId;
    let pkg = p.pkg;
    if (p.team) {
      teamId = resolveTeamId(p.team);
      if (!teamId) {
        errors.push(`Dòng ${p.row}: không tìm thấy đội "${p.team}"`);
        continue;
      }
      if (!PACKAGES[Number(pkg)]) {
        errors.push(`Dòng ${p.row}: gói "${p.pkg}" không hợp lệ (chỉ 60, 80 hoặc 100)`);
        continue;
      }
      const k = `${teamId}:${pkg}`;
      nextOrder[k] = (nextOrder[k] || 0) + 1;
      const q = {
        id: `vd-import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        teamId,
        pkg,
        order: nextOrder[k],
        points: p.points,
        question: p.question,
        answer: p.answer,
      };
      questions.push(q);
      added += 1;
    } else {
      // Không khai đội → câu spare.
      const q = {
        id: `vd-import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        points: p.points,
        question: p.question,
        answer: p.answer,
      };
      questions.push(q);
      added += 1;
    }
  }
  if (added > 0) {
    db.questions.main.veDich = normalizeBank([...bank, ...questions]);
    saveDb();
  }
  return { added, skipped, errors, questions, total: db.questions.main.veDich.length, teams: validateTeamPackages() };
}

// Số giây trả lời theo điểm câu đang thi (10→20s, 20→30s, 30→40s).
// Trả về thời gian dựa trên điểm của câu hiện tại (currentPoints).
export function getAnswerSeconds(game = g()) {
  const pts = currentPoints(game);
  return ANSWER_SECONDS[pts] ?? 30;
}

// Điểm GỐC của câu đang thi (chưa nhân ngôi sao).
export function getBasePoints(game = g()) {
  return currentPoints(game);
}

// Điểm thưởng của câu đang thi (x2 nếu câu này được gán Ngôi sao hy vọng).
export function getPoints(game = g()) {
  const pts = currentPoints(game);
  const ved = game.veDich;
  const star = ved.starQuestion === (ved.pickIndex ?? 0);
  return star ? pts * 2 : pts;
}

// Tính điểm cho Vòng Về đích theo đúng bảng luật câu thường + Ngôi sao hy vọng.
// Mọi mức đều dựa trên điểm GỐC P (questionPoints) của câu, không hard-code 10/20/30.
//   outcome:
//     "selecting-correct" — đội chọn câu trả lời ĐÚNG ngay           → +P (NSHV: +2P).
//     "no-answer"         — chọn câu sai, KHÔNG ai giành quyền/trả lời
//                                                                    → 0 (NSHV: −P/2).
//     "steal-correct"     — chọn câu sai, đội khác giành quyền ĐÚNG → −P / +P
//                                                                    (NSHV: −2P / +2P).
//     "steal-wrong"       — chọn câu sai, đội khác giành quyền SAI  → 0 / −P
//                                                                    (NSHV: −P/2 / −P).
// Trả về { selecting, stealing } = số điểm cộng (+) / trừ (−) cho đội chọn câu và đội
// giành quyền (stealing = 0 khi không có đội giành quyền).
export function calculateAnswerScore({ questionPoints, isStarOfHope, outcome }) {
  const P = Number(questionPoints) || 0;
  const star = !!isStarOfHope;
  let r;
  switch (outcome) {
    case "selecting-correct":
      r = { selecting: star ? 2 * P : P, stealing: 0 };
      break;
    case "no-answer":
      r = { selecting: star ? -(P / 2) : 0, stealing: 0 };
      break;
    case "steal-correct":
      r = { selecting: star ? -2 * P : -P, stealing: star ? 2 * P : P };
      break;
    case "steal-wrong":
      r = { selecting: star ? -(P / 2) : 0, stealing: -P };
      break;
    default:
      r = { selecting: 0, stealing: 0 };
  }
  // Tránh -0 khi P = 0.
  return { selecting: r.selecting || 0, stealing: r.stealing || 0 };
}

// Bật/tắt Ngôi sao hy vọng cho câu SẮP được trình.
// Chỉ được chọn/đổi TRƯỚC KHI hiện câu (phase "ready" cho câu đầu, "prep" cho từng câu
// sau). Khi đang trả lời (phase "answering") hoặc đang soạn/đếm ngược thì KHÔNG được
// đổi. Mỗi đội chỉ được chọn đúng 1 câu duy nhất trong lượt thi.
export function setStar(star) {
  const game = g();
  const enable = !!star;
  if (game.veDich.phase !== "ready" && game.veDich.phase !== "prep") {
    const err = new Error("Ngôi sao hy vọng chỉ chọn được khi đang chuẩn bị hiện câu hỏi.");
    err.status = 400;
    throw err;
  }
  const curIdx = game.veDich.pickIndex ?? 0;
  game.veDich.starQuestion = game.veDich.starQuestion ?? null;
  if (enable) {
    if (game.veDich.starQuestion !== null && game.veDich.starQuestion !== curIdx) {
      const err = new Error(`Đội ${String(game.currentTeam).toUpperCase()} chỉ dùng ngôi sao hy vọng cho 1 câu duy nhất.`);
      err.status = 400;
      throw err;
    }
    game.veDich.starQuestion = curIdx;
  } else {
    game.veDich.starQuestion = null;
  }
  saveDb();
  emit();
}

function teamName(id) {
  const team = (getDb().teams || []).find((t) => t.id === id);
  return team?.name || id?.toUpperCase?.() || id;
}

// Lấy câu hỏi hiện tại của đội đang thi (theo picked[pickIndex], tra theo id trong danh sách câu).
// Chỉ trả về câu sau khi bộ câu đã CHỐT — lúc chưa chốt, chưa có câu nào được đưa ra thi.
export function findQuestion(game = g()) {
  const team = game.currentTeam;
  if (!game.veDich.locked) return null;
  const qids = game.veDich.picked?.[team] || [];
  const qid = qids[game.veDich.pickIndex] || null;
  if (!qid) return null;
  return (normalizeBank(getDb().questions.main.veDich) || []).find((q) => q.id === qid) || null;
}

// Mức điểm của câu đang thi (ưu tiên theo câu đã chọn, fallback về packagePoints).
function currentPoints(game = g()) {
  const q = findQuestion(game);
  return q?.points || game?.veDich?.packagePoints || 20;
}

// MC chọn gói câu hỏi cho đội đang thi. Server load ĐÚNG 4 câu CỐ ĐỊNH đã gán sẵn cho
// (đội, gói) từ Excel (teamId + pkg + order) — KHÔNG bốc ngẫu nhiên, KHÔNG khử trùng.
//   - packagePoints bắt buộc là 60, 80 hoặc 100.
//   - Chỉ cho phép khi chưa chốt (locked == false) — sau khi chốt phải unlock để đổi gói.
//   - Nếu đội chưa chuẩn bị đủ 4 câu đúng cấu trúc cho gói đó → trả lỗi rõ ràng.
//   - Trả về mảng id của 4 câu đã chọn.
export function selectPackage(packagePoints) {
  const game = g();
  const team = game.currentTeam;
  const pts = Number(packagePoints);
  const structure = PACKAGES[pts];
  if (!structure) {
    const err = new Error("Gói câu hỏi chỉ có thể là 60, 80 hoặc 100 điểm.");
    err.status = 400;
    throw err;
  }
  if (game.veDich.locked) {
    const err = new Error("Bộ câu đã chốt — không thể đổi gói. Bấm Sửa lại nếu muốn chọn gói khác.");
    err.status = 400;
    throw err;
  }
  // 4 câu CỐ ĐỊNH của (đội, gói) — theo thứ tự order trong Excel.
  const fixed = fixedPackageQuestions(team, pts);
  if (fixed.length < 4) {
    const err = new Error(
      `${teamName(team)} chưa đủ câu cho gói ${pts}đ (cần ${structure.join(" + ")} = 4 câu, hiện có ${fixed.length}). Hãy bổ sung câu ${pts}đ cho đội này trong Excel rồi thử lại.`
    );
    err.status = 400;
    throw err;
  }
  const want = structure.slice().sort((a, b) => a - b);
  const have = fixed.slice(0, 4).map((x) => Number(x.points)).sort((a, b) => a - b);
  if (String(want) !== String(have)) {
    const err = new Error(
      `Gói ${pts}đ của ${teamName(team)} sai cấu trúc: cần ${structure.join(" + ")} điểm, câu hiện có ${fixed.slice(0, 4).map((x) => x.points).join(" + ")}. Hãy sửa lại dữ liệu đội này trong Excel.`
    );
    err.status = 400;
    throw err;
  }
  const pickedIds = fixed.slice(0, 4).map((x) => x.id);
  game.veDich.picked = { ...(game.veDich.picked || {}), [team]: pickedIds };
  game.veDich.packagePoints = pts;
  game.veDich.pickIndex = 0;
  game.veDich.stealOpen = false;
  game.veDich.stealPending = null;
  saveDb();
  emit();
  return pickedIds;
}

// Chốt bộ 4 câu — đưa câu hỏi cho thí sinh trả lời (bắt đầu từ câu 1).
export function lockPackage() {
  const game = g();
  const team = game.currentTeam;
  const picked = game.veDich.picked?.[team] || [];
  if (picked.length !== 4) {
    const err = new Error(`Bộ câu phải đủ 4 câu (hiện có ${picked.length}) để bắt đầu thi.`);
    err.status = 400;
    throw err;
  }
  game.veDich.locked = true;
  game.veDich.pickIndex = 0;
  game.veDich.stealOpen = false;
  game.veDich.stealPending = null;
  // Ở màn "sẵn sàng" MC sẽ chọn ngôi sao hy vọng (nếu muốn) trước khi Bắt đầu thi.
  game.veDich.phase = "ready";
  saveDb();
  emit();
}

// Bắt đầu thi: từ trạng thái đã chốt, chuyển sang đếm ngược 3-2-1 (do timer loop xử lý).
export function startGame() {
  const game = g();
  if (!game.veDich.locked || game.veDich.picked?.[game.currentTeam]?.length !== 4) {
    const err = new Error("Chưa chốt đủ bộ 4 câu để bắt đầu thi.");
    err.status = 400;
    throw err;
  }
  game.veDich.phase = "countdown";
  game.veDich.pickIndex = 0;
  saveDb();
  emit();
}

// Mở khóa để MC điều chỉnh lại bộ câu.
export function unlockPackage() {
  const game = g();
  game.veDich.locked = false;
  game.veDich.starQuestion = null;
  game.veDich.stealPending = null;
  game.veDich.stealOpen = false;
  game.veDich.phase = "soan";
  saveDb();
  emit();
}

// Xóa toàn bộ câu đã chọn của một đội (để chọn lại).
export function clearPicked(teamId) {
  const game = g();
  const team = teamId || game.currentTeam;
  game.veDich.picked = { ...(game.veDich.picked || {}), [team]: [] };
  game.veDich.pickIndex = 0;
  game.veDich.locked = false;
  game.veDich.starQuestion = null;
  game.veDich.stealPending = null;
  game.veDich.stealOpen = false;
  game.veDich.phase = "soan";
  saveDb();
  emit();
}

// Đổi đội đang thi: lưu answeringTeam, tắt sao, quay lại câu đầu của đội mới.
export function setAnsweringTeam(teamId) {
  const game = g();
  game.veDich.answeringTeam = teamId;
  game.veDich.starQuestion = null;
  game.veDich.pickIndex = 0;
  // Mỗi đội tự chốt bộ câu của mình — đội mới chưa chốt.
  game.veDich.locked = false;
  game.veDich.stealPending = null;
  game.veDich.stealOpen = false;
  game.veDich.phase = "soan";
  saveDb();
  emit();
}