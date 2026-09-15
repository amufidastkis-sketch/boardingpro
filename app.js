
// --- FIX LOGIN HANDLER ---
/* Application behaviour. Shared catalogues and seed data live only in data.js. */
const clone = (value) => JSON.parse(JSON.stringify(value));
const today = '2026-09-05';
const KOP_SURAT_LOGO = './assets/logo-removebg-preview.png';
const SECURITY_STORAGE_PREFIX = 'boardingpro-secure:';
const SECURITY_KEY_NAME = `${SECURITY_STORAGE_PREFIX}key`;
const securityKeyMaterial = localStorage.getItem(SECURITY_KEY_NAME) || (() => {
  const material = crypto.getRandomValues(new Uint8Array(32));
  const encoded = btoa(String.fromCharCode(...material));
  localStorage.setItem(SECURITY_KEY_NAME, encoded);
  return encoded;
})();
const securityKeyPromise = crypto.subtle.importKey('raw', Uint8Array.from(atob(securityKeyMaterial), (character) => character.charCodeAt(0)), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
const secureStorage = {
  async set(key, value) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(value));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await securityKeyPromise, encoded);
    const payload = new Uint8Array(iv.length + encrypted.byteLength);
    payload.set(iv);
    payload.set(new Uint8Array(encrypted), iv.length);
    localStorage.setItem(`${SECURITY_STORAGE_PREFIX}${key}`, btoa(String.fromCharCode(...payload)));
  },
  async get(key) {
    const stored = localStorage.getItem(`${SECURITY_STORAGE_PREFIX}${key}`);
    if (!stored) return null;
    const payload = Uint8Array.from(atob(stored), (character) => character.charCodeAt(0));
    const value = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: payload.slice(0, 12) }, await securityKeyPromise, payload.slice(12));
    return JSON.parse(new TextDecoder().decode(value));
  }
};
const SecurityEngine = secureStorage;
function migratePlainStorage(key, value) {
  if (value !== null) secureStorage.set(key, value).then(() => localStorage.removeItem(key)).catch((error) => console.error(`[BoardingPro] Gagal mengenkripsi ${key}:`, error));
}
function sanitizeInput(value) {
  return sanitizeHTML(value);
}
function sanitizeHTML(value) {
  const text = String(value ?? '').trim();
  const element = document.createElement('textarea');
  element.textContent = text;
  return element.value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}
