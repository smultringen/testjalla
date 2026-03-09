import React, { useState, useMemo, createContext, useContext } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const CERT_LEVELS  = ["None", "RO-P", "RO", "CRO", "RM", "Admin"];
const SYSTEM_ROLES = ["member", "rm", "admin"];
// Points per match role. MD and RM are separate by default.
// MD/RM combined role is only available for Level I matches.
// RO-P (Provisional) earns the same points as a full RO while working towards upgrade.
// Points are awarded per match level (NROI Handbook 2026, p.9), not per role.
// Role determines cert-maintenance eligibility, not point value.
const MATCH_LEVEL_POINTS = { "Level I": 1, "Level II": 2, "Level III": 3, "Level IV": 4, "Level V": 5 };
const SEMINAR_INSTRUCTOR_POINTS = 3;  // IROA/NROI Level I or II seminar as instructor

// Legacy role-based lookup kept only for display fallback
const POINT_RULES  = { "RO-P": 1, RO: 1, CRO: 2, RM: 3, MD: 3, "MD/RM": 4 };

const IPSC_DISCIPLINES = ["Handgun", "Rifle", "Shotgun", "Pistol Caliber Carbine", "Mini-Rifle"];

// DQ reasons sourced from IPSC Combined Competition Rules, Chapter 10 (Jan 2026 edition).
// Grouped by section; discipline tags (where they appear) are included in the label.
const DQ_REASONS = [
  {
    group: "10.4 — Accidental Discharge",
    rules: [
      { code:"10.4.1",  label:"Shot travels over backstop, berm or in an unsafe direction" },
      { code:"10.4.2",  label:"Shot strikes ground within 3 metres of competitor" },
      { code:"10.4.3",  label:"Shot fired during loading, reloading or unloading" },
      { code:"10.4.4",  label:"Shot fired during remedial action for a malfunction" },
      { code:"10.4.5",  label:"Shot fired while transferring firearm between hands/shoulders" },
      { code:"10.4.6",  label:"Shot fired during movement (not while actually shooting at targets)" },
      { code:"10.4.7",  label:"Shot fired at metal target below minimum safe distance" },
      { code:"10.4.9",  label:"[Shotgun] Shot fired using slug ammo on a non-slug course" },
      { code:"10.4.10", label:"[Shotgun] Shot fired using buckshot on a birdshot-only course" },
    ]
  },
  {
    group: "10.5 — Unsafe Gun Handling",
    rules: [
      { code:"10.5.1",  label:"Handling firearm outside Safety Area or without RO supervision" },
      { code:"10.5.2",  label:"Muzzle pointed uprange or past safe angle of fire" },
      { code:"10.5.3",  label:"Dropped or caused firearm to fall during course of fire" },
      { code:"10.5.4",  label:"[Handgun] Drawing or holstering inside a tunnel" },
      { code:"10.5.5",  label:"Muzzle sweeping competitor's own body (during course of fire)" },
      { code:"10.5.6",  label:"Muzzle pointing at another person's body" },
      { code:"10.5.7",  label:"[Handgun] Loaded muzzle pointing rearward past 1 m radius during draw/re-holster" },
      { code:"10.5.8",  label:"Wearing or using more than one firearm during course of fire" },
      { code:"10.5.9",  label:"Finger in trigger guard while clearing malfunction (muzzle off targets)" },
      { code:"10.5.10", label:"Finger in trigger guard during loading, reloading or unloading" },
      { code:"10.5.11", label:"Finger in trigger guard during movement (Rule 8.5.1)" },
      { code:"10.5.12", label:"[Handgun] Loaded and holstered in unsafe/uncocked condition" },
      { code:"10.5.13", label:"Handling live or dummy ammunition in a Safety Area" },
      { code:"10.5.14", label:"Loaded firearm when not specifically authorised by RO" },
      { code:"10.5.15", label:"Competitor retrieved own dropped firearm" },
      { code:"10.5.16", label:"Using prohibited/unsafe ammunition or prohibited firearm" },
    ]
  },
  {
    group: "10.6 — Unsportsmanlike Conduct",
    rules: [
      { code:"10.6.1", label:"Unsportsmanlike conduct (cheating, dishonesty, failure to comply with Match Official, bringing sport into disrepute)" },
      { code:"10.6.2", label:"Intentionally removed/caused loss of eye or ear protection to gain reshoot or advantage" },
    ]
  },
  {
    group: "10.7 — Prohibited Substances",
    rules: [
      { code:"10.7", label:"Under influence of alcohol, non-prescription drugs, illegal or performance-enhancing substances" },
    ]
  },
  {
    group: "Other",
    rules: [
      { code:"10.2.12", label:"Second violation of automatic/burst fire rule" },
      { code:"other",   label:"Other reason (describe in notes)" },
    ]
  },
];

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
  // ── Extra seed users for experimentation ──────────────────────────────────
  {
    id: "u7", name: "Tobias Nygård", email: "tobias@example.com", password: "pass7",
    role: "member", certification: "RO-P", region: "Viken-Øst", joined: "2024-01-15",
    active: true, points: 2, notes: "Just started, keen shooter",
    profilePhotoApproved: false, lastROApplication: null,
    iroa: { member: false, since: null },
    seminarHistory: [],
    certHistory: [
      { cert: "RO-P", grantedBy: "Erik Haugen", date: "2024-01-15", note: "Passed intro module" },
    ]
  },
  {
    id: "u8", name: "Ingrid Hoff", email: "ingrid@example.com", password: "pass8",
    role: "member", certification: "RO", region: "Sør", joined: "2022-04-10",
    active: true, points: 11, notes: "Competes in Rifle and Handgun",
    profilePhotoApproved: true, lastROApplication: "2024-11-20",
    iroa: { member: false, since: null },
    seminarHistory: [{ seminarId:"s1", type:"Level I", graduated:true, diplomaVerified:true, diplomaDate:"2024-04-20" }],
    certHistory: [
      { cert: "RO-P", grantedBy: "Silje Dahl",  date: "2022-04-10", note: "" },
      { cert: "RO",   grantedBy: "Silje Dahl",  date: "2022-10-05", note: "" },
    ]
  },
  {
    id: "u9", name: "Henrik Strand", email: "henrik@example.com", password: "pass9",
    role: "rm", certification: "CRO", region: "Innlandet", joined: "2021-08-22",
    active: true, points: 19, notes: "PCC specialist",
    profilePhotoApproved: true, lastROApplication: null,
    iroa: { member: true, since: "2022-09-01" },
    seminarHistory: [{ seminarId:"s2", type:"Level I", graduated:true, diplomaVerified:true, diplomaDate:"2024-09-14" }],
    certHistory: [
      { cert: "RO-P", grantedBy: "System",      date: "2021-08-22", note: "" },
      { cert: "RO",   grantedBy: "System",      date: "2021-12-15", note: "" },
      { cert: "CRO",  grantedBy: "Erik Haugen", date: "2022-06-01", note: "" },
    ]
  },
  {
    id: "u10", name: "Camilla Ås", email: "camilla@example.com", password: "pass10",
    role: "member", certification: "None", region: "Midt", joined: "2025-03-01",
    active: true, points: 0, notes: "Brand new member — awaiting first seminar",
    profilePhotoApproved: false, lastROApplication: null,
    iroa: { member: false, since: null },
    seminarHistory: [],
    certHistory: []
  },
  {
    id: "u11", name: "Frode Bakken", email: "frode@example.com", password: "pass11",
    role: "member", certification: "RO", region: "Viken-Vest", joined: "2021-05-17",
    active: true, points: 9, notes: "Former military background",
    profilePhotoApproved: true, lastROApplication: null,
    iroa: { member: false, since: null },
    seminarHistory: [],
    certHistory: [
      { cert: "RO-P", grantedBy: "System",      date: "2021-05-17", note: "" },
      { cert: "RO",   grantedBy: "Anna Solberg", date: "2021-11-20", note: "" },
    ]
  },
  {
    id: "u12", name: "Ragnhild Persen", email: "ragnhild@example.com", password: "pass12",
    role: "rm", certification: "CRO", region: "Nord", joined: "2020-06-08",
    active: true, points: 26, notes: "Coordinates Nord district matches",
    profilePhotoApproved: true, lastROApplication: null,
    iroa: { member: true, since: "2021-04-15" },
    seminarHistory: [],
    certHistory: [
      { cert: "RO-P", grantedBy: "System",      date: "2020-06-08", note: "" },
      { cert: "RO",   grantedBy: "System",      date: "2020-09-22", note: "" },
      { cert: "CRO",  grantedBy: "Anna Solberg", date: "2021-02-14", note: "" },
    ]
  },
  {
    id: "u13", name: "Ole Mørk", email: "ole@example.com", password: "pass13",
    role: "member", certification: "RO-P", region: "Sør-Vest", joined: "2023-11-03",
    active: true, points: 4, notes: "Shotgun discipline focus",
    profilePhotoApproved: true, lastROApplication: null,
    iroa: { member: false, since: null },
    seminarHistory: [{ seminarId:"s3", type:"Level I", graduated:true, diplomaVerified:true, diplomaDate:"2026-02-08" }],
    certHistory: [
      { cert: "RO-P", grantedBy: "Marte Lund",  date: "2023-11-03", note: "" },
    ]
  },
  {
    id: "u14", name: "Vibeke Thorsen", email: "vibeke@example.com", password: "pass14",
    role: "member", certification: "RO", region: "Bergen", joined: "2022-09-14",
    active: false, points: 8, notes: "Inactive — moved abroad temporarily",
    profilePhotoApproved: true, lastROApplication: null,
    iroa: { member: false, since: null },
    seminarHistory: [],
    certHistory: [
      { cert: "RO-P", grantedBy: "Marte Lund",  date: "2022-09-14", note: "" },
      { cert: "RO",   grantedBy: "Marte Lund",  date: "2023-02-28", note: "" },
    ]
  },
  {
    id: "u15", name: "Kristoffer Lie", email: "kristoffer@example.com", password: "pass15",
    role: "member", certification: "RO-P", region: "Nord-Vest", joined: "2024-06-20",
    active: true, points: 3, notes: "Mini-Rifle specialist, working towards RO",
    profilePhotoApproved: true, lastROApplication: null,
    iroa: { member: false, since: null },
    seminarHistory: [{ seminarId:"s3", type:"Level I", graduated:true, diplomaVerified:true, diplomaDate:"2026-02-08" }],
    certHistory: [
      { cert: "RO-P", grantedBy: "Henrik Strand", date: "2024-06-20", note: "" },
    ]
  },
  {
    id: "u16", name: "Astrid Kolberg", email: "astrid@example.com", password: "pass16",
    role: "member", certification: "RO", region: "Oslo", joined: "2020-02-11",
    active: true, points: 13, notes: "Long-time competitor, first-time RO",
    profilePhotoApproved: true, lastROApplication: "2025-06-15",
    iroa: { member: false, since: null },
    seminarHistory: [{ seminarId:"s1", type:"Level I", graduated:true, diplomaVerified:true, diplomaDate:"2024-04-20" }],
    certHistory: [
      { cert: "RO-P", grantedBy: "Erik Haugen", date: "2020-02-11", note: "" },
      { cert: "RO",   grantedBy: "Erik Haugen", date: "2020-08-03", note: "" },
    ]
  },
  {
    id: "u17", name: "Petter Elstad", email: "petter@example.com", password: "pass17",
    role: "member", certification: "CRO", region: "Oslo", joined: "2019-10-30",
    active: true, points: 18, notes: "Experienced — eligible for RM application",
    profilePhotoApproved: true, lastROApplication: null,
    iroa: { member: true, since: "2021-07-10" },
    seminarHistory: [{ seminarId:"s2", type:"Level I", graduated:true, diplomaVerified:true, diplomaDate:"2024-09-14" }],
    certHistory: [
      { cert: "RO-P", grantedBy: "System",      date: "2019-10-30", note: "" },
      { cert: "RO",   grantedBy: "System",      date: "2020-03-15", note: "" },
      { cert: "CRO",  grantedBy: "Anna Solberg", date: "2020-09-10", note: "" },
    ]
  },
  {
    id: "u18", name: "Tuva Meland", email: "tuva@example.com", password: "pass18",
    role: "member", certification: "None", region: "Midt", joined: "2025-10-05",
    active: true, points: 0, notes: "Enrolled in upcoming seminar",
    profilePhotoApproved: false, lastROApplication: null,
    iroa: { member: false, since: null },
    seminarHistory: [],
    certHistory: []
  },
];

const seedMatches = [
  {
    // Small local match — one person is both MD and RM
    id: "m1", name: "Oslo Club Match #12", date: "2025-11-15", region: "Oslo", hostClubId: "c1",
    level: "Level I", stages: 6, status: "completed",
    combinedMDRM: true, md: "u1", rm: "u1",
    assignments: [
      { roId: "u1", role: "MD/RM", stages: [1,2], pointsAwarded: 1 },
      { roId: "u2", role: "CRO",   stages: [3,4], pointsAwarded: 1 },
      { roId: "u3", role: "RO",    stages: [5,6], pointsAwarded: 1 },
    ]
  },
  {
    // Larger regional — separate MD and RM
    id: "m2", name: "Bergen Regional 2025", date: "2025-12-01", region: "Bergen", hostClubId: "c2",
    level: "Level II", stages: 12, status: "completed",
    combinedMDRM: false, md: "u4", rm: "u1",
    assignments: [
      { roId: "u4", role: "MD",  stages: [],    pointsAwarded: 2 },
      { roId: "u1", role: "RM",  stages: [],    pointsAwarded: 2 },
      { roId: "u2", role: "CRO", stages: [1,2], pointsAwarded: 2 },
      { roId: "u5", role: "RO",  stages: [3,4], pointsAwarded: 2 },
      { roId: "u3", role: "RO",  stages: [5,6], pointsAwarded: 2 },
    ]
  },
  {
    id: "m3", name: "Oslo Winter League #1", date: "2026-01-18", region: "Oslo",
    level: "Level I", stages: 6, status: "upcoming",
    combinedMDRM: true, md: "u1", rm: "u1",
    assignments: []
  },
];


// ─────────────────────────────────────────────────────────────────────────────
// CLUBS
// ─────────────────────────────────────────────────────────────────────────────

// Club role tiers (scoped to each club)
const CLUB_ROLES = ["member", "secretary", "president"];

// Color helper for club roles
function clubRoleColor(r) {
  return { president:"#f97316", secretary:"#facc15", member:"#60a5fa" }[r] || "#9ca3af";
}

// Can this user manage a specific club? (secretary/president OR system admin)
function canManageClub(currentUser, club) {
  if (!currentUser || !club) return false;
  if (currentUser.role === "admin") return true;
  const m = (club.members||[]).find(m=>m.userId===currentUser.id&&m.status==="active");
  return m && (m.role==="secretary"||m.role==="president");
}
function isClubPresident(currentUser, club) {
  if (!currentUser || !club) return false;
  if (currentUser.role === "admin") return true;
  const m = (club.members||[]).find(m=>m.userId===currentUser.id&&m.status==="active");
  return m && m.role==="president";
}

const seedClubs = [
  {
    id: "c1",
    name: "Oslomarka Skytterlag",
    shortName: "OSL",
    region: "Oslo",
    website: "https://oslomarka.no",
    contactEmail: "post@oslomarka.no",
    founded: "2001-03-10",
    active: true,
    description: "One of the largest IPSC clubs in Oslo, running weekly club matches and hosting regional competitions.",
    members: [
      { userId:"u1", role:"president", since:"2021-03-15", status:"active" },
      { userId:"u3", role:"member",    since:"2023-02-20", status:"active" },
      { userId:"u6", role:"secretary", since:"2019-06-22", status:"active" },
      { userId:"u7", role:"member",    since:"2023-10-05", status:"active" },
      { userId:"u16",role:"member",    since:"2024-01-12", status:"active" },
    ]
  },
  {
    id: "c2",
    name: "Bergen Sportsskyttere",
    shortName: "BSS",
    region: "Bergen",
    website: "",
    contactEmail: "bergen.ipsc@example.com",
    founded: "2005-09-01",
    active: true,
    description: "IPSC club based in Bergen, running monthly practical shooting competitions.",
    members: [
      { userId:"u2", role:"president", since:"2022-07-01", status:"active" },
      { userId:"u5", role:"member",    since:"2023-09-10", status:"active" },
      { userId:"u14",role:"secretary", since:"2022-11-01", status:"active" },
    ]
  },
  {
    id: "c3",
    name: "Drammen Pistolklubb",
    shortName: "DPK",
    region: "Viken-Vest",
    website: "",
    contactEmail: "dpk@example.com",
    founded: "2010-04-22",
    active: true,
    description: "Active club in the Drammen area hosting Level I matches and training days.",
    members: [
      { userId:"u9",  role:"president", since:"2020-01-10", status:"active" },
      { userId:"u11", role:"secretary", since:"2021-05-14", status:"active" },
    ]
  },
  {
    id: "c4",
    name: "Trondheim IPSC",
    shortName: "TIPSC",
    region: "Midt",
    website: "",
    contactEmail: "trondheim.ipsc@example.com",
    founded: "2008-11-15",
    active: true,
    description: "The main IPSC club in the Trondheim area.",
    members: [
      { userId:"u10", role:"member", since:"2024-03-01", status:"active" },
      { userId:"u18", role:"member", since:"2025-01-05", status:"active" },
    ]
  },
];


// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTATION — constants & seed data
// ─────────────────────────────────────────────────────────────────────────────

const DOC_CATEGORIES = ["NROI", "IROA", "IPSC", "Other"];

function docCatColor(cat) {
  return { NROI:"#f97316", IROA:"#38bdf8", IPSC:"#4ade80", Other:"#a78bfa" }[cat] || "#9ca3af";
}

function docTypeColor(ext) {
  const e = (ext||"").toLowerCase();
  if (e==="pdf")                         return "#f87171";
  if (e==="doc"||e==="docx")             return "#60a5fa";
  if (e==="xls"||e==="xlsx")             return "#4ade80";
  if (e==="ppt"||e==="pptx")             return "#fb923c";
  if (["png","jpg","jpeg","gif","webp"].includes(e)) return "#c084fc";
  return "#94a3b8";
}

function fmtFileSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024)    return bytes + " B";
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + " KB";
  return (bytes/1048576).toFixed(1) + " MB";
}

// Seed documents — stored as plain-text blobs so download works without a server
const seedDocs = (() => {
  function make(id, name, category, description, ext, uploadedByName, date, body) {
    return { id, name, category, description, fileType:ext,
             fileSize: body.length, uploadedByName, uploadDate: date,
             dataUrl: "data:text/plain;charset=utf-8," + encodeURIComponent(body) };
  }
  return [
    make("d1","NROI RO Handbook 2024.pdf","NROI",
      "Official NROI handbook covering RO duties, procedures and match etiquette.",
      "pdf","Erik Haugen","2024-01-15",
      "NROI Range Officer Handbook\n\n1. INTRODUCTION\nRange Officers are essential to safe and fair competition.\n\n2. DUTIES\n- Safety oversight at all times\n- Stage preparation and reset\n- Competitor briefings before each run\n- Scoring assistance\n\n3. PROCEDURES\nAll ROs must follow the current IPSC rulebook and NROI guidelines at all times.\n\nVersion 2024.1"),
    make("d2","IROA Level I Curriculum.pdf","IROA",
      "Curriculum and learning objectives for IROA Level I seminars.",
      "pdf","Erik Haugen","2024-02-20",
      "IROA Level I Seminar Curriculum\n\nLearning Objectives:\n1. IPSC safety rules\n2. Stage setup and reset\n3. Competitor briefing techniques\n4. Score verification\n5. DQ procedures\n\nDuration: 1 day (8 hours)\nExam: Written + practical assessment"),
    make("d3","IPSC Combined Competition Rules Jan 2026.pdf","IPSC",
      "Full IPSC Combined Competition Rules, effective January 2026.",
      "pdf","Erik Haugen","2026-01-05",
      "IPSC Combined Competition Rules — January 2026\n\nChapter 1  Competitor Requirements\nChapter 2  Course Design\nChapter 3  Scoring\nChapter 4  Range Commands\nChapter 5  Penalties\nChapter 6  Targets\nChapter 7  Equipment\nChapter 8  Malfunctions\nChapter 9  Appeals\nChapter 10 Disqualifications\n\n© IPSC 2026"),
    make("d4","NROI Match Director Checklist.docx","NROI",
      "Pre-match and day-of checklist for Match Directors running NROI-sanctioned competitions.",
      "docx","Anna Solberg","2025-03-10",
      "NROI Match Director Checklist\n\nPRE-MATCH (1 week before)\n[ ] Confirm range booking\n[ ] Submit match to NROI calendar\n[ ] Assign RO staff\n[ ] Order targets and supplies\n\nDAY BEFORE\n[ ] Brief all ROs\n[ ] Set up stages\n[ ] Test timing equipment\n\nMATCH DAY\n[ ] Safety briefing\n[ ] Open registration\n\nPOST-MATCH\n[ ] Submit results to NROI\n[ ] File incident reports if any"),
    make("d5","IPSC Handgun Equipment Rules 2025.pdf","IPSC",
      "Equipment specifications and legal requirements for the IPSC Handgun division.",
      "pdf","Erik Haugen","2025-06-01",
      "IPSC Handgun Division Equipment Rules 2025\n\nOpen: No restrictions, min 9mm, PF 160 Major\nStandard: No optics, 15+1 max, PF 125 Minor\nProduction: Factory guns, 10+1 max, PF 125 Minor\nProduction Optics: As Production with optic sight\nClassic: 1911-style, 8+1 max\nRevolver: Double-action revolvers, 6 rounds\n\nSee full rules at ipsc.org"),
    make("d6","NROI Contacts 2026.xlsx","NROI",
      "Contact information for NROI board members and regional representatives.",
      "xlsx","Anna Solberg","2026-01-20",
      "NROI Contact List 2026\n\nNational Board\nPresident        [on file]\nVice President   [on file]\nSecretary        [on file]\n\nRegional Representatives\nOslo             [on file]\nBergen           [on file]\nNord             [on file]\nMidt             [on file]\nSør              [on file]"),
  ];
})();

const AuthCtx  = createContext(null);
function useAuth()  { return useContext(AuthCtx); }

const ThemeCtx = createContext("dark");
function useTheme() { return useContext(ThemeCtx); }

