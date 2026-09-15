// scripts/gen-vedich-template.mjs
// Template nhập câu hỏi Vòng 4 (Về đích) — 4 đội × 3 gói × 4 câu = 48
// Đội / Gói / Điểm: điền sẵn | Câu hỏi / Đáp án: ô vàng cần nhập
// Chạy: node scripts/gen-vedich-template.mjs

import XLSX from "xlsx-js-style";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── màu sắc ───────────────────────────────────────────────────────────────
const YELLOW   = { fgColor: { rgb: "FFF200" } };
const WHITE    = { fgColor: { rgb: "FFFFFF" } };
const DARK_BLU = { fgColor: { rgb: "1F4E79" } };
const MED_BLU  = { fgColor: { rgb: "2E75B6" } };
const LT_BLUE  = { fgColor: { rgb: "DEEBF7" } };
const ORANGE   = { fgColor: { rgb: "F4B942" } };
const LT_ORG   = { fgColor: { rgb: "FCE4D6" } };
const GREEN    = { fgColor: { rgb: "375623" } };
const LT_GRN   = { fgColor: { rgb: "E2EFDA" } };
const PURPLE   = { fgColor: { rgb: "7030A0" } };
const LT_PRP   = { fgColor: { rgb: "EAD1DC" } };

const TEAM_THEMES = [
  { name: "angle", bg: MED_BLU,  light: LT_BLUE, dark: DARK_BLU },
  { name: "news",  bg: ORANGE,  light: LT_ORG,  dark: { fgColor: { rgb: "7F3D00" } } },
  { name: "kop",   bg: GREEN,   light: LT_GRN,  dark: { fgColor: { rgb: "1E3A0F" } } },
  { name: "pol",   bg: PURPLE,  light: LT_PRP,  dark: { fgColor: { rgb: "3D0050" } } },
];

const PACKAGES = {
  60:  { label: "GÓI 60", points: [10, 10, 20, 20], light: { fgColor: { rgb: "FFF2CC" } } },
  80:  { label: "GÓI 80", points: [10, 20, 20, 30], light: { fgColor: { rgb: "FCE4D6" } } },
  100: { label: "GÓI 100", points: [20, 20, 30, 30], light: { fgColor: { rgb: "DEEBF7" } } },
};

const WHITE_FONT = { color: { rgb: "FFFFFF" }, bold: true };
const DARK_FONT  = { color: { rgb: "000000" }, bold: true };
const NORM_FONT  = { color: { rgb: "000000" }, bold: false };

function mkCell(v, fill, font, align = "left") {
  return {
    t: typeof v === "number" ? "n" : "s",
    v,
    s: {
      fill,
      font: font || NORM_FONT,
      alignment: { horizontal: align, vertical: "center", wrapText: true },
      border: { top: { style: "thin", color: { rgb: "AAAAAA" } }, bottom: { style: "thin", color: { rgb: "AAAAAA" } }, left: { style: "thin", color: { rgb: "AAAAAA" } }, right: { style: "thin", color: { rgb: "AAAAAA" } } },
    },
  };
}

function emptyYellow() {
  return mkCell("", YELLOW, NORM_FONT, "left");
}

function teamHeaderRow(team) {
  return [
    mkCell(`${team.name} — 3 gói × 4 câu = 12 câu`, team.bg, WHITE_FONT, "center"),
    mkCell("", team.bg, WHITE_FONT, "center"),
    mkCell("", team.bg, WHITE_FONT, "center"),
    mkCell("", team.bg, WHITE_FONT, "center"),
    mkCell("", team.bg, WHITE_FONT, "center"),
  ];
}

function pkgHeaderRow(pkg, light) {
  const info = PACKAGES[pkg];
  return [
    mkCell(info.label, light, DARK_FONT, "center"),
    mkCell(`Cấu trúc: ${info.points.join(" → ")}`, light, DARK_FONT, "center"),
    mkCell("ĐIỂM", light, DARK_FONT, "center"),
    mkCell("CÂU HỎI", light, DARK_FONT, "center"),
    mkCell("ĐÁP ÁN", light, DARK_FONT, "center"),
  ];
}

function dataRow(team, pkg, pts, light) {
  return [
    mkCell(team.name, light, NORM_FONT, "center"),
    mkCell(pkg,       light, NORM_FONT, "center"),
    mkCell(pts,       light, NORM_FONT, "center"),
    emptyYellow(),
    emptyYellow(),
  ];
}

// ─── build sheet data ────────────────────────────────────────────────────────
const DATA = [];

// Dòng tiêu đề chính
DATA.push([
  mkCell("VÒNG 4 — VỀ ĐÍCH  |  4 đội × 3 gói × 4 câu = 48 câu  |  Điền sẵn ĐỘI / GÓI / ĐIỂM — Chỉ nhập CÂU HỎI & ĐÁP ÁN",
    DARK_BLU, WHITE_FONT, "center"),
  mkCell("", DARK_BLU, WHITE_FONT, "center"),
  mkCell("", DARK_BLU, WHITE_FONT, "center"),
  mkCell("", DARK_BLU, WHITE_FONT, "center"),
  mkCell("", DARK_BLU, WHITE_FONT, "center"),
]);
const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

