import * as XLSX from "xlsx";
import crypto from "crypto";
import { getDb } from "../../models/store.js";

// Nhập nhanh câu hỏi Vòng 1 Khởi động + Vòng phụ từ Excel/CSV.
// Ô "Ảnh" ghi TÊN hoặc ĐƯỜNG DẪN ảnh đã upload sẵn (tab Hình ảnh/Video) → hệ thống
// tự dò trong db.media để lấy URL thật; nếu là URL dán thẳng thì dùng luôn.

function normKey(k) {
  return String(k || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, "");
}

const KEY_ANH = new Set(["anh", "image", "pic", "picture", "file", "hinhanh", "media", "icon"]);
const KEY_DAP_AN = new Set(["dapan", "answer", "keys", "key", "traloi", "ketqua", "dap"]);
const KEY_CAU_HOI = new Set(["cauhoi", "question", "cau", "noidung", "text", "thacmac"]);
const KEY_STT = new Set(["stt", "tt", "sothutu", "so", "thisinh", "member", "thutu"]);

function stripNum(k) {
  return String(k || "").replace(/[^\d]/g, "");
}

// Đọc file (.xlsx/.xls hoặc CSV text) thành mảng các dòng (mỗi dòng là mảng ô chuỗi).
export function readQuickRows(buf, name = "") {
  const isXlsx = /\.xlsx?$/i.test(name) || (buf[0] === 0x50 && buf[1] === 0x4b);
  let wb;
  try {
    if (isXlsx) wb = XLSX.read(buf, { type: "buffer", cellDates: false });
    else wb = XLSX.read(buf.toString("utf8"), { type: "string", cellDates: false });
  } catch {
    const err = new Error("Tệp Excel/CSV không hợp lệ.");
    err.status = 400;
    throw err;
  }
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  return aoa
    .map((r) => (Array.isArray(r) ? r.map((v) => String(v ?? "").trim()) : []))
    .filter((r) => r.some((c) => c));
}

// Dựa vào hàng đầu của file để nhận biết có dòng tiêu đề hay không và các cột ở đâu.
function detectHeader(firstRow) {
  const keys = firstRow.map(normKey);
  const sttIdx = keys.findIndex((k) => KEY_STT.has(k));
  const anhIdxs = [];
  const dapAnIdxs = [];
  const cauHoiIdx = keys.findIndex((k) => KEY_CAU_HOI.has(k));
  keys.forEach((k, i) => {
    const n = stripNum(k);
    if (n && (KEY_ANH.has(k.replace(/\d+/g, "").trim()) || /^anh?n?[1-5]$/.test(k))) anhIdxs.push(i);
    else if (n && (KEY_DAP_AN.has(k.replace(/\d+/g, "").trim()) || /^dapan?[1-5]$/.test(k))) dapAnIdxs.push(i);
    else if (!n && KEY_ANH.has(k)) anhIdxs.push(i);
    else if (!n && KEY_DAP_AN.has(k)) dapAnIdxs.push(i);
  });
  const hasHeader = anhIdxs.length > 0 || cauHoiIdx >= 0 || keys.some((k) => KEY_DAP_AN.has(k));
  return { hasHeader, sttIdx, anhIdxs, dapAnIdxs, cauHoiIdx };
}

// Dò URL thật của một ô ghi tên/dường dẫn ảnh đã upload.
function resolveMedia(value) {
  const raw = String(value || "").trim();
  if (!raw) return { mediaUrl: "", mediaType: "" };
  const db = getDb();
  const media = db.media || [];
  const isUrl = /^https?:\/\//i.test(raw) || raw.startsWith("/uploads/") || raw.startsWith("data:");
  if (isUrl) {
    const hit = media.find((m) => m.url === raw);
    return { mediaUrl: raw, mediaType: hit ? hit.type : "image" };
  }
  const base = normKey(raw.replace(/\\/g, "/").split("/").pop().replace(/\.[a-z0-9]+$/i, ""));
  const matchName = media.find((m) => normKey(m.name.replace(/\\/g, "/").split("/").pop().replace(/\.[a-z0-9]+$/i, "")) === base);
  if (matchName) return { mediaUrl: matchName.url, mediaType: matchName.type };
  const matchUrl = media.find((m) => normKey(m.url.split("/").pop().replace(/\.[a-z0-9]+$/i, "")) === base);
  if (matchUrl) return { mediaUrl: matchUrl.url, mediaType: matchUrl.type };
  const contains = media.find((m) => normKey(String(m.name)).includes(base));
  if (contains) return { mediaUrl: contains.url, mediaType: contains.type };
  return { mediaUrl: "", mediaType: "" };
}

