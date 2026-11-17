/* ===================== พิมพ์ใบเสร็จ 58 มม. ผ่านบลูทูธ (เครื่อง Y58 / เครื่องพิมพ์ความร้อน ESC/POS) =====================
 * พิมพ์เป็นรูปภาพทั้งใบ → ภาษาไทยคมชัด ไม่เพี้ยน · Android ใช้ Chrome · iPhone ใช้แอป Bluefy (Safari/LINE ต่อบลูทูธไม่ได้)
 */
const RP = { dev: null, ch: null, name: '', busy: false, W: 384 };
// ใช้ค่าเดียวกับระบบ DD หลอมทอง (ทดสอบกับเครื่อง Y58 จริงแล้ว) · อยู่โดเมนเดียวกัน จึงใช้สิทธิ์เครื่องพิมพ์ที่เคยอนุญาตไว้ร่วมกันได้
const RP_SVC = [0x18f0, 0xff00, 0xffe0, 0xfee7, 0xae30, 0xff80, '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'];
const rpOk = () => !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
const rpIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function rpLoad(k) { try { const v = localStorage.getItem(k); return v == null ? '' : v.replace(/^"|"$/g, ''); } catch (e) { return ''; } }
function rpSaved() { return rpLoad('rpName') || rpLoad('dd_bt_name'); }

