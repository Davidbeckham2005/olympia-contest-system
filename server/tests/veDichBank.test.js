// Test ngân hàng câu Vòng 4 (Về đích): NGÂN HÀNG CHUNG, mỗi câu gán CỐ ĐỊNH teamId/pkg/order.
//   - dữ liệu seed là mảng chung, đủ tối thiểu 12 câu 10đ + 24 câu 20đ + 12 câu 30đ;
//   - mỗi đội (a/b/c/d) có ĐỦ 3 gói 60/80/100, mỗi gói đúng 4 câu theo cấu trúc;
//   - normalizeBank giữ teamId/pkg/order, khử trùng id, chuẩn mức điểm về 10/20/30.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as vedich from "../services/rounds/veDich.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) {
    pass += 1;
    console.log("PASS:", msg);
  } else {
    fail += 1;
    console.error("FAIL:", msg);
  }
}

// 1) File seed: veDich là MẢNG CHUNG (mỗi câu gắn teamId/pkg/order) và đủ tối thiểu theo mức.
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/questions-main.json"), "utf8"));
ok(Array.isArray(seed.veDich), "seed veDich là mảng chung (câu gắn teamId/pkg/order)");
ok(seed.veDich.every((q) => q && typeof q === "object" && q.id), "mọi câu trong ngân hàng có id");
const counts = {};
for (const q of seed.veDich || []) counts[Number(q.points)] = (counts[Number(q.points)] || 0) + 1;
for (const [lv, need] of Object.entries(vedich.BANK_REQUIREMENTS)) {
  const have = counts[Number(lv)] || 0;
  ok(have >= need, `ngân hàng chung đủ câu ${lv}đ (${have} >= ${need})`);
}

// 1b) Mỗi đội a/b/c/d đủ 3 gói, mỗi gói đúng 4 câu theo cấu trúc điểm.
for (const tid of ["a", "b", "c", "d"]) {
  for (const [total, structure] of Object.entries(vedich.PACKAGES)) {
    const qs = seed.veDich.filter((q) => q.teamId === tid && q.pkg === Number(total));
    const ptrs = qs.map((q) => Number(q.points)).sort((x, y) => x - y);
    ok(
      String(ptrs) === String(structure.slice().sort((x, y) => x - y)),
      `đội ${tid.toUpperCase()} gói ${total}đ đủ đúng 4 câu theo cấu trúc (${JSON.stringify(structure)})`
    );
  }
}

// 2) Cấu trúc gói: mỗi gói đúng 4 câu và tổng điểm khớp.
for (const [total, structure] of Object.entries(vedich.PACKAGES)) {
  ok(structure.length === 4, `gói ${total}đ có đúng 4 câu`);
  ok(structure.reduce((a, b) => a + b, 0) === Number(total), `gói ${total}đ tổng điểm = ${structure.reduce((a, b) => a + b, 0)}`);
}

// 3) normalizeBank: dẹp dữ liệu cũ (object { teamId: [...] }) → mảng chung,
//    khử trùng theo id, mức điểm lạ chuẩn về 10/20/30.
const oldStyle = {
  a: [
    { id: "q1", points: 20, teamId: "a", pkg: 60, order: 1, question: "A", answer: "1" },
    { id: "q1", points: 20, teamId: "a", pkg: 60, order: 1, question: "trùng-id", answer: "" },
    { id: "q2", points: 40, question: "B", answer: "2" },
  ],
  b: [{ id: "q3", points: 10, teamId: "b", pkg: 60, order: 2, question: "C", answer: "3" }],
};
const flat = vedich.normalizeBank(oldStyle);
ok(Array.isArray(flat) && flat.length === 3, "normalizeBank dẹp object gắn đội → mảng chung, khử trùng id");
ok(flat.find((x) => x.id === "q1")?.question === "A", "khử trùng id giữ câu xuất hiện trước");
ok(flat.find((x) => x.id === "q2")?.points === 30, "mức điểm lạ (40đ) chuẩn về 30đ");
ok(flat.find((x) => x.id === "q3")?.points === 10, "mức điểm hợp lệ giữ nguyên");
ok(flat.find((x) => x.id === "q1")?.teamId === "a" && flat.find((x) => x.id === "q1")?.pkg === 60 && flat.find((x) => x.id === "q1")?.order === 1, "normalizeBank GIỮ teamId/pkg/order");
ok(flat.find((x) => x.id === "q2")?.teamId === undefined, "câu không gán đội giữ là spare (teamId undefined)");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);