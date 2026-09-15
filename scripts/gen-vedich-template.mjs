// scripts/gen-vedich-template.mjs
// Template nhập câu hỏi Vòng 4 (Về đích) — 4 đội × 3 gói × 4 câu = 48
// Đổi tên đội NHANH đúng 1 nơi: 4 ô vàng ở bảng cấu hình đầu sheet — mọi cột ĐỘI
// (dòng header + 48 dòng dữ liệu) là CÔNG THỨC tham chiếu tới bảng đó, tự cập nhật.
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

// 4 ô cấu hình tên đội (A1-style) — CHỈ SỬA 4 Ô VÀNG này.
// Layout: dòng 3 (B3/D3): "Đội thi 1" | <tên> | "Đội thi 2" | <tên>
//         dòng 4 (B4/D4): "Đội thi 3" | <tên> | "Đội thi 4" | <tên>
// REF = địa chỉ ô, FORMULA = công thức tham chiếu (SheetJS lưu không dấu "=").
const TEAM_CONFIG = [
  { name: "angle", label: "Đội thi 1", ref: "$B$3", address: "B3" },
  { name: "news",  label: "Đội thi 2", ref: "$D$3", address: "D3" },
  { name: "kop",   label: "Đội thi 3", ref: "$B$4", address: "B4" },
  { name: "pol",   label: "Đội thi 4", ref: "$D$4", address: "D4" },
];

const PACKAGES = {
  60:  { label: "GÓI 60", points: [10, 10, 20, 20], light: { fgColor: { rgb: "FFF2CC" } } },
  80:  { label: "GÓI 80", points: [10, 20, 20, 30], light: { fgColor: { rgb: "FCE4D6" } } },
  100: { label: "GÓI 100", points: [20, 20, 30, 30], light: { fgColor: { rgb: "DEEBF7" } } },
};

const WHITE_FONT = { color: { rgb: "FFFFFF" }, bold: true };
const DARK_FONT  = { color: { rgb: "000000" }, bold: true };
const NORM_FONT  = { color: { rgb: "000000" }, bold: false };

function cellStyle(fill, font, align = "left") {
  return {
    fill,
    font: font || NORM_FONT,
    alignment: { horizontal: align, vertical: "center", wrapText: true },
    border: { top: { style: "thin", color: { rgb: "AAAAAA" } }, bottom: { style: "thin", color: { rgb: "AAAAAA" } }, left: { style: "thin", color: { rgb: "AAAAAA" } }, right: { style: "thin", color: { rgb: "AAAAAA" } } },
  };
}

function mkCell(v, fill, font, align = "left") {
  return {
    t: typeof v === "number" ? "n" : "s",
    v,
    s: cellStyle(fill, font, align),
  };
}

// Ô CÓ CÔNG THỨC: v = giá trị cached (để file đọc/import đúng NGAY),
// f = công thức tham chiếu (Excel/LibreOffice tính lại khi người dùng sửa tên đội).
function mkFormulaCell(v, f, fill, font, align = "left") {
  return {
    t: "s",
    v,
    f,
    s: cellStyle(fill, font, align),
  };
}

function emptyYellow() {
  return mkCell("", YELLOW, NORM_FONT, "left");
}

