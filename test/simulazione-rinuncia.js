/*
 * Rinuncia di un candidato dichiarata a votazione gia aperta: resta sulla
 * scheda, i suoi voti si contano, ma il posto scorre al successivo.
 * Uso: node test/simulazione-rinuncia.js      (VERBOSE=1 per vedere gli avvisi)
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
const esito = nome => { const d = foglio('Risultati').d; const h = d[0]; const r = d.find(x => x[1] === nome); return r ? r[h.indexOf('Esito')] : '(assente)'; };
const voti = nome => { const d = foglio('Risultati').d; const h = d[0]; const r = d.find(x => x[1] === nome); return r ? Number(r[h.indexOf('Preferenze')]) : -1; };

// ---------------- Preparazione: 7 societa, 7 candidati, 4 posti ----------------
setup();
setCfg_('Interfaccia di voto', 'Semplice');
setCfg_('Sezione Territoriale', 'Emilia-Romagna');
setCfg_('Numero eletti', 4);
const N = 7;
foglio('Squadre').getRange(2, 1, N, 2).setValues(
  Array.from({ length: N }, (_, i) => ['Squadra ' + (i + 1), 'Società ' + (i + 1)]));
foglio('Candidati').getRange(2, 1, N, 4).setValues(
  Array.from({ length: N }, (_, i) => ['Candidato ' + 'ABCDEFG'[i], 'Allenatore', 'Squadra ' + (i + 1), N - i]));
generaCodici();
const cod = codici();
verifica(cod.length === N, N + ' società con codice');

// ---------------- Si vota, poi arriva la rinuncia ----------------
console.log('\n=== Si vota: A primo, B secondo, C terzo, D quarto, E quinto');
apri1();
const ctx = getInfo().ctx;
const schede = [
  ['Candidato A', 'Candidato B', 'Candidato C'],
  ['Candidato A', 'Candidato B', 'Candidato D'],
  ['Candidato A', 'Candidato C', 'Candidato D'],
  ['Candidato A', 'Candidato B', 'Candidato E'],
  ['Candidato B', 'Candidato C', 'Candidato D'],
  ['Candidato C', 'Candidato E', 'Candidato F'],
  ['Candidato D', 'Candidato E', 'Candidato G']
];
cod.forEach((k, i) => { const r = inviaVoto(k, schede[i], ctx); if (!r.ok) throw new Error(r.err); });
verifica(schede_(1, 0).length === N, 'urna: ' + schede_(1, 0).length + ' schede');

// la rinuncia si registra a votazione ancora aperta, senza toccare la scheda
const shC = sheet_('Candidati');
const colRin = headers_(shC).rinuncia;
verifica(colRin > 0, 'il foglio Candidati ha la colonna "Rinuncia" (colonna ' + colRin + ')');
const primaDellaRinuncia = getInfo().candidati.length;
shC.getRange(2, colRin).setValue(true);          // Candidato A rinuncia
verifica(getInfo().candidati.length === primaDellaRinuncia,
  'la scheda non cambia: i candidati restano ' + getInfo().candidati.length);
verifica(getInfo().candidati.some(k => k.nome === 'Candidato A'),
  'e chi rinuncia resta votabile, perche qualcuno lo ha gia votato');

chiudiVotazione();
calcola1();

console.log('\n=== Spoglio');
verifica(esito('Candidato A') === 'RINUNCIA', 'Candidato A: ' + esito('Candidato A'));
verifica(voti('Candidato A') === 4, 'ma i suoi ' + voti('Candidato A') + ' voti restano contati');
const eletti = foglio('Risultati').d.slice(1).filter(r => String(r[6]) === 'ELETTO').map(r => r[1]);
verifica(eletti.length === 4, 'eletti: ' + eletti.length + ' (' + eletti.join(', ') + ')');
verifica(eletti.indexOf('Candidato A') < 0, 'fra gli eletti non c\'e chi ha rinunciato');
verifica(eletti.indexOf('Candidato E') >= 0, 'e il posto e scorso al successivo (Candidato E)');
verifica(/scorre al candidato successivo/.test(String(foglio('Risultati').d.find(r => r[1] === 'Candidato A')[7])),
  'la nota spiega cosa e successo');

// ---------------- La graduatoria va a verbale ----------------
console.log('\n=== Graduatoria finale nel Report');
aggiornaReport();
const rep = foglio('Verbale').d.map(r => r.map(x => String(x == null ? '' : x)));
const iG = rep.findIndex(r => /Graduatoria finale/.test(r[0]));
verifica(iG > 0, 'il Report ha la sezione "Graduatoria finale"');
const iT = rep.findIndex(r => r[0] === 'Pos.');
const grad = rep.slice(iT + 1).filter(r => /^\d+$/.test(r[0]));
verifica(grad.length === N, 'elenca tutti i ' + grad.length + ' candidati');
verifica(grad[grad.length - 1][1] === 'Candidato A', 'chi ha rinunciato e in fondo: ' + grad[grad.length - 1][1]);
verifica(/Rinuncia/.test(grad[grad.length - 1][4]), 'con la sua posizione: "' + grad[grad.length - 1][4] + '"');
verifica(grad.slice(0, 4).every(r => /Commissario/.test(r[4])), 'i primi quattro sono i commissari');
verifica(/subentra per primo/.test(grad[4][4]), 'il quinto e il primo per lo scorrimento: "' + grad[4][4] + '"');
verifica(rep.some(r => /dimissioni di un commissario subentra il primo dei non eletti/.test(r[0])),
  'e la regola dello scorrimento e scritta a verbale');
verifica(rep.some(r => /non accetterebbero l'incarico/.test(r[0]) && /Candidato A/.test(r[0])),
  'la rinuncia e verbalizzata con il nome');

// ---- l'ordine: eletti per voti, poi le riserve nell'ordine di ripescaggio ----
console.log('\n=== Ordine della graduatoria');
const vociEl = grad.filter(r => /Commissario/.test(r[4])).map(r => Number(r[3]));
verifica(vociEl.every((v, k) => k === 0 || v <= vociEl[k - 1]),
  'gli eletti sono in ordine di preferenze decrescenti: ' + vociEl.join(' ≥ '));
const iPrimaRiserva = grad.findIndex(r => /dei non eletti/.test(r[4]));
verifica(iPrimaRiserva === vociEl.length, 'le riserve vengono dopo tutti gli eletti');
verifica(grad.findIndex(r => /Rinuncia/.test(r[4])) > iPrimaRiserva, 'e le rinunce dopo le riserve');

// due rinunce: fra loro in ordine alfabetico
sheet_('Candidati').getRange(4, colRin).setValue(true);     // Candidato C rinuncia
aggiornaReport();
const rep2 = foglio('Verbale').d.map(r => r.map(x => String(x == null ? '' : x)));
const grad2 = rep2.slice(rep2.findIndex(r => r[0] === 'Pos.') + 1).filter(r => /^\d+$/.test(r[0]));
const coda = grad2.slice(-2).map(r => r[1]);
verifica(coda[0] === 'Candidato A' && coda[1] === 'Candidato C',
  'due rinunce vanno in coda in ordine alfabetico: ' + coda.join(', '));
sheet_('Candidati').getRange(4, colRin).setValue(false);
calcola1();

// ---------------- I commissari: chi rinuncia non entra ----------------
console.log('\n=== Prepara commissari');
preparaCommissari();
const com = commissari_().map(x => x.nome);
verifica(com.length === 4 && com.indexOf('Candidato A') < 0,
  'il foglio Commissari ha i 4 eletti, senza chi ha rinunciato: ' + com.join(', '));
verifica(foglio('Commissari').d[0][8] === 'Rinuncia alla carica',
  'e ha una colonna "Rinuncia alla carica", distinta da quella dei Candidati');

// ---------------- Rinuncia alla carica di Presidente ----------------
console.log('\n=== Presidente: il piu votato rinuncia alla carica');
const shCom = foglio('Commissari');
shCom.getRange(2, 9).setValue(true);              // il primo commissario rinuncia
const primo = commissari_()[0].nome;
apri2();
const ctx2 = getInfo().ctx;
commissari_().forEach((x, i) => inviaVoto(x.codice, [primo], ctx2));   // tutti votano lui
chiudiVotazione();
calcola2();
verifica(String(cfg_()['Presidente']) !== primo,
  'chi ha rinunciato non diventa Presidente anche se e il piu votato');
verifica(!String(cfg_()['Presidente']), 'e senza altri voti la carica resta da assegnare');

// ---------------- Il foglio Commissari si riscrive, le spunte no ----------------
console.log('\n=== Riprepara i commissari: la rinuncia alla carica non si perde');
preparaCommissari();
verifica(commissari_().filter(x => x.rinuncia).map(x => x.nome).join() === primo,
  'la spunta "Rinuncia alla carica" resta su ' + primo + ' anche dopo aver rigenerato il foglio');
verifica(commissari_().length === 4, 'e i commissari restano 4');

console.log('\n=== Rinuncia all\'incarico spuntata ma risultati non ricalcolati');
sheet_('Candidati').getRange(3, colRin).setValue(true);     // Candidato B rinuncia adesso
M.alerts.length = 0;
const bloccato = preparaCommissari();
verifica(bloccato === false, 'preparaCommissari si ferma invece di ignorare la rinuncia');
verifica(/Calcola risultati/.test(String(M.alerts[M.alerts.length - 1])),
  'e dice di ricalcolare prima i risultati: "' + String(M.alerts[M.alerts.length - 1]).split('\n')[0] + '"');
verifica(commissari_().map(x => x.nome).indexOf('Candidato B') >= 0,
  'il foglio Commissari resta com\'era: non lo tocca a meta');
calcola1();
preparaCommissari();
verifica(commissari_().map(x => x.nome).indexOf('Candidato B') < 0,
  'dopo il ricalcolo il posto scorre e Candidato B esce dalla Commissione');

console.log(errori ? '\n' + errori + ' verifiche fallite.' : '\nTutte le verifiche superate.');
process.exit(errori ? 1 : 0);
