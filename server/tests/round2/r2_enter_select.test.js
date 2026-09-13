// Suite R2-01: VÀO VÒNG + CHỌN Ô (selectRow/deselect).
// Chạy: node server/tests/round2/r2_enter_select.test.js
import { getDb, saveDbSync } from "../../models/store.js";
import * as cnv from "../../services/rounds/vuotCnv.service.js";
import * as game from "../../services/game.service.js";
import { createHarness } from "./r2_helper.js";

const t = createHarness();
let snapshot = null;
try {
  await t.setup();
  snapshot = JSON.stringify({ game: getDb().game, teams: getDb().teams });

  // 1. startRound(vuot_cnv): puzzle rỗng + màn chờ idle + đồng hồ 0/dừng.
  game.startRound("vuot_cnv");
  let g = getDb().game;
  t.ok(g.round === "vuot_cnv", "startRound → round=vuot_cnv");
  t.ok(g.puzzle.rowPhase === "idle" && g.puzzle.currentRow === null, "vào vòng → rowPhase idle + currentRow null");
  t.ok(g.display.mode === "idle", "vào vòng → display idle (chưa chiếu gì)");
  t.ok(g.timer.remaining === 0 && g.timer.running === false, "vào vòng → timer 0/dừng");
  t.ok((g.puzzle.rowsSolved || []).every((x) => x === false), "vào vòng → chưa mảnh nào mở");

  // 2. selectRow happy: idle + ô hidden → open + hiện câu hỏi + setTimer(30,dừng).
  let captured = null;
  t.install({ setTimer: (sec, running) => {
    captured = { sec, running };
    getDb().game.timer.duration = sec;
    getDb().game.timer.remaining = sec;
    getDb().game.timer.running = !!running;
  } });
  getDb().game.puzzle.rowPhase = "idle";
  getDb().game.puzzle.currentRow = null;
  cnv.selectRow(0);
  g = getDb().game;
  t.ok(g.puzzle.currentRow === 0 && g.puzzle.rowPhase === "open", "selectRow(0) → currentRow 0 + phase open");
  t.ok(g.display.mode === "question", "selectRow → display question");
  t.ok(captured && captured.sec === 30 && captured.running === false, "selectRow → setTimer(30,dừng)");
  t.ok(Object.keys(g.puzzle.submissions || {}).length === 0, "selectRow → xóa bài cũ");

  // 3. LUẬT ô trung tâm (index 4): chỉ mở được khi đủ 4 mảnh góc đã xử lý xong
  // (mở hoặc khóa), trừ khi MC bật "Mở sớm" (setCenterEarly). Kiểm tra cả 3 nhánh:
  getDb().game.puzzle.rowPhase = "scored";
  getDb().game.puzzle.currentRow = 4;
  const cornersNotDone = { rowsSolved: [false, false, false, false, false], rowsLocked: [false, false, false, false, false] };
  // 3a. Chưa đủ 4 góc → selectRow(4) phải THROW (không mở được).
  getDb().game.puzzle.rowsSolved = cornersNotDone.rowsSolved.slice();
  getDb().game.puzzle.rowsLocked = cornersNotDone.rowsLocked.slice();
  getDb().game.puzzle.rowsSolved[0] = true; // mới 1 góc mở → chưa đủ
  getDb().game.puzzle.currentRow = 0; // đang ở ô góc nào đó, chưa sang trung tâm
  let centerThrew = false;
  try {
    cnv.selectRow(4);
  } catch {
    centerThrew = true;
  }
  t.ok(centerThrew, "chưa đủ 4 góc → selectRow(4) bị chặn (throw)");
  t.ok(getDb().game.puzzle.currentRow !== 4, "chưa đủ 4 góc → không chuyển sang ô trung tâm");
  getDb().game.puzzle.currentRow = null;

  // 3b. Đủ 4 góc (2 mở + 2 khóa) → mở trung tâm OK.
  getDb().game.puzzle.rowsSolved = [true, true, true, false, false];
  getDb().game.puzzle.rowsLocked = [false, false, false, true, false];
  getDb().game.puzzle.rowPhase = "scored";
  cnv.selectRow(4);
  t.ok(getDb().game.puzzle.currentRow === 4 && getDb().game.puzzle.rowPhase === "open", "đủ 4 góc → mở câu hỏi mảnh trung tâm");

  // 3c. Chưa đủ góc nhưng MC bật "Mở sớm" (centerEarly) → mở được (toàn quyền MC).
  getDb().game.puzzle.currentRow = null;
  getDb().game.puzzle.rowPhase = "idle";
  getDb().game.puzzle.rowsSolved = [true, false, false, false, false];
  getDb().game.puzzle.rowsLocked = [false, false, false, false, false];
  cnv.setCenterEarly(true);
  cnv.selectRow(4);
  t.ok(getDb().game.puzzle.currentRow === 4 && getDb().game.puzzle.rowPhase === "open", "chưa đủ 4 góc nhưng bật centerEarly → mở trung tâm được");
  t.ok(getDb().game.puzzle.centerEarly === true, "setCenterEarly(true) → puzzle.centerEarly=true");
  cnv.setCenterEarly(false);
  t.ok(getDb().game.puzzle.centerEarly === false, "setCenterEarly(false) → tắt bỏ qua");
  getDb().game.puzzle.currentRow = null;

  // 3d. revealPiece(4) (nút mảnh trực tiếp) cũng bị gate "đủ 4 góc", trừ khi centerEarly.
  getDb().game.puzzle.rowsSolved = [false, false, false, false, false];
  getDb().game.puzzle.rowsLocked = [false, false, false, false, false];
  getDb().game.puzzle.rowsSolved[1] = true; // mới 1 góc → chưa đủ
  cnv.revealPiece(4);
  t.ok(!getDb().game.puzzle.rowsSolved[4], "chưa đủ 4 góc → revealPiece(4) không mở mảnh");
  getDb().game.puzzle.rowsSolved = [true, true, true, true, false];
  getDb().game.puzzle.rowsLocked = [false, false, false, false, false];
  cnv.revealPiece(4);
  t.ok(getDb().game.puzzle.rowsSolved[4], "đủ 4 góc → revealPiece(4) mở mảnh trung tâm");
  getDb().game.puzzle.rowsSolved[4] = false;
  cnv.setCenterEarly(true);
  cnv.revealPiece(4);
  t.ok(getDb().game.puzzle.rowsSolved[4], "centerEarly bật → revealPiece(4) mở được dù chưa đủ góc");
  cnv.setCenterEarly(false);

  // 4. Chặn đổi ô khi đang open/closed (giữ bài).
  t.resetPuzzle({ row: 0, phase: "open", running: false });
  getDb().game.puzzle.submissions = { a: { answer: "X", elapsed: 1 } };
  let threw = false;
  try { cnv.selectRow(1); } catch { threw = true; }
  t.ok(threw && getDb().game.puzzle.currentRow === 0, "đang open → selectRow ô khác throw + giữ currentRow");
  t.ok(!!getDb().game.puzzle.submissions.a, "đang open → giữ submissions");
  getDb().game.puzzle.rowPhase = "closed";
  threw = false;
  try { cnv.selectRow(2); } catch { threw = true; }
  t.ok(threw, "đang closed (chấm dở) → chặn đổi ô");

  // 5. No-op ô đã solved/locked/keywordSolved (không xóa ranked/lastResult).
  t.resetPuzzle({ row: 0, phase: "scored", running: false });
  getDb().game.puzzle.rowsSolved[1] = true;
  getDb().game.puzzle.rowsLocked[2] = true;
  getDb().game.puzzle.ranked = [{ teamId: "a", correct: true, points: 40 }];
  getDb().game.puzzle.lastResult = { correct: true, row: 0, pts: 40 };
  cnv.selectRow(1);
  t.ok(getDb().game.puzzle.currentRow === 0 && getDb().game.puzzle.ranked.length === 1, "ô đã MỞ → no-op");
  cnv.selectRow(2);
  t.ok(getDb().game.puzzle.lastResult?.row === 0, "ô đã KHÓA → no-op giữ lastResult");
  getDb().game.puzzle.keywordSolved = true;
  cnv.selectRow(3);
  t.ok(getDb().game.puzzle.currentRow === 0, "đã giải từ khóa → selectRow no-op");

  // 6. Invalid row ngoài 0..4 → NO-OP im lặng (code: `if (!(i>=0&&i<=4)) return`,
  // vuotCnv.service.js:140 — không throw). Giữ nguyên currentRow/phase/bài.
  t.resetPuzzle({ row: null, phase: "idle", running: false });
  getDb().game.puzzle.submissions = { a: { answer: "X", elapsed: 1 } };
  for (const bad of [-1, 5, 99, NaN]) {
    cnv.selectRow(bad);
    t.ok(
      getDb().game.puzzle.currentRow === null && getDb().game.puzzle.rowPhase === "idle",
      `selectRow(${String(bad)}) → no-op im lặng, giữ idle/null`
    );
  }
  t.ok(!!getDb().game.puzzle.submissions.a, "selectRow invalid → giữ submissions");

  // 7. Đổi hàng khi timer cũ còn chạy → reset về 30/dừng (không vác elapsed cũ).
  t.resetPuzzle({ row: null, phase: "idle", running: false });
  getDb().game.timer = { duration: 30, remaining: 5, running: true, endsAt: Date.now() + 5000 };
  captured = null;
  t.install({ setTimer: (sec, running) => { captured = { sec, running }; } });
  cnv.selectRow(2);
  t.ok(captured?.sec === 30 && captured?.running === false, "timer cũ chạy → câu mới setTimer(30,dừng)");

  // 8. deselect: idle + null + xóa bài + timer 0/dừng; settle/submit sau đó no-op.
  t.install();
  t.resetPuzzle({ row: 2, phase: "open", running: true });
  getDb().game.puzzle.submissions = { a: { answer: "ABC", elapsed: 1 } };
  cnv.deselectRow();
  t.ok(getDb().game.puzzle.rowPhase === "idle" && getDb().game.puzzle.currentRow === null, "deselect → idle + null");
  t.ok(Object.keys(getDb().game.puzzle.submissions).length === 0, "deselect → xóa bài");
  t.ok(getDb().game.timer.running === false, "deselect → dừng giờ");
  cnv.settleRow();
  t.ok(getDb().game.puzzle.rowPhase === "idle" && !getDb().game.puzzle.rowsLocked[2], "settle sau deselect → no-op");
  getDb().game.timer.running = true;
  getDb().game.timer.endsAt = Date.now() + 30000;
  t.ok(cnv.submitRowAnswer("a", "LATE").ok === false, "submit sau deselect → từ chối");

  console.log(`\n${t.summary() === 0 ? "R2-01 OK" : "R2-01 FAIL"}`);
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
