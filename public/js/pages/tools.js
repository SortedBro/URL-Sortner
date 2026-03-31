/* SnapLink tools page interactions */

function copyText(text, button) {
  const normalizedText = typeof text === 'string' ? text.trim() : '';
  if (!normalizedText || normalizedText === '-' || normalizedText === 'â€”' || normalizedText === 'Ã¢â‚¬â€') return;

  navigator.clipboard.writeText(normalizedText).then(() => {
    if (!button) return;
    const originalText = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => {
      button.textContent = originalText;
    }, 2000);
  });
}

function getToolNavCard(id) {
  return document.querySelector(`.tnav-card[onclick*="openTool('${id}')"]`);
}

window.openTool = function openTool(id, button, options = {}) {
  const skipScroll = Boolean(options.skipScroll);

  document.querySelectorAll('.tpanel').forEach((panel) => {
    panel.style.display = 'none';
    panel.classList.remove('active');
  });
  document.querySelectorAll('.ttab').forEach((tab) => tab.classList.remove('active'));
  document.querySelectorAll('.tnav-card').forEach((card) => card.classList.remove('active'));

  const panel = document.getElementById('tp-' + id);
  const tab = document.getElementById('ttab-' + id);
  const navCard = button && button.classList && button.classList.contains('tnav-card') ? button : getToolNavCard(id);

  if (panel) {
    panel.style.display = 'block';
    panel.classList.add('active');
  }

  if (tab) {
    tab.classList.add('active');
    if (!skipScroll) {
      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  if (navCard) {
    navCard.classList.add('active');
  }

  if (panel && window.location.hash !== '#' + id) {
    history.replaceState(null, '', '#' + id);
  }

  const wrap = document.querySelector('.tools-panels-wrap');
  if (wrap && !skipScroll) {
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tpanel').forEach((panel) => {
    panel.style.display = 'none';
    panel.classList.remove('active');
  });

  const hash = window.location.hash.replace('#', '');
  if (hash && document.getElementById('tp-' + hash)) {
    openTool(hash, null, { skipScroll: true });
  } else {
    openTool('qr', null, { skipScroll: true });
  }

  if (document.getElementById('cPick')) updColor('#FAC775');
  if (document.getElementById('passLen')) genPass();
  if (document.getElementById('emojiCats')) initEmoji();
  if (document.getElementById('caseInput')) updateCaseOutputs();
  if (document.getElementById('uuidList')) generateUuids();

  if (document.getElementById('invDate')) {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('invDate').value = today;
    const due = new Date();
    due.setDate(due.getDate() + 30);
    document.getElementById('invDue').value = due.toISOString().split('T')[0];
    addInvItem('Website Development', 1, 15000);
    addInvItem('Logo Design', 1, 5000);
    updateInv();
  }
});
function genQR() {
  const val = document.getElementById('qrInput').value.trim();
  const ph = document.getElementById('qrPlaceholder');
  if (!val) { ph.style.display = 'flex'; return; }
  ph.style.display = 'none';
  const size = parseInt(document.getElementById('qrSize').value);
  const ec = document.getElementById('qrEC').value;
  const fg = document.getElementById('qrFg').value;
  const bg = document.getElementById('qrBg').value;
  QRCode.toCanvas(document.getElementById('qrCanvas'), val, {
    width: Math.min(size, 320), margin: 2,
    errorCorrectionLevel: ec,
    color: { dark: fg, light: bg }
  }, err => { if (err) console.error(err); });
}
function dlQR() {
  const val = document.getElementById('qrInput').value.trim();
  if (!val) { alert('Pehle URL ya text daalo!'); return; }
  const size = parseInt(document.getElementById('qrSize').value);
  const ec = document.getElementById('qrEC').value;
  const fg = document.getElementById('qrFg').value;
  const bg = document.getElementById('qrBg').value;
  const c = document.createElement('canvas');
  QRCode.toCanvas(c, val, { width: size, margin: 2, errorCorrectionLevel: ec, color: { dark: fg, light: bg } }, err => {
    if (err) return;
    const a = document.createElement('a'); a.download = 'snaplink-qr.png'; a.href = c.toDataURL(); a.click();
  });
}
function copyQRDataURL() {
  const canvas = document.getElementById('qrCanvas');
  canvas.toBlob(blob => {
    const item = new ClipboardItem({ 'image/png': blob });
    navigator.clipboard.write([item]).then(() => alert('Image copied to clipboard!'));
  });
}

/* â•â•â•â• 2. Image Compressor â•â•â•â• */
let origFile = null;
function loadImg(input) {
  origFile = input.files[0]; if (!origFile) return;
  document.getElementById('imgDZText').textContent = origFile.name;
  document.getElementById('imgStatsRow').style.display = 'flex';
  document.getElementById('iOrig').textContent = fmtBytes(origFile.size);
  compressImg();
}
function imgDrop(e) {
  e.preventDefault();
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) { origFile = f; document.getElementById('imgDZText').textContent = f.name; document.getElementById('imgStatsRow').style.display = 'flex'; document.getElementById('iOrig').textContent = fmtBytes(f.size); compressImg(); }
}
function compressImg() {
  if (!origFile) return;
  const q = parseInt(document.getElementById('imgQ').value) / 100;
  const fmt = document.getElementById('imgFmt').value || origFile.type;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const c = document.getElementById('imgCanvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      c.style.display = 'block';
      document.getElementById('imgPlaceholder').style.display = 'none';
      document.getElementById('imgDlBtn').style.display = 'flex';
      c.toBlob(blob => {
        document.getElementById('iComp').textContent = fmtBytes(blob.size);
        const sv = Math.round((1 - blob.size / origFile.size) * 100);
        document.getElementById('iSave').textContent = sv > 0 ? sv + '% saved' : 'Same size';
      }, fmt, q);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(origFile);
}
function dlImg() {
  if (!origFile) return;
  const q = parseInt(document.getElementById('imgQ').value) / 100;
  const fmt = document.getElementById('imgFmt').value || origFile.type;
  const ext = fmt.split('/')[1] || 'jpg';
  document.getElementById('imgCanvas').toBlob(blob => {
    const a = document.createElement('a'); a.download = 'compressed-' + origFile.name.replace(/\.[^.]+$/, '') + '.' + ext; a.href = URL.createObjectURL(blob); a.click();
  }, fmt, q);
}
function fmtBytes(b) { if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(2) + ' MB'; }

/* â•â•â•â• 3. YT Video Downloader â•â•â•â• */
function ytTypeChange() {
  const type = document.getElementById('ytType').value;
  document.getElementById('ytAudioFmtField').style.display = type === 'audio' ? 'block' : 'none';
  document.getElementById('ytQuality').closest('.tfield').style.display = type === 'audio' ? 'none' : 'block';
}

function extractVidId(raw) {
  const m = raw.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  return null;
}

function ytSetStatus(msg, isError = false, loading = false) {
  const box = document.getElementById('ytStatus');
  const msgEl = document.getElementById('ytStatusMsg');
  box.style.display = 'block';
  msgEl.innerHTML = loading
    ? `<div class="yt-loading"><div class="yt-spinner"></div>${msg}</div>`
    : `<div class="${isError ? 'yt-error-msg' : 'yt-success-msg'}">${msg}</div>`;
  document.getElementById('ytDlLink').style.display = 'none';
}

async function downloadYTVideo() {
  const raw = document.getElementById('ytVidUrl').value.trim();
  if (!raw) { ytSetStatus('YouTube URL daalo pehle!', true); return; }

  const vid = extractVidId(raw);
  if (!vid) { ytSetStatus('Valid YouTube URL nahi hai!', true); return; }

  const type    = document.getElementById('ytType').value;
  const quality = document.getElementById('ytQuality').value;
  const audioFmt = document.getElementById('ytAudioFmt').value;

  // Show preview first
  const thumbUrl = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
  document.getElementById('ytPreviewThumb').src = thumbUrl;
  document.getElementById('ytMetaVidId').textContent = vid;
  document.getElementById('ytVidPlaceholder').style.display = 'none';
  document.getElementById('ytVideoCard').style.display = 'block';
  document.getElementById('ytThumbSection').style.display = 'block';
  buildThumbButtons(vid);

  // Download via our backend proxy route
  ytSetStatus('Download process shuru ho raha hai...', false, true);
  document.getElementById('ytDlBtn').disabled = true;

  try {
    const body = {
      url: `https://www.youtube.com/watch?v=${vid}`,
      videoQuality: quality,
      filenameStyle: 'basic',
    };
    if (type === 'audio') {
      body.downloadMode = 'audio';
      body.audioFormat  = audioFmt;
    } else if (type === 'mute') {
      body.downloadMode = 'mute';
    }

    // Call our backend route /tools/yt-download which proxies cobalt API
    const res = await fetch('/tools/yt-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.status === 'redirect' || data.status === 'stream' || data.status === 'tunnel') {
      const dlUrl = data.url;
      document.getElementById('ytDlLink').href = dlUrl;
      document.getElementById('ytDlLink').style.display = 'flex';
      document.getElementById('ytStatusMsg').innerHTML =
        '<div class="yt-success-msg">âœ“ Download link ready hai! Button click karo.</div>';
      // Also try auto-download
      const a = document.createElement('a');
      a.href = dlUrl; a.target = '_blank'; a.download = '';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);

    } else if (data.status === 'picker') {
      // Multiple streams available â€” show all options
      let html = '<div class="yt-success-msg">Multiple streams available â€” choose karo:</div>';
      document.getElementById('ytStatusMsg').innerHTML = html;
      const dlLink = document.getElementById('ytDlLink');
      dlLink.href = data.picker[0]?.url || '#';
      dlLink.textContent = 'â¬‡ Best Quality Download';
      dlLink.style.display = 'flex';

    } else if (data.status === 'error') {
      ytSetStatus(`âŒ Error: ${data.error?.code || 'Unknown error'} â€” ${data.error?.context?.service || 'Try karo dobara'}`, true);
    } else {
      ytSetStatus('âŒ Unexpected response. Dobara try karo ya cobalt.tools directly use karo.', true);
    }
  } catch (err) {
    console.error(err);
    ytSetStatus('âŒ Server se connect nahi ho saka. Route add kiya hai? cobalt.tools directly try karo.', true);
  }

  document.getElementById('ytDlBtn').disabled = false;
}

