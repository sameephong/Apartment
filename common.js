// ===== ฟังก์ชันกลางที่ทุกหน้าใช้ร่วมกัน (ไม่ต้องแก้) =====
/* ---------- หลายตึก: เลือกตึกจากรหัสตึก (?b=CODE หรือที่จำไว้ในเครื่อง) ---------- */
const BLD_LIST = (typeof BUILDINGS !== 'undefined' && BUILDINGS) ? BUILDINGS : null;
const BLD_MULTI = !!(BLD_LIST && Object.keys(BLD_LIST).length);
const BLD = (function () {
  if (!BLD_MULTI) return null;
  const find = c => { c = String(c || '').trim().toUpperCase(); return c && BLD_LIST[c] ? Object.assign({ code: c }, BLD_LIST[c]) : null; };
  let raw = null; try { raw = localStorage.getItem('apt_bld'); } catch (e) {}
  const q = new URLSearchParams(location.search).get('b');
  let b = find(q) || find(raw);
  if (!b && Object.keys(BLD_LIST).length === 1) b = find(Object.keys(BLD_LIST)[0]);
  // ลิงก์เก่าที่ไม่มีรหัสตึก (บิล/หน้าผู้เช่า) ใช้ตึกหลักได้
  if (!b && typeof DEFAULT_BUILDING !== 'undefined' && /\/(bill|tenant)\.html$/.test(location.pathname)) b = find(DEFAULT_BUILDING);
  if (b) {
    try {
      localStorage.setItem('apt_bld', b.code);
      // ความปลอดภัย: เครื่องหนึ่งจำการเข้าสู่ระบบได้ทีละตึก — ล้างรหัส/ข้อมูลของตึกอื่นทั้งหมดทิ้ง
      const SECRET = /^(?:([A-Za-z0-9_-]+):)?(owner_pw|owner_cache|tenant_auth|tenant_cache|tn_seen_.*)$/;
      Object.keys(localStorage).forEach(k => { const m = k.match(SECRET); if (m && m[1] !== b.code) localStorage.removeItem(k); });
    } catch (e) {}
  }
  return b;
})();
const BLD_MANY = BLD_MULTI && Object.keys(BLD_LIST).length > 1; // มีมากกว่า 1 ตึก → แสดงปุ่มเปลี่ยนตึก
window.addEventListener('pageshow', e => { if (e.persisted) location.reload(); });
const NEED_BLD = BLD_MULTI && !BLD;
const API = BLD ? (BLD.url || '') : (typeof API_URL !== 'undefined' ? API_URL : '');
const IS_DEMO = !NEED_BLD && (!API || /^PASTE/i.test(API));
window.BLD_CODE = BLD ? BLD.code : '';
const BKEY = k => BLD ? BLD.code + ':' + k : k; // แยกข้อมูลที่จำในเครื่องตามตึก
function withB(url) { return BLD && BLD_MULTI ? url + (url.includes('?') ? '&' : '?') + 'b=' + encodeURIComponent(BLD.code) : url; }
// เปลี่ยนตึก: ลืมตึกปัจจุบัน + ออกจากระบบของตึกนี้ในเครื่อง → ต้องกรอกรหัสตึก (และรหัสผ่าน) ใหม่ทุกครั้ง
/* ชื่อตึก + สถานะระบบผู้เช่า ที่จำไว้ (ไม่ใช่ข้อมูลลับ) — แสดงในรายการเลือกตึกได้ทันที */
function bInfo(code, info) {
  const k = 'apt_binfo:' + (code || '-');
  if (info) { try { localStorage.setItem(k, JSON.stringify({ name: info.buildingName || info.apartmentName || '', app: !(info.flags && info.flags.app === false) })); } catch (e) {} return; }
  try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
}
function bLabel(code) { const c = bInfo(code); return (c && c.name) || (BLD_LIST && BLD_LIST[code] && BLD_LIST[code].name) || code; }
async function fetchBInfo(code) {
  const b = BLD_LIST && BLD_LIST[code]; if (!b || !b.url) return null;
  const c = new AbortController(), t = setTimeout(() => c.abort(), 15000);
  try { const r = await fetch(b.url + (b.url.includes('?') ? '&' : '?') + 'action=publicInfo', { credentials: 'omit', redirect: 'follow', signal: c.signal }); const j = JSON.parse(await r.text()); if (j.ok) { bInfo(code, j); return j; } }
  catch (e) {} finally { clearTimeout(t); }
  return null;
}
function changeBuilding() {
  try { if (BLD) ['owner_pw', 'owner_cache', 'tenant_auth', 'tenant_cache'].forEach(k => localStorage.removeItem(BKEY(k))); localStorage.removeItem('apt_bld'); } catch (e) {}
  location.href = 'index.html';
}
// ยังไม่ได้เลือกตึก → ไปหน้าแรกเพื่อใส่รหัสตึก
if (NEED_BLD && !/\/(index\.html)?$/.test(location.pathname)) location.replace('index.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search + location.hash));
let _demoReady = null;

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('โหลดไฟล์ ' + src + ' ไม่ได้'));
    document.head.appendChild(s);
  });
}
function demoReady() {
  if (!_demoReady) _demoReady = loadScript('demo.js?v=5.9.2').then(() => loadScript('backend.js?v=5.9.2')).then(() => window.DemoGAS.init());
  return _demoReady;
}
async function callApi(action, payload) {
  const body = JSON.stringify(Object.assign({ action }, payload || {}));
  let j;
  if (IS_DEMO) {
    await demoReady();
    await new Promise(r => setTimeout(r, 120));
    j = JSON.parse(window.DemoGAS.call(body));
  } else {
    j = await remoteCall(body, action, payload);
  }
  if (!j.ok) throw new Error(j.error || 'เกิดข้อผิดพลาด');
  return j;
}

