// ===== ฟังก์ชันกลางที่ทุกหน้าใช้ร่วมกัน (ไม่ต้องแก้) =====
const IS_DEMO = !API_URL || /^PASTE/i.test(API_URL);
let _demoReady = null;

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('โหลดไฟล์ ' + src + ' ไม่ได้'));
    document.head.appendChild(s);
  });
}
function demoReady() {
  if (!_demoReady) _demoReady = loadScript('demo.js').then(() => loadScript('backend.js')).then(() => window.DemoGAS.init());
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
    let res;
    try { res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }); }
    catch (e) { throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ต'); }
    j = await res.json();
  }
  if (!j.ok) throw new Error(j.error || 'เกิดข้อผิดพลาด');
  return j;
}

/* ---------- ที่เก็บในเครื่อง (ปลอดภัยเมื่อเบราว์เซอร์ไม่อนุญาต) ---------- */
function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

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
function billTitle(b) { return b.kind === 'รายเดือน' ? 'บิลเดือน ' + fmtMonth(b.month) : b.kind === 'แรกเข้า' ? 'บิลแรกเข้าอยู่' : b.kind === 'ย้ายออก' ? 'บิลย้ายออก' : (b.items && b.items[0] ? b.items[0].l : 'บิลพิเศษ'); }
function billUrl(b) { return new URL('bill.html?t=' + b.token, location.href).href; }

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
  if (!window.QRCode) { el.textContent = 'โหลด QR ไม่ได้'; return; }
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
    if (inp) { inp.focus(); inp.select(); inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value); }; } else w.querySelector('#dlgOk').focus();
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
