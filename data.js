/* BoardingPro STK IS shared catalogue and seed data.
 * This file is intentionally loaded before app.js and owns every shared dataset.
 */
const roles = {
  mahad: { label: "Ma'had/Admin", icon: 'building-2', description: 'Management Dashboard', demoName: "Ma'had/Admin" },
  admin: { label: 'Admin', icon: 'clipboard-list', description: 'Operational Administration', demoName: 'Admin' },
  master_admin: { label: "Master Admin Ma'had", icon: 'shield-check', description: 'Master Administration Dashboard', demoName: "Master Admin Ma'had" },
  super_admin: { label: 'Super Admin', icon: 'shield-check', description: 'Super User Dashboard', demoName: 'Super Admin' },
  yayasan: { label: 'Yayasan', icon: 'landmark', description: 'Executive Dashboard', demoName: 'Dr. H. Abdullah' },
  pengurus_yayasan: { label: 'Pengurus Yayasan', icon: 'landmark', description: 'Executive Read-only Monitoring', demoName: 'Dr. H. Abdullah' },
  maahad: { label: "Ma'had / Admin", icon: 'building-2', description: 'Management Dashboard', demoName: 'Ust. Hasyim' },
  kepsek: { label: 'Kepala Sekolah', icon: 'school', description: 'Executive Read-only', demoName: 'Drs. Ahmad Fauzi' },
  guru: { label: 'Guru / Ustadz', icon: 'graduation-cap', description: 'Academic Dashboard', demoName: 'Ustadzah Rahma' },
  guru_tahfizh: { label: 'Guru Tahfizh', icon: 'book-open-check', description: 'Tahfizh Dashboard', demoName: 'Ustadz Tahfizh' },
  pembina: { label: 'Pembina', icon: 'shield-check', description: 'Dormitory & Tahfizh', demoName: 'Ust. Salman' },
  musyrif: { label: 'Musyrif / Pembina', icon: 'shield-check', description: 'Dormitory & Tahfizh', demoName: 'Ust. Salman' },
  security: { label: 'Security / Pos Jaga', icon: 'scan-line', description: 'Gatekeeper Dashboard', demoName: 'Pak Joko' },
  parent: { label: 'Orang Tua / Wali', icon: 'users', description: 'Parent Portal', demoName: 'Bpk. Muhammad Fauzi' },
  student: { label: 'Siswa / Santri', icon: 'user-round', description: 'Student Portal', demoName: 'Ahmad Fauzan' },
  santri: { label: 'Siswa / Santri', icon: 'user-round', description: 'Student Portal', demoName: 'Ahmad Fauzan' }
};

