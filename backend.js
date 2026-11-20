/******************************************************************
 * ระบบบริหารอพาร์ทเม้นท์ v2 — Backend (Google Apps Script + Google Sheet)
 *
 * ติดตั้ง: Google Sheet ใหม่ > ส่วนขยาย > Apps Script > ลบโค้ดเดิม
 *         > วางไฟล์นี้ทั้งหมด > Run "setup" > Deploy เป็น Web app
 *         (Execute as: Me, Who has access: Anyone)
 * ไฟล์นี้ใช้เป็นโหมดทดลองในเบราว์เซอร์ได้ด้วย (ไม่ต้องแก้)
 ******************************************************************/

const APP_VER = '6.3';
const SCHEMA = {
  Settings: ['key', 'value', 'description'],
  Rooms:    ['room', 'floor', 'type', 'rent', 'status', 'note',
             'bookName', 'bookPhone', 'bookAt', 'bookDeposit', 'bookNote', 'fixNote', 'fixSince', 'fixDue', 'fixLevel', 'items', 'cleanStatus', 'cleanNote', 'cleanSince', 'cleanLast',
             // ⚠️ คอลัมน์ใหม่ต้องต่อท้ายเท่านั้น ห้ามแทรกกลาง (ข้อมูลเดิมในชีตจะเลื่อนคอลัมน์)
             'bookNo', 'bookLang', 'bookSignMode', 'bookSigned', 'bookToken', 'bookIdCard', 'bookDocDate', 'bookBy'],
  Tenants:  ['id', 'room', 'name', 'phone', 'lineId', 'startDate', 'endDate', 'deposit',
             'status', 'moveOutDate', 'pin', 'note', 'createdAt',
             'advanceRent', 'keyDeposit', 'cardFee', 'contractMonths', 'refundAmount', 'refundStatus', 'refundDate',
             'idCard', 'idAddress', 'contractNo', 'docLang', 'signMode', 'signed', 'docToken', 'docHtml', 'docDate', 'createdBy'],
  Meters:   ['month', 'room', 'waterPrev', 'waterCur', 'elecPrev', 'elecCur', 'updatedAt'],
  Bills:    ['id', 'no', 'token', 'kind', 'month', 'room', 'tenantId', 'tenantName', 'items',
             'waterUnits', 'elecUnits', 'total', 'dueDate', 'status', 'createdAt',
             'slipId', 'slipAt', 'rejectReason', 'rejectedAt',
             'payMethod', 'paidAmount', 'received', 'paidDate', 'receiptNo', 'note', 'paidAt', 'title', 'payPhone', 'createdBy', 'paidBy'],
  Slips:    ['id', 'billId', 'room', 'at', 'fileId', 'hash', 'result'],
  Repairs:  ['id', 'createdAt', 'room', 'tenantId', 'name', 'phone', 'category', 'detail', 'photoId',
             'allowEntry', 'status', 'ownerMsg', 'cost', 'billId', 'updatedAt', 'log',
             'source', 'urgent', 'appointAt', 'outcome'],
  News:     ['id', 'createdAt', 'title', 'body'],
  Files:    ['id', 'createdAt', 'room', 'tenantId', 'category', 'name', 'mime', 'fileId', 'size', 'note', 'ref'],
  Expenses: ['id', 'date', 'category', 'amount', 'note', 'files', 'createdAt', 'createdBy'],
  Users:    ['id', 'name', 'role', 'pinHash', 'salt', 'active', 'createdAt', 'lastLogin'],
  AuditLog: ['at', 'userId', 'userName', 'action', 'detail'],
  Tasks:    ['id', 'createdAt', 'createdBy', 'title', 'category', 'room', 'assignee', 'status', 'dueAt', 'endAt', 'waitFor', 'followUp', 'remind', 'repeat', 'repairId', 'note', 'log', 'doneAt', 'doneBy', 'remindedAt', 'updatedAt'],
  ChatLog:  ['at', 'userId', 'name', 'text'],
  Viewings: ['id', 'createdAt', 'name', 'phone', 'at', 'note', 'lang', 'source', 'userId', 'lineName', 'status', 'updatedAt'],
  Signs:    ['kind', 'ref', 'who', 'name', 'at', 'img'],
  LineUsers: ['userId', 'room', 'tenantId', 'displayName', 'lang', 'createdAt', 'updatedAt'],
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
  ['dailyRate', '0', 'ค่าเช่ารายวัน (บาท/วัน) สำหรับเดือนที่เข้า-ออกไม่เต็มเดือน: จำนวนวันที่อยู่ × ราคานี้ · 0 = คิดตามสัดส่วนวัน'],
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
  ['roomItems', 'เตียง,ที่นอน,ตู้เสื้อผ้า,โต๊ะ,เก้าอี้,แอร์,พัดลม,ตู้เย็น,เครื่องทำน้ำอุ่น,ผ้าม่าน,มุ้งลวด,ทีวี', 'รายการอุปกรณ์ประจำห้อง (คั่นด้วยจุลภาค)'],
  ['botOn', '1', 'บอท LINE ในกลุ่ม: 1 = ทำงาน · 0 = พัก (ไม่ตอบ ไม่แจ้งเตือน)'],
  ['botCmds', 'ซ่อม,รับเงิน,จ่าย,ทำความสะอาด,อุปกรณ์,โน้ต,จอง,ถาม', 'คำสั่งที่บอทรับในกลุ่ม (คั่นด้วยจุลภาค)'],
  ['botLog', '1', 'จดข้อความในกลุ่มไว้ใช้กับคำสั่ง ค้น (1/0)'],
  ['botLogDays', '180', 'เก็บข้อความในกลุ่มย้อนหลังกี่วัน'],
  ['botNotify', 'morning,slip,repair,moveout,checkin', 'แจ้งเตือนเข้ากลุ่ม (คั่นด้วยจุลภาค): morning,slip,repair,moveout,checkin,paid,rent'],
  ['lineOaId', '', 'LINE OA ID ของตึก (เช่น @942xsawg) ใช้สร้าง QR ผูก LINE ผู้เช่า'],
  ['appUrl', '', '(ระบบ) ที่อยู่เว็บของระบบ ใช้สร้างลิงก์บิลใน LINE'],
  ['tNotify', 'bill,remind,repair,paid', 'แจ้งเตือนถึงผู้เช่าทาง LINE OA (คั่นด้วยจุลภาค): bill,remind,repair,paid'],
  ['guestInfo', '', 'ข้อมูลห้องสำหรับลูกค้าที่สนใจ (ภาษาไทย) เช่น ห้องแอร์ เฟอร์นิเจอร์ครบ ใกล้ BTS'],
  ['guestInfoEn', '', 'Room info for prospects (English)'],
  ['richIds', '', '(ระบบ) รหัสเมนู LINE'],
  ['lineTel1', '083-889-8292', 'LINE OA: เบอร์โทรหลัก (ปุ่มกดโทร)'],
  ['lineTel2', '088-246-5696', 'LINE OA: เบอร์โทรที่ 2'],
  ['lineAddr', 'รามคำแหง 58 บางกะปิ กทม', 'LINE OA: ที่อยู่ในการ์ดติดต่อ'],
  ['mapText', 'ซอยรามคำแหง 58 เขตบางกะปิ กทม', 'LINE OA: ข้อความในการ์ดแผนที่'],
  ['mapUrl', 'https://maps.app.goo.gl/WMAyby6YtfYDNNrX7', 'LINE OA: ลิงก์ Google Maps'],
  ['rentDays', '10,20', 'วันที่เตือนจ่ายค่าเช่าตึก'],
  ['rentText', 'จ่ายค่าเช่าตึก', 'ข้อความเตือนจ่ายค่าเช่าตึก (ใส่ชื่อ/ยอดได้)'],
  ['tenantNews', '1', 'ประกาศถึงผู้เช่าในแอป (1/0)'],
  ['billLink', '1', 'ส่งลิงก์บิล + QR พร้อมเพย์ทาง LINE (1/0)'],
  ['landlordName', '', 'ชื่อผู้ให้เช่า (ในสัญญาเช่า / ผู้รับเงินในใบจอง)'],
  ['contractTerms', '', 'ข้อความสัญญาเช่า ภาษาไทย (เว้นว่าง = ใช้แบบมาตรฐานของระบบ)'],
  ['contractTermsEn', '', 'Lease terms in English (blank = system default)'],
  ['bookTerms', '', 'เงื่อนไขใบรับเงินจอง ภาษาไทย (เว้นว่าง = ใช้แบบมาตรฐาน)'],
  ['bookTermsEn', '', 'Booking terms in English (blank = default)'],
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
    if (name === 'Rooms') { try { ensureRoomsLayout_(true); } catch (e) {} }
    sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  const have = readAll_('Settings').map(r => r.key);
  DEFAULT_SETTINGS.forEach(d => { if (have.indexOf(d[0]) < 0) writeRow_('Settings', { key: d[0], value: d[1], description: d[2] }); });
  const blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (blank && blank.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(blank);
  try { DriveApp.getRootFolder(); } catch (e) { /* ขอสิทธิ์ Drive สำหรับเก็บรูปสลิป */ }
  try { if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'dailyCheck')) ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(8).create(); } catch (e) { /* สรุปเช้า 8 โมง */ }
  try { if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'taskTick')) ScriptApp.newTrigger('taskTick').timeBased().everyMinutes(15).create(); } catch (e) { /* เตือนงานตามเวลา ทุก 15 นาที */ }
  return 'ติดตั้งเรียบร้อย';
}

/** สรุปเข้ากลุ่ม LINE ทุกเช้า 9 โมง — รันฟังก์ชันนี้ครั้งเดียว */
function installDailyTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'dailyCheck') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyCheck').timeBased().everyDays(1).atHour(8).create();
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
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    try { ensureRoomsLayout_(); } catch (e) {}
    out = body && Array.isArray(body.events) && body.destination !== undefined ? lineWebhook_(body) : handle_(body);
  }
  catch (err) { out = { ok: false, error: String((err && err.message) || err) }; }
  return json_(out);
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

const PUBLIC_API = { loginUsers: api_loginUsers, userLogin: api_userLogin, logout: api_logout, publicInfo: api_publicInfo, getBill: api_getBill, requestViewing: api_requestViewing, docView: api_docView, docSignPublic: api_docSignPublic };
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
  clearData: api_clearData, resetRoom: api_resetRoom, saveRoomItems: api_saveRoomItems, setClean: api_setClean, clearChatLog: api_clearChatLog, botTest: api_botTest, unlinkLine: api_unlinkLine, setupRichMenu: api_setupRichMenu, saveViewing: api_saveViewing, deleteViewing: api_deleteViewing, docData: api_docData, docInfo: api_docInfo, docSign: api_docSign, docLink: api_docLink, docReset: api_docReset, docEdit: api_docEdit, repairRoomsFrom: api_repairRoomsFrom, saveTask: api_saveTask, taskDone: api_taskDone, taskNote: api_taskNote, deleteTask: api_deleteTask, saveUser: api_saveUser, setUserPin: api_setUserPin, changeMyPin: api_changeMyPin, auditLog: api_auditLog, lineQuota: api_lineQuota, bulkRoomItems: api_bulkRoomItems, renameRoomItem: api_renameRoomItem,
};
const NO_DATA = { previewBills: 1, fileImage: 1, auditLog: 1 }; // คำสั่งที่ไม่ต้องส่งข้อมูลทั้งหมดกลับ

// คำสั่งที่อ่านอย่างเดียว ไม่ต้องรอคิว (เร็วขึ้นเวลามีหลายคนใช้พร้อมกัน)
const READ_ONLY = { auditLog: 1, login: 1, getAll: 1, fileImage: 1, previewBills: 1, tenantData: 1, tenantFile: 1 };

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
  ACTOR = null;
  adminAuth_(req);
  if (OWNER_ONLY[a] && ACTOR.role === 'staff') throw new Error('คำสั่งนี้สำหรับเจ้าของเท่านั้น');
  return lockIf(() => {
    const r = ADMIN_API[a](req) || {};
    if (!READ_ONLY[a] && !AUDIT_SKIP[a] && !ACTOR.legacy) audit_(ACTOR, a, auditDetail_(a, req));
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

/* ---------- ผู้ใช้ระบบ: แต่ละคนมีชื่อ + PIN 6 หลักของตัวเอง → ระบบรู้ว่าใครทำรายการ ---------- */
let ACTOR = null; // ผู้ใช้ที่ทำคำสั่งนี้ { id, name, role }
const OWNER_ONLY = { saveSettings: 1, clearData: 1, resetRoom: 1, deleteRoom: 1, deleteBill: 1, unpay: 1, saveExpense: 1, deleteExpense: 1, addExpenseFile: 1, removeExpenseFile: 1,
  saveUser: 1, setUserPin: 1, repairRoomsFrom: 1, clearChatLog: 1, setupRichMenu: 1, unlinkLine: 1, testLine: 1, auditLog: 1 };
function actorName_() { return ACTOR ? ACTOR.name : ''; }
function users_() { return readAll_('Users').filter(u => u.id); }
function activeUsers_() { return users_().filter(u => u.active !== '0'); }
function pinHash_(salt, pin) { return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'dt|' + salt + '|' + pin, Utilities.Charset.UTF_8)); }
function sessGet_(tk) {
  if (!/^[a-f0-9]{32}$/.test(String(tk || ''))) return null;
  const v = PropertiesService.getScriptProperties().getProperty('sess:' + tk); if (!v) return null;
  try { const o = JSON.parse(v); return o.exp > Date.now() ? o : null; } catch (e) { return null; }
}
function adminAuth_(req) {
  const us = activeUsers_();
  if (us.length) { // มีผู้ใช้แล้ว: เข้าได้ด้วยการล็อกอินรายคนเท่านั้น
    const ss = sessGet_(req.token), u = ss && us.filter(x => x.id === ss.uid)[0];
    if (!u) throw new Error('กรุณาเข้าสู่ระบบใหม่ (เซสชันหมดอายุ)');
    ACTOR = { id: u.id, name: u.name, role: u.role === 'staff' ? 'staff' : 'owner' };
    return;
  }
  const g = guard_('fail_admin', 10); // ยังไม่ได้ตั้งผู้ใช้: ใช้รหัสผ่านรวมแบบเดิม (ถือเป็นเจ้าของ)
  if (String(req.password || '') !== String(getSettings_().adminPassword)) { g.fail(); throw new Error('รหัสผ่านไม่ถูกต้อง'); }
  g.ok();
  ACTOR = { id: '', name: '', role: 'owner', legacy: true };
}
function api_loginUsers() { return { users: activeUsers_().map(u => ({ id: u.id, name: u.name })) }; }
function api_userLogin(req) {
  const u = activeUsers_().filter(x => x.id === String(req.uid || ''))[0]; if (!u) throw new Error('ไม่พบผู้ใช้นี้');
  const g = guard_('fail_u_' + u.id, 5);
  if (!/^\d{6}$/.test(String(req.pin || '')) || pinHash_(u.salt, String(req.pin)) !== u.pinHash) { g.fail(); throw new Error('PIN ไม่ถูกต้อง'); }
  g.ok();
  const tk = Utilities.getUuid().replace(/-/g, ''), P = PropertiesService.getScriptProperties();
  P.setProperty('sess:' + tk, JSON.stringify({ uid: u.id, exp: Date.now() + 90 * 864e5 })); // จำเครื่องไว้ 90 วัน
  try { const all = P.getProperties(), now = Date.now(); Object.keys(all).forEach(k => { if (k.indexOf('sess:') === 0) { try { if (JSON.parse(all[k]).exp < now) P.deleteProperty(k); } catch (e) { P.deleteProperty(k); } } }); } catch (e) {}
  withLock_(() => { u.lastLogin = now_(); writeRow_('Users', u, u._row); audit_({ id: u.id, name: u.name }, 'login', ''); });
  return { token: tk, user: { id: u.id, name: u.name, role: u.role } };
}
function api_logout(req) { if (/^[a-f0-9]{32}$/.test(String(req.token || ''))) PropertiesService.getScriptProperties().deleteProperty('sess:' + req.token); return {}; }
function api_saveUser(req) { // เพิ่ม/แก้ผู้ใช้ (เจ้าของ) · ผู้ใช้คนแรกตั้งได้ตอนยังใช้รหัสผ่านรวม
  const p = req.user || {}, name = String(p.name || '').trim().slice(0, 40), role = p.role === 'staff' ? 'staff' : 'owner';
  if (!name) throw new Error('กรุณาใส่ชื่อ');
  let u = p.id ? findBy_('Users', 'id', String(p.id)) : null;
  if (p.id && !u) throw new Error('ไม่พบผู้ใช้');
  if (activeUsers_().some(x => x.name === name && (!u || x.id !== u.id))) throw new Error('มีชื่อนี้แล้ว');
  const first = !activeUsers_().length;
  if (!u) { if (!/^\d{6}$/.test(String(p.pin || ''))) throw new Error('PIN ต้องเป็นตัวเลข 6 หลัก'); const salt = Utilities.getUuid(); u = { id: 'U' + Date.now().toString(36) + rand_(3), salt, pinHash: pinHash_(salt, String(p.pin)), createdAt: now_(), active: '1' }; }
  u.name = name; u.role = first ? 'owner' : role; if (p.active != null) u.active = p.active === false || p.active === '0' ? '0' : '1';
  const ownersLeft = activeUsers_().filter(x => x.id !== u.id && x.role !== 'staff').length + (u.active !== '0' && u.role !== 'staff' ? 1 : 0);
  if (!ownersLeft) throw new Error('ต้องมีเจ้าของที่ใช้งานอยู่อย่างน้อย 1 คน');
  writeRow_('Users', u, u._row);
  return { id: u.id, first };
}
function api_setUserPin(req) { // เจ้าของตั้ง PIN ใหม่ให้คนอื่น
  const u = findBy_('Users', 'id', String(req.id || '')); if (!u) throw new Error('ไม่พบผู้ใช้');
  if (!/^\d{6}$/.test(String(req.pin || ''))) throw new Error('PIN ต้องเป็นตัวเลข 6 หลัก');
  u.salt = Utilities.getUuid(); u.pinHash = pinHash_(u.salt, String(req.pin)); writeRow_('Users', u, u._row); return {};
}
function api_changeMyPin(req) {
  if (!ACTOR || !ACTOR.id) throw new Error('ต้องเข้าสู่ระบบด้วยชื่อผู้ใช้ก่อน');
  const u = findBy_('Users', 'id', ACTOR.id);
  if (pinHash_(u.salt, String(req.old || '')) !== u.pinHash) throw new Error('PIN เดิมไม่ถูกต้อง');
  if (!/^\d{6}$/.test(String(req.pin || ''))) throw new Error('PIN ใหม่ต้องเป็นตัวเลข 6 หลัก');
  u.salt = Utilities.getUuid(); u.pinHash = pinHash_(u.salt, String(req.pin)); writeRow_('Users', u, u._row); return {};
}
function api_auditLog(req) {
  const n = Math.min(Number(req.limit) || 300, 1000), L = readAll_('AuditLog'), out = [];
  for (let i = L.length - 1; i >= 0 && out.length < n; i--) { const x = L[i]; if (!req.uid || x.userId === req.uid) out.push(strip_(x)); }
  return { log: out };
}
// บันทึกประวัติการใช้งาน (ใครทำอะไร เมื่อไหร่)
const AUDIT_SKIP = { getAll: 1, login: 1, fileImage: 1, previewBills: 1, docData: 1, lineQuota: 1, changeMyPin: 1, auditLog: 1 };
const AUDIT_KEYS = ['room', 'id', 'name', 'amount', 'method', 'status', 'kind', 'month', 'title', 'category', 'who', 'on', 'mode', 'date', 'paidDate'];
function auditDetail_(a, req) {
  const o = {}, src = Object.assign({}, req, req.room && typeof req.room === 'object' ? req.room : {}, req.tenant || {}, req.bill || {}, req.repair || {}, req.expense || {}, req.user || {});
  AUDIT_KEYS.forEach(k => { const v = src[k]; if (v != null && v !== '' && typeof v !== 'object') o[k] = String(v).slice(0, 60); });
  if (req.settings) o.settings = Object.keys(req.settings).filter(k => !/password|token|pin/i.test(k)).join(',');
  if (Array.isArray(req.items)) o.total = req.items.reduce((x, i) => x + (Number(i.a) || 0), 0);
  if (req.from) o.from = String(req.from).slice(0, 40); if (req.to) o.to = String(req.to).slice(0, 40);
  return JSON.stringify(o).slice(0, 300);
}
function audit_(who, action, detail) { try { writeRow_('AuditLog', { at: now_(), userId: who ? who.id || '' : '', userName: who ? who.name || '' : '', action, detail }); } catch (e) {} }

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
    apartmentName: s.apartmentName, buildingName: s.buildingName || s.apartmentName, phone: s.phone, ownerLine: s.ownerLine, flags: f, ver: APP_VER, tel1: s.lineTel1 || s.phone, tel2: s.lineTel2 || '', mapText: s.mapText || '', mapUrl: s.mapUrl || '',
    rooms: f.app ? readAll_('Tenants').filter(t => t.status === ST.ACTIVE).map(t => t.room).sort(roomSort_) : [],
  };
}

function api_getBill(req) {
  const b = bills_().filter(x => x.token && x.token === String(req.token || ''))[0];
  if (!b) throw new Error('ไม่พบบิลนี้');
  return { bill: cleanBill_(b), info: publicSettings_() };
}

/* ============================ ห้อง ============================ */

