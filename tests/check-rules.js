// ตรวจกฎการคำนวณร่วมกัน (ข้อ 4 ในโจทย์) แบบสุ่ม Input — รัน: node tests/check-rules.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "..");
const ctx = { module: { exports: {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root + "/data.js", "utf8") + fs.readFileSync(root + "/planner.js", "utf8") +
  ";this.A=ATTRACTIONS;this.T=TRAVEL;", ctx);
const { planTrip, toMin } = ctx.module.exports;
const A = Object.fromEntries(ctx.A.map((p) => [p.id, p])), T = ctx.T;
const CATS = ["nature", "culture", "art", "food"];
let fails = 0, plans = 0, empty = 0;
// Matrix ต้องสมมาตรและแนวทแยงเป็น 0 (ตาม sheet Rules_and_Sources)
for (const a in T) for (const b in T) if (T[a][b] !== T[b][a] || (a === b && T[a][b] !== 0)) { fails++; console.log("FAIL: matrix", a, b); }
const fail = (msg, inp) => { if (fails++ < 10) console.log("FAIL:", msg, JSON.stringify(inp)); };

// brute force แยกต่างหาก: หาจำนวนสถานที่มากสุดที่ทำได้ (เพื่อเช็คว่า DFS ได้คำตอบดีที่สุดจริง)
function bruteMax(inp) {
  const ok = ctx.A.filter((p) => p.tags.some((t) => inp.interests.includes(t)) && !(inp.weather === "rain" && p.weather === "outdoor"));
  let best = 0;
  (function rec(cur, time, cost, seq) {
    best = Math.max(best, seq.length);
    for (const p of ok) {
      if (seq.includes(p.id) || (p.id === "F" && seq.length)) continue;
      const arr = time + (cur === p.id ? 0 : T[cur][p.id]);
      const dep = Math.max(arr, toMin(p.open)) + p.visit;
      if (dep <= toMin(p.close) && dep <= inp.endMin && cost + p.cost <= inp.budget) rec(p.id, dep, cost + p.cost, [...seq, p.id]);
    }
  })("F", inp.startMin, 0, []);
  return best;
}

for (let i = 0; i < 3000; i++) {
  const interests = CATS.filter(() => Math.random() < 0.5);
  if (!interests.length) interests.push(CATS[i % 4]);
  const startMin = Math.floor(Math.random() * 24 * 60);
  const inp = {
    interests, weather: Math.random() < 0.4 ? "rain" : "normal",
    budget: [0, 50, 100, 200, 300, 500, 1000][i % 7],
    startId: "F", startMin, endMin: Math.min(startMin + 30 + Math.floor(Math.random() * 720), 1440), visited: [],
  };
  const { best } = planTrip(inp);
  if (!best.stops.length) { empty++; } else plans++;
  let prev = "F", t = inp.startMin, cost = 0;
  const seen = new Set();
  best.stops.forEach((s, k) => {
    const p = A[s.id];
    if (seen.has(s.id)) fail("สถานที่ซ้ำ", inp); seen.add(s.id);
    if (s.id === "F" && k !== 0) fail("F ไม่ใช่จุดแรก", inp);
    const travel = prev === s.id ? 0 : T[prev][s.id];
    if (s.travel !== travel) fail("เวลาเดินทางไม่ตรง Matrix", inp);
    if (s.arrive !== t + travel) fail("เวลาไปถึง ≠ ออกจุดก่อน + เดินทาง", inp);
    if (s.start < toMin(p.open)) fail("เริ่มเที่ยวก่อนเปิด", inp);
    if (s.wait !== Math.max(0, toMin(p.open) - s.arrive)) fail("เวลารอผิด", inp);
    if (s.depart !== s.arrive + s.wait + p.visit) fail("เวลาออก ≠ ไปถึง + รอ + Visit_Minutes", inp);
    if (s.depart > toMin(p.close)) fail("ออกหลังเวลาปิด", inp);
    if (inp.weather === "rain" && p.weather === "outdoor") fail("ฝนตกแต่มี outdoor", inp);
    if (!p.tags.some((x) => interests.includes(x))) fail("ไม่ตรงความสนใจ", inp);
    cost += p.cost; prev = s.id; t = s.depart;
  });
  if (cost !== best.cost) fail("ค่าใช้จ่ายรวมผิด", inp);
  if (cost > inp.budget) fail("เกินงบต่อคน", inp);
  if (best.stops.length && t > inp.endMin) fail("เกินเวลาที่มี", inp);
  if (best.stops.length && best.total !== t - inp.startMin) fail("เวลารวมผิด", inp);
  if (best.stops.length !== bruteMax(inp)) fail(`ไม่ใช่จำนวนสถานที่มากสุด (${best.stops.length} vs ${bruteMax(inp)})`, inp);
}
console.log(`ทดสอบ 3000 ชุด: มีแผน ${plans}, ไม่มีแผน ${empty}, ผิดกฎ ${fails}`);
process.exit(fails ? 1 : 0);
