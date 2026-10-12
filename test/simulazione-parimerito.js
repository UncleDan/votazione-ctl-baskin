/*
 * Pari preferenze fra l'ultimo eletto e il primo dei non eletti: il verbale
 * deve dire che cosa ha deciso — gli anni di tesseramento, oppure il
 * ballottaggio — altrimenti quelle due righe sembrano messe a caso.
 * Uso: node test/simulazione-parimerito.js      (VERBOSE=1 per vedere gli avvisi)
 * Copyright (c) 2026 Daniele Lolli (UncleDan) — Licenza MIT
 */
global.VERBOSE = !!process.env.VERBOSE;
const path = require('path'), fs = require('fs');
const M = require('./mock-apps-script.js');
eval(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'));

let errori = 0;
const verifica = (cond, testo) => { console.log((cond ? '  ✔ ' : '  ✘ ') + testo); if (!cond) errori++; };
const foglio = n => M.SS.getSheetByName(n);

// 4 candidati per 2 posti. Secondo e Terzo prenderanno 2 voti a testa:
// decide l'anzianità (4 anni contro 2).
setup();
setCfg_('Interfaccia di voto', 'Semplice');
setCfg_('Numero eletti', 2);
foglio('Squadre').getRange(2, 1, 4, 2).setValues([1, 2, 3, 4].map(i => ['Sq' + i, 'Soc' + i]));
foglio('Candidati').getRange(2, 1, 4, 4).setValues([
  ['Primo', 'Allenatore', 'Sq1', 5],
  ['Secondo', 'Allenatore', 'Sq2', 4],
  ['Terzo', 'Allenatore', 'Sq3', 2],
  ['Quarto', 'Allenatore', 'Sq4', 1]
]);
generaCodici();
apri1();
const cod = foglio('Società').d.slice(1).filter(r => r[0] && r[1]).map(r => r[1]);
const ctx = getInfo().ctx;
[['Primo', 'Secondo'], ['Primo', 'Terzo'], ['Primo', 'Secondo'], ['Terzo', 'Quarto']]
  .forEach((s, i) => inviaVoto(cod[i], s, ctx));
chiudiVotazione();
calcola1();
aggiornaReport();

const rep = foglio('Verbale').d.map(r => r.map(x => String(x == null ? '' : x)));
const grad = rep.slice(rep.findIndex(r => r[0] === 'Pos.') + 1).filter(r => /^\d+$/.test(r[0]));
const riga = nome => grad.find(r => r[1] === nome) || [];

console.log('=== Il pari merito è segnalato');
verifica(Number(riga('Secondo')[3]) === Number(riga('Terzo')[3]),
  'ultimo eletto e primo escluso hanno le stesse preferenze (' + riga('Secondo')[3] + ')');
verifica(/Commissario \(4 anni\)$/.test(riga('Secondo')[4]),
  'accanto all\'ultimo eletto gli anni: "' + riga('Secondo')[4] + '"');
verifica(/\(2 anni\)$/.test(riga('Terzo')[4]),
  'e accanto al primo escluso i suoi: "' + riga('Terzo')[4] + '"');
verifica(grad.filter(r => /\(\d+ anni?\)$/.test(r[4])).length === 2,
  'solo su quelle due righe, non su tutte');
verifica(!/\(\d+ anni?\)$/.test(riga('Primo')[4]) && !/\(\d+ anni?\)$/.test(riga('Quarto')[4]),
  'chi non e sul confine non riporta nulla fra parentesi');

console.log('\n=== E spiegato sotto la tabella');
verifica(rep.some(r => /stesse preferenze/.test(r[0]) && /anni di tesseramento/.test(r[0])),
  'il verbale dice che cosa ha deciso');

console.log('\n=== Vale anche fra le riserve');
// Terzo e Quarto restano fuori entrambi con 1 voto: l'ordine di subentro
// fra loro va giustificato come quello sull'ultimo posto.
azzeraRisultati();
apri1();
const codB = foglio('Società').d.slice(1).filter(r => r[0] && r[1]).map(r => r[1]);
const ctxB = getInfo().ctx;
[['Primo', 'Secondo'], ['Primo', 'Secondo'], ['Primo', 'Terzo'], ['Secondo', 'Quarto']]
  .forEach((s, k) => inviaVoto(codB[k], s, ctxB));
chiudiVotazione(); calcola1(); aggiornaReport();
const repB = foglio('Verbale').d.map(r => r.map(x => String(x == null ? '' : x)));
const gradB = repB.slice(repB.findIndex(r => r[0] === 'Pos.') + 1).filter(r => /^\d+$/.test(r[0]));
const rigaB = nome => gradB.find(r => r[1] === nome) || [];
verifica(Number(rigaB('Terzo')[3]) === Number(rigaB('Quarto')[3]),
  'Terzo e Quarto sono entrambi riserve con ' + rigaB('Terzo')[3] + ' voto');
verifica(/\(2 anni\)$/.test(rigaB('Terzo')[4]) && /\(1 anno\)$/.test(rigaB('Quarto')[4]),
  'e l\'ordine di subentro e giustificato: "' + rigaB('Terzo')[4] + '" / "' + rigaB('Quarto')[4] + '"');
verifica(repB.some(r => /Vale anche fra le riserve/.test(r[0])),
  'la nota dice che la regola vale anche fra le riserve');

console.log('\n=== Senza pari merito non si annota niente');
azzeraRisultati();
apri1();
const cod2 = foglio('Società').d.slice(1).filter(r => r[0] && r[1]).map(r => r[1]);
const ctx2 = getInfo().ctx;
[['Primo', 'Secondo'], ['Primo', 'Secondo'], ['Primo', 'Secondo'], ['Primo', 'Terzo']]
  .forEach((s, k) => inviaVoto(cod2[k], s, ctx2));
chiudiVotazione(); calcola1(); aggiornaReport();
const rep2 = foglio('Verbale').d.map(r => r.map(x => String(x == null ? '' : x)));
const grad2 = rep2.slice(rep2.findIndex(r => r[0] === 'Pos.') + 1).filter(r => /^\d+$/.test(r[0]));
verifica(grad2.every(r => !/\((\d+ anni?|Ballottaggio|Sorteggio)\)$/.test(r[4])),
  'nessuna parentesi quando le preferenze sono tutte diverse');
verifica(!rep2.some(r => /stesse preferenze/.test(r[0])), 'e nessuna nota sul pari merito');

console.log(errori ? '\n' + errori + ' verifiche fallite.' : '\nTutte le verifiche superate.');
process.exit(errori ? 1 : 0);