function ytOpenVideo() {
  const vid = document.getElementById('ytMetaVidId').textContent;
  if (vid && vid !== 'â€”') window.open(`https://youtube.com/watch?v=${vid}`, '_blank');
}

function buildThumbButtons(vid) {
  const qualities = [
    { label: 'Max HD', key: 'maxresdefault', size: '1280Ã—720' },
    { label: 'High',   key: 'hqdefault',     size: '480Ã—360'  },
    { label: 'Medium', key: 'mqdefault',      size: '320Ã—180'  },
    { label: 'SD',     key: 'sddefault',      size: '640Ã—480'  },
  ];
  const wrap = document.getElementById('ytThumbBtns');
  wrap.innerHTML = '';
  qualities.forEach(q => {
    const url = `https://img.youtube.com/vi/${vid}/${q.key}.jpg`;
    const btn = document.createElement('button');
    btn.className = 'yt-qbtn';
    btn.innerHTML = `<b>${q.label}</b><span>${q.size}</span>`;
    btn.onclick = () => dlThumb(url, vid, q.key);
    wrap.appendChild(btn);
  });
}
async function dlThumb(url, vid, q) {
  try {
    const res = await fetch(url); const blob = await res.blob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${vid}-${q}.jpg`; a.click();
  } catch { window.open(url, '_blank'); }
}

/* â•â•â•â• 4. UTM Builder â•â•â•â• */
function buildUTM() {
  const base = document.getElementById('utmBase').value.trim();
  const src = document.getElementById('utmSrc').value.trim();
  if (!base || !src) { document.getElementById('utmOut').textContent = 'URL aur Source bharo...'; document.getElementById('utmParams').innerHTML = ''; return; }
  const p = new URLSearchParams();
  p.set('utm_source', src);
  const fields = [['utmMed','utm_medium'],['utmCamp','utm_campaign'],['utmCont','utm_content'],['utmTerm','utm_term']];
  fields.forEach(([id, key]) => { const v = document.getElementById(id).value.trim(); if (v) p.set(key, v); });
  const url = base + (base.includes('?') ? '&' : '?') + p.toString();
  document.getElementById('utmOut').textContent = url;
  let html = '';
  for (const [k, v] of p.entries()) html += `<span class="utm-param"><b>${k}</b>${v}</span>`;
  document.getElementById('utmParams').innerHTML = html;
}
function copyUTM() { const v = document.getElementById('utmOut').textContent; if (!v.includes('bharo')) { navigator.clipboard.writeText(v).then(() => alert('UTM Link copied!')); } }
function resetUTM() { ['utmBase','utmSrc','utmMed','utmCamp','utmCont','utmTerm'].forEach(id => document.getElementById(id).value = ''); document.getElementById('utmOut').textContent = 'URL aur Source bharo...'; document.getElementById('utmParams').innerHTML = ''; }

/* â•â•â•â• 5. JSON â•â•â•â• */
function fmtJSON() {
  const inp = document.getElementById('jsonIn').value;
  const st = document.getElementById('jsonStat');
  if (!inp.trim()) { document.getElementById('jsonOut').value = ''; st.textContent = ''; return; }
  try { document.getElementById('jsonOut').value = JSON.stringify(JSON.parse(inp), null, 2); st.textContent = 'âœ“ Valid'; st.style.color = 'var(--green)'; }
  catch (e) { document.getElementById('jsonOut').value = 'Error: ' + e.message; st.textContent = 'âœ• Invalid'; st.style.color = 'var(--red)'; }
}
function minJSON() { try { document.getElementById('jsonOut').value = JSON.stringify(JSON.parse(document.getElementById('jsonIn').value)); } catch {} }
function sortJSON() { try { const sort = obj => Array.isArray(obj) ? obj.map(sort) : obj && typeof obj === 'object' ? Object.fromEntries(Object.entries(obj).sort().map(([k,v]) => [k, sort(v)])) : obj; document.getElementById('jsonOut').value = JSON.stringify(sort(JSON.parse(document.getElementById('jsonIn').value)), null, 2); } catch {} }
function clearJSON() { document.getElementById('jsonIn').value = ''; document.getElementById('jsonOut').value = ''; document.getElementById('jsonStat').textContent = ''; }

/* â•â•â•â• 6. Hash â•â•â•â• */
async function genHash() {
  const text = document.getElementById('hashIn').value;
  const ids = ['hMD5','hSHA1','hSHA256','hSHA512'];
  if (!text) { ids.forEach(id => document.getElementById(id).textContent = 'â€”'); return; }
  const enc = new TextEncoder().encode(text);
  const hex = buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  const [s1, s256, s512] = await Promise.all([
    crypto.subtle.digest('SHA-1', enc),
    crypto.subtle.digest('SHA-256', enc),
    crypto.subtle.digest('SHA-512', enc)
  ]);
  document.getElementById('hSHA1').textContent = hex(s1);
  document.getElementById('hSHA256').textContent = hex(s256);
  document.getElementById('hSHA512').textContent = hex(s512);
  document.getElementById('hMD5').textContent = md5(text);
}
/* MD5 */
function md5(s){function sa(x,y){const l=(x&0xFFFF)+(y&0xFFFF);return((x>>16)+(y>>16)+(l>>16))<<16|(l&0xFFFF);}function rl(n,c){return n<<c|n>>>32-c;}function cm(q,a,b,x,s,t){return sa(rl(sa(sa(a,q),sa(x,t)),s),b);}function ff(a,b,c,d,x,s,t){return cm(b&c|~b&d,a,b,x,s,t);}function gg(a,b,c,d,x,s,t){return cm(b&d|c&~d,a,b,x,s,t);}function hh(a,b,c,d,x,s,t){return cm(b^c^d,a,b,x,s,t);}function ii(a,b,c,d,x,s,t){return cm(c^(b|~d),a,b,x,s,t);}const u=unescape(encodeURIComponent(s));const x=[];for(let i=0;i<u.length;i+=4)x.push(u.charCodeAt(i)|u.charCodeAt(i+1)<<8|u.charCodeAt(i+2)<<16|u.charCodeAt(i+3)<<24);x[u.length>>2]|=0x80<<(u.length%4*8);x[(u.length+8>>>6<<4)+14]=u.length*8;let a=0x67452301,b=0xEFCDAB89,c=0x98BADCFE,d=0x10325476;for(let i=0;i<x.length;i+=16){const[A,B,C,D]=[a,b,c,d];a=ff(a,b,c,d,x[i],7,-680876936);d=ff(d,a,b,c,x[i+1],12,-389564586);c=ff(c,d,a,b,x[i+2],17,606105819);b=ff(b,c,d,a,x[i+3],22,-1044525330);a=ff(a,b,c,d,x[i+4],7,-176418897);d=ff(d,a,b,c,x[i+5],12,1200080426);c=ff(c,d,a,b,x[i+6],17,-1473231341);b=ff(b,c,d,a,x[i+7],22,-45705983);a=ff(a,b,c,d,x[i+8],7,1770035416);d=ff(d,a,b,c,x[i+9],12,-1958414417);c=ff(c,d,a,b,x[i+10],17,-42063);b=ff(b,c,d,a,x[i+11],22,-1990404162);a=ff(a,b,c,d,x[i+12],7,1804603682);d=ff(d,a,b,c,x[i+13],12,-40341101);c=ff(c,d,a,b,x[i+14],17,-1502002290);b=ff(b,c,d,a,x[i+15],22,1236535329);a=gg(a,b,c,d,x[i+1],5,-165796510);d=gg(d,a,b,c,x[i+6],9,-1069501632);c=gg(c,d,a,b,x[i+11],14,643717713);b=gg(b,c,d,a,x[i],20,-373897302);a=gg(a,b,c,d,x[i+5],5,-701558691);d=gg(d,a,b,c,x[i+10],9,38016083);c=gg(c,d,a,b,x[i+15],14,-660478335);b=gg(b,c,d,a,x[i+4],20,-405537848);a=gg(a,b,c,d,x[i+9],5,568446438);d=gg(d,a,b,c,x[i+14],9,-1019803690);c=gg(c,d,a,b,x[i+3],14,-187363961);b=gg(b,c,d,a,x[i+8],20,1163531501);a=gg(a,b,c,d,x[i+13],5,-1444681467);d=gg(d,a,b,c,x[i+2],9,-51403784);c=gg(c,d,a,b,x[i+7],14,1735328473);b=gg(b,c,d,a,x[i+12],20,-1926607734);a=hh(a,b,c,d,x[i+5],4,-378558);d=hh(d,a,b,c,x[i+8],11,-2022574463);c=hh(c,d,a,b,x[i+11],16,1839030562);b=hh(b,c,d,a,x[i+14],23,-35309556);a=hh(a,b,c,d,x[i+1],4,-1530992060);d=hh(d,a,b,c,x[i+4],11,1272893353);c=hh(c,d,a,b,x[i+7],16,-155497632);b=hh(b,c,d,a,x[i+10],23,-1094730640);a=hh(a,b,c,d,x[i+13],4,681279174);d=hh(d,a,b,c,x[i],11,-358537222);c=hh(c,d,a,b,x[i+3],16,-722521979);b=hh(b,c,d,a,x[i+6],23,76029189);a=hh(a,b,c,d,x[i+9],4,-640364487);d=hh(d,a,b,c,x[i+12],11,-421815835);c=hh(c,d,a,b,x[i+15],16,530742520);b=hh(b,c,d,a,x[i+2],23,-995338651);a=ii(a,b,c,d,x[i],6,-198630844);d=ii(d,a,b,c,x[i+7],10,1126891415);c=ii(c,d,a,b,x[i+14],15,-1416354905);b=ii(b,c,d,a,x[i+5],21,-57434055);a=ii(a,b,c,d,x[i+12],6,1700485571);d=ii(d,a,b,c,x[i+3],10,-1894986606);c=ii(c,d,a,b,x[i+10],15,-1051523);b=ii(b,c,d,a,x[i+1],21,-2054922799);a=ii(a,b,c,d,x[i+8],6,1873313359);d=ii(d,a,b,c,x[i+15],10,-30611744);c=ii(c,d,a,b,x[i+6],15,-1560198380);b=ii(b,c,d,a,x[i+13],21,1309151649);a=ii(a,b,c,d,x[i+4],6,-145523070);d=ii(d,a,b,c,x[i+11],10,-1120210379);c=ii(c,d,a,b,x[i+2],15,718787259);b=ii(b,c,d,a,x[i+9],21,-343485551);a=sa(a,A);b=sa(b,B);c=sa(c,C);d=sa(d,D);}return[a,b,c,d].map(n=>(n>>>0).toString(16).padStart(8,'0').match(/../g).map(s=>s[1]+s[0]).join('')).join('');}

/* â•â•â•â• 7. Base64 â•â•â•â• */
function b64Mode(m, btn) {
  document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active')); btn.classList.add('active');
  document.getElementById('b64TextMode').style.display = m === 'text' ? 'flex' : 'none';
  document.getElementById('b64ImgMode').style.display = m === 'image' ? 'block' : 'none';
}
function doB64Enc() { try { document.getElementById('b64Out').value = btoa(unescape(encodeURIComponent(document.getElementById('b64In').value))); } catch { document.getElementById('b64Out').value = 'Error encoding'; } }
function doB64Dec() { try { document.getElementById('b64Out').value = decodeURIComponent(escape(atob(document.getElementById('b64In').value))); } catch { document.getElementById('b64Out').value = 'Error: Invalid Base64 string'; } }
function imgToB64(input) { const f = input.files[0]; if (!f) return; const r = new FileReader(); r.onload = e => { document.getElementById('b64ImgOut').value = e.target.result; }; r.readAsDataURL(f); }

/* â•â•â•â• 8. Color Picker â•â•â•â• */
function updColor(hex) {
  document.getElementById('cHexIn').value = hex;
  document.getElementById('cHex').textContent = hex;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  document.getElementById('cRGB').textContent = `rgb(${r}, ${g}, ${b})`;
  const h = rgb2hsl(r,g,b);
  document.getElementById('cHSL').textContent = `hsl(${h[0]}, ${h[1]}%, ${h[2]}%)`;
  document.getElementById('cCSS').textContent = `--color: ${hex};`;
  document.getElementById('cTW').textContent = `bg-[${hex}]`;
  document.getElementById('cBigPrev').style.background = hex;
  document.getElementById('cPrevTxt').textContent = hex;
  const lum = (0.299*r+0.587*g+0.114*b)/255;
  const txtCol = lum > 0.5 ? '#1a1a18' : '#f0f0ee';
  document.getElementById('cPrevTxt').style.color = txtCol;
  document.getElementById('cupBtn').style.background = hex;
  document.getElementById('cupBtn').style.color = txtCol;
  document.getElementById('cupText').style.color = hex;
  document.getElementById('cupBorder').style.borderColor = hex;
  const ratio = lum > 0.5 ? (lum+0.05)/0.05 : 0.05/(lum+0.05);
  document.getElementById('contrastInfo').innerHTML = `<span>Contrast on white: ${ratio.toFixed(1)}:1 ${ratio >= 4.5 ? 'âœ“ AA' : ratio >= 3 ? '~ AA Large' : 'âœ• Low'}</span>`;
  buildShades(h[0], h[1]);
}
function updFromHex(hex) { if (/^#[0-9a-fA-F]{6}$/.test(hex)) { document.getElementById('cPick').value = hex; updColor(hex); } }
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h,s,l=(mx+mn)/2;if(mx===mn){h=s=0;}else{const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);switch(mx){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;default:h=((r-g)/d+4)/6;}}return[Math.round(h*360),Math.round(s*100),Math.round(l*100)];}
function hsl2hex(h,s,l){s/=100;l/=100;const a=s*Math.min(l,1-l);const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(Math.min(k-3,9-k,1),-1))).toString(16).padStart(2,'0');};return`#${f(0)}${f(8)}${f(4)}`;}
function buildShades(h, s) {
  const row = document.getElementById('shadesRow'); row.innerHTML = '';
  [95,85,75,65,55,45,35,25,15,8].forEach(l => {
    const hex = hsl2hex(h, s, l);
    const sw = document.createElement('div'); sw.className = 'shade-sw'; sw.style.background = hex; sw.title = hex;
    sw.onclick = () => { document.getElementById('cPick').value = hex; updColor(hex); };
    row.appendChild(sw);
  });
}

/* â•â•â•â• 9. Word Counter â•â•â•â• */
function countWords() {
  const t = document.getElementById('wordIn').value;
  const w = t.trim() ? t.trim().split(/\s+/).length : 0;
  document.getElementById('wWords').textContent = w;
  document.getElementById('wChars').textContent = t.length;
  document.getElementById('wNoSp').textContent = t.replace(/\s/g,'').length;
  document.getElementById('wSent').textContent = t.trim() ? (t.match(/[.!?]+/g)||[]).length : 0;
  document.getElementById('wPara').textContent = t.trim() ? t.split(/\n\n+/).filter(p=>p.trim()).length : 0;
  document.getElementById('wLines').textContent = t ? t.split('\n').length : 0;
  const uniq = t.trim() ? new Set(t.toLowerCase().match(/\b\w+\b/g)||[]).size : 0;
  document.getElementById('wUniq').textContent = uniq;
  const mins = Math.ceil(w / 200);
  document.getElementById('wRead').textContent = w < 1 ? '0 min' : mins < 1 ? '<1 min' : mins + ' min';
}

/* Utility micro tools */
function syncCodecPreview() {
  const input = document.getElementById('codecInput');
  const output = document.getElementById('codecOutput');
  if (!input || !output || output.value) return;
  output.value = '';
}

function transformCodec(mode) {
  const input = document.getElementById('codecInput');
  const output = document.getElementById('codecOutput');
  if (!input || !output) return;

  const value = input.value.trim();
  if (!value) {
    output.value = '';
    return;
  }

  try {
    output.value = mode === 'encode' ? encodeURIComponent(value) : decodeURIComponent(value);
  } catch {
    output.value = 'Unable to process this text. Check the input and try again.';
  }
}

function swapCodecFields() {
  const input = document.getElementById('codecInput');
  const output = document.getElementById('codecOutput');
  if (!input || !output) return;
  const temp = input.value;
  input.value = output.value;
  output.value = temp;
}

function clearCodecFields() {
  const input = document.getElementById('codecInput');
  const output = document.getElementById('codecOutput');
  if (input) input.value = '';
  if (output) output.value = '';
}

function splitWordsForCase(text) {
  return String(text || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/[^\w\s]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function toTitleCase(text) {
  return splitWordsForCase(text)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function toCamelCase(text) {
  const words = splitWordsForCase(text);
  if (!words.length) return '';
  return words
    .map((word, index) => index === 0
      ? word.toLowerCase()
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function toSeparatedCase(text, separator) {
  return splitWordsForCase(text).map((word) => word.toLowerCase()).join(separator);
}

function updateCaseOutputs() {
  const input = document.getElementById('caseInput');
  if (!input) return;

  const raw = input.value.trim();
  document.getElementById('caseUpper').textContent = raw ? raw.toUpperCase() : '-';
  document.getElementById('caseLower').textContent = raw ? raw.toLowerCase() : '-';
  document.getElementById('caseTitle').textContent = raw ? toTitleCase(raw) : '-';
  document.getElementById('caseCamel').textContent = raw ? toCamelCase(raw) : '-';
  document.getElementById('caseKebab').textContent = raw ? toSeparatedCase(raw, '-') : '-';
  document.getElementById('caseSnake').textContent = raw ? toSeparatedCase(raw, '_') : '-';
}

function fillCaseSample() {
  const input = document.getElementById('caseInput');
  if (!input) return;
  input.value = 'snaplink affiliate wallet growth system';
  updateCaseOutputs();
}

function createUuid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0;
    const value = character === 'x' ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
}

function generateUuids() {
  const count = Math.max(1, Math.min(10, parseInt(document.getElementById('uuidCount')?.value || '3', 10)));
  const prefix = String(document.getElementById('uuidPrefix')?.value || '').trim();
  const list = document.getElementById('uuidList');
  if (!list) return;

  const values = Array.from({ length: count }, () => `${prefix}${createUuid()}`);
  list.innerHTML = values
    .map((value, index) => `<div class="hrow"><span>ID ${index + 1}</span><code>${value}</code><button onclick="copyText('${value}',this)">Copy</button></div>`)
    .join('');
}

function copyAllUuids(button) {
  const values = [...document.querySelectorAll('#uuidList code')]
    .map((element) => element.textContent)
    .filter(Boolean);
  copyText(values.join('\n'), button);
}
function genPass() {
  let chars = '';
  if (document.getElementById('passUpper').checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (document.getElementById('passLower').checked) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (document.getElementById('passNum').checked)   chars += '0123456789';
  if (document.getElementById('passSym').checked)   chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (document.getElementById('passAmb').checked)   chars = chars.replace(/[0Ol1I]/g, '');
  if (!chars) { document.getElementById('passOutput').value = 'Kuch toh select karo!'; return; }
  const len = parseInt(document.getElementById('passLen').value);
  let pass = '';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  arr.forEach(v => pass += chars[v % chars.length]);
  document.getElementById('passOutput').value = pass;
  // Strength
  let score = 0;
  if (pass.length >= 12) score++;
  if (pass.length >= 16) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^a-zA-Z0-9]/.test(pass)) score++;
  const bar = document.getElementById('passStrBar');
  const lbl = document.getElementById('passStrLabel');
  const colors = ['#f87171','#fb923c','#facc15','#4ade80','#22c55e'];
  const labels = ['Very Weak','Weak','Fair','Strong','Very Strong'];
  bar.style.width = (score/5*100)+'%';
  bar.style.background = colors[score-1] || '#2a2a28';
  lbl.textContent = labels[score-1] || '';
}
function genMultiPass() {
  const list = document.getElementById('multiPassList');
  list.style.display = 'block'; list.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    genPass();
    const p = document.getElementById('passOutput').value;
    const row = document.createElement('div'); row.className = 'multi-pass-row';
    row.innerHTML = `<code>${p}</code><button onclick="copyText('${p}',this)">Copy</button>`;
    list.appendChild(row);
  }
}
// (moved to main DOMContentLoaded)

/* â•â•â•â• 12. Fake Data Generator â•â•â•â• */
const fakeDB = {
  in: {
    first: ['Aarav','Aditi','Amit','Ananya','Arjun','Deepak','Divya','Fatima','Gaurav','Kavya','Meera','Mohammed','Neha','Priya','Rahul','Riya','Rohit','Sachin','Sanjay','Sunita','Vikram','Zara'],
    last:  ['Sharma','Verma','Patel','Singh','Kumar','Gupta','Joshi','Mehta','Nair','Reddy','Iyer','Khan','Ansari','Mishra','Tiwari','Chopra','Malhotra','Kapoor','Shah','Agarwal'],
    city:  ['Mumbai','Delhi','Bangalore','Hyderabad','Chennai','Kolkata','Pune','Ahmedabad','Jaipur','Surat','Lucknow','Kanpur','Nagpur','Indore','Bhopal'],
    comp:  ['Infosys','TCS','Wipro','HCL Tech','Tech Mahindra','Bajaj Auto','Reliance Industries','HDFC Bank','Zomato','Paytm'],
    domain:['gmail.com','yahoo.com','outlook.com','hotmail.com','rediffmail.com'],
    street:['MG Road','Linking Road','Brigade Road','Bandra West','Koramangala','Sector 17','Civil Lines','Ashram Road','Anna Nagar','Park Street']
  },
  us: {
    first: ['James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda','William','Barbara','David','Susan'],
    last:  ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Taylor','Anderson','Thomas'],
    city:  ['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','Austin'],
    comp:  ['Apple','Google','Microsoft','Amazon','Meta','Tesla','Netflix','Uber','Airbnb','Stripe'],
    domain:['gmail.com','yahoo.com','outlook.com','hotmail.com','icloud.com'],
    street:['Main St','Oak Ave','Maple Dr','Cedar Ln','Pine Rd','Elm St','Washington Blvd','Park Ave']
  },
  uk: {
    first: ['Oliver','Amelia','George','Isla','Harry','Ava','Jack','Mia','Charlie','Lily'],
    last:  ['Smith','Jones','Williams','Taylor','Brown','Davies','Evans','Wilson','Thomas','Roberts'],
    city:  ['London','Birmingham','Manchester','Glasgow','Leeds','Liverpool','Bristol','Sheffield','Edinburgh','Cardiff'],
    comp:  ['Barclays','HSBC','BP','Shell','Unilever','GSK','Rolls-Royce','Tesco','BT Group','Vodafone'],
    domain:['gmail.com','yahoo.co.uk','hotmail.co.uk','outlook.com','btinternet.com'],
    street:['High Street','Church Lane','Victoria Road','Park Avenue','Station Road','Manor Way']
  }
};

function randItem(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random()*(max-min+1))+min; }

function genFakeData() {
  const count   = parseInt(document.getElementById('fakeCount').value);
  const country = document.getElementById('fakeCountry').value;
  const fmt     = document.getElementById('fakeFmt').value;
  const db      = fakeDB[country];
  const fields  = { name: document.getElementById('fName').checked, email: document.getElementById('fEmail').checked, phone: document.getElementById('fPhone').checked, city: document.getElementById('fCity').checked, dob: document.getElementById('fDob').checked, company: document.getElementById('fComp').checked, address: document.getElementById('fAddr').checked };

  const data = [];
  for (let i = 0; i < count; i++) {
    const first = randItem(db.first), last = randItem(db.last);
    const row = {};
    if (fields.name)    row.name    = first + ' ' + last;
    if (fields.email)   row.email   = (first+'.'+last).toLowerCase().replace(' ','') + randInt(1,999) + '@' + randItem(db.domain);
    if (fields.phone)   row.phone   = country==='in' ? '+91 '+randInt(7,9)+''+Array.from({length:9},()=>randInt(0,9)).join('') : country==='us' ? '+1 ('+randInt(200,999)+') '+randInt(100,999)+'-'+randInt(1000,9999) : '+44 '+randInt(7000,7999)+' '+randInt(100000,999999);
    if (fields.city)    row.city    = randItem(db.city);
    if (fields.dob)     row.dob     = `${randInt(1970,2005)}-${String(randInt(1,12)).padStart(2,'0')}-${String(randInt(1,28)).padStart(2,'0')}`;
    if (fields.company) row.company = randItem(db.comp);
    if (fields.address) row.address = randInt(1,999) + ' ' + randItem(db.street);
    data.push(row);
  }

  const out = document.getElementById('fakeOutput');
  if (fmt === 'json') {
    out.textContent = JSON.stringify(data, null, 2);
  } else if (fmt === 'csv') {
    const keys = Object.keys(data[0]||{});
    out.textContent = [keys.join(','), ...data.map(r => keys.map(k => '"'+(r[k]||'')+'"').join(','))].join('\n');
  } else {
    // Table
    const keys = Object.keys(data[0]||{});
    let html = '<table class="fake-table"><thead><tr>'+keys.map(k=>`<th>${k}</th>`).join('')+'</tr></thead><tbody>';
    data.forEach(r => { html += '<tr>'+keys.map(k=>`<td>${r[k]||''}</td>`).join('')+'</tr>'; });
    html += '</tbody></table>';
    out.innerHTML = html;
  }
}

function dlFakeData() {
  const fmt = document.getElementById('fakeFmt').value;
  const out = document.getElementById('fakeOutput');
  const content = out.textContent || out.innerText;
  const ext = fmt === 'json' ? 'json' : fmt === 'csv' ? 'csv' : 'txt';
  const blob = new Blob([content], {type:'text/plain'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='fake-data.'+ext; a.click();
}

/* â•â•â•â• 13. Markdown Editor â•â•â•â• */
function renderMD() {
  const md = document.getElementById('mdInput').value;
  // Simple markdown parser
  let html = md
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/~~(.+?)~~/g,     '<del>$1</del>')
    .replace(/`([^`]+)`/g,     '<code>$1</code>')
    .replace(/^> (.+)$/gm,    '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm,    '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width:100%">')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
  document.getElementById('mdPreview').innerHTML = '<p>'+html+'</p>';
}
function mdInsert(text) {
  const ta = document.getElementById('mdInput');
  const start = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.slice(0,start) + text + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + text.length;
  ta.focus(); renderMD();
}
function dlMarkdown() {
  const content = document.getElementById('mdInput').value;
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content],{type:'text/markdown'})); a.download='document.md'; a.click();
}

/* â•â•â•â• 14. Meta Tag Generator â•â•â•â• */
function genMeta() {
  const title    = document.getElementById('metaTitle').value;
  const desc     = document.getElementById('metaDesc').value;
  const url      = document.getElementById('metaUrl').value;
  const img      = document.getElementById('metaImg').value;
  const author   = document.getElementById('metaAuthor').value;
  const keywords = document.getElementById('metaKeywords').value;
  const twCard   = document.getElementById('metaTwCard').value;
  const robots   = document.getElementById('metaRobots').value;

  document.getElementById('metaTitleCount').textContent = title.length+'/60';
  document.getElementById('metaDescCount').textContent  = desc.length+'/160';
  document.getElementById('metaTitleCount').style.color = title.length > 60 ? 'var(--red)' : 'var(--muted)';
  document.getElementById('metaDescCount').style.color  = desc.length > 160 ? 'var(--red)' : 'var(--muted)';

  let tags = '';
  if (title)    tags += `<title>${title}</title>
<meta name="title" content="${title}">
`;
  if (desc)     tags += `<meta name="description" content="${desc}">
`;
  if (keywords) tags += `<meta name="keywords" content="${keywords}">
`;
  if (author)   tags += `<meta name="author" content="${author}">
`;
  tags += `<meta name="robots" content="${robots}">
`;
  tags += `<meta name="viewport" content="width=device-width, initial-scale=1.0">
`;
  tags += `<meta charset="UTF-8">

`;
  // OG
  if (title) tags += `<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
`;
  if (desc)  tags += `<meta property="og:description" content="${desc}">
`;
  if (url)   tags += `<meta property="og:url" content="${url}">
`;
  if (img)   tags += `<meta property="og:image" content="${img}">
`;
  // Twitter
  tags += `
<!-- Twitter Card -->
<meta name="twitter:card" content="${twCard}">
`;
  if (title) tags += `<meta name="twitter:title" content="${title}">
`;
  if (desc)  tags += `<meta name="twitter:description" content="${desc}">
`;
  if (img)   tags += `<meta name="twitter:image" content="${img}">
`;

  document.getElementById('metaOutput').value = tags;
  document.getElementById('mpTitle').textContent = title || 'Page title yahan...';
  document.getElementById('mpDesc').textContent  = desc  || 'Description yahan dikhega...';
}

/* â•â•â•â• 15. Emoji Picker â•â•â•â• */
const EMOJIS = [
  {cat:'Smileys',emojis:['ðŸ˜€','ðŸ˜ƒ','ðŸ˜„','ðŸ˜','ðŸ˜†','ðŸ˜…','ðŸ¤£','ðŸ˜‚','ðŸ™‚','ðŸ™ƒ','ðŸ˜‰','ðŸ˜Š','ðŸ˜‡','ðŸ¥°','ðŸ˜','ðŸ¤©','ðŸ˜˜','ðŸ˜—','ðŸ˜š','ðŸ˜™','ðŸ¥²','ðŸ˜‹','ðŸ˜›','ðŸ˜œ','ðŸ¤ª','ðŸ˜','ðŸ¤‘','ðŸ¤—','ðŸ¤­','ðŸ¤«','ðŸ¤”','ðŸ¤','ðŸ¤¨','ðŸ˜','ðŸ˜‘','ðŸ˜¶','ðŸ˜','ðŸ˜’','ðŸ™„','ðŸ˜¬','ðŸ¤¥','ðŸ˜Œ','ðŸ˜”','ðŸ˜ª','ðŸ¤¤','ðŸ˜´','ðŸ˜·','ðŸ¤’','ðŸ¤•','ðŸ¤¢','ðŸ¤®','ðŸ¤§','ðŸ¥µ','ðŸ¥¶','ðŸ¥´','ðŸ˜µ','ðŸ’«','ðŸ¤¯','ðŸ¤ ','ðŸ¥³','ðŸ˜Ž','ðŸ¤“','ðŸ§','ðŸ˜•','ðŸ˜Ÿ','ðŸ™','â˜¹ï¸','ðŸ˜®','ðŸ˜¯','ðŸ˜²','ðŸ˜³','ðŸ¥º','ðŸ˜¦','ðŸ˜§','ðŸ˜¨','ðŸ˜°','ðŸ˜¥','ðŸ˜¢','ðŸ˜­','ðŸ˜±','ðŸ˜–','ðŸ˜£','ðŸ˜ž','ðŸ˜“','ðŸ˜©','ðŸ˜«','ðŸ¥±','ðŸ˜¤','ðŸ˜¡','ðŸ˜ ','ðŸ¤¬','ðŸ˜ˆ','ðŸ‘¿']},
  {cat:'People',emojis:['ðŸ‘‹','ðŸ¤š','ðŸ–ï¸','âœ‹','ðŸ––','ðŸ‘Œ','ðŸ¤Œ','ðŸ¤','âœŒï¸','ðŸ¤ž','ðŸ¤Ÿ','ðŸ¤˜','ðŸ¤™','ðŸ‘ˆ','ðŸ‘‰','ðŸ‘†','ðŸ–•','ðŸ‘‡','â˜ï¸','ðŸ‘','ðŸ‘Ž','âœŠ','ðŸ‘Š','ðŸ¤›','ðŸ¤œ','ðŸ‘','ðŸ™Œ','ðŸ‘','ðŸ¤²','ðŸ™','âœï¸','ðŸ’…','ðŸ¤³','ðŸ’ª','ðŸ¦¾','ðŸ¦¿','ðŸ¦µ','ðŸ¦¶','ðŸ‘‚','ðŸ¦»','ðŸ‘ƒ','ðŸ§ ','ðŸ«€','ðŸ«','ðŸ¦·','ðŸ¦´','ðŸ‘€','ðŸ‘ï¸','ðŸ‘…','ðŸ‘„','ðŸ’‹','ðŸ©¸']},
  {cat:'Animals',emojis:['ðŸ¶','ðŸ±','ðŸ­','ðŸ¹','ðŸ°','ðŸ¦Š','ðŸ»','ðŸ¼','ðŸ¨','ðŸ¯','ðŸ¦','ðŸ®','ðŸ·','ðŸ¸','ðŸµ','ðŸ™ˆ','ðŸ™‰','ðŸ™Š','ðŸ”','ðŸ§','ðŸ¦','ðŸ¤','ðŸ¦†','ðŸ¦…','ðŸ¦‰','ðŸ¦‡','ðŸº','ðŸ—','ðŸ´','ðŸ¦„','ðŸ','ðŸ›','ðŸ¦‹','ðŸŒ','ðŸž','ðŸœ','ðŸ¦Ÿ','ðŸ¦—','ðŸ•·ï¸','ðŸ¦‚','ðŸ¢','ðŸ','ðŸ¦Ž','ðŸ¦–','ðŸ¦•','ðŸ™','ðŸ¦‘','ðŸ¦','ðŸ¦ž','ðŸ¦€','ðŸ¡','ðŸ ','ðŸŸ','ðŸ¬','ðŸ³','ðŸ‹','ðŸ¦ˆ','ðŸŠ','ðŸ…','ðŸ†','ðŸ¦“','ðŸ¦','ðŸ¦§','ðŸ¦£','ðŸ˜','ðŸ¦›','ðŸ¦','ðŸª','ðŸ«','ðŸ¦’','ðŸ¦˜','ðŸ¦¬','ðŸƒ','ðŸ‚','ðŸ„','ðŸŽ','ðŸ–','ðŸ','ðŸ‘','ðŸ¦™','ðŸ','ðŸ¦Œ','ðŸ•','ðŸ©','ðŸ¦®','ðŸ•â€ðŸ¦º','ðŸˆ','ðŸˆâ€â¬›','ðŸª¶','ðŸ“','ðŸ¦ƒ','ðŸ¦¤','ðŸ¦š','ðŸ¦œ','ðŸ¦¢','ðŸ¦©','ðŸ•Šï¸','ðŸ‡','ðŸ¦','ðŸ¦¨','ðŸ¦¡','ðŸ¦«','ðŸ¦¦','ðŸ¦¥','ðŸ','ðŸ€','ðŸ¿ï¸','ðŸ¦”']},
  {cat:'Food',emojis:['ðŸŽ','ðŸŠ','ðŸ‹','ðŸ‡','ðŸ“','ðŸ«','ðŸˆ','ðŸ‘','ðŸ’','ðŸ¥­','ðŸ','ðŸ¥¥','ðŸ¥','ðŸ…','ðŸ†','ðŸ¥‘','ðŸ¥¦','ðŸ¥¬','ðŸ¥’','ðŸŒ¶ï¸','ðŸ«‘','ðŸ§„','ðŸ§…','ðŸ¥”','ðŸ ','ðŸŒ½','ðŸ¥•','ðŸ«›','ðŸ§†','ðŸ¥™','ðŸŒ®','ðŸŒ¯','ðŸ«”','ðŸ¥—','ðŸ¥˜','ðŸ«•','ðŸ¥«','ðŸ±','ðŸ˜','ðŸ£','ðŸ¤','ðŸ™','ðŸš','ðŸœ','ðŸ','ðŸ›','ðŸ²','ðŸ«™','ðŸ¦','ðŸ§','ðŸ¨','ðŸ©','ðŸª','ðŸŽ‚','ðŸ°','ðŸ§','ðŸ¥§','ðŸ«','ðŸ¬','ðŸ­','ðŸ®','ðŸ¯','â˜•','ðŸµ','ðŸ§ƒ','ðŸ¥¤','ðŸ§‹','ðŸ¶','ðŸº','ðŸ·','ðŸ¥‚','ðŸ¥ƒ','ðŸ¸','ðŸ¹']},
  {cat:'Travel',emojis:['ðŸš—','ðŸš•','ðŸš™','ðŸšŒ','ðŸšŽ','ðŸŽï¸','ðŸš“','ðŸš‘','ðŸš’','ðŸš','ðŸ›»','ðŸšš','ðŸš›','ðŸšœ','ðŸï¸','ðŸ›µ','ðŸ›º','ðŸš²','ðŸ›´','ðŸ›¹','ðŸ›¼','ðŸš','ðŸ›¸','âœˆï¸','ðŸ›©ï¸','ðŸš€','ðŸ›¶','â›µ','ðŸš¤','ðŸ›¥ï¸','ðŸ›³ï¸','â›´ï¸','ðŸš¢','âš“','ðŸ—ºï¸','ðŸ”ï¸','â›°ï¸','ðŸŒ‹','ðŸ—»','ðŸ•ï¸','ðŸ–ï¸','ðŸœï¸','ðŸï¸','ðŸžï¸','ðŸŸï¸','ðŸ›ï¸','ðŸ—ï¸','ðŸ˜ï¸','ðŸ™ï¸','ðŸŒ…','ðŸŒ„','ðŸŒ ','ðŸŽ‡','ðŸŽ†','ðŸŒ‡','ðŸŒ†','ðŸ™ï¸','ðŸŒƒ','ðŸŒŒ','ðŸŒ‰','ðŸŒ']},
  {cat:'Objects',emojis:['âŒš','ðŸ“±','ðŸ’»','âŒ¨ï¸','ðŸ–¥ï¸','ðŸ–¨ï¸','ðŸ–±ï¸','ðŸ’¾','ðŸ’¿','ðŸ“·','ðŸ“¸','ðŸ“¹','ðŸŽ¥','ðŸ“ž','â˜Žï¸','ðŸ“º','ðŸ“»','ðŸ§­','â±ï¸','â°','â³','ðŸ“¡','ðŸ”‹','ðŸ”Œ','ðŸ’¡','ðŸ”¦','ðŸ•¯ï¸','ðŸ—‘ï¸','ðŸ›¢ï¸','ðŸ’°','ðŸ’µ','ðŸ’³','ðŸ’Ž','ðŸ”§','ðŸ”¨','âš’ï¸','ðŸ› ï¸','ðŸ”©','ðŸ”—','â›“ï¸','ðŸª','ðŸ§²','ðŸ”‘','ðŸ—ï¸','ðŸªª','ðŸ”','ðŸ”’','ðŸ”“','ðŸªž','ðŸªŸ','ðŸšª','ðŸ›‹ï¸','ðŸª‘','ðŸš½','ðŸª ','ðŸš¿','ðŸ›','ðŸª¤','ðŸ“¦','ðŸ“«','ðŸ“¬','ðŸ“­','ðŸ“®','ðŸ“¯','ðŸ“œ','ðŸ“ƒ','ðŸ“„','ðŸ“‘','ðŸ“Š','ðŸ“ˆ','ðŸ“‰','ðŸ“‹','ðŸ“Œ','ðŸ“','âœ‚ï¸','ðŸ—ƒï¸','ðŸ—„ï¸','ðŸ—‘ï¸']},
  {cat:'Symbols',emojis:['â¤ï¸','ðŸ§¡','ðŸ’›','ðŸ’š','ðŸ’™','ðŸ’œ','ðŸ–¤','ðŸ¤','ðŸ¤Ž','ðŸ’”','â¤ï¸â€ðŸ”¥','â¤ï¸â€ðŸ©¹','â£ï¸','ðŸ’•','ðŸ’ž','ðŸ’“','ðŸ’—','ðŸ’–','ðŸ’˜','ðŸ’','ðŸ’Ÿ','â˜®ï¸','âœï¸','â˜ªï¸','ðŸ•‰ï¸','âœ¡ï¸','ðŸ”¯','ðŸª¯','â˜¯ï¸','ðŸ›','â›Ž','â™ˆ','â™‰','â™Š','â™‹','â™Œ','â™','â™Ž','â™','â™','â™‘','â™’','â™“','ðŸ†”','âš›ï¸','ðŸ‰‘','â˜¢ï¸','â˜£ï¸','ðŸ“´','ðŸ“³','ðŸˆ¶','ðŸˆš','ðŸˆ¸','ðŸˆº','ðŸˆ·ï¸','âœ´ï¸','ðŸ†š','ðŸ’®','ðŸ‰','ãŠ™ï¸','ãŠ—ï¸','ðŸˆ´','ðŸˆµ','ðŸˆ¹','ðŸˆ²','ðŸ…°ï¸','ðŸ…±ï¸','ðŸ†Ž','ðŸ†‘','ðŸ…¾ï¸','ðŸ†˜','âŒ','â­•','ðŸ›‘','â›”','ðŸ“›','ðŸš«','âœ…','â˜‘ï¸','âœ”ï¸','âŽ','ðŸ”°','â™»ï¸','ðŸ”±','ðŸ“›','ðŸ”°','â­•','âœ…','âŒ']}
];

function initEmoji() {
  const cats = document.getElementById('emojiCats');
  cats.innerHTML = EMOJIS.map(c =>
    `<button class="emoji-cat-btn" onclick="showEmojiCat('${c.cat}',this)">${c.cat}</button>`
  ).join('');
  showEmojiCat('Smileys', cats.firstChild);
}

function showEmojiCat(cat, btn) {
  document.querySelectorAll('.emoji-cat-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const group = EMOJIS.find(c => c.cat === cat);
  renderEmojis(group ? group.emojis : []);
}

function renderEmojis(list) {
  const grid = document.getElementById('emojiGrid');
  grid.innerHTML = list.map(e =>
    `<button class="emoji-btn" onclick="selectEmoji('${e}')" title="${e}">${e}</button>`
  ).join('');
}

function searchEmoji(q) {
  if (!q.trim()) { initEmoji(); return; }
  const all = EMOJIS.flatMap(c => c.emojis);
  // Simple: show all (can't search by name without dict â€” just filter nothing)
  renderEmojis(all.filter((_, i) => i < 200));
}

function selectEmoji(e) {
  document.getElementById('emojiSelectedShow').textContent = e;
  document.getElementById('emojiSelectedCode').textContent = [...e].map(c => 'U+'+c.codePointAt(0).toString(16).toUpperCase()).join(' ');
  document.getElementById('emojiCopyBtn').style.display = 'inline-block';
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('sel'));
  event.target.classList.add('sel');
}
function copyEmoji() { copyText(document.getElementById('emojiSelectedShow').textContent, document.getElementById('emojiCopyBtn')); }
// (moved to main DOMContentLoaded)

/* â•â•â•â• 16. Invoice Generator â•â•â•â• */
let invItemCount = 0;
function addInvItem(desc='', qty=1, rate=0) {
  invItemCount++;
  const id = invItemCount;
  const wrap = document.getElementById('invItems');
  const row = document.createElement('div'); row.className = 'inv-item-row'; row.id='irow'+id;
  row.innerHTML = `
    <input type="text"   class="tinput" placeholder="Item description" value="${desc}" oninput="updateInv()" style="flex:3">
    <input type="number" class="tinput" placeholder="Qty"  value="${qty}"  min="1" oninput="updateInv()" style="flex:1">
    <input type="number" class="tinput" placeholder="Rate" value="${rate}" min="0" oninput="updateInv()" style="flex:2">
    <button class="tbtn-xs secondary" onclick="document.getElementById('irow${id}').remove();updateInv()">âœ•</button>`;
  wrap.appendChild(row);
  updateInv();
}

function updateInv() {
  const cur    = document.getElementById('invCurrency').value;
  const gstPct = parseFloat(document.getElementById('invGST').value)||0;

  // Preview update
  document.getElementById('prevFrom').textContent     = document.getElementById('invFrom').value     || 'Your Business';
  document.getElementById('prevFromSub').textContent  = document.getElementById('invFromEmail').value || '';
  document.getElementById('prevNum').textContent      = document.getElementById('invNum').value       || 'INV-001';
  document.getElementById('prevDate').textContent     = document.getElementById('invDate').value      || 'â€”';
  document.getElementById('prevDue').textContent      = document.getElementById('invDue').value       || 'â€”';
  document.getElementById('prevTo').textContent       = document.getElementById('invTo').value        || 'Client Name';
  document.getElementById('prevToEmail').textContent  = document.getElementById('invToEmail').value   || '';
  document.getElementById('prevGSTRate').textContent  = gstPct;

  // Items
  let subtotal = 0;
  const tbody = document.getElementById('prevItems');
  tbody.innerHTML = '';
  document.querySelectorAll('.inv-item-row').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const desc = inputs[0].value, qty = parseFloat(inputs[1].value)||0, rate = parseFloat(inputs[2].value)||0;
    const amt  = qty * rate;
    subtotal  += amt;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${desc||'â€”'}</td><td>${qty}</td><td>${cur}${rate.toFixed(2)}</td><td>${cur}${amt.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });

  const gst   = subtotal * gstPct / 100;
  const total = subtotal + gst;
  document.getElementById('prevSubtotal').textContent = cur + subtotal.toFixed(2);
  document.getElementById('prevGST').textContent      = cur + gst.toFixed(2);
  document.getElementById('prevTotal').textContent    = cur + total.toFixed(2);

  const notes = document.getElementById('invNotes').value;
  const notesEl = document.getElementById('prevNotes');
  notesEl.textContent = notes; notesEl.style.display = notes ? 'block' : 'none';
}

function printInvoice() {
  const preview = document.getElementById('invPreview').outerHTML;
  const win = window.open('','_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>Invoice</title><style>
    body{font-family:sans-serif;padding:40px;color:#1a1a18;background:#fff}
    .inv-prev-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #FAC775}
    .inv-prev-from{font-size:18px;font-weight:700} .inv-prev-from-sub{font-size:13px;color:#666}
    .inv-prev-title{font-size:28px;font-weight:800;color:#FAC775}
    .inv-prev-meta{display:flex;gap:24px;margin-bottom:20px;font-size:13px} .inv-prev-meta b{display:block;color:#666;font-size:11px;text-transform:uppercase}
    .inv-prev-to{margin-bottom:20px;font-size:13px} .inv-prev-to b{display:block;color:#666;font-size:11px;text-transform:uppercase;margin-bottom:4px}
    .inv-prev-table{width:100%;border-collapse:collapse;margin-bottom:16px} .inv-prev-table th,.inv-prev-table td{padding:10px 12px;text-align:left;border-bottom:1px solid #eee;font-size:13px}
    .inv-prev-table th{background:#f5f5f3;font-weight:600;font-size:11px;text-transform:uppercase}
    .inv-prev-totals{float:right;width:240px} .inv-total-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid #eee}
    .inv-total-row.total{font-weight:700;font-size:15px;border-top:2px solid #1a1a18;border-bottom:none;padding-top:10px}
    .inv-prev-notes{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#666}
    @media print{body{padding:20px}}
  </style></head><body>${preview}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
}


/* â•â•â•â• Age Calculator â•â•â•â• */
/* Additional productivity and utility tools */

const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
const hindiOnes = ['','à¤à¤•','à¤¦à¥‹','à¤¤à¥€à¤¨','à¤šà¤¾à¤°','à¤ªà¤¾à¤à¤š','à¤›à¤¹','à¤¸à¤¾à¤¤','à¤†à¤ ','à¤¨à¥Œ','à¤¦à¤¸','à¤—à¥à¤¯à¤¾à¤°à¤¹','à¤¬à¤¾à¤°à¤¹','à¤¤à¥‡à¤°à¤¹','à¤šà¥Œà¤¦à¤¹','à¤ªà¤‚à¤¦à¥à¤°à¤¹','à¤¸à¥‹à¤²à¤¹','à¤¸à¤¤à¥à¤°à¤¹','à¤…à¤ à¤¾à¤°à¤¹','à¤‰à¤¨à¥à¤¨à¥€à¤¸'];
const hindiTens = ['','','à¤¬à¥€à¤¸','à¤¤à¥€à¤¸','à¤šà¤¾à¤²à¥€à¤¸','à¤ªà¤šà¤¾à¤¸','à¤¸à¤¾à¤ ','à¤¸à¤¤à¥à¤¤à¤°','à¤…à¤¸à¥à¤¸à¥€','à¤¨à¤¬à¥à¤¬à¥‡'];

function belowHundred(n) { return n < 20 ? ones[n] : tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : ''); }
function belowHundredHi(n) { return n < 20 ? hindiOnes[n] : hindiTens[Math.floor(n/10)] + (n%10 ? ' '+hindiOnes[n%10] : ''); }

function toWords(n) {
  if (n === 0) return 'Zero';
  if (n < 0) return 'Minus ' + toWords(-n);
  if (n < 100) return belowHundred(n);
  if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + belowHundred(n%100) : '');
  if (n < 100000)   return toWords(Math.floor(n/1000))     + ' Thousand'  + (n%1000   ? ' ' + toWords(n%1000)   : '');
  if (n < 10000000) return toWords(Math.floor(n/100000))   + ' Lakh'      + (n%100000 ? ' ' + toWords(n%100000) : '');
  if (n < 1000000000) return toWords(Math.floor(n/10000000)) + ' Crore'   + (n%10000000 ? ' ' + toWords(n%10000000) : '');
  return toWords(Math.floor(n/1000000000)) + ' Arab' + (n%1000000000 ? ' ' + toWords(n%1000000000) : '');
}

function toWordsHindi(n) {
  if (n === 0) return 'à¤¶à¥‚à¤¨à¥à¤¯';
  if (n < 0) return 'à¤®à¤¾à¤‡à¤¨à¤¸ ' + toWordsHindi(-n);
  if (n < 100) return belowHundredHi(n);
  if (n < 1000) return hindiOnes[Math.floor(n/100)] + ' à¤¸à¥Œ' + (n%100 ? ' ' + toWordsHindi(n%100) : '');
  if (n < 100000)   return toWordsHindi(Math.floor(n/1000))     + ' à¤¹à¤œà¤¼à¤¾à¤°'  + (n%1000   ? ' ' + toWordsHindi(n%1000)   : '');
  if (n < 10000000) return toWordsHindi(Math.floor(n/100000))   + ' à¤²à¤¾à¤–'   + (n%100000 ? ' ' + toWordsHindi(n%100000) : '');
  if (n < 1000000000) return toWordsHindi(Math.floor(n/10000000)) + ' à¤•à¤°à¥‹à¤¡à¤¼' + (n%10000000 ? ' ' + toWordsHindi(n%10000000) : '');
  return toWordsHindi(Math.floor(n/1000000000)) + ' à¤…à¤°à¤¬' + (n%1000000000 ? ' ' + toWordsHindi(n%1000000000) : '');
}

function num2words() {
  const raw = document.getElementById('numInput').value.trim();
  const n = parseInt(raw);
  if (!raw || isNaN(n)) { document.getElementById('numEnglish').textContent = 'â€”'; document.getElementById('numHindi').textContent = 'â€”'; return; }
  const mode = document.getElementById('numCurrency').value;
  let engResult = toWords(Math.abs(n));
  let hinResult = toWordsHindi(Math.abs(n));
  if (mode === 'inr') { engResult += ' Rupees Only'; hinResult += ' à¤°à¥à¤ªà¤¯à¥‡ à¤®à¤¾à¤¤à¥à¤°'; }
  else if (mode === 'usd') { engResult += ' Dollars Only'; }
  if (n < 0) { engResult = 'Minus ' + engResult; hinResult = 'à¤®à¤¾à¤‡à¤¨à¤¸ ' + hinResult; }
  document.getElementById('numEnglish').textContent = engResult;
  document.getElementById('numHindi').textContent = hinResult;
}

/* â•â•â•â• Aspect Ratio Calculator â•â•â•â• */
function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }

const commonRatios = {
  '16:9': 'Widescreen / YouTube / TV',
  '9:16': 'Mobile / Instagram Reels / TikTok',
  '1:1':  'Instagram Post / Profile Photo',
  '4:3':  'Classic TV / Old Monitors',
  '4:5':  'Instagram Portrait',
  '21:9': 'Ultrawide / Cinema',
  '3:2':  'DSLR Photo / Laptop',
  '2:1':  'Twitter Header',
};

function calcAR(changed) {
  const w = parseFloat(document.getElementById('arW').value);
  const h = parseFloat(document.getElementById('arH').value);
  if (!w || !h) return;

  const d = gcd(Math.round(w), Math.round(h));
  const rw = Math.round(w/d), rh = Math.round(h/d);
  const ratioStr = rw + ':' + rh;
  const ratioDecimal = (w/h).toFixed(4);

  document.getElementById('arRatio').textContent = ratioStr;
  const name = commonRatios[ratioStr] || `${ratioDecimal}:1`;
  document.getElementById('arName').textContent = name;

  // Visual
  const box = document.getElementById('arVisual');
  const maxW = 260, maxH = 200;
  const scale = Math.min(maxW/w, maxH/h);
  box.style.width  = Math.round(w*scale) + 'px';
  box.style.height = Math.round(h*scale) + 'px';
  document.getElementById('arVisualLabel').textContent = w + ' Ã— ' + h;

  if (document.getElementById('arNewW').value) scaleAR();
}

function scaleAR() {
  const w = parseFloat(document.getElementById('arW').value);
  const h = parseFloat(document.getElementById('arH').value);
  const newW = parseFloat(document.getElementById('arNewW').value);
  if (!w || !h || !newW) return;
  document.getElementById('arNewH').value = Math.round(newW * h / w);
}

function setAR(w, h) {
  document.getElementById('arW').value = w;
  document.getElementById('arH').value = h;
  calcAR('w');
}

// (moved to main DOMContentLoaded)

/* â•â•â•â• GST Calculator â•â•â•â• */
let gstRate = 5;
function setGSTRate(rate, btn) {
  gstRate = rate;
  document.querySelectorAll('.gst-rate-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.gst-half').forEach(el => el.textContent = rate/2);
  calcGST();
}
function calcGST() {
  const amt = parseFloat(document.getElementById('gstAmt').value) || 0;
  const type = document.querySelector('input[name="gstType"]:checked').value;
  let orig, gstAmt, total;
  if (type === 'add') {
    orig = amt; gstAmt = amt * gstRate / 100; total = amt + gstAmt;
  } else {
    total = amt; orig = amt * 100 / (100 + gstRate); gstAmt = total - orig;
  }
  const half = gstAmt / 2;
  document.getElementById('gstOrig').textContent  = 'â‚¹' + orig.toFixed(2);
  document.getElementById('gstCGST').textContent  = 'â‚¹' + half.toFixed(2);
  document.getElementById('gstSGST').textContent  = 'â‚¹' + half.toFixed(2);
  document.getElementById('gstTotal').textContent = 'â‚¹' + total.toFixed(2);
  document.getElementById('gstAmt2').textContent  = 'â‚¹' + gstAmt.toFixed(2);
  document.querySelectorAll('.gst-half').forEach(el => el.textContent = gstRate/2);
}

/* â•â•â•â• Profit Margin Calculator â•â•â•â• */
function calcProfit() {
  const cost = parseFloat(document.getElementById('profCost').value) || 0;
  const sell = parseFloat(document.getElementById('profSell').value) || 0;
  const qty  = parseFloat(document.getElementById('profQty').value)  || 1;
  const cur  = document.getElementById('profCur').value;
  const revenue   = sell * qty;
  const totalCost = cost * qty;
  const gross     = revenue - totalCost;
  const margin    = sell > 0 ? (gross / revenue * 100) : 0;
  const markup    = cost > 0 ? ((sell - cost) / cost * 100) : 0;
  document.getElementById('profRevenue').textContent   = cur + revenue.toFixed(2);
  document.getElementById('profTotalCost').textContent = cur + totalCost.toFixed(2);
  document.getElementById('profGross').textContent     = cur + gross.toFixed(2);
  document.getElementById('profMarginBig').textContent = margin.toFixed(1) + '%';
  document.getElementById('profMarkup').textContent    = markup.toFixed(1) + '%';
  document.getElementById('profBreak').textContent     = sell > 0 ? Math.ceil(cost / (sell - cost) * qty) + ' units' : 'â€”';
  document.getElementById('profMarginBig').style.color = gross >= 0 ? 'var(--green)' : 'var(--red)';
}

/* â•â•â•â• Pomodoro Timer â•â•â•â• */
let pomoTimer = null, pomoRemaining = 25*60, pomoTotal = 25*60, pomoRunning = false, pomoSessions = 0, pomoTotalFocused = 0;
const POMO_MODES = { focus: 25*60, short: 5*60, long: 15*60 };
function setPomoMode(mode, btn) {
  if (pomoRunning) return;
  document.querySelectorAll('.pomo-mode').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  pomoTotal = POMO_MODES[mode]; pomoRemaining = pomoTotal;
  updatePomoDisplay();
}
function togglePomo() {
  if (pomoRunning) {
    clearInterval(pomoTimer); pomoRunning = false;
    document.getElementById('pomoStartBtn').textContent = 'â–¶ Resume';
    document.getElementById('pomoStatus').textContent = 'Paused';
  } else {
    pomoRunning = true;
    document.getElementById('pomoStartBtn').textContent = 'â¸ Pause';
    document.getElementById('pomoStatus').textContent = document.getElementById('pomoTask').value || 'Focusing...';
    pomoTimer = setInterval(() => {
      pomoRemaining--;
      if (pomoRemaining <= 0) {
        clearInterval(pomoTimer); pomoRunning = false;
        pomoSessions++;
        if (document.getElementById('pomoModeFocus').classList.contains('active')) {
          pomoTotalFocused += pomoTotal / 60;
          document.getElementById('pomoTotalMin').textContent = pomoTotalFocused;
        }
        document.getElementById('pomoCount').textContent = pomoSessions;
        document.getElementById('pomoStatus').textContent = 'âœ“ Done!';
        document.getElementById('pomoStartBtn').textContent = 'â–¶ Start';
        try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAA').play(); } catch {}
        alert('â° Time up! ' + (document.getElementById('pomoModeFocus').classList.contains('active') ? 'Break lo! â˜•' : 'Wapas kaam shuru karo! ðŸ’ª'));
        pomoRemaining = pomoTotal;
      }
      updatePomoDisplay();
    }, 1000);
  }
}
function resetPomo() {
  clearInterval(pomoTimer); pomoRunning = false; pomoRemaining = pomoTotal;
  document.getElementById('pomoStartBtn').textContent = 'â–¶ Start';
  document.getElementById('pomoStatus').textContent = 'Ready';
  updatePomoDisplay();
}
function updatePomoDisplay() {
  const m = Math.floor(pomoRemaining/60), s = pomoRemaining%60;
  document.getElementById('pomoTime').textContent = String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  const pct = 1 - pomoRemaining/pomoTotal;
  const circumference = 2 * Math.PI * 90;
  document.getElementById('pomoProgress').style.strokeDashoffset = circumference * (1 - pct);
}

/* â•â•â•â• Unit Converter â•â•â•â• */
const UNITS = {
  length: { m:'Meter', km:'Kilometer', cm:'Centimeter', mm:'Millimeter', mi:'Mile', ft:'Feet', in:'Inch', yd:'Yard' },
  weight: { kg:'Kilogram', g:'Gram', mg:'Milligram', lb:'Pound', oz:'Ounce', t:'Metric Ton' },
  temp:   { c:'Celsius', f:'Fahrenheit', k:'Kelvin' },
  area:   { m2:'Square Meter', km2:'Square KM', cm2:'Square CM', ha:'Hectare', ac:'Acre', ft2:'Square Feet' },
  speed:  { 'km/h':'km/h', 'mph':'mph', 'mps':'m/s', knot:'Knot' },
  data:   { b:'Byte', kb:'Kilobyte', mb:'Megabyte', gb:'Gigabyte', tb:'Terabyte' }
};
const TO_BASE = {
  m:1,km:1000,cm:.01,mm:.001,mi:1609.34,ft:.3048,in:.0254,yd:.9144,
  kg:1,g:.001,mg:.000001,lb:.453592,oz:.0283495,t:1000,
  m2:1,km2:1e6,cm2:.0001,ha:10000,ac:4046.86,ft2:.0929,
  'km/h':1,'mph':1.60934,'mps':3.6,knot:1.852,
  b:1,kb:1024,mb:1048576,gb:1073741824,tb:1099511627776
};
let currentUnitCat = 'length';
function setUnitCat(cat, btn) {
  currentUnitCat = cat;
  document.querySelectorAll('.unit-cat').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const units = UNITS[cat];
  const keys = Object.keys(units);
  const fromSel = document.getElementById('unitFrom');
  const toSel   = document.getElementById('unitTo');
  fromSel.innerHTML = keys.map(k => `<option value="${k}">${units[k]}</option>`).join('');
  toSel.innerHTML   = keys.map(k => `<option value="${k}">${units[k]}</option>`).join('');
  toSel.value = keys[1] || keys[0];
  convertUnit();
}
function convertUnit() {
  const val  = parseFloat(document.getElementById('unitVal').value) || 0;
  const from = document.getElementById('unitFrom').value;
  const to   = document.getElementById('unitTo').value;
  const cat  = currentUnitCat;
  let result;
  if (cat === 'temp') {
    if (from==='c'&&to==='f') result = val*9/5+32;
    else if (from==='f'&&to==='c') result = (val-32)*5/9;
    else if (from==='c'&&to==='k') result = val+273.15;
    else if (from==='k'&&to==='c') result = val-273.15;
    else if (from==='f'&&to==='k') result = (val-32)*5/9+273.15;
    else if (from==='k'&&to==='f') result = (val-273.15)*9/5+32;
    else result = val;
  } else {
    result = val * (TO_BASE[from]||1) / (TO_BASE[to]||1);
  }
  document.getElementById('unitResult').value = parseFloat(result.toPrecision(8));
  document.getElementById('unitFormula').textContent = `${val} ${UNITS[cat][from]} = ${parseFloat(result.toPrecision(8))} ${UNITS[cat][to]}`;
  // Show all conversions
  if (cat !== 'temp') {
    const baseVal = val * (TO_BASE[from]||1);
    const allHTML = Object.entries(UNITS[cat]).map(([k,name]) => {
      const conv = baseVal / (TO_BASE[k]||1);
      return `<div class="unit-all-row"><span>${name}</span><strong>${parseFloat(conv.toPrecision(6))}</strong></div>`;
    }).join('');
    document.getElementById('unitAllResults').innerHTML = allHTML;
  }
}
function swapUnits() {
  const f = document.getElementById('unitFrom').value;
  const t = document.getElementById('unitTo').value;
  document.getElementById('unitFrom').value = t;
  document.getElementById('unitTo').value   = f;
  convertUnit();
}
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('unitFrom')) setUnitCat('length', document.querySelector('.unit-cat'));
});

/* â•â•â•â• CSS Gradient Generator â•â•â•â• */
let gradType = 'linear';
let gradColors = ['#FAC775','#F09595'];
const GRAD_PRESETS = [
  {name:'Sunset',colors:['#FF6B6B','#FEC89A']},
  {name:'Ocean',colors:['#667eea','#764ba2']},
  {name:'Forest',colors:['#134e5e','#71b280']},
  {name:'Rose',colors:['#f953c6','#b91d73']},
  {name:'Sky',colors:['#a8edea','#fed6e3']},
  {name:'Gold',colors:['#FAC775','#e0aa55']},
  {name:'Night',colors:['#0f0c29','#302b63','#24243e']},
  {name:'Mint',colors:['#00b09b','#96c93d']},
];
function setGradType(t, btn) {
  gradType = t;
  document.querySelectorAll('.grad-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('gradAngleField').style.display = t==='linear' ? 'flex' : 'none';
  updateGrad();
}
function addGradColor(color) {
  gradColors.push(color || '#5DCAA5');
  renderGradColorInputs();
  updateGrad();
}
function renderGradColorInputs() {
  const list = document.getElementById('gradColorsList');
  list.innerHTML = gradColors.map((c,i) => `
    <div class="grad-color-row">
      <input type="color" value="${c}" onchange="gradColors[${i}]=this.value;updateGrad()" class="color-pick-sm">
      <input type="text" value="${c}" onchange="gradColors[${i}]=this.value;this.previousElementSibling.value=this.value;updateGrad()" class="tinput" style="flex:1;font-size:12px" maxlength="7">
      ${gradColors.length>2 ? `<button class="tbtn-xs secondary" onclick="gradColors.splice(${i},1);renderGradColorInputs();updateGrad()">âœ•</button>` : ''}
    </div>`).join('');
}
function updateGrad() {
  renderGradColorInputs();
  const angle = document.getElementById('gradAngle').value;
  const stops = gradColors.join(', ');
  let css;
  if (gradType==='linear')      css = `linear-gradient(${angle}deg, ${stops})`;
  else if (gradType==='radial') css = `radial-gradient(circle, ${stops})`;
  else                          css = `conic-gradient(from ${angle}deg, ${stops})`;
  const fullCSS = `background: ${css};`;
  document.getElementById('gradCSS').textContent = fullCSS;
  document.getElementById('gradPreview').style.background = css;
  document.getElementById('gradBtnPrev').style.background = css;
  document.getElementById('gradTextPrev').style.backgroundImage = css;
  document.getElementById('gradCardPrev').style.background = css;
}
function initGradPresets() {
  const wrap = document.getElementById('gradPresets');
  if (!wrap) return;
  wrap.innerHTML = GRAD_PRESETS.map(p =>
    `<button class="grad-preset-swatch" style="background:linear-gradient(135deg,${p.colors.join(',')})" title="${p.name}" onclick="gradColors=${JSON.stringify(p.colors)};renderGradColorInputs();updateGrad()"></button>`
  ).join('');
}
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('gradPresets')) { initGradPresets(); renderGradColorInputs(); updateGrad(); }
});

/* â•â•â•â• Age Calculator â•â•â•â• */
function calcAge() {
  const dob   = new Date(document.getElementById('ageDOB').value);
  const asOf  = new Date(document.getElementById('ageAsOf').value || Date.now());
  if (isNaN(dob)) return;
  const diff  = asOf - dob;
  const totalDays  = Math.floor(diff / 86400000);
  const totalWeeks = Math.floor(totalDays / 7);
  const totalHours = Math.floor(diff / 3600000);
  let years = asOf.getFullYear() - dob.getFullYear();
  let months = asOf.getMonth() - dob.getMonth();
  if (months < 0) { years--; months += 12; }
  document.getElementById('ageYears').textContent  = years;
  document.getElementById('ageMonths').textContent = years*12 + months;
  document.getElementById('ageWeeks').textContent  = totalWeeks.toLocaleString('en-IN');
  document.getElementById('ageDays').textContent   = totalDays.toLocaleString('en-IN');
  document.getElementById('ageHours').textContent  = totalHours.toLocaleString('en-IN');
  // Next birthday
  const nextBday = new Date(asOf.getFullYear(), dob.getMonth(), dob.getDate());
  if (nextBday <= asOf) nextBday.setFullYear(nextBday.getFullYear() + 1);
  const daysToB = Math.ceil((nextBday - asOf) / 86400000);
  document.getElementById('ageNextBday').textContent = daysToB === 0 ? 'ðŸŽ‚ Aaj!' : daysToB + ' days mein';
}
function calcDateDiff() {
  const start = new Date(document.getElementById('dateStart').value);
  const end   = new Date(document.getElementById('dateEnd').value);
  if (isNaN(start) || isNaN(end)) return;
  const diff  = Math.abs(end - start);
  const days  = Math.floor(diff / 86400000);
  document.getElementById('dateDiffResult').style.display = 'block';
  document.getElementById('ddDays').textContent   = days.toLocaleString('en-IN');
  document.getElementById('ddWeeks').textContent  = Math.floor(days/7).toLocaleString('en-IN');
  document.getElementById('ddMonths').textContent = Math.floor(days/30.44).toFixed(1);
  document.getElementById('ddWork').textContent   = Math.floor(days * 5/7).toLocaleString('en-IN');
}
function calcCountdown() {
  const event = new Date(document.getElementById('dateEvent').value);
  const now   = new Date();
  if (isNaN(event)) return;
  const diff  = event - now;
  const el    = document.getElementById('countdownResult');
  if (diff < 0) { el.textContent = 'Yeh date guzar gayi!'; el.style.color='var(--red)'; return; }
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  el.textContent = days + ' days aur ' + hours + ' hours baaki hain';
  el.style.color = 'var(--accent)';
}
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('ageAsOf')) {
    document.getElementById('ageAsOf').value = new Date().toISOString().split('T')[0];
    document.getElementById('dateEnd').value = new Date().toISOString().split('T')[0];
  }
});

// Signal that tools.js is fully loaded
window._toolsReady = true;
window.dispatchEvent(new Event("toolsReady"));

