// ตัววางแผน: ฟังก์ชันล้วน ไม่แตะหน้าจอ (ทดสอบด้วย node ได้)
// หลักเกณฑ์เลือกแผน: 1) สถานที่ตรงความสนใจมากที่สุด 2) เวลารวมน้อยสุด 3) ค่าใช้จ่ายต่อคนน้อยสุด

function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function toHHMM(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
}

function matchesInterest(place, interests) {
  return place.tags.some((t) => interests.includes(t));
}

// ลองไปสถานที่ p จากตำแหน่ง cur ณ เวลา time → คืนรายละเอียด หรือ null ถ้าผิดเงื่อนไขเวลา
function tryVisit(cur, p, time, endMin) {
  const travel = cur === p.id ? 0 : TRAVEL[cur][p.id];
  const arrive = time + travel;
  const start = Math.max(arrive, toMin(p.open)); // ไปถึงก่อนเปิด → รอ
  const depart = start + p.visit;
  if (depart > toMin(p.close) || depart > endMin) return null;
  return { id: p.id, travel, arrive, wait: start - arrive, start, depart };
}

/**
 * opts: { interests[], weather, budget, startId, startMin, endMin, visited[] }
 * คืน { best, explored, candidates, skipped }
 */
function planTrip(opts) {
  const { interests, weather, budget, startId, startMin, endMin } = opts;
  const visited = new Set(opts.visited || []);
  const skipped = []; // สถานที่ที่ถูกตัดตั้งแต่ต้น พร้อมเหตุผล

  const candidates = ATTRACTIONS.filter((p) => {
    if (visited.has(p.id)) return false;
    if (!matchesInterest(p, interests)) return false;
    if (weather === "rain" && p.weather === "outdoor") {
      skipped.push({ id: p.id, reason: "ฝนตก และเป็นสถานที่กลางแจ้ง (outdoor)" });
      return false;
    }
    if (p.cost > budget) {
      skipped.push({ id: p.id, reason: `ค่าเข้า ${p.cost} บาท เกินงบต่อคน` });
      return false;
    }
    return true;
  });

  let best = { stops: [], cost: 0, total: 0 };
  let explored = 0;

  function better(stops, cost, total) {
    if (stops.length !== best.stops.length) return stops.length > best.stops.length;
    if (total !== best.total) return total < best.total;
    return cost < best.cost;
  }

  function dfs(cur, time, cost, stops, used) {
    explored++;
    const total = stops.length ? stops[stops.length - 1].depart - startMin : 0;
    if (stops.length && better(stops, cost, total)) best = { stops: stops.slice(), cost, total };
    for (const p of candidates) {
      if (used.has(p.id)) continue;
      // จุดเริ่มต้นเที่ยวได้เฉพาะเป็นจุดแรก (ไม่ย้อนกลับมา)
      if (p.id === startId && stops.length > 0) continue;
      if (cost + p.cost > budget) continue;
      const v = tryVisit(cur, p, time, endMin);
      if (!v) continue;
      used.add(p.id);
      stops.push(v);
      dfs(p.id, v.depart, cost + p.cost, stops, used);
      stops.pop();
      used.delete(p.id);
    }
  }
  dfs(startId, startMin, 0, [], new Set());

  // เหตุผลของสถานที่ที่ตรงความสนใจแต่ไม่ได้อยู่ในแผน
  const inPlan = new Set(best.stops.map((s) => s.id));
  for (const p of candidates) {
    if (inPlan.has(p.id)) continue;
    const alone = tryVisit(startId, p, startMin, endMin);
    let reason;
    if (!alone) {
      const close = toMin(p.close);
      if (startMin + (p.id === startId ? 0 : TRAVEL[startId][p.id]) >= close) reason = `ปิด ${p.close} ไปไม่ทัน`;
      else if (Math.max(startMin + (p.id === startId ? 0 : TRAVEL[startId][p.id]), toMin(p.open)) + p.visit > endMin) reason = `เปิด ${p.open} รวมเดินทาง+เที่ยวแล้วเวลาที่มีไม่พอ`;
      else reason = `อยู่ในเวลาเปิด–ปิด ${p.open}–${p.close} ไม่ได้`;
    } else {
      reason = "ใส่เพิ่มแล้วเกินงบหรือเวลา หรือชนเวลาเปิด–ปิดของจุดอื่น";
    }
    skipped.push({ id: p.id, reason });
  }

  return { best, explored, candidates, skipped };
}

// ตรวจ Input ทั้งหมด → { ok, errors: {field: msg}, value }
function validateInput(raw) {
  const errors = {};
  const interests = raw.interests || [];
  if (interests.length === 0) errors.interests = "เลือกความสนใจอย่างน้อย 1 หมวด";

  const budgetStr = String(raw.budget ?? "").trim();
  const budget = Number(budgetStr);
  if (budgetStr === "") errors.budget = "กรอกงบประมาณต่อคน";
  else if (!Number.isFinite(budget)) errors.budget = "งบต้องเป็นตัวเลข";
  else if (budget < 0) errors.budget = "งบต้องไม่ติดลบ";
  else if (budget > 100000) errors.budget = "งบสูงเกินจริง (ไม่เกิน 100,000 บาท)";

  // เวลาเที่ยวรวม: ชั่วโมง + นาที แยกช่อง (ช่องว่าง = 0)
  const hStr = String(raw.hours ?? "").trim();
  const mStr = String(raw.minutes ?? "").trim();
  const hrs = hStr === "" ? 0 : Number(hStr);
  const mins = mStr === "" ? 0 : Number(mStr);
  const durMin = Math.round(hrs * 60) + mins;
  if (hStr === "" && mStr === "") errors.duration = "กรอกเวลาท่องเที่ยว เช่น 1 ชม. 50 นาที";
  else if (!Number.isFinite(hrs) || !Number.isInteger(mins)) errors.duration = "ชั่วโมงต้องเป็นตัวเลข และนาทีต้องเป็นจำนวนเต็ม";
  else if (hrs < 0 || mins < 0) errors.duration = "เวลาต้องไม่ติดลบ";
  else if (durMin <= 0) errors.duration = "เวลาต้องมากกว่า 0";
  else if (durMin > 24 * 60) errors.duration = "แผนนี้รองรับไม่เกิน 1 วัน (24 ชั่วโมง)";

  const m = String(raw.start ?? "").trim().match(/^(\d{1,2})[:.](\d{2})$/);
  const st = m ? String(m[1]).padStart(2, "0") + ":" + m[2] : "";
  if (!m || +m[1] > 23 || +m[2] > 59) errors.start = "ชั่วโมง 0–23 และนาที 00–59 เช่น 08 : 30";

  if (!["normal", "rain"].includes(raw.weather)) errors.weather = "เลือกสภาพอากาศ";

  const pStr = String(raw.people ?? "").trim();
  const people = Number(pStr);
  if (pStr === "") errors.people = "กรอกจำนวนผู้เดินทาง";
  else if (!Number.isInteger(people)) errors.people = "จำนวนคนต้องเป็นจำนวนเต็ม";
  else if (people < 1) errors.people = "ต้องมีอย่างน้อย 1 คน";
  else if (people > 100) errors.people = "จำนวนคนมากเกินจริง (ไม่เกิน 100)";

  const ok = Object.keys(errors).length === 0;
  const value = ok
    ? { interests, budget, durMin, startMin: toMin(st), weather: raw.weather, people }
    : null;
  return { ok, errors, value };
}

if (typeof module !== "undefined") module.exports = { planTrip, validateInput, toMin, toHHMM };
