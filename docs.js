/* ===================== เอกสาร: สัญญาเช่า / ใบรับเงินจอง + แผ่นเซ็นชื่อ (ใช้ร่วม admin.html และ sign.html) ===================== */
(function () {
  const css = `
.dsheet{background:#fff;color:#111;font-family:Sarabun,Loma,sans-serif;font-size:14.5px;line-height:1.62;box-shadow:0 2px 14px rgba(0,0,0,.14)}
.dsheet.dpage{width:210mm;height:297mm;margin:0 auto 14px;padding:13mm 15mm 0;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden}
.dsheet.dpage.rc{padding-bottom:12mm}.dpc{flex:1;min-height:0;overflow:hidden}
.dsheet h1{text-align:center;font-size:22px;margin:0}.dsheet .dc{text-align:center}.dsheet .dr{text-align:right}.dsheet p{margin:5px 0}
.dsheet .dsub{text-align:center;color:#555;margin:0 0 12px}.dsheet .dv{border-bottom:1px dotted #444;padding:0 4px;font-weight:600}
.dsheet .dblank{display:inline-block;min-width:62mm;border-bottom:1px dotted #444;height:1.2em}
.dsheet .dh{font-weight:700;margin:9px 0 0}.dsheet .dtb{width:100%;border-collapse:collapse;margin:6px 0}.dsheet .dtb td{border:1px solid #bbb;padding:4px 9px;text-align:left}.dsheet .dtb td.n{text-align:right;white-space:nowrap;font-weight:600}
.dsheet .drow{display:grid;grid-template-columns:12mm 1fr 1.4fr;border:1px solid #bbb;border-top:0}.dsheet .drow>div{padding:4px 8px;border-left:1px solid #bbb}.dsheet .drow>div:first-child{border-left:0}.dsheet .drow.drh{border-top:1px solid #bbb;font-weight:700;background:#f5f5f5;margin-top:6px}
.dsheet .dsig{display:flex;justify-content:space-between;gap:20px;margin-top:22px;text-align:center}.dsheet .dsig>div{flex:1}
.dsheet .dsig img{height:60px;max-width:100%;display:block;margin:0 auto -14px}.dsheet .dsig .blank{height:46px}
.dsheet .etag{display:inline-block;font-size:11px;color:#15803d;border:1px solid #9bd3ae;border-radius:99px;padding:0 8px;margin-top:2px}
.dpfoot{flex:none;height:27mm;border-top:1px solid #ccc;display:flex;align-items:flex-end;gap:14px;padding:0 0 7mm;font-size:11.5px;line-height:1.35}
.dpfoot .fs{flex:1;text-align:center}.dpfoot .fs img{height:30px;max-width:100%;display:block;margin:0 auto -8px}.dpfoot .fs .blank{height:24px}.dpfoot .dpn{flex:none;color:#666;white-space:nowrap;align-self:flex-end}
.dsheet .dln{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid #eee}.dsheet .dln span{color:#555}
.dsheet .dbig{display:flex;justify-content:space-between;font-size:19px;font-weight:700;padding:8px 0}.dsheet .dbox{background:#f5f7fb;border-radius:10px;padding:8px 14px;margin:8px 0}
.dsheet .dpaid{display:inline-block;border:2px solid #15803d;color:#15803d;border-radius:8px;padding:0 10px;font-weight:700;transform:rotate(-5deg)}
.dsheet ul,.dsheet ol{margin:4px 0;padding-left:22px}.rcw{max-width:150mm;margin:0 auto}.dsheet h3{font-size:1em;font-weight:700;margin:9px 0 0}.dsheet h2{font-size:1.15em;margin:10px 0 2px}
.dedit{outline:none;width:210mm;min-height:297mm;margin:0 auto;padding:13mm 15mm;box-sizing:border-box;box-shadow:0 2px 14px rgba(0,0,0,.14)}.dedit:focus{box-shadow:0 0 0 3px #93c5fd}
.dsheet hr.dpb{border:0;border-top:2px dashed #f59e0b;margin:14px 0;position:relative;overflow:visible}.dsheet hr.dpb::after{content:'— ขึ้นแผ่นใหม่ —';position:absolute;left:50%;top:-11px;transform:translateX(-50%);background:#fff;color:#b45309;font-size:12px;padding:0 8px}
.dovbar .tb{background:#334155;color:#fff;border:0;border-radius:8px;padding:6px 10px;font:inherit;font-size:13.5px;cursor:pointer}.dovbar .tb:hover{background:#475569}
.spad{position:fixed;inset:0;z-index:9999;background:#fff;display:flex;flex-direction:column;touch-action:none}
.spad .spbar{background:#1e293b;color:#fff;padding:12px 16px;display:flex;justify-content:space-between;gap:10px;font-size:15px}.spad .spbar em{color:#93c5fd;font-style:normal}
.spad canvas{flex:1 1 0;min-height:0;height:0;width:100%;display:block;touch-action:none;cursor:crosshair}.spad .sphint{position:absolute;left:0;right:0;bottom:84px;text-align:center;color:#cbd2dc;font-size:14px;pointer-events:none}
.spad .spline{position:absolute;left:12%;right:12%;bottom:150px;border-bottom:2px dashed #e2e8f0;pointer-events:none}
.spad .sprot{background:#3b82f6;color:#fff;border:0;border-radius:99px;padding:6px 12px;font:inherit;font-size:13.5px;font-weight:700;white-space:nowrap}
@media (max-height:500px){.spad .spbar{padding:7px 14px}.spad .spbtn{padding:7px 12px}.spad .spline{bottom:96px}.spad .sphint{bottom:66px}}
.spad.rot .spbar{padding:7px 14px}.spad.rot .spbtn{padding:7px 12px}.spad.rot .spline{bottom:96px}.spad.rot .sphint{bottom:66px}
.spad .spbtn{display:flex;gap:8px;padding:12px;border-top:1px solid #e5e7eb;padding-bottom:max(12px,env(safe-area-inset-bottom))}.spad .spbtn .pri{flex:1}
.dov{position:fixed;inset:0;z-index:9000;background:#e9edf3;overflow:auto;-webkit-overflow-scrolling:touch}
.dov .dovbar{position:sticky;top:0;z-index:2;background:#1e293b;color:#fff;display:flex;gap:8px;align-items:center;padding:10px 14px;flex-wrap:wrap}.dov .dovbar b{flex:1;min-width:140px}
.dov .dovin{padding:14px 8px 40px;overflow-x:hidden}
@media print{@page{size:A4;margin:0}body.docprint>*:not(.dov){display:none!important}body.docprint .dov{position:static;background:#fff;overflow:visible}body.docprint .dovbar{display:none}body.docprint .dovin{padding:0}
  .dsheet.dpage{zoom:.84!important;margin:2mm auto 0!important;box-shadow:none!important;height:296mm;break-after:page;page-break-after:always} /* ย่อ 84%: iPhone/Safari ใส่ขอบกระดาษ+หัวท้ายเองเสมอ ถ้าเต็ม A4 จะตกขอบ */.dsheet.dpage.dlast{break-after:auto;page-break-after:auto}}`;
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
function docSigImg(d, who) { const s = (d.signs || {})[who]; return s && d.mode !== 'paper' ? s : null; }
function docSigBlock(d, who, label, name) {
  const s = docSigImg(d, who), L = DOCL[d.lang];
  return `<div>${s ? `<img src="${s.img}" alt="">` : '<div class="blank"></div>'}${L.sign} ....................................................<br>( ${dEsc(name || '                         ')} )<br>${label}${s ? `<br><span class="etag">${L.esign} ${dEsc(dShort(s.at, d.lang))}</span>` : ''}</div>`;
}
function docFootSig(d, who, label) { const s = docSigImg(d, who), L = DOCL[d.lang]; return `<div class="fs">${s ? `<img src="${s.img}" alt="">` : '<div class="blank"></div>'}${L.sign} ...................................... ${label}</div>`; }
// สร้าง HTML ของเอกสาร (ยังไม่แบ่งหน้า) → ใช้ docRender() เพื่อแบ่งเป็นแผ่น A4
function docHtml(d) {
  const L = DOCL[d.lang] || DOCL.th, b = d.b || {};
  if (d.kind === 'invoice') return docInvoice(d);
  if (d.kind === 'book') {
    const k = d.bk || {}, mi = d.moveIn || {}, all = mi.deposit + mi.advance + mi.key + mi.card, left = Math.max(0, all - k.deposit);
    return `<div class="dflow" data-k="book"><div class="dsec"><div class="rcw"><h1>🧾 ${L.bookT}</h1><p class="dsub">${dEsc(b.name)}${b.address ? '<br>' + dEsc(b.address) : ''}${b.tel ? ' · ' + L.tel + ' ' + dEsc(b.tel) : ''}</p>
      <div class="dln"><span>${L.no}</span><b>${dEsc(d.no || '-')}</b></div>
      <div class="dln"><span>${L.booker}</span><b>${dEsc(k.name)}</b></div>
      <div class="dln"><span>${L.idc}</span><b>${k.idCard ? dEsc(k.idCard) : '<span class="dblank"></span>'}</b></div>
      <div class="dln"><span>${L.tel}</span><b>${dEsc(k.phone || '-')}</b></div>
      <div class="dln"><span>${L.room}</span><b>${dEsc(d.room.room)}${d.room.floor ? ' · ' + L.floor + ' ' + dEsc(d.room.floor) : ''}</b></div>
      <div class="dln"><span>${L.moveAt}</span><b>${dEsc(dShort(k.at, d.lang))}</b></div>
      <div class="dln"><span>${L.recvAt}</span><b>${dEsc(dShort(d.date, d.lang))}</b></div>
      ${k.note ? `<div class="dln"><span>${L.bnote}</span><span style="text-align:right;color:#111">${dEsc(k.note)}</span></div>` : ''}
      <div class="dbig"><span>${L.bdep}</span><span style="color:#15803d">${dNum(k.deposit)} ${L.baht}${k.deposit ? ` &nbsp;<span class="dpaid" style="font-size:14px">${L.paid}</span>` : ''}</span></div>
      <div class="dbox"><b>${L.mi}</b>
        <div class="dln"><span>${L.miAll}</span><b>${dNum(all)} ${L.baht}</b></div>
        <div class="dln"><span>${L.miLess}</span><b>− ${dNum(k.deposit)} ${L.baht}</b></div>
        <div class="dln" style="border:0"><span style="color:#111"><b>${L.miLeft}</b></span><b style="color:#2457c5;font-size:17px">${dNum(left)} ${L.baht}</b></div></div>
      <b>${L.cond2}</b><ul>${String(d.terms || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => `<li>${dEsc(x)}</li>`).join('')}</ul>
      <div class="dsig">${docSigBlock(d, 'tenant', L.booker, k.name)}${docSigBlock(d, 'owner', L.recv, b.landlord)}</div></div></div></div>`;
  }
  const t = d.t || {};
  const foot = docFootSig(d, 'owner', L.landlord) + docFootSig(d, 'tenant', L.tenant), sig = `<div class="dsig">${docSigBlock(d, 'owner', L.landlord, b.landlord)}${docSigBlock(d, 'tenant', L.tenant, t.name)}</div>`;
  const secs = (d.custom ? String(d.custom) : docLeaseBody(d)).split(/<hr[^>]*class="?dpb"?[^>]*>/i);
  return `<div class="dflow" data-k="lease" data-pg="${L.page}"><template class="dpf">${foot}</template>` + secs.map((x, i) => `<div class="dsec">${x}${i === 0 ? sig : ''}</div>`).join('') + `</div>`;
}
// เนื้อหาสัญญาแบบอัตโนมัติ (ไม่รวมช่องเซ็น) · ใช้แสดง และใช้เป็นต้นฉบับในหน้าแก้ไขสัญญา
function docLeaseBody(d) {
  const L = DOCL[d.lang] || DOCL.th, b = d.b || {}, t = d.t || {};
  const party = d.lang === 'en'
    ? `${dV(t.name)}, ${L.idc} ${dV(t.idCard)}, ${L.addr} ${dV(t.idAddress)}, ${L.tel} ${dV(t.phone)}`
    : `${dV(t.name)} ${L.idc} ${dV(t.idCard)} ${L.addr} ${dV(t.idAddress)} ${L.tel} ${dV(t.phone)}`;
  const rows = [[L.dep, t.deposit], [L.adv, t.advance], [L.key, t.key], [L.card, t.card]].filter(x => +x[1]);
  const sum = rows.reduce((a, x) => a + (+x[1] || 0), 0);
  const items = d.items && typeof d.items === 'object' ? Object.keys(d.items) : [];
  const ck = v => v.s ? dEsc(v.s === 'มี' ? L.itemOk : d.lang === 'en' ? ({ 'ขาด': 'Missing', 'ชำรุด': 'Damaged' }[v.s] || v.s) : v.s) : `<span style="color:#666">☐ ${L.itemOk} &nbsp; ☐ ${d.lang === 'en' ? 'Missing' : 'ขาด'} &nbsp; ☐ ${d.lang === 'en' ? 'Damaged' : 'ชำรุด'}</span>`;
  return `<h1>${L.lease}</h1><p class="dsub">${dEsc(b.name)}${b.address ? ' · ' + dEsc(b.address) : ''}</p>
    <p class="dr">${L.no} ${dV(d.no)} &nbsp; ${L.at} ${dV(b.name)}<br>${L.date} ${dV(dDate(d.date, d.lang))}</p>
    <p style="text-indent:2em">${L.intro(dV(b.landlord), party, b)}</p>
    ${docTermsHtml(d)}
    <p class="dh">${L.pay}</p>
    <table class="dtb">${rows.map(x => `<tr><td>${x[0]}</td><td class="n">${dNum(x[1])} ${L.baht}</td></tr>`).join('')}<tr><td><b>${L.total}</b></td><td class="n">${dNum(sum)} ${L.baht}</td></tr></table>
    <p style="text-indent:2em;margin-top:12px">${d.mode === 'e' ? L.estmt : L.pstmt}</p>
    <hr class="dpb"><h1 style="font-size:19px">${L.att}</h1><p class="dsub">${L.no} ${dEsc(d.no || '')} · ${L.room} ${dEsc(d.room.room)}</p>
    ${items.length ? `<div class="drow drh"><div>#</div><div>${L.item}</div><div>${L.cond}</div></div>${items.map((k, i) => `<div class="drow"><div>${i + 1}</div><div>${dEsc(k)}</div><div>${ck(d.items[k] || {})}${(d.items[k] || {}).n ? ' · ' + dEsc(d.items[k].n) : ''}</div></div>`).join('')}` : `<p class="dc" style="color:#888">${L.noItems}</p>`}`;
}
// ใส่เอกสารลงในกล่อง แล้วแบ่งเป็นแผ่น A4 (ใบจอง = 1 แผ่นเสมอ · สัญญา = มีช่องเซ็นชื่อท้ายทุกแผ่น)
async function docRender(el, d) {
  el.innerHTML = docHtml(d);
  try { if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
  docPaginate(el); docFit(el);
}
function docPaginate(el) {
  el.querySelectorAll('.dflow').forEach(fl => {
    const tp = fl.querySelector('template.dpf'), foot = tp ? tp.innerHTML : '', one = fl.dataset.k !== 'lease', pages = [];
    const page = () => { const p = document.createElement('div'); p.className = 'dsheet dpage' + (one ? ' rc' : ''); p.innerHTML = `<div class="dpc"></div>${foot ? `<div class="dpfoot">${foot}<div class="dpn"></div></div>` : ''}`; fl.parentNode.insertBefore(p, fl); pages.push(p); return p.firstChild; };
    fl.querySelectorAll(':scope > .dsec').forEach(sec => {
      while (sec.children.length === 1 && sec.firstElementChild.tagName === 'DIV' && !sec.firstElementChild.className && sec.firstElementChild.children.length) sec.firstElementChild.replaceWith(...sec.firstElementChild.childNodes); // แกะ div ห่อ
      Array.from(sec.childNodes).forEach(n => { if (n.nodeType === 3) { if (n.textContent.trim()) { const p = document.createElement('p'); n.replaceWith(p); p.appendChild(n); } else n.remove(); } else if (n.nodeType !== 1) n.remove(); });
      if (!sec.children.length) return;
      let c = page();
      Array.from(sec.children).forEach(b => {
        c.appendChild(b);
        if (c.scrollHeight > c.clientHeight + 1 && c.children.length > 1) {
          c.removeChild(b); const prev = c.lastElementChild, carry = prev && (prev.classList.contains('dh') || prev.classList.contains('drh') || /^H[1-4]$/.test(prev.tagName)) && c.children.length > 1 ? prev : null; // ไม่ให้หัวข้อค้างท้ายแผ่น
          c = page(); if (carry) c.appendChild(carry); c.appendChild(b);
        }
      });
    });
    if (one && pages[0]) { const c = pages[0].firstChild; let fs = 14.5; while (c.scrollHeight > c.clientHeight + 1 && fs > 9.5) { fs -= .5; c.style.fontSize = fs + 'px'; } }
    pages.forEach((p, i) => { const n = p.querySelector('.dpn'); if (n) n.textContent = (fl.dataset.pg || '') + ' ' + (i + 1) + '/' + pages.length; });
    if (pages.length) pages[pages.length - 1].classList.add('dlast');
    fl.remove();
  });
}
function docFit(el) {
  const cs = getComputedStyle(el), w = (el.clientWidth || window.innerWidth) - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0), z = Math.min(1, (w - 2) / (210 * 96 / 25.4));
  el.querySelectorAll('.dpage').forEach(p => { p.style.zoom = z < 1 ? z : ''; });
}
window.addEventListener('resize', () => document.querySelectorAll('.dovin,#docBox').forEach(docFit));
// แสดงเอกสารเต็มจอ + แถบปุ่ม (พิมพ์/PDF ฯลฯ)
function docShow(d, bar) {
  docClose();
  const ov = document.createElement('div'); ov.className = 'dov'; ov.id = 'docOv';
  ov.innerHTML = `<div class="dovbar"><b>${dEsc(d.kind === 'book' ? DOCL[d.lang].bookT : DOCL[d.lang].lease)} · ${dEsc(d.no || '')}</b>${bar || ''}<button class="btn sm" onclick="docPrint()">🖨 พิมพ์ / PDF</button><button class="btn sm" onclick="docClose()">✕ ปิด</button></div><div class="dovin"></div>`;
  document.body.appendChild(ov); document.body.style.overflow = 'hidden'; document.body.classList.add('docprint'); // เปิดเอกสารอยู่ = พิมพ์เฉพาะเอกสาร
  return docRender(ov.querySelector('.dovin'), d);
}
function docClose() { const o = document.getElementById('docOv'); if (o) o.remove(); document.body.style.overflow = ''; document.body.classList.remove('docprint'); if (DOC_T0 != null) { document.title = DOC_T0; DOC_T0 = null; } }
// พิมพ์ / บันทึก PDF: ต้องเรียก window.print() ทันทีตอนกดปุ่ม (ถ้าหน่วงเวลา iPhone จะบล็อกการพิมพ์ แล้วพิมพ์ทั้งหน้าจอแทน)
let DOC_T0 = null;
function docPrint() {
  const b = document.querySelector('#docOv .dovbar b');
  if (b) { if (DOC_T0 == null) DOC_T0 = document.title; document.title = b.textContent.replace(/\s*·\s*/g, ' ').trim(); } // ชื่อไฟล์ PDF = ชื่อเอกสาร
  document.body.classList.add('docprint');
  window.print();
}
// ใบแจ้งหนี้ / ใบเสร็จรับเงิน A4 (บิลทุกแบบ รวมบิลค่าใช้จ่ายเพิ่มเติมที่ออกให้ใครก็ได้)
function docInvoice(d) {
  const x = d.bill, b = d.b || {}, paid = x.status === 'ชำระแล้ว', th = n => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<div class="dflow" data-k="one"><div class="dsec"><div class="rcw" style="max-width:none">
    <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start"><div><b style="font-size:19px">${dEsc(b.name)}</b><div style="color:#555;font-size:13px">${dEsc(b.address || '')}${b.tel ? '<br>โทร ' + dEsc(b.tel) : ''}</div></div>
      <div style="text-align:right"><h1 style="font-size:24px;text-align:right">${paid ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'}</h1><div style="color:#555;font-size:13px">${paid ? 'RECEIPT' : 'INVOICE'}</div></div></div>
    <div style="display:flex;justify-content:space-between;gap:16px;margin:16px 0 8px;padding:10px 14px;background:#f5f7fb;border-radius:10px">
      <div><span style="color:#555">ชื่อผู้ชำระ</span><br><b style="font-size:16px">${dEsc(x.tenantName || '-')}</b>${x.room ? `<br>ห้อง ${dEsc(x.room)}` : ''}${x.payPhone ? `<br>โทร ${dEsc(x.payPhone)}` : ''}</div>
      <div style="text-align:right">เลขที่ <b>${dEsc(paid && x.receiptNo ? x.receiptNo : x.no)}</b>${paid && x.receiptNo ? `<br><span style="color:#555">อ้างอิง ${dEsc(x.no)}</span>` : ''}<br>วันที่ ${dEsc(dShort(paid ? x.paidDate : (x.createdAt || '').slice(0, 10), 'th'))}${!paid && x.dueDate ? `<br>ครบกำหนด <b>${dEsc(dShort(x.dueDate, 'th'))}</b>` : ''}</div></div>
    ${x.title ? `<p style="font-weight:700;margin:10px 0 4px">${dEsc(x.title)}</p>` : ''}
    <table class="dtb"><tr style="background:#f1f5f9"><td style="width:12mm"><b>#</b></td><td><b>รายการ</b></td><td class="n"><b>จำนวนเงิน (บาท)</b></td></tr>${(x.items || []).map((i, k) => `<tr><td>${k + 1}</td><td>${dEsc(i.l)}</td><td class="n" style="font-weight:400">${th(i.a)}</td></tr>`).join('')}
      <tr><td colspan="2" style="text-align:right"><b>รวมทั้งสิ้น</b></td><td class="n" style="font-size:17px">${th(x.total)}</td></tr></table>
    ${x.note ? `<p style="color:#555">หมายเหตุ: ${dEsc(x.note)}</p>` : ''}
    ${paid ? `<p>ชำระโดย <b>${dEsc(x.payMethod || '-')}</b> เมื่อ ${dEsc(dShort(x.paidDate, 'th'))} &nbsp; <span class="dpaid">ชำระแล้ว ✓</span></p>`
      : `<div class="dbox"><b>ช่องทางชำระเงิน</b>${d.pay && d.pay.promptpay ? `<br>พร้อมเพย์: ${dEsc(d.pay.promptpay)}` : ''}${d.pay && d.pay.bank ? `<br>${dEsc(d.pay.bank)}` : ''}${d.pay && d.pay.cash ? `<br>${dEsc(d.pay.cash)}` : ''}${d.link ? `<br><span style="color:#555;font-size:12.5px">ดูบิล/สแกนจ่ายออนไลน์: ${dEsc(d.link)}</span>` : ''}</div>`}
    <div class="dsig" style="margin-top:34px"><div><div class="blank"></div>ลงชื่อ ....................................................<br>( ${dEsc(x.tenantName || '                         ')} )<br>ผู้ชำระเงิน</div><div><div class="blank"></div>ลงชื่อ ....................................................<br>( ${dEsc(b.landlord || '                         ')} )<br>${paid ? 'ผู้รับเงิน' : 'ผู้ออกบิล'}</div></div>
    </div></div></div>`;
}
// หน้าแก้ไขสัญญา: แก้/เพิ่ม/ลบข้อความได้อิสระ (ช่องเซ็นชื่อระบบใส่ให้เอง)
const DOC_TAGS = { P: 1, H1: 1, H2: 1, H3: 1, B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, UL: 1, OL: 1, LI: 1, TABLE: 1, TBODY: 1, THEAD: 1, TR: 1, TD: 1, TH: 1, SPAN: 1, DIV: 1, HR: 1 };
function docClean(html) {
  const box = document.createElement('div'); box.innerHTML = html;
  const walk = el => Array.from(el.children).forEach(c => {
    if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|LINK|META|TEMPLATE|IMG|SVG|VIDEO|AUDIO|FORM|INPUT|BUTTON)$/.test(c.tagName)) return c.remove();
    walk(c);
    if (!DOC_TAGS[c.tagName]) return c.replaceWith(...c.childNodes);
    Array.from(c.attributes).forEach(a => { const n = a.name.toLowerCase(); if (n === 'class' || n === 'colspan' || n === 'rowspan') return; if (n === 'style' && !/url\(|expression|javascript/i.test(a.value)) return; c.removeAttribute(a.name); });
    if (c.tagName === 'DIV' && c.parentElement === box && !c.className && !c.textContent.trim() && !c.querySelector('hr,br')) c.remove();
  });
  walk(box); return box.innerHTML.trim();
}
function docEditor(d, onSave) {
  docClose();
  const ov = document.createElement('div'); ov.className = 'dov'; ov.id = 'docOv';
  const cmd = (c, v) => `onmousedown="event.preventDefault();document.execCommand('${c}',false,${v ? `'${v}'` : 'null'})"`;
  ov.innerHTML = `<div class="dovbar"><b>✏️ แก้ไขสัญญา · ${dEsc(d.no || '')}</b>
    <button class="tb" ${cmd('bold')}><b>B</b></button><button class="tb" ${cmd('italic')}><i>I</i></button><button class="tb" ${cmd('underline')}><u>U</u></button>
    <button class="tb" ${cmd('formatBlock', 'h3')}>หัวข้อ</button><button class="tb" ${cmd('formatBlock', 'p')}>ย่อหน้า</button><button class="tb" ${cmd('insertUnorderedList')}>• รายการ</button>
    <button class="tb" onmousedown="event.preventDefault();document.execCommand('insertHTML',false,'<hr class=&quot;dpb&quot;><p><br></p>')">⤓ ขึ้นแผ่นใหม่</button>
    <button class="tb" onmousedown="event.preventDefault();document.execCommand('undo')">↶</button>
    <button class="btn sm" id="deAuto">↺ แบบอัตโนมัติ</button><button class="btn sm" onclick="docClose()">ยกเลิก</button><button class="btn sm pri" id="deSave">💾 บันทึก</button></div>
    <div class="dovin"><div style="max-width:210mm;margin:0 auto 10px;background:#fff7e6;border:1px solid #f5d08a;border-radius:10px;padding:8px 12px;font-size:13.5px;line-height:1.5">แตะข้อความเพื่อแก้ไข · ลบ/เพิ่มได้ทุกส่วน · ช่องเซ็นชื่อ (ท้ายสัญญาและท้ายทุกแผ่น) ระบบใส่ให้เอง · ข้อมูลในฉบับที่แก้แล้วจะไม่เปลี่ยนตามระบบ ถ้าแก้ข้อมูลผู้เช่าทีหลัง ให้กด ↺ แบบอัตโนมัติ</div>
    <div class="dsheet dedit" contenteditable="true" spellcheck="false">${d.custom || docLeaseBody(d)}</div></div>`;
  document.body.appendChild(ov); document.body.style.overflow = 'hidden';
  const ed = ov.querySelector('.dedit'), fit = () => { const v = ov.querySelector('.dovin'), w = v.clientWidth - 16, z = Math.min(1, (w - 2) / (210 * 96 / 25.4)); ed.style.zoom = z < 1 ? z : ''; }; fit(); window.addEventListener('resize', fit);
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
  ov.querySelector('#deSave').onclick = () => onSave(docClean(ed.innerHTML));
  ov.querySelector('#deAuto').onclick = () => onSave('');
}
// แผ่นเซ็นชื่อเต็มจอ → คืนค่า PNG (data URL) ที่ตัดขอบแล้ว หรือ null ถ้ายกเลิก
function signPad(o) {
  o = o || {};
  return new Promise(resolve => {
    const ov = document.createElement('div'); ov.className = 'spad';
    const touch = matchMedia('(pointer:coarse)').matches;
    ov.innerHTML = `<div class="spbar"><span>✍️ ${dEsc(o.title || 'เซ็นชื่อ')} <em>${dEsc(o.name || '')}</em></span><span style="display:flex;gap:8px;align-items:center"><b>${dEsc(o.step || '')}</b>${touch ? `<button class="sprot" data-a="r"></button>` : ''}</span></div><canvas></canvas><div class="spline"></div><div class="sphint">${dEsc(o.hint || 'เซ็นชื่อด้วยนิ้วหรือปากกาในกรอบนี้')}</div>
      <div class="spbtn"><button class="btn" data-a="x">✕ ${dEsc(o.cancel || 'ยกเลิก')}</button><button class="btn" data-a="c">↻ ${dEsc(o.clear || 'ล้าง')}</button><button class="btn pri" data-a="ok">✓ ${dEsc(o.ok || 'เซ็นเสร็จ')}</button></div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector('canvas'), ctx = cv.getContext('2d'), S = [], rb = ov.querySelector('.sprot'); let cur = null, rot = false, W0 = 0, H0 = 0;
    const land = () => innerWidth > innerHeight;
    // หมุนกรอบเซ็นเป็นแนวนอน (ใช้ได้แม้ล็อกการหมุนจอไว้): ทั้งกรอบหมุน 90° แล้วให้ผู้ใช้เอียงโทรศัพท์
    const layout = () => {
      if (rot && land()) rot = false; // หมุนเครื่องจริงแล้ว ไม่ต้องหมุนซ้ำ
      ov.classList.toggle('rot', rot);
      if (rot) { ov.style.cssText = `inset:auto;top:0;left:0;width:${innerHeight}px;height:${innerWidth}px;transform-origin:0 0;transform:translateX(${innerWidth}px) rotate(90deg)`; }
      else ov.style.cssText = '';
      if (rb) { rb.style.display = land() ? 'none' : ''; rb.textContent = rot ? '📱 แนวตั้ง' : '📱↻ เซ็นแนวนอน'; }
    };
    const fit = () => {
      layout();
      const w = cv.offsetWidth, h = cv.offsetHeight, k = window.devicePixelRatio || 1;
      if (W0 && H0 && S.length && (w !== W0 || h !== H0)) { // หมุนจอ/ขนาดจอเปลี่ยน: ย่อ-ขยายลายเซ็นตามสัดส่วน ไม่ให้หาย
        const f = Math.min(w / W0, h / H0), dx = (w - W0 * f) / 2, dy = (h - H0 * f) / 2;
        S.forEach(st => st.forEach(p => { p[0] = p[0] * f + dx; p[1] = p[1] * f + dy; }));
      }
      W0 = w; H0 = h; cv.width = w * k; cv.height = h * k; ctx.setTransform(k, 0, 0, k, 0, 0); draw();
    };
    const draw = () => { ctx.clearRect(0, 0, cv.width, cv.height); ctx.lineCap = ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2.6; S.forEach(path); };
    const path = s => { ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]); if (s.length === 1) ctx.lineTo(s[0][0] + .1, s[0][1]); for (let i = 1; i < s.length - 1; i++) ctx.quadraticCurveTo(s[i][0], s[i][1], (s[i][0] + s[i + 1][0]) / 2, (s[i][1] + s[i + 1][1]) / 2); if (s.length > 1) ctx.lineTo(s[s.length - 1][0], s[s.length - 1][1]); ctx.stroke(); };
    // พิกัดบนกรอบ (กรณีหมุน: แปลงพิกัดจอกลับเป็นพิกัดของกรอบ → ลายเซ็นออกมาเป็นแนวนอนตรง ใช้ในเอกสารแนวตั้งได้เลย)
    const pt = e => { if (rot) { const top = cv.offsetTop; return [e.clientY, innerWidth - e.clientX - top]; } const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); cur = [pt(e)]; S.push(cur); ov.querySelector('.sphint').style.display = 'none'; draw(); });
    cv.addEventListener('pointermove', e => { if (!cur) return; e.preventDefault(); (e.getCoalescedEvents ? e.getCoalescedEvents() : [e]).forEach(x => cur.push(pt(x))); draw(); });
    const up = () => { cur = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const onR = () => setTimeout(fit, 60); window.addEventListener('resize', onR); window.addEventListener('orientationchange', onR); setTimeout(fit, 0);
    const done = v => { window.removeEventListener('resize', onR); window.removeEventListener('orientationchange', onR); ov.remove(); resolve(v); };
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
      if (k === 'r') { rot = !rot; fit(); return; }
      if (k === 'c') { S.length = 0; draw(); ov.querySelector('.sphint').style.display = ''; return; }
      const u = exp(); if (!u) { alert(o.empty || 'กรุณาเซ็นชื่อก่อน'); return; } done(u); });
  });
}