// Header đội: tên lấy từ cấu hình qua công thức ghép chuỗi.
function teamHeaderRow(team, cfg) {
  const cached = `${team.name} — 3 gói × 4 câu = 12 câu`;
  const f = `${cfg.ref} & " — 3 gói × 4 câu = 12 câu"`;
  return [
    mkFormulaCell(cached, f, team.bg, WHITE_FONT, "center"),
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

// Dòng câu: cột ĐỘI là CÔNG THỨC tham chiếu ô cấu hình tên đội.
function dataRow(team, pkg, pts, light, cfg) {
  return [
    mkFormulaCell(team.name, cfg.ref, light, NORM_FONT, "center"),
    mkCell(pkg,       light, NORM_FONT, "center"),
    mkCell(pts,       light, NORM_FONT, "center"),
    emptyYellow(),
    emptyYellow(),
  ];
}

// ─── build sheet data ────────────────────────────────────────────────────────
const DATA = [];

// Dòng 0 — tiêu đề chính
DATA.push([
  mkCell("VÒNG 4 — VỀ ĐÍCH  |  4 đội × 3 gói × 4 câu = 48 câu  |  SỬA TÊN ĐỘI Ở BẢNG VÀNG BÊN DƯỚI (4 ô) — Chỉ nhập CÂU HỎI & ĐÁP ÁN",
    DARK_BLU, WHITE_FONT, "center"),
  mkCell("", DARK_BLU, WHITE_FONT, "center"),
  mkCell("", DARK_BLU, WHITE_FONT, "center"),
  mkCell("", DARK_BLU, WHITE_FONT, "center"),
  mkCell("", DARK_BLU, WHITE_FONT, "center"),
]);

// Dòng 1 — hướng dẫn cấu hình
DATA.push([
  mkCell("①  ĐIỀN 4 TÊN ĐỘI THI VÒNG 4 VÀO 4 Ô VÀNG (thay angle/news/kop/pol) — cả sheet tự cập nhật", DARK_BLU, WHITE_FONT, "center"),
  mkCell("", DARK_BLU, WHITE_FONT, "center"),
  mkCell("", DARK_BLU, WHITE_FONT, "center"),
  mkCell("", DARK_BLU, WHITE_FONT, "center"),
  mkCell("", DARK_BLU, WHITE_FONT, "center"),
]);

// Dòng 2-3 — bảng cấu hình 4 tên đội: 2 ô vàng mỗi dòng (tên 1&2 / tên 3&4).
// Đây là ô NHẬP — là giá trị trực tiếp (không công thức), các dòng dữ liệu tham chiếu tới.
function configCells(pair) {
  return [
    mkCell(pair[0].label, WHITE, DARK_FONT, "right"),
    mkCell(pair[0].name, YELLOW, DARK_FONT, "center"),
    mkCell(pair[1].label, WHITE, DARK_FONT, "right"),
    mkCell(pair[1].name, YELLOW, DARK_FONT, "center"),
    mkCell("", WHITE, NORM_FONT, "left"),
  ];
}
DATA.push(configCells([TEAM_CONFIG[0], TEAM_CONFIG[1]]));
DATA.push(configCells([TEAM_CONFIG[2], TEAM_CONFIG[3]]));

// Dòng 4 — tiêu đề cột THẬT (đây là header mà server nhận diện để nhập câu)
DATA.push([
  mkCell("ĐỘI",     DARK_BLU, WHITE_FONT, "center"),
  mkCell("GÓI",     DARK_BLU, WHITE_FONT, "center"),
  mkCell("ĐIỂM",    DARK_BLU, WHITE_FONT, "center"),
  mkCell("CÂU HỎI  ✎ (nhập tại đây)", DARK_BLU, WHITE_FONT, "center"),
  mkCell("ĐÁP ÁN  ✎ (nhập tại đây)",  DARK_BLU, WHITE_FONT, "center"),
]);

// Các khối đội (bắt đầu sau tiêu đề thật) — tham chiếu tên từ cấu hình.
const dataStartRow = DATA.length; // 0-index of team block start = 5
const mergeRows = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }];
for (let k = 0; k < 4; k++) {
  const team = TEAM_THEMES[k];
  const cfg = TEAM_CONFIG[k];
  DATA.push(teamHeaderRow(team, cfg));
  mergeRows.push({ s: { r: DATA.length - 1, c: 0 }, e: { r: DATA.length - 1, c: 4 } });

  for (const pkg of [60, 80, 100]) {
    const light = PACKAGES[pkg].light;
    DATA.push(pkgHeaderRow(pkg, light));
    mergeRows.push({ s: { r: DATA.length - 1, c: 0 }, e: { r: DATA.length - 1, c: 4 } });

    for (const pts of PACKAGES[pkg].points) {
      DATA.push(dataRow(team, pkg, pts, light, cfg));
    }
  }
}