const roleNotifications = {
  yayasan: [
    { id: 'notif-yayasan-1', title: 'Laporan keuangan siap ditinjau', description: 'Ringkasan penerimaan dan piutang September 2026 telah diperbarui.', category: 'Keuangan', timestamp: '10 menit lalu', targetView: 'finance' },
    { id: 'notif-yayasan-2', title: 'Progress tahfizh meningkat', description: 'Capaian program tahfizh bulan ini mencapai 86%.', category: 'Akademik', timestamp: 'Hari ini, 08:30', targetView: 'academic' }
  ],
  kepsek: [
    { id: 'notif-kepsek-1', title: 'Rekap kehadiran guru diperbarui', description: 'Data presensi dan jam mengajar guru bulan September tersedia.', category: 'Presensi', timestamp: '15 menit lalu', targetView: 'teacher-attendance' },
    { id: 'notif-kepsek-2', title: 'Agenda asesmen mendatang', description: 'Simulasi Asesmen SMK dijadwalkan pada 12 September 2026.', category: 'Agenda', timestamp: 'Hari ini, 07:45', targetView: 'schedule' }
  ],
  maahad: [
    { id: 'notif-maahad-1', title: 'Pembayaran menunggu verifikasi', description: 'Ada pembayaran wali santri yang perlu diperiksa.', category: 'Keuangan', timestamp: '5 menit lalu', targetView: 'payments' },
    { id: 'notif-maahad-2', title: 'Pengajuan izin baru', description: 'Pengajuan izin santri baru menunggu persetujuan.', category: 'Perizinan', timestamp: 'Hari ini, 09:10', targetView: 'permits' },
    { id: 'notif-maahad-3', title: 'Rekap guru tersedia', description: 'Rekap kehadiran dan jam mengajar guru siap ditinjau.', category: 'Presensi', timestamp: 'Hari ini, 08:00', targetView: 'teacher-attendance' }
  ],
  guru: [
    { id: 'notif-guru-1', title: 'Jadwal KBM diperbarui', description: 'Jadwal mengajar hari ini telah disinkronkan.', category: 'Jadwal', timestamp: '20 menit lalu', targetView: 'schedule' },
    { id: 'notif-guru-2', title: 'Pengingat presensi', description: 'Jangan lupa mengisi presensi pribadi setelah KBM.', category: 'Presensi', timestamp: 'Hari ini, 06:30', targetView: 'teacher-attendance' }
  ],
  pembina: [
    { id: 'notif-pembina-1', title: 'Setoran tahfizh menunggu verifikasi', description: 'Ada setoran hafalan santri yang perlu ditinjau.', category: 'Tahfizh', timestamp: '12 menit lalu', targetView: 'tahfizh' },
    { id: 'notif-pembina-2', title: 'Presensi asrama diperbarui', description: 'Rekap presensi jamaah malam telah tersedia.', category: 'Asrama', timestamp: 'Hari ini, 05:45', targetView: 'dormitory' }
  ],
  security: [
    { id: 'notif-security-1', title: 'Izin keluar baru', description: 'Ada pengajuan izin yang perlu dipantau di pos jaga.', category: 'Perizinan', timestamp: '8 menit lalu', targetView: 'gate' },
    { id: 'notif-security-2', title: 'Parent Visit Day', description: 'Kunjungan wali berlangsung pada 6 September 2026.', category: 'Agenda', timestamp: 'Hari ini, 08:15', targetView: 'schedule' }
  ],
  parent: [
    { id: 'notif-parent-1', title: 'Perkembangan anak diperbarui', description: 'Feed harian dan ringkasan kehadiran anak sudah tersedia.', category: 'Perkembangan', timestamp: '25 menit lalu', targetView: 'child' },
    { id: 'notif-parent-2', title: 'Pengingat pembayaran', description: 'Periksa tagihan pendidikan yang masih terbuka.', category: 'Keuangan', timestamp: 'Hari ini, 07:00', targetView: 'payments' }
  ],
  student: [
    { id: 'notif-student-1', title: 'Jadwal kegiatan hari ini', description: 'Jadwal KBM dan kegiatan boarding telah diperbarui.', category: 'Jadwal', timestamp: '30 menit lalu', targetView: 'schedule' },
    { id: 'notif-student-2', title: 'Catatan tahfizh baru', description: 'Capaian tahfizh terbaru telah masuk ke portal Anda.', category: 'Tahfizh', timestamp: 'Hari ini, 06:15', targetView: 'tahfizh' }
  ]
};

const programs = [
  { id: 'SMK', name: 'SMK Boarding', description: 'Sekolah Menengah Kejuruan', color: 'blue', pkl: true },
  { id: 'PPTAK', name: 'PPTAK', description: 'Program Pendidikan Tahfizh Al-Qur’an', color: 'green', pkl: false },
  { id: 'KWNQ', name: 'KWNQ', description: 'Kelas Wirausaha dan NQ', color: 'purple', pkl: false }
];

const majors = [
  { id: 'TKJ', programId: 'SMK', name: 'Teknik Komputer dan Jaringan' },
  { id: 'RPL', programId: 'SMK', name: 'Rekayasa Perangkat Lunak' },
  { id: 'TBSM', programId: 'SMK', name: 'Teknik Bisnis Sepeda Motor' },
];

const disciplineCatalog = [
  { id: 'ketertiban', label: 'Ketertiban & Kedisiplinan', defaultSanction: 'Pembinaan dan surat peringatan sesuai tingkat SP' },
  { id: 'kebersihan', label: 'Kebersihan Lingkungan', defaultSanction: 'Tugas kebersihan lingkungan dan hafalan surat' },
  { id: 'ibadah', label: 'Pelanggaran Ibadah/Jamaah', defaultSanction: 'Pembinaan ibadah dan pendampingan musyrif' },
  { id: 'akhlak', label: 'Akhlak & Pergaulan', defaultSanction: 'Konseling dan pemanggilan orang tua' },
  { id: 'asrama', label: 'Tata Tertib Asrama', defaultSanction: 'Pembinaan asrama dan pembatasan kegiatan' },
  { id: 'keamanan', label: 'Keamanan / Barang Terlarang', defaultSanction: 'Penyitaan, pembinaan, dan eskalasi sanksi' },
  { id: 'akademik', label: 'Akademik / Ketidakhadiran', defaultSanction: 'Tugas pengganti dan pembinaan akademik' }
];
const disciplineSanctions = {
  SP1: 'Kebersihan Lingkungan & Hafalan Surat',
  SP2: 'Skorsing 3 Hari',
  SP3: 'Pemanggilan Orang Tua & Peringatan Terakhir',
  DO: 'Pemberhentian Santri'
};

