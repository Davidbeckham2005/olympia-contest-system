// Test NHẬP CÂU HỎI Về đích từ file Excel/CSV (từ khi bỏ "tự thêm câu"):
//   - parse CSV có tiêu đề / không tiêu đề (vị trí 3 cột);
//   - parseVeDichRows nhận dạng header tiếng Việt/Anh, chuẩn mức điểm;
//   - importVeDichFile: CHỈ ĐỌC & XÁC MINH, KHÔNG ghi câu vào ngân hàng;
//   - test tự khôi phục DB về trạng thái trước khi chạy.
import fs from "fs";
import { connectDb } from "../config/database.js";
import { loadDb, getDb, saveDbSync } from "../models/store.js";
import * as vedich from "../services/rounds/veDich.service.js";

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

function csvBuffer(text) {
  return Buffer.from(text, "utf8");
}

await connectDb();

// 1) CSV có tiêu đề.
const rows = vedich.parseVeDichText("Điểm,Câu hỏi,Đáp án\n10,Thủ đô Việt Nam?,Hà Nội\n20,,Pháp\n");
ok(rows.length === 2, "parseVeDichText ĐỌC đủ dòng dữ liệu (bỏ qua tiêu đề)");
ok(rows[0].points === 10 && rows[0].question === "Thủ đô Việt Nam?" && rows[0].answer === "Hà Nội", "dòng hợp lệ: điểm/câu/đáp án đúng");
ok(rows[1].points === 20 && rows[1].question === "" && rows[1].answer === "Pháp", "dòng thiếu câu hỏi: giữ nguyên để import bỏ qua");

// 2) CSV không tiêu đề → quy ước 3 cột (điểm, câu hỏi, đáp án).
const p2 = vedich.parseVeDichText("30,Câu ba,Đáp án ba\n10,Câu một,Đáp án một\n");
ok(p2.length === 2 && p2[0].points === 30 && p2[0].question === "Câu ba" && p2[0].answer === "Đáp án ba", "CSV không tiêu đề: 3 cột theo vị trí");

// 2b) Cột STT ở đầu — có tiêu đề (được bỏ qua) và không tiêu đề (4 cột: STT, điểm, câu, đáp án).
const stt1 = vedich.parseVeDichText("STT,Điểm,Câu hỏi,Đáp án\n1,10,Câu S1,Đáp S1\n2,30,Câu S2,Đáp S2\n");
ok(stt1.length === 2 && stt1[0].points === 10 && stt1[0].question === "Câu S1" && stt1[1].points === 30, "STT có tiêu đề: bỏ qua cột STT");
const stt2 = vedich.parseVeDichText("1,20,Câu X1,Đáp X1\n2,10,Câu X2,Đáp X2\n");
ok(stt2.length === 2 && stt2[0].points === 20 && stt2[0].question === "Câu X1" && stt2[1].points === 10, "STT không tiêu đề: đọc đúng điểm/câu/đáp án từ cột 2-4");

// 3) parseVeDichRows nhận dạng cột tiếng Anh + chuẩn mức điểm.
const en = vedich.parseVeDichRows([{ points: "40", question: "Q?", answer: "A" }, { Score: 20, Question: "Q2", Key: "K" }]);
ok(en.length === 2 && en[0].points === 30, "mức 40đ lạ chuẩn về 30đ");
ok(en[1].points === 20 && en[1].question === "Q2" && en[1].answer === "K", "nhận dạng cột tiếng Anh (Score/Question/Key)");

// 3b) Excel mẫu có tiêu đề lớn + tiêu đề nhóm/gói trước header thật.
const template = fs.readFileSync(new URL("../../client/public/files/template-cau-hoi-ve-dich.xlsx", import.meta.url));
const templateRows = vedich.parseVeDichXlsx(template);
ok(templateRows.length === 48, "Excel mẫu đọc đủ 48 dòng câu hỏi");
ok(
  templateRows[0]?.team === "ĐỘI A" && templateRows[0]?.pkg === 60 && templateRows[0]?.points === 10,
  "Excel mẫu nhận đúng Đội/Gói/Điểm từ header thật"
);

// 4) Import thật vào ngân hàng chung + khôi phục DB.
let snapshot = null;
try {
  await loadDb();
  vedich.init({ emit: () => { } });
  snapshot = JSON.stringify(getDb().questions.main.veDich);

  const bank = getDb().questions.main.veDich;
  const dupQ = (bank.find((q) => q && q.question) || {}).question || "Thủ đô của Việt Nam là thành phố nào?";

  const csv = `Điểm,Câu hỏi,Đáp án\n10,${dupQ},Trùng\n10,Câu import mới A,Đáp A\n30,Câu import mới B,Đáp B\n,,\n20,,thiếu câu\n`;
  const r = vedich.importVeDichFile(csvBuffer(csv), "x.csv");

  ok(r.added === 2, `nhận diện đúng 2 câu mới (thực tế ${r.added})`);
  ok(r.skipped === 1, `nhận diện 1 câu trùng nội dung (thực tế ${r.skipped})`);
  ok((r.errors || []).length === 1, "ghi lỗi 1 dòng thiếu câu hỏi");
  ok(r.total === bank.length, `import KHÔNG ghi DB: ngân hàng giữ nguyên ${bank.length} → ${r.total}`);
  ok(r.questions.every((q) => q.id && q.points === 10 || q.points === 30), "câu mới có id + mức điểm hợp lệ");

  // Import lặp lại → kết quả y hệt (không ghi nên không đổi).
  const r2 = vedich.importVeDichFile(csvBuffer(csv), "x.csv");
  ok(r2.added === 2 && r2.skipped === 1, "import lặp: vẫn chỉ đọc, không ghi (added/skipped như cũ)");
} catch (err) {
  fail += 1;
  console.error("ERROR:", err.message);
} finally {
  if (snapshot) {
    await loadDb();
    getDb().questions.main.veDich = JSON.parse(snapshot);
    await saveDbSync();
    console.log("Đã khôi phục DB về trạng thái ban đầu.");
  }
}

