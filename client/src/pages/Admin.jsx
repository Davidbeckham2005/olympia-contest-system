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
  importQuickQuestionsFile,
  importKhoiDongImagesFile,
  uploadFile,
  uploadSound,
  deleteSound,
  saveSettings,
  saveRoundRules,
  setKhoiDongAnswerSeconds,
  setKhoiDongTimerSeconds,
  resetContest,
  resetTeams,
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
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${tab === id ? "bg-gold text-[#1a1400] border-gold" : "border-line text-mist hover:border-gold/60"
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
const PACKAGES = {
  60: [10, 10, 20, 20],
  80: [10, 20, 20, 30],
  100: [20, 20, 30, 30],
};
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
    tieBreak: v.tieBreak || [],
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
  m.veDich = vdRaw.filter((q) => q && typeof q === "object").map((q) => {
    const rest = { ...q };
    delete rest.auto;
    return {
      id: q.id || uid(),
      question: q.question || "",
      answer: q.answer || "",
      ...rest,
      points: normVdPoints(q.points),
    };
  });
  m.vuotCnv.rows = (m.vuotCnv.rows || []).filter((r) => r && typeof r === "object").map((r) => ({ id: r.id || uid(), question: r.question || "", answer: r.answer || "", letterCount: r.letterCount ?? "", ...r }));
  m.tangToc = (m.tangToc || []).filter((q) => q && typeof q === "object").map((q) => ({ id: q.id || uid(), answer: q.answer || "", duration: Number(q.duration) || 60, mediaUrl: q.mediaUrl || "", mediaType: "video", ...q }));
  m.tieBreak = (m.tieBreak || []).filter((q) => q && typeof q === "object").map((q) => ({
    id: q.id || `tb-${Math.random().toString(36).slice(2, 8)}`,
    question: q.question || "",
    answer: q.answer || "",
    options: Array.isArray(q.options) ? q.options : [],
    mediaUrl: q.mediaUrl || "",
    mediaType: q.mediaType || "",
    note: q.note || "",
    ...q,
  }));
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
    ["vong_phu", "Vòng phụ"],
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
            className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${sub === id ? "bg-gold text-[#1a1400] border-gold" : "border-line text-mist hover:border-gold/60"
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

        {sub === "khoi_dong" && <KhoiDongEditor draft={draft} setDraft={setDraft} teams={state.teams} setMsg={setMsg} />}
        {sub === "vuot_cnv" && <VuotCnvEditor draft={draft} setDraft={setDraft} />}
        {sub === "tang_toc" && <TangTocEditor draft={draft} setDraft={setDraft} />}
        {sub === "ve_dich" && <VeDichEditor draft={draft} setDraft={setDraft} teams={state.teams} setMsg={setMsg} />}
        {sub === "vong_phu" && <TieBreakEditor draft={draft} setDraft={setDraft} setMsg={setMsg} />}
        {sub === "json" && <JsonEditor draft={draft} setDraft={setDraft} setMsg={setMsg} />}
      </div>
    </div>
  );
}

