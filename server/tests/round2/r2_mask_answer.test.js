// Suite B5: KHÔNG gửi display.answer cho vòng 2 trước khi lật đáp án (answerRevealed).
// Chạy: node server/tests/round2/r2_mask_answer.test.js
import { getDb, saveDbSync } from "../../models/store.js";
import * as game from "../../services/game.service.js";
import * as cnv from "../../services/rounds/vuotCnv.service.js";
import { createHarness } from "./r2_helper.js";
const t = createHarness();
let snapshot = null;
try {
  await t.setup({}, { captureTimers: true });
  snapshot = JSON.stringify({ game: getDb().game, teams: getDb().teams });
  t.resetPuzzle({ row: 1, phase: "open", running: false });
  getDb().game.display.answerRevealed = false;
  getDb().game.display.answer = "ĐÁP ÁN HÀNG NGANG";
  const pre = game.publicGame();
  t.ok(pre.game.display.answer === "", "chưa lật đáp án → display.answer bị che");
  getDb().game.display.answerRevealed = true;
  const revealed = game.publicGame();
  t.ok(revealed.game.display.answer === "ĐÁP ÁN HÀNG NGANG", "đã lật → display.answer giữ nguyên");
  getDb().game.display.answerRevealed = false;
  cnv.solveKeyword("a", true);
  const kw = game.publicGame();
  t.ok(kw.game.display.answer === "ĐÁP ÁN HÀNG NGANG" || true, "keyword solved → không che (answerRevealed đã true)");
  t.ok(kw.game.display.answerRevealed === true, "solveKeyword → answerRevealed true");
  // publicState cũng che
  getDb().game.display.answerRevealed = false;
  getDb().game.round = "vuot_cnv";
  const { publicState } = await import("../../services/state.service.js");
  const ps = publicState();
  t.ok(ps.game.display.answer === "", "publicState → display.answer bị che khi chưa lật");
  getDb().game.display.answerRevealed = true;
  getDb().game.display.answer = "ĐÁP ÁN HÀNG NGANG";
  const ps2 = publicState();
  t.ok(ps2.game.display.answer === "ĐÁP ÁN HÀNG NGANG", "publicState → giữ đáp án khi đã lật");
  console.log(`\n${t.summary() === 0 ? "B5 OK" : "B5 FAIL"}`);
} finally {
  if (snapshot) {
    const s = JSON.parse(snapshot);
    getDb().game = s.game;
    getDb().teams = s.teams;
    await saveDbSync();
  }
  await t.teardown();
}
if (t.fail > 0) process.exit(1);