// เรียก Google Apps Script: ไม่ส่งคุกกี้ Google ของเครื่อง (กันปัญหาบนมือถือที่ล็อกอิน Google ไว้)
// ถ้า POST ไม่ผ่าน ลองแบบ GET อีกครั้ง และแจ้งสาเหตุให้ชัดเจน
async function remoteCall(body, action, payload) {
  const parse = async res => {
    const txt = await res.text();
    try { return JSON.parse(txt); }
    catch (e) {
      if (/accounts\.google|ServiceLogin|signin/i.test(txt) || /<html/i.test(txt))
        throw new Error('เซิร์ฟเวอร์ขอให้ล็อกอิน Google — ให้เจ้าของหอตั้ง Deploy เป็น "ผู้มีสิทธิ์เข้าถึง: ทุกคน (Anyone)"');
      throw new Error('เซิร์ฟเวอร์ตอบกลับผิดรูปแบบ (' + res.status + ') ลองใหม่อีกครั้ง');
    }
  };
  // ตั้งเวลาหมด: เซิร์ฟเวอร์ค้าง จะไม่หมุนรอตลอดไป
  const timed = (url, o, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); return fetch(url, Object.assign({ signal: c.signal }, o)).finally(() => clearTimeout(t)); };
  const opts = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, credentials: 'omit', redirect: 'follow', cache: 'no-store' };
  try {
    return await parse(await timed(API, opts, 45000));
  } catch (e1) {
    if (e1.name === 'AbortError') throw new Error(['login', 'getAll', 'publicInfo', 'tenantData', 'getBill', 'previewBills', 'fileImage', 'tenantFile'].includes(action)
      ? 'เซิร์ฟเวอร์ตอบช้าเกินไป ลองใหม่อีกครั้ง' : 'เซิร์ฟเวอร์ตอบช้าเกินไป · กดรีเฟรชเพื่อตรวจว่าบันทึกแล้วหรือยัง ก่อนกดซ้ำ');
    // ลองแบบ GET สำหรับคำสั่งขนาดเล็ก (เช่น เข้าสู่ระบบ) — บางเบราว์เซอร์มือถือมีปัญหากับ POST ข้ามโดเมน
    if (['login', 'getAll', 'publicInfo', 'tenantData', 'getBill'].includes(action)) {
      try {
        const qs = new URLSearchParams(Object.assign({ action }, Object.fromEntries(Object.entries(payload || {}).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)])))).toString();
        return await parse(await timed(API + (API.includes('?') ? '&' : '?') + qs, { credentials: 'omit', redirect: 'follow', cache: 'no-store' }, 30000));
      } catch (e2) { if (/Deploy|ตอบกลับ/.test(e2.message)) throw e2; }
    }
    if (/Deploy|ตอบกลับ/.test(e1.message)) throw e1;
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต แล้วลองใหม่');
  }
}

