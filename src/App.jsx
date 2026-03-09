import { useState, useMemo, createContext, useContext } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CERT_LEVELS  = ["None", "RO-P", "RO", "CRO", "RM", "Admin"];
const SYSTEM_ROLES = ["member", "rm", "admin"];
// Points per match role. MD and RM are separate when the match has distinct people;
// MD/RM combined is used at small local matches where one person fills both roles.
// RO-P (Provisional) earns the same points as a full RO while working towards upgrade.
const POINT_RULES  = { "RO-P": 1, RO: 1, CRO: 2, RM: 3, MD: 3, "MD/RM": 4 };

// Default subregions — seeded with IPSC Norway's official subregions.
// Stored in app state and fully manageable by admins at runtime, so any
// other IPSC Region (nation) can replace or extend the list without code changes.
const DEFAULT_REGIONS = [
  "Nord", "Midt", "Nord-Vest", "Bergen", "Sør-Vest",
  "Sør", "Viken-Vest", "Oslo", "Viken-Øst", "Innlandet",
];

// ─────────────────────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────────────────────

// Seminar seed data and per-user seminar history are declared first because
// seedUsers references userSeminarHistory directly.

const seedSeminars = [
  {
    id: "s1", name: "IROA Level I — Oslo Spring 2024",
    date: "2024-04-20", location: "Oslomarka Skytterlag", type: "Level I",
    instructor: "u1", status: "completed",
    enrollments: [
      { userId:"u3", attended:true, graduated:true,  diplomaVerified:true,  diplomaDate:"2024-04-20" },
      { userId:"u5", attended:true, graduated:true,  diplomaVerified:true,  diplomaDate:"2024-04-20" },
      { userId:"u2", attended:true, graduated:true,  diplomaVerified:true,  diplomaDate:"2024-04-20" },
    ]
  },
  {
    id: "s2", name: "IROA Level I — Bergen Autumn 2024",
    date: "2024-09-14", location: "Bergen Sportsskyttere", type: "Level I",
    instructor: "u4", status: "completed",
    enrollments: [
      { userId:"u4", attended:true, graduated:true,  diplomaVerified:true,  diplomaDate:"2024-09-14" },
      { userId:"u6", attended:true, graduated:true,  diplomaVerified:true,  diplomaDate:"2024-09-14" },
    ]
  },
  {
    id: "s3", name: "IROA Level I — Viken Winter 2026",
    date: "2026-02-08", location: "Drammen Pistolklubb", type: "Level I",
    instructor: "u1", status: "completed",
    enrollments: []
  },
  {
    id: "s4", name: "IROA Level I — Oslo Summer 2026",
    date: "2026-06-15", location: "Oslomarka Skytterlag", type: "Level I",
    instructor: "u1", status: "upcoming",
    enrollments: []
  },
];

// Per-user seminar graduation snapshots — stored on the user for fast checklist
// access. Format: { seminarId, type, graduated, diplomaVerified, diplomaDate }
const userSeminarHistory = {
  u1: [],   // Erik is instructor, not student
  u2: [{ seminarId:"s1", type:"Level I", graduated:true, diplomaVerified:true, diplomaDate:"2024-04-20" }],
  u3: [{ seminarId:"s1", type:"Level I", graduated:true, diplomaVerified:true, diplomaDate:"2024-04-20" }],
  u4: [{ seminarId:"s2", type:"Level I", graduated:true, diplomaVerified:true, diplomaDate:"2024-09-14" }],
  u5: [{ seminarId:"s1", type:"Level I", graduated:true, diplomaVerified:true, diplomaDate:"2024-04-20" }],
  u6: [{ seminarId:"s2", type:"Level I", graduated:true, diplomaVerified:true, diplomaDate:"2024-09-14" }],
};

const seedUsers = [
  {
    id: "u1", name: "Erik Haugen",  email: "erik@example.com",  password: "pass1",
    role: "admin", certification: "RM",  region: "Oslo",    joined: "2021-03-15",
    active: true, points: 28, notes: "Level 3 certified",
    profilePhotoApproved: true, lastROApplication: null,
    iroa: { member: true, since: "2022-01-10" },
    seminarHistory: userSeminarHistory.u1,
    certHistory: [
      { cert: "RO-P", grantedBy: "System",      date: "2021-03-15", note: "Founding member" },
      { cert: "RO",   grantedBy: "System",      date: "2021-06-01", note: "" },
      { cert: "CRO",  grantedBy: "System",      date: "2021-09-01", note: "" },
      { cert: "RM",   grantedBy: "System",      date: "2022-06-10", note: "Passed Level 3 exam" },
    ]
  },
  {
    id: "u2", name: "Marte Lund",   email: "marte@example.com", password: "pass2",
    role: "rm",    certification: "CRO", region: "Bergen",  joined: "2022-07-01",
    active: true, points: 14, notes: "",
    profilePhotoApproved: true, lastROApplication: null,
    iroa: { member: true, since: "2023-05-20" },
    seminarHistory: userSeminarHistory.u2,
    certHistory: [
      { cert: "RO-P", grantedBy: "Erik Haugen", date: "2022-07-01", note: "" },
      { cert: "RO",   grantedBy: "Erik Haugen", date: "2022-11-15", note: "" },
      { cert: "CRO",  grantedBy: "Erik Haugen", date: "2023-03-15", note: "" },
    ]
  },
  {
    id: "u3", name: "Jonas Berg",   email: "jonas@example.com", password: "pass3",
    role: "member", certification: "RO", region: "Oslo",   joined: "2023-02-20",
    active: true, points: 7, notes: "New shooter background",
    profilePhotoApproved: true, lastROApplication: "2025-09-01",
    iroa: { member: false, since: null },
    seminarHistory: userSeminarHistory.u3,
    certHistory: [
      { cert: "RO-P", grantedBy: "Erik Haugen", date: "2023-02-20", note: "Passed intro course" },
      { cert: "RO",   grantedBy: "Erik Haugen", date: "2023-08-10", note: "" },
    ]
  },
  {
    id: "u4", name: "Silje Dahl",   email: "silje@example.com", password: "pass4",
    role: "rm",    certification: "CRO", region: "Nord",   joined: "2020-11-05",
    active: true, points: 22, notes: "",
    profilePhotoApproved: true, lastROApplication: null,
    iroa: { member: false, since: null },
    seminarHistory: userSeminarHistory.u4,
    certHistory: [
      { cert: "RO-P", grantedBy: "System",      date: "2020-11-05", note: "" },
      { cert: "RO",   grantedBy: "System",      date: "2021-02-20", note: "" },
      { cert: "CRO",  grantedBy: "System",      date: "2021-05-20", note: "" },
    ]
  },
  {
    id: "u5", name: "Lars Vik",     email: "lars@example.com",  password: "pass5",
    role: "member", certification: "RO-P", region: "Bergen", joined: "2023-09-10",
    active: true, points: 5, notes: "USPSA background",
    profilePhotoApproved: false, lastROApplication: null,
    iroa: { member: false, since: null },
    seminarHistory: userSeminarHistory.u5,
    certHistory: [
      { cert: "RO-P", grantedBy: "Marte Lund",  date: "2023-09-10", note: "" },
    ]
  },
  {
    id: "u6", name: "Anna Solberg", email: "anna@example.com",  password: "pass6",
    role: "admin", certification: "RM",  region: "Oslo",   joined: "2019-06-22",
    active: false, points: 31, notes: "On leave",
    profilePhotoApproved: true, lastROApplication: null,
    iroa: { member: true, since: "2020-03-01" },
    seminarHistory: userSeminarHistory.u6,
    certHistory: [
      { cert: "RO-P", grantedBy: "System",      date: "2019-06-22", note: "" },
      { cert: "RO",   grantedBy: "System",      date: "2019-10-15", note: "" },
      { cert: "CRO",  grantedBy: "System",      date: "2019-12-01", note: "" },
      { cert: "RM",   grantedBy: "System",      date: "2020-08-15", note: "" },
    ]
  },
];

const seedMatches = [
  {
    // Small local match — one person is both MD and RM
    id: "m1", name: "Oslo Club Match #12", date: "2025-11-15", region: "Oslo",
    level: "Level I", stages: 6, status: "completed",
    combinedMDRM: true, md: "u1", rm: "u1",
    assignments: [
      { roId: "u1", role: "MD/RM", stages: [1,2], pointsAwarded: 4 },
      { roId: "u2", role: "CRO",   stages: [3,4], pointsAwarded: 2 },
      { roId: "u3", role: "RO",    stages: [5,6], pointsAwarded: 1 },
    ]
  },
  {
    // Larger regional — separate MD and RM
    id: "m2", name: "Bergen Regional 2025", date: "2025-12-01", region: "Bergen",
    level: "Level II", stages: 12, status: "completed",
    combinedMDRM: false, md: "u4", rm: "u1",
    assignments: [
      { roId: "u4", role: "MD",  stages: [],    pointsAwarded: 3 },
      { roId: "u1", role: "RM",  stages: [],    pointsAwarded: 3 },
      { roId: "u2", role: "CRO", stages: [1,2], pointsAwarded: 2 },
      { roId: "u5", role: "RO",  stages: [3,4], pointsAwarded: 1 },
      { roId: "u3", role: "RO",  stages: [5,6], pointsAwarded: 1 },
    ]
  },
  {
    id: "m3", name: "Oslo Winter League #1", date: "2026-01-18", region: "Oslo",
    level: "Level I", stages: 6, status: "upcoming",
    combinedMDRM: true, md: "u1", rm: "u1",
    assignments: []
  },
];

const AuthCtx = createContext(null);
function useAuth() { return useContext(AuthCtx); }

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function uid() { return "u" + Math.random().toString(36).slice(2, 9); }

function certColor(c) {
  return { "RO-P":"#86efac", RO:"#4ade80", CRO:"#facc15", RM:"#f97316", MD:"#e85d2c", Admin:"#c084fc", "MD/RM":"#fb923c", None:"#475569" }[c] || "#9ca3af";
}
function roleColor(r) {
  return { admin:"#c084fc", rm:"#f97316", member:"#60a5fa" }[r] || "#9ca3af";
}
function statusColor(s) {
  return { upcoming:"#60a5fa", active:"#4ade80", completed:"#6b7280" }[s] || "#9ca3af";
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
}
function certRank(c) { return { None:0, "RO-P":1, RO:2, CRO:3, RM:4, Admin:5 }[c] || 0; }
function canManageMatches(u) { return u && (u.role === "rm" || u.role === "admin"); }
function isAdmin(u) { return u && u.role === "admin"; }

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────────────────────────────────────

function Badge({ label, color }) {
  return (
    <span style={{
      display:"inline-block", padding:"2px 9px", borderRadius:3, fontSize:11,
      fontWeight:700, letterSpacing:"0.07em", textTransform:"uppercase",
      background:color+"22", color, border:`1px solid ${color}55`
    }}>{label}</span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{ background:"#111418", border:"1px solid #1e2530", borderRadius:8, padding:"18px 22px", minWidth:120, flex:1 }}>
      <div style={{ fontSize:28, fontWeight:800, color:accent||"#e2e8f0", fontFamily:"'Barlow Condensed',sans-serif" }}>{value}</div>
      <div style={{ fontSize:12, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.07em", marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:"#475569", marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:1000,
      display:"flex", alignItems:"center", justifyContent:"center", padding:20
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:"#0d1117", border:"1px solid #1e2530", borderRadius:12,
        width:"100%", maxWidth:wide?820:640, maxHeight:"91vh", overflowY:"auto",
        boxShadow:"0 24px 80px rgba(0,0,0,0.85)"
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 26px", borderBottom:"1px solid #1e2530" }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:"#e2e8f0", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"0.04em" }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:22, lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:"26px" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", fontSize:11, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize:11, color:"#475569", marginTop:4 }}>{hint}</div>}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid #131922", fontSize:13 }}>
      <span style={{ color:"#475569" }}>{label}</span>
      <span style={{ color:"#cbd5e1", fontWeight:500 }}>{value}</span>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, margin:"20px 0" }}>
      <div style={{ flex:1, height:1, background:"#1e2530" }} />
      {label && <span style={{ color:"#475569", fontSize:11, textTransform:"uppercase", letterSpacing:"0.09em" }}>{label}</span>}
      <div style={{ flex:1, height:1, background:"#1e2530" }} />
    </div>
  );
}

// RegionSelect — dropdown built from the live regions list.
// Shows an "Other / free text" escape so users can still type a custom value
// if their region isn't in the list yet. Admins can permanently add new
// regions via the User Database → Region Settings panel.
function RegionSelect({ value, onChange, regions, placeholder = "— Select district —", style }) {
  const knownRegion = !value || regions.includes(value);
  const [showCustom, setShowCustom] = useState(!knownRegion && !!value);

  function handleSelect(e) {
    if (e.target.value === "__other__") {
      setShowCustom(true);
      onChange("");
    } else {
      setShowCustom(false);
      onChange(e.target.value);
    }
  }

  if (showCustom) {
    return (
      <div style={{ display:"flex", gap:8 }}>
        <input
          style={{ ...inp, ...(style||{}), flex:1 }}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Type district name…"
          autoFocus
        />
        <button
          onClick={() => { setShowCustom(false); onChange(""); }}
          style={{ ...btnS, padding:"9px 12px", fontSize:12, whiteSpace:"nowrap" }}
        >↩ List</button>
      </div>
    );
  }

  return (
    <select
      style={{ ...inp, ...(style||{}) }}
      value={regions.includes(value) ? value : ""}
      onChange={handleSelect}
    >
      <option value="">{placeholder}</option>
      {[...regions].sort().map(r => <option key={r} value={r}>{r}</option>)}
      <option value="__other__">Other / not listed…</option>
    </select>
  );
}