// Dòng tiêu đề cột
DATA.push([
  mkCell("ĐỘI",     DARK_BLU, WHITE_FONT, "center"),
  mkCell("GÓI",     DARK_BLU, WHITE_FONT, "center"),
  mkCell("ĐIỂM",    DARK_BLU, WHITE_FONT, "center"),
  mkCell("CÂU HỎI  ✎ (nhập tại đây)", DARK_BLU, WHITE_FONT, "center"),
  mkCell("ĐÁP ÁN  ✎ (nhập tại đây)",  DARK_BLU, WHITE_FONT, "center"),
]);

let r = 2; // current row index for merge tracking
for (const team of TEAM_THEMES) {
  // Header row: ĐỘI A — 3 gói × 4 câu = 12 câu
  DATA.push(teamHeaderRow(team));
  merges.push({ s: { r, c: 0 }, e: { r, c: 4 } });
  r++;

  for (const pkg of [60, 80, 100]) {
    const light = PACKAGES[pkg].light;
    // Sub-header: GÓI 60 | Cấu trúc: 10 → 10 → 20 → 20
    DATA.push(pkgHeaderRow(pkg, light));
    merges.push({ s: { r, c: 0 }, e: { r, c: 4 } });
    r++;

    // 4 câu hỏi
    for (const pts of PACKAGES[pkg].points) {
      DATA.push(dataRow(team, pkg, pts, light));
      r++;
    }
  }
}

const wsData = XLSX.utils.aoa_to_sheet(DATA);
wsData["!cols"] = [
  { wch: 11 },  // ĐỘI
  { wch: 28 },  // GÓI / cấu trúc
  { wch: 7 },   // ĐIỂM
  { wch: 65 },  // CÂU HỎI
  { wch: 35 },  // ĐÁP ÁN
];
wsData["!merges"] = merges;
wsData["!rows"] = [
  { hpt: 36 },  // row 0 – tiêu đề lớn
  { hpt: 28 },  // row 1 – header cột
];
for (let i = 2; i < DATA.length; i++) {
  const isHeader = DATA[i][0].v.toString().includes("gói") || DATA[i][0].v.toString().includes("GÓI");
  wsData["!rows"].push({ hpt: isHeader ? 24 : 28 });
}

wsData["!freeze"] = { xSplit: 0, ySplit: 2 }; // freeze header + tiêu đề

// ─── Sheet 2: Hướng dẫn ──────────────────────────────────────────────────
const guideRows = [
  ["HƯỚNG DẪN SỬ DỤNG TEMPLATE VÒNG 4 — VỀ ĐÍCH", "", ""],
  ["", "", ""],
  ["TỔNG QUAN", "", ""],
  ["4 đội × 3 gói × 4 câu = 48 dòng", "", ""],
  ["Mỗi đội có đủ: Gói 60 (4 câu) + Gói 80 (4 câu) + Gói 100 (4 câu)", "", ""],
  ["", "", ""],
  ["CÁCH NHẬP", "", ""],
  ["Bước 1", "Mở sheet 'Câu hỏi Vòng 4'"],
  ["Bước 2", "Tìm đội cần nhập (angle / news / kop / pol)"],
  ["Bước 3", "Tìm gói cần nhập (Gói 60 / 80 / 100)"],
  ["Bước 4", "Nhập Câu hỏi + Đáp án vào 2 ô vàng trong mỗi dòng"],
  ["Bước 5", "Lưu file Excel (.xlsx)"],
  ["Bước 6", "Quản trị → Câu hỏi → Về đích → Nhập Excel/CSV → chọn file"],
  ["Bước 7", "Kiểm tra tình trạng gói (✓/✗) → Lưu vòng chính"],
  ["", "", ""],
  ["CẤU TRÚC MỖI GÓI", "", ""],
  ["Gói", "Điểm 4 câu", "Tổng"],
  ["60",  "10 → 10 → 20 → 20", "60"],
  ["80",  "10 → 20 → 20 → 30", "80"],
  ["100", "20 → 20 → 30 → 30", "100"],
  ["", "", ""],
  ["QUY TẮC", "", ""],
  ["•", "Cột ĐỘI / GÓI / ĐIỂM: KHÔNG sửa — đã điền sẵn"],
  ["•", "Chỉ nhập vào 2 cột: CÂU HỎI và ĐÁP ÁN (ô vàng)"],
  ["•", "Tên đội: angle, news, kop, pol"],
  ["•", "Gói: 60, 80, 100"],
  ["•", "Điểm: 10, 20, 30 (đúng theo cấu trúc gói)"],
  ["", "", ""],
  ["KHI THI", "", ""],
  ["•", "MC chọn gói cho đội đang thi bằng nút Gói 60đ / 80đ / 100đ"],
  ["•", "Hệ thống tự lấy 4 câu đã nhập cho (đội × gói)"],
  ["•", "Admin không cần biết trước đội nào chọn gói nào"],
];

const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
wsGuide["!cols"] = [{ wch: 12 }, { wch: 60 }, { wch: 25 }];
wsGuide["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

// ─── Ghi file ────────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, wsData, "Câu hỏi Vòng 4");
XLSX.utils.book_append_sheet(wb, wsGuide, "Hướng dẫn");

const outPath = path.join(__dirname, "..", "data", "template-cau-hoi-ve-dich.xlsx");
XLSX.writeFile(wb, outPath);

console.log(`✅ Đã tạo: ${outPath}`);
console.log(`   4 đội × 3 gói × 4 câu = 48 dòng`);
console.log(`   Đội/Gói/Điểm: ĐIỀN SẴN | Câu hỏi/Đáp án: Ô VÀNG → nhập vào`);