/* ---------- ป้าย "กำลังอัปเดต" มุมจอ (แสดงข้อมูลที่จำไว้ทันที แล้วอัปเดตเบื้องหลัง) ---------- */
function syncBadge(on) {
  let el = document.getElementById('syncBadge');
  if (!el) { el = document.createElement('div'); el.id = 'syncBadge'; el.style.cssText = 'position:fixed;top:calc(8px + env(safe-area-inset-top,0px));right:8px;z-index:40;background:rgba(17,24,39,.82);color:#fff;font-size:12px;padding:4px 10px;border-radius:999px;display:none;pointer-events:none'; el.textContent = 'กำลังอัปเดต…'; document.body.appendChild(el); }
  el.style.display = on ? 'block' : 'none';
}
let _saveT = null;
function cacheData(key, data) { clearTimeout(_saveT); _saveT = setTimeout(() => { try { localStorage.setItem(BKEY(key), JSON.stringify(data)); } catch (e) {} }, 300); }
function loadData(key) { try { return JSON.parse(localStorage.getItem(BKEY(key)) || 'null'); } catch (e) { return null; } }

/* ---------- ที่เก็บในเครื่อง (ปลอดภัยเมื่อเบราว์เซอร์ไม่อนุญาต) ---------- */
function store(k, v) { try { v == null ? localStorage.removeItem(BKEY(k)) : localStorage.setItem(BKEY(k), v); } catch (e) {} }
function load(k) { try { return localStorage.getItem(BKEY(k)); } catch (e) { return null; } }

/* ---------- รูปแบบข้อความ ---------- */
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MONTHS_S = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function money(n) { return Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }); }
function fmtMonth(m) { if (!m) return ''; const [y, mm] = String(m).split('-'); return TH_MONTHS[+mm - 1] + ' ' + (+y + 543); }
function fmtMonthS(m) { if (!m) return ''; const [y, mm] = String(m).split('-'); return TH_MONTHS_S[+mm - 1] + ' ' + String(+y + 543).slice(2); }
function fmtDate(d) { if (!d) return '-'; const [y, m, dd] = String(d).slice(0, 10).split('-'); return +dd + ' ' + TH_MONTHS_S[+m - 1] + ' ' + String(+y + 543).slice(2); }
function fmtDateTime(s) { if (!s) return ''; return fmtDate(s) + (s.length > 10 ? ' · ' + s.slice(11, 16) : ''); }
function fmtDayLong(d) { const x = new Date(d + 'T00:00:00'); return 'วัน' + TH_DAYS[x.getDay()] + ' ' + fmtDate(d); }
function daysBetween(a, b) { return Math.round((new Date(b.slice(0, 10) + 'T00:00:00') - new Date(a.slice(0, 10) + 'T00:00:00')) / 864e5); }
function addDaysStr(d, n) { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
function addMonthStr(m, n) { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1 + n, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function billTitle(b) { if (b.title) return b.title; return b.kind === 'รายเดือน' ? 'บิลเดือน ' + fmtMonth(b.month) : b.kind === 'แรกเข้า' ? 'บิลแรกเข้าอยู่' : b.kind === 'ย้ายออก' ? 'บิลย้ายออก' : (b.items && b.items[0] ? b.items[0].l : 'บิลพิเศษ'); }
function billUrl(b) { return new URL(withB('bill.html?t=' + b.token), location.href).href; }

/* ---------- รูปภาพ: ย่อก่อนส่ง ---------- */
function resizeImage(file, max, quality) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, (max || 1280) / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', quality || 0.75));
    };
    img.onerror = () => rej(new Error('เปิดรูปนี้ไม่ได้ ลองเลือกรูปอื่น'));
    img.src = url;
  });
}

