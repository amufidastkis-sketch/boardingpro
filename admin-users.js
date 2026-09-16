// ==========================================
// MANAJEMEN AKUN ADMIN
// ==========================================
function generateUsername() {
  const namaInput = document.getElementById('inputNama')?.value.trim() || '';
  const roleInput = document.getElementById('selectRole')?.value || '';
  const nisInput = document.getElementById('inputNIS')?.value.trim() || '';
  const usernameField = document.getElementById('inputUsername');

  if (!usernameField) return;

  if (roleInput === 'santri') {
    usernameField.value = 's' + (nisInput || '1001');
  } else if (roleInput === 'wali') {
    usernameField.value = 'w' + (nisInput || '1001');
  } else if (namaInput) {
    const inisial = namaInput
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 0)
      .map(word => word[0])
      .join('');
    usernameField.value = `${inisial}.${roleInput || 'staff'}`;
  }
}

function simpanAkunBaru(event) {
  event.preventDefault();
  const nama = document.getElementById('inputNama')?.value || '';
  const role = document.getElementById('selectRole')?.value || '';
  const username = document.getElementById('inputUsername')?.value || '';
  const nis = document.getElementById('inputNIS')?.value || '';
  const password = document.getElementById('inputPassword')?.value || '123456';

  if (!nama || !username) {
    alert('Nama dan Username wajib diisi!');
    return;
  }

  firebase.database().ref('users').push().set({
    nama: nama,
    role: role,
    username: username,
    nis: nis,
    password: password,
    passwordChangeCount: 0,
    status: 'Aktif',
    createdAt: new Date().toISOString()
  }).then(() => {
    alert(`Akun ${nama} berhasil dibuat!`);
    document.getElementById('formAkun')?.reset();
    loadSemuaAkun();
  });
}

function loadSemuaAkun() {
  const tableBody = document.getElementById('tabelAkunBody');
  if (!tableBody) return;

  firebase.database().ref('users').on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      tableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">Belum ada akun.</td></tr>`;
      return;
    }

    let html = '';
    Object.keys(data).forEach(userId => {
      const u = data[userId];
      const isAktif = (u.status || 'Aktif') === 'Aktif';

      html += `
        <tr class="border-b text-xs hover:bg-gray-50 ${!isAktif ? 'bg-red-50' : ''}">
          <td class="p-3 font-semibold">${u.nama}</td>
          <td class="p-3"><span class="px-2 py-1 rounded text-white bg-teal-600">${(u.role || '').toUpperCase()}</span></td>
          <td class="p-3 font-mono">${u.username || '-'}</td>
          <td class="p-3">${u.status || 'Aktif'}</td>
          <td class="p-3 space-x-1">
            <button onclick="resetPasswordAdmin('${userId}', '${u.nama}')" class="px-2 py-1 bg-amber-500 text-white rounded">Reset Pass</button>
            <button onclick="hapusAtauNonaktifkanAkun('${userId}', '${u.nama}', '${u.status || 'Aktif'}')" class="px-2 py-1 ${isAktif ? 'bg-red-500' : 'bg-emerald-500'} text-white rounded">
              ${isAktif ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </td>
        </tr>`;
    });
    tableBody.innerHTML = html;
  });
}

function resetPasswordAdmin(userId, nama) {
  const passBaru = prompt(`Masukkan password baru untuk ${nama}:`, '123456');
  if (passBaru && passBaru.trim() !== '') {
    firebase.database().ref(`users/${userId}`).update({
      password: passBaru.trim(),
      passwordChangeCount: 0
    }).then(() => alert(`Password ${nama} berhasil direset!`));
  }
}

function hapusAtauNonaktifkanAkun(userId, nama, currentStatus) {
  const statusBaru = currentStatus === 'Aktif' ? 'Nonaktif' : 'Aktif';
  if (confirm(`Ubah status akun ${nama} menjadi ${statusBaru}?`)) {
    firebase.database().ref(`users/${userId}`).update({ status: statusBaru })
      .then(() => alert(`Status akun ${nama} diubah ke ${statusBaru}.`));
  }
}