const ROOM_BOOKDOC = ['bookNo', 'bookLang', 'bookSignMode', 'bookSigned', 'bookToken', 'bookIdCard', 'bookDocDate'], ROOM_BOOK = ['bookName', 'bookPhone', 'bookAt', 'bookDeposit', 'bookNote'].concat(ROOM_BOOKDOC), ROOM_FIX = ['fixNote', 'fixSince', 'fixDue', 'fixLevel'];
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
  if (m.status !== ST.RES || !ex || ex.status !== ST.RES) ROOM_BOOKDOC.forEach(k => { m[k] = ''; }); // จองใหม่ = เริ่มใบจองใหม่
  if (m.status !== ST.RES) ROOM_BOOK.forEach(k => { m[k] = ''; });
  if (m.status === ST.RES && (!ex || ex.status !== ST.RES || !m.bookBy)) m.bookBy = actorName_();
  if (m.status !== ST.RES) m.bookBy = '';
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
    status: ST.ACTIVE, moveOutDate: '', pin: t.pin ? checkPin_(t.pin) : newPin_(), note: t.note || '', createdAt: now_(), createdBy: actorName_(),
    advanceRent: t.firstBill && advMonths > 0 ? firstAdvance_(rent0, start, advMonths).a : 0, keyDeposit: num(t.keyDeposit, Number(s.keyDeposit) || 0), cardFee: num(t.cardFee, Number(s.cardFee) || 0),
    contractMonths: months, refundAmount: '', refundStatus: '', refundDate: '',
  };
  writeRow_('Tenants', tenant);
  if (room.status === ST.RES && room.bookNo) readAll_('Files').filter(f => f.ref === 'BK:' + room.bookNo && !f.tenantId).forEach(f => { f.tenantId = tenant.id; writeRow_('Files', f, f._row); }); // สลิป/รูปการจอง ย้ายไปเป็นเอกสารของผู้เช่า
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
  if (notifyOn_('checkin')) pushLine_('🔑 เช็คอินผู้เช่าใหม่ ห้อง ' + room.room + ' · ' + tenant.name + '\nเริ่ม ' + start + (bill ? ' · บิลแรกเข้า ' + fmtNum_(bill.total) + ' บาท' : ''));
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
  if (notifyOn_('moveout')) pushLine_('🚪 ห้อง ' + t.room + ' ย้ายออกแล้ว · ' + t.name + (calc.refund > 0 ? '\n💸 ต้องคืนเงิน ' + fmtNum_(calc.refund) + ' บาท' : calc.owe > 0 ? '\n💰 ผู้เช่าต้องจ่ายเพิ่ม ' + fmtNum_(calc.owe) + ' บาท' : '') + '\n🧹 ห้องรอทำความสะอาด');
  try { unlinkTenantLine_(t.id, t.room); } catch (e) {}
  if (r) { r.status = ST.VAC; r.cleanStatus = 'รอทำ'; r.cleanSince = today_(); r.cleanNote = 'ทำความสะอาดหลังผู้เช่าย้ายออก'; writeRow_('Rooms', r, r._row); }
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
      const nb = newBill_(x.t, KIND.MONTH, month, x.items, due, { waterUnits: x.waterUnits, elecUnits: x.elecUnits, no: nos[n++] });
      if (tNotifyOn_('bill')) try { pushTenant_(x.t.id, lang => txt_(tx_(lang, 'billNew', { r: nb.room, t: billTitleL_(nb, lang), a: fmtNum_(nb.total), d: dateL_(nb.dueDate, lang) }))); } catch (e) {}
    }
  });
  return { result: { created: fresh.length, updated: c.list.length - fresh.length, missing: c.missing, skipped: c.skipped } };
}

/* ============================ บิลพิเศษ / แก้ไขบิล ============================ */

function api_createBill(req) {
  let t = req.free ? null : activeTenant_(String(req.room || ''));
  if (req.free) { const nm = String(req.name || '').trim().slice(0, 80); if (!nm) throw new Error('กรุณาใส่ชื่อผู้ชำระ'); t = { room: String(req.room || '').trim().slice(0, 20), id: '', name: nm }; }
  if (!t) throw new Error('ห้องนี้ไม่มีผู้เช่า');
  const items = cleanItems_(req.items, true);
  if (!items.length) throw new Error('กรุณาใส่รายการอย่างน้อย 1 รายการ');
  const due = isDate_(req.dueDate) ? req.dueDate : addDays_(today_(), 7);
  const b = newBill_(t, KIND.SPECIAL, today_().slice(0, 7), items, due, { note: req.note || '', title: String(req.title || '').trim().slice(0, 80), payPhone: String(req.phone || '').trim().slice(0, 30) });
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
  if (req.title !== undefined) b.title = String(req.title).trim().slice(0, 80);
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
  if (tNotifyOn_('paid')) try { pushTenant_(b.tenantId, lang => card_(tx_(lang, 'rejectT'), tx_(lang, 'rejectT'), '#c62828', [[tx_(lang, 'bill'), billTitleL_(b, lang)], [tx_(lang, 'reason'), b.rejectReason], tx_(lang, 'rejectHint')])); } catch (e) {}
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
  b.paidBy = actorName_();
  writeBill_(b);
  if (b.tenantId && tNotifyOn_('paid')) try { pushTenant_(b.tenantId, lang => card_(tx_(lang, 'paidT'), tx_(lang, 'paidT'), '#15803d', [[tx_(lang, 'bill'), billTitleL_(b, lang)], [tx_(lang, 'amount'), fmtNum_(b.total) + ' ' + tx_(lang, 'baht'), true], [tx_(lang, 'receipt'), b.receiptNo || '-']], billLink_(b, lang) ? [{ label: tx_(lang, 'receiptBtn'), uri: billLink_(b, lang) }] : [])); } catch (e) {}
  if (!BOT_CTX.on && notifyOn_('paid')) pushLine_('💵 รับเงินแล้ว ห้อง ' + b.room + ' · ' + billTitle_(b) + ' ' + fmtNum_(b.total) + ' บาท (' + method + ')');
}

function setSlipResult_(id, result) {
  const s = id && findBy_('Slips', 'id', id);
  if (s) { s.result = result; writeRow_('Slips', s, s._row); }
}

function api_fileImage(req) { return { image: fileDataUrl_(String(req.fileId || '')) }; }

