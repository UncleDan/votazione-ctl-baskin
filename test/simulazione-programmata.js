/*
 * Simulazione delle votazioni programmate (v9): apertura e chiusura a tempo del
 * voto commissari e del voto per il Presidente, proroga automatica quando manca
 * qualche voto, chiusura manuale che ferma la proroga.
 * Uso: node test/simulazione-programmata.js      (VERBOSE=1 per vedere avvisi ed email)
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
const fra = ore => new Date(Date.now() + ore * 3600000);

/** Esegue una funzione come farebbe un trigger a tempo: senza interfaccia. */
function daTrigger(fn) {
  global.SENZA_UI = true;
  try { eval(fn + '()'); } finally { global.SENZA_UI = false; }
}

// ---------------- Preparazione ----------------
setup();
setCfg_('Interfaccia di voto', 'Semplice');   // questa simulazione prova la porta "app Google"
setCfg_('Sezione Territoriale', 'Emilia-Romagna');
setCfg_('Anno sportivo', '2026/2027');
const squadre = [];
for (let s = 1; s <= 5; s++) squadre.push(['Squadra 0' + s, 'Società 0' + s]);
foglio('Squadre').getRange(2, 1, squadre.length, 2).setValues(squadre);
foglio('Candidati').getRange(2, 1, 4, 4).setValues([
  ['Candidato A', 'Allenatore', 'Squadra 01', 5],
  ['Candidato B', 'Allenatore', 'Squadra 02', 4],
  ['Candidato C', 'Allenatore', 'Squadra 03', 3],
  ['Candidato D', 'Allenatore', 'Squadra 04', 2]
]);
generaCodici();

console.log('\n=== Codici e link');
const codSoc = codici('Società', 1);
verifica(codSoc.length === 5, '5 società con codice: ' + codSoc.join(', '));
verifica(codSoc.every(k => /^[A-H]{4}-[0-9]{4}$/.test(k)), 'formato XXXX-9999 (4 lettere A–H + 4 cifre)');
verifica(new Set(codSoc).size === 5, 'codici tutti diversi');

console.log('\n=== Generazione senza azzerare dati');
foglio('Società').appendRow(['Società 06', '', '', '']);
const nuoviPrima = codSoc.slice();
generaCodici();
const codSoc2 = codici('Società', 1);
verifica(codSoc2.length === 6 && nuoviPrima.every((k, i) => codSoc2[i] === k),
  'nuova società: codice aggiunto, i 5 codici esistenti restano invariati');
verifica(foglio('Candidati').getLastRow() === 5 && foglio('Squadre').getLastRow() === 6,
  'candidati e squadre non toccati dalla generazione codici');
foglio('Società').d.pop();   // torno a 5 società

console.log('\n=== Rigenerazione dei codici');
rigeneraCodiciSocieta();
const codRig = codici('Società', 1);
verifica(codRig.length === 5 && codRig.every(k => codSoc.indexOf(k) < 0), 'codici tutti nuovi dopo la rigenerazione');
verifica(foglio('Candidati').getLastRow() === 5, 'candidati intatti dopo la rigenerazione');
codSoc.length = 0; codRig.forEach(k => codSoc.push(k));

console.log('\n=== Pianificazione');
setCfg_('Apertura voto commissari', fra(0.02));
setCfg_('Chiusura voto commissari', fra(24));
setCfg_('Chiusura voto presidente', fra(72));
setCfg_('Proroga automatica (ore)', 6);
setCfg_('Email avvisi', 'custode@example.org');
programmaVotazioni();
verifica(!!trig('triggerApreCommissari') && !!trig('triggerChiudeCommissari'),
  'creati i trigger di apertura e chiusura del voto commissari');

console.log('\n=== Apertura a tempo');
daTrigger('triggerApreCommissari');
verifica(aperta_(cfg_()) && roundAttivo_(cfg_()) === 1, 'il voto commissari si è aperto da solo');
verifica(/aperto/i.test(ultimaMail().subject), 'email di avviso di apertura inviata');
verifica(/si chiude il/.test(getInfo().programma), 'la pagina di voto mostra quando si chiude: ' + getInfo().programma);

