/* Compact transaction history for the transparency dashboard. */
(function () {
  let historyOpen = false;
  let allHistoryData = null;
  const originalRenderTxTable = window.renderTxTable;

  function listFor(data, view) {
    if (!data) return [];
    if (view === 'masuk') return data.pemasukanHistory || [];
    if (view === 'keluar') return data.pengeluaranHistory || [];
    return data.transactions || [];
  }

  function row(t) {
    const masuk = t.jenis === 'masuk';
    const cls = masuk ? 'history-in' : 'history-out';
    const sign = masuk ? '+' : '-';
    return '<tr>' +
      '<td>' + escapeHtml(t.tanggal) + '</td>' +
      '<td>' + escapeHtml(t.deskripsi) + '</td>' +
      '<td class="' + cls + '">' + sign + rupiah(t.jumlah) + '</td>' +
      '<td>' + rupiah(t.saldo) + '</td>' +
      '</tr>';
  }

  function currentView() {
    return document.querySelector('#txTabBar .tab-btn.active')?.getAttribute('data-view') || 'semua';
  }

  window.renderTxTable = function (view) {
    const selected = view || currentView();

    // Biarkan app.js mengambil dan menyusun data seperti biasa, lalu batasi
    // tampilan dashboard menjadi hanya tiga transaksi terbaru.
    if (typeof originalRenderTxTable === 'function') originalRenderTxTable(selected);

    const tbody = document.getElementById('tableTx');
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll('tr'));
      if (rows.length > 3) rows.slice(3).forEach(function (tr) { tr.remove(); });
    }

    if (historyOpen && allHistoryData) renderAllHistory(selected);
  };

  function renderAllHistory(view) {
    const tbody = document.getElementById('allHistoryBody');
    if (!tbody) return;
    const list = listFor(allHistoryData, view || currentView());
    tbody.innerHTML = list.length
      ? list.map(row).join('')
      : '<tr><td colspan="4" class="muted">Belum ada transaksi.</td></tr>';
  }

  async function openHistory() {
    const modal = document.getElementById('historyModal');
    if (!modal) return;

    historyOpen = true;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('history-lock');

    const tbody = document.getElementById('allHistoryBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="muted">Memuat seluruh riwayat...</td></tr>';

    try {
      // Ambil seluruh data hanya ketika user benar-benar meminta "Lihat semua".
      allHistoryData = await apiGet('getTransparencyDashboard');
      renderAllHistory(currentView());
    } catch (error) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="muted">' + escapeHtml(error.message) + '</td></tr>';
    }
  }

  function closeHistory() {
    historyOpen = false;
    const modal = document.getElementById('historyModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('history-lock');
  }

  function setup() {
    const card = document.getElementById('txCard');
    const tabBar = document.getElementById('txTabBar');
    if (!card || !tabBar) return;

    const head = card.querySelector('.card-head');
    if (head && !document.getElementById('showAllHistoryBtn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'showAllHistoryBtn';
      btn.className = 'history-all-btn';
      btn.innerHTML = 'Lihat semua <span aria-hidden="true">→</span>';
      btn.addEventListener('click', openHistory);
      head.appendChild(btn);
    }

    if (!document.getElementById('historyCount')) {
      const meta = document.createElement('div');
      meta.id = 'historyCount';
      meta.className = 'history-count';
      meta.textContent = '3 transaksi terbaru';
      tabBar.parentNode.insertBefore(meta, tabBar);
    }

    if (!document.getElementById('historyModal')) {
      const modal = document.createElement('div');
      modal.id = 'historyModal';
      modal.className = 'history-modal';
      modal.setAttribute('aria-hidden', 'true');
      modal.innerHTML =
        '<div class="history-backdrop" data-close-history></div>' +
        '<section class="history-sheet" role="dialog" aria-modal="true" aria-labelledby="historyTitle">' +
          '<div class="history-sheet-head">' +
            '<div><div class="section-kicker">Riwayat transaksi</div><h2 id="historyTitle">Semua Riwayat</h2></div>' +
            '<button type="button" class="history-close" aria-label="Tutup" data-close-history>×</button>' +
          '</div>' +
          '<div class="table-wrap history-table-wrap"><table>' +
            '<thead><tr><th>Tanggal</th><th>Keterangan</th><th>Jumlah</th><th>Saldo</th></tr></thead>' +
            '<tbody id="allHistoryBody"></tbody>' +
          '</table></div>' +
        '</section>';
      document.body.appendChild(modal);

      modal.addEventListener('click', function (e) {
        if (e.target.closest('[data-close-history]')) closeHistory();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && historyOpen) closeHistory();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', setup);
})();
