/******************************************************************
 * ระบบบริหารอพาร์ทเม้นท์ v2 — Backend (Google Apps Script + Google Sheet)
 *
 * ติดตั้ง: Google Sheet ใหม่ > ส่วนขยาย > Apps Script > ลบโค้ดเดิม
 *         > วางไฟล์นี้ทั้งหมด > Run "setup" > Deploy เป็น Web app
 *         (Execute as: Me, Who has access: Anyone)
 * ไฟล์นี้ใช้เป็นโหมดทดลองในเบราว์เซอร์ได้ด้วย (ไม่ต้องแก้)
 ******************************************************************/

const SCHEMA = {
  Settings: ['key', 'value', 'description'],
  Rooms:    ['room', 'floor', 'type', 'rent', 'status', 'note',
             'bookName', 'bookPhone', 'bookAt', 'bookDeposit', 'bookNote', 'fixNote', 'fixSince', 'fixDue'],
  Tenants:  ['id', 'room', 'name', 'phone', 'lineId', 'startDate', 'endDate', 'deposit',
             'status', 'moveOutDate', 'pin', 'note', 'createdAt',
             'advanceRent', 'keyDeposit', 'cardFee', 'contractMonths', 'refundAmount', 'refundStatus', 'refundDate'],
  Meters:   ['month', 'room', 'waterPrev', 'waterCur', 'elecPrev', 'elecCur', 'updatedAt'],
  Bills:    ['id', 'no', 'token', 'kind', 'month', 'room', 'tenantId', 'tenantName', 'items',
             'waterUnits', 'elecUnits', 'total', 'dueDate', 'status', 'createdAt',
             'slipId', 'slipAt', 'rejectReason', 'rejectedAt',
             'payMethod', 'paidAmount', 'received', 'paidDate', 'receiptNo', 'note', 'paidAt'],
  Slips:    ['id', 'billId', 'room', 'at', 'fileId', 'hash', 'result'],
  Repairs:  ['id', 'createdAt', 'room', 'tenantId', 'name', 'phone', 'category', 'detail', 'photoId',
             'allowEntry', 'status', 'ownerMsg', 'cost', 'billId', 'updatedAt', 'log',
             'source', 'urgent', 'appointAt', 'outcome'],
  News:     ['id', 'createdAt', 'title', 'body'],
  Files:    ['id', 'createdAt', 'room', 'tenantId', 'category', 'name', 'mime', 'fileId', 'size', 'note'],
  Expenses: ['id', 'date', 'category', 'amount', 'note', 'files', 'createdAt'],
};

const NUM_KEYS = new Set(['size', 'floor', 'rent', 'deposit', 'waterPrev', 'waterCur', 'elecPrev', 'elecCur',
  'waterUnits', 'elecUnits', 'total', 'paidAmount', 'received', 'cost', 'advanceRent', 'keyDeposit', 'cardFee', 'refundAmount', 'amount', 'bookDeposit']);

const ST = {
  OCC: 'มีผู้เช่า', VAC: 'ว่าง', RES: 'จอง', FIX: 'ซ่อม',
  ACTIVE: 'อยู่', LEFT: 'ย้ายออก',
  DUE: 'รอชำระ', REVIEW: 'รออนุมัติ', PAID: 'ชำระแล้ว',
  R_NEW: 'รอดำเนินการ', R_DOING: 'กำลังซ่อม', R_DONE: 'เสร็จแล้ว', R_BROKEN: 'ซ่อมไม่ได้',
};
const KIND = { MONTH: 'รายเดือน', SPECIAL: 'พิเศษ', FIRST: 'แรกเข้า', OUT: 'ย้ายออก' };
const PAY = { TRANSFER: 'โอน/พร้อมเพย์', CASH: 'เงินสด', DEPOSIT: 'หักเงินมัดจำ' };
const TH_MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const DEFAULT_SETTINGS = [
  ['apartmentName', 'อพาร์ทเม้นท์ของฉัน', 'ชื่ออพาร์ทเม้นท์'],
  ['address', '', 'ที่อยู่ (แสดงบนบิล)'],
  ['phone', '', 'เบอร์ติดต่อเจ้าของหอ'],
  ['ownerLine', '', 'LINE ID หรือลิงก์ LINE ของหอ (ให้ผู้เช่ากดติดต่อ)'],
  ['adminPassword', '1234', 'รหัสผ่านเจ้าของหอ — เปลี่ยนทันที!'],
  ['waterRate', '18', 'ค่าน้ำ บาท/หน่วย'],
  ['waterMin', '0', 'ค่าน้ำขั้นต่ำ/เดือน'],
  ['elecRate', '8', 'ค่าไฟ บาท/หน่วย'],
  ['elecMin', '0', 'ค่าไฟขั้นต่ำ/เดือน'],
  ['commonFee', '0', 'ค่าส่วนกลาง/เน็ต ต่อเดือน'],
  ['dueDay', '5', 'ครบกำหนดชำระ วันที่ ... ของเดือนถัดไป'],
  ['depositMonths', '1', 'เงินประกัน (จำนวนเดือนของค่าเช่า)'],
  ['advanceMonths', '1', 'ค่าเช่าล่วงหน้าตอนเข้า (จำนวนเดือน · ใช้แทนค่าเช่าเดือนแรก)'],
  ['dailyRate', '0', 'ค่าเช่ารายวัน (บาท/วัน) สำหรับเดือนที่เข้า-ออกไม่เต็มเดือน: ค่าเช่า − วันที่ไม่ได้อยู่ × ราคานี้ · 0 = คิดตามสัดส่วนวัน'],
  ['keyDeposit', '100', 'มัดจำกุญแจ (คืนเมื่อคืนกุญแจตอนย้ายออก)'],
  ['cardFee', '100', 'ค่าคีย์การ์ด (ไม่คืน)'],
  ['contractMonths', '12', 'ระยะสัญญาเริ่มต้น (เดือน)'],
  ['promptpay', '', 'เบอร์/เลขบัตร PromptPay (สร้าง QR บนบิล)'],
  ['bankInfo', '', 'บัญชีธนาคาร (แสดงบนบิล)'],
  ['cashInfo', 'ชำระเงินสดได้ที่สำนักงาน ชั้น 1 ทุกวัน 9:00–18:00', 'ข้อความบอกผู้เช่าเรื่องจ่ายเงินสด'],
  ['lineToken', '', 'LINE Messaging API: Channel access token (ไม่บังคับ)'],
  ['lineGroupId', '', 'LINE Group ID รับแจ้งเตือน (ไม่บังคับ)'],
  ['invSeq', '0', '(ระบบ) เลขที่ใบแจ้งหนี้ล่าสุด'],
  ['rcSeq', '0', '(ระบบ) เลขที่ใบเสร็จล่าสุด'],
  ['fileFolderId', '', '(ระบบ) โฟลเดอร์ Google Drive ที่เก็บรูปสลิป/รูปแจ้งซ่อม'],
  ['buildingName', '', 'ชื่อตึกที่แสดงในรายการเลือกตึกตอนเข้าระบบ (ไทย/อังกฤษได้ · เว้นว่าง = ใช้ชื่ออพาร์ทเม้นท์)'],
  ['tenantMode', 'shared', 'การใช้งานร่วมกับผู้เช่า: shared = ใช้ร่วมกับผู้เช่า · owner = เจ้าของจัดการเอง'],
  ['tenantApp', '1', 'ผู้เช่าเข้าแอปดูบิลและประวัติ (1 = เปิด, 0 = ปิด)'],
  ['tenantSlip', '1', 'ผู้เช่าส่งสลิปในแอป (1/0)'],
  ['tenantRepair', '1', 'ผู้เช่าแจ้งซ่อมในแอป (1/0)'],
  ['tenantNews', '1', 'ประกาศถึงผู้เช่าในแอป (1/0)'],
  ['billLink', '1', 'ส่งลิงก์บิล + QR พร้อมเพย์ทาง LINE (1/0)'],
];
const PRIVATE_SETTINGS = ['adminPassword', 'lineToken', 'invSeq', 'rcSeq', 'fileFolderId'];

/** สิทธิ์ฝั่งผู้เช่า ตามโหมด "เจ้าของจัดการเอง" / "ใช้ร่วมกับผู้เช่า" */
function tenantFlags_(s) {
  s = s || getSettings_();
  const on = k => String(s[k]) !== '0';
  const app = s.tenantMode !== 'owner' && on('tenantApp');
  return { mode: s.tenantMode === 'owner' ? 'owner' : 'shared', app: app, slip: app && on('tenantSlip'), repair: app && on('tenantRepair'), news: app && on('tenantNews'), billLink: on('billLink') };
}
const TENANT_OFF = 'ระบบผู้เช่าปิดอยู่ · ตึกนี้เจ้าของหอดูแลเอง กรุณาติดต่อเจ้าของหอโดยตรง';

/* ============================ ติดตั้ง ============================ */

function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SCHEMA).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  const have = readAll_('Settings').map(r => r.key);
  DEFAULT_SETTINGS.forEach(d => { if (have.indexOf(d[0]) < 0) writeRow_('Settings', { key: d[0], value: d[1], description: d[2] }); });
  const blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  try { DriveApp.getRootFolder(); } catch (e) { /* ขอสิทธิ์ Drive สำหรับเก็บรูปสลิป */ }
  return 'ติดตั้งเรียบร้อย';
}

/** สรุปเข้ากลุ่ม LINE ทุกเช้า 9 โมง — รันฟังก์ชันนี้ครั้งเดียว */
function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'dailyCheck') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(9).create();
}

/** ปลุกเซิร์ฟเวอร์ทุก 5 นาที (ลดอาการเปิดครั้งแรกช้า) + เติมแคชข้อมูล — รันฟังก์ชันนี้ครั้งเดียว */
function installWarmup() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'warmup') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('warmup').timeBased().everyMinutes(5).create();
}
function warmup() { MEMO = {}; prefetch_(); Object.keys(SCHEMA).forEach(n => { try { readAll_(n); } catch (e) {} }); }

/** แก้ข้อมูลใน Google Sheet ด้วยมือ → ล้างแคชของชีตนั้นอัตโนมัติ (ทำงานเอง ไม่ต้องตั้งค่า) */
function onEdit(e) {
  try { const n = e.range.getSheet().getName(); if (SCHEMA[n]) CacheService.getScriptCache().put('gen:' + n, String(Date.now()), 21600); } catch (err) {}
}

