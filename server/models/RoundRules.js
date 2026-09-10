// Luật thi từng vòng do admin chỉnh sửa — lưu dưới dạng JSON mảng dòng luật
// cho từng round id (khoi_dong, vuot_cnv, tang_toc, ve_dich, tie_break).
export async function loadAll(conn) {
  const out = {};
  try {
    const rows = await conn.query("SELECT * FROM round_rules");
    for (const r of rows) {
      try {
        const val = JSON.parse(r.rules || "[]");
        out[r.round] = Array.isArray(val) ? val : [];
      } catch {
        out[r.round] = [];
      }
    }
  } catch {
    /* bảng chưa có */
  }
  return out;
}

export async function saveAll(conn, rules) {
  const map = rules || {};
  await conn.query("DELETE FROM round_rules");
  for (const [round, lines] of Object.entries(map)) {
    if (!Array.isArray(lines)) continue;
    await conn.query("INSERT INTO round_rules (round, rules) VALUES (?, ?)", [
      round,
      JSON.stringify(lines.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean)),
    ]);
  }
}