const wsData = XLSX.utils.aoa_to_sheet(DATA);
wsData["!cols"] = [
  { wch: 14 },  // ĐỘI
  { wch: 28 },  // GÓI / cấu trúc
  { wch: 7 },   // ĐIỂM
  { wch: 65 },  // CÂU HỎI
  { wch: 35 },  // ĐÁP ÁN
];
wsData["!merges"] = mergeRows;
wsData["!rows"] = [
  { hpt: 36 },  // row 0 – tiêu đề lớn
  { hpt: 24 },  // row 1 – hướng dẫn cấu hình
  { hpt: 22 },  // row 2 – cấu hình đội 1-2
  { hpt: 22 },  // row 3 – cấu hình đội 3-4
  { hpt: 28 },  // row 4 – header cột thật
];
for (let i = dataStartRow; i < DATA.length; i++) {
  const isHeader = DATA[i][0].v.toString().includes("gói") || DATA[i][0].v.toString().includes("GÓI");
  wsData["!rows"].push({ hpt: isHeader ? 24 : 28 });
}

// Freeze tiêu đề + bảng cấu hình + header cột (5 dòng đầu) khi cuộn.
wsData["!freeze"] = { xSplit: 0, ySplit: 5 };

// ─── Sheet 2: Hướng dẫn ──────────────────────────────────────────────────
const guideRows = [
  ["HƯỚNG DẪN SỬ DỤNG TEMPLATE VÒNG 4 — VỀ ĐÍCH", "", ""],
  ["", "", ""],
  ["TỔNG QUAN", "", ""],
  ["4 đội × 3 gói × 4 câu = 48 dòng", "", ""],
  ["Mỗi đội có đủ: Gói 60 (4 câu) + Gói 80 (4 câu) + Gói 100 (4 câu)", "", ""],
  ["", "", ""],
  ["BƯỚC 0 — ĐỔI TÊN 4 ĐỘI (QUAN TRỌNG)", "", ""],
  ["•", "Chọn được 4/6 đội vào Vòng 4 rồi?"],
  ["•", "Mở sheet 'Câu hỏi Vòng 4', sửa TÊN 4 ĐỘI ngay dòng 3-4 (4 ô vàng) — MỘT NƠI DUY NHẤT"],
  ["•", "Cả sheet (cột ĐỘI 48 dòng + dòng tiêu đề) tự cập nhật theo — không cần sửa đâu khác"],
  ["", "", ""],
  ["CÁCH NHẬP", "", ""],
  ["Bước 1", "Nhập Câu hỏi + Đáp án vào 2 ô vàng trong mỗi dòng"],
  ["Bước 2", "Lưu file Excel (.xlsx)"],
  ["Bước 3", "Quản trị → Câu hỏi → Về đích → Nhập Excel/CSV → chọn file"],
  ["Bước 4", "Kiểm tra tình trạng gói (✓/✗) → Lưu vòng chính"],
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
  ["•", "Tên đội phải trùng ĐÚNG tên đội trong hệ thống (không dấu, không thêm 'Đội')"],
  ["•", "Gói: 60, 80, 100"],
  ["•", "Điểm: 10, 20, 30 (đúng theo cấu trúc gói)"],
  ["", "", ""],
  ["KHI THI", "", ""],
  ["•", "MC chọn gói cho đội đang thi bằng nút Gói 60đ / 80đ / 100đ"],
  ["•", "Hệ thống tự lấy 4 câu đã nhập cho (đội × gói)"],
  ["•", "Admin không cần biết trước đội nào chọn gói nào"],
];

const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
wsGuide["!cols"] = [{ wch: 12 }, { wch: 70 }, { wch: 25 }];
wsGuide["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];

// ─── Ghi file ────────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, wsData, "Câu hỏi Vòng 4");
XLSX.utils.book_append_sheet(wb, wsGuide, "Hướng dẫn");

const outPath = path.join(__dirname, "..", "data", "template-cau-hoi-ve-dich.xlsx");
XLSX.writeFile(wb, outPath);

console.log(`✅ Đã tạo: ${outPath}`);
console.log(`   4 đội × 3 gói × 4 câu = 48 dòng`);
console.log(`   Đổi tên 4 đội: CHỈ SỬA 4 Ô VÀNG dòng 3-4 của sheet 'Câu hỏi Vòng 4'`);
console.log(`   Đội/Gói/Điểm: ĐIỀN SẴN | Câu hỏi/Đáp án: Ô VÀNG → nhập vào`);