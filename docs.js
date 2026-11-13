/* ===================== เอกสาร: สัญญาเช่า / ใบรับเงินจอง + แผ่นเซ็นชื่อ (ใช้ร่วม admin.html และ sign.html) ===================== */
(function () {
  const css = `
.dsheet{background:#fff;color:#111;width:100%;max-width:794px;margin:0 auto 16px;padding:44px 50px;box-shadow:0 2px 14px rgba(0,0,0,.12);font-family:Sarabun,Loma,sans-serif;font-size:14.5px;line-height:1.7}
.dsheet h1{text-align:center;font-size:23px;margin:0}.dsheet .dc{text-align:center}.dsheet .dr{text-align:right}.dsheet p{margin:6px 0}
.dsheet .dsub{text-align:center;color:#555;margin:0 0 14px}.dsheet .dv{border-bottom:1px dotted #444;padding:0 4px;font-weight:600}
.dsheet .dh{font-weight:700;margin:10px 0 0}.dsheet .dtb{width:100%;border-collapse:collapse;margin:8px 0}.dsheet .dtb td,.dsheet .dtb th{border:1px solid #bbb;padding:5px 9px;text-align:left}.dsheet .dtb td.n{text-align:right;white-space:nowrap;font-weight:600}
.dsheet .dsig{display:flex;justify-content:space-between;gap:20px;margin-top:26px;text-align:center;page-break-inside:avoid}.dsheet .dsig>div{flex:1}
.dsheet .dsig img{height:64px;max-width:100%;display:block;margin:0 auto -14px}.dsheet .dsig .blank{height:50px}
.dsheet .etag{display:inline-block;font-size:11.5px;color:#15803d;border:1px solid #9bd3ae;border-radius:99px;padding:0 8px;margin-top:3px}
.dsheet .dfoot{color:#888;font-size:11.5px;text-align:center;margin-top:16px}
.dsheet.rc{max-width:520px;padding:30px 34px;font-size:14.5px}.dsheet .dln{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid #eee}.dsheet .dln span{color:#555}
.dsheet .dbig{display:flex;justify-content:space-between;font-size:19px;font-weight:700;padding:10px 0}.dsheet .dbox{background:#f5f7fb;border-radius:10px;padding:10px 14px;margin:10px 0}
.dsheet .dpaid{display:inline-block;border:2px solid #15803d;color:#15803d;border-radius:8px;padding:1px 10px;font-weight:700;transform:rotate(-5deg)}
.dsheet ul{margin:6px 0;padding-left:20px}
.spad{position:fixed;inset:0;z-index:9999;background:#fff;display:flex;flex-direction:column;touch-action:none}
.spad .spbar{background:#1e293b;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;gap:10px;font-size:15px}.spad .spbar em{color:#93c5fd;font-style:normal}
.spad canvas{flex:1;width:100%;touch-action:none;cursor:crosshair}.spad .sphint{position:absolute;left:0;right:0;bottom:84px;text-align:center;color:#cbd2dc;font-size:14px;pointer-events:none}
.spad .spline{position:absolute;left:12%;right:12%;bottom:150px;border-bottom:2px dashed #e2e8f0;pointer-events:none}
.spad .spbtn{display:flex;gap:8px;padding:12px;border-top:1px solid #e5e7eb;padding-bottom:max(12px,env(safe-area-inset-bottom))}.spad .spbtn .pri{flex:1}
.dov{position:fixed;inset:0;z-index:9000;background:#e9edf3;overflow:auto;-webkit-overflow-scrolling:touch}
.dov .dovbar{position:sticky;top:0;z-index:2;background:#1e293b;color:#fff;display:flex;gap:8px;align-items:center;padding:10px 14px;flex-wrap:wrap}.dov .dovbar b{flex:1;min-width:140px}
.dov .dovin{padding:16px 10px 40px}
@media (max-width:600px){.dsheet{padding:24px 18px;font-size:13.5px}.dsheet h1{font-size:20px}.dsheet .dsig{gap:10px}}
@media print{body.docprint>*:not(.dov){display:none!important}body.docprint .dov{position:static;background:#fff;overflow:visible}body.docprint .dovbar{display:none}body.docprint .dovin{padding:0}
  .dsheet{box-shadow:none;max-width:none;margin:0;padding:0 4mm}.dsheet+.dsheet{page-break-before:always}@page{size:A4;margin:16mm 14mm}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

const DOCL = {
  th: { lease: 'สัญญาเช่าห้องพัก', no: 'เลขที่', at: 'ทำที่', date: 'วันที่', landlord: 'ผู้ให้เช่า', tenant: 'ผู้เช่า', sign: 'ลงชื่อ',
    pay: 'เงินที่ผู้เช่าชำระในวันทำสัญญา', dep: 'เงินประกันการเช่า (คืนเมื่อสิ้นสุดสัญญา ตามข้อ 9)', adv: 'ค่าเช่าล่วงหน้า', key: 'มัดจำกุญแจ (คืนเมื่อคืนกุญแจ)', card: 'ค่าคีย์การ์ด', total: 'รวม', baht: 'บาท',
    att: 'เอกสารแนบท้ายสัญญา · รายการทรัพย์สินในห้อง', item: 'รายการ', cond: 'สภาพวันเข้าอยู่', noItems: 'ยังไม่ได้บันทึกอุปกรณ์ห้องในระบบ', itemOk: 'มี / ใช้งานได้', esign: 'เซ็นอิเล็กทรอนิกส์',
    estmt: 'สัญญานี้ทำเป็นเอกสารอิเล็กทรอนิกส์ คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงลงลายมือชื่ออิเล็กทรอนิกส์ไว้เป็นสำคัญ',
    pstmt: 'สัญญานี้ทำขึ้นเป็นสองฉบับมีข้อความตรงกัน คู่สัญญาได้อ่านและเข้าใจข้อความโดยตลอดแล้ว จึงลงลายมือชื่อไว้เป็นสำคัญ และต่างเก็บไว้ฝ่ายละหนึ่งฉบับ',
    intro: (L, T, b) => `สัญญานี้ทำขึ้นระหว่าง ${L} ซึ่งต่อไปเรียกว่า <b>“ผู้ให้เช่า”</b> ฝ่ายหนึ่ง กับ ${T} ซึ่งต่อไปเรียกว่า <b>“ผู้เช่า”</b> อีกฝ่ายหนึ่ง ทั้งสองฝ่ายตกลงกันดังต่อไปนี้`,
    idc: 'เลขบัตรประชาชน/พาสปอร์ต', addr: 'ที่อยู่', tel: 'โทร', page: 'หน้า',
    bookT: 'ใบรับเงินจองห้อง', booker: 'ผู้จอง', room: 'ห้อง', floor: 'ชั้น', moveAt: 'วันเวลาเข้าอยู่', recvAt: 'วันที่รับเงิน', bdep: 'เงินจอง', paid: 'ชำระแล้ว ✓',
    mi: 'ค่าแรกเข้าวันเข้าอยู่', miAll: 'ค่าแรกเข้าทั้งหมด', miLess: 'หักเงินจอง', miLeft: 'คงเหลือชำระวันเข้าอยู่', recv: 'ผู้รับเงิน', bnote: 'หมายเหตุ', cond2: 'เงื่อนไข' },
  en: { lease: 'Residential Lease Agreement', no: 'No.', at: 'Made at', date: 'Date', landlord: 'Landlord', tenant: 'Tenant', sign: 'Signed',
    pay: 'Payment on signing', dep: 'Security deposit (refundable per clause 9)', adv: 'Advance rent', key: 'Key deposit (refundable)', card: 'Key card fee', total: 'Total', baht: 'THB',
    att: 'Attachment · Room inventory', item: 'Item', cond: 'Condition at move-in', noItems: 'No room items recorded', itemOk: 'OK', esign: 'e-signed',
    estmt: 'This agreement is made electronically. Both parties have read and understood it and have signed electronically below.',
    pstmt: 'This agreement is made in two identical copies. Both parties have read and understood it, signed below, and each keeps one copy.',
    intro: (L, T) => `This agreement is made between ${L} (the <b>“Landlord”</b>) and ${T} (the <b>“Tenant”</b>). Both parties agree as follows.`,
    idc: 'ID/Passport no.', addr: 'Address', tel: 'Tel', page: 'Page',
    bookT: 'Booking Receipt', booker: 'Booked by', room: 'Room', floor: 'Floor', moveAt: 'Move-in', recvAt: 'Received on', bdep: 'Booking deposit', paid: 'PAID ✓',
    mi: 'Due on move-in', miAll: 'Total move-in cost', miLess: 'Less booking deposit', miLeft: 'Balance due on move-in', recv: 'Received by', bnote: 'Note', cond2: 'Terms' },
};
const DTH_M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const DEN_M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function dEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function dNum(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function dDate(d, lang) { const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return '-'; return lang === 'en' ? Number(m[3]) + ' ' + DEN_M[+m[2] - 1] + ' ' + m[1] : Number(m[3]) + ' ' + DTH_M[+m[2] - 1] + ' ' + (+m[1] + 543); }
function dShort(at, lang) { const m = String(at || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}:\d{2}))?/); if (!m) return '-'; return Number(m[3]) + '/' + Number(m[2]) + '/' + (lang === 'en' ? m[1] : String(+m[1] + 543).slice(-2)) + (m[4] ? ' ' + m[4] + (lang === 'en' ? '' : ' น.') : ''); }
function dV(v) { return `<span class="dv">${dEsc(v == null || v === '' ? '                    ' : v)}</span>`; }
function docTermsHtml(d) {
  const L = d.lang, t = d.t || {}, r = d.rates || {};
  const map = { room: d.room.room, floor: d.room.floor || '-', months: t.months || '-', start: dDate(t.start, L), end: dDate(t.end, L), rent: dNum(d.room.rent), dueDay: r.dueDay || '-', water: dNum(r.water), elec: dNum(r.elec),
    common: r.common ? (L === 'en' ? ' Common/internet fee ' + dNum(r.common) + ' THB per month.' : ' และค่าส่วนกลาง/อินเทอร์เน็ตเดือนละ ' + dNum(r.common) + ' บาท') : '' };
  return String(d.terms || '').split('\n').map(x => x.trim()).filter(Boolean).map(line => {
    const h = /^(ข้อ\s*\d+|\d+\.)\s*\S/.test(line) && line.length < 70;
    const html = dEsc(line).replace(/\{(\w+)\}/g, (m, k) => map[k] != null ? (k === 'common' ? dEsc(map[k]) : '<b>' + dEsc(map[k]) + '</b>') : m);
    return h ? `<p class="dh">${html}</p>` : `<p style="text-indent:2em">${html}</p>`;
  }).join('');
}
function docSigBlock(d, who, label, name) {
  const s = (d.signs || {})[who], L = DOCL[d.lang];
  return `<div>${s && d.mode !== 'paper' ? `<img src="${s.img}" alt="">` : '<div class="blank"></div>'}${L.sign} ....................................................<br>( ${dEsc(name || '                         ')} )<br>${label}${s && d.mode !== 'paper' ? `<br><span class="etag">${L.esign} ${dEsc(dShort(s.at, d.lang))}</span>` : ''}</div>`;
}
function docHtml(d) {
  const L = DOCL[d.lang] || DOCL.th, b = d.b || {};
  if (d.kind === 'book') {
    const k = d.bk || {}, mi = d.moveIn || {}, all = mi.deposit + mi.advance + mi.key + mi.card, left = Math.max(0, all - k.deposit);
    return `<div class="dsheet rc"><h1>🧾 ${L.bookT}</h1><p class="dsub">${dEsc(b.name)}${b.address ? '<br>' + dEsc(b.address) : ''}</p>
      <div class="dln"><span>${L.no}</span><b>${dEsc(d.no || '-')}</b></div>
      <div class="dln"><span>${L.booker}</span><b>${dEsc(k.name)}</b></div>
      <div class="dln"><span>${L.tel}</span><b>${dEsc(k.phone || '-')}</b></div>
      <div class="dln"><span>${L.room}</span><b>${dEsc(d.room.room)}${d.room.floor ? ' · ' + L.floor + ' ' + dEsc(d.room.floor) : ''}</b></div>
      <div class="dln"><span>${L.moveAt}</span><b>${dEsc(dShort(k.at, d.lang))}</b></div>
      <div class="dln"><span>${L.recvAt}</span><b>${dEsc(dShort(d.date, d.lang))}</b></div>
      ${k.note ? `<div class="dln"><span>${L.bnote}</span><span style="text-align:right;color:#111">${dEsc(k.note)}</span></div>` : ''}
      <div class="dbig"><span>${L.bdep}</span><span style="color:#15803d">${dNum(k.deposit)} ${L.baht}</span></div>
      ${k.deposit ? `<div class="dr"><span class="dpaid">${L.paid}</span></div>` : ''}
      <div class="dbox"><b>${L.mi}</b>
        <div class="dln"><span>${L.miAll}</span><b>${dNum(all)} ${L.baht}</b></div>
        <div class="dln"><span>${L.miLess}</span><b>− ${dNum(k.deposit)} ${L.baht}</b></div>
        <div class="dln" style="border:0"><span style="color:#111"><b>${L.miLeft}</b></span><b style="color:#2457c5;font-size:17px">${dNum(left)} ${L.baht}</b></div></div>
      <b>${L.cond2}</b><ul>${String(d.terms || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => `<li>${dEsc(x)}</li>`).join('')}</ul>
      <div class="dsig">${docSigBlock(d, 'tenant', L.booker, k.name)}${docSigBlock(d, 'owner', L.recv, b.landlord)}</div>
      <div class="dfoot">${dEsc(d.no || '')}</div></div>`;
  }
  const t = d.t || {}, rent = d.room.rent;
  const party = d.lang === 'en'
    ? `${dV(t.name)}, ${L.idc} ${dV(t.idCard)}, ${L.addr} ${dV(t.idAddress)}, ${L.tel} ${dV(t.phone)}`
    : `${dV(t.name)} ${L.idc} ${dV(t.idCard)} ${L.addr} ${dV(t.idAddress)} ${L.tel} ${dV(t.phone)}`;
  const rows = [[L.dep, t.deposit], [L.adv, t.advance], [L.key, t.key], [L.card, t.card]].filter(x => +x[1]);
  const sum = rows.reduce((a, x) => a + (+x[1] || 0), 0);
  const items = d.items && typeof d.items === 'object' ? Object.keys(d.items) : [];
  const page1 = `<div class="dsheet"><h1>${L.lease}</h1><p class="dsub">${dEsc(b.name)}${b.address ? ' · ' + dEsc(b.address) : ''}</p>
    <p class="dr">${L.no} ${dV(d.no)} &nbsp; ${L.at} ${dV(b.name)}<br>${L.date} ${dV(dDate(d.date, d.lang))}</p>
    <p style="text-indent:2em">${L.intro(dV(b.landlord), party, b)}</p>
    ${docTermsHtml(d)}
    <p class="dh">${L.pay}</p>
    <table class="dtb">${rows.map(x => `<tr><td>${x[0]}</td><td class="n">${dNum(x[1])} ${L.baht}</td></tr>`).join('')}<tr><td><b>${L.total}</b></td><td class="n">${dNum(sum)} ${L.baht}</td></tr></table>
    <p style="text-indent:2em;margin-top:14px">${d.mode === 'e' ? L.estmt : L.pstmt}</p>
    <div class="dsig">${docSigBlock(d, 'owner', L.landlord, b.landlord)}${docSigBlock(d, 'tenant', L.tenant, t.name)}</div>
    <div class="dfoot">${dEsc(d.no || '')} · ${L.room} ${dEsc(d.room.room)} · ${dNum(rent)} ${L.baht}</div></div>`;
  const page2 = `<div class="dsheet"><h1 style="font-size:19px">${L.att}</h1><p class="dsub">${L.no} ${dEsc(d.no || '')} · ${L.room} ${dEsc(d.room.room)}</p>
    ${items.length ? `<table class="dtb"><tr><th style="width:44px">#</th><th>${L.item}</th><th>${L.cond}</th></tr>${items.map((k, i) => { const v = d.items[k] || {}; return `<tr><td>${i + 1}</td><td>${dEsc(k)}</td><td>${v.s ? dEsc(v.s === 'มี' ? L.itemOk : d.lang === 'en' ? ({ 'ขาด': 'Missing', 'ชำรุด': 'Damaged' }[v.s] || v.s) : v.s) : `<span style="color:#666">☐ ${L.itemOk} &nbsp; ☐ ${d.lang === 'en' ? 'Missing' : 'ขาด'} &nbsp; ☐ ${d.lang === 'en' ? 'Damaged' : 'ชำรุด'}</span>`}${v.n ? ' · ' + dEsc(v.n) : ''}</td></tr>`; }).join('')}</table>` : `<p class="dc" style="color:#888">${L.noItems}</p>`}
    <div class="dsig">${docSigBlock(d, 'owner', L.landlord, b.landlord)}${docSigBlock(d, 'tenant', L.tenant, t.name)}</div></div>`;
  return page1 + page2;
}
// แสดงเอกสารเต็มจอ + แถบปุ่ม (พิมพ์/PDF ฯลฯ)
function docShow(d, bar) {
  docClose();
  const ov = document.createElement('div'); ov.className = 'dov'; ov.id = 'docOv';
  ov.innerHTML = `<div class="dovbar"><b>${dEsc(d.kind === 'book' ? DOCL[d.lang].bookT : DOCL[d.lang].lease)} · ${dEsc(d.no || '')}</b>${bar || ''}<button class="btn sm" onclick="docPrint()">🖨 พิมพ์ / PDF</button><button class="btn sm" onclick="docClose()">✕ ปิด</button></div><div class="dovin">${docHtml(d)}</div>`;
  document.body.appendChild(ov); document.body.style.overflow = 'hidden';
}
function docClose() { const o = document.getElementById('docOv'); if (o) o.remove(); document.body.style.overflow = ''; }
function docPrint() { document.body.classList.add('docprint'); setTimeout(() => { window.print(); setTimeout(() => document.body.classList.remove('docprint'), 500); }, 50); }
// แผ่นเซ็นชื่อเต็มจอ → คืนค่า PNG (data URL) ที่ตัดขอบแล้ว หรือ null ถ้ายกเลิก
function signPad(o) {
  o = o || {};
  return new Promise(resolve => {
    const ov = document.createElement('div'); ov.className = 'spad';
    ov.innerHTML = `<div class="spbar"><span>✍️ ${dEsc(o.title || 'เซ็นชื่อ')} <em>${dEsc(o.name || '')}</em></span><b>${dEsc(o.step || '')}</b></div><canvas></canvas><div class="spline"></div><div class="sphint">${dEsc(o.hint || 'เซ็นชื่อด้วยนิ้วหรือปากกาในกรอบนี้')}</div>
      <div class="spbtn"><button class="btn" data-a="x">✕ ${dEsc(o.cancel || 'ยกเลิก')}</button><button class="btn" data-a="c">↻ ${dEsc(o.clear || 'ล้าง')}</button><button class="btn pri" data-a="ok">✓ ${dEsc(o.ok || 'เซ็นเสร็จ')}</button></div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), S = []; let cur = null;
    const fit = () => { const r = cv.getBoundingClientRect(), k = window.devicePixelRatio || 1; cv.width = r.width * k; cv.height = r.height * k; ctx.setTransform(k, 0, 0, k, 0, 0); draw(); };
    const draw = () => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2.6; S.forEach(path); };
    const path = s => { ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); if (s.length === 1) ctx.lineTo(s[0][0] + .1, s[0][1]); for (let i = 1; i < s.length - 1; i++) ctx.quadraticCurveTo(s[i][0], s[i][1], (s[i][0] + s[i + 1][0]) / 2, (s[i][1] + s[i + 1][1]) / 2); if (s.length > 1) ctx.lineTo(s[s.length - 1][0], s[s.length - 1][1]); ctx.stroke(); };
    const pt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = [pt(e)]; S.push(cur); ov.querySelector('.sphint').style.display = 'none'; draw(); });
    cv.addEventListener('pointermove', e => { if (!cur) return; e.preventDefault(); (e.getCoalescedEvents ? e.getCoalescedEvents() : [e]).forEach(x => cur.push(pt(x))); draw(); });
    const up = () => { cur = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    window.addEventListener('resize', fit); setTimeout(fit, 0);
    const done = v => { window.removeEventListener('resize', fit); ov.remove(); resolve(v); };
    const exp = () => {
      const all = [].concat.apply([], S); if (all.length < 3) return null;
      let x0 = Math.min(...all.map(p => p[0])), x1 = Math.max(...all.map(p => p[0])), y0 = Math.min(...all.map(p => p[1])), y1 = Math.max(...all.map(p => p[1]));
      const pad = 8; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
      for (const maxW of [560, 420, 320, 240]) {
        const k = Math.min(1.4, maxW / (x1 - x0), 200 / (y1 - y0)), c = document.createElement('canvas'), g = c.getContext('2d');
        c.width = Math.ceil((x1 - x0) * k); c.height = Math.ceil((y1 - y0) * k);
        g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#0b2a6b'; g.lineWidth = Math.max(1.6, 2.6 * k);
        S.forEach(s => { g.beginPath(); const P = s.map(p => [(p[0] - x0) * k, (p[1] - y0) * k]); g.moveTo(P[0][0], P[0][1]); if (P.length === 1) g.lineTo(P[0][0] + .1, P[0][1]); for (let i = 1; i < P.length - 1; i++) g.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2); if (P.length > 1) g.lineTo(P[P.length - 1][0], P[P.length - 1][1]); g.stroke(); });
        const u = c.toDataURL('image/png'); if (u.length < 45000) return u;
      }
      return null;
    };
    ov.addEventListener('click', e => { const a = e.target.closest('[data-a]'); if (!a) return; const k = a.dataset.a;
      if (k === 'x') return done(null);
      if (k === 'c') { S.length = 0; draw(); ov.querySelector('.sphint').style.display = ''; return; }
      const u = exp(); if (!u) { alert(o.empty || 'กรุณาเซ็นชื่อก่อน'); return; } done(u); });
  });
}
