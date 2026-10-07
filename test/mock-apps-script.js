/*
 * Mock minimale di Google Apps Script (SpreadsheetApp, PropertiesService, ...)
 * per eseguire Code.gs con Node.js. Solo per test: node test/simulazione.js
 * Copyright (c) 2026 Daniele Lolli (UncleDan) — Licenza MIT
 */
const crypto = require('crypto');

function Sheet(name) { this.name = name; this.d = []; }
Sheet.prototype = {
  getName() { return this.name; }, setName(n) { this.name = n; },
  getLastRow() { for (let i = this.d.length; i > 0; i--) if (this.d[i - 1] && this.d[i - 1].some(v => v !== '' && v != null)) return i; return 0; },
  getLastColumn() { let m = 0; this.d.forEach(r => { for (let j = r.length; j > 0; j--) if (r[j - 1] !== '' && r[j - 1] != null) { m = Math.max(m, j); break; } }); return m; },
  getMaxRows() { return Math.max(this.d.length, 1000); },
  cell(r, c) { while (this.d.length < r) this.d.push([]); const row = this.d[r - 1]; while (row.length < c) row.push(''); return row; },
  getRange(r, c, nr, nc) {
    if (typeof r === 'string') { if (r === 'A1') { r = 1; c = 1; nr = 1; nc = 1; } else { r = 2; c = 1; nr = 999; nc = 1; } }
    nr = nr || 1; nc = nc || 1; const sh = this;
    const R = {
      getValues() { const o = []; for (let i = 0; i < nr; i++) { const a = []; for (let j = 0; j < nc; j++) { const row = sh.d[r - 1 + i] || []; a.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); } o.push(a); } return o; },
      getValue() { return R.getValues()[0][0]; },
      setValues(v) { v.forEach((a, i) => a.forEach((x, j) => { sh.cell(r + i, c + j)[c - 1 + j] = x; })); return R; },
      setValue(x) { sh.cell(r, c)[c - 1] = x; return R; },
      clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) { const row = sh.d[r - 1 + i]; if (row && row.length >= c + j) row[c - 1 + j] = ''; } return R; },
      setRichTextValue(v) { sh.cell(r, c)[c - 1] = v.text; return R; },
      setFontWeight() { return R; }, setBackground() { return R; }, setFontSize() { return R; },
      setDataValidation() { return R; }, setNumberFormat() { return R; },
      setFormula(f) { sh.cell(r, c)[c - 1] = f; return R; }
    };
    return R;
  },
  appendRow(a) { this.d.splice(this.getLastRow(), 0, a.slice()); },
  clearContents() { this.d = []; }, clear() { this.d = []; },
  insertColumnsAfter(c, n) { this.d.forEach(r => { while (r.length < c) r.push(''); r.splice(c, 0, ...Array(n).fill('')); }); },
  setFrozenRows() {}, autoResizeColumns() {}, activate() {}, setRowHeight() {}, setRowHeights() {}
};

const SS = {
  sheets: [],
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; },
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; },
  toast(m) { if (global.VERBOSE) console.log('  [toast]', m); }
};
const alerts = [];
const UI = {
  alert(a, b) { const t = b || a; alerts.push(t); if (global.VERBOSE) console.log('  [avviso]', t.replace(/\n+/g, ' | ')); return 'YES'; },
  Button: { YES: 'YES', NO: 'NO', OK: 'OK', CANCEL: 'CANCEL' },
  ButtonSet: { OK: 'OK', YES_NO: 'YES_NO', OK_CANCEL: 'OK_CANCEL' },
  promptAnswer: '1',
  prompt() { return { getSelectedButton: () => 'OK', getResponseText: () => UI.promptAnswer }; },
  createMenu() { const m = { addItem: () => m, addSubMenu: () => m, addSeparator: () => m, addToUi: () => m }; return m; }
};
const props = {};
global.SpreadsheetApp = {
  getActive: () => SS, getActiveSpreadsheet: () => SS,
  // con global.SENZA_UI si simula l'esecuzione da trigger a tempo (nessuna interfaccia)
  getUi: () => { if (global.SENZA_UI) throw new Error('Cannot call SpreadsheetApp.getUi() from this context.'); return UI; },
  newDataValidation() { const b = { requireValueInList: () => b, requireValueInRange: () => b, setAllowInvalid: () => b, build: () => ({}) }; return b; },
  newRichTextValue() { const o = {}; const b = { setText(t) { o.text = t; return b; }, setLinkUrl() { return b; }, build: () => o }; return b; }
};
global.PropertiesService = { getScriptProperties: () => ({
  getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; },
  setProperties: o => Object.assign(props, o), deleteProperty: k => { delete props[k]; } }) };
global.Utilities = {
  getUuid: () => crypto.randomUUID(),
  computeDigest: (a, s) => Array.from(crypto.createHash('sha256').update(String(s)).digest()).map(b => b > 127 ? b - 256 : b),
  DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 },
  base64Encode: a => Buffer.from(a.map(b => b & 255)).toString('base64'),
  formatDate: (d, tz, f) => {
    const p = n => String(n).padStart(2, '0');
    return f.replace('dd', p(d.getDate())).replace('MM', p(d.getMonth() + 1))
      .replace('yyyy', d.getFullYear()).replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes()));
  }
};
global.LockService = { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) };
// --- trigger temporali ---
const triggers = [];   // { fn, at }
global.ScriptApp = {
  getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/ESEMPIO/exec' }),
  getProjectTriggers: () => triggers.map(t => ({ getHandlerFunction: () => t.fn, _t: t })),
  deleteTrigger: h => { const i = triggers.indexOf(h._t); if (i >= 0) triggers.splice(i, 1); },
  newTrigger(fn) {
    const b = { timeBased: () => b, at(d) { b.when = d; return b; }, create() { triggers.push({ fn: fn, at: b.when }); } };
    return b;
  }
};
global.HtmlService = {};

// --- email di avviso ---
const email = [];
global.MailApp = { sendEmail: (to, subject, body) => { email.push({ to, subject, body }); if (global.VERBOSE) console.log('  [email → ' + to + '] ' + subject); } };
global.Session = { getEffectiveUser: () => ({ getEmail: () => 'custode@example.org' }) };

module.exports = { SS, UI, alerts, props, triggers, email };
