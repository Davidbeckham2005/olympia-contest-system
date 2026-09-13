import * as XLSX from "xlsx";
import crypto from "crypto";
import { getDb } from "../../models/store.js";

// Nhập nhanh câu hỏi Vòng 1 Khởi động + Vòng phụ từ Excel/CSV.
//
// Vòng 1 Khởi động: MỖI FILE = 1 ĐỘI (chọn cùng nút import của đội đó).
//   Mỗi DÒNG = 1 CÂU (Ảnh + Đáp án), đọc từ trên xuống, CỨ 5 DÒNG = 1 THÍ SINH.
//   Có thể dùng dòng tiêu đề "Ảnh, Đáp án" (tự nhận biết) hoặc để thẳng dữ liệu
//   (cột 0 = ảnh, cột 1 = đáp án).
//
// Vòng phụ: 1 dòng = 1 câu (Câu hỏi / Đáp án / Ảnh).
//
// Ô "Ảnh": URL dán thẳng, tên ảnh đã upload trên server (dò db.media), HOẶC tên file
// nằm trong thư mục ảnh chọn kèm khi import (máy cá nhân chưa upload) — hệ thống tự
// upload số ảnh đó lên server rồi gán URL.

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

function pickIdx(keys, set, exclude = new Set()) {
  for (let i = 0; i < keys.length; i++) {
    if (exclude.has(i)) continue;
    if (set.has(keys[i])) return i;
  }
  return -1;
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

// Dò URL thật của một ô ghi tên/dường dẫn ảnh.
// - URL/đường dẫn cloud → dùng luôn (dò db.media lấy type).
// - Tên ảnh đã upload → trả URL trong db.media.
// - Không tìm thấy → { mediaUrl:"", mediaType:"", hint: giá gốc } để bước sau tự upload.
export function resolveMedia(value) {
  const raw = String(value || "").trim();
  if (!raw) return { mediaUrl: "", mediaType: "", hint: "" };
  const media = getDb().media || [];
  const isUrl = /^https?:\/\//i.test(raw) || raw.startsWith("/uploads/") || raw.startsWith("data:");
  if (isUrl) {
    const hit = media.find((m) => m.url === raw);
    return { mediaUrl: raw, mediaType: hit ? hit.type : "image", hint: "" };
  }
  const base = normKey(raw.replace(/\\/g, "/").split("/").pop().replace(/\.[a-z0-9]+$/i, ""));
  const matchName = media.find((m) => normKey(m.name.replace(/\\/g, "/").split("/").pop().replace(/\.[a-z0-9]+$/i, "")) === base);
  if (matchName) return { mediaUrl: matchName.url, mediaType: matchName.type, hint: "" };
  const matchUrl = media.find((m) => normKey(m.url.split("/").pop().replace(/\.[a-z0-9]+$/i, "")) === base);
  if (matchUrl) return { mediaUrl: matchUrl.url, mediaType: matchUrl.type, hint: "" };
  const contains = media.find((m) => normKey(String(m.name)).includes(base));
  if (contains) return { mediaUrl: contains.url, mediaType: contains.type, hint: "" };
  return { mediaUrl: "", mediaType: "", hint: raw };
}

// ---- Vòng 1 Khởi động: MỖI DÒNG = 1 CÂU, cứ 5 dòng = 1 thí sinh. ----
export function parseKhoiDongRows(aoa) {
  if (!Array.isArray(aoa) || !aoa.length) return { units: [], errors: [], added: 0 };
  const keys = aoa[0].map(normKey);
  const anhIdx = pickIdx(keys, KEY_ANH);
  const dapIdx = pickIdx(keys, KEY_DAP_AN, new Set([anhIdx]));
  // Có tiêu đề khi dòng đầu nhận ra được cột Ảnh hoặc Đáp án.
  const hasHeader = anhIdx >= 0 || dapIdx >= 0;
  const start = hasHeader ? 1 : 0;

  const items = [];
  const errors = [];
  for (let r = start; r < aoa.length; r++) {
    const cells = [...aoa[r]];
    let imgCell = "";
    let answer = "";
    if (hasHeader) {
      imgCell = anhIdx >= 0 ? cells[anhIdx] || "" : "";
      answer = dapIdx >= 0 ? cells[dapIdx] || "" : "";
    } else {
      imgCell = cells[0] || "";
      answer = cells[1] || "";
    }
    const media = resolveMedia(imgCell);
    if (media.hint) errors.push(`Dòng ${r + 1}: ảnh "${media.hint}" chưa thấy trong thư mục/đã upload — câu này bỏ trống.`);
    if (!media.mediaUrl && !media.hint && !answer) {
      errors.push(`Dòng ${r + 1}: trống, bỏ qua.`);
      continue;
    }
    items.push({ media, answer: String(answer || "").trim(), row: r + 1 });
  }

  // Chia cụm 5 câu liên tiếp từ trên xuống.
  const units = [];
  for (let i = 0; i < items.length; i += 5) {
    const slice = items.slice(i, i + 5);
    while (slice.length < 5) slice.push({ media: { mediaUrl: "", mediaType: "", hint: "" }, answer: "" });
    units.push({ items: slice });
  }
  const added = items.filter((x) => x.media.mediaUrl || x.media.hint || x.answer).length;
  return { units, errors, added };
}

// ---- Nhập nhanh chỉ bằng ảnh (không cần Excel): đáp án lấy từ TÊN FILE. ----
// Bỏ đuôi mở rộng, bỏ số thứ tự đầu tên ("01-Pháp" / "1. Mỹ" / "(2) Ý" → "Pháp"/"Mỹ"/"Ý").
export function answerFromImageName(name = "") {
  const base = String(name).replace(/\\/g, "/").split("/").pop().replace(/\.[a-z0-9]+$/i, "").trim();
  const stripped = base.replace(/^\(?\d{1,3}\)?[\s\-_.]+/, "").trim();
  return stripped || base;
}

// Chia danh sách ảnh đã upload thành cụm 5 (mỗi 5 ảnh = 1 thí sinh), đệm đủ 5 ô.
export function buildKhoiDongImageClusters(entries, teamId) {
  const clusters = [];
  for (let i = 0; i < entries.length; i += 5) {
    const slice = entries.slice(i, i + 5);
    while (slice.length < 5) slice.push({ media: { mediaUrl: "", mediaType: "", hint: "" }, answer: "" });
    clusters.push(buildKhoiDongCluster(slice, teamId));
  }
  return clusters;
}

// ---- Vòng phụ: 1 dòng = 1 câu (Câu hỏi / Đáp án / Ảnh). ----
export function parseTieBreakRows(aoa) {
  if (!Array.isArray(aoa) || !aoa.length) return { questions: [], errors: [], added: 0 };
  const keys = aoa[0].map(normKey);
  const cauHoiIdx = pickIdx(keys, KEY_CAU_HOI);
  const anhIdx = pickIdx(keys, KEY_ANH, new Set([cauHoiIdx]));
  const dapIdx = pickIdx(keys, KEY_DAP_AN, new Set([cauHoiIdx, anhIdx]));
  const hasHeader = cauHoiIdx >= 0 || anhIdx >= 0 || dapIdx >= 0;
  const start = hasHeader ? 1 : 0;
  const questions = [];
  const errors = [];
  for (let r = start; r < aoa.length; r++) {
    const cells = [...aoa[r]];
    let question = "";
    let answer = "";
    let imgCell = "";
    if (hasHeader) {
      question = cauHoiIdx >= 0 ? cells[cauHoiIdx] || "" : "";
      answer = dapIdx >= 0 ? cells[dapIdx] || "" : "";
      imgCell = anhIdx >= 0 ? cells[anhIdx] || "" : "";
    } else {
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
    const media = resolveMedia(imgCell);
    if (media.hint) errors.push(`Dòng ${r + 1}: ảnh "${media.hint}" chưa thấy trong thư mục/đã upload — câu này bỏ trống ảnh.`);
    if (!question && !answer && !imgCell) {
      errors.push(`Dòng ${r + 1}: trống, bỏ qua.`);
      continue;
    }
    questions.push({ question, answer, media, row: r + 1 });
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
export function buildKhoiDongCluster(items, teamId) {
  return items.map((q, i) => ({
    id: `kd-${teamId}-imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${i}`,
    answer: q.answer || "",
    points: 10,
    mediaUrl: q.media?.mediaUrl || "",
    mediaType: q.media?.mediaType || "",
  }));
}

export function buildTieBreakQuestion(q) {
  return {
    id: crypto.randomUUID(),
    question: q.question || "",
    answer: q.answer || "",
    options: [],
    mediaUrl: q.media?.mediaUrl || "",
    mediaType: q.media?.mediaType || "",
    note: "",
  };
}