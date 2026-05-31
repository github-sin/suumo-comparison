'use strict';

console.log('[SUUMOCompare] content.js loaded on:', window.location.href);

const FREE_LIMIT = 3;
const BTN_ID = 'suumo-compare-btn';

// 物件詳細ページ（jnc_ / bc_）のみ動作
if (window.location.pathname.match(/\/chintai\/(jnc_|bc_)/)) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

async function init() {
  const el = await waitForElement('h1.section_h1-header-title', 10000);
  console.log('[SUUMOCompare] h1 element found:', !!el);

  if (!el) {
    console.log('[SUUMOCompare] h1 element NOT found after 10s');
    return;
  }

  await injectButton(el);
}

function waitForElement(selector, maxWait = 10000) {
  return new Promise(resolve => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const interval = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(interval);
        resolve(el);
      }
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      resolve(null);
    }, maxWait);
  });
}


const BTN_STYLE_BASE = [
  'display: inline-flex !important',
  'visibility: visible !important',
  'opacity: 1 !important',
  'position: relative !important',
  'z-index: 9999 !important',
  'background-color: #6CBB5A !important',
  'color: white !important',
  'border: none !important',
  'border-radius: 4px !important',
  'padding: 8px 16px !important',
  'font-size: 14px !important',
  'font-weight: bold !important',
  'cursor: pointer !important',
  'margin-left: 12px !important',
  'white-space: nowrap !important',
].join('; ');

const BTN_STYLE_ADDED = BTN_STYLE_BASE.replace('#6CBB5A', '#aaaaaa').replace('pointer', 'default');
const BTN_STYLE_LIMIT = BTN_STYLE_BASE.replace('#6CBB5A', '#f5a623').replace('pointer', 'default');

async function injectButton(titleEl) {
  if (document.getElementById(BTN_ID)) return;

  const { compareList = [] } = await chrome.storage.local.get('compareList');
  const alreadyAdded = compareList.some(p => p.url === window.location.href);

  const btn = document.createElement('button');
  btn.id = BTN_ID;
  btn.textContent = alreadyAdded ? '✓ 追加済み' : '＋ 比較リストに追加';
  btn.setAttribute('style', alreadyAdded ? BTN_STYLE_ADDED : BTN_STYLE_BASE);

  btn.addEventListener('click', handleAddClick);

  // h1直後に挿入（SUUMOのCSSに埋もれにくい）
  titleEl.insertAdjacentElement('afterend', btn);

  // 親のoverflow隠蔽を解除
  const parent = btn.parentElement;
  if (parent) {
    parent.style.setProperty('overflow', 'visible', 'important');
  }

  console.log('[SUUMOCompare] button inserted into:', parent?.className || parent?.tagName);
  console.log('[SUUMOCompare] button element:', btn);
  console.log('[SUUMOCompare] button parent:', btn.parentElement);
  console.log('[SUUMOCompare] button computed display:', window.getComputedStyle(btn).display);
}

async function handleAddClick() {
  const btn = document.getElementById(BTN_ID);
  if (!btn || btn.classList.contains('added')) return;

  const data = await chrome.storage.local.get(['compareList', 'isPro', 'licenseKey']);
  const compareList = data.compareList ?? [];
  const isPro = data.licenseKey ? true : (data.isPro ?? false);

  // 上限チェック
  if (!isPro && compareList.length >= FREE_LIMIT) {
    btn.textContent = `⚠️ 無料版は${FREE_LIMIT}件まで。Pro版で無制限に比較する`;
    btn.setAttribute('style', BTN_STYLE_LIMIT);
    setTimeout(() => {
      btn.textContent = '＋ 比較リストに追加';
      btn.setAttribute('style', BTN_STYLE_BASE);
    }, 3000);
    return;
  }

  // 重複チェック
  if (compareList.some(p => p.url === window.location.href)) {
    btn.textContent = '✓ 追加済み';
    btn.setAttribute('style', BTN_STYLE_ADDED);
    return;
  }

  // 物件情報を抽出して保存
  const property = extractPropertyData();
  console.log(`[SUUMOCompare] extracted: ${property.name}, ${property.rent}, ${property.layout}`);

  compareList.push(property);
  await chrome.storage.local.set({ compareList });
  console.log(`[SUUMOCompare] saved to compareList (total: ${compareList.length}件)`);

  btn.textContent = '✓ 追加済み';
  btn.setAttribute('style', BTN_STYLE_ADDED);
}

function extractPropertyData() {
  const url = window.location.href;

  const name = document.querySelector('h1.section_h1-header-title')?.textContent.trim() || '';
  const rent = document.querySelector('span.property_view_note-emphasis')?.textContent.trim() || '';

  const tableData = {};
  document.querySelectorAll('table.property_view_table tr').forEach(row => {
    const ths = row.querySelectorAll('th.property_view_table-title');
    const tds = row.querySelectorAll('td.property_view_table-body');
    ths.forEach((th, i) => {
      if (tds[i]) {
        tableData[th.textContent.trim()] = tds[i].textContent.trim().replace(/\s+/g, ' ');
      }
    });
  });

  let managementFee = '', deposit = '', keyMoney = '';
  document.querySelectorAll('[class*="property_view_note"]').forEach(el => {
    const text = el.textContent.trim();
    if (!managementFee && (text.includes('管理費') || text.includes('共益費')) && text.length < 100) managementFee = text;
    if (!deposit  && text.includes('敷金') && text.length < 100) deposit  = text;
    if (!keyMoney && text.includes('礼金') && text.length < 100) keyMoney = text;
  });

  return {
    id:             `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    rent,
    management_fee: managementFee,
    deposit,
    key_money:      keyMoney,
    address:        tableData['所在地']   || tableData['住所']     || '',
    station:        tableData['駅徒歩']   || tableData['アクセス'] || tableData['交通'] || '',
    layout:         tableData['間取り']   || '',
    area:           tableData['専有面積'] || tableData['面積']     || '',
    age:            tableData['築年数']   || tableData['築年月']   || '',
    floor:          tableData['階']       || tableData['所在階']   || '',
    direction:      tableData['向き']     || '',
    building_type:  tableData['建物種別'] || tableData['構造']     || '',
    url,
    added_at:       new Date().toLocaleString('ja-JP'),
  };
}
