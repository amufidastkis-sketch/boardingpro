// ==========================================
// DASHBOARD STAFF & ABSENSI
// ==========================================
function initDashboardStaff(currentUser) {
  const container = document.getElementById('dashboardStaffSection');
  if (!container) return;
  container.classList.remove('hidden');

  const staffNameEl = document.getElementById('staffNamaHeader');
  if (staffNameEl) staffNameEl.innerText = currentUser.nama || 'Staff';

  checkStatusAbsenHariIni(currentUser.uid || currentUser.username);
  loadRekapAbsenStaff(currentUser.uid || currentUser.username);
}

function submitAbsenStaff(jenisAbsen, userId, namaStaff) {
  const today = new Date().toISOString().split('T')[0];
  const jamSekarang = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const absenRef = firebase.database().ref('absensi_staff/' + today + '/' + userId);

  if (jenisAbsen === 'masuk') {
    absenRef.set({
      userId: userId,
      nama: namaStaff,
      tanggal: today,
      jamMasuk: jamSekarang,
      jamPulang: '-',
      status: 'Hadir',
      timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(function() {
      alert('Berhasil Absen Masuk pukul ' + jamSekarang);
      checkStatusAbsenHariIni(userId);
    });
  } else if (jenisAbsen === 'pulang') {
    absenRef.update({
      jamPulang: jamSekarang
    }).then(function() {
      alert('Berhasil Absen Pulang pukul ' + jamSekarang);
      checkStatusAbsenHariIni(userId);
    });
  }
}

function checkStatusAbsenHariIni(userId) {
  const today = new Date().toISOString().split('T')[0];
  const btnMasuk = document.getElementById('btnAbsenMasukStaff');
  const btnPulang = document.getElementById('btnAbsenPulangStaff');
  const statusBadge = document.getElementById('statusAbsenBadge');

  firebase.database().ref('absensi_staff/' + today + '/' + userId).on('value', function(snapshot) {
    const data = snapshot.val();

    if (!data) {
      if (statusBadge) statusBadge.innerText = 'Belum Absen Hari Ini';
      if (btnMasuk) btnMasuk.disabled = false;
      if (btnPulang) btnPulang.disabled = true;
    } else if (data.jamMasuk && (!data.jamPulang || data.jamPulang === '-')) {
      if (statusBadge) statusBadge.innerText = 'Sudah Absen Masuk (' + data.jamMasuk + ')';
      if (btnMasuk) btnMasuk.disabled = true;
      if (btnPulang) btnPulang.disabled = false;
    } else if (data.jamMasuk && data.jamPulang && data.jamPulang !== '-') {
      if (statusBadge) statusBadge.innerText = 'Selesai (' + data.jamMasuk + ' - ' + data.jamPulang + ')';
      if (btnMasuk) btnMasuk.disabled = true;
      if (btnPulang) btnPulang.disabled = true;
    }
  });
}

function loadRekapAbsenStaff(userId) {
  const listContainer = document.getElementById('listRekapAbsenStaff');
  const totalCounter = document.getElementById('totalHadirStaffCount');
  if (!listContainer) return;

  firebase.database().ref('absensi_staff').on('value', function(snapshot) {
    const allDates = snapshot.val() || {};
    let totalHadir = 0;
    let html = '';

    Object.keys(allDates).forEach(function(date) {
      const dayData = allDates[date][userId];
      if (dayData) {
        totalHadir++;
        html += '<div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg border text-xs">' +
                  '<div>' +
                    '<p class="font-bold">' + date + '</p>' +
                    '<p class="text-gray-500">Masuk: ' + dayData.jamMasuk + ' | Pulang: ' + (dayData.jamPulang || '-') + '</p>' +
                  '</div>' +
                  '<span class="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-semibold">' + (dayData.status || 'Hadir') + '</span>' +
                '</div>';
      }
    });

    if (totalCounter) totalCounter.innerText = totalHadir + ' Hari';
    listContainer.innerHTML = html || '<p class="p-4 text-xs text-gray-400 text-center">Belum ada riwayat absensi.</p>';
  });
}


