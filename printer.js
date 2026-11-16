/* ===================== พิมพ์ใบเสร็จ 58 มม. ผ่านบลูทูธ (เครื่อง Y58 / เครื่องพิมพ์ความร้อน ESC/POS) =====================
 * พิมพ์เป็นรูปภาพทั้งใบ → ภาษาไทยคมชัด ไม่เพี้ยน · Android ใช้ Chrome · iPhone ใช้แอป Bluefy (Safari/LINE ต่อบลูทูธไม่ได้)
 */
const RP = { dev: null, ch: null, name: '', chunk: 180, W: 384 };
const RP_SVC = ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb', '0000ae30-0000-1000-8000-00805f9b34fb',
  '0000ae00-0000-1000-8000-00805f9b34fb', '0000ff80-0000-1000-8000-00805f9b34fb', '00001101-0000-1000-8000-00805f9b34fb'];
const rpOk = () => !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
const rpIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function rpSaved() { try { return localStorage.getItem('rpName') || ''; } catch (e) { return ''; } }

// ---------- เชื่อมเครื่องพิมพ์ ----------
async function rpConnect(pick) {
  if (!rpOk()) throw new Error(rpIOS() ? 'iPhone ต้องเปิดระบบในแอป Bluefy ถึงจะต่อเครื่องพิมพ์ได้' : 'เบราว์เซอร์นี้ต่อบลูทูธไม่ได้ · ใช้ Chrome บน Android หรือคอม');
  if (pick || !RP.dev) {
    RP.dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: RP_SVC });
    RP.ch = null; RP.dev.addEventListener('gattserverdisconnected', () => { RP.ch = null; rpStatus(); });
  }
  if (RP.ch && RP.dev.gatt.connected) return RP.ch;
  const srv = await RP.dev.gatt.connect();
  let ch = null;
  for (const u of RP_SVC) {
    let s; try { s = await srv.getPrimaryService(u); } catch (e) { continue; }
    const cs = await s.getCharacteristics();
    ch = cs.find(c => c.properties.writeWithoutResponse) || cs.find(c => c.properties.write);
    if (ch) break;
  }
  if (!ch) { try { for (const s of await srv.getPrimaryServices()) { const cs = await s.getCharacteristics(); ch = cs.find(c => c.properties.writeWithoutResponse || c.properties.write); if (ch) break; } } catch (e) {} }
  if (!ch) throw new Error('เครื่องนี้ไม่ใช่เครื่องพิมพ์ที่รองรับ (ไม่พบช่องส่งข้อมูล) · ลองเลือกชื่อเครื่องอื่นในรายการ');
  RP.ch = ch; RP.name = RP.dev.name || 'เครื่องพิมพ์';
  try { localStorage.setItem('rpName', RP.name); } catch (e) {}
  rpStatus(); return ch;
}
async function rpWrite(bytes) {
  const ch = RP.ch, slow = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < bytes.length;) {
    const part = bytes.slice(i, i + RP.chunk);
    try {
      if (ch.properties.writeWithoutResponse && ch.writeValueWithoutResponse) { await ch.writeValueWithoutResponse(part); await slow(RP.chunk > 100 ? 18 : 6); }
      else await (ch.writeValueWithResponse ? ch.writeValueWithResponse(part) : ch.writeValue(part));
      i += part.length;
    } catch (e) { if (RP.chunk > 20) { RP.chunk = 20; continue; } throw e; } // เครื่อง/มือถือบางรุ่นรับครั้งละ 20 ไบต์
  }
}
// ---------- รูป → คำสั่ง ESC/POS (GS v 0 พิมพ์ภาพ) ----------
function rpRaster(cv) {
  const W = cv.width, H = cv.height, bw = W / 8, px = cv.getContext('2d').getImageData(0, 0, W, H).data, out = [0x1B, 0x40];
  for (let y0 = 0; y0 < H; y0 += 48) { // พิมพ์ทีละแถบ กันบัฟเฟอร์เครื่องเต็ม
    const h = Math.min(48, H - y0); out.push(0x1D, 0x76, 0x30, 0x00, bw & 255, bw >> 8, h & 255, h >> 8);
    for (let y = y0; y < y0 + h; y++) for (let xb = 0; xb < bw; xb++) {
      let b = 0; for (let k = 0; k < 8; k++) { const i = (y * W + xb * 8 + k) * 4; if (px[i + 3] > 0 && px[i] < 140) b |= 0x80 >> k; } out.push(b);
    }
  }
  out.push(0x1B, 0x64, 0x04); // เลื่อนกระดาษ 4 บรรทัด
  return new Uint8Array(out);
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
    <div class="row" style="margin-top:10px;flex-wrap:wrap;gap:8px"><button class="btn" onclick="rpPickPrinter()">🔗 ${RP.ch ? 'เปลี่ยนเครื่อง' : 'เชื่อมเครื่องพิมพ์'}</button><button class="btn" onclick="rpSave()">⬇️ บันทึกรูป</button><span class="sp"></span><button class="btn pri" id="rpGo" onclick="rpPrint()">🖨 พิมพ์</button></div>`);
  rpStatus(); rpPreview();
}
async function rpPreview() {
  const b = billById(RPB.id); const cv = await rpReceipt(b, { qr: RPB.qr }); RPB.cv = cv;
  const box = $('#rpPv'); if (!box) return; box.className = ''; box.innerHTML = ''; cv.style.cssText = 'width:240px;max-width:100%;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.15)'; box.appendChild(cv);
}
function rpStatus() {
  const el = $('#rpSt'); if (!el) return;
  if (!rpOk()) { el.innerHTML = rpIOS()
    ? `<div class="card" style="background:var(--warn-soft);border:0;margin:0">📱 iPhone ต่อเครื่องพิมพ์ผ่าน Safari/LINE ไม่ได้ · ติดตั้งแอป <b>Bluefy</b> (ฟรี) แล้วเปิดลิงก์ระบบในแอปนั้น<div class="row" style="margin-top:8px;gap:8px"><a class="btn sm" href="https://apps.apple.com/app/bluefy-web-ble-browser/id1492822055" target="_blank">ดาวน์โหลด Bluefy</a><button class="btn sm" onclick="navigator.clipboard&&navigator.clipboard.writeText(location.href.split('#')[0]).then(()=>toast('คัดลอกลิงก์แล้ว · ไปวางในแอป Bluefy'))">📋 คัดลอกลิงก์ระบบ</button></div></div>`
    : `<div class="card" style="background:var(--warn-soft);border:0;margin:0">เบราว์เซอร์นี้ต่อบลูทูธไม่ได้ · ใช้ <b>Chrome</b> บน Android หรือคอม (หรือกด “บันทึกรูป” แล้วพิมพ์จากแอปของเครื่องพิมพ์)</div>`; return; }
  el.innerHTML = RP.ch && RP.dev && RP.dev.gatt.connected ? `🟢 เชื่อมแล้ว: <b>${esc(RP.name)}</b>` : `⚪ ยังไม่ได้เชื่อม${rpSaved() ? ' · ครั้งก่อนใช้ <b>' + esc(rpSaved()) + '</b>' : ''} · เปิดเครื่องพิมพ์ แล้วกด “พิมพ์” เลือกชื่อเครื่องในรายการ`;
}
async function rpPickPrinter() { try { await rpConnect(true); toast('เชื่อมเครื่องพิมพ์แล้ว'); } catch (e) { if (!/cancel|User cancelled|NotFoundError/i.test(e.name + e.message)) uiAlert('เชื่อมไม่สำเร็จ: ' + e.message); rpStatus(); } }
async function rpPrint() {
  const btn = $('#rpGo');
  try {
    if (!RP.ch || !RP.dev || !RP.dev.gatt.connected) await rpConnect(!RP.dev); // ต้องเรียกทันทีตอนกด (iPhone/Android กำหนด)
    if (!RPB.cv) await rpPreview();
    btn.disabled = true; btn.textContent = 'กำลังพิมพ์…';
    await rpWrite(rpRaster(RPB.cv));
    toast('ส่งพิมพ์แล้ว');
  } catch (e) { if (!/cancel|NotFoundError/i.test(e.name + e.message)) uiAlert('พิมพ์ไม่สำเร็จ: ' + e.message + '\nลองปิด-เปิดเครื่องพิมพ์ แล้วกด “เชื่อมเครื่องพิมพ์” ใหม่'); }
  finally { if (btn) { btn.disabled = false; btn.textContent = '🖨 พิมพ์'; } rpStatus(); }
}
function rpSave() {
  if (!RPB || !RPB.cv) return; const b = billById(RPB.id), a = document.createElement('a');
  a.href = RPB.cv.toDataURL('image/png'); a.download = 'ใบเสร็จ_' + (b.room || '') + '_' + (b.receiptNo || b.no) + '.png'; document.body.appendChild(a); a.click(); a.remove();
}
