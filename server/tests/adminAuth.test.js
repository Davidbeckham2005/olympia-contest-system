// Suite: bảo vệ khu vực ban tổ chức — checkPin/requirePin.
// Chạy: node server/tests/adminAuth.test.js
import { connectDb } from "../config/database.js";
import { loadDb, getDb, saveDbSync } from "../models/store.js";
import { config } from "../config/env.js";
import { checkPin, expectedPin } from "../middleware/requirePin.js";
import * as game from "../services/game.service.js";

let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) {
    pass += 1;
    console.log("PASS:", msg);
  } else {
    fail += 1;
    console.error("FAIL:", msg);
  }
};

let snapshot = null;
const devIsProd = config.isProduction;
const devToken = config.adminToken;
try {
  await connectDb();
  await loadDb();
  snapshot = JSON.stringify({ game: getDb().game, teams: getDb().teams });
  getDb().settings.pin = "2026";

  // --- DEV: dùng PIN DB ---
  config.isProduction = false;
  config.adminToken = "";
  ok(expectedPin() === "2026", "dev: expectedPin = PIN DB (2026)");
  ok(checkPin("2026") === true, "dev: PIN 2026 hop le");
  ok(checkPin("0000") === false, "dev: PIN sai bi tu choi");
  ok(checkPin("") === false, "dev: PIN trong bi tu choi");
  ok(checkPin(null) === false, "dev: thieu pin bi tu choi");
  ok(checkPin(2026) === true, "dev: pin dang so van hop le (so sanh string)");

  // --- Production không ADMIN_TOKEN: khóa toàn bộ ---
  config.isProduction = true;
  config.adminToken = "";
  ok(expectedPin() === "", "prod(no token): expectedPin rong");
  ok(checkPin("2026") === false, "prod(no token): PIN DB khong con tac dung");
  ok(checkPin("") === false, "prod(no token): moi thu bi tu choi");

  // --- Production có ADMIN_TOKEN: chỉ token hoạt động ---
  config.adminToken = "s3cret-token";
  ok(expectedPin() === "s3cret-token", "prod(token): expectedPin = ADMIN_TOKEN");
  ok(checkPin("s3cret-token") === true, "prod(token): ADMIN_TOKEN hop le");
  ok(checkPin("2026") === false, "prod(token): PIN DB bi tu choi");
  ok(checkPin("") === false, "prod(token): thieu token bi tu choi");
  ok(checkPin("s3cret-token2") === false, "prod(token): token sai bi tu choi");

  // --- tangTocStop dùng checkPin: production sai token => 401 ---
  config.isProduction = true;
  getDb().game.round = "tang_toc";
  getDb().game.tangToc = { phase: "video", elapsedBase: 0, startedAt: 0, submissions: {} };
  getDb().game.timer = { running: true, remaining: 10, duration: 10, endsAt: null };
  try {
    game.tangTocStop("2026");
    ok(false, "prod: tangTocStop voi PIN DB phai bi loi");
  } catch (e) {
    ok(e.status === 401, "prod: tangTocStop PIN DB -> 401");
  }
  try {
    game.tangTocStop("s3cret-token");
    ok(true, "prod: tangTocStop voi ADMIN_TOKEN thuc hien duoc");
  } catch (e) {
    ok(false, "prod: tangTocStop ADMIN_TOKEN loi: " + e.message);
  }
} finally {
  config.isProduction = devIsProd;
  config.adminToken = devToken;
  game.stopTimerLoop();
  if (snapshot) {
    const s = JSON.parse(snapshot);
    getDb().game = s.game;
    getDb().teams = s.teams;
  }
  saveDbSync();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);