// ─────────────────────────────────────────────────────────────────────────────
// THEME TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    // surfaces
    bg:          "#080c10",
    surface:     "#0d1117",
    surface2:    "#111418",
    surface3:    "#131922",
    border:      "#1e2530",
    border2:     "#2a3441",
    // text
    textPrimary: "#e2e8f0",
    textSecond:  "#94a3b8",
    textMuted:   "#64748b",
    textFaint:   "#475569",
    // inputs
    inpBg:       "#0d1117",
    inpBorder:   "#2a3441",
    inpText:     "#e2e8f0",
    // scrollbar
    scrollBg:    "#0d1117",
    scrollThumb: "#2a3441",
    // modal backdrop
    backdrop:    "rgba(0,0,0,0.82)",
    // misc
    selectOption:"#111418",
    shadowLg:    "0 24px 80px rgba(0,0,0,0.85)",
  },
  light: {
    bg:          "#f1f5f9",
    surface:     "#ffffff",
    surface2:    "#f8fafc",
    surface3:    "#f1f5f9",
    border:      "#e2e8f0",
    border2:     "#cbd5e1",
    textPrimary: "#0f172a",
    textSecond:  "#334155",
    textMuted:   "#64748b",
    textFaint:   "#94a3b8",
    inpBg:       "#ffffff",
    inpBorder:   "#cbd5e1",
    inpText:     "#0f172a",
    scrollBg:    "#f1f5f9",
    scrollThumb: "#cbd5e1",
    backdrop:    "rgba(15,23,42,0.55)",
    selectOption:"#ffffff",
    shadowLg:    "0 24px 80px rgba(15,23,42,0.18)",
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function uid() { return "u" + Math.random().toString(36).slice(2, 9); }

function certColor(c) {
  return { "RO-P":"#86efac", RO:"#4ade80", CRO:"#facc15", RM:"#f97316", MD:"#e85d2c", Admin:"#c084fc", "MD/RM":"#fb923c", None:"var(--text-faint)" }[c] || "#9ca3af";
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
    <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, padding:"18px 22px", minWidth:120, flex:1 }}>
      <div style={{ fontSize:28, fontWeight:800, color:accent||"var(--text-primary)", fontFamily:"'Barlow Condensed',sans-serif" }}>{value}</div>
      <div style={{ fontSize:12, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginTop:2 }}>{label}</div>
      {sub && <div style={{ fontSize:11, color:"var(--text-faint)", marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{
      position:"fixed", inset:0, background:"var(--backdrop)", zIndex:1000,
      display:"flex", alignItems:"flex-start", justifyContent:"center",
      padding:"20px 20px", overflowY:"auto"
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12,
        width:"100%", maxWidth:wide?820:640,
        boxShadow:"var(--shadow-lg)", margin:"auto", flexShrink:0
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"20px 26px", borderBottom:"1px solid var(--border)", position:"sticky", top:0, background:"var(--surface)", zIndex:10, borderRadius:"12px 12px 0 0" }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:"var(--text-primary)", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"0.04em" }}>{title}</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:22, lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:"26px" }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, hint, error }) {
  return (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", fontSize:11, fontWeight:600, color:error?"#f87171":"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{label}{error&&<span style={{fontWeight:400,textTransform:"none",marginLeft:6}}>— {error}</span>}</label>
      {children}
      {hint && !error && <div style={{ fontSize:11, color:"var(--text-faint)", marginTop:4 }}>{hint}</div>}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"1px solid var(--surface3)", fontSize:13 }}>
      <span style={{ color:"var(--text-faint)" }}>{label}</span>
      <span style={{ color:"var(--text-second)", fontWeight:500 }}>{value}</span>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:12, margin:"20px 0" }}>
      <div style={{ flex:1, height:1, background:"var(--border)" }} />
      {label && <span style={{ color:"var(--text-faint)", fontSize:11, textTransform:"uppercase", letterSpacing:"0.09em" }}>{label}</span>}
      <div style={{ flex:1, height:1, background:"var(--border)" }} />
    </div>
  );
}

// RegionSelect — dropdown built from the live regions list.
// Shows an "Other / free text" escape so users can still type a custom value
// if their region isn't in the list yet. Admins can permanently add new
// regions via the User Database → Region Settings panel.
function RegionSelect({ value, onChange, regions, placeholder = "— Select district —", style, hasError }) {
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
          style={{ ...inp, ...(style||{}), flex:1, ...(hasError ? {border:"1.5px solid #f87171",background:"#f8717108"} : {}) }}
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
      style={{ ...inp, ...(style||{}), ...(hasError ? {border:"1.5px solid #f87171",background:"#f8717108"} : {}) }}
      value={regions.includes(value) ? value : ""}
      onChange={handleSelect}
    >
      <option value="">{placeholder}</option>
      {[...regions].sort().map(r => <option key={r} value={r}>{r}</option>)}
      <option value="__other__">Other / not listed…</option>
    </select>
  );
}

// inp / btnS use CSS variables set on :root by the App shell — theme-aware without prop drilling
const inp  = { width:"100%", boxSizing:"border-box", background:"var(--inp-bg)", border:"1px solid var(--inp-border)", borderRadius:6, padding:"9px 12px", color:"var(--inp-text)", fontSize:14, outline:"none", fontFamily:"inherit" };
const btnS = { background:"var(--surface2)", border:"1px solid var(--border2)", borderRadius:6, color:"var(--text-second)", padding:"10px 20px", fontSize:14, fontWeight:600, cursor:"pointer" };
const btnP = { background:"#e85d2c", border:"none", borderRadius:6, color:"#fff", padding:"10px 20px", fontSize:14, fontWeight:700, cursor:"pointer", letterSpacing:"0.04em" };
const btnD = { background:"var(--surface2)", border:"1px solid #f8717144", borderRadius:6, color:"#f87171", padding:"10px 20px", fontSize:14, fontWeight:600, cursor:"pointer" };
// Returns style for an input field — red border when invalid
function errInp(err) { return err ? { ...inp, border:"1.5px solid #f87171", background:"#f8717108" } : inp; }


// ─────────────────────────────────────────────────────────────────────────────
// USER PICKER  — searchable combobox for any user list
// Props:
//   users      — array of { id, name, ...extra } to pick from
//   value      — currently selected id (string) or "" for none
//   onChange   — (id) => void
//   placeholder — string shown when empty
//   labelFn    — optional (user) => string  for the option label (default: name + cert)
//   style      — optional extra style for the wrapper
// ─────────────────────────────────────────────────────────────────────────────

