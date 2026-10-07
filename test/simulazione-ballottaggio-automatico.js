/*
 * Simulazione v9: alla chiusura programmata hanno votato tutti ma c'è una
 * parità → il ballottaggio viene preparato e aperto da solo, con nuovi link e
 * chiusura programmata; risolto il ballottaggio la catena prosegue da sola
 * (commissari pronti e voto per il Presidente aperto).
 * Uso: node test/simulazione-ballottaggio-automatico.js   (VERBOSE=1 per i dettagli)
 * Copyright (c) 2026 Daniele Lolli (UncleDan) — Licenza MIT
 */
global.VERBOSE = !!process.env.VERBOSE;
const path = require('path'), fs = require('fs');
const M = require('./mock-apps-script.js');
eval(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'));

let errori = 0;
const verifica = (cond, testo) => { console.log((cond ? '  ✔ ' : '  ✘ ') + testo); if (!cond) errori++; };
const foglio = n => M.SS.getSheetByName(n);
const codici = (sh, col) => foglio(sh).d.slice(1).filter(r => r[0] && r[col]).map(r => r[col]);
const trig = fn => M.triggers.filter(t => t.fn === fn)[0];
const ultimaMail = () => M.email[M.email.length - 1] || { subject: '', body: '' };
const esito = nome => { const h = foglio('Risultati').d[0]; const r = foglio('Risultati').d.find(x => x[1] === nome); return r[h.indexOf('Esito')]; };
const fra = ore => new Date(Date.now() + ore * 3600000);

function daTrigger(fn) {
  global.SENZA_UI = true;
  try { eval(fn + '()'); } finally { global.SENZA_UI = false; }
}

// ---------------- Preparazione: parità garantita ----------------
setup();
setCfg_('Interfaccia di voto', 'Semplice');   // questa simulazione prova la porta "app Google"
setCfg_('Sezione Territoriale', 'Emilia-Romagna');
setCfg_('Anno sportivo', '2026/2027');
foglio('Squadre').getRange(2, 1, 5, 2).setValues(
  [1, 2, 3, 4, 5].map(i => ['Squadra 0' + i, 'Società 0' + i]));
foglio('Candidati').getRange(2, 1, 4, 4).setValues([
  ['Candidato A', 'Allenatore', 'Squadra 01', 5],
  ['Candidato B', 'Allenatore', 'Squadra 02', 3],
  ['Candidato C', 'Allenatore', 'Squadra 03', 3],
  ['Candidato D', 'Allenatore', 'Squadra 04', 3]
]);
generaCodici();
setCfg_('Chiusura voto commissari', fra(24));
setCfg_('Chiusura voto presidente', fra(96));
setCfg_('Durata ballottaggio (ore)', 12);
setCfg_('Email avvisi', 'custode@example.org');
programmaVotazioni();
apri1();

console.log('\n=== Round 1: 3 posti, B C D a pari preferenze e pari anni');
const codSoc = codici('Società', 1);
const ctx1 = getInfo().ctx;
// A=4, B=3, C=1, D=1: con 3 posti restano C e D pari (stessi anni) per l'ultimo posto
const schede = [['Candidato A', 'Candidato B'], ['Candidato A', 'Candidato B'],
  ['Candidato A', 'Candidato B'], ['Candidato A', 'Candidato C'], ['Candidato D']];
codSoc.forEach((k, i) => inviaVoto(k, schede[i], ctx1));
verifica(usati_(1, 0).length === 5, 'hanno votato tutte e 5 le società');

daTrigger('triggerChiudeCommissari');
console.log('  esiti: ' + ['Candidato A', 'Candidato B', 'Candidato C', 'Candidato D'].map(n => n + '=' + esito(n)).join(', '));
verifica(['Candidato C', 'Candidato D'].every(n => /PARIT/.test(esito(n))),
  'parità rilevata al round 1 (C e D a pari preferenze e pari anni) per l\'ultimo posto');
verifica(ballottaggioAttivo_(cfg_()) === 1 && aperta_(cfg_()),
  'ballottaggio 1 preparato e APERTO in automatico, senza intervento manuale');
verifica(!!trig('triggerChiudeBallottaggio'), 'programmata la chiusura del ballottaggio (12 ore)');
const codBal = codici('Ballottaggio', 1);
verifica(codBal.length === 5 && codBal.every(k => codSoc.indexOf(k) < 0), '5 nuovi link, diversi da quelli del round 1');
verifica(/[Bb]allottaggio 1/.test(ultimaMail().subject) && codBal.every(k => ultimaMail().body.indexOf(k) >= 0),
  'email con l\'avviso di parità e i nuovi link di tutti i votanti');
verifica(verificaCodice(codSoc[0]).ok === false, 'il vecchio link non vale per il ballottaggio');

console.log('\n=== Ballottaggio automatico: proroga e poi esito');
const ctxB = getInfo().ctx;
inviaVoto(codBal[0], ['Candidato C'], ctxB);
daTrigger('triggerChiudeBallottaggio');
verifica(aperta_(cfg_()) && /prorogata/i.test(ultimaMail().subject), 'manca qualcuno: anche il ballottaggio viene prorogato');
[1, 2, 3, 4].forEach(i => inviaVoto(codBal[i], [i < 3 ? 'Candidato C' : 'Candidato D'], ctxB));
daTrigger('triggerChiudeBallottaggio');

verifica(!ballottaggioAttivo_(cfg_()), 'ballottaggio chiuso e calcolato in automatico');
verifica(/^ELETT/i.test(esito('Candidato C')) && /^Non eletto/i.test(esito('Candidato D')),
  'parità risolta: Candidato C eletto al ballottaggio (3 voti a 2)');
verifica(roundAttivo_(cfg_()) === 2 && aperta_(cfg_()),
  'la catena prosegue: commissari preparati e voto per il Presidente aperto');
const com = commissari_();
verifica(com.length === 3 && com.every(x => /^[A-H]{4}-[0-9]{4}$/.test(x.codice)),
  'commissari con codice personale: ' + com.map(x => x.nome).join(', '));
verifica(!!trig('triggerChiudePresidente'), 'programmata la chiusura del voto Presidente');
verifica(foglio('Risultati ballottaggi').getLastRow() > 1, 'foglio "Risultati ballottaggi" compilato');

console.log('\n=== Presidente: parità che nessun ballottaggio risolve → sorteggio');
const codCom = com.map(x => x.codice);
const ctx2 = getInfo().ctx;
inviaVoto(codCom[0], [com[1].nome], ctx2);      // 1 voto a B
inviaVoto(codCom[1], [com[2].nome], ctx2);      // 1 voto a C (stessi anni)
inviaVoto(codCom[2], [], ctx2);                 // scheda bianca
daTrigger('triggerChiudePresidente');
verifica(ballottaggioAttivo_(cfg_()) === 1, 'parità sul Presidente: ballottaggio 1 aperto in automatico');

for (let n = 1; n <= 3; n++) {
  const cb = codici('Ballottaggio', 1);
  const cx = getInfo().ctx;
  inviaVoto(cb[0], [com[1].nome], cx);
  inviaVoto(cb[1], [com[2].nome], cx);
  inviaVoto(cb[2], [], cx);
  daTrigger('triggerChiudeBallottaggio');
  if (n < 3) verifica(ballottaggioAttivo_(cfg_()) === n + 1, 'parità persiste: aperto in automatico il ballottaggio ' + (n + 1));
}

const stFin = balState_(2);
verifica(!!stFin.sorteggiato && stFin.stato === 'risolto',
  'dopo 3 ballottaggi senza esito: parità risolta per sorteggio');
const eletto = String(cfg_()['Presidente']).trim();
verifica([com[1].nome, com[2].nome].indexOf(eletto) >= 0, 'Presidente proclamato dal sorteggio: ' + eletto);
verifica(foglio('Risultati Presidente').d.some(r => /sorteggio/i.test(String(r[6]))),
  'nei risultati la nota "Eletto per sorteggio"');
verifica(foglio('Risultati ballottaggi').d.some(r => /SORTEGGIO/.test(String(r[0]))),
  'il sorteggio è registrato nel foglio "Risultati ballottaggi"');
verifica(/Risultati finali/i.test(ultimaMail().subject),
  'la catena prosegue da sola: email con i risultati finali');
verifica(!aperta_(cfg_()) && !trig('triggerChiudeBallottaggio'), 'nessuna votazione aperta e nessun trigger pendente');

console.log('\n=== Chiusura manuale di una votazione a tempo');
apri3();
creaTrigger_('triggerChiudeBallottaggio', fra(5));
chiudiVotazione();
verifica(!aperta_(cfg_()), 'chiusura manuale eseguita');

console.log(errori ? '\n' + errori + ' verifiche fallite.' : '\nTutte le verifiche superate.');
process.exit(errori ? 1 : 0);
