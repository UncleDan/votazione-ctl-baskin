/*
 * La checklist operativa dentro al foglio: la procedura passo per passo,
 * subito dopo "Config", con le spunte e le note che restano quando il foglio
 * viene rigenerato.
 * Uso: node test/simulazione-checklist.js      (VERBOSE=1 per vedere gli avvisi)
 * Copyright (c) 2026 Daniele Lolli (UncleDan) — Licenza MIT
 */
global.VERBOSE = !!process.env.VERBOSE;
const path = require('path'), fs = require('fs');
const M = require('./mock-apps-script.js');
eval(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'));

let errori = 0;
const verifica = (cond, testo) => { console.log((cond ? '  ✔ ' : '  ✘ ') + testo); if (!cond) errori++; };
const foglio = n => M.SS.getSheetByName(n);
const nomi = () => M.SS.getSheets().map(s => s.getName());
const passi = () => foglio('Checklist').d.filter(r => typeof r[0] === 'boolean');
const riga = txt => foglio('Checklist').d.find(r => /\w/.test(String(r[1])) && String(r[1]).indexOf(txt) >= 0);

console.log('=== Il foglio nasce con "Inizializza / aggiorna fogli"');
setup();
verifica(!!foglio('Checklist'), 'il foglio "Checklist" c\'è');
verifica(nomi()[0] === 'Config' && nomi()[1] === 'Checklist',
  'ed è il secondo, subito dopo Config: ' + nomi().slice(0, 4).join(' · '));
const ck = foglio('Checklist');
verifica(ck.d[2][0] === 'Fatto' && ck.d[2][1] === 'Cosa fare' && ck.d[2][2] === 'Note',
  'intestazione: Fatto · Cosa fare · Note');
verifica(/Checklist operativa/.test(String(ck.d[0][0])), 'con un titolo in testa: "' + ck.d[0][0] + '"');
verifica(passi().length > 30, passi().length + ' passi da spuntare');
verifica(ck.d.some(r => !r[0] && /^0\. Prima di cominciare/.test(String(r[1]))), 'divisi in sezioni');
verifica(['1. Candidature', '2. Round 1', '3. Ballottaggio', '4. Round 2', '5. Round 3', '6. Chiusura', '7. Dopo']
  .every(s => ck.d.some(r => String(r[1]).indexOf(s) === 0)), 'dalla raccolta delle candidature ai posti vacanti');

console.log('\n=== I passi dicono le voci di menu vere');
verifica(!!riga('Genera codici e link mancanti'), 'il round 1 cita "Genera codici e link mancanti"');
verifica(!!riga('3. Chiedi ai commissari se accettano l\'incarico'), 'il round 2 cita la conferma dell\'incarico');
const rin = riga('Chi risponde di no');
verifica(!!rin && /"Candidati" \(NON in "Commissari"\)/.test(String(rin[1])),
  'e la rinuncia manda al foglio giusto: "' + String(rin[1]).slice(0, 60) + '…"');
verifica(!!riga('Controllo OK: schede = codici usati'), 'la chiusura cita il controllo di coerenza');

console.log('\n=== Spunte e note restano quando si rigenera');
const i1 = ck.d.findIndex(r => typeof r[0] === 'boolean');
const testo1 = String(ck.d[i1][1]);
ck.getRange(i1 + 1, 1).setValue(true);
ck.getRange(i1 + 1, 3).setValue('fatto il 12/11, mancano 2 società');
const i2 = ck.d.findIndex((r, k) => typeof r[0] === 'boolean' && k > i1 + 2);
ck.getRange(i2 + 1, 1).setValue(true);
aggiornaChecklist();
const dopo = foglio('Checklist').d.find(r => String(r[1]) === testo1);
verifica(!!dopo && dopo[0] === true, 'la spunta è ancora lì dopo "aggiorna"');
verifica(!!dopo && dopo[2] === 'fatto il 12/11, mancano 2 società', 'e anche la nota');
verifica(foglio('Checklist').d.filter(r => r[0] === true).length === 2, 'tutt\'e due le spunte, non una sola');
setup();
verifica(foglio('Checklist').d.filter(r => r[0] === true).length === 2,
  'e "Inizializza / aggiorna fogli" non le cancella');

console.log('\n=== Una nuova elezione riparte da zero');
azzeraElezione_(true);
aggiornaChecklist();
verifica(foglio('Checklist').d.filter(r => r[0] === true).length === 0,
  'dopo "Azzeramenti → Tutto" le spunte sono sparite');
verifica(passi().length > 30, 'ma i passi ci sono ancora: ' + passi().length);

console.log(errori ? '\n' + errori + ' verifiche fallite.' : '\nTutte le verifiche superate.');
process.exit(errori ? 1 : 0);
