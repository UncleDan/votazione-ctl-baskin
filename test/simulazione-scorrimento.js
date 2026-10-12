/*
 * Ordine di scorrimento in caso di dimissioni: prima allenatori e "Altro",
 * anche con un solo voto; un aiuto allenatore solo se non ne restano, e
 * comunque entro il limite in commissione. Oltre quel limite serve la deroga
 * della Commissione Tecnica Nazionale, oppure si torna al voto.
 * Uso: node test/simulazione-scorrimento.js      (VERBOSE=1 per vedere gli avvisi)
 * Copyright (c) 2026 Daniele Lolli (UncleDan) — Licenza MIT
 */
global.VERBOSE = !!process.env.VERBOSE;
const path = require('path'), fs = require('fs');
const M = require('./mock-apps-script.js');
eval(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'));

let errori = 0;
const verifica = (cond, testo) => { console.log((cond ? '  ✔ ' : '  ✘ ') + testo); if (!cond) errori++; };
const foglio = n => M.SS.getSheetByName(n);

// 6 candidati per 3 posti: 4 allenatori e 2 aiuti, deroga di 1 aiuto
setup();
setCfg_('Interfaccia di voto', 'Semplice');
setCfg_('Numero eletti', 3);
setCfg_('Max aiuti allenatore', 1);
const N = 6;
foglio('Squadre').getRange(2, 1, N, 2).setValues(
  Array.from({ length: N }, (_, i) => ['Sq' + (i + 1), 'Soc' + (i + 1)]));
foglio('Candidati').getRange(2, 1, N, 4).setValues([
  ['All Primo', 'Allenatore', 'Sq1', 6],
  ['All Secondo', 'Allenatore', 'Sq2', 5],
  ['All Terzo', 'Allenatore', 'Sq3', 4],
  ['All Riserva', 'Allenatore', 'Sq4', 3],
  ['Aiuto Uno', 'Aiuto allenatore', 'Sq5', 2],
  ['Aiuto Due', 'Aiuto allenatore', 'Sq6', 1]
]);
generaCodici();
apri1();
const cod = foglio('Società').d.slice(1).filter(r => r[0] && r[1]).map(r => r[1]);
const ctx = getInfo().ctx;
[['All Primo', 'All Secondo'], ['All Primo', 'All Secondo'], ['All Primo', 'All Terzo'],
 ['All Secondo', 'All Terzo'], ['All Terzo', 'Aiuto Uno'], ['All Riserva', 'Aiuto Due']]
  .forEach((s, i) => inviaVoto(cod[i], s, ctx));
chiudiVotazione();
calcola1();
aggiornaReport();

const rep = foglio('Verbale').d.map(r => r.map(x => String(x == null ? '' : x)));
const grad = rep.slice(rep.findIndex(r => r[0] === 'Pos.') + 1).filter(r => /^\d+$/.test(r[0]));
const posizione = nome => grad.find(r => r[1] === nome) || [];

console.log('=== Graduatoria');
verifica(grad.length === N, 'tutti i ' + grad.length + ' candidati in graduatoria');
verifica(grad.slice(0, 3).every(r => /Commissario/.test(r[4])), 'i primi tre sono i commissari eletti');
verifica(posizione('All Riserva')[4].indexOf('subentra per primo') > 0,
  'l\'allenatore non eletto subentra per primo: "' + posizione('All Riserva')[4] + '"');
verifica(Number(posizione('All Riserva')[0]) < Number(posizione('Aiuto Uno')[0]),
  'e sta sopra agli aiuto allenatore, anche a pari voti');

console.log('\n=== Il limite di aiuti in commissione');
verifica(/non restano allenatori/.test(posizione('Aiuto Uno')[4]),
  'il primo aiuto puo subentrare, ma solo se non restano allenatori');
verifica(/oltre il limite/.test(posizione('Aiuto Due')[4]) && /deroga della CTN/.test(posizione('Aiuto Due')[4]),
  'il secondo e oltre il limite: "' + posizione('Aiuto Due')[4] + '"');

console.log('\n=== Il conto a verbale');
const conto = rep.find(r => /Sostituzioni possibili senza deroga/.test(r[0]));
verifica(!!conto, 'il Report dice quante sostituzioni reggono senza deroga');
verifica(/senza deroga: 2\b/.test(conto[0]), 'e sono 2: "' + String(conto[0]).split('.')[0] + '"');
verifica(/Commissione Tecnica Nazionale \(CTN\)/.test(conto[0]) && /si torna al voto/.test(conto[0]),
  'con l\'alternativa se finiscono: deroga della CTN oppure nuovo voto');

console.log(errori ? '\n' + errori + ' verifiche fallite.' : '\nTutte le verifiche superate.');
process.exit(errori ? 1 : 0);
