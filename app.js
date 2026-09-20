/* Application behaviour. Shared catalogues and seed data live only in data.js?v=6000. */
const clone = (value) => JSON.parse(JSON.stringify(value));
const today = new Date().toISOString().slice(0, 10);
const KOP_SURAT_LOGO = './assets/logo-removebg-preview.png';
const OFFICIAL_EDUCATION_ACCOUNT = Object.freeze({
  bank: 'BSI',
  accountNumber: '7123456789',
  accountName: 'Yayasan BoardingPro STKIS',
  locked: true
});
const DEFAULT_POCKET_ACCOUNT = {
  bank: 'BSI',
  accountNumber: '7123456780',
  accountName: 'BoardingPro Uang Saku',
  locked: false
};
const PAYMENT_ACCOUNTS_STORAGE_KEY = 'boardingpro-payment-accounts';
function readPaymentAccountsStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem(PAYMENT_ACCOUNTS_STORAGE_KEY) || 'null');
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
}
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
const dataSantri = (() => {
  try {
    const stored = JSON.parse(localStorage.getItem('boardingpro_santri') || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
})();
const fallbackSeedData = {
  internalAccounts: [
    { id: 'ACC-ADMIN', role: 'admin', username: 'admin', password: 'admin123', name: 'Administrator', nama: 'Administrator', status: 'Aktif', active: true, master: true },
    { id: 'ACC-MAHAD-FALLBACK', role: 'mahad', username: 'admin.stkis', password: 'StkIs#2026!Pro', name: "Ma'had/Admin", nama: "Ma'had/Admin", status: 'Aktif', active: true, master: true }
  ],
  students: dataSantri,
  classes: [], halaqoh: [], teachers: [], financeBills: [], scholarships: [], discounts: [], invoices: [], receipts: [],
  dailyFeed: [], monthlySummaries: [], yayasanProgress: [], announcements: [], pocketTransactions: [],
  pocketBalances: [], majors: [], teacherTeachingRecords: [], incidents: [], lostFound: [],
  disciplineRecords: [], pklReports: [], tahfizhSemesterRecords: [], attendance: [], schedules: [], events: [],
  payments: [], permits: [], tahfizh: [], grades: [], points: [], teacherAttendance: [], dormAttendance: [],
  config: { institution: {} }
};
const seedDataSource = typeof seedData !== 'undefined' && seedData && typeof seedData === 'object' ? seedData : fallbackSeedData;
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
const stateCollectionKeys = ['students', 'internalAccounts', 'classes', 'halaqoh', 'teachers', 'financeBills', 'scholarships', 'discounts', 'invoices', 'receipts', 'dailyFeed', 'monthlySummaries', 'yayasanProgress', 'announcements', 'pocketTransactions', 'pocketBalances', 'majors', 'teacherTeachingRecords', 'incidents', 'lostFound', 'disciplineRecords', 'pklReports', 'tahfizhSemesterRecords', 'attendance', 'schedules', 'events', 'payments', 'permits', 'tahfizh', 'grades', 'points', 'teacherAttendance', 'dormAttendance', 'gateEvents', 'activities'];
const resettableDataKeys = stateCollectionKeys.filter((key) => key !== 'internalAccounts');
const STATE_SYNC_STORAGE_KEY = 'boardingpro-state-sync';
const savedState = localStorage.getItem('boardingpro-state');
const emptyInitialData = clone(seedDataSource);
if (!savedState) {
  stateCollectionKeys.forEach((key) => { emptyInitialData[key] = []; });
  emptyInitialData.internalAccounts = clone(fallbackSeedData.internalAccounts);
  emptyInitialData.students = dataSantri;
}
let state = { ...emptyInitialData, role: localStorage.getItem('boardingpro-role') || 'yayasan', view: 'dashboard', gateEvents: [], lastActivity: Date.now(), presentationMode: false };
if (savedState) {
  try { state = { ...state, ...JSON.parse(savedState) }; migratePlainStorage('boardingpro-state', JSON.parse(savedState)); } catch { localStorage.removeItem('boardingpro-state'); }
}
function normalizeStateCollections() {
  stateCollectionKeys.forEach((key) => {
    if (!Array.isArray(state[key])) state[key] = [];
  });
  state.config = state.config && typeof state.config === 'object' ? state.config : {};
  state.config.institution = state.config.institution && typeof state.config.institution === 'object' ? state.config.institution : {};
  state.config.paymentAccounts = state.config.paymentAccounts && typeof state.config.paymentAccounts === 'object' ? state.config.paymentAccounts : {};
  state.internalAccounts = state.internalAccounts.filter((account) => account && typeof account === 'object');
  state.users = state.internalAccounts;
  state.currentUser = state.currentUser && typeof state.currentUser === 'object' ? state.currentUser : null;
  if (typeof ensurePrimaryAdminAccounts === 'function') ensurePrimaryAdminAccounts();
}
function resetTransactionalData() {
  if (!currentRoleIsAdmin()) throw new Error('Hanya Admin atau Ma\'had yang dapat mereset data.');
  resettableDataKeys.forEach((key) => { state[key] = []; });
  state.billingNotifications = [];
  state.users = state.internalAccounts;
  state.currentUser = state.internalAccounts.find((account) => account.username === state.username) || state.currentUser;
  state.view = 'dashboard';
  ['boardingpro-state-sync', 'boardingpro_santri'].forEach((key) => localStorage.removeItem(key));
  normalizeStateCollections();
  persist();
}
normalizeStateCollections();
secureStorage.get('boardingpro-state').then((storedState) => {
  if (storedState && typeof storedState === 'object') {
    state = { ...state, ...storedState };
    normalizeStateCollections();
    window.appData.state = state;
    if (typeof resetWeeklyExitQuota === 'function' && resetWeeklyExitQuota()) persist();
    if (document.readyState !== 'loading') render();
  }
}).catch((error) => console.error('[BoardingPro] Gagal membaca state terenkripsi:', error));
function musyrifPermitForm() {
  if (!['pembina', 'musyrif'].includes(effectiveRole())) return '';
  return section('Input Izin Atas Nama Santri', 'Sistem menolak persetujuan izin mandiri jika kuota minggu berjalan sudah 3 kali.', `<form id="musyrif-permit-form" class="form-grid"><label>Santri<select name="studentId">${state.students.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}  -  ${escapeHtml(SecurityMasker.identity(item.nis))}</option>`).join('')}</select></label><label>Kategori Izin<select name="kategori_izin"><option>Keluar Mandiri</option><option>Dijenguk Orang Tua</option><option>Kegiatan Bersama Sekolah</option></select></label><label>Tanggal<input name="date" type="date" value="${today}" required></label><label class="full">Alasan<textarea name="reason" required></textarea></label><button class="btn btn-primary full" type="submit">${icon('send')} Simpan Pengajuan</button></form>`);
}
state.config = state.config || {};
state.config.institution = {
  foundationName: 'SEKOLAH TAHFIDZ KEJURUAN',
  name: 'IRMAN SOFRAN',
  school: "STK IRMAN SOFRAN",
  address: 'Kp. Eurih RT. 004 RW.03 Kel. Tambang Ayam, Kec. Anyar, Kab. Serang, Prov. Banten, 42166, Indonesia',
  phone: '0877-7120-0615',
  email: 'admin@tahfidzkejuruan.org',
  website: 'www.tahfidzkejuruan.org',
  logo: '',
  logoUrl: '',
  ...(state.config.institution || {})
};
state.config.paymentAccounts = {
  education: { ...OFFICIAL_EDUCATION_ACCOUNT, ...(readPaymentAccountsStorage().education || {}), ...(state.config.paymentAccounts?.education || {}) },
  pocketMoney: { ...DEFAULT_POCKET_ACCOUNT, ...(readPaymentAccountsStorage().pocketMoney || {}), ...(state.config.paymentAccounts?.pocketMoney || {}) }
};
const notificationStoreKey = 'boardingpro-notifications';
let notificationState = {};
try {
  const storedNotifications = JSON.parse(localStorage.getItem(notificationStoreKey) || '{}');
  notificationState = storedNotifications && typeof storedNotifications === 'object' ? storedNotifications : {};
} catch (error) {
  console.warn('[BoardingPro] Data notifikasi lokal tidak valid, memakai data kosong:', error);
  localStorage.removeItem(notificationStoreKey);
}
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
  return active.length ? `<div class="notice" style="margin-bottom:18px"><b>✓  ${active.length} laporan darurat keamanan perlu ditindaklanjuti.</b> <button class="btn btn-small btn-ghost" data-view="security-reports">Buka laporan</button></div>` : '';
}
state.pklReports = state.pklReports.map((report) => ({
  id: report.id,
  studentId: report.studentId,
  date: report.date || today,
  checkIn: report.checkIn || '',
  checkOut: report.checkOut || '',
  status: ['Hadir', 'Izin', 'Sakit'].includes(report.status) ? report.status : 'Hadir',
  activity: report.activity || '',
  photo: report.photo || ''
}));
if (!state.internalAccounts.some((account) => account.username === 'admin')) {
  const master = seedDataSource.internalAccounts.find((account) => account.username === 'admin');
  if (master) state.internalAccounts.unshift(clone(master));
}
state.users = state.internalAccounts;
try {
  const savedUsers = JSON.parse(localStorage.getItem('boardingpro_users') || '[]');
  if (Array.isArray(savedUsers) && savedUsers.length) {
    state.internalAccounts = savedUsers;
    state.users = state.internalAccounts;
  }
} catch (error) {
  console.warn('[BoardingPro] Data akun lokal tidak valid, memakai state akun saat ini:', error);
  localStorage.removeItem('boardingpro_users');
}
state.currentUser = state.internalAccounts.find((account) => account.username === state.username) || null;
const ROLE_STORAGE_KEY = 'boardingpro-master-roles';
const DEFAULT_MASTER_ROLES = ["Admin Ma'had", 'Guru / Ustadz Tahfizh', 'Musyrif / Pembina Asrama', 'Admin Kesantrian', 'Kepala Sekolah', 'Staf Keuangan'];
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
function ensurePrimaryAdminAccounts() {
  const defaults = fallbackSeedData.internalAccounts;
  defaults.forEach((fallbackAccount) => {
    const existing = state.users.find((account) => account.username === fallbackAccount.username);
    if (existing) {
      existing.role = fallbackAccount.role;
      existing.master = true;
      existing.status = 'Aktif';
      existing.active = true;
      return;
    }
    state.users.push(clone(fallbackAccount));
  });
  state.internalAccounts = state.users;
}
ensurePrimaryAdminAccounts();
state.users.forEach((account) => {
  if (Array.isArray(account.roles) && !account.role) account.role = account.roles[0];
  if (account.role === 'master_admin') account.role = 'mahad';
  delete account.activeRole;
});
const primaryAdmin = state.users.find((account) => account.username === 'admin.stkis') || state.users.find((account) => account.master);
if (primaryAdmin) {
  primaryAdmin.name = "Ma'had/Admin";
  primaryAdmin.role = 'mahad';
  primaryAdmin.username = 'admin.stkis';
  primaryAdmin.password = 'StkIs#2026!Pro';
}
ensurePrimaryAdminAccounts();
state.currentUser = state.users.find((account) => account.username === state.username) || state.currentUser;
const normalizeProgramStructure = () => {
  const nonSmkClasses = state.classes.filter((item) => item.programId === 'PPTAK' || item.programId === 'KWNQ');
  ['PPTAK', 'KWNQ'].forEach((programId) => {
    if (nonSmkClasses.filter((item) => item.programId === programId).length > 1) {
      const canonical = clone(seedDataSource.classes.find((item) => item.programId === programId));
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
const formatLocalLongDate = (date = new Date()) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
const hijriMonthNames = ['Muharram', 'Safar', 'Rabiul Awal', 'Rabiul Akhir', 'Jumadil Awal', 'Jumadil Akhir', 'Rajab', 'Syaban', 'Ramadan', 'Syawal', 'Zulkaidah', 'Zulhijah'];
const hijriConversionOffsetDays = -1;
function localMaghribHour(date = new Date()) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  if (/Makassar|Singapore|Kuala_Lumpur|WITA/i.test(timeZone)) return 18 + 10 / 60;
  if (/Jayapura|WIT|Dili/i.test(timeZone)) return 18 + 20 / 60;
  return 18;
}
function hijriDateParts(date = new Date()) {
  const adjusted = new Date(date);
  const sunset = localMaghribHour(adjusted);
  if (adjusted.getHours() + adjusted.getMinutes() / 60 + adjusted.getSeconds() / 3600 >= sunset) adjusted.setDate(adjusted.getDate() + 1);
  adjusted.setDate(adjusted.getDate() + hijriConversionOffsetDays);
  const parts = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(adjusted);
  const values = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return { day: values.day, month: hijriMonthNames[Number(values.month) - 1] || values.month, year: values.year };
}
function formatDashboardDate(date = new Date()) {
  const hijri = hijriDateParts(date);
  return `${formatLocalLongDate(date)} M / ${hijri.day} ${hijri.month} ${hijri.year} H`;
}
const money = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
const qrSignatureUrl = (payload) => `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=8&data=${encodeURIComponent(JSON.stringify(payload))}`;
const documentActionRoles = ['orang_tua', 'parent', 'kepala_sekolah', 'kepsek', 'admin_mahad', 'mahad', 'maahad', 'admin', 'yayasan', 'pengurus_yayasan', 'guru', 'guru_tahfizh'];
const canUseDocumentActions = () => documentActionRoles.includes(String(effectiveRole() || '').toLowerCase());
// Account management is an administrative capability; teaching roles may only
// manage their academic records.
const canManageUserAccounts = () => currentRoleIsAdmin();
const documentLayoutStyles = `
  html,body{margin:0;background:#fff;color:#333;font-family:Arial,Helvetica,sans-serif}
  .document-container{width:794px!important;min-height:1123px!important;padding:30px!important;margin:0 auto!important;background:#fff!important;color:#333!important;box-shadow:none!important;display:block!important;visibility:visible!important;page-break-after:avoid!important;break-after:avoid-page!important}
  .kop-container,.kop-surat{display:grid;grid-template-columns:110px minmax(0,1fr);align-items:center;width:100%;gap:18px;border-bottom:5px double #333!important;padding:0 0 14px!important;margin:0 0 22px!important;text-align:left}
  .kop-container .logo-wrapper,.kop-surat .logo-wrapper{width:110px;height:110px}
  .kop-text{min-width:0;color:#333;text-align:left}.kop-text b,.kop-text h1,.kop-text p,.kop-text small{text-align:left}.kop-text p,.kop-text small{color:#333!important}
  .document-container table{width:100%;border-collapse:collapse;table-layout:fixed;margin:16px 0;page-break-inside:avoid;break-inside:avoid}
  .document-container th,.document-container td{border:1px solid #ddd!important;padding:9px 10px!important;color:#333!important;vertical-align:top;overflow-wrap:break-word}
  .document-container th{background:#f7f7f7;text-align:left;font-weight:700}
  .document-container td:last-child{word-wrap:break-word}
  .document-container .currency,.document-container td.currency{text-align:right!important;white-space:nowrap}
  .document-container .signature-grid,.document-container .discipline-signatures{display:grid!important;grid-template-columns:1fr 1fr!important;gap:24px!important;page-break-inside:avoid;break-inside:avoid;page-break-after:avoid;break-after:avoid-page}
  .document-action-buttons,.document-actions{display:none!important}
  @media print{@page{size:A4 portrait;margin:0}.document-container{page-break-after:avoid!important;break-after:avoid-page!important;page-break-inside:avoid}}
`;
function normalizeDocumentVisibility(root) {
  if (!root) throw new Error('Konten dokumen tidak tersedia.');
  root.hidden = false;
  root.classList.remove('d-none', 'hidden');
  root.style.removeProperty('display');
  root.style.display = 'block';
  root.style.visibility = 'visible';
  root.querySelectorAll('[hidden],.d-none,.hidden,[style*="display: none"],[style*="display:none"]').forEach((element) => {
    element.hidden = false;
    element.classList.remove('d-none', 'hidden');
    element.style.removeProperty('display');
    element.style.visibility = 'visible';
  });
}
function waitForDocumentReady(root) {
  if (!root || !(root.querySelector?.('.document-container, .permit-letter') || root.matches?.('.document-container, .permit-letter'))) {
    return Promise.reject(new Error('Target dokumen kosong atau belum selesai dirender.'));
  }
  normalizeDocumentVisibility(root);
  const images = Array.from(root.querySelectorAll('img'));
  const imageReady = images.map((image) => {
    image.removeAttribute('hidden');
    image.classList.remove('d-none');
    image.style.removeProperty('display');
    image.style.visibility = 'visible';
    image.loading = 'eager';
    return image.complete ? Promise.resolve() : new Promise((resolve) => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  });
  const fontsReady = document.fonts?.ready || Promise.resolve();
  return Promise.all([fontsReady, ...imageReady]).then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
function printDocumentInFrame(html, title, pageStyle = '') {
  if (!String(html || '').match(/<(?:article|main|section|div)[^>]*class=["'][^"']*(?:document-container|permit-letter)/i)) {
    alert('Dokumen belum siap dicetak karena kontennya kosong. Silakan buka ulang preview lalu coba lagi.');
    return false;
  }
  const frame = document.createElement('iframe');
  frame.className = 'document-print-frame';
  frame.setAttribute('title', `Print ${title}`);
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(frame);
  const frameDocument = frame.contentDocument;
  if (!frameDocument) {
    frame.remove();
    throw new Error('Dokumen print iframe tidak tersedia.');
  }
  frameDocument.open();
  frameDocument.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${documentEngineStyles}${documentLayoutStyles}${pageStyle}</style></head><body>${html}</body></html>`);
  frameDocument.close();
  let printed = false;
  const print = async () => {
    if (printed) return;
    printed = true;
    await waitForDocumentReady(frameDocument.body);
    frame.contentWindow.focus();
    frame.contentWindow.print();
    window.setTimeout(() => frame.remove(), 1000);
  };
  frame.onload = () => window.setTimeout(() => print(), 80);
  window.setTimeout(() => {
    if (document.body.contains(frame)) print();
  }, 1000);
  return true;
}
async function downloadDocumentPdf(html, title, pageStyle = '') {
  const container = document.createElement('div');
  container.innerHTML = html;
  const documentNode = container.querySelector('.document-container, .permit-letter') || container.firstElementChild;
  if (!documentNode || !documentNode.textContent.trim()) throw new Error('Konten dokumen kosong atau belum selesai dirender.');
  if (typeof window.html2pdf !== 'function') {
    throw new Error('Generator PDF belum siap. Muat ulang halaman lalu coba lagi.');
  }
  const pdfNode = documentNode.cloneNode(true);
  pdfNode.style.cssText = 'position:fixed;left:-100000px;top:0;width:794px;min-height:1123px;padding:30px;background:#fff;z-index:-1;display:block!important;visibility:visible!important;page-break-after:avoid;break-after:avoid-page;';
  normalizeDocumentVisibility(pdfNode);
  const styleNode = document.createElement('style');
  styleNode.textContent = documentLayoutStyles;
  pdfNode.prepend(styleNode);
  pdfNode.querySelectorAll('img').forEach((image) => {
    image.crossOrigin = 'anonymous';
    image.loading = 'eager';
    image.removeAttribute('loading');
    image.style.maxWidth = '100%';
  });
  document.body.appendChild(pdfNode);
  await waitForDocumentReady(pdfNode);
  try {
    await window.html2pdf().set({
      margin: 0,
      filename: `${String(title).replace(/[^\w.-]+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'] }
    }).from(pdfNode).save();
  } finally {
    pdfNode.remove();
  }
}
function exportReportPdf() {
  const role = roles[effectiveRole()] || roles.guru;
  const rows = state.students.map((student) => {
    const attendance = state.attendance.filter((item) => item.studentId === student.id);
    const present = attendance.filter((item) => item.status === 'Hadir').length;
    const attendanceRate = attendance.length ? `${Math.round((present / attendance.length) * 100)}%` : '-';
    const bill = state.financeBills.find((item) => item.studentId === student.id);
    const paymentStatus = bill?.status || student.spp || 'Belum ada data';
    return `<tr><td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.className || student.program || '-')}</td><td>${attendanceRate}</td><td>${escapeHtml(paymentStatus)}</td></tr>`;
  }).join('');
  const report = `<article class="document-container report-document"><h1 style="margin:0 0 6px;text-align:center">LAPORAN BOARDINGPRO STKIS</h1><p style="text-align:center;margin:0 0 18px;color:#475569">${escapeHtml(formatLocalLongDate())} - ${escapeHtml(role.label || role.demoName)}</p><table style="width:100%;border-collapse:collapse;table-layout:fixed;word-wrap:break-word"><thead><tr><th style="width:40%;padding:8px;border:1px solid #cbd5e1;text-align:left">Santri</th><th style="width:25%;padding:8px;border:1px solid #cbd5e1;text-align:left">Kelas / Program</th><th style="width:15%;padding:8px;border:1px solid #cbd5e1;text-align:left">Kehadiran</th><th style="width:20%;padding:8px;border:1px solid #cbd5e1;text-align:left">SPP</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="padding:12px;text-align:center">Belum ada data</td></tr>'}</tbody></table></article>`;
  return downloadDocumentPdf(report, `Laporan-BoardingPro-${new Date().toISOString().slice(0, 10)}`);
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
  actions.querySelector('[data-document-download]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await downloadDocumentPdf(documentNode.outerHTML, title, pageStyle);
      showToast('Dokumen PDF berhasil diunduh.');
    } catch (error) {
      console.error('[BoardingPro] Gagal mengunduh dokumen PDF:', error);
      showToast('Dokumen PDF gagal diunduh. Silakan coba lagi.', 'error');
    } finally {
      button.disabled = false;
    }
  });
  actions.querySelector('[data-document-print]')?.addEventListener('click', () => {
    try {
      if (!printDocumentInFrame(documentNode.outerHTML, title, pageStyle)) showToast('Dokumen belum siap dicetak.', 'error');
    } catch (error) {
      console.error('[BoardingPro] Gagal mencetak dokumen:', error);
      showToast('Dokumen gagal dicetak. Silakan buka ulang preview.', 'error');
    }
  });
}
function signatureQrHtml(label, name, timestamp, payload) {
  const safeTimestamp = timestamp || new Date().toISOString();
  const signaturePayload = { ...payload, signer: name || 'Tidak diketahui', signedAt: safeTimestamp };
  const isApplicant = label.toLowerCase().includes('pemohon');
  const badge = isApplicant ? 'Terverifikasi Digital' : "Stempel Digital Ma'had";
  return `<div class="signature-card" style="min-width:0;text-align:center;border:1px solid #cbd5e1;border-radius:8px;padding:12px;overflow-wrap:anywhere;break-inside:avoid"><b class="signature-title" style="display:block;font-size:11px">${escapeHtml(label)}</b><img src="${qrSignatureUrl(signaturePayload)}" alt="QR tanda tangan ${escapeHtml(label)}" width="160" height="160" style="display:block;width:160px;height:160px;max-width:100%;margin:8px auto;object-fit:contain" loading="eager"><strong style="display:block;font-size:11px">${escapeHtml(name || 'Tidak diketahui')}</strong><small style="display:block;font-size:9px;color:#475569">${escapeHtml(new Date(safeTimestamp).toLocaleString('id-ID'))}</small><span class="signature-badge" style="display:inline-block;margin-top:8px;padding:4px 8px;border-radius:999px;background:#d1fae5;color:#047857;font-size:9px;font-weight:700">${escapeHtml(badge)}</span></div>`;
}
const documentEngineStyles = `*,*:before,*:after{box-sizing:border-box}html,body{margin:0;padding:0;background:#e2e8f0;color:#0f172a;font-family:Arial,sans-serif}.document-container{position:relative;width:100%;max-width:210mm;min-height:297mm;margin:18px auto;padding:15mm;background:#fff;box-shadow:0 8px 28px #0f172a22;overflow:hidden}.kop-container{display:flex;align-items:center;justify-content:center;gap:18px;width:100%;text-align:center;border-bottom:3px double #0f172a;padding-bottom:12px;margin-bottom:16px}.logo-wrapper{display:grid;place-items:center;flex:none;width:110px;height:110px}.logo-wrapper img{display:block;width:100%;height:100%;object-fit:contain}.kop-text{flex:1;min-width:0;text-align:center;line-height:1.35}.kop-text b,.kop-text h1,.kop-text p,.kop-text small{display:block;margin:2px 0;text-align:center}.kop-text h1{font-size:18px;line-height:1.2}.kop-text p,.kop-text small{font-size:10px;line-height:1.45;color:#475569}.document-header{text-align:center;border-bottom:5px double #0f172a;padding-bottom:10px;margin-bottom:22px}.document-header h1,.document-header h2,.document-header p{margin:3px 0;text-align:center}.document-header h1{font-size:20px}.document-header p{font-size:11px;color:#475569}.document-content{line-height:1.65;overflow-wrap:anywhere}.document-signatures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:28px;page-break-inside:avoid}.document-watermark{position:absolute;top:48%;left:50%;z-index:2;width:150%;transform:translate(-50%,-50%) rotate(-28deg);color:#b91c1c2b;font-size:34px;font-weight:800;letter-spacing:3px;text-align:center;pointer-events:none;white-space:nowrap}.document-container.is-draft .document-signatures{display:none}.document-container.is-draft .document-content{opacity:.9}.document-multiline{white-space:pre-line}@media(max-width:820px){.document-container{width:100%;min-height:auto;margin:0;padding:28px 20px;box-shadow:none}.document-signatures{grid-template-columns:1fr}.document-watermark{font-size:25px}}@media print{@page{size:A4 portrait;margin:15mm}.document-container{width:100%;max-width:210mm;min-height:297mm;margin:0;box-shadow:none}.document-actions{display:none!important}}`;
function renderDocumentPreview(docType, docData = {}) {
  const status = String(docData.status || '').toLowerCase();
  const verified = ['approved', 'terverifikasi', 'verified', 'lunas', 'aktif'].includes(status);
  const institution = state.config?.institution || {};
  const title = docData.title || ({ discipline: 'Surat Peringatan / DO', invoice: 'Invoice Pembayaran', billing: 'Surat Tagihan', permit: 'Surat Izin Santri' }[docType] || 'Dokumen BoardingPro');
  const content = docData.html || ({
    discipline: `<h2>${escapeHtml(docData.level || 'SURAT KEDISIPLINAN')}</h2><p>Santri: <b>${escapeHtml(docData.studentName || '-')}</b></p><p class="document-multiline">${escapeHtml(docData.sanction || docData.description || '-')}</p>`,
    invoice: `<h2>INVOICE PEMBAYARAN</h2><p>Nomor: <b>${escapeHtml(docData.number || '-')}</b></p><p>Santri: ${escapeHtml(docData.studentName || '-')}</p><p class="document-multiline">${escapeHtml(docData.description || '-')}</p><h3>${escapeHtml(docData.total || '-')}</h3>`,
    billing: `<h2>SURAT TAGIHAN</h2><p>Nomor: <b>${escapeHtml(docData.number || '-')}</b></p><p>Santri: ${escapeHtml(docData.studentName || '-')}</p><p class="document-multiline">${escapeHtml(docData.description || '-')}</p><h3>${escapeHtml(docData.total || '-')}</h3>`,
    permit: `<h2>SURAT IZIN SANTRI</h2><p>Santri: <b>${escapeHtml(docData.studentName || '-')}</b></p><p class="document-multiline">${escapeHtml(docData.reason || '-')}</p>`
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
const quotaFreeCategories = ['Pulang / Mudik', 'Izin Pulang', 'Home Leave', 'Dijenguk Orang Tua', 'Kegiatan Bersama Sekolah'];
const isHomeLeavePermit = (permit) => {
  const category = String(permit?.kategori_izin || permit?.type || '').trim().toLowerCase();
  return ['pulang / mudik', 'izin pulang', 'home leave'].includes(category);
};
function startOfWeek(dateValue) {
  const date = new Date(`${dateValue || today}T00:00:00`);
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + mondayOffset);
  return date.toISOString().slice(0, 10);
}
function isQuotaDeducted(permit) {
  if (isHomeLeavePermit(permit)) return false;
  const category = String(permit?.kategori_izin || permit?.type || '').trim();
  return permit?.is_quota_deducted !== false
    && !quotaFreeCategories.includes(category)
    && ['Keluar Kompleks', 'Keluar Mandiri'].includes(category);
}
function resetWeeklyExitQuota(referenceDate = today) {
  const weekStart = startOfWeek(referenceDate);
  if (state.exitQuotaWeekStart === weekStart) return false;
  state.exitQuotaWeekStart = weekStart;
  state.students.forEach((student) => {
    student.weeklyExitQuotaUsed = 0;
    student.weeklyExitQuotaWeek = weekStart;
  });
  return true;
}
function weeklyQuotaUsed(studentId, dateValue = today) {
  resetWeeklyExitQuota(dateValue);
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
  const styles = { Approved: 'badge-success', Verified: 'badge-success', Terverifikasi: 'badge-success', Lunas: 'badge-success', Hadir: 'badge-success', Published: 'badge-success', Pending: 'badge-warning', pending_verification: 'badge-warning', Menunggu: 'badge-warning', 'Menunggu Verifikasi': 'badge-warning', Menunggak: 'badge-danger', Rejected: 'badge-danger', Alpa: 'badge-danger', Draft: 'badge-neutral' };
  return `<span class="badge ${styles[status] || 'badge-neutral'}">${status}</span>`;
};
const persist = () => {
  normalizeStateCollections();
  secureStorage.set('boardingpro-state', state).catch((error) => console.error('[BoardingPro] Gagal menyimpan state terenkripsi:', error));
  secureStorage.set('boardingpro-role', state.role).catch((error) => console.error('[BoardingPro] Gagal menyimpan role terenkripsi:', error));
  try {
    localStorage.setItem('boardingpro_users', JSON.stringify(state.internalAccounts));
    localStorage.setItem('boardingpro_santri', JSON.stringify(state.students));
    localStorage.setItem(PAYMENT_ACCOUNTS_STORAGE_KEY, JSON.stringify(state.config?.paymentAccounts || {}));
    const syncSnapshot = { revision: Date.now(), data: {} };
    stateCollectionKeys.forEach((key) => { syncSnapshot.data[key] = state[key]; });
    syncSnapshot.data.config = state.config;
    localStorage.setItem(STATE_SYNC_STORAGE_KEY, JSON.stringify(syncSnapshot));
    if (window.boardingProSyncChannel) window.boardingProSyncChannel.postMessage(syncSnapshot);
  } catch (error) {
    console.error('[BoardingPro] Gagal menyimpan akun ke localStorage:', error);
  }
  window.appData.state = state;
  window.appData.currentSantri = currentStudent();
  syncFirebaseFinance();
};
function applySynchronizedState(snapshot) {
  if (!snapshot?.data || typeof snapshot.data !== 'object') return false;
  stateCollectionKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(snapshot.data, key)) state[key] = Array.isArray(snapshot.data[key]) ? snapshot.data[key] : [];
  });
  if (snapshot.data.config && typeof snapshot.data.config === 'object') state.config = snapshot.data.config;
  normalizeStateCollections();
  window.appData.state = state;
  window.appData.currentSantri = currentStudent();
  return true;
}
function handleSynchronizedState(snapshot) {
  if (applySynchronizedState(snapshot)) render();
}
window.addEventListener('storage', (event) => {
  if (event.key !== STATE_SYNC_STORAGE_KEY || !event.newValue) return;
  try { handleSynchronizedState(JSON.parse(event.newValue)); } catch (error) { console.error('[BoardingPro] Sinkronisasi state lokal gagal:', error); }
});
if ('BroadcastChannel' in window) {
  window.boardingProSyncChannel = new BroadcastChannel('boardingpro-state');
  window.boardingProSyncChannel.addEventListener('message', (event) => handleSynchronizedState(event.data));
}
const isPklEligible = (student) => student.program === 'SMK' && ((Number(student.grade) === 11 && Number(student.semester) === 2) || (Number(student.grade) === 12 && Number(student.semester) === 1));
const currentAccount = () => state.users.find((account) => account.username === state.username) || state.currentUser;
const normalizeName = (name) => String(name || '').trim().replace(/\s+/g, ' ');
const nameParts = (name) => normalizeName(name).split(' ').filter(Boolean);
const callName = (name) => nameParts(name).slice(0, 2).join(' ') || 'Pengguna';
const roleDisplayPrefix = (role) => ({ guru: 'Ust.', guru_tahfizh: 'Ust.', pembina: 'Ust.', musyrif: 'Ust.', parent: 'Bpk.', yayasan: 'Dr.', kepsek: 'Drs.', mahad: 'Admin', maahad: 'Admin', admin: 'Admin' }[role] || '');
function displayNameForAccount(account) {
  if (!account) return '';
  const prefix = roleDisplayPrefix(account.role);
  const roleLabel = roles[account.role]?.label || account.role;
  return `${prefix ? `${prefix} ` : ''}${callName(account.name || account.nama)} (${roleLabel})`;
}
function usernameForAccount(role, name) {
  const roleSlug = String(role || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const nameSlug = String(name || 'pengguna').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `${roleSlug}_${nameSlug || 'pengguna'}`;
}
function pklSpecialistAccount(account = currentAccount()) {
  return ['Guru DLE', 'Guru Instrumentasi'].includes(String(account?.subject || account?.specialization || '').trim());
}
function canViewPkl() {
  return ['mahad', 'maahad', 'admin', 'kepsek', 'yayasan'].includes(effectiveRole()) || (effectiveRole() === 'guru' && pklSpecialistAccount());
}
function semesterDefaults(date = new Date()) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 7 ? { semester: '1', academicYear: `${year}/${year + 1}` } : { semester: '2', academicYear: `${year - 1}/${year}` };
}
function academicYearOptions() {
  const current = new Date().getFullYear();
  const defaultYear = semesterDefaults().academicYear;
  return Array.from({ length: 4 }, (_, index) => {
    const start = current - index;
    const value = `${start}/${start + 1}`;
    return `<option value="${value}" ${value === defaultYear ? 'selected' : ''}>${value}</option>`;
  }).join('');
}
function semesterFilterForm(id = 'semester-filter-form') {
  const defaults = semesterDefaults();
  return `<form id="${id}" class="form-grid semester-filter"><label>Semester<select name="semester"><option value="1" ${defaults.semester === '1' ? 'selected' : ''}>Ganjil</option><option value="2" ${defaults.semester === '2' ? 'selected' : ''}>Genap</option></select></label><label>Tahun Ajaran<select name="academicYear">${academicYearOptions()}</select></label><button class="btn btn-primary" type="submit">Terapkan Filter</button></form>`;
}
const currentStudent = () => {
  const account = currentAccount();
  const student = state.students.find((item) => item.id === account?.studentId)
    || state.students.find((student) => String(student.nis) === String(account?.username || '').trim())
    || state.students.find((student) => student.id === state.studentId)
    || state.students[0];
  return student || {
    id: account?.studentId || `STUDENT-${account?.username || 'CURRENT'}`,
    name: account?.name || account?.nama || 'Santri',
    nis: account?.username || '-',
    className: '-',
    room: '-',
    program: '-',
    parent: '-',
    attendance: 0,
    points: 0,
    tahfizh: 0,
    spp: 'Belum ada data',
    status: 'Aktif'
  };
};
const isMasterAdminSession = () => {
  const account = currentAccount();
  return account?.role === 'mahad';
};
const canonicalRole = (role) => role === 'santri' ? 'student' : role === 'wali' ? 'parent' : role === 'master_admin' ? 'mahad' : role;
const effectiveRole = () => {
  const currentUser = state.currentUser || currentAccount();
  return canonicalRole(state.activeRoleView || currentUser?.role || state.role);
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
const financeGroupKeys = ['Reguler SMK  -  Kelas 10', 'Reguler SMK  -  Kelas 11', 'Reguler SMK  -  Kelas 12', 'Program PPTAK (1 Tahun)  -  Non-Jenjang', 'Program KWNQ (3 Bulan)  -  Non-Jenjang'];
function groupedActiveStudentRecords(records, renderItem, emptyMessage = 'Belum ada data tagihan') {
  const groups = Object.fromEntries(financeGroupKeys.map((key) => [key, []]));
  records.forEach((record) => {
    const student = studentById(record.studentId);
    if (!isActiveStudent(student)) return;
    const program = student.program === 'PPTAK' ? 'Program PPTAK (1 Tahun)' : student.program === 'KWNQ' ? 'Program KWNQ (3 Bulan)' : 'Reguler SMK';
    const key = `${program}  -  ${['PPTAK', 'KWNQ'].includes(student.program) ? 'Non-Jenjang' : `Kelas ${Number(student.grade)}`}`;
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
let inactivityEventsBound = false;
const INACTIVITY_LIMIT = 15 * 60 * 1000;
const ACTIVE_SESSION_KEY = 'boardingpro-active-session';
const sessionToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let sessionHeartbeat = null;
function activateSingleSession(account) {
  if (!account?.username) return;
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({ username: account.username, token: sessionToken, updatedAt: Date.now() }));
  window.clearInterval(sessionHeartbeat);
  sessionHeartbeat = window.setInterval(() => {
    if (localStorage.getItem('boardingpro-auth') === 'true') localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({ username: account.username, token: sessionToken, updatedAt: Date.now() }));
  }, 5000);
}
function endSingleSession() {
  const active = JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY) || 'null');
  if (active?.token === sessionToken) localStorage.removeItem(ACTIVE_SESSION_KEY);
  window.clearInterval(sessionHeartbeat);
  sessionHeartbeat = null;
}
window.addEventListener('storage', (event) => {
  if (event.key !== ACTIVE_SESSION_KEY || localStorage.getItem('boardingpro-auth') !== 'true') return;
  const active = JSON.parse(event.newValue || 'null');
  if (active?.username === state.username && active.token !== sessionToken) {
    endSingleSession();
    localStorage.removeItem('boardingpro-auth');
    showLanding();
    alert('Sesi akun ini digunakan di perangkat lain. Anda telah logout otomatis.');
  }
});
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  offerInstallPrompt().catch((error) => console.error('[BoardingPro] Prompt instalasi PWA gagal:', error));
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  localStorage.setItem('boardingpro-install-prompted', 'true');
});
async function offerInstallPrompt() {
  if (!deferredInstallPrompt || localStorage.getItem('boardingpro-install-prompted') === 'true') return;
  localStorage.setItem('boardingpro-install-prompted', 'true');
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
}
const firebaseState = { database: null, syncing: false, ready: false };
const firebaseConfig = window.BOARDINGPRO_FIREBASE_CONFIG || null;
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
  firebaseState.ready = true;
  const paymentsRef = firebaseState.database.ref('boardingpro/payments');
  const invoicesRef = firebaseState.database.ref('boardingpro/invoices');
  const stateRef = firebaseState.database.ref('boardingpro/state');
  stateRef.on('value', (snapshot) => {
    if (firebaseState.syncing) return;
    const remote = snapshot.val();
    if (remote && typeof remote === 'object') {
      applySynchronizedState({ data: remote });
    } else if (remote === null) {
      stateCollectionKeys.forEach((key) => { state[key] = []; });
      normalizeStateCollections();
    }
    render();
  }, (error) => console.error('[BoardingPro] Sinkronisasi state realtime gagal:', error));
  paymentsRef.on('value', (snapshot) => {
    if (firebaseState.syncing) return;
    const remote = snapshot.val();
    state.payments = remote && typeof remote === 'object' ? Object.values(remote) : [];
    render();
  }, (error) => console.error('[BoardingPro] Sinkronisasi pembayaran gagal:', error));
  invoicesRef.on('value', (snapshot) => {
    if (firebaseState.syncing) return;
    const remote = snapshot.val();
    state.invoices = remote && typeof remote === 'object' ? Object.values(remote) : [];
    render();
  }, (error) => console.error('[BoardingPro] Sinkronisasi invoice gagal:', error));
}

function syncFirebaseFinance() {
  if (!firebaseState.ready || !firebaseState.database) return;
  firebaseState.syncing = true;
  const snapshot = {};
  stateCollectionKeys.forEach((key) => { snapshot[key] = state[key]; });
  snapshot.config = state.config;
  Promise.all([
    firebaseState.database.ref('boardingpro/state').set(snapshot),
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
  if (localStorage.getItem('boardingpro-auth') !== 'true' || state.presentationMode) return;
  state.lastActivity = Date.now();
  inactivityTimer = window.setTimeout(() => {
    localStorage.removeItem('boardingpro-auth');
    secureStorage.set('boardingpro-user', null).catch((error) => console.error('[BoardingPro] Gagal menghapus sesi terenkripsi:', error));
    showLanding();
  }, INACTIVITY_LIMIT);
}

function startInactivityTimer() {
  if (!inactivityEventsBound) {
    ['mousemove', 'keydown', 'touchstart', 'scroll'].forEach((eventName) => {
      document.addEventListener(eventName, resetInactivityTimer, { passive: true });
    });
    inactivityEventsBound = true;
  }
  if (state.presentationMode) return;
  resetInactivityTimer();
}

function navItems() {
  const common = [{ id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' }, { id: 'schedule', label: 'Jadwal & Event', icon: 'calendar-days' }, { id: 'announcements', label: 'Pengumuman', icon: 'megaphone' }];
  const pklItem = canViewPkl() ? { id: 'pkl', label: 'Laporan PKL Santri', icon: 'briefcase-business' } : null;
  const semesterTahfizhItem = ['yayasan', 'kepsek', 'mahad', 'maahad', 'admin', 'pembina', 'musyrif', 'guru_tahfizh'].includes(effectiveRole()) ? { id: 'tahfizh-semester', label: 'Rekap Tahfizh Semester', icon: 'book-open-check' } : null;
  const semesterAttendanceItem = ['guru', 'guru_tahfizh'].includes(effectiveRole()) ? { id: 'attendance-semester', label: 'Rekap Absensi Semester', icon: 'calendar-check' } : null;
  const appendModules = (items) => [...items, ...(pklItem ? [pklItem] : []), ...(semesterTahfizhItem ? [semesterTahfizhItem] : []), ...(semesterAttendanceItem ? [semesterAttendanceItem] : [])];
  const map = {
    yayasan: appendModules([...common, { id: 'finance', label: 'Keuangan Yayasan', icon: 'wallet-cards' }, { id: 'reports', label: 'Laporan Eksekutif', icon: 'bar-chart-3' }, { id: 'discipline', label: 'Kedisiplinan', icon: 'shield-alert' }, { id: 'security-reports', label: 'Laporan Keamanan & Pos Jaga', icon: 'shield-alert' }, { id: 'teacher-attendance', label: 'Rekap Kehadiran Guru', icon: 'calendar-check' }, { id: 'students', label: 'Data Santri', icon: 'users' }, { id: 'classes', label: 'Kelas & Program', icon: 'school' }, { id: 'teachers', label: 'Data Guru', icon: 'graduation-cap' }]),
    kepsek: appendModules([...common, { id: 'finance', label: 'Keuangan Sekolah', icon: 'wallet-cards' }, { id: 'reports', label: 'Laporan Eksekutif', icon: 'bar-chart-3' }, { id: 'discipline', label: 'Kedisiplinan', icon: 'shield-alert' }, { id: 'security-reports', label: 'Laporan Keamanan & Pos Jaga', icon: 'shield-alert' }, { id: 'students', label: 'Data Santri', icon: 'users' }, { id: 'teacher-attendance', label: 'Rekap Kehadiran Guru', icon: 'calendar-check' }, { id: 'academic', label: 'Akademik & Tahfizh', icon: 'book-marked' }]),
    maahad: appendModules([...common, { id: 'students', label: 'Data Master Santri', icon: 'users' }, { id: 'classes', label: 'Kelas', icon: 'school' }, { id: 'teachers', label: 'Data Guru', icon: 'graduation-cap' }, { id: 'teacher-attendance', label: 'Rekap Kehadiran Guru', icon: 'calendar-check' }, { id: 'discipline', label: 'Kedisiplinan', icon: 'shield-check' }, { id: 'security-reports', label: 'Laporan Keamanan & Pos Jaga', icon: 'shield-alert' }, { id: 'permits', label: 'Approval Perizinan', icon: 'clipboard-check' }, { id: 'billing', label: 'Tagihan & Notifikasi', icon: 'receipt' }, { id: 'payments', label: 'Verifikasi Pembayaran', icon: 'badge-check' }, { id: 'pocket', label: 'Uang Saku', icon: 'wallet' }, { id: 'academic', label: 'Rekap Akademik & PKL', icon: 'book-marked' }]),
    admin: appendModules([...common, { id: 'students', label: 'Data Master Santri', icon: 'users' }, { id: 'accounts', label: 'Manajemen Akun User', icon: 'key-round' }, { id: 'classes', label: 'Kelas', icon: 'school' }, { id: 'teachers', label: 'Data Guru', icon: 'graduation-cap' }, { id: 'discipline', label: 'Kedisiplinan', icon: 'shield-check' }, { id: 'security-reports', label: 'Laporan Keamanan & Pos Jaga', icon: 'shield-alert' }, { id: 'permits', label: 'Approval Perizinan', icon: 'clipboard-check' }, { id: 'billing', label: 'Tagihan & Notifikasi', icon: 'receipt' }, { id: 'payments', label: 'Verifikasi Pembayaran', icon: 'badge-check' }, { id: 'pocket', label: 'Uang Saku', icon: 'wallet' }, { id: 'academic', label: 'Rekap Akademik & PKL', icon: 'book-marked' }]),
    guru: appendModules([...common, { id: 'grades', label: 'Nilai Pelajaran', icon: 'notebook-pen' }, { id: 'teacher-attendance', label: 'Presensi Guru', icon: 'calendar-check' }]),
    guru_tahfizh: appendModules([...common, { id: 'grades', label: 'Nilai Pelajaran', icon: 'notebook-pen' }, { id: 'tahfizh', label: 'Laporan Tahfizh', icon: 'book-open-check' }, { id: 'teacher-attendance', label: 'Presensi Guru', icon: 'calendar-check' }]),
    pembina: appendModules([...common, { id: 'points', label: 'Poin Kedisiplinan', icon: 'award' }, { id: 'discipline', label: 'Kedisiplinan', icon: 'shield-check' }, { id: 'tahfizh', label: 'Program Tahfizh', icon: 'book-open-check' }, { id: 'permits', label: 'Approval Izin', icon: 'clipboard-check' }, { id: 'pocket', label: 'Uang Saku', icon: 'wallet' }]),
    musyrif: appendModules([...common, { id: 'points', label: 'Poin Kedisiplinan', icon: 'award' }, { id: 'discipline', label: 'Kedisiplinan', icon: 'shield-check' }, { id: 'tahfizh', label: 'Program Tahfizh', icon: 'book-open-check' }, { id: 'permits', label: 'Approval Izin', icon: 'clipboard-check' }, { id: 'pocket', label: 'Uang Saku', icon: 'wallet' }]),
    security: [...common, { id: 'gate', label: 'Log Gerbang', icon: 'scan-line' }, { id: 'security-reports', label: 'Laporan Keamanan', icon: 'shield-alert' }],
    parent: [{ id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' }, { id: 'child', label: 'Ringkasan Anak', icon: 'heart' }, { id: 'discipline', label: 'Kedisiplinan Anak', icon: 'shield-alert' }, { id: 'payments', label: 'Keuangan & Tagihan', icon: 'wallet-cards' }, { id: 'pocket', label: 'Uang Saku', icon: 'wallet' }, { id: 'permits', label: 'Perizinan', icon: 'clipboard-list' }, { id: 'announcements', label: 'Pengumuman', icon: 'megaphone' }],
    student: [...common, { id: 'points', label: 'Poin Kedisiplinan', icon: 'award' }, { id: 'discipline', label: 'Sanksi Saya', icon: 'shield-alert' }, { id: 'tahfizh', label: 'Tahfizh Saya', icon: 'book-open-check' }, ...(pklItem ? [pklItem] : [])]
  };
  // The real Ma'had/Admin account keeps its full navigation only in the
  // default view; an emulator must receive the simulated role's menu.
  if (currentRoleIsAdmin() && !state.activeRoleView) {
    return [...new Map(Object.values(map).flat().map((item) => [item.id, item])).values()]
      .map((item) => item.id === 'discipline' ? { ...item, label: 'Kedisiplinan', icon: 'shield-check' } : item.id === 'payments' ? { ...item, label: 'Verifikasi Pembayaran', icon: 'badge-check' } : item);
  }
  const role = effectiveRole();
  if (role === 'guru' && currentAccount()?.isMusyrif) return [...map.guru, ...map.pembina.filter((item) => !map.guru.some((base) => base.id === item.id))];
  if (role === 'guru' && currentAccount()?.isTahfizhTeacher) return [...map.guru, { id: 'tahfizh', label: 'Laporan Tahfizh', icon: 'book-open-check' }];
  const items = map[role] || map[role === 'mahad' ? 'maahad' : role === 'santri' ? 'student' : role] || common;
  return role === 'admin' ? items : items.filter((item) => item.id !== 'accounts');
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
  if ($('#user-role')) $('#user-role').textContent = displayNameForAccount(account) || `${role.demoName} (${role.label})`;
  if ($('#user-role-label')) $('#user-role-label').textContent = role.label;
  if ($('#user-avatar')) $('#user-avatar').textContent = initials(role.demoName);
  const switcher = $('#role-switcher');
  const emulatorRoles = ['mahad', 'yayasan', 'kepsek', 'guru', 'pembina', 'security', 'parent', 'student'];
  if (switcher) switcher.innerHTML = isMasterAdminSession()
    ? `<label class="role-switch-label">Tampilan Sebagai: <select id="active-role-view">${emulatorRoles.map((item) => `<option value="${item}" ${item === effectiveRole() ? 'selected' : ''}>${roles[item]?.label || item}</option>`).join('')}</select></label>`
    : '';
  const presentationToggle = $('#presentation-toggle');
  const presentationRoles = ['yayasan', 'mahad', 'admin', 'kepsek', 'guru', 'guru_tahfizh'];
  if (presentationToggle) {
    const canPresent = presentationRoles.includes(String(effectiveRole()).toLowerCase());
    presentationToggle.hidden = !canPresent;
    presentationToggle.setAttribute('aria-pressed', String(Boolean(state.presentationMode)));
    presentationToggle.textContent = state.presentationMode ? 'Mode Presentasi: Aktif' : 'Mode Presentasi';
    presentationToggle.classList.toggle('btn-primary', Boolean(state.presentationMode));
    presentationToggle.classList.toggle('btn-ghost', !state.presentationMode);
    presentationToggle.onclick = () => {
      state.presentationMode = !state.presentationMode;
      persist();
      if (state.presentationMode) stopInactivityTimer();
      else startInactivityTimer();
      renderShell();
    };
  }
  const roleView = $('#active-role-view');
  if (roleView) roleView.onchange = (event) => {
    const nextRole = String(event.target.value || 'mahad');
    if (nextRole === effectiveRole() && !state.activeRoleView) return;
    state.activeRoleView = nextRole === 'mahad' ? null : nextRole;
    state.view = 'dashboard';
    closeModal();
    persist();
    render();
  };
}

function metricValueIsActive(value) {
  if (value === null || value === undefined || String(value).trim() === '') return false;
  const normalized = String(value).trim().replace(/\s/g, '').replace(/[^\d,.-]/g, '');
  if (!normalized || /^[-.,]+$/.test(normalized)) return false;
  const numericValue = Number(normalized.includes(',') && normalized.includes('.')
    ? normalized.replace(/\./g, '').replace(',', '.')
    : normalized.replace(',', '.'));
  return Number.isFinite(numericValue) && numericValue !== 0;
}
function statCard(label, value, helper, iconName, color = 'blue') {
  const hasValue = metricValueIsActive(value);
  const hasTrend = hasValue && helper && !/%/.test(String(helper));
  const trend = hasTrend ? `<span class="trend-up">${icon('trending-up', 14)} ${helper}</span>` : '';
  return `<div class="stat-card"><div class="stat-top"><span class="stat-icon ${color}">${icon(iconName)}</span>${trend}</div><div class="stat-value">${value ?? 0}</div><div class="stat-label">${label}</div></div>`;
}
function metricNote(value, text) {
  return metricValueIsActive(value) ? `<div class="metric-note">${text}</div>` : '';
}
function updateLiveDashboardDate() {
  document.querySelectorAll('[data-live-dashboard-date]').forEach((element) => {
    element.textContent = formatDashboardDate();
  });
}
function updateCopyrightYear() {
  document.querySelectorAll('.copyright-year').forEach((year) => {
    year.textContent = String(new Date().getFullYear());
  });
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
const dailyEducationalQuotes = [
  { arabic: 'وَقُلْ رَبِّ زِدْنِي عِلْمًا', translation: 'Ya Rabbku, tambahkanlah ilmu kepadaku.', reference: 'QS. Taha: 114' },
  { arabic: 'هَلْ يَسْتَوِي الَّذِينَ يَعْلَمُونَ وَالَّذِينَ لَا يَعْلَمُونَ', translation: 'Adakah sama orang-orang yang mengetahui dengan orang-orang yang tidak mengetahui?', reference: 'QS. Az-Zumar: 9' },
  { arabic: 'يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ', translation: 'Allah meninggikan orang-orang yang beriman dan yang diberi ilmu beberapa derajat.', reference: 'QS. Al-Mujadilah: 11' },
  { arabic: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ', translation: 'Barang siapa menempuh jalan untuk mencari ilmu, Allah akan mudahkan baginya jalan menuju surga.', reference: 'HR. Muslim No. 2699' },
  { arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ', translation: 'Sesungguhnya setiap amal bergantung pada niatnya.', reference: 'HR. Bukhari No. 1 dan Muslim No. 1907' },
  { arabic: 'مَنْ خَرَجَ فِي طَلَبِ الْعِلْمِ فَهُوَ فِي سَبِيلِ اللَّهِ حَتَّى يَرْجِعَ', translation: 'Barang siapa keluar untuk mencari ilmu, ia berada di jalan Allah hingga ia kembali.', reference: 'HR. Tirmidzi No. 2647' },
  { arabic: 'مَّن ذَا الَّذِي يُقْرِضُ اللَّهَ قَرْضًا حَسَنًا فَيُضَاعِفَهُ لَهُ أَضْعَافًا كَثِيرَةً', translation: 'Siapakah yang mau memberi pinjaman kepada Allah sebagai pinjaman yang baik, maka Dia akan melipatgandakannya dengan banyak.', reference: 'QS. Al-Baqarah: 245' }
];
function dailyEducationalQuote(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date - start) / 86400000);
  return dailyEducationalQuotes[((dayOfYear % dailyEducationalQuotes.length) + dailyEducationalQuotes.length) % dailyEducationalQuotes.length];
}
function educationalQuoteWidget() {
  const quote = dailyEducationalQuote();
  return `<section class="quote-widget" aria-label="Kutipan pendidikan Islam hari ini"><span class="quote-widget-label">Kutipan Pendidikan Islam Hari Ini</span><p class="quote-widget-arabic" lang="ar" dir="rtl">${quote.arabic}</p><p class="quote-widget-translation"><b>Artinya:</b> ${quote.translation}</p><small class="quote-widget-reference">${quote.reference}</small></section>`;
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
  return `<section class="launch-poster"><div class="poster-copy"><span class="poster-kicker">SMART BOARDING SCHOOL  -  MA'HAD</span><h2>Siap-Siap Peluncuran!</h2><p class="poster-subtitle">BoardingPro STKIS ✓  Sistem Informasi Smart Boarding</p><p class="poster-tagline">Satu ruang kendali untuk amanah pendidikan, pengasuhan, dan keuangan.</p><div class="poster-features"><span><i class="fa-solid fa-grid-2"></i> Dashboard Terpadu</span><span><i class="fa-solid fa-calendar-days"></i> Jadwal & Event Real-time</span><span><i class="fa-solid fa-bullhorn"></i> Pengumuman & Feed Harian</span><span><i class="fa-solid fa-chart-line"></i> Rekap Nilai & Kehadiran</span></div><strong>Segera Hadir untuk Memudahkan Operasional Ma'had Anda!</strong></div><div class="poster-art" aria-hidden="true"><img src="./assets/logo-removebg-preview.png" alt=""><span>BOARDING<br>PRO</span></div></section>`;
}

function commonDashboard(roleTitle, description, extra = '') {
  const role = roles[effectiveRole()] || roles.mahad || roles.yayasan;
  return `${welcome(roleTitle, `Ahlan Wa Sahlan, ${role.demoName.split(' ')[0]} `, `<span class="live-dashboard-date" data-live-dashboard-date>${formatDashboardDate()}</span>  -  ${description}`, '')}${educationalQuoteWidget()}${launchPoster()}${extra}`;
}

function adminDashboard() {
  return commonDashboard("ADMIN MA'HAD - FULL CONTROL", 'Pusat kendali operasional, akademik, pengasuhan, dan keuangan.', `${securityAlertBanner()}${managementView()}${section('Keuangan & Uang Saku', 'Verifikasi pembayaran, invoice, top-up, dan pengeluaran.', financeView())}${section('Akademik & Tahfizh Terintegrasi', 'Rekap nilai, presensi, capaian hafalan, dan PKL.', academicView())}${section('Master Data Santri', 'Tambah, edit, dan hapus hanya tersedia untuk Admin.', studentsTable(), `<button type="button" class="btn btn-primary" data-action="add-student">${icon('plus')} Tambah Santri</button>`)}`);
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
  return commonDashboard('GURU / USTADZ  -  AKADEMIK', 'Kelola presensi mandiri dan perkembangan santri di kelas yang diampu.', `${teacherPersonalAttendanceView()}${section('Laporan Santri', 'Pilih modul laporan yang ingin ditinjau.', `<div class="actions-inline" style="margin-bottom:16px">${tabs}</div>${panels}`, `<button type="button" class="btn btn-primary" data-action="export">${icon('download')} Export Laporan</button>`)}`);
}

function guardianDashboard() {
  return commonDashboard('PEMBINA  -  PENGASUHAN & TAHFIZH', 'Pantau aktivitas asrama, kedisiplinan, dan setoran hafalan santri.', `${pembinaView()}${section('Jadwal & Event', 'Agenda boarding school untuk seluruh role.', `${activityTimeline()}${eventsTable()}`)}`);
}

function securityDashboard() {
  return commonDashboard('SECURITY  -  POS JAGA', 'Pantau izin yang telah disetujui dan aktivitas keluar-masuk gerbang.', `${securityQuickActions()}${gateView()}${section('Feed Aktivitas Santri', 'Pembaruan kegiatan terbaru.', activityList())}`);
}
function securityQuickActions() {
  return `<div class="actions-inline" style="margin-bottom:18px"><button class="btn btn-primary" data-action="add-incident">${icon('siren')} Buat Laporan Darurat</button><button class="btn btn-ghost" data-action="add-lost-found">${icon('package-search')} Laporan Penemuan / Kehilangan Barang</button></div>`;
}
function securityReportsView() {
  const incidentRows = state.incidents.map((item) => `<tr><td><b>${escapeHtml(item.type)}</b><small>${escapeHtml(item.location)}</small></td><td>${statusBadge(item.level)}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.status || 'Baru')}</td><td>${canManageSecurity() ? `<button class="btn btn-small btn-primary" data-security-status="incident:${item.id}">Tindak Lanjuti</button>` : '-'}</td></tr>`).join('');
  const lostRows = state.lostFound.map((item) => `<tr><td><b>${escapeHtml(item.itemName)}</b><small>${escapeHtml(item.photoDescription)}</small></td><td>${escapeHtml(item.location)}</td><td>${formatDate(item.dateTime?.slice(0, 10) || today)}</td><td>${escapeHtml(item.status)}</td><td>${canManageSecurity() ? `<button class="btn btn-small btn-primary" data-security-status="lost:${item.id}">Konfirmasi</button>` : '-'}</td></tr>`).join('');
  return `${welcome('LAPORAN KEAMANAN & POS JAGA', 'Monitoring Laporan Security', 'Tinjau, konfirmasi, dan tindak lanjuti laporan darurat serta barang temuan.', '')}<div class="stats-grid">${statCard('Darurat Aktif', state.incidents.filter((item) => item.status !== 'Selesai').length, 'Perlu respons', 'siren', 'orange')}${statCard('Barang Temuan', state.lostFound.length, 'Laporan masuk', 'package-search', 'blue')}</div>${section('Laporan Darurat', 'Laporan kejadian dari Security/Pos Jaga.', table(['Kejadian & Lokasi', 'Bahaya', 'Deskripsi', 'Status', 'Aksi'], incidentRows, 'Belum ada laporan darurat'))}${section('Penemuan / Kehilangan Barang', 'Pencatatan dan serah terima barang.', table(['Barang', 'Lokasi', 'Waktu', 'Status', 'Aksi'], lostRows, 'Belum ada laporan barang'))}`;
}
function scheduleView() {
  const canEdit = canManageSchool();
  const actions = canEdit ? `<div class="actions-inline"><button class="btn btn-primary" data-action="add-schedule">${icon('plus')} Tambah Jadwal</button><button class="btn btn-ghost" data-action="add-event">${icon('plus')} Tambah Event Mendatang</button></div>` : '';
  return `${welcome('JADWAL & AGENDA', 'Jadwal Harian dan Event Mendatang', 'Agenda kegiatan yang diperbarui realtime.', actions)}${section('Jadwal Harian', 'Kegiatan, lokasi, dan penanggung jawab.', activityTimeline())}${section('Event Mendatang', "Agenda resmi sekolah dan ma'had.", eventsTable())}`;
}

function parentDashboard() {
  return commonDashboard('ORANG TUA / WALI - PORTAL PERSONAL', 'Ringkasan personal anak, akademik, tahfizh, dan keuangan.', `${parentView()}${section('Keuangan Anak', 'Tagihan, pembayaran, invoice, dan uang saku milik anak.', financeView())}`);
}

function studentDashboard() {
  const student = currentStudent();
  if (!student) {
    return commonDashboard('SANTRI - PORTAL PERSONAL', 'Jadwal, nilai, tahfizh, dan pengumuman untuk santri.', section('Profil & Progress Saya', 'Belum ada data santri yang terhubung ke akun ini.', '<div class="empty-state"><div class="empty-state-icon">' + icon('user-round-x', 28) + '</div><p>Profil santri belum tersedia. Silakan hubungi administrator untuk menghubungkan akun.</p></div>'));
  }
  return commonDashboard('SANTRI - PORTAL PERSONAL', 'Jadwal, nilai, tahfizh, dan pengumuman untuk santri.', `${section('Profil & Progress Saya', `${student.className} - ${student.program}`, `${tahfizhTable(student.id)}${gradeTable(student.id)}`)}${section('Jadwal & Event', "Agenda harian dan kegiatan ma'had.", `${activityTimeline()}${eventsTable()}`)}`);
}

function executiveDashboard() {
  const title = state.role === 'kepsek' ? 'KEPALA SEKOLAH - EXECUTIVE READ-ONLY' : 'YAYASAN - EXECUTIVE READ-ONLY';
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
    ? `${statCard('Total Santri', state.students.length, '', 'users', 'blue')}${statCard('Kehadiran Rata-rata', '94,8%', '', 'calendar-check', 'green')}${statCard('Penerimaan Terverifikasi', money(verified), '', 'wallet-cards', 'purple')}${statCard('Perlu Verifikasi', pending, 'Pembayaran masuk', 'badge-alert', 'orange')}`
    : `${statCard('Total Santri', state.students.length, 'Data aktif', 'users', 'blue')}${statCard('Kehadiran Rata-rata', '94,8%', '', 'calendar-check', 'green')}${statCard('Setoran Tahfizh', state.tahfizh.length, 'Rekaman terbaru', 'book-open-check', 'purple')}${statCard('Agenda Hari Ini', state.schedules.length, 'Kegiatan terjadwal', 'calendar-days', 'orange')}`;
  const announcementRows = announcements.map((item) => `<div class="activity"><span class="activity-icon green">${icon('megaphone')}</span><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.detail)}</p></div><time>${formatDate(item.date)}</time></div>`).join('');
  const pocketSection = canViewFinance() ? section('Uang Saku Santri', 'Saldo dan mutasi sesuai hak akses role', `<div class="finance-grid"><div class="finance-tile"><span>Saldo ${escapeHtml(student.name)}</span><b>${money(balance)}</b></div><div class="finance-tile"><span>Top up bulan ini</span><b>${money(transactions.filter((item) => item.type === 'Top Up').reduce((sum, item) => sum + Number(item.amount || 0), 0))}</b></div><div class="finance-tile"><span>Transaksi terbaru</span><b>${transactions.length}</b></div></div>${table(['Tanggal','Jenis','Nominal','Catatan'], transactions.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${item.type}</td><td>${money(item.amount)}</td><td>${escapeHtml(item.note)}</td></tr>`).join(''), 'Belum ada mutasi uang saku')}`) : '';
  const financeSection = canViewFinance() ? section('Keuangan & Invoice', 'SPP, non-SPP, beasiswa, laundry, dan dokumen pembayaran', `${billingTable(4)}<div class="actions-inline"><button type="button" class="btn btn-ghost btn-small" data-view="finance">Buka pusat keuangan</button></div>`) : '';
  return `${welcome(`BOARDINGPRO STKIS  -  ${role.label.toUpperCase()}`, `Assalamu'alaikum, ${role.demoName.split(' ')[0]} `, `<span class="live-dashboard-date" data-live-dashboard-date>${formatDashboardDate()}</span>  -  Satu ruang kendali untuk menjaga amanah.`, canManageAnnouncements() ? `<button class="btn btn-primary" data-action="add-announcement">${icon('plus')} Pengumuman</button>` : '')}
    <div class="stats-grid">${stats}</div>
    <div class="grid-2">${section('Pengumuman & Feed Harian', "Kabar terbaru ma'had dan perkembangan santri", `<div class="activity-list">${announcementRows || '<div class="empty">Belum ada pengumuman.</div>'}${feed.map((item) => `<div class="activity"><span class="activity-icon green">${icon(item.type === 'tahfizh' ? 'book-open-check' : 'bell')}</span><div><b>${escapeHtml(item.title)}</b><p>${escapeHtml(item.detail)}</p></div><time>${formatDate(item.date)}</time></div>`).join('')}</div>`, `<button class="btn btn-ghost btn-small" data-view="announcements">Lihat semua</button>`)}
      ${section('Jadwal & Event', 'Agenda kegiatan boarding school', `${activityTimeline()}<div class="panel-head" style="margin-top:15px"><div><h2>Event mendatang</h2><p>Agenda resmi sekolah</p></div><button class="btn btn-ghost btn-small" data-view="schedule">Buka agenda</button></div>${eventsTable()}`)}</div>
    ${pocketSection}
    <div class="grid-2">${financeSection}${section('Tahfizh & Academic', 'Capaian hafalan dan hasil belajar terbaru', `${tahfizhTable()}${gradeTable()}<div class="actions-inline"><button type="button" class="btn btn-ghost btn-small" data-view="academic">Lihat rekap akademik</button></div>`)}</div>
    ${canViewPkl() ? section('PKL  -  Praktik Kerja Lapangan', 'Jam kerja, status absensi, kegiatan, dan dokumentasi praktik', `${pklTable()}<div class="actions-inline"><button class="btn btn-ghost btn-small" data-view="pkl">Buka modul PKL</button></div>`) : ''}`;
}

function yayasanDashboard() {
  const verified = state.payments.filter((payment) => payment.status === 'Verified').reduce((sum, payment) => sum + payment.amount, 0);
  const pending = state.payments.filter((payment) => payment.status === 'Pending').length;
  return `${welcome('EXECUTIVE OVERVIEW', "Assalamu'alaikum, Pengelola ", `<span class="live-dashboard-date" data-live-dashboard-date>${formatDashboardDate()}</span>  -  Ringkasan kinerja dan kesehatan keuangan BoardingPro STKIS.`, `<button class="btn btn-primary" data-action="export">${icon('download')} Export Laporan</button>`)}
    <div class="stats-grid">${statCard('Total Santri', state.students.length, '', 'users', 'blue')}${statCard('Kehadiran Rata-rata', '94,8%', '', 'calendar-check', 'green')}${statCard('Penerimaan Terverifikasi', money(verified), '', 'wallet-cards', 'purple')}${statCard('Perlu Verifikasi', pending, 'Pembayaran masuk', 'badge-alert', 'orange')}</div>
    <div class="finance-grid"><div class="finance-tile"><span>SPP bulanan</span><b>${money(verified * .72)}</b>${metricNote(verified, '78% dari penerimaan')}</div><div class="finance-tile"><span>Dana Yayasan</span><b>${money(verified * .12)}</b>${metricNote(verified, 'Operasional & beasiswa')}</div><div class="finance-tile"><span>Non-SPP & uang saku</span><b>${money(verified * .16)}</b>${metricNote(verified, 'Asrama, makan, saku')}</div></div>
    <div class="grid-2">${section('Rekapitulasi Penerimaan Kas per Program', 'Laporan kas masuk dan penerimaan terverifikasi', financeProgramTable())}${section('Aktivitas Terbaru', 'Pembaruan data secara real-time', activityList())}</div>
    ${section('Monitoring Yayasan - Tahfizh', 'Program, kelas, dan santri dengan target dan capaian', yayasanAccordion())}`;
}
function yayasanAccordion() {
  return `<div class="accordion">${programs.map((program, programIndex) => {
    const classes = state.classes.filter((item) => item.programId === program.id);
    return `<details class="accordion-item" ${programIndex === 0 ? 'open' : ''}><summary><span><b>${program.name}</b><small>${program.description}</small></span><span class="badge badge-neutral">${classes.length} kelas</span></summary><div class="accordion-body">${classes.map((klass) => {
      const progress = state.yayasanProgress.find((item) => item.classId === klass.id) || {};
      const students = state.students.filter((student) => student.className === klass.name);
      const pct = Math.min(100, Math.round((Number(progress.achievementJuz || 0) / Math.max(1, Number(progress.targetJuz || 1))) * 100));
      return `<details class="accordion-class"><summary><span><b>${klass.name}</b><small>Wali: ${escapeHtml(klass.wali || '-')} - ${students.length} santri</small></span><span class="progress-label">${pct}%</span></summary><div class="accordion-body"><div class="progress"><span style="width:${pct}%"></span></div>${table(['Santri', 'Target', 'Capaian', 'Progress'], students.map((student) => {
        const record = state.yayasanProgress.find((item) => item.classId === klass.id) || progress;
        const studentPct = Math.min(100, Math.round((Number(student.tahfizh || record.achievementJuz || 0) / Math.max(1, Number(record.targetJuz || 1))) * 100));
        return `<tr><td><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.nis || '-')}</small></td><td>Juz ${record.targetJuz || 0}</td><td>Juz ${record.achievementJuz || student.tahfizh || 0}</td><td><div class="progress"><span style="width:${studentPct}%"></span></div><small>${studentPct}%</small></td></tr>`;
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
  return `${welcome('PUSAT KENDALI PENGASUHAN', 'Selamat datang, Admin', "Kelola santri, tagihan, dan laporan ma'had.", currentRoleIsAdmin() ? `<button class="btn btn-primary" data-action="add-student">${icon('plus')} Tambah Santri</button>` : '')}
    <div class="stats-grid">${statCard('Total Santri', state.students.length, '+3 bulan ini', 'users')}${statCard('Pembayaran Menunggu', pendingPayments, 'Perlu verifikasi', 'clock-3', 'orange')}${statCard('Notifikasi Tagihan', state.billingNotifications.filter((bill) => !bill.read).length, 'Belum dibaca', 'bell', 'purple')}</div>
    <div class="grid-2">${section('Perizinan Terbaru', 'Tinjau pengajuan yang masuk hari ini', permitTable(true))}${section('Notifikasi Billing', 'Tindak lanjut wali santri', billingTable(3))}</div>${section('Keamanan Akun', 'Perbarui kredensial akun Anda.', selfPasswordForm())}`;
}
function academicView() {
  const canEdit = ['mahad', 'admin', 'kepsek', 'guru'].includes(effectiveRole());
  return `${welcome('AKADEMIK & TAHFIZH TERINTEGRASI', 'Rekap pembelajaran dan hafalan', 'Nilai akademik dan capaian tahfizh santri dalam satu laporan.', canEdit ? `<button type="button" class="btn btn-primary" data-action="add-grade">${icon('plus')} Input Nilai</button>` : '')}
    <div class="stats-grid">${statCard('Rata-rata Nilai', '86,4', '', 'chart-no-axes-combined', 'blue')}${statCard('Kehadiran Kelas', '96,1%', '', 'calendar-check', 'green')}${statCard('Peserta PKL', state.pklReports.length, 'SMK aktif', 'briefcase-business', 'purple')}${statCard('Catatan Aktif', '12', 'Minggu ini', 'notebook-pen', 'orange')}</div>
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
    return `<tr><td><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.program || '-')} - ${escapeHtml(student.className || '-')}</small></td><td>${average} / ${target}</td><td>Juz ${achieved}<small>${escapeHtml(latest.surah || 'Belum ada setoran')}</small></td><td>${statusBadge(latest.mutqin || (latest.status === 'Verified' ? 'Mutqin' : 'Belum dinilai'))}</td><td><div class="progress"><span style="width:${progress}%"></span></div><small>${progress}%</small></td><td>${escapeHtml(summary?.note || summary?.notes || 'Belum ada catatan')}</td></tr>`;
  }).join(''), 'Belum ada data akademik');
}
function teacherPersonalAttendanceView() {
  const teacherName = state.displayName || roles.guru.demoName;
  const records = state.teacherAttendance.filter((item) => item.teacher === teacherName);
  const form = `<form id="teacher-attendance-form" class="form-grid"><label>Status<select name="status"><option>Hadir</option><option>Izin</option><option>Sakit</option><option>Alpa</option></select></label><label>Jam Masuk<input name="checkIn" type="time"></label><label>Jam Pulang<input name="checkOut" type="time"></label><button type="submit" class="btn btn-primary full">Simpan Presensi Pribadi</button></form>`;
  const report = table(['Tanggal', 'Masuk', 'Pulang', 'Status'], records.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${escapeHtml(item.checkIn || '-')}</td><td>${escapeHtml(item.checkOut || '-')}</td><td>${statusBadge(item.status || 'Belum diisi')}</td></tr>`).join(''), 'Belum ada riwayat presensi');
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
    const subject = items[0]?.subject || '-';
    return `<tr><td><b>${escapeHtml(teacher)}</b></td><td>${escapeHtml(subject)}</td><td>${present} hari</td><td>${leave} hari</td><td>${hours} jam</td><td><button type="button" class="btn btn-small btn-primary" data-teacher-detail="${escapeHtml(teacher)}">Lihat Detail</button></td></tr>`;
  }).join('');
  return table(['Nama Guru/Ustadz', 'Mata Pelajaran', 'Total Kehadiran (Hari)', 'Total Izin/Sakit', 'Total Jam Mengajar (Bulan Ini)', 'Aksi'], rows, 'Belum ada rekap presensi guru');
}
function teacherAttendanceAdminView() {
  const summary = teacherAttendanceSummary();
  return `${welcome('REKAP PRESENSI GURU / USTADZ', 'Kehadiran & Jam Mengajar', 'Ringkasan bulan berjalan untuk monitoring pimpinan dan admin.', '')}
    <div class="stats-grid">${statCard('Total Jam Mengajar', `${summary.totalHours} jam`, 'Akumulasi bulan ini', 'clock-3', 'blue')}${statCard('Persentase Kehadiran', `${summary.attendance}%`, 'Dari seluruh hari mengajar', 'calendar-check', 'green')}${statCard('Total Izin / Sakit', summary.leave, 'Tidak termasuk alpa', 'file-warning', 'orange')}${statCard('Guru Terdata', summary.teachers.length, 'Dalam rekap bulan ini', 'users', 'purple')}</div>
    ${section('Rekap Utama Guru/Ustadz', 'Klik Lihat Detail untuk histori harian dan materi KBM.', teacherAttendanceTable())}`;
}
function openTeacherAttendanceDetail(teacherName) {
  const records = teacherAttendanceRecords().filter((item) => item.teacher === teacherName);
  const subject = records[0]?.subject || '-';
  const rows = records.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${new Date(`${item.date}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long' })}</td><td>${statusBadge(item.status)}</td><td>${Number(item.hours || 0)} jam</td><td>${escapeHtml(item.note || '-')}</td></tr>`).join('');
  openModal(`Detail Presensi - ${teacherName}`, `<p class="metric-note">Mata Pelajaran: ${escapeHtml(subject)} - ${new Date(`${today}T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>${table(['Tanggal', 'Hari', 'Status', 'Jam Mengajar', 'Catatan Materi KBM'], rows, 'Belum ada histori harian')}`);
}
function pembinaView() {
  return `${welcome('PENGAWASAN ASRAMA & TAHFIZH', 'Dashboard Pembina', 'Pantau kedisiplinan, presensi jamaah, dan hafalan santri binaan.', canManageDormitory() ? `<button class="btn btn-primary" data-action="add-point">${icon('plus')} Input Poin</button><button class="btn btn-primary" data-action="add-tahfizh-attendance">${icon('plus')} Absensi Tahfizh</button>` : '')}
    <div class="stats-grid">${statCard('Presensi Jamaah', '93,6%', '', 'mosque', 'green')}${statCard('Setoran Menunggu', state.tahfizh.filter((item) => item.status === 'Menunggu').length, 'Perlu verifikasi', 'book-open-check', 'orange')}${statCard('Poin Hari Ini', '+25', '', 'award', 'purple')}</div>
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
  return `<div class="child-hero"><div class="avatar xl">${initials(child.name)}</div><div><span class="eyebrow">PORTAL ORANG TUA / WALI</span><h1>${child.name}</h1><p>${child.className}  -  ${child.room}  -  ${child.program}  -  NIS ${child.nis}</p></div><span class="badge badge-success">Santri Aktif</span></div>
    <div class="stats-grid">${statCard('Progress Tahfizh', `${child.tahfizh} Juz`, '', 'book-open-check', 'green')}${statCard('Poin Kedisiplinan', `+${child.points}`, '', 'award', 'purple')}${statCard('Kehadiran', `${child.attendance}%`, 'Sangat baik', 'calendar-check', 'blue')}${statCard('Status SPP', child.spp, 'September 2026', 'wallet-cards', 'orange')}</div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">${section(`Pengumuman  -  ${formatDate(today)}`, 'Informasi kegiatan dan perkembangan anak', `<div class="h-full flex flex-col justify-between p-5">${feed.length ? `<div class="activity-list">${feed.map((item) => `<div class="activity"><span class="activity-icon green">${icon(item.type === 'tahfizh' ? 'book-open-check' : 'bell')}</span><div><b>${item.title}</b><p>${item.detail}</p></div><time>${formatDate(item.date)}</time></div>`).join('')}</div>` : '<div class="empty">Belum ada pengumuman hari ini.</div>'}</div>`)}${section('Uang Saku Hari Ini', 'Saldo dan mutasi transaksi anak', `<div class="h-full flex flex-col justify-between p-5"style="max-height: 250px; overflow-y: auto; overflow-x: auto; white-space: nowrap;"><div class="finance-tile"><span>Saldo saat ini</span><b>${money(balance)}</b></div>${pocketTable}</div>`)}</div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">${section('Ringkasan Bulanan', summary.month || 'September 2026', compactSummary)}${section('Setoran Hafalan Terakhir', 'Riwayat capaian tahfizh', `<div style="max-height:350px;overflow-y:auto;overflow-x:auto">${tahfizhTable(child.id)}</div><h3 style="margin-top:16px">Presensi Jam Tahfizh</h3><div style="max-height:350px;overflow-y:auto;overflow-x:auto">${attendanceTable('tahfizh')}</div>`)}</div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">${section('Riwayat Poin', 'Perkembangan karakter', `<div style="max-height:350px;overflow-y:auto;overflow-x:auto">${pointsTable(child.id)}</div>`)}${compactSection('Tagihan & Kuitansi', 'Rincian pembayaran santri', `<div style="max-height:350px;overflow-y:auto;overflow-x:auto">${renderWaliInvoices(child.nis)}</div>`)}</div>${renderPaymentDestinationDetails()}`;
}
function studentView() {
  const student = currentStudent();
  return `${welcome('PORTAL SANTRI  -  PERSONAL DASHBOARD', `Assalamu'alaikum, ${student.name.split(' ')[0]}! `, 'Semangat menjalani aktivitas hari ini.', '')}
    <div class="stats-grid">${statCard('Total Poin Saya', `${student.points > 0 ? '+' : ''}${student.points}`, '', 'award', 'purple')}${statCard('Hafalan', `${student.tahfizh} Juz`, 'Terus bertumbuh', 'book-open-check', 'green')}${statCard('Kehadiran', `${student.attendance}%`, 'Bulan ini', 'calendar-check', 'blue')}${statCard('Program', student.program, student.className, 'graduation-cap', 'orange')}</div>
    <div class="grid-2">${section('Jadwal Kegiatan Hari Ini', 'Jaga semangat dan kedisiplinan', activityTimeline())}</div>
    ${section('Tahfizh Saya', 'Ziyadah, Murajaah, catatan, dan presensi jam Tahfizh pribadi', `<div style="max-height:350px;overflow-y:auto;overflow-x:auto">${tahfizhTable(student.id)}${attendanceTable('tahfizh')}</div>`)}`;
}
function gateView() {
  const active = state.permits.filter((permit) => permit.status === 'Approved' && permit.date === today && permit.checkout && !permit.checkin).length;
  const requestForm = effectiveRole() === 'security' && canManageSecurity() ? `<form id="security-permit-form" class="form-grid"><label>Santri<select name="studentId">${state.students.map((student) => `<option value="${student.id}">${escapeHtml(student.name)}  -  ${escapeHtml(student.nis)}</option>`).join('')}</select></label><label>Jenis Izin<select name="type"><option value="Keluar Kompleks">Keluar Kompleks</option><option value="Pulang / Mudik">Pulang / Mudik</option></select></label><label>Tanggal<input name="date" type="date" value="${today}" required></label><label class="full">Alasan<textarea name="reason" required></textarea></label><button type="submit" class="btn btn-primary full">Catat Pengajuan di Pos</button></form>` : '';
  return `${welcome(`POS JAGA UTAMA  -  ${today}`, 'Kontrol Gerbang Utama', 'Catat pergerakan santri secara realtime dan aman.')}
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
  return ['PPTAK', 'KWNQ'].includes(student.program) ? 'Non-Jenjang' : [10, 11, 12].includes(Number(student.grade)) ? `Kelas ${Number(student.grade)}` : 'Kelas Lainnya';
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
    const key = `${program}  -  ${permitGroupClass(student)}`;
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
  const halaqohId = activeHalaqohId();
  const data = state.tahfizh.filter((item) => (isPersonalRole ? item.studentId === scopedStudentId : (!id || item.studentId === id) && (!halaqohId || item.halaqohId === halaqohId || studentById(item.studentId).halaqohId === halaqohId))).slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const actionHeader = hasTahfizhAccess() && !id ? 'Aksi' : '';
  if (id || isPersonalRole) return table(['Santri', 'Juz / Surah', 'Ayat', 'Jenis', 'Status', ...(actionHeader ? [actionHeader] : [])], data.map((item) => `<tr><td>${escapeHtml(studentById(item.studentId).name)}</td><td><b>Juz ${item.juz}</b> - ${escapeHtml(item.surah)}</td><td>${escapeHtml(item.ayat || '-')}</td><td>${escapeHtml(item.type || '-')}</td><td>${statusBadge(item.status)}</td>${actionHeader ? `<td><button type="button" class="icon-btn" data-edit-tahfizh="${item.id}" title="Edit setoran">${icon('pencil', 15)}</button></td>` : ''}</tr>`).join(''));
  return groupedStudentRecords(data, (item) => `<div class="accordion-record"><b>${escapeHtml(studentById(item.studentId).name)}</b><span>Juz ${escapeHtml(item.juz)} - ${escapeHtml(item.surah)} - ${escapeHtml(item.ayat || '-')}</span>${statusBadge(item.status)}</div>`);
}
function tahfizhMonthlySummary() {
  const month = today.slice(0, 7);
  const records = state.tahfizh.filter((item) => String(item.date || '').slice(0, 7) === month);
  const totalJuz = records.reduce((sum, item) => sum + Number(item.juz || 0), 0);
  const totalPages = records.reduce((sum, item) => sum + Number(item.pages || 0), 0);
  return `<div class="stats-grid">${statCard('Bulan Berjalan', new Date(`${today}T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }), 'Rekap aktif', 'calendar', 'green')}${statCard('Total Juz', totalJuz, 'Akumulasi setoran', 'book-open', 'blue')}${statCard('Total Halaman', totalPages, 'Jika tercatat', 'file-text', 'orange')}</div>`;
}
function gradeTable(studentId) {
  const selectedSubject = state.teacherAcademicFilter?.subject;
  const selectedClass = state.teacherAcademicFilter?.className;
  const records = state.grades.filter((grade) => (!studentId || grade.studentId === studentId) && (!selectedSubject || grade.subject === selectedSubject) && (!selectedClass || studentById(grade.studentId).className === selectedClass));
  if (studentId || ['parent', 'student'].includes(effectiveRole())) return table(['Santri', 'Mata Pelajaran', 'Nilai', 'Catatan'], records.map((grade) => `<tr><td>${escapeHtml(studentById(grade.studentId).name)}</td><td>${escapeHtml(grade.subject || '-')}</td><td><span class="score">${grade.score}</span></td><td>${escapeHtml(grade.note || '-')}</td></tr>`).join(''), 'Belum ada nilai');
  return groupedStudentRecords(records, (grade) => `<div class="accordion-record"><b>${escapeHtml(studentById(grade.studentId).name)}</b><span>${escapeHtml(grade.subject || '-')} - Nilai ${escapeHtml(grade.score)}</span><small>${escapeHtml(grade.note || '-')}</small></div>`);
}
function teacherSubjects() {
  const account = currentAccount();
  const subjects = Array.isArray(account?.subjects) ? account.subjects : String(account?.subject || '').split(',').map((item) => item.trim()).filter(Boolean);
  state.teacherTeachingRecords.filter((item) => item.teacher === (account?.name || account?.nama)).forEach((item) => { if (item.subject) subjects.push(item.subject); });
  return [...new Set(subjects)].length ? [...new Set(subjects)] : ['Umum'];
}
function activeHalaqohId() {
  const account = currentAccount();
  if (currentRoleIsAdmin()) return state.tahfizhFilter?.halaqohId || '';
  return account?.halaqohId || account?.pengampu || '';
}
function halaqohLabel() {
  const id = activeHalaqohId();
  if (!id) return currentRoleIsAdmin() ? 'Semua Halaqoh' : 'Halaqoh belum ditentukan';
  return state.halaqoh?.find((item) => item.id === id)?.name || id;
}
function halaqohStudents() {
  const id = activeHalaqohId();
  return state.students.filter((student) => !id || student.halaqohId === id || student.pengampu === id);
}
function teacherScopedStudents() {
  const filter = state.teacherAcademicFilter || {};
  return state.students.filter((student) => !filter.className || student.className === filter.className);
}
function teacherAcademicView() {
  const subjects = teacherSubjects();
  const classes = [...new Set(state.students.map((student) => student.className).filter(Boolean))].sort();
  const filter = state.teacherAcademicFilter || { subject: subjects[0], className: '' };
  const filterForm = `<form id="teacher-academic-filter" class="form-grid teacher-filter"><label>Mata Pelajaran<select name="subject">${subjects.map((subject) => `<option value="${escapeHtml(subject)}" ${filter.subject === subject ? 'selected' : ''}>${escapeHtml(subject)}</option>`).join('')}</select></label><label>Kelas<select name="className"><option value="">Semua Kelas</option>${classes.map((className) => `<option value="${escapeHtml(className)}" ${filter.className === className ? 'selected' : ''}>${escapeHtml(className)}</option>`).join('')}</select></label><button class="btn btn-primary" type="submit">Terapkan Filter</button></form>`;
  const attendance = state.attendance.filter((item) => item.type === 'kelas' && (!filter.subject || item.subject === filter.subject) && (!filter.className || studentById(item.studentId).className === filter.className));
  const attendanceTableHtml = table(['Santri', 'Kelas', 'Mapel', 'Tanggal', 'Status', 'Pencatat'], attendance.map((item) => `<tr><td>${escapeHtml(studentById(item.studentId).name)}</td><td>${escapeHtml(studentById(item.studentId).className || '-')}</td><td>${escapeHtml(item.subject || '-')}</td><td>${formatDate(item.date)}</td><td>${statusBadge(item.status)}</td><td>${escapeHtml(item.by || '-')}</td></tr>`).join(''), 'Belum ada presensi mapel ini');
  return `${welcome('KBM GURU', 'Presensi dan Nilai Multi-Mapel', 'Pilih mapel dan kelas untuk mengisolasi input serta rekap.', '')}${section('Filter Kelas & Mata Pelajaran', 'Data tersimpan terpisah berdasarkan kombinasi mapel dan kelas.', filterForm)}${section('Input Presensi Siswa', 'Presensi KBM mengikuti filter aktif.', `<button type="button" class="btn btn-primary" data-action="add-teacher-student-attendance">${icon('plus')} Input Presensi</button>${attendanceTableHtml}`)}${section('Input Nilai Pelajaran', 'Nilai hanya tampil untuk mapel dan kelas aktif.', gradeTable(), `<button type="button" class="btn btn-primary" data-action="add-grade">${icon('plus')} Input Nilai</button>`)}`;
}
function attendanceTable(type = 'kelas') {
  if (type === 'tahfizh' && !hasTahfizhAccess() && !['parent', 'student'].includes(effectiveRole())) return '<div class="notice">Akses presensi jam Tahfizh hanya untuk Guru Tahfizh, Pembina/Musyrif, atau Administrator.</div>';
  const halaqohId = type === 'tahfizh' ? activeHalaqohId() : '';
  const data = state.attendance.filter((item) => item.type === type && (!halaqohId || item.halaqohId === halaqohId || studentById(item.studentId).halaqohId === halaqohId)).slice().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  if (['parent', 'student'].includes(effectiveRole())) return table(['Santri', 'Tanggal', 'Status', 'Pencatat'], data.filter((item) => item.studentId === currentStudent().id).map((item) => `<tr><td>${studentById(item.studentId).name}</td><td>${formatDate(item.date)}</td><td>${statusBadge(item.status)}</td><td>${item.by || 'Pembina'}</td></tr>`).join(''));
  return groupedStudentRecords(data, (item) => `<div class="accordion-record"><b>${escapeHtml(studentById(item.studentId).name)}</b><span>${formatDate(item.date)} - ${escapeHtml(item.status || '-')}</span><small>${escapeHtml(item.by || 'Pembina')}</small></div>`);
}
function pklTable() {
  return table(['Santri', 'Jam Masuk', 'Jam Pulang', 'Status Absensi', 'Deskripsi Kegiatan', 'Foto'], state.pklReports.map((report) => `<tr><td>${escapeHtml(studentById(report.studentId).name)}</td><td>${escapeHtml(report.checkIn || '-')}</td><td>${escapeHtml(report.checkOut || '-')}</td><td>${escapeHtml(report.status || '-')}</td><td>${escapeHtml(report.lastReport || report.description || '-')}</td><td>${report.photoUrl ? `<a href="${escapeHtml(report.photoUrl)}" target="_blank" rel="noopener">Lihat Foto</a>` : '-'}</td></tr>`).join(''), 'Belum ada laporan PKL');
}
function billingTable(limit, studentId) {
  const bills = state.financeBills.filter((bill) => (!studentId || bill.studentId === studentId) && isActiveStudent(studentById(bill.studentId))).slice().sort((a, b) => new Date(b.dueDate || b.date || 0) - new Date(a.dueDate || a.date || 0)).slice(0, limit || state.financeBills.length);
  const renderBill = (bill) => `<div class="accordion-record"><b>${escapeHtml(studentById(bill.studentId).name)}</b><span>${escapeHtml(bill.label)}  -  ${money(billNet(bill))}</span><span>${statusBadge(bill.status)} <button type="button" class="btn btn-small btn-ghost" data-document="invoice" data-invoice="${escapeHtml(bill.id)}">Lihat</button></span></div>`;
  if (studentId || ['parent', 'student'].includes(effectiveRole())) return `<div style="max-height:350px;overflow-y:auto;overflow-x:auto"><div class="accordion-content">${bills.map(renderBill).join('') || '<div class="empty">Belum ada tagihan</div>'}</div></div>`;
  return groupedActiveStudentRecords(bills, renderBill);
}
function selfPasswordForm() {
  const account = currentAccount();
  const locked = !isMasterAdminSession() && (account?.passwordChangeCount || 0) >= 2;
  const warning = "Batas maksimal perubahan kata sandi mandiri telah tercapai (2/2 kali). Untuk melakukan perubahan/reset kata sandi kembali, silakan hubungi Admin Ma'had.";
  const message = account?.role === 'mahad' ? 'Perubahan kata sandi mandiri tanpa batas.' : locked ? warning : 'Batas maksimal ganti kata sandi mandiri adalah 2 kali.';
  return `<form id="admin-password-form" class="form-grid"><p class="notice ${locked ? 'font-bold' : ''}">${message}</p><label>Password Saat Ini<input name="currentPassword" type="password" autocomplete="current-password" required ${locked ? 'disabled' : ''}></label><label>Password Baru<input name="newPassword" type="password" minlength="10" autocomplete="new-password" required ${locked ? 'disabled' : ''}></label><label class="full">Konfirmasi Password Baru<input name="confirmPassword" type="password" minlength="10" autocomplete="new-password" required ${locked ? 'disabled' : ''}></label><button type="submit" class="btn btn-primary full" ${locked ? 'disabled' : ''}>Ubah Password</button></form>`;
}
function paymentProofGroup(payment) {
  return String(payment.category || '').toUpperCase() === 'POCKET_MONEY' ? 'Uang Saku' : 'SPP / Non-SPP';
}
function paymentVerificationStatus(payment) {
  return ['verified', 'approved', 'terverifikasi'].includes(String(payment.status || '').toLowerCase()) ? 'Terverifikasi' : 'Menunggu Verifikasi';
}
function paymentProofPreview(payment) {
  if (!payment.receiptImageData) return '<div class="empty">Tidak ada gambar bukti tersimpan.</div>';
  return `<img src="${escapeHtml(payment.receiptImageData)}" alt="Bukti transfer ${escapeHtml(studentById(payment.studentId).name)}" style="max-width:100%;max-height:480px;object-fit:contain;border-radius:12px;border:1px solid #d1fae5">`;
}
function paymentVerificationPanel() {
  const pending = state.payments
    .filter((payment) => isActiveStudent(studentById(payment.studentId)))
    .slice()
    .sort((a, b) => new Date(b.submittedAt || b.date || 0) - new Date(a.submittedAt || a.date || 0));
  const renderGroup = (group) => {
    const grouped = {};
    pending.filter((payment) => paymentProofGroup(payment) === group).forEach((payment) => {
      const student = studentById(payment.studentId);
      const key = `${student.className || 'Kelas belum ditentukan'} - ${student.name}`;
      (grouped[key] ||= []).push(payment);
    });
    const content = Object.entries(grouped).map(([studentLabel, payments]) => `<details class="accordion-group" open><summary><span>${escapeHtml(studentLabel)}</span><small>${payments.length} bukti</small></summary><div class="accordion-content"><div class="table-wrap"><table><thead><tr><th>Periode</th><th>Nominal</th><th>File</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${payments.map((payment) => {
      const canVerify = currentRoleIsAdmin() && !['verified', 'approved', 'terverifikasi'].includes(String(payment.status || '').toLowerCase());
      return `<tr><td>${escapeHtml(payment.period || '-')}</td><td>${money(payment.amount)}</td><td>${escapeHtml(payment.receiptFileName || payment.receiptImage || payment.proof || '-')}<small>${escapeHtml(payment.scanStatus || 'Belum dipindai')}</small></td><td>${statusBadge(payment.status)}</td><td class="actions-inline"><button type="button" class="btn btn-small btn-ghost" data-payment-proof="${payment.id}">Lihat Bukti</button>${canVerify ? `<button type="button" class="btn btn-small btn-primary" data-payment="${payment.id}" data-payment-status="Verified">Verifikasi</button>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div></div></details>`).join('');
    return content || '<div class="empty">Belum ada bukti transfer pada kategori ini.</div>';
  };
  return `<section class="panel payment-verification-panel"><div class="panel-head"><div><h2>Pusat Verifikasi Bukti Transfer</h2><p>Terakhir diperbarui ${escapeHtml(formatLocalLongDate())}. Bukti dikelompokkan berdasarkan kelas dan nama santri.</p></div><span class="badge badge-warning">${pending.filter((item) => paymentVerificationStatus(item) !== 'Terverifikasi').length} menunggu</span></div><div class="grid-2"><div><h3 class="eyebrow">SPP / Non-SPP</h3>${renderGroup('SPP / Non-SPP')}</div><div><h3 class="eyebrow">UANG SAKU</h3>${renderGroup('Uang Saku')}</div></div></section>`;
}
function paymentTable(actions = false, studentId) {
  const data = state.payments.filter((payment) => (!studentId || payment.studentId === studentId) && isActiveStudent(studentById(payment.studentId))).slice().sort((a, b) => new Date(b.submittedAt || b.date || 0) - new Date(a.submittedAt || a.date || 0));
  const renderPayment = (payment) => `<div class="accordion-record"><b>${escapeHtml(studentById(payment.studentId).name)}</b><span>${escapeHtml(categoryLabel(payment.category))} - ${escapeHtml(payment.period || '-')} - ${money(payment.amount)}</span><span>${statusBadge(payment.status)} ${actions && ['Pending', 'pending_verification'].includes(payment.status) ? `<button class="btn btn-small btn-primary" data-payment="${payment.id}" data-payment-status="Verified">Verifikasi</button>` : payment.invoiceId ? `<button class="btn btn-small btn-ghost" data-document="invoice" data-invoice="${payment.invoiceId}">Invoice</button>` : ''}</span></div>`;
  if (!studentId && !['parent', 'student'].includes(effectiveRole())) return groupedStudentRecords(data, renderPayment);
  return `<div style="max-height:350px;overflow-y:auto;overflow-x:auto">${table(['Santri', 'Kategori', 'Periode', 'Nominal', 'Status', ...(actions ? ['Aksi'] : [])], data.map((payment) => `<tr><td>${escapeHtml(studentById(payment.studentId).name)}</td><td>${escapeHtml(categoryLabel(payment.category))}</td><td>${escapeHtml(payment.period || '-')}</td><td>${money(payment.amount)}</td><td>${statusBadge(payment.status)}</td>${actions ? `<td>${['Pending', 'pending_verification'].includes(payment.status) ? `<button class="btn btn-small btn-primary" data-payment="${payment.id}" data-payment-status="Verified">Verifikasi</button>` : payment.invoiceId ? `<button class="btn btn-small btn-ghost" data-document="invoice" data-invoice="${payment.invoiceId}">Invoice</button>` : '-'}</td>` : ''}</tr>`).join(''))}</div>`;
}
function invoiceTable(studentId) {
  const invoices = state.invoices.filter((invoice) => (!studentId || invoice.studentId === studentId) && isActiveStudent(studentById(invoice.studentId))).slice().sort((a, b) => new Date(b.issuedAt || b.date || 0) - new Date(a.issuedAt || a.date || 0));
  if (!studentId && !['parent', 'student'].includes(effectiveRole())) return groupedActiveStudentRecords(invoices, (invoice) => `<div class="accordion-record"><b>${escapeHtml(studentById(invoice.studentId).name)}</b><span>${escapeHtml(invoice.number)}  -  ${money(invoice.total)}</span><span>${statusBadge(invoice.status)} <button class="btn btn-small btn-ghost" data-document="invoice" data-invoice="${invoice.id}">Lihat</button></span></div>`, 'Belum ada data invoice');
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
    const description = payment.description || payment.proof || invoice.description || bill?.description || 'Rincian pembayaran BoardingPro STKIS';
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
  const resetAction = currentRoleIsAdmin() ? `<button type="button" class="btn btn-danger" data-action="reset-data">${icon('trash-2')} Reset Data Transaksional</button>` : '';
  return `${welcome('KEUANGAN YAYASAN', 'Billing, Beasiswa & Invoice', 'Komponen SPP dan non-SPP dikelola transparan dengan nominal fleksibel.', currentRoleIsAdmin() ? `<button class="btn btn-primary" data-action="add-billing">${icon('plus')} Tambah Komponen</button>` : '')}
    ${renderPaymentDestinationDetails({ adminPanel: currentRoleIsAdmin() })}
    ${currentRoleIsAdmin() ? section('Reset Data untuk Operasional Baru', 'Hapus seluruh data santri dan transaksi, tetapi akun serta konfigurasi rekening tetap dipertahankan.', `<div class="notice"><b>Perhatian:</b> tindakan ini menghapus santri, presensi, nilai, Tahfizh, izin, tagihan, pembayaran, invoice, dan aktivitas secara permanen dari penyimpanan lokal.</div>`, resetAction) : ''}
    <div class="stats-grid">${statCard('Tagihan Aktif', state.financeBills.filter((bill) => bill.status !== 'Paid').length, 'Perlu ditindaklanjuti', 'receipt', 'orange')}${statCard('Piutang Bersih', money(outstanding), 'Setelah beasiswa & diskon', 'wallet-cards', 'purple')}${statCard('Beasiswa Aktif', state.scholarships.filter((item) => item.active).length, 'Program bantuan', 'heart-handshake', 'green')}${statCard('Invoice Terbit', state.invoices.length, 'Dapat dicetak', 'file-check-2', 'blue')}</div>
    ${section('Daftar Tagihan', 'Rincian nominal yang harus dibayar', billingTable(undefined, studentId))}
    ${section('Pembayaran & Invoice', 'Persetujuan otomatis menerbitkan invoice dan kuitansi', paymentTable(currentRoleIsAdmin(), studentId))}
    ${section('Invoice Digital', 'Admin dan wali dapat melihat, mencetak, atau mengunduh', invoiceTable(studentId))}`;
}
function paymentAccount(account, fallback) {
  return { ...fallback, ...(account || {}) };
}
function renderPaymentDestinationDetails(options = {}) {
  const education = paymentAccount(state.config?.paymentAccounts?.education, OFFICIAL_EDUCATION_ACCOUNT);
  const pocketMoney = paymentAccount(state.config?.paymentAccounts?.pocketMoney, DEFAULT_POCKET_ACCOUNT);
  const includeAdminPanel = options.adminPanel === true && currentRoleIsAdmin();
  const card = (title, description, account) => `<article class="panel payment-destination-card"><div class="panel-head"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div><span class="badge badge-success">Rekening aktif</span></div><dl class="payment-account-details"><div><dt>Bank</dt><dd>${escapeHtml(account.bank)}</dd></div><div><dt>Nomor Rekening</dt><dd><code>${escapeHtml(account.accountNumber)}</code></dd></div><div><dt>Atas Nama</dt><dd>${escapeHtml(account.accountName)}</dd></div></dl></article>`;
  const adminPanel = includeAdminPanel ? `<section class="panel payment-account-settings"><div class="panel-head"><div><h2>Pengaturan Norek Yayasan</h2><p>Ma'had dan Admin dapat memperbarui rekening SPP/Pendidikan serta Uang Saku.</p></div></div><form id="payment-accounts-form" class="form-grid"><label>Bank SPP / Pendidikan<input name="educationBank" value="${escapeHtml(education.bank)}" required></label><label>Nomor Rekening SPP<input name="educationAccountNumber" inputmode="numeric" value="${escapeHtml(education.accountNumber)}" required></label><label>Nama Pemilik SPP<input name="educationAccountName" value="${escapeHtml(education.accountName)}" required></label><label>Bank Uang Saku<input name="pocketBank" value="${escapeHtml(pocketMoney.bank)}" required></label><label>Nomor Rekening Uang Saku<input name="pocketAccountNumber" inputmode="numeric" value="${escapeHtml(pocketMoney.accountNumber)}" required></label><label>Nama Pemilik Uang Saku<input name="pocketAccountName" value="${escapeHtml(pocketMoney.accountName)}" required></label><button type="submit" class="btn btn-primary full">Simpan Semua Rekening</button></form></section>` : '';
  return `<div class="payment-destinations"><div class="panel-head"><div><h2>Tujuan Pembayaran</h2><p>Gunakan rekening sesuai jenis pembayaran yang dipilih.</p></div></div><div class="grid-2">${card('SPP / Pendidikan', 'Pembayaran pendidikan dan uang bangunan.', education)}${card('Uang Saku', 'Top up uang saku santri.', pocketMoney)}</div>${adminPanel}</div>`;
}
function gateTable() {
  const data = state.permits.filter((permit) => permit.status === 'Approved');
  return table(['Santri', 'Jenis Izin', 'Tanggal', 'Jam Keluar', 'Jam Kembali', 'Aksi'], data.map((permit) => `<tr><td><div class="person"><span class="avatar">${initials(studentById(permit.studentId).name)}</span><b>${escapeHtml(studentById(permit.studentId).name)}</b></div></td><td>${escapeHtml(permit.type || '-')}</td><td>${formatDate(permit.date)}</td><td>${escapeHtml(permit.checkout || '-')}</td><td>${escapeHtml(permit.checkin || '-')}</td><td>${permit.checkout && permit.checkin ? statusBadge('Selesai') : `<button class="btn btn-small btn-primary" data-gate="${permit.id}">${permit.checkout ? 'Check-in' : 'Checkout'}</button>`}</td></tr>`).join(''));
}
function gateEventsTable() {
  const rows = state.gateEvents.slice(-5).reverse().map((event) => `<tr><td>${event.time}</td><td><b>${event.action}</b></td><td>${studentById(event.studentId).name}</td><td>${event.operator}</td></tr>`).join('');
  return table(['Waktu', 'Aksi', 'Santri', 'Petugas'], rows, 'Belum ada aktivitas realtime');
}
function activityTimeline() {
  const items = state.schedules.length ? state.schedules : state.activities.map((item) => ({ time: item.time, title: item.title, type: 'Kegiatan' }));
  return items.length
    ? `<div class="timeline">${items.map((item) => `<div class="timeline-item"><div class="time">${item.time}</div><div class="timeline-dot">${icon(item.type === 'Tahfizh' ? 'book-open' : 'calendar-days', 16)}</div><div><b>${item.title}</b><p>${item.room || 'Agenda BoardingPro STKIS'}  -  ${item.teacher || ''}</p></div></div>`).join('')}</div>`
    : '<div class="empty-state"><div class="empty-state-icon">' + icon('calendar-x', 28) + '</div><p>Belum ada jadwal atau aktivitas.</p></div>';
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
  if (!lines.length) return '-';
  const listItems = lines.map((line) => line.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean);
  const isList = lines.some((line) => /^\s*[-*]\s+/.test(line));
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
  const details = `<table class="info-table">${detailRow('Nama Santri', `<b>${escapeHtml(student.name)}</b>`)}${detailRow('NIS', escapeHtml(student.nis || '-'))}${detailRow('Kelas', escapeHtml(student.className || '-'))}${detailRow('Tanggal Kejadian', formatDate(record.incidentDate))}${detailRow('Jenis Pelanggaran', escapeHtml(record.violationType || '-'))}${detailRow('Deskripsi / Sanksi', `<div>${escapeHtml(record.description || '-')}</div><div class="box-sanction">${formatSanctionForPrint(record.sanction)}</div>`, 'info-table--multiline')}${detailRow('Masa Berlaku', `${formatDate(record.issuedAt || record.incidentDate)} s.d. ${formatDate(expirationDate)}`)}${detailRow('Status', escapeHtml(disciplineStatus(record)))}</table>`;
  const statusLabel = verified ? 'Terverifikasi' : 'Draft';
  const html = `<article class="document-container discipline-letter${verified ? '' : ' is-draft'}">${kopSuratHtml()}<div class="doc-header"><h2>Surat Peringatan - ${escapeHtml(disciplineLevelLabel(record.level))}</h2><span class="status-badge ${verified ? 'status-badge--verified' : 'status-badge--draft'}">${statusLabel}</span></div><p class="discipline-letter-intro">Dengan ini menerangkan bahwa santri berikut menerima catatan kedisiplinan dan sanksi sesuai tata tertib pondok/sekolah:</p>${details}<p class="discipline-letter-note">Surat ini diterbitkan sebagai dokumen resmi dan menjadi bagian dari riwayat pembinaan santri.</p>${signatures}<footer>Dokumen: ${escapeHtml(record.id)} - Status penerbitan: ${escapeHtml(disciplineStatus(record))}</footer></article>${documentActionButtons('discipline', record.id, 'Print Surat SP')}`;
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
  return `<section class="panel"><div class="panel-head"><div><h2>Catat Pelanggaran & Terbitkan Surat</h2><p>Form hanya tersedia untuk Musyrif/Pembina dan Kesantrian.</p></div></div><form id="discipline-form" class="form-grid"><label>Santri<select name="studentId" required>${state.students.filter(isActiveStudent).map((student) => `<option value="${student.id}">${escapeHtml(student.name)}  -  ${escapeHtml(student.nis)}</option>`).join('')}</select></label><label>Tingkat SP<select name="level" required>${options}</select></label><label>Tanggal Kejadian<input name="incidentDate" type="date" value="${today}" required></label><label>Jenis Pelanggaran<select name="violationType" required>${types}</select></label><label class="full">Deskripsi Pelanggaran / Sanksi<textarea name="description" required placeholder="Tuliskan kronologi singkat dan catatan pembinaan"></textarea></label><label class="full">Bentuk Sanksi yang Diberikan<textarea id="input-sanksi" name="sanction" rows="3" required placeholder="Contoh:\n1. Tugas kebersihan selama 3 hari\n2. Hafalan surat pendek"></textarea></label><button class="btn btn-primary full" type="submit">${icon('file-plus-2')} Simpan & Terbitkan Surat</button></form></section>`;
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
    return `<tr><td><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.nis || '-')}</small></td><td>${escapeHtml(student.className || '-')}</td><td>${escapeHtml(record.level || '-')}</td><td>${formatDate(record.incidentDate)}</td><td>${escapeHtml(record.sanction || '-')}</td><td>${statusBadge(disciplineStatus(record))}</td><td>${action}</td></tr>`;
  }).join('');
  const childStatus = visible.length ? disciplineStatus(visible[0]) : 'BERSIH / AMAN';
  const emptyMessage = role === 'parent' && !visible.length ? '<div class="notice" style="margin-bottom:12px"><b>Alhamdulillah, tidak ada catatan SP / Bersih.</b></div>' : '';
  return `${role === 'yayasan' ? `<div class="stats-grid">${stats}</div><section class="panel"><div class="panel-head"><div><h2>Filter Monitoring Yayasan</h2><p>Mode read-only: Yayasan hanya dapat memantau dan mencetak.</p></div></div><form id="discipline-filter-form" class="form-grid"><label>Tingkat SP<select name="level"><option value="">Semua Tingkat</option><option value="SP1">SP 1</option><option value="SP2">SP 2</option><option value="SP3">SP 3</option><option value="DO">Surat DO</option></select></label><label>Kelas<select name="className"><option value="">Semua Kelas</option>${classOptions}</select></label><label>Dari Tanggal<input name="fromDate" type="date"></label><label>Sampai Tanggal<input name="toDate" type="date"></label><button class="btn btn-primary" type="submit">Terapkan Filter</button></form></section>` : `<div class="child-hero"><div class="avatar xl">${initials(currentStudent().name)}</div><div><span class="eyebrow">STATUS KEDISIPLINAN ${role === 'parent' ? 'ANAK' : 'SAYA'}</span><h1>${escapeHtml(childStatus)}</h1><p>Riwayat hanya untuk ${escapeHtml(currentStudent().name)}.</p></div></div>`}${emptyMessage}<section class="panel"><div class="panel-head"><div><h2>Riwayat Pelanggaran & Sanksi</h2><p>${visible.length} catatan dapat ditinjau</p></div></div><div class="table-wrap"><table><thead><tr><th>SANTRI</th><th>KELAS</th><th>TINGKAT</th><th>TANGGAL</th><th>SANKSI</th><th>STATUS</th><th>DOKUMEN</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="empty">Belum ada catatan kedisiplinan.</td></tr>'}</tbody></table></div></section>`;
}
function disciplineView() {
  const role = effectiveRole();
  const records = disciplineRecordsForRole();
  const canCreate = ['mahad', 'admin', 'pembina', 'musyrif'].includes(role);
  return `${welcome('MODUL KEDISIPLINAN SANTRI', 'Surat SP 1  -  SP 2  -  SP 3  -  DO', 'Pencatatan, penerbitan surat, dan monitoring riwayat pembinaan.', '')}${canCreate ? disciplineForm() : ''}${disciplineFilters(records)}`;
}

function renderView() {
  if (state.view === 'accounts' && !canManageUserAccounts()) {
    state.view = 'dashboard';
  }
  let html;
  if (state.view === 'dashboard') html = dashboard();
  else if (state.view === 'finance') html = canViewFinance() ? financeView() : dashboard();
  else if (state.view === 'reports') html = yayasanDashboard();
  else if (state.view === 'discipline') html = disciplineView();
  else if (state.view === 'students') html = section('Data Master Santri', 'Admin dapat mengelola data; role lain hanya membaca.', studentsTable(), currentRoleIsAdmin() ? `<div class="actions-inline"><button type="button" class="btn btn-primary" data-action="add-student">${icon('plus')} Tambah Santri</button><button type="button" class="btn btn-ghost" data-action="promote-students">${icon('arrow-up-circle')} Proses Kenaikan Kelas</button></div>` : canPromoteStudents() ? `<button type="button" class="btn btn-ghost" data-action="promote-students">${icon('arrow-up-circle')} Proses Kenaikan Kelas</button>` : '');
  else if (state.view === 'classes') html = section('Manajemen Kelas & Program', 'PPTAK/KWNQ satu kelas; SMK memakai jurusan dinamis.', `${classesTable()}${currentRoleIsAdmin() ? section('Jurusan SMK Dinamis', 'Tambah atau ubah jurusan sesuai kebutuhan sekolah.', majorsTable(), `<button type="button" class="btn btn-primary" data-action="add-major">${icon('plus')} Tambah Jurusan</button>`) : ''}`, currentRoleIsAdmin() ? `<button type="button" class="btn btn-primary" data-action="add-class">${icon('plus')} Tambah Kelas</button>` : '');
  else if (state.view === 'teachers') html = section('Manajemen Guru & Ustadz', 'Data pengajar dan pembina', teachersTable(), currentRoleIsAdmin() ? `<button class="btn btn-primary" data-action="add-teacher">${icon('plus')} Tambah Guru</button>` : '');
  else if (state.view === 'accounts' && canManageUserAccounts()) html = section('Akun Internal Staf', 'Kelola username dan password internal tanpa email', accountsTable(), `<button class="btn btn-primary" data-action="add-account">${icon('plus')} Buat Akun Staf</button>`);
  else if (state.view === 'permits') html = effectiveRole() === 'parent' ? permitForm() : `${musyrifPermitForm()}${section('Manajemen Perizinan', 'Verifikasi seluruh pengajuan santri', permitTable(true))}`;
  else if (state.view === 'billing') html = canViewFinance() ? financeView() : dashboard();
  else if (state.view === 'payments') html = canViewFinance() ? (effectiveRole() === 'parent' ? paymentForm() : `${paymentVerificationPanel()}${section('Riwayat Pembayaran', 'Seluruh transaksi pembayaran yang tercatat', paymentTable(currentRoleIsAdmin()))}`) : dashboard();
  else if (state.view === 'pocket') html = canViewFinance() ? pocketMoneyView() : dashboard();
  else if (state.view === 'academic') html = academicView();
  else if (state.view === 'pkl') html = canViewPkl() ? pklView() : dashboard();
  else if (state.view === 'tahfizh-semester') html = ['yayasan', 'kepsek', 'mahad', 'maahad', 'admin', 'pembina', 'musyrif', 'guru_tahfizh'].includes(effectiveRole()) ? tahfizhSemesterView() : dashboard();
  else if (state.view === 'attendance-semester') html = ['guru', 'guru_tahfizh'].includes(effectiveRole()) ? attendanceSemesterView() : dashboard();
  else if (state.view === 'grades') html = ['guru', 'guru_tahfizh'].includes(effectiveRole()) ? teacherAcademicView() : section('Nilai Pelajaran', 'Input dan rekap nilai KBM', gradeTable(), `<button class="btn btn-primary" data-action="add-grade">${icon('plus')} Input Nilai</button>`);
  else if (state.view === 'attendance') html = section('Presensi Kelas', 'Kehadiran KBM hari ini', attendanceTable());
  else if (state.view === 'teacher-attendance') html = (currentRoleIsAdmin() || ['kepsek', 'yayasan'].includes(effectiveRole())) ? teacherAttendanceAdminView() : effectiveRole() === 'guru' ? teacherPersonalAttendanceView() : dashboard();
  else if (state.view === 'points') {
    const studentOnly = ['student', 'santri'].includes(effectiveRole());
    html = section('Poin Kedisiplinan', studentOnly ? 'Riwayat poin dan sanksi Anda' : 'Catat prestasi dan pelanggaran santri', pointsTable(studentOnly ? currentStudent().id : undefined), studentOnly ? '' : `<button class="btn btn-primary" data-action="add-point">${icon('plus')} Input Poin</button>`);
  }
  else if (state.view === 'tahfizh') html = section('Program Tahfizh', 'Rekap capaian hafalan dan setoran santri', `<div class="notice"><b>Halaqoh: ${escapeHtml(halaqohLabel())}</b><p class="metric-note">Data presensi dan progres dibatasi sesuai kelompok halaqoh pengampu.</p></div>${tahfizhMonthlySummary()}${tahfizhTable()}`, (currentRoleIsAdmin() || hasTahfizhAccess()) ? `<button type="button" class="btn btn-primary" data-action="add-tahfizh">${icon('plus')} Input Setoran</button>` : '');
  else if (state.view === 'gate') html = gateView();
  else if (state.view === 'schedule') html = scheduleView();
  else if (state.view === 'security-reports') html = securityReportsView();
  else if (state.view === 'announcements') html = announcementsView();
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

let renderingDashboard = false;
let queuedDashboardRender = false;
function renderDashboard() {
  if (renderingDashboard) {
    queuedDashboardRender = true;
    return;
  }
  renderingDashboard = true;
  try {
    renderShell();
    renderView();

    // Hook Integrasi BoardingPro (Kehadiran Guru & Notifikasi Role)
    if (typeof renderTeacherAttendanceModule === 'function') {
      const mainContent = document.getElementById('main-content') || document.querySelector('main') || document.body;
      const currentRole = String(state.role || "").toLowerCase();

      // Hanya tampilkan modul rekap guru jika role Ma'had atau Admin
      if (currentRole.includes("ma'had") || currentRole.includes("mahad") || currentRole.includes("admin")) {
        if (!document.getElementById('module-rekap-guru')) {
          const rekapHTML = renderTeacherAttendanceModule();
          if (rekapHTML) {
            mainContent.insertAdjacentHTML('beforeend', rekapHTML);
          }
        }
      } else {
        // Hapus jika berpindah ke role selain Ma'had / Admin
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
    normalizeStateCollections();
    const content = $('#main-content');
    if (content) {
      try {
        renderShell();
        renderView();
      } catch (fallbackError) {
        console.error('[BoardingPro] Fallback dashboard juga gagal:', fallbackError);
        content.innerHTML = `<section class="panel empty-state"><div class="empty-state-icon">${icon('inbox', 28)}</div><h2>Belum Ada Data</h2><p>Data dashboard belum tersedia. Silakan coba lagi setelah sinkronisasi selesai.</p></section>`;
      }
    }
  } finally {
    renderingDashboard = false;
    if (queuedDashboardRender) {
      queuedDashboardRender = false;
      window.requestAnimationFrame(() => renderDashboard());
    }
  }

}
function render() { renderDashboard(); }
function studentsTable() {
  return table(['Santri', 'Program / Kelas', 'Jurusan', 'Kehadiran', 'SPP', 'Aksi'], state.students.map((student) => {
    const programLabel = student.program === 'PPTAK' ? 'Program PPTAK (1 Tahun)' : student.program === 'KWNQ' ? 'Program KWNQ (3 Bulan)' : student.program || '-';
    const classLabel = student.className || 'Program khusus';
    const majorName = (state.majors || majors).find((major) => major.id === student.major)?.name || '-';
    const action = currentRoleIsAdmin() ? `<div class="actions-inline"><button type="button" class="icon-btn" data-edit-student="${student.id}">${icon('pencil', 16)}</button><button type="button" class="icon-btn" data-delete-student="${student.id}" title="Hapus">${icon('trash-2', 16)}</button></div>` : '-';
    return `<tr><td><div class="person"><span class="avatar">${initials(student.name)}</span><div><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.parent || '-')} - ${escapeHtml(student.nis || '-')}</small></div></div></td><td>${escapeHtml(programLabel)}<br><small>${escapeHtml(classLabel)}</small></td><td>${escapeHtml(majorName)}</td><td>${student.attendance || 0}%</td><td>${escapeHtml(student.spp || 'Belum ada data')}</td><td>${action}</td></tr>`;
  }).join(''), 'Belum ada data santri');
}
function classesTable() {
  return table(['Program', 'Kelas', 'Jurusan', 'Wali Kelas', 'Santri', 'Aksi'], state.classes.map((klass) => {
    const program = programs.find((item) => item.id === klass.programId);
    const major = (state.majors || majors).find((item) => item.id === klass.majorId);
    const programLabel = klass.programId === 'PPTAK' ? 'Program PPTAK (1 Tahun)' : klass.programId === 'KWNQ' ? 'Program KWNQ (3 Bulan)' : program ? program.name : klass.programId;
    const action = currentRoleIsAdmin() ? `<button class="icon-btn" data-edit-class="${klass.id}">${icon('pencil', 15)}</button>` : '-';
    return `<tr><td>${escapeHtml(programLabel)}</td><td><b>${escapeHtml(klass.name || '-')}</b></td><td>${escapeHtml(klass.programId === 'SMK' && major ? major.name : '-')}</td><td>${escapeHtml(klass.wali || '-')}</td><td>${state.students.filter((student) => student.className === klass.name).length}</td><td>${action}</td></tr>`;
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
      return `<tr><td><b>${escapeHtml(student.name)}</b><small>${escapeHtml(student.nis || '-')}</small></td><td>${escapeHtml(student.room || '-')}</td><td>${money(balance)}</td><td>${money(spent)}</td></tr>`;
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
  const expenseForm = (currentRoleIsAdmin() || ['pembina', 'musyrif'].includes(role)) ? `<form id="pocket-expense-form" class="form-grid"><label>Santri<select name="studentId">${managedStudents.map((item) => `<option value="${item.id}">${escapeHtml(item.name)}  -  ${escapeHtml(item.nis)}</option>`).join('')}</select></label><label>Nominal Pengeluaran (Rp)<input name="amount" type="number" min="1" step="1000" required></label><label class="full">Keperluan<input name="note" placeholder="Contoh: kantin, koperasi"></label><button type="submit" class="btn btn-primary full">Catat Pengeluaran</button></form>` : '';
  const pending = state.pocketTransactions.filter((item) => item.type === 'Top Up' && item.status === 'Pending');
  const approval = currentRoleIsAdmin() ? table(['Santri', 'Nominal', 'Tanggal', 'Catatan', 'Aksi'], pending.map((item) => `<tr><td>${escapeHtml(studentById(item.studentId).name)}</td><td>${money(item.amount)}</td><td>${formatDate(item.date)}</td><td>${escapeHtml(item.note || '-')}</td><td><button type="button" class="btn btn-small btn-primary" data-pocket-approve="${item.id}">Verifikasi</button></td></tr>`).join(''), 'Tidak ada top up pending') : '';
  const roomSummary = role === 'pembina' || role === 'musyrif' ? pocketRoomSummary(managedStudents) : '';
  return `${welcome('UANG SAKU SANTRI', 'Saldo dan transaksi', 'Top up wali diverifikasi admin, pengeluaran langsung mengurangi saldo.', '')}<div class="finance-grid"><div class="finance-tile"><span>Saldo ${escapeHtml(student.name)}</span><b>${money(balance)}</b></div><div class="finance-tile"><span>Total top up</span><b>${money(transactions.filter((item) => item.type === 'Top Up' && item.status !== 'Pending').reduce((sum, item) => sum + Number(item.amount || 0), 0))}</b></div><div class="finance-tile"><span>Total pengeluaran</span><b>${money(transactions.filter((item) => item.type === 'Pengeluaran').reduce((sum, item) => sum + Number(item.amount || 0), 0))}</b></div></div><div class="grid-2">${isParent ? section('Ajukan Top Up', 'Status awal menunggu verifikasi admin', topUpForm) : ''}${expenseForm ? section('Catat Pengeluaran', 'Hanya admin atau pembina', expenseForm) : ''}</div>${approval ? section('Verifikasi Top Up', 'Persetujuan admin', approval) : ''}${roomSummary}${section('Riwayat Uang Saku', 'Mutasi saldo terbaru', table(['Tanggal', 'Jenis', 'Nominal', 'Status', 'Catatan'], transactions.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${escapeHtml(item.type)}</td><td>${money(item.amount)}</td><td>${item.status ? statusBadge(item.status) : statusBadge('Verified')}</td><td>${escapeHtml(item.note || '-')}</td></tr>`).join(''), 'Belum ada transaksi'))}`;
}
function teachersTable() {
  return table(['Nama', 'Mapel', 'Peran', 'Telepon', 'Status', 'Aksi'], state.teachers.map((teacher) => `<tr><td><b>${escapeHtml(teacher.name)}</b></td><td>${escapeHtml(teacher.subject || '-')}</td><td>${escapeHtml(teacher.role || '-')}</td><td>${escapeHtml(teacher.phone || '-')}</td><td>${statusBadge(teacher.status || 'Aktif')}</td><td><button class="icon-btn" data-edit-teacher="${teacher.id}">${icon('pencil', 15)}</button></td></tr>`).join(''), 'Belum ada data guru');
}
function accountsTable() {
  return table(['Nama', 'Username', 'Peran', 'Password', 'Aksi'], state.internalAccounts.map((account) => {
    const accountRoles = Array.isArray(account.roles) && account.roles.length ? account.roles : [roles[account.role]?.label || account.role];
    return `<tr><td><b>${escapeHtml(account.name || account.nama)}</b></td><td>${escapeHtml(account.username)}</td><td>${accountRoles.map((role) => `<span class="badge badge-neutral">${escapeHtml(role)}</span>`).join(' ')}</td><td><code>${escapeHtml(account.password)}</code><small>${account.role === 'mahad' ? 'Tanpa batas' : `Ganti: ${account.passwordChangeCount || 0}/2`}</small></td><td><button type="button" class="btn btn-small btn-ghost" data-reset-account="${account.id}">Reset Password</button>${account.id !== 'ACC-SUPER' && account.id !== 'ACC-MASTER' ? ` <button type="button" class="btn btn-small btn-ghost" data-delete-account="${account.id}">Hapus Akun</button>` : ''}${isMasterAdminSession() && account.role !== 'master_admin' ? ` <button type="button" class="btn btn-small btn-ghost" data-toggle-account="${account.id}">${account.status === 'Aktif' ? 'Nonaktifkan' : 'Aktifkan'}</button> <button type="button" class="btn btn-small btn-ghost" data-edit-account="${account.id}">Edit Role</button>` : ''}</td></tr>`;
  }).join(''));
}
function ensureStudentAccounts(student) {
  if (!student?.nis) return;
  const nis = String(student.nis).trim();
  const phone = String(student.parentPhone || student.phoneParent || '').trim();
  const accountDefinitions = [
    { role: 'santri', username: nis, password: nis, name: student.name },
    { role: 'wali', username: `ortu_${nis}`, password: phone || nis, name: `Wali dari ${student.name}` }
  ];
  accountDefinitions.forEach((definition) => {
    const existing = state.internalAccounts.find((account) => account.username === definition.username);
    const account = {
      id: existing?.id || `ACC-${Date.now()}-${definition.role}`,
      ...definition,
      studentId: student.id,
      status: existing?.status || 'Aktif',
      active: existing?.active !== false,
      passwordChangeCount: existing?.passwordChangeCount || 0,
      roles: [roles[definition.role]?.label || (definition.role === 'santri' ? 'Santri' : 'Wali Santri')]
    };
    if (existing) Object.assign(existing, account);
    else state.internalAccounts.push(account);
  });
  state.users = state.internalAccounts;
}
function eventsTable() {
  const events = state.events.slice().sort((a, b) => new Date(`${a.date || today}T00:00:00`) - new Date(`${b.date || today}T00:00:00`));
  return table(['Tanggal', 'Event', 'Lokasi', 'Peserta', 'Status'], events.map((event) => `<tr><td>${formatDate(event.date)}</td><td><b>${event.title}</b></td><td>${event.location}</td><td>${event.audience}</td><td>${statusBadge(event.status)}</td></tr>`).join(''));
}
function announcementsView() {
  const action = canManageAnnouncements() ? `<button class="btn btn-primary" data-action="add-announcement">${icon('plus')} Buat Pengumuman</button>` : '';
  const rows = state.announcements.map((item) => `<tr><td><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.detail || '-')}</small></td><td>${formatDate(item.date)}</td><td>${escapeHtml(item.author || '-')}</td><td>${canManageAnnouncements() ? `<div class="actions-inline"><button class="icon-btn" data-edit-announcement="${item.id}" title="Edit">${icon('pencil', 15)}</button><button class="icon-btn" data-delete-announcement="${item.id}" title="Hapus">${icon('trash-2', 15)}</button></div>` : '-'}</td></tr>`).join('');
  return section('Pengumuman', 'Informasi resmi untuk seluruh role', table(['Judul & Detail', 'Tanggal', 'Oleh', 'Aksi'], rows), action);
}
function promoteStudents() {
  if (!canPromoteStudents()) {
    alert("Kenaikan kelas hanya dapat diproses oleh Ma'had / Admin atau Kepala Sekolah.");
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
  if (!canViewPkl()) return section('Laporan PKL Santri', 'Akses terbatas untuk Guru DLE, Guru Instrumentasi, dan manajemen.', '<div class="notice">Anda tidak memiliki hak akses ke modul Laporan PKL.</div>');
  const student = currentStudent();
  if (effectiveRole() === 'student' && !isPklEligible(student)) {
    return section('Praktik Kerja Lapangan', 'Modul belum dibuka', `<div class="notice">${icon('lock', 25)}<b>Akses PKL belum tersedia</b><p class="metric-note">PKL hanya dibuka untuk siswa SMK kelas 11 semester 2 atau kelas 12 semester 1. Status Anda saat ini: kelas ${escapeHtml(student.grade || '-')} semester ${escapeHtml(student.semester || '-')}.</p></div>`);
  }
  return pklView();
}

function pklTable() {
  return `<div class="table-responsive table-wrap">${table(['Santri', 'Jam Masuk', 'Jam Pulang', 'Status Absensi', 'Deskripsi Kegiatan', 'Foto'], state.pklReports.map((report) => `<tr><td>${escapeHtml(studentById(report.studentId).name)}</td><td>${escapeHtml(report.checkIn || '-')}</td><td>${escapeHtml(report.checkOut || '-')}</td><td>${escapeHtml(report.status || '-')}</td><td>${escapeHtml(report.activity || report.lastReport || '-')}</td><td>${report.photo ? `<a href="${escapeHtml(report.photo)}" target="_blank" rel="noopener">Lihat Foto</a>` : '-'}</td></tr>`).join(''), 'Belum ada laporan PKL')}</div>`;
}
function pklView() {
  const canInput = effectiveRole() === 'guru' && pklSpecialistAccount();
  const form = canInput ? `<form id="pkl-report-form" class="form-grid"><label>Santri<select name="studentId">${state.students.filter((student) => student.program === 'SMK').map((student) => `<option value="${student.id}">${escapeHtml(student.name)}</option>`).join('')}</select></label><label>Jam Masuk<input type="time" name="checkIn" required></label><label>Jam Pulang<input type="time" name="checkOut" required></label><label>Status Absensi<select name="status"><option>Hadir</option><option>Izin</option><option>Sakit</option></select></label><label class="full">Deskripsi Kegiatan<textarea name="activity" required></textarea></label><label class="full">Unggah Foto (opsional)<input type="file" name="photo" accept="image/*"></label><button class="btn btn-primary full" type="submit">Simpan Laporan PKL</button></form>` : '';
  return `${welcome('PRAKTIK KERJA LAPANGAN', 'Laporan PKL Santri', 'Jam kerja, status absensi, kegiatan, dan dokumentasi praktik.', '')}${form ? section('Input Laporan PKL', 'Form sederhana tanpa progress persentase.', form) : ''}${section('Rekap PKL', 'Monitoring laporan praktik santri.', pklTable())}`;
}

function tahfizhSemesterRows(semester, academicYear) {
  const records = state.tahfizhSemesterRecords.filter((record) => String(record.semester) === String(semester) && record.academicYear === academicYear);
  return state.students.map((student) => {
    const record = records.find((item) => item.studentId === student.id) || {};
    const attendance = state.attendance.filter((item) => item.type === 'tahfizh' && item.studentId === student.id && semesterDateMatches(item.date, semester, academicYear));
    const counts = ['Hadir', 'Izin', 'Sakit', 'Alpa'].reduce((result, status) => ({ ...result, [status]: attendance.filter((item) => item.status === status).length }), {});
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const percent = total ? Math.round(counts.Hadir / total * 100) : 0;
    return { student, record, counts, percent };
  });
}
function semesterDateMatches(date, semester, academicYear) {
  const [start] = String(academicYear || '').split('/');
  const year = Number(start);
  const month = new Date(`${date}T00:00:00`).getMonth() + 1;
  return semester === '1' ? new Date(`${date}T00:00:00`).getFullYear() === year && month >= 7 : new Date(`${date}T00:00:00`).getFullYear() === year + 1 && month <= 6;
}
function tahfizhSemesterView() {
  const role = effectiveRole();
  const canEdit = ['pembina', 'musyrif', 'guru_tahfizh'].includes(role) || (role === 'guru' && currentAccount()?.isTahfizhTeacher === true);
  const defaults = semesterDefaults();
  const filter = state.tahfizhSemesterFilter || defaults;
  const rows = tahfizhSemesterRows(filter.semester, filter.academicYear);
  const tableHtml = `<div class="table-responsive table-wrap"><table><thead><tr><th>Nama Santri</th><th>Kelas/Halaqah</th><th>Target Semester</th><th>Capaian Ziyadah</th><th>Status Mutqin</th><th>Predikat/Nilai</th><th>Musyrif Pembina</th><th>Absensi Halaqah</th>${canEdit ? '<th>Aksi</th>' : ''}</tr></thead><tbody>${rows.map(({ student, record, counts, percent }) => `<tr><td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.className || '-')}</td><td>${escapeHtml(record.target || '-')}</td><td>${escapeHtml(record.achievement || '-')}</td><td>${escapeHtml(record.mutqin || 'Belum dinilai')}</td><td>${escapeHtml(record.score ?? '-')}</td><td>${escapeHtml(record.musyrif || '-')}</td><td>Hadir ${counts.Hadir} - Izin ${counts.Izin} - Sakit ${counts.Sakit} - Alpa ${counts.Alpa}<br><small>${percent}%</small></td>${canEdit ? `<td><button type="button" class="btn btn-small btn-ghost" data-edit-semester-tahfizh="${student.id}">Edit</button></td>` : ''}</tr>`).join('') || '<tr><td colspan="9" class="empty">Belum ada rekap semester.</td></tr>'}</tbody></table></div>`;
  return `${welcome('REKAP TAHFIZH PER SEMESTER', 'Rapor Tahfizh Semester', 'Target, capaian ziyadah, mutqin, nilai, pembina, dan kehadiran halaqah.', `<button type="button" class="btn btn-primary" data-action="export-tahfizh-semester">${icon('download')} Export PDF / Cetak Rapor</button>`)}${section('Filter Semester', 'Pilihan default mengikuti Juli - Ganjil dan Januari - Genap.', semesterFilterForm())}${section('Rekap Tahfizh Semester', `${filter.semester === '1' ? 'Ganjil' : 'Genap'} - ${filter.academicYear}`, tableHtml)}`;
}
function attendanceSemesterView() {
  const defaults = semesterDefaults();
  const filter = state.attendanceSemesterFilter || defaults;
  const rows = state.students.map((student) => {
    const records = state.attendance.filter((item) => item.type === 'kelas' && item.studentId === student.id && semesterDateMatches(item.date, filter.semester, filter.academicYear));
    const counts = ['Hadir', 'Izin', 'Sakit', 'Alpa'].map((status) => records.filter((item) => item.status === status).length);
    const percent = records.length ? Math.round(counts[0] / records.length * 100) : 0;
    return `<tr><td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.className || '-')}</td><td>${counts[0]}</td><td>${counts[1]}</td><td>${counts[2]}</td><td>${counts[3]}</td><td>${percent}%</td></tr>`;
  }).join('');
  return `${welcome('REKAP ABSENSI PER SEMESTER', 'Absensi Santri Semester', 'Rekap hadir, izin, sakit, alpa, dan persentase kehadiran.', `<button type="button" class="btn btn-primary" data-action="export-attendance-semester">${icon('download')} Export PDF</button>`)}${section('Filter Semester', 'Filter otomatis dapat dipilih kembali untuk arsip.', semesterFilterForm('attendance-semester-filter'))}${section('Rekap Absensi', `${filter.semester === '1' ? 'Ganjil' : 'Genap'} - ${filter.academicYear}`, `<div class="table-responsive table-wrap">${table(['Nama Santri', 'Kelas', 'Total Hadir', 'Izin', 'Sakit', 'Alpa', 'Persentase Kehadiran (%)'], rows)}</div>`)}`;
}
function openTahfizhSemesterModal(studentId) {
  if (!['pembina', 'musyrif', 'guru_tahfizh'].includes(effectiveRole()) && !(effectiveRole() === 'guru' && currentAccount()?.isTahfizhTeacher)) return;
  const filter = state.tahfizhSemesterFilter || semesterDefaults();
  const existing = state.tahfizhSemesterRecords.find((item) => item.studentId === studentId && String(item.semester) === String(filter.semester) && item.academicYear === filter.academicYear) || {};
  openModal('Edit Rekap Tahfizh Semester', `<form id="semester-tahfizh-form" class="form-grid"><label>Target Semester<input name="target" value="${escapeHtml(existing.target || '')}" required></label><label>Capaian Ziadah Realisasi<input name="achievement" value="${escapeHtml(existing.achievement || '')}" required></label><label>Status Mutqin<select name="mutqin"><option ${existing.mutqin === 'Mutqin' ? 'selected' : ''}>Mutqin</option><option ${existing.mutqin === 'Baik' ? 'selected' : ''}>Baik</option><option ${existing.mutqin === 'Perlu Bimbingan' ? 'selected' : ''}>Perlu Bimbingan</option></select></label><label>Predikat/Nilai<input name="score" type="number" min="0" max="100" value="${escapeHtml(existing.score ?? '')}" required></label><label class="full">Nama Musyrif Pembina<input name="mentor" value="${escapeHtml(existing.mentor || currentAccount()?.name || '')}" required></label><button class="btn btn-primary full" type="submit">Simpan Rekap</button></form>`);
  $('#semester-tahfizh-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target).entries());
    if (existing.id) Object.assign(existing, values);
    else state.tahfizhSemesterRecords.push({ id: `TS-${Date.now()}`, studentId, semester: filter.semester, academicYear: filter.academicYear, ...values });
    persist(); closeModal(); render();
  });
}
function exportSemesterReport(type) {
  const content = type === 'tahfizh' ? document.querySelector('.table-responsive')?.innerHTML : document.querySelector('.table-responsive')?.innerHTML;
  if (!content) return;
  downloadDocumentPdf(`<article class="document-container"><h1 style="text-align:center">${type === 'tahfizh' ? 'Rapor Tahfizh Semester' : 'Rekap Absensi Semester'}</h1><p style="text-align:center">${escapeHtml(formatLocalLongDate())}</p>${content}</article>`, `${type === 'tahfizh' ? 'Rapor-Tahfizh' : 'Rekap-Absensi'}-${new Date().toISOString().slice(0, 10)}`).catch((error) => { console.error('[BoardingPro] Ekspor rekap semester gagal:', error); showToast('Rekap gagal diunduh.', 'error'); });
}

function permitForm() {
  const student = currentStudent();
  if (effectiveRole() !== 'parent') return section('Perizinan Santri', 'Pengajuan izin dilakukan oleh Orang Tua / Wali.', '<div class="notice">Akun siswa hanya dapat melihat status izin melalui portalnya. Silakan minta Orang Tua/Wali mengajukan izin.</div>');
  return section('Ajukan Perizinan Santri', "Pengajuan maksimal 3 hari; Admin/Mahad dapat menyesuaikan durasi saat verifikasi.", `<form id="permit-form" class="form-grid"><label>Santri<input value="${escapeHtml(student.name)}  -  ${escapeHtml(student.className)}" disabled><input type="hidden" name="studentId" value="${escapeHtml(student.id)}"></label><label>Jenis Izin<select name="type"><option value="Keluar Kompleks">Izin Keluar Kompleks</option><option value="Pulang / Mudik">Izin Pulang / Mudik</option></select></label><label>Tanggal Mulai<input name="date" type="date" value="${today}" required></label><label>Durasi Diajukan (hari)<input name="requestedDays" type="number" min="1" max="3" value="1" required></label><label class="full">Alasan<textarea name="reason" required placeholder="Contoh: Keperluan keluarga..."></textarea></label><div class="full"><button class="btn btn-primary" type="submit">${icon('send')} Kirim Pengajuan</button></div></form>${section('Riwayat Izin Anak', 'Surat digital tersedia setelah disetujui.', permitTable(false))}`);
}
function paymentForm() {
  const categories = [financeCategories.spp, financeCategories.foundation, ...financeCategories.maahadNonSpp, financeCategories.pocketMoney, financeCategories.custom];
  return renderPaymentDestinationDetails() + section('Konfirmasi Pembayaran', "Kirim konfirmasi SPP, non-SPP ma'had atau uang saku", `<form id="payment-form" class="form-grid"><label>Jenis Pembayaran<select name="category">${categories.map((category) => `<option value="${category.id}">${category.label}</option>`).join('')}</select></label><label>Periode<input name="period" value="September 2026" required></label><label>Nominal Bayar (Rp)<input name="amount" type="number" min="1" required></label><label>Metode<select name="method"><option>Transfer BSI</option><option>Virtual Account</option><option>Tunai ke Admin</option></select></label><label class="full">Upload Bukti Transfer (gambar)<input id="upload-receipt" name="receiptImage" type="file" accept="image/*"><small id="receipt-scan-status">Belum ada pemindaian.</small><span id="receipt-preview" class="receipt-preview" hidden></span></label><label class="full">Catatan / Nama file bukti<input name="proof" placeholder="contoh: bukti-transfer.jpg" required></label><div class="full"><button type="submit" class="btn btn-primary">${icon('send')} Kirim Konfirmasi</button></div></form>${section('Riwayat Pembayaran', 'Status verifikasi admin', paymentTable(false, currentStudent().id))}${compactSection('Tagihan & Kuitansi', 'Rincian pembayaran santri', renderWaliInvoices(currentStudent().nis))}`);
}
function scanTransferReceipt(file) {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File) || !file.type.startsWith('image/')) {
      reject(new Error('Bukti transfer harus berupa gambar.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Bukti transfer tidak dapat dibaca.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const image = new Image();
      image.onload = () => {
        const candidate = file.name.match(/(?:rp|nominal|amount|transfer)[^\d]*(\d[\d.,]*)/i);
        const digits = candidate ? candidate[1].replace(/[.,]/g, '') : '';
        resolve({ dataUrl, width: image.naturalWidth, height: image.naturalHeight, amount: digits ? Number(digits) : 0 });
      };
      image.onerror = () => reject(new Error('Format gambar bukti transfer tidak valid.'));
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
let modalEscapeHandler = null;
function openModal(title, content) {
  closeModal();
  $('#modal-root').innerHTML = `<div class="modal-backdrop modal-overlay" data-modal-backdrop><div class="modal modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head modal-card-header no-print"><h2 id="modal-title" style="font-size:1rem;font-weight:600">${escapeHtml(title)}</h2><button type="button" class="btn btn-ghost modal-close" data-close-modal aria-label="Tutup" onclick="closeModal()"><span aria-hidden="true" style="font-size:1.35rem;line-height:1">×</span> Tutup</button></div><div class="modal-body">${content}</div></div></div>`;
  const root = $('#modal-root');
  root.querySelector('[data-close-modal]').addEventListener('click', closeModal);
  root.querySelector('[data-modal-backdrop]').addEventListener('click', (event) => {
    if (event.target === event.currentTarget) closeModal();
  });
  modalEscapeHandler = (event) => {
    if (event.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', modalEscapeHandler);
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
function closeModal() {
  if (modalEscapeHandler) {
    document.removeEventListener('keydown', modalEscapeHandler);
    modalEscapeHandler = null;
  }
  $('#modal-root').innerHTML = '';
}
function createInvoiceForPayment(payment) {
  if (!payment || payment.status !== 'Verified') return null;
  const existing = state.invoices.find((invoice) => invoice.paymentId === payment.id);
  if (existing) return existing;
  const sequence = String(state.invoices.length + 1).padStart(4, '0');
  const invoice = { id: `INV-${Date.now()}`, paymentId: payment.id, studentId: payment.studentId, category: payment.category, label: payment.label || categoryLabel(payment.category), description: payment.description || payment.proof || 'Pembayaran BoardingPro STKIS', period: payment.period || null, number: `INV/${today.slice(0, 4)}/${today.slice(5, 7)}/${sequence}`, issuedAt: today, total: Number(payment.amount || 0), status: 'Paid', applicantName: payment.applicantName || 'Orang Tua / Wali', applicantSignedAt: payment.submittedAt, applicantQrPayload: payment.applicantQrPayload, verifierName: payment.verifierName || roles.mahad.label, verifierSignedAt: payment.verifierSignedAt || new Date().toISOString(), verifierQrPayload: payment.verifierQrPayload };
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
  return `${receipt ? 'KUITANSI PEMBAYARAN' : 'INVOICE DIGITAL'}\nBoardingPro STKIS\n${receipt ? receipt.number : details.number}\nSantri: ${student.name} (${SecurityMasker.identity(student.nis)})\nKategori: ${details.categoryLabel}\nPeruntukan: ${details.description}\n${details.isSpp && details.period ? `Periode: ${details.period}\n` : ''}Tanggal: ${formatDate(details.date)}\nTotal: ${money(details.total)}\nStatus: ${details.status}\nTerima kasih.`;
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
  const detailRows = `<tr><td>Subtotal</td><td class="currency">${money(subtotal)}</td></tr><tr><td>Potongan/Beasiswa</td><td class="currency">- ${money(adjustment.scholarship + adjustment.discount)}</td></tr><tr><td><b>Total Kewajiban</b></td><td class="currency"><b>${money(total)}</b></td></tr>`;
  const invoiceSignatureBlock = `<div class="signature-grid" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:28px">${signatureQrHtml('Pemohon', source.applicantName || 'Orang Tua / Wali', source.applicantSignedAt, source.applicantQrPayload || { documentId: source.id, documentType: 'invoice', role: 'parent' })}${signatureQrHtml('Mengetahui & Menyetujui', source.verifierName || (paid ? 'Administrator' : 'Belum diverifikasi'), source.verifierSignedAt, source.verifierQrPayload || { documentId: source.id, documentType: 'invoice', role: 'verifier' })}</div>`;
  const cleanRows = `<tr><td>Nomor</td><td>${escapeHtml(source.number || source.id)}</td></tr><tr><td>Santri</td><td>${escapeHtml(student.name)} (${escapeHtml(SecurityMasker.identity(student.nis || '-'))})</td></tr><tr><td>Kategori</td><td>${escapeHtml(categoryLabel(source.category))}</td></tr>${detailRows}<tr><td>Status</td><td>${paid ? 'LUNAS' : 'BELUM LUNAS'}</td></tr>`;
  const pageStyle = '@page{size:A4 portrait;margin:15mm}.document-container,.receipt-document{width:100%;max-width:210mm;min-height:297mm;padding:15mm}';
  const html = `<article class="document-container invoice-document${isReceipt ? ' receipt-document' : ''}">${header}<div class="doc-header"><h2>${escapeHtml(title)}</h2><span class="status-badge ${paid ? 'status-badge--verified' : 'status-badge--draft'}">${paid ? 'Terverifikasi' : 'Draft'}</span></div><table class="clean-table">${cleanRows}</table>${invoiceSignatureBlock}<footer class="document-footer">Security Hash Code: <b>${hash}</b></footer></article>${documentActionButtons(isReceipt ? 'receipt' : 'invoice', isReceipt ? receipt.id : source.id, isReceipt ? 'Print Kwitansi' : 'Print Invoice')}`;
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
  const documentCard = `<div class="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm"><div class="flex flex-wrap items-start justify-between gap-3"><div><span class="text-base font-semibold text-slate-900">${documentTitle}</span><p class="mt-1 text-xs text-slate-500">BoardingPro STKIS  -  ${escapeHtml(studentById(invoice.studentId).name)}</p></div><div class="flex gap-2"><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${details.categoryClass}">${details.categoryLabel}</span><span class="inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${details.statusClass}">${details.status}</span></div></div><dl class="mt-4 grid gap-3 sm:grid-cols-2"><div><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">${receipt ? 'Nomor Kuitansi' : 'Nomor Invoice'}</dt><dd class="text-sm font-semibold text-slate-800">${escapeHtml(receipt ? receipt.number : details.number)}</dd></div><div><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tanggal Transaksi</dt><dd class="text-sm text-slate-700">${formatDate(details.date)}</dd></div><div class="sm:col-span-2"><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Pembayaran Untuk</dt><dd class="text-sm text-slate-700">${escapeHtml(details.description)}</dd></div>${periodRow}<div><dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total Nominal</dt><dd class="text-base font-bold text-teal-700">${money(details.total)}</dd></div></dl></div><pre class="document-preview mt-4">${escapeHtml(text)}</pre><div class="actions-inline mt-4"><button type="button" class="btn btn-primary" data-download-document="${invoice.id}">${icon('download')} Download</button><button type="button" class="btn btn-ghost" data-document="print" data-invoice="${invoice.id}" data-receipt="${receipt ? receipt.id : ''}">${icon('printer')} Print</button></div>`;
  openModal(documentTitle, documentCard);
  const download = $('#modal-root').querySelector('[data-download-document]');
  if (download) download.addEventListener('click', () => { const blob = new Blob([text], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${invoice.number.replaceAll('/', '-')}.txt`; anchor.click(); URL.revokeObjectURL(url); });
  const printButton = $('#modal-root').querySelector('[data-document="print"]');
  if (printButton) printButton.addEventListener('click', () => openDocument(invoice.id, receipt && receipt.id, true));
}
function bindActions() {
  bindMajorCodeGenerator();
  const semesterFilter = $('#semester-filter-form');
  if (semesterFilter) semesterFilter.addEventListener('submit', (event) => { event.preventDefault(); state.tahfizhSemesterFilter = Object.fromEntries(new FormData(semesterFilter).entries()); render(); });
  const attendanceSemesterFilter = $('#attendance-semester-filter');
  if (attendanceSemesterFilter) attendanceSemesterFilter.addEventListener('submit', (event) => { event.preventDefault(); state.attendanceSemesterFilter = Object.fromEntries(new FormData(attendanceSemesterFilter).entries()); render(); });
  const pklForm = $('#pkl-report-form');
  if (pklForm) pklForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!pklSpecialistAccount()) return;
    const form = new FormData(pklForm);
    const photo = form.get('photo');
    let photoData = '';
    if (photo instanceof File && photo.size) photoData = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(photo); });
    state.pklReports.unshift({ id: `PKL-${Date.now()}`, studentId: form.get('studentId'), date: today, checkIn: form.get('checkIn'), checkOut: form.get('checkOut'), status: form.get('status'), activity: sanitizeInput(form.get('activity')), photo: photoData });
    persist(); alert('Laporan PKL berhasil disimpan.'); render();
  });
  document.querySelectorAll('[data-edit-semester-tahfizh]').forEach((button) => button.addEventListener('click', () => openTahfizhSemesterModal(button.dataset.editSemesterTahfizh)));
  document.querySelectorAll('[data-action="export-tahfizh-semester"]').forEach((button) => button.addEventListener('click', () => exportSemesterReport('tahfizh')));
  document.querySelectorAll('[data-action="export-attendance-semester"]').forEach((button) => button.addEventListener('click', () => exportSemesterReport('attendance')));
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
  document.querySelectorAll('[data-payment-proof]').forEach((button) => button.addEventListener('click', () => {
    const payment = state.payments.find((item) => item.id === button.dataset.paymentProof);
    if (!payment || !currentRoleIsAdmin()) return;
    const student = studentById(payment.studentId);
    openModal('Pratinjau Bukti Transfer', `<div class="form-grid"><p><b>${escapeHtml(student.name)}</b> - ${escapeHtml(student.className || 'Kelas belum ditentukan')}<br>${escapeHtml(categoryLabel(payment.category))} - ${money(payment.amount)} - ${escapeHtml(payment.period || '-')}</p>${paymentProofPreview(payment)}<p class="metric-note">Status pemindaian: ${escapeHtml(payment.scanStatus || 'Belum dipindai')}<br>File: ${escapeHtml(payment.receiptFileName || payment.receiptImage || payment.proof || '-')}</p></div>`);
  }));
  document.querySelectorAll('[data-pocket-approve]').forEach((button) => button.addEventListener('click', (e) => { e.preventDefault(); if (!currentRoleIsAdmin()) return; const transaction = state.pocketTransactions.find((item) => item.id === button.dataset.pocketApprove && item.type === 'Top Up' && item.status === 'Pending'); if (!transaction) return; transaction.status = 'Lunas'; const balance = state.pocketBalances.find((item) => item.studentId === transaction.studentId); if (balance) balance.balance = Number(balance.balance || 0) + Number(transaction.amount || 0); else state.pocketBalances.push({ studentId: transaction.studentId, balance: Number(transaction.amount || 0) }); const payment = { id: `PAY-${transaction.id}`, studentId: transaction.studentId, category: 'POCKET_MONEY', period: 'September 2026', amount: Number(transaction.amount || 0), method: transaction.method || 'Top Up Uang Saku', status: 'Verified', submittedAt: transaction.date, proof: transaction.note || '' }; state.payments.push(payment); createInvoiceForPayment(payment); persist(); render(); }));
  document.querySelectorAll('[data-billing-read]').forEach((button) => button.addEventListener('click', () => { const bill = state.billingNotifications.find((item) => item.id === button.dataset.billingRead); if (bill) { bill.read = true; persist(); render(); } }));
  document.querySelectorAll('[data-document="invoice"]').forEach((button) => button.addEventListener('click', () => renderInvoiceModal(button.dataset.invoice, false)));
  document.querySelectorAll('[data-document="receipt"]').forEach((button) => button.addEventListener('click', () => openDocument(null, button.dataset.receipt, false)));
  document.querySelectorAll('[data-document="print"]').forEach((button) => button.addEventListener('click', () => openDocument(button.dataset.invoice, button.dataset.receipt, true)));
  document.querySelectorAll('[data-gate]').forEach((button) => button.addEventListener('click', () => { const permit = state.permits.find((item) => item.id === button.dataset.gate); if (!permit) return; const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); const action = permit.checkout ? 'Check-in' : 'Checkout'; if (!permit.checkout) permit.checkout = time; else permit.checkin = time; state.gateEvents.push({ time, action, studentId: permit.studentId, operator: roles.security.demoName }); persist(); render(); }));
  document.querySelectorAll('[data-attendance]').forEach((button) => button.addEventListener('click', () => { const record = state.attendance.find((item) => item.id === button.dataset.attendance); if (record) { record.status = record.status === 'Hadir' ? 'Izin' : record.status === 'Izin' ? 'Alpa' : 'Hadir'; persist(); render(); } }));
  document.querySelectorAll('[data-teacher-detail]').forEach((button) => button.addEventListener('click', () => openTeacherAttendanceDetail(button.dataset.teacherDetail)));
  document.querySelectorAll('[data-action="add-student"]').forEach((button) => button.addEventListener('click', openStudentModal));
  document.querySelectorAll('[data-action="promote-students"]').forEach((button) => button.addEventListener('click', promoteStudents));
  document.querySelectorAll('[data-edit-student]').forEach((button) => button.addEventListener('click', () => openStudentModal(studentById(button.dataset.editStudent))));
  document.querySelectorAll('[data-reset-account]').forEach((button) => button.addEventListener('click', () => { if (!canManageUserAccounts()) return; const account = state.internalAccounts.find((item) => item.id === button.dataset.resetAccount); if (!account || (account.role === 'master_admin' && !isMasterAdminSession())) return; account.password = ['student', 'santri'].includes(account.role) ? String(account.username) : ['parent', 'wali'].includes(account.role) ? String(account.username).replace(/^ortu_/, '') : 'user123'; account.passwordChangeCount = 0; persist(); render(); alert('Password akun berhasil direset.'); }));
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
      state.users = state.internalAccounts;
      if (state.currentUser?.studentId === student.id) state.currentUser = null;
      persist();
      render();
    });
  }));
  document.querySelectorAll('[data-action="add-point"]').forEach((button) => button.addEventListener('click', openPointModal));
  document.querySelectorAll('[data-action="add-grade"]').forEach((button) => button.addEventListener('click', openGradeModal));
  const teacherAcademicFilterForm = $('#teacher-academic-filter');
  if (teacherAcademicFilterForm) teacherAcademicFilterForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.teacherAcademicFilter = Object.fromEntries(new FormData(teacherAcademicFilterForm).entries());
    persist();
    render();
  });
  document.querySelectorAll('[data-action="add-teacher-student-attendance"]').forEach((button) => button.addEventListener('click', openTeacherStudentAttendanceModal));
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
  document.querySelectorAll('[data-action="reset-data"]').forEach((button) => button.addEventListener('click', () => {
    if (!currentRoleIsAdmin()) return;
    openConfirmModal('Reset Data Transaksional', 'Hapus seluruh data santri, presensi, nilai, Tahfizh, izin, tagihan, pembayaran, invoice, dan aktivitas? Akun serta konfigurasi sistem tetap dipertahankan.', () => {
      try {
        resetTransactionalData();
        closeModal();
        alert('Data transaksional berhasil dikosongkan. Akun dan konfigurasi sistem tetap aman.');
        render();
      } catch (error) {
        console.error('[BoardingPro] Gagal mereset data:', error);
        alert('Data gagal direset. Silakan coba lagi.');
      }
    });
  }));
  document.querySelectorAll('[data-action="add-billing"]').forEach((button) => button.addEventListener('click', openBillingModal));
  document.querySelectorAll('[data-edit-billing]').forEach((button) => button.addEventListener('click', () => { if (canManageFinance()) openBillingModal(state.financeBills.find((bill) => bill.id === button.dataset.editBilling)); }));
  document.querySelectorAll('[data-action="export"]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await exportReportPdf();
      showToast('Laporan berhasil diunduh.');
    } catch (error) {
      console.error('[BoardingPro] Gagal mengekspor laporan:', error);
      showToast('Laporan gagal diunduh. Silakan coba lagi.', 'error');
    } finally {
      button.disabled = false;
    }
  }));
  const permit = $('#permit-form');
  if (permit) permit.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(permit);
    const studentId = sanitizeInput(form.get('studentId'));
    const type = sanitizeInput(form.get('type'));
    const date = sanitizeInput(form.get('date'));
    if (isQuotaDeducted({ type }) && weeklyQuotaUsed(studentId, date) >= QUOTA_LIMIT) {
      alert('Kuota Keluar Kompleks minggu ini sudah mencapai 3 kali.');
      return;
    }
    const requestedDays = Math.min(3, Math.max(1, Number(form.get('requestedDays') || 1)));
    const submittedAt = new Date().toISOString();
    const permitId = `IZN-${Date.now()}`;
    const parent = currentAccount();
    state.permits.unshift({
      id: permitId, studentId, type, reason: sanitizeInput(form.get('reason')), date, requestedDays,
      is_quota_deducted: isQuotaDeducted({ type }), approvedDays: null, endDate: null, status: 'Pending',
      approvedBy: null, approvedAt: null, applicantName: parent?.name || parent?.nama || 'Orang Tua / Wali', applicantSignedAt: submittedAt,
      applicantQrPayload: { documentId: permitId, documentType: 'permit', role: 'parent' }, checkout: null, checkin: null
    });
    persist();
    alert('Pengajuan izin berhasil dikirim.');
    render();
  });
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
    if (receipt) receipt.addEventListener('change', async () => {
      const status = $('#receipt-scan-status');
      const preview = $('#receipt-preview');
      const file = receipt.files[0];
      if (!file) return;
      if (status) status.textContent = 'Memindai dan memvalidasi bukti transfer...';
      try {
        const scan = await scanTransferReceipt(file);
        payment.dataset.receiptData = scan.dataUrl;
        payment.dataset.receiptWidth = String(scan.width);
        payment.dataset.receiptHeight = String(scan.height);
        const amount = payment.querySelector('[name="amount"]');
        if (scan.amount && amount) amount.value = String(scan.amount);
        if (preview) {
          preview.hidden = false;
          preview.innerHTML = `<img src="${escapeHtml(scan.dataUrl)}" alt="Pratinjau bukti transfer" style="max-width:280px;max-height:180px;object-fit:contain;border:1px solid #d1fae5;border-radius:10px;margin-top:8px">`;
        }
        if (status) status.textContent = scan.amount ? `Pemindaian selesai. Nominal terdeteksi: Rp ${scan.amount.toLocaleString('id-ID')}. Silakan pastikan benar.` : `Pemindaian selesai (${scan.width} x ${scan.height} px). Nominal silakan diisi atau diperiksa manual.`;
        showToast('Bukti transfer berhasil dipindai dan siap diverifikasi.', 'success');
      } catch (error) {
        payment.dataset.receiptData = '';
        if (preview) { preview.hidden = true; preview.innerHTML = ''; }
        if (status) status.textContent = error.message;
        showToast(error.message, 'error');
      }
    });
    payment.addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(payment); const student = currentStudent(); const itemId = `PAY-${Date.now()}`; const submittedAt = new Date().toISOString(); const parent = currentAccount(); const item = { id: itemId, studentId: student.id, category: form.get('category'), period: form.get('period'), amount: Number(form.get('amount')), method: form.get('method'), status: 'pending_verification', submittedAt, proof: form.get('proof'), receiptImage: form.get('receiptImage')?.name || null, receiptFileName: form.get('receiptImage')?.name || null, receiptImageData: payment.dataset.receiptData || null, scanStatus: payment.dataset.receiptData ? 'Pemindaian berhasil' : 'Belum dipindai', scannedAt: payment.dataset.receiptData ? new Date().toISOString() : null, applicantName: parent?.name || parent?.nama || 'Orang Tua / Wali', applicantQrPayload: { documentId: itemId, documentType: 'invoice', role: 'parent' } }; state.payments.unshift(item); const notice = { id: `notif-payment-${item.id}`, title: `Pembayaran baru A.N ${student.name}`, description: 'Memerlukan konfirmasi verifikasi.', category: 'Keuangan', timestamp: 'Baru', targetView: 'payments', createdAt: new Date().toISOString(), read: false }; ['maahad', 'admin'].forEach((role) => { if (roleNotifications[role]) roleNotifications[role].unshift(clone(notice)); }); persistNotificationState(); persist(); alert('Konfirmasi pembayaran berhasil dikirim dan masuk ke antrean verifikasi.'); render(); });
  }
  const topup = $('#pocket-topup-form');
  if (topup) topup.addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(topup); state.pocketTransactions.push({ id: `TRX-${Date.now()}`, studentId: currentStudent().id, date: today, type: 'Top Up', amount: Number(form.get('amount')), note: form.get('note') || `Top up ${form.get('method')}`, method: form.get('method'), status: 'Pending' }); persist(); alert('Pengajuan top up berhasil dikirim dan menunggu verifikasi admin.'); render(); });
  const expense = $('#pocket-expense-form');
  if (expense) expense.addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(expense); const amount = Number(form.get('amount')); const balance = state.pocketBalances.find((item) => item.studentId === form.get('studentId')); if (!balance || Number(balance.balance || 0) < amount) { alert('Saldo uang saku tidak mencukupi.'); return; } balance.balance -= amount; state.pocketTransactions.push({ id: `TRX-${Date.now()}`, studentId: form.get('studentId'), date: today, type: 'Pengeluaran', amount, note: form.get('note'), status: 'Verified', by: roles[state.role].label }); persist(); alert('Pengeluaran dicatat dan saldo diperbarui.'); render(); });
  const teacherAttendance = $('#teacher-attendance-form');
  if (teacherAttendance) teacherAttendance.addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(teacherAttendance); state.teacherAttendance.unshift({ id: `TA-${Date.now()}`, teacher: state.displayName || roles.guru.demoName, date: today, status: form.get('status'), checkIn: form.get('checkIn') || null, checkOut: form.get('checkOut') || null }); persist(); alert('Presensi pribadi tersimpan.'); render(); });
  const adminPassword = $('#admin-password-form');
  const paymentAccountsForm = $('#payment-accounts-form');
  if (paymentAccountsForm) paymentAccountsForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!canManageFinance()) return;
    const form = new FormData(paymentAccountsForm);
    const readAccount = (prefix) => ({
      bank: String(form.get(`${prefix}Bank`) || '').trim(),
      accountNumber: String(form.get(`${prefix}AccountNumber`) || '').replace(/\s+/g, '').trim(),
      accountName: String(form.get(`${prefix}AccountName`) || '').trim(),
      locked: false
    });
    const education = readAccount('education');
    const pocketMoney = readAccount('pocket');
    if (![education, pocketMoney].every((account) => account.bank && /^[0-9]{6,24}$/.test(account.accountNumber) && account.accountName)) {
      alert('Lengkapi seluruh bank, nomor rekening 6-24 digit, dan nama pemilik rekening.');
      return;
    }
    state.config.paymentAccounts = { education, pocketMoney };
    persist();
    render();
    alert('Rekening SPP dan Uang Saku berhasil diperbarui.');
  });
  if (adminPassword) adminPassword.addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(adminPassword); const account = currentAccount(); const currentPassword = String(form.get('currentPassword') || ''); const newPassword = String(form.get('newPassword') || ''); if (!account || account.password !== currentPassword) { alert('Password saat ini tidak sesuai.'); return; } if (!isMasterAdminSession() && (account.passwordChangeCount || 0) >= 2) { alert("Batas maksimal perubahan kata sandi mandiri telah tercapai (2/2 kali). Untuk melakukan perubahan/reset kata sandi kembali, silakan hubungi Admin Ma'had."); return; } if (newPassword.length < 10 || newPassword !== String(form.get('confirmPassword') || '')) { alert('Password baru minimal 10 karakter dan harus sama dengan konfirmasi.'); return; } account.password = newPassword; if (!isMasterAdminSession()) account.passwordChangeCount = (account.passwordChangeCount || 0) + 1; state.currentUser = account; persist(); adminPassword.reset(); alert('Password berhasil diubah.'); });
}
function openStudentModal(student) {
  if (!currentRoleIsAdmin()) return;
  const editing = Boolean(student && student.id);
  const value = (key, fallback = '') => student && student[key] !== undefined ? student[key] : fallback;
  openModal(editing ? 'Edit Data Santri' : 'Tambah Santri Baru', `<form id="student-modal-form" class="form-grid"><label>Nama Lengkap<input name="name" value="${value('name')}" required></label><label>NIS<input name="nis" value="${value('nis')}" required></label><label>Program<select id="student-program" name="program">${programs.map((program) => `<option value="${program.id}" ${value('program', 'SMK') === program.id ? 'selected' : ''}>${program.name}</option>`).join('')}</select></label><label id="student-class-field">Kelas<input name="className" value="${value('className', 'X')}"></label><label id="student-major-field">Jurusan<select id="student-major" name="major"><option value="">Tanpa Jurusan</option>${currentMajors().map((major) => `<option value="${major.id}" ${value('major', currentMajors()[0]?.id || '') === major.id ? 'selected' : ''}>${escapeHtml(major.name)}</option>`).join('')}</select></label>><label>Nama Wali<input name="parent" value="${value('parent')}"></label><label>No HP Wali<input name="parentPhone" value="${value('parentPhone')}"></label><button type="submit" class="btn btn-primary full">${editing ? 'Simpan Perubahan' : 'Simpan Data'}</button></form>`);
  const studentProgram = $('#student-program');
  const updateStudentProgram = () => { const special = ['PPTAK', 'KWNQ'].includes(studentProgram.value); $('#student-class-field').hidden = special; $('#student-major-field').hidden = special; if (special) { $('#student-major').value = ''; } };
  studentProgram.addEventListener('change', updateStudentProgram);
  updateStudentProgram();
  $('#student-modal-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const values = { name: form.get('name'), nis: form.get('nis'), program: form.get('program'), major: form.get('major'), className: form.get('className'), room: form.get('room'), parent: form.get('parent'), parentPhone: form.get('parentPhone') };
    if (editing) {
      Object.assign(student, values);
      ensureStudentAccounts(student);
    } else {
      const newStudent = { id: `STD-${String(state.students.length + 1).padStart(3, '0')}`, gender: 'L', grade: 10, semester: 1, phone: '', attendance: 100, points: 0, tahfizh: 0, spp: 'Lunas', status: 'Aktif', ...values };
      state.students.push(newStudent);
      ensureStudentAccounts(newStudent);
      alert(`Akun otomatis dibuat: ${newStudent.nis} dan ortu_${newStudent.nis}.`);
    }
    persist();
    closeModal();
    render();
  });
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
  openModal(editing ? 'Edit Guru' : 'Tambah Guru', `<form id="teacher-modal-form" class="form-grid"><label>Nama<input name="name" value="${escapeHtml(value('name'))}" required></label><label>Mata Pelajaran<input name="subject" value="${escapeHtml(value('subject'))}" required></label><label>Peran<select name="role"><option>Guru</option><option>Pembina</option><option>Admin</option></select></label><label>Telepon<input name="phone" value="${escapeHtml(value('phone'))}"></label><button class="btn btn-primary full">Simpan</button></form>`);
  $('#teacher-modal-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.target); const values = { name: form.get('name'), subject: form.get('subject'), role: form.get('role'), phone: form.get('phone'), status: 'Aktif' }; if (editing) Object.assign(teacher, values); else state.teachers.push({ id: `TCH-${Date.now()}`, ...values }); persist(); closeModal(); render(); });
}
function openAccountModal() {
  if (!currentRoleIsAdmin()) return;
  const roleOptions = () => masterRoles().map((role, index) => `<label class="role-option"><input type="checkbox" name="roles" value="${escapeHtml(role)}" ${index === 0 ? 'checked' : ''}> <span>${escapeHtml(role)}</span></label>`).join('');
  openModal('Buat Akun Staf Internal', `<form id="account-modal-form" class="form-grid"><label>Nama Lengkap<input id="nama-staf" name="name" required></label><label>Username / ID<input id="username-staf" name="username" required autocomplete="off"></label><div class="full role-assignment"><div class="role-assignment-head"><b>Penugasan Peran</b><button type="button" class="btn btn-small btn-ghost" id="add-master-role">+ Tambah Opsi Peran</button></div><div id="master-role-options" class="role-options">${roleOptions()}</div></div><label>Password<input name="password" value="123456" required></label><label class="full"><input type="checkbox" name="isTahfizhTeacher"> Bertugas sebagai Guru/Ustadz Tahfizh</label><label class="full"><input type="checkbox" name="isMusyrif"> Bertugas sebagai Musyrif/Pembina Asrama</label><button type="submit" class="btn btn-primary full">Simpan Akun</button></form>`);
  const nameInput = $('#nama-staf');
  const usernameInput = $('#username-staf');
  const updateGeneratedUsername = () => {
    const selectedRole = $('#master-role-options input[name="roles"]:checked')?.value || 'user';
    if (usernameInput.dataset.manual === 'true') return;
    usernameInput.value = usernameForAccount(selectedRole, nameInput.value);
  };
  nameInput.addEventListener('input', () => {
    updateGeneratedUsername();
  });
  usernameInput.addEventListener('input', () => { usernameInput.dataset.manual = 'true'; });
  $('#master-role-options').addEventListener('change', updateGeneratedUsername);
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
    state.internalAccounts.push({ id: `ACC-${Date.now()}`, name: form.get('name'), username, password: form.get('password'), passwordChangeCount: 0, roles: selectedRoles, role: selectedRoles[0], displayName: displayNameForAccount({ name: form.get('name'), role: selectedRoles[0] }), isTahfizhTeacher: form.get('isTahfizhTeacher') === 'on', isMusyrif: form.get('isMusyrif') === 'on' });
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
  if (!['mahad', 'admin', 'kepsek', 'guru', 'guru_tahfizh'].includes(effectiveRole())) return;
  const subjects = effectiveRole() === 'guru' ? teacherSubjects() : [...new Set(state.grades.map((item) => item.subject).filter(Boolean))];
  const filter = state.teacherAcademicFilter || {};
  openModal('Input Nilai Pelajaran', `<form id="grade-modal-form" class="form-grid"><label>Santri<select name="studentId">${teacherScopedStudents().map((student) => `<option value="${student.id}">${escapeHtml(student.name)} - ${escapeHtml(student.className || '-')}</option>`).join('')}</select></label><label>Mata Pelajaran<select name="subject">${subjects.map((subject) => `<option value="${escapeHtml(subject)}" ${filter.subject === subject ? 'selected' : ''}>${escapeHtml(subject)}</option>`).join('')}</select></label><label>Nilai<input name="score" type="number" min="0" max="100" required></label><label class="full">Catatan<input name="note"></label><button class="btn btn-primary full">Simpan Nilai</button></form>`);
  $('#grade-modal-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.target); const student = studentById(form.get('studentId')); state.grades.unshift({ id: `GR-${Date.now()}`, studentId: form.get('studentId'), className: student.className || '', subject: form.get('subject'), score: Number(form.get('score')), note: form.get('note'), teacher: currentAccount()?.name || currentAccount()?.nama || '' }); persist(); closeModal(); render(); });
}
function openTeacherStudentAttendanceModal() {
  if (!['guru', 'guru_tahfizh'].includes(effectiveRole())) return;
  const subjects = teacherSubjects();
  const filter = state.teacherAcademicFilter || {};
  openModal('Input Presensi Siswa', `<form id="teacher-student-attendance-form" class="form-grid"><label>Santri<select name="studentId">${teacherScopedStudents().map((student) => `<option value="${student.id}">${escapeHtml(student.name)} - ${escapeHtml(student.className || '-')}</option>`).join('')}</select></label><label>Mata Pelajaran<select name="subject">${subjects.map((subject) => `<option value="${escapeHtml(subject)}" ${filter.subject === subject ? 'selected' : ''}>${escapeHtml(subject)}</option>`).join('')}</select></label><label>Tanggal<input name="date" type="date" value="${today}" required></label><label>Status<select name="status"><option>Hadir</option><option>Izin</option><option>Sakit</option><option>Alpa</option></select></label><label class="full">Catatan<input name="note"></label><button class="btn btn-primary full">Simpan Presensi</button></form>`);
  $('#teacher-student-attendance-form').addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.target); const student = studentById(form.get('studentId')); state.attendance.unshift({ id: `ATT-${Date.now()}`, type: 'kelas', studentId: form.get('studentId'), className: student.className || '', subject: form.get('subject'), date: form.get('date'), status: form.get('status'), by: currentAccount()?.name || currentAccount()?.nama || roles.guru.demoName, note: form.get('note') || '' }); persist(); closeModal(); render(); });
}
function openTahfizhModal(record) {
  if (!hasTahfizhAccess()) return;
  const editing = Boolean(record);
  const value = (key, fallback = '') => record && record[key] !== undefined ? record[key] : fallback;
  const scopedStudents = currentRoleIsAdmin() ? state.students : halaqohStudents();
  openModal(editing ? 'Edit Setoran Tahfizh' : 'Input Setoran Tahfizh', `<form id="tahfizh-modal-form" class="form-grid"><label>Santri<select name="studentId">${scopedStudents.map((student) => `<option value="${student.id}" ${value('studentId') === student.id ? 'selected' : ''}>${escapeHtml(student.name)} - ${escapeHtml(student.className || '-')}</option>`).join('')}</select></label><label>Halaqoh<input value="${escapeHtml(halaqohLabel())}" disabled></label><label>Jenis<select name="type"><option ${value('type') === 'Ziyadah' ? 'selected' : ''}>Ziyadah</option><option ${value('type') === 'Murajaah' ? 'selected' : ''}>Murajaah</option></select></label><label>Predikat<select name="predikat"><option>Mutqin</option><option>Ziyadah</option></select></label><label>Juz<input name="juz" type="number" min="1" value="${value('juz')}" required></label><label>Surah<input name="surah" value="${escapeHtml(value('surah'))}" required></label><label class="full">Ayat<input name="ayat" value="${escapeHtml(value('ayat'))}" required></label><button type="submit" class="btn btn-primary full">${editing ? 'Simpan Perubahan' : 'Simpan Setoran'}</button></form>`);
  $('#tahfizh-modal-form').addEventListener('submit', (event) => { event.preventDefault(); if (!(currentRoleIsAdmin() || hasTahfizhAccess())) return; const form = new FormData(event.target); const values = { studentId: form.get('studentId'), halaqohId: activeHalaqohId() || studentById(form.get('studentId')).halaqohId || '', juz: Number(form.get('juz')), surah: form.get('surah'), ayat: form.get('ayat'), type: form.get('type'), predikat: form.get('predikat') }; if (editing) Object.assign(record, values); else state.tahfizh.unshift({ id: `TH-${Date.now()}`, ...values, status: 'Menunggu', date: today }); persist(); closeModal(); render(); });
}
function openTahfizhAttendanceModal() {
  if (!hasTahfizhAccess()) return;
  const scopedStudents = currentRoleIsAdmin() ? state.students : halaqohStudents();
  openModal('Input Absensi Jam Tahfizh', `<form id="tahfizh-attendance-form" class="form-grid"><label>Santri<select name="studentId">${scopedStudents.map((student) => `<option value="${student.id}">${escapeHtml(student.name)} - ${escapeHtml(student.nis)}</option>`).join('')}</select></label><label>Halaqoh<input value="${escapeHtml(halaqohLabel())}" disabled></label><label>Tanggal<input name="date" type="date" value="${today}" required></label><label>Status<select name="status"><option>Hadir</option><option>Izin</option><option>Sakit</option><option>Alpa</option></select></label><label class="full">Catatan<input name="note" placeholder="Catatan jam Tahfizh"></label><button class="btn btn-primary full">Simpan Absensi</button></form>`);
  $('#tahfizh-attendance-form').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!hasTahfizhAccess()) return;
    const form = new FormData(event.target);
    state.attendance.unshift({ id: `ATT-TH-${Date.now()}`, type: 'tahfizh', halaqohId: activeHalaqohId() || studentById(form.get('studentId')).halaqohId || '', studentId: form.get('studentId'), date: form.get('date'), status: form.get('status'), by: roles[effectiveRole()]?.label || roles.mahad.label, note: form.get('note') || '' });
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
  const html = `<article class="permit-letter document-container">${kopSuratHtml()}<div style="text-align:center;margin:24px 0 18px"><h1 style="font-size:16px;text-decoration:underline;margin:0">SURAT IZIN KELUAR / PULANG SANTRI</h1><p>Nomor: ${escapeHtml(permit.letterNumber)}</p></div><p>Yang bertanda tangan di bawah ini, Pengasuhan ${escapeHtml(institution.school)}, memberikan izin kepada santri berikut:</p><table style="width:100%;line-height:1.8"><tr><td>Nama Santri</td><td>: <b>${escapeHtml(student.name)}</b></td></tr><tr><td>NIS / NISN</td><td>: ${escapeHtml(student.nis || student.nisn || '-')}</td></tr><tr><td>Kelas / Program</td><td>: ${escapeHtml(student.className || '-')} / ${escapeHtml(student.program || 'Reguler')}</td></tr><tr><td>Orang Tua / Wali</td><td>: ${escapeHtml(student.parent || '-')}</td></tr></table><p>Dengan ketentuan izin sebagai berikut:</p><table style="width:100%;line-height:1.8"><tr><td>Alasan Keperluan</td><td>: ${escapeHtml(permit.reason || '-')}</td></tr><tr><td>Tanggal Berangkat</td><td>: ${formatDate(permit.date)}${permit.departureTime ? `, pukul ${escapeHtml(permit.departureTime)}` : ''}</td></tr><tr><td>Wajib Kembali</td><td>: ${formatDate(endDate)}${permit.returnTime ? `, paling lambat pukul ${escapeHtml(permit.returnTime)}` : ''}</td></tr><tr><td>Total Durasi</td><td>: <b>${permit.approvedDays || permit.requestedDays || 1} hari</b></td></tr></table><div style="border:1px solid #555;padding:10px;margin-top:18px"><b>Catatan:</b> Santri wajib kembali sesuai batas waktu yang ditetapkan.</div>${signatureBlock}<div style="margin-top:38px;text-align:center;font-size:9px">Security Hash: ${escapeHtml(securityHash)}</div></article>${documentActionButtons('permit', permit.id, 'Print Surat')}`;
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
  updateCopyrightYear();
  renderDashboard();
  startInactivityTimer();
  offerInstallPrompt().catch((error) => console.error('[BoardingPro] Prompt instalasi PWA gagal:', error));
}
function showLanding() {
  stopInactivityTimer();
  endSingleSession();
  const landing = $('#landing');
  const shell = $('#app-shell');
  if (!landing || !shell) return;
  landing.hidden = false;
  shell.hidden = true;
  updateCopyrightYear();
  const selector = $('#demo-role');
  const preview = $('#demo-role-preview');
  if (!selector || !preview) return;
  const updatePreview = () => { const role = roles[selector.value]; preview.textContent = `${role.demoName}  -  ${role.description}`; };
  selector.value = state.role;
  selector.onchange = updatePreview;
  updatePreview();
}
document.addEventListener('DOMContentLoaded', () => {
  if (resetWeeklyExitQuota()) persist();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.error('[BoardingPro] Service worker gagal didaftarkan:', error));
  }
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
    activateSingleSession(account);
    saveAuthenticatedUser();
    persist();
    showDashboard();
    window.setTimeout(showUnreadCriticalNotifications, 120);
  });
  const logout = $('#logout');
  if (logout) logout.addEventListener('click', () => { localStorage.removeItem('boardingpro-auth'); secureStorage.set('boardingpro-user', null).catch((error) => console.error('[BoardingPro] Gagal menghapus sesi terenkripsi:', error)); showLanding(); });
  if (localStorage.getItem('boardingpro-auth') === 'true') {
    activateSingleSession(currentAccount());
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

  // Hanya tampil untuk Ma'had / Pengasuhan dan Admin
  if (userRole.includes("ma'had") || userRole.includes("mahad") || userRole.includes("admin") || userRole.includes("pengasuhan")) {
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
window.setInterval(updateLiveDashboardDate, 30000);
updateLiveDashboardDate();


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
    ? notifications.map((item) => `<article class="notification-item ${item.read ? 'notification-read' : ''}" data-notification-id="${escapeHtml(item.id)}" data-notification-target="${escapeHtml(item.targetView || 'dashboard')}"><div class="notification-item-head"><b>${escapeHtml(item.title)}</b><span class="notification-category">${escapeHtml(item.category)}</span></div><p>${escapeHtml(item.description)}</p><time>${escapeHtml(item.timestamp)}${item.read ? '  -  Dibaca' : '  -  Baru'}</time></article>`).join('')
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