function sanitizeTextFields(form) {
  if (!form || form.id === 'account-login-form' || form.id === 'admin-password-form') return;
  form.querySelectorAll('input[type="text"], input:not([type]), textarea').forEach((field) => {
    field.value = sanitizeInput(field.value);
  });
}
function verifyDocumentAccess(docType, userRole) {
  const role = String(userRole || '').toLowerCase();
  const allowedRoles = {
    permit: ['parent', 'student', 'pembina', 'musyrif', 'security', 'mahad', 'admin', 'kepsek', 'yayasan'],
    discipline: ['student', 'parent', 'pembina', 'musyrif', 'mahad', 'admin', 'kepsek', 'yayasan'],
    invoice: ['parent', 'student', 'mahad', 'admin', 'kepsek', 'yayasan'],
    receipt: ['parent', 'student', 'mahad', 'admin', 'kepsek', 'yayasan']
  };
  return Boolean(allowedRoles[String(docType || '').toLowerCase()]?.includes(role));
}
const SecurityMasker = {
  canViewFull() { return ['mahad', 'admin', 'kepsek', 'yayasan'].includes(String(effectiveRole()).toLowerCase()); },
  phone(value) {
    const text = String(value ?? '');
    return this.canViewFull() || text.length < 8 ? text : `${text.slice(0, 4)}****${text.slice(-4)}`;
  },
  identity(value) {
    const text = String(value ?? '');
    return this.canViewFull() || text.length < 6 ? text : `${text.slice(0, 3)}****${text.slice(-3)}`;
  }
};
const sensitiveDocumentRoles = ['mahad', 'admin', 'kepsek', 'yayasan'];
function bindSensitiveDocumentGuard() {
  if (window.__boardingProSecurityGuard) return;
  window.__boardingProSecurityGuard = true;
  document.addEventListener('contextmenu', (event) => {
    if ($('#modal-root .document-container') && !sensitiveDocumentRoles.includes(String(effectiveRole()).toLowerCase())) event.preventDefault();
  });
  document.addEventListener('keydown', (event) => {
    const sensitiveOpen = $('#modal-root .document-container') && !sensitiveDocumentRoles.includes(String(effectiveRole()).toLowerCase());
    if (sensitiveOpen && (event.key === 'F12' || (event.ctrlKey && event.shiftKey && ['I', 'J', 'C'].includes(event.key.toUpperCase())) || (event.ctrlKey && event.key.toUpperCase() === 'U'))) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}
document.addEventListener('submit', (event) => {
  sanitizeTextFields(event.target);
}, true);
function kopSuratHtml() {
  return `<header class="kop-container kop-surat"><div class="logo-wrapper" aria-label="Logo Yayasan"><img src="${KOP_SURAT_LOGO}" alt="Logo"></div><div class="kop-text"><b>SEKOLAH TAHFIDZ KEJURUAN</b><h1>IRMAN SOFRAN</h1><p>Kp. Eurih RT. 004 RW.03 Kel. Tambang Ayam, Kec. Anyar, Kab. Serang, Prov. Banten, 42166, Indonesia | Telp: ${SecurityMasker.phone('0877-7120-0615')}</p><small>admin@tahfidzkejuruan.org | www.tahfidzkejuruan.org</small></div></header>`;
}
const savedState = localStorage.getItem('boardingpro-state');
let state = { ...clone(seedData), role: localStorage.getItem('boardingpro-role') || 'yayasan', view: 'dashboard', gateEvents: [], lastActivity: Date.now() };
if (savedState) {
  try { state = { ...state, ...JSON.parse(savedState) }; migratePlainStorage('boardingpro-state', JSON.parse(savedState)); } catch { localStorage.removeItem('boardingpro-state'); }
}
secureStorage.get('boardingpro-state').then((storedState) => {
  if (storedState && typeof storedState === 'object') {
    state = { ...state, ...storedState };
    window.appData.state = state;
    if (document.readyState !== 'loading') render();
  }
}).catch((error) => console.error('[BoardingPro] Gagal membaca state terenkripsi:', error));
function musyrifPermitForm() {
  if (!['pembina', 'musyrif'].includes(effectiveRole())) return '';
  return section('Input Izin Atas Nama Santri', 'Sistem menolak persetujuan izin mandiri jika kuota minggu berjalan sudah 3 kali.', `<form id="musyrif-permit-form" class="form-grid"><label>Santri<select name="studentId">${state.students.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} ? ${escapeHtml(SecurityMasker.identity(item.nis))}</option>`).join('')}</select></label><label>Kategori Izin<select name="kategori_izin"><option>Keluar Mandiri</option><option>Dijenguk Orang Tua</option><option>Kegiatan Bersama Sekolah</option></select></label><label>Tanggal<input name="date" type="date" value="${today}" required></label><label class="full">Alasan<textarea name="reason" required></textarea></label><button class="btn btn-primary full" type="submit">${icon('send')} Simpan Pengajuan</button></form>`);
}
state.config = state.config || {};
state.config.institution = {
  foundationName: 'SEKOLAH TAHFIDZ KEJURUAN',
  name: 'IRMAN SOFRAN',
  school: "STK IRMAN SOFRAN",
  address: 'Kp. Eurih RT. 004 RW.03 Kel. Tambang Ayam, Kec. Anyar, Kab. Serang, Prov. Banten, 42166, Indonesia',
  phone: '0877-7120-0615',
  website: 'www.tahfidzkejuruan.org',
  logo: '',
  logoUrl: '',
  ...(state.config.institution || {})
};
const notificationStoreKey = 'boardingpro-notifications';
let notificationState = JSON.parse(localStorage.getItem(notificationStoreKey) || '{}');
secureStorage.get('notifications').then((storedNotifications) => {
  if (storedNotifications && typeof storedNotifications === 'object') notificationState = storedNotifications;
}).catch((error) => console.error('[BoardingPro] Gagal membaca notifikasi terenkripsi:', error));
const notificationSeedDate = new Date().toISOString();
Object.values(roleNotifications).forEach((items) => items.forEach((item) => {
  const saved = notificationState[item.id] || {};
  item.createdAt = saved.createdAt || item.createdAt || notificationSeedDate;
  item.read = saved.read === true;
}));
const persistNotificationState = () => {
  const snapshot = {};
  Object.values(roleNotifications).flat().forEach((item) => { snapshot[item.id] = { read: item.read === true, createdAt: item.createdAt }; });
  secureStorage.set('notifications', snapshot).catch((error) => console.error('[BoardingPro] Gagal menyimpan notifikasi terenkripsi:', error));
};
function filterActiveNotifications(items) {
  const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
  const active = items.filter((item) => !item.createdAt || new Date(item.createdAt).getTime() >= twoDaysAgo);
  persistNotificationState();
  return active;
}
function securityAlertBanner() {
  const active = state.incidents.filter((item) => item.status !== 'Selesai');
  return active.length ? `<div class="notice" style="margin-bottom:18px"><b>? ${active.length} laporan darurat keamanan perlu ditindaklanjuti.</b> <button class="btn btn-small btn-ghost" data-view="security-reports">Buka laporan</button></div>` : '';
}
Object.keys(seedData).forEach((key) => { if (!state[key]) state[key] = clone(seedData[key]); });
['classes', 'teachers', 'financeBills', 'scholarships', 'discounts', 'invoices', 'receipts', 'dailyFeed', 'monthlySummaries', 'yayasanProgress', 'internalAccounts', 'announcements', 'pocketTransactions', 'pocketBalances', 'majors', 'teacherTeachingRecords', 'teachingAssignments', 'kbmAttendance', 'kbmJournals', 'kbmGrades', 'tahfizhRecords', 'incidents', 'lostFound', 'disciplineRecords'].forEach((key) => {
  if (!Array.isArray(state[key])) state[key] = clone(seedData[key] || []);
});
if (!state.internalAccounts.some((account) => account.username === 'admin')) {
  const master = seedData.internalAccounts.find((account) => account.username === 'admin');
  if (master) state.internalAccounts.unshift(clone(master));
}
state.users = state.internalAccounts;
state.currentUser = state.internalAccounts.find((account) => account.username === state.username) || null;
state.students.forEach((student) => {
  const nis = String(student.nis || '').trim();
  if (!nis || state.internalAccounts.some((account) => account.studentId === student.id && account.role === 'student')) return;
  state.internalAccounts.push({ id: `ACC-${student.id}-S`, role: 'student', username: nis, password: nis, name: student.name, studentId: student.id, status: 'Aktif', passwordChangeCount: 0 });
  state.internalAccounts.push({ id: `ACC-${student.id}-P`, role: 'parent', username: `ortu_${nis}`, password: 'wali123', name: student.parent || 'Orang Tua / Wali', studentId: student.id, status: 'Aktif', passwordChangeCount: 0 });
});
state.users = state.internalAccounts;
const ROLE_STORAGE_KEY = 'boardingpro-master-roles';
const DEFAULT_MASTER_ROLES = ["Admin Mahad", 'Guru / Ustadz Tahfizh', 'Musyrif / Pembina Asrama', 'Admin Kesantrian', 'Kepala Sekolah', 'Staf Keuangan'];
function masterRoles() {
  const saved = JSON.parse(localStorage.getItem(ROLE_STORAGE_KEY) || 'null');
  return Array.isArray(saved) && saved.length ? saved : DEFAULT_MASTER_ROLES.slice();
}
function saveMasterRoles(items) {
  const unique = [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
  localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(unique));
  return unique;
}
function compactUsername(name) {
  const cleaned = String(name || '').replace(/^(?:drs?\.?|dra\.?|ustadzah?|ust\.?|bpk\.?|ibu|bapak|hj\.?|h\.)\s+/i, '').trim();
  const words = cleaned.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  return words.length <= 1 ? (words[0] || '') : `${words[0]}.${words.slice(1).map((word) => word[0]).join('')}`;
}
state.users.forEach((account) => {
  if (Array.isArray(account.roles) && !account.role) account.role = account.roles[0];
  if (account.role === 'master_admin') account.role = 'mahad';
  delete account.activeRole;
});
const primaryAdmin = state.users.find((account) => account.username === 'admin.stkis') || state.users.find((account) => account.master);
if (primaryAdmin) {
  primaryAdmin.name = "Mahad/Admin";
  primaryAdmin.role = 'mahad';
  primaryAdmin.username = 'admin.stkis';
  primaryAdmin.password = 'StkIs#2026!Pro';
}
if (!state.users.some((account) => account.role === 'mahad' || account.role === 'admin')) {
  state.users.push({ id: 'ACC-MASTER-AUTO', name: "Mahad/Admin", username: 'admin.stkis', password: 'StkIs#2026!Pro', role: 'mahad', status: 'Aktif', active: true, master: true, passwordChangeCount: 0 });
}
state.currentUser = state.users.find((account) => account.username === state.username) || state.currentUser;
const normalizeProgramStructure = () => {
  const nonSmkClasses = state.classes.filter((item) => item.programId === 'PPTAK' || item.programId === 'KWNQ');
  ['PPTAK', 'KWNQ'].forEach((programId) => {
    if (nonSmkClasses.filter((item) => item.programId === programId).length > 1) {
      const canonical = clone(seedData.classes.find((item) => item.programId === programId));
      state.classes = state.classes.filter((item) => item.programId !== programId);
      state.classes.push(canonical);
    }
  });
  state.students.forEach((student) => {
    if (student.program === 'PPTAK') { student.major = ''; student.className = 'Kelas PPTAK'; }
    if (student.program === 'KWNQ') { student.major = ''; student.className = 'Kelas KWNQ'; }
  });
};
normalizeProgramStructure();

const $ = (selector) => document.querySelector(selector);
const initials = (name) => name.split(' ').map((part) => part[0]).slice(0, 2).join('');
const studentById = (id) => state.students.find((student) => student.id === id) || { name: 'Tidak diketahui', className: '', room: '', nis: '' };
const formatDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const qrSignatureUrl = (payload) => `https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=8&data=${encodeURIComponent(JSON.stringify(payload))}`;
const documentActionRoles = ['orang_tua', 'parent', 'kepala_sekolah', 'kepsek', 'admin_mahad', 'mahad', 'maahad', 'admin', 'yayasan', 'pengurus_yayasan'];
const canUseDocumentActions = () => documentActionRoles.includes(String(effectiveRole() || '').toLowerCase());
function printDocumentInFrame(html, title, pageStyle = '') {
  const frame = document.createElement('iframe');
  frame.className = 'document-print-frame';
  frame.setAttribute('title', `Print ${title}`);
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
  document.body.appendChild(frame);
  const frameDocument = frame.contentDocument;
  if (!frameDocument) {
    frame.remove();
    throw new Error('Dokumen print iframe tidak tersedia.');
  }
  frameDocument.open();
  frameDocument.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${documentEngineStyles}${pageStyle}</style></head><body>${html}</body></html>`);
  frameDocument.close();
  let printed = false;
  const print = () => {
    if (printed) return;
    printed = true;
    frame.contentWindow.focus();
    frame.contentWindow.print();
    window.setTimeout(() => frame.remove(), 1000);
  };
  frame.onload = () => window.setTimeout(print, 80);
  window.setTimeout(() => {
    if (document.body.contains(frame)) print();
  }, 500);
}
function downloadDocumentPdf(html, title, pageStyle = '') {
  const container = document.createElement('div');
  container.innerHTML = html;
  const documentNode = container.querySelector('.document-container, .permit-letter') || container.firstElementChild;
  if (!documentNode) throw new Error('Konten dokumen tidak ditemukan.');
  if (typeof window.html2pdf !== 'function') {
    showToast('Generator PDF belum siap. Muat ulang halaman lalu coba lagi.', 'error');
    return;
  }
  window.html2pdf().set({
    margin: 0,
    filename: `${String(title).replace(/[^\w.-]+/g, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['css', 'legacy'] }
  }).from(documentNode).save();
}
function documentActionButtons(kind, id, label = 'Cetak') {
  if (!canUseDocumentActions()) return '';
  return `<div class="document-actions document-action-buttons" data-document-actions="${escapeHtml(kind)}" data-document-id="${escapeHtml(id || '')}"><button type="button" class="btn btn-ghost" data-document-preview>${icon('eye', 14)} Lihat / Preview</button><button type="button" class="btn btn-ghost" data-document-download>${icon('download', 14)} Download PDF</button><button type="button" class="btn btn-primary" data-document-print>${icon('printer', 14)} ${escapeHtml(label)}</button></div>`;
}
function bindDocumentActions(root, title, pageStyle = '') {
  const documentNode = root.querySelector('.document-container, .permit-letter');
  const actions = root.querySelector('[data-document-actions]');
  if (!documentNode || !actions) return;
  actions.querySelector('[data-document-preview]')?.addEventListener('click', () => documentNode.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  actions.querySelector('[data-document-download]')?.addEventListener('click', () => downloadDocumentPdf(documentNode.outerHTML, title, pageStyle));
  actions.querySelector('[data-document-print]')?.addEventListener('click', () => printDocumentInFrame(documentNode.outerHTML, title, pageStyle));
}
function signatureQrHtml(label, name, timestamp, payload) {
  const safeTimestamp = timestamp || new Date().toISOString();
  const signaturePayload = { ...payload, signer: name || 'Tidak diketahui', signedAt: safeTimestamp };
  const isApplicant = label.toLowerCase().includes('pemohon');
  const badge = isApplicant ? 'Terverifikasi Digital' : "Stempel Digital Mahad";
  return `<div class="signature-card" style="min-width:0;text-align:center;border:1px solid #cbd5e1;border-radius:8px;padding:12px;overflow-wrap:anywhere;break-inside:avoid"><b class="signature-title" style="display:block;font-size:11px">${escapeHtml(label)}</b><img src="${qrSignatureUrl(signaturePayload)}" alt="QR tanda tangan ${escapeHtml(label)}" width="120" height="120" style="display:block;width:120px;height:120px;max-width:100%;margin:8px auto;object-fit:contain" loading="lazy"><strong style="display:block;font-size:11px">${escapeHtml(name || 'Tidak diketahui')}</strong><small style="display:block;font-size:9px;color:#475569">${escapeHtml(new Date(safeTimestamp).toLocaleString('id-ID'))}</small><span class="signature-badge" style="display:inline-block;margin-top:8px;padding:4px 8px;border-radius:999px;background:#d1fae5;color:#047857;font-size:9px;font-weight:700">${escapeHtml(badge)}</span></div>`;
}
const documentEngineStyles = `*,*:before,*:after{box-sizing:border-box}html,body{margin:0;padding:0;background:#e2e8f0;color:#0f172a;font-family:Arial,sans-serif}.document-container{position:relative;width:100%;max-width:210mm;min-height:297mm;margin:18px auto;padding:15mm;background:#fff;box-shadow:0 8px 28px #0f172a22;overflow:hidden}.kop-container{display:flex;align-items:center;justify-content:center;gap:18px;width:100%;text-align:center;border-bottom:3px double #0f172a;padding-bottom:12px;margin-bottom:16px}.logo-wrapper{display:grid;place-items:center;flex:none;width:110px;height:110px}.logo-wrapper img{display:block;width:100%;height:100%;object-fit:contain}.kop-text{flex:1;min-width:0;text-align:center;line-height:1.35}.kop-text b,.kop-text h1,.kop-text p,.kop-text small{display:block;margin:2px 0;text-align:center}.kop-text h1{font-size:18px;line-height:1.2}.kop-text p,.kop-text small{font-size:10px;line-height:1.45;color:#475569}.document-header{text-align:center;border-bottom:5px double #0f172a;padding-bottom:10px;margin-bottom:22px}.document-header h1,.document-header h2,.document-header p{margin:3px 0;text-align:center}.document-header h1{font-size:20px}.document-header p{font-size:11px;color:#475569}.document-content{line-height:1.65;overflow-wrap:anywhere}.document-signatures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:28px;page-break-inside:avoid}.document-watermark{position:absolute;top:48%;left:50%;z-index:2;width:150%;transform:translate(-50%,-50%) rotate(-28deg);color:#b91c1c2b;font-size:34px;font-weight:800;letter-spacing:3px;text-align:center;pointer-events:none;white-space:nowrap}.document-container.is-draft .document-signatures{display:none}.document-container.is-draft .document-content{opacity:.9}.document-multiline{white-space:pre-line}@media(max-width:820px){.document-container{width:100%;min-height:auto;margin:0;padding:28px 20px;box-shadow:none}.document-signatures{grid-template-columns:1fr}.document-watermark{font-size:25px}}@media print{@page{size:A4 portrait;margin:15mm}.document-container{width:100%;max-width:210mm;min-height:297mm;margin:0;box-shadow:none}.document-actions{display:none!important}}`;
function renderDocumentPreview(docType, docData = {}) {
  const status = String(docData.status || '').toLowerCase();
  const verified = ['approved', 'terverifikasi', 'verified', 'lunas', 'aktif'].includes(status);
  const institution = state.config?.institution || {};
  const title = docData.title || ({ discipline: 'Surat Peringatan / DO', invoice: 'Invoice Pembayaran', billing: 'Surat Tagihan', permit: 'Surat Izin Santri' }[docType] || 'Dokumen BoardingPro');
  const content = docData.html || ({
    discipline: `<h2>${escapeHtml(docData.level || 'SURAT KEDISIPLINAN')}</h2><p>Santri: <b>${escapeHtml(docData.studentName || '?')}</b></p><p class="document-multiline">${escapeHtml(docData.sanction || docData.description || '?')}</p>`,
    invoice: `<h2>INVOICE PEMBAYARAN</h2><p>Nomor: <b>${escapeHtml(docData.number || '?')}</b></p><p>Santri: ${escapeHtml(docData.studentName || '?')}</p><p class="document-multiline">${escapeHtml(docData.description || '?')}</p><h3>${escapeHtml(docData.total || '?')}</h3>`,
    billing: `<h2>SURAT TAGIHAN</h2><p>Nomor: <b>${escapeHtml(docData.number || '?')}</b></p><p>Santri: ${escapeHtml(docData.studentName || '?')}</p><p class="document-multiline">${escapeHtml(docData.description || '?')}</p><h3>${escapeHtml(docData.total || '?')}</h3>`,
    permit: `<h2>SURAT IZIN SANTRI</h2><p>Santri: <b>${escapeHtml(docData.studentName || '?')}</b></p><p class="document-multiline">${escapeHtml(docData.reason || '?')}</p>`
  }[docType] || `<h2>${escapeHtml(title)}</h2><p class="document-multiline">${escapeHtml(docData.description || 'Dokumen digital BoardingPro')}</p>`);
  const signatures = verified && docData.signaturesHtml ? `<div class="document-signatures">${docData.signaturesHtml}</div>` : '';
  const watermark = verified ? '' : '<div class="document-watermark" aria-label="Draft menunggu verifikasi">DRAFT / MENUNGGU VERIFIKASI</div>';
  const documentHtml = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${documentEngineStyles}</style></head><body><main class="document-container${verified ? '' : ' is-draft'}">${kopSuratHtml()}<section class="document-content">${content}</section>${signatures}${watermark}</main></body></html>`;
  const blobUrl = URL.createObjectURL(new Blob([documentHtml], { type: 'text/html;charset=utf-8' }));
  const preview = window.open(blobUrl, '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!preview) { URL.revokeObjectURL(blobUrl); alert('Popup diblokir browser. Izinkan popup untuk melihat dokumen.'); return null; }
  const revoke = () => URL.revokeObjectURL(blobUrl);
  preview.addEventListener('load', revoke, { once: true });
  window.setTimeout(revoke, 60000);
  return blobUrl;
}
const QUOTA_LIMIT = 3;
const quotaFreeCategories = ['Dijenguk Orang Tua', 'Kegiatan Bersama Sekolah'];
function startOfWeek(dateValue) {
  const date = new Date(`${dateValue || today}T00:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}
function isQuotaDeducted(permit) {
  return permit?.is_quota_deducted !== false && !quotaFreeCategories.includes(permit?.kategori_izin || permit?.type);
}
function weeklyQuotaUsed(studentId, dateValue = today) {
  const weekStart = startOfWeek(dateValue);
  return state.permits.filter((permit) => permit.studentId === studentId
    && ['Approved', 'Terverifikasi'].includes(permit.status)
    && isQuotaDeducted(permit)
    && startOfWeek(permit.date) === weekStart).length;
}
function canApprovePermit(permit) {
  return !isQuotaDeducted(permit) || weeklyQuotaUsed(permit.studentId, permit.date) < QUOTA_LIMIT;
}
const icon = (name, size = 18) => `<i data-lucide="${name}" width="${size}" height="${size}"></i>`;
const statusBadge = (status) => {
  const styles = { Approved: 'badge-success', Verified: 'badge-success', Terverifikasi: 'badge-success', Lunas: 'badge-success', Hadir: 'badge-success', Published: 'badge-success', Pending: 'badge-warning', Menunggu: 'badge-warning', Menunggak: 'badge-danger', Rejected: 'badge-danger', Alpa: 'badge-danger', Draft: 'badge-neutral' };
  return `<span class="badge ${styles[status] || 'badge-neutral'}">${status}</span>`;
};
const persist = () => {
  secureStorage.set('boardingpro-state', state).catch((error) => console.error('[BoardingPro] Gagal menyimpan state terenkripsi:', error));
  secureStorage.set('boardingpro-role', state.role).catch((error) => console.error('[BoardingPro] Gagal menyimpan role terenkripsi:', error));
  window.appData.state = state;
  window.appData.currentSantri = currentStudent();
  syncFirebaseFinance();
};
const isPklEligible = (student) => student.program === 'SMK' && ((Number(student.grade) === 11 && Number(student.semester) === 2) || (Number(student.grade) === 12 && Number(student.semester) === 1));
const currentAccount = () => state.users.find((account) => account.username === state.username) || state.currentUser;
const currentStudent = () => {
  const account = currentAccount();
  return state.students.find((student) => student.id === account?.studentId)
    || state.students.find((student) => String(student.nis) === String(account?.username || '').trim())
    || state.students.find((student) => student.id === state.studentId)
    || state.students[0];
};
const isMasterAdminSession = () => {
  const account = currentAccount();
  return account?.role === 'mahad';
};
const effectiveRole = () => {
  const currentUser = state.currentUser || currentAccount();
  return state.activeRoleView || currentUser?.role || state.role;
};
const currentRoleIsAdmin = () => ['mahad', 'admin'].includes(effectiveRole());
const checkPermission = () => currentRoleIsAdmin();
const hasTahfizhAccess = () => currentRoleIsAdmin() || ['pembina', 'musyrif'].includes(effectiveRole()) || (effectiveRole() === 'guru' && currentAccount()?.isTahfizhTeacher === true) || (currentAccount()?.isMusyrif === true && ['guru', 'pembina', 'musyrif'].includes(effectiveRole()));
const canManageAnnouncements = () => ['mahad', 'kepsek'].includes(effectiveRole());
const canPromoteStudents = () => ['kepsek', 'mahad', 'admin'].includes(effectiveRole());
const canManageFinance = () => ['mahad', 'admin'].includes(effectiveRole());
const canManageSecurity = () => ['security', 'mahad', 'admin'].includes(effectiveRole());
const canManageDormitory = () => ['mahad', 'admin', 'pembina', 'musyrif'].includes(effectiveRole()) || (['guru', 'pembina', 'musyrif'].includes(effectiveRole()) && currentAccount()?.isMusyrif === true);
const isActiveStudent = (student) => student && student.status !== 'Alumni' && student.status !== 'Alumni Program' && [10, 11, 12].includes(Number(student.grade)) || ['PPTAK', 'KWNQ'].includes(student?.program) && student.status !== 'Alumni' && student.status !== 'Alumni Program';
state.billingNotifications = (state.billingNotifications || []).filter((bill) => isActiveStudent(state.students.find((student) => student.id === bill.studentId)));
const financeGroupKeys = ['Reguler SMK ? Kelas 10', 'Reguler SMK ? Kelas 11', 'Reguler SMK ? Kelas 12', 'Program PPTAK (1 Tahun) ? Non-Jenjang', 'Program KWNQ (3 Bulan) ? Non-Jenjang'];
function groupedActiveStudentRecords(records, renderItem, emptyMessage = 'Belum ada data tagihan') {
  const groups = Object.fromEntries(financeGroupKeys.map((key) => [key, []]));
  records.forEach((record) => {
    const student = studentById(record.studentId);
    if (!isActiveStudent(student)) return;
    const program = student.program === 'PPTAK' ? 'Program PPTAK (1 Tahun)' : student.program === 'KWNQ' ? 'Program KWNQ (3 Bulan)' : 'Reguler SMK';
    const key = `${program} ? ${['PPTAK', 'KWNQ'].includes(student.program) ? 'Non-Jenjang' : `Kelas ${Number(student.grade)}`}`;
    if (groups[key]) groups[key].push(record);
  });
  return groupedDetails('Rekap', groups, (items) => items.length ? items.map(renderItem).join('') : `<div class="empty">${emptyMessage}</div>`);
}
const canManageSchool = () => ['mahad', 'admin', 'kepsek'].includes(effectiveRole());
const canViewFinance = () => ['mahad', 'admin', 'parent', 'yayasan', 'kepsek', 'pembina', 'musyrif'].includes(effectiveRole());
const canViewFinanceSummary = () => canViewFinance();
const currentMajors = () => (state.majors || majors).filter((major) => major.programId === 'SMK');
const benefitAmount = (entries, bill) => entries.filter((entry) => entry.active !== false && entry.studentId === bill.studentId && (!entry.category || entry.category === bill.category)).reduce((sum, entry) => sum + (entry.type === 'Percent' ? Number(bill.amount || 0) * Number(entry.amount || 0) / 100 : Number(entry.amount || 0)), 0);
const billAdjustments = (bill) => ({
  scholarship: bill.scholarship !== undefined ? Number(bill.scholarship || 0) : benefitAmount(state.scholarships, bill),
  discount: bill.discount !== undefined ? Number(bill.discount || 0) : benefitAmount(state.discounts, bill)
});
const billNet = (bill) => {
  const adjustment = billAdjustments(bill);
  return Math.max(0, Number(bill.amount || 0) - adjustment.scholarship - adjustment.discount);
};
const categoryLabel = (id) => {
  const categories = [financeCategories.spp, financeCategories.foundation, ...financeCategories.maahadNonSpp, financeCategories.pocketMoney, financeCategories.custom];
  return (categories.find((category) => category.id === id) || { label: id || 'Lainnya' }).label;
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
let inactivityTimer = null;
const INACTIVITY_LIMIT = 15 * 60 * 1000;
const firebaseState = { database: null, syncing: false, ready: false };
var firebaseConfig = window.BOARDINGPRO_FIREBASE_CONFIG || {
  apiKey: 'AIzaSyBdihFIGtHf_tnyEMxL2PrryotpA6hCgVw',
  authDomain: 'boardingpro-web.firebaseapp.com',
  databaseURL: 'https://boardingpro-web-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'boardingpro-web',
  storageBucket: 'boardingpro-web.firebasestorage.app',
  messagingSenderId: '218729877835',
  appId: '1:218729877835:web:9222e0ed4899dd9a6c18ce'
};
var db = null;
window.appData = window.appData || {};
window.appData.state = state;
window.appData.currentSantri = currentStudent();

function loadFirebaseScript(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Gagal memuat Firebase SDK: ${source}`));
    document.head.appendChild(script);
  });
}

async function initializeFirebase() {
  if (!firebaseConfig || !firebaseConfig.databaseURL) return;
  if (!window.firebase) {
    await loadFirebaseScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
    await loadFirebaseScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js');
  }
  const firebaseApp = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(firebaseConfig);
  firebaseState.database = firebaseApp.database();
  db = firebaseState.database;
  firebaseState.ready = true;
  const paymentsRef = firebaseState.database.ref('boardingpro/payments');
  const invoicesRef = firebaseState.database.ref('boardingpro/invoices');
  paymentsRef.on('value', (snapshot) => {
    if (firebaseState.syncing) return;
    const remote = snapshot.val();
    if (remote && typeof remote === 'object') {
      state.payments = Object.values(remote);
      persist();
    }
    render();
  }, (error) => console.error('[BoardingPro] Sinkronisasi pembayaran gagal:', error));
  invoicesRef.on('value', (snapshot) => {
    if (firebaseState.syncing) return;
    const remote = snapshot.val();
    if (remote && typeof remote === 'object') {
      state.invoices = Object.values(remote);
      persist();
    }
    render();
  }, (error) => console.error('[BoardingPro] Sinkronisasi invoice gagal:', error));
}

function syncFirebaseFinance() {
  if (!firebaseState.ready || !firebaseState.database) return;
  firebaseState.syncing = true;
  Promise.all([
    firebaseState.database.ref('boardingpro/payments').set(Object.fromEntries(state.payments.map((item) => [item.id, item]))),
    firebaseState.database.ref('boardingpro/invoices').set(Object.fromEntries(state.invoices.map((item) => [item.id, item])))
  ]).catch((error) => console.error('[BoardingPro] Gagal menyimpan pembayaran/invoice ke Firebase:', error)).finally(() => {
    firebaseState.syncing = false;
  });
}

function saveAuthenticatedUser() {
  const account = currentAccount();
  const role = roles[account?.role || state.role] || roles.yayasan;
  const user = {
    role: account?.role || state.role,
    username: state.username || role.demoName.toLowerCase().replace(/[^a-z0-9]+/g, '.'),
    name: state.displayName || role.demoName
  };
  secureStorage.set('boardingpro-user', user).catch((error) => console.error('[BoardingPro] Gagal menyimpan sesi terenkripsi:', error));
  localStorage.removeItem('boardingpro-user');
}

function stopInactivityTimer() {
  if (inactivityTimer) {
    window.clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

function resetInactivityTimer() {
  stopInactivityTimer();
  if (localStorage.getItem('boardingpro-auth') !== 'true') return;
  state.lastActivity = Date.now();
  inactivityTimer = window.setTimeout(() => {
    localStorage.removeItem('boardingpro-auth');
    secureStorage.set('boardingpro-user', null).catch((error) => console.error('[BoardingPro] Gagal menghapus sesi terenkripsi:', error));
    showLanding();
  }, INACTIVITY_LIMIT);
}

function startInactivityTimer() {
  ['mousemove', 'click', 'keypress', 'touchstart'].forEach((eventName) => {
    document.addEventListener(eventName, resetInactivityTimer, { passive: true });
  });
  resetInactivityTimer();
}

function navItems() {
  const common = [{ id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' }, { id: 'schedule', label: 'Jadwal & Event', icon: 'calendar-days' }, { id: 'announcements', label: 'Pengumuman', icon: 'megaphone' }];
  const pklItem = isPklEligible(currentStudent()) ? { id: 'pkl', label: 'Praktik Kerja Lapangan', icon: 'briefcase-business' } : { id: 'pkl', label: 'PKL ? Terkunci', icon: 'lock-keyhole' };
  const map = {
    yayasan: [...common, { id: 'finance', label: 'Keuangan Yayasan', icon: 'wallet-cards' }, { id: 'reports', label: 'Laporan Eksekutif', icon: 'bar-chart-3' }, { id: 'discipline', label: 'Kedisiplinan', icon: 'shield-alert' }, { id: 'security-reports', label: 'Laporan Keamanan & Pos Jaga', icon: 'shield-alert' }, { id: 'teacher-attendance', label: 'Rekap Kehadiran Guru', icon: 'calendar-check' }, { id: 'students', label: 'Data Santri', icon: 'users' }, { id: 'classes', label: 'Kelas & Program', icon: 'school' }, { id: 'teachers', label: 'Data Guru', icon: 'graduation-cap' }],
    kepsek: [...common, { id: 'finance', label: 'Keuangan Sekolah', icon: 'wallet-cards' }, { id: 'reports', label: 'Laporan Eksekutif', icon: 'bar-chart-3' }, { id: 'discipline', label: 'Kedisiplinan', icon: 'shield-alert' }, { id: 'security-reports', label: 'Laporan Keamanan & Pos Jaga', icon: 'shield-alert' }, { id: 'students', label: 'Data Santri', icon: 'users' }, { id: 'teacher-attendance', label: 'Rekap Kehadiran Guru', icon: 'calendar-check' }, { id: 'academic', label: 'Akademik & Tahfizh', icon: 'book-marked' }],
    maahad: [...common, { id: 'students', label: 'Data Master Santri', icon: 'users' }, { id: 'classes', label: 'Kelas', icon: 'school' }, { id: 'teachers', label: 'Data Guru', icon: 'graduation-cap' }, { id: 'teacher-attendance', label: 'Rekap Kehadiran Guru', icon: 'calendar-check' }, { id: 'discipline', label: 'Kedisiplinan', icon: 'shield-check' }, { id: 'security-reports', label: 'Laporan Keamanan & Pos Jaga', icon: 'shield-alert' }, { id: 'accounts', label: 'Akun Internal', icon: 'key-round' }, { id: 'permits', label: 'Approval Perizinan', icon: 'clipboard-check' }, { id: 'billing', label: 'Tagihan & Notifikasi', icon: 'receipt' }, { id: 'payments', label: 'Verifikasi Pembayaran', icon: 'badge-check' }, { id: 'pocket', label: 'Uang Saku', icon: 'wallet' }, { id: 'academic', label: 'Rekap Akademik & PKL', icon: 'book-marked' }],
    admin: [...common, { id: 'students', label: 'Data Master Santri', icon: 'users' }, { id: 'classes', label: 'Kelas', icon: 'school' }, { id: 'teachers', label: 'Data Guru', icon: 'graduation-cap' }, { id: 'discipline', label: 'Kedisiplinan', icon: 'shield-check' }, { id: 'security-reports', label: 'Laporan Keamanan & Pos Jaga', icon: 'shield-alert' }, { id: 'permits', label: 'Approval Perizinan', icon: 'clipboard-check' }, { id: 'billing', label: 'Tagihan & Notifikasi', icon: 'receipt' }, { id: 'payments', label: 'Verifikasi Pembayaran', icon: 'badge-check' }, { id: 'pocket', label: 'Uang Saku', icon: 'wallet' }, { id: 'academic', label: 'Rekap Akademik & PKL', icon: 'book-marked' }],
    guru: [...common, { id: 'grades', label: 'Nilai Pelajaran', icon: 'notebook-pen' }, { id: 'teacher-attendance', label: 'Presensi Guru', icon: 'calendar-check' }],
    guru_tahfizh: [...common, { id: 'grades', label: 'Nilai Pelajaran', icon: 'notebook-pen' }, { id: 'tahfizh', label: 'Laporan Tahfizh', icon: 'book-open-check' }, { id: 'teacher-attendance', label: 'Presensi Guru', icon: 'calendar-check' }],
    pembina: [...common, { id: 'points', label: 'Poin Kedisiplinan', icon: 'award' }, { id: 'discipline', label: 'Kedisiplinan', icon: 'shield-check' }, { id: 'tahfizh', label: 'Program Tahfizh', icon: 'book-open-check' }, { id: 'permits', label: 'Approval Izin', icon: 'clipboard-check' }, { id: 'pocket', label: 'Uang Saku', icon: 'wallet' }],
    musyrif: [...common, { id: 'points', label: 'Poin Kedisiplinan', icon: 'award' }, { id: 'discipline', label: 'Kedisiplinan', icon: 'shield-check' }, { id: 'tahfizh', label: 'Program Tahfizh', icon: 'book-open-check' }, { id: 'permits', label: 'Approval Izin', icon: 'clipboard-check' }, { id: 'pocket', label: 'Uang Saku', icon: 'wallet' }],
    security: [...common, { id: 'gate', label: 'Log Gerbang', icon: 'scan-line' }, { id: 'security-reports', label: 'Laporan Keamanan', icon: 'shield-alert' }],
    parent: [{ id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' }, { id: 'child', label: 'Ringkasan Anak', icon: 'heart' }, { id: 'discipline', label: 'Kedisiplinan Anak', icon: 'shield-alert' }, { id: 'payments', label: 'Keuangan & Tagihan', icon: 'wallet-cards' }, { id: 'pocket', label: 'Uang Saku', icon: 'wallet' }, { id: 'permits', label: 'Perizinan', icon: 'clipboard-list' }, { id: 'announcements', label: 'Pengumuman', icon: 'megaphone' }],
    student: [...common, { id: 'points', label: 'Poin Kedisiplinan', icon: 'award' }, { id: 'discipline', label: 'Sanksi Saya', icon: 'shield-alert' }, { id: 'tahfizh', label: 'Tahfizh Saya', icon: 'book-open-check' }, pklItem]
  };
  // The real Mahad/Admin account keeps its full navigation only in the
  // default view; an emulator must receive the simulated role's menu.
  if (isMasterAdminSession() && !state.activeRoleView) {
    return [...new Map(Object.values(map).flat().map((item) => [item.id, item])).values()]
      .map((item) => item.id === 'discipline' ? { ...item, label: 'Kedisiplinan', icon: 'shield-check' } : item);
  }
  const role = effectiveRole();
  if (role === 'guru' && currentAccount()?.isMusyrif) return [...map.guru, ...map.pembina.filter((item) => !map.guru.some((base) => base.id === item.id))];
  if (role === 'guru' && currentAccount()?.isTahfizhTeacher) return [...map.guru, { id: 'tahfizh', label: 'Laporan Tahfizh', icon: 'book-open-check' }];
  return map[role] || map[role === 'mahad' ? 'maahad' : role === 'santri' ? 'student' : role] || common;
}

function navigationIcon(name) {
  return `<span class="nav-icon" aria-hidden="true">${icon(name, 16)}</span>`;
}

function ensureNavigationIcons(container) {
  if (!container) return;
  if (window.lucide) lucide.createIcons();
  container.querySelectorAll('.nav-icon').forEach((wrapper) => {
    if (wrapper.querySelector('svg')) return;
    wrapper.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M8 12h8M12 8v8"></path></svg>';
  });
}

function renderShell() {
  const role = roles[effectiveRole()] || roles.yayasan;
  const items = navItems();
  const quickNav = $('#quick-nav');
  if (!items.some((item) => item.id === state.view)) state.view = items[0]?.id || 'dashboard';
  if ($('#role-description')) $('#role-description').textContent = role.description;
  if (quickNav) quickNav.innerHTML = items.map((item) => `<button type="button" class="${state.view === item.id ? 'active' : ''}" data-view="${item.id}">${navigationIcon(item.icon)}<span class="nav-label">${item.label}</span></button>`).join('');
  ensureNavigationIcons(quickNav);
  if ($('#page-title')) $('#page-title').textContent = (items.find((item) => item.id === state.view) || items[0]).label;
  const account = currentAccount();
  if ($('#user-role')) $('#user-role').textContent = account?.name || role.demoName;
  if ($('#user-avatar')) $('#user-avatar').textContent = initials(role.demoName);
  const switcher = $('#role-switcher');
  const emulatorRoles = ['mahad', 'yayasan', 'kepsek', 'guru', 'pembina', 'security', 'parent', 'student'];
  if (switcher) switcher.innerHTML = isMasterAdminSession()
    ? `<label class="role-switch-label">Tampilan Sebagai: <select id="active-role-view">${emulatorRoles.map((item) => `<option value="${item}" ${item === effectiveRole() ? 'selected' : ''}>${roles[item]?.label || item}</option>`).join('')}</select></label>`
    : '';
  $('#active-role-view')?.addEventListener('change', (event) => {
    state.activeRoleView = event.target.value === 'mahad' ? null : event.target.value;
    const simulatedItems = navItems();
    state.view = simulatedItems[0]?.id || 'dashboard';
    persist();
    renderDashboard();
  });
  if (quickNav) quickNav.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
    state.view = button.dataset.view;
    render();
  }));
}

function statCard(label, value, helper, iconName, color = 'blue') {
  return `<div class="stat-card"><div class="stat-top"><span class="stat-icon ${color}">${icon(iconName)}</span><span class="trend-up">${icon('trending-up', 14)} ${helper}</span></div><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;
}
function table(headers, rows, empty = 'Belum ada data') {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows || `<tr><td colspan="${headers.length}" class="empty">${empty}</td></tr>`}</tbody></table></div>`;
}
function section(title, subtitle, content, action = '') {
  return `<section class="panel"><div class="panel-head"><div><h2>${title}</h2><p>${subtitle}</p></div>${action}</div>${content}</section>`;
}
function compactSection(title, subtitle, content, action = '') {
  return `<section class="panel p-3"><div class="panel-head mb-3"><div><h2 class="text-sm font-bold text-slate-900">${title}</h2><p class="text-xs text-gray-500">${subtitle}</p></div>${action}</div>${content}</section>`;
}
function welcome(eyebrow, title, description, action = '') {
  return `<div class="welcome"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}

function dashboard() {
  const role = effectiveRole();
  const views = {
    maahad: adminDashboard,
    guru: teacherDashboard,
    pembina: guardianDashboard,
    guru_tahfizh: teacherDashboard,
    musyrif: guardianDashboard,
    security: securityDashboard,
    parent: parentDashboard,
    student: studentDashboard,
    yayasan: executiveDashboard,
    kepsek: executiveDashboard
  };
  return (views[role] || adminDashboard)();
}

function launchPoster() {
  return `<section class="launch-poster"><div class="poster-copy"><span class="poster-kicker">SMART BOARDING SCHOOL ? MA'HAD</span><h2>Siap-Siap Peluncuran!</h2><p class="poster-subtitle">BoardingPro STKIS ? Sistem Informasi Smart Boarding</p><p class="poster-tagline">Satu ruang kendali untuk amanah pendidikan, pengasuhan, dan keuangan.</p><div class="poster-features"><span><i class="fa-solid fa-grid-2"></i> Dashboard Terpadu</span><span><i class="fa-solid fa-calendar-days"></i> Jadwal & Event Real-time</span><span><i class="fa-solid fa-bullhorn"></i> Pengumuman & Feed Harian</span><span><i class="fa-solid fa-chart-line"></i> Rekap Nilai & Kehadiran</span></div><strong>Segera Hadir untuk Memudahkan Operasional Mahad Anda!</strong></div><div class="poster-art" aria-hidden="true"><i class="fa-solid fa-layer-group"></i><span>BOARDING<br>PRO</span></div></section>`;
}

function commonDashboard(roleTitle, description, extra = '') {
  const role = roles[effectiveRole()] || roles.mahad || roles.yayasan;
  return `${welcome(roleTitle, `Ahlan Wa Sahlan, ${role.demoName.split(' ')[0]} ??`, description, '')}${launchPoster()}${extra}`;
}

function adminDashboard() {
  return commonDashboard('ADMIN MAHAD - FULL CONTROL', 'Pusat kendali operasional, akademik, pengasuhan, dan keuangan.', `${securityAlertBanner()}${managementView()}${section('Keuangan & Uang Saku', 'Verifikasi pembayaran, invoice, non-SPP maahad, dan pengeluaran.', financeView())}${section('Akademik & Tahfizh Terintegrasi', 'Rekap nilai, presensi, capaian hafalan, dan PKL.', academicView())}${section('Master Data Santri', 'Tambah, edit, dan hapus hanya tersedia untuk Admin.', studentsTable(), `<button type="button" class="btn btn-primary" data-action="add-student">${icon('plus')} Tambah Santri</button>`)}`);
}

function currentTeacherId() {
  const account = currentAccount() || {};
  return account.teacherId || state.teachers.find((teacher) => teacher.name === account.name || teacher.name === account.nama)?.id || account.id || '';
}
function teacherAssignments() {
  const id = currentTeacherId();
  const assignments = state.teachingAssignments || [];
  const own = assignments.filter((item) => !item.teacherId || item.teacherId === id || item.teacherName === (currentAccount()?.name || currentAccount()?.nama));
  return own.length ? own : assignments;
}
function teachingDashboard() {
  const assignments = teacherAssignments();
  const selected = state.teacherSelection || {};
  const options = assignments.map((item) => `<option value="${escapeHtml(item.id)}" ${selected.assignmentId === item.id ? 'selected' : ''}>${escapeHtml(item.className)} - ${escapeHtml(item.subject)}</option>`).join('');
  const assignment = assignments.find((item) => item.id === selected.assignmentId) || assignments[0];
  const assignmentId = assignment?.id || '';
  const rows = (state.kbmAttendance || []).filter((item) => item.assignmentId === assignmentId).slice(-12).reverse().map((item) => `<tr><td>${formatDate(item.date)}</td><td>${escapeHtml(studentById(item.studentId).name)}</td><td>${escapeHtml(item.status)}</td></tr>`).join('');
  const attendance = (state.kbmAttendance || []).filter((item) => item.assignmentId === assignmentId);
  const present = attendance.filter((item) => item.status === 'Hadir').length;
  const percentage = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
  const grades = (state.kbmGrades || []).filter((item) => item.assignmentId === assignmentId);
  const average = grades.length ? Math.round(grades.reduce((sum, item) => sum + Number(item.score || 0), 0) / grades.length) : 0;
  return section('KBM Kustom Guru', 'Pilih kelas/halaqah dan mata pelajaran agar presensi, jurnal, setoran, dan nilai tetap terisolasi.', `<div class="form-grid"><label>Kelas / Halaqah<select id="teacher-assignment-select">${options || '<option value="">Belum ada penugasan</option>'}</select></label><div class="metric-note">Penugasan aktif: ${assignments.length}</div></div><div class="stats-grid"><div class="stat-card"><div class="stat-label">Kehadiran Periode</div><div class="stat-value">${percentage}%</div></div><div class="stat-card"><div class="stat-label">Rata-rata Nilai</div><div class="stat-value">${average}</div></div></div><div class="actions-inline" style="margin:12px 0"><button class="btn btn-primary" data-action="add-kbm-attendance">Input Presensi</button><button class="btn btn-ghost" data-action="add-kbm-journal">Jurnal / Setoran</button><button class="btn btn-ghost" data-action="add-kbm-grade">Input Nilai</button><button class="btn btn-ghost" data-action="export-kbm-pdf">Export Rekap PDF</button></div>${table(['Tanggal', 'Santri', 'Status'], rows, 'Belum ada presensi pada penugasan ini')}`);
}

function teacherDashboard() {
  const tahfizhTeacher = hasTahfizhAccess();
  const reports = [
    ['attendance', 'Rekap Absensi / Presensi', attendanceTable()],
    ['grades', 'Rekap Nilai / Akademik', gradeTable()],
    ['tahfizh', 'Laporan Tahfizh', tahfizhTable(), tahfizhTeacher ? `<button type="button" class="btn btn-primary" data-action="add-tahfizh">${icon('plus')} Input Tahfizh</button>` : '<p class="notice">Akses input Tahfizh hanya tersedia untuk Guru/Ustadz yang bertugas pada Tahfizh.</p>'],
    ['tahfizh-attendance', 'Absensi Jam Tahfizh', attendanceTable('tahfizh'), tahfizhTeacher ? `<button type="button" class="btn btn-primary" data-action="add-tahfizh-attendance">${icon('plus')} Input Absensi Tahfizh</button>` : ''],
    ['notes', 'Catatan Perkembangan Santri', groupedActiveStudentRecords(state.points, (item) => `<div class="accordion-record"><b>${escapeHtml(studentById(item.studentId).name)}</b><span>${escapeHtml(item.note || 'Catatan perkembangan')}</span><small>${formatDate(item.date)}</small></div>`, 'Belum ada catatan perkembangan santri.')]
  ];
  const tabs = reports.map(([id, label], index) => `<button type="button" class="btn ${index === 0 ? 'btn-primary' : 'btn-ghost'}" data-report-tab="${id}">${label}</button>`).join('');
  const panels = reports.map(([id, label, content, actions = ''], index) => `<section class="panel teacher-report-panel" data-report-panel="${id}" ${index ? 'hidden' : ''}><div class="panel-head"><div><h2>${label}</h2><p>Reguler SMK Kelas 10, 11, 12, PPTAK, dan KWNQ</p></div>${actions}</div>${content}</section>`).join('');
  return commonDashboard('GURU / USTADZ - AKADEMIK', 'Kelola presensi mandiri dan perkembangan santri di kelas yang diampu.', `${teachingDashboard()}${teacherPersonalAttendanceView()}${section('Laporan Santri', 'Pilih modul laporan yang ingin ditinjau.', `<div class="actions-inline" style="margin-bottom:16px">${tabs}</div>${panels}`)}`);
}

function guardianDashboard() {
  return commonDashboard('PEMBINA ? PENGASUHAN & TAHFIZH', 'Pantau aktivitas asrama, kedisiplinan, dan setoran hafalan santri.', `${pembinaView()}${section('Jadwal & Event', 'Agenda boarding school untuk seluruh role.', `${activityTimeline()}${eventsTable()}`)}`);
}

function securityDashboard() {
  return commonDashboard('SECURITY ? POS JAGA', 'Pantau izin yang telah disetujui dan aktivitas keluar-masuk gerbang.', `${securityQuickActions()}${gateView()}${section('Feed Aktivitas Santri', 'Pembaruan kegiatan terbaru.', activityList())}`);
}
function securityQuickActions() {
  return `<div class="actions-inline" style="margin-bottom:18px"><button class="btn btn-primary" data-action="add-incident">${icon('siren')} Buat Laporan Darurat</button><button class="btn btn-ghost" data-action="add-lost-found">${icon('package-search')} Laporan Penemuan / Kehilangan Barang</button></div>`;
}
function securityReportsView() {
  const incidentRows = state.incidents.map((item) => `<tr><td><b>${escapeHtml(item.type)}</b><small>${escapeHtml(item.location)}</small></td><td>${statusBadge(item.level)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.status || 'Baru')}</td><td>${canManageSecurity() ? `<button class="btn btn-small btn-primary" data-security-status="incident:${item.id}">Tindak Lanjuti</button>` : '?'}</td></tr>`).join('');
  const lostRows = state.lostFound.map((item) => `<tr><td><b>${escapeHtml(item.itemName)}</b><small>${escapeHtml(item.photoDescription)}</small></td><td>${escapeHtml(item.location)}</td><td>${formatDate(item.dateTime?.slice(0, 10) || today)}</td><td>${escapeHtml(item.status)}</td><td>${canManageSecurity() ? `<button class="btn btn-small btn-primary" data-security-status="lost:${item.id}">Konfirmasi</button>` : '?'}</td></tr>`).join('');
  return `${welcome('LAPORAN KEAMANAN & POS JAGA', 'Monitoring Laporan Security', 'Tinjau, konfirmasi, dan tindak lanjuti laporan darurat serta barang temuan.', '')}<div class="stats-grid">${statCard('Darurat Aktif', state.incidents.filter((item) => item.status !== 'Selesai').length, 'Perlu respons', 'siren', 'orange')}${statCard('Barang Temuan', state.lostFound.length, 'Laporan masuk', 'package-search', 'blue')}</div>${section('Laporan Darurat', 'Laporan kejadian dari Security/Pos Jaga.', table(['Kejadian & Lokasi', 'Bahaya', 'Deskripsi', 'Status', 'Aksi'], incidentRows, 'Belum ada laporan darurat'))}${section('Penemuan / Kehilangan Barang', 'Pencatatan dan serah terima barang.', table(['Barang', 'Lokasi', 'Waktu', 'Status', 'Aksi'], lostRows, 'Belum ada laporan barang'))}`;
}
function scheduleView() {
  const canEdit = canManageSchool();
  const actions = canEdit ? `<div class="actions-inline"><button class="btn btn-primary" data-action="add-schedule">${icon('plus')} Tambah Jadwal</button><button class="btn btn-ghost" data-action="add-event">${icon('plus')} Tambah Event Mendatang</button></div>` : '';
  return `${welcome('JADWAL & AGENDA', 'Jadwal Harian dan Event Mendatang', 'Agenda kegiatan yang diperbarui realtime.', actions)}${section('Jadwal Harian', 'Kegiatan, lokasi, dan penanggung jawab.', activityTimeline())}${section('Event Mendatang', 'Agenda resmi sekolah dan mahad.', eventsTable())}`;
}

function parentDashboard() {
  return commonDashboard('ORANG TUA / WALI ? PORTAL PERSONAL', 'Ringkasan personal anak, akademik, tahfizh, dan keuangan.', `${parentView()}${section('Keuangan Anak', 'Tagihan, pembayaran, invoice, dan uang saku milik anak.', financeView())}`);
}

function studentDashboard() {
  const student = currentStudent();
  return commonDashboard('SANTRI ? PORTAL PERSONAL', 'Jadwal, nilai, tahfizh, dan pengumuman untuk santri.', `${section('Profil & Progress Saya', `${student.className} ? ${student.program}`, `${tahfizhTable(student.id)}${gradeTable(student.id)}`)}${section('Jadwal & Event', 'Agenda harian dan kegiatan mahad.', `${activityTimeline()}${eventsTable()}`)}`);
}

function executiveDashboard() {
  const title = state.role === 'kepsek' ? 'KEPALA SEKOLAH ? EXECUTIVE READ-ONLY' : 'YAYASAN ? EXECUTIVE READ-ONLY';
  return commonDashboard(title, 'Ringkasan keuangan lembaga, akademik, dan tahfizh.', `${securityAlertBanner()}${yayasanDashboard()}`);
}

function unifiedDashboard() {
  const role = roles[state.role] || roles.yayasan;
  const student = currentStudent();
  const verified = state.payments.filter((payment) => payment.status === 'Verified').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pending = state.payments.filter((payment) => payment.status === 'Pending').length;
  const feed = state.dailyFeed.slice(0, 4);
  const announcements = state.announcements.slice(0, 4);
  const balance = state.pocketBalances.find((item) => item.studentId === student.id)?.balance || 0;
  const transactions = state.pocketTransactions.filter((item) => item.studentId === student.id).slice(0, 4);
  const stats = canViewFinance()
    ? `${statCard('Total Santri', state.students.length, '+8,2% tahun ini', 'users', 'blue')}${statCard('Kehadiran Rata-rata', '94,8%', '+2,4% bulan ini', 'calendar-check', 'green')}${statCard('Penerimaan Terverifikasi', money(verified), '92,4% target', 'wallet-cards', 'purple')}${statCard('Perlu Verifikasi', pending, 'Pembayaran masuk', 'badge-alert', 'orange')}`
    : `${statCard('Total Santri', state.students.length, 'Data aktif', 'users', 'blue')}${statCard('Kehadiran Rata-rata', '94,8%', '+2,4% bulan ini', 'calendar-check', 'green')}${statCard('Setoran Tahfizh', state.tahfizh.length, 'Rekaman terbaru', 'book-open-check', 'purple')}${statCard('Agenda Hari Ini', state.schedules.length, 'Kegiatan terjadwal', 'calendar-days', 'orange')}`;
  const announcementRows = announcements.map((item) => `<div class="activity"><span class="activity-icon green">${icon('megaphone')}</span><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.detail)}</p></div><time>${formatDate(item.date)}</time></div>`).join('');
  const pocketSection = canViewFinance() ? section('Uang Saku Santri', 'Saldo dan mutasi sesuai hak akses role', `<div class="finance-grid"><div class="finance-tile"><span>Saldo ${escapeHtml(student.name)}</span><b>${money(balance)}</b></div><div class="finance-tile"><span>Top up bulan ini</span><b>${money(transactions.filter((item) => item.type === 'Top Up').reduce((sum, item) => sum + Number(item.amount || 0), 0))}</b></div><div class="finance-tile"><span>Transaksi terbaru</span><b>${transactions.length}</b></div></div>${table(['Tanggal','Jenis','Nominal','Catatan'], transactions.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${item.type}</td><td>${money(item.amount)}</td><td>${escapeHtml(item.note)}</td></tr>`).join(''), 'Belum ada mutasi uang saku')}`) : '';
  const financeSection = canViewFinance() ? section('Keuangan & Invoice', 'SPP, non-SPP, beasiswa, laundry, dan dokumen pembayaran', `${billingTable(4)}<div class="actions-inline"><button type="button" class="btn btn-ghost btn-small" data-view="finance">Buka pusat keuangan</button></div>`) : '';
  return `${welcome(`BOARDINGPRO STK IS ? ${role.label.toUpperCase()}`, `Assalamu'alaikum, ${role.demoName.split(' ')[0]} ??`, 'Satu ruang kendali untuk menjaga amanah.', canManageAnnouncements() ? `<button class="btn btn-primary" data-action="add-announcement">${icon('plus')} Pengumuman</button>` : '')}
    <div class="stats-grid">${stats}</div>
    <div class="grid-2">${section('Pengumuman & Feed Harian', 'Kabar terbaru mahad dan perkembangan santri', `<div class="activity-list">${announcementRows || '<div class="empty">Belum ada pengumuman.</div>'}${feed.map((item) => `<div class="activity"><span class="activity-icon green">${icon(item.type === 'tahfizh' ? 'book-open-check' : 'bell')}</span><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.detail)}</p></div><time>${formatDate(item.date)}</time></div>`).join('')}</div>`, `<button class="btn btn-ghost btn-small" data-view="announcements">Lihat semua</button>`)}
      ${section('Jadwal & Event', 'Agenda kegiatan boarding school', `${activityTimeline()}<div class="panel-head" style="margin-top:15px"><div><h2>Event mendatang</h2><p>Agenda resmi sekolah</p></div><button class="btn btn-ghost btn-small" data-view="schedule">Buka agenda</button></div>${eventsTable()}`)}</div>
    ${pocketSection}
    <div class="grid-2">${financeSection}${section('Tahfizh & Academic', 'Capaian hafalan dan hasil belajar terbaru', `${tahfizhTable()}${gradeTable()}<div class="actions-inline"><button type="button" class="btn btn-ghost btn-small" data-view="academic">Lihat rekap akademik</button></div>`)}</div>
    ${section('PKL ? Praktik Kerja Lapangan', 'Monitoring eligibility, penempatan, progress, dan pembimbing', `${pklTable()}<div class="actions-inline"><button class="btn btn-ghost btn-small" data-view="pkl">Buka modul PKL</button></div>`)}`;
}

function yayasanDashboard() {
  const verified = state.payments.filter((payment) => payment.status === 'Verified').reduce((sum, payment) => sum + payment.amount, 0);
  const pending = state.payments.filter((payment) => payment.status === 'Pending').length;
  return `${welcome('EXECUTIVE OVERVIEW ? SABTU, 05 SEPTEMBER 2026', "Assalamu'alaikum, Pengelola ??", 'Ringkasan kinerja dan kesehatan keuangan BoardingPro STK IS.', `<button class="btn btn-primary" data-action="export">${icon('download')} Export Laporan</button>`)}
    <div class="stats-grid">${statCard('Total Santri', state.students.length, '+8.2% tahun ini', 'users', 'blue')}${statCard('Kehadiran Rata-rata', '94,8%', '+2.4% bulan ini', 'calendar-check', 'green')}${statCard('Penerimaan Terverifikasi', money(verified), '92,4% target', 'wallet-cards', 'purple')}${statCard('Perlu Verifikasi', pending, 'Pembayaran masuk', 'badge-alert', 'orange')}</div>
    <div class="finance-grid"><div class="finance-tile"><span>SPP bulanan</span><b>${money(verified * .72)}</b><div class="metric-note">78% dari penerimaan</div></div><div class="finance-tile"><span>Dana Yayasan</span><b>${money(verified * .12)}</b><div class="metric-note">Operasional & beasiswa</div></div><div class="finance-tile"><span>Non-SPP & uang saku</span><b>${money(verified * .16)}</b><div class="metric-note">Asrama, makan, saku</div></div></div>
    <div class="grid-2">${section('Rekapitulasi Penerimaan Kas per Program', 'Laporan kas masuk dan penerimaan terverifikasi', financeProgramTable())}${section('Aktivitas Terbaru', 'Pembaruan data secara real-time', activityList())}</div>
    ${section('Monitoring Yayasan ? Tahfizh', 'Program ? kelas ? santri dengan target dan capaian', yayasanAccordion())}`;
}
function yayasanAccordion() {
  return `<div class="accordion">${programs.map((program, programIndex) => {
    const classes = state.classes.filter((item) => item.programId === program.id);
    return `<details class="accordion-item" ${programIndex === 0 ? 'open' : ''}><summary><span><b>${program.name}</b><small>${program.description}</small></span><span class="badge badge-neutral">${classes.length} kelas</span></summary><div class="accordion-body">${classes.map((klass) => {
      const progress = state.yayasanProgress.find((item) => item.classId === klass.id) || {};
      const students = state.students.filter((student) => student.className === klass.name);
      const pct = Math.min(100, Math.round((Number(progress.achievementJuz || 0) / Math.max(1, Number(progress.targetJuz || 1))) * 100));
      return `<details class="accordion-class"><summary><span><b>${klass.name}</b><small>Wali: ${klass.wali || '?'} ? ${students.length} santri</small></span><span class="progress-label">${pct}%</span></summary><div class="accordion-body"><div class="progress"><span style="width:${pct}%"></span></div>${table(['Santri', 'Target (Juz / Surah / Ayat)', 'Capaian (Juz / Surah / Ayat)', 'Mutqin', 'Progress'], students.map((student) => {
        const record = state.yayasanProgress.find((item) => item.classId === klass.id) || progress;
        const studentPct = Math.min(100, Math.round((Number(student.tahfizh || record.achievementJuz || 0) / Math.max(1, Number(record.targetJuz || 1))) * 100));
        return `<tr><td><b>${student.name}</b><small>${student.nis}</small></td><td>Juz ${record.targetJuz || 0} ? ${record.targetSurah || '?'} ? ${record.targetAyat || '?'}</td><td>Juz ${record.achievementJuz || student.tahfizh || 0} ? ${record.achievementSurah || '?'} ? ${record.achievementAyat || '?'}</td><td>${statusBadge(record.mutqin || 'Belum dinilai')}</td><td><div class="progress"><span style="width:${studentPct}%"></span></div><small>${studentPct}%</small></td></tr>`;
      }).join(''), 'Belum ada santri pada kelas ini')}</div></details>`;
    }).join('')}</div></details>`;
  }).join('')}</div>`;
}
function financeProgramTable() {
  return table(['Program', 'Santri', 'SPP', 'Non-SPP', 'Total'], programs.map((program) => {
    const members = state.students.filter((student) => student.program === program.id);
    const total = state.payments.filter((payment) => payment.status === 'Verified' && members.some((student) => student.id === payment.studentId)).reduce((sum, payment) => sum + payment.amount, 0);
    return `<tr><td><b>${program.name}</b><small>${program.description}</small></td><td>${members.length}</td><td>${money(total * .72)}</td><td>${money(total * .28)}</td><td><b>${money(total)}</b></td></tr>`;
  }).join(''));
}
function activityList() {
  return `<div class="activity-list">${state.points.slice(0, 4).map((point) => `<div class="activity"><span class="activity-icon ${point.kind === 'prestasi' ? 'green' : 'red'}">${icon(point.kind === 'prestasi' ? 'award' : 'alert-triangle')}</span><div><b>${studentById(point.studentId).name}</b><p>${point.note}</p></div><time>${formatDate(point.date)}</time></div>`).join('')}</div>`;
}
function managementView() {
  const pendingPayments = state.payments.filter((payment) => payment.status === 'Pending').length;
  return `${welcome('PUSAT KENDALI PENGASUHAN', 'Selamat datang, Admin ??', 'Kelola santri, tagihan, dan laporan mahad.', currentRoleIsAdmin() ? `<button class="btn btn-primary" data-action="add-student">${icon('plus')} Tambah Santri</button>` : '')}
    <div class="stats-grid">${statCard('Total Santri', state.students.length, '+3 bulan ini', 'users')}${statCard('Pembayaran Menunggu', pendingPayments, 'Perlu verifikasi', 'clock-3', 'orange')}${statCard('Notifikasi Tagihan', state.billingNotifications.filter((bill) => !bill.read).length, 'Belum dibaca', 'bell', 'purple')}</div>
    <div class="grid-2">${section('Perizinan Terbaru', 'Tinjau pengajuan yang masuk hari ini', permitTable(true))}${section('Notifikasi Billing', 'Tindak lanjut wali santri', billingTable(3))}</div>${section('Keamanan Akun', 'Perbarui kredensial akun Anda.', selfPasswordForm())}`;
}
function academicView() {
  const canEdit = ['mahad', 'admin', 'kepsek', 'guru'].includes(effectiveRole());
  return `${welcome('AKADEMIK & TAHFIZH TERINTEGRASI', 'Rekap pembelajaran & hafalan ??', 'Nilai akademik dan capaian tahfizh santri dalam satu laporan.', canEdit ? `<button type="button" class="btn btn-primary" data-action="add-grade">${icon('plus')} Input Nilai</button>` : '')}
    <div class="stats-grid">${statCard('Rata-rata Nilai', '86,4', '+3.2%', 'chart-no-axes-combined', 'blue')}${statCard('Kehadiran Kelas', '96,1%', '+1.8%', 'calendar-check', 'green')}${statCard('Peserta PKL', state.pklReports.length, 'SMK aktif', 'briefcase-business', 'purple')}${statCard('Catatan Aktif', '12', 'Minggu ini', 'notebook-pen', 'orange')}</div>
    ${section('Rekap Terintegrasi Santri', 'Akademik formal dan target/capaian tahfizh', integratedAcademicTable())}
    <div class="grid-2">${section('Rekap Nilai Terbaru', 'Input guru dan hasil belajar', gradeTable())}${section('Rekap PKL', 'Monitoring peserta praktik', pklTable())}</div>`;
}
function integratedAcademicTable() {
  return table(['Santri / Program', 'Nilai Rata-rata', 'Target Tahfizh', 'Capaian', 'Mutqin', 'Progress', 'Catatan Bulanan'], state.students.map((student) => {
    const grades = state.grades.filter((item) => item.studentId === student.id);
    const average = grades.length ? Math.round(grades.reduce((sum, item) => sum + Number(item.score || 0), 0) / grades.length) : 0;
    const records = state.tahfizh.filter((item) => item.studentId === student.id);
    const latest = records[0] || {};
    const target = Number(student.tahfizhTarget || 30);
    const achieved = Number(student.tahfizh || latest.juz || 0);
    const progress = Math.min(100, Math.round(achieved / Math.max(1, target) * 100));
    const summary = state.monthlySummaries.find((item) => item.studentId === student.id && item.month === 'September 2026');
    return `<tr><td><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.program)} ? ${escapeHtml(student.className)}</small></td><td>${average || '?'}</td><td>Juz ${target}</td><td>Juz ${achieved}<small>${escapeHtml(latest.surah || 'Belum ada setoran')}</small></td><td>${statusBadge(latest.mutqin || (latest.status === 'Verified' ? 'Mutqin' : 'Belum dinilai'))}</td><td><div class="progress"><span style="width:${progress}%"></span></div><small>${progress}%</small></td><td>${escapeHtml(summary?.note || summary?.notes || 'Belum ada catatan')}</td></tr>`;
  }).join(''), 'Belum ada data akademik');
}
function teacherPersonalAttendanceView() {
  const teacherName = state.displayName || roles.guru.demoName;
  const records = state.teacherAttendance.filter((item) => item.teacher === teacherName);
  const form = `<form id="teacher-attendance-form" class="form-grid"><label>Status<select name="status"><option>Hadir</option><option>Izin</option><option>Sakit</option><option>Alpa</option></select></label><label>Jam Masuk<input name="checkIn" type="time"></label><label>Jam Pulang<input name="checkOut" type="time"></label><button type="submit" class="btn btn-primary full">Simpan Presensi Pribadi</button></form>`;
  const report = table(['Tanggal', 'Masuk', 'Pulang', 'Status'], records.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${item.checkIn || '?'}</td><td>${item.checkOut || '?'}</td><td>${statusBadge(item.status)}</td></tr>`).join(''), 'Belum ada riwayat presensi');
  return `${section('Presensi Harian Guru Mandiri', 'Hanya data presensi akun Anda yang ditampilkan.', form)}${section('Riwayat Presensi Pribadi', 'Riwayat check-in dan check-out Anda.', report)}`;
}
function teacherAttendanceRecords() {
  return (state.teacherTeachingRecords || []).filter((item) => item.date.startsWith('2026-09'));
}
function teacherAttendanceSummary() {
  const records = teacherAttendanceRecords();
  const teachers = [...new Set(records.map((item) => item.teacher))];
  const days = records.length;
  const present = records.filter((item) => item.status === 'Hadir').length;
  return {
    totalHours: records.reduce((sum, item) => sum + Number(item.hours || 0), 0),
    attendance: days ? Math.round((present / days) * 100) : 0,
    leave: records.filter((item) => ['Izin', 'Sakit'].includes(item.status)).length,
    teachers
  };
}
function teacherAttendanceTable() {
  const records = teacherAttendanceRecords();
  const teachers = [...new Set(records.map((item) => item.teacher))];
  const rows = teachers.map((teacher) => {
    const items = records.filter((item) => item.teacher === teacher);
    const present = items.filter((item) => item.status === 'Hadir').length;
    const leave = items.filter((item) => ['Izin', 'Sakit'].includes(item.status)).length;
    const hours = items.reduce((sum, item) => sum + Number(item.hours || 0), 0);
    const subject = items[0]?.subject || '?';
    return `<tr><td><b>${escapeHtml(teacher)}</b></td><td>${escapeHtml(subject)}</td><td>${present} hari</td><td>${leave} hari</td><td>${hours} jam</td><td><button type="button" class="btn btn-small btn-primary" data-teacher-detail="${escapeHtml(teacher)}">Lihat Detail</button></td></tr>`;
  }).join('');
  return table(['Nama Guru/Ustadz', 'Mata Pelajaran', 'Total Kehadiran (Hari)', 'Total Izin/Sakit', 'Total Jam Mengajar (Bulan Ini)', 'Aksi'], rows, 'Belum ada rekap presensi guru');
}
function teacherAttendanceAdminView() {
  const summary = teacherAttendanceSummary();
  return `${welcome('REKAP PRESENSI GURU / USTADZ', 'Kehadiran & Jam Mengajar', 'Ringkasan bulan September 2026 untuk monitoring pimpinan dan admin.', '')}
    <div class="stats-grid">${statCard('Total Jam Mengajar', `${summary.totalHours} jam`, 'Akumulasi bulan ini', 'clock-3', 'blue')}${statCard('Persentase Kehadiran', `${summary.attendance}%`, 'Dari seluruh hari mengajar', 'calendar-check', 'green')}${statCard('Total Izin / Sakit', summary.leave, 'Tidak termasuk alpa', 'file-warning', 'orange')}${statCard('Guru Terdata', summary.teachers.length, 'Dalam rekap bulan ini', 'users', 'purple')}</div>
    ${section('Rekap Utama Guru/Ustadz', 'Klik Lihat Detail untuk histori harian dan materi KBM.', teacherAttendanceTable())}`;
}
function openTeacherAttendanceDetail(teacherName) {
  const records = teacherAttendanceRecords().filter((item) => item.teacher === teacherName);
  const subject = records[0]?.subject || '?';
  const rows = records.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${new Date(`${item.date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long' })}</td><td>${statusBadge(item.status)}</td><td>${Number(item.hours || 0)} jam</td><td>${escapeHtml(item.note || '?')}</td></tr>`).join('');
  openModal(`Detail Presensi ? ${teacherName}`, `<p class="metric-note">Mata Pelajaran: ${escapeHtml(subject)} ? September 2026</p>${table(['Tanggal', 'Hari', 'Status', 'Jam Mengajar', 'Catatan Materi KBM'], rows, 'Belum ada histori harian')}`);
}
function pembinaView() {
  return `${welcome('PENGAWASAN ASRAMA & TAHFIZH', 'Dashboard Pembina 🛡️', 'Pantau kedisiplinan, presensi jamaah, dan hafalan santri binaan.', canManageDormitory() ? `<button class="btn btn-primary" data-action="add-point">${icon('plus')} Input Poin</button><button class="btn btn-primary" data-action="add-tahfizh-attendance">${icon('plus')} Absensi Tahfizh</button>` : '')}
    <div class="stats-grid">${statCard('Presensi Jamaah', '93,6%', '+2.1%', 'mosque', 'green')}${statCard('Setoran Menunggu', state.tahfizh.filter((item) => item.status === 'Menunggu').length, 'Perlu verifikasi', 'book-open-check', 'orange')}${statCard('Poin Hari Ini', '+25', '+14.6%', 'award', 'purple')}</div>
    <div class="grid-2">${section('Setoran Terbaru', 'Verifikasi capaian hafalan', tahfizhTable())}${section('Izin Menunggu', 'Persetujuan pengajuan outing', permitTable(true))}</div>`;
}
function parentView() {
  const child = currentStudent();
  const summary = state.monthlySummaries.find((item) => item.studentId === child.id && item.month === 'September 2026') || { attendance: child.attendance, tahfizh: child.tahfizh, points: child.points, paid: 0, outstanding: 0 };
  const feed = state.dailyFeed.filter((item) => item.date === today && (!item.studentId || item.studentId === child.id)).slice(0, 5);
  const balance = state.pocketBalances.find((item) => item.studentId === child.id)?.balance || 0;
  const transactions = state.pocketTransactions.filter((item) => item.studentId === child.id && item.date === today).slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const compactSummary = `<div class="grid grid-cols-3 gap-3">${[['Kehadiran', `${summary.attendance}%`], ['Hafalan Baru', `${summary.tahfizh} Juz`], ['Poin', `${summary.points > 0 ? '+' : ''}${summary.points}`]].map(([label, value]) => `<div class="p-3 rounded-lg border border-emerald-100 bg-white shadow-sm"><span class="text-xs text-slate-500">${label}</span><b class="block text-base font-bold text-emerald-900">${value}</b></div>`).join('')}</div><div class="flex flex-wrap gap-2 mt-3 text-xs"><span class="badge badge-success">Sudah dibayar ${money(summary.paid)}</span><span class="badge badge-warning">Sisa tagihan ${money(summary.outstanding)}</span></div>`;
  const pocketTable = `<div style="max-height:350px;overflow-y:auto;overflow-x:auto"><table class="w-full table-auto text-xs" style="white-space:nowrap"><thead><tr><th class="py-2 px-2">Waktu</th><th class="py-2 px-2">Jenis</th><th class="py-2 px-2">Nominal</th><th class="py-2 px-2">Catatan</th></tr></thead><tbody>${transactions.map((item) => `<tr><td class="py-2 px-2">${formatDate(item.date)}</td><td class="py-2 px-2">${item.type}</td><td class="py-2 px-2">${money(item.amount)}</td><td class="py-2 px-2">${escapeHtml(item.note)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Belum ada transaksi hari ini</td></tr>'}</tbody></table></div>`;
  return `<div class="child-hero"><div class="avatar xl">${initials(child.name)}</div><div><span class="eyebrow">PORTAL ORANG TUA / WALI</span><h1>${child.name}</h1><p>${child.className} ? ${child.room} ? ${child.program} ? NIS ${child.nis}</p></div><span class="badge badge-success">Santri Aktif</span></div>
    <div class="stats-grid">${statCard('Progress Tahfizh', `${child.tahfizh} Juz`, '+1 juz semester ini', 'book-open-check', 'green')}${statCard('Poin Kedisiplinan', `+${child.points}`, '+4 bulan ini', 'award', 'purple')}${statCard('Kehadiran', `${child.attendance}%`, 'Sangat baik', 'calendar-check', 'blue')}${statCard('Status SPP', child.spp, 'September 2026', 'wallet-cards', 'orange')}</div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">${section(`Pengumuman ? ${formatDate(today)}`, 'Informasi kegiatan dan perkembangan anak', `<div class="h-full flex flex-col justify-between p-5">${feed.length ? `<div class="activity-list">${feed.map((item) => `<div class="activity"><span class="activity-icon green">${icon(item.type === 'tahfizh' ? 'book-open-check' : 'bell')}</span><div><b>${item.title}</b><p>${item.detail}</p></div><time>${formatDate(item.date)}</time></div>`).join('')}</div>` : '<div class="empty">Belum ada pengumuman hari ini.</div>'}</div>`)}${section('Uang Saku Hari Ini', 'Saldo dan mutasi transaksi anak', `<div class="h-full flex flex-col justify-between p-5"style="max-height: 250px; overflow-y: auto; overflow-x: auto; white-space: nowrap;"><div class="finance-tile"><span>Saldo saat ini</span><b>${money(balance)}</b></div>${pocketTable}</div>`)}</div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">${section('Ringkasan Bulanan', summary.month || 'September 2026', compactSummary)}${section('Setoran Hafalan Terakhir', 'Riwayat capaian tahfizh', `<div style="max-height:350px;overflow-y:auto;overflow-x:auto">${tahfizhTable(child.id)}</div><h3 style="margin-top:16px">Presensi Jam Tahfizh</h3><div style="max-height:350px;overflow-y:auto;overflow-x:auto">${attendanceTable('tahfizh')}</div>`)}</div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">${section('Riwayat Poin', 'Perkembangan karakter', `<div style="max-height:350px;overflow-y:auto;overflow-x:auto">${pointsTable(child.id)}</div>`)}${compactSection('Tagihan & Kuitansi', 'Rincian pembayaran santri', `<div style="max-height:350px;overflow-y:auto;overflow-x:auto">${renderWaliInvoices(child.nis)}</div>`)}</div>`;
}
function studentView() {
  const student = currentStudent();
  return `${welcome('PORTAL SANTRI ? PERSONAL DASHBOARD', `Assalamu'alaikum, ${student.name.split(' ')[0]}! ??`, 'Semangat menjalani aktivitas hari ini.', '')}
    <div class="stats-grid">${statCard('Total Poin Saya', `${student.points > 0 ? '+' : ''}${student.points}`, '+4 minggu ini', 'award', 'purple')}${statCard('Hafalan', `${student.tahfizh} Juz`, 'Terus bertumbuh', 'book-open-check', 'green')}${statCard('Kehadiran', `${student.attendance}%`, 'Bulan ini', 'calendar-check', 'blue')}${statCard('Program', student.program, student.className, 'graduation-cap', 'orange')}</div>
    <div class="grid-2">${section('Jadwal Kegiatan Hari Ini', 'Jaga semangat dan kedisiplinan', activityTimeline())}${section('Status PKL', isPklEligible(student) ? 'Modul aktif untuk semester ini' : 'Modul belum dibuka', pklSummary(student))}</div>
    ${section('Tahfizh Saya', 'Ziyadah, Murajaah, catatan, dan presensi jam Tahfizh pribadi', `<div style="max-height:350px;overflow-y:auto;overflow-x:auto">${tahfizhTable(student.id)}${attendanceTable('tahfizh')}</div>`)}`;
}
function pklSummary(student) {
  if (!isPklEligible(student)) return `<div class="locked-card">${icon('lock', 25)}<p>Modul PKL aktif untuk siswa SMK kelas 11 semester 2 atau kelas 12 semester 1.</p><button class="btn btn-ghost" data-view="pkl">Lihat status modul</button></div>`;
  const report = state.pklReports.find((item) => item.studentId === student.id);
  return report ? `<div><div class="notice"><span class="status-dot"></span>${report.status} ? ${report.company}</div><p class="metric-note">Progress laporan ${report.progress}% ? Kehadiran ${report.attendance}%</p><button class="btn btn-ghost" data-view="pkl">Buka modul PKL ${icon('arrow-right')}</button></div>` : '<div class="empty">Belum ada penempatan PKL.</div>';
}
function gateView() {
  const active = state.permits.filter((permit) => permit.status === 'Approved' && permit.date === today && permit.checkout && !permit.checkin).length;
  const requestForm = effectiveRole() === 'security' && canManageSecurity() ? `<form id="security-permit-form" class="form-grid"><label>Santri<select name="studentId">${state.students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)} ? ${escapeHtml(student.nis)}</option>`).join('')}</select></label><label>Jenis Izin<select name="type"><option value="Keluar Kompleks">Keluar Kompleks</option><option value="Pulang / Mudik">Pulang / Mudik</option></select></label><label>Tanggal<input name="date" type="date" value="${today}" required></label><label class="full">Alasan<textarea name="reason" required></textarea></label><button type="submit" class="btn btn-primary full">Catat Pengajuan di Pos</button></form>` : '';
  return `${welcome(`POS JAGA UTAMA - ${today}`, 'Kontrol Gerbang 🚪', 'Catat pergerakan santri secara realtime dan aman.')}
    <div class="stats-grid">${statCard('Sedang di Luar', active, 'Aktif di luar', 'log-out', 'blue')}${statCard('Total Checkout', state.permits.filter((permit) => permit.checkout && permit.date === today).length, 'Hari ini', 'scan-line', 'green')}${statCard('Izin Pending', state.permits.filter((permit) => permit.status === 'Pending').length, 'Hubungi pembina', 'alarm-clock', 'orange')}</div>
    ${requestForm ? section('Pengajuan Izin di Pos', 'Security mencatat pengajuan; persetujuan dilakukan pihak berwenang.', requestForm) : ''}${section('Log Keluar-Masuk', 'Hanya izin yang telah disetujui pihak berwenang', gateTable())}${section('Aktivitas Realtime', 'Perubahan terakhir di pos jaga', gateEventsTable())}`;
}

function permitTable(actions = false) {
  const canApprove = currentRoleIsAdmin() || ['pembina', 'musyrif', 'kepsek'].includes(effectiveRole()) || (effectiveRole() === 'guru' && currentAccount()?.isMusyrif === true);
  const visiblePermits = ['parent', 'student'].includes(effectiveRole()) ? state.permits.filter((permit) => permit.studentId === currentStudent().id) : state.permits;
  const rows = visiblePermits.slice(0, 8).map((permit) => {
    const approved = ['approved', 'terverifikasi'].includes(String(permit.status).toLowerCase());
    const letter = approved ? `<button type="button" class="btn btn-small btn-ghost" data-permit-letter="${permit.id}">Lihat Surat</button>` : '';
    const quotaNote = isQuotaDeducted(permit) ? `Kuota minggu ini: ${weeklyQuotaUsed(permit.studentId, permit.date)}/${QUOTA_LIMIT}` : 'Tidak memotong kuota';
    const approval = actions && canApprove ? `<td>${permit.status === 'Pending' ? `<button type="button" class="icon-btn approve" title="${escapeHtml(quotaNote)}" data-permit="${permit.id}" data-status="Approved">${icon('check', 16)}</button><button type="button" class="icon-btn reject" data-permit="${permit.id}" data-status="Rejected">${icon('x', 16)}</button>` : letter}</td>` : `<td>${letter}</td>`;
    return `<tr><td><div class="person"><span class="avatar">${initials(studentById(permit.studentId).name)}</span><b>${studentById(permit.studentId).name}</b></div></td><td>${escapeHtml(permit.kategori_izin || permit.type)}</td><td>${formatDate(permit.date)}${permit.endDate ? ` s.d. ${formatDate(permit.endDate)}` : ''}</td><td>${escapeHtml(permit.reason)}<small>${escapeHtml(permit.rejectionReason || quotaNote)}</small></td><td>${statusBadge(permit.status)}<small>${permit.approvedDays || permit.requestedDays || 1} hari</small></td>${approval}</tr>`;
  }).join('');
  return table(['Santri', 'Jenis', 'Tanggal', 'Alasan', 'Status', 'Surat / Aksi'], rows);
}
function permitGroupClass(student) {
  return ['PPTAK', 'KWNQ'].includes(student.program) ? 'Non-Jenjang' : [10, 11, 12].includes(Number(student.grade)) ? `Kelas ${Number(student.grade)}` : 'Kelas ?';
}
function groupedDetails(title, groups, renderItems, personal = false) {
  return `<div class="accordion-groups">${Object.entries(groups).map(([group, items]) => `<details class="accordion-group" ${personal ? 'open' : ''}><summary><span>${escapeHtml(group)}</span><small>${items.length} santri</small></summary><div class="accordion-content">${renderItems(items)}</div></details>`).join('')}</div>`;
}
function groupedStudentRecords(records, renderItem) {
  const visible = ['parent', 'student'].includes(effectiveRole()) ? records.filter((item) => item.studentId === currentStudent().id) : records;
  const groups = {};
  visible.filter((record) => isActiveStudent(studentById(record.studentId))).forEach((record) => {
    const student = studentById(record.studentId);
    const program = student.program === 'PPTAK' ? 'Program PPTAK (1 Tahun)' : student.program === 'KWNQ' ? 'Program KWNQ (3 Bulan)' : student.program || 'Reguler SMK';
    const key = `${program} ? ${permitGroupClass(student)}`;
    (groups[key] ||= []).push(record);
  });
  return groupedActiveStudentRecords(visible, renderItem, 'Belum ada rekap nilai untuk kelas ini.');
}
function pointsTable(id) {
  const data = state.points.filter((point) => !id || point.studentId === id).slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return table(['Santri', 'Catatan', 'Jenis', 'Poin', 'Tanggal'], data.map((point) => `<tr><td>${studentById(point.studentId).name}</td><td>${point.note}</td><td>${point.kind === 'prestasi' ? '<span class="text-green">Prestasi</span>' : '<span class="text-red">Pelanggaran</span>'}</td><td><b>${point.value > 0 ? '+' : ''}${point.value}</b></td><td>${formatDate(point.date)}</td></tr>`).join(''));
}
function tahfizhTable(id) {
  const scopedStudentId = id || state.currentStudentId || state.studentId || currentStudent()?.id;
  const isPersonalRole = ['student', 'parent'].includes(effectiveRole());
  const data = state.tahfizh.filter((item) => (isPersonalRole ? item.studentId === scopedStudentId : !id || item.studentId === id)).slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const actionHeader = hasTahfizhAccess() && !id ? 'Aksi' : '';
  if (id || isPersonalRole) return table(['Santri', 'Juz / Surah', 'Ayat', 'Jenis', 'Status', ...(actionHeader ? [actionHeader] : [])], data.map((item) => `<tr><td>${escapeHtml(studentById(item.studentId).name)}</td><td><b>Juz ${item.juz}</b> ? ${escapeHtml(item.surah)}</td><td>${escapeHtml(item.ayat)}</td><td>${escapeHtml(item.type)}</td><td>${statusBadge(item.status)}</td>${actionHeader ? `<td><button type="button" class="icon-btn" data-edit-tahfizh="${item.id}" title="Edit setoran">${icon('pencil', 15)}</button></td>` : ''}</tr>`).join(''));
  return groupedStudentRecords(data, (item) => `<div class="accordion-record"><b>${escapeHtml(studentById(item.studentId).name)}</b><span>Juz ${escapeHtml(item.juz)} ? ${escapeHtml(item.surah)} ? ${escapeHtml(item.ayat || '?')}</span>${statusBadge(item.status)}</div>`);
}
function tahfizhMonthlySummary() {
  const month = today.slice(0, 7);
  const records = state.tahfizh.filter((item) => String(item.date || '').slice(0, 7) === month);
  const totalJuz = records.reduce((sum, item) => sum + Number(item.juz || 0), 0);
  const totalPages = records.reduce((sum, item) => sum + Number(item.pages || 0), 0);
  return `<div class="stats-grid">${statCard('Bulan Berjalan', new Date(`${today}T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }), 'Rekap aktif', 'calendar', 'green')}${statCard('Total Juz', totalJuz, 'Akumulasi setoran', 'book-open', 'blue')}${statCard('Total Halaman', totalPages, 'Jika tercatat', 'file-text', 'orange')}</div>`;
}
function gradeTable(studentId) {
  const records = state.grades.filter((grade) => !studentId || grade.studentId === studentId);
  if (studentId || ['parent', 'student'].includes(effectiveRole())) return table(['Santri', 'Mata Pelajaran', 'Nilai', 'Catatan'], records.map((grade) => `<tr><td>${escapeHtml(studentById(grade.studentId).name)}</td><td>${escapeHtml(grade.subject)}</td><td><span class="score">${grade.score}</span></td><td>${escapeHtml(grade.note || '?')}</td></tr>`).join(''));
  return groupedStudentRecords(records, (grade) => `<div class="accordion-record"><b>${escapeHtml(studentById(grade.studentId).name)}</b><span>${escapeHtml(grade.subject)} ? Nilai ${escapeHtml(grade.score)}</span><small>${escapeHtml(grade.note || '?')}</small></div>`);
}
function attendanceTable(type = 'kelas') {
  if (type === 'tahfizh' && !hasTahfizhAccess() && !['parent', 'student'].includes(effectiveRole())) return '<div class="notice">Akses presensi jam Tahfizh hanya untuk Guru Tahfizh, Pembina/Musyrif, atau Administrator.</div>';
  const data = state.attendance.filter((item) => item.type === type).slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  if (['parent', 'student'].includes(effectiveRole())) return table(['Santri', 'Tanggal', 'Status', 'Pencatat'], data.filter((item) => item.studentId === currentStudent().id).map((item) => `<tr><td>${studentById(item.studentId).name}</td><td>${formatDate(item.date)}</td><td>${statusBadge(item.status)}</td><td>${item.by || 'Pembina'}</td></tr>`).join(''));
  return groupedStudentRecords(data, (item) => `<div class="accordion-record"><b>${escapeHtml(studentById(item.studentId).name)}</b><span>${formatDate(item.date)} ? ${item.status}</span><small>${escapeHtml(item.by || 'Pembina')}</small></div>`);
}
function pklTable() {
  return table(['Santri', 'Tempat PKL', 'Pembimbing', 'Progress', 'Status'], state.pklReports.map((report) => `<tr><td>${studentById(report.studentId).name}</td><td>${report.company}</td><td>${report.mentor}</td><td>${report.progress}%</td><td>${statusBadge(report.status)}</td></tr>`).join(''));
}
function billingTable(limit, studentId) {
  const bills = state.financeBills.filter((bill) => (!studentId || bill.studentId === studentId) && isActiveStudent(studentById(bill.studentId))).slice().sort((a, b) => new Date(b.dueDate || b.date || 0) - new Date(a.dueDate || a.date || 0)).slice(0, limit || state.financeBills.length);
  const renderBill = (bill) => `<div class="accordion-record"><b>${escapeHtml(studentById(bill.studentId).name)}</b><span>${escapeHtml(bill.label)} ? ${money(billNet(bill))}</span><span>${statusBadge(bill.status)} <button type="button" class="btn btn-small btn-ghost" data-document="invoice" data-invoice="${escapeHtml(bill.id)}">Lihat</button></span></div>`;
  if (studentId || ['parent', 'student'].includes(effectiveRole())) return `<div style="max-height:350px;overflow-y:auto;overflow-x:auto"><div class="accordion-content">${bills.map(renderBill).join('') || '<div class="empty">Belum ada tagihan</div>'}</div></div>`;
  return groupedActiveStudentRecords(bills, renderBill);
}
function selfPasswordForm() {
  const account = currentAccount();
  const locked = !isMasterAdminSession() && (account?.passwordChangeCount || 0) >= 2;
  const warning = 'Batas maksimal perubahan kata sandi mandiri telah tercapai (2/2 kali). Untuk melakukan perubahan/reset kata sandi kembali, silakan hubungi Admin Mahad.';
  const message = account?.role === 'mahad' ? 'Perubahan kata sandi mandiri tanpa batas.' : locked ? warning : 'Batas maksimal ganti kata sandi mandiri adalah 2 kali.';
  return `<form id="admin-password-form" class="form-grid"><p class="notice ${locked ? 'font-bold' : ''}">${message}</p><label>Password Saat Ini<input name="currentPassword" type="password" autocomplete="current-password" required ${locked ? 'disabled' : ''}></label><label>Password Baru<input name="newPassword" type="password" minlength="10" autocomplete="new-password" required ${locked ? 'disabled' : ''}></label><label class="full">Konfirmasi Password Baru<input name="confirmPassword" type="password" minlength="10" autocomplete="new-password" required ${locked ? 'disabled' : ''}></label><button type="submit" class="btn btn-primary full" ${locked ? 'disabled' : ''}>Ubah Password</button></form>`;
}
function paymentTable(actions = false, studentId) {
  const data = state.payments.filter((payment) => (!studentId || payment.studentId === studentId) && isActiveStudent(studentById(payment.studentId))).slice().sort((a, b) => new Date(b.submittedAt || b.date || 0) - new Date(a.submittedAt || a.date || 0));
  const renderPayment = (payment) => `<div class="accordion-record"><b>${escapeHtml(studentById(payment.studentId).name)}</b><span>${escapeHtml(categoryLabel(payment.category))} ? ${escapeHtml(payment.period || '?')} ? ${money(payment.amount)}</span><span>${statusBadge(payment.status)} ${actions && ['Pending', 'pending_verification'].includes(payment.status) ? `<button class="btn btn-small btn-primary" data-payment="${payment.id}" data-payment-status="Verified">Verifikasi</button>` : payment.invoiceId ? `<button class="btn btn-small btn-ghost" data-document="invoice" data-invoice="${payment.invoiceId}">Invoice</button>` : ''}</span></div>`;
  if (!studentId && !['parent', 'student'].includes(effectiveRole())) return groupedStudentRecords(data, renderPayment);
  return `<div style="max-height:350px;overflow-y:auto;overflow-x:auto">${table(['Santri', 'Kategori', 'Periode', 'Nominal', 'Status', actions ? 'Aksi' : ''], data.map((payment) => `<tr><td>${studentById(payment.studentId).name}</td><td>${categoryLabel(payment.category)}</td><td>${payment.period}</td><td>${money(payment.amount)}</td><td>${statusBadge(payment.status)}</td>${actions ? `<td>${['Pending', 'pending_verification'].includes(payment.status) ? `<button class="btn btn-small btn-primary" data-payment="${payment.id}" data-payment-status="Verified">Verifikasi</button>` : payment.invoiceId ? `<button class="btn btn-small btn-ghost" data-document="invoice" data-invoice="${payment.invoiceId}">Invoice</button>` : '?'}</td>` : ''}</tr>`).join(''))}</div>`;
}
function invoiceTable(studentId) {
  const invoices = state.invoices.filter((invoice) => (!studentId || invoice.studentId === studentId) && isActiveStudent(studentById(invoice.studentId))).slice().sort((a, b) => new Date(b.issuedAt || b.date || 0) - new Date(a.issuedAt || a.date || 0));
  if (!studentId && !['parent', 'student'].includes(effectiveRole())) return groupedActiveStudentRecords(invoices, (invoice) => `<div class="accordion-record"><b>${escapeHtml(studentById(invoice.studentId).name)}</b><span>${escapeHtml(invoice.number)} ? ${money(invoice.total)}</span><span>${statusBadge(invoice.status)} <button class="btn btn-small btn-ghost" data-document="invoice" data-invoice="${invoice.id}">Lihat</button></span></div>`, 'Belum ada data invoice');
  const rows = invoices.map((invoice) => {
    const receipt = state.receipts.find((item) => item.invoiceId === invoice.id);
    return `<tr><td><b>${invoice.number}</b><small>${formatDate(invoice.issuedAt)}</small></td><td>${money(invoice.total)}</td><td>${statusBadge(invoice.status)}</td><td class="actions-inline"><button class="btn btn-small btn-ghost" data-document="invoice" data-invoice="${invoice.id}">${icon('eye', 14)} Lihat</button>${receipt ? `<button class="btn btn-small btn-ghost" data-document="receipt" data-receipt="${receipt.id}">${icon('download', 14)} Kuitansi</button>` : ''}</td></tr>`;
  }).join('');
  return ['parent', 'student'].includes(effectiveRole()) ? `<div style="max-height:350px;overflow-y:auto;overflow-x:auto">${table(['Nomor Invoice', 'Total', 'Status', 'Aksi'], rows, 'Belum ada invoice digital')}</div>` : table(['Nomor Invoice', 'Total', 'Status', 'Aksi'], rows, 'Belum ada invoice digital');
}
function renderWaliInvoices(studentNis) {
  const activeSantri = window.appData?.currentSantri;
  const nis = String(studentNis || activeSantri?.nis || '').trim();
  if (!nis) return '<div class="empty">Belum ada tagihan atau invoice</div>';
  const student = state.students.find((item) => String(item.nis) === nis);
  if (!student) return '<div class="empty">Belum ada tagihan atau invoice</div>';
  const studentInvoices = state.invoices.filter((invoice) => invoice.studentId === student.id).slice().sort((a, b) => new Date(b.issuedAt || b.date || 0) - new Date(a.issuedAt || a.date || 0));
  const unpaidBills = state.financeBills.filter((bill) => bill.studentId === student.id && bill.status !== 'Paid' && !studentInvoices.some((invoice) => invoice.category === bill.category && invoice.label === bill.label)).slice().sort((a, b) => new Date(b.dueDate || b.date || 0) - new Date(a.dueDate || a.date || 0));
  const invoiceEntries = [...studentInvoices, ...unpaidBills.map((bill) => ({ id: bill.id, studentId: bill.studentId, category: bill.category, label: bill.label, description: bill.description, period: bill.period, issuedAt: bill.dueDate, total: billNet(bill), status: bill.status }))].sort((a, b) => new Date(b.issuedAt || b.date || 0) - new Date(a.issuedAt || a.date || 0));
  const studentPayments = state.payments.filter((payment) => payment.studentId === student.id);
  const cards = invoiceEntries.map((invoice) => {
    const payment = studentPayments.find((item) => item.invoiceId === invoice.id || item.id === invoice.paymentId) || {};
    const bill = state.financeBills.find((item) => item.studentId === student.id && item.category === payment.category && (item.status === 'Paid' || item.label === invoice.label));
    const category = payment.category || invoice.category || bill?.category || 'CUSTOM';
    const isSpp = category === 'SPP';
    const label = payment.label || invoice.label || bill?.label || categoryLabel(category);
    const description = payment.description || payment.proof || invoice.description || bill?.description || 'Rincian pembayaran BoardingPro STK IS';
    const status = payment.status === 'Verified' || ['Paid', 'Lunas', 'Verified'].includes(invoice.status) ? 'Lunas' : 'Belum Lunas';
    const statusClass = status === 'Lunas' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
    const categoryClass = isSpp ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800';
    return `<article class="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm"><div class="flex flex-wrap items-start justify-between gap-3"><div><span class="inline-flex rounded-full px-3 py-1 text-xs font-bold ${categoryClass}">${isSpp ? 'SPP' : 'Non-SPP'}</span><h3 class="mt-3 text-base font-bold text-slate-900">${escapeHtml(label)}</h3></div><span class="inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass}">${status}</span></div><dl class="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2"><div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Tanggal</dt><dd>${formatDate(invoice.issuedAt || invoice.date || today)}</dd></div><div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Nomor Invoice</dt><dd>${escapeHtml(invoice.number || invoice.id)}</dd></div>${isSpp && (payment.period || invoice.period || bill?.period) ? `<div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Periode Bulan</dt><dd>${escapeHtml(payment.period || invoice.period || bill.period)}</dd></div>` : ''}<div><dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Nominal</dt><dd class="font-bold text-teal-700">${money(invoice.total || payment.amount || bill?.amount)}</dd></div><div class="sm:col-span-2"><dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Deskripsi</dt><dd>${escapeHtml(description)}</dd></div></dl></article>`;
  }).join('');
  return cards || '<div class="empty">Belum ada tagihan atau invoice</div>';
}
function invoiceDetails(invoice, receipt) {
  const payment = state.payments.find((item) => item.id === invoice.paymentId) || {};
  const bill = state.financeBills.find((item) => item.id === invoice.billId || (item.studentId === invoice.studentId && item.category === (invoice.category || payment.category) && item.label === (invoice.label || payment.label)));
  const category = invoice.category || payment.category || bill?.category || 'CUSTOM';
  const isSpp = category === 'SPP';
  const label = invoice.label || invoice.namaTagihan || payment.label || payment.namaTagihan || bill?.label || bill?.namaTagihan || categoryLabel(category);
  const description = invoice.description || invoice.keterangan || payment.description || payment.keterangan || payment.proof || bill?.description || bill?.keterangan || `Pembayaran ${label}`;
  const period = invoice.period || payment.period || bill?.period || null;
  const total = Number(invoice.total || payment.amount || bill?.amount || 0);
  const status = payment.status === 'Verified' || ['Paid', 'Lunas', 'Verified'].includes(invoice.status) ? 'Lunas' : 'Belum Lunas';
  return {
    isSpp,
    categoryLabel: isSpp ? 'SPP' : 'Non-SPP',
    categoryClass: isSpp ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800',
    status,
    statusClass: status === 'Lunas' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
    label,
    description,
    period,
    total,
    date: receipt?.issuedAt || invoice.issuedAt || invoice.date || today,
    number: invoice.number || invoice.id
  };
}
function financeView() {
  const studentId = effectiveRole() === 'parent' || effectiveRole() === 'student' ? currentStudent().id : undefined;
  const visibleBills = state.financeBills.filter((bill) => !studentId || bill.studentId === studentId);
  const outstanding = visibleBills.filter((bill) => bill.status !== 'Paid').reduce((sum, bill) => sum + billNet(bill), 0);
  return `${welcome('KEUANGAN YAYASAN', 'Billing, Beasiswa & Invoice', 'Komponen SPP dan non-SPP dikelola transparan dengan nominal fleksibel.', currentRoleIsAdmin() ? `<button class="btn btn-primary" data-action="add-billing">${icon('plus')} Tambah Komponen</button>` : '')}
    <div class="stats-grid">${statCard('Tagihan Aktif', state.financeBills.filter((bill) => bill.status !== 'Paid').length, 'Perlu ditindaklanjuti', 'receipt', 'orange')}${statCard('Piutang Bersih', money(outstanding), 'Setelah beasiswa & diskon', 'wallet-cards', 'purple')}${statCard('Beasiswa Aktif', state.scholarships.filter((item) => item.active).length, 'Program bantuan', 'heart-handshake', 'green')}${statCard('Invoice Terbit', state.invoices.length, 'Dapat dicetak', 'file-check-2', 'blue')}</div>
    ${section('Daftar Tagihan', 'Rincian nominal yang harus dibayar', billingTable(undefined, studentId))}
    ${section('Pembayaran & Invoice', 'Persetujuan otomatis menerbitkan invoice dan kuitansi', paymentTable(currentRoleIsAdmin(), studentId))}
    ${section('Invoice Digital', 'Admin dan wali dapat melihat, mencetak, atau mengunduh', invoiceTable(studentId))}`;
}
function gateTable() {
  const data = state.permits.filter((permit) => permit.status === 'Approved');
  return table(['Santri', 'Jenis Izin', 'Tanggal', 'Jam Keluar', 'Jam Kembali', 'Aksi'], data.map((permit) => `<tr><td><div class="person"><span class="avatar">${initials(studentById(permit.studentId).name)}</span><b>${studentById(permit.studentId).name}</b></div></td><td>${permit.type}</td><td>${formatDate(permit.date)}</td><td>${permit.checkout || '?'}</td><td>${permit.checkin || '?'}</td><td>${permit.checkin ? statusBadge('Selesai') : `<button class="btn btn-small btn-primary" data-gate="${permit.id}">${permit.checkout ? 'Check-in' : 'Checkout'}</button>`}</td></tr>`).join(''));
}
function gateEventsTable() {
  const rows = state.gateEvents.slice(-5).reverse().map((event) => `<tr><td>${event.time}</td><td><b>${event.action}</b></td><td>${studentById(event.studentId).name}</td><td>${event.operator}</td></tr>`).join('');
  return table(['Waktu', 'Aksi', 'Santri', 'Petugas'], rows, 'Belum ada aktivitas realtime');
}
function activityTimeline() {
  const items = state.schedules.length ? state.schedules : state.activities.map((item) => ({ time: item.time, title: item.title, type: 'Kegiatan' }));
  return `<div class="timeline">${items.map((item) => `<div class="timeline-item"><div class="time">${item.time}</div><div class="timeline-dot">${icon(item.type === 'Tahfizh' ? 'book-open' : 'calendar-days', 16)}</div><div><b>${item.title}</b><p>${item.room || 'Agenda BoardingPro STK IS'} ? ${item.teacher || ''}</p></div></div>`).join('')}</div>`;
}

function disciplineLevelLabel(level) {
  return ({ SP1: 'SP 1', SP2: 'SP 2', SP3: 'SP 3', DO: 'Surat DO' })[level] || level;
}
function disciplineExpiryDate(record) {
  if (record.expirationDate) return record.expirationDate;
  const issued = new Date(`${record.issuedAt || record.incidentDate || today}T00:00:00`);
  issued.setMonth(issued.getMonth() + 3);
  return issued.toISOString().slice(0, 10);
}
function disciplineVerificationStatus(record) {
  return record.status === 'Terverifikasi' || record.status === 'Aktif' || record.status === 'Selesai Sanksi'
    ? 'Terverifikasi'
    : 'Menunggu Verifikasi';
}
function hasNewerDisciplineRecord(record) {
  return (state.disciplineRecords || []).some((item) => item.studentId === record.studentId
    && item.id !== record.id
    && String(item.incidentDate || item.issuedAt || '') > String(record.expirationDate || disciplineExpiryDate(record)));
}
function disciplineRecordsForRole() {
  const role = effectiveRole();
  if (role === 'student' || role === 'santri') {
    const student = currentStudent();
    return (state.disciplineRecords || []).filter((record) => record.studentId === student.id);
  }
  if (role !== 'parent') return state.disciplineRecords || [];
  const allSPData = state.disciplineRecords || [];
  const activeParent = currentAccount();
  const childStudentId = activeParent?.studentId || state.studentId;
  if (!childStudentId) return [];
  return allSPData.filter((item) => item.studentId === childStudentId);
}
function disciplineStatus(record) {
  if (disciplineVerificationStatus(record) !== 'Terverifikasi') return 'Menunggu Verifikasi';
  if (record.level !== 'DO' && today > disciplineExpiryDate(record) && !hasNewerDisciplineRecord(record)) return 'KADALUARSA / PEMUTIHAN (BERSIH)';
  return record.status === 'Selesai Sanksi' ? 'Selesai Sanksi' : 'Aktif';
}
function formatSanctionForPrint(value) {
  const lines = String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return '?';
  const listItems = lines.map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')).filter(Boolean);
  const isList = lines.some((line) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line));
  return isList
    ? `<ol style="margin:0;padding-left:20px">${listItems.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ol>`
    : lines.map((line) => escapeHtml(line)).join('<br>');
}
function renderDisciplineLetter(recordId) {
  if (!verifyDocumentAccess('discipline', effectiveRole())) {
    console.warn('[BoardingPro] Akses dokumen SP ditolak.');
    return null;
  }
  const record = (state.disciplineRecords || []).find((item) => item.id === recordId);
  if (!record) return;
  const student = studentById(record.studentId);
  const institution = state.config?.institution || {};
  const issuerName = record.issuerName || roles[record.issuerRole]?.label || 'Musyrif / Kesantrian';
  const principalName = record.principalName || roles.kepsek.label;
  const verified = disciplineVerificationStatus(record) === 'Terverifikasi';
  const signatures = verified
    ? `<div class="discipline-signatures">${signatureQrHtml('Musyrif / Kesantrian', issuerName, record.issuerSignedAt, { documentId: record.id, documentType: 'discipline', role: 'issuer' })}${signatureQrHtml('Mengetahui Kepala Sekolah', principalName, record.principalSignedAt, { documentId: record.id, documentType: 'discipline', role: 'kepsek' })}</div>`
    : '<div class="draft-watermark" role="status">DRAFT / MENUNGGU ACC</div>';
  const expirationDate = disciplineExpiryDate(record);
  const detailRow = (label, value, className = '') => `<tr class="${className}"><th>${label}</th><td>${value}</td></tr>`;
  const details = `<table class="info-table">${detailRow('Nama Santri', `<b>${escapeHtml(student.name)}</b>`)}${detailRow('NIS', escapeHtml(student.nis || '?'))}${detailRow('Kelas', escapeHtml(student.className || '?'))}${detailRow('Tanggal Kejadian', formatDate(record.incidentDate))}${detailRow('Jenis Pelanggaran', escapeHtml(record.violationType))}${detailRow('Deskripsi / Sanksi', `<div>${escapeHtml(record.description)}</div><div class="box-sanction">${formatSanctionForPrint(record.sanction)}</div>`, 'info-table--multiline')}${detailRow('Masa Berlaku', `${formatDate(record.issuedAt || record.incidentDate)} s.d. ${formatDate(expirationDate)}`)}${detailRow('Status', escapeHtml(disciplineStatus(record)))}</table>`;
  const statusLabel = verified ? '? Terverifikasi' : 'Draft';
  const html = `<article class="document-container discipline-letter${verified ? '' : ' is-draft'}">${kopSuratHtml()}<div class="doc-header"><h2>Surat Peringatan ? ${escapeHtml(disciplineLevelLabel(record.level))}</h2><span class="status-badge ${verified ? 'status-badge--verified' : 'status-badge--draft'}">${statusLabel}</span></div><p class="discipline-letter-intro">Dengan ini menerangkan bahwa santri berikut menerima catatan kedisiplinan dan sanksi sesuai tata tertib pondok/sekolah:</p>${details}<p class="discipline-letter-note">Surat ini diterbitkan sebagai dokumen resmi dan menjadi bagian dari riwayat pembinaan santri.</p>${signatures}<footer>Dokumen: ${escapeHtml(record.id)} ? Status penerbitan: ${escapeHtml(disciplineStatus(record))}</footer></article>${documentActionButtons('discipline', record.id, 'Print Surat SP')}`;
  openModal(`Preview Surat Peringatan - ${student.name}`, html);
  bindDocumentActions($('#modal-root'), `Surat Peringatan - ${student.name}`, '@page{size:A4 portrait;margin:15mm}');
}
function cetakSuratSP(recordId) {
  const record = (state.disciplineRecords || []).find((item) => item.id === String(recordId));
  if (!record) return;
  const student = studentById(record.studentId);
  const modal = $('#modal-root');
  const documentNode = modal?.querySelector('.discipline-letter');
  if (documentNode) printDocumentInFrame(documentNode.outerHTML, `Surat Peringatan - ${student.name}`, '@page{size:A4 portrait;margin:15mm}');
  else renderDisciplineLetter(String(recordId));
}
function disciplineForm() {
  const role = effectiveRole();
  const levels = role === 'musyrif' || role === 'pembina' ? ['SP1', 'SP2'] : Object.keys(disciplineSanctions);
  const options = levels.map((level) => `<option value="${level}">${disciplineLevelLabel(level)}${level === 'DO' ? ' (Pemberhentian)' : ''}</option>`).join('');
  const types = disciplineCatalog.map((item) => `<option value="${escapeHtml(item.label)}">${escapeHtml(item.label)}</option>`).join('');
  return `<section class="panel"><div class="panel-head"><div><h2>Catat Pelanggaran & Terbitkan Surat</h2><p>Form hanya tersedia untuk Musyrif/Pembina dan Kesantrian.</p></div></div><form id="discipline-form" class="form-grid"><label>Santri<select name="studentId" required>${state.students.filter(isActiveStudent).map((student) => `<option value="${student.id}">${escapeHtml(student.name)} ? ${escapeHtml(student.nis)}</option>`).join('')}</select></label><label>Tingkat SP<select name="level" required>${options}</select></label><label>Tanggal Kejadian<input name="incidentDate" type="date" value="${today}" required></label><label>Jenis Pelanggaran<select name="violationType" required>${types}</select></label><label class="full">Deskripsi Pelanggaran / Sanksi<textarea name="description" required placeholder="Tuliskan kronologi singkat dan catatan pembinaan"></textarea></label><label class="full">Bentuk Sanksi yang Diberikan<textarea id="input-sanksi" name="sanction" rows="3" required placeholder="Contoh:\n1. Tugas kebersihan selama 3 hari\n2. Hafalan surat pendek"></textarea></label><button class="btn btn-primary full" type="submit">${icon('file-plus-2')} Simpan & Terbitkan Surat</button></form></section>`;
}
function disciplineFilters(records) {
  const role = effectiveRole();
  const filter = role === 'yayasan' ? (state.disciplineFilter || {}) : {};
  const visible = records.filter((record) => {
    const student = studentById(record.studentId);
    return (!filter.level || record.level === filter.level)
      && (!filter.className || student.className === filter.className)
      && (!filter.fromDate || record.incidentDate >= filter.fromDate)
      && (!filter.toDate || record.incidentDate <= filter.toDate);
  });
  const stats = ['SP1', 'SP2', 'SP3', 'DO'].map((level) => statCard(disciplineLevelLabel(level), visible.filter((item) => item.level === level && disciplineStatus(item) !== 'KADALUARSA / PEMUTIHAN (BERSIH)').length, 'Catatan aktif', 'shield-alert', level === 'DO' ? 'orange' : 'green')).join('');
  const classOptions = [...new Set(visible.map((item) => studentById(item.studentId).className).filter(Boolean))].sort().map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  const rows = visible.map((record) => {
    const student = studentById(record.studentId);
      const canApprove = ['mahad', 'admin', 'kepsek'].includes(role) && ['Menunggu Verifikasi', 'Draft'].includes(record.status);
      const action = `<button type="button" class="btn btn-small btn-ghost" data-discipline-letter="${record.id}">${icon('file-text', 14)} Lihat Surat</button>${canApprove ? `<button type="button" class="btn btn-small btn-primary" data-discipline-approve="${record.id}">${icon('shield-check', 14)} Verifikasi & Setujui SP</button>` : ''}`;
    return `<tr><td><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.nis || '')}</small></td><td>${escapeHtml(student.className || '?')}</td><td>${escapeHtml(disciplineLevelLabel(record.level))}</td><td>${formatDate(record.incidentDate)}</td><td>${escapeHtml(record.sanction)}</td><td>${statusBadge(disciplineStatus(record))}</td><td>${action}</td></tr>`;
  }).join('');
  const childStatus = visible.length ? disciplineStatus(visible[0]) : 'BERSIH / AMAN';
  const emptyMessage = role === 'parent' && !visible.length ? '<div class="notice" style="margin-bottom:12px"><b>Alhamdulillah, tidak ada catatan SP / Bersih.</b></div>' : '';
  return `${role === 'yayasan' ? `<div class="stats-grid">${stats}</div><section class="panel"><div class="panel-head"><div><h2>Filter Monitoring Yayasan</h2><p>Mode read-only: Yayasan hanya dapat memantau dan mencetak.</p></div></div><form id="discipline-filter-form" class="form-grid"><label>Tingkat SP<select name="level"><option value="">Semua Tingkat</option><option value="SP1">SP 1</option><option value="SP2">SP 2</option><option value="SP3">SP 3</option><option value="DO">Surat DO</option></select></label><label>Kelas<select name="className"><option value="">Semua Kelas</option>${classOptions}</select></label><label>Dari Tanggal<input name="fromDate" type="date"></label><label>Sampai Tanggal<input name="toDate" type="date"></label><button class="btn btn-primary" type="submit">Terapkan Filter</button></form></section>` : `<div class="child-hero"><div class="avatar xl">${initials(currentStudent().name)}</div><div><span class="eyebrow">STATUS KEDISIPLINAN ${role === 'parent' ? 'ANAK' : 'SAYA'}</span><h1>${escapeHtml(childStatus)}</h1><p>Riwayat hanya untuk ${escapeHtml(currentStudent().name)}.</p></div></div>`}${emptyMessage}<section class="panel"><div class="panel-head"><div><h2>Riwayat Pelanggaran & Sanksi</h2><p>${visible.length} catatan dapat ditinjau</p></div></div><div class="table-wrap"><table><thead><tr><th>SANTRI</th><th>KELAS</th><th>TINGKAT</th><th>TANGGAL</th><th>SANKSI</th><th>STATUS</th><th>DOKUMEN</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty">Belum ada catatan kedisiplinan.</td></tr>'}</tbody></table></div></section>`;
}
function disciplineView() {
  const role = effectiveRole();
  const records = disciplineRecordsForRole();
  const canCreate = ['mahad', 'admin', 'pembina', 'musyrif'].includes(role);
  return `${welcome('MODUL KEDISIPLINAN SANTRI', 'Surat SP 1 ? SP 2 ? SP 3 ? DO', 'Pencatatan, penerbitan surat, dan monitoring riwayat pembinaan.', '')}${canCreate ? disciplineForm() : ''}${disciplineFilters(records)}`;
}

