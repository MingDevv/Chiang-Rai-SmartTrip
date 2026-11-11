// ตรวจ validateInput — รัน: node tests/check-validation.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "..");
const ctx = { module: { exports: {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(root + "/data.js", "utf8") + fs.readFileSync(root + "/planner.js", "utf8"), ctx);
const { validateInput } = ctx.module.exports;
const base = { interests: ["nature"], budget: "500", people: "2", start: "08:30", hours: "3", minutes: "0", weather: "normal" };
// [ชื่อเคส, override, field ที่ต้อง error (null = ต้อง valid)]
const cases = [
  ["baseline valid", {}, null],
  ["interests empty []", { interests: [] }, "interests"],
  ["budget empty", { budget: "" }, "budget"],
  ["people empty", { people: "" }, "people"],
  ["start empty", { start: "" }, "start"],
  ["weather empty", { weather: "" }, "weather"],
  ["budget -1", { budget: "-1" }, "budget"],
  ["budget abc", { budget: "abc" }, "budget"],
  ["budget 0 valid", { budget: "0" }, null],
  ["budget ' 300 ' valid", { budget: " 300 " }, null],
  ["budget 100000 valid", { budget: "100000" }, null],
  ["budget 100001 over cap", { budget: "100001" }, "budget"],
  ["people 0", { people: "0" }, "people"],
  ["people 1.5", { people: "1.5" }, "people"],
  ["people -2", { people: "-2" }, "people"],
  ["people 101", { people: "101" }, "people"],
  ["people 100 valid", { people: "100" }, null],
  ["people 2 valid", { people: "2" }, null],
  ["start 9:30 valid (1-digit hour)", { start: "9:30" }, null],
  ["start 08.30 valid (dot)", { start: "08.30" }, null],
  ["start 24:00", { start: "24:00" }, "start"],
  ["start 24:00", { start: "24:00" }, "start"],
  ["start 23:59 valid", { start: "23:59" }, null],
  ["start 07:60", { start: "07:60" }, "start"],
  ["start 0830", { start: "0830" }, "start"],
  ["start ab:cd", { start: "ab:cd" }, "start"],
  ["hours 1 min 50 valid", { hours: "1", minutes: "50" }, null],
  ["0 h 90 min valid", { hours: "0", minutes: "90" }, null],
  ["hours -1", { hours: "-1" }, "duration"],
  ["hours 1.5 valid", { hours: "1.5" }, null],
  ["hours abc", { hours: "abc" }, "duration"],
  ["minutes 1.5", { minutes: "1.5" }, "duration"],
  ["hours empty min 30 valid", { hours: "", minutes: "30" }, null],
  ["hours 2 min empty valid", { hours: "2", minutes: "" }, null],
  ["hours & minutes both empty", { hours: "", minutes: "" }, "duration"],
  ["hours 0 min 0", { hours: "0", minutes: "0" }, "duration"],
  ["hours 24 min 1 too long", { hours: "24", minutes: "1" }, "duration"],
  ["hours 24 min 0 valid", { hours: "24", minutes: "0" }, null],
  ["weather snow", { weather: "snow" }, "weather"],
  ["weather rain valid", { weather: "rain" }, null],
  ["interests 4 valid", { interests: ["nature", "culture", "art", "food"] }, null],
];
let pass = 0, fail = 0;
const findings = [];
for (const [name, ov, expect] of cases) {
  const inp = { ...base, ...ov };
  let r;
  try { r = validateInput(inp); } catch (e) { r = { ok: false, errors: { THROW: e.message } }; }
  const keys = Object.keys(r.errors || {});
  let good;
  if (expect === null) good = r.ok === true && keys.length === 0;
  else if (expect === "duration") good = r.ok === false && keys.some((k) => k === "hours" || k === "minutes" || k === "duration");
  else good = r.ok === false && keys.includes(expect);
  const actual = r.ok ? "ok" : "error: " + keys.join(",");
  const want = expect === null ? "ok" : "error: " + expect;
  console.log(`${good ? "PASS" : "FAIL"}  ${name.padEnd(30)} -> ${actual}${good ? "" : `   (expected ${want}; errors=${JSON.stringify(r.errors)})`}`);
  good ? pass++ : fail++;
}
console.log(`\n${pass} passed, ${fail} failed, ${cases.length} total`);
process.exit(fail ? 1 : 0);
