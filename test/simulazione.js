/*
 * Simulazione completa: 11 società, 16 squadre, parità risolta con due
 * ballottaggi al round 1, parità sul Presidente risolta con un ballottaggio,
 * e un caso di parità irrisolta dopo 3 ballottaggi.
 * Uso: node test/simulazione.js      (VERBOSE=1 per vedere gli avvisi)
 * Copyright (c) 2026 Daniele Lolli (UncleDan) — Licenza MIT
 */
global.VERBOSE = !!process.env.VERBOSE;
const path = require('path'), fs = require('fs');
const M = require('./mock-apps-script.js');
eval(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'));

let errori = 0;
const verifica = (cond, testo) => { console.log((cond ? '  ✔ ' : '  ✘ ') + testo); if (!cond) errori++; };
const foglio = n => M.SS.getSheetByName(n);
const stampa = (n, max) => { console.log('\n--- Foglio "' + n + '"'); foglio(n).d.slice(0, max || 99).forEach(r => { if (r.some(x => x !== '')) console.log('  ' + r.filter((x, i) => x !== '' || i < 2).join(' | ')); }); };
const esito = (sh, nome) => { const h = foglio(sh).d[0]; const r = foglio(sh).d.find(x => x[1] === nome); return r[h.indexOf('Esito')]; };
const codici = (sh, col) => foglio(sh).d.slice(1).filter(r => r[0] && r[col]).map(r => r[col]);

/** Genera schede che producono esattamente i conteggi voluti (max preferenze per scheda). */
function schedePer(conteggi, nSchede, max) {
  const schede = Array.from({ length: nSchede }, () => []);
  Object.keys(conteggi).sort((a, b) => conteggi[b] - conteggi[a]).forEach(nome => {
    schede.slice().sort((a, b) => a.length - b.length).slice(0, conteggi[nome]).forEach(s => {
      if (s.length >= max) throw new Error('capienza insufficiente'); s.push(nome);
    });
  });
  return schede;
}
function vota(listaCodici, schede, ctx) {
  listaCodici.forEach((c, i) => { const r = inviaVoto(c, schede[i] || [], ctx); if (!r.ok) throw new Error(r.err); });
}

// ---------------- Preparazione ----------------
setup();
setCfg_('Interfaccia di voto', 'Semplice');   // questa simulazione prova la porta "app Google"
setCfg_('Sezione Territoriale', 'Emilia-Romagna');
setCfg_('Anno sportivo', '2026/2027');
const squadre = [];
for (let s = 1; s <= 11; s++) {
  const nSq = s <= 3 ? 2 : (s === 4 ? 3 : 1);            // 3 società con 2 squadre, 1 con 3, 7 con 1 → 16 squadre
  for (let k = 1; k <= nSq; k++) squadre.push(['Squadra ' + String(squadre.length + 1).padStart(2, '0'), 'Società ' + String(s).padStart(2, '0')]);
}
foglio('Squadre').getRange(2, 1, squadre.length, 2).setValues(squadre);
const cand = [ // nome, qualifica, squadra, anni
  ['Candidato A', 'Allenatore', 'Squadra 01', 4], ['Candidato B', 'Allenatore', 'Squadra 03', 4],
  ['Candidato C', 'Autocandidatura', 'Squadra 05', 5], ['Candidato D', 'Allenatore', 'Squadra 07', 2],
  ['Candidato E', 'Allenatore', 'Squadra 09', 3], ['Candidato F', 'Autocandidatura', 'Squadra 10', 3],
  ['Candidato G', 'Allenatore', 'Squadra 12', 3], ['Candidato H', 'Allenatore', 'Squadra 14', 1],
  ['Candidato I', 'Aiuto allenatore', 'Squadra 15', 6], ['Candidato L', 'Aiuto allenatore', 'Squadra 16', 1]
];
foglio('Candidati').getRange(2, 1, cand.length, 4).setValues(cand);
setCfg_('Formatore di riferimento', 'Candidato C');
generaCodici();

console.log('\n=== Domanda: 16 squadre di 11 società');
verifica(numSocieta_() === 11, 'società aventi diritto al voto: ' + numSocieta_() + ' (una scheda ciascuna, non 16)');
verifica(posti_(cfg_()) === 6, 'commissari da eleggere: ' + posti_(cfg_()) + ' (metà di 11 per eccesso = 6, massimo 6)');
verifica(maxPref_(cfg_(), cand.length) === 5, 'preferenze per scheda: ' + maxPref_(cfg_(), cand.length) + ' (metà di 10 candidati)');

// ---------------- Round 1 ----------------
console.log('\n=== Round 1 – Commissari CTL');
apri1();
const codSoc = codici('Società', 1);
vota(codSoc, schedePer({ 'Candidato I': 9, 'Candidato A': 8, 'Candidato B': 7, 'Candidato C': 6, 'Candidato D': 6,
  'Candidato E': 4, 'Candidato F': 4, 'Candidato G': 4, 'Candidato H': 2, 'Candidato L': 1 }, 11, 5), getInfo().ctx);
verifica(inviaVoto(codSoc[0], [], getInfo().ctx).ok === false, 'secondo voto con lo stesso codice rifiutato');
chiudiVotazione();
calcola1();
stampa('Risultati', 11);
verifica(esito('Risultati', 'Candidato I') === 'Non eletto', 'aiuto allenatore più votato escluso: allenatori/autocandidature sufficienti');
verifica(/anni/.test(foglio('Risultati').d.find(r => r[1] === 'Candidato C')[7]), 'C e D pari preferenze: precede C per anni');
verifica(['Candidato E', 'Candidato F', 'Candidato G'].every(n => /PARIT/.test(esito('Risultati', n))), 'E, F, G pari preferenze e pari anni per 2 posti → ballottaggio');

// ---------------- Ballottaggio 1 ----------------
console.log('\n=== Ballottaggio 1: 2 posti tra E, F, G — tutte le società, fino a 2 preferenze');
preparaBallottaggio();
const codBal1 = codici('Ballottaggio', 1);
verifica(codBal1.length === 11 && codBal1.every(k => codSoc.indexOf(k) < 0), '11 nuovi codici/link, diversi da quelli del round 1');
apriBallottaggio();
verifica(verificaCodice(codSoc[0]).ok === false, 'il vecchio link della società non vale per il ballottaggio');
verifica(getInfo().max === 2 && getInfo().candidati.length === 3, 'scheda di ballottaggio: 3 nomi, max 2 preferenze');
vota(codBal1, schedePer({ 'Candidato E': 8, 'Candidato F': 6, 'Candidato G': 6 }, 11, 2), getInfo().ctx);
chiudiVotazione();
calcolaBallottaggio();
verifica(esito('Risultati', 'Candidato E') === 'ELETTO', 'E eletto al ballottaggio 1');
verifica(/PARIT/.test(esito('Risultati', 'Candidato F')) && /PARIT/.test(esito('Risultati', 'Candidato G')), 'F e G ancora pari per 1 posto → ballottaggio 2');

// ---------------- Ballottaggio 2 ----------------
console.log('\n=== Ballottaggio 2: 1 posto tra F e G — nuovi link');
preparaBallottaggio();
const codBal2 = codici('Ballottaggio', 1);
verifica(codBal2.every(k => codBal1.indexOf(k) < 0), 'nuovi link, diversi da quelli del ballottaggio 1');
apriBallottaggio();
verifica(getInfo().max === 1, 'scheda di ballottaggio 2: max 1 preferenza');
vota(codBal2, schedePer({ 'Candidato F': 6, 'Candidato G': 5 }, 11, 1), getInfo().ctx);
chiudiVotazione();
calcolaBallottaggio();
stampa('Risultati', 11);
verifica(esito('Risultati', 'Candidato F') === 'ELETTO' && esito('Risultati', 'Candidato G') === 'Non eletto', 'F eletto al ballottaggio 2, G non eletto');
stampa('Risultati ballottaggi');

// ---------------- Round 2 con parità ----------------
console.log('\n=== Round 2 – Presidente (parità A–B, pari anni)');
preparaCommissari();
const codCom = codici('Commissari', 3);
verifica(codCom.length === 6, '6 commissari con link personale');
apri2();
vota(codCom, [['Candidato A'], ['Candidato A'], ['Candidato A'], ['Candidato B'], ['Candidato B'], ['Candidato B']], getInfo().ctx);
chiudiVotazione();
calcola2();
verifica(cfg_()['Presidente'] === '', 'A e B 3–3 con pari anni: Presidente non assegnato');
preparaBallottaggio();
apriBallottaggio();
vota(codici('Ballottaggio', 1), [['Candidato A'], ['Candidato A'], ['Candidato A'], ['Candidato A'], ['Candidato B'], []], getInfo().ctx);
chiudiVotazione();
calcolaBallottaggio();
verifica(cfg_()['Presidente'] === 'Candidato A', 'Presidente eletto al ballottaggio: ' + cfg_()['Presidente']);

// ---------------- Round 3 ----------------
console.log('\n=== Round 3 – Vice');
apri3();
verifica(getInfo().candidati.every(x => x.nome !== 'Candidato A'), 'il Presidente non è tra i candidati Vice');
vota(codCom, [['Candidato B'], ['Candidato B'], ['Candidato E'], ['Candidato B'], ['Candidato C'], ['Candidato F']], getInfo().ctx);
chiudiVotazione();
calcola3();
verifica(cfg_()['Vice'] === 'Candidato B', 'Vice: ' + cfg_()['Vice']);
stampa('Report');
const urna = foglio('Riepilogo urna').d.map(r => r.join(' '));
verifica(urna.filter(r => /Controllo OK/.test(r)).length === 6 && !urna.some(r => /ANOMALIA/.test(r)),
  'riepilogo urna: 6 urne (3 round + 3 ballottaggi) tutte coerenti');

// ---------------- Parità irrisolta ----------------
console.log('\n=== Caso limite: parità sul Vice (E–F, pari anni) che resta dopo 3 ballottaggi');
M.UI.promptAnswer = '3'; azzeraRound();
apri3();
vota(codCom, [['Candidato F'], ['Candidato F'], ['Candidato E'], ['Candidato E'], [], []], getInfo().ctx);
chiudiVotazione(); calcola3();
for (let b = 1; b <= 3; b++) {
  preparaBallottaggio(); apriBallottaggio();
  vota(codici('Ballottaggio', 1), [['Candidato F'], ['Candidato E'], ['Candidato F'], ['Candidato E'], [], []], getInfo().ctx);
  chiudiVotazione(); calcolaBallottaggio();
}
verifica(balState_(3).stato === 'irrisolto' && cfg_()['Vice'] === '', 'dopo 3 ballottaggi: parità da risolvere manualmente');
preparaBallottaggio();
verifica(/manualmente/.test(M.alerts[M.alerts.length - 1]), 'un quarto ballottaggio non è consentito');

console.log('\n=== Logo');
['Report', 'Riepilogo urna', 'Risultati ballottaggi'].forEach(n =>
  verifica(/^=IMAGE\("https:\/\/eisi\.it\/.*\.png", 1\)$/.test(foglio(n).d[0][0]), 'logo in testa al foglio "' + n + '"'));
['Risultati', 'Risultati Presidente', 'Risultati Vice'].forEach(n =>
  verifica(foglio(n).d.some(r => /^=IMAGE\(/.test(r[0])), 'logo nel piede del foglio "' + n + '"'));
verifica(foglio('Report').d.some(r => /Ente Italiano Sport Inclusivi/.test(r[0])), 'nota di proprietà del logo nei resoconti');

console.log('\n' + (errori ? errori + ' verifiche FALLITE' : 'Tutte le verifiche superate.'));
process.exit(errori ? 1 : 0);