// 5) Import có cột Đội + Gói → gán fixed teamId/pkg/order và trả về trạng thái gói theo đội.
try {
  await loadDb();
  vedich.init({ emit: () => { } });

  const bank2 = getDb().questions.main.veDich;
  const snapshot2 = JSON.stringify(bank2);
  try {
    const csvT = "Đội,Gói,Điểm,Câu hỏi,Đáp án\nĐội A,60,10,Câu gói A mới 1,Đáp 1\nĐội A,60,20,Câu gói A mới 2,Đáp 2\nĐội B,80,30,Câu gói B mới 1,Đáp 3\nĐội Xyz,60,10,Câu đội lạ,Đáp 4\nĐội A,999,10,Câu gói lạ,Đáp 5\n,100,20,Câu spare có gói nhưng không đội,Đáp 6\n";
    const r3 = vedich.importVeDichFile(csvBuffer(csvT), "t.csv");
    const newQs = r3.questions;
    const qA1 = newQs.find((q) => q.teamId === "a" && q.pkg === 60 && q.question === "Câu gói A mới 1");
    const qA2 = newQs.find((q) => q.teamId === "a" && q.pkg === 60 && q.question === "Câu gói A mới 2");
    const qB1 = newQs.find((q) => q.teamId === "b" && q.pkg === 80 && q.question === "Câu gói B mới 1");
    const qName = newQs.find((q) => q.question === "Câu gói A mới 1");
    ok(qA1?.order && qA2?.order && qA2.order === qA1.order + 1, "order của câu trong cùng (đội,gói) tăng liên tục (5, 6 sau mãng seed 4)");
    ok(qB1?.order, "order tính riêng cho từng (đội,gói)");
    ok(qName && qName.teamId === "a" && qName.pkg === 60, "resolve tên đội Đội A → teamId a, gói 60");
    ok((r3.errors || []).some((e) => String(e).includes("Đội Xyz")), "đội không tồn tại → dòng lỗi");
    ok((r3.errors || []).some((e) => String(e).includes("999")), "gói không hợp lệ → dòng lỗi");
    ok(r3.questions.some((q) => q.question === "Câu spare có gói nhưng không đội" && !q.teamId), "không khai đội → câu spare (không gán)");
    const teamAVd = (r3.teams || []).find((t) => t.teamId === "a");
    ok(teamAVd && Number(teamAVd.packages[60]?.have) === 4, "import không ghi: gói 60 của Đội A chỉ đếm 4 câu seed trong ngân hàng");
  } finally {
    const db2 = getDb();
    db2.questions.main.veDich = JSON.parse(snapshot2);
    await saveDbSync();
    console.log("Đã khôi phục DB khỏi test nhập đội/gói.");
  }
} catch (err) {
  fail += 1;
  console.error("ERROR:", err.message);
}

// 6) Production: đội KHÔNG còn id/tên mặc định a/b/c/d → cột Đội "a"/"b"/"c"/"d"
// vẫn map theo THỨ TỰ danh sách đội hiện có ("a" → đội đầu tiên, "b" → đội kế tiếp).
try {
  await loadDb();
  vedich.init({ emit: () => { } });

  const bank3 = getDb().questions.main.veDich;
  const teamsSnapshot3 = JSON.stringify(getDb().teams);
  const questionsSnapshot3 = JSON.stringify(bank3);
  try {
    // Giả lập production: đội có id/tên khác "a"/"b" (vd id "t1", "t2").
    getDb().teams = [
      { id: "t1", name: "Đội Sao Đỏ", memberIds: [], score: 0 },
      { id: "t2", name: "Đội Sao Vàng", memberIds: [], score: 0 },
      { id: "t3", name: "Đội Sao Xanh", memberIds: [], score: 0 },
      { id: "t4", name: "Đội Sao Tím", memberIds: [], score: 0 },
    ];
    getDb().questions.main.veDich = [];
    const csvT = "Đội,Gói,Điểm,Câu hỏi,Đáp án\na,60,10,Câu order a,Đáp 1\nb,60,10,Câu order b,Đáp 1\nc,60,10,Câu order c,Đáp 1\nd,60,10,Câu order d,Đáp 1\n";
    const r4 = vedich.importVeDichFile(csvBuffer(csvT), "prod.csv");
    ok(r4.added === 4, "production: import đủ 4 câu với cột Đội a/b/c/d");
    ok(r4.questions.find((q) => q.question === "Câu order a")?.teamId === "t1", "production: 'a' → đội đầu tiên (t1)");
    ok(r4.questions.find((q) => q.question === "Câu order b")?.teamId === "t2", "production: 'b' → đội kế tiếp (t2)");
    ok(r4.questions.find((q) => q.question === "Câu order c")?.teamId === "t3", "production: 'c' → đội thứ 3 (t3)");
    ok(r4.questions.find((q) => q.question === "Câu order d")?.teamId === "t4", "production: 'd' → đội thứ 4 (t4)");
  } finally {
    getDb().teams = JSON.parse(teamsSnapshot3);
    getDb().questions.main.veDich = JSON.parse(questionsSnapshot3);
    await saveDbSync();
    console.log("Đã khôi phục DB khỏi test production.");
  }
} catch (err) {
  fail += 1;
  console.error("ERROR:", err.message);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);