/* ============================ Web API ============================ */

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.action) return json_({ ok: true, message: 'Apartment API v2 is running' });
  return doPost({ postData: { contents: JSON.stringify(p) } });
}

function doPost(e) {
  let out;
  try { out = handle_(JSON.parse((e && e.postData && e.postData.contents) || '{}')); }
  catch (err) { out = { ok: false, error: String((err && err.message) || err) }; }
  return json_(out);
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

const PUBLIC_API = { publicInfo: api_publicInfo, getBill: api_getBill };
const TENANT_API = {
  tenantData: () => ({}), tenantSlip: api_tenantSlip, tenantRepair: api_tenantRepair, tenantFile: api_tenantFile,
};
const ADMIN_API = {
  login: () => ({}), getAll: () => ({}),
  saveRoom: api_saveRoom, deleteRoom: api_deleteRoom, bulkRooms: api_bulkRooms,
  checkIn: api_checkIn, saveTenant: api_saveTenant, markRefund: api_markRefund, resetPin: api_setPin, setPin: api_setPin, moveOut: api_moveOut,
  saveMeters: api_saveMeters, previewBills: api_previewBills, generateBills: api_generateBills,
  createBill: api_createBill, updateBill: api_updateBill, deleteBill: api_deleteBill,
  approveSlip: api_approveSlip, rejectSlip: api_rejectSlip, receiveCash: api_receiveCash, recordPayment: api_recordPayment, unpay: api_unpay,
  fileImage: api_fileImage, saveRepair: api_saveRepair, createRepair: api_createRepair,
  uploadDoc: api_uploadDoc, deleteDoc: api_deleteDoc, updateDoc: api_updateDoc,
  postNews: api_postNews, deleteNews: api_deleteNews,
  saveSettings: api_saveSettings, testLine: api_testLine,
  saveExpense: api_saveExpense, deleteExpense: api_deleteExpense, addExpenseFile: api_addExpenseFile, removeExpenseFile: api_removeExpenseFile,
  clearData: api_clearData, resetRoom: api_resetRoom,
};
const NO_DATA = { previewBills: 1, fileImage: 1 }; // คำสั่งที่ไม่ต้องส่งข้อมูลทั้งหมดกลับ

// คำสั่งที่อ่านอย่างเดียว ไม่ต้องรอคิว (เร็วขึ้นเวลามีหลายคนใช้พร้อมกัน)
const READ_ONLY = { login: 1, getAll: 1, fileImage: 1, previewBills: 1, tenantData: 1, tenantFile: 1 };

function handle_(req) {
  MEMO = {};
  prefetch_();
  const a = String(req.action || '');
  if (PUBLIC_API[a]) return Object.assign({ ok: true }, PUBLIC_API[a](req));
  const lockIf = fn => (READ_ONLY[a] || (a === 'moveOut' && !req.confirm)) ? fn() : withLock_(fn);
  if (TENANT_API[a]) {
    const f = tenantFlags_();
    if (!f.app) throw new Error(TENANT_OFF);
    if (a === 'tenantSlip' && !f.slip) throw new Error('การส่งสลิปในแอปปิดอยู่ · ส่งสลิปให้เจ้าของหอทาง LINE ได้เลย');
    if (a === 'tenantRepair' && !f.repair) throw new Error('การแจ้งซ่อมในแอปปิดอยู่ · กรุณาแจ้งเจ้าของหอโดยตรง');
    const t = tenantAuth_(req);
    return lockIf(() => {
      const r = TENANT_API[a](req, t) || {};
      return Object.assign({ ok: true, data: tenantView_(findBy_('Tenants', 'id', t.id)) }, r);
    });
  }
  if (!ADMIN_API[a]) throw new Error('ไม่รู้จักคำสั่ง: ' + a);
  adminAuth_(req);
  return lockIf(() => {
    const r = ADMIN_API[a](req) || {};
    return NO_DATA[a] ? Object.assign({ ok: true }, r) : Object.assign({ ok: true, data: allData_() }, r);
  });
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function guard_(key, max) {
  const c = CacheService.getScriptCache(), n = Number(c.get(key) || 0);
  if (n >= max) throw new Error('ใส่รหัสผิดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่');
  return { fail: () => c.put(key, String(n + 1), 900), ok: () => c.remove(key) };
}

function adminAuth_(req) {
  const g = guard_('fail_admin', 10);
  if (String(req.password || '') !== String(getSettings_().adminPassword)) { g.fail(); throw new Error('รหัสผ่านไม่ถูกต้อง'); }
  g.ok();
}

function tenantAuth_(req) {
  const room = String(req.room || '').trim(), pin = String(req.pin || '').trim();
  const g = guard_('fail_' + room, 5);
  const t = readAll_('Tenants').filter(x => x.room === room && x.status === ST.ACTIVE)[0];
  if (!t || !t.pin || t.pin !== pin) { g.fail(); throw new Error('เลขห้องหรือรหัสผู้เช่าไม่ถูกต้อง'); }
  g.ok();
  return t;
}

/* ============================ Public ============================ */

function api_publicInfo() {
  const s = getSettings_();
  const f = tenantFlags_(s);
  return {
    apartmentName: s.apartmentName, buildingName: s.buildingName || s.apartmentName, phone: s.phone, ownerLine: s.ownerLine, flags: f,
    rooms: f.app ? readAll_('Tenants').filter(t => t.status === ST.ACTIVE).map(t => t.room).sort(roomSort_) : [],
  };
}

function api_getBill(req) {
  const b = bills_().filter(x => x.token && x.token === String(req.token || ''))[0];
  if (!b) throw new Error('ไม่พบบิลนี้');
  return { bill: cleanBill_(b), info: publicSettings_() };
}

/* ============================ ห้อง ============================ */

const ROOM_BOOK = ['bookName', 'bookPhone', 'bookAt', 'bookDeposit', 'bookNote'], ROOM_FIX = ['fixNote', 'fixSince', 'fixDue'];
function api_saveRoom(req) {
  const r = req.room || {};
  r.room = String(r.room || '').trim();
  if (!r.room) throw new Error('กรุณาระบุเลขห้อง');
  const ex = findBy_('Rooms', 'room', r.room);
  if (!ex && req.isNew === false) throw new Error('ไม่พบห้อง');
  if (ex && req.isNew) throw new Error('มีห้อง ' + r.room + ' อยู่แล้ว');
  const m = Object.assign({ floor: guessFloor_(r.room), type: '', rent: 0, status: ST.VAC, note: '' }, ex || {}, r);
  if (activeTenant_(m.room)) m.status = ST.OCC;
  else if (m.status === ST.OCC) m.status = ST.VAC;
  if (m.status !== ST.RES) ROOM_BOOK.forEach(k => { m[k] = ''; });
  if (m.status !== ST.FIX) ROOM_FIX.forEach(k => { m[k] = ''; });
  if (m.status === ST.FIX && !isDate_(m.fixSince)) m.fixSince = today_();
  ['bookName', 'bookPhone', 'bookNote', 'fixNote'].forEach(k => { m[k] = String(m[k] || '').slice(0, 500); });
  writeRow_('Rooms', m, ex && ex._row);
}

function api_deleteRoom(req) {
  const ex = findBy_('Rooms', 'room', String(req.room));
  if (!ex) throw new Error('ไม่พบห้อง');
  if (activeTenant_(ex.room)) throw new Error('ห้องนี้ยังมีผู้เช่า ต้องย้ายออกก่อน');
  deleteRow_('Rooms', ex._row);
}

function api_bulkRooms(req) {
  const f1 = Number(req.floorFrom), f2 = Number(req.floorTo), n = Number(req.perFloor);
  if (!(f1 >= 1 && f2 >= f1 && f2 <= 99 && n >= 1 && n <= 99)) throw new Error('ข้อมูลชั้น/จำนวนห้องไม่ถูกต้อง');
  const have = new Set(readAll_('Rooms').map(r => r.room)), rows = [];
  for (let f = f1; f <= f2; f++) for (let i = 1; i <= n; i++) {
    const room = String(f) + pad2_(i);
    if (!have.has(room)) rows.push({ room, floor: f, type: req.type || '', rent: Number(req.rent) || 0, status: ST.VAC, note: '' });
  }
  writeRows_('Rooms', rows);
  return { result: { created: rows.length } };
}

/* ============================ ผู้เช่า ============================ */

function api_checkIn(req) {
  const t = req.tenant || {}, s = getSettings_();
  const room = findBy_('Rooms', 'room', String(t.room || ''));
  if (!room) throw new Error('ไม่พบห้อง');
  if (activeTenant_(room.room)) throw new Error('ห้องนี้มีผู้เช่าอยู่แล้ว');
  if (!String(t.name || '').trim()) throw new Error('กรุณาระบุชื่อผู้เช่า');
  const start = isDate_(t.startDate) ? t.startDate : today_();
  const months = Number(t.contractMonths) || Number(s.contractMonths) || 12;
  const rent0 = Number(room.rent) || 0, num = (v, d) => v === '' || v == null ? d : Number(v) || 0;
  const advMonths = num(t.advanceMonths, Number(s.advanceMonths) || 0);
  const tenant = {
    id: 'T' + Date.now().toString(36) + rand_(3), room: room.room, name: String(t.name).trim(),
    phone: t.phone || '', lineId: t.lineId || '', startDate: start,
    endDate: isDate_(t.endDate) ? t.endDate : addDays_(addMonths_(start, months), -1),
    deposit: t.deposit === '' || t.deposit == null ? (Number(room.rent) || 0) * (Number(s.depositMonths) || 0) : Number(t.deposit) || 0,
    status: ST.ACTIVE, moveOutDate: '', pin: t.pin ? checkPin_(t.pin) : newPin_(), note: t.note || '', createdAt: now_(),
    advanceRent: t.firstBill && advMonths > 0 ? firstAdvance_(rent0, start, advMonths).a : 0, keyDeposit: num(t.keyDeposit, Number(s.keyDeposit) || 0), cardFee: num(t.cardFee, Number(s.cardFee) || 0),
    contractMonths: months, refundAmount: '', refundStatus: '', refundDate: '',
  };
  writeRow_('Tenants', tenant);
  room.status = ST.OCC;
  ROOM_BOOK.concat(ROOM_FIX).forEach(k => { room[k] = ''; });
  writeRow_('Rooms', room, room._row);

  const month = start.slice(0, 7);
  if (has_(t.waterStart) || has_(t.elecStart)) {
    const m = readAll_('Meters').filter(x => x.month === month && x.room === room.room)[0];
    const rec = Object.assign({ month, room: room.room, waterPrev: '', elecPrev: '' }, m || {});
    if (has_(t.waterStart)) rec.waterPrev = Number(t.waterStart);
    if (has_(t.elecStart)) rec.elecPrev = Number(t.elecStart);
    rec.waterCur = ''; rec.elecCur = ''; rec.updatedAt = now_();
    writeRow_('Meters', rec, m && m._row);
  }
  let bill = null;
  if (t.firstBill) {
    const items = [];
    if (tenant.advanceRent > 0) items.push({ l: firstAdvance_(rent0, start, advMonths).l, a: tenant.advanceRent, k: 'advance' });
    else if (rent0 > 0) items.push(rentItem_(rent0, start, monthEnd_(month)));
    if (tenant.deposit > 0) items.push({ l: 'เงินประกัน', a: tenant.deposit, k: 'deposit' });
    if (tenant.keyDeposit > 0) items.push({ l: 'มัดจำกุญแจ (คืนเมื่อคืนกุญแจ)', a: tenant.keyDeposit, k: 'keydep' });
    if (tenant.cardFee > 0) items.push({ l: 'ค่าคีย์การ์ด', a: tenant.cardFee, k: 'card' });
    if (items.length) bill = newBill_(tenant, KIND.FIRST, month, items, start);
  }
  return { id: tenant.id, pin: tenant.pin, billId: bill && bill.id };
}

/** บันทึกว่าคืนเงินประกัน/เงินคงเหลือให้ผู้เช่าที่ย้ายออกแล้ว */
function api_markRefund(req) {
  const t = findBy_('Tenants', 'id', String(req.id || ''));
  if (!t || t.status !== ST.LEFT) throw new Error('ไม่พบผู้เช่าที่ย้ายออกแล้ว');
  t.refundStatus = req.undo ? 'รอคืนเงิน' : 'คืนแล้ว';
  t.refundDate = req.undo ? '' : (isDate_(req.date) ? req.date : today_());
  if (req.method) t.note = (t.note ? t.note + ' | ' : '') + 'คืนเงิน ' + fmtNum_(t.refundAmount) + ' บาท ทาง' + String(req.method).slice(0, 30);
  writeRow_('Tenants', t, t._row);
}

function api_saveTenant(req) {
  const p = req.tenant || {};
  const t = findBy_('Tenants', 'id', String(p.id || ''));
  if (!t) throw new Error('ไม่พบผู้เช่า');
  ['name', 'phone', 'lineId', 'startDate', 'endDate', 'deposit', 'keyDeposit', 'advanceRent', 'contractMonths', 'note'].forEach(k => { if (p[k] !== undefined) t[k] = p[k]; });
  writeRow_('Tenants', t, t._row);
}

/** เจ้าของหอตั้งรหัสเข้าระบบให้ผู้เช่าเอง (ตัวเลข 4–8 หลัก) หรือเว้นว่างให้ระบบสุ่ม */
function api_setPin(req) {
  const t = findBy_('Tenants', 'id', String(req.id || ''));
  if (!t || t.status !== ST.ACTIVE) throw new Error('ไม่พบผู้เช่า');
  t.pin = req.pin ? checkPin_(req.pin) : newPin_();
  writeRow_('Tenants', t, t._row);
  return { pin: t.pin };
}

/** ย้ายออก: confirm=false คำนวณให้ดูก่อน, confirm=true บันทึกจริง */
function api_moveOut(req) {
  const t = findBy_('Tenants', 'id', String(req.id || ''));
  if (!t || t.status !== ST.ACTIVE) throw new Error('ไม่พบผู้เช่าที่ยังอยู่');
  const s = getSettings_(), date = isDate_(req.date) ? req.date : today_(), month = date.slice(0, 7);
  const room = findBy_('Rooms', 'room', t.room) || {};
  const all = bills_(), meters = readAll_('Meters');
  const mine = all.filter(b => b.tenantId === t.id);
  const items = [];
  const monthlyDone = mine.some(b => b.kind === KIND.MONTH && b.month === month);
  let waterUnits = '', elecUnits = '';
  if (!monthlyDone) {
    const firstCovers = t.startDate.slice(0, 7) === month && mine.some(b => b.kind === KIND.FIRST && (b.items || []).some(i => i.k === 'rent'));
    if (!firstCovers) {
      const from = t.startDate.slice(0, 7) === month ? t.startDate : month + '-01';
      if (from <= date) items.push(rentItem_(Number(room.rent) || 0, from, date));
    }
    const prev = prevReading_(t.room, month, meters);
    if (has_(req.waterCur) && prev.water !== '') {
      waterUnits = Math.max(0, Number(req.waterCur) - Number(prev.water));
      items.push(utilItem_('water', waterUnits, prev.water, req.waterCur, s));
    }
    if (has_(req.elecCur) && prev.elec !== '') {
      elecUnits = Math.max(0, Number(req.elecCur) - Number(prev.elec));
      items.push(utilItem_('elec', elecUnits, prev.elec, req.elecCur, s));
    }
  }
  applyAdvance_(t, items, mine, null);
  const unpaid = mine.filter(b => b.status !== ST.PAID);
  unpaid.forEach(b => items.push({ l: 'ยอดค้าง: ' + billTitle_(b), a: b.total, k: 'unpaid' }));
  if (Number(req.damages) > 0) items.push({ l: req.damageNote || 'ค่าทำความสะอาด/ความเสียหาย', a: Number(req.damages), k: 'damage' });
  // เงินประกัน: ครบสัญญาคืนเต็ม · ออกก่อนสัญญา เจ้าของเลือกเอง (คืนเต็ม / คืนบางส่วน / ไม่คืน)
  const dep = Number(t.deposit) || 0, early = !!(t.endDate && date < t.endDate);
  const mode = ['full', 'partial', 'none'].indexOf(req.depositMode) >= 0 ? req.depositMode : (early ? '' : 'full');
  const keep = mode === 'none' ? dep : mode === 'partial' ? Math.min(dep, Math.max(0, Number(req.depositKeep) || 0)) : 0;
  if (dep > 0 && dep - keep > 0) items.push({ l: keep ? 'คืนเงินประกัน (หักไว้ ' + fmtNum_(keep) + ')' : 'คืนเงินประกัน', a: -(dep - keep), k: 'deposit' });
  const kd = Number(t.keyDeposit) || 0, keyBack = req.keyReturned === undefined || req.keyReturned === true || req.keyReturned === 'true';
  if (kd > 0 && keyBack) items.push({ l: 'คืนมัดจำกุญแจ', a: -kd, k: 'keydep' });
  const advLeft = advanceLeft_(t, mine, null) - items.filter(i => i.k === 'advuse').reduce((a, i) => a - i.a, 0);
  if (advLeft > 0) items.push({ l: 'คืนค่าเช่าล่วงหน้าที่ยังไม่ได้ใช้', a: -advLeft, k: 'advback' });
  const total = sumItems_(items);
  const calc = { items, total, refund: total < 0 ? -total : 0, owe: total > 0 ? total : 0, deposit: dep, keyDeposit: kd, keep, early, needChoice: early && dep > 0 && !mode,
    endDate: t.endDate, daysLeft: early ? dayDiff_(date, t.endDate) : 0 };
  if (!req.confirm) return { calc };
  if (calc.needChoice) throw new Error('ยังไม่ครบสัญญา — กรุณาเลือกว่าจะคืนเงินประกันอย่างไร');

  unpaid.forEach(b => markPaid_(b, PAY.DEPOSIT, b.total, date));
  const bill = newBill_(t, KIND.OUT, month, items, date, { waterUnits, elecUnits });
  if (total <= 0) markPaid_(bill, PAY.DEPOSIT, total, date, null, total < 0 ? 'คืนเงินผู้เช่า ' + fmtNum_(-total) + ' บาท' : '');
  if (has_(req.waterCur) || has_(req.elecCur)) {
    const m = meters.filter(x => x.month === month && x.room === t.room)[0];
    const rec = Object.assign({ month, room: t.room, waterPrev: '', elecPrev: '' }, m || {});
    const prev = prevReading_(t.room, month, meters);
    if (rec.waterPrev === '') rec.waterPrev = prev.water;
    if (rec.elecPrev === '') rec.elecPrev = prev.elec;
    if (has_(req.waterCur)) rec.waterCur = Number(req.waterCur);
    if (has_(req.elecCur)) rec.elecCur = Number(req.elecCur);
    rec.updatedAt = now_();
    writeRow_('Meters', rec, m && m._row);
  }
  t.status = ST.LEFT; t.moveOutDate = date; t.pin = '';
  if (calc.refund > 0) { t.refundAmount = calc.refund; t.refundStatus = 'รอคืนเงิน'; t.refundDate = ''; }
  const notes = [];
  if (keep) notes.push('ไม่คืนเงินประกัน ' + fmtNum_(keep) + ' บาท' + (early ? ' (ย้ายออกก่อนครบสัญญา)' : ''));
  if (kd > 0 && !keyBack) notes.push('ไม่ได้คืนกุญแจ (ไม่คืนมัดจำกุญแจ ' + fmtNum_(kd) + ')');
  if (notes.length) { bill.note = notes.join(' · '); writeBill_(bill); }
  if (req.note) t.note = (t.note ? t.note + ' | ' : '') + req.note;
  writeRow_('Tenants', t, t._row);
  const r = findBy_('Rooms', 'room', t.room);
  if (r) { r.status = ST.VAC; writeRow_('Rooms', r, r._row); }
  return { calc, billId: bill.id };
}

/* ============================ มิเตอร์ & บิลรายเดือน ============================ */

function api_saveMeters(req) {
  const month = String(req.month || '');
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('เดือนไม่ถูกต้อง');
  const ex = {};
  readAll_('Meters').forEach(m => { if (m.month === month) ex[m.room] = m; });
  let saved = 0;
  (req.rows || []).forEach(r => {
    const keys = ['waterPrev', 'waterCur', 'elecPrev', 'elecCur'].filter(k => r[k] !== undefined);
    if (!keys.length) return;
    const old = ex[String(r.room)];
    const rec = Object.assign({ waterPrev: '', waterCur: '', elecPrev: '', elecCur: '' }, old || {}, { month, room: String(r.room), updatedAt: now_() });
    keys.forEach(k => { rec[k] = has_(r[k]) ? Number(r[k]) : ''; });
    writeRow_('Meters', rec, old && old._row);
    ex[rec.room] = Object.assign(rec, { _row: old ? old._row : sheet_('Meters').getLastRow() });
    saved++;
  });
  return { result: { saved } };
}

function computeMonth_(month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('เดือนไม่ถูกต้อง');
  const s = getSettings_(), meters = readAll_('Meters'), all = bills_();
  const rooms = {};
  readAll_('Rooms').forEach(r => { rooms[r.room] = r; });
  const tenants = readAll_('Tenants').filter(t => t.status === ST.ACTIVE && t.startDate.slice(0, 7) <= month)
    .sort((a, b) => roomSort_(a.room, b.room));
  const out = { list: [], missing: [], skipped: [], warnings: [] };
  tenants.forEach(t => {
    const room = rooms[t.room] || {};
    const ex = all.filter(b => b.kind === KIND.MONTH && b.month === month && b.tenantId === t.id)[0];
    if (ex && ex.status !== ST.DUE) { out.skipped.push(t.room); return; }
    const rec = meters.filter(m => m.month === month && m.room === t.room)[0];
    const prev = prevReading_(t.room, month, meters);
    const wp = rec && rec.waterPrev !== '' ? rec.waterPrev : prev.water, ep = rec && rec.elecPrev !== '' ? rec.elecPrev : prev.elec;
    if (!rec || rec.waterCur === '' || rec.elecCur === '' || wp === '' || ep === '') { out.missing.push(t.room); return; }
    const items = [];
    const rent = Number(room.rent) || 0;
    if (t.startDate.slice(0, 7) === month) {
      // แบบเดิม: บิลแรกเข้ารวมค่าเช่าเดือนแรกแล้ว → ไม่เก็บซ้ำ · แบบใหม่: เก็บค่าเช่าตามวัน แล้วหักด้วยค่าเช่าล่วงหน้า
      const firstHasRent = all.some(b => b.tenantId === t.id && b.kind === KIND.FIRST && (b.items || []).some(i => i.k === 'rent'));
      if (!firstHasRent && rent > 0) items.push(rentItem_(rent, t.startDate, monthEnd_(month)));
    } else if (rent > 0) items.push({ l: 'ค่าเช่าห้อง ' + monthLabel_(month), a: rent, k: 'rent' });
    applyAdvance_(t, items, all, ex && ex.id);
    const wu = Math.max(0, Number(rec.waterCur) - Number(wp)), eu = Math.max(0, Number(rec.elecCur) - Number(ep));
    items.push(utilItem_('water', wu, wp, rec.waterCur, s));
    items.push(utilItem_('elec', eu, ep, rec.elecCur, s));
    if (Number(s.commonFee) > 0) items.push({ l: 'ค่าส่วนกลาง', a: Number(s.commonFee), k: 'common' });
    if (ex) ex.items.filter(i => i.c).forEach(i => items.push(i)); // เก็บรายการที่เจ้าของหอเพิ่มเอง
    // ตรวจค่าน้ำ-ไฟผิดปกติ เทียบเฉลี่ย 3 บิลก่อนหน้าของห้องนี้
    const hist = all.filter(b => b.kind === KIND.MONTH && b.room === t.room && b.month < month)
      .sort((a, b) => b.month.localeCompare(a.month)).slice(0, 3);
    [['elecUnits', eu, 'ค่าไฟ', 50], ['waterUnits', wu, 'ค่าน้ำ', 10]].forEach(([k, u, name, gap]) => {
      const h = hist.filter(b => Number(b[k]) > 0);
      if (!h.length) return;
      const avg = h.reduce((x, b) => x + Number(b[k]), 0) / h.length;
      if (u > avg * 1.8 && u - avg >= gap) out.warnings.push({ room: t.room, text: name + 'สูงผิดปกติ: ใช้ ' + u + ' หน่วย (ปกติ ~' + Math.round(avg) + ')' });
    });
    if (Number(rec.waterCur) < Number(wp) || Number(rec.elecCur) < Number(ep))
      out.warnings.push({ room: t.room, text: 'เลขมิเตอร์ครั้งนี้น้อยกว่าครั้งก่อน (คิดเป็น 0 หน่วย)' });
    out.list.push({ t, ex, items, waterUnits: wu, elecUnits: eu, total: sumItems_(items) });
  });
  return out;
}

function api_previewBills(req) {
  const c = computeMonth_(String(req.month || ''));
  const sum = { rent: 0, water: 0, elec: 0, common: 0, other: 0, waterUnits: 0, elecUnits: 0 };
  c.list.forEach(x => {
    sum.waterUnits += x.waterUnits; sum.elecUnits += x.elecUnits;
    x.items.forEach(i => { sum[sum[i.k] !== undefined ? i.k : 'other'] += Number(i.a) || 0; });
  });
  return { preview: {
    count: c.list.length, total: round2_(c.list.reduce((a, x) => a + x.total, 0)), sum,
    updating: c.list.filter(x => x.ex).length, missing: c.missing, skipped: c.skipped, warnings: c.warnings,
  } };
}

function api_generateBills(req) {
  const month = String(req.month || ''), c = computeMonth_(month), s = getSettings_();
  const due = dueDate_(month, s.dueDay);
  const fresh = c.list.filter(x => !x.ex), nos = reserveNos_('invSeq', 'INV', fresh.length);
  let n = 0;
  c.list.forEach(x => {
    if (x.ex) {
      Object.assign(x.ex, { items: x.items, total: x.total, waterUnits: x.waterUnits, elecUnits: x.elecUnits, tenantName: x.t.name });
      writeBill_(x.ex);
    } else {
      newBill_(x.t, KIND.MONTH, month, x.items, due, { waterUnits: x.waterUnits, elecUnits: x.elecUnits, no: nos[n++] });
    }
  });
  return { result: { created: fresh.length, updated: c.list.length - fresh.length, missing: c.missing, skipped: c.skipped } };
}

/* ============================ บิลพิเศษ / แก้ไขบิล ============================ */

function api_createBill(req) {
  const t = activeTenant_(String(req.room || ''));
  if (!t) throw new Error('ห้องนี้ไม่มีผู้เช่า');
  const items = cleanItems_(req.items, true);
  if (!items.length) throw new Error('กรุณาใส่รายการอย่างน้อย 1 รายการ');
  const due = isDate_(req.dueDate) ? req.dueDate : addDays_(today_(), 7);
  const b = newBill_(t, KIND.SPECIAL, today_().slice(0, 7), items, due, { note: req.note || '' });
  return { billId: b.id };
}

function api_updateBill(req) {
  const b = billById_(req.id);
  if (b.status === ST.PAID) throw new Error('บิลที่ชำระแล้วแก้ไขไม่ได้');
  if (req.items) {
    const keepAuto = b.kind === KIND.MONTH;
    b.items = cleanItems_(req.items, !keepAuto);
    if (!b.items.length) throw new Error('บิลต้องมีอย่างน้อย 1 รายการ');
    b.total = sumItems_(b.items);
  }
  if (isDate_(req.dueDate)) b.dueDate = req.dueDate;
  if (req.note !== undefined) b.note = req.note;
  writeBill_(b);
}

function api_deleteBill(req) {
  const b = billById_(req.id);
  if (b.status === ST.PAID) throw new Error('บิลที่ชำระแล้วลบไม่ได้ (ยกเลิกการรับเงินก่อน)');
  deleteRow_('Bills', b._row);
}

/* ============================ รับเงิน ============================ */

function api_approveSlip(req) {
  const b = billById_(req.id);
  if (b.status !== ST.REVIEW) throw new Error('บิลนี้ไม่ได้รออนุมัติ');
  markPaid_(b, PAY.TRANSFER, b.total, today_());
  setSlipResult_(b.slipId, 'อนุมัติ');
}

function api_rejectSlip(req) {
  const b = billById_(req.id);
  if (b.status !== ST.REVIEW) throw new Error('บิลนี้ไม่ได้รออนุมัติ');
  b.status = ST.DUE; b.rejectReason = String(req.reason || 'สลิปไม่ถูกต้อง').slice(0, 300); b.rejectedAt = now_();
  writeBill_(b);
  setSlipResult_(b.slipId, 'ไม่อนุมัติ');
}

function api_receiveCash(req) {
  const b = billById_(req.id);
  if (b.status === ST.PAID) throw new Error('บิลนี้ชำระแล้ว');
  const got = has_(req.received) ? Number(req.received) : b.total;
  if (got < b.total) throw new Error('รับเงินน้อยกว่ายอดบิล');
  markPaid_(b, PAY.CASH, b.total, isDate_(req.paidDate) ? req.paidDate : today_(), got);
}

/** บันทึกรับเงินโดยเจ้าของหอ: โอน / เงินสด / หักเงินมัดจำ · แนบรูปสลิปได้ (ไม่บังคับ) */
function api_recordPayment(req) {
  const b = billById_(req.id);
  if (b.status === ST.PAID) throw new Error('บิลนี้ชำระแล้ว');
  const method = [PAY.TRANSFER, PAY.CASH, PAY.DEPOSIT].indexOf(req.method) >= 0 ? req.method : PAY.TRANSFER;
  const got = has_(req.amount) ? Number(req.amount) : b.total;
  if (!(got >= b.total)) throw new Error('ยอดที่รับ (' + fmtNum_(got) + ') น้อยกว่ายอดบิล (' + fmtNum_(b.total) + ')');
  let dup = '';
  if (req.image) {
    const up = saveImage_(req.image, 'สลิป_' + b.room + '_' + (b.no || b.id));
    const d = readAll_('Slips').filter(x => x.hash === up.hash)[0];
    if (d) dup = 'ซ้ำกับสลิปห้อง ' + d.room + ' (' + d.at.slice(0, 10) + ')';
    if (b.status === ST.REVIEW && b.slipId) setSlipResult_(b.slipId, 'แทนที่ด้วยการบันทึกของเจ้าของหอ');
    const slip = { id: 'S' + Date.now().toString(36) + rand_(3), billId: b.id, room: b.room, at: now_(), fileId: up.fileId, hash: up.hash, result: dup || 'บันทึกโดยเจ้าของหอ' };
    writeRow_('Slips', slip);
    b.slipId = slip.id; b.slipAt = slip.at;
  } else if (b.status === ST.REVIEW && b.slipId) {
    setSlipResult_(b.slipId, method === PAY.TRANSFER ? 'อนุมัติ' : 'แทนที่ด้วยการบันทึกของเจ้าของหอ');
  }
  const note = String(req.note || '').trim().slice(0, 200);
  markPaid_(b, method, b.total, isDate_(req.paidDate) ? req.paidDate : today_(), method === PAY.CASH ? got : null, note ? (b.note ? b.note + ' | ' : '') + note : '');
  return { dup: dup };
}

function api_unpay(req) {
  const b = billById_(req.id);
  if (b.status !== ST.PAID) throw new Error('บิลนี้ยังไม่ได้ชำระ');
  Object.assign(b, { status: ST.DUE, payMethod: '', paidAmount: '', received: '', paidDate: '', paidAt: '', receiptNo: '', note: (b.note ? b.note + ' | ' : '') + 'ยกเลิกใบเสร็จ ' + b.receiptNo });
  writeBill_(b);
}

function markPaid_(b, method, amount, date, received, note) {
  Object.assign(b, { status: ST.PAID, payMethod: method, paidAmount: amount, paidDate: date || today_(), rejectReason: '' });
  b.paidAt = b.paidDate === today_() ? now_() : b.paidDate + ' 12:00';
  if (received != null) b.received = received;
  if (note) b.note = note;
  if (!b.receiptNo) b.receiptNo = reserveNos_('rcSeq', 'RC', 1)[0];
  writeBill_(b);
}

function setSlipResult_(id, result) {
  const s = id && findBy_('Slips', 'id', id);
  if (s) { s.result = result; writeRow_('Slips', s, s._row); }
}

function api_fileImage(req) { return { image: fileDataUrl_(String(req.fileId || '')) }; }

/* ============================ เอกสาร / รูปของห้อง (สัญญา บัตร รูปห้อง) ============================ */
const DOC_CATS = ['สัญญาเช่า', 'เอกสารผู้เช่า', 'รูปห้องตอนเข้า', 'รูปห้องตอนออก', 'อื่นๆ'];
function api_uploadDoc(req) {
  const room = String(req.room || '').trim();
  if (!findBy_('Rooms', 'room', room)) throw new Error('ไม่พบห้อง ' + room);
  const m = String(req.data || '').match(/^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/);
  if (!m) throw new Error('ไฟล์ไม่ถูกต้อง');
  if (!/^image\/(jpeg|png|webp|heic|heif)$|^application\/pdf$/.test(m[1])) throw new Error('รองรับเฉพาะรูปภาพ และไฟล์ PDF');
  if (m[2].length > 14 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 10 MB');
  const t = req.tenantId ? findBy_('Tenants', 'id', String(req.tenantId)) : activeTenant_(room);
  const cat = DOC_CATS.indexOf(req.category) >= 0 ? req.category : 'อื่นๆ';
  const name = String(req.name || cat).replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'ห้อง' + room + '_' + cat + '_' + name);
  const fileId = fileFolder_().createFile(blob).getId();
  const doc = { id: 'D' + Date.now().toString(36) + rand_(3), createdAt: now_(), room, tenantId: t ? t.id : '', category: cat, name, mime: m[1],
    fileId, size: Math.round(m[2].length * 0.75), note: String(req.note || '').slice(0, 200) };
  writeRow_('Files', doc);
  return { id: doc.id };
}
function api_updateDoc(req) {
  const d = findBy_('Files', 'id', String(req.id || ''));
  if (!d) throw new Error('ไม่พบไฟล์');
  if (req.category !== undefined && DOC_CATS.indexOf(req.category) >= 0) d.category = req.category;
  if (req.note !== undefined) d.note = String(req.note).slice(0, 200);
  if (req.name !== undefined && String(req.name).trim()) d.name = String(req.name).trim().slice(0, 100);
  writeRow_('Files', d, d._row);
}
function api_deleteDoc(req) {
  const d = findBy_('Files', 'id', String(req.id || ''));
  if (!d) return;
  try { DriveApp.getFileById(d.fileId).setTrashed(true); } catch (e) { /* ไฟล์ถูกลบไปแล้ว */ }
  deleteRow_('Files', d._row);
}

/* ============================ แจ้งซ่อม & ประกาศ ============================ */

function api_saveRepair(req) {
  const p = req.repair || {};
  const r = findBy_('Repairs', 'id', String(p.id || ''));
  if (!r) throw new Error('ไม่พบรายการแจ้งซ่อม');
  const before = { status: r.status, ownerMsg: r.ownerMsg };
  if (p.status !== undefined && [ST.R_NEW, ST.R_DOING, ST.R_DONE, ST.R_BROKEN].indexOf(p.status) < 0) throw new Error('สถานะไม่ถูกต้อง');
  ['status', 'ownerMsg', 'cost', 'appointAt', 'outcome'].forEach(k => { if (p[k] !== undefined) r[k] = String(p[k]).slice(0, 300); });
  if (p.urgent !== undefined) r.urgent = p.urgent ? 'ด่วน' : '';
  if (r.status !== before.status || r.ownerMsg !== before.ownerMsg) {
    const log = parseLog_(r);
    log.push({ at: now_(), s: r.status, m: r.ownerMsg !== before.ownerMsg ? r.ownerMsg : '' });
    r.log = JSON.stringify(log);
  }
  if (p.charge) chargeRepair_(r);
  r.updatedAt = now_();
  writeRow_('Repairs', r, r._row);
}

/** ออกบิลเก็บผู้เช่า: ค่าซ่อม หรือ ค่าเสียหาย (กรณีของเสียหาย/ซ่อมไม่ได้) */
function chargeRepair_(r) {
  if (!(Number(r.cost) > 0) || r.billId) return;
  const t = activeTenant_(r.room);
  if (!t) throw new Error('ห้องนี้ไม่มีผู้เช่าแล้ว ออกบิลเก็บเงินไม่ได้');
  const what = r.status === ST.R_BROKEN ? 'ค่าเสียหาย' : 'ค่าซ่อม';
  const log = parseLog_(r); log.push({ at: now_(), s: r.status, m: 'ออกบิล' + what + ' ' + fmtNum_(r.cost) + ' บาท' }); r.log = JSON.stringify(log);
  r.billId = newBill_(t, KIND.SPECIAL, today_().slice(0, 7), [{ l: what + ': ' + r.category + ' (' + r.detail.slice(0, 30) + ')', a: Number(r.cost), c: 1 }], addDays_(today_(), 7)).id;
}

/** เจ้าของหอบันทึกแจ้งซ่อมเอง (ผู้เช่าโทร/LINE/มาบอก หรือเจ้าของพบเอง) */
function api_createRepair(req) {
  const p = req.repair || {}, room = String(p.room || '').trim();
  if (!findBy_('Rooms', 'room', room)) throw new Error('ไม่พบห้อง ' + room);
  const detail = String(p.detail || '').trim();
  if (!detail) throw new Error('กรุณาใส่รายละเอียด');
  const t = activeTenant_(room);
  let photoId = '';
  if (p.image) photoId = saveImage_(p.image, 'แจ้งซ่อม_' + room).fileId;
  const status = [ST.R_NEW, ST.R_DOING, ST.R_DONE, ST.R_BROKEN].indexOf(p.status) >= 0 ? p.status : ST.R_NEW;
  const r = {
    id: 'R' + Date.now().toString(36) + rand_(2), createdAt: now_(), room: room, tenantId: t ? t.id : '', name: t ? t.name : '',
    phone: t ? t.phone : '', category: String(p.category || 'อื่นๆ').slice(0, 40), detail: detail.slice(0, 1000), photoId: photoId,
    allowEntry: p.allowEntry ? 'ได้' : 'ไม่ได้', status: status, ownerMsg: String(p.ownerMsg || '').slice(0, 300), cost: '', billId: '', updatedAt: now_(),
    source: String(p.source || 'เจ้าของบันทึก').slice(0, 30), urgent: p.urgent ? 'ด่วน' : '', appointAt: String(p.appointAt || '').slice(0, 20),
    outcome: status === ST.R_BROKEN ? String(p.outcome || '').slice(0, 60) : '',
  };
  if (has_(p.cost) && Number(p.cost) > 0) r.cost = Number(p.cost);
  r.log = JSON.stringify([{ at: r.createdAt, s: status, m: 'บันทึกโดยเจ้าของหอ (' + r.source + ')' }]);
  if (p.charge) chargeRepair_(r);
  writeRow_('Repairs', r);
  return { id: r.id };
}

function api_postNews(req) {
  const title = String(req.title || '').trim();
  if (!title) throw new Error('กรุณาใส่หัวข้อประกาศ');
  writeRow_('News', { id: 'N' + Date.now().toString(36), createdAt: now_(), title: title.slice(0, 120), body: String(req.body || '').slice(0, 1000) });
}

function api_deleteNews(req) {
  const n = findBy_('News', 'id', String(req.id || ''));
  if (n) deleteRow_('News', n._row);
}

/* ============================ ตั้งค่า ============================ */

function api_saveSettings(req) {
  const p = req.settings || {}, rows = readAll_('Settings');
  DEFAULT_SETTINGS.forEach(d => {
    const k = d[0];
    if (p[k] === undefined || k === 'invSeq' || k === 'rcSeq' || k === 'fileFolderId') return;
    if ((k === 'adminPassword' || k === 'lineToken') && String(p[k]) === '') return;
    if (k === 'adminPassword' && String(p[k]).length < 4) throw new Error('รหัสผ่านต้องยาวอย่างน้อย 4 ตัว');
    if (k === 'tenantMode' && ['shared', 'owner'].indexOf(String(p[k])) < 0) return;
    if (/^(tenantApp|tenantSlip|tenantRepair|tenantNews|billLink)$/.test(k)) p[k] = (p[k] === true || String(p[k]) === '1') ? '1' : '0';
    const ex = rows.filter(r => r.key === k)[0];
    writeRow_('Settings', { key: k, value: String(p[k]).trim(), description: d[2] }, ex && ex._row);
  });
}

function api_testLine() {
  if (!pushLine_('✅ ทดสอบแจ้งเตือนจากระบบ ' + getSettings_().apartmentName)) throw new Error('ส่ง LINE ไม่สำเร็จ — ตรวจสอบ token และ Group ID');
}

/* ============================ ฝั่งผู้เช่า ============================ */

function tenantView_(t) {
  const bills = bills_().filter(b => b.tenantId === t.id).map(cleanBill_).sort(billSort_);
  const ids = new Set(bills.map(b => b.id));
  const slips = readAll_('Slips').filter(x => ids.has(x.billId)).map(x => ({ id: x.id, billId: x.billId, at: x.at, result: x.result }));
  const repairs = readAll_('Repairs').filter(r => r.tenantId ? r.tenantId === t.id : (r.room === t.room && r.createdAt.slice(0, 10) >= t.startDate))
    .map(r => { const o = strip_(r); delete o.tenantId; if (!o.billId) o.cost = ''; o.log = parseLog_(r); return o; })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const news = !tenantFlags_().news ? [] : readAll_('News').map(strip_).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20);
  const room = findBy_('Rooms', 'room', t.room) || {};
  return {
    tenant: { id: t.id, room: t.room, name: t.name, phone: t.phone, startDate: t.startDate, endDate: t.endDate,
              deposit: t.deposit, rent: room.rent, type: room.type },
    bills, slips, repairs, news, info: publicSettings_(), serverToday: today_(), serverNow: now_(),
  };
}

function api_tenantSlip(req, t) {
  const b = bills_().filter(x => x.id === String(req.billId || '') && x.tenantId === t.id)[0];
  if (!b) throw new Error('ไม่พบบิล');
  if (b.status === ST.PAID) throw new Error('บิลนี้ชำระแล้ว');
  const up = saveImage_(req.image, 'สลิป_' + b.room + '_' + (b.no || b.id));
  const dup = readAll_('Slips').filter(x => x.hash === up.hash)[0];
  const slip = { id: 'S' + Date.now().toString(36) + rand_(3), billId: b.id, room: b.room, at: now_(), fileId: up.fileId, hash: up.hash,
                 result: dup ? 'ซ้ำกับสลิปห้อง ' + dup.room + ' (' + dup.at.slice(0, 10) + ')' : 'รอตรวจ' };
  writeRow_('Slips', slip);
  Object.assign(b, { status: ST.REVIEW, slipId: slip.id, slipAt: slip.at, rejectReason: '' });
  writeBill_(b);
  pushLine_('💰 ห้อง ' + b.room + ' ส่งสลิป ' + billTitle_(b) + ' ยอด ' + fmtNum_(b.total) + ' บาท' + (dup ? '\n⚠️ สลิปซ้ำกับที่เคยส่ง' : '') + '\nกดอนุมัติในระบบเจ้าของหอ');
  return {};
}

function api_tenantRepair(req, t) {
  const detail = String(req.detail || '').trim();
  if (!detail) throw new Error('กรุณาใส่รายละเอียด');
  let photoId = '';
  if (req.image) photoId = saveImage_(req.image, 'แจ้งซ่อม_' + t.room).fileId;
  const r = {
    id: 'R' + Date.now().toString(36) + rand_(2), createdAt: now_(), room: t.room, tenantId: t.id, name: t.name,
    phone: String(req.phone || t.phone || '').slice(0, 30), category: String(req.category || 'อื่นๆ').slice(0, 40),
    detail: detail.slice(0, 1000), photoId, allowEntry: req.allowEntry ? 'ได้' : 'ไม่ได้', status: ST.R_NEW,
    ownerMsg: '', cost: '', billId: '', updatedAt: now_(),
  };
  r.log = JSON.stringify([{ at: r.createdAt, s: ST.R_NEW, m: '' }]);
  writeRow_('Repairs', r);
  pushLine_('🔧 แจ้งซ่อม ห้อง ' + t.room + ' (' + r.category + ')\n' + r.detail + '\nโทร ' + r.phone);
  return {};
}

function api_tenantFile(req, t) {
  let id = String(req.fileId || '');
  if (req.slipId) { const s = findBy_('Slips', 'id', String(req.slipId)); id = s ? s.fileId : ''; }
  const mine = new Set(bills_().filter(b => b.tenantId === t.id).map(b => b.id));
  const ok = readAll_('Slips').some(x => x.fileId === id && mine.has(x.billId)) ||
    readAll_('Repairs').some(r => r.photoId === id && r.tenantId === t.id);
  if (!ok) throw new Error('ไม่มีสิทธิ์ดูไฟล์นี้');
  return { image: fileDataUrl_(id) };
}

/* ============================ ข้อมูลรวม (เจ้าของหอ) ============================ */

/* ============================ ค่าใช้จ่ายของตึก ============================ */
function api_saveExpense(req) {
  const e = req.id ? findBy_('Expenses', 'id', String(req.id)) : null;
  if (req.id && !e) throw new Error('ไม่พบรายการ');
  const amount = Number(req.amount);
  if (!(amount > 0)) throw new Error('กรุณาใส่จำนวนเงิน');
  const cat = String(req.category || '').trim().slice(0, 60);
  if (!cat) throw new Error('กรุณาเลือกประเภทค่าใช้จ่าย');
  const o = e || { id: 'E' + Date.now().toString(36) + rand_(3), files: '[]', createdAt: now_() };
  o.date = isDate_(req.date) ? req.date : today_(); o.category = cat; o.amount = round2_(amount); o.note = String(req.note || '').slice(0, 300);
  writeRow_('Expenses', o, e && e._row);
  return { id: o.id };
}
function api_addExpenseFile(req) {
  const e = findBy_('Expenses', 'id', String(req.id || ''));
  if (!e) throw new Error('ไม่พบรายการ');
  const m = String(req.data || '').match(/^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/);
  if (!m || !/^image\/(jpeg|png|webp|heic|heif)$|^application\/pdf$/.test(m[1])) throw new Error('รองรับเฉพาะรูปภาพ และไฟล์ PDF');
  if (m[2].length > 14 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 10 MB');
  const name = String(req.name || 'ไฟล์').replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
  const fileId = fileFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'ค่าใช้จ่าย_' + e.date + '_' + e.category + '_' + name)).getId();
  const files = parseJson_(e.files); files.push({ fileId, name, mime: m[1], size: Math.round(m[2].length * 0.75) });
  e.files = JSON.stringify(files); writeRow_('Expenses', e, e._row);
}
function api_removeExpenseFile(req) {
  const e = findBy_('Expenses', 'id', String(req.id || ''));
  if (!e) throw new Error('ไม่พบรายการ');
  const files = parseJson_(e.files); trashFile_(req.fileId);
  e.files = JSON.stringify(files.filter(f => f.fileId !== req.fileId)); writeRow_('Expenses', e, e._row);
}
function api_deleteExpense(req) {
  const e = findBy_('Expenses', 'id', String(req.id || ''));
  if (!e) return;
  parseJson_(e.files).forEach(f => trashFile_(f.fileId));
  deleteRow_('Expenses', e._row);
}

