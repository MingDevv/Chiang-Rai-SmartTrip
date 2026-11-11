// ส่วนหน้าจอ: อ่านฟอร์ม → ตรวจ → วางแผน → แสดงผล
const $ = (s) => document.querySelector(s);
const form = $("#form");
const resultEl = $("#result");
const byId = Object.fromEntries(ATTRACTIONS.map((p) => [p.id, p]));
const STORE_KEY = "smarttrip-input";
const PHOTOS = { A: "images/A.jpg", C: "images/C.jpg", D: "images/D.jpg" }; // ภาพจริงจาก Wikimedia Commons เฉพาะที่มี

let lastPlanIds = null; // ใช้เทียบว่าแผนใหม่เปลี่ยนอะไร
let current = null;     // { input, stops, cost, ... } ของแผนที่แสดงอยู่

// รวมช่อง HH กับ MM เป็น "HH:MM" แล้วให้ validateInput ตรวจรูปแบบเหมือนเดิม
function joinTime(h, m) {
  h = String(h ?? "").trim(); m = String(m ?? "").trim();
  if (h === "" && m === "") return "";
  if (/^\d$/.test(m)) m = "0" + m; // พิมพ์นาทีหลักเดียว เช่น 5 → 05
  return h + ":" + m;
}

function readForm() {
  const fd = new FormData(form);
  return {
    interests: fd.getAll("interests"),
    budget: fd.get("budget"),
    people: fd.get("people"),
    start: joinTime(fd.get("startH"), fd.get("startM")),
    hours: fd.get("hours"),
    minutes: fd.get("minutes"),
    weather: fd.get("weather"),
  };
}

function writeForm(raw) {
  form.querySelectorAll('input[name="interests"]').forEach((c) => (c.checked = raw.interests.includes(c.value)));
  for (const k of ["budget", "people", "hours", "minutes"]) if (raw[k] != null) form.elements[k].value = raw[k];
  if (raw.start != null) {
    const [h = "", m = ""] = String(raw.start).split(":");
    form.elements.startH.value = h;
    form.elements.startM.value = m;
  }
  form.querySelectorAll('input[name="weather"]').forEach((r) => (r.checked = r.value === raw.weather));
}

function showErrors(errors) {
  form.querySelectorAll(".err").forEach((p) => {
    const msg = errors[p.dataset.for] || "";
    p.textContent = msg;
    const field = p.closest(".field");
    field.classList.toggle("invalid", !!msg);
  });
}

