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
verifica(cand.length === 11, 'candidati: ' + cand.length);
verifica(cand.filter(x => x.aiuto).length === 3, 'di cui aiuto allenatore: ' + cand.filter(x => x.aiuto).length);
const conCand = new Set(cand.map(x => mappaSquadraSocieta_()[x.squadra]).filter(Boolean));  // l'autocandidato non ha società
verifica(11 - conCand.size === 1, 'società senza candidati: ' + (11 - conCand.size));
verifica(societaDoppie_().length === 0, 'nessuna società con più di un candidato');
verifica(posti_(cfg_()) === 6, 'commissari da eleggere: ' + posti_(cfg_()));
verifica(maxPref_(cfg_(), cand.length) === 6, 'preferenze per scheda: ' + maxPref_(cfg_(), cand.length));
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
  ['Candidato X', 'Autocandidatura', 'Topolinia 2', 2, '']  // con squadra: la squadra resta
]);
setup();
const c3 = candidati_();
const y = c3.filter(x => x.nome === 'Candidato Y')[0];
const x = c3.filter(x2 => x2.nome === 'Candidato X')[0];
verifica(y.qualifica === 'Altro' && y.squadra === 'Autocandidatura',
  'senza squadra: qualifica "Altro" e autocandidatura al posto della squadra');
verifica(x.qualifica === 'Altro' && x.squadra === 'Topolinia 2',
  'con squadra: la squadra resta, cambia solo la qualifica');
verifica(c3.filter(k => /autocand/i.test(k.qualifica)).length === 0,
  'nessuna qualifica "Autocandidatura" rimasta');

// ---------------- Una società, un solo candidato ----------------
console.log('\n=== Regola: ogni società può presentare un solo candidato');
// "Candidato X" e appena finito sulla squadra "Topolinia 2": la societa ne ha due
const doppie = societaDoppie_();
verifica(doppie.length === 1 && /Topolinia/.test(doppie[0]), 'la societa con due candidati viene segnalata: ' + doppie[0]);
verifica(/Topolino/.test(doppie[0]) && /Candidato X/.test(doppie[0]), 'con i nomi di entrambi');
M.alerts.length = 0;
apri1();
verifica(String(cfg_()['Stato']).toUpperCase() !== 'APERTA', 'il round 1 non si apre finche restano');
verifica(M.alerts.some(a => /un solo candidato/.test(JSON.stringify(a))), 'e viene detto perche');
// l'autocandidato invece non conta: "Candidato Y" resta senza squadra
sh.getRange(17, 1, 1, 5).setValues([['', '', '', '', '']]);   // ritira "Candidato X"
verifica(societaDoppie_().length === 0, 'ritirato il candidato in eccesso, la segnalazione cade');

// ---------------- Avviso di apertura per email ----------------
console.log('\n=== All\'apertura parte la mail alle societa che hanno un indirizzo');
const shS = foglio('Società');
const nSoc = shS.d.slice(1).filter(r => r[0]).length;
shS.d.slice(1).forEach((r, i) => { if (r[0]) shS.getRange(i + 2, 6).setValue('societa' + (i + 1) + '@esempio-valido.it'); });
setCfg_('Chiusura voto commissari', new Date(Date.now() + 36e5));
M.email.length = 0;
apri1();
verifica(String(cfg_()['Stato']).toUpperCase() === 'APERTA', 'ora il round 1 si apre');
verifica(M.email.length === nSoc, 'una mail per societa: ' + M.email.length + ' su ' + nSoc);
verifica(M.email.every(e => /si vota da adesso/i.test(e.subject)), 'oggetto: "' + (M.email[0] || {}).subject + '"');
verifica(mittente_(cfg_()) === 'Sezione Territoriale Baskin EISI Sezione di prova',
  'mittente predefinito: "' + mittente_(cfg_()) + '"');
setCfg_('Mittente email', 'Baskin Emilia-Romagna');
verifica(mittente_(cfg_()) === 'Baskin Emilia-Romagna', 'e si puo cambiare da Config');
setCfg_('Mittente email', '');
verifica(M.email.every(e => /si chiude il /.test(e.body)), 'e il testo dice quando si chiude');
verifica(M.email.every(e => /inoltr/i.test(e.body)), 'e che il messaggio si puo inoltrare a un\'altra persona della societa');
M.email.length = 0;
chiudiVotazione();
apri1();
verifica(M.email.length === 0, 'riaprendo non si ripete l\'avviso: parte una volta per round');

// ---------------- Piu indirizzi nella stessa cella ----------------
console.log('\n=== Una societa puo avere piu indirizzi, separati da virgola');
const v1 = vaglia_('uno@esempio-valido.it, due@esempio-valido.it ; tre@esempio-valido.it');
verifica(v1.buoni.length === 3, 'virgola e punto e virgola dividono: ' + v1.buoni.join(' | '));
const v2 = vaglia_('buono@esempio-valido.it, non-un-indirizzo, prova@example.invalid');
verifica(v2.buoni.length === 1 && v2.sbagliati.length === 1 && v2.finti.length === 1,
  'buoni, sbagliati e di prova vengono separati');
verifica(/^=HYPERLINK\("mailto:uno@esempio-valido\.it,due@esempio-valido\.it/.test(
  mailtoFormula_('uno@esempio-valido.it, due@esempio-valido.it', 'Oggetto', 'Testo')),
  'il mailto elenca tutti i destinatari');
verifica(mailtoFormula_('non-un-indirizzo', 'Oggetto', 'Testo') === '',
  'senza nemmeno un indirizzo scrivibile non si scrive il link');
verifica(/^=HYPERLINK\("mailto:prova@example\.invalid/.test(mailtoFormula_('prova@example.invalid', 'O', 'T')),
  'ma un dominio di prova il link ce l\'ha: apre la mail, non la manda');
// e l'invio arriva a entrambi
shS.getRange(2, 6).setValue('primo@esempio-valido.it, secondo@esempio-valido.it');
M.email.length = 0;
azzeraRound();
apri1();
const multi = M.email.filter(e => /primo@esempio-valido\.it,secondo@esempio-valido\.it/.test(e.to));
verifica(multi.length === 1, 'una sola mail, indirizzata a tutti e due i referenti');
verifica(M.email.length === nSoc, 'e le altre societa ne ricevono sempre una a testa');

console.log(errori ? '\n' + errori + ' verifiche fallite.' : '\nTutte le verifiche superate.');
process.exit(errori ? 1 : 0);