/* ---------- PromptPay QR (มาตรฐาน EMVCo) ---------- */
function promptPayPayload(id, amount) {
  id = String(id || '').replace(/[^0-9]/g, '');
  const f = (tag, v) => tag + String(v.length).padStart(2, '0') + v;
  let acc;
  if (id.length === 15) acc = f('03', id);
  else if (id.length === 13) acc = f('02', id);
  else acc = f('01', ('0000000000000' + id.replace(/^0/, '66')).slice(-13));
  const p = f('00', '01') + f('01', amount ? '12' : '11') + f('29', f('00', 'A000000677010111') + acc) +
    f('53', '764') + (amount ? f('54', Number(amount).toFixed(2)) : '') + f('58', 'TH') + '6304';
  return p + crc16(p);
}
function crc16(s) {
  let crc = 0xFFFF;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function drawQR(el, text, size) {
  if (!el) return;
  el.innerHTML = '';
  if (!window.QRCode) { // สคริปต์ QR โหลดแบบไม่บล็อกหน้า — รอสักครู่
    const n = (+el.dataset.qrTry || 0) + 1; el.dataset.qrTry = n;
    if (n < 40) { el.textContent = 'กำลังสร้าง QR…'; setTimeout(() => drawQR(el, text, size), 150); } else el.textContent = 'โหลด QR ไม่ได้';
    return;
  }
  new QRCode(el, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
}

/* ---------- แถบโหมดทดลอง ---------- */
function demoBanner(extra) {
  if (!IS_DEMO) return '';
  return `<div class="demo-bar">โหมดทดลอง · ข้อมูลตัวอย่างอยู่ในเครื่องนี้เท่านั้น${extra ? ' · ' + extra : ''}</div>`;
}

/* ---------- กล่องข้อความในหน้า (แทน alert/confirm/prompt ของเบราว์เซอร์) ---------- */
function uiDialog(msg, opts) {
  opts = opts || {};
  return new Promise(res => {
    const w = document.createElement('div');
    w.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:90;display:flex;align-items:center;justify-content:center;padding:16px';
    w.innerHTML = `<div style="background:#fff;color:#1f2933;border-radius:16px;padding:18px;width:100%;max-width:380px;box-shadow:0 10px 30px rgba(0,0,0,.2)">
      <div style="font-size:16px;line-height:1.5;white-space:pre-wrap">${esc(msg)}</div>
      ${opts.input != null ? `<input id="dlgIn" inputmode="decimal" style="width:100%;margin-top:12px;font-size:18px" value="${esc(opts.input)}">` : ''}
      <div style="display:flex;gap:8px;margin-top:16px">${opts.cancel ? '<button class="btn" id="dlgNo" style="flex:1">ยกเลิก</button>' : ''}<button class="btn ${opts.danger ? 'badfill' : 'pri'}" id="dlgOk" style="flex:1">${opts.ok || 'ตกลง'}</button></div></div>`;
    document.body.appendChild(w);
    const inp = w.querySelector('#dlgIn');
    const done = v => { w.remove(); res(v); };
    w.querySelector('#dlgOk').onclick = () => done(inp ? inp.value : true);
    const no = w.querySelector('#dlgNo'); if (no) no.onclick = () => done(inp ? null : false);
    if (inp) { kbFix(inp); inp.focus(); inp.select(); inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value); }; } else w.querySelector('#dlgOk').focus();
  });
}
function uiAlert(msg) { return uiDialog(msg); }
function uiConfirm(msg, okText, danger) { return uiDialog(msg, { cancel: true, ok: okText || 'ยืนยัน', danger }); }
function uiPrompt(msg, def) { return uiDialog(msg, { cancel: true, input: def == null ? '' : def }); }

/* ---------- โทรออก: แสดงเบอร์ให้คัดลอก (ไม่พาหน้าเว็บออกไป) ---------- */
function callPhone(num) {
  const w = document.createElement('div');
  w.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:90;display:flex;align-items:center;justify-content:center;padding:16px';
  w.innerHTML = `<div style="background:#fff;color:#1f2933;border-radius:16px;padding:18px;width:100%;max-width:340px;text-align:center">
    <div style="color:#6b7280;font-size:14px">เบอร์โทร</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:1px;margin:4px 0 14px;user-select:all">${esc(num)}</div>
    <div style="display:flex;gap:8px"><button class="btn" id="cpCopy" style="flex:1">คัดลอกเบอร์</button><a class="btn pri" style="flex:1" href="tel:${esc(String(num).replace(/[^0-9+]/g, ''))}" target="_blank" rel="noopener">โทร</a></div>
    <button class="btn" id="cpClose" style="width:100%;margin-top:8px">ปิด</button></div>`;
  document.body.appendChild(w);
  w.onclick = e => { if (e.target === w) w.remove(); };
  w.querySelector('#cpClose').onclick = () => w.remove();
  w.querySelector('#cpCopy').onclick = function () {
    const b = this;
    (navigator.clipboard ? navigator.clipboard.writeText(num) : Promise.reject()).then(() => { b.textContent = 'คัดลอกแล้ว ✓'; }, () => { b.textContent = 'กดค้างที่เบอร์เพื่อคัดลอก'; });
  };
}