const inp = {
  width:"100%", boxSizing:"border-box", background:"#111418", border:"1px solid #2a3441",
  borderRadius:6, padding:"9px 12px", color:"#e2e8f0", fontSize:14, outline:"none", fontFamily:"inherit"
};
const btnP = { background:"#e85d2c", border:"none", borderRadius:6, color:"#fff", padding:"10px 20px", fontSize:14, fontWeight:700, cursor:"pointer", letterSpacing:"0.04em" };
const btnS = { background:"#1e2530", border:"1px solid #2a3441", borderRadius:6, color:"#94a3b8", padding:"10px 20px", fontSize:14, fontWeight:600, cursor:"pointer" };
const btnD = { background:"#2a1515", border:"1px solid #4a2020", borderRadius:6, color:"#f87171", padding:"10px 20px", fontSize:14, fontWeight:600, cursor:"pointer" };

// ─────────────────────────────────────────────────────────────────────────────
// AUTH SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function AuthScreen({ users, setUsers, onLogin, regions }) {
  const [mode, setMode]   = useState("login");
  const [form, setForm]   = useState({ name:"", email:"", password:"", confirm:"", region:"" });
  const [error, setError] = useState("");

  const f = k => e => { setForm(p => ({...p,[k]:e.target.value})); setError(""); };

  function login() {
    const user = users.find(u => u.email.toLowerCase() === form.email.toLowerCase() && u.password === form.password);
    if (!user)        { setError("Invalid email or password."); return; }
    if (!user.active) { setError("Account deactivated. Contact an administrator."); return; }
    onLogin(user);
  }

  function register() {
    if (!form.name.trim() || !form.email.trim() || !form.password) { setError("Name, email and password are required."); return; }
    if (form.password !== form.confirm)  { setError("Passwords do not match."); return; }
    if (form.password.length < 4)        { setError("Password must be at least 4 characters."); return; }
    if (users.find(u => u.email.toLowerCase() === form.email.toLowerCase())) { setError("Email already registered."); return; }
    const nu = {
      id:uid(), name:form.name.trim(), email:form.email.trim(), password:form.password,
      role:"member", certification:"None", region:form.region.trim(),
      joined:new Date().toISOString().slice(0,10), active:true, points:0, notes:"",
      iroa: { member: false, since: null },
      profilePhotoApproved: false, lastROApplication: null,
      seminarHistory: [],
      certHistory:[]
    };
    setUsers(prev => [...prev, nu]);
    onLogin(nu);
  }

  return (
    <div style={{ minHeight:"100vh", background:"#080c10", display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"Inter,sans-serif" }}>
      <div style={{ position:"fixed", top:"-15%", right:"-8%", width:480, height:480, borderRadius:"50%", background:"radial-gradient(circle,#e85d2c16 0%,transparent 70%)", pointerEvents:"none" }} />
      <div style={{ position:"fixed", bottom:"-15%", left:"-8%", width:380, height:380, borderRadius:"50%", background:"radial-gradient(circle,#60a5fa0d 0%,transparent 70%)", pointerEvents:"none" }} />
      <div style={{ width:"100%", maxWidth:430 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:60, height:60, background:"#e85d2c", borderRadius:16, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:30, marginBottom:18 }}>🎯</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:30, fontWeight:800, color:"#e2e8f0", letterSpacing:"0.05em" }}>IPSC RO Manager</div>
          <div style={{ fontSize:13, color:"#475569", marginTop:4 }}>Range Officer Management System</div>
        </div>

        <div style={{ background:"#0d1117", border:"1px solid #1e2530", borderRadius:14, padding:34, boxShadow:"0 24px 70px rgba(0,0,0,0.65)" }}>
          {/* Tab */}
          <div style={{ display:"flex", background:"#111418", borderRadius:9, padding:4, marginBottom:28 }}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
                flex:1, padding:"9px", border:"none", borderRadius:6, cursor:"pointer", fontSize:14, fontWeight:600,
                background:mode===m?"#e85d2c":"transparent", color:mode===m?"#fff":"#64748b", transition:"all 0.15s"
              }}>{m==="login"?"Sign In":"Register"}</button>
            ))}
          </div>

          {error && <div style={{ background:"#2a1515", border:"1px solid #4a2020", borderRadius:7, padding:"10px 14px", color:"#f87171", fontSize:13, marginBottom:18 }}>{error}</div>}

          {mode === "login" ? (
            <>
              <Field label="Email"><input style={inp} type="email" value={form.email} onChange={f("email")} placeholder="your@email.com" onKeyDown={e=>e.key==="Enter"&&login()} /></Field>
              <Field label="Password"><input style={inp} type="password" value={form.password} onChange={f("password")} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&login()} /></Field>
              <button style={{...btnP,width:"100%",padding:"12px",marginTop:4}} onClick={login}>Sign In</button>
              <Divider label="demo accounts" />
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {[
                  { label:"Admin",  email:"erik@example.com",  pass:"pass1", role:"admin"  },
                  { label:"RM",     email:"marte@example.com", pass:"pass2", role:"rm"     },
                  { label:"Member", email:"jonas@example.com", pass:"pass3", role:"member" },
                ].map(d => (
                  <button key={d.email} onClick={() => { setForm(p=>({...p,email:d.email,password:d.pass})); setError(""); }}
                    style={{...btnS,padding:"8px 14px",fontSize:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{color:"#94a3b8"}}>{d.label}: {d.email} / {d.pass}</span>
                    <Badge label={d.role} color={roleColor(d.role)} />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <Field label="Full Name"><input style={inp} value={form.name} onChange={f("name")} placeholder="Your full name" /></Field>
              <Field label="Email"><input style={inp} type="email" value={form.email} onChange={f("email")} placeholder="your@email.com" /></Field>
              <Field label="District (optional)">
                <RegionSelect value={form.region} onChange={v=>setForm(p=>({...p,region:v}))} regions={regions} placeholder="— Select your district —" />
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Password"><input style={inp} type="password" value={form.password} onChange={f("password")} placeholder="Min. 4 chars" /></Field>
                <Field label="Confirm"><input style={inp} type="password" value={form.confirm} onChange={f("confirm")} placeholder="Repeat" onKeyDown={e=>e.key==="Enter"&&register()} /></Field>
              </div>
              <div style={{ background:"#111418", border:"1px solid #1e2530", borderRadius:7, padding:"11px 14px", fontSize:12, color:"#475569", marginBottom:16 }}>
                New accounts start as <Badge label="member" color="#60a5fa" /> with <Badge label="No Cert" color="#475569" />. An admin must grant your RO certification before you can be assigned to matches.
              </div>
              <button style={{...btnP,width:"100%",padding:"12px"}} onClick={register}>Create Account</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

function Dashboard({ users, matches, seminars }) {
  const activeUsers     = users.filter(u=>u.active).length;
  const certifiedROs    = users.filter(u=>u.certification!=="None"&&u.active).length;
  const upcomingMatches = matches.filter(m=>m.status==="upcoming").length;
  const completedMatches= matches.filter(m=>m.status==="completed").length;
  const totalPoints     = users.reduce((s,u)=>s+u.points,0);
  const certBreakdown   = ["RO-P","RO","CRO","RM"].map(c=>({ cert:c, count:users.filter(u=>u.certification===c&&u.active).length })).filter(x=>x.count>0);
  const upcomingSeminars= (seminars||[]).filter(s=>s.status==="upcoming").length;
  const recentMatches   = [...matches].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5);

  return (
    <div>
      <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 4px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.03em",color:"#e2e8f0"}}>Dashboard</h1>
      <p style={{color:"#475569",marginBottom:28,fontSize:14}}>System-wide overview</p>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:28}}>
        <StatCard label="Registered Users"  value={users.length}    sub={`${activeUsers} active`}  accent="#4ade80" />
        <StatCard label="Certified ROs"     value={certifiedROs}    accent="#facc15" />
        <StatCard label="Upcoming Matches"  value={upcomingMatches} accent="#60a5fa" />
        <StatCard label="Completed Matches" value={completedMatches}accent="#6b7280" />
        <StatCard label="Seminars Scheduled"value={upcomingSeminars}accent="#38bdf8" />
        <StatCard label="Total Points"      value={totalPoints}     accent="#e85d2c" />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:20}}>
          <h3 style={{margin:"0 0 16px",fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Certification Breakdown</h3>
          {certBreakdown.map(({cert,count})=>(
            <div key={cert} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <Badge label={cert} color={certColor(cert)} />
              <div style={{flex:1,background:"#1e2530",borderRadius:4,height:6,overflow:"hidden"}}>
                <div style={{width:`${(count/(certifiedROs||1))*100}%`,background:certColor(cert),height:"100%",borderRadius:4}} />
              </div>
              <span style={{color:"#94a3b8",fontSize:13,fontWeight:600,minWidth:20}}>{count}</span>
            </div>
          ))}
        </div>
        <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:20}}>
          <h3 style={{margin:"0 0 16px",fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Points Leaderboard</h3>
          {[...users].filter(u=>u.active).sort((a,b)=>b.points-a.points).slice(0,6).map((u,i)=>(
            <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:11,color:i<3?"#facc15":"#475569",fontWeight:700,minWidth:20}}>#{i+1}</span>
              <span style={{flex:1,color:"#cbd5e1",fontSize:14}}>{u.name}</span>
              <Badge label={u.certification||"None"} color={certColor(u.certification)} />
              <span style={{color:"#e85d2c",fontWeight:800,fontSize:15,fontFamily:"'Barlow Condensed',sans-serif",minWidth:28,textAlign:"right"}}>{u.points}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:20}}>
        <h3 style={{margin:"0 0 16px",fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Recent Matches</h3>
        {recentMatches.map(m=>{
          const mdUser=users.find(u=>u.id===m.md);
          const rmUser=users.find(u=>u.id===m.rm);
          const staffStr = m.combinedMDRM
            ? `MD/RM: ${mdUser?.name||"—"}`
            : `MD: ${mdUser?.name||"—"} · RM: ${rmUser?.name||"—"}`;
          return (
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 0",borderBottom:"1px solid #1a2030"}}>
              <Badge label={m.status} color={statusColor(m.status)} />
              <div style={{flex:1}}>
                <div style={{color:"#e2e8f0",fontWeight:600,fontSize:14}}>{m.name}</div>
                <div style={{color:"#475569",fontSize:12,marginTop:2}}>{fmtDate(m.date)} · {m.region} · {m.stages} stages · {staffStr}</div>
              </div>
              <Badge label={m.level} color="#7c8cf8" />
              <span style={{color:"#64748b",fontSize:12}}>{m.assignments.length} ROs</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MY PROFILE
// ─────────────────────────────────────────────────────────────────────────────

function MyProfile({ users, setUsers, matches, seminars, regions }) {
  const { currentUser, setCurrentUser } = useAuth();
  const user = users.find(u=>u.id===currentUser.id) || currentUser;

  const [editMode,  setEditMode]  = useState(false);
  const [form,      setForm]      = useState({ name:user.name, region:user.region, notes:user.notes, email:user.email, iroa: user.iroa || { member:false, since:null } });
  const [pwForm,    setPwForm]    = useState({ current:"", next:"", confirm:"" });
  const [pwError,   setPwError]   = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [applyMsg,  setApplyMsg]  = useState("");

  const myMatches = useMemo(() =>
    matches.filter(m=>m.assignments.some(a=>a.roId===user.id))
      .map(m=>({...m, assignment:m.assignments.find(a=>a.roId===user.id)}))
  ,[matches,user.id]);

  // Seminar history for this user
  const mySeminars = useMemo(()=>{
    return (seminars||[]).filter(s=>s.enrollments.some(e=>e.userId===user.id))
      .map(s=>({ ...s, enrollment:s.enrollments.find(e=>e.userId===user.id) }));
  },[seminars,user.id]);

  function saveProfile() {
    if (!form.name.trim()) return;
    const upd = {...user,name:form.name.trim(),region:form.region.trim(),notes:form.notes,email:form.email.trim(),iroa:form.iroa};
    setUsers(prev=>prev.map(u=>u.id===user.id?upd:u));
    setCurrentUser(upd); setEditMode(false);
  }

  function changePw() {
    setPwError(""); setPwSuccess(false);
    if (pwForm.current!==user.password) { setPwError("Current password is incorrect."); return; }
    if (pwForm.next.length<4)           { setPwError("New password must be at least 4 characters."); return; }
    if (pwForm.next!==pwForm.confirm)   { setPwError("New passwords do not match."); return; }
    setUsers(prev=>prev.map(u=>u.id===user.id?{...u,password:pwForm.next}:u));
    setPwForm({current:"",next:"",confirm:""}); setPwSuccess(true);
  }

  const pf = k => e => setPwForm(p=>({...p,[k]:e.target.value}));

  function applyForRO() {
    const today = new Date().toISOString().slice(0,10);
    setUsers(prev=>prev.map(u=>u.id===user.id?{...u,lastROApplication:today}:u));
    setApplyMsg("Your application has been submitted. An administrator will review your checklist and upgrade your certification when all requirements are met.");
  }

  return (
    <div>
      <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 4px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.03em",color:"#e2e8f0"}}>My Profile</h1>
      <p style={{color:"#475569",marginBottom:28,fontSize:14}}>Your account, certifications and match history</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        {/* Left */}
        <div>
          <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:24,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
              <div style={{width:54,height:54,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0}}>{user.name.charAt(0)}</div>
              <div>
                <div style={{fontSize:18,fontWeight:700,color:"#e2e8f0"}}>{user.name}</div>
                <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                  <Badge label={user.role}                  color={roleColor(user.role)} />
                  <Badge label={user.certification||"No Cert"} color={certColor(user.certification)} />
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginBottom:20}}>
              <StatCard label="Points"  value={user.points}       accent="#e85d2c" />
              <StatCard label="Matches" value={myMatches.length}  accent="#60a5fa" />
            </div>
            {!editMode ? (
              <>
                <InfoRow label="Email"    value={user.email} />
                <InfoRow label="District" value={user.region||"—"} />
                <InfoRow label="Joined"   value={fmtDate(user.joined)} />
                <InfoRow label="IROA Member" value={
                  user.iroa?.member
                    ? <span>Yes {user.iroa.since ? <span style={{color:"#475569",fontSize:12}}>since {fmtDate(user.iroa.since)}</span> : ""}</span>
                    : "No"
                } />
                {user.notes&&<InfoRow label="Notes" value={user.notes}/>}
                <button style={{...btnS,marginTop:14}} onClick={()=>setEditMode(true)}>Edit Profile</button>
              </>
            ) : (
              <>
                <Field label="Full Name"><input style={inp} value={form.name}   onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></Field>
                <Field label="Email">    <input style={inp} type="email" value={form.email}  onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></Field>
                <Field label="District">
                  <RegionSelect value={form.region} onChange={v=>setForm(f=>({...f,region:v}))} regions={regions} />
                </Field>
                <Field label="Notes">   <textarea style={{...inp,height:60,resize:"vertical"}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></Field>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 0",borderBottom:"1px solid #131922",marginBottom:12}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flex:1}}>
                    <input type="checkbox" checked={!!form.iroa?.member}
                      onChange={e=>setForm(f=>({...f,iroa:{...f.iroa,member:e.target.checked,since:e.target.checked?(f.iroa?.since||new Date().toISOString().slice(0,10)):null}}))}
                      style={{width:16,height:16,accentColor:"#e85d2c"}} />
                    <span style={{fontSize:13,color:"#e2e8f0",fontWeight:600}}>IROA Member</span>
                  </label>
                  {form.iroa?.member && (
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <label style={{fontSize:11,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"}}>Since</label>
                      <input type="date" style={{...inp,width:140,padding:"6px 10px",fontSize:12}}
                        value={form.iroa?.since||""}
                        onChange={e=>setForm(f=>({...f,iroa:{...f.iroa,since:e.target.value}}))} />
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button style={btnP} onClick={saveProfile}>Save</button>
                  <button style={btnS} onClick={()=>setEditMode(false)}>Cancel</button>
                </div>
              </>
            )}
          </div>
          <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:24}}>
            <h3 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Change Password</h3>
            {pwError   && <div style={{background:"#2a1515",border:"1px solid #4a2020",borderRadius:6,padding:"9px 13px",color:"#f87171",fontSize:13,marginBottom:12}}>{pwError}</div>}
            {pwSuccess && <div style={{background:"#0a2a15",border:"1px solid #164a20",borderRadius:6,padding:"9px 13px",color:"#4ade80",fontSize:13,marginBottom:12}}>Password updated successfully.</div>}
            <Field label="Current Password"><input style={inp} type="password" value={pwForm.current} onChange={pf("current")} /></Field>
            <Field label="New Password">    <input style={inp} type="password" value={pwForm.next}    onChange={pf("next")} /></Field>
            <Field label="Confirm New">     <input style={inp} type="password" value={pwForm.confirm} onChange={pf("confirm")} /></Field>
            <button style={btnP} onClick={changePw}>Update Password</button>
          </div>
        </div>
        {/* Right */}
        <div>
          <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:24,marginBottom:16}}>
            <h3 style={{margin:"0 0 16px",fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Certification History</h3>
            {(!user.certHistory||user.certHistory.length===0)
              ? <p style={{color:"#475569",fontSize:13}}>No certifications on record yet. Contact an administrator.</p>
              : [...user.certHistory].reverse().map((c,i,arr)=>(
                <div key={i} style={{display:"flex",gap:12,paddingBottom:i<arr.length-1?14:0}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:certColor(c.cert),flexShrink:0,marginTop:4}} />
                    {i<arr.length-1&&<div style={{width:2,flex:1,background:"#1e2530",marginTop:4}}/>}
                  </div>
                  <div style={{flex:1,paddingBottom:4}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}><Badge label={c.cert} color={certColor(c.cert)} /><span style={{color:"#64748b",fontSize:12}}>{fmtDate(c.date)}</span></div>
                    <div style={{color:"#475569",fontSize:12,marginTop:4}}>Granted by: {c.grantedBy}</div>
                    {c.note&&<div style={{color:"#64748b",fontSize:12,fontStyle:"italic",marginTop:2}}>{c.note}</div>}
                  </div>
                </div>
              ))
            }
          </div>

          {/* RO Upgrade Checklist — only shown for RO-P holders */}
          {user.certification==="RO-P" && (()=>{
            const checklist = computeROChecklist(user);
            const allPass   = checklist.every(c=>c.pass);
            return (
              <div style={{background:"#111418",border:`1px solid ${allPass?"#166534":"#1e2530"}`,borderRadius:8,padding:24,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <h3 style={{margin:0,fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>RO Upgrade Checklist</h3>
                  {allPass && <Badge label="All Requirements Met" color="#4ade80" />}
                </div>
                <p style={{fontSize:12,color:"#475569",margin:"0 0 16px"}}>
                  These checks must all pass before applying for a full <Badge label="RO" color="#4ade80" /> upgrade. Automatic checks are performed by the system; if you believe a result is incorrect, contact NROI directly.
                </p>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                  {checklist.map(item=>(
                    <div key={item.key} style={{
                      display:"flex",alignItems:"flex-start",gap:12,
                      padding:"10px 12px",borderRadius:7,
                      background:item.pass?"#0a1f0a":"#1a0e0e",
                      border:`1px solid ${item.pass?"#166534":"#4a1010"}`
                    }}>
                      <span style={{fontSize:16,flexShrink:0,marginTop:1}}>
                        {item.pass ? "✅" : "❌"}
                      </span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:item.pass?"#86efac":"#fca5a5"}}>{item.label}</div>
                        <div style={{fontSize:11,color:"#475569",marginTop:2}}>{item.desc}</div>
                        {item.detail&&<div style={{fontSize:11,color:"#64748b",marginTop:2,fontStyle:"italic"}}>{item.detail}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {applyMsg ? (
                  <div style={{background:"#0a1f0a",border:"1px solid #166534",borderRadius:7,padding:"12px 14px",color:"#86efac",fontSize:13}}>{applyMsg}</div>
                ) : allPass ? (
                  <button style={{...btnP,background:"#16a34a",width:"100%"}} onClick={applyForRO}>
                    Apply for RO Upgrade
                  </button>
                ) : (
                  <button style={{...btnS,width:"100%",cursor:"not-allowed",opacity:0.5}} disabled>
                    Apply for RO Upgrade — Requirements Not Met
                  </button>
                )}
              </div>
            );
          })()}

          {/* Seminar History */}
          <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:24,marginBottom:16}}>
            <h3 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Seminar History</h3>
            {mySeminars.length===0
              ? <p style={{color:"#475569",fontSize:13}}>No seminars on record.</p>
              : mySeminars.map(s=>(
                <div key={s.id} style={{padding:"10px 0",borderBottom:"1px solid #1a2030",display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{color:"#e2e8f0",fontSize:13,fontWeight:600}}>{s.name}</div>
                    <div style={{color:"#475569",fontSize:11,marginTop:3}}>{fmtDate(s.date)} {s.location?"· "+s.location:""}</div>
                    <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                      <Badge label={s.type} color={s.type==="Level I"?"#38bdf8":"#a78bfa"} />
                      {s.enrollment.graduated&&<Badge label="Graduated" color="#4ade80" />}
                      {s.enrollment.diplomaVerified&&<Badge label="Diploma Verified" color="#38bdf8" />}
                    </div>
                  </div>
                  {s.enrollment.diplomaDate&&<span style={{color:"#475569",fontSize:11,whiteSpace:"nowrap"}}>{fmtDate(s.enrollment.diplomaDate)}</span>}
                </div>
              ))
            }
          </div>

          <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:24}}>
            <h3 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Match History</h3>
            {myMatches.length===0
              ? <p style={{color:"#475569",fontSize:13}}>No match assignments yet.</p>
              : myMatches.map(m=>(
                <div key={m.id} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:"1px solid #1a2030"}}>
                  <div style={{flex:1}}>
                    <div style={{color:"#e2e8f0",fontSize:14,fontWeight:500}}>{m.name}</div>
                    <div style={{color:"#475569",fontSize:12,marginTop:2}}>{fmtDate(m.date)} · {m.region}</div>
                  </div>
                  <Badge label={m.assignment.role} color={certColor(m.assignment.role)} />
                  <span style={{color:"#e85d2c",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16}}>+{m.assignment.pointsAwarded}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: USER DATABASE
// ─────────────────────────────────────────────────────────────────────────────

function UserDatabase({ users, setUsers, regions, setRegions }) {
  const { currentUser } = useAuth();
  const [tab,          setTab]          = useState("users");  // "users" | "regions"
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState("All");
  const [certFilter,   setCertFilter]   = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [viewUser,     setViewUser]     = useState(null);
  const [certTarget,   setCertTarget]   = useState(null);

  // Region management state
  const [newRegionName, setNewRegionName] = useState("");
  const [regionError,   setRegionError]   = useState("");

  const filtered = useMemo(() => users.filter(u=>{
    const q=search.toLowerCase();
    return (u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)||(u.region||"").toLowerCase().includes(q))
      && (roleFilter==="All"||u.role===roleFilter)
      && (certFilter==="All"||u.certification===certFilter)
      && (regionFilter==="All"||(u.region||"")=== regionFilter);
  }),[users,search,roleFilter,certFilter,regionFilter]);

  function setRole(id,role) {
    setUsers(prev=>prev.map(u=>u.id===id?{...u,role}:u));
    setViewUser(v=>v?.id===id?{...v,role}:v);
  }
  function toggleActive(id) {
    setUsers(prev=>prev.map(u=>u.id===id?{...u,active:!u.active}:u));
    setViewUser(v=>v?.id===id?{...v,active:!v.active}:v);
  }
  function deleteUser(id) {
    if (id===currentUser.id) return alert("You cannot delete your own account.");
    if (window.confirm("Permanently remove this user?")) { setUsers(prev=>prev.filter(u=>u.id!==id)); setViewUser(null); }
  }
  function grantCert(userId, cert, newRole, note) {
    const granter = currentUser.name;
    const entry = { cert, grantedBy:granter, date:new Date().toISOString().slice(0,10), note };
    setUsers(prev=>prev.map(u=>{
      if (u.id!==userId) return u;
      const shouldUpgrade = certRank(cert) >= certRank(u.certification);
      return { ...u, certification:shouldUpgrade?cert:u.certification, role:newRole||u.role, certHistory:[...(u.certHistory||[]),entry] };
    }));
    setCertTarget(null);
  }

  // Region management
  function addRegion() {
    const name = newRegionName.trim();
    if (!name) { setRegionError("Region name cannot be empty."); return; }
    if (regions.includes(name)) { setRegionError(`"${name}" already exists.`); return; }
    setRegions(prev => [...prev, name].sort());
    setNewRegionName(""); setRegionError("");
  }
  function removeRegion(name) {
    const usedBy = users.filter(u=>(u.region||"")=== name).length;
    const matchUsed = /* we can't access matches here but warn generically */ false;
    if (usedBy > 0) {
      if (!window.confirm(`"${name}" is assigned to ${usedBy} user${usedBy!==1?"s":""}. Remove it from the list anyway? Existing assignments are kept.`)) return;
    } else if (!window.confirm(`Remove district "${name}" from the list?`)) return;
    setRegions(prev => prev.filter(r=>r!==name));
    if (regionFilter === name) setRegionFilter("All");
  }

  const liveUser = id => users.find(u=>u.id===id);
  const tabBtn = t => ({
    padding:"8px 20px", fontSize:13, fontWeight:600, cursor:"pointer", border:"none", borderRadius:6,
    background: tab===t ? "#e85d2c" : "transparent", color: tab===t ? "#fff" : "#64748b"
  });

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 4px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.03em",color:"#e2e8f0"}}>User Database</h1>
          <p style={{color:"#475569",margin:0,fontSize:14}}>{tab==="users" ? `${filtered.length} of ${users.length} users` : `${regions.length} districts configured`}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:4,marginBottom:24,background:"#0d1117",padding:4,borderRadius:8,width:"fit-content"}}>
        <button style={tabBtn("users")}   onClick={()=>setTab("users")}>👥 Users</button>
        <button style={tabBtn("regions")} onClick={()=>setTab("regions")}>🗺️ Districts</button>
      </div>

      {tab === "users" && (<>
        <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, email, district…" style={{...inp,flex:1,minWidth:200}} />
          <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)} style={{...inp,width:130}}>
            <option value="All">All Roles</option>
            {SYSTEM_ROLES.map(r=><option key={r}>{r}</option>)}
          </select>
          <select value={certFilter} onChange={e=>setCertFilter(e.target.value)} style={{...inp,width:130}}>
            <option value="All">All Certs</option>
            {CERT_LEVELS.map(c=><option key={c}>{c}</option>)}
          </select>
          <select value={regionFilter} onChange={e=>setRegionFilter(e.target.value)} style={{...inp,width:150}}>
            <option value="All">All Districts</option>
            {[...regions].sort().map(r=><option key={r} value={r}>{r}</option>)}
            <option value="">— No district —</option>
          </select>
        </div>
        <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#0d1117"}}>
                {["User","Email","Role","Certification","District","Points","Status","Actions"].map(h=>(
                  <th key={h} style={{padding:"12px 13px",textAlign:"left",fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:"1px solid #1e2530"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u,i)=>(
                <tr key={u.id} style={{borderBottom:"1px solid #131922",background:i%2===0?"transparent":"#0a0e14"}}>
                  <td style={{padding:"11px 13px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:9}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>{u.name.charAt(0)}</div>
                      <button onClick={()=>setViewUser(u)} style={{background:"none",border:"none",color:"#e2e8f0",fontWeight:600,fontSize:14,cursor:"pointer",padding:0}}>{u.name}</button>
                      {u.id===currentUser.id&&<span style={{fontSize:10,color:"#475569"}}>(you)</span>}
                    </div>
                  </td>
                  <td style={{padding:"11px 13px",color:"#64748b",fontSize:13}}>{u.email}</td>
                  <td style={{padding:"11px 13px"}}><Badge label={u.role} color={roleColor(u.role)} /></td>
                  <td style={{padding:"11px 13px"}}><Badge label={u.certification||"None"} color={certColor(u.certification)} /></td>
                  <td style={{padding:"11px 13px",color:"#94a3b8",fontSize:13}}>{u.region||"—"}</td>
                  <td style={{padding:"11px 13px",color:"#e85d2c",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:15}}>{u.points}</td>
                  <td style={{padding:"11px 13px"}}><Badge label={u.active?"Active":"Inactive"} color={u.active?"#4ade80":"#6b7280"} /></td>
                  <td style={{padding:"11px 13px"}}>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>setCertTarget(u)} style={{...btnS,padding:"5px 10px",fontSize:11}}>Certs</button>
                      <button onClick={()=>setViewUser(u)}   style={{...btnS,padding:"5px 10px",fontSize:11}}>View</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={8} style={{padding:44,textAlign:"center",color:"#475569"}}>No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}

      {tab === "regions" && (
        <div>
          <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:24,marginBottom:20}}>
            <h3 style={{margin:"0 0 6px",fontSize:14,fontWeight:700,color:"#e2e8f0"}}>District List</h3>
            <p style={{margin:"0 0 20px",fontSize:13,color:"#475569"}}>
              These districts appear in all district dropdowns throughout the system — for user profiles, match creation, and filters.
              Add or remove them here to configure the system for your IPSC Region. Removing a district from the list does <em style={{color:"#94a3b8"}}>not</em> clear it from users or matches that already have it set.
            </p>

            {/* Add new district */}
            <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"flex-end"}}>
              <Field label="New District Name" hint="e.g. 'Midtøst' or 'Capital District'">
                <input
                  style={{...inp,width:260}}
                  value={newRegionName}
                  onChange={e=>{ setNewRegionName(e.target.value); setRegionError(""); }}
                  placeholder="District name…"
                  onKeyDown={e=>e.key==="Enter"&&addRegion()}
                />
              </Field>
              <button style={{...btnP,marginBottom:16}} onClick={addRegion}>Add District</button>
            </div>
            {regionError && <div style={{background:"#2a1515",border:"1px solid #4a2020",borderRadius:6,padding:"9px 13px",color:"#f87171",fontSize:13,marginBottom:16}}>{regionError}</div>}

            {/* District grid */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
              {[...regions].sort().map(r => {
                const userCount = users.filter(u=>(u.region||"")===r).length;
                return (
                  <div key={r} style={{
                    background:"#0d1117", border:"1px solid #1e2530", borderRadius:8,
                    padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10
                  }}>
                    <div>
                      <div style={{color:"#e2e8f0",fontWeight:600,fontSize:14}}>{r}</div>
                      <div style={{color:"#475569",fontSize:12,marginTop:2}}>{userCount} user{userCount!==1?"s":""}</div>
                    </div>
                    <button onClick={()=>removeRegion(r)} style={{
                      background:"none", border:"1px solid #2a3441", borderRadius:5,
                      color:"#64748b", cursor:"pointer", padding:"4px 9px", fontSize:12,
                      lineHeight:1
                    }} title={`Remove ${r}`}>✕</button>
                  </div>
                );
              })}
            </div>

            {regions.length === 0 && (
              <div style={{textAlign:"center",padding:40,color:"#475569",fontSize:13}}>
                No districts configured. Add one above, or district fields will fall back to free text.
              </div>
            )}
          </div>

          <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:18}}>
            <div style={{fontSize:12,color:"#475569"}}>
              <strong style={{color:"#64748b"}}>Note for other IPSC Regions:</strong> This system ships with IPSC Norway's ten official districts as the default. Replace them here with your own nation's district breakdown. The software does not hard-code any district names — this list is the sole source of truth for all dropdowns.
            </div>
          </div>
        </div>
      )}

      {/* View/manage user modal */}
      {viewUser && (
        <Modal title={`User: ${viewUser.name}`} onClose={()=>setViewUser(null)} wide>
          {(() => {
            const u = liveUser(viewUser.id) || viewUser;
            return (
              <div style={{display:"flex",gap:26}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
                    <div style={{width:50,height:50,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:800,color:"#fff"}}>{u.name.charAt(0)}</div>
                    <div>
                      <div style={{fontSize:18,fontWeight:700,color:"#e2e8f0"}}>{u.name}</div>
                      <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                        <Badge label={u.role} color={roleColor(u.role)} />
                        <Badge label={u.certification||"No Cert"} color={certColor(u.certification)} />
                        <Badge label={u.active?"Active":"Inactive"} color={u.active?"#4ade80":"#6b7280"} />
                      </div>
                    </div>
                  </div>
                  <InfoRow label="Email"     value={u.email} />
                  <InfoRow label="District"  value={u.region||"—"} />
                  <InfoRow label="Joined"    value={fmtDate(u.joined)} />
                  <InfoRow label="Points"    value={u.points} />
                  <InfoRow label="IROA Member" value={
                    u.iroa?.member
                      ? `Yes${u.iroa.since ? " — since " + fmtDate(u.iroa.since) : ""}`
                      : "No"
                  } />
                  {u.notes&&<InfoRow label="Notes" value={u.notes}/>}
                  {u.id!==currentUser.id && (
                    <>
                      <Divider label="Admin Controls" />
                      <Field label="System Role">
                        <select style={inp} value={u.role} onChange={e=>setRole(u.id,e.target.value)}>
                          {SYSTEM_ROLES.map(r=><option key={r}>{r}</option>)}
                        </select>
                      </Field>
                      <Field label="District">
                        <RegionSelect
                          value={u.region||""}
                          onChange={v=>setUsers(prev=>prev.map(x=>x.id===u.id?{...x,region:v}:x))}
                          regions={regions}
                        />
                      </Field>
                      <Field label="IROA Membership">
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                            <input type="checkbox"
                              checked={!!(u.iroa?.member)}
                              onChange={e=>{
                                const member=e.target.checked;
                                setUsers(prev=>prev.map(x=>x.id===u.id?{...x,iroa:{member,since:member?(x.iroa?.since||new Date().toISOString().slice(0,10)):null}}:x));
                              }}
                              style={{width:16,height:16,accentColor:"#e85d2c"}} />
                            <span style={{fontSize:13,color:"#e2e8f0"}}>IROA Member</span>
                          </label>
                          {u.iroa?.member && (
                            <input type="date"
                              style={{...inp,width:150,padding:"6px 10px",fontSize:12}}
                              value={u.iroa?.since||""}
                              onChange={e=>setUsers(prev=>prev.map(x=>x.id===u.id?{...x,iroa:{...x.iroa,since:e.target.value}}:x))}
                            />
                          )}
                        </div>
                      </Field>
                      <Field label="Profile Photo">
                        <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                          <input type="checkbox"
                            checked={!!u.profilePhotoApproved}
                            onChange={e=>setUsers(prev=>prev.map(x=>x.id===u.id?{...x,profilePhotoApproved:e.target.checked}:x))}
                            style={{width:16,height:16,accentColor:"#e85d2c"}} />
                          <span style={{fontSize:13,color:"#e2e8f0"}}>Profile photo approved</span>
                        </label>
                      </Field>
                      <div style={{display:"flex",gap:8,marginTop:4}}>
                        <button style={{...btnS,padding:"8px 14px",fontSize:13}} onClick={()=>toggleActive(u.id)}>{u.active?"Deactivate":"Reactivate"} Account</button>
                        <button style={{...btnD,padding:"8px 14px",fontSize:13}} onClick={()=>deleteUser(u.id)}>Delete User</button>
                      </div>
                    </>
                  )}
                </div>
                <div style={{width:250}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <h4 style={{margin:0,fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Cert History</h4>
                    <button style={{...btnP,padding:"5px 10px",fontSize:11}} onClick={()=>{setCertTarget(u);setViewUser(null);}}>+ Grant</button>
                  </div>
                  {(!u.certHistory||u.certHistory.length===0)
                    ? <p style={{color:"#475569",fontSize:13}}>No certifications.</p>
                    : [...u.certHistory].reverse().map((c,i)=>(
                      <div key={i} style={{padding:"9px 0",borderBottom:"1px solid #1a2030"}}>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}><Badge label={c.cert} color={certColor(c.cert)} /><span style={{color:"#64748b",fontSize:11}}>{fmtDate(c.date)}</span></div>
                        <div style={{color:"#475569",fontSize:11,marginTop:4}}>By: {c.grantedBy}</div>
                        {c.note&&<div style={{color:"#64748b",fontSize:11,fontStyle:"italic"}}>{c.note}</div>}
                      </div>
                    ))
                  }
                </div>
              </div>
            );
          })()}
        </Modal>
      )}

      {/* Grant Cert Modal */}
      {certTarget && (
        <GrantCertModal
          user={liveUser(certTarget.id)||certTarget}
          granterName={currentUser.name}
          onClose={()=>setCertTarget(null)}
          onSave={grantCert}
        />
      )}
    </div>
  );
}

function GrantCertModal({ user, granterName, onClose, onSave }) {
  const [cert,      setCert]      = useState("RO-P");
  const [newRole,   setNewRole]   = useState(user.role);
  const [note,      setNote]      = useState("");

  function handleCertChange(c) {
    setCert(c);
    // Auto-suggest role upgrade: RM cert → rm role
    if (c==="RM" && user.role==="member") setNewRole("rm");
    else setNewRole(user.role);
  }

  return (
    <Modal title={`Grant Certification — ${user.name}`} onClose={onClose}>
      <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:16,marginBottom:20}}>
        <div style={{fontSize:13,color:"#94a3b8",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          Current cert: <Badge label={user.certification||"None"} color={certColor(user.certification)} />
          Current role: <Badge label={user.role} color={roleColor(user.role)} />
        </div>
      </div>
      <Field label="Certification to Grant" hint="This will be appended to the user's certification history.">
        <select style={inp} value={cert} onChange={e=>handleCertChange(e.target.value)}>
          {["RO-P","RO","CRO","RM"].map(c=><option key={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Update System Role" hint="Adjust account privileges to match. RM cert → rm role is recommended.">
        <select style={inp} value={newRole} onChange={e=>setNewRole(e.target.value)}>
          {SYSTEM_ROLES.map(r=><option key={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Notes / Reason (optional)">
        <input style={inp} value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Passed RO exam at Bergen Regional 2026" />
      </Field>
      <div style={{background:"#0d1015",border:"1px solid #2a3441",borderRadius:6,padding:"11px 14px",fontSize:12,color:"#64748b",marginBottom:22}}>
        <strong style={{color:"#94a3b8"}}>Note:</strong> Granting a cert <em>adds</em> a history entry. The user's displayed certification updates only if the new cert is equal or higher rank than the current one. All cert grants are logged with your name ({granterName}) and today's date.
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button style={btnS} onClick={onClose}>Cancel</button>
        <button style={btnP} onClick={()=>onSave(user.id,cert,newRole,note)}>Grant {cert} Certification</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RANGE OFFICERS PAGE
// ─────────────────────────────────────────────────────────────────────────────

function ROPage({ users, matches, regions }) {
  const [search,       setSearch]       = useState("");
  const [certFilter,   setCertFilter]   = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [viewUser,     setViewUser]     = useState(null);

  const ros = users.filter(u=>u.certification!=="None"&&u.active);
  const filtered = useMemo(()=>ros.filter(u=>{
    const q=search.toLowerCase();
    return (u.name.toLowerCase().includes(q)||u.email.toLowerCase().includes(q)||(u.region||"").toLowerCase().includes(q))
      && (certFilter==="All"||u.certification===certFilter)
      && (regionFilter==="All"||(u.region||"")===regionFilter);
  }),[ros,search,certFilter,regionFilter]);

  const roMatchHistory = useMemo(()=>viewUser
    ? matches.filter(m=>m.assignments.some(a=>a.roId===viewUser.id))
        .map(m=>({...m,assignment:m.assignments.find(a=>a.roId===viewUser.id)}))
    : []
  ,[viewUser,matches]);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 4px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.03em",color:"#e2e8f0"}}>Range Officers</h1>
          <p style={{color:"#475569",margin:0,fontSize:14}}>{filtered.length} certified active officers</p>
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, email, district…" style={{...inp,flex:1}} />
        <select value={certFilter} onChange={e=>setCertFilter(e.target.value)} style={{...inp,width:140}}>
          <option value="All">All Certs</option>
          {["RO-P","RO","CRO","RM"].map(c=><option key={c}>{c}</option>)}
        </select>
        <select value={regionFilter} onChange={e=>setRegionFilter(e.target.value)} style={{...inp,width:150}}>
          <option value="All">All Districts</option>
          {[...regions].sort().map(r=><option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#0d1117"}}>
              {["Name","Certification","IROA","District","Matches","Points",""].map(h=>(
                <th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:"1px solid #1e2530"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u,i)=>{
              const mc=matches.filter(m=>m.assignments.some(a=>a.roId===u.id)).length;
              return (
                <tr key={u.id} style={{borderBottom:"1px solid #131922",background:i%2===0?"transparent":"#0a0e14"}}>
                  <td style={{padding:"12px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>{u.name.charAt(0)}</div>
                      <button onClick={()=>setViewUser(u)} style={{background:"none",border:"none",color:"#e2e8f0",fontWeight:600,fontSize:14,cursor:"pointer",padding:0}}>{u.name}</button>
                    </div>
                  </td>
                  <td style={{padding:"12px 16px"}}><Badge label={u.certification} color={certColor(u.certification)} /></td>
                  <td style={{padding:"12px 16px"}}>
                    {u.iroa?.member
                      ? <span style={{display:"flex",alignItems:"center",gap:5}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:"#38bdf8",display:"inline-block",flexShrink:0}} />
                          <span style={{color:"#38bdf8",fontSize:12,fontWeight:600}}>IROA</span>
                        </span>
                      : <span style={{color:"#334155",fontSize:12}}>—</span>
                    }
                  </td>
                  <td style={{padding:"12px 16px",color:"#94a3b8",fontSize:13}}>{u.region||"—"}</td>
                  <td style={{padding:"12px 16px",color:"#64748b",fontSize:13}}>{mc}</td>
                  <td style={{padding:"12px 16px",color:"#e85d2c",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:15}}>{u.points}</td>
                  <td style={{padding:"12px 16px"}}><button onClick={()=>setViewUser(u)} style={{...btnS,padding:"5px 12px",fontSize:12}}>View</button></td>
                </tr>
              );
            })}
            {filtered.length===0&&<tr><td colSpan={7} style={{padding:44,textAlign:"center",color:"#475569"}}>No certified ROs found.</td></tr>}
          </tbody>
        </table>
      </div>

      {viewUser && (
        <Modal title={`RO Profile — ${viewUser.name}`} onClose={()=>setViewUser(null)}>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
            <StatCard label="Points"  value={viewUser.points}        accent="#e85d2c" />
            <StatCard label="Matches" value={roMatchHistory.length}  accent="#60a5fa" />
            <StatCard label="Cert"    value={viewUser.certification} accent={certColor(viewUser.certification)} />
          </div>
          <InfoRow label="Email"    value={viewUser.email} />
          <InfoRow label="District" value={viewUser.region||"—"} />
          <InfoRow label="Joined"   value={fmtDate(viewUser.joined)} />
          <InfoRow label="IROA Member" value={
            viewUser.iroa?.member
              ? <span style={{color:"#38bdf8",fontWeight:600}}>Yes{viewUser.iroa.since ? <span style={{color:"#475569",fontWeight:400}}> — since {fmtDate(viewUser.iroa.since)}</span> : ""}</span>
              : "No"
          } />
          {viewUser.notes&&<InfoRow label="Notes" value={viewUser.notes}/>}
          {(viewUser.seminarHistory||[]).length>0 && (
            <>
              <h4 style={{margin:"20px 0 10px",fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Seminar History</h4>
              {[...viewUser.seminarHistory].reverse().map((s,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 0",borderBottom:"1px solid #1a2030",flexWrap:"wrap"}}>
                  <Badge label={s.type} color={s.type==="Level I"?"#38bdf8":"#a78bfa"} />
                  {s.graduated&&<Badge label="Graduated" color="#4ade80" />}
                  {s.diplomaVerified&&<Badge label="Verified" color="#38bdf8" />}
                  <span style={{color:"#475569",fontSize:11,marginLeft:"auto"}}>{s.diplomaDate?fmtDate(s.diplomaDate):"—"}</span>
                </div>
              ))}
            </>
          )}
          <h4 style={{margin:"20px 0 10px",fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Certification History</h4>
          {(viewUser.certHistory||[]).length===0
            ? <p style={{color:"#475569",fontSize:13}}>No cert history.</p>
            : [...(viewUser.certHistory||[])].reverse().map((c,i)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"7px 0",borderBottom:"1px solid #1a2030"}}>
                <Badge label={c.cert} color={certColor(c.cert)} />
                <span style={{color:"#64748b",fontSize:12,flex:1}}>Granted by {c.grantedBy}</span>
                <span style={{color:"#475569",fontSize:12}}>{fmtDate(c.date)}</span>
              </div>
            ))
          }
          <h4 style={{margin:"20px 0 10px",fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Match History</h4>
          {roMatchHistory.length===0
            ? <p style={{color:"#475569",fontSize:13}}>No match assignments.</p>
            : roMatchHistory.map(m=>(
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #1a2030"}}>
                <div style={{flex:1}}>
                  <div style={{color:"#e2e8f0",fontSize:14,fontWeight:500}}>{m.name}</div>
                  <div style={{color:"#475569",fontSize:12,marginTop:2}}>{fmtDate(m.date)} · {m.region}</div>
                </div>
                <Badge label={m.assignment.role} color={certColor(m.assignment.role)} />
                <span style={{color:"#e85d2c",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16}}>+{m.assignment.pointsAwarded}</span>
              </div>
            ))
          }
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MATCHES PAGE
// ─────────────────────────────────────────────────────────────────────────────

function MatchesPage({ users, matches, setMatches, regions }) {
  const { currentUser } = useAuth();
  const canEdit = canManageMatches(currentUser);

  const [showCreate,   setShowCreate]   = useState(false);
  const [manageMatch,  setManageMatch]  = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [search,       setSearch]       = useState("");

  const blank = { name:"", date:new Date().toISOString().slice(0,10), region:"", level:"Level I", stages:6, status:"upcoming", combinedMDRM:true, md:"", rm:"", assignments:[] };
  const [form, setForm] = useState(blank);

  const filtered = useMemo(()=>matches.filter(m=>{
    const q=search.toLowerCase();
    return (m.name.toLowerCase().includes(q)||m.region.toLowerCase().includes(q))
      && (statusFilter==="All"||m.status===statusFilter)
      && (regionFilter==="All"||(m.region||"")===regionFilter);
  }),[matches,search,statusFilter,regionFilter]);

  function createMatch() {
    if (!form.name.trim()) return;
    setMatches(prev=>[...prev,{...form,id:uid()}]);
    setShowCreate(false); setForm(blank);
  }
  function deleteMatch(id) {
    if (window.confirm("Delete this match?")) setMatches(prev=>prev.filter(m=>m.id!==id));
  }
  const eligibleMDs = users.filter(u=>(u.role==="rm"||u.role==="admin")&&u.active);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 4px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.03em",color:"#e2e8f0"}}>Matches</h1>
          <p style={{color:"#475569",margin:0,fontSize:14}}>{filtered.length} of {matches.length} shown</p>
        </div>
        {canEdit&&<button style={btnP} onClick={()=>{setForm(blank);setShowCreate(true);}}>+ Create Match</button>}
      </div>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search matches…" style={{...inp,flex:1}} />
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{...inp,width:140}}>
          <option value="All">All Status</option>
          <option>upcoming</option><option>active</option><option>completed</option>
        </select>
        <select value={regionFilter} onChange={e=>setRegionFilter(e.target.value)} style={{...inp,width:150}}>
          <option value="All">All Districts</option>
          {[...regions].sort().map(r=><option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {filtered.map(m=>{
          const mdUser=users.find(u=>u.id===m.md);
          const rmUser=users.find(u=>u.id===m.rm);
          const staffLabel = m.combinedMDRM
            ? `MD/RM: ${mdUser?.name||"—"}`
            : `MD: ${mdUser?.name||"—"} · RM: ${rmUser?.name||"—"}`;
          return (
            <div key={m.id} style={{background:"#111418",border:"1px solid #1e2530",borderRadius:10,padding:"18px 22px",display:"flex",alignItems:"center",gap:16}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <span style={{fontSize:16,fontWeight:700,color:"#e2e8f0"}}>{m.name}</span>
                  <Badge label={m.status} color={statusColor(m.status)} />
                  <Badge label={m.level}  color="#7c8cf8" />
                  {!m.combinedMDRM && <Badge label="Sep. MD/RM" color="#94a3b8" />}
                </div>
                <div style={{color:"#475569",fontSize:13,display:"flex",gap:18,flexWrap:"wrap"}}>
                  <span>📅 {fmtDate(m.date)}</span><span>📍 {m.region}</span>
                  <span>🎯 {m.stages} stages</span><span>👔 {staffLabel}</span>
                  <span>👥 {m.assignments.length} RO{m.assignments.length!==1?"s":""}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={{...btnS,padding:"8px 16px",fontSize:13}} onClick={()=>setManageMatch(m)}>{canEdit?"Manage":"View"}</button>
                {canEdit&&<button style={{...btnD,padding:"8px 16px",fontSize:13}} onClick={()=>deleteMatch(m.id)}>Delete</button>}
              </div>
            </div>
          );
        })}
        {filtered.length===0&&<div style={{textAlign:"center",padding:60,color:"#475569"}}>No matches found.</div>}
      </div>

      {showCreate&&canEdit&&(
        <Modal title="Create Match" onClose={()=>setShowCreate(false)}>
          <Field label="Match Name"><input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Oslo Club Match #13" /></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Field label="Date"><input style={inp} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></Field>
            <Field label="District"><RegionSelect value={form.region} onChange={v=>setForm(f=>({...f,region:v}))} regions={regions} placeholder="— Select district —" /></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
            <Field label="Level"><select style={inp} value={form.level} onChange={e=>setForm(f=>({...f,level:e.target.value}))}>{["Level I","Level II","Level III","Level IV"].map(l=><option key={l}>{l}</option>)}</select></Field>
            <Field label="Stages"><input style={inp} type="number" min={1} max={40} value={form.stages} onChange={e=>setForm(f=>({...f,stages:parseInt(e.target.value)||1}))} /></Field>
            <Field label="Status"><select style={inp} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}><option>upcoming</option><option>active</option><option>completed</option></select></Field>
          </div>

          {/* MD/RM toggle */}
          <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:"14px 16px",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:form.combinedMDRM?0:14}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>Match Director / Rangemaster</div>
                <div style={{fontSize:12,color:"#475569",marginTop:2}}>
                  {form.combinedMDRM ? "One person fills both roles (typical for local/Level I matches)" : "Separate people for MD and RM (required for Level II+)"}
                </div>
              </div>
              <button onClick={()=>setForm(f=>({...f,combinedMDRM:!f.combinedMDRM,rm:f.combinedMDRM?"":f.md}))} style={{
                background:form.combinedMDRM?"#e85d2c22":"#1e2530",
                border:`1px solid ${form.combinedMDRM?"#e85d2c55":"#2a3441"}`,
                borderRadius:6, color:form.combinedMDRM?"#e85d2c":"#64748b",
                padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap"
              }}>{form.combinedMDRM?"Combined MD/RM":"Separate MD & RM"}</button>
            </div>
            {form.combinedMDRM ? (
              <div style={{marginTop:14}}>
                <Field label="Match Director & Rangemaster">
                  <select style={inp} value={form.md} onChange={e=>setForm(f=>({...f,md:e.target.value,rm:e.target.value}))}>
                    <option value="">— Select MD/RM —</option>
                    {eligibleMDs.map(u=><option key={u.id} value={u.id}>{u.name} ({u.certification})</option>)}
                  </select>
                </Field>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:0}}>
                <Field label="Match Director (MD)" hint="Organiser, administration">
                  <select style={inp} value={form.md} onChange={e=>setForm(f=>({...f,md:e.target.value}))}>
                    <option value="">— Select MD —</option>
                    {eligibleMDs.map(u=><option key={u.id} value={u.id}>{u.name} ({u.certification})</option>)}
                  </select>
                </Field>
                <Field label="Rangemaster (RM)" hint="Safety, range operations">
                  <select style={inp} value={form.rm} onChange={e=>setForm(f=>({...f,rm:e.target.value}))}>
                    <option value="">— Select RM —</option>
                    {eligibleMDs.map(u=><option key={u.id} value={u.id}>{u.name} ({u.certification})</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
            <button style={btnS} onClick={()=>setShowCreate(false)}>Cancel</button>
            <button style={btnP} onClick={createMatch}>Create Match</button>
          </div>
        </Modal>
      )}

      {manageMatch&&(
        <ManageMatch match={manageMatch} users={users} readonly={!canEdit}
          onClose={()=>setManageMatch(null)}
          onUpdate={upd=>{setMatches(prev=>prev.map(m=>m.id===upd.id?upd:m));setManageMatch(upd);}}
        />
      )}
    </div>
  );
}

function ManageMatch({ match, users, readonly, onClose, onUpdate }) {
  const [tab,       setTab]       = useState("roster");
  const [addROId,   setAddROId]   = useState("");
  const [addRole,   setAddRole]   = useState("RO");
  const [addStages, setAddStages] = useState("");
  const [editStatus,setEditStatus]= useState(match.status);

  const assignedIds  = match.assignments.map(a=>a.roId);
  const availableROs = users.filter(u=>u.active&&u.certification!=="None"&&!assignedIds.includes(u.id));

  // Role options depend on whether this match has combined or separate MD/RM
  const roleOptions = match.combinedMDRM
    ? ["RO-P","RO","CRO","RM","MD/RM"]
    : ["RO-P","RO","CRO","RM","MD","MD/RM"];

  function addAssignment() {
    if (!addROId) return;
    const stages=addStages.split(",").map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
    onUpdate({...match,assignments:[...match.assignments,{roId:addROId,role:addRole,stages,pointsAwarded:POINT_RULES[addRole]||1}]});
    setAddROId(""); setAddStages("");
  }
  function removeAssignment(id) { onUpdate({...match,assignments:match.assignments.filter(a=>a.roId!==id)}); }
  function distributePoints()   {
    onUpdate({...match,status:"completed",_pointsToDistribute:true});
    alert(`Points distributed to ${match.assignments.length} range officer${match.assignments.length!==1?"s":""}. Match marked completed.`);
  }

  const mdUser = users.find(u=>u.id===match.md);
  const rmUser = users.find(u=>u.id===match.rm);

  const tb = t=>({ padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer", border:"none", borderRadius:6,
    background:tab===t?"#e85d2c":"transparent", color:tab===t?"#fff":"#64748b" });

  return (
    <Modal title={`${readonly?"View":"Manage"}: ${match.name}`} onClose={onClose} wide>
      {/* Match header info */}
      <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:"14px 18px",marginBottom:18}}>
        <div style={{display:"flex",gap:24,flexWrap:"wrap",fontSize:13}}>
          <span style={{color:"#64748b"}}>📅 <span style={{color:"#e2e8f0"}}>{fmtDate(match.date)}</span></span>
          <span style={{color:"#64748b"}}>📍 <span style={{color:"#e2e8f0"}}>{match.region}</span></span>
          <span style={{color:"#64748b"}}>🎯 <span style={{color:"#e2e8f0"}}>{match.stages} stages</span></span>
          <span style={{color:"#64748b"}}><Badge label={match.level} color="#7c8cf8" /></span>
        </div>
        <div style={{marginTop:12,display:"flex",gap:24,flexWrap:"wrap",fontSize:13}}>
          {match.combinedMDRM ? (
            <span style={{color:"#64748b"}}>👔 MD/RM (combined): <span style={{color:"#e2e8f0",fontWeight:600}}>{mdUser?.name||"—"}</span></span>
          ) : (
            <>
              <span style={{color:"#64748b"}}>🗂️ Match Director: <span style={{color:"#e2e8f0",fontWeight:600}}>{mdUser?.name||"—"}</span></span>
              <span style={{color:"#64748b"}}>🛡️ Rangemaster: <span style={{color:"#e2e8f0",fontWeight:600}}>{rmUser?.name||"—"}</span></span>
            </>
          )}
        </div>
      </div>

      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
        <StatCard label="ROs Assigned"   value={match.assignments.length}                                accent="#60a5fa" />
        <StatCard label="Points to Give" value={match.assignments.reduce((s,a)=>s+a.pointsAwarded,0)}   accent="#e85d2c" />
      </div>

      {!readonly&&(
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:20,flexWrap:"wrap"}}>
          <select style={{...inp,width:160}} value={editStatus} onChange={e=>setEditStatus(e.target.value)}>
            <option>upcoming</option><option>active</option><option>completed</option>
          </select>
          <button style={{...btnS,padding:"9px 16px"}} onClick={()=>onUpdate({...match,status:editStatus})}>Update Status</button>
          {match.status!=="completed"&&<button style={{...btnP,background:"#16a34a"}} onClick={distributePoints}>✓ Distribute Points & Complete</button>}
          {match.status==="completed"&&<Badge label="Points Distributed" color="#4ade80" />}
        </div>
      )}

      <div style={{display:"flex",gap:4,marginBottom:20,background:"#0d1117",padding:4,borderRadius:8}}>
        <button style={tb("roster")} onClick={()=>setTab("roster")}>RO Roster</button>
        {!readonly&&<button style={tb("add")} onClick={()=>setTab("add")}>Add RO</button>}
      </div>

      {tab==="roster"&&(
        <div>
          {match.assignments.length===0&&<p style={{color:"#475569",fontSize:14}}>No ROs assigned yet.</p>}
          {match.assignments.map(a=>{
            const ro=users.find(u=>u.id===a.roId);
            return (
              <div key={a.roId} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #1a2030"}}>
                <div style={{flex:1}}>
                  <div style={{color:"#e2e8f0",fontWeight:600,fontSize:14}}>{ro?.name||"Unknown"}</div>
                  <div style={{color:"#475569",fontSize:12,marginTop:2}}>
                    {ro?.certification}
                    {a.stages&&a.stages.length>0 ? ` · Stages: ${a.stages.join(", ")}` : " · No specific stages"}
                  </div>
                </div>
                <Badge label={a.role} color={certColor(a.role)} />
                <span style={{color:"#e85d2c",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,minWidth:40,textAlign:"right"}}>+{a.pointsAwarded} pts</span>
                {!readonly&&<button onClick={()=>removeAssignment(a.roId)} style={{...btnD,padding:"4px 9px",fontSize:12}}>✕</button>}
              </div>
            );
          })}
        </div>
      )}

      {tab==="add"&&!readonly&&(
        <div>
          {/* Point rules explanation, adjusted for combined/separate */}
          <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:7,padding:"11px 14px",fontSize:12,color:"#64748b",marginBottom:18}}>
            <strong style={{color:"#94a3b8"}}>Point awards for this match:</strong>
            {match.combinedMDRM
              ? " RO = 1 pt · CRO = 2 pts · RM = 3 pts · MD/RM (combined) = 4 pts"
              : " RO = 1 pt · CRO = 2 pts · RM = 3 pts · MD = 3 pts · MD/RM (combined) = 4 pts"
            }
            {!match.combinedMDRM && (
              <div style={{marginTop:6,color:"#475569"}}>
                This match has <strong style={{color:"#e2e8f0"}}>separate MD and RM</strong>. Use the <Badge label="MD" color={certColor("MD")} /> role for the Match Director and <Badge label="RM" color={certColor("RM")} /> for the Rangemaster. Both receive 3 pts.
              </div>
            )}
          </div>
          <Field label="Select Range Officer">
            <select style={inp} value={addROId} onChange={e=>setAddROId(e.target.value)}>
              <option value="">— Choose RO —</option>
              {availableROs.map(u=><option key={u.id} value={u.id}>{u.name} ({u.certification})</option>)}
            </select>
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Field label="Role at Match">
              <select style={inp} value={addRole} onChange={e=>setAddRole(e.target.value)}>
                {roleOptions.map(r=><option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Stages (comma-sep, optional)">
              <input style={inp} value={addStages} onChange={e=>setAddStages(e.target.value)} placeholder="e.g. 1, 2, 5 — leave blank for MD/RM" />
            </Field>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <button style={btnP} onClick={addAssignment} disabled={!addROId}>Add to Roster</button>
            <span style={{color:"#94a3b8",fontSize:13}}>Will award: <span style={{color:"#e85d2c",fontWeight:700}}>{POINT_RULES[addRole]||1} pt{(POINT_RULES[addRole]||1)!==1?"s":""}</span></span>
          </div>
          {availableROs.length===0&&<p style={{color:"#475569",fontSize:13,marginTop:12}}>All eligible ROs are already assigned.</p>}
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POINTS LEDGER
// ─────────────────────────────────────────────────────────────────────────────

function PointsPage({ users, setUsers, matches }) {
  const { currentUser } = useAuth();
  const adminAccess = isAdmin(currentUser);

  const [adjustId,     setAdjustId]     = useState("");
  const [adjustAmt,    setAdjustAmt]    = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustLog,    setAdjustLog]    = useState([]);

  const sorted = [...users].filter(u=>u.active).sort((a,b)=>b.points-a.points);
  const max    = sorted[0]?.points||1;

  function applyAdjust() {
    const amt=parseInt(adjustAmt);
    if (!adjustId||isNaN(amt)||amt===0) return;
    const ro=users.find(u=>u.id===adjustId);
    setUsers(prev=>prev.map(u=>u.id===adjustId?{...u,points:Math.max(0,u.points+amt)}:u));
    setAdjustLog(prev=>[{name:ro?.name,amt,reason:adjustReason||"Manual adjustment",ts:new Date().toLocaleString()},...prev]);
    setAdjustAmt(""); setAdjustReason("");
  }

  const matchHistory = useMemo(()=>{
    const events=[];
    matches.filter(m=>m.status==="completed").forEach(m=>{
      m.assignments.forEach(a=>{
        const u=users.find(u=>u.id===a.roId);
        events.push({matchName:m.name,date:m.date,roName:u?.name||"Unknown",role:a.role,pts:a.pointsAwarded});
      });
    });
    return events.sort((a,b)=>new Date(b.date)-new Date(a.date));
  },[matches,users]);

  return (
    <div>
      <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 4px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.03em",color:"#e2e8f0"}}>Activity Points</h1>
      <p style={{color:"#475569",marginBottom:28,fontSize:14}}>Points ledger and distribution history</p>
      <div style={{display:"grid",gridTemplateColumns:adminAccess?"1fr 1fr":"1fr",gap:20,marginBottom:28}}>
        <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:20}}>
          <h3 style={{margin:"0 0 16px",fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Points Standings</h3>
          {sorted.map((u,i)=>(
            <div key={u.id} style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:11,color:i<3?"#facc15":"#475569",fontWeight:700,minWidth:20}}>#{i+1}</span>
                  <span style={{color:"#e2e8f0",fontSize:14}}>{u.name}</span>
                  <Badge label={u.certification||"None"} color={certColor(u.certification)} />
                </div>
                <span style={{color:"#e85d2c",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16}}>{u.points}</span>
              </div>
              <div style={{background:"#1e2530",borderRadius:4,height:4,overflow:"hidden"}}>
                <div style={{width:`${(u.points/max)*100}%`,background:`hsl(${Math.max(0,120-i/sorted.length*90)},70%,50%)`,height:"100%",borderRadius:4}} />
              </div>
            </div>
          ))}
        </div>
        {adminAccess&&(
          <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:20}}>
            <h3 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Manual Adjustment</h3>
            <p style={{color:"#475569",fontSize:13,marginBottom:16}}>Positive adds, negative deducts.</p>
            <Field label="User"><select style={inp} value={adjustId} onChange={e=>setAdjustId(e.target.value)}><option value="">— Select —</option>{users.map(u=><option key={u.id} value={u.id}>{u.name} ({u.points} pts)</option>)}</select></Field>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Amount"><input style={inp} type="number" value={adjustAmt} onChange={e=>setAdjustAmt(e.target.value)} placeholder="+2 or -1" /></Field>
              <Field label="Reason"><input style={inp} value={adjustReason} onChange={e=>setAdjustReason(e.target.value)} placeholder="Reason…" /></Field>
            </div>
            <button style={btnP} onClick={applyAdjust}>Apply</button>
            {adjustLog.length>0&&(
              <div style={{marginTop:16}}>
                <h4 style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>This session</h4>
                {adjustLog.slice(0,5).map((l,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #1a2030",fontSize:13}}>
                    <span style={{color:"#94a3b8"}}>{l.name} — {l.reason}</span>
                    <span style={{color:l.amt>0?"#4ade80":"#f87171",fontWeight:700}}>{l.amt>0?"+":""}{l.amt} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{background:"#111418",border:"1px solid #1e2530",borderRadius:8,padding:20}}>
        <h3 style={{margin:"0 0 16px",fontSize:13,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.08em"}}>Points from Completed Matches</h3>
        {matchHistory.length===0&&<p style={{color:"#475569"}}>No completed matches yet.</p>}
        {matchHistory.length>0&&(
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>{["Match","Date","Range Officer","Role","Points"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:"0.06em",borderBottom:"1px solid #1e2530"}}>{h}</th>)}</tr></thead>
            <tbody>
              {matchHistory.map((e,i)=>(
                <tr key={i} style={{borderBottom:"1px solid #131922"}}>
                  <td style={{padding:"10px 12px",color:"#e2e8f0",fontSize:13}}>{e.matchName}</td>
                  <td style={{padding:"10px 12px",color:"#64748b",fontSize:13}}>{fmtDate(e.date)}</td>
                  <td style={{padding:"10px 12px",color:"#cbd5e1",fontSize:13}}>{e.roName}</td>
                  <td style={{padding:"10px 12px"}}><Badge label={e.role} color={certColor(e.role)} /></td>
                  <td style={{padding:"10px 12px",color:"#e85d2c",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:16}}>+{e.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RO UPGRADE CHECKLIST LOGIC
// ─────────────────────────────────────────────────────────────────────────────

const RO_UPGRADE_CONFIG = {
  minPoints:       3,       // minimum match points earned
  minActiveYears:  0.5,     // years since joining
  quarantineDays:  180,     // days between RO applications
};

function computeROChecklist(user) {
  const today = new Date();
  const joined = user.joined ? new Date(user.joined) : null;
  const yearsActive = joined ? (today - joined) / (1000 * 60 * 60 * 24 * 365.25) : 0;
  const lastApp = user.lastROApplication ? new Date(user.lastROApplication) : null;
  const daysSinceApp = lastApp ? (today - lastApp) / (1000 * 60 * 60 * 24) : Infinity;

  const hasLevelI = (user.seminarHistory || []).some(
    s => s.type === "Level I" && s.graduated && s.diplomaVerified
  );

  return [
    {
      key:  "active",
      label:"Active member",
      desc: "Account must be active (not deactivated or on leave)",
      pass: !!user.active,
    },
    {
      key:  "photo",
      label:"Approved profile photo",
      desc: "A profile photo must be on file and approved by an admin",
      pass: !!user.profilePhotoApproved,
      canOverride: true,
    },
    {
      key:  "points",
      label:`Minimum ${RO_UPGRADE_CONFIG.minPoints} match points`,
      desc: `Must have earned at least ${RO_UPGRADE_CONFIG.minPoints} points working as RO-P at matches`,
      pass: (user.points || 0) >= RO_UPGRADE_CONFIG.minPoints,
    },
    {
      key:  "seminar",
      label:"IROA Level I Seminar",
      desc: "Must have graduated from a verified IROA Level I seminar",
      pass: hasLevelI,
      canOverride: true,
    },
    {
      key:  "years",
      label:`Minimum ${RO_UPGRADE_CONFIG.minActiveYears} active year(s)`,
      desc: `Must have been a registered member for at least ${RO_UPGRADE_CONFIG.minActiveYears * 12} months`,
      pass: yearsActive >= RO_UPGRADE_CONFIG.minActiveYears,
    },
    {
      key:  "quarantine",
      label:`Application quarantine (${RO_UPGRADE_CONFIG.quarantineDays} days)`,
      desc: `Must not have submitted an RO upgrade application within the last ${RO_UPGRADE_CONFIG.quarantineDays} days`,
      pass: daysSinceApp >= RO_UPGRADE_CONFIG.quarantineDays,
      detail: lastApp ? `Last application: ${fmtDate(user.lastROApplication)}` : "No previous application",
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// SEMINARS PAGE
// ─────────────────────────────────────────────────────────────────────────────

function SeminarsPage({ users, setUsers, seminars, setSeminars }) {
  const { currentUser } = useAuth();
  const canEdit = canManageMatches(currentUser);

  const [view,       setView]       = useState(null);    // seminar being viewed
  const [showCreate, setShowCreate] = useState(false);
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const blank = {
    name:"", date:new Date().toISOString().slice(0,10),
    location:"", type:"Level I", instructor:"", status:"upcoming", enrollments:[]
  };
  const [form, setForm] = useState(blank);

  const filtered = seminars.filter(s =>
    (typeFilter==="All"  || s.type===typeFilter) &&
    (statusFilter==="All"|| s.status===statusFilter)
  );

  function createSeminar() {
    if (!form.name.trim()) return;
    setSeminars(prev=>[...prev, { ...form, id:"s"+Date.now() }]);
    setShowCreate(false); setForm(blank);
  }

  // When a seminar is marked completed, auto-grant RO-P to graduated students with None cert
  function completeSeminar(seminar) {
    const updated = { ...seminar, status:"completed" };
    setSeminars(prev => prev.map(s => s.id===seminar.id ? updated : s));

    // Grant RO-P to graduates who have None certification
    seminar.enrollments.forEach(e => {
      if (!e.graduated) return;
      setUsers(prev => prev.map(u => {
        if (u.id !== e.userId) return u;
        if (certRank(u.certification) > 0) return u; // already has a cert
        const entry = { cert:"RO-P", grantedBy:"System (Seminar)", date:new Date().toISOString().slice(0,10), note:`Graduated: ${seminar.name}` };
        const semEntry = { seminarId:seminar.id, type:seminar.type, graduated:true, diplomaVerified:e.diplomaVerified, diplomaDate:e.diplomaDate||new Date().toISOString().slice(0,10) };
        return {
          ...u,
          certification: "RO-P",
          certHistory: [...(u.certHistory||[]), entry],
          seminarHistory: [...(u.seminarHistory||[]), semEntry],
        };
      }));
    });

    // Also update seminarHistory for graduated students already above None
    seminar.enrollments.forEach(e => {
      if (!e.graduated) return;
      setUsers(prev => prev.map(u => {
        if (u.id !== e.userId) return u;
        if (certRank(u.certification) === 0) return u; // handled above
        const already = (u.seminarHistory||[]).some(sh=>sh.seminarId===seminar.id);
        if (already) return u;
        const semEntry = { seminarId:seminar.id, type:seminar.type, graduated:true, diplomaVerified:e.diplomaVerified, diplomaDate:e.diplomaDate||new Date().toISOString().slice(0,10) };
        return { ...u, seminarHistory:[...(u.seminarHistory||[]), semEntry] };
      }));
    });

    setView(updated);
  }

  const typeColor = t => t==="Level I" ? "#38bdf8" : "#a78bfa";

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 4px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.03em",color:"#e2e8f0"}}>Seminars</h1>
          <p style={{color:"#475569",margin:0,fontSize:14}}>IROA certification seminars — {seminars.length} total</p>
        </div>
        {canEdit && <button style={btnP} onClick={()=>{setForm(blank);setShowCreate(true);}}>+ New Seminar</button>}
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{...inp,width:150}}>
          <option value="All">All Types</option>
          <option value="Level I">Level I</option>
          <option value="Level II">Level II</option>
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{...inp,width:150}}>
          <option value="All">All Status</option>
          <option value="upcoming">Upcoming</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Seminar cards */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {filtered.map(s => {
          const instructor = users.find(u=>u.id===s.instructor);
          const graduated  = s.enrollments.filter(e=>e.graduated).length;
          return (
            <div key={s.id} style={{background:"#111418",border:"1px solid #1e2530",borderRadius:10,padding:"18px 22px",display:"flex",gap:18,alignItems:"center"}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:6}}>
                  <span style={{fontSize:16,fontWeight:700,color:"#e2e8f0"}}>{s.name}</span>
                  <Badge label={s.type} color={typeColor(s.type)} />
                  <Badge label={s.status} color={statusColor(s.status)} />
                </div>
                <div style={{display:"flex",gap:16,flexWrap:"wrap",fontSize:12,color:"#64748b"}}>
                  <span>📅 {fmtDate(s.date)}</span>
                  {s.location && <span>📍 {s.location}</span>}
                  <span>👤 Instructor: {instructor?.name||"—"}</span>
                  <span>🎓 {graduated}/{s.enrollments.length} graduated</span>
                </div>
              </div>
              <button onClick={()=>setView(s)} style={{...btnS,padding:"8px 16px",fontSize:13,whiteSpace:"nowrap"}}>
                {canEdit ? "Manage" : "View"}
              </button>
            </div>
          );
        })}
        {filtered.length===0 && (
          <div style={{textAlign:"center",padding:60,color:"#475569",fontSize:14}}>
            No seminars found. {canEdit && "Create the first one above."}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <Modal title="New Seminar" onClose={()=>setShowCreate(false)}>
          <Field label="Seminar Name">
            <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. IROA Level I — Oslo Spring 2026" />
          </Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Type">
              <select style={inp} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                <option value="Level I">Level I</option>
                <option value="Level II">Level II</option>
              </select>
            </Field>
            <Field label="Date">
              <input style={inp} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
            </Field>
          </div>
          <Field label="Location">
            <input style={inp} value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="Club / venue name" />
          </Field>
          <Field label="Instructor" hint="Must be an RM or Admin to instruct">
            <select style={inp} value={form.instructor} onChange={e=>setForm(f=>({...f,instructor:e.target.value}))}>
              <option value="">— Select instructor —</option>
              {users.filter(u=>u.active&&(u.role==="rm"||u.role==="admin")).map(u=>(
                <option key={u.id} value={u.id}>{u.name} ({u.certification})</option>
              ))}
            </select>
          </Field>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
            <button style={btnS} onClick={()=>setShowCreate(false)}>Cancel</button>
            <button style={btnP} onClick={createSeminar}>Create Seminar</button>
          </div>
        </Modal>
      )}

      {/* Manage/View seminar modal */}
      {view && (
        <SeminarDetailModal
          seminar={view}
          users={users}
          setUsers={setUsers}
          canEdit={canEdit}
          onClose={()=>setView(null)}
          onUpdate={updated=>{
            setSeminars(prev=>prev.map(s=>s.id===updated.id?updated:s));
            setView(updated);
          }}
          onComplete={completeSeminar}
        />
      )}
    </div>
  );
}

function SeminarDetailModal({ seminar, users, setUsers, canEdit, onClose, onUpdate, onComplete }) {
  const [tab, setTab]           = useState("students"); // "students" | "enroll"
  const [enrollSearch, setEnrollSearch] = useState("");
  const [confirmComplete, setConfirmComplete] = useState(false);

  const enrolledIds = new Set(seminar.enrollments.map(e=>e.userId));
  const instructor  = users.find(u=>u.id===seminar.instructor);

  // Candidates for enrollment: active users not already enrolled
  const candidates = users.filter(u =>
    u.active &&
    !enrolledIds.has(u.id) &&
    (u.name.toLowerCase().includes(enrollSearch.toLowerCase()) ||
     u.email.toLowerCase().includes(enrollSearch.toLowerCase()))
  );

  function enroll(userId) {
    const updated = { ...seminar, enrollments:[...seminar.enrollments, { userId, attended:false, graduated:false, diplomaVerified:false, diplomaDate:null }] };
    onUpdate(updated);
  }

  function removeEnrollment(userId) {
    const updated = { ...seminar, enrollments:seminar.enrollments.filter(e=>e.userId!==userId) };
    onUpdate(updated);
  }

  function updateEnrollment(userId, patch) {
    const updated = { ...seminar, enrollments:seminar.enrollments.map(e=>e.userId===userId?{...e,...patch}:e) };
    onUpdate(updated);
  }

  const typeColor = t => t==="Level I" ? "#38bdf8" : "#a78bfa";
  const graduated = seminar.enrollments.filter(e=>e.graduated).length;

  const tabBtn = t => ({
    padding:"7px 18px", fontSize:13, fontWeight:600, cursor:"pointer", border:"none", borderRadius:5,
    background:tab===t?"#e85d2c":"transparent", color:tab===t?"#fff":"#64748b"
  });

  return (
    <Modal title={seminar.name} onClose={onClose} wide>
      {/* Header info */}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
        <Badge label={seminar.type}   color={typeColor(seminar.type)} />
        <Badge label={seminar.status} color={statusColor(seminar.status)} />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10,marginBottom:20}}>
        <StatCard label="Date"       value={fmtDate(seminar.date)}       accent="#60a5fa" />
        <StatCard label="Enrolled"   value={seminar.enrollments.length}  accent="#94a3b8" />
        <StatCard label="Graduated"  value={graduated}                   accent="#4ade80" />
        <StatCard label="Instructor" value={instructor?.name||"—"}       accent="#f97316" />
      </div>
      {seminar.location && <div style={{color:"#64748b",fontSize:13,marginBottom:16}}>📍 {seminar.location}</div>}

      {/* Tabs */}
      <div style={{display:"flex",gap:4,background:"#0d1117",padding:4,borderRadius:7,marginBottom:20,width:"fit-content"}}>
        <button style={tabBtn("students")} onClick={()=>setTab("students")}>🎓 Student Roster</button>
        {canEdit && seminar.status==="upcoming" && <button style={tabBtn("enroll")} onClick={()=>setTab("enroll")}>➕ Enroll Students</button>}
      </div>

      {/* Student roster tab */}
      {tab==="students" && (
        <div>
          {seminar.enrollments.length === 0 ? (
            <div style={{textAlign:"center",padding:40,color:"#475569",fontSize:13}}>No students enrolled yet.</div>
          ) : (
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#0d1117"}}>
                  {["Student","Current Cert","Attended","Graduated","Diploma Verified","Diploma Date", canEdit?"":""].map((h,i)=>(
                    <th key={i} style={{padding:"10px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:"1px solid #1e2530"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seminar.enrollments.map((e,i) => {
                  const u = users.find(x=>x.id===e.userId);
                  if (!u) return null;
                  return (
                    <tr key={e.userId} style={{borderBottom:"1px solid #131922",background:i%2===0?"transparent":"#0a0e14"}}>
                      <td style={{padding:"10px 12px"}}>
                        <div style={{fontWeight:600,color:"#e2e8f0",fontSize:13}}>{u.name}</div>
                        <div style={{color:"#475569",fontSize:11}}>{u.email}</div>
                      </td>
                      <td style={{padding:"10px 12px"}}><Badge label={u.certification||"None"} color={certColor(u.certification)} /></td>
                      <td style={{padding:"10px 12px"}}>
                        {canEdit
                          ? <input type="checkbox" checked={e.attended} onChange={ev=>updateEnrollment(e.userId,{attended:ev.target.checked})} style={{width:16,height:16,accentColor:"#e85d2c"}} />
                          : <span style={{color:e.attended?"#4ade80":"#475569"}}>{e.attended?"✓":"—"}</span>
                        }
                      </td>
                      <td style={{padding:"10px 12px"}}>
                        {canEdit
                          ? <input type="checkbox" checked={e.graduated} onChange={ev=>updateEnrollment(e.userId,{graduated:ev.target.checked})} style={{width:16,height:16,accentColor:"#4ade80"}} />
                          : <span style={{color:e.graduated?"#4ade80":"#475569"}}>{e.graduated?"✓":"—"}</span>
                        }
                      </td>
                      <td style={{padding:"10px 12px"}}>
                        {canEdit
                          ? <input type="checkbox" checked={e.diplomaVerified} onChange={ev=>updateEnrollment(e.userId,{diplomaVerified:ev.target.checked})} style={{width:16,height:16,accentColor:"#38bdf8"}} />
                          : <span style={{color:e.diplomaVerified?"#38bdf8":"#475569"}}>{e.diplomaVerified?"✓":"—"}</span>
                        }
                      </td>
                      <td style={{padding:"10px 12px"}}>
                        {canEdit
                          ? <input type="date" style={{...inp,width:140,padding:"5px 8px",fontSize:12}} value={e.diplomaDate||""} onChange={ev=>updateEnrollment(e.userId,{diplomaDate:ev.target.value})} />
                          : <span style={{color:"#64748b",fontSize:12}}>{e.diplomaDate?fmtDate(e.diplomaDate):"—"}</span>
                        }
                      </td>
                      {canEdit && (
                        <td style={{padding:"10px 12px"}}>
                          {seminar.status==="upcoming" && (
                            <button onClick={()=>removeEnrollment(e.userId)} style={{...btnD,padding:"4px 10px",fontSize:11}}>Remove</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Complete seminar button */}
          {canEdit && seminar.status==="upcoming" && seminar.enrollments.length>0 && (
            <div style={{marginTop:24,borderTop:"1px solid #1e2530",paddingTop:20}}>
              {!confirmComplete ? (
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <div style={{fontSize:13,color:"#64748b"}}>
                    Completing the seminar will auto-grant <Badge label="RO-P" color="#86efac" /> to any students who graduated and have no existing certification.
                  </div>
                  <button style={{...btnP,background:"#16a34a",whiteSpace:"nowrap"}} onClick={()=>setConfirmComplete(true)}>
                    ✓ Complete Seminar
                  </button>
                </div>
              ) : (
                <div style={{background:"#111c11",border:"1px solid #166534",borderRadius:8,padding:16}}>
                  <div style={{color:"#86efac",fontWeight:600,marginBottom:10}}>
                    Complete seminar and grant RO-P to {seminar.enrollments.filter(e=>e.graduated).length} graduating student(s)?
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={{...btnP,background:"#16a34a"}} onClick={()=>{ onComplete(seminar); setConfirmComplete(false); }}>Confirm</button>
                    <button style={btnS} onClick={()=>setConfirmComplete(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Enroll tab */}
      {tab==="enroll" && canEdit && (
        <div>
          <input
            style={{...inp,marginBottom:14}}
            value={enrollSearch}
            onChange={e=>setEnrollSearch(e.target.value)}
            placeholder="Search by name or email…"
          />
          {candidates.length===0 ? (
            <div style={{color:"#475569",fontSize:13,textAlign:"center",padding:30}}>No eligible users found.</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {candidates.map(u=>(
                <div key={u.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0d1117",border:"1px solid #1e2530",borderRadius:8,padding:"12px 16px"}}>
                  <div>
                    <div style={{fontWeight:600,color:"#e2e8f0",fontSize:13}}>{u.name}</div>
                    <div style={{color:"#475569",fontSize:11}}>{u.email} · {u.region||"No district"}</div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <Badge label={u.certification||"None"} color={certColor(u.certification)} />
                    <button onClick={()=>enroll(u.id)} style={{...btnP,padding:"6px 14px",fontSize:12}}>Enroll</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function App() {
  const [users,       setUsers]       = useState(seedUsers);
  const [matches,     setMatchesRaw]  = useState(seedMatches);
  const [seminars,    setSeminars]    = useState(seedSeminars);
  const [currentUser, setCurrentUser] = useState(null);
  const [page,        setPage]        = useState("dashboard");
  // Subregion list — seeded from DEFAULT_REGIONS, fully editable by admins at runtime
  const [regions,     setRegions]     = useState(DEFAULT_REGIONS);
  const [menuOpen,    setMenuOpen]    = useState(false);

  function setMatches(updater) {
    setMatchesRaw(prev=>{
      const next=typeof updater==="function"?updater(prev):updater;
      next.forEach(m=>{
        if (m._pointsToDistribute) {
          m.assignments.forEach(a=>{
            setUsers(u=>u.map(r=>r.id===a.roId?{...r,points:r.points+a.pointsAwarded}:r));
          });
        }
      });
      return next.map(m=>{const c={...m};delete c._pointsToDistribute;return c;});
    });
  }

  function login(user)  { setCurrentUser(user); setPage("dashboard"); }
  function logout()     { setCurrentUser(null);  setPage("dashboard"); }

  const admin    = currentUser && isAdmin(currentUser);
  const canMatch = currentUser && canManageMatches(currentUser);

  const NAV = [
    { id:"dashboard", label:"Dashboard",      icon:"◉"  },
    { id:"ros",       label:"Range Officers",  icon:"👥" },
    { id:"matches",   label:"Matches",         icon:"🎯" },
    { id:"seminars",  label:"Seminars",        icon:"🎓" },
    { id:"points",    label:"Points Ledger",   icon:"📊" },
    ...(admin    ? [{ id:"users",   label:"User Database", icon:"🛡️" }] : []),
    ...(currentUser ? [{ id:"profile", label:"My Profile",    icon:"👤" }] : []),
  ];

  if (!currentUser) {
    return (
      <>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');*{box-sizing:border-box;}body{margin:0;}select option{background:#111418;}`}</style>
        <AuthCtx.Provider value={{ currentUser, setCurrentUser }}>
          <AuthScreen users={users} setUsers={setUsers} onLogin={login} regions={regions} />
        </AuthCtx.Provider>
      </>
    );
  }

  return (
    <AuthCtx.Provider value={{ currentUser, setCurrentUser }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; background: #080c10; color: #e2e8f0; font-family: 'Inter', sans-serif; }
        ::-webkit-scrollbar { width: 6px; background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #2a3441; border-radius: 3px; }
        select option { background: #111418; }

        /* ── Desktop: sidebar visible, no mobile chrome ── */
        .ro-sidebar   { display: flex; }
        .ro-topbar    { display: none; }
        .ro-main      { margin-left: 228px; padding: 32px 40px; }
        .ro-backdrop  { display: none; }

        /* ── Mobile (≤ 700px) ── */
        @media (max-width: 700px) {
          .ro-sidebar  { transform: translateX(-100%); transition: transform 0.22s ease; }
          .ro-sidebar.open { transform: translateX(0); }
          .ro-topbar   { display: flex; }
          .ro-main     { margin-left: 0; padding: 16px 14px 90px; }
          .ro-backdrop { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.65); z-index: 90; }
        }
      `}</style>

      {/* Mobile backdrop — closes drawer when tapped */}
      {menuOpen && <div className="ro-backdrop" onClick={()=>setMenuOpen(false)} />}

      <div style={{display:"flex",minHeight:"100vh"}}>

        {/* ── Sidebar (desktop always, mobile as drawer) ── */}
        <aside className={`ro-sidebar${menuOpen?" open":""}`} style={{
          width:228, background:"#0d1117", borderRight:"1px solid #1e2530",
          flexDirection:"column", position:"fixed", top:0, left:0, bottom:0, zIndex:100
        }}>
          <div style={{padding:"22px 20px 18px",borderBottom:"1px solid #1a2030"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:36,height:36,background:"#e85d2c",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎯</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:17,fontWeight:800,color:"#e2e8f0",letterSpacing:"0.06em"}}>IPSC</div>
                <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:"0.1em"}}>RO Manager</div>
              </div>
              {/* Close button — only meaningful on mobile */}
              <button onClick={()=>setMenuOpen(false)} style={{
                background:"none",border:"none",color:"#475569",fontSize:20,cursor:"pointer",
                lineHeight:1,padding:"2px 4px",display:"block"
              }}>×</button>
            </div>
          </div>
          <nav style={{flex:1,padding:"14px 10px",overflowY:"auto"}}>
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>{ setPage(n.id); setMenuOpen(false); }} style={{
                display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",
                background:page===n.id?"#e85d2c18":"transparent",
                border:page===n.id?"1px solid #e85d2c33":"1px solid transparent",
                borderRadius:8,cursor:"pointer",marginBottom:3,textAlign:"left"
              }}>
                <span style={{fontSize:14}}>{n.icon}</span>
                <span style={{fontSize:14,fontWeight:600,color:page===n.id?"#e85d2c":"#64748b"}}>{n.label}</span>
              </button>
            ))}
          </nav>
          {/* User panel */}
          <div style={{padding:"14px 16px",borderTop:"1px solid #1a2030"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:800,color:"#fff",flexShrink:0}}>{currentUser.name.charAt(0)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"#e2e8f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{currentUser.name}</div>
                <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                  <Badge label={currentUser.role} color={roleColor(currentUser.role)} />
                  {currentUser.certification&&currentUser.certification!=="None"&&<Badge label={currentUser.certification} color={certColor(currentUser.certification)} />}
                </div>
              </div>
            </div>
            <button onClick={logout} style={{width:"100%",background:"#1e2530",border:"1px solid #2a3441",borderRadius:6,color:"#64748b",padding:"7px",fontSize:12,cursor:"pointer",fontWeight:600}}>Sign Out</button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:"100vh"}}>

          {/* Mobile top bar — hidden on desktop */}
          <header className="ro-topbar" style={{
            position:"sticky",top:0,zIndex:80,
            background:"#0d1117",borderBottom:"1px solid #1e2530",
            alignItems:"center",justifyContent:"space-between",
            padding:"12px 16px",gap:10
          }}>
            <button onClick={()=>setMenuOpen(true)} style={{
              background:"#1e2530",border:"1px solid #2a3441",borderRadius:7,
              color:"#e2e8f0",padding:"7px 11px",fontSize:15,cursor:"pointer",lineHeight:1,flexShrink:0
            }}>☰</button>
            <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
              <div style={{width:24,height:24,background:"#e85d2c",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,flexShrink:0}}>🎯</div>
              <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:16,fontWeight:800,color:"#e2e8f0",letterSpacing:"0.05em",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                {NAV.find(n=>n.id===page)?.label || "IPSC RO Manager"}
              </span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff"}}>{currentUser.name.charAt(0)}</div>
            </div>
          </header>

          <main className="ro-main" style={{flex:1}}>
            {page==="dashboard"&&<Dashboard users={users} matches={matches} seminars={seminars} />}
            {page==="ros"      &&<ROPage users={users} matches={matches} regions={regions} />}
            {page==="matches"  &&<MatchesPage users={users} matches={matches} setMatches={setMatches} regions={regions} />}
            {page==="seminars" &&<SeminarsPage users={users} setUsers={setUsers} seminars={seminars} setSeminars={setSeminars} />}
            {page==="points"   &&<PointsPage users={users} setUsers={setUsers} matches={matches} />}
            {page==="users"    &&admin&&<UserDatabase users={users} setUsers={setUsers} regions={regions} setRegions={setRegions} />}
            {page==="profile"  &&currentUser&&<MyProfile users={users} setUsers={setUsers} matches={matches} seminars={seminars} regions={regions} />}
          </main>
        </div>

      </div>
    </AuthCtx.Provider>
  );
}
