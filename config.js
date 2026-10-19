// ===== ตั้งค่าการเชื่อมต่อ (หลายตึก) =====
// เพิ่ม 1 บรรทัดต่อ 1 ตึก:  รหัสตึก: { name: 'ชื่อตึก', url: 'URL ของ Apps Script ที่ลงท้ายด้วย /exec' },
const BUILDINGS = {
  CHARAT: { name: 'ตึกจรัสศรี', url: 'https://script.google.com/macros/s/AKfycbyQ4qjGSxCUR_avgSWKBeT-UY6XPpJLd8KLfp6X2yZrfafmFthNUS-9xt55IJaPsDl2/exec' },
  MS: { name: 'MS apartment', url: 'https://script.google.com/macros/s/AKfycbyW_Uy-1cpYO0kP_T7b1Zo4th1OB7wS_aSPtsC02u5QqCzT6aHM4KR77Qd3ahGuCXZ6/exec' },
};
// ลิงก์บิล/หน้าผู้เช่าแบบเก่าที่ส่งไปก่อนมีรหัสตึก ให้เปิดเป็นตึกนี้
const DEFAULT_BUILDING = 'CHARAT';