/* ============================ ล้างข้อมูล (ก่อนเริ่มใช้จริง / ทีละห้อง) ============================ */
function billDate_(b) { return b.kind === KIND.MONTH && b.month ? b.month + '-01' : String(b.paidDate || b.createdAt || '').slice(0, 10); }
function api_clearData(req) {
  const cut = isDate_(req.before) ? req.before : '';
  if (!cut) throw new Error('กรุณาเลือกวันที่');
  const n = { bills: 0, repairs: 0, expenses: 0 };
  if (req.bills) {
    const all = bills_(), del = {};
    all.forEach(b => { if (billDate_(b) < cut) del[b.id] = 1; });
    // คงค่าเช่าล่วงหน้าที่เหลือของผู้เช่าไว้เท่าเดิม แม้บิลที่เคยหักไปถูกลบ
    readAll_('Tenants').forEach(t => {
      if (!(Number(t.advanceRent) > 0)) return;
      const left = advanceLeft_(t, all), keptUse = advanceLeft_(Object.assign({}, t, { advanceRent: 1e12 }), all.filter(b => !del[b.id]));
      const na = round2_(left + (1e12 - keptUse));
      if (na !== Number(t.advanceRent)) { t.advanceRent = na; writeRow_('Tenants', t, t._row); }
    });
    n.bills = keepRows_('Bills', b => !del[b.id]);
    keepRows_('Slips', x => !del[x.billId]);
    if (!readAll_('Bills').length) setSetting_('invSeq', '0'), setSetting_('rcSeq', '0');
  }
  if (req.repairs) n.repairs = keepRows_('Repairs', r => String(r.createdAt).slice(0, 10) >= cut);
  if (req.expenses) {
    readAll_('Expenses').filter(e => e.date < cut).forEach(e => parseJson_(e.files).forEach(f => trashFile_(f.fileId)));
    n.expenses = keepRows_('Expenses', e => e.date >= cut);
  }
  return { result: n };
}
function api_resetRoom(req) {
  const room = String(req.room || '');
  const r = findBy_('Rooms', 'room', room);
  if (!r) throw new Error('ไม่พบห้อง');
  const tids = {}; readAll_('Tenants').forEach(t => { if (t.room === room) tids[t.id] = 1; });
  const billIds = {}; bills_().forEach(b => { if (b.room === room) billIds[b.id] = 1; });
  const n = { tenants: Object.keys(tids).length, bills: Object.keys(billIds).length, docs: 0 };
  keepRows_('Tenants', t => t.room !== room);
  keepRows_('Bills', b => !billIds[b.id]);
  keepRows_('Slips', x => !billIds[x.billId] && x.room !== room);
  if (req.docs) { readAll_('Files').filter(d => d.room === room).forEach(d => { trashFile_(d.fileId); n.docs++; }); keepRows_('Files', d => d.room !== room); }
  if (req.repairs) keepRows_('Repairs', x => x.room !== room);
  r.status = ST.VAC; writeRow_('Rooms', r, r._row);
  return { result: n };
}
function setSetting_(key, value) {
  const row = readAll_('Settings').filter(r => r.key === key)[0];
  const d = DEFAULT_SETTINGS.filter(x => x[0] === key)[0];
  writeRow_('Settings', { key, value, description: row ? row.description : (d ? d[2] : '') }, row && row._row);
}