function renderView() {
  let html;
  if (state.view === 'dashboard') html = dashboard();
  else if (state.view === 'finance') html = canViewFinance() ? financeView() : dashboard();
  else if (state.view === 'reports') html = yayasanDashboard();
  else if (state.view === 'discipline') html = disciplineView();
  else if (state.view === 'students') html = section('Data Master Santri', 'Admin dapat mengelola data; role lain hanya membaca.', studentsTable(), currentRoleIsAdmin() ? `<div class="actions-inline"><button type="button" class="btn btn-primary" data-action="add-student">${icon('plus')} Tambah Santri</button><button type="button" class="btn btn-ghost" data-action="promote-students">${icon('arrow-up-circle')} Proses Kenaikan Kelas</button></div>` : canPromoteStudents() ? `<button type="button" class="btn btn-ghost" data-action="promote-students">${icon('arrow-up-circle')} Proses Kenaikan Kelas</button>` : '');
  else if (state.view === 'classes') html = section('Manajemen Kelas & Program', 'PPTAK/KWNQ satu kelas; SMK memakai jurusan dinamis.', `${classesTable()}${currentRoleIsAdmin() ? section('Jurusan SMK Dinamis', 'Tambah atau ubah jurusan sesuai kebutuhan sekolah.', majorsTable(), `<button type="button" class="btn btn-primary" data-action="add-major">${icon('plus')} Tambah Jurusan</button>`) : ''}`, currentRoleIsAdmin() ? `<button type="button" class="btn btn-primary" data-action="add-class">${icon('plus')} Tambah Kelas</button>` : '');
  else if (state.view === 'teachers') html = section('Manajemen Guru & Ustadz', 'Data pengajar dan pembina', teachersTable(), currentRoleIsAdmin() ? `<button class="btn btn-primary" data-action="add-teacher">${icon('plus')} Tambah Guru</button>` : '');
  else if (state.view === 'accounts') html = section('Akun Internal Staf', 'Kelola username dan password internal', accountsTable(), `<button class="btn btn-primary" data-action="add-account">${icon('plus')} Buat Akun Staf</button>`);
  else if (state.view === 'permits') html = effectiveRole() === 'parent' ? permitForm() : `${musyrifPermitForm()}${section('Manajemen Perizinan', 'Verifikasi seluruh pengajuan santri', permitTable(true))}`;
  else if (state.view === 'billing') html = canViewFinance() ? financeView() : dashboard();
  else if (state.view === 'payments') html = canViewFinance() ? (effectiveRole() === 'parent' ? paymentForm() : section('Verifikasi Pembayaran', 'Validasi bukti transfer wali santri', paymentTable(currentRoleIsAdmin(), effectiveRole() === 'parent' ? currentStudent().id : undefined), currentRoleIsAdmin() ? `<button type="button" class="btn btn-primary" data-action="add-billing">${icon('plus')} Buat Tagihan</button>` : '')) : dashboard();
  else if (state.view === 'pocket') html = canViewFinance() ? pocketMoneyView() : dashboard();
  else if (state.view === 'academic') html = academicView();
  else if (state.view === 'grades') html = section('Nilai Pelajaran', 'Input dan rekap nilai KBM', gradeTable(), `<button class="btn btn-primary" data-action="add-grade">${icon('plus')} Input Nilai</button>`);
  else if (state.view === 'attendance') html = section('Presensi Kelas', 'Kehadiran KBM hari ini', attendanceTable());
  else if (state.view === 'teacher-attendance') html = (currentRoleIsAdmin() || ['kepsek', 'yayasan'].includes(effectiveRole())) ? teacherAttendanceAdminView() : effectiveRole() === 'guru' ? teacherPersonalAttendanceView() : dashboard();
  else if (state.view === 'points') {
    const studentOnly = ['student', 'santri'].includes(effectiveRole());
    html = section('Poin Kedisiplinan', studentOnly ? 'Riwayat poin dan sanksi Anda' : 'Catat prestasi dan pelanggaran santri', pointsTable(studentOnly ? currentStudent().id : undefined), studentOnly ? '' : `<button class="btn btn-primary" data-action="add-point">${icon('plus')} Input Poin</button>`);
  }
  else if (state.view === 'tahfizh') html = section('Program Tahfizh', 'Rekap capaian hafalan dan setoran santri', tahfizhMonthlySummary() + tahfizhTable(), (currentRoleIsAdmin() || hasTahfizhAccess()) ? `<button type="button" class="btn btn-primary" data-action="add-tahfizh">${icon('plus')} Input Setoran</button>` : '');
  else if (state.view === 'gate') html = gateView();
  else if (state.view === 'schedule') html = scheduleView();
  else if (state.view === 'security-reports') html = securityReportsView();
  else if (state.view === 'announcements') html = announcementsView();
  else if (state.view === 'pkl') html = pklViewWithEligibility();
  else if (state.view === 'permit-form') html = permitForm();
  else if (state.view === 'child') html = parentView();
  else html = dashboard();
  $('#main-content').innerHTML = html;
  $('#main-content').querySelectorAll('button:not([type]):not(form button)').forEach((button) => { button.type = 'button'; });
  bindActions();
  if (window.lucide) lucide.createIcons();
  renderRoleBasedNotifications();
  bindNotificationActions();
}