// ---- Vòng 1 Khởi động: 1 dòng = 1 thí sinh, 5 cặp (Ảnh + Đáp án). ----
export function parseKhoiDongRows(aoa) {
  if (!Array.isArray(aoa) || !aoa.length) return { clusters: [], errors: [], added: 0 };
  const det = detectHeader(aoa[0]);
  const start = det.hasHeader ? 1 : 0;
  const clusters = [];
  const errors = [];
  for (let r = start; r < aoa.length; r++) {
    const row = aoa[r];
    const cells = [...row];
    if (!det.hasHeader) {
      // Không tiêu đề → mặc định cột: [Ảnh1, Đáp án1, Ảnh2, Đáp án2, ... Ảnh5, Đáp án5]
      let first = 0;
      if (/^\d+$/.test(normKey(cells[0] || ""))) {
        first = 1; // cột 0 là số thứ tự thí sinh
        errors.push(`Dòng ${r + 2}: bỏ qua cột STT`);
      }
      const qs = [];
      for (let i = 0; i < 5; i++) qs.push(pickPairs(cells[first + i * 2], cells[first + i * 2 + 1]));
      clusters.push(qs);
      continue;
    }
    const qs = [null, null, null, null, null];
    for (let i = 1; i <= 5; i++) {
      const ai = det.anhIdxs.find((_, j) => j === i - 1);
      const di = det.dapAnIdxs.find((_, j) => j === i - 1);
      qs[i - 1] = ai !== undefined ? pickPairs(cells[ai], cells[di]) : { mediaUrl: "", mediaType: "", answer: "" };
    }
    if (!qs.some((q) => q.mediaUrl || q.answer)) {
      errors.push(`Dòng ${r + 1} (thí sinh ${r - start + 1}): trống, bỏ qua.`);
      continue;
    }
    clusters.push(qs);
  }
  return { clusters, errors, added: clusters.length };
}

function pickPairs(imgCell, ansCell) {
  const img = resolveMedia(imgCell);
  return { mediaUrl: img.mediaUrl, mediaType: img.mediaType, answer: String(ansCell || "").trim() };
}

// ---- Vòng phụ: 1 dòng = 1 câu (Câu hỏi / Đáp án / Ảnh). ----
export function parseTieBreakRows(aoa) {
  if (!Array.isArray(aoa) || !aoa.length) return { questions: [], errors: [], added: 0 };
  const det = detectHeader(aoa[0]);
  const hasHeader = det.cauHoiIdx >= 0 || det.hasHeader;
  const start = hasHeader ? 1 : 0;
  const questions = [];
  const errors = [];
  for (let r = start; r < aoa.length; r++) {
    const cells = [...aoa[r]];
    let question = "";
    let answer = "";
    let imgCell = "";
    if (hasHeader) {
      const ci = [det.cauHoiIdx, det.anhIdxs[0], det.dapAnIdxs[0]].find((x, i, arr) => x !== undefined);
      question = cells[det.cauHoiIdx] || "";
      if (det.dapAnIdxs[0] !== undefined) answer = cells[det.dapAnIdxs[0]] || "";
      let mediaIdx = det.anhIdxs[0];
      if (mediaIdx === undefined && det.cauHoiIdx >= 0 && det.sttIdx >= 0) mediaIdx = undefined;
      imgCell = mediaIdx !== undefined ? cells[mediaIdx] : "";
      void ci;
    } else {
      // Không tiêu đề → quy ước: Câu hỏi, Đáp án, Ảnh (ảnh có thể bỏ trống; STT đầu tuỳ chọn).
      let q = 0;
      let a = 1;
      let im = 2;
      if (cells.length >= 4 && /^\d+$/.test(normKey(cells[0] || ""))) {
        q = 1;
        a = 2;
        im = 3;
      }
      question = cells[q] || "";
      answer = cells[a] || "";
      imgCell = cells[im] || "";
    }
    if (!question && !answer && !imgCell) {
      errors.push(`Dòng ${r + 1}: trống, bỏ qua.`);
      continue;
    }
    const img = resolveMedia(imgCell);
    const base = { question, answer, ...img };
    questions.push(base);
  }
  return { questions, errors, added: questions.length };
}

// Điểm vào chính: đọc file rồi parse theo loại vòng. Không ghi DB.
export function parseQuickImport(buf, name = "", round = "") {
  const aoa = readQuickRows(buf, name);
  if (!aoa.length) {
    const err = new Error("Không tìm thấy dữ liệu trong tệp.");
    err.status = 400;
    throw err;
  }
  if (round === "khoi_dong") return parseKhoiDongRows(aoa);
  if (round === "tie_break") return parseTieBreakRows(aoa);
  const err = new Error(`Vòng không hỗ trợ nhập nhanh: ${round}`);
  err.status = 400;
  throw err;
}

// Dựng object câu Khởi động hợp lệ cho DB (5 ô, points mặc định 10).
export function buildKhoiDongCluster(qs, teamId) {
  return qs.map((q, i) => ({
    id: `kd-${teamId}-imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${i}`,
    answer: q.answer || "",
    points: 10,
    mediaUrl: q.mediaUrl || "",
    mediaType: q.mediaType || "",
  }));
}

export function buildTieBreakQuestion(q) {
  return {
    id: crypto.randomUUID(),
    question: q.question || "",
    answer: q.answer || "",
    options: [],
    mediaUrl: q.mediaUrl || "",
    mediaType: q.mediaType || "",
    note: "",
  };
}