function allData_() {
  const s = getSettings_(), settings = {};
  DEFAULT_SETTINGS.forEach(d => { if (PRIVATE_SETTINGS.indexOf(d[0]) < 0) settings[d[0]] = s[d[0]]; });
  settings.lineConfigured = !!(s.lineToken && s.lineGroupId);
  settings.flags = tenantFlags_(s);
  return {
    settings,
    rooms: readAll_('Rooms').map(strip_).sort((a, b) => roomSort_(a.room, b.room)),
    tenants: readAll_('Tenants').map(strip_),
    meters: readAll_('Meters').map(strip_),
    bills: bills_().map(b => { const o = strip_(b); return o; }).sort(billSort_),
    slips: readAll_('Slips').map(x => { const o = strip_(x); delete o.hash; return o; }),
    repairs: readAll_('Repairs').map(r => { const o = strip_(r); o.log = parseLog_(r); return o; }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    news: readAll_('News').map(strip_).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    docs: readAll_('Files').map(strip_).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    expenses: readAll_('Expenses').map(x => { const o = strip_(x); o.files = parseJson_(x.files); return o; }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    serverToday: today_(), serverNow: now_(),
  };
}

function publicSettings_() {
  const s = getSettings_();
  const keys = ['apartmentName', 'address', 'phone', 'ownerLine', 'promptpay', 'bankInfo', 'cashInfo', 'dueDay', 'waterRate', 'elecRate', 'commonFee'];
  const o = {};
  keys.forEach(k => { o[k] = s[k]; });
  o.flags = tenantFlags_(s);
  return o;
}

/* ============================ แจ้งเตือน LINE ============================ */

function pushLine_(text) {
  const s = getSettings_();
  if (!s.lineToken || !s.lineGroupId) return false;
  try {
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + s.lineToken },
      payload: JSON.stringify({ to: s.lineGroupId, messages: [{ type: 'text', text: String(text).slice(0, 4900) }] }),
    });
    return res.getResponseCode() === 200;
  } catch (e) { return false; }
}