function TieBreakEditor({ draft, setDraft, setMsg }) {
  const m = draft.main;
  const list = (m.tieBreak || []).slice();
  const setList = (next) => setDraft({ ...draft, main: { ...m, tieBreak: next } });
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const pendingImgs = useRef([]);
  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const images = pendingImgs.current;
      pendingImgs.current = [];
      const r = await importQuickQuestionsFile(file, "tie_break", "", images);
      const fresh = (r.questions || []).map((q) => (q.id ? q : { ...q, id: uid() }));
      setList([...list, ...fresh]);
      setMsg(`Đã nhập ${r.added} câu Vòng phụ` + (images.length ? `, dùng ${images.length} ảnh từ thư mục` : "") + (r.errors?.length ? `, ${r.errors.length} dòng bỏ qua` : "") + ". Bấm Lưu vòng chính khi xong.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setImporting(false);
    }
  }
  function pickImages(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    pendingImgs.current = [...pendingImgs.current, ...files];
    setMsg(`Đã chọn ${files.length} ảnh (tổng ${pendingImgs.current.length}). Giờ chọn file Excel danh sách bên cạnh.`);
  }
  function setQuestion(index, patch) {
    setList(list.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }
  function addQuestion() {
    setList([...list, { id: `tb-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, question: "", answer: "", options: [], mediaUrl: "", mediaType: "", note: "" }]);
  }
  async function uploadQuestionImage(index, file) {
    if (!file) return;
    try {
      const media = await uploadFile(file);
      setQuestion(index, { mediaUrl: media.url, mediaType: media.type || "image" });
    } catch (err) {
      setMsg(err.message);
    }
  }
  function downloadTbTemplate() {
    const csv =
      "\uFEFFCâu hỏi,Đáp án,Ảnh\n" +
      "Thủ đô của Việt Nam là thành phố nào?,Hà Nội,\n" +
      ",Paris,thap-efiel.png\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mau-cau-hoi-vong-phu.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
        <div>
          <div className="text-sm font-semibold text-white">Ngân hàng câu hỏi Vòng phụ</div>
          <div className="text-xs text-mist mt-0.5">Mỗi dòng là một câu. Có thể nhập kèm ảnh giống Vòng 1.</div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input ref={imgRef} type="file" accept="image/*" multiple className="hidden" onChange={pickImages} />
          <button type="button" className="btn btn-ghost text-xs py-1.5!" title="Chọn các ảnh để dùng cùng file nhập." onClick={() => imgRef.current?.click()}>
            Chọn ảnh kèm
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onImport} />
          <button type="button" className="btn btn-ok text-xs py-1.5!" disabled={importing} onClick={() => fileRef.current?.click()}>
            {importing ? "Đang nhập…" : "Nhập Excel / CSV"}
          </button>
          {pendingImgs.current.length > 0 && <span className="text-xs text-gold">Đã chọn {pendingImgs.current.length} ảnh</span>}
          <button type="button" className="btn btn-ghost text-xs py-1.5!" onClick={downloadTbTemplate}>Tải file mẫu</button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-sm text-mist">
          <span className="text-white font-semibold">{list.length}</span> câu
          <span className="mx-2 text-line">|</span>
          <span className="text-ok">{list.filter((q) => q.question?.trim() && q.answer?.trim()).length}</span> hoàn chỉnh
          <span className="mx-2 text-line">|</span>
          <span className="text-gold">{list.filter((q) => q.mediaUrl).length}</span> có ảnh
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm câu hỏi / đáp án…"
          className="ml-auto min-w-[240px] flex-1! max-w-[420px]"
        />
        <button type="button" className="btn btn-ghost text-xs py-1.5!" onClick={addQuestion}>+ Thêm câu</button>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[900px] flex flex-col gap-1.5">
          <div className="grid grid-cols-[2.5rem_9rem_minmax(0,1fr)_14rem_2.5rem] gap-2 border-b border-line px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-mist/70">
            <span className="text-right">#</span>
            <span>Hình ảnh</span>
            <span>Câu hỏi</span>
            <span>Đáp án</span>
            <span />
          </div>
          {list.filter((q) => {
            const keyword = search.trim().toLowerCase();
            return !keyword || `${q.question || ""} ${q.answer || ""}`.toLowerCase().includes(keyword);
          }).length === 0 ? (
            <div className="border border-dashed border-line px-4 py-8 text-center text-sm text-mist">
              {list.length ? "Không có câu phù hợp." : "Chưa có câu hỏi Vòng phụ. Hãy nhập file hoặc thêm câu mới."}
            </div>
          ) : (
            list.map((q, i) => {
              const keyword = search.trim().toLowerCase();
              if (keyword && !`${q.question || ""} ${q.answer || ""}`.toLowerCase().includes(keyword)) return null;
              return (
                <div key={q.id || i} className="grid grid-cols-[2.5rem_9rem_minmax(0,1fr)_14rem_2.5rem] gap-2 items-center border-b border-line/50 px-3 py-2 hover:bg-night/30 transition">
                  <span className="text-right text-xs text-mist/70 tabular-nums">{i + 1}</span>
                  <div className="flex items-center gap-1.5">
                    {q.mediaUrl ? (
                      <div className="relative">
                        <img src={q.mediaUrl} alt="" className="h-14 w-20 rounded object-cover border border-line" />
                        <button type="button" title="Gỡ ảnh" className="absolute -top-1 -right-1 rounded bg-night/90 px-1 text-[10px] text-danger" onClick={() => setQuestion(i, { mediaUrl: "", mediaType: "" })}>✕</button>
                      </div>
                    ) : (
                      <span className="h-14 w-20 rounded border border-dashed border-line grid place-items-center text-[10px] text-mist">Chưa có ảnh</span>
                    )}
                    <label className="btn btn-ghost text-[10px] py-1! cursor-pointer">
                      Đổi ảnh
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; uploadQuestionImage(i, file); }} />
                    </label>
                  </div>
                  <input
                    className="w-full! bg-panel border border-line px-2.5 py-2 text-sm text-white"
                    value={q.question || ""}
                    onChange={(e) => setQuestion(i, { question: e.target.value })}
                    placeholder="Câu hỏi…"
                  />
                  <input
                    className="w-full! bg-panel border border-line px-2.5 py-2 text-sm text-white"
                    value={q.answer || ""}
                    onChange={(e) => setQuestion(i, { answer: e.target.value })}
                    placeholder="Đáp án"
                  />
                  <button
                    type="button"
                    title="Xóa câu"
                    className="justify-self-end text-mist/70 hover:text-danger text-sm"
                    onClick={() => setList(list.filter((_, j) => j !== i))}
                  >
                    Xóa
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function KhoiDongEditor({ draft, setDraft, teams, setMsg }) {
  const m = draft.main;
  const teamIds = TEAM_ORDER;
  const [importing, setImporting] = useState("");
  const fileRefs = useRef({});
  const imgRefs = useRef({});
  const quickImgRefs = useRef({});
  const pendingImgs = useRef({}); // { tid: File[] } ảnh chọn trước, chờ chọn file Excel
  // Nhập nhanh CHỈ bằng ảnh: cứ 5 ảnh = 1 thí sinh, đáp án lấy từ tên file.
  async function onImportImages(tid, e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setImporting(tid);
    try {
      const r = await importKhoiDongImagesFile(tid, files);
      const clusters = m.khoiDong?.[tid] || [];
      const fresh = (r.clusters || []).filter((cl) => cl && cl.length);
      const next = [...clusters, ...fresh];
      setDraft({ ...draft, main: { ...m, khoiDong: { ...(m.khoiDong || {}), [tid]: next } } });
      setMsg(`Đã nhập ${r.added} ảnh (${fresh.length} thí sinh) cho đội, đáp án lấy từ tên file` + (r.errors?.length ? `, ${r.errors.length} ảnh lỗi` : "") + ". Bấm Lưu vòng chính khi xong.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setImporting("");
    }
  }
  async function onImport(tid, e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(tid);
    try {
      const images = pendingImgs.current[tid] || [];
      delete pendingImgs.current[tid];
      const r = await importQuickQuestionsFile(file, "khoi_dong", tid, images);
      const clusters = m.khoiDong?.[tid] || [];
      const fresh = (r.clusters || []).filter((cl) => cl && cl.length);
      const next = [...clusters, ...fresh];
      setDraft({ ...draft, main: { ...m, khoiDong: { ...(m.khoiDong || {}), [tid]: next } } });
      setMsg(`Đã nhập ${r.added} câu (${r.clusters?.length || 0} thí sinh) cho đội` + (images.length ? `, dùng ${images.length} ảnh từ thư mục` : "") + (r.errors?.length ? `, ${r.errors.length} dòng bỏ qua` : "") + ". Bấm Lưu vòng chính khi xong.");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setImporting("");
    }
  }
  function pickImages(tid, e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    pendingImgs.current[tid] = [...(pendingImgs.current[tid] || []), ...files];
    setMsg(`Đã chọn ${files.length} ảnh cho đội (tổng ${pendingImgs.current[tid].length}). Giờ chọn file Excel danh sách bên cạnh.`);
  }
  function downloadKdTemplate() {
    const csv =
      "\uFEFFẢnh,Đáp án\n" +
      "thap-efiel.png,Pháp\n" +
      "tuong-nu-than.png,Mỹ\n" +
      "thap-nghieng.png,Ý\n" +
      "dai-bai.jpg,Úc\n" +
      "cau-vong.png,Mỹ\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mau-khoi-dong.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

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
              <div className="ml-auto flex items-center gap-2">
                <input
                  ref={(el) => { quickImgRefs.current[tid] = el; }}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onImportImages(tid, e)}
                />
                <button
                  type="button"
                  className="btn btn-ok text-xs py-1!"
                  disabled={importing === tid}
                  title="Chọn nhanh nhiều ảnh cùng lúc — cứ 5 ảnh (theo tên file) = 1 thí sinh. Đáp án lấy từ tên file (vd: 01-Pháp.png → Pháp), bỏ số thứ tự đầu tên."
                  onClick={() => quickImgRefs.current[tid]?.click()}
                >
                  {importing === tid ? "Đang nhập…" : "Nhập nhanh ảnh"}
                </button>
                <input
                  ref={(el) => { imgRefs.current[tid] = el; }}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => pickImages(tid, e)}
                />
                <button
                  type="button"
                  className="btn btn-ghost text-xs py-1!"
                  title="Chọn các file ảnh trong thư mục ảnh trên máy cá nhân (chưa upload). Có thể chọn nhiều file cùng lúc."
                  onClick={() => imgRefs.current[tid]?.click()}
                >
                  Chọn ảnh…
                </button>
                <input ref={(el) => { fileRefs.current[tid] = el; }} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onImport(tid, e)} />
                <button
                  type="button"
                  className="btn btn-ok text-xs py-1!"
                  disabled={importing === tid}
                  title="1 dòng = 1 câu (Ảnh + Đáp án), cứ 5 dòng = 1 thí sinh. Ảnh ghi tên file (có thể chọn kèm thư mục ảnh trước)."
                  onClick={() => fileRefs.current[tid]?.click()}
                >
                  {importing === tid ? "Đang nhập…" : "Nhập Excel / CSV"}
                </button>
                <button type="button" className="btn btn-ghost text-xs py-1!" onClick={downloadKdTemplate}>File mẫu</button>
                <button type="button" className="btn btn-ghost text-xs py-1!" onClick={() => addMember(tid)}>+ Thêm thí sinh</button>
              </div>
            </div>

            {clusters.map((cl, mi) => (
              <div key={String(mi)} className="rounded-lg border border-line bg-night/60 p-2 mb-3 last:mb-0">
                <div className="flex items-center justify-between mb-2">
                  <b className="text-xs text-mist uppercase">Thí sinh {mi + 1}</b>
                  <button type="button" className="btn btn-danger text-xs py-0.5! px-1.5!" onClick={() => delMember(tid, mi)}>✕</button>
                </div>
                <div className="grid gap-2">
                  {Array.from({ length: 5 }, (_, i) => {
                    const q = cl[i] || { answer: "", mediaUrl: "" };
                    return (
                      <div key={i} className="grid grid-cols-[3.5rem_7rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 items-center rounded-lg border border-line bg-night/70 px-2 py-1.5">
                        <span className="text-mist text-xs text-center truncate">Ảnh #{i + 1}</span>
                        <div className="relative shrink-0">
                          {q.mediaUrl ? (
                            <div className="relative">
                              <img src={q.mediaUrl} className="w-24 h-14 object-cover rounded-lg" />
                              <button
                                type="button"
                                className="absolute -top-1 -right-1 text-[10px] text-danger bg-night/80 rounded px-1"
                                title="Gỡ ảnh"
                                onClick={() => setQ(tid, mi, i, { mediaUrl: "" })}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="w-24 h-14 rounded-lg border border-dashed border-line grid place-items-center text-mist text-[10px] text-center p-1">
                              Chưa có ảnh
                            </div>
                          )}
                          <label className="btn btn-ok text-[10px] py-0! cursor-pointer mt-1">
                            Chọn
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) setImg(tid, mi, i, f); }}
                            />
                          </label>
                        </div>
                        <input
                          className="w-full! bg-panel border border-line px-2 py-1 text-xs text-white"
                          value={q.mediaUrl || ""}
                          placeholder="…hoặc dán URL ảnh"
                          onChange={(e) => setQ(tid, mi, i, { mediaUrl: e.target.value })}
                        />
                        <input
                          className="w-full! bg-panel border border-line px-2 py-1 text-xs text-white"
                          value={q.answer || ""}
                          placeholder="Đáp án"
                          onChange={(e) => setQ(tid, mi, i, { answer: e.target.value })}
                        />
                        <span />
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

      <div className="overflow-x-auto mb-4">
        <div className="min-w-[760px] flex flex-col gap-1.5">
          <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_13rem_5.5rem_3rem] gap-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-mist/70">
            <span className="text-right">#</span>
            <span>Câu hỏi hàng ngang</span>
            <span>Đáp án</span>
            <span>Số chữ</span>
            <span />
          </div>
          {(v.rows || []).length === 0 ? (
            <p className="px-1 text-sm text-mist/80">Chưa có câu hỏi Vượt CNV.</p>
          ) : (
            (v.rows || []).map((row, i) => (
              <div key={row.id} className="grid grid-cols-[2.5rem_minmax(0,1fr)_13rem_5.5rem_3rem] gap-2 items-center px-3 py-1.5 rounded bg-night/25 hover:bg-night/50 transition">
                <span className="text-right text-xs text-mist/70 tabular-nums">{i + 1}</span>
                <input
                  className="w-full!"
                  value={row.question || ""}
                  placeholder="Câu hỏi hàng ngang (sẽ phóng to khi chiếu)"
                  onChange={(e) => setRow(i, { question: e.target.value })}
                />
                <input
                  className="w-full!"
                  value={row.answer || ""}
                  placeholder="Đáp án"
                  onChange={(e) => setRow(i, { answer: e.target.value })}
                />
                <input
                  type="number"
                  min={1}
                  className="w-full!"
                  value={row.letterCount || ""}
                  placeholder="Chữ"
                  onChange={(e) => setRow(i, { letterCount: e.target.value })}
                />
                <button
                  type="button"
                  title="Xóa câu"
                  className="justify-self-end text-mist/70 hover:text-danger text-sm"
                  onClick={() => setV({ rows: (v.rows || []).filter((_, k) => k !== i) })}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      <button
        type="button"
        className="btn btn-ghost text-xs py-1! mb-4"
        onClick={() => setV({ rows: [...(v.rows || []), { id: uid(), question: "", answer: "", letterCount: v.letterCount || "" }] })}
      >
        + Thêm câu hàng ngang
      </button>
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

function VeDichEditor({ draft, setDraft, teams = [], setMsg }) {
  const m = draft.main;
  const qs0 = Array.isArray(m.veDich) ? m.veDich : [];
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(50);
  const [filterLv, setFilterLv] = useState(0);
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
  // Tình trạng gói CỐ ĐỊNH của từng đội (từ dữ liệu nháp, cùng quy tắc với server).
  const teamStatus = (() => {
    const byTeam = {};
    for (const q of qs0) {
      if (!q.teamId) continue;
      const key = `${q.teamId}:${q.pkg}`;
      if (!byTeam[key]) byTeam[key] = [];
      byTeam[key].push(q);
    }
    const out = [];
    for (const team of teams) {
      const pkgs = {};
      let okAll = true;
      for (const [total, structure] of Object.entries(PACKAGES)) {
        const target = Number(total);
        const qs = (byTeam[`${team.id}:${target}`] || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        const expectedCounts = {};
        for (const lv of structure) expectedCounts[lv] = (expectedCounts[lv] || 0) + 1;
        const haveCounts = {};
        for (const x of qs) {
          const lv = Number(x.points);
          haveCounts[lv] = (haveCounts[lv] || 0) + 1;
        }
        const ok = qs.length === 4 && structure.every((lv) => expectedCounts[lv] === haveCounts[lv]);
        if (!ok) okAll = false;
        pkgs[target] = { count: qs.length, ok };
      }
      out.push({ teamId: team.id, teamName: team.name, ok: okAll, pkgs });
    }
    return out;
  })();

  async function onImport(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const r = await importVeDichQuestionsFile(file);
      const inDraft = new Set(qs0.map((q) => String(q.question || "").trim().toLocaleLowerCase()).filter(Boolean));
      const fresh = (r.questions || []).filter((q) => {
        const key = String(q.question || "").trim().toLocaleLowerCase();
        if (!key || inDraft.has(key)) return false;
        inDraft.add(key);
        return true;
      });
      if (fresh.length) setQs([...qs0, ...fresh]);
      const bad = (r.teams || []).filter((t) => !t.ok);
      const msgParts = [
        `Đã nhận ${fresh.length} câu từ file vào bản nháp (${r.added} mới, ${r.skipped} trùng) — bấm "Lưu vòng chính" để ghi vào ngân hàng`,
        r.errors?.length ? `, ${r.errors.length} dòng lỗi` : "",
        ` (ngân hàng hiện có: ${r.total} câu)`,
      ];
      if (bad.length) {
        const detail = bad.map((t) => {
          const parts = Object.entries(t.packages || {}).map(([p, s]) => `${p}đ${s.ok ? "✓" : `✗(${s.have}/${s.need})`}`);
          return `${t.teamName} ${parts.join(" ")}`;
        });
        msgParts.push(` — GÓI THIẾU: ${detail.join("; ")}`);
      }
      setMsg(msgParts.join(""));
    } catch (err) {
      setMsg(err.message);
    } finally {
      setImporting(false);
    }
  }

  function downloadVdTemplate() {
    const a = document.createElement("a");
    a.href = "/files/template-cau-hoi-ve-dich.xlsx";
    a.download = "mau-cau-hoi-ve-dich.xlsx";
    a.click();
  }

  const all = qs0.slice().sort((a, b) => String(a.question || "").localeCompare(String(b.question || "")));
  const kw = search.trim().toLowerCase();
  const matched = all.filter(
    (q) =>
      !kw ||
      String(q.question || "").toLowerCase().includes(kw) ||
      String(q.answer || "").toLowerCase().includes(kw)
  );
  // Sắp xếp theo đội → gói → order → nội dung — nhóm câu của cùng đội/gói lại gần nhau
  // để admin dễ kiểm tra cấu trúc từng gói.
  const teamOrderIdx = (tid) => {
    const i = TEAM_ORDER.indexOf(tid);
    return i === -1 ? 99 : i;
  };
  const filtered = matched.filter((q) => !filterLv || Number(q.points) === filterLv);
  const sorted = [...filtered].sort(
    (a, b) =>
      teamOrderIdx(a.teamId || "") - teamOrderIdx(b.teamId || "") ||
      Number(a.pkg || 0) - Number(b.pkg || 0) ||
      Number(a.order || 0) - Number(b.order || 0) ||
      String(a.question || "").localeCompare(String(b.question || ""))
  );
  const shown = sorted.slice(0, visible);
  const ptBadge = (lv) =>
    lv === 10
      ? "bg-white/10 text-white/80"
      : lv === 20
        ? "bg-gold/15 text-gold"
        : "bg-ok/15 text-ok";

  return (
    <div>
      {/* THỐNG KÊ + IMPORT — gọn một dòng */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 mb-3">
        <span className="text-sm">
          {[10, 20, 30].map((lv, i) => (
            <span key={lv}>
              {i > 0 && " | "}
              <button
                type="button"
                onClick={() => setFilterLv(filterLv === lv ? 0 : lv)}
                title={`Lọc câu ${lv} điểm`}
                className={`rounded px-1.5 py-0.5 transition ${filterLv === lv ? "bg-gold text-[#1a1400]" : "hover:bg-white/10 hover:text-white"
                  }`}
              >
                {lv}đ: <b>{qs0.filter((q) => Number(q.points) === lv).length}</b>
              </button>
            </span>
          ))}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onImport} />
          <button
            type="button"
            disabled={importing}
            title="Đọc file và đưa câu hợp lệ vào bản nháp; bấm Lưu vòng chính để ghi vào ngân hàng. Cột: Đội • Gói (60/80/100) • Điểm (10/20/30) • Câu hỏi • Đáp án. Tệp không có tiêu đề = 3 cột đúng thứ tự (Điểm, Câu hỏi, Đáp án) → thành câu dự trữ."
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

      {/* TÌNH TRẠNG GÓI THEO ĐỘI */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {teamStatus.length === 0 ? (
          <span className="text-xs text-mist">Chưa có đội — thông tin đội sẽ xuất hiện sau khi chia đội.</span>
        ) : teamStatus.map((t) => (
          <span
            key={t.teamId}
            className={`px-2 py-1 text-[11px] rounded border ${t.ok ? "border-ok/60 text-ok" : "border-danger/60 text-danger"
              }`}
            title={t.ok ? "Đủ 3 gói 60/80/100" : "Còn thiếu câu để đủ 3 gói"}
          >
            <b>{t.teamName}</b>{" "}
            {[60, 80, 100].map((p) => `${p}đ${t.pkgs[p]?.ok ? "✓" : `✗(${t.pkgs[p]?.count || 0}/4)`}`).join(" ")}
          </span>
        ))}
      </div>

      {/* TÌM KIẾM + LỌC MỨC ĐIỂM + thao tác */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo nội dung câu hỏi / đáp án…"
          className="min-w-0 flex-1!"
        />
        <div className="flex items-center gap-1">
          {[0, 10, 20, 30].map((lv) => (
            <button
              key={lv}
              type="button"
              onClick={() => setFilterLv(lv)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold transition ${filterLv === lv ? "bg-gold text-[#1a1400] border-gold" : "border-line/60 text-mist hover:border-gold/40"
                }`}
            >
              {lv === 0 ? "Tất cả" : `${lv}đ`}
            </button>
          ))}
        </div>
        <span className="text-sm text-mist whitespace-nowrap">
          Hiện {shown.length}/{filtered.length} câu
        </span>
        {matched.length > 0 && (
          <button
            type="button"
            className="border border-line/60 px-2 py-1 text-xs text-mist transition hover:border-danger/60 hover:text-danger"
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

      {/* DANH SÁCH CÂU HỎI — mỗi câu 1 dòng, xếp theo Đội → Gói → thứ tự */}
      <div className="overflow-x-auto">
        <div className="min-w-[860px] flex flex-col gap-1.5">
          <div className="grid grid-cols-[2rem_8.5rem_5.5rem_4rem_minmax(0,1fr)_15rem_2.5rem] gap-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-mist/70">
            <span className="text-right">#</span>
            <span>Đội</span>
            <span>Gói</span>
            <span>Điểm</span>
            <span>Câu hỏi</span>
            <span>Đáp án</span>
            <span />
          </div>
          {shown.length === 0 ? (
            <p className="px-1 text-sm text-mist/80">Không có câu hỏi phù hợp.</p>
          ) : (
            shown.map((qd, i) => {
              const incomplete =
                !String(qd.question || "").trim() || !String(qd.answer || "").trim();
              return (
                <div
                  key={qd.id}
                  className={`grid grid-cols-[2rem_8.5rem_5.5rem_4rem_minmax(0,1fr)_15rem_2.5rem] gap-2 items-center px-3 py-1.5 rounded bg-night/25 hover:bg-night/50 transition ${incomplete ? "ring-1 ring-danger/30" : ""
                    }`}
                >
                  <span className="text-right text-xs text-mist/70 tabular-nums">{i + 1}</span>
                  <select
                    value={qd.teamId || ""}
                    onChange={(e) => setQ(qd.id, { teamId: e.target.value || undefined })}
                    className="w-full text-xs"
                  >
                    <option value="">Đội…</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <select
                    value={qd.pkg || ""}
                    onChange={(e) => setQ(qd.id, { pkg: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full text-xs"
                  >
                    <option value="">Gói…</option>
                    {[60, 80, 100].map((p) => (
                      <option key={p} value={p}>{p}đ</option>
                    ))}
                  </select>
                  <span className={`justify-self-center rounded px-2 py-0.5 text-[11px] font-bold ${ptBadge(Number(qd.points))}`}>
                    {Number(qd.points)}đ
                  </span>
                  <input
                    value={qd.question || ""}
                    placeholder={`Câu hỏi ${qd.points} điểm`}
                    onChange={(e) => setQ(qd.id, { question: e.target.value, auto: false })}
                    className="w-full"
                  />
                  <input
                    value={qd.answer || ""}
                    placeholder="Đáp án"
                    onChange={(e) => setQ(qd.id, { answer: e.target.value, auto: false })}
                    className="w-full"
                  />
                  <span className="justify-self-end whitespace-nowrap">
                    {incomplete ? (
                      <span className="text-[11px] font-semibold text-danger/90" title="Thiếu câu hỏi hoặc đáp án">✗</span>
                    ) : (
                      <button
                        type="button"
                        title="Xóa câu"
                        onClick={() => delQ(qd.id)}
                        className="text-mist/70 transition hover:text-danger"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {shown.length < filtered.length && (
        <button
          type="button"
          className="mt-3 w-full border border-line/60 px-3 py-1.5 text-xs text-mist transition hover:border-gold/40 hover:text-white"
          onClick={() => setVisible((v) => v + 50)}
        >
          Hiện thêm ({filtered.length - shown.length} câu)
        </button>
      )}
      {qs0.length === 0 ? (
        <p className="text-mist text-sm mt-2">Chưa có câu hỏi Về đích.</p>
      ) : filtered.length === 0 ? (
        <p className="text-mist text-sm mt-2">Không có câu hỏi phù hợp với bộ lọc.</p>
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
    ["result", "Hiệu ứng kết quả vòng", "Phát khi MC bật màn Tổng kết điểm (chưa upload sẽ tự phát tiếng hiệu tổng hợp)"],
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
  // Vòng 2 đang mở nhận bài: đồng hồ chung ở tab này là nguồn gốc gây lệch cờ mở nộp
  // bài (bấm "Bắt đầu giờ"/"Dừng" ở đây không đồng bộ với màn điều khiển Vòng 2).
  // Khóa các nút này và ép MC dùng nút "▶ Bắt đầu giờ" / "Bỏ chọn" trên màn Vòng 2.
  const cnvAccepting = g.round === "vuot_cnv" && g.puzzle?.rowPhase === "open";
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
        {cnvAccepting ? (
          <span className="text-xs text-[#ffb3c1]">
            Vòng 2 đang mở nhận bài — dùng nút <b className="text-white">▶ Bắt đầu giờ</b> trên màn điều khiển Vòng 2 (đồng hồ chung tạm khóa để không lệch cờ nộp bài).
          </span>
        ) : (
          <>
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
          </>
        )}
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
  const [cnvAutoSec, setCnvAutoSec] = useState(() => Number(state.settings?.vuotCnvAutoAnswerSeconds) || 6);
  const [tbAnswerSec, setTbAnswerSec] = useState(() => Number(state.settings?.tieBreakAnswerSeconds) || 10);
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
      <label className="label-grid">
        Vượt CNV — tự bắt đầu giờ trả lời sau khi mở câu hỏi (giây, 0 = tắt, chờ MC bấm)
        <input type="number" min={0} value={cnvAutoSec} onChange={(e) => setCnvAutoSec(Number(e.target.value))} />
      </label>
      <label className="label-grid">
        Vòng phụ — thời gian trả lời mỗi câu (giây)
        <input type="number" min={3} value={tbAnswerSec} onChange={(e) => setTbAnswerSec(Number(e.target.value))} />
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
        <button type="button" className="btn" onClick={async () => {
          await saveSettings({
            ...s,
            veDichAutoAnswerSeconds: Math.max(0, Number(vedAutoSec) || 0),
            vuotCnvAutoAnswerSeconds: Math.max(0, Number(cnvAutoSec) || 0),
            tieBreakAnswerSeconds: Math.max(3, Number(tbAnswerSec) || 10),
          });
          setMsg("Đã lưu cài đặt");
          reload();
        }}>Lưu</button>
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
        <button
          type="button"
          className="btn btn-danger btn-ghost"
          onClick={async () => {
            if (confirm("Đưa điểm toàn bộ đội về 0 và bắt đầu lại cuộc thi? (Giữ nguyên thí sinh, câu hỏi, âm thanh)")) {
              await resetTeams();
              reload();
            }
          }}
        >
          Reset đội về 0
        </button>
      </div>
    </div>
  );
}
