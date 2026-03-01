import { useState, useEffect } from "react";
import "./App.css";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  setDoc,
} from "firebase/firestore";

// ── Replace with your Firebase project config ─────────────────────────────────
const firebaseConfig = {
  apiKey: "XXXXXXXX",
  authDomain: "attendmark-17229.firebaseapp.com",
  projectId: "attendmark-17229",
  storageBucket: "XXXXXXX",
  messagingSenderId: "XXXXXXX",
  appId: "XXXXXXXXXXX",
  measurementId: "XXXXXXXXXX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const PERIODS = ["P-1", "P-2", "P-3", "P-4", "P-5", "P-6", "P-7", "P-8"];

function today() { return new Date().toISOString().split("T")[0]; }

function fmtDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function smartSort(arr) {
  return [...arr].sort((a, b) => {
    const aNum = parseInt(a), bNum = parseInt(b);
    const aIsNum = !isNaN(aNum) && String(aNum) === String(a);
    const bIsNum = !isNaN(bNum) && String(bNum) === String(b);
    if (aIsNum && bIsNum) return aNum - bNum;
    if (aIsNum) return -1;
    if (bIsNum) return 1;
    return a.localeCompare(b);
  });
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <Splash />;
  if (!user) return <Login />;
  return <Dashboard />;
}

function Splash() {
  return <div className="splash"><span className="logo-mark">AM</span></div>;
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true); setErr("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (e) {
      setErr("Wrong email or password.");
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <span className="logo-mark sm">AM</span>
          <h1>AttendMark</h1>
        </div>
        <p className="subtitle">Teacher access only</p>
        <input placeholder="Email" type="email" value={email} autoComplete="email"
          onChange={e => setEmail(e.target.value)} />
        <input placeholder="Password" type="password" value={pass} autoComplete="current-password"
          onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && signIn()} />
        {err && <p className="err-msg">{err}</p>}
        <button className="btn-primary" onClick={signIn} disabled={busy}>
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard() {
  const [tab, setTab] = useState("mark");
  return (
    <div className="shell">
      <header>
        <span className="logo">AttendMark</span>
        <button className="btn-ghost sm" onClick={() => signOut(auth)}>Sign out</button>
      </header>
      <nav>
        {[["mark", "✏️  Mark"], ["history", "🗂  History"], ["students", "👥  Students"]].map(([v, l]) => (
          <button key={v} className={`nav-btn ${tab === v ? "active" : ""}`}
            onClick={() => setTab(v)}>{l}</button>
        ))}
      </nav>
      <main>
        {tab === "mark" && <MarkTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "students" && <StudentsTab />}
      </main>
    </div>
  );
}

// ── Mark Attendance ───────────────────────────────────────────────────────────
function MarkTab() {
  const [date, setDate] = useState(today());
  const [period, setPeriod] = useState("P-1");
  const [students, setStudents] = useState([]);
  const [absent, setAbsent] = useState(new Set());
  const [status, setStatus] = useState("idle");
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadStudents(); }, []);

  async function loadStudents() {
    const snap = await getDocs(collection(db, "students"));
    const nums = snap.docs.map(d => d.id);
    setStudents(smartSort(nums));
  }

  function toggle(num) {
    setAbsent(prev => {
      const next = new Set(prev);
      next.has(num) ? next.delete(num) : next.add(num);
      return next;
    });
    setStatus("idle"); setOutput("");
  }

  function reset() { setAbsent(new Set()); setStatus("idle"); setOutput(""); }

  async function save() {
    if (!students.length) { alert("Add students first in the Students tab."); return; }
    setStatus("saving");

    // Delete existing records for this date + period
    const q = query(
      collection(db, "attendance"),
      where("date", "==", date),
      where("period", "==", period)
    );
    const existing = await getDocs(q);
    await Promise.all(existing.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));

    // Insert new absent records
    if (absent.size > 0) {
      await Promise.all([...absent].map(num =>
        addDoc(collection(db, "attendance"), {
          date,
          period,
          student_number: num,
          created_at: new Date().toISOString(),
        })
      ));
    }

    const list = smartSort([...absent]).join(", ");
    setOutput(`${fmtDate(date)}    ${period}\n${list || "No absences"}`);
    setStatus("saved");
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="view">
      <section className="card">
        <div className="control-row">
          <label>Date</label>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); reset(); }} />
        </div>
        <div className="control-row">
          <label>Period</label>
          <select value={period} onChange={e => { setPeriod(e.target.value); reset(); }}>
            {PERIODS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </section>

      <section className="card student-list">
        <h2>
          Students
          {absent.size > 0 && <span className="badge red">{absent.size} absent</span>}
        </h2>
        {!students.length
          ? <p className="empty">No students yet — add them in the Students tab.</p>
          : students.map(num => (
            <label key={num} className={`student-row ${absent.has(num) ? "absent" : ""}`}>
              <span className="student-num">{num}</span>
              <div className="row-right">
                {absent.has(num) && <span className="absent-tag">Absent</span>}
                <input type="checkbox" checked={absent.has(num)} onChange={() => toggle(num)} />
              </div>
            </label>
          ))
        }
      </section>

      <button
        className={`btn-primary save-btn ${status === "saved" ? "saved" : ""}`}
        onClick={save}
        disabled={status === "saving" || status === "saved"}
      >
        {status === "saving" ? "Saving…" : status === "saved" ? "✓ Saved" : "Save Attendance"}
      </button>

      {output && (
        <section className="card output-card">
          <h2>Output</h2>
          <pre className="output-box">{output}</pre>
          <button className="btn-copy" onClick={copy}>{copied ? "✓ Copied!" : "Copy"}</button>
        </section>
      )}
    </div>
  );
}