function dailyCheck() {
  const today = today_(), in30 = addDays_(today, 30), all = bills_();
  const review = all.filter(b => b.status === ST.REVIEW);
  const overdue = all.filter(b => b.status === ST.DUE && b.dueDate < today);
  const exp = readAll_('Tenants').filter(t => t.status === ST.ACTIVE && t.endDate && t.endDate <= in30);
  const reps = readAll_('Repairs').filter(r => r.status === ST.R_NEW || r.status === ST.R_DOING);
  if (!review.length && !overdue.length && !exp.length && !reps.length) return;
  const L = ['📋 สรุปประจำวัน ' + getSettings_().apartmentName];
  if (review.length) L.push('🧾 สลิปรออนุมัติ ' + review.length + ' รายการ');
  if (overdue.length) {
    L.push('⏰ เกินกำหนด ' + overdue.length + ' บิล รวม ' + fmtNum_(overdue.reduce((a, b) => a + Number(b.total), 0)) + ' บาท');
    overdue.slice(0, 15).forEach(b => L.push('  • ห้อง ' + b.room + ' ' + billTitle_(b) + ' ' + fmtNum_(b.total)));
  }
  if (exp.length) L.push('📄 สัญญาใกล้หมด: ' + exp.map(t => t.room + ' (' + t.endDate + ')').join(', '));
  if (reps.length) L.push('🔧 งานซ่อมค้าง ' + reps.length + ' งาน');
  pushLine_(L.join('\n'));
}