function UserPicker({ users, value, onChange, placeholder = "— Select user —", labelFn, style, hasError }) {
  const defaultLabel = u => u.certification && u.certification !== "None"
    ? `${u.name} (${u.certification})`
    : u.name;
  const label = labelFn || defaultLabel;

  const selected = users.find(u => u.id === value) || null;

  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState("");
  const [dropPos, setDropPos] = useState({ top:0, left:0, width:0 });
  const inputRef  = React.useRef(null);
  const triggerRef = React.useRef(null);
  const wrapRef   = React.useRef(null);

  // Position the fixed dropdown relative to the trigger button
  function calcPos() {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    // Decide whether to open upward if too close to bottom
    const spaceBelow = window.innerHeight - r.bottom;
    const dropH = Math.min(300, users.length * 38 + 60);
    const openUp = spaceBelow < dropH && r.top > dropH;
    setDropPos({
      top: openUp ? r.top - dropH - 4 : r.bottom + 4,
      left: r.left,
      width: r.width,
      openUp
    });
  }

  // Close on outside click or scroll
  React.useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target) &&
          !document.getElementById("userpicker-portal")?.contains(e.target)) {
        setOpen(false); setQuery("");
      }
    }
    function onScroll() { if (open) { calcPos(); } }
    document.addEventListener("mousedown", handler);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return q ? users.filter(u => label(u).toLowerCase().includes(q)) : users;
  }, [users, query]);

  function select(id) { onChange(id); setOpen(false); setQuery(""); }

  function handleTriggerClick() {
    calcPos();
    setOpen(o => !o);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 30);
  }

  const theme = useTheme();

  return (
    <div ref={wrapRef} style={{ position:"relative", width:"100%", ...(style||{}) }}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        style={{
          ...inp, textAlign:"left", cursor:"pointer", display:"flex",
          alignItems:"center", justifyContent:"space-between", gap:8,
          paddingRight:10, userSelect:"none",
          ...(hasError ? {border:"1.5px solid #f87171",background:"#f8717108"} : {})
        }}
      >
        <span style={{ color: selected ? "var(--text-primary)" : "var(--text-faint)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>
          {selected ? label(selected) : placeholder}
        </span>
        <span style={{ color:"var(--text-faint)", fontSize:11, flexShrink:0 }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown — rendered via a portal-like fixed div to escape any overflow:hidden/auto parent */}
      {open && (
        <div
          id="userpicker-portal"
          style={{
            position:"fixed",
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background:"var(--surface)",
            border:"1px solid var(--border2)",
            borderRadius:8,
            boxShadow: theme === "dark"
              ? "0 12px 40px rgba(0,0,0,0.75)"
              : "0 8px 32px rgba(0,0,0,0.18)",
            overflow:"hidden"
          }}
        >
          {/* Search input */}
          <div style={{ padding:"8px 10px", borderBottom:"1px solid var(--border)" }}>
            <input
              ref={inputRef}
              style={{ ...inp, padding:"7px 10px", fontSize:13 }}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search…"
              onClick={e => e.stopPropagation()}
            />
          </div>
          {/* Option list */}
          <div style={{ maxHeight:220, overflowY:"auto" }}>
            <div
              onClick={() => select("")}
              style={{
                padding:"9px 14px", cursor:"pointer", fontSize:13,
                color: !value ? "#e85d2c" : "var(--text-faint)",
                background: !value ? "var(--surface3)" : "transparent",
                borderBottom:"1px solid var(--border)"
              }}
            >{placeholder}</div>
            {filtered.length === 0 && (
              <div style={{ padding:"12px 14px", color:"var(--text-faint)", fontSize:13 }}>No results for "{query}"</div>
            )}
            {filtered.map(u => (
              <div
                key={u.id}
                onClick={() => select(u.id)}
                style={{
                  padding:"9px 14px", cursor:"pointer", fontSize:13,
                  color: u.id === value ? "#e85d2c" : "var(--text-primary)",
                  background: u.id === value ? "var(--surface3)" : "transparent",
                  borderBottom:"1px solid var(--surface3)",
                  transition:"background 0.1s"
                }}
                onMouseEnter={e => { if (u.id !== value) e.currentTarget.style.background = "var(--surface3)"; }}
                onMouseLeave={e => { if (u.id !== value) e.currentTarget.style.background = "transparent"; }}
              >
                {label(u)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH SCREEN
// ─────────────────────────────────────────────────────────────────────────────

function AuthScreen({ users, setUsers, onLogin, regions }) {
  const [mode, setMode]   = useState("login");
  const [form, setForm]   = useState({ name:"", email:"", password:"", confirm:"", region:"" });
  const [error, setError] = useState("");
  const [fe, setFe]       = useState({});   // field errors for register form

  const f = k => e => { setForm(p => ({...p,[k]:e.target.value})); setError(""); setFe(p=>({...p,[k]:false})); };

  function login() {
    const user = users.find(u => u.email.toLowerCase() === form.email.toLowerCase() && u.password === form.password);
    if (!user)        { setError("Invalid email or password."); return; }
    if (!user.active) { setError("Account deactivated. Contact an administrator."); return; }
    onLogin(user);
  }

  function register() {
    const errs = {};
    if (!form.name.trim())    errs.name     = true;
    if (!form.email.trim())   errs.email    = true;
    if (!form.password)       errs.password = true;
    if (Object.keys(errs).length) { setFe(errs); setError(""); return; }
    if (form.password !== form.confirm)  { setFe({confirm:true}); setError("Passwords do not match."); return; }
    if (form.password.length < 4)        { setFe({password:true}); setError("Password must be at least 4 characters."); return; }
    if (users.find(u => u.email.toLowerCase() === form.email.toLowerCase())) { setFe({email:true}); setError("Email already registered."); return; }
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
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"Inter,sans-serif" }}>
      <div style={{ position:"fixed", top:"-15%", right:"-8%", width:480, height:480, borderRadius:"50%", background:"radial-gradient(circle,#e85d2c16 0%,transparent 70%)", pointerEvents:"none" }} />
      <div style={{ position:"fixed", bottom:"-15%", left:"-8%", width:380, height:380, borderRadius:"50%", background:"radial-gradient(circle,#60a5fa0d 0%,transparent 70%)", pointerEvents:"none" }} />
      <div style={{ width:"100%", maxWidth:430 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:60, height:60, background:"#e85d2c", borderRadius:16, display:"inline-flex", alignItems:"center", justifyContent:"center", fontSize:30, marginBottom:18 }}>🎯</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:30, fontWeight:800, color:"var(--text-primary)", letterSpacing:"0.05em" }}>IPSC RO Manager</div>
          <div style={{ fontSize:13, color:"var(--text-faint)", marginTop:4 }}>Range Officer Management System</div>
        </div>

        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:34, boxShadow:"0 24px 70px rgba(0,0,0,0.65)" }}>
          {/* Tab */}
          <div style={{ display:"flex", background:"var(--surface2)", borderRadius:9, padding:4, marginBottom:28 }}>
            {["login","register"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); setFe({}); }} style={{
                flex:1, padding:"9px", border:"none", borderRadius:6, cursor:"pointer", fontSize:14, fontWeight:600,
                background:mode===m?"#e85d2c":"transparent", color:mode===m?"#fff":"var(--text-muted)", transition:"all 0.15s"
              }}>{m==="login"?"Sign In":"Register"}</button>
            ))}
          </div>

          {error && <div style={{ background:"#f8717115", border:"1px solid #f8717155", borderRadius:7, padding:"10px 14px", color:"#f87171", fontSize:13, marginBottom:18 }}>{error}</div>}

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
                    <span style={{color:"var(--text-second)"}}>{d.label}: {d.email} / {d.pass}</span>
                    <Badge label={d.role} color={roleColor(d.role)} />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <Field label="Full Name" error={fe.name?"Required":undefined}><input style={errInp(fe.name)} value={form.name} onChange={f("name")} placeholder="Your full name" /></Field>
              <Field label="Email" error={fe.email?"Required":undefined}><input style={errInp(fe.email)} type="email" value={form.email} onChange={f("email")} placeholder="your@email.com" /></Field>
              <Field label="District (optional)">
                <RegionSelect value={form.region} onChange={v=>setForm(p=>({...p,region:v}))} regions={regions} placeholder="— Select your district —" />
              </Field>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <Field label="Password" error={fe.password?"Required":undefined}><input style={errInp(fe.password)} type="password" value={form.password} onChange={f("password")} placeholder="Min. 4 chars" /></Field>
                <Field label="Confirm" error={fe.confirm?"Mismatch":undefined}><input style={errInp(fe.confirm)} type="password" value={form.confirm} onChange={f("confirm")} placeholder="Repeat" onKeyDown={e=>e.key==="Enter"&&register()} /></Field>
              </div>
              <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:7, padding:"11px 14px", fontSize:12, color:"var(--text-faint)", marginBottom:16 }}>
                New accounts start as <Badge label="member" color="#60a5fa" /> with <Badge label="No Cert" color="var(--text-faint)" />. An admin must grant your RO certification before you can be assigned to matches.
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
      <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 4px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.03em",color:"var(--text-primary)"}}>Dashboard</h1>
      <p style={{color:"var(--text-faint)",marginBottom:28,fontSize:14}}>System-wide overview</p>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:28}}>
        <StatCard label="Registered Users"  value={users.length}    sub={`${activeUsers} active`}  accent="#4ade80" />
        <StatCard label="Certified ROs"     value={certifiedROs}    accent="#facc15" />
        <StatCard label="Upcoming Matches"  value={upcomingMatches} accent="#60a5fa" />
        <StatCard label="Completed Matches" value={completedMatches}accent="#6b7280" />
        <StatCard label="Seminars Scheduled"value={upcomingSeminars}accent="#38bdf8" />
        <StatCard label="Total Points"      value={totalPoints}     accent="#e85d2c" />
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:20}}>
          <h3 style={{margin:"0 0 16px",fontSize:13,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Certification Breakdown</h3>
          {certBreakdown.map(({cert,count})=>(
            <div key={cert} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <Badge label={cert} color={certColor(cert)} />
              <div style={{flex:1,background:"var(--border)",borderRadius:4,height:6,overflow:"hidden"}}>
                <div style={{width:`${(count/(certifiedROs||1))*100}%`,background:certColor(cert),height:"100%",borderRadius:4}} />
              </div>
              <span style={{color:"var(--text-second)",fontSize:13,fontWeight:600,minWidth:20}}>{count}</span>
            </div>
          ))}
        </div>
        <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:20}}>
          <h3 style={{margin:"0 0 16px",fontSize:13,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Points Leaderboard</h3>
          {[...users].filter(u=>u.active).sort((a,b)=>b.points-a.points).slice(0,6).map((u,i)=>(
            <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <span style={{fontSize:11,color:i<3?"#facc15":"var(--text-faint)",fontWeight:700,minWidth:20}}>#{i+1}</span>
              <span style={{flex:1,color:"var(--text-primary)",fontSize:14}}>{u.name}</span>
              <Badge label={u.certification||"None"} color={certColor(u.certification)} />
              <span style={{color:"#e85d2c",fontWeight:800,fontSize:15,fontFamily:"'Barlow Condensed',sans-serif",minWidth:28,textAlign:"right"}}>{u.points}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:20}}>
        <h3 style={{margin:"0 0 16px",fontSize:13,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Recent Matches</h3>
        {recentMatches.map(m=>{
          const mdUser=users.find(u=>u.id===m.md);
          const rmUser=users.find(u=>u.id===m.rm);
          const staffStr = m.combinedMDRM
            ? `MD/RM: ${mdUser?.name||"—"}`
            : `MD: ${mdUser?.name||"—"} · RM: ${rmUser?.name||"—"}`;
          return (
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:14,padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
              <Badge label={m.status} color={statusColor(m.status)} />
              <div style={{flex:1}}>
                <div style={{color:"var(--text-primary)",fontWeight:600,fontSize:14}}>{m.name}</div>
                <div style={{color:"var(--text-faint)",fontSize:12,marginTop:2}}>{fmtDate(m.date)} · {m.region} · {m.stages} stages · {staffStr}</div>
              </div>
              <Badge label={m.level} color="#7c8cf8" />
              <span style={{color:"var(--text-muted)",fontSize:12}}>{m.assignments.length} ROs</span>
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

function MyProfile({ users, setUsers, matches, seminars, regions, applications, setApplications, clubs, setClubs }) {
  const { currentUser, setCurrentUser } = useAuth();
  const user = users.find(u=>u.id===currentUser.id) || currentUser;

  const [editMode,  setEditMode]  = useState(false);
  const [form,      setForm]      = useState({ name:user.name, region:user.region, notes:user.notes, email:user.email, iroa: user.iroa || { member:false, since:null } });
  const [profileFe, setProfileFe] = useState({});
  const [pwForm,    setPwForm]    = useState({ current:"", next:"", confirm:"" });
  const [pwError,   setPwError]   = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  const myMatches = useMemo(() =>
    matches.filter(m=>m.assignments.some(a=>a.roId===user.id))
      .map(m=>({...m, assignment:m.assignments.find(a=>a.roId===user.id)}))
  ,[matches,user.id]);

  const mySeminars = useMemo(()=>{
    return (seminars||[]).filter(s=>s.enrollments.some(e=>e.userId===user.id))
      .map(s=>({ ...s, enrollment:s.enrollments.find(e=>e.userId===user.id) }));
  },[seminars,user.id]);

  const myApplications = useMemo(()=>
    (applications||[]).filter(a=>a.userId===user.id)
      .sort((a,b)=>new Date(b.date)-new Date(a.date))
  ,[applications,user.id]);

  const myClubs = useMemo(()=>
    (clubs||[]).filter(c=>(c.members||[]).some(m=>m.userId===user.id&&m.status==="active"))
      .map(c=>({ ...c, membership:(c.members||[]).find(m=>m.userId===user.id) }))
  ,[clubs,user.id]);

  const myPendingClubApps = useMemo(()=>
    (applications||[]).filter(a=>a.type==="club_membership"&&a.userId===user.id&&a.status==="pending")
  ,[applications,user.id]);

  // Which cert/IROA types already have a pending application?
  const pendingTypes = new Set(myApplications.filter(a=>a.status==="pending").map(a=>a.type));

  function saveProfile() {
    if (!form.name.trim()) { setProfileFe({name:true}); return; }
    setProfileFe({});
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

  function submitApplication(type, note) {
    const today = new Date().toISOString().slice(0,10);
    const app = {
      id: "app" + Date.now(),
      userId: user.id, userName: user.name,
      userCert: user.certification, userRegion: user.region,
      type, date: today, note: note||"",
      status: "pending", reviewedBy: null, reviewedDate: null, reviewNote: ""
    };
    setApplications(prev=>[...prev, app]);
    // Record last application date on the user (used by quarantine check for RO)
    if (type==="RO") setUsers(prev=>prev.map(u=>u.id===user.id?{...u,lastROApplication:today}:u));
  }

  return (
    <div>
      <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 4px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.03em",color:"var(--text-primary)"}}>My Profile</h1>
      <p style={{color:"var(--text-faint)",marginBottom:28,fontSize:14}}>Your account, certifications and match history</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        {/* Left */}
        <div>
          <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:24,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
              <div style={{width:54,height:54,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:"#fff",fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0}}>{user.name.charAt(0)}</div>
              <div>
                <div style={{fontSize:18,fontWeight:700,color:"var(--text-primary)"}}>{user.name}</div>
                <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                  <Badge label={user.role}                  color={roleColor(user.role)} />
                  <Badge label={user.certification||"No Cert"} color={certColor(user.certification)} />
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:10,marginBottom:20}}>
              <StatCard label="Points"  value={user.points}       accent="#e85d2c" />
              <StatCard label="Matches" value={myMatches.length}  accent="#60a5fa" />
              <StatCard label="Clubs"   value={myClubs.length}   accent="#7c8cf8" />
            </div>
            {!editMode ? (
              <>
                <InfoRow label="Email"    value={user.email} />
                <InfoRow label="District" value={user.region||"—"} />
                <InfoRow label="Joined"   value={fmtDate(user.joined)} />
                <InfoRow label="IROA Member" value={
                  user.iroa?.member
                    ? <span>Yes {user.iroa.since ? <span style={{color:"var(--text-faint)",fontSize:12}}>since {fmtDate(user.iroa.since)}</span> : ""}</span>
                    : "No"
                } />
                {user.notes&&<InfoRow label="Notes" value={user.notes}/>}
                <button style={{...btnS,marginTop:14}} onClick={()=>setEditMode(true)}>Edit Profile</button>
              </>
            ) : (
              <>
                <Field label="Full Name"><input style={errInp(profileFe.name)} value={form.name}   onChange={e=>{setForm(f=>({...f,name:e.target.value}));setProfileFe(p=>({...p,name:false}));}} /></Field>
                <Field label="Email">    <input style={inp} type="email" value={form.email}  onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></Field>
                <Field label="District">
                  <RegionSelect value={form.region} onChange={v=>setForm(f=>({...f,region:v}))} regions={regions} />
                </Field>
                <Field label="Notes">   <textarea style={{...inp,height:60,resize:"vertical"}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></Field>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 0",borderBottom:"1px solid var(--surface3)",marginBottom:12}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",flex:1}}>
                    <input type="checkbox" checked={!!form.iroa?.member}
                      onChange={e=>setForm(f=>({...f,iroa:{...f.iroa,member:e.target.checked,since:e.target.checked?(f.iroa?.since||new Date().toISOString().slice(0,10)):null}}))}
                      style={{width:16,height:16,accentColor:"#e85d2c"}} />
                    <span style={{fontSize:13,color:"var(--text-primary)",fontWeight:600}}>IROA Member</span>
                  </label>
                  {form.iroa?.member && (
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <label style={{fontSize:11,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"}}>Since</label>
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
          <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:24}}>
            <h3 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Change Password</h3>
            {pwError   && <div style={{background:"#f8717115",border:"1px solid #f8717155",borderRadius:6,padding:"9px 13px",color:"#f87171",fontSize:13,marginBottom:12}}>{pwError}</div>}
            {pwSuccess && <div style={{background:"#0a2a15",border:"1px solid #164a20",borderRadius:6,padding:"9px 13px",color:"#4ade80",fontSize:13,marginBottom:12}}>Password updated successfully.</div>}
            <Field label="Current Password"><input style={inp} type="password" value={pwForm.current} onChange={pf("current")} /></Field>
            <Field label="New Password">    <input style={inp} type="password" value={pwForm.next}    onChange={pf("next")} /></Field>
            <Field label="Confirm New">     <input style={inp} type="password" value={pwForm.confirm} onChange={pf("confirm")} /></Field>
            <button style={btnP} onClick={changePw}>Update Password</button>
          </div>
        </div>
        {/* Right */}
        <div>
          <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:24,marginBottom:16}}>
            <h3 style={{margin:"0 0 16px",fontSize:13,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Certification History</h3>
            {(!user.certHistory||user.certHistory.length===0)
              ? <p style={{color:"var(--text-faint)",fontSize:13}}>No certifications on record yet. Contact an administrator.</p>
              : [...user.certHistory].reverse().map((c,i,arr)=>(
                <div key={i} style={{display:"flex",gap:12,paddingBottom:i<arr.length-1?14:0}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:certColor(c.cert),flexShrink:0,marginTop:4}} />
                    {i<arr.length-1&&<div style={{width:2,flex:1,background:"var(--border)",marginTop:4}}/>}
                  </div>
                  <div style={{flex:1,paddingBottom:4}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}><Badge label={c.cert} color={certColor(c.cert)} /><span style={{color:"var(--text-muted)",fontSize:12}}>{fmtDate(c.date)}</span></div>
                    <div style={{color:"var(--text-faint)",fontSize:12,marginTop:4}}>Granted by: {c.grantedBy}</div>
                    {c.note&&<div style={{color:"var(--text-muted)",fontSize:12,fontStyle:"italic",marginTop:2}}>{c.note}</div>}
                  </div>
                </div>
              ))
            }
          </div>

          {/* RO Upgrade Checklist — only shown for RO-P holders */}
          {user.certification==="RO-P" && (()=>{
            const checklist = computeROChecklist(user, matches);
            const allPass   = checklist.every(c=>c.pass);
            return (
              <div style={{background:"var(--surface2)",border:`1px solid ${allPass?"#4ade8066":"var(--border)"}`,borderRadius:8,padding:24,marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                  <h3 style={{margin:0,fontSize:13,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>RO Upgrade Checklist</h3>
                  {allPass && <Badge label="All Requirements Met" color="#4ade80" />}
                </div>
                <p style={{fontSize:12,color:"var(--text-faint)",margin:"0 0 16px"}}>
                  These checks must all pass before applying for a full <Badge label="RO" color="#4ade80" /> upgrade. If you believe a result is incorrect, contact NROI directly.
                </p>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
                  {checklist.map(item=>(
                    <div key={item.key} style={{
                      display:"flex",alignItems:"flex-start",gap:12,
                      padding:"10px 12px",borderRadius:7,
                      background:item.pass?"#4ade8015":"#f8717115",
                      border:`1px solid ${item.pass?"#4ade8066":"#f8717155"}`
                    }}>
                      <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{item.pass ? "✅" : "❌"}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13,fontWeight:600,color:item.pass?"#86efac":"#fca5a5"}}>{item.label}</div>
                        <div style={{fontSize:11,color:"var(--text-faint)",marginTop:2}}>{item.desc}</div>
                        {item.detail&&<div style={{fontSize:11,color:"var(--text-muted)",marginTop:2,fontStyle:"italic"}}>{item.detail}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {pendingTypes.has("RO") ? (
                  <div style={{background:"#60a5fa15",border:"1px solid #60a5fa44",borderRadius:7,padding:"12px 14px",color:"#60a5fa",fontSize:13}}>
                    ⏳ RO upgrade application is pending review.
                  </div>
                ) : allPass ? (
                  <button style={{...btnP,background:"#16a34a",width:"100%"}} onClick={()=>submitApplication("RO")}>
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

          {/* Certification upgrade applications — CRO, RM, IROA */}
          <CertApplicationPanel user={user} pendingTypes={pendingTypes} submitApplication={submitApplication} />

          {/* Club memberships */}
          {(myClubs.length > 0 || myPendingClubApps.length > 0) && (
            <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:24,marginBottom:16}}>
              <h3 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Club Memberships</h3>
              {myClubs.map(c=>(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
                  <div style={{width:36,height:36,borderRadius:8,background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",letterSpacing:"0.05em",fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0}}>
                    {c.shortName.slice(0,3)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{color:"var(--text-primary)",fontWeight:600,fontSize:14}}>{c.name}</div>
                    <div style={{fontSize:12,color:"var(--text-faint)",marginTop:2}}>
                      {c.region} · Member since {fmtDate(c.membership?.since)}
                    </div>
                  </div>
                  <Badge label={c.membership?.role||"member"} color={clubRoleColor(c.membership?.role)} />
                </div>
              ))}
              {myPendingClubApps.map(a=>{
                const club = (clubs||[]).find(c=>c.id===a.clubId);
                return (
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border)",opacity:0.7}}>
                    <div style={{width:36,height:36,borderRadius:8,background:"var(--surface3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"var(--text-faint)",fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0}}>
                      {(club?.shortName||"?").slice(0,3)}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{color:"var(--text-primary)",fontWeight:600,fontSize:14}}>{club?.name||"Unknown Club"}</div>
                      <div style={{fontSize:12,color:"var(--text-faint)",marginTop:2}}>Applied {fmtDate(a.date)}</div>
                    </div>
                    <Badge label="⏳ pending" color="#60a5fa" />
                  </div>
                );
              })}
            </div>
          )}
          {/* My application history */}
          {myApplications.length > 0 && (
            <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:24,marginBottom:16}}>
              <h3 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>My Applications</h3>
              {myApplications.map(app=>(
                <div key={app.id} style={{padding:"11px 0",borderBottom:"1px solid var(--border)",display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontWeight:600,color:"var(--text-primary)",fontSize:13}}>
                        {app.type==="IROA" ? "IROA Membership"
                          : app.type==="club_membership"
                            ? `Club Membership: ${(clubs||[]).find(c=>c.id===app.clubId)?.name||"Unknown Club"}`
                            : `${app.type} Certification`}
                      </span>
                      <Badge
                        label={app.status}
                        color={app.status==="pending"?"#60a5fa":app.status==="approved"?"#4ade80":"#f87171"}
                      />
                    </div>
                    <div style={{color:"var(--text-faint)",fontSize:11,marginTop:3}}>Submitted {fmtDate(app.date)}</div>
                    {app.note&&<div style={{color:"var(--text-muted)",fontSize:12,marginTop:3,fontStyle:"italic"}}>{app.note}</div>}
                    {app.reviewNote&&<div style={{color:"var(--text-second)",fontSize:12,marginTop:3}}>Review note: {app.reviewNote}</div>}
                    {app.reviewedBy&&<div style={{color:"var(--text-faint)",fontSize:11,marginTop:2}}>Reviewed by {app.reviewedBy} on {fmtDate(app.reviewedDate)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Seminar History */}
          <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:24,marginBottom:16}}>
            <h3 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Seminar History</h3>
            {mySeminars.length===0
              ? <p style={{color:"var(--text-faint)",fontSize:13}}>No seminars on record.</p>
              : mySeminars.map(s=>(
                <div key={s.id} style={{padding:"10px 0",borderBottom:"1px solid var(--border)",display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{color:"var(--text-primary)",fontSize:13,fontWeight:600}}>{s.name}</div>
                    <div style={{color:"var(--text-faint)",fontSize:11,marginTop:3}}>{fmtDate(s.date)} {s.location?"· "+s.location:""}</div>
                    <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                      <Badge label={s.type} color={s.type==="Level I"?"#38bdf8":"#a78bfa"} />
                      {s.enrollment.graduated&&<Badge label="Graduated" color="#4ade80" />}
                      {s.enrollment.diplomaVerified&&<Badge label="Diploma Verified" color="#38bdf8" />}
                    </div>
                  </div>
                  {s.enrollment.diplomaDate&&<span style={{color:"var(--text-faint)",fontSize:11,whiteSpace:"nowrap"}}>{fmtDate(s.enrollment.diplomaDate)}</span>}
                </div>
              ))
            }
          </div>

          <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:24}}>
            <h3 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Match History</h3>
            {myMatches.length===0
              ? <p style={{color:"var(--text-faint)",fontSize:13}}>No match assignments yet.</p>
              : myMatches.map(m=>(
                <div key={m.id} style={{display:"flex",gap:12,alignItems:"center",padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
                  <div style={{flex:1}}>
                    <div style={{color:"var(--text-primary)",fontSize:14,fontWeight:500}}>{m.name}</div>
                    <div style={{color:"var(--text-faint)",fontSize:12,marginTop:2}}>{fmtDate(m.date)} · {m.region}</div>
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
// CERT APPLICATION PANEL  (shown in My Profile)
// ─────────────────────────────────────────────────────────────────────────────

const CERT_APP_OPTIONS = [
  {
    type: "RO",
    label: "Range Officer (RO)",
    color: "#4ade80",
    minCert: "RO-P",
    desc: "Full RO status. Requires passing the automated checklist above.",
    showIf: u => u.certification === "RO-P",
  },
  {
    type: "CRO",
    label: "Chief Range Officer (CRO)",
    color: "#facc15",
    minCert: "RO",
    desc: "Requires at least RO certification and demonstrated experience as an RO at matches.",
    showIf: u => certRank(u.certification) === certRank("RO"),
  },
  {
    type: "RM",
    label: "Range Master (RM)",
    color: "#f97316",
    minCert: "CRO",
    desc: "Requires CRO certification, completion of Level II seminar, and approval by NROI.",
    showIf: u => certRank(u.certification) === certRank("CRO"),
  },
  {
    type: "IROA",
    label: "IROA Membership",
    color: "#38bdf8",
    minCert: null,
    desc: "Apply to become an IROA member. Requires an active RO-P or higher certification.",
    showIf: u => certRank(u.certification) >= certRank("RO-P") && !u.iroa?.member,
  },
];

function CertApplicationPanel({ user, pendingTypes, submitApplication }) {
  const [expanded, setExpanded] = useState(null);
  const [noteText, setNoteText]  = useState({});

  const visible = CERT_APP_OPTIONS.filter(o => o.showIf(user));
  if (visible.length === 0) return null;

  return (
    <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:24,marginBottom:16}}>
      <h3 style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Apply for Upgrade</h3>
      <p style={{fontSize:12,color:"var(--text-faint)",margin:"0 0 16px"}}>Submit an application for a higher certification or IROA membership. Applications are reviewed by admins and RMs.</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {visible.map(opt => {
          const isPending  = pendingTypes.has(opt.type);
          const isExpanded = expanded === opt.type;
          return (
            <div key={opt.type} style={{border:`1px solid ${isPending?"#60a5fa55":isExpanded?"var(--border2)":"var(--border)"}`,borderRadius:8,overflow:"hidden"}}>
              <div style={{
                display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
                background:isExpanded?"#0d1520":"transparent",cursor:isPending?"default":"pointer"
              }} onClick={()=>!isPending&&setExpanded(isExpanded?null:opt.type)}>
                <Badge label={opt.type} color={opt.color} />
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>{opt.label}</div>
                  <div style={{fontSize:11,color:"var(--text-faint)",marginTop:2}}>{opt.desc}</div>
                </div>
                {isPending
                  ? <span style={{fontSize:11,color:"#60a5fa",whiteSpace:"nowrap"}}>⏳ Pending</span>
                  : <span style={{color:"var(--text-faint)",fontSize:14}}>{isExpanded?"▲":"▼"}</span>
                }
              </div>
              {isExpanded && !isPending && (
                <div style={{padding:"14px 16px",borderTop:"1px solid var(--border)",background:"var(--surface)"}}>
                  <Field label="Supporting note (optional)" hint="Any context you want reviewers to see — match experience, seminar dates, etc.">
                    <textarea
                      style={{...inp,height:64,resize:"vertical"}}
                      value={noteText[opt.type]||""}
                      onChange={e=>setNoteText(p=>({...p,[opt.type]:e.target.value}))}
                      placeholder="e.g. I've worked 8 matches as RO and completed Level II seminar in Bergen 2025."
                    />
                  </Field>
                  <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                    <button style={btnS} onClick={()=>setExpanded(null)}>Cancel</button>
                    <button style={{...btnP,background:opt.color==="color"?opt.color:"#e85d2c"}} onClick={()=>{
                      submitApplication(opt.type, noteText[opt.type]||"");
                      setExpanded(null);
                      setNoteText(p=>({...p,[opt.type]:""}));
                    }}>Submit Application</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: USER DATABASE
// ─────────────────────────────────────────────────────────────────────────────

function UserDatabase({ users, setUsers, regions, setRegions, applications, setApplications, matches }) {
  const { currentUser } = useAuth();
  const adminAccess = isAdmin(currentUser);
  const [tab,          setTab]          = useState("users");  // "users" | "apps" | "regions"
  const [search,       setSearch]       = useState("");
  const [roleFilter,   setRoleFilter]   = useState("All");
  const [certFilter,   setCertFilter]   = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [viewUser,     setViewUser]     = useState(null);
  const [certTarget,   setCertTarget]   = useState(null);

  // Region management state
  const [newRegionName, setNewRegionName] = useState("");
  const [regionError,   setRegionError]   = useState("");
  const [regionFieldErr,setRegionFieldErr]= useState(false);

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

  function approveApplication(app, reviewNote) {
    const today = new Date().toISOString().slice(0,10);
    setApplications(prev=>prev.map(a=>a.id===app.id
      ? {...a, status:"approved", reviewedBy:currentUser.name, reviewedDate:today, reviewNote:reviewNote||""}
      : a
    ));
    // Auto-grant: cert applications grant the cert; IROA marks membership
    if (app.type === "IROA") {
      setUsers(prev=>prev.map(u=>u.id===app.userId
        ? {...u, iroa:{member:true, since:today}}
        : u
      ));
    } else {
      const entry = { cert:app.type, grantedBy:currentUser.name, date:today, note:`Approved application${reviewNote?": "+reviewNote:""}` };
      setUsers(prev=>prev.map(u=>{
        if (u.id!==app.userId) return u;
        const shouldUpgrade = certRank(app.type) >= certRank(u.certification);
        return { ...u, certification:shouldUpgrade?app.type:u.certification, certHistory:[...(u.certHistory||[]),entry] };
      }));
    }
  }

  function rejectApplication(app, reviewNote) {
    const today = new Date().toISOString().slice(0,10);
    setApplications(prev=>prev.map(a=>a.id===app.id
      ? {...a, status:"rejected", reviewedBy:currentUser.name, reviewedDate:today, reviewNote:reviewNote||""}
      : a
    ));
  }

  // Region management
  function addRegion() {
    const name = newRegionName.trim();
    if (!name) { setRegionError("Region name cannot be empty."); setRegionFieldErr(true); return; }
    setRegionFieldErr(false);
    if (regions.includes(name)) { setRegionError(`"${name}" already exists.`); setRegionFieldErr(true); return; }
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

  const pendingApps = (applications||[]).filter(a=>a.status==="pending");
  const liveUser = id => users.find(u=>u.id===id);
  const tabBtn = t => ({
    padding:"8px 20px", fontSize:13, fontWeight:600, cursor:"pointer", border:"none", borderRadius:6,
    background: tab===t ? "#e85d2c" : "transparent", color: tab===t ? "#fff" : "var(--text-muted)",
    display:"flex", alignItems:"center", gap:6
  });

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 4px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.03em",color:"var(--text-primary)"}}>{adminAccess?"User Database":"Applications"}</h1>
          <p style={{color:"var(--text-faint)",margin:0,fontSize:14}}>
            {tab==="users" ? `${filtered.length} of ${users.length} users`
             : tab==="apps" ? `${pendingApps.length} pending application${pendingApps.length!==1?"s":""}` 
             : `${regions.length} districts configured`}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:4,marginBottom:24,background:"var(--surface)",padding:4,borderRadius:8,width:"fit-content"}}>
        {adminAccess&&<button style={tabBtn("users")}   onClick={()=>setTab("users")}>👥 Users</button>}
        <button style={tabBtn("apps")} onClick={()=>setTab("apps")}>
          📋 Applications
          {pendingApps.length>0&&<span style={{background:"#e85d2c",color:"#fff",borderRadius:10,fontSize:10,fontWeight:800,padding:"1px 6px"}}>{pendingApps.length}</span>}
        </button>
        {adminAccess&&<button style={tabBtn("regions")} onClick={()=>setTab("regions")}>🗺️ Districts</button>}
      </div>

      {adminAccess && tab === "users" && (<>
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
        <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"var(--surface)"}}>
                {["User","Email","Role","Certification","District","Points","Status","Actions"].map(h=>(
                  <th key={h} style={{padding:"12px 13px",textAlign:"left",fontSize:11,fontWeight:700,color:"var(--text-faint)",textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:"1px solid var(--border)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u,i)=>(
                <tr key={u.id} style={{borderBottom:"1px solid var(--surface3)",background:i%2===0?"transparent":"var(--surface)"}}>
                  <td style={{padding:"11px 13px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:9}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>{u.name.charAt(0)}</div>
                      <button onClick={()=>setViewUser(u)} style={{background:"none",border:"none",color:"var(--text-primary)",fontWeight:600,fontSize:14,cursor:"pointer",padding:0}}>{u.name}</button>
                      {u.id===currentUser.id&&<span style={{fontSize:10,color:"var(--text-faint)"}}>(you)</span>}
                    </div>
                  </td>
                  <td style={{padding:"11px 13px",color:"var(--text-muted)",fontSize:13}}>{u.email}</td>
                  <td style={{padding:"11px 13px"}}><Badge label={u.role} color={roleColor(u.role)} /></td>
                  <td style={{padding:"11px 13px"}}><Badge label={u.certification||"None"} color={certColor(u.certification)} /></td>
                  <td style={{padding:"11px 13px",color:"var(--text-second)",fontSize:13}}>{u.region||"—"}</td>
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
              {filtered.length===0&&<tr><td colSpan={8} style={{padding:44,textAlign:"center",color:"var(--text-faint)"}}>No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      </>)}

      {/* ── Applications tab ── */}
      {tab === "apps" && (
        <ApplicationsTab
          applications={applications}
          users={users}
          matches={matches}
          currentUser={currentUser}
          onApprove={approveApplication}
          onReject={rejectApplication}
        />
      )}

      {adminAccess && tab === "regions" && (
        <div>
          <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:24,marginBottom:20}}>
            <h3 style={{margin:"0 0 6px",fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>District List</h3>
            <p style={{margin:"0 0 20px",fontSize:13,color:"var(--text-faint)"}}>
              These districts appear in all district dropdowns throughout the system — for user profiles, match creation, and filters.
              Add or remove them here to configure the system for your IPSC Region. Removing a district from the list does <em style={{color:"var(--text-second)"}}>not</em> clear it from users or matches that already have it set.
            </p>

            {/* Add new district */}
            <div style={{display:"flex",gap:10,marginBottom:20,alignItems:"flex-end"}}>
              <Field label="New District Name" hint="e.g. 'Midtøst' or 'Capital District'">
                <input
                  style={{...errInp(regionFieldErr),width:260}}
                  value={newRegionName}
                  onChange={e=>{ setNewRegionName(e.target.value); setRegionError(""); setRegionFieldErr(false); }}
                  placeholder="District name…"
                  onKeyDown={e=>e.key==="Enter"&&addRegion()}
                />
              </Field>
              <button style={{...btnP,marginBottom:16}} onClick={addRegion}>Add District</button>
            </div>
            {regionError && <div style={{background:"#f8717115",border:"1px solid #f8717155",borderRadius:6,padding:"9px 13px",color:"#f87171",fontSize:13,marginBottom:16}}>{regionError}</div>}

            {/* District grid */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
              {[...regions].sort().map(r => {
                const userCount = users.filter(u=>(u.region||"")===r).length;
                return (
                  <div key={r} style={{
                    background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8,
                    padding:"12px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10
                  }}>
                    <div>
                      <div style={{color:"var(--text-primary)",fontWeight:600,fontSize:14}}>{r}</div>
                      <div style={{color:"var(--text-faint)",fontSize:12,marginTop:2}}>{userCount} user{userCount!==1?"s":""}</div>
                    </div>
                    <button onClick={()=>removeRegion(r)} style={{
                      background:"none", border:"1px solid var(--border2)", borderRadius:5,
                      color:"var(--text-muted)", cursor:"pointer", padding:"4px 9px", fontSize:12,
                      lineHeight:1
                    }} title={`Remove ${r}`}>✕</button>
                  </div>
                );
              })}
            </div>

            {regions.length === 0 && (
              <div style={{textAlign:"center",padding:40,color:"var(--text-faint)",fontSize:13}}>
                No districts configured. Add one above, or district fields will fall back to free text.
              </div>
            )}
          </div>

          <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:18}}>
            <div style={{fontSize:12,color:"var(--text-faint)"}}>
              <strong style={{color:"var(--text-muted)"}}>Note for other IPSC Regions:</strong> This system ships with IPSC Norway's ten official districts as the default. Replace them here with your own nation's district breakdown. The software does not hard-code any district names — this list is the sole source of truth for all dropdowns.
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
                      <div style={{fontSize:18,fontWeight:700,color:"var(--text-primary)"}}>{u.name}</div>
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
                            <span style={{fontSize:13,color:"var(--text-primary)"}}>IROA Member</span>
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
                          <span style={{fontSize:13,color:"var(--text-primary)"}}>Profile photo approved</span>
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
                    <h4 style={{margin:0,fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Cert History</h4>
                    <button style={{...btnP,padding:"5px 10px",fontSize:11}} onClick={()=>{setCertTarget(u);setViewUser(null);}}>+ Grant</button>
                  </div>
                  {(!u.certHistory||u.certHistory.length===0)
                    ? <p style={{color:"var(--text-faint)",fontSize:13}}>No certifications.</p>
                    : [...u.certHistory].reverse().map((c,i)=>(
                      <div key={i} style={{padding:"9px 0",borderBottom:"1px solid var(--border)"}}>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}><Badge label={c.cert} color={certColor(c.cert)} /><span style={{color:"var(--text-muted)",fontSize:11}}>{fmtDate(c.date)}</span></div>
                        <div style={{color:"var(--text-faint)",fontSize:11,marginTop:4}}>By: {c.grantedBy}</div>
                        {c.note&&<div style={{color:"var(--text-muted)",fontSize:11,fontStyle:"italic"}}>{c.note}</div>}
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
      <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:16,marginBottom:20}}>
        <div style={{fontSize:13,color:"var(--text-second)",display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
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
      <div style={{background:"var(--surface)",border:"1px solid var(--border2)",borderRadius:6,padding:"11px 14px",fontSize:12,color:"var(--text-muted)",marginBottom:22}}>
        <strong style={{color:"var(--text-second)"}}>Note:</strong> Granting a cert <em>adds</em> a history entry. The user's displayed certification updates only if the new cert is equal or higher rank than the current one. All cert grants are logged with your name ({granterName}) and today's date.
      </div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button style={btnS} onClick={onClose}>Cancel</button>
        <button style={btnP} onClick={()=>onSave(user.id,cert,newRole,note)}>Grant {cert} Certification</button>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATIONS TAB  (used inside UserDatabase)
// ─────────────────────────────────────────────────────────────────────────────

function ApplicationsTab({ applications, users, matches, currentUser, onApprove, onReject }) {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [reviewingId,  setReviewingId]  = useState(null);
  const [reviewNote,   setReviewNote]   = useState("");

  const filtered = (applications||[])
    .filter(a => statusFilter==="all" || a.status===statusFilter)
    .sort((a,b)=>new Date(b.date)-new Date(a.date));

  const appTypeColor = t => ({RO:"#4ade80",CRO:"#facc15",RM:"#f97316",IROA:"#38bdf8",club_membership:"#7c8cf8"})[t]||"#9ca3af";

  function handleApprove(app) {
    onApprove(app, reviewNote);
    setReviewingId(null); setReviewNote("");
  }
  function handleReject(app) {
    onReject(app, reviewNote);
    setReviewingId(null); setReviewNote("");
  }

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{display:"flex",gap:4,background:"var(--surface)",padding:4,borderRadius:7}}>
          {["pending","approved","rejected","all"].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} style={{
              padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",border:"none",borderRadius:5,
              background:statusFilter===s?"#e85d2c":"transparent",color:statusFilter===s?"#fff":"var(--text-muted)",textTransform:"capitalize"
            }}>{s}</button>
          ))}
        </div>
        <span style={{color:"var(--text-faint)",fontSize:13}}>{filtered.length} application{filtered.length!==1?"s":""}</span>
      </div>

      {filtered.length===0 ? (
        <div style={{textAlign:"center",padding:60,color:"var(--text-faint)",fontSize:14}}>
          No {statusFilter==="all"?"":statusFilter} applications.
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.map(app=>{
            const applicant = users.find(u=>u.id===app.userId);
            const isReviewing = reviewingId===app.id;
            return (
              <div key={app.id} style={{background:"var(--surface2)",border:`1px solid ${app.status==="pending"?"var(--border2)":"var(--border)"}`,borderRadius:10,overflow:"hidden"}}>
                <div style={{padding:"16px 20px",display:"flex",gap:14,alignItems:"flex-start",flexWrap:"wrap"}}>
                  {/* Applicant avatar */}
                  <div style={{width:38,height:38,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#fff",flexShrink:0}}>
                    {(applicant?.name||app.userName||"?").charAt(0)}
                  </div>
                  <div style={{flex:1,minWidth:200}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
                      <span style={{fontWeight:700,color:"var(--text-primary)",fontSize:14}}>{applicant?.name||app.userName}</span>
                      <Badge label={app.type==="club_membership" ? "Club Membership" : `Apply: ${app.type}`} color={appTypeColor(app.type)} />
                      {app.clubId && app.type==="club_membership" && (()=>{
                        // Note: clubs not in scope here — show clubId as fallback
                        return null;
                      })()}
                      <Badge label={app.status} color={app.status==="pending"?"#60a5fa":app.status==="approved"?"#4ade80":"#f87171"} />
                    </div>
                    <div style={{fontSize:12,color:"var(--text-faint)",display:"flex",gap:14,flexWrap:"wrap"}}>
                      <span>Current cert: <span style={{color:"var(--text-second)"}}>{applicant?.certification||app.userCert||"—"}</span></span>
                      <span>District: <span style={{color:"var(--text-second)"}}>{applicant?.region||app.userRegion||"—"}</span></span>
                      <span>Submitted: <span style={{color:"var(--text-second)"}}>{fmtDate(app.date)}</span></span>
                    </div>
                    {app.note&&<div style={{marginTop:6,fontSize:13,color:"var(--text-muted)",fontStyle:"italic"}}>"{app.note}"</div>}
                    {app.status!=="pending"&&app.reviewedBy&&(
                      <div style={{marginTop:6,fontSize:12,color:"var(--text-faint)"}}>
                        {app.status==="approved"?"✅":"❌"} {app.status} by {app.reviewedBy} on {fmtDate(app.reviewedDate)}
                        {app.reviewNote&&<span style={{color:"var(--text-muted)"}}> — "{app.reviewNote}"</span>}
                      </div>
                    )}
                    {/* Show automated RO checklist inline for RO applications */}
                    {app.type==="RO" && app.status==="pending" && applicant && (()=>{
                      const checklist = computeROChecklist(applicant, matches);
                      const allPass   = checklist.every(c=>c.pass);
                      return (
                        <div style={{marginTop:10,padding:"10px 12px",background:"var(--surface)",borderRadius:7,border:"1px solid var(--border)"}}>
                          <div style={{fontSize:11,fontWeight:700,color:"var(--text-faint)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>
                            Automated RO checklist {allPass?<span style={{color:"#4ade80"}}>— All pass ✅</span>:<span style={{color:"#f87171"}}>— Fails detected ❌</span>}
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:4}}>
                            {checklist.map(item=>(
                              <div key={item.key} style={{display:"flex",gap:8,alignItems:"center",fontSize:12}}>
                                <span>{item.pass?"✅":"❌"}</span>
                                <span style={{color:item.pass?"#86efac":"#fca5a5"}}>{item.label}</span>
                                {item.detail&&<span style={{color:"var(--text-faint)",fontSize:11}}>— {item.detail}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {/* Action buttons for pending */}
                  {app.status==="pending" && !isReviewing && (
                    <div style={{display:"flex",gap:8,flexShrink:0,alignSelf:"center"}}>
                      <button style={{...btnP,padding:"7px 14px",fontSize:12,background:"#16a34a"}} onClick={()=>{setReviewingId(app.id);setReviewNote("");}}>Approve</button>
                      <button style={{...btnD,padding:"7px 14px",fontSize:12}} onClick={()=>{setReviewingId(app.id);setReviewNote("");}}>Reject</button>
                    </div>
                  )}
                </div>
                {/* Inline review panel */}
                {isReviewing && (
                  <div style={{padding:"14px 20px",borderTop:"1px solid var(--border)",background:"var(--surface)"}}>
                    <Field label="Review note (optional)">
                      <input style={inp} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Reason for decision, optional…" />
                    </Field>
                    <div style={{display:"flex",gap:8,marginTop:4}}>
                      <button style={{...btnP,background:"#16a34a",padding:"8px 18px",fontSize:13}} onClick={()=>handleApprove(app)}>✓ Confirm Approve</button>
                      <button style={{...btnD,padding:"8px 18px",fontSize:13}} onClick={()=>handleReject(app)}>✕ Confirm Reject</button>
                      <button style={{...btnS,padding:"8px 14px",fontSize:13}} onClick={()=>setReviewingId(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
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
          <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 4px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.03em",color:"var(--text-primary)"}}>Range Officers</h1>
          <p style={{color:"var(--text-faint)",margin:0,fontSize:14}}>{filtered.length} certified active officers</p>
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
      <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"var(--surface)"}}>
              {["Name","Certification","IROA","District","Matches","Points",""].map(h=>(
                <th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:11,fontWeight:700,color:"var(--text-faint)",textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:"1px solid var(--border)"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u,i)=>{
              const mc=matches.filter(m=>m.assignments.some(a=>a.roId===u.id)).length;
              return (
                <tr key={u.id} style={{borderBottom:"1px solid var(--surface3)",background:i%2===0?"transparent":"var(--surface)"}}>
                  <td style={{padding:"12px 16px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:30,height:30,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>{u.name.charAt(0)}</div>
                      <button onClick={()=>setViewUser(u)} style={{background:"none",border:"none",color:"var(--text-primary)",fontWeight:600,fontSize:14,cursor:"pointer",padding:0}}>{u.name}</button>
                    </div>
                  </td>
                  <td style={{padding:"12px 16px"}}><Badge label={u.certification} color={certColor(u.certification)} /></td>
                  <td style={{padding:"12px 16px"}}>
                    {u.iroa?.member
                      ? <span style={{display:"flex",alignItems:"center",gap:5}}>
                          <span style={{width:8,height:8,borderRadius:"50%",background:"#38bdf8",display:"inline-block",flexShrink:0}} />
                          <span style={{color:"#38bdf8",fontSize:12,fontWeight:600}}>IROA</span>
                        </span>
                      : <span style={{color:"var(--text-faint)",fontSize:12}}>—</span>
                    }
                  </td>
                  <td style={{padding:"12px 16px",color:"var(--text-second)",fontSize:13}}>{u.region||"—"}</td>
                  <td style={{padding:"12px 16px",color:"var(--text-muted)",fontSize:13}}>{mc}</td>
                  <td style={{padding:"12px 16px",color:"#e85d2c",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:15}}>{u.points}</td>
                  <td style={{padding:"12px 16px"}}><button onClick={()=>setViewUser(u)} style={{...btnS,padding:"5px 12px",fontSize:12}}>View</button></td>
                </tr>
              );
            })}
            {filtered.length===0&&<tr><td colSpan={7} style={{padding:44,textAlign:"center",color:"var(--text-faint)"}}>No certified ROs found.</td></tr>}
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
              ? <span style={{color:"#38bdf8",fontWeight:600}}>Yes{viewUser.iroa.since ? <span style={{color:"var(--text-faint)",fontWeight:400}}> — since {fmtDate(viewUser.iroa.since)}</span> : ""}</span>
              : "No"
          } />
          {viewUser.notes&&<InfoRow label="Notes" value={viewUser.notes}/>}
          {(viewUser.seminarHistory||[]).length>0 && (
            <>
              <h4 style={{margin:"20px 0 10px",fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Seminar History</h4>
              {[...viewUser.seminarHistory].reverse().map((s,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)",flexWrap:"wrap"}}>
                  <Badge label={s.type} color={s.type==="Level I"?"#38bdf8":"#a78bfa"} />
                  {s.graduated&&<Badge label="Graduated" color="#4ade80" />}
                  {s.diplomaVerified&&<Badge label="Verified" color="#38bdf8" />}
                  <span style={{color:"var(--text-faint)",fontSize:11,marginLeft:"auto"}}>{s.diplomaDate?fmtDate(s.diplomaDate):"—"}</span>
                </div>
              ))}
            </>
          )}
          <h4 style={{margin:"20px 0 10px",fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Certification History</h4>
          {(viewUser.certHistory||[]).length===0
            ? <p style={{color:"var(--text-faint)",fontSize:13}}>No cert history.</p>
            : [...(viewUser.certHistory||[])].reverse().map((c,i)=>(
              <div key={i} style={{display:"flex",gap:10,alignItems:"center",padding:"7px 0",borderBottom:"1px solid var(--border)"}}>
                <Badge label={c.cert} color={certColor(c.cert)} />
                <span style={{color:"var(--text-muted)",fontSize:12,flex:1}}>Granted by {c.grantedBy}</span>
                <span style={{color:"var(--text-faint)",fontSize:12}}>{fmtDate(c.date)}</span>
              </div>
            ))
          }
          <h4 style={{margin:"20px 0 10px",fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Match History</h4>
          {roMatchHistory.length===0
            ? <p style={{color:"var(--text-faint)",fontSize:13}}>No match assignments.</p>
            : roMatchHistory.map(m=>(
              <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
                <div style={{flex:1}}>
                  <div style={{color:"var(--text-primary)",fontSize:14,fontWeight:500}}>{m.name}</div>
                  <div style={{color:"var(--text-faint)",fontSize:12,marginTop:2}}>{fmtDate(m.date)} · {m.region}</div>
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

function MatchesPage({ users, matches, setMatches, regions, clubs }) {
  const { currentUser } = useAuth();
  const canEdit = canManageMatches(currentUser);

  const [showCreate,   setShowCreate]   = useState(false);
  const [manageMatch,  setManageMatch]  = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [regionFilter, setRegionFilter] = useState("All");
  const [search,       setSearch]       = useState("");

  const blank = { name:"", date:new Date().toISOString().slice(0,10), region:"", level:"Level I", discipline:"Handgun", stages:6, shooters:"", externalLink:"", status:"upcoming", combinedMDRM:false, md:"", mdText:"", rm:"", assignments:[], hostClubId:"" };
  const [form,        setForm]       = useState(blank);
  const [formErrors,  setFormErrors] = useState({});

  const filtered = useMemo(()=>matches.filter(m=>{
    const q=search.toLowerCase();
    return (m.name.toLowerCase().includes(q)||m.region.toLowerCase().includes(q))
      && (statusFilter==="All"||m.status===statusFilter)
      && (regionFilter==="All"||(m.region||"")===regionFilter);
  }),[matches,search,statusFilter,regionFilter]);

  function createMatch() {
    const errs = {};
    if (!form.name.trim())                                  errs.name   = true;
    if (!form.region)                                       errs.region = true;
    // RM required; MD required unless external mdText provided
    if (form.combinedMDRM) {
      if (!form.md)                                         errs.mdRm   = true;
    } else {
      if (!form.rm)                                         errs.rm     = true;
      if (!form.md && !form.mdText.trim())                  errs.md     = true;
    }
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    setFormErrors({});
    setMatches(prev=>[...prev,{...form,id:uid()}]);
    setShowCreate(false); setForm(blank); setFormErrors({});
  }
  function deleteMatch(id) {
    if (window.confirm("Delete this match?")) setMatches(prev=>prev.filter(m=>m.id!==id));
  }

  // MD: any active user (or free-text). RM: RO+ for L1/L2, RM cert only for L3+.
  const allActiveUsers = users.filter(u=>u.active);
  function eligibleRMs(level) {
    const highLevel = level==="Level III"||level==="Level IV";
    return users.filter(u=>u.active && certRank(u.certification) >= (highLevel ? certRank("RM") : certRank("RO")));
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{fontSize:28,fontWeight:800,margin:"0 0 4px",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.03em",color:"var(--text-primary)"}}>Matches</h1>
          <p style={{color:"var(--text-faint)",margin:0,fontSize:14}}>{filtered.length} of {matches.length} shown</p>
        </div>
        {canEdit&&<button style={btnP} onClick={()=>{setForm(blank);setFormErrors({});setShowCreate(true);}}>+ Create Match</button>}
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
          const mdName = mdUser?.name || m.mdText || null;
          const staffLabel = m.combinedMDRM
            ? `MD/RM: ${mdName||"—"}`
            : [mdName ? `MD: ${mdName}` : null, rmUser ? `RM: ${rmUser.name}` : null].filter(Boolean).join(" · ") || "—";
          return (
            <div key={m.id} style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,padding:"18px 22px",display:"flex",alignItems:"center",gap:16}}>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                  <span style={{fontSize:16,fontWeight:700,color:"var(--text-primary)"}}>{m.name}</span>
                  <Badge label={m.status} color={statusColor(m.status)} />
                  <Badge label={m.level}  color="#7c8cf8" />
                  {m.discipline && <Badge label={m.discipline} color="#0ea5e9" />}

                </div>
                <div style={{color:"var(--text-faint)",fontSize:13,display:"flex",gap:18,flexWrap:"wrap"}}>
                  <span>📅 {fmtDate(m.date)}</span><span>📍 {m.region}</span>
                  <span>🎯 {m.stages} stages</span>
                  {m.shooters ? <span>🔫 {m.shooters} shooters</span> : null}
                  <span>👔 {staffLabel}</span>
                  {m.hostClubId && (()=>{ const cl=(clubs||[]).find(c=>c.id===m.hostClubId); return cl?<span>🏛️ {cl.shortName}</span>:null; })()}
                  <span>👥 {m.assignments.length} RO{m.assignments.length!==1?"s":""}</span>
                  {m.externalLink && <a href={m.externalLink} target="_blank" rel="noopener noreferrer" style={{color:"#60a5fa",textDecoration:"none"}} onClick={e=>e.stopPropagation()}>🔗 Match page</a>}
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={{...btnS,padding:"8px 16px",fontSize:13}} onClick={()=>setManageMatch(m)}>{canEdit?"Manage":"View"}</button>
                {canEdit&&<button style={{...btnD,padding:"8px 16px",fontSize:13}} onClick={()=>deleteMatch(m.id)}>Delete</button>}
              </div>
            </div>
          );
        })}
        {filtered.length===0&&<div style={{textAlign:"center",padding:60,color:"var(--text-faint)"}}>No matches found.</div>}
      </div>

      {showCreate&&canEdit&&(
        <Modal title="Create Match" onClose={()=>{setShowCreate(false);setFormErrors({});}}>
          <Field label="Match Name" error={formErrors.name?"Required":undefined}><input style={errInp(formErrors.name)} value={form.name} onChange={e=>{setForm(f=>({...f,name:e.target.value}));setFormErrors(p=>({...p,name:false}));}} placeholder="e.g. Oslo Club Match #13" /></Field>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Field label="Date"><input style={inp} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></Field>
            <Field label="District" error={formErrors.region?"Required":undefined}><RegionSelect value={form.region} onChange={v=>{setForm(f=>({...f,region:v}));setFormErrors(p=>({...p,region:false}));}} regions={regions} placeholder="— Select district —" hasError={formErrors.region} /></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
            <Field label="Level"><select style={inp} value={form.level} onChange={e=>{ const lv=e.target.value; setForm(f=>({...f,level:lv,combinedMDRM:lv==="Level I"?f.combinedMDRM:false})); }}>{["Level I","Level II","Level III","Level IV"].map(l=><option key={l}>{l}</option>)}</select></Field>
            <Field label="Discipline"><select style={inp} value={form.discipline||"Handgun"} onChange={e=>setForm(f=>({...f,discipline:e.target.value}))}>{IPSC_DISCIPLINES.map(d=><option key={d}>{d}</option>)}</select></Field>
            <Field label="Status"><select style={inp} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}><option>upcoming</option><option>active</option><option>completed</option></select></Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
            <Field label="Stages"><input style={inp} type="number" min={1} max={40} value={form.stages} onChange={e=>setForm(f=>({...f,stages:parseInt(e.target.value)||1}))} /></Field>
            <Field label="Number of Shooters" hint="Expected or registered competitor count">
              <input style={inp} type="number" min={0} value={form.shooters} onChange={e=>setForm(f=>({...f,shooters:e.target.value}))} placeholder="e.g. 60" />
            </Field>
            <Field label="External Link (optional)" hint="Match page, registration, or results URL">
              <input style={inp} type="url" value={form.externalLink} onChange={e=>setForm(f=>({...f,externalLink:e.target.value}))} placeholder="https://practiscore.com/…" />
            </Field>
            <Field label="Host Club (optional)" hint="Club organising or hosting this match">
              <select style={inp} value={form.hostClubId||""} onChange={e=>setForm(f=>({...f,hostClubId:e.target.value}))}>
                <option value="">— No club host —</option>
                {(clubs||[]).filter(c=>c.active).sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.id} value={c.id}>{c.name} ({c.shortName})</option>)}
              </select>
            </Field>
          </div>

          {/* MD/RM section */}
          <div style={{background:"var(--surface2)",border:`1px solid ${(formErrors.md||formErrors.rm||formErrors.mdRm)?"#f8717155":"var(--border)"}`,borderRadius:8,padding:"14px 16px",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:600,color:"var(--text-primary)"}}>Match Director / Rangemaster</div>
              {/* Combine toggle: only available for Level I */}
              {form.level==="Level I" && (
                <button onClick={()=>setForm(f=>({...f,combinedMDRM:!f.combinedMDRM,md:"",rm:"",mdText:""}))} style={{
                  background:form.combinedMDRM?"#e85d2c22":"var(--border)",
                  border:`1px solid ${form.combinedMDRM?"#e85d2c55":"var(--border2)"}`,
                  borderRadius:6, color:form.combinedMDRM?"#e85d2c":"var(--text-muted)",
                  padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap"
                }}>{form.combinedMDRM?"✓ Combined MD/RM":"Combine MD/RM"}</button>
              )}
            </div>

            {form.combinedMDRM ? (
              // Combined: Level I only — one person fills both roles
              <Field label="Match Director & Rangemaster" error={formErrors.mdRm?"Required":undefined} hint={!formErrors.mdRm?"Level I only — RO certification or above required":undefined}>
                <UserPicker
                  users={eligibleRMs(form.level)}
                  value={form.md}
                  onChange={id => {setForm(f=>({...f, md:id, rm:id, mdText:""}));setFormErrors(p=>({...p,mdRm:false}));}}
                  placeholder="— Select MD/RM —"
                  hasError={formErrors.mdRm}
                />
              </Field>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <div>
                  <Field label="Match Director (MD)" error={formErrors.md?"Required":undefined}>
                    <UserPicker
                      users={allActiveUsers}
                      value={form.md}
                      onChange={id => {setForm(f=>({...f, md:id, mdText:""}));setFormErrors(p=>({...p,md:false}));}}
                      placeholder="— Select MD —"
                      labelFn={u => u.certification && u.certification!=="None" ? `${u.name} (${u.certification})` : u.name}
                      hasError={formErrors.md && !form.mdText.trim()}
                    />
                  </Field>
                  {!form.md && (
                    <input style={formErrors.md&&!form.md ? {width:"100%",boxSizing:"border-box",border:"1.5px solid #f87171",background:"#f8717108",borderRadius:6,padding:"9px 12px",color:"var(--inp-text)",fontSize:14,outline:"none",fontFamily:"inherit",marginTop:-8} : {...inp,marginTop:-8}} value={form.mdText} onChange={e=>{setForm(f=>({...f,mdText:e.target.value}));setFormErrors(p=>({...p,md:false}));}} placeholder="Or type MD name (external)…" />
                  )}
                </div>
                <Field label="Rangemaster (RM)" error={formErrors.rm?"Required":undefined} hint={
                  !formErrors.rm ? ((form.level==="Level III"||form.level==="Level IV")
                    ? "Level III/IV requires RM certification"
                    : "Level I/II: RO certification or above") : undefined
                }>
                  <UserPicker
                    users={eligibleRMs(form.level)}
                    value={form.rm}
                    onChange={id => {setForm(f=>({...f, rm:id}));setFormErrors(p=>({...p,rm:false}));}}
                    placeholder="— Select RM —"
                    hasError={formErrors.rm}
                  />
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
        <ManageMatch match={manageMatch} users={users} clubs={clubs} readonly={!canEdit}
          onClose={()=>setManageMatch(null)}
          onUpdate={upd=>{setMatches(prev=>prev.map(m=>m.id===upd.id?upd:m));setManageMatch(upd);}}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPLETE MATCH MODAL
// Requires user to log DQs (or tick "no DQs") and extra staff (or tick "none")
// before points can be distributed and the match marked completed.
// ─────────────────────────────────────────────────────────────────────────────

function CompleteMatchModal({ match, users, onConfirm, onClose }) {
  // ── DQ state ──
  const [noDQs,     setNoDQs]     = useState(false);
  const [dqList,    setDqList]    = useState([]);          // [{name, ruleCode, ruleLabel, notes}]
  const [dqName,    setDqName]    = useState("");
  const [dqCode,    setDqCode]    = useState(DQ_REASONS[0].rules[0].code);
  const [dqNotes,   setDqNotes]   = useState("");
  const [dqError,   setDqError]   = useState("");

  // ── Extra staff state ──
  const [noExtra,     setNoExtra]     = useState(false);
  const [extraStaff,  setExtraStaff]  = useState([]);      // [{name, role, notes}]
  const [esName,      setEsName]      = useState("");
  const [esRole,      setEsRole]      = useState("RO");
  const [esNotes,     setEsNotes]     = useState("");
  const [esError,     setEsError]     = useState("");

  // Flat list of all DQ rules for the picker
  const allRules = DQ_REASONS.flatMap(g => g.rules);
  const selectedRule = allRules.find(r => r.code === dqCode) || allRules[0];

  function addDQ() {
    if (!dqName.trim()) { setDqError("Enter the competitor's name."); return; }
    setDqList(p => [...p, { name:dqName.trim(), ruleCode:selectedRule.code, ruleLabel:selectedRule.label, notes:dqNotes.trim() }]);
    setDqName(""); setDqNotes(""); setDqError("");
  }
  function removeDQ(i) { setDqList(p => p.filter((_,j)=>j!==i)); }

  function addStaff() {
    if (!esName.trim()) { setEsError("Enter the staff member's name."); return; }
    setExtraStaff(p => [...p, { name:esName.trim(), role:esRole, notes:esNotes.trim() }]);
    setEsName(""); setEsNotes(""); setEsError("");
  }
  function removeStaff(i) { setExtraStaff(p => p.filter((_,j)=>j!==i)); }

  const dqReady    = noDQs    || dqList.length > 0;
  const staffReady = noExtra  || extraStaff.length > 0;
  const canConfirm = dqReady && staffReady;

  const sectionHead = (label, done) => (
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      <div style={{
        width:22, height:22, borderRadius:"50%", flexShrink:0,
        background: done ? "#16a34a" : "var(--border)",
        border: `2px solid ${done ? "#4ade80" : "var(--border2)"}`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:13, color: done ? "#fff" : "var(--text-faint)"
      }}>{done ? "✓" : ""}</div>
      <h3 style={{margin:0,fontSize:14,fontWeight:700,color:"var(--text-primary)"}}>{label}</h3>
    </div>
  );

  return (
    <Modal title="Complete Match — Final Report" onClose={onClose} wide>
      <p style={{color:"var(--text-faint)",fontSize:13,margin:"0 0 22px"}}>
        Before distributing points and closing the match, confirm the DQ log and any additional staff below.
        Both sections must be filled in or checked off.
      </p>

      {/* ── SECTION 1: DQs ── */}
      <div style={{background:"var(--surface2)",border:`1px solid ${dqReady?"#4ade8066":"var(--border)"}`,borderRadius:10,padding:20,marginBottom:16}}>
        {sectionHead("Disqualifications", dqReady)}

        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:16}}>
          <input type="checkbox" checked={noDQs} onChange={e=>{ setNoDQs(e.target.checked); if(e.target.checked) setDqList([]); }}
            style={{width:16,height:16,accentColor:"#4ade80"}} />
          <span style={{fontSize:13,color:"var(--text-primary)",fontWeight:600}}>No disqualifications at this match</span>
        </label>

        {!noDQs && (<>
          {/* DQ list */}
          {dqList.length > 0 && (
            <div style={{marginBottom:16}}>
              {dqList.map((dq,i) => (
                <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"9px 12px",background:"#f8717110",border:"1px solid #f8717144",borderRadius:7,marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{color:"var(--text-primary)",fontWeight:600,fontSize:13}}>{dq.name}</div>
                    <div style={{color:"#f87171",fontSize:11,marginTop:2}}>Rule {dq.ruleCode} — {dq.ruleLabel}</div>
                    {dq.notes && <div style={{color:"var(--text-muted)",fontSize:11,marginTop:2,fontStyle:"italic"}}>{dq.notes}</div>}
                  </div>
                  <button onClick={()=>removeDQ(i)} style={{...btnD,padding:"3px 8px",fontSize:11,flexShrink:0}}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Add DQ form */}
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"14px 16px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>Add Disqualification</div>
            <Field label="Competitor Name / Alias">
              <input style={errInp(dqError)} value={dqName} onChange={e=>{setDqName(e.target.value);setDqError("");}} placeholder="e.g. Jan Hansen" />
            </Field>
            <Field label="Rule Violated">
              <select style={inp} value={dqCode} onChange={e=>setDqCode(e.target.value)}>
                {DQ_REASONS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.rules.map(r => (
                      <option key={r.code} value={r.code}>{r.code} — {r.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Additional notes (optional)">
              <input style={inp} value={dqNotes} onChange={e=>setDqNotes(e.target.value)} placeholder="Stage number, brief description…" />
            </Field>
            {dqError && <div style={{color:"#f87171",fontSize:12,marginBottom:8}}>{dqError}</div>}
            <button style={{...btnP,background:"#b91c1c"}} onClick={addDQ}>+ Add DQ</button>
          </div>
        </>)}
      </div>

      {/* ── SECTION 2: Extra Staff ── */}
      <div style={{background:"var(--surface2)",border:`1px solid ${staffReady?"#4ade8066":"var(--border)"}`,borderRadius:10,padding:20,marginBottom:22}}>
        {sectionHead("Additional Staff (not in RO roster)", staffReady)}
        <p style={{color:"var(--text-faint)",fontSize:12,margin:"0 0 14px"}}>
          List any officials, scorers, stats officers, setup crew etc. who worked the match but aren't on the RO roster page.
        </p>

        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:16}}>
          <input type="checkbox" checked={noExtra} onChange={e=>{ setNoExtra(e.target.checked); if(e.target.checked) setExtraStaff([]); }}
            style={{width:16,height:16,accentColor:"#4ade80"}} />
          <span style={{fontSize:13,color:"var(--text-primary)",fontWeight:600}}>No additional staff to report</span>
        </label>

        {!noExtra && (<>
          {extraStaff.length > 0 && (
            <div style={{marginBottom:16}}>
              {extraStaff.map((s,i) => (
                <div key={i} style={{display:"flex",gap:12,alignItems:"center",padding:"9px 12px",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:7,marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{color:"var(--text-primary)",fontWeight:600,fontSize:13}}>{s.name}</div>
                    <div style={{color:"var(--text-faint)",fontSize:11,marginTop:2}}>{s.role}{s.notes ? " — "+s.notes : ""}</div>
                  </div>
                  <button onClick={()=>removeStaff(i)} style={{...btnD,padding:"3px 8px",fontSize:11}}>✕</button>
                </div>
              ))}
            </div>
          )}

          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"14px 16px"}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>Add Staff Member</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Name">
                <input style={errInp(esError)} value={esName} onChange={e=>{setEsName(e.target.value);setEsError("");}} placeholder="Full name" />
              </Field>
              <Field label="Role">
                <select style={inp} value={esRole} onChange={e=>setEsRole(e.target.value)}>
                  {["Stats Officer","Setup Crew","Scorer","Safety Officer","Statistician","Armorer","Timer Operator","Other"].map(r=><option key={r}>{r}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes (optional)">
              <input style={inp} value={esNotes} onChange={e=>setEsNotes(e.target.value)} placeholder="e.g. Worked stages 1–4" />
            </Field>
            {esError && <div style={{color:"#f87171",fontSize:12,marginBottom:8}}>{esError}</div>}
            <button style={btnS} onClick={addStaff}>+ Add Staff Member</button>
          </div>
        </>)}
      </div>

      {/* ── Confirm ── */}
      {!canConfirm && (
        <div style={{background:"#fbbf2415",border:"1px solid #fbbf2455",borderRadius:7,padding:"11px 14px",color:"#fbbf24",fontSize:13,marginBottom:16}}>
          ⚠️ Complete both sections above before confirming.
          {!dqReady && " — DQ log required."}
          {!staffReady && " — Extra staff report required."}
        </div>
      )}
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button style={btnS} onClick={onClose}>Cancel</button>
        <button
          style={{...btnP, background: canConfirm ? "#16a34a" : "var(--border)", cursor: canConfirm ? "pointer" : "not-allowed", opacity: canConfirm ? 1 : 0.5}}
          disabled={!canConfirm}
          onClick={()=>onConfirm(dqList, extraStaff)}
        >
          ✓ Distribute Points &amp; Complete Match
        </button>
      </div>
    </Modal>
  );
}

function ManageMatch({ match, users, clubs, readonly, onClose, onUpdate }) {
  const [addROId,       setAddROId]       = useState("");
  const [addRole,       setAddRole]       = useState("RO");
  const [addStages,     setAddStages]     = useState("");
  const [addROErr,      setAddROErr]      = useState(false);
  const [editStatus,    setEditStatus]    = useState(match.status);
  const [showComplete,  setShowComplete]  = useState(false);

  const assignedIds  = match.assignments.map(a=>a.roId);
  const availableROs = users.filter(u=>u.active&&u.certification!=="None"&&!assignedIds.includes(u.id));

  // Role options depend on whether this match has combined or separate MD/RM
  const roleOptions = match.combinedMDRM
    ? ["RO-P","RO","CRO","RM","MD/RM"]
    : ["RO-P","RO","CRO","RM","MD","MD/RM"];

  function addAssignment() {
    if (!addROId) { setAddROErr(true); return; }
    setAddROErr(false);
    const stages=addStages.split(",").map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
    const levelPts = MATCH_LEVEL_POINTS[match.level] || 1;
    onUpdate({...match,assignments:[...match.assignments,{roId:addROId,role:addRole,stages,pointsAwarded:levelPts}]});
    setAddROId(""); setAddStages("");
  }
  function removeAssignment(id) { onUpdate({...match,assignments:match.assignments.filter(a=>a.roId!==id)}); }
  function completeMatch(dqList, extraStaff) {
    onUpdate({...match, status:"completed", dqList, extraStaff, _pointsToDistribute:true});
    setShowComplete(false);
  }

  const mdUser = users.find(u=>u.id===match.md);
  const rmUser = users.find(u=>u.id===match.rm);
  const mdName = mdUser?.name || match.mdText || null;


  return (
    <Modal title={`${readonly?"View":"Manage"}: ${match.name}`} onClose={onClose} wide>
      {/* Match header info */}
      <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:"14px 18px",marginBottom:18}}>
        <div style={{display:"flex",gap:24,flexWrap:"wrap",fontSize:13,alignItems:"center"}}>
          <span style={{color:"var(--text-muted)"}}>📅 <span style={{color:"var(--text-primary)"}}>{fmtDate(match.date)}</span></span>
          <span style={{color:"var(--text-muted)"}}>📍 <span style={{color:"var(--text-primary)"}}>{match.region}</span></span>
          <span style={{color:"var(--text-muted)"}}>🎯 <span style={{color:"var(--text-primary)"}}>{match.stages} stages</span></span>
          {match.shooters ? <span style={{color:"var(--text-muted)"}}>🔫 <span style={{color:"var(--text-primary)"}}>{match.shooters} shooters</span></span> : null}
          <span style={{color:"var(--text-muted)"}}><Badge label={match.level} color="#7c8cf8" /></span>
          {match.discipline && <Badge label={match.discipline} color="#0ea5e9" />}
          {match.externalLink && <a href={match.externalLink} target="_blank" rel="noopener noreferrer" style={{color:"#60a5fa",fontSize:13,textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>🔗 Match page ↗</a>}
          {match.hostClubId && clubs && (()=>{ const cl=clubs.find(c=>c.id===match.hostClubId); return cl?<span style={{color:"var(--text-muted)"}}>🏛️ <span style={{color:"var(--text-primary)",fontWeight:600}}>{cl.name}</span></span>:null; })()}
        </div>
        <div style={{marginTop:12,display:"flex",gap:24,flexWrap:"wrap",fontSize:13}}>
          {match.combinedMDRM ? (
            <span style={{color:"var(--text-muted)"}}>👔 MD/RM (combined): <span style={{color:"var(--text-primary)",fontWeight:600}}>{mdName||"—"}</span></span>
          ) : (
            <>
              {mdName && <span style={{color:"var(--text-muted)"}}>🗂️ Match Director: <span style={{color:"var(--text-primary)",fontWeight:600}}>{mdName}</span></span>}
              <span style={{color:"var(--text-muted)"}}>🛡️ Rangemaster: <span style={{color:"var(--text-primary)",fontWeight:600}}>{rmUser?.name||"—"}</span></span>
            </>
          )}
        </div>
      </div>


      {/* Add RO — always-visible compact form when editable */}
      {!readonly && (
        <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:"10px 14px",marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
            Add RO to Roster
            <span style={{fontWeight:400,textTransform:"none",letterSpacing:0,color:"var(--text-faint)",fontSize:11}}>
              {match.combinedMDRM ? "RO=1 · CRO=2 · RM=3 · MD/RM=4 pts" : "RO=1 · CRO=2 · RM/MD=3 · MD/RM=4 pts"}
            </span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 110px 130px auto",gap:8,alignItems:"center"}}>
            <UserPicker
              users={availableROs}
              value={addROId}
              onChange={id => {setAddROId(id);setAddROErr(false);}}
              placeholder="— Choose RO —"
              hasError={addROErr}
            />
            <select style={{...inp,margin:0}} value={addRole} onChange={e=>setAddRole(e.target.value)}>
              {roleOptions.map(r=><option key={r}>{r}</option>)}
            </select>
            <input style={{...inp,margin:0}} value={addStages} onChange={e=>setAddStages(e.target.value)} placeholder="Stages (opt.)" title="Comma-separated, e.g. 1, 2, 5" />
            <button style={{...btnP,whiteSpace:"nowrap",padding:"9px 14px"}} onClick={addAssignment} disabled={!addROId}>
              + Add · <span style={{color:"#fbbf24"}}>{MATCH_LEVEL_POINTS[match.level]||1}pt (L{["I","II","III","IV","V"][["Level I","Level II","Level III","Level IV","Level V"].indexOf(match.level)]})</span>
            </button>
          </div>
          {availableROs.length===0 && <p style={{color:"var(--text-faint)",fontSize:12,margin:"6px 0 0"}}>All eligible ROs are already assigned.</p>}
        </div>
      )}


      {/* RO Roster */}
      <div style={{fontSize:11,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>RO Roster</div>
      <div>
        {match.assignments.length===0&&<p style={{color:"var(--text-faint)",fontSize:14}}>No ROs assigned yet.</p>}
        {match.assignments.map(a=>{
          const ro=users.find(u=>u.id===a.roId);
          return (
            <div key={a.roId} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{flex:1}}>
                <div style={{color:"var(--text-primary)",fontWeight:600,fontSize:14}}>{ro?.name||"Unknown"}</div>
                <div style={{color:"var(--text-faint)",fontSize:12,marginTop:2}}>
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

      {/* Compact stat strip */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
        <span style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600,color:"#60a5fa"}}>
          {match.assignments.length} RO{match.assignments.length!==1?"s":""} assigned
        </span>
        {match.shooters ? (
          <span style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600,color:"#a78bfa"}}>
            {match.shooters} shooters
          </span>
        ) : null}
        <span style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600,color:"#e85d2c"}}>
          {match.assignments.reduce((s,a)=>s+a.pointsAwarded,0)} pts to give
        </span>
        {match.status==="completed" && match.dqList && (
          <span style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:20,padding:"4px 12px",fontSize:12,fontWeight:600,color:match.dqList.length>0?"#f87171":"#4ade80"}}>
            {match.dqList.length===0?"No DQs":`${match.dqList.length} DQ${match.dqList.length!==1?"s":""}`}
          </span>
        )}
      </div>


      {!readonly&&(
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:20,flexWrap:"wrap"}}>
          <select style={{...inp,width:160}} value={editStatus} onChange={e=>setEditStatus(e.target.value)}>
            <option>upcoming</option><option>active</option><option>completed</option>
          </select>
          <button style={{...btnS,padding:"9px 16px"}} onClick={()=>onUpdate({...match,status:editStatus})}>Update Status</button>
          {match.status!=="completed"&&<button style={{...btnP,background:"#16a34a"}} onClick={()=>setShowComplete(true)}>✓ Complete Match…</button>}
          {match.status==="completed"&&<Badge label="Completed ✓" color="#4ade80" />}
        </div>
      )}


      {/* DQ / staff / complete modal */}
      {showComplete && (
        <CompleteMatchModal
          match={match}
          users={users}
          onConfirm={completeMatch}
          onClose={()=>setShowComplete(false)}
        />
      )}


      {/* DQ + extra staff summary (completed matches) */}
      {match.status==="completed" && (match.dqList?.length>0 || match.extraStaff?.length>0) && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
          {match.dqList?.length>0 && (
            <div style={{background:"#f8717110",border:"1px solid #f8717144",borderRadius:8,padding:"14px 16px"}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f87171",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>
                🚫 Disqualifications ({match.dqList.length})
              </div>
              {match.dqList.map((dq,i)=>(
                <div key={i} style={{padding:"7px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                  <div style={{color:"var(--text-primary)",fontWeight:600}}>{dq.name}</div>
                  <div style={{color:"#f87171",fontSize:11,marginTop:2}}>{dq.ruleCode} — {dq.ruleLabel}</div>
                  {dq.notes && <div style={{color:"var(--text-muted)",fontSize:11,marginTop:1,fontStyle:"italic"}}>{dq.notes}</div>}
                </div>
              ))}
            </div>
          )}
          {match.extraStaff?.length>0 && (
            <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8,padding:"14px 16px"}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--text-second)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>
                👔 Additional Staff ({match.extraStaff.length})
              </div>
              {match.extraStaff.map((s,i)=>(
                <div key={i} style={{padding:"7px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                  <div style={{color:"var(--text-primary)",fontWeight:600}}>{s.name}</div>
                  <div style={{color:"var(--text-faint)",fontSize:11,marginTop:2}}>{s.role}{s.notes ? " — "+s.notes : ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLUBS PAGE
// ─────────────────────────────────────────────────────────────────────────────

function ClubsPage({ users, clubs, setClubs, applications, setApplications, matches, regions }) {
  const { currentUser } = useAuth();
  const admin = isAdmin(currentUser);

  const [search,     setSearch]     = useState("");
  const [regionFilt, setRegionFilt] = useState("All");
  const [detail,     setDetail]     = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createFe,   setCreateFe]   = useState({});
  const [createForm, setCreateForm] = useState({ name:"", shortName:"", region:"", website:"", contactEmail:"", founded:"", description:"" });

  const filtered = clubs.filter(c => {
    const q = search.toLowerCase();
    return (c.name.toLowerCase().includes(q) || c.shortName.toLowerCase().includes(q))
      && (regionFilt === "All" || c.region === regionFilt);
  });

  // Membership helpers for current user
  function myMembership(club) {
    return (club.members||[]).find(m=>m.userId===currentUser.id&&m.status==="active");
  }
  function hasPendingApp(clubId) {
    return (applications||[]).some(a=>a.type==="club_membership"&&a.clubId===clubId&&a.userId===currentUser.id&&a.status==="pending");
  }

  function applyMembership(clubId) {
    const app = {
      id:"app"+Date.now(), userId:currentUser.id, userName:currentUser.name,
      userCert:currentUser.certification, userRegion:currentUser.region,
      type:"club_membership", clubId, date:new Date().toISOString().slice(0,10),
      note:"", status:"pending", reviewedBy:null, reviewedDate:null, reviewNote:""
    };
    setApplications(prev=>[...prev,app]);
  }

  function createClub() {
    const errs = {};
    if (!createForm.name.trim())      errs.name      = true;
    if (!createForm.shortName.trim()) errs.shortName = true;
    if (!createForm.region)           errs.region    = true;
    if (Object.keys(errs).length) { setCreateFe(errs); return; }
    const club = {
      ...createForm,
      id: "c"+(clubs.length+1)+(Date.now()%10000),
      active: true,
      members: [{ userId:currentUser.id, role:"president", since:new Date().toISOString().slice(0,10), status:"active" }]
    };
    setClubs(prev=>[...prev,club]);
    setShowCreate(false);
    setCreateForm({ name:"", shortName:"", region:"", website:"", contactEmail:"", founded:"", description:"" });
    setCreateFe({});
    setDetail(club);
  }

  return (
    <div style={{padding:"28px 32px", maxWidth:980}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <h1 style={{margin:"0 0 4px",fontSize:26,fontWeight:800,color:"var(--text-primary)",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.04em"}}>Clubs</h1>
          <p style={{margin:0,color:"var(--text-muted)",fontSize:14}}>{clubs.length} registered club{clubs.length!==1?"s":""} · apply for membership or manage your club</p>
        </div>
        <button style={{...btnP,padding:"10px 18px"}} onClick={()=>{setShowCreate(true);setCreateFe({});}}>+ Register Club</button>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search clubs…" style={{...inp,flex:1,minWidth:180}} />
        <select style={{...inp,width:160}} value={regionFilt} onChange={e=>setRegionFilt(e.target.value)}>
          <option value="All">All Districts</option>
          {[...new Set(clubs.map(c=>c.region))].sort().map(r=><option key={r}>{r}</option>)}
        </select>
      </div>

      {/* Club cards */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.map(club => {
          const membership = myMembership(club);
          const pending    = hasPendingApp(club.id);
          const canManage  = canManageClub(currentUser, club);
          const matchCount = (matches||[]).filter(m=>m.hostClubId===club.id).length;

          return (
            <div key={club.id} style={{
              background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,
              padding:"16px 20px",display:"flex",alignItems:"center",gap:16
            }}>
              {/* Club avatar */}
              <div style={{
                width:46,height:46,borderRadius:10,background:"#e85d2c",flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:14,fontWeight:800,color:"#fff",letterSpacing:"0.05em",fontFamily:"'Barlow Condensed',sans-serif"
              }}>{club.shortName.slice(0,3)}</div>

              <div style={{flex:1}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                  <span style={{fontWeight:700,fontSize:15,color:"var(--text-primary)"}}>{club.name}</span>
                  <Badge label={club.shortName} color="#7c8cf8" />
                  <Badge label={club.region}    color="var(--text-faint)" />
                  {membership && <Badge label={membership.role} color={clubRoleColor(membership.role)} />}
                  {canManage  && <Badge label="⚙ Admin" color="#a855f7" />}
                </div>
                <div style={{fontSize:12,color:"var(--text-muted)",display:"flex",gap:14,flexWrap:"wrap"}}>
                  <span>👥 {(club.members||[]).filter(m=>m.status==="active").length} member{(club.members||[]).filter(m=>m.status==="active").length!==1?"s":""}</span>
                  {matchCount>0 && <span>🎯 {matchCount} match{matchCount!==1?"es":""} hosted</span>}
                  {club.website && <a href={club.website} target="_blank" rel="noopener noreferrer" style={{color:"#60a5fa",textDecoration:"none"}}>🔗 Website</a>}
                </div>
                {club.description && <div style={{fontSize:12,color:"var(--text-faint)",marginTop:4,fontStyle:"italic",maxWidth:560}}>{club.description.length>100?club.description.slice(0,100)+"…":club.description}</div>}
              </div>

              <div style={{display:"flex",gap:8,flexShrink:0,alignItems:"center"}}>
                {!membership && !pending && (
                  <button style={{...btnS,padding:"7px 14px",fontSize:13}} onClick={()=>applyMembership(club.id)}>Apply to Join</button>
                )}
                {!membership && pending && (
                  <span style={{fontSize:12,color:"#60a5fa",padding:"7px 12px"}}>⏳ Application pending</span>
                )}
                {membership && !canManage && (
                  <span style={{fontSize:12,color:"#4ade80",padding:"7px 12px"}}>✓ Member</span>
                )}
                <button style={{...btnP,padding:"7px 14px",fontSize:13}} onClick={()=>setDetail(club)}>
                  {canManage ? "Manage" : "View"}
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length===0 && <div style={{textAlign:"center",padding:60,color:"var(--text-faint)"}}>No clubs found.</div>}
      </div>

      {/* Create Club Modal */}
      {showCreate && (
        <Modal title="Register New Club" onClose={()=>{setShowCreate(false);setCreateFe({});}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
            <Field label="Club Name">
              <input style={errInp(createFe.name)} value={createForm.name}
                onChange={e=>{setCreateForm(f=>({...f,name:e.target.value}));setCreateFe(p=>({...p,name:false}));}}
                placeholder="e.g. Oslo Pistolklubb" />
            </Field>
            <Field label="Short Name / Abbreviation">
              <input style={errInp(createFe.shortName)} value={createForm.shortName}
                onChange={e=>{setCreateForm(f=>({...f,shortName:e.target.value.toUpperCase()}));setCreateFe(p=>({...p,shortName:false}));}}
                placeholder="e.g. OPK" maxLength={6} />
            </Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Field label="District">
              <RegionSelect value={createForm.region} onChange={v=>{setCreateForm(f=>({...f,region:v}));setCreateFe(p=>({...p,region:false}));}}
                regions={regions} placeholder="— Select district —" hasError={createFe.region} />
            </Field>
            <Field label="Founded (optional)">
              <input style={inp} type="date" value={createForm.founded} onChange={e=>setCreateForm(f=>({...f,founded:e.target.value}))} />
            </Field>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            <Field label="Website (optional)">
              <input style={inp} type="url" value={createForm.website} onChange={e=>setCreateForm(f=>({...f,website:e.target.value}))} placeholder="https://…" />
            </Field>
            <Field label="Contact Email (optional)">
              <input style={inp} type="email" value={createForm.contactEmail} onChange={e=>setCreateForm(f=>({...f,contactEmail:e.target.value}))} placeholder="info@club.no" />
            </Field>
          </div>
          <Field label="Description (optional)">
            <textarea style={{...inp,height:72,resize:"vertical"}} value={createForm.description}
              onChange={e=>setCreateForm(f=>({...f,description:e.target.value}))} placeholder="Brief description of the club…" />
          </Field>
          <div style={{background:"#60a5fa11",border:"1px solid #60a5fa33",borderRadius:7,padding:"10px 14px",fontSize:12,color:"var(--text-muted)",marginBottom:8}}>
            You will be added as <Badge label="president" color="#f97316" /> of this club.
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
            <button style={btnS} onClick={()=>{setShowCreate(false);setCreateFe({});}}>Cancel</button>
            <button style={btnP} onClick={createClub}>Register Club</button>
          </div>
        </Modal>
      )}

      {/* Club Detail Modal */}
      {detail && (
        <ClubDetailModal
          club={clubs.find(c=>c.id===detail.id)||detail}
          users={users}
          currentUser={currentUser}
          applications={applications}
          setApplications={setApplications}
          matches={matches}
          onClose={()=>setDetail(null)}
          onUpdate={updated=>setClubs(prev=>prev.map(c=>c.id===updated.id?updated:c))}
          isAdmin={admin}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLUB DETAIL MODAL
// Tabs: Info | Members | Applications (club admins) | Matches
// ─────────────────────────────────────────────────────────────────────────────

function ClubDetailModal({ club, users, currentUser, applications, setApplications, matches, onClose, onUpdate, isAdmin: sysAdmin }) {
  const [tab,        setTab]        = useState("info");
  const [editMode,   setEditMode]   = useState(false);
  const [editForm,   setEditForm]   = useState({ name:club.name, shortName:club.shortName, website:club.website||"", contactEmail:club.contactEmail||"", description:club.description||"" });
  const [editFe,     setEditFe]     = useState({});
  const [reviewingId,setReviewingId]= useState(null);
  const [reviewNote, setReviewNote] = useState("");

  const canManage = canManageClub(currentUser, club);
  const isPresident = isClubPresident(currentUser, club);

  const activeMembers = (club.members||[]).filter(m=>m.status==="active");
  const pendingApps   = (applications||[]).filter(a=>a.type==="club_membership"&&a.clubId===club.id&&a.status==="pending");
  const hostMatches   = (matches||[]).filter(m=>m.hostClubId===club.id);

  function saveEdit() {
    const errs = {};
    if (!editForm.name.trim())      errs.name      = true;
    if (!editForm.shortName.trim()) errs.shortName = true;
    if (Object.keys(errs).length) { setEditFe(errs); return; }
    setEditFe({});
    onUpdate({ ...club, ...editForm });
    setEditMode(false);
  }

  function approveApp(app) {
    // Add to club members
    const newMember = { userId:app.userId, role:"member", since:new Date().toISOString().slice(0,10), status:"active" };
    onUpdate({ ...club, members:[...(club.members||[]), newMember] });
    // Update application status
    setApplications(prev=>prev.map(a=>a.id===app.id
      ? {...a, status:"approved", reviewedBy:currentUser.name, reviewedDate:new Date().toISOString().slice(0,10), reviewNote}
      : a
    ));
    setReviewingId(null); setReviewNote("");
  }

  function rejectApp(app) {
    setApplications(prev=>prev.map(a=>a.id===app.id
      ? {...a, status:"rejected", reviewedBy:currentUser.name, reviewedDate:new Date().toISOString().slice(0,10), reviewNote}
      : a
    ));
    setReviewingId(null); setReviewNote("");
  }

  function setMemberRole(userId, newRole) {
    onUpdate({ ...club, members:(club.members||[]).map(m=>m.userId===userId?{...m,role:newRole}:m) });
  }

  function suspendMember(userId) {
    onUpdate({ ...club, members:(club.members||[]).map(m=>m.userId===userId?{...m,status:"suspended"}:m) });
  }

  function reinstateMember(userId) {
    onUpdate({ ...club, members:(club.members||[]).map(m=>m.userId===userId?{...m,status:"active"}:m) });
  }

  function removeMember(userId) {
    if (!window.confirm("Remove this member from the club?")) return;
    onUpdate({ ...club, members:(club.members||[]).filter(m=>m.userId!==userId) });
  }

  const TABS = [
    { id:"info",     label:"Info" },
    { id:"members",  label:`Members (${activeMembers.length})` },
    canManage && pendingApps.length > 0 && { id:"apps", label:`Applications (${pendingApps.length})`, accent:true },
    canManage && { id:"apps", label:`Applications${pendingApps.length>0?" ("+pendingApps.length+")":""}`, accent:pendingApps.length>0 },
    { id:"matches",  label:`Matches (${hostMatches.length})` },
  ].filter(Boolean);

  // Dedupe tabs (apps appears twice due to conditional logic above)
  const seenIds = new Set();
  const uniqueTabs = TABS.filter(t=>{ if(seenIds.has(t.id)){return false;} seenIds.add(t.id); return true; });

  const tabStyle = t => ({
    background:"none", border:"none",
    borderBottom: tab===t.id ? "2px solid #e85d2c" : "2px solid transparent",
    color: tab===t.id ? "var(--text-primary)" : "var(--text-muted)",
    padding:"9px 16px", cursor:"pointer", fontSize:13, fontWeight:tab===t.id?700:400,
    marginBottom:-1, whiteSpace:"nowrap",
    ...(t.accent && tab!==t.id ? {color:"#e85d2c"} : {})
  });

  return (
    <Modal title={club.name} onClose={onClose} wide>
      {/* Club header strip */}
      <div style={{display:"flex",gap:16,alignItems:"center",marginBottom:20,padding:"14px 18px",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:8}}>
        <div style={{width:52,height:52,borderRadius:10,background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff",letterSpacing:"0.05em",fontFamily:"'Barlow Condensed',sans-serif",flexShrink:0}}>
          {club.shortName.slice(0,3)}
        </div>
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:4}}>
            <Badge label={club.shortName} color="#7c8cf8" />
            <Badge label={club.region}    color="var(--text-faint)" />
            {!club.active && <Badge label="Inactive" color="#f87171" />}
          </div>
          <div style={{display:"flex",gap:16,fontSize:12,color:"var(--text-muted)",flexWrap:"wrap"}}>
            <span>👥 {activeMembers.length} active member{activeMembers.length!==1?"s":""}</span>
            {club.founded && <span>📅 Founded {fmtDate(club.founded)}</span>}
            {club.contactEmail && <span>✉️ {club.contactEmail}</span>}
            {club.website && <a href={club.website} target="_blank" rel="noopener noreferrer" style={{color:"#60a5fa",textDecoration:"none"}}>🔗 Website</a>}
          </div>
        </div>
        {canManage && !editMode && (
          <button style={{...btnS,padding:"7px 14px",fontSize:12}} onClick={()=>setEditMode(true)}>✏️ Edit</button>
        )}
      </div>

      {/* Tab bar */}
      <div style={{display:"flex",gap:0,borderBottom:"1px solid var(--border)",marginBottom:20,overflowX:"auto"}}>
        {uniqueTabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={tabStyle(t)}>{t.label}</button>
        ))}
      </div>

      {/* ── INFO TAB ── */}
      {tab==="info" && (
        <div>
          {editMode ? (
            <div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
                <Field label="Club Name">
                  <input style={errInp(editFe.name)} value={editForm.name}
                    onChange={e=>{setEditForm(f=>({...f,name:e.target.value}));setEditFe(p=>({...p,name:false}));}} />
                </Field>
                <Field label="Short Name">
                  <input style={errInp(editFe.shortName)} value={editForm.shortName}
                    onChange={e=>{setEditForm(f=>({...f,shortName:e.target.value.toUpperCase()}));setEditFe(p=>({...p,shortName:false}));}}
                    maxLength={6} />
                </Field>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                <Field label="Website">
                  <input style={inp} type="url" value={editForm.website} onChange={e=>setEditForm(f=>({...f,website:e.target.value}))} placeholder="https://…" />
                </Field>
                <Field label="Contact Email">
                  <input style={inp} type="email" value={editForm.contactEmail} onChange={e=>setEditForm(f=>({...f,contactEmail:e.target.value}))} />
                </Field>
              </div>
              <Field label="Description">
                <textarea style={{...inp,height:80,resize:"vertical"}} value={editForm.description} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))} />
              </Field>
              <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:4}}>
                <button style={btnS} onClick={()=>{setEditMode(false);setEditFe({});}}>Cancel</button>
                <button style={btnP} onClick={saveEdit}>Save Changes</button>
              </div>
            </div>
          ) : (
            <div>
              {club.description && (
                <p style={{color:"var(--text-second)",fontSize:14,lineHeight:1.6,marginTop:0,marginBottom:20}}>{club.description}</p>
              )}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <InfoRow label="District"      value={club.region||"—"} />
                <InfoRow label="Founded"       value={club.founded?fmtDate(club.founded):"—"} />
                <InfoRow label="Contact Email" value={club.contactEmail||"—"} />
                <InfoRow label="Website"       value={club.website||"—"} />
                <InfoRow label="Active Members" value={activeMembers.length} />
                <InfoRow label="Matches Hosted" value={hostMatches.length} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MEMBERS TAB ── */}
      {tab==="members" && (
        <div>
          {/* Role legend */}
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {CLUB_ROLES.map(r=>(
              <span key={r} style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:"var(--text-faint)"}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:clubRoleColor(r),display:"inline-block"}} />{r}
              </span>
            ))}
            <span style={{fontSize:12,color:"var(--text-faint)",marginLeft:8}}>· President can manage roles · Secretary can approve/reject applications</span>
          </div>

          {/* All members (active + suspended) */}
          {(club.members||[]).length===0 && <p style={{color:"var(--text-faint)",fontSize:14}}>No members yet.</p>}
          {(club.members||[]).map(m=>{
            const u = users.find(u=>u.id===m.userId);
            if (!u) return null;
            const isSelf = m.userId === currentUser.id;
            const isThisPresident = m.role==="president";
            const canChangeRole = isPresident && !isSelf;
            const canRemove = isPresident && !isSelf;

            return (
              <div key={m.userId} style={{
                display:"flex",alignItems:"center",gap:12,padding:"10px 0",
                borderBottom:"1px solid var(--border)",
                opacity: m.status==="suspended" ? 0.5 : 1
              }}>
                <div style={{width:34,height:34,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>{u.name.charAt(0)}</div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{color:"var(--text-primary)",fontWeight:600,fontSize:14}}>{u.name}</span>
                    {isSelf && <span style={{fontSize:11,color:"var(--text-faint)"}}>(you)</span>}
                    <Badge label={m.role} color={clubRoleColor(m.role)} />
                    {m.status==="suspended" && <Badge label="Suspended" color="#f87171" />}
                    {u.certification!=="None" && <Badge label={u.certification} color={certColor(u.certification)} />}
                  </div>
                  <div style={{fontSize:12,color:"var(--text-faint)",marginTop:2}}>
                    Member since {fmtDate(m.since)} · {u.region||"—"}
                  </div>
                </div>

                {canManage && (
                  <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                    {/* Role select — only president can change roles */}
                    {canChangeRole && (
                      <select
                        style={{...inp,width:110,padding:"5px 8px",fontSize:12}}
                        value={m.role}
                        onChange={e=>setMemberRole(m.userId,e.target.value)}
                      >
                        {CLUB_ROLES.map(r=><option key={r} value={r}>{r}</option>)}
                      </select>
                    )}
                    {m.status==="active" && canRemove && (
                      <button style={{...btnD,padding:"4px 9px",fontSize:11}} onClick={()=>suspendMember(m.userId)}>Suspend</button>
                    )}
                    {m.status==="suspended" && canRemove && (
                      <button style={{...btnS,padding:"4px 9px",fontSize:11}} onClick={()=>reinstateMember(m.userId)}>Reinstate</button>
                    )}
                    {canRemove && (
                      <button style={{...btnD,padding:"4px 9px",fontSize:11}} onClick={()=>removeMember(m.userId)}>✕</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── APPLICATIONS TAB ── */}
      {tab==="apps" && canManage && (
        <div>
          {pendingApps.length===0 && <p style={{color:"var(--text-faint)",fontSize:14}}>No pending membership applications.</p>}
          {pendingApps.map(app=>{
            const applicant = users.find(u=>u.id===app.userId);
            const isReviewing = reviewingId===app.id;
            return (
              <div key={app.id} style={{background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:10,overflow:"hidden",marginBottom:10}}>
                <div style={{padding:"14px 18px",display:"flex",gap:14,alignItems:"center"}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>
                    {(applicant?.name||app.userName||"?").charAt(0)}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:"var(--text-primary)",fontSize:14,marginBottom:2}}>{applicant?.name||app.userName}</div>
                    <div style={{fontSize:12,color:"var(--text-faint)",display:"flex",gap:12,flexWrap:"wrap"}}>
                      <span>Cert: {applicant?.certification||"—"}</span>
                      <span>District: {applicant?.region||"—"}</span>
                      <span>Applied: {fmtDate(app.date)}</span>
                    </div>
                    {app.note&&<div style={{marginTop:6,fontSize:13,color:"var(--text-muted)",fontStyle:"italic"}}>&ldquo;{app.note}&rdquo;</div>}
                  </div>
                  {!isReviewing && (
                    <div style={{display:"flex",gap:8}}>
                      <button style={{...btnP,padding:"7px 14px",fontSize:12,background:"#16a34a"}} onClick={()=>{setReviewingId(app.id);setReviewNote("");}}>Approve</button>
                      <button style={{...btnD,padding:"7px 14px",fontSize:12}} onClick={()=>{setReviewingId(app.id);setReviewNote("");}}>Reject</button>
                    </div>
                  )}
                </div>
                {isReviewing && (
                  <div style={{padding:"12px 18px",borderTop:"1px solid var(--border)",background:"var(--surface)"}}>
                    <Field label="Note (optional)">
                      <input style={inp} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Optional note for the applicant…" />
                    </Field>
                    <div style={{display:"flex",gap:8,marginTop:4}}>
                      <button style={{...btnP,background:"#16a34a",padding:"8px 16px",fontSize:13}} onClick={()=>approveApp(app)}>✓ Confirm Approve</button>
                      <button style={{...btnD,padding:"8px 16px",fontSize:13}} onClick={()=>rejectApp(app)}>✕ Confirm Reject</button>
                      <button style={{...btnS,padding:"8px 12px",fontSize:13}} onClick={()=>setReviewingId(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Past apps */}
          {(applications||[]).filter(a=>a.type==="club_membership"&&a.clubId===club.id&&a.status!=="pending").length>0 && (
            <div style={{marginTop:20}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--text-faint)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:8}}>Past Decisions</div>
              {(applications||[]).filter(a=>a.type==="club_membership"&&a.clubId===club.id&&a.status!=="pending").map(app=>(
                <div key={app.id} style={{padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13,display:"flex",gap:10,alignItems:"center"}}>
                  <Badge label={app.status} color={app.status==="approved"?"#4ade80":"#f87171"} />
                  <span style={{color:"var(--text-primary)"}}>{app.userName}</span>
                  <span style={{color:"var(--text-faint)",fontSize:12}}>by {app.reviewedBy} · {fmtDate(app.reviewedDate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MATCHES TAB ── */}
      {tab==="matches" && (
        <div>
          {hostMatches.length===0 && <p style={{color:"var(--text-faint)",fontSize:14}}>No matches hosted by this club yet.</p>}
          {hostMatches.sort((a,b)=>new Date(b.date)-new Date(a.date)).map(m=>(
            <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{flex:1}}>
                <div style={{color:"var(--text-primary)",fontWeight:600,fontSize:14,marginBottom:2}}>{m.name}</div>
                <div style={{fontSize:12,color:"var(--text-faint)",display:"flex",gap:12,flexWrap:"wrap"}}>
                  <span>📅 {fmtDate(m.date)}</span>
                  <span>🎯 {m.stages} stages</span>
                  <span>{m.assignments.length} RO{m.assignments.length!==1?"s":""}</span>
                </div>
              </div>
              <Badge label={m.level}  color="#7c8cf8" />
              <Badge label={m.status} color={statusColor(m.status)} />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTATION PAGE
// ─────────────────────────────────────────────────────────────────────────────

function DocsPage({ docs, setDocs }) {
  const { currentUser } = useAuth();
  const admin = isAdmin(currentUser);

  const [search,      setSearch]      = useState("");
  const [catFilter,   setCatFilter]   = useState("All");
  const [sortCol,     setSortCol]     = useState("uploadDate");
  const [sortDir,     setSortDir]     = useState("desc");
  const [showUpload,  setShowUpload]  = useState(false);
  const [pendingFile, setPendingFile] = useState(null);   // { name, ext, size, dataUrl }
  const [uploadForm,  setUploadForm]  = useState({ category:"NROI", description:"" });
  const [uploadFe,    setUploadFe]    = useState({});
  const [dragOver,    setDragOver]    = useState(false);
  const fileInputRef = React.useRef(null);

  // ── Filtering + sorting ──────────────────────────────────────────────────
  const catCounts = React.useMemo(() => {
    const c = { All: docs.length };
    DOC_CATEGORIES.forEach(k => { c[k] = docs.filter(d=>d.category===k).length; });
    return c;
  }, [docs]);

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase();
    return docs
      .filter(d =>
        (catFilter==="All" || d.category===catFilter) &&
        (d.name.toLowerCase().includes(q) ||
         (d.description||"").toLowerCase().includes(q) ||
         d.uploadedByName.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        let av = a[sortCol]??"", bv = b[sortCol]??"";
        if (sortCol==="fileSize") { av=a.fileSize||0; bv=b.fileSize||0; }
        const cmp = typeof av==="number" ? av-bv : String(av).localeCompare(String(bv));
        return sortDir==="asc" ? cmp : -cmp;
      });
  }, [docs, search, catFilter, sortCol, sortDir]);

  function toggleSort(col) {
    if (sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortCol(col); setSortDir("asc"); }
  }

  // ── File reading (FileReader → dataUrl) ─────────────────────────────────
  function readFile(file) {
    const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "bin";
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve({ name:file.name, ext, size:file.size, dataUrl:e.target.result });
      reader.readAsDataURL(file);
    });
  }

  async function acceptFile(file) {
    if (!file) return;
    const parsed = await readFile(file);
    setPendingFile(parsed);
    setUploadFe({});
  }

  // ── Upload submit ────────────────────────────────────────────────────────
  function submitUpload() {
    const errs = {};
    if (!pendingFile)          errs.file     = true;
    if (!uploadForm.category)  errs.category = true;
    if (Object.keys(errs).length) { setUploadFe(errs); return; }
    setDocs(prev => [{
      id: "d"+Date.now(),
      name: pendingFile.name,
      category: uploadForm.category,
      description: uploadForm.description.trim(),
      fileType: pendingFile.ext,
      fileSize: pendingFile.size,
      uploadedByName: currentUser.name,
      uploadDate: new Date().toISOString().slice(0,10),
      dataUrl: pendingFile.dataUrl,
    }, ...prev]);
    setPendingFile(null);
    setUploadForm({ category:"NROI", description:"" });
    setUploadFe({});
    setShowUpload(false);
  }

  // ── Download ─────────────────────────────────────────────────────────────
  function downloadDoc(doc) {
    if (!doc.dataUrl) return;
    const a = document.createElement("a");
    a.href = doc.dataUrl;
    a.download = doc.name;
    a.click();
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  function deleteDoc(id) {
    if (!window.confirm("Delete this document? This cannot be undone.")) return;
    setDocs(prev => prev.filter(d=>d.id!==id));
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────
  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  }

  // ── Sortable column header ────────────────────────────────────────────────
  function TH({ col, label, width, right }) {
    const active = sortCol===col;
    return (
      <th onClick={()=>toggleSort(col)} style={{
        padding:"10px 14px", textAlign:right?"right":"left", fontSize:11, fontWeight:700,
        color:"var(--text-faint)", textTransform:"uppercase", letterSpacing:"0.07em",
        borderBottom:"1px solid var(--border)", cursor:"pointer", whiteSpace:"nowrap",
        userSelect:"none", width,
      }}>
        {label}
        <span style={{marginLeft:4, fontSize:10, color:active?"#e85d2c":"var(--text-faint)"}}>
          {active ? (sortDir==="asc"?"▲":"▼") : "⇅"}
        </span>
      </th>
    );
  }

  return (
    <div style={{padding:"28px 32px", maxWidth:1060}}>

      {/* ── Page header ── */}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24}}>
        <div>
          <h1 style={{margin:"0 0 4px", fontSize:26, fontWeight:800, color:"var(--text-primary)",
            fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:"0.04em"}}>Documentation</h1>
          <p style={{margin:0, color:"var(--text-muted)", fontSize:14}}>
            {docs.length} document{docs.length!==1?"s":""} · official rules, handbooks and reference materials
          </p>
        </div>
        {admin && (
          <button style={{...btnP, padding:"10px 18px"}}
            onClick={()=>{ setShowUpload(s=>!s); setPendingFile(null); setUploadFe({}); }}>
            {showUpload ? "✕ Cancel" : "↑ Upload Document"}
          </button>
        )}
      </div>

      {/* ── Upload panel (admin only) ── */}
      {admin && showUpload && (
        <div style={{background:"var(--surface2)", border:"1px solid var(--border)",
          borderRadius:10, padding:"20px 24px", marginBottom:24}}>

          {/* Drop zone / file preview */}
          {!pendingFile ? (
            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={onDrop}
              onClick={()=>fileInputRef.current?.click()}
              style={{
                border:`2px dashed ${dragOver?"#e85d2c":uploadFe.file?"#f87171":"var(--border2)"}`,
                borderRadius:8, padding:"30px 20px", textAlign:"center", cursor:"pointer",
                background: dragOver?"#e85d2c08":uploadFe.file?"#f8717108":"var(--surface)",
                marginBottom:16, transition:"border-color 0.15s, background 0.15s",
              }}
            >
              <div style={{fontSize:28, marginBottom:6}}>📎</div>
              <div style={{color:"var(--text-primary)", fontWeight:600, fontSize:14, marginBottom:3}}>
                Click to browse or drag &amp; drop a file
              </div>
              <div style={{color:"var(--text-faint)", fontSize:12}}>Any file type — PDF, Word, Excel, images…</div>
              {uploadFe.file && <div style={{color:"#f87171", fontSize:12, marginTop:6}}>Please select a file.</div>}
              <input ref={fileInputRef} type="file" style={{display:"none"}}
                onChange={e=>acceptFile(e.target.files?.[0])} />
            </div>
          ) : (
            <div style={{display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
              background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, marginBottom:16}}>
              <div style={{
                width:38, height:38, borderRadius:6, flexShrink:0,
                background:docTypeColor(pendingFile.ext)+"22",
                border:`1px solid ${docTypeColor(pendingFile.ext)}55`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:12, fontWeight:800, color:docTypeColor(pendingFile.ext),
                textTransform:"uppercase", fontFamily:"'Barlow Condensed',sans-serif",
              }}>.{pendingFile.ext}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{color:"var(--text-primary)", fontWeight:600, fontSize:13,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{pendingFile.name}</div>
                <div style={{color:"var(--text-faint)", fontSize:11, marginTop:1}}>{fmtFileSize(pendingFile.size)}</div>
              </div>
              <button onClick={()=>setPendingFile(null)}
                style={{background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer",fontSize:20,lineHeight:1,padding:"0 4px"}}>×</button>
            </div>
          )}

          {/* Category + description */}
          <div style={{display:"grid", gridTemplateColumns:"150px 1fr", gap:16, marginBottom:16}}>
            <Field label="Category">
              <select style={errInp(uploadFe.category)} value={uploadForm.category}
                onChange={e=>{setUploadForm(f=>({...f,category:e.target.value}));setUploadFe(p=>({...p,category:false}));}}>
                {DOC_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Description" hint="Optional — shown in the document table">
              <input style={inp} value={uploadForm.description}
                onChange={e=>setUploadForm(f=>({...f,description:e.target.value}))}
                placeholder="e.g. Current IPSC rulebook effective January 2026" />
            </Field>
          </div>

          <div style={{display:"flex", gap:10, justifyContent:"flex-end"}}>
            <button style={btnS} onClick={()=>{setShowUpload(false);setPendingFile(null);setUploadFe({});}}>Cancel</button>
            <button style={{...btnP, opacity:pendingFile?1:0.45}} onClick={submitUpload} disabled={!pendingFile}>
              ↑ Upload
            </button>
          </div>
        </div>
      )}

      {/* ── Category filter chips + search ── */}
      <div style={{display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center"}}>
        {["All",...DOC_CATEGORIES].map(cat=>{
          const active = catFilter===cat;
          const color  = cat==="All" ? "#e85d2c" : docCatColor(cat);
          return (
            <button key={cat} onClick={()=>setCatFilter(cat)} style={{
              padding:"5px 14px", borderRadius:20, fontSize:12, fontWeight:600,
              cursor:"pointer", border:`1px solid ${active?color:"var(--border)"}`,
              background: active ? color+"22" : "var(--surface2)",
              color: active ? color : "var(--text-muted)",
              transition:"all 0.12s",
            }}>
              {cat}
              <span style={{opacity:0.7, marginLeft:5}}>({catCounts[cat]||0})</span>
            </button>
          );
        })}
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search documents…"
          style={{...inp, flex:1, minWidth:160, padding:"6px 12px", fontSize:13}} />
      </div>

      {/* ── Document table ── */}
      <div style={{background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, overflow:"hidden"}}>
        {filtered.length===0 ? (
          <div style={{textAlign:"center", padding:"60px 20px", color:"var(--text-faint)", fontSize:14}}>
            {docs.length===0 ? "No documents have been uploaded yet." : "No documents match your search."}
          </div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%", borderCollapse:"collapse", minWidth:700}}>
              <thead>
                <tr style={{background:"var(--surface3)"}}>
                  <TH col="category"       label="Category"    width={100} />
                  <TH col="name"           label="File Name"               />
                  <TH col="fileType"       label="Type"        width={72}  />
                  <TH col="description"    label="Description"             />
                  <TH col="fileSize"       label="Size"        width={80} right />
                  <TH col="uploadedByName" label="Uploaded By" width={130} />
                  <TH col="uploadDate"     label="Date"        width={110} />
                  <th style={{width:admin?116:90, borderBottom:"1px solid var(--border)"}} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, i) => {
                  const rowBg = i%2===0 ? "transparent" : "var(--surface3)";
                  return (
                    <tr key={doc.id}
                      style={{background:rowBg}}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"}
                      onMouseLeave={e=>e.currentTarget.style.background=rowBg}
                    >
                      {/* Category */}
                      <td style={{padding:"11px 14px", whiteSpace:"nowrap"}}>
                        <Badge label={doc.category} color={docCatColor(doc.category)} />
                      </td>

                      {/* File name */}
                      <td style={{padding:"11px 14px", maxWidth:220}}>
                        <div style={{color:"var(--text-primary)", fontWeight:600, fontSize:13,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}
                          title={doc.name}>{doc.name}</div>
                      </td>

                      {/* File type badge */}
                      <td style={{padding:"11px 14px"}}>
                        <span style={{
                          display:"inline-block", padding:"2px 7px", borderRadius:5,
                          fontSize:11, fontWeight:800, textTransform:"uppercase",
                          letterSpacing:"0.04em", fontFamily:"'Barlow Condensed',sans-serif",
                          background:docTypeColor(doc.fileType)+"22",
                          color:docTypeColor(doc.fileType),
                          border:`1px solid ${docTypeColor(doc.fileType)}44`,
                        }}>.{doc.fileType||"?"}</span>
                      </td>

                      {/* Description */}
                      <td style={{padding:"11px 14px", maxWidth:260}}>
                        {doc.description
                          ? <div style={{color:"var(--text-second)", fontSize:12,
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}
                              title={doc.description}>{doc.description}</div>
                          : <span style={{color:"var(--text-faint)", fontStyle:"italic", fontSize:12}}>—</span>}
                      </td>

                      {/* Size */}
                      <td style={{padding:"11px 14px", textAlign:"right",
                        color:"var(--text-faint)", fontSize:12, whiteSpace:"nowrap"}}>
                        {fmtFileSize(doc.fileSize)}
                      </td>

                      {/* Uploaded by */}
                      <td style={{padding:"11px 14px", color:"var(--text-muted)", fontSize:12, whiteSpace:"nowrap"}}>
                        {doc.uploadedByName}
                      </td>

                      {/* Upload date */}
                      <td style={{padding:"11px 14px", color:"var(--text-faint)", fontSize:12, whiteSpace:"nowrap"}}>
                        {fmtDate(doc.uploadDate)}
                      </td>

                      {/* Actions */}
                      <td style={{padding:"11px 14px"}}>
                        <div style={{display:"flex", gap:6, justifyContent:"flex-end"}}>
                          <button
                            onClick={()=>downloadDoc(doc)}
                            disabled={!doc.dataUrl}
                            style={{...btnS, padding:"5px 11px", fontSize:12,
                              opacity:doc.dataUrl?1:0.4, cursor:doc.dataUrl?"pointer":"default"}}
                          >↓ Download</button>
                          {admin && (
                            <button onClick={()=>deleteDoc(doc.id)}
                              style={{...btnD, padding:"5px 9px", fontSize:12}}
                              title="Delete document">✕</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Row count footer */}
      {filtered.length>0 && filtered.length!==docs.length && (
        <div style={{textAlign:"right", marginTop:8, fontSize:12, color:"var(--text-faint)"}}>
          Showing {filtered.length} of {docs.length} documents
        </div>
      )}
    </div>
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
  const [maintenanceId,setMaintenanceId]= useState(null);  // expanded user in maintenance table
  const [ledgerFilter, setLedgerFilter] = useState("all"); // "all" | userId

  const thisYear = new Date().getFullYear().toString();
  const sorted   = [...users].filter(u=>u.active).sort((a,b)=>b.points-a.points);
  const max      = sorted[0]?.points||1;

  function applyAdjust() {
    const amt=parseInt(adjustAmt);
    if (!adjustId||isNaN(amt)||amt===0) return;
    const ro=users.find(u=>u.id===adjustId);
    if (!ro) return;
    setUsers(prev=>prev.map(u=>u.id===adjustId?{...u,points:u.points+amt}:u));
    setAdjustLog(prev=>[{roId:adjustId,roName:ro.name,amt,reason:adjustReason||"Manual adjustment",date:new Date().toISOString().slice(0,10)},...prev]);
    setAdjustId(""); setAdjustAmt(""); setAdjustReason("");
  }

  // Build ledger from completed matches
  const matchLedger = [];
  matches.forEach(m=>{
    if (m.status!=="completed") return;
    m.assignments.forEach(a=>{
      const ro=users.find(u=>u.id===a.roId);
      if (ro) matchLedger.push({ roId:a.roId, name:ro.name, matchName:m.name, matchLevel:m.level, date:m.date, role:a.role, amt:a.pointsAwarded });
    });
  });
  adjustLog.forEach(e=>matchLedger.push({roId:e.roId,name:e.roName,matchName:"Manual adjustment",matchLevel:"—",date:e.date,role:"Adj.",amt:e.amt,reason:e.reason}));
  matchLedger.sort((a,b)=>b.date.localeCompare(a.date));

  const visibleLedger = ledgerFilter==="all" ? matchLedger : matchLedger.filter(e=>e.roId===ledgerFilter);

  // Compute yearly point totals per user (for maintenance table)
  const yearlyMap = React.useMemo(()=>{
    const map = {};
    users.forEach(u=>{ map[u.id] = computeYearlyPoints(u.id, matches); });
    return map;
  },[users, matches]);

  // All years that appear in the data
  const allYears = React.useMemo(()=>{
    const ys = new Set();
    Object.values(yearlyMap).forEach(byYear=>Object.keys(byYear).forEach(y=>ys.add(y)));
    return [...ys].sort((a,b)=>b.localeCompare(a));
  },[yearlyMap]);

  // Maintenance status for a user in a given year
  function maintenanceStatus(user, year) {
    const cert = user.certification;
    if (cert==="None"||cert==="RO-P"||cert==="Admin") return null; // no maintenance req
    const entries = yearlyMap[user.id]?.[year]?.entries || [];
    return checkAnnualMaintenance(cert, entries);
  }

  const certifiedUsers = users.filter(u=>u.active && ["RO","CRO","RM"].includes(u.certification));

  return (
    <div style={{padding:"28px 32px",maxWidth:960}}>
      <h1 style={{margin:"0 0 6px",fontSize:26,fontWeight:800,color:"var(--text-primary)",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.04em"}}>Points Ledger</h1>
      <p style={{margin:"0 0 28px",color:"var(--text-muted)",fontSize:14}}>
        RO activity points per NROI Handbook 2026 — 1pt L1, 2pt L2, 3pt L3, 4pt L4, 5pt L5.
        Points are tracked both cumulatively and year-by-year for annual maintenance.
      </p>

      {/* ── Annual Maintenance Status ── */}
      {certifiedUsers.length > 0 && (
        <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,padding:"18px 22px",marginBottom:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Annual Maintenance Status</div>
            <div style={{fontSize:11,color:"var(--text-faint)"}}>≥6 pts/year + level qualifier required — per NROI Handbook 2026</div>
          </div>

          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
              <thead>
                <tr style={{background:"var(--surface3)"}}>
                  <th style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:"var(--text-faint)",textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:"1px solid var(--border)",minWidth:130}}>RO</th>
                  <th style={{padding:"8px 12px",textAlign:"center",fontSize:11,fontWeight:700,color:"var(--text-faint)",textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:"1px solid var(--border)",width:70}}>Cert</th>
                  {allYears.slice(0,4).map(y=>(
                    <th key={y} style={{padding:"8px 12px",textAlign:"center",fontSize:11,fontWeight:700,color:y===thisYear?"#e85d2c":"var(--text-faint)",textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:"1px solid var(--border)",width:100}}>
                      {y}{y===thisYear?" ★":""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {certifiedUsers.map((u,ri)=>{
                  const expanded = maintenanceId===u.id;
                  return (
                    <React.Fragment key={u.id}>
                      <tr
                        style={{background:ri%2===0?"transparent":"var(--surface3)",cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"}
                        onMouseLeave={e=>e.currentTarget.style.background=ri%2===0?"transparent":"var(--surface3)"}
                        onClick={()=>setMaintenanceId(expanded?null:u.id)}
                      >
                        <td style={{padding:"10px 12px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div style={{width:28,height:28,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0}}>{u.name.charAt(0)}</div>
                            <span style={{color:"var(--text-primary)",fontWeight:600,fontSize:13}}>{u.name}</span>
                          </div>
                        </td>
                        <td style={{padding:"10px 12px",textAlign:"center"}}>
                          <Badge label={u.certification} color={certColor(u.certification)} />
                        </td>
                        {allYears.slice(0,4).map(y=>{
                          const status = maintenanceStatus(u,y);
                          const yearPts = yearlyMap[u.id]?.[y]?.total||0;
                          if (!status) return <td key={y} style={{padding:"10px 12px",textAlign:"center",color:"var(--text-faint)",fontSize:12}}>—</td>;
                          const pass = status.totalPass && status.qualPass;
                          return (
                            <td key={y} style={{padding:"10px 12px",textAlign:"center"}}>
                              <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:2}}>
                                <span style={{fontSize:16}}>{pass?"✅":"❌"}</span>
                                <span style={{fontSize:11,color:pass?"#4ade80":"#f87171",fontWeight:700}}>{yearPts}pt</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={2+Math.min(allYears.length,4)} style={{padding:"0 12px 12px",background:"var(--surface)"}}>
                            <div style={{padding:"12px 14px",background:"var(--surface2)",borderRadius:8,border:"1px solid var(--border)"}}>
                              <div style={{fontSize:11,fontWeight:700,color:"var(--text-faint)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>
                                {u.name} — Yearly breakdown
                              </div>
                              {allYears.slice(0,4).map(y=>{
                                const status = maintenanceStatus(u,y);
                                if (!status) return null;
                                const entries = yearlyMap[u.id]?.[y]?.entries||[];
                                return (
                                  <div key={y} style={{marginBottom:12}}>
                                    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:6}}>
                                      <span style={{fontWeight:700,color:"var(--text-primary)",fontSize:13}}>{y}</span>
                                      <span style={{fontSize:12,color:status.totalPass?"#4ade80":"#f87171"}}>{status.total}pt / 6pt min {status.totalPass?"✓":"✗"}</span>
                                      <span style={{fontSize:11,color:"var(--text-faint)"}}>·</span>
                                      <span style={{fontSize:11,color:status.qualPass?"#4ade80":"#f87171"}}>{status.qualLabel} {status.qualPass?"✓":"✗"}</span>
                                    </div>
                                    {entries.length===0
                                      ? <div style={{fontSize:12,color:"var(--text-faint)",fontStyle:"italic"}}>No activity this year.</div>
                                      : entries.map((e,ei)=>(
                                          <div key={ei} style={{display:"flex",gap:10,fontSize:12,color:"var(--text-muted)",paddingLeft:8,marginBottom:3}}>
                                            <span style={{color:"var(--text-faint)",minWidth:85}}>{fmtDate(e.date)}</span>
                                            <Badge label={e.role} color={certColor(e.role)} />
                                            <span style={{color:"var(--text-second)"}}>{e.matchName}</span>
                                            <Badge label={e.matchLevel} color="#7c8cf8" />
                                            <span style={{color:"#e85d2c",fontWeight:700,marginLeft:"auto"}}>+{e.pts}pt</span>
                                          </div>
                                        ))
                                    }
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:10,fontSize:11,color:"var(--text-faint)"}}>
            Click a row to expand yearly detail. RO: min 1×L2+; CRO: min 1×L3+; RM: min 2×L3+.
          </div>
        </div>
      )}

      {/* ── Cumulative Leaderboard ── */}
      <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,padding:"18px 22px",marginBottom:24}}>
        <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14}}>Cumulative Leaderboard</div>
        {sorted.map((u,i)=>(
          <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
            <div style={{width:22,textAlign:"right",color:"var(--text-faint)",fontSize:12,fontWeight:700}}>{i+1}</div>
            <div style={{width:32,height:32,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>{u.name.charAt(0)}</div>
            <div style={{flex:1}}>
              <div style={{color:"var(--text-primary)",fontWeight:600,fontSize:14}}>{u.name}</div>
              <div style={{background:"var(--border)",borderRadius:4,height:6,overflow:"hidden",marginTop:4}}>
                <div style={{width:`${(u.points/max)*100}%`,background:`hsl(${Math.max(0,120-i/sorted.length*90)},70%,50%)`,height:"100%",borderRadius:4}} />
              </div>
            </div>
            <div style={{color:"#e85d2c",fontWeight:800,fontFamily:"'Barlow Condensed',sans-serif",fontSize:18,minWidth:48,textAlign:"right"}}>{u.points} pts</div>
          </div>
        ))}
      </div>

      {/* ── Manual adjustment (admin only) ── */}
      {adminAccess && (
        <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,padding:"18px 22px",marginBottom:24}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:14}}>Manual Adjustment</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 100px 1fr auto",gap:8}}>
            <UserPicker users={users.filter(u=>u.active)} value={adjustId} onChange={setAdjustId} placeholder="— Select RO —" />
            <input style={inp} type="number" value={adjustAmt} onChange={e=>setAdjustAmt(e.target.value)} placeholder="±pts" />
            <input style={inp} value={adjustReason} onChange={e=>setAdjustReason(e.target.value)} placeholder="Reason (optional)" />
            <button style={{...btnP,padding:"9px 16px"}} onClick={applyAdjust} disabled={!adjustId||!adjustAmt}>Apply</button>
          </div>
        </div>
      )}

      {/* ── Activity Log ── */}
      <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"14px 18px",borderBottom:"1px solid var(--border)"}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Activity Log</div>
          <select style={{...inp,width:180,padding:"5px 10px",fontSize:12}} value={ledgerFilter} onChange={e=>setLedgerFilter(e.target.value)}>
            <option value="all">All ROs</option>
            {[...users].sort((a,b)=>a.name.localeCompare(b.name)).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <span style={{fontSize:11,color:"var(--text-faint)",marginLeft:"auto"}}>{visibleLedger.length} entries</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",minWidth:560}}>
            <thead>
              <tr style={{background:"var(--surface3)"}}>
                {["RO","Match","Level","Date","Role","Points"].map(h=>(
                  <th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:"var(--text-faint)",textTransform:"uppercase",letterSpacing:"0.07em",borderBottom:"1px solid var(--border)"}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleLedger.map((e,i)=>(
                <tr key={i} style={{background:i%2===0?"transparent":"var(--surface3)"}}>
                  <td style={{padding:"10px 14px",color:"var(--text-primary)",fontSize:13,fontWeight:600}}>{e.name}</td>
                  <td style={{padding:"10px 14px",color:"var(--text-second)",fontSize:13}}>{e.matchName}</td>
                  <td style={{padding:"10px 14px"}}><Badge label={e.matchLevel||"—"} color="#7c8cf8" /></td>
                  <td style={{padding:"10px 14px",color:"var(--text-muted)",fontSize:12}}>{fmtDate(e.date)}</td>
                  <td style={{padding:"10px 14px"}}><Badge label={e.role} color={certColor(e.role)} /></td>
                  <td style={{padding:"10px 14px",color:e.amt>0?"#4ade80":"#f87171",fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",fontSize:15}}>{e.amt>0?"+":"-"}{Math.abs(e.amt)} pts</td>
                </tr>
              ))}
              {visibleLedger.length===0&&<tr><td colSpan={6} style={{padding:"20px 14px",color:"var(--text-faint)",fontSize:13,textAlign:"center"}}>No activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RO CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// NROI HANDBOOK 2026 — points & maintenance rules
// ─────────────────────────────────────────────────────────────────────────────

// Compute year-by-year point totals for a user from match assignments.
// `matches` must be passed in; we derive from all completed matches.
// Returns: { [year]: { total, byRole: { roId, role, matchLevel, pts, date, matchName }[] } }
function computeYearlyPoints(userId, matches) {
  const byYear = {};
  (matches||[]).forEach(m => {
    if (m.status !== "completed") return;
    const year = (m.date||"").slice(0,4);
    if (!year) return;
    const a = (m.assignments||[]).find(a=>a.roId===userId);
    if (!a) return;
    if (!byYear[year]) byYear[year] = { total:0, entries:[] };
    byYear[year].total += a.pointsAwarded;
    byYear[year].entries.push({
      role: a.role,
      matchLevel: m.level,
      pts: a.pointsAwarded,
      date: m.date,
      matchName: m.name,
    });
  });
  return byYear;
}

// Check annual maintenance requirement for a certification level.
// Returns { pass, details } per the handbook:
//   RO:  ≥6 pts/year, incl. min 1×Level II+ as RO or higher
//   CRO: ≥6 pts/year, incl. min 1×Level III+ as RO or higher
//   RM:  ≥6 pts/year, incl. min 2×Level III+ as RO or higher
const LEVEL_ORDER = ["Level I","Level II","Level III","Level IV","Level V"];
function meetsLevelOrHigher(matchLevel, minLevel) {
  return LEVEL_ORDER.indexOf(matchLevel) >= LEVEL_ORDER.indexOf(minLevel);
}
const RO_ROLES_COUNTING = ["RO-P","RO","CRO","RM","MD","MD/RM"]; // all RO roles count for maintenance

function checkAnnualMaintenance(cert, yearEntries) {
  const entries = yearEntries || [];
  const total   = entries.reduce((s,e)=>s+e.pts, 0);
  const qualifies = e => RO_ROLES_COUNTING.includes(e.role);

  let qualCount = 0, qualLabel = "", minLevel = "Level I";
  if (cert === "RO") {
    minLevel  = "Level II";
    qualCount = entries.filter(e=>qualifies(e)&&meetsLevelOrHigher(e.matchLevel,minLevel)).length;
    qualLabel = `≥1×Level II+ match as RO or higher (found ${qualCount})`;
  } else if (cert === "CRO") {
    minLevel  = "Level III";
    qualCount = entries.filter(e=>qualifies(e)&&meetsLevelOrHigher(e.matchLevel,minLevel)).length;
    qualLabel = `≥1×Level III+ match as RO or higher (found ${qualCount})`;
  } else if (cert === "RM") {
    minLevel  = "Level III";
    qualCount = entries.filter(e=>qualifies(e)&&meetsLevelOrHigher(e.matchLevel,minLevel)).length;
    qualLabel = `≥2×Level III+ matches as RO or higher (found ${qualCount})`;
  }

  const minQual = cert==="RM" ? 2 : cert==="CRO"||cert==="RO" ? 1 : 0;
  return {
    totalPass:    total >= 6,
    qualPass:     minQual===0 || qualCount >= minQual,
    total, qualCount, qualLabel,
  };
}

// RO-P → RO promotion checklist (NROI Handbook 2026, p.7)
// Requirements:
//   • Current cert is RO-P
//   • Account active
//   • Member ≥ 1 year
//   • Completed IROA Level I seminar and graduated
//   • Accumulated provisional points: 6 pts as combination of L1+L2+ with min 2×L2
//   • Profile photo approved
//   • No quarantine (2 years after a rejected application)
const RO_UPGRADE_CONFIG = {
  provisionalMinPts:   6,
  provisionalMinL2:    2,
  minMemberYears:      1,
  quarantineYears:     2,
};

function computeROChecklist(user, matches) {
  const now       = new Date();
  const joinDate  = new Date(user.joined);
  const yearsActive = (now - joinDate) / (1000*60*60*24*365.25);
  const lastApp   = user.lastROApplication ? new Date(user.lastROApplication) : null;
  const daysSinceLastApp = lastApp ? (now - lastApp) / (1000*60*60*24) : Infinity;

  // Provisional match points accumulated (as RO-P)
  const provEntries = (matches||[])
    .filter(m=>m.status==="completed")
    .flatMap(m=>(m.assignments||[])
      .filter(a=>a.roId===user.id && a.role==="RO-P")
      .map(a=>({ pts:a.pointsAwarded, level:m.level }))
    );
  const provTotal = provEntries.reduce((s,e)=>s+e.pts,0);
  const provL2    = provEntries.filter(e=>meetsLevelOrHigher(e.level,"Level II")).length;

  // IROA Level I seminar completed and graduated
  const hasLevelI = (user.seminarHistory||[]).some(
    s=>s.type==="Level I"&&s.graduated&&s.diplomaVerified
  );

  return [
    {
      key:"cert",
      label:"Current certification is RO-P",
      pass: user.certification==="RO-P",
    },
    {
      key:"active",
      label:"Account is active",
      pass: user.active,
    },
    {
      key:"member_age",
      label:`Member ≥ 1 year (currently ${yearsActive.toFixed(1)} yrs)`,
      pass: yearsActive >= RO_UPGRADE_CONFIG.minMemberYears,
    },
    {
      key:"photo",
      label:"Profile photo approved",
      pass: !!user.profilePhotoApproved,
    },
    {
      key:"seminar",
      label:"Completed & verified IROA Level I seminar",
      pass: hasLevelI,
    },
    {
      key:"prov_pts",
      label:`Provisional points ≥ ${RO_UPGRADE_CONFIG.provisionalMinPts} (earned: ${provTotal})`,
      pass: provTotal >= RO_UPGRADE_CONFIG.provisionalMinPts,
      detail: "Points from matches worked as Provisional RO",
    },
    {
      key:"prov_l2",
      label:`≥ ${RO_UPGRADE_CONFIG.provisionalMinL2}×Level II+ matches as RO-P (count: ${provL2})`,
      pass: provL2 >= RO_UPGRADE_CONFIG.provisionalMinL2,
      detail: "Provisional period must include at least 2 Level II or higher matches",
    },
    {
      key:"quarantine",
      label:`No rejected application in last 2 years`,
      pass: daysSinceLastApp >= RO_UPGRADE_CONFIG.quarantineYears * 365,
      detail: lastApp ? `Last application: ${lastApp.toLocaleDateString("en-GB")}` : "No previous application",
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// SEMINARS
// ─────────────────────────────────────────────────────────────────────────────

function SeminarsPage({ users, setUsers, seminars, setSeminars }) {
  const { currentUser } = useAuth();
  const canEdit = canManageMatches(currentUser);

  const blank = { name:"", date:new Date().toISOString().slice(0,10), location:"", type:"Level I", instructor:"", status:"upcoming", enrollments:[] };
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(blank);
  const [semFe, setSemFe]   = useState({});
  const [detail, setDetail] = useState(null);

  function createSeminar() {
    const errs = {};
    if (!form.name.trim())       errs.name       = true;
    if (!form.location.trim())   errs.location   = true;
    if (!form.instructor)        errs.instructor = true;
    if (Object.keys(errs).length) { setSemFe(errs); return; }
    setSemFe({});
    const s = { ...form, id:"s"+(seminars.length+1)+(Date.now()%10000) };
    setSeminars(prev=>[...prev, s]);
    setShowCreate(false); setForm(blank);
  }

  function updateSeminar(updated) {
    setSeminars(prev=>prev.map(s=>s.id===updated.id?updated:s));
    if (detail?.id===updated.id) setDetail(updated);
  }

  function completeSeminar(seminar) {
    // Graduate enrolled users who attended
    setUsers(prev=>prev.map(u=>{
      const e = seminar.enrollments.find(en=>en.userId===u.id && en.attended && en.graduated);
      if (!e) return u;
      if (certRank(u.certification) > 0) return u;
      const entry = { cert:"RO-P", grantedBy:"System (Seminar)", date:new Date().toISOString().slice(0,10), note:`Graduated: ${seminar.name}` };
      const semEntry = { seminarId:seminar.id, type:seminar.type, graduated:true, diplomaVerified:e.diplomaVerified, diplomaDate:e.diplomaDate||new Date().toISOString().slice(0,10) };
      return { ...u, certification:"RO-P", certHistory:[...(u.certHistory||[]),entry], seminarHistory:[...(u.seminarHistory||[]),semEntry] };
    }));
    const completed = { ...seminar, status:"completed" };
    updateSeminar(completed);
  }

  const upcoming  = seminars.filter(s=>s.status==="upcoming");
  const completed = seminars.filter(s=>s.status==="completed");

  function SemCard({ s }) {
    const instructor = users.find(u=>u.id===s.instructor);
    return (
      <div style={{background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:10,padding:"16px 18px",display:"flex",alignItems:"center",gap:16}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
            <span style={{color:"var(--text-primary)",fontWeight:700,fontSize:15}}>{s.name}</span>
            <Badge label={s.type} color="#7c8cf8" />
            <Badge label={s.status} color={statusColor(s.status)} />
          </div>
          <div style={{display:"flex",gap:16,fontSize:12,color:"var(--text-muted)",flexWrap:"wrap"}}>
            <span>📅 {fmtDate(s.date)}</span>
            <span>📍 {s.location}</span>
            <span>👤 {instructor?.name||"Unknown"}</span>
            <span>👥 {s.enrollments.length} enrolled</span>
          </div>
        </div>
        <button style={{...btnS,padding:"7px 14px",fontSize:13}} onClick={()=>setDetail(s)}>View</button>
      </div>
    );
  }

  return (
    <div style={{padding:"28px 32px",maxWidth:900}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h1 style={{margin:"0 0 4px",fontSize:26,fontWeight:800,color:"var(--text-primary)",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.04em"}}>Seminars</h1>
          <p style={{margin:0,color:"var(--text-muted)",fontSize:14}}>IROA Level I/II seminars and graduation records.</p>
        </div>
        {canEdit&&<button style={{...btnP,padding:"10px 18px"}} onClick={()=>{setShowCreate(true);setSemFe({});}}>+ Create Seminar</button>}
      </div>

      {showCreate && (
        <Modal title="Create Seminar" onClose={()=>{setShowCreate(false);setSemFe({});}}>
          <Field label="Name" error={semFe.name?"Required":undefined}><input style={errInp(semFe.name)} value={form.name} onChange={e=>{setForm(f=>({...f,name:e.target.value}));setSemFe(p=>({...p,name:false}));}} placeholder="e.g. IROA Level I — Oslo Spring 2026" /></Field>
          <Field label="Date"><input style={inp} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} /></Field>
          <Field label="Location" error={semFe.location?"Required":undefined}><input style={errInp(semFe.location)} value={form.location} onChange={e=>{setForm(f=>({...f,location:e.target.value}));setSemFe(p=>({...p,location:false}));}} placeholder="Venue / club name" /></Field>
          <Field label="Type">
            <select style={inp} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
              <option>Level I</option><option>Level II</option>
            </select>
          </Field>
          <Field label="Instructor" error={semFe.instructor?"Required":undefined}>
            <UserPicker users={users.filter(u=>u.active&&certRank(u.certification)>=3)} value={form.instructor} onChange={id=>{setForm(f=>({...f,instructor:id}));setSemFe(p=>({...p,instructor:false}));}} placeholder="— Select instructor —" hasError={semFe.instructor} />
          </Field>
          <div style={{display:"flex",gap:10,marginTop:6}}>
            <button style={{...btnP,flex:1}} onClick={createSeminar} disabled={!form.name||!form.location}>Create Seminar</button>
            <button style={{...btnS}} onClick={()=>setShowCreate(false)}>Cancel</button>
          </div>
        </Modal>
      )}

      {detail && (
        <SeminarDetailModal
          seminar={detail}
          users={users}
          setUsers={setUsers}
          canEdit={canEdit}
          onClose={()=>setDetail(null)}
          onUpdate={updateSeminar}
          onComplete={completeSeminar}
        />
      )}

      {upcoming.length>0&&(
        <div style={{marginBottom:24}}>
          <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Upcoming</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {upcoming.map(s=><SemCard key={s.id} s={s} />)}
          </div>
        </div>
      )}
      {completed.length>0&&(
        <div>
          <div style={{fontSize:12,fontWeight:700,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10}}>Completed</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {completed.map(s=><SemCard key={s.id} s={s} />)}
          </div>
        </div>
      )}
      {seminars.length===0&&<p style={{color:"var(--text-faint)",fontSize:14}}>No seminars yet.</p>}
    </div>
  );
}

function SeminarDetailModal({ seminar, users, setUsers, canEdit, onClose, onUpdate, onComplete }) {
  const [tab, setTab] = useState("roster");
  const [enrollId, setEnrollId] = useState("");

  const enrolled = seminar.enrollments || [];
  const notEnrolled = users.filter(u=>u.active&&!enrolled.find(e=>e.userId===u.id));
  const instructor = users.find(u=>u.id===seminar.instructor);

  function enroll(userId) {
    if (!userId) return;
    const updated = { ...seminar, enrollments:[...enrolled, { userId, attended:false, graduated:false, diplomaVerified:false, diplomaDate:"" }] };
    onUpdate(updated);
    setEnrollId("");
  }

  function updateEnrollment(userId, patch) {
    const updated = { ...seminar, enrollments:enrolled.map(e=>e.userId===userId?{...e,...patch}:e) };
    onUpdate(updated);
  }

  function removeEnrollment(userId) {
    const updated = { ...seminar, enrollments:enrolled.filter(e=>e.userId!==userId) };
    onUpdate(updated);
  }

  return (
    <Modal title={seminar.name} onClose={onClose} wide>
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
        <StatCard label="Date"       value={fmtDate(seminar.date)}       accent="#60a5fa" />
        <StatCard label="Enrolled"   value={seminar.enrollments.length}  accent="var(--text-second)" />
        <StatCard label="Graduated"  value={enrolled.filter(e=>e.graduated).length} accent="#4ade80" />
        <StatCard label="Instructor" value={instructor?.name||"—"}       accent="#f97316" />
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:"1px solid var(--border)",paddingBottom:0}}>
        {["roster","enroll"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            background:"none",border:"none",borderBottom:tab===t?"2px solid #e85d2c":"2px solid transparent",
            color:tab===t?"var(--text-primary)":"var(--text-muted)",padding:"8px 14px",cursor:"pointer",
            fontSize:13,fontWeight:tab===t?700:400,marginBottom:-1,textTransform:"capitalize"
          }}>{t==="enroll"?"+ Enroll":t.charAt(0).toUpperCase()+t.slice(1)}</button>
        ))}
      </div>

      {tab==="enroll" && canEdit && seminar.status!=="completed" && (
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <div style={{flex:1}}>
            <UserPicker users={notEnrolled} value={enrollId} onChange={setEnrollId} placeholder="— Select user to enroll —" />
          </div>
          <button style={{...btnP,padding:"9px 16px"}} onClick={()=>enroll(enrollId)} disabled={!enrollId}>Enroll</button>
        </div>
      )}

      {tab==="roster" && (
        <div>
          {enrolled.length===0&&<p style={{color:"var(--text-faint)",fontSize:14}}>No one enrolled yet.</p>}
          {enrolled.map(e=>{
            const u=users.find(u=>u.id===e.userId);
            return (
              <div key={e.userId} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--border)"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>{u?.name.charAt(0)||"?"}</div>
                <div style={{flex:1}}>
                  <div style={{color:"var(--text-primary)",fontWeight:600,fontSize:14}}>{u?.name||"Unknown"}</div>
                  <div style={{color:"var(--text-muted)",fontSize:12}}>{u?.certification||"—"} · {u?.region||"—"}</div>
                </div>
                {canEdit&&seminar.status!=="completed"&&(
                  <div style={{display:"flex",gap:8,alignItems:"center",fontSize:12}}>
                    <label style={{display:"flex",gap:4,alignItems:"center",color:"var(--text-second)",cursor:"pointer"}}>
                      <input type="checkbox" checked={e.attended} onChange={ev=>updateEnrollment(e.userId,{attended:ev.target.checked})} />
                      Attended
                    </label>
                    <label style={{display:"flex",gap:4,alignItems:"center",color:"var(--text-second)",cursor:"pointer"}}>
                      <input type="checkbox" checked={e.graduated} onChange={ev=>updateEnrollment(e.userId,{graduated:ev.target.checked})} />
                      Graduated
                    </label>
                    <label style={{display:"flex",gap:4,alignItems:"center",color:"var(--text-second)",cursor:"pointer"}}>
                      <input type="checkbox" checked={e.diplomaVerified} onChange={ev=>updateEnrollment(e.userId,{diplomaVerified:ev.target.checked})} />
                      Diploma
                    </label>
                    <button onClick={()=>removeEnrollment(e.userId)} style={{...btnD,padding:"3px 8px",fontSize:11}}>✕</button>
                  </div>
                )}
                {(seminar.status==="completed"||!canEdit)&&(
                  <div style={{display:"flex",gap:6}}>
                    {e.attended&&<Badge label="Attended" color="#60a5fa" />}
                    {e.graduated&&<Badge label="Graduated" color="#4ade80" />}
                    {e.diplomaVerified&&<Badge label="Diploma ✓" color="#f97316" />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canEdit&&seminar.status==="upcoming"&&(
        <div style={{marginTop:20,paddingTop:16,borderTop:"1px solid var(--border)",display:"flex",gap:10}}>
          <button style={{...btnP,background:"#16a34a"}} onClick={()=>onComplete(seminar)}>
            ✓ Complete Seminar &amp; Graduate Attendees
          </button>
          <button style={{...btnS}} onClick={onClose}>Close</button>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// APP
// ─────────────────────────────────────────────────────────────────────────────

export default function App() {
  const [users,       setUsers]       = useState(seedUsers);
  const [matchesRaw,  setMatchesRaw]  = useState(seedMatches);
  const [seminars,    setSeminars]    = useState(seedSeminars);
  const [applications,setApplications]= useState([]);
  const [clubs,       setClubs]       = useState(seedClubs);
  const [docs,        setDocs]        = useState(seedDocs);
  const [currentUser, setCurrentUser] = useState(null);
  const [page,        setPage]        = useState("dashboard");
  const [regions,     setRegions]     = useState(DEFAULT_REGIONS);
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [theme,       setTheme]       = useState("dark");

  // Intercept setMatches to distribute points when a match is completed
  function setMatches(updater) {
    setMatchesRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      // Find newly completed matches that need point distribution
      next.forEach(m => {
        if (m._pointsToDistribute) {
          setUsers(u => u.map(user => {
            const assignment = m.assignments.find(a => a.roId === user.id);
            if (!assignment) return user;
            return { ...user, points: user.points + assignment.pointsAwarded };
          }));
          // Clear the flag
          m._pointsToDistribute = false;
        }
      });
      return next;
    });
  }

  function login(user)  { setCurrentUser(user); setPage("dashboard"); setMenuOpen(false); }
  function logout()     { setCurrentUser(null); setPage("dashboard"); setMenuOpen(false); }

  const pendingApps = applications.filter(a=>a.status==="pending");
  const admin    = currentUser && isAdmin(currentUser);
  const canMatch = currentUser && canManageMatches(currentUser);

  const T = THEMES[theme];

  const cssVars = `
    :root {
      --bg: ${T.bg}; --surface: ${T.surface}; --surface2: ${T.surface2}; --surface3: ${T.surface3};
      --border: ${T.border}; --border2: ${T.border2};
      --text-primary: ${T.textPrimary}; --text-second: ${T.textSecond}; --text-muted: ${T.textMuted}; --text-faint: ${T.textFaint};
      --inp-bg: ${T.inpBg}; --inp-border: ${T.inpBorder}; --inp-text: ${T.inpText};
      --shadow-lg: ${T.shadowLg}; --backdrop: ${T.backdrop};
      --scroll-bg: ${T.scrollBg}; --scroll-thumb: ${T.scrollThumb};
    }
  `;

  const NAV = [
    { id:"dashboard", label:"Dashboard",      icon:"📊", show:true },
    { id:"ro",        label:"Range Officers", icon:"👥", show:true },
    { id:"matches",   label:"Matches",        icon:"🎯", show:true },
    { id:"clubs",     label:"Clubs",           icon:"🏛️", show:true },
    { id:"docs",      label:"Documentation",   icon:"📄", show:true },
    { id:"seminars",  label:"Seminars",       icon:"🎓", show:true },
    { id:"points",    label:"Points Ledger",  icon:"📈", show:true },
    { id:"users",     label:"User Database",  icon:"🛡️", show:canMatch, badge:pendingApps.length>0?pendingApps.length:null },
    { id:"profile",   label:"My Profile",     icon:"👤", show:true },
  ].filter(n=>n.show);

  if (!currentUser) {
    return (
      <ThemeCtx.Provider value={theme}>
        <AuthCtx.Provider value={{ currentUser, setCurrentUser }}>
          <style>{cssVars}</style>
          <style>{`body{margin:0;background:var(--bg);color:var(--text-primary);font-family:'Inter','Segoe UI',sans-serif;}*{box-sizing:border-box;}input,select,textarea{background:var(--inp-bg);border-color:var(--inp-border);color:var(--inp-text);}select option{background:var(--surface);color:var(--inp-text);}::-webkit-scrollbar{width:6px;background:var(--scroll-bg);}::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border-radius:3px;}`}</style>
          <AuthScreen users={users} setUsers={setUsers} onLogin={login} regions={regions} />
        </AuthCtx.Provider>
      </ThemeCtx.Provider>
    );
  }

  return (
    <ThemeCtx.Provider value={theme}>
      <AuthCtx.Provider value={{ currentUser, setCurrentUser }}>
        <style>{cssVars}</style>
        <style>{`
          body{margin:0;background:var(--bg);color:var(--text-primary);font-family:'Inter','Segoe UI',sans-serif;}
          *{box-sizing:border-box;}
          input,select,textarea{background:var(--inp-bg);border-color:var(--inp-border);color:var(--inp-text);}
          select option{background:var(--surface);color:var(--inp-text);}
          ::-webkit-scrollbar{width:6px;background:var(--scroll-bg);}
          ::-webkit-scrollbar-thumb{background:var(--scroll-thumb);border-radius:3px;}
          .ro-sidebar{display:flex;transition:transform 0.2s;}
          @media(max-width:700px){
            .ro-sidebar{transform:translateX(-100%);}
            .ro-sidebar.open{transform:translateX(0);}
          }
        `}</style>

        <div style={{display:"flex",minHeight:"100vh",background:"var(--bg)"}}>

          {/* ── Sidebar (desktop always, mobile as drawer) ── */}
          <aside className={`ro-sidebar${menuOpen?" open":""}`} style={{
            width:228, background:"var(--surface)", borderRight:"1px solid var(--border)",
            flexDirection:"column", position:"fixed", top:0, left:0, bottom:0, zIndex:100
          }}>
            {/* Logo */}
            <div style={{padding:"18px 20px 14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:8,background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎯</div>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:"var(--text-primary)",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.06em"}}>IPSC</div>
                  <div style={{fontSize:10,color:"var(--text-muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>RO Manager</div>
                </div>
              </div>
              <button onClick={()=>setMenuOpen(false)} style={{background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer",fontSize:18,display:"none"}} className="mobile-close">×</button>
            </div>

            {/* Nav */}
            <nav style={{flex:1,overflowY:"auto",padding:"10px 0"}}>
              {NAV.map(n=>(
                <button key={n.id} onClick={()=>{ setPage(n.id); setMenuOpen(false); }} style={{
                  display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 16px",
                  background:page===n.id?"#e85d2c22":"none",
                  border:page===n.id?"1px solid #e85d2c44":"1px solid transparent",
                  borderRadius:6,margin:"1px 8px",width:"calc(100% - 16px)",
                  color:page===n.id?"#e85d2c":"var(--text-muted)",cursor:"pointer",fontSize:14,fontWeight:page===n.id?700:400,
                  textAlign:"left"
                }}>
                  <span style={{fontSize:16}}>{n.icon}</span>
                  <span style={{flex:1}}>{n.label}</span>
                  {n.badge && <span style={{background:"#e85d2c",color:"#fff",borderRadius:10,fontSize:10,fontWeight:800,padding:"1px 6px"}}>{n.badge}</span>}
                </button>
              ))}
            </nav>

            {/* User footer */}
            <div style={{padding:"12px 14px",borderTop:"1px solid var(--border)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:36,height:36,borderRadius:"50%",background:"#e85d2c",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:800,color:"#fff",flexShrink:0}}>{currentUser.name.charAt(0)}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,color:"var(--text-primary)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser.name}</div>
                  <div style={{display:"flex",gap:4,marginTop:2,flexWrap:"wrap"}}>
                    <Badge label={currentUser.role.toUpperCase()} color={roleColor(currentUser.role)} />
                    {currentUser.certification!=="None"&&<Badge label={currentUser.certification} color={certColor(currentUser.certification)} />}
                  </div>
                </div>
              </div>
              <button
                onClick={()=>setTheme(t=>t==="dark"?"light":"dark")}
                style={{width:"100%",marginBottom:8,background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,color:"var(--text-muted)",padding:"7px",fontSize:12,cursor:"pointer",fontWeight:600}}
              >{theme==="dark"?"🌙 Dark Mode":"☀️ Light Mode"}</button>
              <button onClick={logout} style={{width:"100%",background:"var(--surface2)",border:"1px solid var(--border2)",borderRadius:6,color:"var(--text-muted)",padding:"7px",fontSize:12,cursor:"pointer",fontWeight:600}}>Sign Out</button>
            </div>
          </aside>

          {/* Mobile top bar */}
          <div style={{display:"none",position:"fixed",top:0,left:0,right:0,height:52,background:"var(--surface)",borderBottom:"1px solid var(--border)",zIndex:99,alignItems:"center",padding:"0 14px",gap:12}} className="mobile-topbar">
            <button onClick={()=>setMenuOpen(o=>!o)} style={{background:"none",border:"none",color:"var(--text-primary)",fontSize:22,cursor:"pointer",padding:4}}>☰</button>
            <div style={{fontWeight:800,fontSize:16,color:"var(--text-primary)",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:"0.06em"}}>IPSC RO</div>
            <div style={{flex:1}} />
            <button onClick={()=>setTheme(t=>t==="dark"?"light":"dark")} style={{background:"none",border:"none",fontSize:18,cursor:"pointer"}}>{theme==="dark"?"🌙":"☀️"}</button>
          </div>

          {/* Main content */}
          <main style={{marginLeft:228,flex:1,minHeight:"100vh",background:"var(--bg)"}}>
            {page==="dashboard" && <Dashboard users={users} matches={matchesRaw} seminars={seminars} />}
            {page==="ro"        && <ROPage users={users} matches={matchesRaw} regions={regions} />}
            {page==="matches"   && <MatchesPage users={users} matches={matchesRaw} setMatches={setMatches} regions={regions} clubs={clubs} />}
            {page==="clubs"     && <ClubsPage users={users} clubs={clubs} setClubs={setClubs} applications={applications} setApplications={setApplications} matches={matchesRaw} regions={regions} />}
            {page==="docs"      && <DocsPage docs={docs} setDocs={setDocs} />}
            {page==="seminars"  && <SeminarsPage users={users} setUsers={setUsers} seminars={seminars} setSeminars={setSeminars} />}
            {page==="points"    && <PointsPage users={users} setUsers={setUsers} matches={matchesRaw} />}
            {page==="users"     && canMatch && <UserDatabase users={users} setUsers={setUsers} regions={regions} setRegions={setRegions} applications={applications} setApplications={setApplications} matches={matchesRaw} />}
            {page==="profile"   && <MyProfile users={users} setUsers={setUsers} matches={matchesRaw} seminars={seminars} regions={regions} applications={applications} setApplications={setApplications} clubs={clubs} setClubs={setClubs} />}
          </main>
        </div>
      </AuthCtx.Provider>
    </ThemeCtx.Provider>
  );
}