// ── History ───────────────────────────────────────────────────────────────────
function HistoryTab() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    let q = query(collection(db, "attendance"), orderBy("date", "desc"), orderBy("period"));
    const snap = await getDocs(q);
    let all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (filterDate) all = all.filter(r => r.date === filterDate);
    if (filterPeriod) all = all.filter(r => r.period === filterPeriod);
    setRecords(all);
    setLoading(false);
  }

  const grouped = Object.values(
    records.reduce((acc, r) => {
      const key = `${r.date}||${r.period}`;
      if (!acc[key]) acc[key] = { date: r.date, period: r.period, nums: [] };
      acc[key].nums.push(r.student_number);
      return acc;
    }, {})
  );

  async function copyEntry(g) {
    const list = smartSort(g.nums).join(", ");
    await navigator.clipboard.writeText(`${fmtDate(g.date)}    ${g.period}\n${list || "No absences"}`);
    setCopied(`${g.date}${g.period}`);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <div className="view">
      <section className="card">
        <div className="control-row">
          <label>Date</label>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        </div>
        <div className="control-row">
          <label>Period</label>
          <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
            <option value="">All</option>
            {PERIODS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <button className="btn-secondary full" onClick={load}>Search</button>
      </section>

      {loading
        ? <p className="empty">Loading…</p>
        : !grouped.length
          ? <p className="empty">No records found.</p>
          : grouped.map(g => {
            const key = `${g.date}${g.period}`;
            const list = smartSort(g.nums).join(", ");
            return (
              <div key={key} className="card history-entry">
                <div className="hist-top">
                  <span className="hist-date">{fmtDate(g.date)}</span>
                  <span className="badge">{g.period}</span>
                  <button className="btn-ghost sm ml-auto" onClick={() => copyEntry(g)}>
                    {copied === key ? "✓" : "Copy"}
                  </button>
                </div>
                <pre className="hist-list">{list || "No absences"}</pre>
              </div>
            );
          })
      }
    </div>
  );
}

// ── Students ──────────────────────────────────────────────────────────────────
function StudentsTab() {
  const [students, setStudents] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const snap = await getDocs(collection(db, "students"));
    const nums = snap.docs.map(d => d.id);
    setStudents(smartSort(nums));
    setLoading(false);
  }

  async function add() {
    const tokens = input.split(/[\s,]+/).map(n => n.trim()).filter(n => n.length > 0);
    if (!tokens.length) return;
    await Promise.all(tokens.map(n => setDoc(doc(db, "students", n), { number: n })));
    setInput(""); load();
  }

  async function remove(num) {
    if (!confirm(`Remove student #${num}?`)) return;
    await deleteDoc(doc(db, "students", num));
    load();
  }

  async function removeAll() {
    if (!confirm("Remove ALL students? This cannot be undone.")) return;
    const snap = await getDocs(collection(db, "students"));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "students", d.id))));
    load();
  }

  return (
    <div className="view">
      <section className="card">
        <h2>Add Students</h2>
        <p className="hint">Enter numbers separated by commas or spaces</p>
        <textarea rows={3} placeholder="e.g.  1, 2, 3, 45, le01"
          value={input} onChange={e => setInput(e.target.value)} />
        <button className="btn-primary" onClick={add}>Add</button>
      </section>

      <section className="card">
        <h2>
          All Students <span className="badge">{students.length}</span>
          {students.length > 0 &&
            <button className="btn-ghost sm ml-auto danger" onClick={removeAll}>Clear all</button>}
        </h2>
        {loading ? <p className="empty">Loading…</p>
          : !students.length ? <p className="empty">No students yet.</p>
            : <div className="chip-grid">
              {students.map(num => (
                <div key={num} className="chip">
                  <span>{num}</span>
                  <button onClick={() => remove(num)}>×</button>
                </div>
              ))}
            </div>
        }
      </section>
    </div>
  );
}
