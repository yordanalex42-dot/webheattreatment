// Verification that RCF search/render flow works end-to-end
// Simulates the browser environment and runs RCF.init() + searchMaterial()

'use strict';

const fs = require('fs');
const path = require('path');

// ---- Mock browser environment ----
class MemoryStorage {
  constructor() { this.store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this.store, k) ? this.store[k] : null; }
  setItem(k, v) { this.store[k] = String(v); }
  removeItem(k) { delete this.store[k]; }
  keys() { return Object.keys(this.store); }
  clear() { this.store = {}; }
}

const domElements = {};
function createElement(tag) {
  const el = {
    _tag: tag, _id: null, id: '', className: '',
    innerHTML: '', textContent: '', value: '',
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
      toggle(c) { if (this._set.has(c)) this._set.delete(c); else this._set.add(c); }
    },
    appendChild(child) { this._children = this._children || []; this._children.push(child); return child; },
    setAttribute(n, v) { this[n] = v; },
    getAttribute(n) { return this[n] != null ? this[n] : null; },
    addEventListener() {},
    focus() {},
    scrollIntoView() {},
    disabled: false,
    style: {},
    _children: []
  };
  return el;
}

const mockDocument = {
  getElementById(id) {
    if (!domElements[id]) domElements[id] = createElement('div');
    domElements[id]._id = id;
    domElements[id].id = id;
    return domElements[id];
  },
  createElement(tag) { return createElement(tag); },
  addEventListener() {},
  querySelector(selector) {
    // Parse #id or element selector
    if (selector.startsWith('#')) {
      const id = selector.slice(1).replace(/[.'\[].*$/, '');
      return domElements[id] || mockDocument.getElementById(id);
    }
    return null;
  }
};

global.document = mockDocument;
global.localStorage = new MemoryStorage();
global.location = { protocol: 'file:', host: 'localhost', pathname: '/inspection-report.html' };
global.window = global.location;
global.window.addEventListener = () => {};
global.QRCode = { CorrectLevel: { H: 0 } };
global.console = console;

// Mock HTUI for any references in report-center.js
global.HTUI = {
  requireAuth: () => true,
  openModal: () => {},
  closeModal: () => {},
  toast: () => {}
};

// Load date-format.js
var dfCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'date-format.js'), 'utf8');
// Inject global declarations so the bare assignments work
var dfWrapper = 'var HTDateFormat; var formatDateLong; var formatDateLongWithTime; ' + dfCode + ' global.formatDateLong = formatDateLong; global.formatDateLongWithTime = formatDateLongWithTime; global.HTDateFormat = HTDateFormat;';
eval(dfWrapper);

// Load db.js - it's a module with const DB, we need to make it global
var dbCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'db.js'), 'utf8');
dbCode = dbCode.replace('const DB', 'global.DB');
eval(dbCode);
DB.init();

// Load report-center.js - it's `const RCF`, we need to make it global
var rcfCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'report-center.js'), 'utf8');
rcfCode = rcfCode.replace('const RCF', 'global.RCF');
eval(rcfCode);

// ---- Test ----
let failures = 0;
function assert(cond, msg) {
  if (cond) console.log('PASS:', msg);
  else { console.log('FAIL:', msg); failures++; }
}

// Init RCF
try {
  RCF.init();
  assert(true, 'RCF.init() runs without error');
} catch (e) {
  assert(false, 'RCF.init() runs without error: ' + e.message);
}

// Get test data from DB
let materials = [];
try {
  if (DB && DB.get) materials = DB.get('materials');
  else if (DBModule && DBModule.DB && DBModule.DB.get) materials = DBModule.DB.get('materials');
} catch (e) {
  console.log('DB access error:', e.message);
}
assert(materials.length > 0, 'DB has materials for testing');

if (materials.length > 0) {
  // Use material 3M which has full QC data with all approvals
  var testKode = '3M';
  console.log('\nTesting with kode:', testKode);

  // Check QC data
  var material = DB.findByKode(testKode) || DB.findMaterial(testKode);
  console.log('Material found:', material ? material.kode : 'null');
  var qc = DB._getAfterQc(material);
  console.log('QC data:', qc ? 'found (hasil=' + qc.hasil + ')' : 'null');
  var judge = DB.getQCJudgement(material);
  console.log('Judge hasInspector:', judge ? judge.hasInspector : 'null');
  console.log('Judge leaderJudgement:', judge ? judge.leaderJudgement : 'null');
  console.log('Judge supervisorJudgement:', judge ? judge.supervisorJudgement : 'null');

  // Simulate typing in input
  const input = document.getElementById('materialCodeInput');
  input.value = testKode;

  // Run search
  RCF.searchMaterial();
  assert(true, 'RCF.searchMaterial() runs without error');

  // Check that search results are shown
  const sr = document.getElementById('searchResults');
  assert(!sr.classList.contains('hidden'), 'searchResults is visible after search');

  // Check that not-found state is hidden
  const nf = document.getElementById('notFoundState');
  assert(nf.classList.contains('hidden'), 'notFoundState is hidden after search');

  // Check that sHasil was populated (this was the bug — null deref)
  const sh = document.getElementById('sHasil');
  assert(sh.innerHTML.indexOf('OK') >= 0, 'sHasil is populated after search: ' + sh.innerHTML);
  assert(sh.innerHTML.indexOf('<span') >= 0, 'sHasil contains badge span HTML');

  // Check control number
  const sc = document.getElementById('sControlNumber');
  assert(sc.textContent !== '-', 'sControlNumber is populated: ' + sc.textContent);

  // Check customer
  const cust = document.getElementById('sCustomer');
  assert(cust.textContent !== '-', 'sCustomer is populated: ' + cust.textContent);

  // Check approval badges have content
  const inspBadge = document.getElementById('aInspectorBadge');
  assert(inspBadge.textContent !== '', 'aInspectorBadge has content');

  const issueList = document.getElementById('issueList');
  console.log('issueList innerHTML length:', issueList.innerHTML ? issueList.innerHTML.length : 0);

  const statusBadge = document.getElementById('documentStatusBadge');
  console.log('documentStatusBadge textContent:', statusBadge.textContent || '(empty)');
}

// Test with invalid kode
console.log('\n--- Testing invalid kode ---');
const input2 = document.getElementById('materialCodeInput');
input2.value = 'INVALIDKODE12345';
try {
  RCF.searchMaterial();
  assert(true, 'RCF.searchMaterial() with invalid kode runs without error');
} catch (e) {
  assert(false, 'RCF.searchMaterial() with invalid kode error: ' + e.message);
}

const nf2 = document.getElementById('notFoundState');
const sr2 = document.getElementById('searchResults');

// notFoundState should be visible (no hidden class)
const notFoundVisible = !nf2.classList.contains('hidden');
const resultsHidden = sr2.classList.contains('hidden');
assert(notFoundVisible, 'notFoundState is visible for invalid kode');
assert(resultsHidden, 'searchResults is hidden for invalid kode');

// Test clearing search
console.log('\n--- Testing reset search ---');
try {
  RCF.resetSearch();
  assert(true, 'RCF.resetSearch() runs without error');
} catch (e) {
  assert(false, 'RCF.clearSearch() error: ' + e.message);
}

console.log('\n=== Test Summary ===');
console.log('Failures:', failures);
process.exit(failures > 0 ? 1 : 0);