function renderDashboard() {
  try {
    renderShell();
    renderView();

    // Hook Integrasi BoardingPro (Kehadiran Guru & Notifikasi Role)
    if (typeof renderTeacherAttendanceModule === 'function') {
      const mainContent = document.getElementById('main-content') || document.querySelector('main') || document.body;
      const currentRole = String(state.role || "").toLowerCase();

      // Hanya tampilkan modul rekap guru jika role Mahad atau Admin
      if (currentRole.includes("mahad") || currentRole.includes("mahad") || currentRole.includes("admin")) {
        if (!document.getElementById('module-rekap-guru')) {
          const rekapHTML = renderTeacherAttendanceModule();
          if (rekapHTML) {
            mainContent.insertAdjacentHTML('beforeend', rekapHTML);
          }
        }
      } else {
        // Hapus jika berpindah ke role selain Mahad / Admin
        const existingModule = document.getElementById('module-rekap-guru');
        if (existingModule) existingModule.remove();
      }
    }

    // RefreshNotifikasi berbasis Role
    if (typeof renderRoleBasedNotifications === 'function') {
      renderRoleBasedNotifications();
    }

    if (window.lucide) lucide.createIcons();
  } catch (error) {
    console.error('[BoardingPro] Gagal merender dashboard:', error);
    const content = $('#main-content');
    if (content) {
      content.innerHTML = `<section class="panel"><h2>Dashboard tidak dapat dimuat</h2><p>Terjadi kendala saat membaca data. Silakan muat ulang halaman.</p><button class="btn btn-primary" onclick="window.location.reload()">Muat ulang</button></section>`;
    }
  }

}
function render() { renderDashboard(); }
function studentsTable() {
  return table(['Santri', 'Program / Kelas', 'Jurusan','Kehadiran', 'SPP', 'Aksi'], state.students.map((student) => { const programLabel = student.program === 'PPTAK' ? 'Program PPTAK (1 Tahun)' : student.program === 'KWNQ' ? 'Program KWNQ (3 Bulan)' : student.program; const classLabel = ['PPTAK', 'KWNQ'].includes(student.program) ? (student.status === 'Alumni Program' ? 'Alumni Program' : 'Program khusus') : student.className; return `<tr><td><div class="person"><span class="avatar">${initials(student.name)}</span><div><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.parent)} ? ${escapeHtml(student.nis)}</small></div></div></td><td>${escapeHtml(programLabel)}<br><small>${escapeHtml(classLabel)}</small></td><td>${escapeHtml((state.majors || majors).find((major) => major.id === student.major)?.name || '?')}</td><td>${student.attendance}%</td><td>${statusBadge(student.spp)}</td><td>${currentRoleIsAdmin() ? `<div class="actions-inline"><button type="button" class="btn btn-small btn-ghost" data-student-credentials="${student.id}">Kredensial</button><button type="button" class="icon-btn" data-edit-student="${student.id}">${icon('pencil', 16)}</button><button type="button" class="icon-btn" data-delete-student="${student.id}" title="Hapus">${icon('trash-2', 16)}</button></div>` : '?'}</td></tr>`; }).join(''));
}
function classesTable() {
  return table(['Program', 'Kelas', 'Jurusan', 'Wali Kelas', 'Santri', 'Aksi'], state.classes.map((klass) => {
    const program = programs.find((item) => item.id === klass.programId);
    const major = (state.majors || majors).find((item) => item.id === klass.majorId);
    const programLabel = klass.programId === 'PPTAK' ? 'Program PPTAK (1 Tahun)' : klass.programId === 'KWNQ' ? 'Program KWNQ (3 Bulan)' : program ? program.name : klass.programId;
    return `<tr><td>${programLabel}</td><td><b>${klass.programId === 'PPTAK' ? 'Program 1 Tahun' : klass.programId === 'KWNQ' ? 'Program 3 Bulan' : klass.name}</b></td><td>${klass.programId === 'SMK' && major ? major.name : '?'}</td><td>${klass.wali || '?'}</td><td>${klass.studentIds.length}</td><td>${currentRoleIsAdmin() ? `<button class="icon-btn" data-edit-class="${klass.id}">${icon('pencil', 15)}</button>` : '?'}</td></tr>`;
  }).join(''));
}
function pocketRoomSummary(students) {
  const groups = students.reduce((result, student) => {
    const className = student.className || 'Tanpa Kelas';
    if (!result[className]) result[className] = [];
    result[className].push(student);
    return result;
  }, {});
  const groupsHtml = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'id')).map(([className, classStudents]) => {
    const rows = classStudents.map((student) => {
      const expenses = state.pocketTransactions.filter((transaction) => transaction.studentId === student.id && transaction.type === 'Pengeluaran');
      const balance = state.pocketBalances.find((entry) => entry.studentId === student.id)?.balance || 0;
      const spent = expenses.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
      return `<tr><td><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.nis || '')}</small></td><td>${escapeHtml(student.room || '?')}</td><td>${money(balance)}</td><td>${money(spent)}</td></tr>`;
    }).join('');
    return `<details class="room-summary-group"><summary><span>${escapeHtml(className)}</span><small>${classStudents.length} santri</small></summary><div class="table-wrap"><table><thead><tr><th>SANTRI</th><th>KAMAR</th><th>SALDO</th><th>PENGELUARAN</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Belum ada santri</td></tr>'}</tbody></table></div></details>`;
  }).join('');
  return `<section class="panel room-summary-panel"><div class="panel-head"><div><h2>Rekap per Kamar / Asrama</h2><p>Kelompok santri berdasarkan kelas</p></div></div>${groupsHtml || '<p class="empty-state">Belum ada data santri.</p>'}</section>`;
}
function majorsTable() {
  return table(['Kode', 'Nama Jurusan', 'Aksi'], currentMajors().map((major) => `<tr><td><b>${escapeHtml(major.id)}</b></td><td>${escapeHtml(major.name)}</td><td><button type="button" class="icon-btn" data-edit-major="${escapeHtml(major.id)}">${icon('pencil', 15)}</button></td></tr>`).join(''), 'Belum ada jurusan SMK');
}
function pocketMoneyView() {
  const role = effectiveRole();
  const isParent = role === 'parent';
  const managedStudents = isParent ? [currentStudent()] : state.students;
  const student = currentStudent();
  const balanceEntry = state.pocketBalances.find((item) => item.studentId === student.id);
  const balance = balanceEntry ? Number(balanceEntry.balance || 0) : 0;
  const transactions = state.pocketTransactions.filter((item) => isParent ? item.studentId === student.id : true).slice().reverse();
  const topUpForm = isParent ? `<form id="pocket-topup-form" class="form-grid"><label>Nominal Top Up (Rp)<input name="amount" type="number" min="1000" step="1000" required></label><label>Metode Pembayaran<select name="method"><option>Transfer BSI</option><option>QRIS</option><option>Tunai</option></select></label><label class="full">Catatan<input name="note" placeholder="Contoh: uang saku pekan pertama"></label><button type="submit" class="btn btn-primary full">Ajukan Top Up</button></form>` : '';
  const expenseForm = (currentRoleIsAdmin() || ['pembina', 'musyrif'].includes(role)) ? `<form id="pocket-expense-form" class="form-grid"><label>Santri<select name="studentId">${managedStudents.map((item) => `<option value="${item.id}">${escapeHtml(item.name)} ? ${escapeHtml(item.nis)}</option>`).join('')}</select></label><label>Nominal Pengeluaran (Rp)<input name="amount" type="number" min="1" step="1000" required></label><label class="full">Keperluan<input name="note" placeholder="Contoh: kantin, koperasi"></label><button type="submit" class="btn btn-primary full">Catat Pengeluaran</button></form>` : '';
  const pending = state.pocketTransactions.filter((item) => item.type === 'Top Up' && item.status === 'Pending');
  const approval = currentRoleIsAdmin() ? table(['Santri', 'Nominal', 'Tanggal', 'Catatan', 'Aksi'], pending.map((item) => `<tr><td>${escapeHtml(studentById(item.studentId).name)}</td><td>${money(item.amount)}</td><td>${formatDate(item.date)}</td><td>${escapeHtml(item.note || '?')}</td><td><button type="button" class="btn btn-small btn-primary" data-pocket-approve="${item.id}">Verifikasi</button></td></tr>`).join(''), 'Tidak ada top up pending') : '';
  const roomSummary = role === 'pembina' || role === 'musyrif' ? pocketRoomSummary(managedStudents) : '';
  return `${welcome('UANG SAKU SANTRI', 'Saldo & transaksi', 'Top up wali diverifikasi admin, pengeluaran langsung mengurangi saldo.', '')}<div class="finance-grid"><div class="finance-tile"><span>Saldo ${escapeHtml(student.name)}</span><b>${money(balance)}</b></div><div class="finance-tile"><span>Total top up</span><b>${money(transactions.filter((item) => item.type === 'Top Up' && item.status !== 'Pending').reduce((sum, item) => sum + Number(item.amount || 0), 0))}</b></div><div class="finance-tile"><span>Total pengeluaran</span><b>${money(transactions.filter((item) => item.type === 'Pengeluaran').reduce((sum, item) => sum + Number(item.amount || 0), 0))}</b></div></div><div class="grid-2">${isParent ? section('Ajukan Top Up', 'Status awal menunggu verifikasi admin', topUpForm) : ''}${expenseForm ? section('Catat Pengeluaran', 'Hanya admin atau pembina', expenseForm) : ''}</div>${approval ? section('Verifikasi Top Up', 'Persetujuan admin', approval) : ''}${roomSummary}${section('Riwayat Uang Saku', 'Mutasi saldo terbaru', table(['Tanggal', 'Jenis', 'Nominal', 'Status', 'Catatan'], transactions.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${escapeHtml(item.type)}</td><td>${money(item.amount)}</td><td>${item.status ? statusBadge(item.status) : statusBadge('Verified')}</td><td>${escapeHtml(item.note || '?')}</td></tr>`).join(''), 'Belum ada transaksi'))}`;
}
function teachersTable() {
  return table(['Nama', 'Mapel', 'Peran', 'Telepon', 'Status', 'Aksi'], state.teachers.map((teacher) => `<tr><td><b>${teacher.name}</b></td><td>${teacher.subject}</td><td>${teacher.role}</td><td>${teacher.phone || '?'}</td><td>${statusBadge(teacher.status)}</td><td>${currentRoleIsAdmin() ? `<button class="icon-btn" data-edit-teacher="${teacher.id}">${icon('pencil', 15)}</button>` : '?'}</td></tr>`).join(''));
}
function accountsTable() {
  return table(['Nama', 'Username', 'Peran', 'Password', 'Aksi'], state.internalAccounts.map((account) => {
    const accountRoles = Array.isArray(account.roles) && account.roles.length ? account.roles : [roles[account.role]?.label || account.role];
    return `<tr><td><b>${escapeHtml(account.name || account.nama)}</b></td><td>${escapeHtml(account.username)}</td><td>${accountRoles.map((role) => `<span class="badge badge-neutral">${escapeHtml(role)}</span>`).join(' ')}</td><td><code>${escapeHtml(account.password)}</code><small>${account.role === 'mahad' ? 'Tanpa batas' : `Ganti: ${account.passwordChangeCount || 0}/2`}</small></td><td><button type="button" class="btn btn-small btn-ghost" data-reset-account="${account.id}">Reset Password</button>${account.id !== 'ACC-SUPER' && account.id !== 'ACC-MASTER' ? ` <button type="button" class="btn btn-small btn-ghost" data-delete-account="${account.id}">Hapus Akun</button>` : ''}${isMasterAdminSession() && account.role !== 'master_admin' ? ` <button type="button" class="btn btn-small btn-ghost" data-toggle-account="${account.id}">${account.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}</button> <button type="button" class="btn btn-small btn-ghost" data-edit-account="${account.id}">Edit Role</button>` : ''}</td></tr>`;
  }).join(''));
}
function eventsTable() {
  const events = state.events.slice().sort((a, b) => new Date(`${a.date || today}T00:00:00`) - new Date(`${b.date || today}T00:00:00`));
  return table(['Tanggal', 'Event', 'Lokasi', 'Peserta', 'Status'], events.map((event) => `<tr><td>${formatDate(event.date)}</td><td><b>${event.title}</b></td><td>${event.location}</td><td>${event.audience}</td><td>${statusBadge(event.status)}</td></tr>`).join(''));
}
function announcementsView() {
  const action = canManageAnnouncements() ? `<button class="btn btn-primary" data-action="add-announcement">${icon('plus')} Buat Pengumuman</button>` : '';
  const rows = state.announcements.map((item) => `<tr><td><b>${item.title}</b><small>${item.detail}</small></td><td>${formatDate(item.date)}</td><td>${item.author}</td><td>${canManageAnnouncements() ? `<div class="actions-inline"><button class="icon-btn" data-edit-announcement="${item.id}" title="Edit">${icon('pencil', 15)}</button><button class="icon-btn" data-delete-announcement="${item.id}" title="Hapus">${icon('trash-2', 15)}</button></div>` : '?'}</td></tr>`).join('');
  return section('Pengumuman', 'Informasi resmi untuk seluruh role', table(['Judul & Detail', 'Tanggal', 'Oleh', 'Aksi'], rows), action);
}
function pklView() {
  const student = currentStudent();
  if (effectiveRole() === 'student' && !isPklEligible(student)) return section('Praktik Kerja Lapangan', 'Modul terkunci', '<div class="locked-card">' + icon('lock', 30) + '<h3>PKL belum aktif</h3><p>PKL hanya tersedia untuk SMK kelas 11 semester 2 atau kelas 12 semester 1.</p></div>');
  return section('Praktik Kerja Lapangan', 'Laporan, presensi, dan monitoring pembimbing', pklTable(), `<button class="btn btn-primary" data-action="add-pkl">${icon('plus')} Kirim Laporan</button>`);
}

function prosesKirimLaporanPKL() {
  const student = currentStudent();
  if (effectiveRole() !== 'student') {
    alert('Pengiriman laporan PKL hanya tersedia untuk role Siswa.');
    return;
  }
  if (!isPklEligible(student)) {
    alert('Modul PKL belum aktif untuk siswa ini.');
    return;
  }
  const existing = state.pklReports.find((report) => report.studentId === student.id);
  openModal('Kirim Laporan PKL', `<form id="pkl-report-form" class="form-grid"><label class="full">Ringkasan Kegiatan<textarea name="lastReport" required placeholder="Tuliskan kegiatan PKL hari ini..."></textarea></label><label>Progress (%)<input name="progress" type="number" min="0" max="100" value="${existing?.progress || 0}" required></label><label>Kehadiran (%)<input name="attendance" type="number" min="0" max="100" value="${existing?.attendance || 0}" required></label><button type="submit" class="btn btn-primary full">Kirim Laporan</button></form>`);
  $('#pkl-report-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const values = {
      studentId: student.id,
      lastReport: String(form.get('lastReport')).trim(),
      progress: Number(form.get('progress')),
      attendance: Number(form.get('attendance')),
      status: existing?.status || 'Berjalan'
    };
    if (existing) Object.assign(existing, values);
    else state.pklReports.unshift({ id: `PKL-${Date.now()}`, company: 'Belum diisi', mentor: 'Belum ditentukan', startDate: today, endDate: today, ...values });
    persist();
    closeModal();
    render();
    alert('Laporan PKL berhasil dikirim.');
  });
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="add-pkl"]');
  if (!button) return;
  event.preventDefault();
  prosesKirimLaporanPKL();
});

function promoteStudents() {
  if (!canPromoteStudents()) {
    alert('Kenaikan kelas hanya dapat diproses oleh Mahad / Admin atau Kepala Sekolah.');
    return;
  }
  openModal('Proses Kenaikan Kelas', '<form id="promotion-form" class="form-grid"><label>Kelompok Kelas<select name="grade"><option value="all">Semua kelas</option><option value="10">Kelas 10 ke 11</option><option value="11">Kelas 11 ke 12</option><option value="12">Kelas 12 ke Alumni</option></select></label><p class="metric-note">Program PPTAK dan KWNQ dikecualikan otomatis dari kenaikan kelas.</p><button class="btn btn-primary full" type="submit">Proses Sekarang</button></form>');
  $('#promotion-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const selectedGrade = String(new FormData(event.target).get('grade'));
    openModal('Konfirmasi Kenaikan Kelas', '<div class="form-grid"><p class="metric-note" style="font-size:13px;color:#0f172a">Proses kelompok kelas yang dipilih sekarang?</p><div class="actions-inline" style="justify-content:flex-end"><button type="button" class="btn btn-ghost" data-cancel-promotion>Batal</button><button type="button" class="btn btn-primary" data-confirm-promotion>Ya, Proses</button></div></div>');
    $('#modal-root [data-cancel-promotion]').addEventListener('click', closeModal);
    $('#modal-root [data-confirm-promotion]').addEventListener('click', () => processPromotion(selectedGrade));
  });
}
function processPromotion(selectedGrade) {
  let promoted = 0;
  let alumni = 0;
  state.students.forEach((student) => {
    const grade = Number(student.grade);
    if (!['SMK', undefined, null, ''].includes(student.program) || ![10, 11, 12].includes(grade) || (selectedGrade !== 'all' && selectedGrade !== String(grade))) {
      if (['PPTAK', 'KWNQ'].includes(student.program) && (student.programCompleted || student.status === 'Alumni Program')) {
        student.status = 'Alumni Program';
        student.className = `Lulus ${student.program}`;
      }
      return;
    }
    promoted += 1;
    if (grade === 12) {
      student.status = 'Alumni';
      student.className = 'Alumni';
      student.grade = null;
      student.semester = null;
      alumni += 1;
      return;
    }
    student.grade = grade + 1;
    student.semester = 1;
  });
  persist();
  closeModal();
  render();
  alert(`${promoted} santri diproses; ${alumni} santri menjadi Alumni.`);
}

function pklViewWithEligibility() {
  const student = currentStudent();
  if (effectiveRole() === 'student' && !isPklEligible(student)) {
    return section('Praktik Kerja Lapangan', 'Modul belum dibuka', `<div class="notice">${icon('lock', 25)}<b>Akses PKL belum tersedia</b><p class="metric-note">PKL hanya dibuka untuk siswa SMK kelas 11 semester 2 atau kelas 12 semester 1. Status Anda saat ini: kelas ${escapeHtml(student.grade || '?')} semester ${escapeHtml(student.semester || '?')}.</p></div>`);
  }
  return pklView();
}

function permitForm() {
  const student = currentStudent();
  if (effectiveRole() !== 'parent') return section('Perizinan Santri', 'Pengajuan izin dilakukan oleh Orang Tua / Wali.', '<div class="notice">Akun siswa hanya dapat melihat status izin melalui portalnya. Silakan minta Orang Tua/Wali mengajukan izin.</div>');
  return section('Ajukan Perizinan Santri', 'Pengajuan maksimal 3 hari; Admin/Mahad dapat menyesuaikan durasi saat verifikasi.', `<form id="permit-form" class="form-grid"><label>Santri<input value="${escapeHtml(student.name)} ? ${escapeHtml(student.className)}" disabled><input type="hidden" name="studentId" value="${escapeHtml(student.id)}"></label><label>Jenis Izin<select name="type"><option value="Keluar Kompleks">Izin Keluar Kompleks</option><option value="Pulang / Mudik">Izin Pulang / Mudik</option></select></label><label>Tanggal Mulai<input name="date" type="date" value="${today}" required></label><label>Durasi Diajukan (hari)<input name="requestedDays" type="number" min="1" max="3" value="1" required></label><label class="full">Alasan<textarea name="reason" required placeholder="Contoh: Keperluan keluarga..."></textarea></label><div class="full"><button class="btn btn-primary" type="submit">${icon('send')} Kirim Pengajuan</button></div></form>${section('Riwayat Izin Anak', 'Surat digital tersedia setelah disetujui.', permitTable(false))}`);
}
function paymentForm() {
  const categories = [financeCategories.spp, financeCategories.foundation, ...financeCategories.maahadNonSpp, financeCategories.pocketMoney, financeCategories.custom];
  return section('Konfirmasi Pembayaran', 'Kirim konfirmasi SPP, non-SPP mahad, atau uang saku', `<form id="payment-form" class="form-grid"><label>Jenis Pembayaran<select name="category">${categories.map((category) => `<option value="${category.id}">${category.label}</option>`).join('')}</select></label><label>Periode<input name="period" value="September 2026" required></label><label>Nominal Bayar (Rp)<input name="amount" type="number" min="1" required></label><label>Metode<select name="method"><option>Transfer BSI</option><option>Virtual Account</option><option>Tunai ke Admin</option></select></label><label class="full">Upload Bukti Transfer (gambar)<input id="upload-receipt" name="receiptImage" type="file" accept="image/*"><small id="receipt-scan-status">Belum ada pemindaian.</small></label><label class="full">Catatan / Nama file bukti<input name="proof" placeholder="contoh: bukti-transfer.jpg" required></label><div class="full"><button type="submit" class="btn btn-primary">${icon('send')} Kirim Konfirmasi</button></div></form>${section('Riwayat Pembayaran', 'Status verifikasi admin', paymentTable(false, currentStudent().id))}${compactSection('Tagihan & Kuitansi', 'Rincian pembayaran santri', renderWaliInvoices(currentStudent().nis))}`);
}
function openModal(title, content) {
  $('#modal-root').innerHTML = `<div class="modal-backdrop modal-overlay"><div class="modal modal-card"><div class="modal-head modal-card-header"><h2 style="font-size:1rem;font-weight:600">${escapeHtml(title)}</h2><button type="button" class="icon-btn modal-close" data-close-modal aria-label="Tutup">${icon('x')}</button></div>${content}</div></div>`;
  $('#modal-root').querySelector('[data-close-modal]').addEventListener('click', closeModal);
  bindSensitiveDocumentGuard();
  if (window.lucide) lucide.createIcons();
}
function openInputModal(title, label, value, onSave, options = {}) {
  const inputType = options.type || 'text';
  const placeholder = options.placeholder || '';
  openModal(title, `<form id="input-modal-form" class="form-grid"><label class="full">${escapeHtml(label)}<input name="value" type="${inputType}" value="${escapeHtml(value || '')}" placeholder="${escapeHtml(placeholder)}" ${options.required === false ? '' : 'required'}></label><div class="actions-inline full" style="justify-content:flex-end"><button type="button" class="btn btn-ghost" data-input-cancel>Batal</button><button type="submit" class="btn btn-primary">Simpan</button></div></form>`);
  $('#input-modal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const nextValue = String(new FormData(event.target).get('value') || '').trim();
    if (options.required !== false && !nextValue) return;
    closeModal();
    onSave(nextValue);
  });
  $('#input-modal-form [data-input-cancel]').addEventListener('click', closeModal);
  $('#input-modal-form input').focus();
}
function openConfirmModal(title, message, onConfirm) {
  openModal(title, `<div class="confirm-modal-content"><p>${escapeHtml(message)}</p><div class="actions-inline" style="justify-content:flex-end;margin-top:18px"><button type="button" class="btn btn-ghost" data-confirm-cancel>Batal</button><button type="button" class="btn btn-primary" data-confirm-ok>Ya, Lanjutkan</button></div></div>`);
  $('#modal-root [data-confirm-cancel]').addEventListener('click', closeModal);
  $('#modal-root [data-confirm-ok]').addEventListener('click', () => { closeModal(); onConfirm(); });
}
function closeModal() { $('#modal-root').innerHTML = ''; }
function createInvoiceForPayment(payment) {
  if (!payment || payment.status !== 'Verified') return null;
  const existing = state.invoices.find((invoice) => invoice.paymentId === payment.id);
  if (existing) return existing;
  const sequence = String(state.invoices.length + 1).padStart(4, '0');
  const invoice = { id: `INV-${Date.now()}`, paymentId: payment.id, studentId: payment.studentId, category: payment.category, label: payment.label || categoryLabel(payment.category), description: payment.description || payment.proof || 'Pembayaran BoardingPro STK IS', period: payment.period || null, number: `INV/${today.slice(0, 4)}/${today.slice(5, 7)}/${sequence}`, issuedAt: today, total: Number(payment.amount || 0), status: 'Paid', applicantName: payment.applicantName || 'Orang Tua / Wali', applicantSignedAt: payment.submittedAt, applicantQrPayload: payment.applicantQrPayload, verifierName: payment.verifierName || roles.mahad.label, verifierSignedAt: payment.verifierSignedAt || new Date().toISOString(), verifierQrPayload: payment.verifierQrPayload };
  state.invoices.unshift(invoice);
  const receipt = { id: `RCT-${Date.now()}`, invoiceId: invoice.id, paymentId: payment.id, number: `KWT/${today.slice(0, 4)}/${today.slice(5, 7)}/${sequence}`, issuedAt: today };
  state.receipts.unshift(receipt);
  payment.invoiceId = invoice.id;
  payment.receiptId = receipt.id;
  const matchingBill = state.financeBills.find((bill) => bill.studentId === payment.studentId && bill.category === payment.category && bill.status !== 'Paid');
  if (matchingBill) matchingBill.status = 'Paid';
  return invoice;
}
function documentText(invoice, receipt) {
  const student = studentById(invoice.studentId);
  const details = invoiceDetails(invoice, receipt);
  return `${receipt ? 'KUITANSI PEMBAYARAN' : 'INVOICE DIGITAL'}\nBoardingPro STK IS\n${receipt ? receipt.number : details.number}\nSantri: ${student.name} (${SecurityMasker.identity(student.nis)})\nKategori: ${details.categoryLabel}\nPeruntukan: ${details.description}\n${details.isSpp && details.period ? `Periode: ${details.period}\n` : ''}Tanggal: ${formatDate(details.date)}\nTotal: ${money(details.total)}\nStatus: ${details.status}\nTerima kasih.`;
}
function renderInvoiceModal(invoiceId, print = false, receiptId = null) {
  const documentType = receiptId ? 'receipt' : 'invoice';
  if (!verifyDocumentAccess(documentType, effectiveRole())) {
    console.warn(`[BoardingPro] Akses dokumen ${documentType} ditolak.`);
    return null;
  }
  const receipt = receiptId ? state.receipts.find((item) => item.id === receiptId) : null;
  const invoice = state.invoices.find((item) => item.id === invoiceId)
    || (receipt ? state.invoices.find((item) => item.id === receipt.invoiceId) : null);
  const bill = state.financeBills.find((item) => item.id === invoiceId);
  const source = invoice || (bill ? { ...bill, total: billNet(bill), issuedAt: bill.dueDate, number: bill.id } : null);
  if (!source) return;
  const student = studentById(source.studentId);
  const adjustment = billAdjustments(source);
  const subtotal = Number(source.amount || source.total || 0);
  const total = Number(source.total || billNet(source));
  const paid = ['Paid', 'Lunas', 'Verified'].includes(source.status) || state.payments.some((payment) => payment.id === source.paymentId && payment.status === 'Verified');
  const hash = `STKIS-${btoa(`${source.id}|${source.studentId}|${total}`).replace(/[^A-Z0-9]/gi, '').slice(0, 16).toUpperCase()}`;
  const institution = state.config?.institution || {};
  const header = kopSuratHtml();
  const isReceipt = Boolean(receipt);
  const title = isReceipt ? 'KWITANSI PEMBAYARAN' : paid ? 'INVOICE PEMBAYARAN' : 'SURAT PENAGIHAN / INVOICE';
  const detailRows = `<tr><td>Subtotal</td><td>${money(subtotal)}</td></tr><tr><td>Potongan/Beasiswa</td><td>- ${money(adjustment.scholarship + adjustment.discount)}</td></tr><tr><td><b>Total Kewajiban</b></td><td><b>${money(total)}</b></td></tr>`;
  const invoiceSignatureBlock = `<div class="signature-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:28px">${signatureQrHtml('Pemohon', source.applicantName || 'Orang Tua / Wali', source.applicantSignedAt, source.applicantQrPayload || { documentId: source.id, documentType: 'invoice', role: 'parent' })}${signatureQrHtml('Mengetahui & Menyetujui', source.verifierName || (paid ? 'Administrator' : 'Belum diverifikasi'), source.verifierSignedAt, source.verifierQrPayload || { documentId: source.id, documentType: 'invoice', role: 'verifier' })}</div>`;
  const cleanRows = `<tr><td>Nomor</td><td>${escapeHtml(source.number || source.id)}</td></tr><tr><td>Santri</td><td>${escapeHtml(student.name)} (${escapeHtml(SecurityMasker.identity(student.nis || '?'))})</td></tr><tr><td>Tagihan</td><td>${escapeHtml(source.label || categoryLabel(source.category))}</td></tr>${detailRows}<tr><td>Status</td><td>${paid ? 'LUNAS / PAID' : 'BELUM LUNAS / UNPAID'}</td></tr>`;
  const pageStyle = '@page{size:A4 portrait;margin:15mm}.document-container,.receipt-document{width:100%;max-width:210mm;min-height:297mm;padding:15mm}';
  const html = `<article class="document-container invoice-document${isReceipt ? ' receipt-document' : ''}">${header}<div class="doc-header"><h2>${escapeHtml(title)}</h2><span class="status-badge ${paid ? 'status-badge--verified' : 'status-badge--draft'}">${paid ? '? Terverifikasi' : 'Draft'}</span></div><table class="clean-table">${cleanRows}</table>${invoiceSignatureBlock}<footer class="document-footer">Security Hash Code: <b>${hash}</b></footer></article>${documentActionButtons(isReceipt ? 'receipt' : 'invoice', isReceipt ? receipt.id : source.id, isReceipt ? 'Print Kwitansi' : 'Print Invoice')}`;
  if (print) {
    printDocumentInFrame(html, `${title} - ${source.number || source.id}`, pageStyle);
    return;
  }
  openModal(title, html);
  bindDocumentActions($('#modal-root'), `${title} - ${source.number || source.id}`, pageStyle);
}
function openDocument(invoiceId, receiptId, print = false) {
  if (!verifyDocumentAccess(receiptId ? 'receipt' : 'invoice', effectiveRole())) {
    console.warn('[BoardingPro] Akses dokumen pembayaran ditolak.');
    return null;
  }
  const invoice = state.invoices.find((item) => item.id === invoiceId) || state.invoices.find((item) => item.id === state.receipts.find((receipt) => receipt.id === receiptId)?.invoiceId);
  if (!invoice) return;
  const receipt = state.receipts.find((item) => item.id === receiptId) || state.receipts.find((item) => item.invoiceId === invoice.id);
  const text = documentText(invoice, receipt);
  if (print) { renderInvoiceModal(invoice.id, true, receiptId); return; }
  if (receiptId) { renderInvoiceModal(invoice.id, false, receiptId); return; }
  const details = invoiceDetails(invoice, receipt);
  const documentTitle = receipt ? 'Kuitansi Digital' : 'Invoice Digital';
  const periodRow = details.isSpp && details.period ? `<div><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Periode Bulan</dt><dd class="text-sm text-slate-700">${escapeHtml(details.period)}</dd></div>` : '';
  const documentCard = `<div class="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm"><div class="flex flex-wrap items-start justify-between gap-3"><div><span class="text-base font-semibold text-slate-900">${documentTitle}</span><p class="mt-1 text-xs text-slate-500">BoardingPro STK IS ? ${escapeHtml(studentById(invoice.studentId).name)}</p></div><div class="flex gap-2"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${details.categoryClass}">${details.categoryLabel}</span><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${details.statusClass}">${details.status}</span></div></div><dl class="mt-4 grid gap-3 sm:grid-cols-2"><div><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">${receipt ? 'Nomor Kuitansi' : 'Nomor Invoice'}</dt><dd class="text-sm font-semibold text-slate-800">${escapeHtml(receipt ? receipt.number : details.number)}</dd></div><div><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tanggal Transaksi</dt><dd class="text-sm text-slate-700">${formatDate(details.date)}</dd></div><div class="sm:col-span-2"><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pembayaran Untuk</dt><dd class="text-sm text-slate-700">${escapeHtml(details.description)}</dd></div>${periodRow}<div><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total Nominal</dt><dd class="text-base font-bold text-teal-700">${money(details.total)}</dd></div></dl></div><pre class="document-preview mt-4">${escapeHtml(text)}</pre><div class="actions-inline mt-4"><button type="button" class="btn btn-primary" data-download-document="${invoice.id}">${icon('download')} Download</button><button type="button" class="btn btn-ghost" data-document="print" data-invoice="${invoice.id}" data-receipt="${receipt ? receipt.id : ''}">${icon('printer')} Print</button></div>`;
  openModal(documentTitle, documentCard);
  const download = $('#modal-root').querySelector('[data-download-document]');
  if (download) download.addEventListener('click', () => downloadDocumentPdf(`<article class="document-container">${kopSuratHtml()}<h2>${escapeHtml(documentTitle)}</h2><pre class="document-preview">${escapeHtml(text)}</pre></article>`, invoice.number.replaceAll('/', '-'), '@page{size:A4 portrait;margin:15mm}'));
  const printButton = $('#modal-root').querySelector('[data-document="print"]');
  if (printButton) printButton.addEventListener('click', () => openDocument(invoice.id, receipt && receipt.id, true));
}
function openKbmEntryModal(kind) {
  const assignment = teacherAssignments().find((item) => item.id === (state.teacherSelection || {}).assignmentId) || teacherAssignments()[0];
  if (!assignment) return alert('Belum ada penugasan kelas atau mata pelajaran.');
  const students = state.students.filter((student) => student.className === assignment.className && isActiveStudent(student));
  const studentOptions = students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)} - ${escapeHtml(student.nis)}</option>`).join('');
  const title = kind === 'attendance' ? 'Presensi KBM' : kind === 'journal' ? (assignment.type === 'tahfizh' ? 'Setoran Tahfizh' : 'Jurnal KBM') : 'Nilai Per Mata Pelajaran';
  const fields = kind === 'attendance'
    ? `<label>Santri<select name="studentId" required>${studentOptions}</select></label><label>Status<select name="status"><option>Hadir</option><option>Izin</option><option>Sakit</option><option>Alpa</option></select></label>`
    : kind === 'journal'
      ? `<label class="full">Tanggal<input name="date" type="date" value="${today}" required></label><label class="full">Catatan / Materi / Ziyadah & Muraaja'ah<textarea name="note" rows="4" required></textarea></label>`
      : `<label>Santri<select name="studentId" required>${studentOptions}</select></label><label>Jenis Nilai<select name="assessment"><option>Tugas</option><option>UH</option><option>UTS</option><option>UAS</option><option>Ujian Mutqin/Tahfizh</option></select></label><label>Nilai<input name="score" type="number" min="0" max="100" required></label>`;
  openModal(title, `<form id="kbm-entry-form" class="form-grid">${fields}<button class="btn btn-primary full" type="submit">Simpan</button></form>`);
  $('#kbm-entry-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const base = { id: `KBM-${Date.now()}`, assignmentId: assignment.id, teacherId: currentTeacherId(), date: String(form.get('date') || today) };
    if (kind === 'attendance') (state.kbmAttendance || (state.kbmAttendance = [])).push({ ...base, studentId: String(form.get('studentId')), status: String(form.get('status')) });
    if (kind === 'journal') (state.kbmJournals || (state.kbmJournals = [])).push({ ...base, note: sanitizeInput(form.get('note')), type: assignment.type === 'tahfizh' ? 'tahfizh' : 'umum' });
    if (kind === 'grade') (state.kbmGrades || (state.kbmGrades = [])).push({ ...base, studentId: String(form.get('studentId')), assessment: String(form.get('assessment')), score: Number(form.get('score')) });
    persist(); closeModal(); render();
  });
}
function bindActions() {
  bindMajorCodeGenerator();
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
    state.view = button.dataset.view;
    render();
  }));
  const disciplineFormElement = $('#discipline-form');
  if (disciplineFormElement) disciplineFormElement.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!['mahad', 'admin', 'pembina', 'musyrif'].includes(effectiveRole())) return;
    const form = new FormData(disciplineFormElement);
    const recordId = `DISC-${Date.now()}`;
    const issuer = currentAccount();
    state.disciplineRecords.unshift({
      id: recordId,
      studentId: sanitizeInput(form.get('studentId')),
      level: sanitizeInput(form.get('level')),
      incidentDate: sanitizeInput(form.get('incidentDate')),
      violationType: sanitizeInput(form.get('violationType')),
      description: sanitizeInput(form.get('description')),
      sanction: sanitizeInput(form.get('sanction')),
      status: effectiveRole() === 'musyrif' || effectiveRole() === 'pembina' ? 'Menunggu Verifikasi' : 'Terverifikasi',
      issuedAt: today,
      expirationDate: disciplineExpiryDate({ issuedAt: today }),
      issuerName: issuer?.name || issuer?.nama || roles[effectiveRole()]?.label || 'Musyrif / Kesantrian',
      issuerRole: effectiveRole(),
      issuerSignedAt: new Date().toISOString(),
      principalName: roles.kepsek.demoName,
      principalSignedAt: new Date().toISOString()
    });
    persist();
    alert('Catatan pelanggaran dan surat resmi berhasil diterbitkan.');
    render();
  });
  const disciplineFilter = $('#discipline-filter-form');
  if (disciplineFilter) disciplineFilter.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(disciplineFilter);
    state.disciplineFilter = Object.fromEntries(form.entries());
    render();
  });
  document.querySelectorAll('[data-discipline-letter]').forEach((button) => button.addEventListener('click', () => cetakSuratSP(button.dataset.disciplineLetter)));
  document.querySelectorAll('[data-discipline-approve]').forEach((button) => button.addEventListener('click', () => {
    if (!['mahad', 'admin', 'kepsek'].includes(effectiveRole())) return;
    const record = (state.disciplineRecords || []).find((item) => item.id === button.dataset.disciplineApprove);
    if (!record || !['Menunggu Verifikasi', 'Draft'].includes(record.status)) return;
    const verifier = currentAccount();
    record.status = 'Terverifikasi';
    record.approvedBy = verifier?.name || verifier?.nama || roles[effectiveRole()].label;
    record.approvedAt = new Date().toISOString();
    record.principalName = effectiveRole() === 'kepsek' ? record.approvedBy : record.principalName || roles.kepsek.demoName;
    record.principalSignedAt = record.approvedAt;
    record.verifierQrPayload = { documentId: record.id, documentType: 'discipline', role: effectiveRole() };
    persist();
    alert('Surat berhasil disetujui dan QR verifikator diterbitkan.');
    render();
  }));
  document.querySelectorAll('[data-status]').forEach((button) => button.addEventListener('click', (event) => {
    event.preventDefault();
    if (!(currentRoleIsAdmin() || ['pembina', 'musyrif', 'guru', 'kepsek'].includes(effectiveRole()))) return;
    const permit = state.permits.find((item) => item.id === button.dataset.permit);
    if (!permit) return;
    if (button.dataset.status === 'Approved' && !canApprovePermit(permit)) { alert('Kuota Keluar Mandiri Minggu Ini Habis'); return; }
    const finish = (rejectionReason, approvedDays) => {
      permit.status = button.dataset.status;
      permit.approvedBy = roles[effectiveRole()]?.label || roles.mahad.label;
      permit.approvedAt = new Date().toISOString();
      permit.verifierQrPayload = { documentId: permit.id, documentType: 'permit', role: effectiveRole() };
      if (permit.status === 'Rejected') permit.rejectionReason = rejectionReason || 'Ditolak oleh petugas berwenang';
      if (permit.status === 'Approved') {
        permit.approvedDays = approvedDays;
        permit.weekly_quota_used = weeklyQuotaUsed(permit.studentId, permit.date) + (isQuotaDeducted(permit) ? 1 : 0);
        const end = new Date(`${permit.date}T00:00:00`);
        end.setDate(end.getDate() + approvedDays - 1);
        permit.endDate = end.toISOString().slice(0, 10);
        permit.letterNumber = permit.letterNumber || generatePermitNumber(permit.id);
        permit.verifiedAt = permit.approvedAt;
        permit.officialSignature = '[ TERVERIFIKASI DIGITAL MAHAD / PEMBINA ]';
        permit.officialStamp = 'STEMPEL DIGITAL MAHAD';
      }
      persist();
      render();
    };
    if (permit.status === 'Pending' && button.dataset.status === 'Rejected') {
      openInputModal('Tolak Pengajuan Izin', 'Alasan penolakan', '', (reason) => finish(reason, 0), { required: false });
    } else if (permit.status === 'Pending' && button.dataset.status === 'Approved') {
      openInputModal('Durasi Izin', 'Durasi izin (hari)', permit.requestedDays || 1, (value) => finish('', Math.min(3, Math.max(1, Number(value) || 1))), { type: 'number' });
    } else {
      finish('', permit.requestedDays || 1);
    }
  }));
  document.querySelectorAll('[data-permit-letter]').forEach((button) => button.addEventListener('click', () => renderPermitLetter(button.dataset.permitLetter)));
  document.querySelectorAll('[data-security-status]').forEach((button) => button.addEventListener('click', () => {
    if (!canManageSecurity()) return;
    const [kind, id] = button.dataset.securityStatus.split(':');
    const collection = kind === 'incident' ? state.incidents : state.lostFound;
    const item = collection.find((entry) => entry.id === id);
    if (!item) return;
    item.status = kind === 'incident' ? 'Selesai' : 'Diserahkan';
    persist();
    render();
  }));
  document.querySelectorAll('[data-action="add-incident"]').forEach((button) => button.addEventListener('click', () => openSecurityReportModal('incident')));
  document.querySelectorAll('[data-action="add-lost-found"]').forEach((button) => button.addEventListener('click', () => openSecurityReportModal('lost')));
  document.querySelectorAll('[data-action="add-schedule"]').forEach((button) => button.addEventListener('click', () => openScheduleModal('schedule')));
  document.querySelectorAll('[data-action="add-event"]').forEach((button) => button.addEventListener('click', () => openScheduleModal('event')));
  document.querySelectorAll('[data-payment]').forEach((button) => button.addEventListener('click', (e) => { e.preventDefault(); const payment = state.payments.find((item) => item.id === button.dataset.payment); if (payment && currentRoleIsAdmin()) { payment.status = button.dataset.paymentStatus; if (payment.status === 'Verified') { const verifier = currentAccount(); payment.verifierName = verifier?.name || verifier?.nama || roles[effectiveRole()]?.label || 'Administrator'; payment.verifierSignedAt = new Date().toISOString(); payment.verifierQrPayload = { documentId: payment.id, documentType: 'invoice', role: effectiveRole() }; createInvoiceForPayment(payment); } persist(); render(); alert('Pembayaran disetujui. Invoice dan kuitansi digital otomatis diterbitkan.'); } }));
  document.querySelectorAll('[data-pocket-approve]').forEach((button) => button.addEventListener('click', (e) => { e.preventDefault(); if (!currentRoleIsAdmin()) return; const transaction = state.pocketTransactions.find((item) => item.id === button.dataset.pocketApprove && item.type === 'Top Up' && item.status === 'Pending'); if (!transaction) return; transaction.status = 'Lunas'; const balance = state.pocketBalances.find((item) => item.studentId === transaction.studentId); if (balance) balance.balance = Number(balance.balance || 0) + Number(transaction.amount || 0); else state.pocketBalances.push({ studentId: transaction.studentId, balance: Number(transaction.amount || 0) }); const payment = { id: `PAY-${transaction.id}`, studentId: transaction.studentId, category: 'POCKET_MONEY', period: 'September 2026', amount: Number(transaction.amount || 0), method: transaction.method || 'Top Up Uang Saku', status: 'Verified', submittedAt: transaction.date, proof: transaction.note || '' }; state.payments.push(payment); createInvoiceForPayment(payment); persist(); render(); }));
  document.querySelectorAll('[data-billing-read]').forEach((button) => button.addEventListener('click', () => { const bill = state.billingNotifications.find((item) => item.id === button.dataset.billingRead); if (bill) { bill.read = true; persist(); render(); } }));
  document.querySelectorAll('[data-document="invoice"]').forEach((button) => button.addEventListener('click', () => renderInvoiceModal(button.dataset.invoice, false)));
  document.querySelectorAll('[data-document="receipt"]').forEach((button) => button.addEventListener('click', () => openDocument(null, button.dataset.receipt, false)));
  document.querySelectorAll('[data-document="print"]').forEach((button) => button.addEventListener('click', () => openDocument(button.dataset.invoice, button.dataset.receipt, true)));
  document.querySelectorAll('[data-gate]').forEach((button) => button.addEventListener('click', () => { const permit = state.permits.find((item) => item.id === button.dataset.gate); if (!permit) return; const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); const action = permit.checkout ? 'Check-in' : 'Checkout'; if (!permit.checkout) permit.checkout = time; else permit.checkin = time; state.gateEvents.push({ time, action, studentId: permit.studentId, operator: roles.security.demoName }); persist(); render(); }));
  document.querySelectorAll('[data-attendance]').forEach((button) => button.addEventListener('click', () => { const record = state.attendance.find((item) => item.id === button.dataset.attendance); if (record) { record.status = record.status === 'Hadir' ? 'Izin' : record.status === 'Izin' ? 'Alpa' : 'Hadir'; persist(); render(); } }));
  document.querySelectorAll('[data-teacher-detail]').forEach((button) => button.addEventListener('click', () => openTeacherAttendanceDetail(button.dataset.teacherDetail)));
  document.querySelectorAll('[data-action="add-student"]').forEach((button) => button.addEventListener('click', openStudentModal));
  document.querySelectorAll('[data-action="add-kbm-attendance"]').forEach((button) => button.addEventListener('click', () => openKbmEntryModal('attendance')));
  document.querySelectorAll('[data-action="add-kbm-journal"]').forEach((button) => button.addEventListener('click', () => openKbmEntryModal('journal')));
  document.querySelectorAll('[data-action="add-kbm-grade"]').forEach((button) => button.addEventListener('click', () => openKbmEntryModal('grade')));
  const assignmentSelect = $('#teacher-assignment-select');
  if (assignmentSelect) assignmentSelect.addEventListener('change', () => { state.teacherSelection = { assignmentId: assignmentSelect.value }; persist(); render(); });
  document.querySelectorAll('[data-action="export-kbm-pdf"]').forEach((button) => button.addEventListener('click', () => {
    const assignment = teacherAssignments().find((item) => item.id === (state.teacherSelection || {}).assignmentId) || teacherAssignments()[0];
    if (!assignment) return;
    const content = `<article class="document-container"><h1>REKAP KBM</h1><h2>${escapeHtml(assignment.className)} - ${escapeHtml(assignment.subject)}</h2>${teachingDashboard()}</article>`;
    downloadDocumentPdf(content, `Rekap-KBM-${assignment.className}-${assignment.subject}`, '@page{size:A4 portrait;margin:15mm}');
  }));
  document.querySelectorAll('[data-action="promote-students"]').forEach((button) => button.addEventListener('click', promoteStudents));
  document.querySelectorAll('[data-student-credentials]').forEach((button) => button.addEventListener('click', () => openStudentCredentialsModal(studentById(button.dataset.studentCredentials))));
  document.querySelectorAll('[data-edit-student]').forEach((button) => button.addEventListener('click', () => openStudentModal(studentById(button.dataset.editStudent))));
  document.querySelectorAll('[data-reset-account]').forEach((button) => button.addEventListener('click', () => { if (!currentRoleIsAdmin()) return; const account = state.internalAccounts.find((item) => item.id === button.dataset.resetAccount); if (!account || (account.role === 'master_admin' && !isMasterAdminSession())) return; account.password = account.role === 'student' ? 'santri123' : 'user123'; account.passwordChangeCount = 0; persist(); render(); alert('Password akun berhasil direset.'); }));
  document.querySelectorAll('[data-delete-account]').forEach((button) => button.addEventListener('click', () => {
    if (!currentRoleIsAdmin()) return;
    const account = state.internalAccounts.find((item) => item.id === button.dataset.deleteAccount);
    if (!account || account.role === 'master_admin' || (account.role === 'mahad' && !isMasterAdminSession())) return;
    openModal('Hapus Akun', '<div class="form-grid"><p class="metric-note" style="font-size:13px;color:#0f172a">Hapus hanya kredensial akun ini? Data historis santri tetap aman.</p><div class="actions-inline" style="justify-content:flex-end"><button type="button" class="btn btn-ghost" data-cancel-delete>Batal</button><button type="button" class="btn btn-primary" data-confirm-delete>Ya, Hapus</button></div></div>');
    $('#modal-root [data-cancel-delete]').addEventListener('click', closeModal);
    $('#modal-root [data-confirm-delete]').addEventListener('click', () => {
      state.internalAccounts = state.internalAccounts.filter((item) => item.id !== account.id);
      state.users = state.internalAccounts;
      persist();
      closeModal();
      render();
    });
  }));
  document.querySelectorAll('[data-toggle-account]').forEach((button) => button.addEventListener('click', () => { if (!isMasterAdminSession()) return; const account = state.internalAccounts.find((item) => item.id === button.dataset.toggleAccount); if (!account || account.role === 'master_admin') return; account.status = account.status === 'Aktif' ? 'Nonaktif' : 'Aktif'; account.active = account.status === 'Aktif'; persist(); render(); }));
  document.querySelectorAll('[data-edit-account]').forEach((button) => button.addEventListener('click', () => {
    if (!isMasterAdminSession()) return;
    const account = state.internalAccounts.find((item) => item.id === button.dataset.editAccount);
    if (!account || account.role === 'master_admin') return;
    openInputModal('Edit Role Akun', 'Kode role internal', account.role, (role) => {
      if (!roles[role]) { alert('Kode role tidak dikenali.'); return; }
      account.role = role;
      account.roles = [roles[role].label];
      persist();
      render();
    }, { placeholder: 'maahad, kepsek, guru, musyrif, security' });
  }));
  document.querySelectorAll('[data-delete-student]').forEach((button) => button.addEventListener('click', (e) => {
    e.preventDefault();
    if (!currentRoleIsAdmin()) return;
    const student = state.students.find((item) => item.id === button.dataset.deleteStudent);
    if (!student) return;
    openConfirmModal('Hapus Data Santri', `Hapus data ${student.name}? Data historis terkait akan tetap aman.`, () => {
      state.students = state.students.filter((item) => item.id !== student.id);
      state.internalAccounts = state.internalAccounts.filter((item) => item.studentId !== student.id);
      state.pocketBalances = state.pocketBalances.filter((item) => item.studentId !== student.id);
      persist();
      render();
    });
  }));
  document.querySelectorAll('[data-action="add-point"]').forEach((button) => button.addEventListener('click', openPointModal));
  document.querySelectorAll('[data-action="add-grade"]').forEach((button) => button.addEventListener('click', openGradeModal));
  document.querySelectorAll('[data-report-tab]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-report-tab]').forEach((item) => item.classList.toggle('btn-primary', item === button));
    document.querySelectorAll('[data-report-tab]').forEach((item) => item.classList.toggle('btn-ghost', item !== button));
    document.querySelectorAll('[data-report-panel]').forEach((panel) => { panel.hidden = panel.dataset.reportPanel !== button.dataset.reportTab; });
  }));
  document.querySelectorAll('[data-action="add-tahfizh"]').forEach((button) => button.addEventListener('click', () => {
    if (!hasTahfizhAccess()) return;
    openTahfizhModal();
  }));
  document.querySelectorAll('[data-action="add-tahfizh-attendance"]').forEach((button) => button.addEventListener('click', () => {
    if (hasTahfizhAccess()) openTahfizhAttendanceModal();
  }));
  document.querySelectorAll('[data-edit-tahfizh]').forEach((button) => button.addEventListener('click', () => openTahfizhModal(state.tahfizh.find((item) => item.id === button.dataset.editTahfizh))));
  document.querySelectorAll('[data-action="add-announcement"]').forEach((button) => button.addEventListener('click', () => { if (canManageAnnouncements()) openAnnouncementModal(); }));
  document.querySelectorAll('[data-edit-announcement]').forEach((button) => button.addEventListener('click', () => { if (canManageAnnouncements()) openAnnouncementModal(state.announcements.find((item) => item.id === button.dataset.editAnnouncement)); }));
  document.querySelectorAll('[data-delete-announcement]').forEach((button) => button.addEventListener('click', () => {
    if (!canManageAnnouncements()) return;
    state.announcements = state.announcements.filter((item) => item.id !== button.dataset.deleteAnnouncement);
    persist();
    render();
  }));
  document.querySelectorAll('[data-action="add-class"], [data-edit-class]').forEach((button) => button.addEventListener('click', () => openClassModal(button.dataset.editClass && state.classes.find((item) => item.id === button.dataset.editClass))));
  document.querySelectorAll('[data-action="add-major"], [data-edit-major]').forEach((button) => button.addEventListener('click', () => openMajorModal(button.dataset.editMajor && (state.majors || majors).find((item) => item.id === button.dataset.editMajor))));
  document.querySelectorAll('[data-action="add-teacher"], [data-edit-teacher]').forEach((button) => button.addEventListener('click', () => openTeacherModal(button.dataset.editTeacher && state.teachers.find((item) => item.id === button.dataset.editTeacher))));
  document.querySelectorAll('[data-action="add-account"]').forEach((button) => button.addEventListener('click', openAccountModal));
  document.querySelectorAll('[data-action="add-billing"]').forEach((button) => button.addEventListener('click', openBillingModal));
  document.querySelectorAll('[data-edit-billing]').forEach((button) => button.addEventListener('click', () => { if (canManageFinance()) openBillingModal(state.financeBills.find((bill) => bill.id === button.dataset.editBilling)); }));
  document.querySelectorAll('[data-action="export"]').forEach((button) => button.addEventListener('click', () => {
    const content = $('#main-content')?.innerHTML || '<h1>Laporan BoardingPro</h1>';
    downloadDocumentPdf(`<article class="document-container">${kopSuratHtml()}<h2>Laporan BoardingPro</h2>${content}</article>`, `Laporan-BoardingPro-${today}`, '@page{size:A4 portrait;margin:15mm}');
  }));
  const permit = $('#permit-form');
  if (permit) permit.addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(permit); const requestedDays = Math.min(3, Math.max(1, Number(form.get('requestedDays') || 1))); const submittedAt = new Date().toISOString(); const permitId = `IZN-${Date.now()}`; const parent = currentAccount(); state.permits.unshift({ id: permitId, studentId: sanitizeInput(form.get('studentId')), type: sanitizeInput(form.get('type')), reason: sanitizeInput(form.get('reason')), date: sanitizeInput(form.get('date')), requestedDays, approvedDays: null, endDate: null, status: 'Pending', approvedBy: null, approvedAt: null, applicantName: parent?.name || parent?.nama || 'Orang Tua / Wali', applicantSignature: '[ TERVERIFIKASI DIGITAL WALI SANTRI ]', applicantSignedAt: submittedAt, applicantQrPayload: { documentId: permitId, documentType: 'permit', role: 'parent' }, checkout: null, checkin: null }); persist(); alert('Pengajuan izin berhasil dikirim.'); render(); });
  const musyrifPermit = $('#musyrif-permit-form');
  if (musyrifPermit) musyrifPermit.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(musyrifPermit);
    const category = sanitizeInput(form.get('kategori_izin'));
    const studentId = sanitizeInput(form.get('studentId'));
    if (category === 'Keluar Mandiri' && weeklyQuotaUsed(studentId, form.get('date')) >= QUOTA_LIMIT) {
      alert('Kuota Keluar Mandiri Minggu Ini Habis');
      return;
    }
    state.permits.unshift({
      id: `IZN-${Date.now()}`, studentId, kategori_izin: category, type: category,
      is_quota_deducted: !quotaFreeCategories.includes(category), weekly_quota_used: weeklyQuotaUsed(studentId, form.get('date')),
      reason: sanitizeInput(form.get('reason')), date: sanitizeInput(form.get('date')), requestedDays: 1, approvedDays: null,
      endDate: null, status: 'Pending', approvedBy: null, approvedAt: null, rejectionReason: null,
      requestedBy: roles[effectiveRole()]?.label || 'Musyrif', checkout: null, checkin: null
    });
    persist();
    alert('Pengajuan izin berhasil dicatat.');
    render();
  });
  const securityPermit = $('#security-permit-form');
  if (securityPermit) securityPermit.addEventListener('submit', (event) => { event.preventDefault(); if (!canManageSecurity()) return; const form = new FormData(securityPermit); state.permits.unshift({ id: `IZN-${Date.now()}`, studentId: sanitizeInput(form.get('studentId')), type: sanitizeInput(form.get('type')), reason: sanitizeInput(form.get('reason')), date: sanitizeInput(form.get('date')), status: 'Pending', approvedBy: null, requestedBy: roles.security.label, checkout: null, checkin: null }); persist(); alert('Pengajuan dicatat dan menunggu approval.'); render(); });
  const payment = $('#payment-form');
  if (payment) {
    const receipt = $('#upload-receipt');
    if (receipt) receipt.addEventListener('change', () => { const status = $('#receipt-scan-status'); const file = receipt.files[0]; if (!file) return; if (status) status.textContent = 'Memindai Bukti Transfer...'; window.setTimeout(() => { const candidate = file.name.match(/(?:rp|nominal|amount|transfer)[^\d]*(\d[\d.,]*)/i); const digits = candidate ? candidate[1].replace(/[.,]/g, '') : ''; const amount = payment.querySelector('[name="amount"]'); if (digits && amount) amount.value = digits; if (status) status.textContent = digits ? `Pemindaian selesai. Nominal terdeteksi: Rp ${Number(digits).toLocaleString('id-ID')}. Silakan pastikan benar.` : 'Pemindaian selesai. Nominal tidak terbaca otomatis; silakan isi manual.'; }, 700); });
    payment.addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(payment); const student = currentStudent(); const itemId = `PAY-${Date.now()}`; const submittedAt = new Date().toISOString(); const parent = currentAccount(); const item = { id: itemId, studentId: student.id, category: form.get('category'), period: form.get('period'), amount: Number(form.get('amount')), method: form.get('method'), status: 'pending_verification', submittedAt, proof: form.get('proof'), receiptImage: form.get('receiptImage')?.name || null, applicantName: parent?.name || parent?.nama || 'Orang Tua / Wali', applicantQrPayload: { documentId: itemId, documentType: 'invoice', role: 'parent' } }; state.payments.unshift(item); const notice = { id: `notif-payment-${item.id}`, title: `Pembayaran baru A.N ${student.name}`, description: 'Memerlukan konfirmasi verifikasi.', category: 'Keuangan', timestamp: 'Baru', targetView: 'payments', createdAt: new Date().toISOString(), read: false }; ['maahad'].forEach((role) => roleNotifications[role].unshift(clone(notice))); persistNotificationState(); persist(); alert('Konfirmasi pembayaran berhasil dikirim.'); render(); });
  }
  const topup = $('#pocket-topup-form');
  if (topup) topup.addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(topup); state.pocketTransactions.push({ id: `TRX-${Date.now()}`, studentId: currentStudent().id, date: today, type: 'Top Up', amount: Number(form.get('amount')), note: form.get('note') || `Top up ${form.get('method')}`, method: form.get('method'), status: 'Pending' }); persist(); alert('Pengajuan top up berhasil dikirim dan menunggu verifikasi admin.'); render(); });
  const expense = $('#pocket-expense-form');
  if (expense) expense.addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(expense); const amount = Number(form.get('amount')); const balance = state.pocketBalances.find((item) => item.studentId === form.get('studentId')); if (!balance || Number(balance.balance || 0) < amount) { alert('Saldo uang saku tidak mencukupi.'); return; } balance.balance -= amount; state.pocketTransactions.push({ id: `TRX-${Date.now()}`, studentId: form.get('studentId'), date: today, type: 'Pengeluaran', amount, note: form.get('note'), status: 'Verified', by: roles[state.role].label }); persist(); alert('Pengeluaran dicatat dan saldo diperbarui.'); render(); });
  const teacherAttendance = $('#teacher-attendance-form');
  if (teacherAttendance) teacherAttendance.addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(teacherAttendance); state.teacherAttendance.unshift({ id: `TA-${Date.now()}`, teacher: state.displayName || roles.guru.demoName, date: today, status: form.get('status'), checkIn: form.get('checkIn') || null, checkOut: form.get('checkOut') || null }); persist(); alert('Presensi pribadi tersimpan.'); render(); });
  const adminPassword = $('#admin-password-form');
  if (adminPassword) adminPassword.addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(adminPassword); const account = currentAccount(); const currentPassword = String(form.get('currentPassword') || ''); const newPassword = String(form.get('newPassword') || ''); if (!account || account.password !== currentPassword) { alert('Password saat ini tidak sesuai.'); return; } if (!isMasterAdminSession() && (account.passwordChangeCount || 0) >= 2) { alert('Batas maksimal perubahan kata sandi mandiri telah tercapai (2/2 kali). Untuk melakukan perubahan/reset kata sandi kembali, silakan hubungi Admin Mahad.'); return; } if (newPassword.length < 10 || newPassword !== String(form.get('confirmPassword') || '')) { alert('Password baru minimal 10 karakter dan harus sama dengan konfirmasi.'); return; } account.password = newPassword; if (!isMasterAdminSession()) account.passwordChangeCount = (account.passwordChangeCount || 0) + 1; state.currentUser = account; persist(); adminPassword.reset(); alert('Password berhasil diubah.'); });
}
function openStudentModal(student) {
  if (!currentRoleIsAdmin()) return;
  const editing = Boolean(student && student.id);
  const value = (key, fallback = '') => student && student[key] !== undefined ? student[key] : fallback;
  openModal(editing ? 'Edit Data Santri' : 'Tambah Santri Baru', `<form id="student-modal-form" class="form-grid"><label>Nama Lengkap<input name="name" value="${escapeHtml(value('name'))}" required></label><label>NIS<input name="nis" value="${escapeHtml(value('nis'))}" required></label><label>Program<select id="student-program" name="program">${programs.map((program) => `<option value="${program.id}" ${value('program', 'SMK') === program.id ? 'selected' : ''}>${program.name}</option>`).join('')}</select></label><label id="student-class-field">Kelas<input name="className" value="${escapeHtml(value('className', 'X'))}"></label><label id="student-major-field">Jurusan<select id="student-major" name="major"><option value="">Tanpa Jurusan</option>${currentMajors().map((major) => `<option value="${major.id}" ${value('major', currentMajors()[0]?.id || '') === major.id ? 'selected' : ''}>${escapeHtml(major.name)}</option>`).join('')}</select></label><label>Nama Wali<input name="parent" value="${escapeHtml(value('parent'))}"></label><label>No HP Wali (opsional)<input name="parentPhone" value="${escapeHtml(value('parentPhone', value('phone')))}" inputmode="tel"></label><button type="submit" class="btn btn-primary full">${editing ? 'Simpan Perubahan' : 'Simpan Data'}</button></form>`);
  const studentProgram = $('#student-program');
  const updateStudentProgram = () => { const special = ['PPTAK', 'KWNQ'].includes(studentProgram.value); $('#student-class-field').hidden = special; $('#student-major-field').hidden = special; if (special) { $('#student-major').value = ''; } };
  studentProgram.addEventListener('change', updateStudentProgram);
  updateStudentProgram();
  $('#student-modal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const values = { name: sanitizeInput(form.get('name')), nis: sanitizeInput(form.get('nis')), program: form.get('program'), major: form.get('major'), className: sanitizeInput(form.get('className')), room: sanitizeInput(form.get('room')), parent: sanitizeInput(form.get('parent')), parentPhone: sanitizeInput(form.get('parentPhone')), phone: sanitizeInput(form.get('parentPhone')) };
    if (editing) {
      Object.assign(student, values);
    } else {
      const newStudent = { id: `STD-${String(state.students.length + 1).padStart(3, '0')}`, gender: 'L', grade: 10, semester: 1, phone: '', attendance: 100, points: 0, tahfizh: 0, spp: 'Lunas', status: 'Aktif', ...values };
      state.students.push(newStudent);
      const nis = String(newStudent.nis).trim();
      const credentials = [
        { id: `ACC-${Date.now()}-S`, role: 'student', username: nis, password: nis, name: newStudent.name, studentId: newStudent.id, status: 'Aktif', passwordChangeCount: 0 },
        { id: `ACC-${Date.now()}-P`, role: 'parent', username: `ortu_${nis}`, password: 'wali123', name: newStudent.parent || 'Orang Tua / Wali', studentId: newStudent.id, status: 'Aktif', passwordChangeCount: 0 }
      ];
      state.internalAccounts.push(...credentials);
      state.users = state.internalAccounts;
      persist();
      closeModal();
      openStudentCredentialsModal(newStudent);
      return;
    }
    persist();
    closeModal();
    render();
  });
}
function studentCredentials(student) {
  return state.internalAccounts.filter((account) => account.studentId === student?.id);
}
function credentialSlipHtml(student) {
  const accounts = studentCredentials(student);
  return `<article class="document-container credential-slip" style="padding:28px;background:#fff;color:#0f172a"><h1 style="text-align:center;font-size:18px;margin:0 0 4px">SLIP KREDENSIAL AKUN</h1><p style="text-align:center;margin:0 0 20px;color:#64748b">BoardingPro STK IS</p><table class="info-table"><tr><th>Nama Santri</th><td>${escapeHtml(student.name)}</td></tr><tr><th>NIS</th><td>${escapeHtml(student.nis)}</td></tr><tr><th>Wali</th><td>${escapeHtml(student.parent || 'Orang Tua / Wali')}</td></tr></table>${accounts.map((account) => `<section style="border:1px solid #cbd5e1;border-radius:8px;padding:14px;margin-top:12px"><b>${account.role === 'parent' ? 'Akun Orang Tua / Wali' : 'Akun Santri'}</b><p style="margin:8px 0 2px">Username: <strong>${escapeHtml(account.username)}</strong></p><p style="margin:0">Password: <strong>${escapeHtml(account.password)}</strong></p></section>`).join('')}<p style="margin-top:24px;font-size:10px;color:#64748b">Simpan slip ini dengan aman dan segera ganti password setelah login.</p></article>`;
}
function openStudentCredentialsModal(student) {
  if (!currentRoleIsAdmin() || !student) return;
  const title = `Kredensial - ${student.name}`;
  openModal(title, `<div id="student-credential-slip">${credentialSlipHtml(student)}</div><div class="actions-inline" style="justify-content:flex-end;margin-top:16px"><button type="button" class="btn btn-ghost" data-credential-reset>Reset Password</button><button type="button" class="btn btn-ghost" data-credential-pdf>Export PDF</button><button type="button" class="btn btn-primary" data-credential-print>Print Slip</button></div>`);
  const resetButton = $('#modal-root [data-credential-reset]');
  resetButton.addEventListener('click', () => {
    const accounts = studentCredentials(student);
    accounts.forEach((account) => { account.password = account.role === 'parent' ? 'wali123' : String(student.nis); account.passwordChangeCount = 0; });
    persist();
    openStudentCredentialsModal(student);
  });
  $('#modal-root [data-credential-pdf]').addEventListener('click', () => downloadDocumentPdf(credentialSlipHtml(student), title, '@page{size:A4 portrait;margin:15mm}'));
  $('#modal-root [data-credential-print]').addEventListener('click', () => printDocumentInFrame(credentialSlipHtml(student), title, '@page{size:A4 portrait;margin:15mm}'));
}
function openMajorModal(major) {
  if (!currentRoleIsAdmin()) return;
  const editing = Boolean(major);
  const value = (key, fallback = '') => major && major[key] !== undefined ? major[key] : fallback;
  openModal(editing ? 'Edit Jurusan SMK' : 'Tambah Jurusan SMK', `<form id="major-modal-form" class="form-grid"><label>Kode Jurusan<input id="major-code" name="id" value="${escapeHtml(value('id'))}" required pattern="[A-Za-z0-9_\\-]+"></label><label class="full">Nama Jurusan<input id="major-name" name="name" value="${escapeHtml(value('name'))}" required></label><button type="submit" class="btn btn-primary full">Simpan Jurusan</button></form>`);
  bindMajorCodeGenerator();
  $('#major-modal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const id = String(form.get('id')).trim().toUpperCase();
    const name = String(form.get('name')).trim();
    if (!id || !name) return;
    const collection = state.majors || (state.majors = clone(majors));
    if (editing) {
      const previousId = major.id;
      if (id !== previousId && collection.some((item) => item !== major && item.id === id)) { alert('Kode jurusan sudah digunakan.'); return; }
      major.id = id;
      major.name = name;
      state.classes.forEach((klass) => { if (klass.majorId === previousId) klass.majorId = id; });
      state.students.forEach((student) => { if (student.major === previousId) student.major = id; });
    }
    else if (collection.some((item) => item.id === id)) { alert('Kode jurusan sudah digunakan.'); return; }
    else collection.push({ id, programId: 'SMK', name });
    persist();
    closeModal();
    render();
  });
}
function bindMajorCodeGenerator() {
  const majorCode = $('#major-code');
  const majorName = $('#major-name');
  if (!majorCode || !majorName || majorCode.dataset.bound === 'true') return;
  majorCode.dataset.bound = 'true';
  majorCode.dataset.userEdited = 'false';
  majorCode.addEventListener('input', () => { majorCode.dataset.userEdited = 'true'; });
  majorName.addEventListener('input', () => {
    if (majorCode.dataset.userEdited === 'true') return;
    majorCode.value = majorName.value.trim().split(/\s+/).filter(Boolean).map((word) => word[0]).join('').toUpperCase();
  });
}
function openClassModal(klass) {
  if (!currentRoleIsAdmin()) return;
  const editing = Boolean(klass);
  const value = (key, fallback = '') => klass && klass[key] !== undefined ? klass[key] : fallback;
  openModal(editing ? 'Edit Kelas' : 'Tambah Kelas', `<form id="class-modal-form" class="form-grid"><label>Nama Kelas<input name="name" value="${escapeHtml(value('name'))}" required></label><label>Program<select id="class-program" name="programId">${programs.map((program) => `<option value="${program.id}" ${value('programId', 'SMK') === program.id ? 'selected' : ''}>${program.name}</option>`).join('')}</select></label><label>Jurusan SMK<select id="class-major" name="majorId"><option value="">Tanpa Jurusan</option>${currentMajors().map((major) => `<option value="${major.id}" ${value('majorId', '') === major.id ? 'selected' : ''}>${escapeHtml(major.name)}</option>`).join('')}</select></label><label>Wali Kelas<input name="wali" value="${escapeHtml(value('wali'))}" required></label><button type="submit" class="btn btn-primary full">Simpan</button></form>`);
  const classProgram = $('#class-program');
  const classMajor = $('#class-major');
  const updateClassProgram = () => { const special = ['PPTAK', 'KWNQ'].includes(classProgram.value); classMajor.disabled = special; if (special) classMajor.value = ''; };
  classProgram.addEventListener('change', updateClassProgram);
  updateClassProgram();
  $('#class-modal-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.target); const values = { name: form.get('name'), programId: form.get('programId'), majorId: form.get('majorId'), wali: form.get('wali') }; if (editing) Object.assign(klass, values); else state.classes.push({ id: `CLS-${Date.now()}`, studentIds: [], ...values }); persist(); closeModal(); render(); });
}
function openTeacherModal(teacher) {
  if (!currentRoleIsAdmin()) return;
  const editing = Boolean(teacher);
  const value = (key, fallback = '') => teacher && teacher[key] !== undefined ? teacher[key] : fallback;
  const assignedClasses = new Set((state.teachingAssignments || []).filter((item) => item.teacherId === teacher?.id).map((item) => item.classId));
  const classOptions = (state.classes || []).map((klass) => `<label class="role-option"><input type="checkbox" name="classIds" value="${klass.id}" ${assignedClasses.has(klass.id) ? 'checked' : ''}> ${escapeHtml(klass.name)}</label>`).join('');
  openModal(editing ? 'Edit Guru' : 'Tambah Guru', `<form id="teacher-modal-form" class="form-grid"><label>Nama<input name="name" value="${escapeHtml(value('name'))}" required></label><label>Mata Pelajaran (pisahkan koma untuk multi-mapel)<input name="subject" value="${escapeHtml(value('subject'))}" required></label><label>Peran<select name="role"><option>Guru</option><option>Pembina</option><option>Admin</option></select></label><label>Telepon (opsional)<input name="phone" value="${escapeHtml(value('phone'))}"></label><div class="full role-options">${classOptions}</div><button class="btn btn-primary full">Simpan</button></form>`);
  $('#teacher-modal-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.target); const values = { name: String(form.get('name')).trim(), subject: String(form.get('subject')).trim(), role: form.get('role'), phone: String(form.get('phone') || '').trim(), status: 'Aktif' }; const savedTeacher = editing ? Object.assign(teacher, values) : (state.teachers.push({ id: `TCH-${Date.now()}`, ...values }), state.teachers[state.teachers.length - 1]); state.teachingAssignments = (state.teachingAssignments || []).filter((item) => item.teacherId !== savedTeacher.id); form.getAll('classIds').forEach((classId) => { const klass = state.classes.find((item) => item.id === classId); values.subject.split(',').map((subject) => subject.trim()).filter(Boolean).forEach((subject) => state.teachingAssignments.push({ id: `ASG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, teacherId: savedTeacher.id, teacherName: savedTeacher.name, classId, className: klass?.name || classId, subject, type: /tahfizh|hafalan/i.test(subject) ? 'tahfizh' : 'umum' })); }); persist(); closeModal(); render(); });
}
function openAccountModal() {
  if (!currentRoleIsAdmin()) return;
  const roleOptions = () => masterRoles().map((role, index) => `<label class="role-option"><input type="checkbox" name="roles" value="${escapeHtml(role)}" ${index === 0 ? 'checked' : ''}> <span>${escapeHtml(role)}</span></label>`).join('');
  openModal('Buat Akun Staf Internal', `<form id="account-modal-form" class="form-grid"><label>Nama Lengkap<input id="nama-staf" name="name" required></label><label>Username / ID<input id="username-staf" name="username" required autocomplete="off"></label><div class="full role-assignment"><div class="role-assignment-head"><b>Penugasan Peran</b><button type="button" class="btn btn-small btn-ghost" id="add-master-role">+ Tambah Opsi Peran</button></div><div id="master-role-options" class="role-options">${roleOptions()}</div></div><label>Password<input name="password" value="123456" required></label><label class="full"><input type="checkbox" name="isTahfizhTeacher"> Bertugas sebagai Guru/Ustadz Tahfizh</label><label class="full"><input type="checkbox" name="isMusyrif"> Bertugas sebagai Musyrif/Pembina Asrama</label><button type="submit" class="btn btn-primary full">Simpan Akun</button></form>`);
  const nameInput = $('#nama-staf');
  const usernameInput = $('#username-staf');
  nameInput.addEventListener('input', () => {
    if (usernameInput.dataset.manual === 'true') return;
    usernameInput.value = compactUsername(nameInput.value);
  });
  usernameInput.addEventListener('input', () => { usernameInput.dataset.manual = 'true'; });
  $('#add-master-role').addEventListener('click', () => {
    openInputModal('Tambah Opsi Peran', 'Nama peran baru', '', (roleName) => {
      saveMasterRoles([...masterRoles(), roleName]);
      const optionsRoot = $('#master-role-options');
      if (optionsRoot) optionsRoot.innerHTML = roleOptions();
    });
  });
  $('#account-modal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const username = String(form.get('username')).trim();
    const selectedRoles = form.getAll('roles').map((role) => String(role).trim()).filter(Boolean);
    if (!selectedRoles.length) { alert('Pilih minimal satu peran.'); return; }
    if (state.internalAccounts.some((account) => account.username === username)) { alert('Username sudah digunakan.'); return; }
    state.internalAccounts.push({ id: `ACC-${Date.now()}`, name: form.get('name'), username, password: form.get('password'), passwordChangeCount: 0, roles: selectedRoles, role: selectedRoles[0], isTahfizhTeacher: form.get('isTahfizhTeacher') === 'on', isMusyrif: form.get('isMusyrif') === 'on' });
    persist();
    closeModal();
    render();
  });
}
function openBillingModal(bill) {
  if (!canManageFinance()) return;
  const editing = Boolean(bill);
  const value = (key, fallback = '') => bill && bill[key] !== undefined ? bill[key] : fallback;
  const categories = [financeCategories.spp, financeCategories.foundation, ...financeCategories.maahadNonSpp, financeCategories.pocketMoney, financeCategories.custom];
  openModal(editing ? 'Edit Komponen Tagihan' : 'Tambah Komponen Tagihan', `<form id="billing-modal-form" class="form-grid"><label>Santri<select name="studentId">${state.students.map((student) => `<option value="${student.id}" ${value('studentId', state.students[0]?.id) === student.id ? 'selected' : ''}>${student.name}</option>`).join('')}</select></label><label>Komponen<select name="category">${categories.map((category) => `<option value="${category.id}" ${value('category', category.id) === category.id ? 'selected' : ''}>${category.label}</option>`).join('')}</select></label><label>Nama Tagihan<input name="label" value="${escapeHtml(value('label'))}" placeholder="Contoh: Kegiatan akhir semester" required></label><label>Nominal (Rp)<input name="amount" type="number" min="0" value="${value('amount', 0)}" required></label><label>Beasiswa (Rp)<input name="scholarship" type="number" min="0" value="${value('scholarship', 0)}"></label><label>Diskon (Rp)<input name="discount" type="number" min="0" value="${value('discount', 0)}"></label><label>Jatuh Tempo<input name="dueDate" type="date" value="${value('dueDate', today)}" required></label><button class="btn btn-primary full">Simpan Tagihan</button></form>`);
  $('#billing-modal-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.target); const values = { studentId: form.get('studentId'), category: form.get('category'), label: form.get('label'), period: 'September 2026', amount: Number(form.get('amount')), scholarship: Number(form.get('scholarship')), discount: Number(form.get('discount')), dueDate: form.get('dueDate') }; if (editing) Object.assign(bill, values); else state.financeBills.unshift({ id: `BILL-${Date.now()}`, status: 'Open', ...values }); persist(); closeModal(); render(); });
}
function openPointModal() {
  if (!canManageDormitory()) return;
  openModal('Input Poin Kedisiplinan', `<form id="point-modal-form" class="form-grid"><label>Santri<select name="studentId">${state.students.map((student) => `<option value="${student.id}">${student.name}</option>`).join('')}</select></label><label>Jenis<select name="kind"><option value="prestasi">Prestasi (+)</option><option value="pelanggaran">Pelanggaran (-)</option></select></label><label>Nilai<input name="value" type="number" value="5" min="1"></label><label class="full">Catatan<input name="note" required></label><button class="btn btn-primary full">Simpan Poin</button></form>`);
  $('#point-modal-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.target); const value = Number(form.get('value')) * (form.get('kind') === 'pelanggaran' ? -1 : 1); state.points.unshift({ id: `PT-${Date.now()}`, studentId: form.get('studentId'), kind: form.get('kind'), note: form.get('note'), value, date: today }); const student = studentById(form.get('studentId')); student.points += value; persist(); closeModal(); render(); });
}
function openGradeModal() {
  if (!['mahad', 'admin', 'kepsek', 'guru'].includes(effectiveRole())) return;
  openModal('Input Nilai Pelajaran', `<form id="grade-modal-form" class="form-grid"><label>Santri<select name="studentId">${state.students.map((student) => `<option value="${student.id}">${student.name}</option>`).join('')}</select></label><label>Mata Pelajaran<input name="subject" required></label><label>Nilai<input name="score" type="number" min="0" max="100" required></label><label class="full">Catatan<input name="note"></label><button class="btn btn-primary full">Simpan Nilai</button></form>`);
  $('#grade-modal-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.target); state.grades.unshift({ id: `GR-${Date.now()}`, studentId: form.get('studentId'), subject: form.get('subject'), score: Number(form.get('score')), note: form.get('note') }); persist(); closeModal(); render(); });
}
function openTahfizhModal(record) {
  if (!hasTahfizhAccess()) return;
  const editing = Boolean(record);
  const value = (key, fallback = '') => record && record[key] !== undefined ? record[key] : fallback;
  openModal(editing ? 'Edit Setoran Tahfizh' : 'Input Setoran Tahfizh', `<form id="tahfizh-modal-form" class="form-grid"><label>Santri<select name="studentId">${state.students.map((student) => `<option value="${student.id}" ${value('studentId') === student.id ? 'selected' : ''}>${student.name}</option>`).join('')}</select></label><label>Jenis<select name="type"><option ${value('type') === 'Ziyadah' ? 'selected' : ''}>Ziyadah</option><option ${value('type') === 'Murajaah' ? 'selected' : ''}>Murajaah</option></select></label><label>Predikat<select name="predikat"><option>Mutqin</option><option>Ziyadah</option></select></label><label>Juz<input name="juz" type="number" min="1" value="${value('juz')}" required></label><label>Surah<input name="surah" value="${escapeHtml(value('surah'))}" required></label><label class="full">Ayat<input name="ayat" value="${escapeHtml(value('ayat'))}" required></label><button type="submit" class="btn btn-primary full">${editing ? 'Simpan Perubahan' : 'Simpan Setoran'}</button></form>`);
  $('#tahfizh-modal-form').addEventListener('submit', (event) => { event.preventDefault(); if (!(currentRoleIsAdmin() || hasTahfizhAccess())) return; const form = new FormData(event.target); const values = { studentId: form.get('studentId'), juz: Number(form.get('juz')), surah: form.get('surah'), ayat: form.get('ayat'), type: form.get('type'), predikat: form.get('predikat') }; if (editing) Object.assign(record, values); else state.tahfizh.unshift({ id: `TH-${Date.now()}`, ...values, status: 'Menunggu', date: today }); persist(); closeModal(); render(); });
}
function openTahfizhAttendanceModal() {
  if (!hasTahfizhAccess()) return;
  openModal('Input Absensi Jam Tahfizh', `<form id="tahfizh-attendance-form" class="form-grid"><label>Santri<select name="studentId">${state.students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)} ? ${escapeHtml(student.nis)}</option>`).join('')}</select></label><label>Tanggal<input name="date" type="date" value="${today}" required></label><label>Status<select name="status"><option>Hadir</option><option>Izin</option><option>Sakit</option><option>Alpa</option></select></label><label class="full">Catatan<input name="note" placeholder="Catatan jam Tahfizh"></label><button class="btn btn-primary full">Simpan Absensi</button></form>`);
  $('#tahfizh-attendance-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!hasTahfizhAccess()) return;
    const form = new FormData(event.target);
    state.attendance.unshift({ id: `ATT-TH-${Date.now()}`, type: 'tahfizh', studentId: form.get('studentId'), date: form.get('date'), status: form.get('status'), by: roles[effectiveRole()]?.label || roles.mahad.label, note: form.get('note') || '' });
    persist();
    closeModal();
    render();
  });
}
function openAnnouncementModal(announcement) {
  if (!canManageAnnouncements()) return;
  const editing = Boolean(announcement);
  const value = (key, fallback = '') => announcement && announcement[key] !== undefined ? announcement[key] : fallback;
  openModal(editing ? 'Edit Pengumuman' : 'Buat Pengumuman', `<form id="announcement-modal-form" class="form-grid"><label>Judul<input name="title" value="${escapeHtml(value('title'))}" required></label><label>Tanggal<input name="date" type="date" value="${escapeHtml(value('date', today))}" required></label><label class="full">Detail<textarea name="detail" required>${escapeHtml(value('detail'))}</textarea></label><button class="btn btn-primary full">${editing ? 'Simpan Perubahan' : 'Terbitkan'}</button></form>`);
  $('#announcement-modal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const values = { title: form.get('title'), detail: form.get('detail'), date: form.get('date') };
    if (editing) Object.assign(announcement, values);
    else state.announcements.unshift({ id: `ANN-${Date.now()}`, ...values, author: roles[state.role].label });
    persist();
    closeModal();
    render();
  });
}
function openSecurityReportModal(kind) {
  if (!canManageSecurity()) return;
  const isIncident = kind === 'incident';
  const title = isIncident ? 'Buat Laporan Darurat' : 'Laporan Penemuan / Kehilangan Barang';
  const content = isIncident
    ? `<form id="security-report-form" class="form-grid"><label>Jenis Kejadian<input name="type" required placeholder="Contoh: Kebakaran, keributan"></label><label>Lokasi<input name="location" required></label><label>Tingkat Bahaya<select name="level"><option>Tinggi</option><option>Sedang</option><option>Rendah</option></select></label><label class="full">Deskripsi Singkat<textarea name="description" required></textarea></label><button class="btn btn-primary full">Simpan Laporan</button></form>`
    : `<form id="security-report-form" class="form-grid"><label>Nama Barang<input name="itemName" required></label><label>Lokasi Ditemukan<input name="location" required></label><label>Foto / Deskripsi<input name="photoDescription" required placeholder="Nama file foto atau deskripsi"></label><label>Tanggal / Waktu<input name="dateTime" type="datetime-local" required></label><label>Status<select name="status"><option>Diamankan Pos</option><option>Diserahkan</option></select></label><button class="btn btn-primary full">Simpan Laporan</button></form>`;
  openModal(title, content);
  $('#security-report-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const record = Object.fromEntries(form.entries());
    if (isIncident) state.incidents.unshift({ id: `INC-${Date.now()}`, ...record, createdBy: roles.security.label, status: 'Baru', createdAt: new Date().toISOString() });
    else state.lostFound.unshift({ id: `LF-${Date.now()}`, ...record, createdBy: roles.security.label });
    persist();
    closeModal();
    render();
  });
}
function generatePermitNumber(permitId) {
  const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const numericId = String(permitId || '').replace(/\D/g, '');
  const paddedId = String(Number(numericId || 0) % 1000).padStart(3, '0');
  const date = new Date();
  return `${paddedId}/PERMIT-MAHAD/${romanMonths[date.getMonth()]}/${date.getFullYear()}`;
}
function renderPermitLetter(permitId, print = false) {
  if (!verifyDocumentAccess('permit', effectiveRole())) {
    console.warn('[BoardingPro] Akses Surat Izin ditolak.');
    return null;
  }
  const permit = typeof permitId === 'object' ? permitId : state.permits.find((item) => item.id === permitId);
  if (!permit || !['approved', 'terverifikasi'].includes(String(permit.status).toLowerCase())) return;
  if (!permit.letterNumber) { permit.letterNumber = generatePermitNumber(permit.id); persist(); }
  const student = studentById(permit.studentId);
  const endDate = permit.endDate || permit.date;
  const institution = state.config?.institution || {};
  const securityHash = permit.securityHash || `STKIS-${btoa(`${permit.id}|${permit.letterNumber}|${student.nis}`).replace(/[^A-Z0-9]/gi, '').slice(0, 16).toUpperCase()}`;
  permit.securityHash = securityHash;
  const signatureBlock = `<div class="signature-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:28px;max-width:100%">${signatureQrHtml('Pemohon', permit.applicantName || student.parent || 'Orang Tua / Wali', permit.applicantSignedAt, permit.applicantQrPayload || { documentId: permit.id, documentType: 'permit', role: 'parent' })}${signatureQrHtml('Mengetahui & Menyetujui', permit.approvedBy || 'Belum diverifikasi', permit.approvedAt || permit.verifiedAt || new Date().toISOString(), permit.verifierQrPayload || { documentId: permit.id, documentType: 'permit', role: 'verifier' })}</div>`;
  const html = `<article class="permit-letter document-container"><style>.permit-letter>div[style*="margin-top:42px"]{display:none!important}</style>${kopSuratHtml()}<div style="border-top:1px solid #111;margin-top:2px"></div><div style="text-align:center;margin:24px 0 18px"><h1 style="font-size:16px;text-decoration:underline;margin:0">SURAT IZIN KELUAR / PULANG SANTRI</h1><p style="margin:6px 0">Nomor: ${escapeHtml(permit.letterNumber)}</p></div><p>Yang bertanda tangan di bawah ini, Pengasuhan ${escapeHtml(institution.school)}, menerangkan dan memberikan izin kepada santri berikut:</p><table style="width:100%;margin:16px 0;border-collapse:collapse;line-height:1.8"><tr><td style="width:35%">Nama Santri</td><td>: <b>${escapeHtml(student.name)}</b></td></tr><tr><td>NIS / NISN</td><td>: ${escapeHtml(student.nis || student.nisn || '?')}</td></tr><tr><td>Kelas / Program</td><td>: ${escapeHtml(student.className)} / ${escapeHtml(student.program || 'Reguler')}</td></tr><tr><td>Orang Tua / Wali Pemohon</td><td>: ${escapeHtml(student.parent || '?')}</td></tr></table><p>Dengan ketentuan izin sebagai berikut:</p><table style="width:100%;margin:12px 0;border-collapse:collapse;line-height:1.8"><tr><td style="width:35%">Alasan Keperluan</td><td>: ${escapeHtml(permit.reason)}</td></tr><tr><td>Tanggal Berangkat</td><td>: ${formatDate(permit.date)}${permit.departureTime ? `, pukul ${escapeHtml(permit.departureTime)}` : ''}</td></tr><tr><td>Wajib Kembali</td><td>: ${formatDate(endDate)}${permit.returnTime ? `, paling lambat pukul ${escapeHtml(permit.returnTime)}` : ''}</td></tr><tr><td>Total Durasi Resmi</td><td>: <b>${permit.approvedDays || permit.requestedDays || 1} hari</b></td></tr></table><div style="border:1px solid #555;padding:10px;margin-top:18px"><b>Catatan Kedisiplinan:</b> Santri wajib kembali sesuai batas waktu yang ditetapkan. Keterlambatan tanpa konfirmasi susulan kepada Mahad dapat dikenakan sanksi sesuai tata tertib yang berlaku.</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:42px;text-align:center"><div>Pemohon,<br><br>${escapeHtml(permit.applicantSignature || '[ TERVERIFIKASI DIGITAL WALI SANTRI ]')}<br><b>( ${escapeHtml(student.parent || 'Orang Tua / Wali')} )</b><br>${permit.applicantSignedAt ? formatDate(permit.applicantSignedAt.slice(0, 10)) : ''}</div><div>Mengetahui & Menyetujui,<br>${escapeHtml(permit.approvedBy || 'Pembina Santri')}<br><span style="display:inline-block;margin:12px 0;border:1px dashed #555;padding:12px">${escapeHtml(permit.officialStamp || 'STEMPEL DIGITAL MAHAD')}</span><br>${escapeHtml(permit.officialSignature || '[ TERVERIFIKASI DIGITAL MAHAD / PEMBINA ]')}<br>Verifikasi: ${formatDate(permit.verifiedAt || today)}</div></div>${signatureBlock}<div style="position:relative;margin-top:38px;text-align:center;color:#64748b;font-size:9px"><div style="opacity:.16;font-size:18px;font-weight:800;letter-spacing:3px">OFFICIAL STK IS DOCUMENT</div><div>Security Hash: ${escapeHtml(securityHash)}</div></div></article>${documentActionButtons('permit', permit.id, 'Print Surat')}`;
  if (print) {
    printDocumentInFrame(html, `Surat Izin - ${permit.letterNumber}`, '@page{size:A4 portrait;margin:15mm}');
    return;
  }
  openModal('Surat Izin Digital', html);
  bindDocumentActions($('#modal-root'), `Surat Izin - ${permit.letterNumber}`, '@page{size:A4 portrait;margin:15mm}');
}
function openScheduleModal(kind) {
  if (!canManageSchool()) return;
  const isSchedule = kind === 'schedule';
  const title = isSchedule ? 'Tambah Jadwal Harian' : 'Tambah Event Mendatang';
  const content = isSchedule
    ? `<form id="schedule-modal-form" class="form-grid"><label>Hari<input name="day" required></label><label>Waktu / Jam<input name="time" required placeholder="07:00-08:30"></label><label>Nama Kegiatan<input name="title" required></label><label>Lokasi<input name="room" required></label><label class="full">Pengampu / Penanggung Jawab<input name="teacher" required></label><button class="btn btn-primary full">Simpan Jadwal</button></form>`
    : `<form id="schedule-modal-form" class="form-grid"><label>Nama Agenda<input name="title" required></label><label>Tanggal Pelaksanaan<input name="date" type="date" required></label><label>Kategori Event<input name="audience" required placeholder="Akademik, Asrama, Umum"></label><label class="full">Keterangan<input name="location" required></label><button class="btn btn-primary full">Simpan Event</button></form>`;
  openModal(title, content);
  $('#schedule-modal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target).entries());
    if (isSchedule) state.schedules.push({ id: `SCH-${Date.now()}`, type: 'Kegiatan', ...values });
    else state.events.push({ id: `EV-${Date.now()}`, status: 'Published', ...values });
    persist();
    closeModal();
    render();
  });
}
function showDashboard() {
  const landing = $('#landing');
  const shell = $('#app-shell');
  if (!landing || !shell) {
    console.error('[BoardingPro] Container landing/app-shell tidak ditemukan.');
    return;
  }
  landing.hidden = true;
  shell.hidden = false;
  renderDashboard();
  startInactivityTimer();
}
function showLanding() {
  stopInactivityTimer();
  const landing = $('#landing');
  const shell = $('#app-shell');
  if (!landing || !shell) return;
  landing.hidden = false;
  shell.hidden = true;
  const selector = $('#demo-role');
  const preview = $('#demo-role-preview');
  if (!selector || !preview) return;
  const updatePreview = () => { const role = roles[selector.value]; preview.textContent = `${role.demoName} ? ${role.description}`; };
  selector.value = state.role;
  selector.onchange = updatePreview;
  updatePreview();
}
document.addEventListener('DOMContentLoaded', () => {
  initializeFirebase().catch((error) => console.error('[BoardingPro] Firebase tidak siap:', error));
  const accountLogin = $('#account-login-form');
  if (accountLogin) accountLogin.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(accountLogin);
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '');
    const account = state.users.find((item) => item.username.toLowerCase() === username.toLowerCase() && item.password === password && item.status !== 'Nonaktif');
    const error = $('#login-error');
    if (!account) {
      if (error) { error.hidden = false; error.textContent = 'Username atau password tidak sesuai.'; }
      return;
    }
    if (error) error.hidden = true;
    state.role = account.role;
    state.activeRoleView = null;
    state.username = account.username;
    state.displayName = account.name;
    state.currentUser = account;
    state.studentId = account.studentId || null;
    state.view = 'dashboard';
    localStorage.setItem('boardingpro-auth', 'true');
    saveAuthenticatedUser();
    persist();
    showDashboard();
    window.setTimeout(showUnreadCriticalNotifications, 120);
  });
  const logout = $('#logout');
  if (logout) logout.addEventListener('click', () => { localStorage.removeItem('boardingpro-auth'); secureStorage.set('boardingpro-user', null).catch((error) => console.error('[BoardingPro] Gagal menghapus sesi terenkripsi:', error)); showLanding(); });
  if (localStorage.getItem('boardingpro-auth') === 'true') {
    saveAuthenticatedUser();
    showDashboard();
  } else showLanding();
});