/* ============================ เอกสาร / รูปของห้อง (สัญญา บัตร รูปห้อง) ============================ */
const DOC_CATS = ['สัญญาเช่า', 'เอกสารผู้เช่า', 'รูปห้องตอนเข้า', 'รูปห้องตอนออก', 'การจอง', 'อื่นๆ'];
function api_uploadDoc(req) {
  const room = String(req.room || '').trim();
  if (!findBy_('Rooms', 'room', room)) throw new Error('ไม่พบห้อง ' + room);
  const m = String(req.data || '').match(/^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/);
  if (!m) throw new Error('ไฟล์ไม่ถูกต้อง');
  if (!/^image\/(jpeg|png|webp|heic|heif)$|^application\/pdf$/.test(m[1])) throw new Error('รองรับเฉพาะรูปภาพ และไฟล์ PDF');
  if (m[2].length > 14 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 10 MB');
  const cat = DOC_CATS.indexOf(req.category) >= 0 ? req.category : 'อื่นๆ';
  let ref = '';
  if (cat === 'การจอง') { const r = findBy_('Rooms', 'room', room); if (r.status !== ST.RES) throw new Error('ห้อง ' + room + ' ไม่ได้อยู่ในสถานะจอง'); ensureDocNo_('book', r); ref = 'BK:' + r.bookNo; }
  const t = ref ? null : req.tenantId ? findBy_('Tenants', 'id', String(req.tenantId)) : activeTenant_(room);
  const name = String(req.name || cat).replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'ห้อง' + room + '_' + cat + '_' + name);
  const fileId = fileFolder_().createFile(blob).getId();
  const doc = { id: 'D' + Date.now().toString(36) + rand_(3), createdAt: now_(), room, tenantId: t ? t.id : '', category: cat, name, mime: m[1],
    fileId, size: Math.round(m[2].length * 0.75), note: String(req.note || '').slice(0, 200), ref };
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
  if (r.tenantId && tNotifyOn_('repair') && (r.status !== before.status || r.ownerMsg !== before.ownerMsg || (p.appointAt !== undefined && p.appointAt))) try {
    pushTenant_(r.tenantId, lang => card_(tx_(lang, 'repUpd', { r: r.room }), tx_(lang, 'repUpd', { r: r.room }), r.status === ST.R_DONE ? '#15803d' : '#2457c5',
      [[tx_(lang, 'repDetail'), String(r.detail).slice(0, 80)], [lang === 'en' ? 'Status' : 'สถานะ', tx_(lang, 'st')[r.status] || r.status, true]].concat(r.appointAt && r.status !== ST.R_DONE ? [[tx_(lang, 'appoint'), String(r.appointAt).replace('T', ' ')]] : []).concat(r.ownerMsg ? [r.ownerMsg] : [])));
  } catch (e) {}
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
  if (req.line) return { result: { sent: lineNews_(title.slice(0, 120), String(req.body || '').slice(0, 1000), req.floors) } };
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
  if (notifyOn_('slip')) pushLine_('💰 ห้อง ' + b.room + ' ส่งสลิป ' + billTitle_(b) + ' ยอด ' + fmtNum_(b.total) + ' บาท' + (dup ? '\n⚠️ สลิปซ้ำกับที่เคยส่ง' : '') + '\nกดอนุมัติในระบบเจ้าของหอ');
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
  if (notifyOn_('repair')) pushLine_('🔧 แจ้งซ่อม ห้อง ' + t.room + ' (' + r.category + ')\n' + r.detail + '\nโทร ' + r.phone);
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
  const o = e || { id: 'E' + Date.now().toString(36) + rand_(3), files: '[]', createdAt: now_(), createdBy: actorName_() };
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
/* ============================ สถานะทำความสะอาด ============================ */
// on = true: สั่งทำความสะอาด (รอทำ) · on = false: ทำเสร็จแล้ว (บันทึกวันที่ทำล่าสุด)
function api_setClean(req) {
  const rooms = [].concat(req.rooms || req.room || []).map(String);
  if (!rooms.length) throw new Error('ไม่พบห้อง');
  let n = 0;
  readAll_('Rooms').forEach(r => {
    if (rooms.indexOf(r.room) < 0) return;
    if (req.on) { r.cleanStatus = 'รอทำ'; r.cleanSince = isDate_(req.date) ? req.date : today_(); r.cleanNote = String(req.note || '').slice(0, 300); }
    else { r.cleanStatus = ''; r.cleanNote = ''; r.cleanSince = ''; r.cleanLast = isDate_(req.date) ? req.date : today_(); }
    writeRow_('Rooms', r, r._row); n++;
  });
  return { result: n };
}

/* ============================ อุปกรณ์ประจำห้อง (มี / ขาด / ชำรุด) ============================ */
const ITEM_ST = ['มี', 'ขาด', 'ชำรุด'];
function cleanItems2_(obj) {
  const out = {};
  Object.keys(obj || {}).slice(0, 60).forEach(k => {
    const name = String(k).trim().slice(0, 40), v = obj[k] || {};
    if (!name) return;
    const st = ITEM_ST.indexOf(v.s) >= 0 ? v.s : '', n = String(v.n || '').trim().slice(0, 200);
    if (st || n) out[name] = { s: st, n };
  });
  return out;
}
function parseItems_(r) { try { return JSON.parse(r.items || '{}') || {}; } catch (e) { return {}; } }
function api_saveRoomItems(req) {
  const r = findBy_('Rooms', 'room', String(req.room || ''));
  if (!r) throw new Error('ไม่พบห้อง');
  r.items = JSON.stringify(Object.assign({}, req.merge ? parseItems_(r) : {}, cleanItems2_(req.items)));
  writeRow_('Rooms', r, r._row);
}
// ตั้งสถานะอุปกรณ์ทีละหลายห้อง (เช่น ทุกห้องที่ยังไม่ตรวจ = มี)
function api_bulkRoomItems(req) {
  const st = ITEM_ST.indexOf(req.s) >= 0 ? req.s : '', names = (req.names || []).map(x => String(x).trim()).filter(Boolean);
  if (!st || !names.length) throw new Error('ข้อมูลไม่ครบ');
  const want = req.rooms ? new Set(req.rooms.map(String)) : null;
  const rows = readAll_('Rooms'), sh = sheet_('Rooms'), col = SCHEMA.Rooms.indexOf('items') + 1;
  let n = 0;
  rows.forEach(r => {
    if (want && !want.has(r.room)) return;
    const it = parseItems_(r); let ch = false;
    names.forEach(k => { if (req.onlyBlank && it[k] && it[k].s) return; it[k] = { s: st, n: (it[k] && it[k].n) || '' }; ch = true; });
    if (ch) { sh.getRange(r._row, col, 1, 1).setValues([[toCell_('items', JSON.stringify(it))]]); n++; }
  });
  dropCache_('Rooms');
  return { result: n };
}
// เปลี่ยนชื่อ / รวมรายการอุปกรณ์ที่เรียกต่างกันแต่เป็นของชิ้นเดียวกัน (to ว่าง = ลบรายการนี้ออกจากทุกห้อง)
function api_renameRoomItem(req) {
  const from = String(req.from || '').trim(), to = String(req.to || '').trim().replace(/,/g, ' ').slice(0, 40);
  if (!from) throw new Error('ไม่ระบุรายการ'); if (from === to) return { result: 0 };
  const rank = s => ({ 'ขาด': 3, 'ชำรุด': 2, 'มี': 1 })[s] || 0;
  const rows = readAll_('Rooms'), sh = sheet_('Rooms'), col = SCHEMA.Rooms.indexOf('items') + 1; let n = 0;
  rows.forEach(r => {
    const it = parseItems_(r); if (!it[from]) return;
    const a = it[from]; delete it[from];
    if (to) { const b = it[to]; it[to] = !b ? a : { s: rank(a.s) > rank(b.s) ? a.s : b.s, n: [b.n, a.n].filter(Boolean).filter((x, i, l) => l.indexOf(x) === i).join(' · ').slice(0, 200) }; }
    sh.getRange(r._row, col, 1, 1).setValues([[toCell_('items', JSON.stringify(it))]]); n++;
  });
  dropCache_('Rooms');
  // รายการมาตรฐานในตั้งค่า
  const def = String(getSettings_().roomItems || '').split(',').map(x => x.trim()).filter(Boolean);
  if (def.indexOf(from) >= 0) { const nd = []; def.forEach(x => { const y = x === from ? to : x; if (y && nd.indexOf(y) < 0) nd.push(y); }); api_saveSettings({ settings: { roomItems: nd.join(',') } }); }
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
    tenants: readAll_('Tenants').map(t => { const o = strip_(t); o.docCustom = !!o.docHtml; delete o.docHtml; return o; }),
    meters: readAll_('Meters').map(strip_),
    bills: bills_().map(b => { const o = strip_(b); return o; }).sort(billSort_),
    slips: readAll_('Slips').map(x => { const o = strip_(x); delete o.hash; return o; }),
    repairs: readAll_('Repairs').map(r => { const o = strip_(r); o.log = parseLog_(r); return o; }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    news: readAll_('News').map(strip_).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    docs: readAll_('Files').map(strip_).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    lineUsers: readAll_('LineUsers').map(strip_),
    expenses: ACTOR && ACTOR.role === 'staff' ? [] : readAll_('Expenses').map(x => { const o = strip_(x); o.files = parseJson_(x.files); return o; }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    viewings: readAll_('Viewings').map(strip_).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    tasks: tasksView_(),
    me: ACTOR ? { id: ACTOR.id, name: ACTOR.name, role: ACTOR.role, legacy: !!ACTOR.legacy } : null,
    users: users_().map(u => ({ id: u.id, name: u.name, role: u.role, active: u.active !== '0', lastLogin: u.lastLogin })),
    ver: APP_VER, serverToday: today_(), serverNow: now_(),
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
  try { ensureRoomsLayout_(); } catch (e) {}
  const st = getSettings_();
  if (st.botOn === '0') return;
  try { trimChatLog_(st); } catch (e) {}
  const L = [];
  const rd = String(st.rentDays || '').split(/[,\s]+/).map(Number).filter(Boolean), dd = Number(today_().slice(8));
  if (notifyOn_('rent') && rd.indexOf(dd) >= 0) pushLine_('🏦 วันนี้วันที่ ' + dd + ' · ' + (st.rentText || 'จ่ายค่าเช่าตึก'));
  if (tNotifyOn_('remind')) try {
    const tom = addDays_(today_(), 1);
    bills_().filter(b => b.status === ST.DUE && b.tenantId && b.dueDate).forEach(b => {
      const od = dayDiff_(b.dueDate, today_());
      if (b.dueDate === tom) pushTenant_(b.tenantId, lang => txt_(tx_(lang, 'remind1', { r: b.room, t: billTitleL_(b, lang), d: dateL_(b.dueDate, lang), a: fmtNum_(b.total) })));
      else if ([1, 3, 7].indexOf(od) >= 0) pushTenant_(b.tenantId, lang => txt_(tx_(lang, 'remindOver', { r: b.room, t: billTitleL_(b, lang), n: od, a: fmtNum_(b.total) })));
    });
  } catch (e) {}
  try { tasksMorning_(); } catch (e) {}
  if (!notifyOn_('morning')) return;
  pushLine_(morningText_());
}
function morningText_() {
  const today = today_(), in30 = addDays_(today, 30), all = bills_(), rooms = readAll_('Rooms');
  const review = all.filter(b => b.status === ST.REVIEW);
  const overdue = all.filter(b => b.status === ST.DUE && b.dueDate < today);
  const act = readAll_('Tenants').filter(t => t.status === ST.ACTIVE);
  const exp = act.filter(t => t.endDate && t.endDate <= in30);
  const reps = readAll_('Repairs').filter(r => r.status === ST.R_NEW || r.status === ST.R_DOING);
  const clean = rooms.filter(r => r.cleanStatus === 'รอทำ'), book = rooms.filter(r => r.status === ST.RES && String(r.bookAt || '').slice(0, 10) <= addDays_(today, 1) && r.bookAt);
  const L = ['📋 สรุปเช้านี้ · ' + monthLabel_(today.slice(0, 7)).replace(/^\S+/, Number(today.slice(8)) + ' $&'), '🏠 มีผู้เช่า ' + act.length + ' / ' + rooms.length + ' ห้อง'];
  if (overdue.length) { L.push('⏰ ค้างจ่าย ' + overdue.length + ' บิล รวม ' + fmtNum_(overdue.reduce((a, b) => a + Number(b.total), 0)) + ' บาท'); overdue.slice(0, 10).forEach(b => L.push('   • ห้อง ' + b.room + ' ' + fmtNum_(b.total) + ' (' + dayDiff_(b.dueDate, today) + ' วัน)')); }
  if (review.length) L.push('🧾 สลิปรออนุมัติ ' + review.length + ' รายการ');
  if (reps.length) L.push('🔧 งานซ่อมค้าง ' + reps.length + ' งาน: ' + reps.slice(0, 8).map(r => r.room).join(', '));
  if (clean.length) L.push('🧹 รอทำความสะอาด: ' + clean.map(r => r.room).join(', '));
  book.forEach(r => L.push('📅 ห้อง ' + r.room + ' ' + (r.bookName || '') + ' เข้าอยู่ ' + r.bookAt));
  if (exp.length) L.push('📄 สัญญาใกล้หมด: ' + exp.map(t => t.room + ' (' + t.endDate + ')').join(', '));
  if (L.length === 2) L.push('✅ ไม่มีงานค้าง');
  return L.join('\n');
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
  if (!b.createdBy) b.createdBy = actorName_();
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
function billTitle_(b) { if (b.title) return b.title; return b.kind === KIND.MONTH ? 'บิลเดือน ' + monthLabel_(b.month) : 'บิล' + b.kind + ' ' + (b.no || ''); }
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
// ค่าเช่าเดือนที่อยู่ไม่เต็มเดือน: ตั้งค่ารายวันไว้ = จำนวนวันที่อยู่ × ค่ารายวัน (ไม่เกินค่าเช่าเต็มเดือน) · ไม่ตั้ง = ตามสัดส่วนวัน
function partRent_(rent, days, dim) {
  const daily = Number(getSettings_().dailyRate) || 0;
  if (days >= dim) return rent;
  return daily > 0 ? Math.max(0, Math.min(rent, Math.round(days * daily))) : Math.round(rent * days / dim);
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

/* ============================ บอท LINE ในกลุ่ม (ระดับ 1: คำสั่ง + ค้นด้วยคำ) ============================ */
let BOT_CTX = { on: false };
function notifyOn_(k) { const s = getSettings_(); return s.botOn !== '0' && String(s.botNotify || '').split(',').map(x => x.trim()).indexOf(k) >= 0; }
function lineApi_(path, payload, method) {
  const s = getSettings_(); if (!s.lineToken) return null;
  try {
    const res = UrlFetchApp.fetch('https://api.line.me' + path, { method: method || 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + s.lineToken }, payload: payload ? JSON.stringify(payload) : undefined });
    return res.getResponseCode() === 200 ? JSON.parse(res.getContentText() || '{}') : null;
  } catch (e) { return null; }
}
function lineReply_(token, text) { if (token) lineApi_('/v2/bot/message/reply', { replyToken: token, messages: [{ type: 'text', text: String(text).slice(0, 4900) }] }); }
function lineName_(gid, uid) {
  if (!uid) return 'ไม่ทราบชื่อ';
  const c = CacheService.getScriptCache(), k = 'ln:' + uid, hit = c.get(k); if (hit) return hit;
  const p = gid ? lineApi_('/v2/bot/group/' + gid + '/member/' + uid, null, 'get') : null;
  const n = (p && p.displayName) || 'สมาชิก'; c.put(k, n, 21600); return n;
}
function lineWebhook_(body) {
  MEMO = {}; prefetch_();
  (body.events || []).forEach(ev => {
    try { botEvent_(ev); } catch (e) { lineReply_(ev.replyToken, '⚠️ ' + ((e && e.message) || e)); }
  });
  return { ok: true };
}
const BOT_HELP = {
  'งาน': ['งาน · ดูงานวันนี้', 'งาน ตามใบอนุญาตก่อสร้าง · เพิ่มงาน', 'งาน 402 เปลี่ยนหลอดไฟ · เพิ่มงานของห้อง', 'เสร็จ 402 · ติ๊กงานห้อง 402 ว่าเสร็จ'],
  'ซ่อม': ['ซ่อม 203 ก๊อกน้ำรั่ว', 'ซ่อมเสร็จ 203'],
  'รับเงิน': ['รับเงิน 105 3500 โอน', 'รับเงิน 105 เงินสด'],
  'จ่าย': ['จ่าย ค่าแม่บ้าน 4000', 'จ่าย ค่าช่าง 1500 ซ่อมปั๊มน้ำ'],
  'ทำความสะอาด': ['ทำความสะอาด 102 104', 'สะอาดแล้ว 102'],
  'อุปกรณ์': ['ขาด 204 เตียง', 'ชำรุด 204 ตู้เสื้อผ้า บานพับหลุด', 'มีแล้ว 204 เตียง'],
  'โน้ต': ['โน้ต 305 ฝ้าห้องน้ำร้าว'],
  'จอง': ['จอง 301 สมชาย 0812345678 23/11 20:00', 'ยกเลิกจอง 301'],
  'ถาม': ['สรุป', 'ห้อง 204', 'ค้างจ่าย', 'ห้องว่าง', 'รอทำความสะอาด', 'งานซ่อม', 'การจอง', 'ค้น ฝ้า'],
};
function botEvent_(ev) {
  const s = getSettings_(), src = ev.source || {}, gid = src.groupId || src.roomId || '';
  if (src.type === 'user') return userEvent_(ev, s);
  if (ev.type === 'join') return lineReply_(ev.replyToken, '👋 สวัสดีครับ บอทดูแลตึก\nพิมพ์ groupid เพื่อดู Group ID ของกลุ่มนี้ แล้วนำไปใส่ในระบบ › ตั้งค่า › LINE');
  if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') return;
  const text = String(ev.message.text || '').trim(), rt = ev.replyToken;
  if (/^(groupid|group id|ไอดีกลุ่ม)$/i.test(text)) return lineReply_(rt, gid ? 'Group ID ของกลุ่มนี้:\n' + gid + '\n\nคัดลอกไปใส่ใน ระบบ › ตั้งค่า › LINE แจ้งเตือน' : 'ใช้คำสั่งนี้ในกลุ่มเท่านั้นครับ');
  if (!s.lineGroupId || gid !== s.lineGroupId) return; // รับเฉพาะกลุ่มที่ตั้งไว้
  const sw = text.match(/^บอท\s*(เปิด|พัก|ปิด)$/);
  if (sw) { withLock_(() => setSetting_('botOn', sw[1] === 'เปิด' ? '1' : '0')); return lineReply_(rt, sw[1] === 'เปิด' ? '✅ บอทกลับมาทำงานแล้ว' : '😴 บอทพักแล้ว · พิมพ์ "บอท เปิด" เพื่อให้กลับมาทำงาน'); }
  if (s.botOn === '0') return;
  const name = lineName_(gid, src.userId);
  if (s.botLog !== '0') withLock_(() => writeRow_('ChatLog', { at: now_(), userId: src.userId || '', name, text: text.slice(0, 2000) }));
  const out = botCommand_(text, name, s);
  if (out) lineReply_(rt, out);
}
function botRoom_(tok) { const r = findBy_('Rooms', 'room', String(tok || '')); if (!r) throw new Error('ไม่พบห้อง ' + (tok || '') + ' · ตัวอย่าง: ซ่อม 203 ก๊อกรั่ว'); return r; }
function botNum_(tok) { const n = Number(String(tok || '').replace(/,/g, '')); return tok != null && tok !== '' && !isNaN(n) ? n : null; }
// แปลงคำพูดหลายแบบให้เป็นคำสั่งมาตรฐาน (ต้องขึ้นต้นข้อความเท่านั้น ข้อความคุยทั่วไปบอทไม่ตอบ)
const BOT_ALIAS = [
  [/^(สรุป(วันนี้|เช้า|ประจำวัน)?|รายงาน(วันนี้)?)(\s.*)?$/, 'สรุป'],
  [/^(ค้างจ่าย|บิลค้าง|ค้างเงิน|ค้างค่าเช่า|ใครค้าง(จ่าย)?|ห้องค้าง(จ่าย)?|ค้างกี่ห้อง|ยังไม่จ่าย|ห้องไหนค้าง(จ่าย)?)(กี่ห้อง|กี่บิล|ห้องไหน|ทั้งหมด|เท่าไหร่|เท่าไร)?(\s.*)?$/, 'ค้างจ่าย'],
  [/^(ห้องว่าง|ว่างกี่ห้อง|ว่างห้องไหน|มีห้องว่าง|ห้องไหนว่าง)(กี่ห้อง|ห้องไหน|ทั้งหมด)?(\s.*)?$/, 'ห้องว่าง'],
  [/^(ห้อง(ที่)?(ต้อง|รอ)ทำความสะอาด|รอทำความสะอาด|ทำความสะอาดห้องไหน|ห้องไหนต้องทำความสะอาด|งานทำความสะอาด|ห้องสกปรก)(\s.*)?$/, 'รอทำความสะอาด'],
  [/^(งานซ่อม|ซ่อมค้าง|งานซ่อมค้าง|ห้องซ่อม|ห้องไหนซ่อม|ซ่อมอะไรอยู่)(\s.*)?$/, 'งานซ่อม'],
  [/^(การจอง|ห้องจอง|ใครจอง|จองห้องไหน|รายการจอง)(\s.*)?$/, 'การจอง'],
  [/^(หา|ค้นหา)\s+/, 'ค้น '],
  [/^(จ่ายเงิน|ชำระ(เงิน)?|โอนแล้ว)\s+(?=\d)/, 'รับเงิน '],
  [/^(แจ้งซ่อม)\s*/, 'ซ่อม '],
  [/^(ทำความสะอาดแล้ว|ทำความสะอาดเสร็จ|สะอาดแล้ว)\s*/, 'สะอาดแล้ว '],
];
function botNorm_(text) {
  let t = String(text || '').trim().replace(/[\u200b\u00a0]/g, ' ').replace(/\s+/g, ' ');
  t = t.replace(/[?？!]+$/, '').replace(/\s*(ครับผม|ครับ|ค่ะ|คะ|นะ|จ้า|หน่อย|ไหม|มั้ย|บ้าง|ด้วย)+$/, '').trim();
  for (const [re, to] of BOT_ALIAS) if (re.test(t)) { t = /\s$/.test(to) ? t.replace(re, to) : to; break; }
  // ติดเลขห้องโดยไม่เว้นวรรค: ซ่อม203 → ซ่อม 203
  t = t.replace(/^(ซ่อมเสร็จ|ซ่อม|รับเงิน|ทำความสะอาด|สะอาดแล้ว|ขาด|ชำรุด|มีแล้ว|โน้ต|จอง|ยกเลิกจอง|ห้อง)(\d)/, '$1 $2');
  return t.trim();
}
function botCommand_(text, name, s) {
  let called = false;
  if (/^(บอท|bot)\s+/i.test(text)) { called = true; text = text.replace(/^(บอท|bot)\s+/i, ''); }
  text = botNorm_(text);
  const on = String(s.botCmds || '').split(',').map(x => x.trim()).concat(['งาน']), T = text.split(/\s+/), c = T[0], a = T.slice(1);
  const need = g => { if (on.indexOf(g) < 0) throw new Error('คำสั่ง "' + g + '" ปิดอยู่ · เปิดได้ที่ ระบบ › ตั้งค่า › บอท LINE'); };
  const by = ' (LINE: ' + name + ')';
  BOT_CTX.on = true;
  try {
    if (/^(คำสั่ง|ช่วย|help|\?)$/i.test(c)) return '📖 คำสั่งที่ใช้ได้\n' + on.filter(g => BOT_HELP[g]).map(g => BOT_HELP[g].map(x => '• ' + x).join('\n')).join('\n') + '\n• บอท พัก / บอท เปิด';
    if (c === 'งาน') return botTasks_(a, name);
    if (c === 'เสร็จ') return botTaskDone_(a, name);
    if (c === 'ซ่อมเสร็จ') { need('ซ่อม'); const r = botRoom_(a[0]); return withLock_(() => {
      const reps = readAll_('Repairs').filter(x => x.room === r.room && (x.status === ST.R_NEW || x.status === ST.R_DOING));
      reps.forEach(x => api_saveRepair({ repair: { id: x.id, status: ST.R_DONE, ownerMsg: 'ปิดงานผ่าน LINE โดย ' + name } }));
      let extra = '';
      if (r.status === ST.FIX && !activeTenant_(r.room)) { api_saveRoom({ room: { room: r.room, status: ST.VAC }, isNew: false }); extra = '\n🏠 ห้องกลับเป็นว่าง พร้อมให้เช่า'; }
      return reps.length || extra ? '✅ ห้อง ' + r.room + ' ซ่อมเสร็จ' + (reps.length ? ' · ปิดงานซ่อม ' + reps.length + ' งาน' : '') + extra : 'ห้อง ' + r.room + ' ไม่มีงานซ่อมค้างครับ'; }); }
    if (c === 'ซ่อม') { need('ซ่อม'); const r = botRoom_(a[0]), d = a.slice(1).join(' '); if (!d) throw new Error('ใส่รายละเอียดด้วย · ตัวอย่าง: ซ่อม ' + r.room + ' ก๊อกรั่ว');
      withLock_(() => api_createRepair({ repair: { room: r.room, detail: d, category: 'อื่นๆ', source: 'LINE: ' + name } }));
      const t = activeTenant_(r.room); return '🔧 บันทึกแจ้งซ่อมแล้ว\nห้อง ' + r.room + (t ? ' · ' + t.name : '') + '\n' + d + '\nสถานะ: รอดำเนินการ'; }
    if (c === 'รับเงิน') { need('รับเงิน'); const r = botRoom_(a[0]); let amt = null, m = 'โอน/พร้อมเพย์';
      a.slice(1).forEach(x => { if (botNum_(x) != null) amt = botNum_(x); else if (/สด/.test(x)) m = 'เงินสด'; });
      return withLock_(() => {
        const open = bills_().filter(b => b.room === r.room && (b.status === ST.DUE || b.status === ST.REVIEW)).sort((x, y) => (x.dueDate || '').localeCompare(y.dueDate || ''));
        if (!open.length) return 'ห้อง ' + r.room + ' ไม่มีบิลค้างครับ';
        const b = open[0];
        if (amt != null && amt < Number(b.total)) return '⚠️ ยอดไม่พอ · ' + billTitle_(b) + ' ห้อง ' + r.room + ' ยอด ' + fmtNum_(b.total) + ' บาท';
        ACTOR = { id: 'line', name: 'LINE · ' + name, role: 'staff' };
        api_recordPayment({ id: b.id, method: m, amount: amt != null ? amt : b.total, note: 'บันทึกผ่าน LINE โดย ' + name });
        return '💵 บันทึกรับเงินแล้ว\nห้อง ' + r.room + ' · ' + billTitle_(b) + '\nยอด ' + fmtNum_(b.total) + ' บาท · ' + m + (amt > b.total && m === 'เงินสด' ? ' (ทอน ' + fmtNum_(amt - b.total) + ')' : '') + (open.length > 1 ? '\n⚠️ ยังค้างอีก ' + (open.length - 1) + ' บิล' : '') + '\nบันทึกโดย ' + name; }); }
    if (c === 'จ่าย') { need('จ่าย'); const i = a.findIndex(x => botNum_(x) != null); if (i < 1) throw new Error('ตัวอย่าง: จ่าย ค่าแม่บ้าน 4000');
      const cat = a.slice(0, i).join(' '), amt = botNum_(a[i]), note = a.slice(i + 1).join(' ');
      withLock_(() => api_saveExpense({ category: cat, amount: amt, note: (note ? note + ' ' : '') + by.trim() }));
      return '💸 บันทึกค่าใช้จ่ายแล้ว\n' + cat + ' ' + fmtNum_(amt) + ' บาท' + (note ? '\n' + note : '') + '\nส่งรูปใบเสร็จ: แนบในระบบ › ค่าใช้จ่าย'; }
    if (c === 'ทำความสะอาด' || c === 'สะอาดแล้ว') { need('ทำความสะอาด'); const rooms = a.filter(x => findBy_('Rooms', 'room', x)), note = a.filter(x => !findBy_('Rooms', 'room', x)).join(' ');
      if (!rooms.length) throw new Error('ตัวอย่าง: ' + c + ' 102 104');
      withLock_(() => api_setClean({ rooms, on: c === 'ทำความสะอาด', note }));
      return c === 'ทำความสะอาด' ? '🧹 สั่งทำความสะอาดห้อง ' + rooms.join(', ') + (note ? '\n' + note : '') : '✅ ห้อง ' + rooms.join(', ') + ' ทำความสะอาดเสร็จแล้ว'; }
    if (c === 'ขาด' || c === 'ชำรุด' || c === 'มีแล้ว') { need('อุปกรณ์'); const r = botRoom_(a[0]), item = a[1]; if (!item) throw new Error('ตัวอย่าง: ' + c + ' ' + r.room + ' เตียง');
      const st = c === 'มีแล้ว' ? 'มี' : c, n = a.slice(2).join(' ');
      withLock_(() => api_saveRoomItems({ room: r.room, merge: true, items: { [item]: { s: st, n } } }));
      return (st === 'มี' ? '✅' : st === 'ขาด' ? '❌' : '⚠️') + ' ห้อง ' + r.room + ' · ' + item + ': ' + st + (n ? ' (' + n + ')' : ''); }
    if (c === 'โน้ต') { need('โน้ต'); const r = botRoom_(a[0]), n = a.slice(1).join(' '); if (!n) throw new Error('ตัวอย่าง: โน้ต ' + r.room + ' ฝ้าห้องน้ำร้าว');
      withLock_(() => { const x = findBy_('Rooms', 'room', r.room); x.note = (x.note ? x.note + ' | ' : '') + today_().slice(5).split('-').reverse().join('/') + ' ' + n; writeRow_('Rooms', x, x._row); });
      return '📝 เพิ่มหมายเหตุห้อง ' + r.room + ' แล้ว\n' + n; }
    if (c === 'ยกเลิกจอง') { need('จอง'); const r = botRoom_(a[0]); if (r.status !== ST.RES) return 'ห้อง ' + r.room + ' ไม่ได้จองไว้ครับ';
      withLock_(() => api_saveRoom({ room: { room: r.room, status: ST.VAC }, isNew: false })); return '✕ ยกเลิกการจองห้อง ' + r.room + ' แล้ว'; }
    if (c === 'จอง') { need('จอง'); const r = botRoom_(a[0]); if (activeTenant_(r.room)) throw new Error('ห้อง ' + r.room + ' มีผู้เช่าอยู่');
      let phone = '', date = '', time = ''; const nm = [];
      a.slice(1).forEach(x => { if (/^0\d{8,9}$/.test(x.replace(/-/g, ''))) phone = x; else if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(x)) date = x; else if (/^\d{1,2}[:.]\d{2}(น\.?)?$/.test(x)) time = x.replace('.', ':').replace(/น\.?$/, ''); else nm.push(x); });
      if (!nm.length) throw new Error('ตัวอย่าง: จอง ' + r.room + ' สมชาย 0812345678 23/11 20:00');
      let at = '';
      if (date) { const p = date.split('/'), y0 = Number(today_().slice(0, 4)); let y = p[2] ? Number(p[2]) : y0; if (y < 100) y += 2000; if (y > 2400) y -= 543; if (y < 2000) y += 0; at = y + '-' + pad2_(Number(p[1])) + '-' + pad2_(Number(p[0])); if (!p[2] && at < today_()) at = (y + 1) + at.slice(4); }
      if (at && time) { const t2 = time.split(':'); at += ' ' + pad2_(Number(t2[0])) + ':' + t2[1]; }
      withLock_(() => api_saveRoom({ room: { room: r.room, status: ST.RES, bookName: nm.join(' '), bookPhone: phone, bookAt: at, bookNote: 'จองผ่าน LINE โดย ' + name }, isNew: false }));
      return '📅 บันทึกการจองแล้ว\nห้อง ' + r.room + ' · ' + nm.join(' ') + (phone ? '\n📞 ' + phone : '') + (at ? '\nเข้าอยู่ ' + at : ''); }
    if (c === 'ห้อง' && a[0] && (a.length === 1 || called)) { need('ถาม'); return botRoomInfo_(botRoom_(a[0])); }
    if (c === 'ค้างจ่าย') { need('ถาม'); const today = today_(), o = bills_().filter(b => b.status === ST.DUE || b.status === ST.REVIEW).sort((x, y) => roomSort_(x.room, y.room));
      if (!o.length) return '✅ ไม่มีบิลค้างครับ';
      return '⏰ ค้างจ่าย ' + o.length + ' บิล รวม ' + fmtNum_(o.reduce((x, b) => x + Number(b.total), 0)) + ' บาท\n' + o.slice(0, 30).map(b => '• ห้อง ' + b.room + ' ' + fmtNum_(b.total) + (b.status === ST.REVIEW ? ' (สลิปรออนุมัติ)' : b.dueDate < today ? ' · เกิน ' + dayDiff_(b.dueDate, today) + ' วัน' : ' · ครบ ' + b.dueDate.slice(8) + '/' + b.dueDate.slice(5, 7))).join('\n'); }
    if (c === 'ห้องว่าง' || c === 'ว่าง') { need('ถาม'); const v = readAll_('Rooms').filter(r => !activeTenant_(r.room)).sort((x, y) => roomSort_(x.room, y.room));
      const grp = k => v.filter(r => k(r)).map(r => r.room).join(', ');
      return '🏠 ห้องที่ไม่มีผู้เช่า ' + v.length + ' ห้อง\nพร้อมให้เช่า: ' + (grp(r => r.status === ST.VAC && r.cleanStatus !== 'รอทำ') || '-') + '\n🧹 รอทำความสะอาด: ' + (grp(r => r.status === ST.VAC && r.cleanStatus === 'รอทำ') || '-') + '\n📅 จอง: ' + (grp(r => r.status === ST.RES) || '-') + '\n🔧 ซ่อม: ' + (grp(r => r.status === ST.FIX) || '-'); }
    if (c === 'สรุป') { need('ถาม'); return morningText_().replace('สรุปเช้านี้', 'สรุปตอนนี้'); }
    if (c === 'รอทำความสะอาด' || (c === 'ทำความสะอาด' && !a.length)) { need('ถาม'); const w = readAll_('Rooms').filter(r => r.cleanStatus === 'รอทำ').sort((x, y) => roomSort_(x.room, y.room));
      return w.length ? '🧹 รอทำความสะอาด ' + w.length + ' ห้อง\n' + w.map(r => '• ห้อง ' + r.room + (r.cleanNote ? ' — ' + r.cleanNote : '') + (activeTenant_(r.room) ? ' (มีผู้เช่า)' : '') + (r.cleanSince ? ' · สั่ง ' + r.cleanSince.slice(8) + '/' + r.cleanSince.slice(5, 7) : '')).join('\n') : '✅ ไม่มีห้องรอทำความสะอาดครับ'; }
    if (c === 'งานซ่อม') { need('ถาม'); const reps = readAll_('Repairs').filter(x => x.status === ST.R_NEW || x.status === ST.R_DOING).sort((x, y) => roomSort_(x.room, y.room)), fix = readAll_('Rooms').filter(r => r.status === ST.FIX);
      if (!reps.length && !fix.length) return '✅ ไม่มีงานซ่อมค้างครับ';
      return (reps.length ? '🛠️ งานซ่อมค้าง ' + reps.length + ' งาน\n' + reps.map(x => '• ห้อง ' + x.room + ' ' + x.detail.slice(0, 50) + ' (' + x.status + ')').join('\n') : '') + (fix.length ? (reps.length ? '\n' : '') + '🔧 ห้องปิดซ่อม: ' + fix.map(r => r.room + (r.fixLevel === 'หนัก' ? '(หนัก)' : '') + (r.fixNote ? ' ' + r.fixNote.slice(0, 30) : '')).join(', ') : ''); }
    if (c === 'การจอง') { need('ถาม'); const b = readAll_('Rooms').filter(r => r.status === ST.RES).sort((x, y) => String(x.bookAt).localeCompare(String(y.bookAt)));
      return b.length ? '📅 ห้องที่จอง ' + b.length + ' ห้อง\n' + b.map(r => '• ห้อง ' + r.room + ' ' + (r.bookName || '') + (r.bookAt ? ' · เข้า ' + r.bookAt : '') + (r.bookPhone ? ' · ' + r.bookPhone : '')).join('\n') : 'ไม่มีห้องที่จองไว้ครับ'; }
    if (c === 'ค้น') { need('ถาม'); const q = a.join(' ').toLowerCase(); if (!q) throw new Error('ตัวอย่าง: ค้น ฝ้า'); return botSearch_(q); }
    // พิมพ์คำสั้นๆ ที่มีอยู่ในหมายเหตุ เช่น “กลิ่นอับ” “ห้องไหนกลิ่นฉี่” → ตอบว่าห้องไหนบันทึกไว้
    if (on.indexOf('ถาม') >= 0) { const kq = botKeyword_(text, called); if (kq) { const r = botNoteHits_(kq); if (r) return r; } }
    if (called) return '🤔 ไม่เข้าใจคำสั่ง “' + text.slice(0, 40) + '”\nลองพิมพ์: ค้น ' + text.split(' ')[0].slice(0, 20) + '\nหรือพิมพ์ คำสั่ง เพื่อดูทั้งหมด';
    return null; // ไม่ใช่คำสั่ง → ไม่ตอบ
  } finally { BOT_CTX.on = false; }
}
function botRoomInfo_(r) {
  const t = activeTenant_(r.room), L = ['🚪 ห้อง ' + r.room + (t ? ' · ' + t.name : ' · ' + r.status)];
  if (t) {
    const o = bills_().filter(b => b.tenantId === t.id && (b.status === ST.DUE || b.status === ST.REVIEW));
    L.push(o.length ? '⏰ ค้าง ' + o.length + ' บิล ' + fmtNum_(o.reduce((a, b) => a + Number(b.total), 0)) + ' บาท' : '✅ จ่ายครบ');
    if (t.phone) L.push('📞 ' + t.phone); if (t.endDate) L.push('📄 สัญญาถึง ' + t.endDate);
  }
  if (r.status === ST.RES) L.push('📅 จอง: ' + (r.bookName || '') + ' ' + (r.bookAt || ''));
  if (r.status === ST.FIX) L.push((r.fixLevel === 'หนัก' ? '🧱 ซ่อมหนัก: ' : '🔧 ซ่อม: ') + (r.fixNote || ''));
  if (r.cleanStatus === 'รอทำ') L.push('🧹 รอทำความสะอาด' + (r.cleanNote ? ': ' + r.cleanNote : ''));
  const it = parseItems_(r), bad = Object.keys(it).filter(k => it[k].s === 'ขาด' || it[k].s === 'ชำรุด');
  if (bad.length) L.push('🛏️ ' + bad.map(k => (it[k].s === 'ขาด' ? '❌ ขาด' : '⚠️ ชำรุด') + k + (it[k].n ? ' (' + it[k].n + ')' : '')).join(', '));
  const reps = readAll_('Repairs').filter(x => x.room === r.room && (x.status === ST.R_NEW || x.status === ST.R_DOING));
  if (reps.length) L.push('🛠️ งานซ่อมค้าง: ' + reps.map(x => x.detail.slice(0, 40)).join(' / '));
  if (r.note) L.push('📝 ' + r.note);
  return L.join('\n');
}
const BOT_STOP = /^(ok|okay|โอเค|โอเคร|ได้|ได้เลย|ขอบคุณ|ขอบใจ|ครับ|ค่ะ|คะ|จ้า|จ้ะ|555+|ใช่|ไม่|ยัง|แล้ว|รับทราบ|ทราบ|เค|เคๆ|อืม|ดี|ดีมาก|สวัสดี|ห้อง|ซ่อม|จ่าย|บิล)$/i;
function botKeyword_(t, called) {
  let q = String(t || '').trim().replace(/^(ห้องไหน|ห้องที่|ห้องอะไร|มีห้องไหน|ที่ไหน)\s*(มี|บ้าง|ที่มี)?\s*/, '').replace(/\s*(บ้าง|อยู่|ห้องไหน|ที่ไหน)$/, '').trim();
  if (!q || q.length < 2 || BOT_STOP.test(q) || /^\d+$/.test(q)) return '';
  if (!called && (q.split(' ').length > 3 || q.length > 30)) return ''; // ประโยคยาว = คุยกันทั่วไป
  return q.toLowerCase();
}
// ค้นทุกช่องหมายเหตุ/รายละเอียดในระบบ จัดกลุ่มตามห้อง · ไม่พบ → คืนค่าว่าง (บอทเงียบ)
function botNoteHits_(q) {
  const has = x => String(x || '').toLowerCase().indexOf(q) >= 0, by = {}, add = (room, x) => (by[room || '-'] = by[room || '-'] || []).push(x);
  readAll_('Rooms').forEach(r => {
    if (has(r.note)) add(r.room, '📝 ' + r.note);
    if (r.status === ST.FIX && has(r.fixNote)) add(r.room, (r.fixLevel === 'หนัก' ? '🧱 ซ่อมหนัก: ' : '🔧 ซ่อม: ') + r.fixNote);
    if (r.cleanStatus === 'รอทำ' && has(r.cleanNote)) add(r.room, '🧹 ' + r.cleanNote);
    if (r.status === ST.RES && has(r.bookNote)) add(r.room, '📅 ' + r.bookNote);
    const it = parseItems_(r); Object.keys(it).forEach(k => { if (has(it[k].n) || (it[k].s && it[k].s !== 'มี' && has(k))) add(r.room, '🛏️ ' + k + (it[k].s ? ' (' + it[k].s + ')' : '') + (it[k].n ? ': ' + it[k].n : '')); });
  });
  readAll_('Repairs').forEach(x => { if (has(x.detail) || has(x.ownerMsg) || has(x.outcome)) add(x.room, '🛠️ ' + x.createdAt.slice(8, 10) + '/' + x.createdAt.slice(5, 7) + ' ' + String(x.detail).slice(0, 60) + ' (' + x.status + ')'); });
  readAll_('Tenants').forEach(t => { if (t.status === ST.ACTIVE && has(t.note)) add(t.room, '👤 ' + t.note); });
  readAll_('Expenses').forEach(e => { if (has(e.note) || has(e.category)) add('', '💸 ' + e.date + ' ' + e.category + ' ' + fmtNum_(e.amount) + (e.note ? ' · ' + e.note : '')); });
  const rooms = Object.keys(by).filter(k => k !== '-').sort(roomSort_);
  if (!rooms.length && !by['-']) return '';
  const L = ['🔎 “' + q + '” พบใน ' + rooms.length + ' ห้อง'];
  rooms.slice(0, 20).forEach(k => { L.push('🚪 ห้อง ' + k); by[k].slice(0, 4).forEach(x => L.push('   ' + x)); });
  if (rooms.length > 20) L.push('…และอีก ' + (rooms.length - 20) + ' ห้อง');
  if (by['-']) { L.push('📌 อื่นๆ'); by['-'].slice(0, 5).forEach(x => L.push('   ' + x)); }
  return L.join('\n');
}
function botSearch_(q) {
  const has = x => String(x || '').toLowerCase().indexOf(q) >= 0, H = [];
  readAll_('Rooms').forEach(r => {
    if (has(r.note)) H.push('🚪 ห้อง ' + r.room + ' หมายเหตุ: ' + r.note);
    if (r.status === ST.FIX && has(r.fixNote)) H.push('🔧 ห้อง ' + r.room + ' ซ่อม: ' + r.fixNote);
    if (r.cleanStatus === 'รอทำ' && has(r.cleanNote)) H.push('🧹 ห้อง ' + r.room + ': ' + r.cleanNote);
    const it = parseItems_(r); Object.keys(it).forEach(k => { if (has(it[k].n) || (it[k].s && it[k].s !== 'มี' && (has(k) || has(it[k].s)))) H.push('🛏️ ห้อง ' + r.room + ' ' + k + ' ' + (it[k].s || '') + (it[k].n ? ': ' + it[k].n : '')); });
  });
  readAll_('Repairs').forEach(x => { if (has(x.detail) || has(x.ownerMsg) || has(x.category)) H.push('🛠️ ' + x.createdAt.slice(0, 10) + ' ห้อง ' + x.room + ': ' + x.detail.slice(0, 60) + ' (' + x.status + ')'); });
  readAll_('Expenses').forEach(e => { if (has(e.category) || has(e.note)) H.push('💸 ' + e.date + ' ' + e.category + ' ' + fmtNum_(e.amount) + ' บาท' + (e.note ? ' · ' + e.note : '')); });
  readAll_('Tenants').forEach(t => { if (has(t.note)) H.push('👤 ห้อง ' + t.room + ' ' + t.name + ': ' + t.note); });
  const chat = readAll_('ChatLog').filter(m => has(m.text) && !/^ค้น\s/.test(m.text)).reverse().slice(0, 10);
  const L = [];
  if (H.length) L.push('📂 ในระบบ (' + H.length + ')', ...H.slice(0, 10).map(x => '• ' + x));
  if (chat.length) L.push((L.length ? '\n' : '') + '💬 ในแชทกลุ่ม (' + chat.length + (chat.length === 10 ? '+' : '') + ')', ...chat.map(m => '• ' + m.at.slice(8, 10) + '/' + m.at.slice(5, 7) + ' ' + m.at.slice(11, 16) + ' ' + m.name + ': ' + m.text.slice(0, 120)));
  return L.length ? '🔎 ค้น "' + q + '"\n' + L.join('\n') : '🔎 ไม่พบ "' + q + '" ในระบบและในแชทครับ';
}
function trimChatLog_(s) {
  const days = Number(s.botLogDays) || 180, cut = addDays_(today_(), -days);
  if (readAll_('ChatLog').some(m => m.at.slice(0, 10) < cut)) keepRows_('ChatLog', m => m.at.slice(0, 10) >= cut);
}
function api_clearChatLog() { keepRows_('ChatLog', () => false); }
function api_botTest() { const m = morningText_(); if (!pushLine_('✅ ทดสอบบอทดูแลตึก\n\n' + m)) throw new Error('ส่ง LINE ไม่สำเร็จ — ตรวจสอบ token และ Group ID'); }

/* ============================ LINE OA ฝั่งผู้เช่า / ลูกค้า (ไทย · English) ============================ */
const TX = {
  th: {
    welcome: '👋 สวัสดีครับ ยินดีต้อนรับสู่ {b}\n\n🏠 สนใจเช่าห้อง: กดเมนู “ห้องว่าง / ราคา” หรือ “นัดดูห้อง”\n🔑 ผู้เช่า: สแกน QR ที่ได้รับตอนทำสัญญา หรือพิมพ์\nลงทะเบียน เลขห้อง รหัสผู้เช่า\n\n🌐 For English, tap “English” or type EN',
    regOk: '✅ ลงทะเบียนสำเร็จ', regRoom: 'ห้อง', regName: 'ผู้เช่า', regUntil: 'สัญญาถึง', regHint: 'ใช้เมนูด้านล่างเพื่อดูบิล ส่งสลิป และแจ้งซ่อมได้เลยครับ 👇',
    regBad: '⚠️ เลขห้องหรือรหัสผู้เช่าไม่ถูกต้อง\nตัวอย่าง: ลงทะเบียน 203 482915', regLock: '⚠️ ใส่รหัสผิดหลายครั้ง กรุณารอ 15 นาที หรือติดต่อเจ้าของตึก',
    needReg: '🔑 เมนูนี้สำหรับผู้เช่า กรุณาลงทะเบียนก่อน\nสแกน QR ที่ได้รับตอนทำสัญญา หรือพิมพ์\nลงทะเบียน เลขห้อง รหัสผู้เช่า',
    noBill: '✅ ห้อง {r} ไม่มีบิลค้างครับ', billT: '🧾 ห้อง {r} · {t}', total: 'รวม', due: 'ครบกำหนด', overdue: 'เลยกำหนด {d} วัน', review: 'ส่งสลิปแล้ว รอตรวจสอบ',
    payBtn: 'ดูบิล / สแกนจ่าย QR', slipBtn: 'ส่งสลิป', lastPaid: 'บิลล่าสุดชำระแล้ว', receiptBtn: 'ดูใบเสร็จ',
    slipAsk: '💳 ส่งรูปสลิปโอนเงินในแชทนี้ได้เลยครับ\nบิลที่ค้าง: {x}', slipGot: '📥 ได้รับสลิปแล้วครับ\nห้อง {r} · {a} บาท\nรอเจ้าของตึกตรวจสอบ', slipDup: '\n⚠️ สลิปนี้เคยส่งแล้ว',
    imgNoBill: 'ห้อง {r} ไม่มีบิลค้างครับ ถ้าเป็นรูปแจ้งซ่อม กดเมนู “แจ้งซ่อม” ก่อนแล้วส่งรูปอีกครั้ง',
    repAsk: '🔧 พิมพ์รายละเอียดที่ต้องการซ่อมได้เลยครับ\nเช่น แอร์ไม่เย็น มีน้ำหยด\n(ส่งรูปตามมาได้)', repOk: '🔧 รับแจ้งซ่อมแล้ว', repDetail: 'รายละเอียด', repPhoto: '📷 ส่งรูปตามมาได้ภายใน 15 นาที',
    repPhotoOk: '📷 แนบรูปกับงานซ่อมแล้วครับ', repNone: '✅ ห้อง {r} ไม่มีงานซ่อมค้างครับ', repList: '🛠️ งานซ่อมห้อง {r}',
    repUpd: '🛠️ อัปเดตงานซ่อม ห้อง {r}', st: { 'รอดำเนินการ': 'รับเรื่องแล้ว', 'กำลังซ่อม': 'กำลังซ่อม', 'เสร็จแล้ว': 'ซ่อมเสร็จแล้ว ✅', 'ซ่อมไม่ได้': 'ซ่อมไม่ได้' }, appoint: 'นัดช่าง',
    roomT: '📄 ห้อง {r}', rent: 'ค่าเช่า/เดือน', start: 'เริ่มสัญญา', end: 'สิ้นสุดสัญญา', deposit: 'เงินประกัน', baht: 'บาท',
    contactT: '📞 ติดต่อ {b}', phone: 'โทร', line: 'LINE', addr: 'ที่อยู่',
    newsT: '📢 ประกาศจากตึก', newsNone: 'ยังไม่มีประกาศครับ',
    paidT: '✅ ชำระเงินเรียบร้อย', bill: 'บิล', amount: 'ยอด', receipt: 'ใบเสร็จ', rejectT: '⚠️ สลิปไม่ผ่านการตรวจสอบ', reason: 'เหตุผล', rejectHint: 'กรุณาส่งสลิปใหม่ หรือติดต่อเจ้าของตึก',
    billNew: '🧾 บิล{t} ห้อง {r} ออกแล้ว\nยอด {a} บาท · ครบกำหนด {d}\nกดเมนู “บิลของฉัน” เพื่อดูและสแกนจ่าย', remind1: '⏰ แจ้งเตือนห้อง {r}\nบิล{t} ครบกำหนดพรุ่งนี้ ({d})\nยอด {a} บาท · กด “บิลของฉัน” เพื่อสแกนจ่าย',
    remindOver: '⏰ ห้อง {r} บิล{t} เลยกำหนด {n} วัน\nยอด {a} บาท · กด “บิลของฉัน” เพื่อสแกนจ่าย หรือติดต่อเจ้าของตึก',
    vacT: '🏠 ห้องว่างตอนนี้', vacN: 'ว่าง {n} ห้อง', vacNone: 'ตอนนี้ห้องเต็มครับ ฝากชื่อและเบอร์ไว้ได้ จะแจ้งเมื่อมีห้องว่าง', from: 'ค่าเช่าเริ่มต้น', perM: 'บาท/เดือน',
    viewAsk: '📅 นัดดูห้อง พิมพ์ตามนี้ได้เลยครับ\nนัดดูห้อง ชื่อ เบอร์โทร วัน เวลา\nเช่น นัดดูห้อง สมชาย 0812345678 พรุ่งนี้ 18:00', viewOk: '📅 รับนัดดูห้องแล้วครับ\n{x}\nเจ้าของตึกจะติดต่อกลับเพื่อยืนยัน',
    viewT: '📅 นัดดูห้อง', viewForm: 'กดปุ่มด้านล่าง แล้วกรอกชื่อ เบอร์โทร และวันเวลาที่สะดวกครับ', viewBtn: 'กรอกข้อมูลนัดดูห้อง', vwT: '📅 นัดดูห้องของคุณ', vwCode: 'รหัสนัด', vwName: 'ชื่อ', vwWhen: 'วันเวลา', vwSt: 'สถานะ', vwWait: 'เจ้าของตึกจะติดต่อกลับเพื่อยืนยันนัดครับ', vwOkNote: 'ยืนยันนัดแล้ว แล้วพบกันครับ 🙏', viewNo: 'ไม่พบรหัสนัดนี้ครับ ลองกรอกฟอร์มนัดดูห้องอีกครั้ง หรือโทรหาเรา',
    vacList: 'ห้องที่ว่าง', vacClean: '(กำลังทำความสะอาด)', rentL: 'ค่าเช่า', water: 'ค่าน้ำ', elec: 'ค่าไฟฟ้า', perUnit: 'บาท/หน่วย', moveIn: 'ค่าแรกเข้าทั้งหมด', depL: 'เงินประกัน', advL: 'เงินค่าเช่าล่วงหน้า', keyL: 'ค่ากุญแจ', cardL: 'ค่าคีย์การ์ด', sumL: 'รวมทั้งหมด',
    mapT: '📍 แผนที่ {b}', mapBtn: 'เปิด Google Maps', langSet: '🇹🇭 เปลี่ยนเป็นภาษาไทยแล้วครับ',
    help: '📋 พิมพ์หรือกดเมนู: บิลของฉัน · ส่งสลิป · แจ้งซ่อม · สถานะซ่อม · ห้อง/สัญญา · ประกาศ · ติดต่อ · English',
    unlinked: '🚪 ห้อง {r} ย้ายออกแล้ว ขอบคุณที่ใช้บริการครับ 🙏',
  },
  en: {
    welcome: '👋 Welcome to {b}\n\n🏠 Looking for a room? Tap “Rooms & Prices” or “Book a viewing”\n🔑 Tenants: scan the QR code from your lease, or type\nregister ROOM PIN\n\n🌐 ภาษาไทย: กด “ภาษาไทย” หรือพิมพ์ TH',
    regOk: '✅ Registered', regRoom: 'Room', regName: 'Tenant', regUntil: 'Lease ends', regHint: 'Use the menu below to see bills, send slips and report repairs 👇',
    regBad: '⚠️ Room number or PIN is incorrect\nExample: register 203 482915', regLock: '⚠️ Too many wrong attempts. Please wait 15 minutes or contact the owner',
    needReg: '🔑 This menu is for tenants. Please register first:\nscan the QR code from your lease, or type\nregister ROOM PIN',
    noBill: '✅ Room {r} has no unpaid bills', billT: '🧾 Room {r} · {t}', total: 'Total', due: 'Due', overdue: '{d} days overdue', review: 'Slip received, being checked',
    payBtn: 'View bill / Pay by QR', slipBtn: 'Send slip', lastPaid: 'Latest bill is paid', receiptBtn: 'View receipt',
    slipAsk: '💳 Send a photo of your transfer slip in this chat\nUnpaid bill: {x}', slipGot: '📥 Slip received\nRoom {r} · {a} THB\nThe owner will check it shortly', slipDup: '\n⚠️ This slip was sent before',
    imgNoBill: 'Room {r} has no unpaid bills. If this photo is for a repair, tap “Repair” first and send it again',
    repAsk: '🔧 Please type what needs fixing\ne.g. air-con not cold, water dripping\n(you can send photos after)', repOk: '🔧 Repair request received', repDetail: 'Details', repPhoto: '📷 You can send photos within 15 minutes',
    repPhotoOk: '📷 Photo added to your repair request', repNone: '✅ Room {r} has no open repairs', repList: '🛠️ Repairs · Room {r}',
    repUpd: '🛠️ Repair update · Room {r}', st: { 'รอดำเนินการ': 'Received', 'กำลังซ่อม': 'In progress', 'เสร็จแล้ว': 'Done ✅', 'ซ่อมไม่ได้': 'Cannot be repaired' }, appoint: 'Technician visit',
    roomT: '📄 Room {r}', rent: 'Rent / month', start: 'Lease start', end: 'Lease end', deposit: 'Deposit', baht: 'THB',
    contactT: '📞 Contact {b}', phone: 'Phone', line: 'LINE', addr: 'Address',
    newsT: '📢 Building announcements', newsNone: 'No announcements yet',
    paidT: '✅ Payment received', bill: 'Bill', amount: 'Amount', receipt: 'Receipt', rejectT: '⚠️ Slip not accepted', reason: 'Reason', rejectHint: 'Please send a new slip or contact the owner',
    billNew: '🧾 New bill · Room {r} ({t})\nAmount {a} THB · Due {d}\nTap “My bill” to view and pay', remind1: '⏰ Reminder · Room {r}\nYour bill ({t}) is due tomorrow ({d})\nAmount {a} THB · Tap “My bill” to pay',
    remindOver: '⏰ Room {r}: bill ({t}) is {n} days overdue\nAmount {a} THB · Tap “My bill” to pay or contact the owner',
    vacT: '🏠 Available rooms', vacN: '{n} rooms available', vacNone: 'We are fully booked right now. Leave your name and phone and we will let you know', from: 'Rent from', perM: 'THB / month',
    viewAsk: '📅 To book a viewing, type:\nviewing NAME PHONE DATE TIME\ne.g. viewing John 0812345678 tomorrow 18:00', viewOk: '📅 Viewing request received\n{x}\nThe owner will contact you to confirm',
    viewT: '📅 Book a viewing', viewForm: 'Tap the button below and fill in your name, phone and preferred time', viewBtn: 'Fill in viewing form', vwT: '📅 Your viewing', vwCode: 'Ref', vwName: 'Name', vwWhen: 'Date/time', vwSt: 'Status', vwWait: 'The owner will contact you to confirm', vwOkNote: 'Your viewing is confirmed. See you soon 🙏', viewNo: 'Viewing not found. Please fill in the form again or call us',
    vacList: 'Available', vacClean: '(being cleaned)', rentL: 'Rent', water: 'Water', elec: 'Electricity', perUnit: 'THB/unit', moveIn: 'Move-in costs', depL: 'Deposit', advL: 'Advance rent', keyL: 'Key deposit', cardL: 'Key card', sumL: 'Total',
    mapT: '📍 Map · {b}', mapBtn: 'Open Google Maps', langSet: '🇬🇧 Switched to English',
    help: '📋 Type or tap: My bill · Send slip · Repair · Repair status · My room · News · Contact · ภาษาไทย',
    unlinked: '🚪 Room {r} has moved out. Thank you for staying with us 🙏',
  },
};
function tx_(lang, k, v) { let s = (TX[lang] || TX.th)[k]; if (s == null) s = TX.th[k] || k; if (typeof s === 'string' && v) Object.keys(v).forEach(x => { s = s.split('{' + x + '}').join(String(v[x])); }); return s; }
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dateL_(d, lang) { if (!isDate_(String(d || '').slice(0, 10))) return '-'; d = String(d).slice(0, 10); return lang === 'en' ? Number(d.slice(8)) + ' ' + MON_EN[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4) : Number(d.slice(8)) + ' ' + TH_MS[+d.slice(5, 7) - 1] + ' ' + String(+d.slice(0, 4) + 543).slice(2); }
function billTitleL_(b, lang) { if (lang !== 'en') return billTitle_(b).replace(/^บิล/, ''); return b.kind === KIND.MONTH ? MON_EN[+b.month.slice(5, 7) - 1] + ' ' + b.month.slice(0, 4) : ({ 'พิเศษ': 'Extra charge', 'แรกเข้า': 'Move-in', 'ย้ายออก': 'Move-out' })[b.kind] || b.kind; }
function txt_(t) { return { type: 'text', text: String(t).slice(0, 4900) }; }
// การ์ด Flex: rows = [ [ชื่อ, ค่า, ตัวหนา?, สี?] | 'ข้อความ' ], btns = [{label, uri | text, primary}]
function card_(alt, title, color, rows, btns) {
  const T = x => String(x == null || x === '' ? '-' : x);
  const bubble = { type: 'bubble', size: 'kilo',
    header: { type: 'box', layout: 'vertical', backgroundColor: color, paddingAll: '12px', contents: [{ type: 'text', text: T(title), color: '#ffffff', weight: 'bold', size: 'md', wrap: true }] },
    body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: (rows.length ? rows : ['-']).map(r => r && r.sep ? { type: 'separator', margin: 'md' }
      : r && r.h ? { type: 'text', text: T(r.h), wrap: true, size: 'sm', weight: 'bold', color: '#111111', margin: 'md' }
      : typeof r === 'string'
      ? { type: 'text', text: T(r), wrap: true, size: 'sm', color: '#555555' }
      : { type: 'box', layout: 'horizontal', contents: [{ type: 'text', text: T(r[0]), size: 'sm', color: '#777777', flex: 4, wrap: true }, { type: 'text', text: T(r[1]), size: r[2] ? 'md' : 'sm', align: 'end', flex: 6, wrap: true, weight: r[2] ? 'bold' : 'regular', color: r[3] || '#111111' }] }) } };
  if (btns && btns.length) bubble.footer = { type: 'box', layout: 'vertical', spacing: 'sm', contents: btns.map(b => ({ type: 'button', style: b.primary ? 'primary' : 'link', height: 'sm', color: b.primary ? color : undefined,
    action: b.uri ? { type: 'uri', label: String(b.label).slice(0, 40), uri: b.uri } : { type: 'message', label: String(b.label).slice(0, 40), text: b.text } })) };
  return { type: 'flex', altText: String(alt).slice(0, 380), contents: bubble };
}
function lineReplyMsgs_(token, msgs) { if (token && msgs && msgs.length) lineApi_('/v2/bot/message/reply', { replyToken: token, messages: msgs.slice(0, 5) }); }
function pushUser_(uid, msgs) { return uid ? !!lineApi_('/v2/bot/message/push', { to: uid, messages: msgs.slice(0, 5) }) : false; }
function tNotifyOn_(k) { const s = getSettings_(); return s.botOn !== '0' && !!s.lineToken && String(s.tNotify || '').split(',').map(x => x.trim()).indexOf(k) >= 0; }
function lineUsers_() { return readAll_('LineUsers'); }
function lineUser_(uid) { return lineUsers_().filter(u => u.userId === uid)[0]; }
function upsertLineUser_(uid, patch) {
  const ex = lineUser_(uid), o = Object.assign({ userId: uid, room: '', tenantId: '', displayName: '', lang: 'th', createdAt: now_() }, ex || {}, patch, { updatedAt: now_() });
  writeRow_('LineUsers', o, ex && ex._row); return o;
}
// ส่งถึงผู้เช่าทุกคนที่ผูก LINE กับผู้เช่ารายนี้ · fn(lang) คืนข้อความ
function pushTenant_(tenantId, fn) {
  if (!tenantId) return 0; let n = 0;
  lineUsers_().filter(u => u.tenantId === tenantId).forEach(u => { if (pushUser_(u.userId, [].concat(fn(u.lang === 'en' ? 'en' : 'th')))) n++; });
  return n;
}
function appLink_(page, extra) {
  const base = String(getSettings_().appUrl || ''); if (!base) return '';
  try { const m = base.match(/^(.*\/)([^\/?#]*)(\?[^#]*)?/); const q = (m[3] || '').replace(/^\?/, ''); return m[1] + page + '?' + [q, extra].filter(Boolean).join('&'); } catch (e) { return ''; }
}
function billLink_(b, lang) { return b.token ? appLink_('bill.html', 't=' + b.token + (lang === 'en' ? '&lang=en' : '')) : ''; }
function regLink_(room, pin, lang) {
  const id = String(getSettings_().lineOaId || '').trim(); if (!id) return '';
  return 'https://line.me/R/oaMessage/' + encodeURIComponent(id.charAt(0) === '@' ? id : '@' + id) + '/?' + encodeURIComponent((lang === 'en' ? 'register ' : 'ลงทะเบียน ') + room + ' ' + pin);
}
function userEvent_(ev, s) {
  const uid = (ev.source || {}).userId; if (!uid) return;
  const rt = ev.replyToken, u = lineUser_(uid), lang = u && u.lang === 'en' ? 'en' : 'th', b = s.buildingName || s.apartmentName || 'ตึก';
  const t = u && u.tenantId ? readAll_('Tenants').filter(x => x.id === u.tenantId && x.status === ST.ACTIVE)[0] : null;
  if (ev.type === 'follow') {
    const p = lineApi_('/v2/bot/profile/' + uid, null, 'get');
    withLock_(() => upsertLineUser_(uid, { displayName: (p && p.displayName) || '' }));
    if (u && u.tenantId && t) linkMenuFor_(uid, 'tenant', lang);
    return lineReplyMsgs_(rt, [txt_(tx_(lang, 'welcome', { b }))]);
  }
  if (ev.type !== 'message' || !ev.message) return;
  if (s.botOn === '0') return;
  if (ev.message.type === 'image') return userImage_(ev, u, t, lang);
  if (ev.message.type !== 'text') return;
  const raw = String(ev.message.text || '').trim(), x = raw.replace(/\s+/g, ' ').replace(/[?？!]+$/, '').trim(), lx = x.toLowerCase();
  const out = m => lineReplyMsgs_(rt, [].concat(m).map(v => typeof v === 'string' ? txt_(v) : v));
  // เปลี่ยนภาษา
  if (/^(english|eng|en|🌐 english|language)$/i.test(x)) { withLock_(() => upsertLineUser_(uid, { lang: 'en' })); linkMenuFor_(uid, t ? 'tenant' : 'guest', 'en'); return out(tx_('en', 'langSet')); }
  if (/^(ไทย|ภาษาไทย|th|thai|🌐 ภาษาไทย)$/i.test(x)) { withLock_(() => upsertLineUser_(uid, { lang: 'th' })); linkMenuFor_(uid, t ? 'tenant' : 'guest', 'th'); return out(tx_('th', 'langSet')); }
  // ลงทะเบียน
  const reg = x.match(/^(ลงทะเบียน|register)\s*(\S+)\s+(\d{4,8})$/i);
  if (reg) return out(registerLine_(uid, reg[2], reg[3], /^register/i.test(reg[1]) ? 'en' : lang, b));
  if (/^(ลงทะเบียน|ลงทะเบียนผู้เช่า|register|tenant register|i'?m a tenant)$/i.test(x)) return out(tx_(lang, 'needReg'));
  const mode = CacheService.getScriptCache().get('lm:' + uid) || '';
  const isCmd = c => c.test(lx);
  const C = {
    bill: /^(บิล|บิลของฉัน|ดูบิล|บิลค้าง|my bill|bill|bills|invoice)$/,
    slip: /^(ส่งสลิป|สลิป|แจ้งโอน|send slip|slip|pay|paid)$/,
    repair: /^(แจ้งซ่อม|ซ่อม|repair|report repair|fix)(\s+.+)?$/,
    status: /^(สถานะซ่อม|ติดตามซ่อม|งานซ่อม|repair status|status|my repairs)$/,
    room: /^(ห้อง\/สัญญา|ห้อง \/ สัญญา|ห้องของฉัน|สัญญา|ข้อมูลห้อง|my room|room|contract|lease)$/,
    news: /^(ประกาศ|ประกาศล่าสุด|ข่าว|news|announcements?)$/,
    contact: /^(ติดต่อ|ติดต่อเจ้าของ|ติดต่อเจ้าของตึก|contact|contact owner|call)$/,
    help: /^(เมนู|menu|help|คำสั่ง|วิธีใช้)$/,
    vacant: /^(ห้องว่าง|ห้องว่าง\/ราคา|ห้องว่าง \/ ราคา|ราคา|ค่าเช่า|ห้องเช่า|rooms?|vacant|available rooms?|rooms? & prices|price|prices)$/,
    view: /^(นัดดูห้อง|ดูห้อง|book a viewing|viewing|view room|visit)(\s+.+)?$/,
    map: /^(แผนที่|ที่ตั้ง|location|map|address)$/,
  };
  if (isCmd(C.contact)) {
    const t1 = s.lineTel1 || s.phone || '', t2 = s.lineTel2 || '', ad = s.lineAddr || s.address || '';
    const L = [[tx_(lang, 'phone'), t1 || '-', true]]; if (t2) L.push([tx_(lang, 'phone') + ' 2', t2, true]); if (ad) L.push([tx_(lang, 'addr'), ad]);
    return out(card_(tx_(lang, 'contactT', { b }), tx_(lang, 'contactT', { b }), '#334155', L, t1 ? [{ label: (lang === 'en' ? '📞 Call ' : '📞 โทร ') + t1, uri: 'tel:' + String(t1).replace(/[^\d+]/g, ''), primary: true }] : []));
  }
  if (isCmd(C.map)) { const mt = s.mapText || s.address || b, mu = s.mapUrl || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(mt)); return out(card_(tx_(lang, 'mapT', { b }), tx_(lang, 'mapT', { b }), '#0f766e', ['📍 ' + mt], [{ label: tx_(lang, 'mapBtn'), uri: mu, primary: true }])); }
  if (isCmd(C.news)) { const N = readAll_('News').sort((p, q) => q.createdAt.localeCompare(p.createdAt)).slice(0, 3); return out(N.length ? N.map(n => '📢 ' + n.title + (n.body ? '\n' + n.body : '') + '\n— ' + dateL_(n.createdAt, lang)).join('\n\n') : tx_(lang, 'newsNone')); }
  if (isCmd(C.help)) return out(tx_(lang, 'help'));
  // ลูกค้าที่ยังไม่ได้เป็นผู้เช่า
  if (isCmd(C.vacant)) return out(vacantCard_(s, lang, b));

  const vc = x.match(/^(ยืนยันนัด|ยืนยันนัดดูห้อง|confirm viewing|confirm)\s*#?\s*(V[A-Z0-9]{4,})$/i);
  if (vc) {
    const v = findBy_('Viewings', 'id', vc[2].toUpperCase());
    if (!v) return out(tx_(lang, 'viewNo'));
    if (!v.userId) withLock_(() => { v.userId = uid; v.lineName = (u && u.displayName) || (lineApi_('/v2/bot/profile/' + uid, null, 'get') || {}).displayName || ''; v.updatedAt = now_(); writeRow_('Viewings', v, v._row); });
    return out(viewCard_(v, lang, b));
  }
  const vw = lx.match(C.view);
  if (vw) {
    const d = raw.replace(/^\S+(\s+(a\s+viewing|room))?\s*/i, '').replace(/^ห้อง\s*/, '').trim(), fl = appLink_('viewing.html', lang === 'en' ? 'lang=en' : '');
    if (!d) return out(fl ? card_(tx_(lang, 'viewT'), tx_(lang, 'viewT'), '#15803d', [tx_(lang, 'viewForm')], [{ label: tx_(lang, 'viewBtn'), uri: fl, primary: true }]) : tx_(lang, 'viewAsk'));
    const who = (u && u.displayName) || '';
    const v = withLock_(() => addViewing_({ name: who || '-', phone: (d.match(/\+?\d[\d-]{8,13}\d/) || [''])[0].replace(/-/g, ''), at: '', note: d, lang, source: 'LINE', userId: uid, lineName: who, status: 'ใหม่' }));
    viewNotify_(v);
    return out(tx_(lang, 'viewOk', { x: d }));
  }

  // เมนูผู้เช่า
  const tenantCmd = isCmd(C.bill) || isCmd(C.slip) || isCmd(C.repair) || isCmd(C.status) || isCmd(C.room) || mode === 'repairAsk';
  if (!tenantCmd) return; // ข้อความอื่น: ให้เจ้าของตอบเองในแชท
  if (!t) return out(tx_(lang, 'needReg'));
  if (isCmd(C.bill) || isCmd(C.status) || isCmd(C.room)) CacheService.getScriptCache().remove('lm:' + uid);
  const open = bills_().filter(z => z.tenantId === t.id && (z.status === ST.DUE || z.status === ST.REVIEW)).sort((p, q) => (p.dueDate || '').localeCompare(q.dueDate || ''));
  if (isCmd(C.bill)) {
    if (!open.length) {
      const last = bills_().filter(z => z.tenantId === t.id && z.status === ST.PAID).sort((p, q) => (q.paidDate || '').localeCompare(p.paidDate || ''))[0];
      return out(last ? card_(tx_(lang, 'noBill', { r: t.room }), tx_(lang, 'noBill', { r: t.room }), '#15803d', [[tx_(lang, 'lastPaid'), billTitleL_(last, lang)], [tx_(lang, 'amount'), fmtNum_(last.total) + ' ' + tx_(lang, 'baht')], [tx_(lang, 'receipt'), last.receiptNo || '-']], billLink_(last, lang) ? [{ label: tx_(lang, 'receiptBtn'), uri: billLink_(last, lang) }] : []) : tx_(lang, 'noBill', { r: t.room }));
    }
    return out(open.slice(0, 3).map(z => {
      const od = z.dueDate && z.dueDate < today_() ? dayDiff_(z.dueDate, today_()) : 0, L = z.items.map(i => [i.l, fmtNum_(i.a)]);
      L.push([tx_(lang, 'total'), fmtNum_(z.total) + ' ' + tx_(lang, 'baht'), true]);
      L.push([tx_(lang, 'due'), dateL_(z.dueDate, lang) + (od ? ' · ' + tx_(lang, 'overdue', { d: od }) : ''), false, od ? '#c62828' : '#b45309']);
      if (z.status === ST.REVIEW) L.push(tx_(lang, 'review'));
      const btn = []; if (billLink_(z, lang)) btn.push({ label: tx_(lang, 'payBtn'), uri: billLink_(z, lang), primary: true });
      if (z.status === ST.DUE) btn.push({ label: tx_(lang, 'slipBtn'), text: lang === 'en' ? 'send slip' : 'ส่งสลิป' });
      return card_(tx_(lang, 'billT', { r: t.room, t: billTitleL_(z, lang) }) + ' ' + fmtNum_(z.total), tx_(lang, 'billT', { r: t.room, t: billTitleL_(z, lang) }), od ? '#c62828' : '#2457c5', L, btn);
    }));
  }
  if (isCmd(C.slip)) {
    const due = open.filter(z => z.status === ST.DUE);
    if (!due.length) return out(tx_(lang, 'noBill', { r: t.room }));
    CacheService.getScriptCache().put('lm:' + uid, 'slip', 900);
    return out(tx_(lang, 'slipAsk', { x: due.map(z => billTitleL_(z, lang) + ' ' + fmtNum_(z.total) + ' ' + tx_(lang, 'baht')).join(', ') }));
  }
  if (isCmd(C.status)) {
    const R = readAll_('Repairs').filter(z => z.room === t.room && z.tenantId === t.id).sort((p, q) => q.createdAt.localeCompare(p.createdAt)).slice(0, 5);
    if (!R.length || !R.some(z => z.status === ST.R_NEW || z.status === ST.R_DOING)) { if (!R.length) return out(tx_(lang, 'repNone', { r: t.room })); }
    return out(card_(tx_(lang, 'repList', { r: t.room }), tx_(lang, 'repList', { r: t.room }), '#334155', R.map(z => [dateL_(z.createdAt, lang) + ' · ' + String(z.detail).slice(0, 40), tx_(lang, 'st')[z.status] || z.status, false, z.status === ST.R_DONE ? '#15803d' : '#b45309'])));
  }
  if (isCmd(C.room)) {
    const room = findBy_('Rooms', 'room', t.room) || {};
    return out(card_(tx_(lang, 'roomT', { r: t.room }), tx_(lang, 'roomT', { r: t.room }), '#0f766e', [[tx_(lang, 'regName'), t.name], [tx_(lang, 'rent'), fmtNum_(room.rent) + ' ' + tx_(lang, 'baht')], [tx_(lang, 'start'), dateL_(t.startDate, lang)], [tx_(lang, 'end'), dateL_(t.endDate, lang)], [tx_(lang, 'deposit'), fmtNum_(t.deposit) + ' ' + tx_(lang, 'baht')]]));
  }
  // แจ้งซ่อม
  const rm = lx.match(C.repair), detail = mode === 'repairAsk' && !rm ? raw : rm ? raw.replace(/^\S+(\s+repair)?\s*/i, '').trim() : '';
  if (!detail) { CacheService.getScriptCache().put('lm:' + uid, 'repairAsk', 900); return out(tx_(lang, 'repAsk')); }
  const j = withLock_(() => api_createRepair({ repair: { room: t.room, detail, category: 'อื่นๆ', source: 'LINE ผู้เช่า' } }));
  withLock_(() => { const r = findBy_('Repairs', 'id', j.id); if (r) { r.tenantId = t.id; r.name = t.name; r.phone = t.phone; r.log = JSON.stringify([{ at: now_(), s: r.status, m: 'ผู้เช่าแจ้งผ่าน LINE' }]); writeRow_('Repairs', r, r._row); } });
  CacheService.getScriptCache().put('lm:' + uid, 'rep:' + j.id, 900);
  if (notifyOn_('repair')) pushLine_('🔧 แจ้งซ่อม ห้อง ' + t.room + ' (ผ่าน LINE)\n' + detail + '\n' + t.name + (t.phone ? ' · โทร ' + t.phone : ''));
  return out(card_(tx_(lang, 'repOk'), tx_(lang, 'repOk'), '#334155', [[tx_(lang, 'regRoom'), t.room, true], [tx_(lang, 'repDetail'), detail], [lang === 'en' ? 'Status' : 'สถานะ', tx_(lang, 'st')[ST.R_NEW]], tx_(lang, 'repPhoto')]));
}
function lineImage_(id) {
  const tok = getSettings_().lineToken;
  const res = UrlFetchApp.fetch('https://api-data.line.me/v2/bot/message/' + id + '/content', { headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('โหลดรูปจาก LINE ไม่ได้');
  const blob = res.getBlob(), mime = /png/.test(blob.getContentType()) ? 'image/png' : 'image/jpeg';
  return 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes());
}
function userImage_(ev, u, t, lang) {
  const uid = ev.source.userId, rt = ev.replyToken, c = CacheService.getScriptCache(), mode = c.get('lm:' + uid) || '';
  if (!t) return lineReplyMsgs_(rt, [txt_(tx_(lang, 'needReg'))]);
  if (/^rep:/.test(mode)) {
    const id = mode.slice(4), img = lineImage_(ev.message.id);
    withLock_(() => { const r = findBy_('Repairs', 'id', id); if (r) { const up = saveImage_(img, 'แจ้งซ่อม_' + r.room); if (!r.photoId) r.photoId = up.fileId; else r.ownerMsg = r.ownerMsg; const log = parseLog_(r); log.push({ at: now_(), s: r.status, m: 'ผู้เช่าส่งรูปเพิ่มทาง LINE' }); r.log = JSON.stringify(log); writeRow_('Repairs', r, r._row); } });
    return lineReplyMsgs_(rt, [txt_(tx_(lang, 'repPhotoOk'))]);
  }
  const due = bills_().filter(z => z.tenantId === t.id && z.status === ST.DUE).sort((p, q) => (p.dueDate || '').localeCompare(q.dueDate || ''));
  if (!due.length) return lineReplyMsgs_(rt, [txt_(tx_(lang, 'imgNoBill', { r: t.room }))]);
  const img = lineImage_(ev.message.id), b = due[0];
  withLock_(() => api_tenantSlip({ billId: b.id, image: img }, t));
  c.remove('lm:' + uid);
  const dup = (findBy_('Slips', 'id', billById_(b.id).slipId) || {}).result || '';
  return lineReplyMsgs_(rt, [txt_(tx_(lang, 'slipGot', { r: t.room, a: fmtNum_(b.total) }) + (/ซ้ำ/.test(dup) ? tx_(lang, 'slipDup') : ''))]);
}
function registerLine_(uid, room, pin, lang, bname) {
  const c = CacheService.getScriptCache(), k = 'lr:' + uid, n = Number(c.get(k) || 0);
  if (n >= 5) return tx_(lang, 'regLock');
  const t = readAll_('Tenants').filter(x => x.room === String(room) && x.status === ST.ACTIVE && String(x.pin) === String(pin))[0];
  if (!t) { c.put(k, String(n + 1), 900); return tx_(lang, 'regBad'); }
  c.remove(k);
  const p = lineApi_('/v2/bot/profile/' + uid, null, 'get'), name = (p && p.displayName) || '';
  withLock_(() => upsertLineUser_(uid, { room: t.room, tenantId: t.id, displayName: name, lang }));
  linkMenuFor_(uid, 'tenant', lang);
  if (notifyOn_('checkin')) pushLine_('🔗 ห้อง ' + t.room + ' ผูก LINE แล้ว · ' + t.name + (name ? ' (LINE: ' + name + ')' : ''));
  return card_(tx_(lang, 'regOk'), tx_(lang, 'regOk'), '#15803d', [[tx_(lang, 'regRoom'), t.room, true], [tx_(lang, 'regName'), t.name], [tx_(lang, 'regUntil'), dateL_(t.endDate, lang)], tx_(lang, 'regHint')]);
}
// ตัดการเชื่อม LINE ของผู้เช่าที่ย้ายออก (กลับเป็นเมนูลูกค้าทั่วไป)
function unlinkTenantLine_(tenantId, room) {
  lineUsers_().filter(u => u.tenantId === tenantId).forEach(u => {
    if (tNotifyOn_('paid') || tNotifyOn_('bill')) pushUser_(u.userId, [txt_(tx_(u.lang, 'unlinked', { r: room }))]);
    upsertLineUser_(u.userId, { room: '', tenantId: '' });
    linkMenuFor_(u.userId, 'guest', u.lang);
  });
}
function api_unlinkLine(req) { const u = lineUser_(String(req.userId || '')); if (!u) throw new Error('ไม่พบ'); upsertLineUser_(u.userId, { room: '', tenantId: '' }); linkMenuFor_(u.userId, 'guest', u.lang); }
/* ---- เมนูด้านล่างแชท (Rich menu) 4 ชุด: ผู้เช่า/ลูกค้า × ไทย/อังกฤษ ---- */
const RICH = {
  tenant_th: ['บิลของฉัน', 'ส่งสลิป', 'แจ้งซ่อม', 'สถานะซ่อม', 'ห้อง/สัญญา', 'ประกาศ', 'ติดต่อ', 'English'],
  tenant_en: ['My bill', 'Send slip', 'Repair', 'Repair status', 'My room', 'News', 'Contact', 'ภาษาไทย'],
  guest_th: ['ห้องว่าง/ราคา', 'นัดดูห้อง', 'แผนที่', 'ติดต่อ', 'ลงทะเบียนผู้เช่า', 'English'],
  guest_en: ['Rooms & prices', 'Book a viewing', 'Map', 'Contact', 'Tenant register', 'ภาษาไทย'],
};
function richIds_() { try { return JSON.parse(getSettings_().richIds || '{}') || {}; } catch (e) { return {}; } }
function linkMenuFor_(uid, kind, lang) {
  const id = richIds_()[kind + '_' + (lang === 'en' ? 'en' : 'th')]; if (!id) return;
  if (kind === 'guest' && lang !== 'en') lineApi_('/v2/bot/user/' + uid + '/richmenu', null, 'delete'); // ใช้เมนูเริ่มต้น
  else lineApi_('/v2/bot/user/' + uid + '/richmenu/' + id, {}, 'post');
}
function richAction_(k, i, t) {
  if (/^guest/.test(k) && i === 1) { const fl = appLink_('viewing.html', /_en$/.test(k) ? 'lang=en' : ''); if (fl) return { type: 'uri', label: t.slice(0, 20), uri: fl }; }
  return { type: 'message', text: t };
}
// การ์ดห้องว่าง + ค่าใช้จ่าย (ห้องว่าง + ห้องที่รอทำความสะอาด)
function vacantCard_(s, lang, b) {
  const v = readAll_('Rooms').filter(r => !activeTenant_(r.room) && r.status === ST.VAC).sort((x, y) => roomSort_(x.room, y.room));
  const info = lang === 'en' ? (s.guestInfoEn || s.guestInfo) : s.guestInfo;
  if (!v.length) return [txt_(tx_(lang, 'vacNone'))].concat(info ? [txt_(info)] : []);
  const rents = v.map(r => Number(r.rent) || 0).filter(Boolean), rent = rents.length ? Math.min.apply(null, rents) : 0;
  const dep = rent * (Number(s.depositMonths) || 0), adv = rent * (Number(s.advanceMonths) || 0), key = Number(s.keyDeposit) || 0, card = Number(s.cardFee) || 0, B = ' ' + tx_(lang, 'baht');
  const ready = v.filter(r => r.cleanStatus !== 'รอทำ').map(r => r.room), cl = v.filter(r => r.cleanStatus === 'รอทำ').map(r => r.room);
  const L = [{ h: tx_(lang, 'vacN', { n: v.length }) }];
  if (ready.length) L.push(ready.join(', '));
  if (cl.length) L.push(cl.join(', ') + ' ' + tx_(lang, 'vacClean'));
  L.push({ sep: 1 }, [tx_(lang, 'rentL'), fmtNum_(rent) + B, true], { sep: 1 },
    [tx_(lang, 'water'), fmtNum_(s.waterRate) + ' ' + tx_(lang, 'perUnit')], [tx_(lang, 'elec'), fmtNum_(s.elecRate) + ' ' + tx_(lang, 'perUnit')],
    { sep: 1 }, { h: tx_(lang, 'moveIn') });
  if (dep) L.push([tx_(lang, 'depL'), fmtNum_(dep) + B]); if (adv) L.push([tx_(lang, 'advL'), fmtNum_(adv) + B]);
  if (key) L.push([tx_(lang, 'keyL'), fmtNum_(key) + B]); if (card) L.push([tx_(lang, 'cardL'), fmtNum_(card) + B]);
  L.push({ sep: 1 }, [tx_(lang, 'sumL'), fmtNum_(dep + adv + key + card) + B, true, '#15803d']);
  if (info) L.push({ sep: 1 }, info);
  const fl = appLink_('viewing.html', lang === 'en' ? 'lang=en' : '');
  return card_(tx_(lang, 'vacT'), tx_(lang, 'vacT') + ' · ' + b, '#2457c5', L, [fl ? { label: tx_(lang, 'viewBtn'), uri: fl, primary: true } : { label: lang === 'en' ? 'Book a viewing' : 'นัดดูห้อง', text: lang === 'en' ? 'viewing' : 'นัดดูห้อง', primary: true }]);
}
// ฟอร์มนัดดูห้อง (หน้าเว็บ viewing.html) → แจ้งกลุ่มเจ้าของ
function api_requestViewing(req) {
  if (req.hp) return {}; // กันบอทสแปม
  const name = String(req.name || '').trim().slice(0, 60), phone = String(req.phone || '').replace(/[^\d+]/g, ''), at = String(req.at || '').trim().slice(0, 40), note = String(req.note || '').trim().slice(0, 300);
  const en = req.lang === 'en';
  if (!name) throw new Error(en ? 'Please enter your name' : 'กรุณากรอกชื่อ');
  if (!/^\+?\d{9,12}$/.test(phone)) throw new Error(en ? 'Please enter a valid phone number' : 'กรุณากรอกเบอร์โทรให้ถูกต้อง');
  if (!at) throw new Error(en ? 'Please choose a date and time' : 'กรุณาเลือกวันเวลาที่สะดวก');
  const c = CacheService.getScriptCache(), k1 = 'vw:' + phone, n1 = Number(c.get(k1) || 0), n2 = Number(c.get('vw:all') || 0);
  if (n1 >= 3 || n2 >= 40) throw new Error(en ? 'Too many requests. Please try again later or call us' : 'ส่งคำขอมากเกินไป กรุณาลองใหม่ภายหลัง หรือโทรหาเรา');
  c.put(k1, String(n1 + 1), 3600); c.put('vw:all', String(n2 + 1), 3600);
  const v = withLock_(() => addViewing_({ name, phone, at: at.replace('T', ' '), note, lang: en ? 'en' : 'th', source: 'ฟอร์ม', status: 'ใหม่' }));
  viewNotify_(v);
  const id = String(getSettings_().lineOaId || '').trim();
  const chat = id ? 'https://line.me/R/oaMessage/' + encodeURIComponent(id.charAt(0) === '@' ? id : '@' + id) + '/?' + encodeURIComponent((en ? 'confirm viewing ' : 'ยืนยันนัด ') + v.id) : '';
  return { id: v.id, chat };
}
function addViewing_(o) {
  const ids = readAll_('Viewings').map(x => x.id); let id;
  do { id = 'V' + Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, '0'); } while (ids.indexOf(id) >= 0);
  const v = Object.assign({ id, createdAt: now_(), updatedAt: now_() }, o);
  writeRow_('Viewings', v); return v;
}
function viewNotify_(v) { // นัดดูห้องแจ้งเข้ากลุ่มเสมอ (นานๆ ครั้งและสำคัญ)
  const s = getSettings_(); if (s.botOn === '0') return;
  pushLine_('📅 ลูกค้าขอนัดดูห้อง' + (v.lang === 'en' ? ' (English)' : '') + ' · ' + v.source + '\n👤 ' + v.name + (v.phone ? '\n📞 ' + v.phone : '') + (v.at ? '\n🕒 ' + fmtViewAt_(v.at, 'th') : '') + (v.note ? '\n📝 ' + v.note : '') + '\nรหัส ' + v.id + ' · ดู/ยืนยันในระบบ เมนู "นัดดูห้อง"');
}
function fmtViewAt_(at, lang) {
  const m = String(at || '').match(/^(\d{4})-(\d{2})-(\d{2})\s*(\d{1,2}:\d{2})?/); if (!m) return String(at || '-');
  const y = Number(m[1]); return Number(m[3]) + '/' + Number(m[2]) + '/' + (lang === 'en' ? y : String(y + 543).slice(-2)) + (m[4] ? ' ' + m[4] + (lang === 'en' ? '' : ' น.') : '');
}
const VIEW_ST = { 'ใหม่': ['รอยืนยัน', 'Pending'], 'ยืนยันแล้ว': ['ยืนยันแล้ว ✅', 'Confirmed ✅'], 'ดูแล้ว': ['ดูห้องแล้ว', 'Visited'], 'ยกเลิก': ['ยกเลิก', 'Cancelled'] };
function viewCard_(v, lang, b) {
  const en = lang === 'en', st = VIEW_ST[v.status] || VIEW_ST['ใหม่'];
  const L = [[tx_(lang, 'vwCode'), v.id, true], [tx_(lang, 'vwName'), v.name], [tx_(lang, 'phone'), v.phone || '-'], [tx_(lang, 'vwWhen'), fmtViewAt_(v.at, lang), true], [tx_(lang, 'vwSt'), st[en ? 1 : 0], true, v.status === 'ยืนยันแล้ว' ? '#15803d' : v.status === 'ยกเลิก' ? '#b91c1c' : '#b45309']];
  if (v.note) L.push(v.note);
  L.push({ sep: 1 }, tx_(lang, v.status === 'ยืนยันแล้ว' ? 'vwOkNote' : 'vwWait'));
  const s = getSettings_(), t1 = s.lineTel1 || s.phone || '';
  return card_(tx_(lang, 'vwT'), tx_(lang, 'vwT') + ' · ' + b, '#15803d', L, t1 ? [{ label: (en ? '📞 Call ' : '📞 โทร ') + t1, uri: 'tel:' + String(t1).replace(/[^\d+]/g, '') }] : []);
}
function api_saveViewing(req) {
  const v = findBy_('Viewings', 'id', String(req.id || '')); if (!v) throw new Error('ไม่พบนัดนี้');
  const old = v.status;
  ['status', 'at', 'note', 'name', 'phone'].forEach(k => { if (req[k] != null) v[k] = String(req[k]).slice(0, 300); });
  v.updatedAt = now_(); writeRow_('Viewings', v, v._row);
  let sent = false;
  if (v.userId && v.status !== old && (v.status === 'ยืนยันแล้ว' || v.status === 'ยกเลิก') && req.notify !== false) {
    const s = getSettings_(); sent = pushUser_(v.userId, [viewCard_(v, v.lang === 'en' ? 'en' : 'th', s.buildingName || s.apartmentName || '')]);
  }
  return { sent };
}
function api_deleteViewing(req) {
  const v = findBy_('Viewings', 'id', String(req.id || '')); if (!v) throw new Error('ไม่พบนัดนี้');
  deleteRow_('Viewings', v._row); return {};
}
function api_setupRichMenu(req) {
  const s = getSettings_(); if (!s.lineToken) throw new Error('ยังไม่ได้ใส่ Channel access token');
  const base = String(req.base || '').replace(/[?#].*$/, '').replace(/[^\/]*$/, ''); if (!/^https:\/\//.test(base)) throw new Error('ไม่พบที่อยู่เว็บของระบบ');
  const old = richIds_(), ids = {};
  Object.keys(old).forEach(k => { try { lineApi_('/v2/bot/richmenu/' + old[k], null, 'delete'); } catch (e) {} });
  Object.keys(RICH).forEach(k => {
    const L = RICH[k], cols = L.length === 8 ? 4 : 3, W = 2500, H = 1686, cw = Math.floor(W / cols), ch = H / 2;
    const areas = L.map((t, i) => ({ bounds: { x: (i % cols) * cw, y: Math.floor(i / cols) * ch, width: i % cols === cols - 1 ? W - (cols - 1) * cw : cw, height: ch }, action: richAction_(k, i, t) }));
    const m = lineApi_('/v2/bot/richmenu', { size: { width: W, height: H }, selected: true, name: 'dulaetuek_' + k, chatBarText: k.slice(-2) === 'en' ? 'Menu' : 'เมนู', areas });
    if (!m || !m.richMenuId) throw new Error('สร้างเมนูไม่สำเร็จ (' + k + ') — ตรวจสอบ token');
    const img = UrlFetchApp.fetch(base + 'richmenu-' + k.replace('_', '-') + '.jpg', { muteHttpExceptions: true });
    if (img.getResponseCode() !== 200) throw new Error('ไม่พบรูปเมนู richmenu-' + k.replace('_', '-') + '.jpg บน GitHub — อัปโหลดไฟล์รูปเมนูก่อน');
    const up = UrlFetchApp.fetch('https://api-data.line.me/v2/bot/richmenu/' + m.richMenuId + '/content', { method: 'post', contentType: 'image/jpeg', payload: img.getBlob().getBytes(), headers: { Authorization: 'Bearer ' + s.lineToken }, muteHttpExceptions: true });
    if (up.getResponseCode() !== 200) throw new Error('อัปโหลดรูปเมนูไม่สำเร็จ (' + k + ')');
    ids[k] = m.richMenuId;
  });
  setSetting_('richIds', JSON.stringify(ids));
  lineApi_('/v2/bot/user/all/richmenu/' + ids.guest_th, {}, 'post');
  let n = 0; lineUsers_().forEach(u => { if (u.tenantId) { linkMenuFor_(u.userId, 'tenant', u.lang); n++; } else if (u.lang === 'en') linkMenuFor_(u.userId, 'guest', 'en'); });
  return { result: { menus: Object.keys(ids).length, tenants: n } };
}
function api_lineQuota() {
  const q = lineApi_('/v2/bot/message/quota', null, 'get'), c = lineApi_('/v2/bot/message/quota/consumption', null, 'get');
  if (!q) throw new Error('ดึงโควตาไม่ได้ — ตรวจสอบ token');
  return { result: { type: q.type, limit: q.value || 0, used: (c && c.totalUsage) || 0 } };
}
// ส่งประกาศเข้า LINE ผู้เช่า (ทุกห้อง หรือเฉพาะชั้น)
function lineNews_(title, body, floors) {
  const fl = (floors || []).map(String), rooms = {}; readAll_('Rooms').forEach(r => { rooms[r.room] = String(r.floor || ''); });
  const us = lineUsers_().filter(u => u.tenantId && (!fl.length || fl.indexOf(rooms[u.room]) >= 0));
  let n = 0; us.forEach(u => { if (pushUser_(u.userId, [{ type: 'flex', altText: '📢 ' + title, contents: card_('📢', '📢 ' + title, '#f59e0b', body ? [body] : []).contents }])) n++; });
  return n;
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


/* ============================ เอกสาร: สัญญาเช่า / ใบรับเงินจอง + ลายเซ็น ============================ */
const CONTRACT_TH = `ข้อ 1 ผู้เช่าตกลงเช่าห้องพักเลขที่ {room} ตามสถานที่ดังกล่าวเบื้องต้นจำนวน 1 ห้อง มีกำหนดสัญญาเช่าอย่างน้อย {months} เดือน นับตั้งแต่วันเข้าพักอาศัย (วันที่ {start} ถึงวันที่ {end}) ในอัตราเดือนละ {rent} บาท ({rentText}) ซึ่งถือว่าเป็นค่าเช่าล่วงหน้า 1 เดือน และในแต่ละเดือนผู้เช่าต้องชำระค่าเช่าให้แก่ผู้ให้เช่าภายในวันที่ {dueDay} ของเดือน{common}
ข้อ 2 ผู้เช่าได้วางเงินประกัน ค่าน้ำประปา ค่าไฟฟ้า และค่าของชำรุดเสียหายให้แก่ผู้ให้เช่ายึดถือไว้เป็นจำนวนเงิน {deposit} บาท ({depositText}) เงินจำนวนนี้จะคืนให้แก่ผู้เช่าเมื่อผู้เช่าอยู่ครบตามสัญญาเช่า และกรณีที่ผู้เช่ามีความจำเป็นต้องย้ายออกจากห้องไม่ว่ากรณีใดๆ หลังจากครบสัญญาเช่าแล้ว ผู้เช่าต้องบอกกล่าวล่วงหน้าอย่างน้อย 1 เดือน หรือ 30 วัน มิฉะนั้นจะไม่ได้รับเงินประกันคืน
ข้อ 3 ผู้เช่าผิดสัญญาเช่าโดยชำระเงินค่าเช่าช้ากว่ากำหนด 5 วัน ผู้เช่าต้องชำระเงินค่าปรับวันละ 50 บาท และหากติดค้างค่าเช่าเป็นเวลานาน ผู้ให้เช่ามีสิทธิ์คล้องกุญแจห้องพักได้ทันที และเข้าครอบครองห้องพักได้ด้วย โดยไม่ต้องบอกกล่าว ในกรณีผู้เช่าทำให้ทรัพย์สินของผู้ให้เช่าเสียหาย หรือค้างค่าเช่าเมื่อหักกับเงินประกันในข้อ 2 แล้วยังไม่พอชำระ ผู้เช่ายินยอมให้ยึดทรัพย์สินในห้องพักออกขายทอดตลาดได้ทันทีโดยไม่มีข้อแม้ใดๆ ทั้งสิ้น
ข้อ 4 ผู้เช่าเป็นผู้ชำระค่าน้ำประปา และค่าไฟฟ้า ตามจำนวนที่ผู้เช่าใช้โดยมีมิเตอร์ติดตั้งไว้ให้ ค่าน้ำคิดหน่วยละ {water} บาท{waterMin} ค่าไฟคิดหน่วยละ {elec} บาท ในกรณีผู้เช่าติดค้างชำระค่าน้ำประปา ค่าไฟฟ้า ผู้เช่ายินยอมให้ตัดน้ำตัดไฟได้ทันทีโดยไม่ต้องบอกกล่าว และผู้เช่าจะไม่โต้แย้งใดๆ ทั้งสิ้น
ข้อ 5 ในห้องเช่าหนึ่งๆ มีทรัพย์สินของผู้ให้เช่าซึ่งได้มอบให้แก่ผู้เช่าไว้ใช้สอยดังนี้ ไฟฟ้านีออน 3 จุด ปลั๊กไฟฟ้า 3 จุด ปลั๊กต่อเคเบิ้ลทีวี 1 จุด พัดลมเพดาน 1 เครื่อง และสุขภัณฑ์ภายในห้องน้ำ 1 ชุด (รายละเอียดตามเอกสารแนบท้ายสัญญา) ทรัพย์สินหรือสิ่งของดังกล่าวอยู่ในสภาพที่ดีใช้การได้ ผู้เช่ามีหน้าที่ต้องดูแลให้อยู่ในสภาพที่ดีใช้การได้เสมอ หากเกิดการชำรุดเสียหายด้วยเหตุใดก็ตาม ผู้เช่าจะต้องรับผิดชอบชดใช้หรือซ่อมแซมให้อยู่ในสภาพดีเหมือนเดิม และส่งมอบคืนให้แก่ผู้ให้เช่าเมื่อเลิกสัญญาเช่าแล้ว กรณีห้องที่มีแอร์ผู้เช่าต้องล้างแอร์เองทุกๆ 6 เดือน 500 บาท แต่ถ้าผู้เช่าติดแอร์เอง หลังย้ายออกผู้เช่าต้องจ่ายค่าซ่อมแซมเพื่อปิดรูท่อแอร์ และรูน็อตต่างๆ หลังรื้อถอนไปแล้ว 1,500 บาท
ข้อ 6 ในห้องเช่าหนึ่งๆ ผู้เช่าจะพักอาศัยได้ไม่เกิน 3 คน หากพักอาศัยเกินจำนวนดังกล่าว ผู้ให้เช่ามีสิทธิ์บอกเลิกสัญญาดังกล่าวได้ทันที ส่วนทรัพย์สินใดๆ ของผู้เช่าหรือบริวารของผู้เช่า หากเกิดความเสียหายหรือสูญหายขึ้นมา ผู้ให้เช่าจะไม่รับผิดชอบใดๆ ทั้งสิ้น
ข้อ 7 กรณีผู้เช่ามีสัตว์เลี้ยง ทางห้องพักอนุญาตให้มีสัตว์เลี้ยงได้ ยกเว้นสุนัข ต้องแจ้งผู้ให้เช่าด้วยว่าจะเลี้ยงอะไร เท่าไหร่ และมีรูป กับสมุดวัคซีนด้วยจะดีมาก สัตว์เลี้ยงถ้าเป็นแมว เลี้ยงได้ไม่เกิน 3 ตัวต่อห้อง แต่ผู้เช่าต้องเลี้ยงระบบปิด ไม่ให้ออกมาเพ่นพ่านนอกห้อง หรือขับถ่ายเรี่ยราด ผู้เช่าต้องรักษาความสะอาด และต้องไม่ให้มีกลิ่นและเสียงรบกวนห้องอื่น ถ้าออกจากห้องต้องมีสายจูงหรืออยู่ในตะกร้าหรือรถเข็นให้เรียบร้อย กรณีทำผิดกฎครั้งแรกผู้ให้เช่าจะตักเตือน แต่ครั้งต่อไปจะถูกยกเลิกสัญญาได้ทันที และห้ามผู้เช่าทอดทิ้งสัตว์หลังจากย้ายออกด้วย
ข้อ 8 ให้ห้องเช่าห้องหนึ่งๆ มีลูกบิดประตูเข้าออกพร้อมลูกกุญแจให้ 1 ชุด ซึ่งใช้การได้ดี และอยู่ในสภาพเรียบร้อย หากผู้เช่าทำกุญแจดังกล่าวชำรุดเสียหายหรือสูญหาย ผู้เช่าต้องเปลี่ยนกุญแจใหม่ทั้งชุด จะทำการซ่อมแซมหรือทำลูกกุญแจสำรองไม่ได้ และส่งมอบคืนเมื่อเลิกสัญญาเช่าแล้ว
ข้อ 9 ผู้เช่าจะต้องไม่เล่นการพนันทุกชนิด ไม่ดื่มสุรามึนเมาเป็นที่รำคาญของผู้อื่น ไม่ทะเลาะวิวาททำร้ายร่างกายหรือทำลายทรัพย์สิน ไม่ว่าผู้เช่าจะอยู่ห้องเดียวกันหรือต่างห้องกันในบริเวณห้องพักอาศัยก็ตาม และไม่นำสิ่งของใดๆ ที่ผิดกฎหมาย หรือเพื่อใช้เพื่อกระทำผิด เช่น อาวุธ วัตถุระเบิด เชื้อเพลิง เข้ามาหรือเก็บไว้ในที่พักเป็นอันขาด หากผู้ใดฝ่าฝืนการกระทำดังกล่าว ผู้ให้เช่ามีสิทธิ์บอกเลิกสัญญาเช่าได้ทันทีโดยไม่ต้องบอกกล่าวล่วงหน้า
ข้อ 10 ผู้เช่าต้องไม่ทำการโอนสิทธิ์การเช่าหรือเช่าช่วง ให้ผู้หนึ่งผู้ใดเข้าพักอาศัยแทนเป็นอันขาด หากพบว่าผู้หนึ่งผู้ใดเข้าพักในห้องพัก โดยผู้เช่าไม่ได้แจ้งหรือได้รับความยินยอมจากผู้ให้เช่า ย่อมถือว่าผู้นั้นเข้ามาพักโดยมิชอบ และถือเป็นการบุกรุก ผู้ให้เช่ามีสิทธิ์บอกเลิกสัญญาเช่า และดำเนินคดีฐานบุกรุกได้
ข้อ 11 ผู้เช่าต้องไม่ทำการตอกตะปู ติดรูปภาพ ติดสติ๊กเกอร์ หรือกาว 2 หน้า เพื่อแขวนภาชนะใดๆ บริเวณผนังห้อง ผู้ใดฝ่าฝืนปรับจุดละ 80 บาท
ข้อ 12 ผู้เช่าต้องไม่ใช้เตาแก๊ส หรือเตาถ่าน ในการประกอบอาหารโดยเด็ดขาด แต่ถ้ามีความจำเป็นอนุญาตให้ใช้กระทะไฟฟ้าได้ ทั้งนี้เพื่อความสะอาดและปลอดภัยต่อผู้พักอาศัยร่วมกัน หากผู้ใดฝ่าฝืนผู้ให้เช่ามีสิทธิ์บอกเลิกสัญญาเช่าได้ทันที และถ้าเกิดอัคคีภัยในห้องพัก ทรัพย์สินต่างๆ ของผู้เช่าเกิดความสูญหาย หรือเสียหาย ผู้ให้เช่าจะไม่รับผิดชอบใดๆ ทั้งสิ้น แต่ในกรณีที่ทรัพย์สินของผู้ให้เช่าเสียหาย ผู้เช่าต้องจัดการซ่อมแซมให้อยู่ในสภาพเดิม หรือชดใช้ค่าเสียหายตามความเป็นจริง
ข้อ 13 ผู้เช่ามีรถยนต์ หรือรถจักรยานยนต์ จะนำเข้าออกบริเวณที่พักอาศัย จะต้องได้รับการอนุญาตจากผู้ให้เช่าเสียก่อน โดยผู้ให้เช่าจะจัดที่จอดรถให้ แต่หากเกิดความสูญหายหรือเสียหายขึ้นมาไม่ว่ากรณีใดๆ ผู้ให้เช่าจะไม่รับผิดชอบใดๆ ทั้งสิ้น ดังนั้นผู้เช่าต้องระวังรักษารถเอง
ข้อ 14 ตามสัญญาเช่าห้องหนึ่งๆ จะพักอาศัยได้ไม่เกิน 3 คนนั้น ผู้เช่าจะต้องนำสำเนาบัตรประจำตัวประชาชนมามอบให้แก่ผู้ให้เช่า เพื่อแนบไว้กับหนังสือสัญญาเช่าฉบับนี้ หากมีการเปลี่ยนแปลงผู้เช่าจะต้องแจ้งให้ทราบทุกครั้ง ทั้งนี้เพื่อความสะดวกในการติดต่อ ผู้เช่าในห้องมีจำนวนคนดังนี้
{occupants}`;
const CONTRACT_EN = `1. The Tenant agrees to rent Room No. {room} at the above premises, 1 room, for a minimum term of {months} months from the move-in date ({start} to {end}), at the rate of {rent} THB ({rentText}) per month, which is treated as 1 month of advance rent. The Tenant shall pay the rent to the Landlord by day {dueDay} of each month.{common}
2. The Tenant has placed a deposit of {deposit} THB ({depositText}) with the Landlord to cover water, electricity and any damage. This deposit will be returned to the Tenant when the Tenant has stayed for the full lease term. If, after the lease term, the Tenant needs to move out for any reason, the Tenant must give at least 1 month (30 days) notice in advance; otherwise the deposit will not be refunded.
3. If the Tenant pays rent more than 5 days late, the Tenant shall pay a fine of 50 THB per day. If rent remains unpaid for a long time, the Landlord has the right to lock the room immediately and take possession of it without notice. If the Tenant damages the Landlord's property, or unpaid rent exceeds the deposit in clause 2, the Tenant agrees that the property in the room may be seized and sold at auction immediately without any condition.
4. The Tenant pays for water and electricity according to actual use as shown by the meters installed. Water is {water} THB per unit{waterMin}; electricity is {elec} THB per unit. If water or electricity charges are unpaid, the Tenant agrees that the water and electricity may be cut off immediately without notice, and will not dispute this.
5. Each room contains the Landlord's property provided for the Tenant's use: 3 fluorescent lights, 3 power sockets, 1 cable TV socket, 1 ceiling fan and 1 set of bathroom fixtures (details in the attachment). These items are in good working condition. The Tenant must keep them in good working condition at all times. If any item is damaged for any reason, the Tenant must pay for or repair it to its original condition and return it to the Landlord when the lease ends. For rooms with air-conditioning, the Tenant must have the air-conditioner cleaned every 6 months (500 THB). If the Tenant installs their own air-conditioner, after moving out the Tenant must pay 1,500 THB to repair and seal the pipe and screw holes after removal.
6. No more than 3 people may live in each room. If more people live in the room, the Landlord has the right to terminate this lease immediately. The Landlord is not responsible for any damage to or loss of property belonging to the Tenant or the Tenant's guests.
7. Pets are allowed, except dogs. The Tenant must inform the Landlord what pets and how many, preferably with photos and a vaccination record. Cats are limited to 3 per room and must be kept indoors, not allowed to roam outside the room or relieve themselves around the building. The Tenant must keep the room clean and free of odour and noise that disturbs other rooms. Outside the room, pets must be on a leash or in a carrier or pet stroller. A first violation will receive a warning; any further violation may lead to immediate termination of the lease. Abandoning pets after moving out is strictly prohibited.
8. Each room comes with a door lock and 1 set of keys in good working order. If the Tenant damages or loses the keys, the Tenant must replace the whole lock set; repairs or duplicate keys are not allowed. The keys must be returned when the lease ends.
9. The Tenant must not gamble in any form, get drunk and disturb others, fight, assault anyone or destroy property, whether within the same room or between rooms in the building, and must never bring in or keep anything illegal or intended for wrongdoing, such as weapons, explosives or fuel. If anyone violates this, the Landlord may terminate the lease immediately without prior notice.
10. The Tenant must not transfer the lease or sublet the room, or allow anyone to live in the room in the Tenant's place. Anyone found staying in the room without the Tenant informing the Landlord or obtaining the Landlord's consent is deemed to be staying unlawfully and trespassing. The Landlord may terminate the lease and take legal action for trespass.
11. The Tenant must not hammer nails, hang pictures, or use stickers or double-sided tape to hang anything on the walls. A fine of 80 THB per spot applies.
12. Gas stoves and charcoal stoves are strictly prohibited for cooking; an electric pan may be used if necessary, for the cleanliness and safety of all residents. If violated, the Landlord may terminate the lease immediately. If a fire occurs in the room, the Landlord is not responsible for any loss of or damage to the Tenant's property; if the Landlord's property is damaged, the Tenant must repair it to its original condition or pay for the actual damage.
13. A Tenant who wishes to bring a car or motorcycle onto the premises must first obtain the Landlord's permission; the Landlord will provide a parking space. The Landlord is not responsible for any loss or damage in any case, so the Tenant must take care of their own vehicle.
14. As each room may house no more than 3 people, the Tenant must provide copies of each occupant's ID card or passport to the Landlord to be attached to this lease, and must inform the Landlord of any change, for ease of contact. The occupants of the room are as follows:
{occupants}`;
const BOOK_TH = `เงินจองนำไปหักค่าแรกเข้าในวันทำสัญญา
หากไม่เข้าอยู่ตามกำหนด และไม่แจ้งล่วงหน้าภายใน 3 วัน ขอสงวนสิทธิ์ไม่คืนเงินจอง
สอบถาม {tel}`;
const BOOK_EN = `The booking deposit will be deducted from the move-in payment.
If you do not move in as scheduled and do not inform us at least 3 days in advance, the booking deposit is non-refundable.
Contact {tel}`;

function docTarget_(kind, id) {
  if (kind === 'contract') { const t = findBy_('Tenants', 'id', String(id || '')); if (!t) throw new Error('ไม่พบผู้เช่า'); return t; }
  if (kind === 'book') { const r = findBy_('Rooms', 'room', String(id || '')); if (!r || r.status !== ST.RES) throw new Error('ห้องนี้ไม่ได้อยู่ในสถานะจอง'); return r; }
  throw new Error('ไม่รู้จักเอกสาร');
}
function docRef_(kind, o) { return kind === 'contract' ? o.id : o.room + '|' + (o.bookNo || ''); }
function beYm_(d) { d = String(d || today_()); return String(+d.slice(0, 4) + 543).slice(2) + d.slice(5, 7); }
function ensureDocNo_(kind, o) {
  if (kind === 'contract' && !o.contractNo) { o.contractNo = 'CT-' + beYm_(o.startDate) + '-' + o.room; writeRow_('Tenants', o, o._row); }
  if (kind === 'book' && !o.bookNo) {
    const base = 'BK-' + beYm_() + String(today_()).slice(8, 10) + '-' + o.room, used = readAll_('Signs').map(x => x.ref.split('|')[1]);
    let no = base, i = 2; while (used.indexOf(no) >= 0) no = base + '-' + (i++);
    o.bookNo = no; if (!isDate_(o.bookDocDate)) o.bookDocDate = today_(); writeRow_('Rooms', o, o._row);
  }
}
function docSigns_(kind, o) {
  const ref = docRef_(kind, o), out = {};
  readAll_('Signs').filter(x => x.kind === kind && x.ref === ref).forEach(x => { out[x.who] = { img: x.img, at: x.at, name: x.name }; });
  return out;
}
function docPayload_(kind, o, withSigns) {
  const s = getSettings_(), en = (kind === 'contract' ? o.docLang : o.bookLang) === 'en';
  const room = kind === 'contract' ? (findBy_('Rooms', 'room', o.room) || {}) : o;
  const b = { name: s.buildingName || s.apartmentName, address: s.address || s.mapText || '', tel: s.lineTel1 || s.phone || '', landlord: s.landlordName || s.apartmentName };
  const d = { kind, lang: en ? 'en' : 'th', b, room: { room: room.room, floor: room.floor, rent: Number(room.rent) || 0 },
    rates: { water: Number(s.waterRate) || 0, waterMin: Number(s.waterMin) || 0, elec: Number(s.elecRate) || 0, common: Number(s.commonFee) || 0, dueDay: s.dueDay },
    mode: (kind === 'contract' ? o.signMode : o.bookSignMode) || '', signed: (kind === 'contract' ? o.signed : o.bookSigned) || '' };
  if (kind === 'contract') {
    const rent = Number(o.rent) || d.room.rent;
    d.custom = o.docHtml || ''; d.no = o.contractNo; d.terms = (en ? s.contractTermsEn : s.contractTerms) || (en ? CONTRACT_EN : CONTRACT_TH);
    d.t = { name: o.name, phone: o.phone, idCard: o.idCard, idAddress: o.idAddress, start: o.startDate, end: o.endDate, months: Number(o.contractMonths) || (isDate_(o.startDate) && isDate_(o.endDate) ? Math.round((new Date(o.endDate) - new Date(o.startDate)) / 2629800000) : '') || '', deposit: Number(o.deposit) || 0, advance: Number(o.advanceRent) || 0, key: Number(o.keyDeposit) || 0, card: Number(o.cardFee) || 0 };
    d.room.rent = rent;
    const it = parseItems_(room), names = String(s.roomItems || '').split(',').map(x => x.trim()).filter(Boolean);
    Object.keys(it).forEach(k => { if (names.indexOf(k) < 0) names.push(k); });
    d.items = {}; names.forEach(k => { d.items[k] = it[k] || { s: '', n: '' }; });
    d.date = isDate_(o.docDate) ? o.docDate : o.startDate;
  } else {
    const rent = d.room.rent, dep = rent * (Number(s.depositMonths) || 0), adv = rent * (Number(s.advanceMonths) || 0);
    d.no = o.bookNo; d.terms = ((en ? s.bookTermsEn : s.bookTerms) || (en ? BOOK_EN : BOOK_TH)).replace(/\{tel\}/g, b.tel);
    d.recvBy = o.bookBy || '';
    d.bk = { name: o.bookName, idCard: o.bookIdCard, phone: o.bookPhone, at: o.bookAt, deposit: Number(o.bookDeposit) || 0, note: o.bookNote };
    d.moveIn = { deposit: dep, advance: adv, key: Number(s.keyDeposit) || 0, card: Number(s.cardFee) || 0 };
    d.date = isDate_(o.bookDocDate) ? o.bookDocDate : today_();
  }
  if (withSigns) d.signs = docSigns_(kind, o);
  return d;
}
function api_docData(req) { const o = docTarget_(req.kind, req.id); withLock_(() => ensureDocNo_(req.kind, findBy_(req.kind === 'contract' ? 'Tenants' : 'Rooms', req.kind === 'contract' ? 'id' : 'room', String(req.id)))); MEMO = {}; return { doc: docPayload_(req.kind, docTarget_(req.kind, req.id), true) }; }
function api_docInfo(req) {
  const o = docTarget_(req.kind, req.id), C = req.kind === 'contract';
  if (C) { ['idCard', 'idAddress'].forEach(k => { if (req[k] != null) o[k] = String(req[k]).trim().slice(0, 200); }); }
  else if (req.idCard != null) o.bookIdCard = String(req.idCard).trim().slice(0, 40);
  // วันที่ในเอกสาร
  if (req.docDate != null) { if (req.docDate && !isDate_(req.docDate)) throw new Error('วันที่ไม่ถูกต้อง'); o[C ? 'docDate' : 'bookDocDate'] = req.docDate || ''; }
  if (C && (req.startDate != null || req.endDate != null)) {
    const sd = req.startDate != null ? req.startDate : o.startDate, ed = req.endDate != null ? req.endDate : o.endDate;
    if (!isDate_(sd) || (ed && !isDate_(ed))) throw new Error('วันที่ไม่ถูกต้อง');
    if (ed && ed < sd) throw new Error('วันสิ้นสุดสัญญาต้องอยู่หลังวันเริ่ม');
    o.startDate = sd; o.endDate = ed || '';
    if (ed) o.contractMonths = Math.max(1, Math.round((new Date(ed) - new Date(sd)) / 2629800000));
  }
  if (!C && req.bookAt != null) { if (!isDate_(String(req.bookAt).slice(0, 10))) throw new Error('วันเข้าอยู่ไม่ถูกต้อง'); o.bookAt = String(req.bookAt).slice(0, 16); }
  if (req.lang != null) o[C ? 'docLang' : 'bookLang'] = req.lang === 'en' ? 'en' : 'th';
  if (req.mode != null) o[C ? 'signMode' : 'bookSignMode'] = req.mode === 'paper' ? 'paper' : req.mode === 'e' ? 'e' : '';
  if (req.paperDone != null) o[C ? 'signed' : 'bookSigned'] = req.paperDone ? 'paper:' + today_() : '';
  writeRow_(C ? 'Tenants' : 'Rooms', o, o._row);
  return {};
}
function saveSign_(kind, o, who, img, name) {
  img = String(img || '');
  if (!/^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(img)) throw new Error('ลายเซ็นไม่ถูกต้อง');
  if (img.length > 48000) throw new Error('ลายเซ็นใหญ่เกินไป ลองเซ็นใหม่ให้เล็กลง');
  ensureDocNo_(kind, o);
  const ref = docRef_(kind, o), ex = readAll_('Signs').filter(x => x.kind === kind && x.ref === ref && x.who === who)[0];
  writeRow_('Signs', { kind, ref, who, name: String(name || '').slice(0, 80), at: now_(), img }, ex && ex._row);
  const sg = docSigns_(kind, o), C = kind === 'contract';
  o[C ? 'signMode' : 'bookSignMode'] = 'e';
  o[C ? 'signed' : 'bookSigned'] = sg.tenant && sg.owner ? 'e:' + today_() : sg.tenant ? 'tenant' : sg.owner ? 'owner' : '';
  writeRow_(C ? 'Tenants' : 'Rooms', o, o._row);
  return o[C ? 'signed' : 'bookSigned'];
}
function api_docSign(req) {
  const o = docTarget_(req.kind, req.id), s = getSettings_();
  const who = req.who === 'owner' ? 'owner' : 'tenant', name = who === 'owner' ? (req.kind === 'book' && o.bookBy ? o.bookBy : (s.landlordName || s.apartmentName)) : (req.kind === 'contract' ? o.name : o.bookName);
  return { signed: saveSign_(req.kind, o, who, req.img, name) };
}
function api_docLink(req) {
  const o = docTarget_(req.kind, req.id), C = req.kind === 'contract', k = C ? 'docToken' : 'bookToken';
  ensureDocNo_(req.kind, o);
  if (!o[k] || req.renew) { o[k] = Utilities.getUuid().replace(/-/g, '').slice(0, 20); o[C ? 'signMode' : 'bookSignMode'] = 'e'; writeRow_(C ? 'Tenants' : 'Rooms', o, o._row); }
  let pushed = false;
  if (C && req.push) { const u = readAll_('LineUsers').filter(x => x.tenantId === o.id)[0], url = appLink_('sign.html', 'k=' + o[k]);
    if (u && url) pushed = pushUser_(u.userId, [card_(o.docLang === 'en' ? '✍️ Please sign your lease' : '✍️ เชิญเซ็นสัญญาเช่า', o.docLang === 'en' ? '✍️ Lease agreement · Room ' + o.room : '✍️ สัญญาเช่า · ห้อง ' + o.room, '#2457c5', [o.docLang === 'en' ? 'Please review and sign your lease online' : 'กรุณาตรวจสอบและเซ็นสัญญาเช่าออนไลน์'], [{ label: o.docLang === 'en' ? 'Open lease' : 'เปิดสัญญา', uri: url, primary: true }])]); }
  return { token: o[k], pushed };
}
function api_docReset(req) {
  const o = docTarget_(req.kind, req.id), ref = docRef_(req.kind, o), C = req.kind === 'contract';
  readAll_('Signs').filter(x => x.kind === req.kind && x.ref === ref).map(x => x._row).sort((a, b) => b - a).forEach(r => deleteRow_('Signs', r));
  o[C ? 'signed' : 'bookSigned'] = ''; o[C ? 'docToken' : 'bookToken'] = ''; writeRow_(C ? 'Tenants' : 'Rooms', o, o._row);
  return {};
}
function cleanDocHtml_(h) {
  h = String(h || '');
  if (h.length > 45000) throw new Error('สัญญายาวเกินไป (เกิน 45,000 ตัวอักษร) ลองตัดข้อความบางส่วน');
  return h.replace(/<\s*(script|style|iframe|object|embed|link|meta|img|svg|form|input|button|template)[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '').replace(/<\s*(script|style|iframe|object|embed|link|meta|img|svg|form|input|button|template)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:|expression\(|url\(/gi, '');
}
/* ---------- กู้คอลัมน์ชีต Rooms (v5.3–5.5 แทรกคอลัมน์กลางชีต ทำให้ข้อมูลซ่อม/อุปกรณ์ห้อง/ทำความสะอาดอ่านผิดช่อง) ---------- */
const ROOMS_A = ['room', 'floor', 'type', 'rent', 'status', 'note', 'bookName', 'bookPhone', 'bookAt', 'bookDeposit', 'bookNote', 'fixNote', 'fixSince', 'fixDue', 'fixLevel', 'items', 'cleanStatus', 'cleanNote', 'cleanSince', 'cleanLast'];
function rlStr_(v) { return v instanceof Date ? Utilities.formatDate(v, tz_(), 'yyyy-MM-dd') : String(v == null ? '' : v).trim(); }
function rlJson_(v) { v = rlStr_(v); if (!/^\{[\s\S]*\}$/.test(v)) return ''; try { const o = JSON.parse(v); return o && typeof o === 'object' && !Array.isArray(o) ? v : ''; } catch (e) { return ''; } }
function rlDate_(v) { v = rlStr_(v); return /^\d{4}-\d{2}-\d{2}/.test(v) ? v : ''; }
function rlText_(v) { v = rlStr_(v); return v && !rlDate_(v) && !rlJson_(v) && v !== 'รอทำ' && v !== 'หนัก' && !/^BK-/.test(v) && !/^(th|en|e|paper|tenant|owner)$/.test(v) && !/^(e|paper):/.test(v) && !/^[a-f0-9]{16,40}$/.test(v) ? v : ''; }
// อ่านค่าดิบแต่ละแถว แล้วจัดลงช่องที่ถูกต้อง (รองรับข้อมูลที่ถูกบันทึกจาก v5.2 / v5.3 / v5.4–5.5 ปนกัน)
function rlDecode_(P) {
  P = P.slice(); while (P.length < 26) P.push('');
  const o = {}; ROOMS_A.slice(0, 11).forEach((k, i) => { o[k] = P[i] instanceof Date ? rlStr_(P[i]) : P[i]; });
  const fix = o.status === 'ซ่อม';
  o.items = rlJson_(P[21]) || rlJson_(P[20]) || rlJson_(P[15]);
  o.fixLevel = [P[20], P[19], P[14]].some(v => rlStr_(v) === 'หนัก') ? 'หนัก' : '';
  o.cleanStatus = [P[22], P[21], P[16]].some(v => rlStr_(v) === 'รอทำ') ? 'รอทำ' : '';
  // งานซ่อม: แบบเดิม (11-13) → แบบ 5.3 (16-18) → แบบ 5.4+ (17-19)
  o.fixNote = rlText_(P[11]); o.fixSince = rlDate_(P[12]); o.fixDue = rlDate_(P[13]);
  const b53 = rlText_(P[16]) && rlDate_(P[17]); // 5.3 เขียนงานซ่อมที่ช่อง 16-18
  if (b53) { o.fixNote = o.fixNote || rlText_(P[16]); o.fixSince = o.fixSince || rlDate_(P[17]); o.fixDue = o.fixDue || rlDate_(P[18]); }
  // ทำความสะอาด: แบบ 5.4+ (23-25) → แบบ 5.3 (22-24) → แบบเดิม (17-19)
  if (rlStr_(P[25]) || rlDate_(P[24]) && !rlDate_(P[23])) { o.cleanNote = rlText_(P[23]); o.cleanSince = rlDate_(P[24]); o.cleanLast = rlDate_(P[25]); }
  else if (rlText_(P[22]) || rlDate_(P[23]) || rlDate_(P[24])) { o.cleanNote = rlText_(P[22]); o.cleanSince = rlDate_(P[23]); o.cleanLast = rlDate_(P[24]); }
  else if (!b53) {
    const t17 = rlText_(P[17]), d18 = rlDate_(P[18]), d19 = rlDate_(P[19]);
    if (fix && !o.fixNote && !o.fixSince && (t17 || d18) && !o.cleanStatus) { o.fixNote = t17; o.fixSince = d18; o.fixDue = d19; } // 5.4+ เขียนงานซ่อมที่ช่อง 17-19
    else { o.cleanNote = t17; o.cleanSince = d18; o.cleanLast = d19; }
  }
  if (o.cleanStatus !== 'รอทำ') { o.cleanNote = ''; o.cleanSince = ''; }
  if (!fix) { o.fixNote = ''; o.fixSince = ''; o.fixDue = ''; o.fixLevel = ''; }
  // ใบจอง (เฉพาะห้องที่ยังจองอยู่)
  const bk = rlStr_(P[11]);
  if (o.status === 'จอง' && /^BK-/.test(bk)) {
    o.bookNo = bk; o.bookLang = /^(th|en)$/.test(rlStr_(P[12])) ? rlStr_(P[12]) : ''; o.bookSignMode = /^(e|paper)$/.test(rlStr_(P[13])) ? rlStr_(P[13]) : '';
    o.bookSigned = /^(tenant|owner|e:|paper:)/.test(rlStr_(P[14])) ? rlStr_(P[14]) : ''; o.bookToken = /^[a-f0-9]{16,40}$/.test(rlStr_(P[15])) ? rlStr_(P[15]) : '';
    o.bookIdCard = rlStr_(P[16]) && rlStr_(P[16]) !== 'รอทำ' && !rlDate_(P[17]) ? rlStr_(P[16]) : '';
  }
  return o;
}
function ensureRoomsLayout_(force) {
  const c = CacheService.getScriptCache(), key = 'roomsLayout:' + APP_VER;
  if (!force && c.get(key)) return false;
  const sh = SpreadsheetApp.getActive().getSheetByName('Rooms'); if (!sh) return false;
  const H = SCHEMA.Rooms, w = Math.max(sh.getLastColumn(), H.length), head = sh.getRange(1, 1, 1, w).getValues()[0].map(rlStr_);
  const ok = H.every((h, i) => head[i] === h);
  if (ok) { c.put(key, '1', 21600); return false; }
  const used = head.filter(Boolean).length;
  if (used > ROOMS_A.length && H.slice(0, used).every((h, i) => head[i] === h)) { // แค่มีคอลัมน์ใหม่ต่อท้าย: เติมหัวคอลัมน์ ไม่ต้องย้ายข้อมูล
    sh.getRange(1, 1, 1, H.length).setValues([H]).setFontWeight('bold'); MEMO = {}; dropCache_('Rooms'); c.put(key, '1', 21600); return false;
  }
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const ss = SpreadsheetApp.getActive(), stamp = Utilities.formatDate(new Date(), tz_(), 'yyyyMMdd-HHmm');
    sh.copyTo(ss).setName('Rooms_backup_' + stamp); // สำรองชีตเดิมไว้ก่อนแก้
    const last = sh.getLastRow(), raw = last < 2 ? [] : sh.getRange(2, 1, last - 1, w).getValues();
    const rows = raw.map(P => { const o = rlDecode_(P); return H.map(h => toCell_(h, o[h])); });
    sh.getRange(1, 1, 1, w).clearContent(); sh.getRange(1, 1, 1, H.length).setValues([H]).setFontWeight('bold');
    if (rows.length) { sh.getRange(2, 1, rows.length, w).clearContent(); sh.getRange(2, 1, rows.length, H.length).setValues(rows); }
    MEMO = {}; dropCache_('Rooms'); c.put(key, '1', 21600);
    writeRow_('ChatLog', { at: now_(), userId: 'system', name: 'ระบบ', text: 'ซ่อมคอลัมน์ชีต Rooms อัตโนมัติ ' + rows.length + ' แถว (สำรองไว้ที่ชีต Rooms_backup_' + stamp + ')' });
    return true;
  } finally { lock.releaseLock(); }
}
// กู้ข้อมูลซ่อม/อุปกรณ์ห้อง/ทำความสะอาด จากไฟล์สำเนาประวัติเวอร์ชัน (เติมเฉพาะช่องที่ว่าง)
function api_repairRoomsFrom(req) {
  const url = String(req.url || '').trim(); if (!/docs\.google\.com\/spreadsheets\/d\//.test(url)) throw new Error('กรุณาวางลิงก์ Google Sheets ของไฟล์สำเนา');
  let src; try { src = SpreadsheetApp.openByUrl(url); } catch (e) { throw new Error('เปิดไฟล์สำเนาไม่ได้ — ตรวจลิงก์ หรือกด Run ฟังก์ชัน setup ใน Apps Script อีกครั้งเพื่ออนุญาตสิทธิ์'); }
  const sh = src.getSheetByName('Rooms'); if (!sh) throw new Error('ไฟล์สำเนาไม่มีชีต Rooms');
  const w = sh.getLastColumn(), last = sh.getLastRow(); if (last < 2) throw new Error('ไฟล์สำเนาไม่มีข้อมูลห้อง');
  const head = sh.getRange(1, 1, 1, w).getValues()[0].map(rlStr_), raw = sh.getRange(2, 1, last - 1, w).getValues();
  const legacy = ROOMS_A.every((h, i) => head[i] === h) && head.length >= 20 ? null : 1;
  const old = {}; raw.forEach(P => { const o = legacy ? rlDecode_(P) : (() => { const x = {}; head.forEach((h, i) => { x[h] = rlStr_(P[i]); }); return x; })(); if (o.room) old[rlStr_(o.room)] = o; });
  const F = ['fixNote', 'fixSince', 'fixDue', 'fixLevel', 'items', 'cleanStatus', 'cleanNote', 'cleanSince', 'cleanLast'], rep = [];
  let n = 0;
  readAll_('Rooms').forEach(r => {
    const o = old[r.room]; if (!o) return; const got = [];
    F.forEach(k => {
      if (r[k] || !o[k]) return;
      if (/^fix/.test(k) && r.status !== 'ซ่อม') return; // ห้องที่ไม่ได้ซ่อมแล้ว ไม่ต้องคืนข้อมูลซ่อม
      if (/^clean(Status|Note|Since)$/.test(k) && r.cleanStatus !== 'รอทำ' && k !== 'cleanStatus' && o.cleanStatus !== 'รอทำ') return;
      r[k] = o[k]; got.push(k);
    });
    if (got.length) { if (!req.dry) writeRow_('Rooms', r, r._row); n += got.length; rep.push(r.room + ': ' + got.map(k => ({ fixNote: 'รายละเอียดซ่อม', fixSince: 'วันเริ่มซ่อม', fixDue: 'วันเสร็จ', fixLevel: 'ซ่อมหนัก', items: 'อุปกรณ์ห้อง', cleanStatus: 'รอทำความสะอาด', cleanNote: 'โน้ตทำความสะอาด', cleanSince: 'วันสั่งทำความสะอาด', cleanLast: 'ทำความสะอาดล่าสุด' })[k]).join(', ')); }
  });
  return { filled: n, rooms: rep };
}
function api_docEdit(req) { // แก้ข้อความสัญญาฉบับนี้ (html = '' กลับไปใช้แบบอัตโนมัติ) · ลายเซ็นเดิมถูกล้าง
  const o = docTarget_('contract', req.id), ref = docRef_('contract', o);
  o.docHtml = cleanDocHtml_(req.html);
  readAll_('Signs').filter(x => x.kind === 'contract' && x.ref === ref).map(x => x._row).sort((a, b) => b - a).forEach(r => deleteRow_('Signs', r));
  if (!/^paper/.test(o.signed || '')) o.signed = '';
  writeRow_('Tenants', o, o._row);
  return {};
}
function docByToken_(k) {
  k = String(k || ''); if (!/^[a-f0-9]{16,40}$/.test(k)) throw new Error('ลิงก์ไม่ถูกต้อง');
  const t = readAll_('Tenants').filter(x => x.docToken === k)[0]; if (t) return { kind: 'contract', o: t };
  const r = readAll_('Rooms').filter(x => x.bookToken === k)[0]; if (r) return { kind: 'book', o: r };
  throw new Error('ลิงก์หมดอายุหรือเอกสารถูกยกเลิกแล้ว กรุณาติดต่อเจ้าของตึก');
}
function api_docView(req) { const x = docByToken_(req.k); return { doc: docPayload_(x.kind, x.o, true) }; }
function api_docSignPublic(req) {
  const c = CacheService.getScriptCache(), ck = 'ds:' + String(req.k).slice(0, 20), n = Number(c.get(ck) || 0);
  if (n >= 10) throw new Error('ลองหลายครั้งเกินไป กรุณารอสักครู่');
  c.put(ck, String(n + 1), 600);
  return withLock_(() => {
    const x = docByToken_(req.k), o = x.o, signs = docSigns_(x.kind, o);
    if (signs.tenant) throw new Error('เอกสารนี้เซ็นแล้ว');
    const idc = String(req.idCard || '').trim().slice(0, 40), ida = String(req.idAddress || '').trim().slice(0, 200);
    if (x.kind === 'contract') { if (idc && !o.idCard) o.idCard = idc; if (ida && !o.idAddress) o.idAddress = ida; } else if (idc && !o.bookIdCard) o.bookIdCard = idc;
    const nm = x.kind === 'contract' ? o.name : o.bookName, st = saveSign_(x.kind, o, 'tenant', req.img, nm);
    if (getSettings_().botOn !== '0') pushLine_('✍️ ' + (x.kind === 'contract' ? 'ผู้เช่าเซ็นสัญญาเช่าแล้ว' : 'ผู้จองเซ็นใบรับเงินจองแล้ว') + '\nห้อง ' + o.room + ' · ' + nm + (st === 'tenant' ? '\nรอผู้ให้เช่าเซ็นในระบบ' : ''));
    MEMO = {};
    return { doc: docPayload_(x.kind, docByToken_(req.k).o, true) };
  });
}


/* ============================ งาน (สิ่งที่ต้องทำ) ============================ */
const TASK_ST = { TODO: 'todo', WAIT: 'wait', DONE: 'done', CANCEL: 'cancel' };
function taskLog_(t) { return parseJson_(t.log); }
function tasksView_() {
  const cut = addDays_(today_(), -60);
  return readAll_('Tasks').filter(t => t.id && (t.status === TASK_ST.TODO || t.status === TASK_ST.WAIT || String(t.doneAt || t.updatedAt || '').slice(0, 10) >= cut))
    .map(t => { const o = strip_(t); o.log = taskLog_(t); return o; });
}
function cleanDT_(v) { v = String(v || '').trim().replace('T', ' ').slice(0, 16); if (!v) return ''; if (!isDate_(v.slice(0, 10))) throw new Error('วันที่ไม่ถูกต้อง'); return /^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}$/.test(v) ? v : v.slice(0, 10); }
function api_saveTask(req) {
  const p = req.task || {}, ex = p.id ? findBy_('Tasks', 'id', String(p.id)) : null;
  if (p.id && !ex) throw new Error('ไม่พบงานนี้');
  const t = ex || { id: 'K' + Date.now().toString(36) + rand_(3), createdAt: now_(), createdBy: actorName_(), status: TASK_ST.TODO, log: '[]' };
  const title = String(p.title != null ? p.title : t.title || '').trim().slice(0, 200); if (!title) throw new Error('กรุณาใส่ว่าต้องทำอะไร');
  t.title = title;
  ['category', 'assignee', 'waitFor', 'note'].forEach(k => { if (p[k] != null) t[k] = String(p[k]).trim().slice(0, k === 'note' ? 1000 : 80); });
  if (p.room != null) { const rm = String(p.room).trim(); if (rm && !findBy_('Rooms', 'room', rm)) throw new Error('ไม่พบห้อง ' + rm); t.room = rm; }
  if (p.dueAt != null) t.dueAt = cleanDT_(p.dueAt);
  if (p.endAt != null) t.endAt = cleanDT_(p.endAt);
  if (p.followUp != null) t.followUp = cleanDT_(p.followUp).slice(0, 10);
  if (p.remind != null) t.remind = ['none', 'morning', '30', '60', '1d'].indexOf(p.remind) >= 0 ? p.remind : 'morning';
  if (p.repeat != null) t.repeat = ['', 'week', 'month'].indexOf(p.repeat) >= 0 ? p.repeat : '';
  if (p.repairId != null) t.repairId = String(p.repairId);
  if (p.status != null && [TASK_ST.TODO, TASK_ST.WAIT, TASK_ST.CANCEL].indexOf(p.status) >= 0) {
    if (t.status !== p.status) { const L = taskLog_(t); L.unshift({ at: now_(), by: actorName_(), text: p.status === TASK_ST.WAIT ? '⏳ รอ ' + (t.waitFor || 'คนอื่น') : p.status === TASK_ST.CANCEL ? '✖ ยกเลิก' : '↺ กลับมาทำต่อ' }); t.log = JSON.stringify(L.slice(0, 100)); }
    t.status = p.status;
  }
  if ((p.dueAt != null || p.remind != null) && t.status === TASK_ST.TODO) t.remindedAt = ''; // เปลี่ยนเวลา = เตือนใหม่
  if (!ex) t.log = JSON.stringify([{ at: now_(), by: actorName_(), text: 'สร้างงาน' }]);
  t.updatedAt = now_();
  writeRow_('Tasks', t, t._row);
  return { id: t.id };
}
function api_taskDone(req) {
  const t = findBy_('Tasks', 'id', String(req.id || '')); if (!t) throw new Error('ไม่พบงานนี้');
  return taskDone_(t, req.done !== false, actorName_());
}
function taskDone_(t, done, who) {
  const L = taskLog_(t);
  if (done) {
    t.status = TASK_ST.DONE; t.doneAt = now_(); t.doneBy = who; L.unshift({ at: now_(), by: who, text: '✓ เสร็จแล้ว' });
    if (t.room) { const r = findBy_('Rooms', 'room', t.room); if (r) { const d = today_(); r.note = ('✓ ' + Number(d.slice(8)) + '/' + Number(d.slice(5, 7)) + ' ' + t.title + (who ? ' (' + who + ')' : '') + (r.note ? '\n' + r.note : '')).slice(0, 2000); writeRow_('Rooms', r, r._row); } }
    if (t.repeat && t.dueAt) { // งานทำซ้ำ: สร้างรอบถัดไป
      const next = (dt, rp) => { if (!dt) return ''; const d = dt.slice(0, 10), tm = dt.slice(10); return (rp === 'week' ? addDays_(d, 7) : addMonths_(d, 1)) + tm; };
      writeRow_('Tasks', Object.assign({}, t, { _row: undefined, id: 'K' + Date.now().toString(36) + rand_(3), createdAt: now_(), status: TASK_ST.TODO, dueAt: next(t.dueAt, t.repeat), endAt: next(t.endAt, t.repeat), doneAt: '', doneBy: '', remindedAt: '', log: JSON.stringify([{ at: now_(), by: who, text: 'สร้างรอบถัดไปอัตโนมัติ' }]), updatedAt: now_() }));
    }
  } else { t.status = TASK_ST.TODO; t.doneAt = ''; t.doneBy = ''; L.unshift({ at: now_(), by: who, text: '↺ ยกเลิกการติ๊กเสร็จ' }); }
  t.log = JSON.stringify(L.slice(0, 100)); t.updatedAt = now_();
  writeRow_('Tasks', t, t._row);
  return { id: t.id };
}
function api_taskNote(req) {
  const t = findBy_('Tasks', 'id', String(req.id || '')); if (!t) throw new Error('ไม่พบงานนี้');
  const text = String(req.text || '').trim().slice(0, 500); let fileId = '';
  const m = String(req.data || '').match(/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/);
  if (m) { if (m[2].length > 14 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 10 MB'); fileId = fileFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'งาน_' + t.id + '_' + Date.now())).getId(); }
  if (!text && !fileId) throw new Error('พิมพ์ความคืบหน้าหรือแนบรูปก่อน');
  const L = taskLog_(t); L.unshift({ at: now_(), by: actorName_(), text, file: fileId }); t.log = JSON.stringify(L.slice(0, 100)); t.updatedAt = now_();
  writeRow_('Tasks', t, t._row); return {};
}
function api_deleteTask(req) { const t = findBy_('Tasks', 'id', String(req.id || '')); if (!t) throw new Error('ไม่พบงานนี้'); deleteRow_('Tasks', t._row); return {}; }
// วันที่ "ถึงกำหนด" ของงาน: รอคนอื่น = วันตามเรื่อง · อื่นๆ = วันที่ต้องทำ
function taskDay_(t) { return t.status === TASK_ST.WAIT ? String(t.followUp || '') : String(t.dueAt || '').slice(0, 10); }
function taskLine_(t) { return (t.dueAt && t.dueAt.length > 10 ? t.dueAt.slice(11) + ' ' : '') + t.title + (t.room ? ' ห้อง ' + t.room : '') + (t.assignee ? ' (' + t.assignee + ')' : ''); }
// สรุปงานตอนเช้า (ส่งเฉพาะวันที่มีงาน) + เรื่องที่รอคนอื่นถึงวันตาม → กลับมา "ต้องทำ"
function tasksMorning_() {
  const today = today_(), T = readAll_('Tasks').filter(t => t.id);
  withLock_(() => T.filter(t => t.status === TASK_ST.WAIT && t.followUp && t.followUp <= today).forEach(t => {
    const L = taskLog_(t); L.unshift({ at: now_(), by: 'ระบบ', text: '🔔 ถึงวันตามเรื่อง' }); t.log = JSON.stringify(L.slice(0, 100)); t.status = TASK_ST.TODO; t.dueAt = t.dueAt || today; t.updatedAt = now_(); writeRow_('Tasks', t, t._row); }));
  const open = readAll_('Tasks').filter(t => t.status === TASK_ST.TODO && t.remind !== 'none');
  const over = open.filter(t => taskDay_(t) && taskDay_(t) < today), tod = open.filter(t => taskDay_(t) === today).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
  const reps = readAll_('Repairs').filter(r => String(r.appointAt || '').slice(0, 10) === today && (r.status === ST.R_NEW || r.status === ST.R_DOING));
  if (!over.length && !tod.length && !reps.length) return;
  pushLine_('📋 งานวันนี้ ' + dateL_(today, 'th') + (over.length ? '\n⚠️ เกินกำหนด: ' + over.map(taskLine_).join(' · ') : '') +
    reps.map(r => '\n🔧 ' + String(r.appointAt).slice(11, 16) + ' นัดช่าง ห้อง ' + r.room + ' ' + String(r.detail || '').slice(0, 30)).join('') +
    tod.map(t => '\n• ' + taskLine_(t)).join('') + '\nพิมพ์ “เสร็จ ห้อง/ชื่องาน” เพื่อติ๊กว่าทำแล้ว');
}
// เตือนตามเวลา (ทริกเกอร์ทุก 15 นาที)
function taskTick() {
  const s = getSettings_(); if (s.botOn === '0' || !s.lineToken) return;
  const now = new Date(), T = readAll_('Tasks').filter(t => t.status === TASK_ST.TODO && ['30', '60', '1d'].indexOf(t.remind) >= 0 && !t.remindedAt && t.dueAt);
  T.forEach(t => {
    const due = new Date(t.dueAt.length > 10 ? t.dueAt.replace(' ', 'T') + ':00+07:00' : t.dueAt + 'T09:00:00+07:00'), before = t.remind === '1d' ? 1440 : Number(t.remind);
    if (now.getTime() < due.getTime() - before * 60000 || now.getTime() > due.getTime() + 6 * 3600000) return;
    pushLine_('🔔 ถึงเวลาทำงาน' + (t.remind === '1d' ? ' (พรุ่งนี้)' : ' (อีก ' + t.remind + ' นาที)') + '\n📌 ' + t.title + (t.room ? '\n🚪 ห้อง ' + t.room : '') + '\n🕘 ' + dateL_(t.dueAt, 'th') + (t.dueAt.length > 10 ? ' ' + t.dueAt.slice(11) : '') + (t.endAt ? '–' + t.endAt.slice(11) : '') + (t.assignee ? '\n👤 ' + t.assignee : '') + '\nพิมพ์ “เสร็จ ' + (t.room || t.title.split(' ')[0]) + '” เมื่อทำแล้ว');
    withLock_(() => { const x = findBy_('Tasks', 'id', t.id); if (x) { x.remindedAt = now_(); writeRow_('Tasks', x, x._row); } });
  });
}
// คำสั่งในกลุ่ม LINE: งาน / งาน <ข้อความ> / เสร็จ <ห้อง หรือคำในชื่องาน>
function botTasks_(a, name) {
  if (!a.length) {
    const today = today_(), open = readAll_('Tasks').filter(t => t.status === TASK_ST.TODO || t.status === TASK_ST.WAIT);
    const over = open.filter(t => t.status === TASK_ST.TODO && taskDay_(t) && taskDay_(t) < today), tod = open.filter(t => t.status === TASK_ST.TODO && taskDay_(t) === today), wait = open.filter(t => t.status === TASK_ST.WAIT), other = open.filter(t => t.status === TASK_ST.TODO && (!taskDay_(t) || taskDay_(t) > today));
    if (!open.length) return '📌 ไม่มีงานค้างครับ 🎉';
    return '📌 งานค้าง ' + open.length + ' เรื่อง' + (over.length ? '\n⚠️ เกินกำหนด\n' + over.map(t => '• ' + taskLine_(t)).join('\n') : '') + (tod.length ? '\n📅 วันนี้\n' + tod.map(t => '• ' + taskLine_(t)).join('\n') : '') +
      (other.length ? '\n🗂 อื่นๆ\n' + other.slice(0, 8).map(t => '• ' + taskLine_(t) + (taskDay_(t) ? ' · ' + dateL_(taskDay_(t), 'th') : '')).join('\n') : '') + (wait.length ? '\n⏳ รอคนอื่น\n' + wait.map(t => '• ' + t.title + (t.waitFor ? ' (รอ ' + t.waitFor + ')' : '')).join('\n') : '');
  }
  let room = ''; if (findBy_('Rooms', 'room', a[0])) room = a.shift();
  const title = a.join(' ').trim(); if (!title) throw new Error('ใส่ว่าต้องทำอะไร · ตัวอย่าง: งาน 402 เปลี่ยนหลอดไฟ');
  ACTOR = { id: 'line', name: 'LINE · ' + name, role: 'staff' };
  withLock_(() => api_saveTask({ task: { title, room, category: 'อื่นๆ', remind: 'morning' } }));
  return '📌 เพิ่มงานแล้ว: ' + title + (room ? ' · ห้อง ' + room : '') + '\nดู/ตั้งวันเวลาได้ในระบบ เมนู งาน';
}
function botTaskDone_(a, name) {
  if (!a.length) throw new Error('พิมพ์ เสร็จ ตามด้วยเลขห้องหรือชื่องาน · ตัวอย่าง: เสร็จ 402');
  const q = a.join(' ').toLowerCase(), open = readAll_('Tasks').filter(t => t.status === TASK_ST.TODO || t.status === TASK_ST.WAIT);
  let hit = open.filter(t => t.room === a[0]);
  if (hit.length && a.length > 1) { const kw = a.slice(1).join(' ').toLowerCase(); hit = hit.filter(t => t.title.toLowerCase().indexOf(kw) >= 0); }
  if (!hit.length) hit = open.filter(t => t.title.toLowerCase().indexOf(q) >= 0);
  if (!hit.length) return 'ไม่พบงานค้างที่ตรงกับ “' + a.join(' ') + '” · พิมพ์ งาน เพื่อดูรายการ';
  if (hit.length > 1) return 'พบ ' + hit.length + ' งาน เลือกพิมพ์ให้ชัดขึ้น:\n' + hit.slice(0, 8).map(t => '• เสร็จ ' + (t.room ? t.room + ' ' : '') + t.title.split(' ').slice(0, 2).join(' ') + ' — ' + t.title).join('\n') + (a[0] && findBy_('Rooms', 'room', a[0]) && readAll_('Repairs').some(r => r.room === a[0] && (r.status === ST.R_NEW || r.status === ST.R_DOING)) ? '\n• ซ่อมเสร็จ ' + a[0] + ' — ปิดแจ้งซ่อม (แจ้งผู้เช่าให้)' : '');
  withLock_(() => { const t = findBy_('Tasks', 'id', hit[0].id); taskDone_(t, true, 'LINE · ' + name); });
  return '✅ เสร็จแล้ว: ' + hit[0].title + (hit[0].room ? ' ห้อง ' + hit[0].room : '') + ' · โดย ' + name;
}
