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
  deleteDoc,
  doc,
  setDoc,
} from "firebase/firestore";

// ── Replace with your Firebase project config ─────────────────────────────────
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
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
        {tab === "mark"     && <MarkTab />}
        {tab === "history"  && <HistoryTab />}
        {tab === "students" && <StudentsTab />}
      </main>
    </div>
  );
}

// ── Mark Attendance ───────────────────────────────────────────────────────────
function MarkTab() {
  const [date, setDate]     = useState(today());
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

    // Store as one document per date+period — organized and clean
    const docId = `${date}_${period}`;
    const absentList = smartSort([...absent]);
    try {
      await setDoc(doc(db, "attendance", docId), {
        date,
        period,
        absent: absentList,
        created_at: new Date().toISOString(),
      });
      const list = absentList.join(", ");
      setOutput(`${fmtDate(date)}    ${period}\n${list || "No absences"}`);
      setStatus("saved");
    } catch (e) {
      alert("Save failed: " + e.message);
      setStatus("idle");
    }
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
  const [record, setRecord]     = useState(null);   // single result
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [filterDate, setFilterDate]     = useState("");
  const [filterPeriod, setFilterPeriod] = useState("");
  const [copied, setCopied] = useState(false);

  async function search() {
    if (!filterDate || !filterPeriod) {
      alert("Please select both a date and a period to search.");
      return;
    }
    setLoading(true);
    setSearched(false);
    setRecord(null);
    try {
      // Document ID is always date_period e.g. 2026-03-04_P-1
      const { getDoc } = await import("firebase/firestore");
      const snap = await getDoc(doc(db, "attendance", `${filterDate}_${filterPeriod}`));
      if (snap.exists()) {
        setRecord({ id: snap.id, ...snap.data() });
      } else {
        setRecord(null);
      }
    } catch(e) {
      alert("Search failed: " + e.message);
    }
    setSearched(true);
    setLoading(false);
  }

  async function copy() {
    if (!record) return;
    const list = smartSort(record.absent || []).join(", ");
    await navigator.clipboard.writeText(
      `${fmtDate(record.date)}    ${record.period}\n${list || "No absences"}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="view">
      <section className="card">
        <div className="control-row">
          <label>Date</label>
          <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setSearched(false); setRecord(null); }} />
        </div>
        <div className="control-row">
          <label>Period</label>
          <select value={filterPeriod} onChange={e => { setFilterPeriod(e.target.value); setSearched(false); setRecord(null); }}>
            <option value="">Select</option>
            {PERIODS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
        <button className="btn-secondary full" onClick={search}>Search</button>
      </section>

      {loading && <p className="empty">Searching…</p>}

      {!loading && searched && !record && (
        <p className="empty">No attendance record found for this date and period.</p>
      )}

      {!loading && record && (() => {
        const list = smartSort(record.absent || []).join(", ");
        return (
          <section className="card output-card">
            <h2>Result</h2>
            <pre className="output-box">{`${fmtDate(record.date)}    ${record.period}\n${list || "No absences"}`}</pre>
            <button className="btn-copy" onClick={copy}>{copied ? "✓ Copied!" : "Copy"}</button>
          </section>
        );
      })()}
    </div>
  );
}

// ── Students ──────────────────────────────────────────────────────────────────
function StudentsTab() {
  const [students, setStudents] = useState([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(true);

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
