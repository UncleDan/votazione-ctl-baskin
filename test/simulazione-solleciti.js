/*
 * Promemoria automatico a chi non ha ancora votato, poche ore prima della
 * chiusura programmata.
 * Uso: node test/simulazione-solleciti.js      (VERBOSE=1 per vedere gli avvisi)
 * Copyright (c) 2026 Daniele Lolli (UncleDan) — Licenza MIT
 */
global.VERBOSE = !!process.env.VERBOSE;
const path = require('path'), fs = require('fs');
const M = require('./mock-apps-script.js');
eval(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'));

let errori = 0;
const verifica = (cond, testo) => { console.log((cond ? '  ✔ ' : '  ✘ ') + testo); if (!cond) errori++; };
const foglio = n => M.SS.getSheetByName(n);
const codici = () => foglio('Società').d.slice(1).filter(r => r[0] && r[1]).map(r => r[1]);
const sol = () => M.triggers.filter(t => t.fn === 'triggerSollecito');
// le notifiche al Coordinatore hanno il prefisso [CTL Baskin]: qui contano solo i promemoria ai votanti
const avvisi = () => M.email.filter(e => !/^\[CTL Baskin\]/.test(e.subject));
const ORA = 3600000;

// ---------------- Preparazione: chiusura fra 10 ore ----------------
setup();
setCfg_('Interfaccia di voto', 'Semplice');
setCfg_('Sezione Territoriale', 'Emilia-Romagna');
setCfg_('Numero eletti', 3);
const N = 5;
foglio('Squadre').getRange(2, 1, N, 2).setValues(
  Array.from({ length: N }, (_, i) => ['Squadra ' + (i + 1), 'Società ' + (i + 1)]));
foglio('Candidati').getRange(2, 1, N, 4).setValues(
  Array.from({ length: N }, (_, i) => ['Candidato ' + 'ABCDE'[i], 'Allenatore', 'Squadra ' + (i + 1), N - i]));
generaCodici();
const soc = sheet_('Società');
for (let i = 0; i < N; i++) soc.getRange(i + 2, 6).setValue('s' + (i + 1) + '@esempio-valido.it');
const chiusura = new Date(Date.now() + 10 * ORA);
setCfg_('Chiusura voto commissari', chiusura);

console.log('=== Programmazione');
verifica(oreSolleciti_(cfg_()).join(',') === '4,2', 'Config predefinito: ' + oreSolleciti_(cfg_()).join(' e ') + ' ore prima');
programmaVotazioni();
verifica(sol().length === 2, 'due promemoria programmati: ' + sol().length);
const quando = sol().map(t => Math.round((chiusura - t.at) / ORA)).sort((a, b) => b - a);
verifica(quando.join(',') === '4,2', 'a ' + quando.join(' e ') + ' ore dalla chiusura');

console.log('\n=== Il promemoria parte solo a chi non ha votato');
apri1();
const cod = codici();
const ctx = getInfo().ctx;
[0, 1].forEach(i => inviaVoto(cod[i], ['Candidato A'], ctx));     // votano i primi due
M.email.length = 0;
triggerSollecito();
verifica(avvisi().length === N - 2, 'promemoria a ' + avvisi().length + ' societa su ' + N + ' (due hanno gia votato)');
verifica(avvisi().every(e => /mancano \d+ ore per votare/.test(e.subject)),
  'oggetto: "' + (avvisi()[0] || {}).subject + '"');
verifica(avvisi().every(e => /non risulta ancora una scheda/.test(e.body)), 'e il testo dice perche arriva');
verifica(avvisi().every(e => /si chiude il /.test(e.body)), 'con la data di chiusura');
verifica(avvisi().every(e => /\?c=|#c=/.test(e.body)), 'e il link personale per votare');
verifica(M.email.length === avvisi().length + 1, 'e al Coordinatore arriva il riepilogo di chi e stato sollecitato');

console.log('\n=== Quando non deve partire');
M.email.length = 0;
[2, 3, 4].forEach(i => inviaVoto(cod[i], ['Candidato B'], ctx));   // votano tutti
triggerSollecito();
verifica(avvisi().length === 0, 'hanno votato tutti: nessun promemoria');
chiudiVotazione();
verifica(sol().length === 0, 'chiudendo a mano cadono anche i promemoria pendenti');
M.email.length = 0;
triggerSollecito();
verifica(avvisi().length === 0, 'a votazione chiusa non parte niente');

console.log('\n=== Si possono spegnere, o cambiare');
setCfg_('Stato', 'CHIUSA');
setCfg_('Solleciti prima della chiusura (ore)', '');
setCfg_('Chiusura voto commissari', new Date(Date.now() + 10 * ORA));
programmaVotazioni();
verifica(sol().length === 0, 'con il parametro vuoto non se ne programma nessuno');
setCfg_('Solleciti prima della chiusura (ore)', '24, 6, 1');
setCfg_('Chiusura voto commissari', new Date(Date.now() + 48 * ORA));   // 24 ore prima dev'essere ancora futuro
programmaVotazioni();
verifica(sol().length === 3, 'con "24, 6, 1" se ne programmano 3');
const q2 = sol().map(t => Math.round((pianificazione_(cfg_()).ch1 - t.at) / ORA)).sort((a, b) => b - a);
verifica(q2.join(',') === '24,6,1', 'agli anticipi indicati: ' + q2.join(', ') + ' ore');

console.log(errori ? '\n' + errori + ' verifiche fallite.' : '\nTutte le verifiche superate.');
process.exit(errori ? 1 : 0);
