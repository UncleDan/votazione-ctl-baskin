/*
 * Dati di prova, qualifica "Altro" e autocandidatura spostata sulla squadra.
 * Uso: node test/simulazione-dati-prova.js      (VERBOSE=1 per vedere gli avvisi)
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

// ---------------- Dati di prova ----------------
console.log('=== "Riempi con dati di prova": stessi numeri dell\'Emilia-Romagna');
inizializzaDatiProva();
const cand = candidati_();
verifica(numSocieta_() === 11, 'società: ' + numSocieta_());
verifica(squadre_().length === 16, 'squadre: ' + squadre_().length);
verifica(cand.length === 13, 'candidati: ' + cand.length);
verifica(cand.filter(x => x.aiuto).length === 4, 'di cui aiuto allenatore: ' + cand.filter(x => x.aiuto).length);
const conCand = new Set(cand.map(x => mappaSquadraSocieta_()[x.squadra]).filter(Boolean));  // l'autocandidato non ha società
verifica(11 - conCand.size === 2, 'società senza candidati: ' + (11 - conCand.size));
verifica(posti_(cfg_()) === 6, 'commissari da eleggere: ' + posti_(cfg_()));
verifica(maxPref_(cfg_(), cand.length) === 7, 'preferenze per scheda: ' + maxPref_(cfg_(), cand.length));
verifica(cand.filter(x => x.auto).length === 1, 'di cui autocandidati: ' + cand.filter(x => x.auto).length);
verifica(codici().length === 11, 'codici generati: ' + codici().length);
verifica(/PROVA/.test(String(cfg_()['Titolo'])), 'titolo marcato: ' + cfg_()['Titolo']);
verifica(cand.every(x => ['Allenatore', 'Aiuto allenatore', 'Altro'].indexOf(x.qualifica) >= 0),
  'tutte le qualifiche sono fra quelle previste');

// ---------------- Qualifica "Altro" e autocandidatura ----------------
console.log('\n=== Qualifica "Altro" e autocandidatura al posto della squadra');
const sh = sheet_('Candidati');
sh.getRange(15, 1, 1, 5).setValues([['Candidato Z', 'Altro', 'Autocandidatura', 7, 'si candida da sé']]);
const c2 = candidati_();
const z = c2.filter(x => x.nome === 'Candidato Z')[0];
verifica(!!z, 'candidato con qualifica "Altro" accettato');
verifica(z.auto === true, 'la squadra "Autocandidatura" lo segna come autocandidato');
verifica(z.aiuto === false, 'non è un aiuto allenatore, quindi non consuma la deroga');
verifica(mappaSquadraSocieta_()['Autocandidatura'] === undefined, 'non è abbinato a nessuna società');

// l'autocandidato entra fra i "primi", come un allenatore
const lista = [
  { nome: 'Candidato Z', aiuto: false, voti: 9, anni: 7 },
  { nome: 'Candidato A', aiuto: true, voti: 8, anni: 6 },
  { nome: 'Candidato C', aiuto: false, voti: 7, anni: 4 }
];
const ass = assegna_(lista, 2, 1);
verifica(ass.esito['Candidato Z'].esito === 'ELETTO' && ass.esito['Candidato C'].esito === 'ELETTO',
  'con 2 posti entrano l\'autocandidato e l\'allenatore, non l\'aiuto più votato');
verifica(/non bastano gli altri candidati/.test(ass.esito['Candidato A'].nota),
  'e all\'aiuto allenatore viene spiegato perché: "' + ass.esito['Candidato A'].nota + '"');

// ---------------- Migrazione dalle versioni precedenti ----------------
console.log('\n=== Migrazione: "Autocandidatura" era una qualifica');
sh.getRange(16, 1, 2, 5).setValues([
  ['Candidato Y', 'Autocandidatura', '', 3, ''],          // senza squadra: diventa autocandidato
  ['Candidato X', 'Autocandidatura', 'Golf', 2, '']        // con squadra: la squadra resta
]);
setup();
const c3 = candidati_();
const y = c3.filter(x => x.nome === 'Candidato Y')[0];
const x = c3.filter(x2 => x2.nome === 'Candidato X')[0];
verifica(y.qualifica === 'Altro' && y.squadra === 'Autocandidatura',
  'senza squadra: qualifica "Altro" e autocandidatura al posto della squadra');
verifica(x.qualifica === 'Altro' && x.squadra === 'Golf',
  'con squadra: la squadra resta, cambia solo la qualifica');
verifica(c3.filter(k => /autocand/i.test(k.qualifica)).length === 0,
  'nessuna qualifica "Autocandidatura" rimasta');

console.log(errori ? '\n' + errori + ' verifiche fallite.' : '\nTutte le verifiche superate.');
process.exit(errori ? 1 : 0);
