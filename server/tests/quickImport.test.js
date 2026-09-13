// Test nhập nhanh Vòng 1 Khởi động + Vòng phụ từ Excel/CSV (parser mới:
// mỗi file = 1 đội; mỗi dòng = 1 câu; cứ 5 dòng = 1 thí sinh).
// Chạy: node server/tests/quickImport.test.js
import { connectDb } from "../config/database.js";
import { loadDb, getDb, saveDbSync } from "../models/store.js";
import * as quick from "../services/rounds/quickImport.service.js";
import { utf8Name } from "../middleware/upload.js";

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

let snapshot = null;
try {
  await connectDb();
  await loadDb();
  const db = getDb();
  snapshot = JSON.stringify({ media: db.media });
  db.media = [
    { id: "m1", name: "thap-efiel.png", url: "/uploads/tower.png", type: "image" },
    { id: "m2", name: "paris.jpg", url: "https://cdn.test/paris.jpg", type: "image" },
  ];

  // ---------- Khởi động: CSV có tiêu đề, 1 dòng = 1 câu, 5 dòng = 1 thí sinh ----------
  const kdCsv =
    "\uFEFFẢnh,Đáp án\n" +
    "thap-efiel.png,Pháp\n" +
    "paris.jpg,Paris\n" +
    ",Câu 3 không ảnh\n" +
    ",Câu 4\n" +
    ",Câu 5\n" +
    "missing.png,Câu 6 của thí sinh 2\n";
  const kd = quick.parseQuickImport(Buffer.from(kdCsv), "kd.csv", "khoi_dong");
  ok(kd.units.length === 2, "Khởi động: 6 dòng → 2 thí sinh (cụm 5)");
  ok(kd.units[0].items.length === 5, "Khởi động: cụm 1 đủ 5 câu");
  ok(kd.units[0].items[0].media.mediaUrl === "/uploads/tower.png", "Khởi động: dò ảnh theo tên file đã upload");
  ok(kd.units[0].items[0].answer === "Pháp", "Khởi động: đáp án câu 1 đúng");
  ok(kd.units[0].items[1].media.mediaUrl === "https://cdn.test/paris.jpg", "Khởi động: dò ảnh theo tên file p2");
  ok(kd.units[1].items[0].media.hint === "missing.png", "Khởi động: ảnh không thấy → giữ hint để upload từ thư mục");
  ok(kd.errors.some((e) => e.includes("missing.png")), "Khởi động: báo lỗi ảnh chưa tìm thấy");
  ok(kd.units[0].items[2].media.mediaUrl === "" && kd.units[0].items[2].answer === "Câu 3 không ảnh", "Khởi động: câu không ảnh vẫn giữ đáp án");

  // ---------- Khởi động: không tiêu đề, cột 0 = ảnh, cột 1 = đáp án ----------
  const kdCsv2 = "thap-efiel.png,Đáp án A\nthap-efiel.png,Đáp án B\nthap-efiel.png,Đáp án C\nthap-efiel.png,Đáp án D\nthap-efiel.png,Đáp án E\n";
  const kd2 = quick.parseQuickImport(Buffer.from(kdCsv2), "kd2.csv", "khoi_dong");
  ok(kd2.units.length === 1 && kd2.units[0].items[4].answer === "Đáp án E", "Khởi động không tiêu đề: đọc đúng cột 0/1, chia 5");

  // ---------- Vòng phụ: CSV có tiêu đề ----------
  const tbCsv = "\uFEFFCâu hỏi,Đáp án,Ảnh\nThủ đô Việt Nam?,Hà Nội,paris.jpg\nKhông có ảnh,A,\n";
  const tb = quick.parseQuickImport(Buffer.from(tbCsv), "tb.csv", "tie_break");
  ok(tb.added === 2, "Vòng phụ: parse được 2 câu");
  ok(tb.questions[0].question === "Thủ đô Việt Nam?" && tb.questions[0].answer === "Hà Nội", "Vòng phụ: câu hỏi/đáp án đúng");
  ok(tb.questions[0].media.mediaUrl === "https://cdn.test/paris.jpg", "Vòng phụ: dò ảnh theo tên file");
  ok(tb.questions[1].media.mediaUrl === "" && tb.questions[1].answer === "A", "Vòng phụ: câu không ảnh vẫn nhập đáp án");

  // ---------- build object DB ----------
  const cluster = quick.buildKhoiDongCluster(kd.units[0].items, "a");
  ok(cluster.length === 5 && cluster[0].id && cluster[0].points === 10 && cluster[0].mediaType === "image", "buildKhoiDongCluster: 5 câu, đủ trường DB");
  const q = quick.buildTieBreakQuestion(tb.questions[0]);
  ok(q.id && q.options?.length === 0 && q.note === "" && q.question !== "", "buildTieBreakQuestion: đủ trường DB");

  // ---------- File rỗng → lỗi ----------
  let threw = false;
  try {
    quick.parseQuickImport(Buffer.from(""), "empty.csv", "khoi_dong");
  } catch {
    threw = true;
  }
  ok(threw, "File rỗng ném lỗi");

  // ---------- XLSX thực tế (tạo file nhớ) ----------
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([["Ảnh", "Đáp án"], ["thap-efiel.png", "Paris"]]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const kdX = quick.parseQuickImport(buf, "kd.xlsx", "khoi_dong");
  ok(kdX.units[0].items[0].media.mediaUrl === "/uploads/tower.png" && kdX.units[0].items[0].answer === "Paris", "XLSX Khởi động: header 'Ảnh, Đáp án' parse đúng");

  // ---------- resolveMedia hỗ trợ URL dán thẳng ----------
  const r = quick.resolveMedia("https://img.test/anh-xa.jpg");
  ok(r.mediaUrl === "https://img.test/anh-xa.jpg" && r.mediaType === "image", "URL dán thẳng dùng luôn");

  // ---------- Nhập nhanh chỉ bằng ảnh: đáp án từ tên file ----------
  ok(quick.answerFromImageName("Pháp.png") === "Pháp", "Tên file trần → đáp án nguyên tên");
  ok(quick.answerFromImageName("01-Pháp.png") === "Pháp", "Bỏ số thứ tự '01-' đầu tên");
  ok(quick.answerFromImageName("1. Mỹ.jpg") === "Mỹ", "Bỏ số thứ tự '1.' đầu tên");
  ok(quick.answerFromImageName("(2) Ý.png") === "Ý", "Bỏ số thứ tự '(2)' đầu tên");
  ok(quick.answerFromImageName("03_phan-thiet.JPEG") === "phan-thiet", "Bỏ số + gạch dưới, đuôi hoa");
  ok(quick.answerFromImageName("cau-vang.png") === "cau-vang", "Tên không số giữ nguyên");

  // ---------- Chia cụm 5 ảnh = 1 thí sinh ----------
  const entries = Array.from({ length: 11 }, (_, i) => ({
    media: { mediaUrl: `/uploads/a${i + 1}.png`, mediaType: "image", hint: "" },
    answer: `A${i + 1}`,
  }));
  const imgClusters = quick.buildKhoiDongImageClusters(entries, "b");
  ok(imgClusters.length === 3, "11 ảnh → 3 thí sinh (5+5+1 đệm 5)");
  ok(imgClusters[0].length === 5 && imgClusters[2].length === 5, "Mỗi cụm đủ 5 ô (cụm cuối đệm trống)");
  ok(imgClusters[0][0].mediaUrl === "/uploads/a1.png" && imgClusters[0][0].answer === "A1", "Cụm 1 đúng ảnh + đáp án đầu");
  ok(imgClusters[2][0].mediaUrl === "/uploads/a11.png" && imgClusters[2][1].mediaUrl === "", "Cụm cuối: ảnh 11 ở ô 1, ô 2 trống");

  // ---------- Decode tên file UTF-8 (multer/busboy decode latin1 gây mojibake) ----------
  ok(utf8Name("Phap.png") === "Phap.png", "utf8Name: ASCII giữ nguyên");
  const mojibake = Buffer.from("01-Pháp.png", "utf8").toString("latin1");
  ok(utf8Name(mojibake) === "01-Pháp.png", "utf8Name: mojibake latin1 → tiếng Việt đúng");
  const bad = "café.txt"; // é (U+00E9) đơn lẻ không hợp lệ UTF-8 → decode sinh U+FFFD → giữ nguyên
  ok(utf8Name(bad) === bad, "utf8Name: tên latin1 thật giữ nguyên");
  ok(!utf8Name(bad).includes("\uFFFD"), "utf8Name: không sinh ký tự lỗi");
} catch (e) {
  console.error("ERROR:", e);
  fail += 1;
} finally {
  if (snapshot) {
    const db = getDb();
    const prev = JSON.parse(snapshot);
    db.media = prev.media;
    saveDbSync();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}