/* ---------- เว็บแอป “ดูแลตึก” (ติดตั้งลงหน้าจอโฮม / Dock) ---------- */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
let _bip = null;
const IS_APP = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _bip = e; showInstall(); });
window.addEventListener('appinstalled', () => { _bip = null; showInstall(); });
function showInstall() { document.querySelectorAll('.install-btn').forEach(b => b.classList.toggle('hide', IS_APP())); }
async function installApp() {
  if (_bip) { _bip.prompt(); try { await _bip.userChoice; } catch (e) {} _bip = null; showInstall(); return; }
  const ua = navigator.userAgent;
  let how;
  if (/Line\//i.test(ua) || /FBAN|FBAV|Instagram/i.test(ua)) how = 'ตอนนี้เปิดอยู่ในแอป LINE/Facebook ซึ่งติดตั้งไม่ได้\n\n1. กดปุ่ม ⋯ มุมขวา\n2. เลือก “เปิดในเบราว์เซอร์” (Safari หรือ Chrome)\n3. แล้วกดปุ่ม “ติดตั้งแอป” อีกครั้ง';
  else if (IS_IOS) how = 'บน iPhone / iPad (ใช้ Safari)\n\n1. กดปุ่มแชร์ ⬆️ ด้านล่างจอ\n2. เลื่อนลงแล้วกด “เพิ่มไปยังหน้าจอโฮม”\n3. กด “เพิ่ม” — ไอคอน “ดูแลตึก” จะขึ้นที่หน้าจอโฮม';
  else if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Edg/.test(ua)) how = 'บน Mac (Safari)\n\nเมนู “ไฟล์” → “เพิ่มไปยัง Dock…” → กด “เพิ่ม”';
  else if (/Android/i.test(ua)) how = 'บน Android (Chrome)\n\nกดเมนู ⋮ มุมขวาบน → “ติดตั้งแอป” หรือ “เพิ่มไปยังหน้าจอหลัก”';
  else how = 'บนคอม (Chrome / Edge)\n\nกดไอคอน ⊕ ติดตั้ง ที่ท้ายช่องที่อยู่เว็บด้านบน\nหรือเมนู ⋮ → “บันทึกและแชร์” → “ติดตั้งหน้าเว็บนี้เป็นแอป”';
  uiAlert(how);
}
document.addEventListener('DOMContentLoaded', showInstall);

/* ---------- iPhone: แตะช่องกรอกแล้วแป้นพิมพ์ไม่ขึ้น (โดยเฉพาะในแอปบนหน้าจอโฮม) ---------- */
function kbFix(el) {
  if (!el || el._kb || !IS_IOS) return; el._kb = 1;
  if (IS_APP() && el.type === 'password') el.setAttribute('autocomplete', 'off'); // ระบบเติมรหัสอัตโนมัติของ iOS ทำให้แป้นพิมพ์ค้างในแอป
  el.addEventListener('touchend', e => { e.preventDefault(); el.blur(); el.focus(); try { const n = el.value.length; el.setSelectionRange && el.type !== 'number' && el.setSelectionRange(n, n); } catch (x) {} });
}

/* ---------- แป้นตัวเลขบนจอ (เข้าสู่ระบบ) — กดง่าย ไม่ต้องรอแป้นพิมพ์มือถือ · คอมพิมพ์เลข/Backspace/Enter ได้ ---------- */
function pinPad(el, o) {
  o = Object.assign({ max: 12, dots: 6, go: 'เข้า', goId: '' }, o);
  let v = '';
  el.innerHTML = `<div class="pp-dots"></div><div class="pp-grid">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" class="pp-k" data-k="${n}">${n}</button>`).join('')}
    <button type="button" class="pp-k pp-del" data-k="del">ลบ</button><button type="button" class="pp-k" data-k="0">0</button><button type="button" class="pp-k pp-go" data-k="go"${o.goId ? ` id="${o.goId}"` : ''}>${o.go}</button></div>`;
  const dots = el.querySelector('.pp-dots');
  const draw = () => { const n = Math.max(o.dots, v.length); dots.innerHTML = Array.from({ length: n }, (_, i) => `<i class="${i < v.length ? 'on' : ''}"></i>`).join(''); if (o.onChange) o.onChange(v); };
  const press = k => {
    if (k === 'go') { if (v.length && o.onSubmit) o.onSubmit(v); return; }
    if (k === 'del') v = v.slice(0, -1); else if (v.length < o.max) v += k;
    try { navigator.vibrate && navigator.vibrate(8); } catch (e) {}
    draw();
  };
  el.addEventListener('click', e => { const b = e.target.closest('.pp-k'); if (b && !b.disabled) press(b.dataset.k); });
  document.addEventListener('keydown', e => {
    if (!el.offsetParent || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') || e.metaKey || e.ctrlKey) return;
    if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('del'); else if (e.key === 'Enter') press('go'); else return;
    e.preventDefault();
  });
  draw();
  return { get value() { return v; }, clear() { v = ''; draw(); }, shake() { v = ''; draw(); dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); } };
}