const semesters = [
  { id: '2026-1', label: 'Ganjil 2026/2027', year: 2026, term: 1 },
  { id: '2026-2', label: 'Genap 2026/2027', year: 2026, term: 2 },
  { id: '2025-2', label: 'Genap 2025/2026', year: 2025, term: 2 }
];

const financeCategories = {
  spp: { id: 'SPP', label: 'SPP Bulanan', nominal: 850000, account: '4111' },
  foundation: { id: 'FOUNDATION', label: 'Uang Bangunan', nominal: 250000, account: '4210' },
  maahadNonSpp: [
    { id: 'MAAHAD_KAMAR', label: 'Uang Kamar & Asrama', nominal: 450000 },
    { id: 'MAAHAD_MAKAN', label: 'Uang Makan', nominal: 650000 },
    { id: 'MAAHAD_KEGIATAN', label: 'Kegiatan Asrama', nominal: 150000 },
    { id: 'MAAHAD_SERAGAM', label: 'Seragam', nominal: 300000 },
    { id: 'MAAHAD_LAUNDRY', label: 'Laundry', nominal: 100000 },
    { id: 'MAAHAD_PENDAFTARAN', label: 'Pendaftaran', nominal: 500000 },
    { id: 'MAAHAD_BUKU', label: 'Buku', nominal: 175000 }
  ],
  pocketMoney: { id: 'POCKET_MONEY', label: 'Uang Saku', nominal: 300000 },
  custom: { id: 'CUSTOM', label: 'Komponen Non-SPP Lainnya', nominal: 0 }
};

