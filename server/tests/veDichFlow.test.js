// Test LUỒNG chọn gói Vòng 4 — CÂU CỐ ĐỊNH THEO ĐỘI + GÓI (teamId/pkg/order):
//   - selectPackage trả đúng 4 câu theo cấu trúc gói;
//   - câu gán cố định theo đội, không random;
//   - chọn lại gói lấy đúng 4 câu cũ (giữ nguyên);
//   - câu các đội không trùng nhau (do seed đã phân bổ).
// Test tự khôi phục DB về trạng thái trước khi chạy (không làm bẩn dữ liệu thật).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDb } from "../config/database.js";
import { loadDb, getDb, saveDbSync } from "../models/store.js";
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

let snapshot = null;
try {
  await connectDb();
  await loadDb();
  // Nạp seed veDich từ file JSON (giả lập nhập Excel một lần trước khi thi).
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/questions-main.json"), "utf8"));
  getDb().questions.main.veDich = Array.isArray(seed.veDich) ? seed.veDich : [];

  vedich.init({ emit: () => {} });

  snapshot = {
    game: JSON.stringify(getDb().game),
    veDich: JSON.stringify(getDb().questions.main.veDich),
  };

  const db = getDb();
  const teams = ["a", "b", "c", "d"];
  const packages = [60, 80, 100, 60];
  db.game.veDich = vedich.defaultState();
  db.game.round = "ve_dich";

  // 1) Mỗi đội chọn gói → nhận đúng 4 câu theo cấu trúc gói.
  const plans = {};
  teams.forEach((tid, i) => {
    db.game.currentTeam = tid;
    const pickedIds = vedich.selectPackage(packages[i]);
    plans[tid] = { pkg: packages[i], ids: pickedIds };
    ok(Array.isArray(pickedIds) && pickedIds.length === 4, `đội ${tid.toUpperCase()} chọn gói ${packages[i]} nhận đúng 4 câu`);
  });

  // 2) Kết cấu gói khớp cấu trúc + đủ mức điểm.
  for (const tid of teams) {
    const { pkg, ids } = plans[tid];
    const ptrs = ids.map((id) => (db.questions.main.veDich.find((x) => x.id === id) || {}).points);
    ok(String(ptrs.sort((a, b) => a - b)) === String(vedich.PACKAGES[pkg].slice().sort((a, b) => a - b)), `đội ${tid.toUpperCase()}: bộ câu đúng mức điểm gói ${pkg}`);
  }

  // 3) Mỗi đội chỉ dùng câu gắn teamId trùng tên đội (câu cố định, không random).
  for (const tid of teams) {
    const ids = plans[tid].ids;
    const qTeamIds = ids.map((id) => (db.questions.main.veDich.find((x) => x.id === id) || {}).teamId);
    const allMatchTeam = qTeamIds.every((t) => t === tid);
    ok(allMatchTeam, `đội ${tid.toUpperCase()}: 4 câu trả về đều gắn teamId = ${tid.toUpperCase()}`);
  }

  // 4) Câu các đội không trùng nhau (seed đã phân bổ riêng).
  const all = teams.flatMap((t) => plans[t].ids);
  ok(new Set(all).size === all.length, `4 đội dùng 16 câu KHÔNG trùng lặp (unique ${new Set(all).size}/16)`);

  // 5) Chọn lại gói cho 1 đội → trả đúng 4 câu Y HƯƠNG ban đầu (giữ nguyên cố định).
  const oldA = [...plans.a.ids];
  db.game.currentTeam = "a";
  const repick = vedich.selectPackage(60);
  ok(JSON.stringify(repick) === JSON.stringify(oldA), "chọn lại gói đội A trả đúng 4 câu Y HƯƠNG ban đầu (cố định)");
} catch (err) {
  fail += 1;
  console.error("ERROR:", err.message);
} finally {
  if (snapshot) {
    const db = getDb();
    db.game = JSON.parse(snapshot.game);
    db.questions.main.veDich = JSON.parse(snapshot.veDich);
    await saveDbSync();
    console.log("Đã khôi phục DB về trạng thái ban đầu.");
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