// ---------- เชื่อมเครื่องพิมพ์ ----------
async function rpAttach(dev) {
  const srv = await dev.gatt.connect(); let ch = null;
  for (const sv of await srv.getPrimaryServices()) { for (const c of await sv.getCharacteristics()) { if (!ch && (c.properties.writeWithoutResponse || c.properties.write)) ch = c; } }
  if (!ch) throw new Error('ไม่พบช่องส่งข้อมูลของเครื่องพิมพ์');
  if (RP.dev !== dev) dev.addEventListener('gattserverdisconnected', () => { RP.ch = null; rpStatus(); });
  RP.dev = dev; RP.ch = ch; RP.name = dev.name || 'เครื่องพิมพ์';
  try { localStorage.setItem('rpName', RP.name); } catch (e) {}
  rpStatus();
}
async function rpPick() {
  if (!rpOk()) throw new Error(rpIOS() ? 'iPhone ต้องเปิดระบบในแอป Bluefy ถึงจะต่อเครื่องพิมพ์ได้' : 'ใช้ Google Chrome เพื่อเชื่อมบลูทูธ');
  const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: RP_SVC }); await rpAttach(dev);
}
async function rpReady() { // ต่อเครื่องเดิมให้เอง ไม่ต้องเลือกใหม่
  if (RP.ch && RP.dev && RP.dev.gatt.connected) return true;
  if (RP.dev) { try { await rpAttach(RP.dev); return true; } catch (e) {} }
  if (navigator.bluetooth && navigator.bluetooth.getDevices) {
    try { const ds = await navigator.bluetooth.getDevices(), nm = rpSaved(); const d = ds.find(x => x.name === nm) || (ds.length === 1 ? ds[0] : null); if (d) { await rpAttach(d); return true; } } catch (e) {}
  }
  return false;
}
async function rpConnect(pick) { if (pick || !(await rpReady())) await rpPick(); return RP.ch; }
async function rpWrite(parts) {
  const ch = RP.ch, wr = ch.properties.writeWithoutResponse ? v => ch.writeValueWithoutResponse(v) : v => ch.writeValue(v);
  for (const p of parts) for (let i = 0; i < p.length; i += 100) { await wr(p.slice(i, i + 100)); await new Promise(r => setTimeout(r, 20)); }
}
// ---------- รูป → คำสั่ง ESC/POS (GS v 0 พิมพ์ภาพ) แบบเดียวกับระบบหลอมทอง ----------
function rpRaster(cv) {
  const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data, bw = w / 8, out = [new Uint8Array([0x1B, 0x40])];
  for (let y0 = 0; y0 < h; y0 += 128) { const rows = Math.min(128, h - y0), buf = new Uint8Array(8 + bw * rows); buf.set([0x1D, 0x76, 0x30, 0, bw & 255, bw >> 8, rows & 255, rows >> 8]);
    for (let y = 0; y < rows; y++) for (let x = 0; x < w; x++) { const i = ((y0 + y) * w + x) * 4; if (d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11 < 150) buf[8 + y * bw + (x >> 3)] |= 0x80 >> (x & 7); }
    out.push(buf); }
  const pad = 176, blank = new Uint8Array(8 + bw * pad); blank.set([0x1D, 0x76, 0x30, 0, bw & 255, bw >> 8, pad & 255, pad >> 8]); out.push(blank); // เว้นที่ว่างท้ายใบ ~22 มม. (เครื่องบางรุ่นไม่ป้อนกระดาษตามคำสั่ง)
  out.push(new Uint8Array([0x1B, 0x4A, 200, 0x1B, 0x4A, 40, 0x1B, 0x64, 0x02])); // ป้อนกระดาษให้ท้ายใบพ้นใบมีดฉีก
  return out;
}
// ---------- วาดใบเสร็จ (กว้าง 384 จุด = กระดาษ 58 มม.) ----------
function rpQR(text, size) {
  return new Promise(res => {
    if (!window.QRCode) return res(null);
    const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(d);
    try { new QRCode(d, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M }); } catch (e) { d.remove(); return res(null); }
    setTimeout(() => { const c = d.querySelector('canvas'); d.remove(); res(c); }, 30);
  });
}
async function rpReceipt(b, opt) {
  opt = opt || {};
  const s = S(), W = RP.W, P = 6, F = "'Sarabun','Loma','Tahoma',sans-serif", paid = b.status === 'ชำระแล้ว';
  try { if (document.fonts) await Promise.race([document.fonts.load('700 20px Sarabun'), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  const qrOn = opt.qr != null ? opt.qr : (!paid && !!s.promptpay);
  const qr = qrOn && s.promptpay ? await rpQR(promptPayPayload(s.promptpay, +b.total), 232) : null;
  const ops = []; let y = 10;
  const ctx0 = document.createElement('canvas').getContext('2d');
  const font = (sz, bold) => (bold ? '700 ' : '400 ') + sz + 'px ' + F;
  const wrap = (t, sz, bold, maxW) => { ctx0.font = font(sz, bold); const out = []; let line = ''; for (const ch of Array.from(String(t))) { if (ctx0.measureText(line + ch).width > maxW && line) { out.push(line); line = ch.trim() ? ch : ''; } else line += ch; } if (line) out.push(line); return out.length ? out : [''] };
  const text = (t, sz, o) => { o = o || {}; const lh = Math.round(sz * 1.38); wrap(t, sz, o.bold, W - P * 2).forEach(l => { ops.push(['t', l, sz, o.bold, o.align || 'left', y + sz]); y += lh; }); };
  const row = (l, r, sz, bold) => { const lh = Math.round(sz * 1.38); ctx0.font = font(sz, bold); const rw = ctx0.measureText(r).width; const ls = wrap(l, sz, bold, W - P * 2 - rw - 10); ls.forEach((t, i) => { ops.push(['t', t, sz, bold, 'left', y + sz]); if (i === 0) ops.push(['t', r, sz, bold, 'right', y + sz]); y += lh; }); };
  const line = dash => { y += 4; ops.push(['l', y, dash]); y += 8; };
  text(s.buildingName || s.apartmentName || '', 28, { bold: true, align: 'center' });
  if (s.address) text(s.address, 17, { align: 'center' });
  if (s.lineTel1 || s.phone) text('โทร ' + (s.lineTel1 || s.phone), 17, { align: 'center' });
  line(true);
  text(paid ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งค่าเช่า', 25, { bold: true, align: 'center' });
  row('เลขที่', paid && b.receiptNo ? b.receiptNo : b.no, 18);
  row('วันที่', fmtDate(paid ? b.paidDate : (b.createdAt || '').slice(0, 10)), 18);
  if (b.room) row('ห้อง', b.room, 22, true);
  if (b.tenantName) row('ชื่อ', b.tenantName, 18);
  row('รายการ', billTitle(b), 18);
  line(true);
  (b.items || []).forEach(i => row(i.l, money(i.a), 19));
  line(false);
  row('รวมทั้งสิ้น', money(b.total) + ' บาท', 26, true);
  line(false);
  if (paid) { row('ชำระโดย', b.payMethod || '-', 18); if (+b.received > +b.total) { row('รับเงิน', money(b.received), 18); row('เงินทอน', money(b.received - b.total), 18); } text('✓ ชำระเรียบร้อยแล้ว', 22, { bold: true, align: 'center' }); }
  else if (b.dueDate) text('กรุณาชำระภายใน ' + fmtDate(b.dueDate), 19, { bold: true, align: 'center' });
  if (qr) { y += 6; ops.push(['q', qr, (W - 232) / 2, y, 232]); y += 238; text('สแกนจ่าย พร้อมเพย์ ' + s.promptpay, 17, { align: 'center' }); text('ยอด ' + money(b.total) + ' บาท', 19, { bold: true, align: 'center' }); }
  else if (!paid && s.bankInfo) text(s.bankInfo, 17, { align: 'center' });
  const who = paid ? b.paidBy : b.createdBy; if (who) { y += 2; text((paid ? 'ผู้รับเงิน: ' : 'ออกบิลโดย: ') + who, 17, { align: 'center' }); }
  y += 6; text('ขอบคุณครับ', 19, { align: 'center' });
  y += 14;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Math.ceil(y); const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, cv.height); g.fillStyle = '#000'; g.strokeStyle = '#000'; g.textBaseline = 'alphabetic';
  ops.forEach(o => {
    if (o[0] === 't') { g.font = font(o[2], o[3]); g.textAlign = o[4]; g.fillText(o[1], o[4] === 'center' ? W / 2 : o[4] === 'right' ? W - P : P, o[5]); }
    else if (o[0] === 'l') { g.lineWidth = 2; g.setLineDash(o[2] ? [6, 5] : []); g.beginPath(); g.moveTo(P, o[1]); g.lineTo(W - P, o[1]); g.stroke(); g.setLineDash([]); }
    else if (o[0] === 'q') { g.imageSmoothingEnabled = false; g.drawImage(o[1], o[2], o[3], o[4], o[4]); }
  });
  // ทำเป็นขาว-ดำล้วน (ภาพที่พิมพ์จะเหมือนพรีวิว)
  const id = g.getImageData(0, 0, W, cv.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11 < 150 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  g.putImageData(id, 0, 0);
  return cv;
}
// ---------- หน้าพิมพ์ใบเสร็จ ----------
let RPB = null;
async function rpSheet(id) {
  const b = billById(id); if (!b) return;
  RPB = { id, qr: b.status !== 'ชำระแล้ว' && !!S().promptpay };
  openSheet(`<h3>🧾 พิมพ์ใบเสร็จ 58 มม.</h3><div class="muted small">${b.room ? 'ห้อง ' + esc(b.room) + ' · ' : ''}${esc(b.tenantName || '')} · ${esc(billTitle(b))} · ${money(b.total)} บาท</div>
    <div id="rpSt" class="small" style="margin:8px 0"></div>
    ${S().promptpay ? `<label style="display:flex;gap:8px;align-items:center;margin:4px 0 8px;font-size:15px"><input type="checkbox" id="rpQr" ${RPB.qr ? 'checked' : ''} onchange="RPB.qr=this.checked;rpPreview()" style="width:20px;height:20px"> ใส่ QR พร้อมเพย์</label>` : '<div class="muted small" style="margin-bottom:8px">💡 ใส่เบอร์พร้อมเพย์ในหน้า ตั้งค่า › การรับเงิน เพื่อพิมพ์ QR</div>'}
    <div style="background:#e9edf3;border-radius:12px;padding:12px;text-align:center;max-height:46vh;overflow:auto"><div id="rpPv" class="muted">กำลังสร้างใบเสร็จ…</div></div>
    <div class="row" style="margin-top:10px;flex-wrap:wrap;gap:8px"><button class="btn" onclick="rpPickPrinter()">🔗 ${RP.ch ? 'เปลี่ยนเครื่อง' : 'เชื่อมเครื่องพิมพ์'}</button><button class="btn" onclick="rpSave()">⬇️ บันทึกรูป</button><span class="sp"></span><button class="btn pri" id="rpGo" onclick="rpPrint()">🖨 พิมพ์ (บลูทูธ)</button></div>
    <button class="btn blk" style="margin-top:8px" onclick="rpSysPrint()">🖥 พิมพ์ผ่านหน้าต่างพิมพ์ (เครื่องที่ต่อสาย USB / ติดตั้งไดรเวอร์)</button>
    <div class="muted small" style="margin-top:6px">หน้าต่างพิมพ์: เลือกเครื่อง Y58 · ขนาดกระดาษ 58 มม. (หรือ 58×210) · ระยะขอบ “ไม่มี” · ไม่ต้องย่อ/ขยาย</div>`);
  rpStatus(); rpPreview();
}
async function rpPreview() {
  const b = billById(RPB.id); const cv = await rpReceipt(b, { qr: RPB.qr }); RPB.cv = cv;
  const box = $('#rpPv'); if (!box) return; box.className = ''; box.innerHTML = ''; cv.style.cssText = 'width:240px;max-width:100%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15)'; box.appendChild(cv); rpSysPrep(cv);
}
function rpStatus() {
  const el = $('#rpSt'); if (!el) return;
  if (!rpOk()) { el.innerHTML = rpIOS()
    ? `<div class="card" style="background:var(--warn-soft);border:0;margin:0">📱 iPhone ต่อเครื่องพิมพ์ผ่าน Safari/LINE ไม่ได้ · ติดตั้งแอป <b>Bluefy</b> (ฟรี) แล้วเปิดลิงก์ระบบในแอปนั้น<div class="row" style="margin-top:8px;gap:8px"><a class="btn sm" href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055" target="_blank">ดาวน์โหลด Bluefy</a><button class="btn sm" onclick="navigator.clipboard&&navigator.clipboard.writeText(location.href.split('#')[0]).then(()=>toast('คัดลอกลิงก์แล้ว · ไปวางในแอป Bluefy'))">📋 คัดลอกลิงก์ระบบ</button></div></div>`
    : `<div class="card" style="background:var(--warn-soft);border:0;margin:0">เบราว์เซอร์นี้ต่อบลูทูธไม่ได้ · ใช้ <b>Chrome</b> บน Android หรือคอม (หรือกด “บันทึกรูป” แล้วพิมพ์จากแอปของเครื่องพิมพ์)</div>`; return; }
  el.innerHTML = RP.ch && RP.dev && RP.dev.gatt.connected ? `🟢 เชื่อมแล้ว: <b>${esc(RP.name)}</b>` : `⚪ ยังไม่ได้เชื่อม${rpSaved() ? ' · ครั้งก่อนใช้ <b>' + esc(rpSaved()) + '</b>' : ''} · เปิดเครื่องพิมพ์ แล้วกด “พิมพ์” เลือกชื่อเครื่องในรายการ`;
}
async function rpPickPrinter() { try { await rpPick(); toast('เชื่อมเครื่องพิมพ์ ' + RP.name + ' แล้ว'); } catch (e) { if (e.name !== 'NotFoundError') uiAlert('เชื่อมไม่สำเร็จ: ' + e.message); rpStatus(); } }
async function rpPrint() {
  const btn = $('#rpGo'); if (RP.busy) return toast('เครื่องพิมพ์กำลังพิมพ์อยู่ — รอสักครู่');
  if (!(await rpReady())) { try { await rpPick(); } catch (e) { if (e.name !== 'NotFoundError') uiAlert('เชื่อมไม่สำเร็จ: ' + e.message); rpStatus(); return; } }
  RP.busy = true;
  try {
    if (!RPB.cv) await rpPreview();
    btn.disabled = true; btn.textContent = 'กำลังพิมพ์…';
    await rpWrite(rpRaster(RPB.cv));
    toast('ส่งพิมพ์แล้ว');
  } catch (e) { RP.ch = null; uiAlert('พิมพ์ผ่านบลูทูธไม่สำเร็จ: ' + e.message + '\nลองปิด-เปิดเครื่องพิมพ์ แล้วกด “เชื่อมเครื่องพิมพ์” ใหม่'); }
  finally { RP.busy = false; if (btn) { btn.disabled = false; btn.textContent = '🖨 พิมพ์ (บลูทูธ)'; } rpStatus(); }
}
function rpSave() {
  if (!RPB || !RPB.cv) return; const b = billById(RPB.id), a = document.createElement('a');
  a.href = RPB.cv.toDataURL('image/png'); a.download = 'ใบเสร็จ_' + (b.room || '') + '_' + (b.receiptNo || b.no) + '.png'; document.body.appendChild(a); a.click(); a.remove();
}

// ---------- พิมพ์ผ่านหน้าต่างพิมพ์ของเครื่อง (USB / เครื่องที่ติดตั้งไดรเวอร์) · จัดหน้ากระดาษกว้าง 58 มม. ----------
// เตรียมรูปไว้ล่วงหน้าตั้งแต่ตอนสร้างพรีวิว (ถ้าสร้างตอนกดพิมพ์ รูปยังโหลดไม่ทัน หน้าพิมพ์จะว่างเปล่า)
function rpSysPrep(cv) {
  let box = document.getElementById('rpPrintBox');
  if (!box) { box = document.createElement('div'); box.id = 'rpPrintBox'; box.innerHTML = '<img alt="">'; document.body.appendChild(box); }
  const img = box.querySelector('img'); img.src = cv.toDataURL('image/png'); RPB.img = img; RPB.ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  let st = document.getElementById('rpPrintCss0');
  if (!st) { st = document.createElement('style'); st.id = 'rpPrintCss0'; st.textContent = '#rpPrintBox{position:fixed;left:-99999px;top:0;width:1px;height:1px;overflow:hidden}'; document.head.appendChild(st); }
}
function rpSysClear() { const e = document.getElementById('rpPrintCss'); if (e) e.remove(); document.body.classList.remove('rpprint'); }
async function rpSysPrint() {
  if (!RPB || !RPB.cv || !RPB.img) return toast('รอสร้างใบเสร็จสักครู่');
  if (!RPB.img.complete) await RPB.ready;
  rpSysClear();
  const cv = RPB.cv, wmm = 48, hmm = Math.ceil(cv.height / cv.width * wmm) + 12; // พื้นที่พิมพ์ 48 มม. บนกระดาษ 58 มม.
  const st = document.createElement('style'); st.id = 'rpPrintCss';
  st.textContent = `@media print{@page{size:58mm ${hmm}mm;margin:0}html,body{width:58mm!important;min-width:0!important;margin:0!important;padding:0!important;background:#fff!important}
body.rpprint>*:not(#rpPrintBox){display:none!important}body.rpprint #rpPrintBox{display:block!important;position:static!important;width:58mm!important;height:auto!important;overflow:visible!important;padding:3mm 5mm 0;box-sizing:border-box}
#rpPrintBox img{display:block;width:${wmm}mm;height:auto}}`;
  document.head.appendChild(st);
  document.body.classList.add('rpprint');
  window.addEventListener('afterprint', rpSysClear, { once: true });
  window.print();
}