/* ============================ ตัวช่วยเรื่องบิล ============================ */

function bills_() {
  return readAll_('Bills').map(b => { try { b.items = JSON.parse(b.items || '[]'); } catch (e) { b.items = []; } return b; });
}
function billById_(id) {
  const b = bills_().filter(x => x.id === String(id || ''))[0];
  if (!b) throw new Error('ไม่พบบิล');
  return b;
}
function writeBill_(b) { writeRow_('Bills', Object.assign({}, b, { items: JSON.stringify(b.items || []) }), b._row); }
function newBill_(t, kind, month, items, dueDate, extra) {
  const b = Object.assign({
    id: 'B' + Date.now().toString(36) + rand_(4), token: Utilities.getUuid().replace(/-/g, ''),
    kind, month, room: t.room, tenantId: t.id, tenantName: t.name, items, waterUnits: '', elecUnits: '',
    dueDate, status: ST.DUE, createdAt: now_(),
  }, extra || {});
  if (!b.no) b.no = reserveNos_('invSeq', 'INV', 1)[0];
  b.total = sumItems_(b.items);
  writeBill_(b);
  b._row = sheet_('Bills').getLastRow();
  return b;
}
function cleanBill_(b) { const o = strip_(b); delete o.tenantId; return o; }
function cleanItems_(items, custom) {
  return (items || []).map(i => {
    const o = { l: String(i.l || '').trim().slice(0, 120), a: round2_(Number(i.a) || 0) };
    if (i.k) o.k = i.k;
    if (custom || i.c || !i.k) o.c = 1;
    return o;
  }).filter(i => i.l && (i.a !== 0 || i.k));
}
function sumItems_(items) { return round2_((items || []).reduce((a, i) => a + (Number(i.a) || 0), 0)); }
function billSort_(a, b) { return (b.createdAt || '').localeCompare(a.createdAt || '') || roomSort_(a.room, b.room); }
function billTitle_(b) { return b.kind === KIND.MONTH ? 'บิลเดือน ' + monthLabel_(b.month) : 'บิล' + b.kind + ' ' + (b.no || ''); }
/** ค่าเช่าล่วงหน้าคงเหลือ (เงินที่จ่ายตอนเข้า ใช้หักค่าเช่าเดือนแรก ๆ) ไม่นับบิล exceptId */
function advanceLeft_(t, bills, exceptId) {
  const used = bills.filter(b => b.tenantId === t.id && b.id !== exceptId)
    .reduce((a, b) => a + (b.items || []).filter(i => i.k === 'advuse').reduce((x, i) => x - Number(i.a || 0), 0), 0);
  return Math.max(0, round2_((Number(t.advanceRent) || 0) - used));
}
function applyAdvance_(t, items, bills, exceptId) {
  const rent = items.filter(i => i.k === 'rent').reduce((a, i) => a + Number(i.a || 0), 0), left = advanceLeft_(t, bills, exceptId);
  const use = Math.min(left, rent);
  if (use > 0) items.push({ l: 'หักค่าเช่าล่วงหน้า (จ่ายไว้ตอนเข้า)', a: -use, k: 'advuse' });
}
function rentItem_(rent, from, to) {
  const days = dayDiff_(from, to) + 1, dim = daysInMonth_(from.slice(0, 7));
  if (days >= dim) return { l: 'ค่าเช่าห้อง ' + monthLabel_(from.slice(0, 7)), a: rent, k: 'rent' };
  const f = Number(from.slice(8)), tt = Number(to.slice(8)), m = TH_MS[Number(from.slice(5, 7)) - 1];
  return { l: 'ค่าเช่าห้อง ' + f + '–' + tt + ' ' + m + ' (' + days + ' วัน)', a: partRent_(rent, days, dim), k: 'rent' };
}
// ค่าเช่าเดือนที่อยู่ไม่เต็มเดือน: ตั้งค่ารายวันไว้ = ค่าเช่า − (วันที่ไม่ได้อยู่ × ค่ารายวัน) · ไม่ตั้ง = ตามสัดส่วนวัน
function partRent_(rent, days, dim) {
  const daily = Number(getSettings_().dailyRate) || 0;
  if (days >= dim) return rent;
  return daily > 0 ? Math.max(0, Math.min(rent, Math.round(rent - (dim - days) * daily))) : Math.round(rent * days / dim);
}
// ค่าเช่าล่วงหน้าตอนเข้า: เข้ากลางเดือน = ค่าเช่าของวันที่เหลือในเดือนนั้น (+ เดือนถัดไปถ้าตั้งไว้มากกว่า 1 เดือน)
function firstAdvance_(rent, start, months) {
  const month = start.slice(0, 7), first = rentItem_(rent, start, monthEnd_(month)), part = first.a !== rent || Number(start.slice(8)) > 1;
  const a = round2_(first.a + rent * Math.max(0, months - 1));
  const l = part ? 'ค่าเช่าล่วงหน้า ' + first.l.replace('ค่าเช่าห้อง ', '') + (months > 1 ? ' + ' + (months - 1) + ' เดือน' : '') : 'ค่าเช่าล่วงหน้า ' + months + ' เดือน';
  return { a, l };
}
function utilItem_(k, units, prev, cur, s) {
  const rate = Number(s[k + 'Rate']) || 0, min = Number(s[k + 'Min']) || 0;
  return { l: (k === 'water' ? 'ค่าน้ำ ' : 'ค่าไฟ ') + units + ' หน่วย (' + prev + '→' + cur + ')', a: round2_(Math.max(units * rate, min)), k };
}
function prevReading_(room, month, meters) {
  const rec = meters.filter(m => m.month === month && m.room === room)[0];
  const earlier = meters.filter(m => m.room === room && m.month < month).sort((a, b) => b.month.localeCompare(a.month));
  const pick = k => {
    if (rec && rec[k + 'Prev'] !== '') return rec[k + 'Prev'];
    for (const m of earlier) { if (m[k + 'Cur'] !== '') return m[k + 'Cur']; if (m[k + 'Prev'] !== '') return m[k + 'Prev']; }
    return '';
  };
  return { water: pick('water'), elec: pick('elec') };
}
function reserveNos_(key, prefix, n) {
  if (!n) return [];
  const rows = readAll_('Settings'), row = rows.filter(r => r.key === key)[0];
  const cur = Number(row && row.value) || 0, yy = Number(today_().slice(0, 4)) + 543, out = [];
  for (let i = 1; i <= n; i++) out.push(prefix + '-' + yy + '-' + ('000' + (cur + i)).slice(-Math.max(4, String(cur + i).length)));
  writeRow_('Settings', { key, value: String(cur + n), description: row ? row.description : '' }, row && row._row);
  return out;
}

