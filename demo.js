/* ===== โหมดทดลอง: จำลอง Google Apps Script + Google Sheet ในเบราว์เซอร์ =====
 * ใช้โค้ด backend.js ตัวจริงทั้งหมด ข้อมูลเก็บใน localStorage ของเครื่องนี้
 * ไม่ต้องอัปโหลดไฟล์นี้ถ้าใช้งานจริง (ใส่ API_URL แล้วไฟล์นี้จะไม่ถูกโหลด) */
(function () {
  const KEY = 'apt_demo_v2', FKEY = 'apt_demo_files_v2';
  let DB = {}, FILES = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} };
  const saveFiles = () => { try { localStorage.setItem(FKEY, JSON.stringify(FILES)); } catch (e) {} };

  class Range {
    constructor(name, r, c, nr, nc) { Object.assign(this, { name, r, c, nr, nc }); }
    setValues(v) {
      const rows = DB[this.name];
      for (let i = 0; i < this.nr; i++) {
        const row = rows[this.r - 1 + i] = rows[this.r - 1 + i] || [];
        for (let j = 0; j < this.nc; j++) {
          let x = v[i][j];
          if (typeof x === 'string' && x[0] === "'") x = x.slice(1);
          row[this.c - 1 + j] = x;
        }
      }
      return this;
    }
    getValues() {
      const rows = DB[this.name], out = [];
      for (let i = 0; i < this.nr; i++) {
        const row = rows[this.r - 1 + i] || [], o = [];
        for (let j = 0; j < this.nc; j++) o.push(row[this.c - 1 + j] == null ? '' : row[this.c - 1 + j]);
        out.push(o);
      }
      return out;
    }
    setFontWeight() { return this; }
  }
  class Sheet {
    constructor(name) { this.name = name; }
    getRange(r, c, nr, nc) { return new Range(this.name, r, c, nr || 1, nc || 1); }
    getLastRow() { return DB[this.name].length; }
    setFrozenRows() {}
    deleteRow(r) { DB[this.name].splice(r - 1, 1); }
  }
  const book = {
    getSheetByName: n => (DB[n] ? new Sheet(n) : null),
    insertSheet: n => { DB[n] = []; return new Sheet(n); },
    getSheets: () => Object.keys(DB).map(n => new Sheet(n)),
    deleteSheet: s => { delete DB[s.name]; },
  };
  const cache = {};
  const p2 = n => String(n).padStart(2, '0');
  const folder = {
    getId: () => 'DEMOFOLDER',
    createFile: blob => {
      const id = 'F' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      FILES[id] = { b64: blob.b64, mime: blob.mime };
      saveFiles();
      return { getId: () => id };
    },
  };

  window.SpreadsheetApp = { getActive: () => book };
  window.Session = { getScriptTimeZone: () => 'Asia/Bangkok' };
  window.Utilities = {
    formatDate(d, tz, f) {
      const x = new Date(d.getTime() + 7 * 3600e3);
      const m = { yyyy: x.getUTCFullYear(), yy: String(x.getUTCFullYear()).slice(2), MM: p2(x.getUTCMonth() + 1), dd: p2(x.getUTCDate()), HH: p2(x.getUTCHours()), mm: p2(x.getUTCMinutes()), ss: p2(x.getUTCSeconds()) };
      return f.replace(/yyyy|yy|MM|dd|HH|mm|ss/g, k => m[k]);
    },
    getUuid: () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
    base64Decode: s => ({ __b64: s }),
    base64Encode: b => b.__b64,
    newBlob: (b, mime, name) => ({ b64: b.__b64, mime, name }),
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    computeDigest(alg, b) {
      const s = b.__b64, out = [];
      let h = 2166136261;
      for (let k = 0; k < 32; k++) {
        for (let i = k; i < s.length; i += 97) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        out.push(((h >>> 0) % 256) - 128);
      }
      return out;
    },
  };
  window.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
  window.CacheService = { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; }, remove: k => { delete cache[k]; } }) };
  window.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: t => ({ t, setMimeType() { return this; } }) };
  window.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 200 }) };
  window.ScriptApp = { getProjectTriggers: () => [] };
  window.DriveApp = {
    getRootFolder: () => folder,
    getFolderById: () => folder,
    getFoldersByName: () => ({ hasNext: () => true, next: () => folder }),
    createFolder: () => folder,
    getFileById: id => {
      const f = FILES[id];
      if (!f) throw new Error('ไม่พบไฟล์ (ข้อมูลทดลองอาจถูกล้าง)');
      return { getBlob: () => ({ getContentType: () => f.mime, getBytes: () => ({ __b64: f.b64 }) }) };
    },
  };

  /* ---------- ข้อมูลตัวอย่าง ---------- */
  function slipImage(amount, name, when) {
    const c = document.createElement('canvas'); c.width = 480; c.height = 720;
    const g = c.getContext('2d');
    g.fillStyle = '#f3f6f4'; g.fillRect(0, 0, 480, 720);
    g.fillStyle = '#fff'; g.fillRect(24, 24, 432, 672);
    g.fillStyle = '#3f9b6e'; g.fillRect(24, 24, 432, 110);
    g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.fillText('✓ โอนเงินสำเร็จ', 56, 92);
    g.fillStyle = '#6b7280'; g.font = '20px sans-serif'; g.fillText('สลิปตัวอย่าง (โหมดทดลอง)', 56, 180); g.fillText(when, 56, 212);
    g.fillStyle = '#1f2933'; g.font = 'bold 48px sans-serif'; g.fillText(Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' ฿', 56, 300);
    g.font = '22px sans-serif'; g.fillStyle = '#6b7280';
    g.fillText('จาก', 56, 380); g.fillStyle = '#1f2933'; g.fillText(name, 56, 412);
    g.fillStyle = '#6b7280'; g.fillText('ไปยัง', 56, 470); g.fillStyle = '#1f2933'; g.fillText('พร้อมเพย์ 081-xxx-5678', 56, 502);
    g.fillStyle = '#6b7280'; g.fillText('เลขที่รายการ ' + Math.random().toString().slice(2, 14), 56, 600);
    return c.toDataURL('image/jpeg', 0.8);
  }

  function seed() {
    setup();
    const set = (k, v) => { const r = readAll_('Settings').filter(x => x.key === k)[0]; writeRow_('Settings', { key: k, value: v, description: r.description }, r._row); };
    set('apartmentName', 'บ้านสุขใจ อพาร์ทเม้นท์');
    set('address', '99 ถนนตัวอย่าง เขตตัวอย่าง กรุงเทพฯ 10000');
    set('phone', '081-234-5678');
    set('promptpay', '0812345678');
    set('bankInfo', 'ธนาคารตัวอย่าง 123-4-56789-0 (บ้านสุขใจ)');
    set('commonFee', '100');

    api_bulkRooms({ floorFrom: 1, floorTo: 3, perFloor: 8, rent: 3000, type: 'ห้องแอร์' });
    readAll_('Rooms').forEach(r => { if (r.floor === 3) { r.rent = 3500; r.type = 'ห้องแอร์ ใหญ่'; writeRow_('Rooms', r, r._row); } });

    const today = today_(), M = today.slice(0, 7);
    const months = [-3, -2, -1].map(n => addMonths_(M + '-01', n).slice(0, 7));
    const names = ['สมชาย ใจดี', 'สมหญิง รักดี', 'อรุณ แสงทอง', 'วิไล ศรีสุข', 'ประเสริฐ มั่นคง', 'กิตติ วงศ์ดี', 'นภา ใจงาม',
      'สุดา พรมมา', 'ธีระ ทองคำ', 'ธนพล ศักดิ์ดี', 'พิมพ์ชนก แก้วใส', 'มานพ บุญมา', 'เอกชัย สายทอง', 'จิราพร ชื่นใจ',
      'ณัฐวุฒิ ดีเลิศ', 'สมศักดิ์ ทรัพย์มาก', 'บุญมี ใจซื่อ', 'มาลี ดอกไม้', 'อนันต์ สุขสันต์', 'ดวงใจ สว่าง'];
    const occ = ['101', '102', '103', '104', '105', '107', '108', '201', '202', '203', '204', '206', '207', '208', '301', '302', '303', '304', '305', '307'];
    const pins = { '101': '111111', '102': '222222' };
    let rnd = 7;
    const R = (a, b) => { rnd = (rnd * 9301 + 49297) % 233280; return a + Math.floor(rnd / 233280 * (b - a + 1)); };
    const tenants = occ.map((room, i) => {
      const r = findBy_('Rooms', 'room', room);
      let start = addMonths_(today, -(5 + (i * 3) % 10)).slice(0, 8) + p2(R(1, 20));
      let end = addDays_(addMonths_(start, 12), -1);
      if (room === '204') { end = addDays_(today, 20); start = addDays_(addMonths_(end, -12), 1); }
      if (end < today) { end = addDays_(addMonths_(end, 12), 0); }
      const t = { id: 'T' + Date.now().toString(36) + i, room, name: names[i], phone: '08' + R(1, 9) + '-' + R(100, 999) + '-' + R(1000, 9999),
        lineId: '', startDate: start, endDate: end, deposit: r.rent * 2, status: ST.ACTIVE, moveOutDate: '',
        pin: pins[room] || newPin_(), note: '', createdAt: start + ' 10:00' };
      writeRow_('Tenants', t);
      r.status = ST.OCC; writeRow_('Rooms', r, r._row);
      return t;
    });
    [['205', ST.RES, 'จองไว้ เข้าอยู่ ' + fmtD(addDays_(today, 6))], ['306', ST.FIX, 'ทาสีใหม่ เปลี่ยนพื้น']].forEach(([room, st, note]) => {
      const r = findBy_('Rooms', 'room', room); r.status = st; r.note = note; writeRow_('Rooms', r, r._row);
    });
    function fmtD(d) { return +d.slice(8) + ' ' + TH_MS[+d.slice(5, 7) - 1]; }

    // มิเตอร์ 3 เดือนย้อนหลัง + ออกบิล
    const read = {};
    tenants.forEach(t => { read[t.room] = { w: R(80, 400), e: R(1500, 9000) }; });
    months.forEach(m => {
      api_saveMeters({ month: m, rows: tenants.map(t => {
        const p = read[t.room], w = p.w + R(5, 13), e = p.e + R(85, 210);
        const row = { room: t.room, waterPrev: p.w, waterCur: w, elecPrev: p.e, elecCur: e };
        read[t.room] = { w, e };
        return row;
      }) });
      api_generateBills({ month: m });
      bills_().filter(b => b.month === m).forEach(b => { b.createdAt = monthEnd_(m) + ' 20:' + p2(R(0, 59)); writeBill_(b); });
    });

    // การชำระเงิน
    const keepDue = { [months[2]]: ['101', '104', '203', '210', '302', '307'], [months[1]]: ['307'], [months[0]]: [] };
    bills_().forEach(b => {
      if ((keepDue[b.month] || []).indexOf(b.room) >= 0) return;
      const cash = R(1, 5) === 1;
      const paid = addDays_(b.dueDate, -R(0, 4));
      markPaid_(b, cash ? PAY.CASH : PAY.TRANSFER, b.total, paid > today ? today : paid, cash ? Math.ceil(b.total / 500) * 500 : null);
    });
    // สลิปรออนุมัติ
    [['101', 0], ['104', -110]].forEach(([room, diff]) => {
      const t = tenants.filter(x => x.room === room)[0];
      const b = bills_().filter(x => x.tenantId === t.id && x.month === months[2])[0];
      api_tenantSlip({ billId: b.id, image: slipImage(b.total + diff, 'นาย/นาง ' + t.name, fmtD(today) + ' 19:42') }, t);
    });
    // แจ้งซ่อม
    const rep = (room, cat, detail, st, msg, ago) => {
      const t = tenants.filter(x => x.room === room)[0];
      const at = addDays_(today, -ago) + ' ' + p2(R(8, 21)) + ':' + p2(R(0, 59));
      const log = [{ at, s: ST.R_NEW, m: '' }];
      const later = (d, h) => addDays_(at.slice(0, 10), d) + ' ' + p2(h) + ':' + p2(R(0, 59));
      if (st !== ST.R_NEW) log.push({ at: later(0, 21), s: ST.R_DOING, m: st === ST.R_DOING ? msg : 'รับเรื่องแล้ว ช่างจะเข้าตรวจ' });
      if (st === ST.R_DONE) log.push({ at: later(1, 15), s: ST.R_DONE, m: msg });
      writeRow_('Repairs', { id: 'R' + room + ago, createdAt: at, room, tenantId: t.id, name: t.name, phone: t.phone, category: cat, detail, photoId: '',
        allowEntry: 'ได้', status: st, ownerMsg: msg, cost: '', billId: '', updatedAt: log[log.length - 1].at, log: JSON.stringify(log) });
    };
    rep('102', 'ประปา', 'ก๊อกน้ำห้องน้ำรั่ว น้ำหยดตลอด', ST.R_DONE, 'เปลี่ยนก๊อกใหม่แล้ว', 18);
    rep('101', 'แอร์', 'แอร์ไม่เย็น เปิดแล้วมีแต่ลม มีน้ำหยดด้วย', ST.R_DOING, 'ช่างเข้าพรุ่งนี้ 10 โมง', 1);
    rep('207', 'ไฟฟ้า', 'หลอดไฟห้องน้ำขาด', ST.R_NEW, '', 0);
    writeRow_('News', { id: 'N1', createdAt: addDays_(today, -2) + ' 09:00', title: 'แจ้งปิดน้ำซ่อมท่อ', body: 'วันที่ ' + fmtD(addDays_(today, 5)) + ' เวลา 9:00–12:00 จะปิดน้ำเพื่อซ่อมท่อประปาหลัก ขออภัยในความไม่สะดวก' });
  }

  window.DemoGAS = {
    init() {
      try { DB = JSON.parse(localStorage.getItem(KEY) || 'null') || {}; FILES = JSON.parse(localStorage.getItem(FKEY) || 'null') || {}; } catch (e) { DB = {}; FILES = {}; }
      if (!DB.Settings) { DB = {}; FILES = {}; seed(); save(); saveFiles(); }
    },
    call(body) {
      // อ่านข้อมูลล่าสุดก่อนทุกครั้ง เผื่อเปิดหลายแท็บ (ฝั่งเจ้าของหอ + ผู้เช่า)
      try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d && d.Settings) DB = d; const f = JSON.parse(localStorage.getItem(FKEY) || 'null'); if (f) FILES = f; } catch (e) {}
      const out = doPost({ postData: { contents: body } }); save(); return out.t;
    },
    reset() { try { localStorage.removeItem(KEY); localStorage.removeItem(FKEY); } catch (e) {} DB = {}; FILES = {}; },
  };
})();