const seedData = {
  internalAccounts: [
    { id: 'ACC-SUPER', role: 'master_admin', username: 'masteradmin', password: 'superadmin123', name: "Master Admin Ma'had", nama: "Master Admin Ma'had", passwordChangeCount: 0, status: 'Aktif', active: true, master: true },
    { id: 'ACC-MASTER', role: 'master_admin', username: 'admin.stkis', password: 'StkIs#2026!Pro', name: 'Master Admin Ma’had', nama: 'Master Admin Ma’had', passwordChangeCount: 0, status: 'Aktif', active: true, master: true },
    { id: 'ACC-001', role: 'yayasan', username: 'yayasan.demo', password: 'demo123', name: 'Dr. H. Abdullah', nama: 'Dr. H. Abdullah', passwordChangeCount: 0, status: 'Aktif', active: true },
    { id: 'ACC-002', role: 'maahad', username: 'admin.maahad', password: 'admin123', name: 'Ust. Hasyim', nama: 'Ust. Hasyim', passwordChangeCount: 0, status: 'Aktif', active: true },
    { id: 'ACC-003', role: 'guru', username: 'guru.demo', password: 'demo123', name: 'Ustadzah Rahma', nama: 'Ustadzah Rahma', subject: 'Guru DLE', isTahfizhTeacher: false, passwordChangeCount: 0, status: 'Aktif', active: true },
    { id: 'ACC-004', role: 'pembina', username: 'pembina.demo', password: 'demo123', name: 'Ust. Salman', nama: 'Ust. Salman', passwordChangeCount: 0, status: 'Aktif', active: true },
    { id: 'ACC-005', role: 'security', username: 'security.demo', password: 'demo123', name: 'Pak Joko', nama: 'Pak Joko', passwordChangeCount: 0, status: 'Aktif', active: true }
  ],
  programs,
  majors,
  semesters,
  financeCategories,
  finance: financeCategories,
  students: [
    { id: 'STD-001', name: 'Ahmad Fauzan', nis: '240101', gender: 'L', program: 'SMK', major: 'TKJ', grade: 11, semester: 2, className: 'XI TKJ', parent: 'Bpk. Muhammad Fauzi', phone: '081234567890', attendance: 96, points: 18, tahfizh: 12, spp: 'Lunas', status: 'Aktif' },
    { id: 'STD-002', name: 'Fatimah Zahra', nis: '240102', gender: 'P', program: 'PPTAK', major: '', grade: 10, semester: 1, className: 'Kelas PPTAK', parent: 'Ibu Siti Aminah', phone: '081298765432', attendance: 98, points: 27, tahfizh: 15, spp: 'Lunas', status: 'Aktif' },
    { id: 'STD-003', name: 'Abdullah Rizky', nis: '240103', gender: 'L', program: 'KWNQ', major: '', grade: 7, semester: 1, className: 'Kelas KWNQ', parent: 'Bpk. Rizky Hidayat', phone: '082112223333', attendance: 91, points: -6, tahfizh: 8, spp: 'Menunggak', status: 'Aktif' },
    { id: 'STD-004', name: 'Aisyah Nabila', nis: '240104', gender: 'P', program: 'SMK', major: 'RPL', grade: 12, semester: 1, className: 'XII RPL', parent: 'Bpk. Ahmad Nabil', phone: '082233445566', attendance: 94, points: 34, tahfizh: 20, spp: 'Lunas', status: 'Aktif' },
    { id: 'STD-005', name: 'Bilal Ramadhan', nis: '240105', gender: 'L', program: 'SMK', major: 'TBSM', grade: 10, semester: 2, className: 'X TBSM', parent: 'Ibu Nur Ramadhan', phone: '085677889900', attendance: 89, points: -12, tahfizh: 6, spp: 'Menunggak', status: 'Aktif' },
    { id: 'STD-006', name: 'Maryam Hanifah', nis: '240106', gender: 'P', program: 'PPTAK', major: '', grade: 11, semester: 1, className: 'Kelas PPTAK', parent: 'Ibu Hanifah', phone: '081377788899', attendance: 97, points: 41, tahfizh: 22, spp: 'Lunas', status: 'Aktif' }
  ],
  classes: [
    { id: 'CLS-SMK-XI-TKJ', name: 'XI TKJ', programId: 'SMK', majorId: 'TKJ', wali: 'Ustadzah Rahma', studentIds: ['STD-001'] },
    { id: 'CLS-SMK-XII-RPL', name: 'XII RPL', programId: 'SMK', majorId: 'RPL', wali: 'Ust. Hasyim', studentIds: ['STD-004'] },
    { id: 'CLS-SMK-X-TBSM', name: 'X TBSM', programId: 'SMK', majorId: 'TBSM', wali: 'Ust. Salman', studentIds: ['STD-005'] },
    { id: 'CLS-PPTAK', name: 'Kelas PPTAK', programId: 'PPTAK', majorId: '', wali: 'Ustz. Rahma', studentIds: ['STD-002', 'STD-006'] },
    { id: 'CLS-KWNQ', name: 'Kelas KWNQ', programId: 'KWNQ', majorId: '', wali: 'Ust. Hasyim', studentIds: ['STD-003'] }
  ],
  teachers: [
    { id: 'TCH-001', name: 'Ustadzah Rahma', subject: 'Bahasa Arab', role: 'Guru', phone: '081200000001', status: 'Aktif' },
    { id: 'TCH-002', name: 'Ust. Hasyim', subject: 'Fiqih', role: 'Guru', phone: '081200000002', status: 'Aktif' },
    { id: 'TCH-003', name: 'Ust. Salman', subject: 'Tahfizh', role: 'Pembina', phone: '081200000003', status: 'Aktif' },
    { id: 'TCH-004', name: 'Ustz. Nadia', subject: 'Bahasa Arab', role: 'Pembina', phone: '081200000004', status: 'Aktif' }
  ],
  permits: [
    { id: 'IZN-1001', studentId: 'STD-001', type: 'Pulang', reason: 'Menghadiri acara keluarga', date: '2026-09-05', status: 'Approved', approvedBy: 'Ust. Hasyim', checkout: '08:15', checkin: null },
    { id: 'IZN-1002', studentId: 'STD-003', type: 'Outing', reason: 'Keperluan kesehatan', date: '2026-09-05', status: 'Pending', approvedBy: null, checkout: null, checkin: null },
    { id: 'IZN-1003', studentId: 'STD-004', type: 'Pulang', reason: 'Kunjungan orang tua', date: '2026-09-05', status: 'Approved', approvedBy: 'Ustz. Rahma', checkout: '07:45', checkin: null },
    { id: 'IZN-1004', studentId: 'STD-005', type: 'Outing', reason: 'Membeli perlengkapan', date: '2026-09-04', status: 'Approved', approvedBy: 'Ust. Salman', checkout: '13:00', checkin: null },
    { id: 'IZN-1005', studentId: 'STD-002', type: 'Pulang', reason: 'Acara keluarga', date: '2026-09-06', status: 'Pending', approvedBy: null, checkout: null, checkin: null }
  ],
  points: [
    { id: 'PT-01', studentId: 'STD-001', kind: 'prestasi', note: 'Memimpin shalat berjamaah', value: 10, date: '2026-09-04' },
    { id: 'PT-02', studentId: 'STD-003', kind: 'pelanggaran', note: 'Terlambat apel pagi', value: -5, date: '2026-09-04' },
    { id: 'PT-03', studentId: 'STD-004', kind: 'prestasi', note: 'Juara MHQ internal', value: 15, date: '2026-09-03' },
    { id: 'PT-04', studentId: 'STD-005', kind: 'pelanggaran', note: 'Tidak mengikuti jamaah', value: -10, date: '2026-09-04' }
  ],
  tahfizh: [
    { id: 'TH-01', studentId: 'STD-001', juz: 2, surah: 'Al-Baqarah', ayat: '142-150', type: 'Ziyadah', status: 'Terverifikasi', date: '2026-09-04' },
    { id: 'TH-02', studentId: 'STD-002', juz: 3, surah: 'Ali Imran', ayat: '1-15', type: 'Murajaah', status: 'Terverifikasi', date: '2026-09-04' },
    { id: 'TH-03', studentId: 'STD-003', juz: 1, surah: 'Al-Baqarah', ayat: '1-5', type: 'Ziyadah', status: 'Menunggu', date: '2026-09-05' },
    { id: 'TH-04', studentId: 'STD-004', juz: 5, surah: 'An-Nisa', ayat: '1-10', type: 'Murajaah', status: 'Terverifikasi', date: '2026-09-03' }
  ],
  grades: [
    { id: 'GR-01', studentId: 'STD-001', subject: 'Bahasa Arab', score: 92, note: 'Sangat aktif' },
    { id: 'GR-02', studentId: 'STD-002', subject: 'Fiqih', score: 95, note: 'Pemahaman sangat baik' },
    { id: 'GR-03', studentId: 'STD-003', subject: 'Matematika', score: 78, note: 'Perlu latihan tambahan' }
  ],
  attendance: [
    { id: 'AT-01', studentId: 'STD-001', date: '2026-09-05', type: 'kelas', status: 'Hadir', by: 'Ustadzah Rahma' },
    { id: 'AT-02', studentId: 'STD-002', date: '2026-09-05', type: 'asrama', status: 'Hadir', by: 'Ust. Salman' },
    { id: 'AT-03', studentId: 'STD-003', date: '2026-09-05', type: 'kelas', status: 'Izin', by: 'Ustadzah Rahma' }
  ],
  pklReports: [
    { id: 'PKL-001', studentId: 'STD-001', date: '2026-09-05', checkIn: '07:00', checkOut: '15:00', status: 'Hadir', activity: 'Perakitan panel listrik', photo: '' }
  ],
  tahfizhSemesterRecords: [
    { id: 'TS-001', studentId: 'STD-001', semester: 1, academicYear: '2026/2027', target: '5 Juz', achievement: '3 Juz', mutqin: 'Baik', score: 86, mentor: 'Ust. Salman' },
    { id: 'TS-002', studentId: 'STD-002', semester: 1, academicYear: '2026/2027', target: '6 Juz', achievement: '4 Juz', mutqin: 'Mutqin', score: 92, mentor: 'Ust. Salman' }
  ],
  dormAttendance: [
    { id: 'DA-01', studentId: 'STD-001', date: '2026-09-05', shift: 'Subuh', status: 'Hadir' },
    { id: 'DA-02', studentId: 'STD-002', date: '2026-09-05', shift: 'Subuh', status: 'Hadir' },
    { id: 'DA-03', studentId: 'STD-003', date: '2026-09-05', shift: 'Subuh', status: 'Alpa' }
  ],
  payments: [
    { id: 'PAY-001', studentId: 'STD-001', category: 'SPP', period: 'September 2026', amount: 850000, method: 'Transfer BSI', status: 'Verified', submittedAt: '2026-09-01', proof: 'transfer-september.jpg' },
    { id: 'PAY-002', studentId: 'STD-003', category: 'SPP', period: 'September 2026', amount: 850000, method: 'Transfer BSI', status: 'Pending', submittedAt: '2026-09-04', proof: 'bukti-240103.jpg' },
    { id: 'PAY-003', studentId: 'STD-001', category: 'MAAHAD_MAKAN', period: 'September 2026', amount: 650000, method: 'Virtual Account', status: 'Pending', submittedAt: '2026-09-05', proof: 'makan-september.jpg' },
    { id: 'PAY-004', studentId: 'STD-001', category: 'POCKET_MONEY', period: 'September 2026', amount: 300000, method: 'Transfer BSI', status: 'Verified', submittedAt: '2026-09-01', proof: 'saku-ahmad.jpg' },
    { id: 'PAY-005', studentId: 'STD-002', category: 'FOUNDATION', period: 'Tahun Ajaran 2026/2027', amount: 250000, method: 'Transfer BSI', status: 'Verified', submittedAt: '2026-07-01', proof: 'foundation-fatimah.jpg' }
    ,{ id: 'PAY-006', studentId: 'STD-005', category: 'SPP', period: 'September 2026', amount: 850000, method: 'Transfer BSI', status: 'Pending', submittedAt: '2026-09-04', proof: 'spp-bilal.jpg' }
    ,{ id: 'PAY-007', studentId: 'STD-004', category: 'SPP', period: 'September 2026', amount: 850000, method: 'Virtual Account', status: 'Verified', submittedAt: '2026-09-02', proof: 'spp-aisyah.jpg' }
  ],
  financeBills: [
    { id: 'BILL-INV-001', studentId: 'STD-001', category: 'SPP', label: 'SPP September 2026', period: 'September 2026', amount: 850000, dueDate: '2026-09-10', status: 'Open', scholarship: 0, discount: 0 },
    { id: 'BILL-INV-002', studentId: 'STD-001', category: 'MAAHAD_MAKAN', label: 'Uang makan September 2026', period: 'September 2026', amount: 650000, dueDate: '2026-09-08', status: 'Open', scholarship: 0, discount: 50000 },
    { id: 'BILL-INV-003', studentId: 'STD-002', category: 'SPP', label: 'SPP September 2026', period: 'September 2026', amount: 850000, dueDate: '2026-09-10', status: 'Open', scholarship: 150000, discount: 0 },
    { id: 'BILL-INV-004', studentId: 'STD-003', category: 'SPP', label: 'SPP September 2026', period: 'September 2026', amount: 850000, dueDate: '2026-09-10', status: 'Open', scholarship: 0, discount: 0 }
    ,{ id: 'BILL-INV-005', studentId: 'STD-005', category: 'SPP', label: 'SPP September 2026', period: 'September 2026', amount: 850000, dueDate: '2026-09-10', status: 'Open', scholarship: 0, discount: 0 }
    ,{ id: 'BILL-INV-006', studentId: 'STD-004', category: 'SPP', label: 'SPP September 2026', period: 'September 2026', amount: 850000, dueDate: '2026-09-10', status: 'Open', scholarship: 0, discount: 0 }
  ],
  scholarships: [
    { id: 'SCHOLAR-001', studentId: 'STD-002', name: 'Beasiswa Tahfizh', type: 'Nominal', amount: 150000, active: true },
    { id: 'SCHOLAR-002', studentId: 'STD-006', name: 'Beasiswa Prestasi', type: 'Percent', amount: 20, active: true }
  ],
  discounts: [
    { id: 'DISC-001', studentId: 'STD-001', name: 'Diskon uang makan', type: 'Nominal', amount: 50000, active: true }
  ],
  invoices: [
    { id: 'INV-2026-0001', paymentId: 'PAY-001', studentId: 'STD-001', number: 'INV/2026/09/0001', issuedAt: '2026-09-01', total: 850000, status: 'Paid' },
    { id: 'INV-2026-0002', paymentId: 'PAY-004', studentId: 'STD-001', number: 'INV/2026/09/0002', issuedAt: '2026-09-01', total: 300000, status: 'Paid' },
    { id: 'INV-2026-0003', paymentId: 'PAY-005', studentId: 'STD-002', number: 'INV/2026/07/0003', issuedAt: '2026-07-01', total: 250000, status: 'Paid' }
    ,{ id: 'INV-2026-0004', paymentId: 'PAY-007', studentId: 'STD-004', number: 'INV/2026/09/0004', issuedAt: '2026-09-02', total: 850000, status: 'Paid' }
    ,{ id: 'INV-2026-0005', paymentId: 'PAY-006', studentId: 'STD-005', number: 'INV/2026/09/0005', issuedAt: '2026-09-04', total: 850000, status: 'Pending' }
  ],
  receipts: [
    { id: 'RCT-2026-0001', invoiceId: 'INV-2026-0001', paymentId: 'PAY-001', number: 'KWT/2026/09/0001', issuedAt: '2026-09-01' },
    { id: 'RCT-2026-0002', invoiceId: 'INV-2026-0002', paymentId: 'PAY-004', number: 'KWT/2026/09/0002', issuedAt: '2026-09-01' },
    { id: 'RCT-2026-0003', invoiceId: 'INV-2026-0003', paymentId: 'PAY-005', number: 'KWT/2026/07/0003', issuedAt: '2026-07-01' }
  ],
  billingNotifications: [
    { id: 'BILL-001', studentId: 'STD-003', category: 'SPP', title: 'SPP September belum dibayar', amount: 850000, dueDate: '2026-09-10', read: false },
    { id: 'BILL-002', studentId: 'STD-005', category: 'MAAHAD_KAMAR', title: 'Tagihan kamar September', amount: 450000, dueDate: '2026-09-10', read: false },
    { id: 'BILL-003', studentId: 'STD-001', category: 'MAAHAD_MAKAN', title: 'Konfirmasi uang makan', amount: 650000, dueDate: '2026-09-08', read: true }
  ],
  teacherAttendance: [
    { id: 'TA-01', teacher: 'Ustadzah Rahma', date: '2026-09-05', status: 'Hadir', checkIn: '06:42', checkOut: null },
    { id: 'TA-02', teacher: 'Ust. Hasyim', date: '2026-09-05', status: 'Hadir', checkIn: '06:38', checkOut: '15:30' },
    { id: 'TA-03', teacher: 'Ust. Salman', date: '2026-09-05', status: 'Izin', checkIn: null, checkOut: null }
  ],
  teacherTeachingRecords: [
    { id: 'TTR-01', teacher: 'Ustadzah Rahma', subject: 'Bahasa Arab', date: '2026-09-01', status: 'Hadir', hours: 2, note: 'Nahwu dasar dan percakapan' },
    { id: 'TTR-02', teacher: 'Ustadzah Rahma', subject: 'Bahasa Arab', date: '2026-09-03', status: 'Hadir', hours: 2, note: 'Latihan qawaid' },
    { id: 'TTR-03', teacher: 'Ustadzah Rahma', subject: 'Bahasa Arab', date: '2026-09-04', status: 'Izin', hours: 0, note: 'Acara keluarga' },
    { id: 'TTR-04', teacher: 'Ust. Hasyim', subject: 'Fiqih', date: '2026-09-01', status: 'Hadir', hours: 3, note: 'Thaharah dan praktik wudhu' },
    { id: 'TTR-05', teacher: 'Ust. Hasyim', subject: 'Fiqih', date: '2026-09-03', status: 'Sakit', hours: 0, note: 'Surat keterangan sakit' },
    { id: 'TTR-06', teacher: 'Ust. Hasyim', subject: 'Fiqih', date: '2026-09-05', status: 'Hadir', hours: 3, note: 'Shalat berjamaah' },
    { id: 'TTR-07', teacher: 'Ust. Salman', subject: 'Tahfizh', date: '2026-09-02', status: 'Hadir', hours: 2, note: 'Setoran Juz Amma' },
    { id: 'TTR-08', teacher: 'Ust. Salman', subject: 'Tahfizh', date: '2026-09-04', status: 'Hadir', hours: 2, note: 'Murajaah surat pilihan' },
    { id: 'TTR-09', teacher: 'Ustz. Nadia', subject: 'Bahasa Arab', date: '2026-09-02', status: 'Hadir', hours: 2, note: 'Makhraj huruf' },
    { id: 'TTR-10', teacher: 'Ustz. Nadia', subject: 'Bahasa Arab', date: '2026-09-05', status: 'Alpa', hours: 0, note: 'Tidak ada keterangan' }
  ],
  schedules: [
    { id: 'SCH-01', day: 'Sabtu', time: '07:00-08:30', title: 'KBM Formal', room: 'Lab Komputer', teacher: 'Ustadzah Rahma', type: 'Akademik' },
    { id: 'SCH-02', day: 'Sabtu', time: '09:00-10:30', title: 'Setoran Tahfizh', room: 'Aula Tahfizh', teacher: 'Ust. Salman', type: 'Tahfizh' },
    { id: 'SCH-03', day: 'Sabtu', time: '15:30-17:00', title: 'Olahraga & Ekstrakurikuler', room: 'Lapangan', teacher: 'Ust. Hasyim', type: 'Asrama' },
    { id: 'SCH-04', day: 'Sabtu', time: '18:30-19:30', title: 'Kajian Maghrib', room: 'Masjid', teacher: 'Ust. Hasyim', type: 'Keagamaan' }
  ],
  events: [
    { id: 'EV-01', date: '2026-09-06', title: 'Parent Visit Day', location: 'Lapangan Utama', audience: 'Semua wali', status: 'Published' },
    { id: 'EV-02', date: '2026-09-12', title: 'Simulasi Asesmen SMK', location: 'Gedung SMK', audience: 'SMK kelas 11-12', status: 'Published' },
    { id: 'EV-03', date: '2026-09-19', title: 'Tasmi’ Akbar', location: 'Masjid', audience: 'PPTAK', status: 'Draft' }
  ],
  activities: [
    { time: '04:00', title: 'Qiyamul Lail & Shalat Subuh', icon: 'moon-star' },
    { time: '05:30', title: 'Setoran Tahfizh', icon: 'book-open' },
    { time: '07:00', title: 'KBM Formal', icon: 'graduation-cap' },
    { time: '15:30', title: 'Olahraga & Ekstrakurikuler', icon: 'dumbbell' },
    { time: '18:30', title: 'Kajian Maghrib', icon: 'mosque' }
  ],
  dailyFeed: [
    { id: 'FEED-001', date: '2026-09-05', title: 'Alhamdulillah, Ahmad hadir shalat Subuh berjamaah', detail: 'Presensi asrama tercatat hadir dengan baik.', type: 'asrama' },
    { id: 'FEED-002', date: '2026-09-05', title: 'Setoran tahfizh terverifikasi', detail: 'Juz 2 · Al-Baqarah ayat 142-150.', type: 'tahfizh' },
    { id: 'FEED-003', date: '2026-09-04', title: 'Catatan pembina', detail: 'Menjadi teladan dalam kegiatan sore.', type: 'catatan' }
  ],
  announcements: [
    { id: 'ANN-001', title: 'Kajian Akbar Maulid Nabi', detail: 'Seluruh santri mengikuti kajian setelah Maghrib di masjid.', date: '2026-09-06', author: 'Admin Ma’had' },
    { id: 'ANN-002', title: 'Parent Visit Day', detail: 'Kunjungan wali santri dilaksanakan di lapangan utama.', date: '2026-09-06', author: 'Yayasan' }
  ],
  pocketTransactions: [
    { id: 'TRX-001', studentId: 'STD-001', date: '2026-09-05', type: 'Pengeluaran', amount: 15000, note: 'Kantin pagi' },
    { id: 'TRX-002', studentId: 'STD-001', date: '2026-09-05', type: 'Top Up', amount: 300000, note: 'Top up wali' },
    { id: 'TRX-003', studentId: 'STD-004', date: '2026-09-05', type: 'Pengeluaran', amount: 12000, note: 'Koperasi' }
  ],
  pocketBalances: [
    { studentId: 'STD-001', balance: 485000 },
    { studentId: 'STD-004', balance: 220000 }
  ],
  disciplineRecords: [
    { id: 'DISC-001', studentId: 'STD-005', level: 'SP1', incidentDate: '2026-09-03', violationType: 'Kebersihan Lingkungan', description: 'Tidak mengikuti piket asrama.', sanction: disciplineSanctions.SP1, status: 'Terverifikasi', issuedAt: '2026-09-03', issuerName: 'Ust. Salman', issuerRole: 'Musyrif / Kesantrian', issuerSignedAt: '2026-09-03T08:00:00+07:00', principalName: 'Drs. Ahmad Fauzi', principalSignedAt: '2026-09-03T09:00:00+07:00' }
  ],
  monthlySummaries: [
    { studentId: 'STD-001', month: 'September 2026', attendance: 96, tahfizh: 1, points: 4, paid: 1150000, outstanding: 650000 },
    { studentId: 'STD-002', month: 'September 2026', attendance: 98, tahfizh: 2, points: 7, paid: 250000, outstanding: 700000 }
  ],
  yayasanProgress: [
    { programId: 'SMK', classId: 'CLS-SMK-XI-TKJ', targetJuz: 5, targetSurah: 'Al-Baqarah', targetAyat: '1-286', achievementJuz: 3, achievementSurah: 'Al-Baqarah', achievementAyat: '142-200', mutqin: 'Baik' },
    { programId: 'SMK', classId: 'CLS-SMK-XII-RPL', targetJuz: 10, targetSurah: 'Yunus', targetAyat: '1-109', achievementJuz: 8, achievementSurah: 'At-Taubah', achievementAyat: '1-50', mutqin: 'Mutqin' },
    { programId: 'SMK', classId: 'CLS-SMK-X-TBSM', targetJuz: 3, targetSurah: 'Al-Baqarah', targetAyat: '1-100', achievementJuz: 2, achievementSurah: 'Al-Baqarah', achievementAyat: '1-80', mutqin: 'Perlu Bimbingan' },
    { programId: 'PPTAK', classId: 'CLS-PPTAK', targetJuz: 10, targetSurah: 'An-Nisa', targetAyat: '1-176', achievementJuz: 7, achievementSurah: 'Ali Imran', achievementAyat: '1-100', mutqin: 'Baik' },
    { programId: 'KWNQ', classId: 'CLS-KWNQ', targetJuz: 3, targetSurah: 'Al-Baqarah', targetAyat: '1-70', achievementJuz: 2, achievementSurah: 'Al-Baqarah', achievementAyat: '1-40', mutqin: 'Baik' }
  ]
};
