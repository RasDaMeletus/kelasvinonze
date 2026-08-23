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
    return '<tr><td>' + escapeHtml(t.tanggal) + '</td><td>' + escapeHtml(t.deskripsi) + '</td><td class="' + (masuk ? 'history-in' : 'history-out') + '">' + (masuk ? '+' : '-') + rupiah(t.jumlah) + '</td><td>' + rupiah(t.saldo) + '</td></tr>';
  }

  function currentView() {
    return document.querySelector('#txTabBar .tab-btn.active')?.getAttribute('data-view') || 'semua';
  }

  window.renderTxTable = function (view) {
    const selected = view || currentView();
    if (typeof originalRenderTxTable === 'function') originalRenderTxTable(selected);
    const tbody = document.getElementById('tableTx');
    if (tbody) {
      const rows = Array.from(tbody.querySelectorAll('tr'));
      if (rows.length > 3) rows.slice(3).forEach(function (tr) { tr.remove(); });
    }
    if (historyOpen && allHistoryData) renderAllHistory(selected);
  };

  function ensureModal() {
    let modal = document.getElementById('historyModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'historyModal';
    modal.className = 'history-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML =
      '<div class="history-backdrop" data-close-history></div>' +
      '<section class="history-sheet" role="dialog" aria-modal="true" aria-labelledby="historyTitle">' +
        '<div class="history-sheet-head"><div><div class="section-kicker">Riwayat transaksi</div><h2 id="historyTitle">Semua Riwayat</h2><div id="allHistoryCount" class="history-count">0 transaksi</div></div><button type="button" class="history-close" aria-label="Tutup" data-close-history>×</button></div>' +
        '<div class="history-filter-bar" id="historyFilterBar"><button type="button" class="history-filter active" data-view="semua">Semua</button><button type="button" class="history-filter" data-view="masuk">Pendapatan</button><button type="button" class="history-filter" data-view="keluar">Pengeluaran</button></div>' +
        '<div class="table-wrap history-table-wrap"><table><thead><tr><th>Tanggal</th><th>Keterangan</th><th>Jumlah</th><th>Saldo</th></tr></thead><tbody id="allHistoryBody"></tbody></table></div>' +
      '</section>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
      const filter = e.target.closest ? e.target.closest('.history-filter') : null;
      if (filter) {
        e.preventDefault();
        updateModalFilter(filter.getAttribute('data-view'));
        return;
      }
      if (e.target.closest && e.target.closest('[data-close-history]')) closeHistory();
    });

    return modal;
  }

  function renderAllHistory(view) {
    const tbody = document.getElementById('allHistoryBody');
    if (!tbody) return;
    const list = listFor(allHistoryData, view || 'semua');
    tbody.innerHTML = list.length ? list.map(row).join('') : '<tr><td colspan="4" class="muted">Belum ada transaksi.</td></tr>';
    const count = document.getElementById('allHistoryCount');
    if (count) count.textContent = list.length + ' transaksi';
  }

  function updateModalFilter(view) {
    const modal = ensureModal();
    modal.querySelectorAll('.history-filter').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });
    renderAllHistory(view);
  }

  async function openHistory() {
    const modal = ensureModal();
    historyOpen = true;
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('history-lock');

    const tbody = document.getElementById('allHistoryBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="muted">Memuat seluruh riwayat...</td></tr>';

    try {
      allHistoryData = await apiGet('getTransparencyDashboard');
      updateModalFilter('semua');
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

  // Event delegation makes the bottom button reliable even if another script
  // re-renders the transaction card after history.js has loaded.
  document.addEventListener('click', function (e) {
    const button = e.target.closest ? e.target.closest('#showAllHistoryBtn') : null;
    if (button) {
      e.preventDefault();
      e.stopPropagation();
      openHistory();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && historyOpen) closeHistory();
  });
})();