console.log('\n=== Chiusura a tempo con voti mancanti → proroga');
const ctx1 = getInfo().ctx;
[0, 1, 2].forEach(i => inviaVoto(codSoc[i], ['Candidato A', 'Candidato B'], ctx1));   // votano 3 su 5
chiudiVotazione();
rigeneraCodiciSocieta();
verifica(codici('Società', 1).every((k, i) => k === codSoc[i]), 'con voti già espressi la rigenerazione è rifiutata (niente doppio voto)');
setCfg_('Stato', 'APERTA');
daTrigger('triggerChiudeCommissari');
verifica(aperta_(cfg_()), 'mancano voti: la votazione resta APERTA');
verifica(/prorogata/i.test(ultimaMail().subject), 'email di proroga inviata');
verifica(/Società 04/.test(ultimaMail().body) && /Società 05/.test(ultimaMail().body),
  'l\'email elenca chi non ha ancora votato');
verifica(!!trig('triggerChiudeCommissari'), 'nuova chiusura programmata (proroga di 6 ore)');
verifica(dataCfg_(cfg_(), 'Chiusura voto commissari') > new Date(), 'la data di chiusura in Config è stata spostata avanti');

console.log('\n=== Tutti hanno votato → chiusura, risultati, commissari, voto Presidente');
inviaVoto(codSoc[3], ['Candidato C', 'Candidato B'], ctx1);
inviaVoto(codSoc[4], ['Candidato A', 'Candidato C'], ctx1);
daTrigger('triggerChiudeCommissari');
verifica(roundAttivo_(cfg_()) === 2 && aperta_(cfg_()), 'voto commissari chiuso e voto Presidente aperto in automatico');
verifica(foglio('Risultati').getLastRow() > 1, 'risultati del round 1 calcolati');
const com = commissari_();
verifica(com.length === 3, 'commissari eletti e preparati: ' + com.map(x => x.nome).join(', '));
verifica(com.every(x => /^[A-H]{4}-[0-9]{4}$/.test(x.codice) && link_(x.codice)), 'ogni commissario ha codice e link personale');
verifica(/Presidente/.test(ultimaMail().subject) && com.every(x => ultimaMail().body.indexOf(link_(x.codice)) >= 0),
  'email con l\'elenco dei commissari e i loro link');
verifica(!!trig('triggerChiudePresidente'), 'programmata la chiusura del voto Presidente');

console.log('\n=== Voto Presidente: proroga e poi risultati finali');
const ctx2 = getInfo().ctx;
const codCom = com.map(x => x.codice);
inviaVoto(codCom[0], [com[0].nome], ctx2);
inviaVoto(codCom[1], [com[0].nome], ctx2);
daTrigger('triggerChiudePresidente');
verifica(aperta_(cfg_()) && /prorogata/i.test(ultimaMail().subject), 'manca un commissario: proroga anche al round 2');
verifica(ultimaMail().body.indexOf(com[2].nome) >= 0, 'l\'email indica il commissario che non ha votato');
inviaVoto(codCom[2], [com[0].nome], ctx2);
daTrigger('triggerChiudePresidente');
verifica(!aperta_(cfg_()), 'hanno votato tutti: voto Presidente chiuso');
verifica(String(cfg_()['Presidente']).trim() === com[0].nome, 'Presidente eletto: ' + cfg_()['Presidente']);
verifica(/Risultati finali/i.test(ultimaMail().subject) && ultimaMail().body.indexOf(com[0].nome) >= 0,
  'email con i risultati finali');

console.log('\n=== Chiusura manuale di una votazione a tempo');
setCfg_('Chiusura voto presidente', fra(10));
apri3();                                   // round 3: Vice
creaTrigger_('triggerChiudePresidente', fra(10));
verifica(!!trig('triggerChiudePresidente'), 'trigger di chiusura pendente');
chiudiVotazione();
verifica(!aperta_(cfg_()) && !trig('triggerChiudePresidente'),
  'chiusura manuale: votazione chiusa e proroga automatica annullata');
annullaPianificazione();
verifica(M.triggers.length === 0, 'pianificazione annullata: nessun trigger residuo');

console.log(errori ? '\n' + errori + ' verifiche fallite.' : '\nTutte le verifiche superate.');
process.exit(errori ? 1 : 0);