/* ============================ ไฟล์รูป (Google Drive) ============================ */

function saveImage_(dataUrl, name) {
  const m = String(dataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) throw new Error('ไฟล์รูปไม่ถูกต้อง');
  if (m[2].length > 6 * 1024 * 1024) throw new Error('รูปใหญ่เกินไป');
  const bytes = Utilities.base64Decode(m[2]);
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)
    .map(x => ((x < 0 ? x + 256 : x).toString(16)).padStart(2, '0')).join('');
  const blob = Utilities.newBlob(bytes, m[1], name + '_' + Utilities.formatDate(new Date(), tz_(), 'yyMMdd-HHmmss') + (m[1] === 'image/png' ? '.png' : '.jpg'));
  return { fileId: fileFolder_().createFile(blob).getId(), hash };
}
function fileDataUrl_(id) {
  if (!id) throw new Error('ไม่พบไฟล์');
  const blob = DriveApp.getFileById(id).getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}
function fileFolder_() {
  const id = getSettings_().fileFolderId;
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* ถูกลบไป สร้างใหม่ */ } }
  const name = 'ไฟล์ระบบอพาร์ทเม้นท์ (สลิป-แจ้งซ่อม)';
  const it = DriveApp.getFoldersByName(name);
  const f = it.hasNext() ? it.next() : DriveApp.createFolder(name);
  const row = readAll_('Settings').filter(r => r.key === 'fileFolderId')[0];
  writeRow_('Settings', { key: 'fileFolderId', value: f.getId(), description: '(ระบบ) โฟลเดอร์ Google Drive ที่เก็บรูปสลิป/รูปแจ้งซ่อม' }, row && row._row);
  return f;
}