const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)} ชม.${m % 60 ? " " + (m % 60) + " นาที" : ""}` : `${m} นาที`);
const fmtBaht = (n) => n.toLocaleString("th-TH") + " บาท";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tagTH = (t) => INTERESTS[t] || { indoor: "ในร่ม", outdoor: "กลางแจ้ง", shopping: "ช้อปปิ้ง" }[t] || t;
const weatherTH = { outdoor: "กลางแจ้ง", indoor: "ในร่ม", mixed: "ในร่ม+กลางแจ้ง" };

function generate() {
  const raw = readForm();
  const v = validateInput(raw);
  showErrors(v.errors);
  if (!v.ok) {
    resultEl.innerHTML = `<div class="notice bad"><h3>ข้อมูลยังไม่ถูกต้อง</h3><p>แก้ช่องที่ขึ้นข้อความสีแดง แล้วกดสร้างแผนอีกครั้ง</p></div>`;
    form.querySelector(".invalid input, .invalid select")?.focus();
    return;
  }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(raw)); } catch (e) {}

  const x = v.value;
  const key = JSON.stringify(x);
  if (current && current.key === key && current.replanAt === null) return; // Input เดิม = แผนเดิม (กันการคำนวณซ้ำลบกล่อง "เทียบกับแผนก่อนหน้า")
  const endMin = Math.min(x.startMin + x.durMin, 24 * 60);
  const r = planTrip({
    interests: x.interests, weather: x.weather, budget: x.budget,
    startId: START_ID, startMin: x.startMin, endMin, visited: [],
  });
  current = { key, input: x, endMin, stops: r.best.stops, cost: r.best.cost, explored: r.explored, skipped: r.skipped, replanAt: null };
  render();
}

// ฝนตกระหว่างทาง: เก็บจุดที่เที่ยวแล้ว แล้ววางแผนต่อจากจุดที่ k ด้วยเงื่อนไขฝนตก
function replanFrom(k) {
  const x = current.input;
  const done = current.stops.slice(0, k + 1);
  const here = done[done.length - 1];
  const spent = done.reduce((s, st) => s + byId[st.id].cost, 0);
  const r = planTrip({
    interests: x.interests, weather: "rain", budget: x.budget - spent,
    startId: here.id, startMin: here.depart, endMin: current.endMin,
    visited: done.map((s) => s.id),
  });
  lastPlanIds = current.stops.map((s) => s.id);
  current = {
    ...current, stops: done.concat(r.best.stops), cost: spent + r.best.cost,
    explored: r.explored, skipped: r.skipped, replanAt: k,
  };
  render(true);
}

function diffHTML(prevIds, nowIds, skipped = []) {
  if (!prevIds) return "";
  const removed = prevIds.filter((id) => !nowIds.includes(id));
  const added = nowIds.filter((id) => !prevIds.includes(id));
  if (!removed.length && !added.length) {
    return `<div class="diff same">แผนใหม่มีสถานที่ชุดเดิม${prevIds.join() === nowIds.join() ? "" : " แต่สลับลำดับ"}</div>`;
  }
  const names = (ids) => ids.map((id) => esc(byId[id].name)).join(", ");
  return `<div class="diff">
    <strong>เทียบกับแผนก่อนหน้า</strong>
    ${removed.map((id) => {
      const why = skipped.find((s) => s.id === id);
      return `<p class="minus">ตัดออก: ${esc(byId[id].name)}${why ? ` — ${esc(why.reason)}` : ""}</p>`;
    }).join("")}
    ${added.length ? `<p class="plus">เพิ่มเข้ามา: ${names(added)}</p>` : ""}
  </div>`;
}

function noPlanHTML(x, skipped, endMin) {
  const reasons = skipped.map((s) => `<li><strong>${esc(byId[s.id].name)}</strong> — ${esc(s.reason)}</li>`).join("");
  const tips = [];
  if (x.weather === "rain") {
    const dry = ATTRACTIONS.filter((p) => p.weather !== "outdoor");
    const missing = [...new Set(dry.flatMap((p) => p.tags.filter((t) => INTERESTS[t] && !x.interests.includes(t))))];
    tips.push(`วันฝนตกไปได้เฉพาะที่ในร่มหรือกึ่งในร่ม: ${dry.map((p) => `${p.name} (${p.tags.filter((t) => INTERESTS[t]).map(tagTH).join("/")})`).join(", ")}` +
      (missing.length ? ` ลองเลือกหมวด ${missing.map(tagTH).join(" หรือ ")} เพิ่ม` : ""));
  }
  const matching = ATTRACTIONS.filter((p) => matchesInterest(p, x.interests));
  const cheapest = Math.min(...matching.map((p) => p.cost));
  if (cheapest > x.budget) tips.push(`งบต้องมีอย่างน้อย ${fmtBaht(cheapest)} ต่อคนสำหรับหมวดที่เลือก`);
  if (x.interests.includes("food") && x.interests.length === 1) tips.push(x.weather === "rain" ? "หมวดอาหารมีเฉพาะเชียงรายไนท์บาซาร์ ซึ่งเป็นที่กลางแจ้ง วันฝนตกจึงไปไม่ได้ ลองเลือกหมวดอื่น" : "หมวดอาหารมีเฉพาะเชียงรายไนท์บาซาร์ เปิด 18:00–23:00 ต้องเริ่มและมีเวลาช่วงเย็น");
  tips.push("ลองเพิ่มเวลาเที่ยว เปลี่ยนเวลาเริ่ม หรือเลือกความสนใจเพิ่ม");
  return `<div class="notice bad">
    <h3>ไม่พบแผนที่ตรงทุกเงื่อนไข</h3>
    <p>ไม่มีสถานที่ในหมวดที่เลือกที่ไปได้ภายในงบ ${fmtBaht(x.budget)} ต่อคน และเวลา ${fmtDur(endMin - x.startMin)} (เริ่ม ${toHHMM(x.startMin)} ถึง ${toHHMM(endMin)})</p>
    ${reasons ? `<ul class="reasons">${reasons}</ul>` : ""}
    <p><strong>ลองแบบนี้</strong></p>
    <ul>${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
  </div>`;
}

function render(fromReplan = false) {
  const { input: x, stops, cost, explored, skipped, replanAt } = current;
  const ids = stops.map((s) => s.id);
  const diff = diffHTML(lastPlanIds, ids, skipped);
  lastPlanIds = ids;

  const scen = `<div class="scenarios">
    <span>สถานการณ์เปลี่ยน?</span>
    <button type="button" data-s="rain">${x.weather === "rain" ? "ฝนหยุดแล้ว" : "ฝนตก"}</button>
    <button type="button" data-open="budget">งบลดลง</button>
    <button type="button" data-open="time">เวลาเหลือน้อยลง</button>
    <button type="button" data-open="late">ออกช้ากว่าเดิม</button>
  </div>
  <div class="ask" data-ask="budget" hidden>
    <label>ตอนนี้งบเหลือคนละ <input name="sBudget" inputmode="decimal" value="${x.budget}"> บาท</label>
    <button type="button" data-apply="budget">ปรับแผน</button><p class="err"></p>
  </div>
  <div class="ask" data-ask="time" hidden>
    <label>เหลือเวลาเที่ยวอีก <input name="sH" inputmode="decimal" value="${Math.floor(x.durMin / 60)}"> ชม.</label>
    <label><input name="sM" inputmode="numeric" value="${x.durMin % 60}"> นาที</label>
    <button type="button" data-apply="time">ปรับแผน</button><p class="err"></p>
  </div>
  <div class="ask" data-ask="late" hidden>
    <label>ออกช้ากว่าเดิม <input name="lH" inputmode="numeric" value="1"> ชม.</label>
    <label><input name="lM" inputmode="numeric" value="0"> นาที</label>
    <span class="muted">(เดิมออก ${toHHMM(x.startMin)})</span>
    <button type="button" data-apply="late">ปรับแผน</button><p class="err"></p>
  </div>`;

  if (!stops.length) {
    resultEl.innerHTML = scen + diff + noPlanHTML(x, skipped, current.endMin);
    bindScenarios();
    return;
  }

  const last = stops[stops.length - 1];
  const total = last.depart - x.startMin;
  const travelSum = stops.reduce((s, st) => s + st.travel, 0);
  const waitSum = stops.reduce((s, st) => s + st.wait, 0);
  const visitSum = total - travelSum - waitSum;

  let rows = `<li class="stop origin"><div class="time">${toHHMM(x.startMin)}</div>
    <div class="card"><h4>ออกเดินทางจาก${esc(byId[START_ID].name)}</h4></div></li>`;
  stops.forEach((s, i) => {
    const p = byId[s.id];
    if (replanAt !== null && i === replanAt + 1) {
      rows += `<li class="replan-mark">ฝนตกหลังออกจาก${esc(byId[stops[replanAt].id].name)} — ปรับแผนต่อจากตรงนี้ (ข้ามที่กลางแจ้ง)</li>`;
    }
    rows += `<li class="leg">${s.travel ? `เดินทาง ${s.travel} นาที` : "อยู่ที่จุดเริ่มต้น"}${s.wait ? ` · รอเปิด ${s.wait} นาที` : ""}</li>`;
    rows += `<li class="stop">
      <div class="time">${toHHMM(s.start)}<small>ถึง ${toHHMM(s.arrive)}</small></div>
      <div class="card">
        ${PHOTOS[p.id] ? `<img class="thumb" src="${PHOTOS[p.id]}" alt="${esc(p.name)}" loading="lazy">` : ""}
        <div class="card-head"><h4>${esc(p.name)}</h4><span class="cost">${p.cost ? fmtBaht(p.cost) : "ฟรี"}</span></div>
        <p class="meta">เที่ยว ${p.visit} นาที · ออก ${toHHMM(s.depart)} · เปิด ${p.open}–${p.close} · ${weatherTH[p.weather]}</p>
        <p class="tags">${p.tags.filter((t) => INTERESTS[t] && x.interests.includes(t)).map((t) => `<span class="tag">${tagTH(t)}</span>`).join("")}</p>
        ${i < stops.length - 1 && replanAt === null && x.weather !== "rain" ? `<button type="button" class="link" data-replan="${i}">ถ้าฝนตกหลังจุดนี้ ปรับแผนต่อ</button>` : ""}
      </div></li>`;
  });

  const skippedHTML = skipped.length
    ? `<details class="skipped"><summary>สถานที่ตรงความสนใจที่ไม่ได้อยู่ในแผน (${skipped.length})</summary>
        <ul>${skipped.map((s) => `<li><strong>${esc(byId[s.id].name)}</strong> — ${esc(s.reason)}</li>`).join("")}</ul></details>`
    : "";

  resultEl.innerHTML = `
    ${scen}
    ${diff}
    <div class="summary">
      <div><b>${stops.length}</b><span>สถานที่</span></div>
      <div><b>${fmtDur(total)}</b><span>จาก ${fmtDur(current.endMin - x.startMin)} ที่มี</span></div>
      <div><b>${fmtBaht(cost)}</b><span>ต่อคน (งบ ${fmtBaht(x.budget)})</span></div>
      <div><b>${fmtBaht(cost * x.people)}</b><span>ทั้งกลุ่ม ${x.people} คน</span></div>
    </div>
    <p class="breakdown">ตรงความสนใจ: ${x.interests.map((t) => `${tagTH(t)} ${stops.filter((s) => byId[s.id].tags.includes(t)).length} ที่`).join(" · ")}<br>เวลารวม = เดินทาง ${travelSum} + เที่ยว ${visitSum} + รอเปิด ${waitSum} = ${total} นาที · จบทริป ${toHHMM(last.depart)}</p>
    <ol class="timeline">${rows}</ol>
    ${skippedHTML}
    <details class="why"><summary>ทำไมเลือกแผนนี้</summary>
      <p>แอปลองลำดับการเดินทางที่เป็นไปได้ ${explored.toLocaleString("th-TH")} แบบ (ทุกแบบเริ่มจากหอนาฬิกา ไม่ซ้ำ อยู่ในงบ เวลา และช่วงเปิด–ปิด${x.weather === "rain" ? " และไม่มีที่กลางแจ้ง" : ""}) แล้วเลือกตามลำดับนี้</p>
      <ol><li>ได้สถานที่ตรงความสนใจมากที่สุด</li><li>ถ้าเท่ากัน เลือกแผนที่ใช้เวลารวมน้อยกว่า</li><li>ถ้ายังเท่ากัน เลือกแผนที่ถูกกว่า</li></ol>
    </details>`;
  bindScenarios();
  resultEl.querySelectorAll("[data-replan]").forEach((b) => b.addEventListener("click", () => replanFrom(+b.dataset.replan)));
  if (fromReplan) resultEl.querySelector(".replan-mark")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function bindScenarios() {
  // ฝนตก/ฝนหยุด: สลับทันที
  resultEl.querySelectorAll("[data-s]").forEach((b) =>
    b.addEventListener("click", () => {
      const raw = readForm();
      raw.weather = raw.weather === "rain" ? "normal" : "rain";
      writeForm(raw);
      generate();
    })
  );
  // งบ/เวลา/ออกช้า: เปิดช่องถามค่าใหม่ก่อน
  resultEl.querySelectorAll("[data-open]").forEach((b) =>
    b.addEventListener("click", () => {
      resultEl.querySelectorAll("[data-ask]").forEach((d) => (d.hidden = d.dataset.ask !== b.dataset.open || !d.hidden));
      resultEl.querySelectorAll("[data-open]").forEach((o) => o.classList.toggle("on", o === b && !resultEl.querySelector(`[data-ask="${b.dataset.open}"]`).hidden));
      resultEl.querySelector(`[data-ask="${b.dataset.open}"] input`)?.select();
    })
  );
  resultEl.querySelectorAll("[data-ask]").forEach((box) => {
    const apply = () => applyScenario(box);
    box.querySelector("[data-apply]").addEventListener("click", apply);
    box.addEventListener("keydown", (e) => { if (e.key === "Enter") apply(); });
  });
}

function applyScenario(box) {
  const kind = box.dataset.ask;
  const val = (n) => box.querySelector(`[name="${n}"]`).value;
  const err = box.querySelector(".err");
  const raw = readForm();
  let msg = "";
  if (kind === "budget") {
    raw.budget = val("sBudget").trim();
    msg = validateInput(raw).errors.budget || "";
  }
  if (kind === "time") {
    raw.hours = val("sH").trim();
    raw.minutes = val("sM").trim();
    msg = validateInput(raw).errors.duration || "";
  }
  if (kind === "late") {
    const h = val("lH").trim() === "" ? 0 : Number(val("lH"));
    const m = val("lM").trim() === "" ? 0 : Number(val("lM"));
    const now = validateInput(raw);
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0) msg = "ชั่วโมงและนาทีต้องเป็นจำนวนเต็มไม่ติดลบ";
    else if (h * 60 + m === 0) msg = "ใส่เวลาที่ช้าไปอย่างน้อย 1 นาที";
    else if (!now.ok) msg = "แก้ข้อมูลในฟอร์มด้านซ้ายให้ถูกก่อน";
    else if (now.value.startMin + h * 60 + m > 23 * 60 + 59) msg = `ออกช้าขนาดนี้จะเลย 23:59 (เดิมออก ${toHHMM(now.value.startMin)})`;
    else raw.start = toHHMM(now.value.startMin + h * 60 + m);
  }
  err.textContent = msg;
  if (msg) return;
  writeForm(raw);
  generate();
}

let hasPlanned = false;
form.addEventListener("submit", (e) => {
  e.preventDefault();
  hasPlanned = true;
  generate();
});

// หลังสร้างแผนครั้งแรก: แก้ช่องไหนก็ได้ แผนจะคำนวณใหม่เอง
// ใช้ event "change" (ติ๊ก/เลือกแล้วเกิดทันที, ช่องพิมพ์เกิดเมื่อกด Enter หรือออกจากช่อง) เพื่อไม่ให้ขึ้น error ระหว่างพิมพ์ยังไม่จบ
form.addEventListener("change", () => {
  if (!hasPlanned) return;
  generate();
  resultEl.classList.remove("flash");
  void resultEl.offsetWidth; // เริ่มแอนิเมชันใหม่
  resultEl.classList.add("flash");
});

// โหลดค่าที่กรอกไว้ครั้งก่อน
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  if (saved) writeForm(saved);
} catch (e) {}

$("#foot").innerHTML =
  `ข้อมูลสถานที่: ชื่อเป็นสถานที่จริง แต่ราคา เวลา และเวลาเปิด–ปิดเป็นข้อมูลจำลองของผู้จัด (Chiang_Rai_SmartTrip_Competition_Dataset)` +
  (MATRIX_IS_SAMPLE ? `<br><strong class="warn">เวลาเดินทางระหว่างสถานที่ตอนนี้เป็นค่าตัวอย่าง ยังไม่ใช่ Travel_Time_Matrix ของผู้จัด</strong>` : "");

// สไลด์พื้นหลัง hero: สลับภาพทุก 6 วินาที
(() => {
  const slides = [...document.querySelectorAll(".slide")];
  const label = document.getElementById("slide-name");
  let i = 0;
  setInterval(() => {
    slides[i].classList.remove("on");
    i = (i + 1) % slides.length;
    slides[i].classList.add("on");
    label.textContent = slides[i].dataset.name;
  }, 6000);
})();
