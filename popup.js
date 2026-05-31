'use strict';

const FREE_LIMIT = 3;
const GUMROAD_PRODUCT_ID = 'eBmdC1FIMf26nfw5RWDDGQ==';

const state = {
  isPro:       false,
  licenseKey:  '',
  compareList: [],
};

// ---- Init ----

document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get(['isPro', 'licenseKey', 'compareList']);
  state.isPro       = data.isPro ?? false;
  state.licenseKey  = data.licenseKey ?? '';
  if (state.licenseKey) state.isPro = true;
  state.compareList = data.compareList ?? [];

  renderAll();
  bindEvents();
});

// ---- Render ----

function renderAll() {
  renderPlanBadge();
  renderTable();
  renderLicenseStatus();
}

function renderPlanBadge() {
  const badge = document.getElementById('plan-badge');
  if (state.isPro) {
    badge.textContent = 'PRO版';
    badge.classList.add('is-pro');
  } else {
    badge.textContent = '無料版';
    badge.classList.remove('is-pro');
  }
}

function renderTable() {
  const tbody      = document.getElementById('compare-tbody');
  const countLabel = document.getElementById('count-label');
  const emptyMsg   = document.getElementById('empty-msg');
  const tableEl    = document.getElementById('compare-table');
  const limitWarn  = document.getElementById('limit-warn');
  const csvBtn     = document.getElementById('csv-btn');

  const list = state.compareList;
  countLabel.textContent = `${list.length}件を比較中`;
  csvBtn.disabled = !state.isPro;

  if (!list.length) {
    emptyMsg.classList.remove('hidden');
    tableEl.classList.add('hidden');
    limitWarn.classList.add('hidden');
    return;
  }

  emptyMsg.classList.add('hidden');
  tableEl.classList.remove('hidden');
  limitWarn.classList.toggle('hidden', state.isPro || list.length < FREE_LIMIT);

  tbody.innerHTML = list.map((p, i) => `
    <tr class="${i % 2 === 0 ? '' : 'row-odd'}">
      <td class="col-name"><a href="${esc(p.url)}" target="_blank" title="${esc(p.name)}">${esc(p.name)}</a></td>
      <td class="col-rent">${esc(p.rent)}</td>
      <td class="col-mgmt">${esc(p.management_fee)}</td>
      <td class="col-layout">${esc(p.layout)}</td>
      <td class="col-area">${esc(p.area)}</td>
      <td class="col-station">${esc(p.station)}</td>
      <td class="col-age">${esc(p.age)}</td>
      <td class="col-floor">${esc(p.floor)}</td>
      <td class="col-dir">${esc(p.direction)}</td>
      <td class="col-addr">${esc(p.address)}</td>
      <td class="col-del"><button class="btn-delete" data-id="${esc(p.id)}">削除</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteProperty(btn.dataset.id));
  });
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- Actions ----

async function deleteProperty(id) {
  state.compareList = state.compareList.filter(p => p.id !== id);
  await chrome.storage.local.set({ compareList: state.compareList });
  renderTable();
}

async function clearAll() {
  if (!state.compareList.length) return;
  if (!confirm('比較リストを全てクリアしますか？')) return;
  state.compareList = [];
  await chrome.storage.local.set({ compareList: [] });
  renderTable();
}

function exportCSV() {
  if (!state.isPro || !state.compareList.length) return;

  const headers = [
    '物件名', '家賃', '管理費', '敷金', '礼金',
    '間取り', '専有面積', '駅徒歩', '築年数', '階',
    '向き', '所在地', '建物種別', 'URL', '追加日時',
  ];
  const rows = state.compareList.map(p => [
    p.name, p.rent, p.management_fee, p.deposit, p.key_money,
    p.layout, p.area, p.station, p.age, p.floor,
    p.direction, p.address, p.building_type, p.url, p.added_at,
  ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));

  const csv  = '﻿' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `suumo_compare_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- Events ----

function bindEvents() {
  document.getElementById('clear-btn').addEventListener('click', clearAll);
  document.getElementById('csv-btn').addEventListener('click', exportCSV);
  document.getElementById('license-btn').addEventListener('click', handleLicenseBtn);
  document.getElementById('license-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLicenseBtn();
  });
}

// ---- License ----

function renderLicenseStatus() {
  const input   = document.getElementById('license-input');
  const btn     = document.getElementById('license-btn');
  const status  = document.getElementById('license-status');

  document.querySelectorAll('.pro-link').forEach(a => {
    a.style.display = state.licenseKey ? 'none' : '';
  });

  if (state.licenseKey) {
    input.value     = maskKey(state.licenseKey);
    input.disabled  = true;
    btn.textContent = '解除';
    btn.classList.add('revoke');
    status.textContent = '✅ Pro版認証済み';
    status.className   = 'license-status license-ok';
  } else {
    input.value     = '';
    input.disabled  = false;
    btn.textContent = '認証する';
    btn.classList.remove('revoke');
    status.textContent = '';
    status.className   = 'license-status';
  }
}

function maskKey(key) {
  return key.slice(0, 4) + '-****-****-****';
}

async function handleLicenseBtn() {
  if (state.licenseKey) {
    state.licenseKey = '';
    state.isPro      = false;
    await chrome.storage.local.set({ isPro: false, licenseKey: '' });
    renderAll();
    return;
  }

  const input  = document.getElementById('license-input');
  const btn    = document.getElementById('license-btn');
  const status = document.getElementById('license-status');
  const key    = input.value.trim();
  if (!key) return;

  btn.disabled    = true;
  btn.textContent = '確認中…';
  status.textContent = '';
  status.className   = 'license-status';

  try {
    const res  = await fetch('https://api.gumroad.com/v2/licenses/verify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({ product_id: GUMROAD_PRODUCT_ID, license_key: key }),
    });
    const data = await res.json();

    if (data.success) {
      state.licenseKey = key;
      state.isPro      = true;
      await chrome.storage.local.set({ isPro: true, licenseKey: key });
      renderAll();
    } else {
      status.textContent = '❌ ライセンスキーが無効です';
      status.className   = 'license-status license-error';
      btn.disabled       = false;
      btn.textContent    = '認証する';
    }
  } catch {
    status.textContent = '❌ 認証に失敗しました（通信エラー）';
    status.className   = 'license-status license-error';
    btn.disabled       = false;
    btn.textContent    = '認証する';
  }
}