/* ============================ Sheet helpers ============================ */

function getSettings_() {
  const s = {};
  DEFAULT_SETTINGS.forEach(d => { s[d[0]] = d[1]; });
  try { sheet_('Settings'); } catch (e) { throw new Error('ยังไม่ได้ติดตั้ง — กรุณารันฟังก์ชัน setup ใน Apps Script'); }
  readAll_('Settings').forEach(r => { if (r.key) s[r.key] = String(r.value); });
  return s;
}
function activeTenant_(room) { return readAll_('Tenants').filter(t => t.room === room && t.status === ST.ACTIVE)[0]; }
// อ่านชีตแต่ละชีตครั้งเดียวต่อคำสั่ง (เร็วขึ้นมาก) · เขียนแล้วล้างแคชของชีตนั้น
let MEMO = {};
function deleteRow_(name, row) { sheet_(name).deleteRow(row); dropCache_(name); }

/* ---- แคชข้อมูลชีตใน CacheService: อ่านเร็วกว่าอ่านจากชีตหลายเท่า ---- */
const CACHE_TTL = 21600, CHUNK = 30000;
function prefetch_() {
  try {
    const c = CacheService.getScriptCache(), names = Object.keys(SCHEMA);
    const head = c.getAll(names.map(n => 'sv:' + n).concat(names.map(n => 'gen:' + n)));
    const keys = [], ok = {};
    names.forEach(n => {
      const m = String(head['sv:' + n] || '').split('|'), gen = head['gen:' + n] || '0';
      MEMO['g:' + n] = gen;
      if (m.length === 2 && m[0] === gen) { ok[n] = +m[1]; for (let i = 0; i < ok[n]; i++) keys.push('sv:' + n + ':' + i); }
    });
    const parts = keys.length ? c.getAll(keys) : {};
    Object.keys(ok).forEach(n => {
      let str = '';
      for (let i = 0; i < ok[n]; i++) { const p = parts['sv:' + n + ':' + i]; if (p == null) return; str += p; }
      try { MEMO['v:' + n] = JSON.parse(str); } catch (e) {}
    });
  } catch (e) {}
}
function cachePut_(name, vals) {
  try {
    const str = JSON.stringify(vals), o = {};
    let n = 0;
    for (let i = 0; i < str.length; i += CHUNK) o['sv:' + name + ':' + (n++)] = str.slice(i, i + CHUNK);
    if (n > 60) return;
    o['sv:' + name] = (MEMO['g:' + name] || '0') + '|' + n;
    CacheService.getScriptCache().putAll(o, CACHE_TTL);
  } catch (e) {}
}
function dropCache_(name) {
  delete MEMO['v:' + name];
  const g = String(Date.now()) + rand_(3);
  MEMO['g:' + name] = g;
  try { CacheService.getScriptCache().put('gen:' + name, g, CACHE_TTL); } catch (e) {}
}
function parseJson_(v) { try { return JSON.parse(v || '[]') || []; } catch (e) { return []; } }
// เก็บเฉพาะแถวที่ต้องการ (ลบแถวอื่นทิ้งทีเดียว)
function keepRows_(name, keep) {
  const all = readAll_(name), kept = all.filter(keep);
  if (kept.length === all.length) return 0;
  const sh = sheet_(name), last = sh.getLastRow(), W = SCHEMA[name].length;
  if (last >= 2) sh.getRange(2, 1, last - 1, W).clearContent();
  if (kept.length) sh.getRange(2, 1, kept.length, W).setValues(kept.map(o => SCHEMA[name].map(h => toCell_(h, o[h]))));
  if (last > kept.length + 2) { try { sh.deleteRows(kept.length + 2, last - kept.length - 1); } catch (e) { /* แถวว่างเหลือไว้ได้ ไม่มีผล */ } }
  dropCache_(name);
  return all.length - kept.length;
}
function trashFile_(id) { if (!id) return; try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { /* ลบไปแล้ว */ } }
function parseLog_(r) { try { return JSON.parse(r.log || '[]'); } catch (e) { return []; } }
function sheet_(name) {
  if (MEMO['s:' + name]) return MEMO['s:' + name];
  let sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh && SCHEMA[name] && name !== 'Settings') { // ชีตที่เพิ่มในเวอร์ชันใหม่ สร้างให้อัตโนมัติ
    sh = SpreadsheetApp.getActive().insertSheet(name);
    sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]).setFontWeight('bold'); sh.setFrozenRows(1);
  }
  if (!sh) throw new Error('ไม่พบชีต ' + name + ' — กรุณารัน setup อีกครั้ง');
  MEMO['s:' + name] = sh;
  return sh;
}
function readAll_(name) {
  const H = SCHEMA[name];
  let vals = MEMO['v:' + name];
  if (!vals) {
    const sh = sheet_(name), last = sh.getLastRow();
    const raw = last < 2 ? [] : sh.getRange(2, 1, last - 1, H.length).getValues();
    vals = MEMO['v:' + name] = raw.map(r => r.map((v, j) => v instanceof Date ? norm_(H[j], v) : v));
    cachePut_(name, vals);
  }
  return vals.map((r, i) => {
    const o = { _row: i + 2 };
    H.forEach((h, j) => { o[h] = norm_(h, r[j]); });
    return o;
  }).filter(o => H.some(h => o[h] !== ''));
}
function norm_(key, v) {
  if (v instanceof Date) {
    if (key === 'month') return Utilities.formatDate(v, tz_(), 'yyyy-MM');
    if (/At$/.test(key)) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd HH:mm');
    return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  }
  if (v === '' || v == null) return '';
  if (NUM_KEYS.has(key)) return Number(v) || 0;
  return String(v);
}
function toCell_(key, v) {
  if (v === undefined || v === null || v === '') return '';
  if (NUM_KEYS.has(key)) return Number(v) || 0;
  return "'" + String(v); // บังคับเป็นข้อความ: กันเลข 0 หน้าเบอร์หาย / กันวันที่ถูกแปลง / กันสูตร
}
function writeRow_(name, obj, rowNum) {
  const row = SCHEMA[name].map(h => toCell_(h, obj[h])), sh = sheet_(name);
  sh.getRange(rowNum || sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  dropCache_(name);
}
function writeRows_(name, objs) {
  if (!objs.length) return;
  const sh = sheet_(name), rows = objs.map(o => SCHEMA[name].map(h => toCell_(h, o[h])));
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, SCHEMA[name].length).setValues(rows);
  dropCache_(name);
}
function findBy_(name, key, val) { return readAll_(name).filter(o => o[key] === val)[0]; }
function strip_(o) { const c = Object.assign({}, o); delete c._row; return c; }

/* ============================ Utils ============================ */

function tz_() { return Session.getScriptTimeZone() || 'Asia/Bangkok'; }
function today_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
function now_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm'); }
function pad2_(n) { return (n < 10 ? '0' : '') + n; }
function rand_(n) { return Math.random().toString(36).slice(2, 2 + n); }
function round2_(n) { return Math.round(Number(n) * 100) / 100; }
function has_(v) { return v !== '' && v !== null && v !== undefined && !isNaN(Number(v)); }
function fmtNum_(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function isDate_(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')); }
function checkPin_(p) {
  p = String(p).trim();
  if (!/^\d{4,8}$/.test(p)) throw new Error('รหัสผู้เช่าต้องเป็นตัวเลข 4–8 หลัก');
  return p;
}
function newPin_() { return String(Math.floor(100000 + Math.random() * 900000)); }
function guessFloor_(room) { const m = String(room).match(/^(\d+)\d\d$/); return m ? Number(m[1]) : ''; }
function roomSort_(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true }); }
function ymd_(d) { return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate()); }
function utc_(s) { return new Date(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10) || 1)); }
function addDays_(s, n) { const d = utc_(s); d.setUTCDate(d.getUTCDate() + n); return ymd_(d); }
function addMonths_(s, n) {
  const y = +s.slice(0, 4), m = +s.slice(5, 7) - 1 + n, d = +s.slice(8, 10);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return ymd_(new Date(Date.UTC(y, m, Math.min(d, last))));
}
function dayDiff_(a, b) { return Math.round((utc_(b) - utc_(a)) / 864e5); }
function daysInMonth_(month) { return new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).getUTCDate(); }
function monthEnd_(month) { return month + '-' + pad2_(daysInMonth_(month)); }
function monthLabel_(month) { return TH_MS[+month.slice(5, 7) - 1] + ' ' + String(+month.slice(0, 4) + 543).slice(2); }
function dueDate_(month, dueDay) {
  const next = addMonths_(month + '-01', 1).slice(0, 7);
  return next + '-' + pad2_(Math.min(Math.max(1, Number(dueDay) || 5), daysInMonth_(next)));
}