// --- MODUL REKAP KEHADIRAN GURU ---
const detailHarianGuru = {
  "Ustadz Ahmad, S.Pd.": [
    { tanggal: "2026-09-01", hari: "Selasa", status: "Hadir", jam: 2, catatan: "Nahwu dasar & Percakapan" },
    { tanggal: "2026-09-03", hari: "Kamis", status: "Hadir", jam: 2, catatan: "Latihan Qawaid" },
    { tanggal: "2026-09-04", hari: "Jumat", status: "Izin", jam: 0, catatan: "Acara keluarga" },
    { tanggal: "2026-09-07", hari: "Senin", status: "Hadir", jam: 2, catatan: "Setoran mufradat" }
  ],
  "Ustadzah Siti, M.Ag.": [
    { tanggal: "2026-09-01", hari: "Selasa", status: "Hadir", jam: 2, catatan: "Makhraj huruf" },
    { tanggal: "2026-09-02", hari: "Rabu", status: "Hadir", jam: 2, catatan: "Hukum Tajwid" }
  ]
};

function detailKehadiranGuru(namaGuru) {
  const modal = document.getElementById("modal-detail-guru");
  const modalNama = document.getElementById("modal-nama-guru");
  const tbodyDetail = document.getElementById("tbody-detail-tanggal");
  const modalTotal = document.getElementById("modal-total-ringkasan");

  if (!modal || !tbodyDetail) return;

  const listHarian = detailHarianGuru[namaGuru] || [];
  modalNama.textContent = `Rincian Kehadiran: ${namaGuru}`;
  tbodyDetail.innerHTML = "";

  let totalHadir = 0, totalJam = 0;

  if (listHarian.length === 0) {
    tbodyDetail.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Belum ada riwayat.</td></tr>`;
  } else {
    listHarian.forEach(item => {
      if (item.status === "Hadir") { totalHadir++; totalJam += item.jam; }
      const statusBadge = item.status === "Hadir" 
        ? `<span class="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 text-emerald-700">Hadir</span>`
        : `<span class="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 text-amber-700">${item.status}</span>`;

      tbodyDetail.innerHTML += `
        <tr class="hover:bg-slate-50">
          <td class="p-2.5 font-medium text-slate-700">${item.tanggal}</td>
          <td class="p-2.5 text-slate-600">${item.hari}</td>
          <td class="p-2.5 text-center">${statusBadge}</td>
          <td class="p-2.5 text-center font-semibold text-slate-700">${item.jam} Jam</td>
          <td class="p-2.5 text-slate-500 text-xs">${item.catatan}</td>
        </tr>`;
    });
  }

  modalTotal.textContent = `Total: ${totalHadir} Hari Hadir | ${totalJam} Jam Mengajar`;
  modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function closeModalDetailGuru() {
  const modal = document.getElementById("modal-detail-guru");
  if (modal) modal.classList.add("hidden");
}


// --- HAK AKSES REKAP GURU (KHUSUS MA'HAD / ADMIN) ---
function showGuruRecapForMahadAdmin() {
  const rekapElement = document.getElementById("tbody-rekap-guru")?.closest(".bg-white");
  if (!rekapElement) return;

  const userRole = String(state.role || "").toLowerCase();

  // Hanya tampil untuk Mahad / Pengasuhan dan Admin
  if (userRole.includes("mahad") || userRole.includes("mahad") || userRole.includes("admin") || userRole.includes("pengasuhan")) {
    rekapElement.style.display = "block";
  } else {
    rekapElement.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  showGuruRecapForMahadAdmin();
});


// --- SISTEM NOTIFIKASI IN-APP & LONCENG ---
const systemNotifications = [];

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all duration-300 opacity-0 translate-y-2 ${type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`;
  toast.innerHTML = `
    <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" class="w-5 h-5"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.classList.remove('opacity-0', 'translate-y-2');
  }, 10);

  // Simpan ke riwayat lonceng
  addNotificationToBell(message);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function addNotificationToBell(message) {
  systemNotifications.unshift({
    text: message,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  updateBellUI();
}

function updateBellUI() {
  const list = document.getElementById('notif-list');
  const badge = document.getElementById('notif-count-badge');
  if (!list) return;

  if (systemNotifications.length === 0) {
    list.innerHTML = `<div class="p-4 text-center text-slate-400">Belum ada notifikasi baru.</div>`;
    if (badge) badge.textContent = '0 Baru';
    return;
  }

  if (badge) badge.textContent = `${systemNotifications.length} Baru`;
  list.innerHTML = systemNotifications.map(n => `
    <div class="p-3 hover:bg-slate-50 transition">
      <p class="text-slate-800 font-medium">${n.text}</p>
      <span class="text-[10px] text-slate-400 mt-1 block">${n.time}</span>
    </div>
  `).join('');
}

// Interseptor ganti alert() bawaan
window.alert = function(msg) {
  showToast(msg, 'success');
};

// Event Listener Lonceng
document.addEventListener('click', (e) => {
  if (e.target.closest('#notification-bell')) return;
  const bellBtn = e.target.closest('button:has([data-lucide="bell"]), button .lucide-bell')?.parentElement || e.target.closest('header button');
  const dropdown = document.getElementById('notif-dropdown');
  
  // Toggle jika klik lonceng
  if (bellBtn && (bellBtn.innerHTML.includes('bell') || bellBtn.querySelector('[data-lucide="bell"]'))) {
    e.stopPropagation();
    if (dropdown) dropdown.classList.toggle('hidden');
  } else if (dropdown && !dropdown.contains(e.target)) {
    dropdown.classList.add('hidden');
  }
});


// --- PERBAIKAN DROPDOWN LONCENG & BADGE ANGKA ---
let unreadCount = 0;

function updateBellBadge() {
  let bellBtn = document.querySelector('button:has([data-lucide="bell"]), button .lucide-bell')?.closest('button');
  if (!bellBtn) {
    // Fallback pencarian tombol lonceng
    const buttons = Array.from(document.querySelectorAll('button'));
    bellBtn = buttons.find(btn => btn.innerHTML.includes('bell') || btn.querySelector('[data-lucide="bell"]'));
  }

  if (!bellBtn) return;

  // Pastikan tombol parent punya position relative
  bellBtn.style.position = 'relative';

  let badge = bellBtn.querySelector('.bell-badge-count');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'bell-badge-count absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white pointer-events-none hidden';
    bellBtn.appendChild(badge);
  }

  if (unreadCount > 0) {
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// Override / Tambah fungsi catat notifikasi
const originalAddNotif = window.addNotificationToBell;
window.addNotificationToBell = function(message) {
  if (typeof originalAddNotif === 'function') originalAddNotif(message);
  unreadCount++;
  updateBellBadge();
};

// Event Klik pada Notifikasi
document.addEventListener('click', (e) => {
  if (e.target.closest('#notification-bell')) return;
  const item = e.target.closest('#notif-list > div');
  if (item) {
    item.classList.add('bg-slate-100', 'opacity-60');
    if (unreadCount > 0) {
      unreadCount--;
      updateBellBadge();
    }
  }

  // Toggle Dropdown saat tombol lonceng diklik
  const bellBtn = e.target.closest('button:has([data-lucide="bell"]), button .lucide-bell')?.closest('button');
  const dropdown = document.getElementById('notif-dropdown');

  if (bellBtn) {
    e.stopPropagation();
    if (dropdown) {
      dropdown.classList.toggle('hidden');
      // Bila dibuka, reset counter angka
      if (!dropdown.classList.contains('hidden')) {
        unreadCount = 0;
        updateBellBadge();
      }
    }
  }
});

// Jalankan inisialisasi awal
document.addEventListener('DOMContentLoaded', updateBellBadge);
setTimeout(updateBellBadge, 1000);


// --- FIX EVENT KLIK LONCENG NOTIFIKASI ---
document.addEventListener('click', function(e) {
  if (e.target.closest('#notification-bell')) return;
  // Cari tombol lonceng
  const bellButton = e.target.closest('button') && (
    e.target.closest('button').querySelector('[data-lucide="bell"]') ||
    e.target.closest('button').querySelector('.lucide-bell') ||
    e.target.closest('button').innerHTML.includes('bell')
  ) ? e.target.closest('button') : null;

  const dropdown = document.getElementById('notif-dropdown');

  if (bellButton) {
    e.preventDefault();
    e.stopPropagation();

    if (dropdown) {
      // Toggle tampil / sembunyi
      const isHidden = dropdown.classList.contains('hidden');
      if (isHidden) {
        dropdown.classList.remove('hidden');
        // Reset badge angka saat dibuka
        unreadCount = 0;
        if (typeof updateBellBadge === 'function') updateBellBadge();
      } else {
        dropdown.classList.add('hidden');
      }
    }
  } else if (dropdown && !dropdown.contains(e.target)) {
    // Sembunyikan dropdown jika klik di luar area lonceng/dropdown
    dropdown.classList.add('hidden');
  }
});

function renderRoleBasedNotifications() {
  const notifications = filterActiveNotifications(roleNotifications[effectiveRole()] || []);
  const list = $('#notif-list');
  const badge = $('#notification-badge');
  const roleLabel = $('#notification-role-label');
  if (!list || !badge) return;
  if (roleLabel) roleLabel.textContent = (roles[effectiveRole()] || roles.yayasan).label;
  const unread = notifications.filter((item) => !item.read);
  badge.classList.toggle('notification-badge-live', unread.length > 0);
  badge.textContent = unread.length > 9 ? '9+' : String(unread.length);
  badge.hidden = unread.length === 0;
  list.innerHTML = notifications.length
    ? notifications.map((item) => `<article class="notification-item ${item.read ? 'notification-read' : ''}" data-notification-id="${escapeHtml(item.id)}" data-notification-target="${escapeHtml(item.targetView || 'dashboard')}"><div class="notification-item-head"><b>${escapeHtml(item.title)}</b><span class="notification-category">${escapeHtml(item.category)}</span></div><p>${escapeHtml(item.description)}</p><time>${escapeHtml(item.timestamp)}${item.read ? ' ? Dibaca' : ' ? Baru'}</time></article>`).join('')
    : '<div class="notification-empty">Belum ada notifikasi untuk role ini.</div>';
}

function bindNotificationActions() {
  if (window.__boardingProNotificationActionsBound) return;
  window.__boardingProNotificationActionsBound = true;
  document.addEventListener('click', (event) => {
    const bell = event.target.closest('#notification-bell');
    const dropdown = $('#notif-dropdown');
    const notification = event.target.closest('[data-notification-target]');
    if (notification) {
      const item = (roleNotifications[effectiveRole()] || []).find((entry) => entry.id === notification.dataset.notificationId);
      if (item) { item.read = true; persistNotificationState(); }
      state.view = notification.dataset.notificationTarget;
      if (dropdown) { dropdown.hidden = true; dropdown.classList.add('hidden'); }
      $('#notification-bell')?.setAttribute('aria-expanded', 'false');
      render();
      return;
    }
    if (bell) {
      event.preventDefault();
      event.stopPropagation();
      if (dropdown) {
        const isHidden = dropdown.hidden || dropdown.classList.contains('hidden');
        dropdown.hidden = !isHidden;
        dropdown.classList.toggle('hidden', !isHidden);
        bell.setAttribute('aria-expanded', String(isHidden));
      }
      return;
    }
    if (dropdown && !event.target.closest('#notif-dropdown')) {
      dropdown.hidden = true;
      dropdown.classList.add('hidden');
      $('#notification-bell')?.setAttribute('aria-expanded', 'false');
    }
  });
}

function criticalNotificationsForRole(role) {
  const records = state.disciplineRecords || [];
  const critical = [];
  if (role === 'parent') {
    const child = currentStudent();
    records.filter((record) => record.studentId === child.id && record.status !== 'Draft').forEach((record) => critical.push({
      id: `critical-${record.id}`, title: `${disciplineLevelLabel(record.level)} untuk ${child.name}`,
      description: `Surat kedisiplinan baru tersedia. Status: ${disciplineStatus(record)}.`, recordId: record.id
    }));
  }
  if (role === 'kepsek') {
    records.filter((record) => record.status === 'Draft' && ['SP3', 'DO'].includes(record.level)).forEach((record) => critical.push({
      id: `critical-${record.id}`, title: `Persetujuan ${disciplineLevelLabel(record.level)}`,
      description: `Pengajuan surat untuk ${studentById(record.studentId).name} menunggu approval dan QR.`, recordId: record.id
    }));
  }
  return critical;
}
function playCriticalAlert() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.16);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.45);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.46);
  oscillator.addEventListener('ended', () => audioContext.close().catch(() => {}), { once: true });
}
function showUnreadCriticalNotifications() {
  const role = effectiveRole();
  const notifications = criticalNotificationsForRole(role);
  const readIds = JSON.parse(localStorage.getItem('unread_critical_notifications') || '[]');
  const unread = notifications.filter((item) => !readIds.includes(item.id));
  if (!unread.length) return;
  const updatedReadIds = [...new Set([...readIds, ...unread.map((item) => item.id)])];
  localStorage.setItem('unread_critical_notifications', JSON.stringify(updatedReadIds));
  playCriticalAlert();
  openModal('Notifikasi Penting', `<div class="notice" style="margin-bottom:12px"><b>${unread.length} notifikasi kedisiplinan membutuhkan perhatian.</b></div><div class="activity-list">${unread.map((item) => `<div class="activity"><span class="activity-icon red">${icon('triangle-alert', 16)}</span><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.description)}</p></div></div>`).join('')}</div>`);
}
// AUTO GENERATE AKUN SANTRI & ORTU
if (typeof saveData === 'function') { const originalSave = saveData; saveData = function(data) { originalSave(data); let users = JSON.parse(localStorage.getItem('boardingpro_users')) || []; if (data && data.nis) { users.push({ username: data.nis, password: data.nis, name: data.nama || 'Santri', role: 'santri' }); users.push({ username: 'ortu_' + data.nis, password: data.noHpOrtu || data.nis, name: 'Wali dari ' + (data.nama || 'Santri'), role: 'wali' }); localStorage.setItem('boardingpro_users', JSON.stringify(users)); } }; }

// FUNCTION AUTO SYNC TO FIREBASE
function syncToCloud(path, key, data) { if (db) { db.ref(path + '/' + key).set(data); } }


// Fallback & Firebase Login Fix
if (typeof handleLogin === 'function') {
  const oldLogin = handleLogin;
  handleLogin = function(e) {
    if(e) e.preventDefault();
    const users = JSON.parse(localStorage.getItem('boardingpro_users')) || [];
    if (users.length === 0) {
      alert('Data akun belum terisi dari Cloud / LocalStorage. Silakan coba beberapa detik lagi.');
      return;
    }
    oldLogin(e);
  };
}


// --- OVERRIDE SYSTEM LOGIN COMPATIBLE WITH FIREBASE ---
window.executeLogin = function(username, password) {
  if (!username || !password) {
    alert('Username dan Password wajib diisi!');
    return;
  }
  
  // 1. Cek langsung ke Firebase Realtime Database
  if (db) {
    db.ref('boardingpro_users').once('value').then((snapshot) => {
      const usersData = snapshot.val();
      let users = [];
      if (usersData) {
        users = Array.isArray(usersData) ? usersData : Object.values(usersData);
      }
      
      // Jika firebase kosong, fallback ke localStorage
      if (users.length === 0) {
        users = JSON.parse(localStorage.getItem('boardingpro_users')) || [];
      }
      
      // Pencocokan akun
      const match = users.find(u => u.username === username && u.password === password);
      if (match) {
        localStorage.setItem('boardingpro_session', JSON.stringify(match));
        alert('Login Berhasil! Selamat datang ' + match.name);
        window.location.reload();
      } else {
        alert('Username atau Password salah! (Atau akun belum terdaftar di Cloud)');
      }
    }).catch(err => {
      console.error(err);
      alert('Gagal terhubung ke Cloud Database: ' + err.message);
    });
  } else {
    alert('Firebase belum terinisialisasi dengan benar. Periksa kembali app.js.');
  }
};

if (db) { db.ref('boardingpro_users/admin').set({ username: 'admin', password: '123', name: 'Administrator', role: 'admin' }); }


// --- MULTI-MAPEL HANDLER FOR GURU ---
function getMapelGuru(guruData) {
  if (!guruData || !guruData.mapel) return [];
  if (Array.isArray(guruData.mapel)) return guruData.mapel;
  return guruData.mapel.split(',').map(m => m.trim());
}

function renderDropdownMapelGuru(guruData, selectElementId) {
  const mapelList = getMapelGuru(guruData);
  const selectEl = document.getElementById(selectElementId);
  if (!selectEl) return;
  
 selectEl.innerHTML = mapelList.map(m => `<option value="${m}">${m}</option>`).join('');
}
