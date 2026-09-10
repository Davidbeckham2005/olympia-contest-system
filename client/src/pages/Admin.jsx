import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getAdminState,
  createContestant,
  importContestantsFile,
  deleteContestant,
  deleteContestants,
  divideTeams,
  assignTeams,
  saveTeams,
  saveMainQuestions,
  importVeDichQuestionsFile,
  uploadFile,
  uploadSound,
  deleteSound,
  saveSettings,
  saveRoundRules,
  setKhoiDongAnswerSeconds,
  setKhoiDongTimerSeconds,
  resetContest,
} from "../lib/api/admin.js";
import { getPin } from "../lib/session.js";
import { formatTime } from "../lib/format.js";
import { sendControl } from "../lib/api/control.js";
import { on } from "../lib/socket.js";
import { TEAM_ORDER } from "../lib/teams.js";

export default function Admin() {
  const nav = useNavigate();
  const [tab, setTab] = useState("thi-sinh");
  const [state, setState] = useState(null);
  const [msg, setMsg] = useState("");
  const [timer, setTimer] = useState(null);

  async function load() {
    try {
      setState(await getAdminState());
    } catch {
      nav("/dang-nhap?next=/admin");
    }
  }

  useEffect(() => {
    if (!getPin()) {
      nav("/dang-nhap?next=/admin");
      return;
    }
    load();
  }, [nav]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!getPin()) return;
    return on("game:state", () => {
      load();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!getPin()) return;
    return on("game:timer", setTimer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return <div className="min-h-screen grid place-items-center text-mist">Đang tải quản trị…</div>;

  return (
    <div className="mx-auto w-[min(1200px,calc(100%-24px))] py-7 pb-16">
      <div className="flex justify-between items-end gap-3 mb-6 flex-wrap">
        <div>
          <Link to="/" className="text-mist hover:text-gold">← Trang chủ</Link>
          <h2 className="font-display text-2xl font-bold mt-1.5">Quản trị cuộc thi</h2>
        </div>
        <Link className="btn" to="/mc">Bàn MC</Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {[
          ["thi-sinh", "Thí sinh"],
          ["doi", "4 đội"],
          ["cau-hoi", "Câu hỏi"],
          ["luat", "Luật thi"],
          ["am-thanh", "Âm thanh"],
          ["media", "Hình ảnh / Video"],
          ["dieu-khien", "Hẹn giờ & chuông"],
          ["cai-dat", "Cài đặt"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              tab === id ? "bg-gold text-[#1a1400] border-gold" : "border-line text-mist hover:border-gold/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {msg && <p className="badge badge-ok inline-block mb-4">{msg}</p>}
      {tab === "thi-sinh" && <ContestantsTab state={state} reload={load} setMsg={setMsg} />}
      {tab === "doi" && <TeamsTab state={state} reload={load} setMsg={setMsg} />}
      {tab === "cau-hoi" && <QuestionsTab state={state} reload={load} setMsg={setMsg} />}
      {tab === "luat" && <RulesTab state={state} reload={load} setMsg={setMsg} />}
      {tab === "am-thanh" && <SoundsTab state={state} reload={load} setMsg={setMsg} />}
      {tab === "media" && <MediaTab state={state} reload={load} setMsg={setMsg} />}
      {tab === "dieu-khien" && <TimerBuzzerTab state={state} timer={timer} setMsg={setMsg} />}
      {tab === "cai-dat" && <SettingsTab state={state} reload={load} setMsg={setMsg} />}
    </div>
  );
}

function ContestantsTab({ state, reload, setMsg }) {
  const [form, setForm] = useState({ name: "", studentId: "", school: "", className: "" });
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const list = state.contestants || [];

  async function add(e) {
    e.preventDefault();
    try {
      await createContestant(form);
      setForm({ name: "", studentId: "", school: "", className: "" });
      setMsg("Đã thêm thí sinh");
      reload();
    } catch (err) {
      setMsg(err.message);
    }
  }

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const r = await importContestantsFile(file);
      const errN = (r.errors || []).length;
      setMsg(`Đã đọc ${r.created} thí sinh mới` + (r.skipped ? `, bỏ qua ${r.skipped} mã trùng` : "") + (errN ? `, ${errN} dòng lỗi` : ""));
      reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const csv = "\uFEFFHọ tên,Mã thí sinh,Trường,Lớp\nNguyễn Văn A,TS001,THPT ABC,12A1\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mau-thi-sinh.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function toggle(id) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function del(c) {
    if (!confirm(`Xóa thí sinh ${c.name}?`)) return;
    await deleteContestant(c.id);
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(c.id);
      return n;
    });
    setMsg("Đã xóa thí sinh");
    reload();
  }

  async function delSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`Xóa ${ids.length} thí sinh đã chọn?`)) return;
    await deleteContestants(ids);
    setSelected(new Set());
    setMsg(`Đã xóa ${ids.length} thí sinh`);
    reload();
  }

  async function assign(contestantId, teamId) {
    const current = Object.fromEntries(
      list.filter((c) => c.teamId).map((c) => [c.id, c.teamId])
    );
    if (teamId) current[contestantId] = teamId;
    else delete current[contestantId];
    await assignTeams(Object.entries(current).map(([id, tid]) => ({ contestantId: id, teamId: tid })));
    reload();
  }

  async function divide() {
    if (!confirm("Chia đều tất cả thí sinh vào các đội?")) return;
    await divideTeams();
    setMsg("Đã chia đều thí sinh vào các đội");
    reload();
  }

  const s = search.trim().toLowerCase();
  const filtered = list.filter((c) =>
    !s
      ? true
      : [c.name, c.studentId, c.school, c.className].some((v) => (v || "").toLowerCase().includes(s))
  );
  const allChecked = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  function toggleAll() {
    setSelected((prev) => {
      const n = new Set(prev);
      if (allChecked) filtered.forEach((c) => n.delete(c.id));
      else filtered.forEach((c) => n.add(c.id));
      return n;
    });
  }

  return (
    <div className="panel">
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] items-end mb-3">
        <label className="label-grid">
          Họ tên *
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="label-grid">
          Mã *
          <input required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} />
        </label>
        <label className="label-grid">
          Trường
          <input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
        </label>
        <label className="label-grid">
          Lớp
          <input value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
        </label>
        <button type="submit" className="btn btn-ok py-1.5! text-sm!">+ Thêm</button>
      </form>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h3 className="font-bold">Thí sinh ({list.length})</h3>
        <label className={`btn btn-ghost text-sm py-1.5! cursor-pointer ${importing ? "opacity-60 pointer-events-none" : ""}`}>
          {importing ? "Đang đọc…" : "Đọc file"}
          <input type="file" accept=".xlsx,.xls,.csv,.tsv,.txt,.json" className="hidden" disabled={importing} onChange={onImport} />
        </label>
        <button type="button" className="btn btn-ghost text-sm py-1.5!" onClick={downloadTemplate}>Mẫu</button>
        {list.length > 0 && (
          <input className="w-44! ml-auto" placeholder="Tìm…" value={search} onChange={(e) => setSearch(e.target.value)} />
        )}
        {list.length > 0 && (
          <button type="button" className="btn text-sm py-1.5!" onClick={divide}>Chia đội</button>
        )}
        {selected.size > 0 && (
          <button type="button" className="btn btn-danger text-sm py-1.5!" onClick={delSelected}>
            Xóa {selected.size}
          </button>
        )}
      </div>

      <table className="table">
        <thead>
          <tr>
            <th className="w-8">
              {filtered.length > 0 && (
                <input type="checkbox" className="w-auto!" checked={allChecked} onChange={toggleAll} />
              )}
            </th>
            <th>#</th><th>Họ tên</th><th>Mã</th><th>Trường</th><th>Lớp</th><th>Đội</th>
            {filtered.length > 0 && <th></th>}
          </tr>
        </thead>
        <tbody>
          {filtered.map((c, i) => (
            <tr key={c.id}>
              <td>
                <input type="checkbox" className="w-auto!" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              </td>
              <td className="text-mist">{i + 1}</td>
              <td>{c.name}</td>
              <td>{c.studentId}</td>
              <td>{c.school || "—"}</td>
              <td>{c.className || "—"}</td>
              <td>
                <select value={c.teamId || ""} onChange={(e) => assign(c.id, e.target.value)}>
                  <option value="">—</option>
                  {state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </td>
              <td>
                <button type="button" className="btn btn-danger text-xs py-0.5! px-2!" onClick={() => del(c)}>Xóa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="text-mist text-sm mt-3">Chưa có thí sinh. Thêm thủ công hoặc đọc file.</p>}
    </div>
  );
}

function TeamsTab({ state, reload, setMsg }) {
  const [names, setNames] = useState(() => Object.fromEntries(state.teams.map((t) => [t.id, t.name])));
  const [passes, setPasses] = useState(() => Object.fromEntries(state.teams.map((t) => [t.id, t.pass || ""])));
  const list = state.contestants || [];

  async function saveAll() {
    await saveTeams(state.teams.map((t) => ({ id: t.id, name: names[t.id], pass: passes[t.id] })));
    setMsg("Đã lưu tên và mật khẩu đội");
    reload();
  }

  async function assign(contestantId, teamId) {
    const current = Object.fromEntries(
      list.filter((c) => c.teamId).map((c) => [c.id, c.teamId])
    );
    if (teamId) current[contestantId] = teamId;
    else delete current[contestantId];
    const assignments = Object.entries(current).map(([id, tid]) => ({ contestantId: id, teamId: tid }));
    await assignTeams(assignments);
    reload();
  }

  return (
    <div className="panel">
      <div className="grid gap-4 sm:grid-cols-2 mb-5">
        {state.teams.map((t) => (
          <div key={t.id} className="rounded-xl border p-4 bg-panel-solid" style={{ borderColor: t.color }}>
            <b style={{ color: t.color }}>{t.name}</b>
            <label className="label-grid mt-3">
              Tên đội
              <input value={names[t.id] || ""} onChange={(e) => setNames({ ...names, [t.id]: e.target.value })} />
            </label>
            <label className="label-grid mt-2">
              Mật khẩu vào giao diện thí sinh
              <input autoComplete="off" value={passes[t.id] || ""} onChange={(e) => setPasses({ ...passes, [t.id]: e.target.value })} />
            </label>
            <div className="text-mist text-xs mt-2">{(t.members || []).length} thành viên</div>
          </div>
        ))}
      </div>
      <button type="button" className="btn" onClick={saveAll}>Lưu tên &amp; mật khẩu đội</button>

      <h3 className="font-bold mt-7 mb-2">Gán thí sinh vào đội</h3>
      <table className="table">
        <thead>
          <tr><th>#</th><th>Họ tên</th><th>Mã</th><th>Đội</th></tr>
        </thead>
        <tbody>
          {list.map((c, i) => (
            <tr key={c.id}>
              <td className="text-mist">{i + 1}</td>
              <td>{c.name}</td>
              <td>{c.studentId}</td>
              <td>
                <select value={c.teamId || ""} onChange={(e) => assign(c.id, e.target.value)}>
                  <option value="">—</option>
                  {state.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <p className="text-mist text-sm mt-3">Chưa có thí sinh nào. Thêm ở tab "Thí sinh".</p>}
    </div>
  );
}

function clone(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}
function eq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function uid() {
  return "q" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}
function probeVideoDuration(src) {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const d = v.duration;
      resolve(d && isFinite(d) && d > 0 ? Math.ceil(d) : undefined);
      v.removeAttribute("src");
      v.load();
    };
    v.onloadedmetadata = finish;
    v.onerror = finish;
    setTimeout(finish, 8000);
    v.src = src;
  });
}
const normVdPoints = (p) => {
  const n = Number(p) || 20;
  if (n <= 10) return 10;
  if (n <= 20) return 20;
  return 30;
};
function normalizeMain(v) {
  const m = {
    khoiDong: v.khoiDong || {},
    vuotCnv: v.vuotCnv || { keyword: "", hint: "", letterCount: "", media: { type: "image", url: "" }, rows: [] },
    tangToc: v.tangToc || [],
    veDich: v.veDich || [],
  };
  for (const tid of TEAM_ORDER) {
    const raw = m.khoiDong[tid] || [];
    // Chuẩn hóa dữ liệu Khởi động thành dạng lưng: mảng "bọc thí sinh", mỗi bọc là 5 hình ảnh.
    // Nếu dữ liệu đang phẳng (câu/ảnh phẳng) → gom thành bọc 5 mỗi lượt; nếu đã lưng thì giữ nguyên.
    const normQ = (q) => ({ id: q.id || uid(), answer: q.answer || "", points: q.points || 10, mediaUrl: q.mediaUrl || "", mediaType: q.mediaType || "", ...q });
    const asMod = (x) => Array.isArray(x) ? x.filter((q) => q && typeof q === "object") : [];
    let clusters;
    if (raw.length && Array.isArray(raw[0])) {
      clusters = raw.map((mod) => {
        const qs = asMod(mod);
        return Array.from({ length: 5 }, (_, i) => qs[i] || normQ({}));
      });
    } else {
      const flat = asMod(raw);
      clusters = [];
      for (let m = 0; m < 4; m++) {
        const cl = [];
        for (let i = 0; i < 5; i++) cl.push(normQ(flat[m * 5 + i] || {}));
        clusters.push(cl);
      }
    }
    m.khoiDong[tid] = clusters;
  }
  // Ngân hàng câu Về đích: là mảng CHUNG — không phụ thuộc số lượng đội.
  // Dữ liệu cũ (object gắn đội) được dẹp phẳng thành mảng chung; mức điểm chuẩn về 10/20/30.
  const vdRaw = Array.isArray(m.veDich) ? m.veDich : Object.keys(m.veDich || {}).flatMap((tid) => (Array.isArray(m.veDich[tid]) ? m.veDich[tid] : []));
  m.veDich = vdRaw.filter((q) => q && typeof q === "object").map((q) => ({
    id: q.id || uid(),
    question: q.question || "",
    answer: q.answer || "",
    ...q,
    points: normVdPoints(q.points),
    auto: !!q.auto,
  }));
  m.vuotCnv.rows = (m.vuotCnv.rows || []).filter((r) => r && typeof r === "object").map((r) => ({ id: r.id || uid(), question: r.question || "", answer: r.answer || "", letterCount: r.letterCount ?? "", ...r }));
  m.tangToc = (m.tangToc || []).filter((q) => q && typeof q === "object").map((q) => ({ id: q.id || uid(), answer: q.answer || "", duration: Number(q.duration) || 60, mediaUrl: q.mediaUrl || "", mediaType: "video", ...q }));
  return m;
}

function QuestionsTab({ state, reload, setMsg }) {
  const main = state.questions.main || {};
  const [sub, setSub] = useState("khoi_dong");
  const [draft, setDraft] = useState({ main: clone(main) });
  const lastMain = useRef(main);
  const dirty = !eq(draft.main, main);

  useEffect(() => {
    if (eq(state.questions.main, lastMain.current)) return;
    lastMain.current = clone(state.questions.main || {});
    setDraft({ main: lastMain.current });
  }, [state.questions.main]);

  async function saveDraft() {
    await saveMainQuestions(draft.main);
    setMsg("Đã lưu câu hỏi vòng chính");
    reload();
  }
  function revert() {
    setDraft({ main: clone(main) });
  }

  const items = [
    ["khoi_dong", "Khởi động"],
    ["vuot_cnv", "Vượt CNV"],
    ["tang_toc", "Tăng tốc"],
    ["ve_dich", "Về đích"],
    ["json", "Chỉnh JSON"],
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {items.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              sub === id ? "bg-gold text-[#1a1400] border-gold" : "border-line text-mist hover:border-gold/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="panel">
          <div className="flex flex-wrap items-center gap-3 mb-4 rounded-xl border border-line bg-night/40 px-3 py-2">
            <span className="text-sm font-semibold">Sửa trực tiếp — bấm <b>Lưu vòng chính</b> khi xong</span>
            <div className="ml-auto flex items-center gap-2">
              <span className={`text-xs ${dirty ? "badge badge-warn" : "text-mist"}`}>
                {dirty ? "Có thay đổi chưa lưu" : "Đã lưu hết"}
              </span>
              <button type="button" className="btn btn-ghost py-1! text-xs!" disabled={!dirty} onClick={revert}>Hoàn tác</button>
              <button type="button" className="btn btn-ok py-1! text-xs!" disabled={!dirty} onClick={saveDraft}>Lưu vòng chính</button>
            </div>
          </div>

          {sub === "khoi_dong" && <KhoiDongEditor draft={draft} setDraft={setDraft} teams={state.teams} />}
          {sub === "vuot_cnv" && <VuotCnvEditor draft={draft} setDraft={setDraft} />}
          {sub === "tang_toc" && <TangTocEditor draft={draft} setDraft={setDraft} />}
          {sub === "ve_dich" && <VeDichEditor draft={draft} setDraft={setDraft} setMsg={setMsg} />}
          {sub === "json" && <JsonEditor draft={draft} setDraft={setDraft} setMsg={setMsg} />}
      </div>
    </div>
  );
}

function KhoiDongEditor({ draft, setDraft, teams }) {
  const m = draft.main;
  const teamIds = TEAM_ORDER;

  const setCluster = (tid, memberIdx, p) => {
    const clusters = [...(m.khoiDong?.[tid] || [])];
    clusters[memberIdx] = p;
    setDraft({ ...draft, main: { ...m, khoiDong: { ...(m.khoiDong || {}), [tid]: clusters } } });
  };
  const setQ = (tid, memberIdx, i, p) => {
    const cl = [...((m.khoiDong?.[tid] || [])[memberIdx] || [])];
    while (cl.length < 5) cl.push({ id: uid(), answer: "", points: 10, mediaUrl: "", mediaType: "" });
    cl[i] = { ...cl[i], ...p };
    setCluster(tid, memberIdx, cl);
  };
  function addMember(tid) {
    const cl = [];
    for (let i = 0; i < 5; i++) cl.push({ id: uid(), answer: "", points: 10, mediaUrl: "", mediaType: "" });
    setCluster(tid, (m.khoiDong?.[tid] || []).length, cl);
  }
  function delMember(tid, memberIdx) {
    const clusters = (m.khoiDong?.[tid] || []).filter((_, k) => k !== memberIdx);
    setDraft({ ...draft, main: { ...m, khoiDong: { ...(m.khoiDong || {}), [tid]: clusters } } });
  }
  function setImg(tid, memberIdx, i, file) {
    uploadFile(file).then((r) => setQ(tid, memberIdx, i, { mediaUrl: r.url, mediaType: r.type }));
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {teamIds.map((tid) => {
        const team = teams.find((t) => t.id === tid);
        const clusters = m.khoiDong?.[tid] || [];
        return (
          <div key={tid} className="rounded-xl border border-line bg-night/40 p-3">
            <div className="flex items-center gap-2 mb-3">
              <b style={{ color: team?.color }}>{team?.name}{clusters.length > 0 && <span className="text-mist font-normal"> — {clusters.length} thí sinh × 5 ảnh</span>}</b>
              <button type="button" className="btn btn-ghost text-xs py-1! ml-auto" onClick={() => addMember(tid)}>+ Thêm thí sinh</button>
            </div>

            {clusters.map((cl, mi) => (
              <div key={String(mi)} className="rounded-lg border border-line bg-night/60 p-2 mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <b className="text-xs text-mist uppercase">Thí sinh {mi + 1}</b>
                  <button type="button" className="btn btn-danger text-xs py-0.5! px-1.5!" onClick={() => delMember(tid, mi)}>✕</button>
                </div>
                <div className="grid gap-2 sm:grid-cols-1">
                  {Array.from({ length: 5 }, (_, i) => {
                    const q = cl[i] || { answer: "", mediaUrl: "" };
                    return (
                      <div key={i} className="rounded-lg border border-line bg-night/70 p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-mist text-xs">Ảnh #{i + 1}</span>
                          {q.mediaUrl && (
                            <button type="button" className="btn btn-danger text-xs py-0.5! px-1.5!" onClick={() => setQ(tid, mi, i, { mediaUrl: "" })}>✕</button>
                          )}
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="relative shrink-0 w-[110px]">
                            {q.mediaUrl ? (
                              <img src={q.mediaUrl} className="w-[110px] h-[76px] object-cover rounded-lg" />
                            ) : (
                              <div className="w-[110px] h-[76px] rounded-lg border border-dashed border-line grid place-items-center text-mist text-xs text-center p-2">
                                Chưa có ảnh
                              </div>
                            )}
                            <label className="btn btn-ok text-xs py-1! cursor-pointer absolute bottom-1 left-1 opacity-90">
                              📁 Chọn
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setImg(tid, mi, i, f); }} />
                            </label>
                          </div>
                          <div className="grid gap-1.5 flex-1">
                            <input className="w-full!" value={q.mediaUrl || ""} placeholder="Dán URL ảnh…" onChange={(e) => setQ(tid, mi, i, { mediaUrl: e.target.value })} />
                            <input value={q.answer || ""} placeholder="Đáp án đúng" onChange={(e) => setQ(tid, mi, i, { answer: e.target.value })} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {clusters.length === 0 && <p className="text-mist text-sm">Chưa có thí sinh nào. Bấm "+ Thêm thí sinh" để tạo bọc 5 ảnh.</p>}
          </div>
        );
      })}
    </div>
  );
}

function VuotCnvEditor({ draft, setDraft }) {
  const m = draft.main;
  const v = m.vuotCnv || { keyword: "", hint: "", letterCount: "", rows: [] };
  const setV = (p) => setDraft({ ...draft, main: { ...m, vuotCnv: { ...v, ...p } } });
  function setRow(i, p) {
    setV({ rows: (v.rows || []).map((r, k) => (k === i ? { ...r, ...p } : r)) });
  }
  const vMedia = v.media || { type: "image", url: "" };
  const setVMedia = (p) => setV({ media: { ...vMedia, ...p } });

  return (
    <div>
      {/* Ảnh chướng ngại vật — 5 mảnh ghép (4 góc + ô trung tâm) hợp thành 1 bức ảnh này */}
      <div className="rounded-xl border border-line bg-night/40 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <b className="text-gold">Ảnh chướng ngại vật</b>
          <span className="text-mist text-xs">Bức ảnh hoàn chỉnh — 5 mảnh ghép (4 góc + ô trung tâm) sẽ cắt bức ảnh này.</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {vMedia.url ? (
            vMedia.type === "video" ? (
              <video src={vMedia.url} controls className="w-[220px] h-[138px] object-contain rounded bg-black" />
            ) : (
              <img src={vMedia.url} alt="CNV" className="w-[220px] h-[138px] object-cover rounded border border-line" />
            )
          ) : (
            <div className="w-[220px] h-[138px] rounded border border-dashed border-line grid place-items-center text-mist text-xs">Chưa có ảnh</div>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="btn btn-ghost text-sm! py-1.5! cursor-pointer">
                {vMedia.url ? "Đổi ảnh" : "Chọn ảnh"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const r = await uploadFile(f);
                    setVMedia({ url: r.url, type: "image" });
                  }}
                />
              </label>
              {vMedia.url && (
                <button type="button" className="btn btn-ghost text-sm! py-1.5!" onClick={() => setVMedia({ url: "", type: "image" })}>Gỡ ảnh</button>
              )}
              <input
                type="url"
                className="w-56!"
                value={vMedia.url || ""}
                placeholder="…hoặc dán URL ảnh"
                onChange={(e) => setVMedia({ url: e.target.value })}
              />
            </div>
            <p className="text-mist text-xs">Ảnh nên tỉ lệ gần 16:10. Mảnh nào mở sẽ hiện đúng phần ảnh đó, mở đủ 5 mảnh → ảnh hoàn chỉnh.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <label className="label-grid">
          Đáp án CNV (từ khóa)
          <input value={v.keyword || ""} placeholder="VD: HỮU NGHỊ" onChange={(e) => setV({ keyword: e.target.value })} />
        </label>
        <label className="label-grid">
          Số chữ cái
          <input type="number" min={1} value={v.letterCount || ""} placeholder="VD: 12" onChange={(e) => setV({ letterCount: e.target.value })} />
        </label>
        <label className="label-grid">
          Gợi ý (hint)
          <input value={v.hint || ""} placeholder="Gợi ý ngắn cho khán giả" onChange={(e) => setV({ hint: e.target.value })} />
        </label>
      </div>

      <div>
        {(v.rows || []).map((row, i) => (
          <div key={row.id} className="rounded-xl border border-line bg-night/40 p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <b className="text-gold text-xl">{i + 1}</b>
              <span className="text-mist text-xs">Câu hỏi sẽ phóng to khi chiếu</span>
              <div className="ml-auto flex gap-1">
                <button type="button" className="btn btn-ghost text-xs py-1!" onClick={() => setRow(i, { question: "" })}>Xóa nội dung</button>
                <button type="button" className="btn btn-ghost text-xs py-1!" onClick={() => setV({ rows: [...(v.rows || []), { id: uid(), question: "", answer: "", letterCount: v.letterCount || "" }] })}>+ Thêm</button>
                <button type="button" className="btn btn-danger text-xs py-1!" onClick={() => setV({ rows: (v.rows || []).filter((_, k) => k !== i) })}>Xóa câu</button>
              </div>
            </div>
            <textarea
              rows={5}
              className="w-full text-2xl! font-bold! leading-snug"
              value={row.question || ""}
              onChange={(e) => setRow(i, { question: e.target.value })}
              placeholder="Nhập câu hỏi ở đây…"
            />
            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              <label className="label-grid">
                Đáp án
                <input className="text-lg!" value={row.answer || ""} onChange={(e) => setRow(i, { answer: e.target.value })} placeholder="Đáp án cho dòng ngang này" />
              </label>
              <label className="label-grid">
                Số chữ cái
                <input type="number" min={1} value={row.letterCount || ""} onChange={(e) => setRow(i, { letterCount: e.target.value })} />
              </label>
            </div>
          </div>
        ))}
        {(v.rows || []).length === 0 && <p className="text-mist text-sm">Chưa có câu hỏi Vượt CNV.</p>}
      </div>
    </div>
  );
}

function TangTocEditor({ draft, setDraft }) {
  const m = draft.main;
  const qs = m.tangToc || [];
  const setQs = (next) => setDraft({ ...draft, main: { ...m, tangToc: next } });
  function setQ(i, p) {
    setQs(qs.map((q, k) => (k === i ? { ...q, ...p } : q)));
  }

  return (
    <div>
      <p className="text-mist text-sm mb-3">Mỗi câu là <b>1 video</b>. Đổi video ngay tại cột; nếu chưa có, khán giả thấy ô chờ. Đáp án & thời lượng để MC tham khảo.</p>
      <div className="block sm:hidden text-mist text-xs mb-2">Lưu ý: xem chi tiết & chỉnh trên màn hình rộng.</div>
      <table className="table">
        <thead><tr><th>#</th><th>Video</th><th>Thời lượng (s)</th><th>Đáp án (MC)</th><th></th></tr></thead>
        <tbody>
          {qs.map((q, i) => (
            <tr key={q.id}>
              <td className="text-mist">{i + 1}</td>
              <td>
                <div className="flex items-center gap-2">
                  {q.mediaUrl ? (
                    <video src={q.mediaUrl} className="w-[150px] h-[90px] object-contain rounded bg-black" controls />
                  ) : (
                    <div className="w-[150px] h-[90px] rounded border border-dashed border-line grid place-items-center text-mist text-xs">Chưa có video</div>
                  )}
                  <div className="flex flex-col gap-1">
                    <label className="btn btn-ghost text-xs py-1! cursor-pointer">
                      {q.mediaUrl ? "Đổi video" : "Chọn video"}
                      <input type="file" accept="video/*" className="hidden" onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const localUrl = URL.createObjectURL(f);
                        const dur = await probeVideoDuration(localUrl);
                        URL.revokeObjectURL(localUrl);
                        const r = await uploadFile(f);
                        setQ(i, { mediaUrl: r.url, duration: dur ?? q.duration ?? 60 });
                      }} />
                    </label>
                    {q.mediaUrl && <button type="button" className="btn btn-ghost text-xs py-1!" onClick={() => setQ(i, { mediaUrl: "" })}>Gỡ video</button>}
                  </div>
                </div>
              </td>
              <td>
                <div className="flex items-center gap-1">
                  <input type="number" min={1} className="w-20!" value={q.duration || 60} onChange={(e) => setQ(i, { duration: Number(e.target.value) || 60 })} />
                  {q.mediaUrl && (
                    <button
                      type="button"
                      className="btn btn-ghost text-xs py-1! px-2!"
                      title="Tự nhận thời lượng từ video"
                      onClick={async () => {
                        const d = await probeVideoDuration(q.mediaUrl);
                        if (d) setQ(i, { duration: d });
                      }}
                    >
                      ⟳
                    </button>
                  )}
                </div>
              </td>
              <td><input value={q.answer || ""} placeholder="Đáp án chuẩn" onChange={(e) => setQ(i, { answer: e.target.value })} /></td>
              <td>
                <div className="flex flex-col gap-1">
                  <button type="button" className="btn btn-ghost text-xs py-1!" onClick={() => setQs([...qs, { id: uid(), answer: "", duration: 60, mediaUrl: "", mediaType: "video" }])}>+ Thêm</button>
                  <button type="button" className="btn btn-danger text-xs py-1!" onClick={() => setQs(qs.filter((_, k) => k !== i))}>Xóa</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {qs.length === 0 && <p className="text-mist text-sm mt-2">Chưa có câu hỏi Tăng tốc.</p>}
    </div>
  );
}

function VeDichEditor({ draft, setDraft, setMsg }) {
  const m = draft.main;
  const qs0 = Array.isArray(m.veDich) ? m.veDich : [];
  const levels = [10, 20, 30];
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(50);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);
  function setQs(next) {
    setDraft({ ...draft, main: { ...m, veDich: next } });
  }
  function setQ(id, p) {
    setQs(qs0.map((q) => (q.id === id ? { ...q, ...p } : q)));
  }
  function delQ(id) {
    setQs(qs0.filter((q) => q.id !== id));
  }
  function delQs(ids) {
    const s = new Set(ids);
    setQs(qs0.filter((q) => !s.has(q.id)));
  }
  function addQ(points) {
    setQs([...qs0, { id: uid(), points, question: "", answer: "" }]);
  }

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const r = await importVeDichQuestionsFile(file);
      setMsg(
        `Đã thêm ${r.added} câu Về đích` +
          (r.skipped ? `, bỏ qua ${r.skipped} câu đã có` : "") +
          (r.errors?.length ? `, ${r.errors.length} dòng thiếu câu hỏi` : "") +
          ` (ngân hàng: ${r.total})`
      );
    } catch (err) {
      setMsg(err.message);
    } finally {
      setImporting(false);
    }
  }

  function downloadVdTemplate() {
    const csv =
      "\uFEFFSTT,Điểm,Câu hỏi,Đáp án\n" +
      "1,10,Thủ đô của Việt Nam là thành phố nào?,Hà Nội\n" +
      "2,20,Tác phẩm “Tắt đèn” của nhà văn nào?,Ngô Tất Tố\n" +
      "3,30,Năm nào Đảng Cộng sản Việt Nam thành lập?,1930\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mau-cau-hoi-ve-dich.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const all = qs0.slice().sort((a, b) => Number(!!b.auto) - Number(!!a.auto) || String(a.question || "").localeCompare(String(b.question || "")));
  const kw = search.trim().toLowerCase();
  const matched = all.filter(
    (q) =>
      (filter === "all" || Number(q.points) === filter) &&
      (!kw ||
        String(q.question || "").toLowerCase().includes(kw) ||
        String(q.answer || "").toLowerCase().includes(kw))
  );
  const shown = matched.slice(0, visible);
  const autoInMatched = matched.filter((q) => !!q.auto).length;

  return (
    <div>
      {/* THỐNG KÊ + IMPORT — gọn một dòng */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
        <span className="text-sm">
          <b>10đ: {qs0.filter((q) => Number(q.points) === 10).length}</b>
          {" · "}
          <b>20đ: {qs0.filter((q) => Number(q.points) === 20).length}</b>
          {" · "}
          <b>30đ: {qs0.filter((q) => Number(q.points) === 30).length}</b>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onImport} />
          <button
            type="button"
            disabled={importing}
            title="Cột: Điểm (10/20/30) • Câu hỏi • Đáp án. STT tuỳ chọn (4 cột đầu). Không tiêu đề = 3 cột đúng thứ tự."
            className="btn btn-ok text-xs py-1!"
            onClick={() => fileRef.current?.click()}
          >
            {importing ? "Đang nhập…" : "Nhập Excel / CSV"}
          </button>
          <button type="button" className="btn btn-ghost text-xs py-1!" onClick={downloadVdTemplate}>
            File mẫu
          </button>
        </span>
      </div>

      {/* LỌC THEO ĐIỂM */}
      <div className="flex flex-wrap items-center gap-2 mb-2.5">
        {["all", ...levels].map((lv) => (
          <button
            key={lv}
            type="button"
            onClick={() => setFilter(lv)}
            className={`border px-3 py-1 text-xs font-semibold transition ${
              filter === lv
                ? "border-gold bg-gold/15 text-gold"
                : "border-line/60 text-mist hover:border-gold/50 hover:text-white"
            }`}
          >
            {lv === "all" ? "Tất cả" : `${lv}đ`}
          </button>
        ))}
      </div>

      {/* TÌM KIẾM + THÊM */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo nội dung câu hỏi / đáp án…"
          className="min-w-0 flex-1!"
        />
        <button
          type="button"
          className="btn btn-ok text-xs py-1.5! ml-auto"
          title={filter === "all" ? "Thêm câu 10 điểm" : `Thêm câu ${filter} điểm`}
          onClick={() => addQ(filter === "all" ? 10 : filter)}
        >
          {filter === "all" ? "+ Thêm" : `+ Thêm ${filter}đ`}
        </button>
      </div>

      {/* DANH SÁCH */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-sm text-mist">
          Hiện {shown.length}/{matched.length} câu
        </span>
        {autoInMatched > 0 && (
          <button
            type="button"
            className="btn btn-ghost text-xs py-1! px-2!"
            onClick={() => {
              if (confirm(`Xóa ${autoInMatched} câu tự tạo (auto) đang hiển thị sau bộ lọc?`)) {
                delQs(matched.filter((q) => q.auto).map((q) => q.id));
              }
            }}
          >
            Dọn {autoInMatched} câu tự tạo
          </button>
        )}
        {matched.length > 0 && (<button
            type="button"
            className="btn btn-danger text-xs py-1! px-2! ml-auto"
            onClick={() => {
              if (confirm(`Xóa ${matched.length} câu Về đích đang hiển thị sau bộ lọc?`)) {
                delQs(matched.map((q) => q.id));
              }
            }}
          >
            Xóa {matched.length} câu
          </button>
        )}
      </div>

      <div className="grid gap-2">
        {shown.map((qd, i) => {
          const incomplete =
            !String(qd.question || "").trim() || !String(qd.answer || "").trim();
          return (
            <div
              key={qd.id}
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-lg border border-line/60 bg-night/30 px-3 py-2"
            >
              <span className="shrink-0 w-6 text-right text-xs text-mist tabular-nums">{i + 1}</span>
              <span className="shrink-0 w-9 text-xs font-bold text-gold">{qd.points}đ</span>
              <input
                value={qd.question || ""}
                placeholder={`Câu hỏi ${qd.points} điểm`}
                onChange={(e) => setQ(qd.id, { question: e.target.value, auto: false })}
                className="min-w-[180px] flex-1 basis-72!"
              />
              <input
                value={qd.answer || ""}
                placeholder="Đáp án"
                onChange={(e) => setQ(qd.id, { answer: e.target.value, auto: false })}
                className="w-56 shrink-0!"
              />
              {incomplete && <span className="shrink-0 text-[11px] text-mist/70">Chưa nhập nội dung</span>}
              <button
                type="button"
                title="Xóa câu"
                onClick={() => delQ(qd.id)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line/60 text-mist transition hover:border-danger/60 hover:text-danger"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {shown.length < matched.length && (
        <button
          type="button"
          className="mt-2.5 w-full border border-line/60 px-3 py-1.5 text-xs text-mist transition hover:border-gold/40 hover:text-white"
          onClick={() => setVisible((v) => v + 50)}
        >
          Hiện thêm ({matched.length - shown.length} câu)
        </button>
      )}
      {qs0.length === 0 ? (
        <p className="text-mist text-sm">Chưa có câu hỏi Về đích.</p>
      ) : matched.length === 0 ? (
        <p className="text-mist text-sm">Không có câu hỏi phù hợp với bộ lọc.</p>
      ) : null}
    </div>
  );
}

function JsonEditor({ draft, setDraft, setMsg }) {
  const [text, setText] = useState(JSON.stringify(draft.main, null, 2));
  const [err, setErr] = useState(null);

  useEffect(() => {
    setText(JSON.stringify(draft.main, null, 2));
  }, [draft.main]);

  function apply() {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object") throw new Error("Phải là object bọc các vòng");
      setDraft({ ...draft, main: normalizeMain(parsed) });
      setErr(null);
      setMsg("Đã nạp JSON vào bản nháp — bấm Lưu vòng chính");
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div>
      <p className="text-mist text-sm mb-2">Sửa JSON rồi bấm <b>Nạp vào bản nháp</b>, sau đó <b>Lưu vòng chính</b>. Cấu trúc thiếu sẽ tự được bổ sung.</p>
      <textarea rows={18} className="w-full font-mono text-sm" value={text} onChange={(e) => { setText(e.target.value); setErr(null); }} />
      {err && <p className="text-red-400 text-sm mt-1">Lỗi: {err}</p>}
      <button type="button" className="btn mt-3" onClick={apply} disabled={err}>Nạp vào bản nháp</button>
    </div>
  );
}

function RulesTab({ state, reload, setMsg }) {
  const rounds = state.rounds || [];
  const [drafts, setDrafts] = useState(() => {
    const init = {};
    rounds.forEach((r) => {
      init[r.id] = (Array.isArray(r.rules) ? r.rules : []).join("\n");
    });
    return init;
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    const rules = {};
    rounds.forEach((r) => {
      const lines = (drafts[r.id] || "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      if (lines.length) rules[r.id] = lines;
    });
    setSaving(true);
    try {
      await saveRoundRules(rules);
      setMsg("Đã lưu luật thi từng vòng");
      reload();
    } catch (err) {
      setMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <p className="text-mist text-sm mb-4">
        Mỗi dòng là một ý luật (hiện theo số thứ tự trên màn hình lớn). Lưu xong là màn hình khán giả / thí sinh / MC cập nhật ngay.
      </p>
      <div className="grid gap-3 lg:grid-cols-2">
        {rounds.map((r) => (
          <div key={r.id} className="rounded-xl border border-line bg-night/40 p-4">
            <div className="font-bold flex items-center justify-between gap-2">
              <span>{r.name}</span>
              <span className="text-mist text-xs">{drafts[r.id]?.split("\n").filter((x) => x.trim()).length || 0} dòng</span>
            </div>
            <textarea
              rows={10}
              className="w-full font-mono text-sm mt-2"
              value={drafts[r.id] || ""}
              placeholder="Mỗi dòng là một luật…"
              onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button type="button" className="btn mt-4" onClick={save} disabled={saving}>
        {saving ? "Đang lưu…" : "Lưu luật thi"}
      </button>
    </div>
  );
}

function SoundsTab({ state, reload, setMsg }) {
  const slots = [
    ["correct", "Đúng", "Phát khi MC chấm đúng"],
    ["wrong", "Sai", "Phát khi MC chấm sai"],
    ["bg", "Nhạc nền", "Lặp khi đang thi"],
    ["wait", "Nhạc chờ", "Lặp khi màn hình chờ"],
    ["buzz", "Chuông giành quyền CNV", "Phát khi thí sinh ấn phím trả lời chướng ngại vật"],
    ["answers", "Chuyển màn Đáp án", "Phát khi MC chuyển khán giả sang màn Đáp án vòng 2"],
    ["khoi_dong", "Nhạc luật chơi Khởi động", "Phát trên màn hình Khán giả khi chiếu luật chơi vòng Khởi động"],
  ];
  const sounds = state.sounds || {};

  async function onFile(slot, e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadSound(slot, file);
    setMsg(`Đã lưu âm thanh ${slot}`);
    reload();
  }

  async function clear(slot) {
    await deleteSound(slot);
    setMsg("Đã gỡ âm thanh");
    reload();
  }

  return (
    <div className="panel">
      <p className="text-mist text-sm mb-4">Bốn file âm thanh riêng — không trộn với ảnh/video. Màn hình khán giả tự phát.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {slots.map(([id, label, hint]) => {
          const s = sounds[id] || {};
          return (
            <div key={id} className="rounded-xl border border-line bg-night/40 p-4">
              <div className="font-bold">{label}</div>
              <div className="text-mist text-xs mt-0.5">{hint}</div>
              {s.url ? (
                <audio className="w-full mt-3" src={s.url} controls />
              ) : (
                <div className="text-mist text-sm mt-3">Chưa có file</div>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <label className="btn btn-ghost text-sm py-1.5! cursor-pointer">
                  {s.url ? "Đổi file" : "Chọn file"}
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => onFile(id, e)} />
                </label>
                {s.url && (
                  <button type="button" className="btn btn-danger text-sm py-1.5!" onClick={() => clear(id)}>Gỡ</button>
                )}
                {s.name && <span className="text-mist text-xs truncate">{s.name}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MediaTab({ state, reload, setMsg }) {
  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    setMsg("Đã tải media");
    reload();
  }

  return (
    <div className="panel">
      <p className="text-mist">Tải ảnh/video gợi ý. MC có thể hiện lên màn hình khán giả.</p>
      <input type="file" accept="image/*,video/*" onChange={onFile} className="my-3" />
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(state.media || []).filter((m) => m.type === "image" || m.type === "video").map((m) => (
          <div key={m.id}>
            {m.type === "video" ? (
              <video src={m.url} className="w-full rounded-lg" />
            ) : (
              <img src={m.url} alt={m.name} className="w-full rounded-lg object-cover" />
            )}
            <div className="text-mist text-xs mt-1 truncate">{m.name}</div>
            <button type="button" className="btn btn-ghost mt-1 text-sm py-1.5!" onClick={() => navigator.clipboard.writeText(m.url)}>
              Copy URL
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimerBuzzerTab({ state, timer: liveTimer, setMsg }) {
  const g = state.game || {};
  const t = liveTimer || g.timer || {};
  const [seconds, setSeconds] = useState(() => Number(t.remaining) || 15);
  const remaining = t.remaining ?? 0;
  const running = !!t.running;
  const winner = state.teams.find((x) => x.id === g.buzzer?.winner);
  const act = async (action, body) => {
    try {
      await sendControl(action, body);
    } catch (e) {
      setMsg(e.message);
    }
  };
  return (
    <div className="panel max-w-[560px]">
      <div className="text-xs tracking-[0.18em] text-mist uppercase mb-2">Hẹn giờ</div>
      <span className={`timer-xl text-4xl ${remaining <= 5 && running ? "timer-danger" : ""}`}>
        {formatTime(remaining)}
      </span>
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <input type="number" value={seconds} onChange={(e) => setSeconds(e.target.value)} className="w-20!" />
        <button type="button" className="btn" onClick={() => act("timer.set", { seconds: Number(seconds), running: true })}>
          Bắt đầu giờ
        </button>
        <button type="button" className="btn btn-ghost" disabled={!running} onClick={() => act("timer.pause")}>
          Dừng
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!!running || !(remaining > 0)}
          onClick={() => act("timer.resume")}
        >
          Tiếp
        </button>
        <span className="text-mist text-xs">{running ? "Đang chạy" : "Đã dừng"}</span>
      </div>

      <div className="text-xs tracking-[0.18em] text-mist uppercase mt-6 mb-2">Chuông</div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" disabled={!!g.buzzer?.open} onClick={() => act("buzzer.open")}>
          Mở chuông
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => act("buzzer.reset", { open: true })}>
          Reset chuông (mở)
        </button>
        <button type="button" className="btn btn-ghost" disabled={!g.buzzer?.open} onClick={() => act("buzzer.close")}>
          Khóa chuông
        </button>
        {!!g.buzzer?.winner && <span className="badge badge-ok">Giữ chuông: {winner?.name || g.buzzer.winner}</span>}
      </div>
      <div className="text-mist text-xs mt-2">
        Chuông: {g.buzzer?.open ? "MỞ" : "KHÓA"}
        {(g.buzzer?.order || []).length > 0 &&
          ` • Thứ tự bấm: ${g.buzzer.order.map((id) => state.teams.find((x) => x.id === id)?.name || id).join(" → ")}`}
      </div>
    </div>
  );
}

function SettingsTab({ state, reload, setMsg }) {
  const [s, setS] = useState(state.settings);
  const [kdAnswerSec, setKdAnswerSec] = useState(() => Number(state.game?.khoiDong?.answerSeconds) || 4);
  const [kdTimerSec, setKdTimerSec] = useState(() => Number(state.game?.khoiDong?.timerSeconds) || 60);
  const [vedAutoSec, setVedAutoSec] = useState(() => Number(state.settings?.veDichAutoAnswerSeconds) || 5);
  // Bộ điểm thưởng theo độ nhanh Vòng 2 (Vượt CNV) & Vòng 3 (Tăng tốc) — admin thay đổi được.
  const [r2Pts, setR2Pts] = useState(() => (state.game?.round2Points || [40, 30, 20, 10]).map((n) => String(Number(n) || 0)));
  const [r3Pts, setR3Pts] = useState(() => (state.game?.round3Points || [40, 30, 20, 10]).map((n) => String(Number(n) || 0)));
  return (
    <div className="panel grid gap-3.5 max-w-[560px]">
      <label className="label-grid">
        Tên cuộc thi
        <input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} />
      </label>
      <label className="label-grid">
        Phụ đề
        <input value={s.subtitle} onChange={(e) => setS({ ...s, subtitle: e.target.value })} />
      </label>
      <label className="label-grid">
        PIN ban tổ chức
        <input value={s.pin} onChange={(e) => setS({ ...s, pin: e.target.value })} />
      </label>
      <label className="flex items-center gap-2 text-sm text-mist">
        <input
          type="checkbox"
          checked={!!s.showLiveRanking}
          onChange={(e) => setS({ ...s, showLiveRanking: e.target.checked })}
          className="w-auto!"
        />
        Hiện bảng xếp hạng live
      </label>
      <div className="rounded-xl border border-line bg-night/40 p-3.5">
        <div className="text-xs tracking-[0.18em] text-mist uppercase mb-2">Nền màn hình khán giả (khởi động)</div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="label-grid flex-1 min-w-[180px]">
            Kiểu nền
            <select value={s.audienceBg || "dark"} onChange={(e) => setS({ ...s, audienceBg: e.target.value })}>
              <option value="dark">Tối (đặc)</option>
              <option value="blur">Ảnh mờ phía sau</option>
            </select>
          </label>
          {s.audienceBg === "blur" && (
            <label className="label-grid flex-1 min-w-[220px]">
              Ảnh nền (chọn từ Hình ảnh/Video đã tải)
              <select value={s.audienceBgUrl || ""} onChange={(e) => setS({ ...s, audienceBgUrl: e.target.value })}>
                <option value="">— Không dùng ảnh nền —</option>
                {(state.media || []).filter((m) => m.type === "image").map((m) => (
                  <option key={m.id} value={m.url}>{m.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {s.audienceBg === "blur" && s.audienceBgUrl && (
          <img src={s.audienceBgUrl} className="mt-3 h-24 w-full object-cover rounded-lg border border-line" alt="Ảnh nền" />
        )}
        {s.audienceBg !== "blur" && <p className="text-mist text-xs mt-2">Màn hình khán giả vòng khởi động sẽ dùng nền tối đặc.</p>}
      </div>
      <label className="label-grid">
        Thời gian hiện đáp án khởi động (giây — 0 = sang câu kế ngay)
        <input type="number" value={kdAnswerSec} onChange={(e) => setKdAnswerSec(Number(e.target.value))} />
      </label>
      <label className="label-grid">
        Thời gian mỗi lượt khởi động (giây)
        <input type="number" value={kdTimerSec} onChange={(e) => setKdTimerSec(Number(e.target.value))} />
      </label>
      <label className="label-grid">
        Về đích — tự bắt đầu giờ trả lời sau (giây, 0 = tắt, chờ MC bấm)
        <input type="number" min={0} value={vedAutoSec} onChange={(e) => setVedAutoSec(Number(e.target.value))} />
      </label>
      <div className="rounded-xl border border-line bg-night/40 p-3.5">
        <div className="text-xs tracking-[0.18em] text-mist uppercase mb-1">Điểm thưởng theo độ nhanh</div>
        <p className="text-mist text-xs mb-3">
          MC đổi bộ điểm cho từng đội trả lời ĐÚNG ở Vòng 2 (Vượt CNV) &amp; Vòng 3 (Tăng tốc), theo thứ tự nộp nhanh → chậm (mặc định 40·30·20·10).
        </p>
        {[
          { label: "Vòng 2 · Vượt CNV", key: "r2", arr: r2Pts, set: setR2Pts },
          { label: "Vòng 3 · Tăng tốc", key: "r3", arr: r3Pts, set: setR3Pts },
        ].map((g2) => (
          <div key={g2.key} className="mb-3">
            <div className="text-sm font-semibold text-white mb-1.5">{g2.label}</div>
            <div className="flex items-center gap-2">
              {["Nhất", "Nhì", "Ba", "Tư"].map((label, idx) => (
                <label key={label} className="flex-1 min-w-0">
                  <span className="block text-[10px] uppercase tracking-wider text-mist mb-0.5">{label}</span>
                  <input
                    type="number"
                    min={0}
                    className="w-full! px-2 py-1! text-sm tabular-nums"
                    value={g2.arr[idx]}
                    onChange={(e) => {
                      const next = g2.arr.slice();
                      next[idx] = e.target.value;
                      g2.set(next);
                    }}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost text-xs py-1!"
          onClick={async () => {
            const num = (a) => a.map((x) => Math.max(0, Number(x) || 0));
            await sendControl("round.points", { round: "vuot_cnv", points: num(r2Pts) });
            await sendControl("round.points", { round: "tang_toc", points: num(r3Pts) });
            setMsg("Đã lưu điểm thưởng Vòng 2 & Vòng 3");
            reload();
          }}
        >
          Lưu điểm thưởng Vòng 2 &amp; Vòng 3
        </button>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={async () => { await saveSettings(s); setMsg("Đã lưu cài đặt"); reload(); }}>Lưu</button>
        <button type="button" className="btn btn-ghost" onClick={async () => { await setKhoiDongAnswerSeconds(kdAnswerSec || 0); await setKhoiDongTimerSeconds(kdTimerSec || 60); setMsg("Đã lưu cấu hình khởi động"); reload(); }}>Lưu thời gian khởi động</button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={async () => {
            if (confirm("Xóa toàn bộ thí sinh và điểm?")) {
              await resetContest();
              reload();
            }
          }}
        >
          Reset cuộc thi
        </button>
      </div>
    </div>
  );
}
