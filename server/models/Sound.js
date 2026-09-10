export const SOUND_SLOTS = ["correct", "wrong", "bg", "wait", "buzz", "answers", "khoi_dong"];

export function emptySounds() {
  return {
    correct: { url: "", name: "" },
    wrong: { url: "", name: "" },
    bg: { url: "", name: "" },
    wait: { url: "", name: "" },
    buzz: { url: "", name: "" },
    answers: { url: "", name: "" },
    khoi_dong: { url: "", name: "" },
  };
}

export async function loadAll(conn) {
  const out = emptySounds();
  try {
    const rows = await conn.query("SELECT * FROM sounds");
    for (const r of rows) {
      if (out[r.slot]) out[r.slot] = { url: r.url || "", name: r.name || "" };
    }
  } catch {
    /* bảng chưa có */
  }
  return out;
}

export async function saveAll(conn, sounds) {
  const pack = { ...emptySounds(), ...(sounds || {}) };
  await conn.query("DELETE FROM sounds");
  for (const slot of SOUND_SLOTS) {
    const s = pack[slot] || {};
    await conn.query("INSERT INTO sounds (slot, name, url) VALUES (?, ?, ?)", [
      slot,
      s.name || "",
      s.url || "",
    ]);
  }
}

