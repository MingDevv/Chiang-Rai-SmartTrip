// ข้อมูลจาก Chiang_Rai_SmartTrip_Competition_Dataset.xlsx (sheet Attractions) — ข้อมูลจำลองของผู้จัด
const ATTRACTIONS = [
  { id: "A", name: "วัดร่องขุ่น",          tags: ["culture", "art"],      cost: 100, visit: 60, open: "08:00", close: "17:00", weather: "outdoor" },
  { id: "B", name: "สิงห์ปาร์ค",           tags: ["nature"],              cost: 150, visit: 90, open: "09:00", close: "17:00", weather: "outdoor" },
  { id: "C", name: "วัดร่องเสือเต้น",       tags: ["culture"],             cost: 0,   visit: 45, open: "07:00", close: "20:00", weather: "outdoor" },
  { id: "D", name: "พิพิธภัณฑ์บ้านดำ",      tags: ["art", "indoor"],       cost: 100, visit: 60, open: "09:00", close: "17:00", weather: "indoor" },
  { id: "E", name: "วัดห้วยปลากั้ง",        tags: ["culture"],             cost: 50,  visit: 45, open: "07:00", close: "18:00", weather: "outdoor" },
  { id: "F", name: "หอนาฬิกาเชียงราย",     tags: ["art", "outdoor"],      cost: 0,   visit: 20, open: "08:00", close: "21:00", weather: "outdoor" },
  { id: "G", name: "พิพิธภัณฑ์อูบคำ",       tags: ["culture", "indoor"],   cost: 150, visit: 60, open: "09:00", close: "17:00", weather: "indoor" },
  { id: "H", name: "ไร่แม่ฟ้าหลวง",         tags: ["art", "nature"],       cost: 100, visit: 60, open: "09:00", close: "16:30", weather: "mixed" },
  { id: "I", name: "เชียงรายไนท์บาซาร์",    tags: ["food", "shopping"],    cost: 150, visit: 60, open: "18:00", close: "23:00", weather: "outdoor" },
  { id: "J", name: "วัดพระแก้ว",           tags: ["culture"],             cost: 0,   visit: 45, open: "08:00", close: "17:00", weather: "outdoor" },
];

// Travel Time Matrix (นาที) จาก sheet Travel_Time_Matrix ของผู้จัด — สมมาตร, แนวทแยง = 0, รถส่วนตัวจำลอง
const MATRIX_IS_SAMPLE = false;
const TRAVEL = {
  A: { A: 0, B: 15, C: 35, D: 55, E: 40, F: 30, G: 25, H: 25, I: 30, J: 30 },
  B: { A: 15, B: 0, C: 35, D: 55, E: 35, F: 25, G: 20, H: 15, I: 30, J: 30 },
  C: { A: 35, B: 35, C: 0, D: 25, E: 20, F: 10, G: 20, H: 25, I: 10, J: 10 },
  D: { A: 55, B: 55, C: 25, D: 0, E: 30, F: 30, G: 35, H: 45, I: 30, J: 30 },
  E: { A: 40, B: 35, C: 20, D: 30, E: 0, F: 20, G: 20, H: 25, I: 20, J: 15 },
  F: { A: 30, B: 25, C: 10, D: 30, E: 20, F: 0, G: 10, H: 20, I: 10, J: 10 },
  G: { A: 25, B: 20, C: 20, D: 35, E: 20, F: 10, G: 0, H: 15, I: 15, J: 10 },
  H: { A: 25, B: 15, C: 25, D: 45, E: 25, F: 20, G: 15, H: 0, I: 20, J: 20 },
  I: { A: 30, B: 30, C: 10, D: 30, E: 20, F: 10, G: 15, H: 20, I: 0, J: 10 },
  J: { A: 30, B: 30, C: 10, D: 30, E: 15, F: 10, G: 10, H: 20, I: 10, J: 0 },
};

const START_ID = "F"; // ทุกแผนเริ่มที่หอนาฬิกาเชียงราย
const INTERESTS = { nature: "ธรรมชาติ", culture: "วัฒนธรรม", art: "ศิลปะ", food: "อาหาร" };
