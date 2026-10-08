/**
 * Votazione CTL Baskin — voto online anonimo, un voto per società
 * v9 — Google Apps Script legato a un Foglio Google
 *
 * Codice sorgente: https://github.com/UncleDan/votazione-ctl-baskin
 * Copyright (c) 2026 Daniele Lolli (UncleDan) — Licenza MIT (vedi LICENSE)
 * SPDX-License-Identifier: MIT
 *
 * Il logo EISI è di proprietà di Ente Italiano Sport Inclusivi: non è coperto
 * dalla licenza MIT e viene caricato in hotlinking dal sito eisi.it (vedi NOTICE).
 *
 * Round 1: le società eleggono i commissari CTL (qualifiche, deroga aiuto
 *          allenatore, commissari = metà delle società, min 3, max 6).
 * Round 2: i commissari eletti eleggono il Presidente (maggioranza semplice).
 * Round 3: i commissari eleggono il Vice tra i rimanenti.
 * Ballottaggio: una parità non risolvibile (pari preferenze e pari anni)
 *          sui posti in palio si risolve con fino a 3 ballottaggi a voto
 *          multiplo tra i soli candidati a pari merito, ciascuno con nuovi link.
 * Pianificazione: il voto commissari può aprirsi e chiudersi da solo a data e
 *          ora prefissate; alla chiusura i risultati vengono calcolati, i
 *          commissari eletti ricevono codice e link e si apre il voto per il
 *          Presidente, chiuso a sua volta a tempo con calcolo finale.
 * Formatore di riferimento: indicato senza votazione (Config).
 * Report, Riepilogo urna per il custode, link al codice sorgente.
 *
 * Anonimato: le schede sono salvate nelle Script Properties (non nel foglio,
 * quindi senza cronologia versioni), senza codice né orario, e inserite in
 * posizione casuale. Dei codici usati si conserva solo un hash con sale.
 */

const SH = {
  CONFIG: 'Config', SOC: 'Società', SQ: 'Squadre', CAND: 'Candidati', RIS: 'Risultati',
  COM: 'Commissari', BAL: 'Ballottaggio', RB: 'Risultati ballottaggi',
  RP: 'Risultati Presidente', RV: 'Risultati Vice', REP: 'Report', URNA: 'Riepilogo urna',
  MSG: 'Messaggi'
};
const REPO_URL = 'https://github.com/UncleDan/votazione-ctl-baskin';
const VERSIONE = 'v20';
const LOGO_SVG = 'https://eisi.it/wp-content/uploads/2026/09/logo-eisi-epp-cip.svg';
const LOGO_PNG = 'https://eisi.it/wp-content/uploads/2026/09/logo-eisi-epp-cip.png';
const PROPRIETA_LOGO = 'Logo © Ente Italiano Sport Inclusivi (EISI), tutti i diritti riservati';
const P_SALT = 'SALT';
const MAX_BALLOTTAGGI = 3;
const ROUND = {
  1: { nome: 'Commissari CTL', ballots: 'BALLOTS', used: 'USED', ric: 'RIC', prefisso: 'Stai votando per la società: ' },
  2: { nome: 'Presidente CTL', ballots: 'BALLOTS_2', used: 'USED_2', ric: 'RIC_2', ris: SH.RP, col: 'Votato Presidente', cfg: 'Presidente', prefisso: 'Stai votando come: ' },
  3: { nome: 'Vice CTL', ballots: 'BALLOTS_3', used: 'USED_3', ric: 'RIC_3', ris: SH.RV, col: 'Votato Vice', cfg: 'Vice', prefisso: 'Stai votando come: ' }
};
const SOC_HEADER = ['Società', 'Codice', 'Link diretto di voto', 'Ha votato', 'Nome breve'];
const SQ_HEADER = ['Squadra', 'Società'];
const CAND_HEADER = ['Candidato', 'Qualifica', 'Squadra', 'Anni tesseramento/incarichi (spareggio)', 'Note'];
const COM_HEADER = ['Commissario', 'Qualifica', 'Squadra', 'Codice', 'Link diretto di voto', 'Votato Presidente', 'Votato Vice'];
const BAL_HEADER = ['Votante', 'Codice ballottaggio', 'Link diretto di voto', 'Ha votato'];
const RIS_HEADER = ['Posizione', 'Candidato', 'Qualifica', 'Squadra', 'Preferenze', 'Anni (spareggio)', 'Esito', 'Note'];
const MSG_HEADER = ['Destinatario', 'Codice', 'Messaggio da copiare e incollare'];
const LETTERE = 'ABCDEFGH';      // codici: 4 lettere A–H
const CIFRE = '0123456789';      // + 4 cifre, nel formato XXXX-9999
const FUSO = 'Europe/Rome';
const TRIGGER_FN = ['triggerApreCommissari', 'triggerChiudeCommissari', 'triggerAprePresidente', 'triggerChiudePresidente', 'triggerChiudeBallottaggio'];
const LOG_ = [];                 // messaggi raccolti quando si lavora senza interfaccia (trigger)
const QUALIFICHE = ['Allenatore', 'Aiuto allenatore', 'Altro'];
// L'autocandidatura non e una qualifica ma un modo di arrivare in lista: si indica
// al posto della squadra, per chi si candida da se e non e tesserato con un club.
const AUTOCAND = 'Autocandidatura';
const BLU = '#e8eaf6';
const INTERFACCE = ['Semplice', 'HTML'];   // una sola attiva per votazione
const CFG_INTERFACCIA = 'Interfaccia di voto';
const CFG_URL_HTML = 'Indirizzo interfaccia HTML';

/* ================= Menu ================= */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🗳️ Votazione')
    .addItem('Inizializza / aggiorna fogli', 'setup')
    .addSubMenu(ui.createMenu('Round 1 – Commissari CTL')
      .addItem('Genera codici e link mancanti', 'generaCodici')
      .addItem('Rigenera TUTTI i codici e link società…', 'rigeneraCodiciSocieta')
      .addItem('Apri', 'apri1')
      .addItem('Chiudi', 'chiudiVotazione')
      .addItem('Calcola risultati', 'calcola1'))
    .addSubMenu(ui.createMenu('Round 2 – Presidente')
      .addItem('Prepara commissari e link', 'preparaCommissari')
      .addItem('Rigenera codici e link commissari…', 'rigeneraCodiciCommissari')
      .addItem('Apri', 'apri2')
      .addItem('Chiudi', 'chiudiVotazione')
      .addItem('Calcola risultati', 'calcola2'))
    .addSubMenu(ui.createMenu('Round 3 – Vice')
      .addItem('Apri', 'apri3')
      .addItem('Chiudi', 'chiudiVotazione')
      .addItem('Calcola risultati', 'calcola3'))
    .addSubMenu(ui.createMenu('Ballottaggio (parità)')
      .addItem('Prepara ballottaggio e nuovi link', 'preparaBallottaggio')
      .addItem('Apri', 'apriBallottaggio')
      .addItem('Chiudi', 'chiudiVotazione')
      .addItem('Calcola ballottaggio', 'calcolaBallottaggio')
      .addItem('Sorteggia la parità residua…', 'sorteggiaParita'))
    .addSubMenu(ui.createMenu('Votazioni programmate')
      .addItem('Programma apertura e chiusura', 'programmaVotazioni')
      .addItem('Mostra pianificazione', 'mostraPianificazione')
      .addItem('Annulla pianificazione', 'annullaPianificazione'))
    .addItem('Prepara i messaggi per i votanti', 'preparaMessaggiMenu')
    .addSubMenu(ui.createMenu('Interfaccia di voto')
      .addItem('Usa la app Google (semplice)', 'usaInterfacciaSemplice')
      .addItem('Usa la pagina web (HTML)…', 'usaInterfacciaHtml')
      .addItem('Mostra interfaccia attiva e indirizzi', 'mostraInterfaccia'))
    .addSeparator()
    .addItem('Aggiorna partecipazione', 'aggiornaPartecipazione')
    .addItem('Aggiorna report', 'aggiornaReport')
    .addItem('Aggiorna riepilogo urna', 'aggiornaUrna')
    .addSubMenu(ui.createMenu('Azzeramenti')
      .addItem('Solo i risultati, stessi codici…', 'azzeraRisultati')
      .addItem('Un round solo…', 'azzeraRound')
      .addItem('Tutto, per una nuova elezione…', 'azzeraTutto')
      .addItem('Tutto e riempi con dati di prova…', 'inizializzaDatiProva'))
    .addToUi();
}

function apri1() { apriRound_(1); }
function apri2() { apriRound_(2); }
function apri3() { apriRound_(3); }
function calcola1() { calcolaRisultati_(false); }
function calcola2() { calcolaCarica_(2, false); }
function calcola3() { calcolaCarica_(3, false); }

/* ================= Interfaccia (anche senza interfaccia) ================= */

/**
 * Restituisce l'interfaccia del foglio quando c'è un utente davanti allo schermo.
 * Quando il codice gira da un trigger a tempo l'interfaccia non esiste: si usa
 * una finta UI che raccoglie i messaggi in LOG_ (finiscono nelle email di avviso)
 * e conferma automaticamente le domande sì/no.
 */
function ui_() {
  try {
    const u = SpreadsheetApp.getUi();
    u.ButtonSet.YES_NO;            // tocca l'oggetto: fuori dall'interfaccia solleva eccezione
    return u;
  } catch (e) {
    return {
      automatica: true,
      Button: { YES: 'YES', NO: 'NO', OK: 'OK', CANCEL: 'CANCEL' },
      ButtonSet: { OK: 'OK', YES_NO: 'YES_NO', OK_CANCEL: 'OK_CANCEL' },
      alert: function (a, b) { LOG_.push(String(b === undefined || b === 'OK' || b === 'YES_NO' || b === 'OK_CANCEL' ? a : a + ': ' + b)); return 'YES'; },
      prompt: function (a) { LOG_.push(String(a)); return { getSelectedButton: function () { return 'CANCEL'; }, getResponseText: function () { return ''; } }; }
    };
  }
}

/* ================= Setup e migrazioni ================= */

function setup() {
  const ss = SpreadsheetApp.getActive();
  const avvisi = [];

  // v1/v2: "Codici" → "Squadre" (formato v3–v6)
  const vecchio = ss.getSheetByName('Codici');
  if (vecchio && !ss.getSheetByName(SH.SQ)) {
    vecchio.setName(SH.SQ);
    vecchio.getRange('A1').setValue('Squadra');
  }
  // v3–v6: "Squadre" con i codici → "Società" (codici) + "Squadre" (squadra → società)
  const sqOld = ss.getSheetByName(SH.SQ);
  if (sqOld && !ss.getSheetByName(SH.SOC) && /^codice/i.test(String(sqOld.getRange(1, 2).getValue()))) {
    const n = sqOld.getLastRow() - 1;
    const rows = n > 0 ? sqOld.getRange(2, 1, n, 4).getValues().filter(r => String(r[0]).trim()) : [];
    const soc = ensureSheet_(ss, SH.SOC, SOC_HEADER);
    if (rows.length) soc.getRange(2, 1, rows.length, 4).setValues(rows);
    sqOld.clearContents();
    sqOld.getRange(1, 1, 1, 2).setValues([SQ_HEADER]).setFontWeight('bold').setBackground(BLU);
    if (rows.length) sqOld.getRange(2, 1, rows.length, 2).setValues(rows.map(r => [r[0], r[0]]));
    avvisi.push('Migrazione: ogni riga del vecchio foglio Squadre è diventata una società con il suo codice. ' +
      'Se più squadre appartengono alla stessa società, correggi la colonna Società in "Squadre" ed elimina le righe in eccesso in "Società".');
  }

  ensureSheet_(ss, SH.CONFIG, ['Parametro', 'Valore', 'Note']);
  cfgRename_('Sezione territoriale', 'Sezione Territoriale');
  [
    ['Titolo', 'Elezione CTL Baskin', 'Titolo della pagina di voto'],
    ['Sezione Territoriale', '', 'Es. Emilia-Romagna — compare sulla pagina di voto e nei report'],
    ['Anno sportivo', '', 'Testo libero, es. 2026/2027 — compare sulla pagina di voto e nei report'],
    ['Stato', 'CHIUSA', 'APERTA / CHIUSA — gestito dal menu'],
    ['Round attivo', 1, 'Gestito dal menu (1 commissari, 2 presidente, 3 vice)'],
    ['Ballottaggio', 0, 'Gestito dal menu (0 = nessuno, altrimenti numero del ballottaggio in corso)'],
    ['Max preferenze', '', 'Vuoto = metà dei candidati arrotondata per eccesso'],
    ['Numero eletti', '', 'Vuoto = regola CTL: metà delle società per eccesso, min 3, max 6'],
    ['Max aiuti allenatore', 1, 'Deroga: aiuti allenatore ammessi, solo se non bastano gli altri candidati'],
    ['Messaggio', 'Seleziona i candidati a cui dai la preferenza.', 'Testo sopra la scheda (round 1)'],
    ['Formatore di riferimento', '', 'Nome, senza votazione. Se vuole essere votante va inserito anche tra i Candidati, con "' + AUTOCAND + '" al posto della squadra'],
    ['Presidente', '', 'Compilato dal round 2; parità non risolte: scrivilo a mano'],
    ['Vice', '', 'Compilato dal round 3; parità non risolte: scrivilo a mano'],
    ['Apertura voto commissari', '', 'Data e ora (gg/mm/aaaa hh:mm). Vuoto = apertura manuale'],
    ['Chiusura voto commissari', '', 'Data e ora: alla chiusura calcola i risultati, prepara i commissari e apre il voto Presidente'],
    ['Apertura voto presidente', '', 'Vuoto = subito dopo la chiusura del voto commissari'],
    ['Chiusura voto presidente', '', 'Data e ora: alla chiusura calcola i risultati finali'],
    ['Durata ballottaggio (ore)', 24, 'Quanto resta aperto un ballottaggio aperto in automatico dopo una parità'],
    ['Proroga automatica (ore)', 24, 'Se alla chiusura programmata manca qualche voto, la votazione resta aperta ancora per queste ore'],
    ['Email avvisi', '', 'Dove inviare gli avvisi delle votazioni programmate. Vuoto = indirizzo del proprietario del foglio'],
    ['Logo pagina web', LOGO_SVG, 'URL del logo sulla pagina di voto (hotlinking, SVG o PNG). Vuoto = nessun logo'],
    ['Logo fogli (PNG)', LOGO_PNG, 'URL del logo nei resoconti: i fogli Google non mostrano SVG, serve PNG/JPG. Vuoto = nessun logo'],
    [CFG_INTERFACCIA, 'HTML', 'Da dove si vota: Semplice = app Google; HTML = pagina su GitHub Pages. Una sola per votazione, gestita dal menu'],
    [CFG_URL_HTML, '', 'Indirizzo della pagina su GitHub Pages. Serve solo con l\'interfaccia HTML: entra nei link inviati ai votanti']
  ].forEach(r => ensureCfgRow_(r[0], r[1], r[2]));
  cfgCell_(CFG_INTERFACCIA).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(INTERFACCE, true).setAllowInvalid(false).build());
  cfgCell_('Anno sportivo').setNumberFormat('@');  // testo: "2026/27" non diventa una data
  ['Apertura voto commissari', 'Chiusura voto commissari', 'Apertura voto presidente', 'Chiusura voto presidente']
    .forEach(k => cfgCell_(k).setNumberFormat('dd/mm/yyyy hh:mm'));

  ensureSheet_(ss, SH.SOC, SOC_HEADER);
  ensureSheet_(ss, SH.SQ, SQ_HEADER);
  const cand = ensureSheet_(ss, SH.CAND, CAND_HEADER);
  if (!headers_(cand).qualifica) {  // v1/v2: Candidato | Anni | Note
    cand.insertColumnsAfter(1, 2);
    cand.getRange(1, 2, 1, 2).setValues([['Qualifica', 'Squadra']]).setFontWeight('bold').setBackground(BLU);
  }
  ensureSheet_(ss, SH.COM, COM_HEADER);
  ensureSheet_(ss, SH.RIS, RIS_HEADER);
  ensureSheet_(ss, SH.MSG, MSG_HEADER);
  const brevi = riempiNomiBrevi_();
  if (brevi) avvisi.push(brevi + ' societa senza "Nome breve": per ora vale la ragione sociale. ' +
    'Accorcialo nel foglio "Societa" (ultima colonna): e il nome che vedono i votanti, nei messaggi e nei resoconti.');
  const spostate = migraAutocandidature_();
  if (spostate) avvisi.push(spostate + ' candidati avevano "' + AUTOCAND + '" come qualifica: ora la qualifica e "Altro" e ' +
    '"' + AUTOCAND + '" sta nella colonna Squadra, per chi non e tesserato con un club. Controlla il foglio "Candidati".');

  applicaValidazioni_();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(P_SALT)) props.setProperty(P_SALT, Utilities.getUuid());
  const nuovi = assegnaCodiciMancanti_();   // codici univoci XXXX-9999 a chi non ne ha
  if (nuovi) avvisi.push(nuovi + ' società senza codice: codice e link assegnati ora.');
  ui_().alert(
    'Fogli pronti.\n\n1) "Società": una riga per società (una riga = un voto).\n' +
    '2) "Squadre": squadra e società di appartenenza.\n' +
    '3) "Candidati": nome, qualifica, squadra, anni.\n' +
    '4) Round 1 → "Genera codici e link mancanti".' + (avvisi.length ? '\n\n' + avvisi.join('\n\n') : ''));
}

/**
 * Dalla v10 "Autocandidatura" non e piu una qualifica: la qualifica dice che cosa
 * e il candidato (Allenatore, Aiuto allenatore, Altro) e l'autocandidatura prende
 * il posto della squadra, per chi si candida da se senza essere tesserato.
 * Converte le righe vecchie e restituisce quante ne ha toccate.
 */
/** Riempie i "Nome breve" vuoti con la ragione sociale e dice quanti ne ha riempiti. */
function riempiNomiBrevi_() {
  const sh = sheet_(SH.SOC);
  if (sh.getLastRow() < 2) return 0;
  const n = sh.getLastRow() - 1;
  const rag = sh.getRange(2, 1, n, 1).getValues();
  const br = sh.getRange(2, 5, n, 1).getValues();
  let q = 0;
  rag.forEach((r, i) => {
    if (String(r[0]).trim() && !String(br[i][0]).trim()) { br[i][0] = String(r[0]).trim(); q++; }
  });
  if (q) sh.getRange(2, 5, n, 1).setValues(br);
  return q;
}

function migraAutocandidature_() {
  const sh = sheet_(SH.CAND);
  if (sh.getLastRow() < 2) return 0;
  const h = headers_(sh);
  if (!h.qualifica || !h.squadra) return 0;
  const n = sh.getLastRow() - 1;
  const q = sh.getRange(2, h.qualifica, n, 1).getValues();
  const s = sh.getRange(2, h.squadra, n, 1).getValues();
  let tocchi = 0;
  q.forEach((r, i) => {
    if (!/autocand/i.test(String(r[0]))) return;
    r[0] = 'Altro';
    if (!String(s[i][0]).trim()) s[i][0] = AUTOCAND;
    tocchi++;
  });
  if (tocchi) {
    sh.getRange(2, h.qualifica, n, 1).setValues(q);
    sh.getRange(2, h.squadra, n, 1).setValues(s);
  }
  return tocchi;
}

/** Svuota un foglio e rimette la riga di intestazione (clearContents la porta via). */
function svuotaFoglio_(ss, name, header) {
  const sh = ss.getSheetByName(name);
  if (!sh) return ensureSheet_(ss, name, header);
  sh.clearContents();
  if (header && header.length) {
    sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground(BLU);
    sh.setFrozenRows(1);
  }
  return sh;
}

function ensureSheet_(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold').setBackground(BLU);
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);
  return sh;
}

function ensureCfgRow_(key, val, note) {
  const sh = sheet_(SH.CONFIG);
  const keys = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(r => String(r[0]).trim());
  const i = keys.indexOf(key);
  if (i < 0) sh.appendRow([key, val, note]);
  else sh.getRange(i + 1, 3).setValue(note);
}

function cfgRename_(da, a) {
  const sh = sheet_(SH.CONFIG);
  const keys = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues().map(r => String(r[0]).trim());
  const i = keys.indexOf(da);
  if (i >= 0 && keys.indexOf(a) < 0) sh.getRange(i + 1, 1).setValue(a);
}

function applicaValidazioni_() {
  const cand = sheet_(SH.CAND), sq = sheet_(SH.SQ), soc = sheet_(SH.SOC);
  const h = headers_(cand);
  const n = Math.max(cand.getMaxRows() - 1, 1);
  cand.getRange(2, h.qualifica, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(QUALIFICHE, true).setAllowInvalid(false).build());
  // la squadra del candidato: una di quelle iscritte, oppure "Autocandidatura"
  const elencoSq = colonna_(sq, 1).concat([AUTOCAND]);
  cand.getRange(2, h.squadra, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(elencoSq, true).setAllowInvalid(true).build());
  sq.getRange(2, 2, Math.max(sq.getMaxRows() - 1, 1), 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(soc.getRange('A2:A'), true).setAllowInvalid(true).build());
}

/* ================= Round 1: codici società ================= */

/**
 * Assegna codice e link alle società che non li hanno ancora e aggiorna tutti
 * i link all'URL corrente, senza toccare società, squadre, candidati, codici
 * già assegnati né voti già espressi. Restituisce quanti codici sono nuovi.
 */
function assegnaCodiciMancanti_(tutti) {
  const soc = sheet_(SH.SOC);
  // aggiunge le società indicate in "Squadre" ma non ancora elencate
  const presenti = new Set(colonna_(soc, 1).map(x => x.toLowerCase()));
  squadre_().forEach(x => {
    if (x.societa && !presenti.has(x.societa.toLowerCase())) {
      presenti.add(x.societa.toLowerCase());
      soc.appendRow([x.societa, '', '', '', x.societa]);
    }
  });
  const n = soc.getLastRow() - 1;
  if (n < 1) return 0;
  const rows = soc.getRange(2, 1, n, 3).getValues();
  const usati = tutti ? new Set() : codiciEsistenti_();
  let nuovi = 0;
  rows.forEach(r => {
    if (!String(r[0]).trim()) { r[1] = tutti ? '' : r[1]; r[2] = ''; return; }
    if (tutti || !norm_(r[1])) { r[1] = codiceNuovo_(usati); nuovi++; }
    r[2] = link_(r[1]);
  });
  soc.getRange(2, 1, n, 3).setValues(rows);
  applicaValidazioni_();
  return nuovi;
}

/** Genera i codici mancanti e aggiorna i link, lasciando intatto tutto il resto. */
function generaCodici() {
  const ui = ui_();
  if (!sheet_(SH.SOC).getLastRow() || numSocieta_() + squadre_().length === 0)
    return ui.alert('Inserisci le società nel foglio "Società" (o la società di ogni squadra in "Squadre").');
  const nuovi = assegnaCodiciMancanti_(false);
  messaggiSicuro_();
  ui.alert(nuovi + ' nuovi codici generati; link aggiornati per tutte le società (codici esistenti e voti già espressi restano validi).' +
    '\nSocietà aventi diritto: ' + numSocieta_() + ' → commissari da eleggere: ' + posti_(cfg_()) + '.' +
    (link_('X') ? '\n\nInvia a ogni società solo il SUO link.'
      : '\n\nLink non disponibili: pubblica prima l\'app web (Esegui il deployment → App web), poi rilancia questa voce.'));
}

/** Rigenera da zero i codici di tutte le società (dati e candidati restano intatti). */
function rigeneraCodiciSocieta() {
  const ui = ui_();
  const c = cfg_();
  if (aperta_(c)) return ui.alert('Chiudi prima la votazione aperta.');
  if (usati_(1, 0).length)
    return ui.alert('Ci sono già voti espressi nel round 1: rigenerare i codici permetterebbe di votare due volte.\n\n' +
      'Usa "Genera codici e link mancanti" oppure azzera il round 1 prima di rigenerare.');
  if (ui.alert('Rigenera tutti i codici', 'Tutte le società ricevono un nuovo codice e un nuovo link: quelli già inviati non funzioneranno più.\nSocietà, squadre e candidati restano invariati. Procedere?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const n = assegnaCodiciMancanti_(true);
  ui.alert(n + ' codici rigenerati. Invia a ogni società il suo nuovo link.');
}

/** Rigenera i codici dei commissari senza rifare l'elenco (round 2 e 3). */
function rigeneraCodiciCommissari() {
  const ui = ui_();
  const c = cfg_();
  if (aperta_(c)) return ui.alert('Chiudi prima la votazione aperta.');
  const sh = sheet_(SH.COM);
  const com = commissari_();
  if (!com.length) return ui.alert('Nessun commissario: usa "Prepara commissari e link".');
  if (usati_(2, 0).length || usati_(3, 0).length)
    return ui.alert('Ci sono già voti espressi nei round 2 o 3: rigenerare i codici permetterebbe di votare due volte.\n\nAzzera prima quei round.');
  if (ui.alert('Rigenera codici commissari', com.length + ' commissari riceveranno un nuovo codice e link; i link precedenti non funzioneranno più. Procedere?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const usati = new Set(Object.keys(codiciMap_()));
  com.forEach((x, i) => {
    const cod = codiceNuovo_(usati);
    sh.getRange(i + 2, 4, 1, 2).setValues([[cod, link_(cod)]]);
  });
  ui.alert(com.length + ' codici commissari rigenerati.');
}

/** Codice casuale nel formato XXXX-9999: 4 lettere maiuscole A–H e 4 cifre. */
function codiceCasuale_() {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
  let s = '';
  for (let i = 0; i < 4; i++) s += LETTERE[(bytes[i] + 256) % LETTERE.length];
  for (let i = 4; i < 8; i++) s += CIFRE[(bytes[i] + 256) % CIFRE.length];
  return s;
}

function codiceNuovo_(usati) {
  let k;
  do { k = codiceCasuale_(); } while (usati.has(k));
  usati.add(k);
  return k.slice(0, 4) + '-' + k.slice(4);
}

function codiciEsistenti_() {
  const s = new Set(Object.keys(codiciMap_()));
  commissari_().forEach(x => s.add(norm_(x.codice)));
  const bal = SpreadsheetApp.getActive().getSheetByName(SH.BAL);
  if (bal) colonna_(bal, 2).forEach(x => s.add(norm_(x)));
  return s;
}

/* ================= Interfaccia di voto attiva ================= */

/** 'HTML' se si vota dalla pagina statica, 'SEMPLICE' se dalla app Google. */
function interfaccia_(c) {
  return String((c || cfg_())[CFG_INTERFACCIA] || 'HTML').trim().toUpperCase() === 'SEMPLICE' ? 'SEMPLICE' : 'HTML';
}

function urlHtml_(c) { return String((c || cfg_())[CFG_URL_HTML] || '').trim().replace(/\/+$/, ''); }

function urlApp_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

/**
 * Controlla che la scheda arrivi dall'ingresso attivo. Restituisce null se va bene,
 * altrimenti il messaggio da mostrare, con l'indirizzo giusto quando lo conosciamo.
 * Il controllo sta qui, dal lato che scrive: un vecchio link non deve poter votare
 * dalla porta chiusa.
 */
function guardiaIngresso_(c, origine) {
  const attiva = interfaccia_(c);
  if ((origine === 'html' ? 'HTML' : 'SEMPLICE') === attiva) return null;
  if (attiva === 'HTML') {
    const u = urlHtml_(c);
    return 'Per questa votazione si vota dalla pagina web' + (u ? ': ' + u : ' indicata dal Coordinatore.');
  }
  const u = urlApp_();
  return 'Per questa votazione si vota dall\'app Google' + (u ? ': ' + u : ' indicata dal Coordinatore.');
}

/** Link personale del votante, verso l'ingresso attivo. */
function link_(cod, c) {
  const n = norm_(cod);
  if (!n) return '';
  const cfg = c || cfg_();
  if (interfaccia_(cfg) === 'HTML') {
    const u = urlHtml_(cfg);
    return u ? u + '#c=' + n : '';
  }
  const u = urlApp_();
  return u ? u + '?c=' + n : '';
}

/** Riscrive i link di società, commissari e ballottaggio senza toccare i codici. */
function aggiornaLink_() {
  const ss = SpreadsheetApp.getActive(), c = cfg_();
  let n = 0;
  [[SH.SOC, 2, 3], [SH.COM, 4, 5], [SH.BAL, 2, 3]].forEach(t => {
    const sh = ss.getSheetByName(t[0]);
    if (!sh || sh.getLastRow() < 2) return;
    const righe = sh.getLastRow() - 1;
    const cod = sh.getRange(2, t[1], righe, 1).getValues();
    sh.getRange(2, t[2], righe, 1).setValues(cod.map(r => { const l = link_(r[0], c); if (l) n++; return [l]; }));
  });
  return n;
}

/* ================= Messaggi per i votanti ================= */

function preparaMessaggiMenu() {
  const n = preparaMessaggi();
  ui_().alert(n
    ? n + ' messaggi pronti nel foglio "Messaggi".\n\nUna riga per votante: copia la cella della terza ' +
      'colonna e incollala nella chat. Il link dentro il messaggio e gia quello personale.'
    : 'Nessun votante per il round attivo: genera prima i codici (o prepara i commissari).');
}

/**
 * Prepara il foglio "Messaggi": una riga per votante del round attivo, con il
 * testo gia pronto in una sola cella. Si copia la cella e si incolla nella chat
 * della societa, senza doverlo ricomporre ogni volta.
 */
function preparaMessaggi() {
  const ss = SpreadsheetApp.getActive(), c = cfg_();
  const x = contesto_(c);
  const map = votantiMap_(x.r, x.b);
  const sh = svuotaFoglio_(ss, SH.MSG, MSG_HEADER);
  const righe = Object.keys(map).sort((a, b) => map[a].localeCompare(map[b], 'it'))
    .map(k => [map[k], formattaCodice_(k), testoMessaggio_(c, x, map[k], k)]);
  if (righe.length) sh.getRange(2, 1, righe.length, 3).setValues(righe);
  sh.setColumnWidth(1, 220); sh.setColumnWidth(2, 110); sh.setColumnWidth(3, 620);
  if (righe.length) sh.getRange(2, 3, righe.length, 1).setWrap(true).setVerticalAlignment('top');
  return righe.length;
}

/** Il codice come lo vede chi lo riceve: XXXX-9999. */
function formattaCodice_(k) {
  const n = norm_(k);
  return n.length > 4 ? n.slice(0, 4) + '-' + n.slice(4) : n;
}

/** Testo del messaggio: tutto quello che serve al votante, niente di più. */
function testoMessaggio_(c, x, nome, codice) {
  const titolo = String(c['Titolo'] || 'Elezione CTL Baskin');
  const dove = intestazione_(c);
  const link = link_(codice, c);
  const quando = testoProgramma_(c);
  const soc = x.r === 1 && !x.b;
  const cosa = x.b
    ? 'il ballottaggio per ' + ROUND[x.r].nome.replace(' CTL', ' della CTL')
    : (x.r === 1 ? 'i Commissari della CTL' : 'il ' + ROUND[x.r].nome.replace(' CTL', ' della CTL'));
  const r = [];
  r.push(titolo + (dove ? ' — ' + dove : ''));
  r.push('');
  r.push('Ciao ' + nome + ', si vota per ' + cosa + '.');
  r.push('');
  r.push(soc ? 'Questo è il link riservato alla vostra società:' : 'Questo è il tuo link personale:');
  r.push(link || '(link non disponibile: pubblica la app web, poi rigenera i messaggi)');
  r.push('');
  r.push('Il codice è ' + formattaCodice_(codice) + ', già compreso nel link. Serve solo a garantire ' +
    'un voto per ' + (soc ? 'società' : 'commissario') + ': la scheda viene registrata senza codice, ' +
    'senza nome e senza orario.');
  r.push('');
  r.push((x.max === 1 ? 'Si esprime una sola preferenza.' :
    'Si possono esprimere fino a ' + x.max + ' preferenze, e l\'ordine non conta.') +
    ' Si vota una volta sola: il codice non si riusa.');
  if (quando) r.push(quando);
  r.push('');
  r.push('IMPORTANTE — Dopo aver depositato la scheda compare una RICEVUTA, un codice tipo 7K2M-94QD. ' +
    (soc ? 'Fatele' : 'Falle') + ' subito uno screenshot, oppure ' + (soc ? 'trascrivetela' : 'trascrivila') +
    ': non è recuperabile, chiusa la pagina non la conosce più nessuno. A spoglio concluso ' +
    (soc ? 'la ritroverete' : 'la ritroverai') + ' nel riepilogo dell\'urna, e vorrà dire che ' +
    (soc ? 'la vostra scheda è' : 'la tua scheda è') + ' stata contata. La ricevuta non dice come ' +
    (soc ? 'avete' : 'hai') + ' votato: è proprio questo che tiene il voto anonimo.');
  r.push('');
  r.push('Il programma è pubblico e verificabile da chiunque: ' + REPO_URL);
  return r.join('\n');
}

/* ================= Dati di prova ================= */

/**
 * Riempie i fogli con societa, squadre e candidati inventati, ma negli stessi
 * numeri della Sezione Territoriale Emilia-Romagna 2026/2027: 11 societa,
 * 16 squadre, 13 candidati (9 allenatori e 4 aiuto allenatore, di cui uno
 * autocandidato senza squadra), due societa senza candidati. Serve per provare
 * il giro completo senza toccare i dati veri.
 * I nomi sono dell'alfabeto fonetico: nessuna persona e nessun club reale.
 */
const PROVA_SQUADRE = [
  ['Alfa 1', 'Baskin Alfa'], ['Alfa 2', 'Baskin Alfa'], ['Alfa 3', 'Baskin Alfa'],
  ['Bravo', 'Baskin Bravo'],
  ['Charlie 1', 'Baskin Charlie'], ['Charlie 2', 'Baskin Charlie'],
  ['Delta 1', 'Baskin Delta'], ['Delta 2', 'Baskin Delta'],
  ['Echo 1', 'Baskin Echo'], ['Echo 2', 'Baskin Echo'],
  ['Foxtrot', 'Baskin Foxtrot'], ['Golf', 'Baskin Golf'], ['Hotel', 'Baskin Hotel'],
  ['India', 'Baskin India'], ['Juliett', 'Baskin Juliett'], ['Kilo', 'Baskin Kilo']
];
const PROVA_CANDIDATI = [
  ['Candidato A', 'Aiuto allenatore', 'Alfa 1', 6, ''],
  ['Candidato B', 'Aiuto allenatore', 'Alfa 2', 1, ''],
  ['Candidato C', 'Allenatore', 'Bravo', 4, ''],
  ['Candidato D', 'Allenatore', 'Bravo', 3, ''],
  ['Candidato E', 'Aiuto allenatore', 'Bravo', 2, ''],
  ['Candidato F', 'Aiuto allenatore', 'Charlie 1', 5, ''],
  ['Candidato G', 'Allenatore', 'Delta 1', 4, ''],
  ['Candidato H', 'Allenatore', 'Echo 2', 3, ''],
  ['Candidato I', 'Allenatore', 'Foxtrot', 2, ''],
  ['Candidato L', 'Allenatore', 'Golf', 5, ''],
  ['Candidato M', 'Allenatore', 'Hotel', 1, ''],
  ['Candidato N', 'Allenatore', 'India', 3, ''],
  ['Candidato O', 'Allenatore', AUTOCAND, 0, 'allenatore non tesserato: si candida da se']
];

function inizializzaDatiProva() {
  const ui = ui_(), ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(SH.CONFIG)) setup();     // funziona anche su un foglio appena creato
  const c = cfg_();
  if (aperta_(c)) return ui.alert('C\'e una votazione aperta: chiudila prima di caricare i dati di prova.');
  const voti = [1, 2, 3].reduce((n, r) => n + usati_(r, 0).length, 0);
  if (voti) return ui.alert('Ci sono gia ' + voti + ' voti espressi.\n\nUsa prima "Azzera round…": i dati di prova ' +
    'sostituiscono societa, squadre e candidati, e con voti in corso il conteggio non avrebbe senso.');
  if (ui.alert('Dati di prova',
    'Sostituisco il contenuto dei fogli "Societa", "Squadre" e "Candidati" con dati inventati, negli stessi numeri ' +
    'dell\'Emilia-Romagna: 11 societa, 16 squadre, 13 candidati di cui 4 aiuto allenatore e uno autocandidato, ' +
    'e due societa senza candidati.\n\n' +
    'I dati veri che fossero gia nei fogli vengono persi. Procedere?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  setup();
  azzeraElezione_(true);          // 3) azzeramento totale, poi riempie con i dati finti
  sheet_(SH.SQ).getRange(2, 1, PROVA_SQUADRE.length, 2).setValues(PROVA_SQUADRE);
  sheet_(SH.CAND).getRange(2, 1, PROVA_CANDIDATI.length, 5).setValues(PROVA_CANDIDATI);
  setCfg_('Titolo', 'Elezione CTL Baskin (PROVA)');
  setCfg_('Sezione Territoriale', 'Sezione di prova');
  setCfg_('Formatore di riferimento', 'Candidato C');
  const nuovi = assegnaCodiciMancanti_(true);
  messaggiSicuro_();
  applicaValidazioni_();
  dopoAzzeramento_();

  const soc = numSocieta_();
  ui.alert('Dati di prova caricati.\n\n' +
    soc + ' societa, ' + PROVA_SQUADRE.length + ' squadre, ' + PROVA_CANDIDATI.length +
    ' candidati (4 aiuto allenatore, 1 autocandidato).\n' +
    'Commissari da eleggere: ' + posti_(cfg_()) + '. Preferenze per scheda: ' + maxPref_(cfg_(), PROVA_CANDIDATI.length) + '.\n' +
    nuovi + ' codici generati.\n\n' +
    'Il titolo e marcato (PROVA): toglilo quando passi ai dati veri.');
}

/* ================= Scelta dell'interfaccia ================= */

function usaInterfacciaSemplice() { cambiaInterfaccia_('Semplice'); }

function usaInterfacciaHtml() {
  const ui = ui_(), c = cfg_();
  const r = ui.prompt('Pagina web di voto',
    'Indirizzo della pagina su GitHub Pages (per esempio https://uncledan.github.io/votazione-ctl-baskin/).' +
    (urlHtml_(c) ? '\n\nLascia vuoto per tenere quello attuale:\n' + urlHtml_(c) : ''),
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const u = String(r.getResponseText() || '').trim().replace(/\/+$/, '');
  if (u && !/^https:\/\/.+/i.test(u)) return ui.alert('Indirizzo non valido: deve iniziare per https://');
  if (!u && !urlHtml_(c)) return ui.alert('Senza indirizzo i link ai votanti resterebbero vuoti: riprova indicandolo.');
  if (u) setCfg_(CFG_URL_HTML, u);
  cambiaInterfaccia_('HTML');
}

/**
 * Cambia l'ingresso attivo e riscrive i link. Si può fare anche a votazione
 * aperta: le schede già depositate restano valide, perché l'urna e il formato
 * sono gli stessi. Cambia solo da dove si entra, quindi i link vanno rimandati.
 */
function cambiaInterfaccia_(valore) {
  const ui = ui_(), c = cfg_();
  if (interfaccia_(c) === (valore === 'HTML' ? 'HTML' : 'SEMPLICE') && valore !== 'HTML')
    return ui.alert('Si vota già dalla app Google.');
  if (aperta_(c) && ui.alert('Votazione aperta',
    'C\'è una votazione aperta. Le schede già depositate restano valide, ma chi ha ricevuto il vecchio link lo troverà chiuso ' +
    'e dovrai rimandare i link aggiornati.\n\nProcedere?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  setCfg_(CFG_INTERFACCIA, valore);
  const n = aggiornaLink_();
  const u = valore === 'HTML' ? urlHtml_(cfg_()) : urlApp_();
  ui.alert('Interfaccia attiva: ' + valore + '.\n\n' +
    (u ? 'Indirizzo: ' + u + '\n\n' : 'Indirizzo non ancora disponibile.\n\n') +
    n + ' link aggiornati nei fogli. Rimanda a ogni votante il SUO link.');
}

function mostraInterfaccia() {
  const c = cfg_();
  const att = interfaccia_(c);
  ui_().alert('Interfaccia di voto',
    'Attiva per questa votazione: ' + (att === 'HTML' ? 'pagina web (HTML)' : 'app Google (semplice)') + '.\n\n' +
    'App Google: ' + (urlApp_() || 'non pubblicata') + '\n' +
    'Pagina web: ' + (urlHtml_(c) || 'non configurata') + '\n\n' +
    'Ponte per la pagina web: lo stesso indirizzo della app Google, chiamato in POST.\n' +
    'Chi prova a votare dall\'ingresso non attivo riceve un rimando a quello giusto.',
    ui_().ButtonSet.OK);
}

/* ================= Apertura / chiusura ================= */

function apriRound_(r) {
  const ui = ui_();
  const c = cfg_();
  if (aperta_(c)) return ui.alert('È aperta: ' + descrContesto_(c) + '. Chiudila prima.');
  const cand = candidatiRound_(r, c);
  if (!cand.length) {
    return ui.alert(r === 1 ? 'Nessun candidato inserito.'
      : r === 2 ? 'Nessun commissario: usa "Round 2 → Prepara commissari e link".'
      : 'Presidente non ancora eletto: calcola il round 2 (o scrivi il nome in Config → Presidente).');
  }
  if (r === 1) {
    const nomi = cand.map(x => x.nome);
    const doppi = nomi.filter((x, i) => nomi.indexOf(x) !== i);
    if (doppi.length) return ui.alert('Candidati con lo stesso nome: ' + doppi.join(', ') + '. Rendili distinguibili.');
    if (!Object.keys(codiciMap_()).length) return ui.alert('Nessun codice: usa "Round 1 → Genera codici e link mancanti".');
    const senzaQ = cand.filter(x => !x.qualifica).map(x => x.nome);
    if (senzaQ.length && ui.alert('Qualifica mancante', 'Senza qualifica (trattati come allenatori): ' + senzaQ.join(', ') + '.\nAprire comunque?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    if (cand.length < posti_(c) && ui.alert('Candidati insufficienti', 'Ci sono ' + cand.length + ' candidati per ' + posti_(c) + ' posti. Aprire comunque?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  } else if (!Object.keys(votantiMap_(r, 0)).length) {
    return ui.alert('I commissari non hanno codici: usa "Round 2 → Prepara commissari e link".');
  }
  setCfg_('Round attivo', r);
  setCfg_('Ballottaggio', 0);
  setCfg_('Stato', 'APERTA');
  ui.alert('Round ' + r + ' – ' + ROUND[r].nome + ' APERTO.\nPosti: ' + postiRound_(r, c) +
    ', max preferenze per scheda: ' + maxPrefRound_(r, c, cand.length) +
    '.\nNon modificare candidati e votanti finché è in corso.');
}

/**
 * Chiude la votazione in corso. Vale anche per una votazione aperta a tempo:
 * il trigger di chiusura/proroga ancora pendente viene rimosso, così la
 * decisione resta a chi amministra l'urna.
 */
function chiudiVotazione() {
  const c0 = cfg_();
  const r = roundAttivo_(c0);
  eliminaTrigger_(ballottaggioAttivo_(c0) ? 'triggerChiudeBallottaggio'
    : r === 2 ? 'triggerChiudePresidente' : r === 1 ? 'triggerChiudeCommissari' : null);
  setCfg_('Stato', 'CHIUSA');
  aggiornaPartecipazione();
  aggiornaUrna();
}

function descrContesto_(c) {
  const r = roundAttivo_(c), b = ballottaggioAttivo_(c);
  return 'Round ' + r + ' – ' + ROUND[r].nome + (b ? ', ballottaggio ' + b : '');
}

/* ================= Round 2 e 3: commissari ================= */

/** Crea il foglio Commissari dagli ELETTI del round 1, con codici e link per i round 2 e 3. */
function preparaCommissari() {
  const ui = ui_();
  const c = cfg_();
  if (aperta_(c)) { ui.alert('Chiudi prima la votazione aperta.'); return false; }
  const ris = sheet_(SH.RIS);
  if (ris.getLastRow() < 2) { ui.alert('Calcola prima i risultati del round 1.'); return false; }
  const h = ris.getRange(1, 1, 1, ris.getLastColumn()).getValues()[0].map(x => String(x).toLowerCase());
  const col = p => h.findIndex(x => x.indexOf(p) === 0);
  const iN = col('candidat'), iQ = col('qualific'), iS = col('squadr'), iE = col('esito');
  const v = ris.getRange(2, 1, ris.getLastRow() - 1, ris.getLastColumn()).getValues();
  if (v.some(r => /^PARIT/i.test(String(r[iE])))) {
    ui.alert('Ci sono parità da risolvere in "Risultati": usa il menu Ballottaggio oppure scrivi a mano ELETTO o Non eletto nella colonna Esito.');
    return false;
  }
  const eletti = v.filter(r => /^ELETT/i.test(String(r[iE])) && String(r[iN]).trim());
  if (!eletti.length) { ui.alert('Nessun eletto in "Risultati".'); return false; }

  const sh = sheet_(SH.COM);
  const vecchi = {};
  commissari_().forEach(x => { if (x.codice) vecchi[x.nome] = x.codice; });
  const usati = codiciEsistenti_();
  const rows = eletti.map(r => {
    const nome = String(r[iN]).trim();
    const cod = vecchi[nome] || codiceNuovo_(usati);
    return [nome, String(r[iQ]).trim(), String(r[iS]).trim(), cod, link_(cod), '', ''];
  });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, COM_HEADER.length).clearContent();
  sh.getRange(2, 1, rows.length, COM_HEADER.length).setValues(rows);
  sh.autoResizeColumns(1, COM_HEADER.length);
  sh.activate();
  aggiornaReport();
  ui.alert(rows.length + ' commissari pronti.' + (link_('X')
    ? '\nInvia a ciascuno il SUO link: vale sia per il Presidente sia per il Vice.'
    : '\nLink non disponibili: pubblica prima l\'app web.'));
  return true;
}

/* ================= Partecipazione ================= */

function aggiornaPartecipazione() {
  const c = cfg_();
  const r = roundAttivo_(c), b = ballottaggioAttivo_(c);
  const used = new Set(usati_(r, b));
  let sh, colCod, colOut;
  if (b) { sh = sheet_(SH.BAL); colCod = 2; colOut = 4; }
  else if (r === 1) { sh = sheet_(SH.SOC); colCod = 2; colOut = 4; }
  else { sh = sheet_(SH.COM); colCod = 4; colOut = COM_HEADER.indexOf(ROUND[r].col) + 1; }
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const codici = sh.getRange(2, colCod, n, 1).getValues();
  const out = codici.map(x => [norm_(x[0]) && used.has(hash_(x[0])) ? 'SÌ' : '']);
  sh.getRange(2, colOut, n, 1).setValues(out);
  const votanti = out.filter(x => x[0]).length;
  const aventi = codici.filter(x => norm_(x[0])).length;
  SpreadsheetApp.getActive().toast(descrContesto_(c) + ': hanno votato ' + votanti + ' su ' + aventi + '.', 'Partecipazione', 8);
}

/* ================= Calcolo round 1 ================= */

function pari_(a, b) { return !!a && !!b && a.voti === b.voti && a.anni === b.anni; }

function datiRound1_(c) {
  const cand = candidati_();
  const schede = schede_(1, 0);
  const voti = {};
  cand.forEach(x => voti[x.nome] = 0);
  let bianche = 0, totPref = 0;
  schede.forEach(s => {
    if (!s.length) bianche++;
    s.forEach(nome => { if (nome in voti) { voti[nome]++; totPref++; } });
  });
  const lista = cand.map(x => Object.assign({}, x, { voti: voti[x.nome] }))
    .sort((a, b) => b.voti - a.voti || b.anni - a.anni || a.nome.localeCompare(b.nome, 'it'));
  const posti = posti_(c);
  const ass = assegna_(lista, posti, maxAiuti_(c));
  applicaBallottaggio_(1, ass);
  return { cand: cand, schede: schede, bianche: bianche, totPref: totPref, lista: lista, posti: posti, ass: ass };
}

function calcolaRisultati_(silenzioso) {
  const ui = ui_();
  const c = cfg_();
  if (aperta_(c) && roundAttivo_(c) === 1) return ui.alert('Chiudi prima la votazione in corso.');
  const d = datiRound1_(c);
  const lista = d.lista, ass = d.ass;

  const out = [];
  lista.forEach((x, i) => {
    const pos = (i > 0 && pari_(x, lista[i - 1])) ? out[i - 1][0] : i + 1;
    out.push([pos, x.nome, x.qualifica || '—', x.squadra, x.voti, x.anni, ass.esito[x.nome].esito, ass.esito[x.nome].nota]);
  });
  const eletti = lista.filter(x => ass.esito[x.nome].esito === 'ELETTO').length;
  const vacanti = Math.max(d.posti - eletti - (ass.tie ? ass.tie.posti : 0), 0);

  const sh = sheet_(SH.RIS);
  sh.clearContents();
  altezzeRighe_(sh);
  sh.getRange(1, 1, 1, RIS_HEADER.length).setValues([RIS_HEADER]).setFontWeight('bold').setBackground(BLU);
  if (out.length) sh.getRange(2, 1, out.length, RIS_HEADER.length).setValues(out);
  const r = (a, b, c3) => [a, b, c3 || '', '', '', '', '', ''];
  const riepilogo = [
    r('', ''),
    r('Riepilogo', ''),
    r('Sezione Territoriale', sezione_(c)),
    r('Anno sportivo', anno_(c)),
    r('Società aventi diritto', numSocieta_()),
    r('Schede votate', d.schede.length),
    r('di cui bianche', d.bianche),
    r('Preferenze espresse', d.totPref),
    r('Max preferenze per scheda', maxPref_(c, d.cand.length)),
    r('Commissari da eleggere', d.posti),
    r('Eletti', eletti, ass.tie ? 'ATTENZIONE: ' + ass.tie.posti + ' posti in parità tra ' + ass.tie.candidati.join(', ') : ''),
    r('Posti vacanti', vacanti, (!ass.tie && eletti < 3) ? 'ATTENZIONE: CTL sotto il minimo di 3 membri' : ''),
    r('Calcolato il', Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm'))
  ];
  sh.getRange(out.length + 2, 1, riepilogo.length, RIS_HEADER.length).setValues(riepilogo);
  scriviPiede_(sh, out.length + 2 + riepilogo.length + 1, c);
  sh.autoResizeColumns(1, RIS_HEADER.length);
  sh.activate();
  aggiornaReport();
  aggiornaUrna();
  if (!silenzioso && ass.tie) ui.alert(messaggioParita_(1, ass.tie));
}

function messaggioParita_(r, tie) {
  const st = balState_(r);
  if (st && st.stato === 'irrisolto')
    return 'Parità ancora aperta dopo ' + MAX_BALLOTTAGGI + ' ballottaggi tra ' + tie.candidati.join(', ') +
      '. Va risolta manualmente (es. sorteggio): scrivi l\'esito a mano' + (r === 1 ? ' nella colonna Esito di "Risultati".' : ' in Config → ' + ROUND[r].cfg + '.');
  return 'Parità non risolvibile con gli anni: ' + tie.posti + (tie.posti === 1 ? ' posto' : ' posti') +
    ' da assegnare tra ' + tie.candidati.join(', ') + '.\n\nUsa "Ballottaggio → Prepara ballottaggio e nuovi link".';
}

/**
 * Assegna i posti del round 1:
 * - allenatori e candidati di altra qualifica entrano per primi, in ordine di preferenze
 *   (spareggio per anni), indipendentemente dal confronto con gli aiuti;
 * - solo se non bastano entrano gli aiuti allenatore, fino al limite della deroga;
 * - gli eventuali posti rimanenti restano vacanti.
 * tie = eventuale gruppo a pari merito (preferenze e anni) a cavallo dell'ultimo posto.
 */
function assegna_(lista, posti, maxAiuti) {
  const esito = {};
  lista.forEach(x => esito[x.nome] = { esito: 'Non eletto', nota: '' });
  let tie = null;

  function eleggi(arr, n, nota) {
    if (n <= 0 || !arr.length) return 0;
    if (arr.length <= n) {
      arr.forEach(x => esito[x.nome] = { esito: 'ELETTO', nota: nota });
      return arr.length;
    }
    const taglio = pari_(arr[n - 1], arr[n]);
    if (taglio) {
      const g = arr.filter(x => pari_(x, arr[n - 1]));
      tie = { candidati: g.map(x => x.nome), posti: n - arr.indexOf(g[0]) };
    }
    arr.forEach((x, i) => {
      if (taglio && pari_(x, arr[n - 1])) {
        esito[x.nome] = { esito: 'PARITÀ — da risolvere', nota: 'Pari preferenze e pari anni sull\'ultimo posto: ballottaggio' };
      } else if (i < n) {
        const precede = arr.some(y => y !== x && y.voti === x.voti && y.anni < x.anni);
        esito[x.nome] = { esito: 'ELETTO', nota: [nota, precede ? 'pari preferenze: precedenza per anni' : ''].filter(Boolean).join('; ') };
      }
    });
    return n;
  }

  const A = lista.filter(x => !x.aiuto);
  const B = lista.filter(x => x.aiuto);
  const daA = eleggi(A, posti, '');
  const resto = posti - daA;
  let daB = 0;
  if (resto > 0) {
    daB = eleggi(B, Math.min(resto, maxAiuti), 'Deroga aiuto allenatore');
    B.forEach(x => { if (esito[x.nome].esito === 'Non eletto') esito[x.nome].nota = 'Oltre il limite di aiuti allenatore'; });
  } else {
    B.forEach(x => esito[x.nome].nota = 'Aiuto allenatore: entra solo se non bastano gli altri candidati');
  }
  return { esito: esito, vacanti: Math.max(posti - daA - daB, 0), tie: tie };
}

/* ================= Calcolo round 2 e 3 ================= */

function datiCarica_(r, c) {
  const cand = candidatiRound_(r, c);
  const schede = schede_(r, 0);
  const voti = {};
  cand.forEach(x => voti[x.nome] = 0);
  let bianche = 0;
  schede.forEach(s => { if (!s.length) bianche++; s.forEach(n => { if (n in voti) voti[n]++; }); });
  const lista = cand.map(x => Object.assign({}, x, { voti: voti[x.nome] }))
    .sort((a, b) => b.voti - a.voti || b.anni - a.anni || a.nome.localeCompare(b.nome, 'it'));
  const esito = {};
  lista.forEach(x => esito[x.nome] = { esito: '', nota: '' });
  let tie = null;
  if (lista.length && lista[0].voti > 0) {
    const g = lista.filter(x => pari_(x, lista[0]));
    if (g.length === 1) {
      esito[lista[0].nome] = { esito: 'ELETTO', nota: (lista.length > 1 && lista[1].voti === lista[0].voti) ? 'Pari voti: precedenza per anni' : '' };
    } else {
      tie = { candidati: g.map(x => x.nome), posti: 1 };
      g.forEach(x => esito[x.nome] = { esito: 'PARITÀ — da risolvere', nota: 'Pari voti e pari anni: ballottaggio' });
    }
  }
  const ass = { esito: esito, tie: tie };
  applicaBallottaggio_(r, ass);
  const el = Object.keys(ass.esito).filter(k => ass.esito[k].esito === 'ELETTO');
  return { cand: cand, schede: schede, bianche: bianche, lista: lista, ass: ass, vincitore: el.length === 1 ? el[0] : '' };
}

function calcolaCarica_(r, silenzioso) {
  const ui = ui_();
  const c = cfg_();
  if (aperta_(c) && roundAttivo_(c) === r) return ui.alert('Chiudi prima la votazione in corso.');
  const d = datiCarica_(r, c);
  if (!d.cand.length) return ui.alert('Nessun candidato per questo round.');
  const lista = d.lista;
  const out = [];
  lista.forEach((x, i) => {
    const pos = (i > 0 && pari_(x, lista[i - 1])) ? out[i - 1][0] : i + 1;
    out.push([pos, x.nome, x.squadra, x.voti, x.anni, d.ass.esito[x.nome].esito, d.ass.esito[x.nome].nota]);
  });
  const head = ['Posizione', 'Candidato', 'Squadra', 'Voti', 'Anni (spareggio)', 'Esito', 'Note'];
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(ROUND[r].ris) || ss.insertSheet(ROUND[r].ris);
  sh.clearContents();
  altezzeRighe_(sh);
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground(BLU);
  sh.getRange(2, 1, out.length, head.length).setValues(out);
  const f = (a, b) => [a, b, '', '', '', '', ''];
  const riep = [f('', ''), f('Riepilogo', ''), f('Sezione Territoriale', sezione_(c)), f('Anno sportivo', anno_(c)),
    f('Commissari aventi diritto', Object.keys(votantiMap_(r, 0)).length),
    f('Schede votate', d.schede.length), f('di cui bianche', d.bianche),
    f('Calcolato il', Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm'))];
  sh.getRange(out.length + 2, 1, riep.length, head.length).setValues(riep);
  scriviPiede_(sh, out.length + 2 + riep.length + 1, c);
  sh.autoResizeColumns(1, head.length);
  sh.activate();

  setCfg_(ROUND[r].cfg, d.vincitore);
  aggiornaReport();
  aggiornaUrna();
  if (silenzioso) return;
  if (d.ass.tie) ui.alert(messaggioParita_(r, d.ass.tie));
  else if (!d.vincitore) ui.alert('Nessun eletto (nessun voto espresso). Scrivi il nome in Config → ' + ROUND[r].cfg + ', poi "Aggiorna report".');
}

/* ================= Ballottaggio ================= */

/*
 * Stato del ballottaggio di un round (Script Properties "BALSTATE_<r>"):
 * { orig: {candidati, posti},      parità originale da risolvere
 *   eletti: [{nome, n}],           già decisi dai ballottaggi
 *   candidati, posti,              parità ancora aperta
 *   n,                             numero dell'ultimo ballottaggio preparato
 *   stato: preparato | calcolato | risolto | irrisolto,
 *   storico: [{n, candidati, posti, voti, schede, bianche, eletti}] }
 */

function balState_(r) {
  const v = PropertiesService.getScriptProperties().getProperty('BALSTATE_' + r);
  return v ? JSON.parse(v) : null;
}
function setBalState_(r, st) { PropertiesService.getScriptProperties().setProperty('BALSTATE_' + r, JSON.stringify(st)); }

function stessoGruppo_(a, b) {
  return !!a && !!b && a.posti === b.posti && a.candidati.slice().sort().join('\n') === b.candidati.slice().sort().join('\n');
}

/** Applica ai risultati di un round l'esito dei ballottaggi relativi alla stessa parità. */
function applicaBallottaggio_(r, ass) {
  const st = balState_(r);
  if (!st || !ass.tie || !stessoGruppo_(st.orig, ass.tie)) return;
  st.eletti.forEach(e => ass.esito[e.nome] = {
    esito: 'ELETTO',
    nota: e.sorteggio ? 'Eletto per sorteggio dopo ' + MAX_BALLOTTAGGI + ' ballottaggi' : 'Eletto al ballottaggio ' + e.n
  });
  st.orig.candidati.forEach(nome => {
    if (st.eletti.some(e => e.nome === nome)) return;
    if (st.stato !== 'risolto' && st.candidati.indexOf(nome) >= 0) {
      ass.esito[nome] = {
        esito: 'PARITÀ — da risolvere',
        nota: st.stato === 'irrisolto' ? 'Parità dopo ' + MAX_BALLOTTAGGI + ' ballottaggi: risolvere manualmente'
          : st.stato === 'preparato' ? 'In ballottaggio ' + st.n : 'Serve il ballottaggio ' + (st.n + 1)
      };
    } else {
      ass.esito[nome] = { esito: 'Non eletto', nota: 'Non eletto al ballottaggio' };
    }
  });
  ass.tie = st.stato === 'risolto' ? null : { candidati: st.candidati.slice(), posti: st.posti, pendente: true };
}

function tieCorrente_(r, c) { return r === 1 ? datiRound1_(c).ass.tie : datiCarica_(r, c).ass.tie; }

function preparaBallottaggio() {
  const ui = ui_();
  const c = cfg_();
  if (aperta_(c)) return ui.alert('Chiudi prima la votazione aperta (' + descrContesto_(c) + ').');
  const r = roundAttivo_(c);
  const tie = tieCorrente_(r, c);
  if (!tie) return ui.alert('Nessuna parità da risolvere nel round ' + r + ' – ' + ROUND[r].nome + '. Calcola prima i risultati.');
  let st = balState_(r);
  if (st && !tie.pendente) st = null;  // risultati cambiati: nuova parità
  if (st && st.stato === 'irrisolto') return ui.alert(messaggioParita_(r, tie));
  if (st && st.stato === 'preparato') {
    if (usati_(r, st.n).length) return ui.alert('Il ballottaggio ' + st.n + ' ha già ricevuto voti: aprilo o calcolalo.');
    if (ui.alert('Ballottaggio già preparato', 'Rigenerare i link del ballottaggio ' + st.n + '? Quelli già inviati non funzioneranno più.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  } else if (st && st.stato === 'calcolato') {
    st.n += 1;
    st.stato = 'preparato';
  } else {
    const props = PropertiesService.getScriptProperties();
    for (let b = 1; b <= MAX_BALLOTTAGGI; b++) { props.deleteProperty(chiave_(r, b, 'BALLOTS')); props.deleteProperty(chiave_(r, b, 'USED')); }
    st = { orig: { candidati: tie.candidati.slice(), posti: tie.posti }, eletti: [], candidati: tie.candidati.slice(),
      posti: tie.posti, n: 1, stato: 'preparato', storico: [] };
  }

  const votanti = r === 1 ? nomiSocieta_() : commissari_().map(x => x.nome);
  if (!votanti.length) return ui.alert('Nessun votante per questo round.');
  const usati = codiciEsistenti_();
  const rows = votanti.map(v => { const k = codiceNuovo_(usati); return [v, k, link_(k), '']; });
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SH.BAL) || ss.insertSheet(SH.BAL);
  sh.clearContents();
  sh.getRange(1, 1, 1, BAL_HEADER.length).setValues([BAL_HEADER]).setFontWeight('bold').setBackground(BLU);
  sh.getRange(2, 1, rows.length, BAL_HEADER.length).setValues(rows);
  sh.getRange(rows.length + 3, 1).setValue('Round ' + r + ' – ' + ROUND[r].nome + ' · Ballottaggio ' + st.n +
    ': ' + st.posti + (st.posti === 1 ? ' posto' : ' posti') + ' tra ' + st.candidati.join(', '));
  sh.autoResizeColumns(1, BAL_HEADER.length);
  sh.activate();

  setBalState_(r, st);
  setCfg_('Round attivo', r);
  setCfg_('Ballottaggio', 0);
  ui.alert('Ballottaggio ' + st.n + ' di ' + MAX_BALLOTTAGGI + ' (round ' + r + ' – ' + ROUND[r].nome + ') preparato.\n\n' +
    'Posti: ' + st.posti + ' tra ' + st.candidati.join(', ') + '.\n' +
    'Ogni votante esprime fino a ' + st.posti + (st.posti === 1 ? ' preferenza' : ' preferenze') + '.\n\n' +
    'Nuovi link nel foglio "Ballottaggio": inviali (i link precedenti non valgono per il ballottaggio), poi "Ballottaggio → Apri".');
}

function apriBallottaggio() {
  const ui = ui_();
  const c = cfg_();
  if (aperta_(c)) return ui.alert('È aperta: ' + descrContesto_(c) + '. Chiudila prima.');
  const r = roundAttivo_(c);
  const st = balState_(r);
  if (!st || st.stato !== 'preparato') return ui.alert('Nessun ballottaggio preparato: usa "Ballottaggio → Prepara ballottaggio e nuovi link".');
  setCfg_('Ballottaggio', st.n);
  setCfg_('Stato', 'APERTA');
  ui.alert('Ballottaggio ' + st.n + ' APERTO (round ' + r + ' – ' + ROUND[r].nome + ').\nPosti: ' + st.posti +
    ' tra ' + st.candidati.join(', ') + '.');
}

function calcolaBallottaggio() {
  const ui = ui_();
  const c = cfg_();
  const r = roundAttivo_(c);
  if (aperta_(c) && ballottaggioAttivo_(c)) return ui.alert('Chiudi prima il ballottaggio.');
  const st = balState_(r);
  if (!st || st.stato !== 'preparato') return ui.alert('Nessun ballottaggio da calcolare.');

  const schede = schede_(r, st.n);
  const voti = {};
  st.candidati.forEach(n => voti[n] = 0);
  let bianche = 0;
  schede.forEach(s => { if (!s.length) bianche++; s.forEach(n => { if (n in voti) voti[n]++; }); });
  const lista = st.candidati.map(n => ({ nome: n, voti: voti[n] }))
    .sort((a, b) => b.voti - a.voti || a.nome.localeCompare(b.nome, 'it'));
  const m = st.posti;
  const soglia = lista[m - 1].voti;
  const parita = lista.length > m && lista[m].voti === soglia;
  const eletti = parita ? lista.filter(x => x.voti > soglia).map(x => x.nome) : lista.slice(0, m).map(x => x.nome);

  st.storico.push({ n: st.n, candidati: lista.map(x => x.nome), posti: m, voti: voti, schede: schede.length, bianche: bianche,
    eletti: eletti, pari: parita ? lista.filter(x => x.voti === soglia).map(x => x.nome) : [] });
  eletti.forEach(n => st.eletti.push({ nome: n, n: st.n }));
  let msg;
  if (!parita) {
    st.stato = 'risolto';
    msg = 'Ballottaggio ' + st.n + ': eletti ' + eletti.join(', ') + '. Parità risolta.';
  } else {
    st.candidati = lista.filter(x => x.voti === soglia).map(x => x.nome);
    st.posti = m - eletti.length;
    st.stato = st.n >= MAX_BALLOTTAGGI ? 'irrisolto' : 'calcolato';
    msg = 'Ballottaggio ' + st.n + ': ' + (eletti.length ? 'eletti ' + eletti.join(', ') + '; ' : '') +
      'ancora parità tra ' + st.candidati.join(', ') + ' per ' + st.posti + (st.posti === 1 ? ' posto.' : ' posti.') +
      (st.stato === 'irrisolto' ? '\n\nRaggiunto il massimo di ' + MAX_BALLOTTAGGI + ' ballottaggi: risolvere manualmente (es. sorteggio).'
        : '\n\nUsa "Ballottaggio → Prepara ballottaggio e nuovi link" per il ballottaggio ' + (st.n + 1) + '.');
  }
  setBalState_(r, st);
  setCfg_('Ballottaggio', 0);
  scriviRisultatiBallottaggi_();
  if (r === 1) calcolaRisultati_(true); else calcolaCarica_(r, true);
  ui.alert(msg);
}

function scriviRisultatiBallottaggi_() {
  const ss = SpreadsheetApp.getActive();
  const c = cfg_();
  const sh = ss.getSheetByName(SH.RB) || ss.insertSheet(SH.RB);
  sh.clearContents();
  const W = 4, rows = [], head = [];
  const R = function () { const a = Array.prototype.slice.call(arguments); while (a.length < W) a.push(''); return a.slice(0, W); };
  rows.push(R('Risultati ballottaggi — ' + String(c['Titolo'] || 'Elezione CTL') + (intestazione_(c) ? ' — ' + intestazione_(c) : '')));
  [1, 2, 3].forEach(r => {
    const st = balState_(r);
    if (!st) return;
    st.storico.forEach(b => {
      rows.push(R(''));
      rows.push(R('Round ' + r + ' – ' + ROUND[r].nome + (b.sorteggio
        ? ' · SORTEGGIO dopo ' + MAX_BALLOTTAGGI + ' ballottaggi: ' + b.posti + (b.posti === 1 ? ' posto' : ' posti') + ' tra ' + b.candidati.length + ' candidati'
        : ' · Ballottaggio ' + b.n + ': ' + b.posti + (b.posti === 1 ? ' posto' : ' posti') + ' tra ' + b.candidati.length + ' candidati')));
      head.push(rows.length);
      rows.push(R('Candidato', b.sorteggio ? 'Esito del sorteggio' : 'Voti', b.sorteggio ? '' : 'Esito'));
      const pari = b.pari || [];
      b.candidati.forEach(n => rows.push(b.sorteggio
        ? R(n, b.eletti.indexOf(n) >= 0 ? 'ELETTO (sorteggio)' : 'Non eletto')
        : R(n, b.voti[n], b.eletti.indexOf(n) >= 0 ? 'ELETTO' : (pari.indexOf(n) >= 0 ? 'Ancora in parità' : 'Non eletto'))));
      if (b.sorteggio) rows.push(R('Sorteggio eseguito il', b.quando || ''));
      else rows.push(R('Schede', b.schede, 'di cui bianche: ' + b.bianche));
    });
    rows.push(R('Stato finale round ' + r, st.sorteggiato ? 'Parità risolta per sorteggio'
      : st.stato === 'risolto' ? 'Parità risolta'
      : st.stato === 'irrisolto' ? 'Parità non risolta dopo ' + MAX_BALLOTTAGGI + ' ballottaggi: decisione manuale'
      : 'In corso (ballottaggio ' + st.n + ')'));
  });
  altezzeRighe_(sh);
  const o = scriviLogo_(sh, 1, c) ? 1 : 0;  // con il logo il contenuto parte dalla riga 2
  sh.getRange(1 + o, 1, rows.length, W).setValues(rows);
  sh.getRange(1 + o, 1).setFontWeight('bold').setFontSize(14);
  head.forEach(i => sh.getRange(i + o, 1, 1, W).setFontWeight('bold').setBackground(BLU));
  scriviLinkRepo_(sh, rows.length + 2 + o);
  sh.autoResizeColumns(1, W);
}

/* ================= Votazioni programmate ================= */

/*
 * Apertura e chiusura a tempo del voto commissari (round 1) e del voto per il
 * Presidente (round 2), tramite trigger temporali.
 *
 * Regola di chiusura: si calcola e si prosegue SOLO se hanno votato tutti gli
 * aventi diritto. Se manca anche un solo voto la votazione resta aperta e la
 * chiusura è prorogata automaticamente delle ore indicate in Config, con una
 * email che elenca chi non ha ancora votato. Le proroghe non hanno limite:
 * in qualsiasi momento si può chiudere a mano dal menu (la chiusura manuale
 * annulla il trigger pendente).
 */

function dataCfg_(c, key) {
  const v = c[key];
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const t = String(v || '').trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:[ ,]+(\d{1,2})[:.](\d{2}))?$/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function dataTesto_(d) { return d ? Utilities.formatDate(d, FUSO, 'dd/MM/yyyy HH:mm') : '—'; }

function oreProroga_(c) {
  const n = Number(String(c['Proroga automatica (ore)'] || '').toString().replace(',', '.'));
  return n > 0 ? n : 24;
}

function emailAvvisi_(c) {
  const e = String(c['Email avvisi'] || '').trim();
  if (e) return e;
  try { return Session.getEffectiveUser().getEmail(); } catch (err) { return ''; }
}

/** Invia un avviso a chi amministra l'urna; i messaggi raccolti in LOG_ finiscono in coda. */
function notifica_(oggetto, corpo) {
  const c = cfg_();
  const to = emailAvvisi_(c);
  const testo = corpo + (LOG_.length ? '\n\n— Note del sistema —\n' + LOG_.join('\n') : '') +
    '\n\n' + intestazione_(c) + '\n' + REPO_URL + ' (' + VERSIONE + ')';
  if (!to) return;
  try { MailApp.sendEmail(to, '[CTL Baskin] ' + oggetto, testo); } catch (e) { /* niente email: resta il foglio */ }
}

function eliminaTrigger_(fn) {
  ScriptApp.getProjectTriggers().forEach(t => {
    const f = t.getHandlerFunction();
    if (fn ? f === fn : TRIGGER_FN.indexOf(f) >= 0) ScriptApp.deleteTrigger(t);
  });
}

function creaTrigger_(fn, data) {
  eliminaTrigger_(fn);
  ScriptApp.newTrigger(fn).timeBased().at(data).create();
}

/** Legge dal foglio Config le quattro date della pianificazione. */
function pianificazione_(c) {
  return {
    ap1: dataCfg_(c, 'Apertura voto commissari'),
    ch1: dataCfg_(c, 'Chiusura voto commissari'),
    ap2: dataCfg_(c, 'Apertura voto presidente'),
    ch2: dataCfg_(c, 'Chiusura voto presidente')
  };
}

/** Crea i trigger a partire dalle date scritte in Config. */
function programmaVotazioni() {
  const ui = ui_();
  const c = cfg_();
  const p = pianificazione_(c);
  const ora = new Date();
  const min = new Date(ora.getTime() + 60000);
  if (!p.ap1 && !p.ch1 && !p.ch2)
    return ui.alert('Compila in Config almeno "Chiusura voto commissari" (formato gg/mm/aaaa hh:mm).');
  if (p.ap1 && p.ch1 && p.ch1 <= p.ap1) return ui.alert('La chiusura del voto commissari deve venire dopo l\'apertura.');
  if (p.ap2 && p.ch1 && p.ap2 < p.ch1) return ui.alert('L\'apertura del voto presidente non può precedere la chiusura del voto commissari.');
  if (p.ch2 && (p.ap2 || p.ch1) && p.ch2 <= (p.ap2 || p.ch1)) return ui.alert('La chiusura del voto presidente deve venire dopo la sua apertura.');

  eliminaTrigger_(null);
  const righe = [];
  if (p.ap1 && p.ap1 > min) { creaTrigger_('triggerApreCommissari', p.ap1); righe.push('Apre il voto commissari: ' + dataTesto_(p.ap1)); }
  else if (p.ap1) righe.push('Apertura voto commissari già passata: aprilo a mano dal menu.');
  if (p.ch1 && p.ch1 > min) { creaTrigger_('triggerChiudeCommissari', p.ch1); righe.push('Chiude il voto commissari: ' + dataTesto_(p.ch1)); }
  else if (p.ch1) righe.push('Chiusura voto commissari già passata: non programmata.');
  righe.push(p.ap2 ? 'Apre il voto presidente: ' + dataTesto_(p.ap2) : 'Apre il voto presidente: subito dopo la chiusura del voto commissari');
  righe.push(p.ch2 ? 'Chiude il voto presidente: ' + dataTesto_(p.ch2) : 'Chiusura voto presidente: non programmata (manuale)');
  righe.push('');
  righe.push('Se alla chiusura manca qualche voto, la votazione resta aperta e la chiusura è prorogata di ' +
    oreProroga_(c) + ' ore, con avviso a ' + (emailAvvisi_(c) || '(nessuna email impostata)') + '.');
  righe.push('In qualsiasi momento puoi chiudere a mano dal menu: la proroga automatica si ferma.');
  ui.alert('Votazioni programmate', righe.join('\n'), ui.ButtonSet.OK);
}

function mostraPianificazione() {
  const ui = ui_();
  const c = cfg_();
  const p = pianificazione_(c);
  const attivi = ScriptApp.getProjectTriggers()
    .map(t => t.getHandlerFunction())
    .filter(f => TRIGGER_FN.indexOf(f) >= 0);
  const nomi = {
    triggerApreCommissari: 'apertura voto commissari',
    triggerChiudeCommissari: 'chiusura voto commissari',
    triggerAprePresidente: 'apertura voto presidente',
    triggerChiudePresidente: 'chiusura voto presidente'
  };
  ui.alert('Pianificazione',
    'Date in Config:\n' +
    '· apertura voto commissari: ' + dataTesto_(p.ap1) + '\n' +
    '· chiusura voto commissari: ' + dataTesto_(p.ch1) + '\n' +
    '· apertura voto presidente: ' + (p.ap2 ? dataTesto_(p.ap2) : 'subito dopo la chiusura del voto commissari') + '\n' +
    '· chiusura voto presidente: ' + dataTesto_(p.ch2) + '\n' +
    '· proroga automatica: ' + oreProroga_(c) + ' ore\n' +
    '· avvisi a: ' + (emailAvvisi_(c) || '—') + '\n\n' +
    (attivi.length ? 'Programmazioni attive: ' + attivi.map(f => nomi[f]).join(', ') + '.'
      : 'Nessuna programmazione attiva: usa "Programma apertura e chiusura".'), ui.ButtonSet.OK);
}

function annullaPianificazione() {
  const ui = ui_();
  if (ui.alert('Annulla pianificazione', 'Le aperture e chiusure automatiche vengono rimosse. Le votazioni già aperte restano aperte. Procedere?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  eliminaTrigger_(null);
  ui.alert('Pianificazione annullata: da qui in poi apri e chiudi dal menu.');
}

/** Elenco di chi non ha ancora votato nel round (o ballottaggio) indicato. */
function mancanti_(r, b) {
  const used = usati_(r, b || 0);
  const map = votantiMap_(r, b || 0);
  const out = [];
  Object.keys(map).forEach(k => { if (used.indexOf(hash_(k)) < 0) out.push(map[k]); });
  return out.sort();
}

/**
 * Chiusura programmata di un round: chiude solo se hanno votato tutti,
 * altrimenti proroga e avvisa. Restituisce true se il round è stato chiuso.
 */
function chiusuraProgrammata_(r, b, fnTrigger, chiaveCfg) {
  const c = cfg_();
  const mancano = mancanti_(r, b);
  if (!mancano.length) { chiudiVotazione(); return true; }
  const ore = oreProroga_(c);
  const nuova = new Date(new Date().getTime() + ore * 3600000);
  if (chiaveCfg) setCfg_(chiaveCfg, nuova);
  creaTrigger_(fnTrigger, nuova);
  notifica_('Mancano voti: chiusura prorogata',
    'La votazione "' + ROUND[r].nome + (b ? ' — ballottaggio ' + b : '') + '" doveva chiudersi ora, ma non hanno ancora votato tutti.\n\n' +
    'Non hanno votato (' + mancano.length + '):\n· ' + mancano.join('\n· ') + '\n\n' +
    'La votazione resta APERTA e la chiusura è prorogata di ' + ore + ' ore, al ' + dataTesto_(nuova) + '.\n' +
    'Sollecita chi manca, oppure chiudi a mano dal menu (Votazione → Chiudi): la proroga si ferma e decidi tu come procedere.');
  return false;
}

function triggerApreCommissari() {
  LOG_.length = 0;
  const c = cfg_();
  if (aperta_(c)) return;
  apriRound_(1);
  const ok = aperta_(cfg_());
  notifica_(ok ? 'Voto commissari aperto' : 'Voto commissari NON aperto',
    ok ? 'Il voto per i commissari è aperto: le società possono votare con il link ricevuto.' +
         (pianificazione_(cfg_()).ch1 ? '\nChiusura prevista: ' + dataTesto_(pianificazione_(cfg_()).ch1) + '.' : '')
       : 'Non è stato possibile aprire il voto per i commissari. Controlla il foglio e apri a mano dal menu.');
}

function triggerChiudeCommissari() {
  LOG_.length = 0;
  const c = cfg_();
  if (!aperta_(c) || roundAttivo_(c) !== 1 || ballottaggioAttivo_(c)) return;  // già chiusa a mano o ballottaggio in corso
  if (!chiusuraProgrammata_(1, 0, 'triggerChiudeCommissari', 'Chiusura voto commissari')) return;

  calcolaRisultati_(true);
  if (datiRound1_(cfg_()).ass.tie) return avviaBallottaggio_(1);
  proseguiDopoRound1_();
}

/** Round 1 concluso senza parità: commissari pronti e voto per il Presidente. */
function proseguiDopoRound1_() {
  if (!preparaCommissari()) {
    notifica_('Voto commissari chiuso: controlla i risultati',
      'Il voto è chiuso e i risultati sono calcolati, ma non è stato possibile preparare i commissari. ' +
      'Controlla il foglio "Risultati" e prosegui dal menu.');
    return;
  }
  const p = pianificazione_(cfg_());
  const elenco = commissari_().map(x => '· ' + x.nome + ' — codice ' + x.codice + (link_(x.codice) ? ' — ' + link_(x.codice) : ' — link non disponibile (pubblica l\'app web)')).join('\n');
  if (p.ap2 && p.ap2 > new Date(new Date().getTime() + 60000)) {
    creaTrigger_('triggerAprePresidente', p.ap2);
    notifica_('Commissari eletti: voto Presidente il ' + dataTesto_(p.ap2),
      'Hanno votato tutte le società. I commissari eletti sono:\n' + elenco +
      '\n\nIl voto per il Presidente si aprirà il ' + dataTesto_(p.ap2) +
      (p.ch2 ? ' e si chiuderà il ' + dataTesto_(p.ch2) : '') + '.\nInvia a ogni commissario il suo link.');
    return;
  }
  apriRound_(2);
  if (p.ch2 && p.ch2 > new Date(new Date().getTime() + 60000)) creaTrigger_('triggerChiudePresidente', p.ch2);
  notifica_('Commissari eletti: voto Presidente aperto',
    'Hanno votato tutte le società. I commissari eletti sono:\n' + elenco +
    '\n\nIl voto per il Presidente è aperto' + (p.ch2 ? ' e si chiuderà il ' + dataTesto_(p.ch2) : '') +
    '.\nInvia a ogni commissario il suo link: vale anche per il voto del Vice.');
}

function triggerAprePresidente() {
  LOG_.length = 0;
  const c = cfg_();
  if (aperta_(c)) return;
  apriRound_(2);
  const p = pianificazione_(cfg_());
  if (p.ch2 && p.ch2 > new Date(new Date().getTime() + 60000)) creaTrigger_('triggerChiudePresidente', p.ch2);
  const elenco = commissari_().map(x => '· ' + x.nome + ' — codice ' + x.codice + (link_(x.codice) ? ' — ' + link_(x.codice) : ' — link non disponibile (pubblica l\'app web)')).join('\n');
  notifica_(aperta_(cfg_()) ? 'Voto Presidente aperto' : 'Voto Presidente NON aperto',
    (aperta_(cfg_()) ? 'Il voto per il Presidente è aperto' + (p.ch2 ? ', chiusura prevista il ' + dataTesto_(p.ch2) : '') + '.\n\n'
      : 'Non è stato possibile aprire il voto per il Presidente: apri a mano dal menu.\n\n') + elenco);
}

function triggerChiudePresidente() {
  LOG_.length = 0;
  const c = cfg_();
  if (!aperta_(c) || roundAttivo_(c) !== 2 || ballottaggioAttivo_(c)) return;
  if (!chiusuraProgrammata_(2, 0, 'triggerChiudePresidente', 'Chiusura voto presidente')) return;

  calcolaCarica_(2, true);
  if (datiCarica_(2, cfg_()).ass.tie) return avviaBallottaggio_(2);
  concludiPresidente_();
}

/** Voto per il Presidente concluso: risultati finali per email. */
function concludiPresidente_() {
  const d = datiCarica_(2, cfg_());
  const righe = commissari_().map(x => '· ' + x.nome + (x.squadra ? ' (' + x.squadra + ')' : ''));
  notifica_('Risultati finali: Presidente eletto',
    'Hanno votato tutti i commissari. Risultati finali:\n\n' +
    'Presidente della CTL: ' + (d.vincitore || '— nessun voto espresso —') + '\n\n' +
    'Commissari:\n' + righe.join('\n') +
    '\n\nResta da eleggere il Vice (round 3), da aprire dal menu: i commissari usano lo stesso link.');
}

/**
 * Risolve per sorteggio la parità rimasta dopo il massimo dei ballottaggi.
 * L'estrazione è registrata nel foglio "Risultati ballottaggi" e nei risultati
 * del round (nota "Eletto per sorteggio"). Restituisce i nomi estratti.
 */
function sorteggio_(r) {
  const st = balState_(r);
  if (!st || st.stato !== 'irrisolto' || !st.candidati.length) return null;
  const urna = st.candidati.slice();
  const estratti = [];
  for (let i = 0; i < st.posti && urna.length; i++) {
    const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
    estratti.push(urna.splice(((bytes[0] + 256) % 256) % urna.length, 1)[0]);
  }
  const quando = Utilities.formatDate(new Date(), FUSO, 'dd/MM/yyyy HH:mm');
  st.storico.push({ n: st.n, sorteggio: true, quando: quando, candidati: st.candidati.slice(),
    posti: st.posti, voti: {}, schede: 0, bianche: 0, eletti: estratti.slice(), pari: [] });
  estratti.forEach(n => st.eletti.push({ nome: n, n: st.n, sorteggio: true }));
  st.candidati = [];
  st.posti = 0;
  st.stato = 'risolto';
  st.sorteggiato = true;
  setBalState_(r, st);
  scriviRisultatiBallottaggi_();
  if (r === 1) calcolaRisultati_(true); else calcolaCarica_(r, true);
  return { estratti: estratti, quando: quando, esclusi: urna };
}

/** Voce di menu: sorteggio della parità residua, con conferma. */
function sorteggiaParita() {
  const ui = ui_();
  const c = cfg_();
  const r = roundAttivo_(c);
  const st = balState_(r);
  if (!st || st.stato !== 'irrisolto')
    return ui.alert('Nessuna parità da sorteggiare: il sorteggio si usa solo dopo ' + MAX_BALLOTTAGGI + ' ballottaggi senza esito.');
  if (ui.alert('Sorteggio', 'Estrarre a sorte ' + st.posti + (st.posti === 1 ? ' nome' : ' nomi') + ' fra ' +
      st.candidati.join(', ') + '? L\'esito è definitivo e viene registrato nei risultati.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const s = sorteggio_(r);
  ui.alert(s ? 'Sorteggio del ' + s.quando + ': estratti ' + s.estratti.join(', ') + '.' : 'Sorteggio non eseguito.');
}

/** Ore di durata di un ballottaggio aperto in automatico. */
function oreBallottaggio_(c) {
  const n = Number(String(c['Durata ballottaggio (ore)'] || '').toString().replace(',', '.'));
  return n > 0 ? n : 24;
}

/**
 * Parità con tutti i voti espressi: prepara e apre da solo il ballottaggio
 * successivo, con nuovi link per tutti i votanti, e ne programma la chiusura.
 */
function avviaBallottaggio_(r) {
  const prima = balState_(r);
  preparaBallottaggio();
  const st = balState_(r);
  if (!st || st.stato === 'irrisolto' || (prima && st.n === (prima.n || 0) && prima.stato === 'irrisolto'))
    return sorteggiaEProsegui_(r);
  apriBallottaggio();
  const c = cfg_();
  if (!aperta_(c) || !ballottaggioAttivo_(c)) {
    notifica_('Ballottaggio non aperto',
      'C\'è una parità nel round ' + r + ' – ' + ROUND[r].nome + ' ma non è stato possibile aprire il ballottaggio in automatico: controlla il foglio e procedi dal menu Ballottaggio.');
    return;
  }
  const ore = oreBallottaggio_(c);
  const fine = new Date(new Date().getTime() + ore * 3600000);
  creaTrigger_('triggerChiudeBallottaggio', fine);
  const sh = sheet_(SH.BAL);
  const elenco = sh.getLastRow() > 1
    ? sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().filter(x => x[0] && x[1])
        .map(x => '· ' + x[0] + ' — codice ' + x[1] + (x[2] ? ' — ' + x[2] : ' — link non disponibile')).join('\n')
    : '';
  notifica_('Parità: ballottaggio ' + st.n + ' aperto',
    'Hanno votato tutti, ma nel round ' + r + ' – ' + ROUND[r].nome + ' c\'è una parità: ' + st.posti +
    (st.posti === 1 ? ' posto' : ' posti') + ' tra ' + st.candidati.join(', ') + '.\n\n' +
    'Il ballottaggio ' + st.n + ' di ' + MAX_BALLOTTAGGI + ' è stato aperto in automatico e si chiude il ' + dataTesto_(fine) +
    ' (durata in Config → "Durata ballottaggio (ore)").\n' +
    'ATTENZIONE: i link precedenti non valgono, invia a ogni votante il SUO nuovo link:\n' + elenco);
}

/** Dopo il massimo dei ballottaggi la parità si risolve a sorte e la catena prosegue. */
function sorteggiaEProsegui_(r) {
  const s = sorteggio_(r);
  if (!s) {
    notifica_('Parità da risolvere a mano',
      'La parità del round ' + r + ' – ' + ROUND[r].nome + ' non è stata risolta e il sorteggio automatico non è riuscito: ' +
      (r === 1 ? 'scrivi l\'esito nella colonna Esito del foglio "Risultati".' : 'scrivi il nome in Config → ' + ROUND[r].cfg + '.'));
    return;
  }
  notifica_('Parità risolta per sorteggio',
    'Dopo ' + MAX_BALLOTTAGGI + ' ballottaggi la parità del round ' + r + ' – ' + ROUND[r].nome + ' è stata risolta per sorteggio (' + s.quando + ').\n\n' +
    'Estratti: ' + s.estratti.join(', ') + (s.esclusi.length ? '\nNon estratti: ' + s.esclusi.join(', ') : '') +
    '\n\nIl sorteggio è registrato nel foglio "Risultati ballottaggi" e nei risultati del round.');
  if (r === 1) proseguiDopoRound1_(); else concludiPresidente_();
}

function triggerChiudeBallottaggio() {
  LOG_.length = 0;
  const c = cfg_();
  const r = roundAttivo_(c), b = ballottaggioAttivo_(c);
  if (!aperta_(c) || !b) return;                       // già chiuso a mano
  if (!chiusuraProgrammata_(r, b, 'triggerChiudeBallottaggio', null)) return;

  calcolaBallottaggio();
  const st = balState_(r);
  if (st && st.stato === 'calcolato') return avviaBallottaggio_(r);   // parità residua: ballottaggio successivo
  if (!st || st.stato === 'irrisolto') return sorteggiaEProsegui_(r);
  notifica_('Ballottaggio ' + st.n + ' concluso',
    'Il ballottaggio ' + st.n + ' del round ' + r + ' – ' + ROUND[r].nome + ' ha risolto la parità: eletti ' +
    st.eletti.map(x => x.nome).join(', ') + '.');
  if (r === 1) proseguiDopoRound1_(); else concludiPresidente_();
}

/* ================= Report ================= */

function aggiornaReport() {
  const ss = SpreadsheetApp.getActive();
  const c = cfg_();
  const sh = ss.getSheetByName(SH.REP) || ss.insertSheet(SH.REP);
  sh.clear();
  const pres = String(c['Presidente'] || '').trim();
  const vice = String(c['Vice'] || '').trim();
  const form = String(c['Formatore di riferimento'] || '').trim();
  const com = commissari_();
  const cand = candidati_();
  const nomiCom = com.map(x => x.nome);
  const candForm = cand.filter(x => x.nome === form)[0];

  let statoForm = '';
  if (form && nomiCom.indexOf(form) >= 0) statoForm = 'Votante — componente eletto della CTL';
  else if (form && candForm) statoForm = 'Non votante — candidato non eletto al round 1';
  else if (form) statoForm = 'Non votante';
  if (candForm && !candForm.auto)
    statoForm += ' (attenzione: da regolamento il formatore votante si candida da se: indica "' + AUTOCAND + '" al posto della squadra)';

  const ballottaggi = [1, 2, 3].map(r => {
    const st = balState_(r);
    return st && st.storico.length ? ROUND[r].nome + ': ' + st.storico.length + (st.stato === 'risolto' ? ' (parità risolta)' : ' (parità aperta)') : '';
  }).filter(Boolean).join('; ');

  const R = (a, b, c3, d) => [a, b || '', c3 || '', d || ''];
  const rows = [
    R(String(c['Titolo'] || 'Elezione CTL') + (intestazione_(c) ? ' — ' + intestazione_(c) : '') + ' — Report'),
    R('Sezione Territoriale', sezione_(c) || '(non indicata)'),
    R('Anno sportivo', anno_(c) || '(non indicato)'),
    R('Aggiornato il', Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm')),
    R(''),
    R('Presidente', pres || '(da eleggere)'),
    R('Vice', vice || '(da eleggere)'),
    R('Formatore di riferimento', form || '(non indicato)', statoForm),
    R('Commissari eletti', com.length + ' su ' + posti_(c) + ' posti'),
    R('Ballottaggi svolti', ballottaggi || 'nessuno'),
    R(''),
    R('Nome', 'Qualifica', 'Squadra', 'Ruolo')
  ];
  const headRow = rows.length;
  com.forEach(x => rows.push(R(x.nome, x.qualifica, x.squadra,
    ['Commissario', x.nome === pres ? 'Presidente' : '', x.nome === vice ? 'Vice' : '',
      x.nome === form ? 'Formatore di riferimento' : ''].filter(Boolean).join(' · '))));
  if (!com.length) rows.push(R('(round 1 non ancora concluso: usa "Round 2 → Prepara commissari e link")'));
  if (form && nomiCom.indexOf(form) < 0)
    rows.push(R(form, '', candForm ? candForm.squadra : '', 'Formatore di riferimento (non votante, non componente CTL)'));

  altezzeRighe_(sh);
  const o = scriviLogo_(sh, 1, c) ? 1 : 0;
  sh.getRange(1 + o, 1, rows.length, 4).setValues(rows);
  sh.getRange(1 + o, 1).setFontWeight('bold').setFontSize(14);
  sh.getRange(6 + o, 1, 5, 1).setFontWeight('bold');
  sh.getRange(headRow + o, 1, 1, 4).setFontWeight('bold').setBackground(BLU);
  scriviLinkRepo_(sh, rows.length + 2 + o);
  sh.autoResizeColumns(1, 4);
}

/* ================= Riepilogo per il custode dell'urna ================= */

/**
 * Per ogni round e ballottaggio: aventi diritto, chi ha votato, controllo di
 * coerenza (schede = codici usati), bianche, preferenze e schede anonime.
 * A votazione APERTA mostra solo partecipazione e numero di schede.
 */
function aggiornaUrna() {
  const ss = SpreadsheetApp.getActive();
  const c = cfg_();
  const sh = ss.getSheetByName(SH.URNA) || ss.insertSheet(SH.URNA);
  sh.clear();
  const W = 4;
  const R = function () { const a = Array.prototype.slice.call(arguments); while (a.length < W) a.push(''); return a.slice(0, W); };
  const rows = [], bold = [], head = [];
  const push = (row, tipo) => { rows.push(row); if (tipo === 'b') bold.push(rows.length); if (tipo === 'h') head.push(rows.length); };

  push(R('Riepilogo per il custode dell\'urna — ' + String(c['Titolo'] || 'Elezione CTL')), 'b');
  push(R('Sezione Territoriale', sezione_(c) || '(non indicata)'));
  push(R('Anno sportivo', anno_(c) || '(non indicato)'));
  push(R('Aggiornato il', Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm')));
  push(R('Stato', descrContesto_(c) + ': ' + (aperta_(c) ? 'APERTA' : 'CHIUSA')));

  function sezione(titolo, votanti, used, schede, nomi, inCorso, ric) {
    push(R(''));
    push(R(titolo + (inCorso ? ' (IN CORSO)' : '')), 'h');
    if (!votanti.length && !schede.length) { push(R('Non ancora preparato.')); return; }
    if (votanti.length) {
      const hanno = votanti.filter(v => used.has(hash_(v.codice))).map(v => v.nome);
      const non = votanti.filter(v => !used.has(hash_(v.codice))).map(v => v.nome);
      push(R('Aventi diritto', votanti.length));
      push(R('Hanno votato', hanno.join(', ') || '—'));
      push(R('Non hanno votato', non.join(', ') || '—'));
    }
    push(R('Codici usati', used.size));
    push(R('Schede nell\'urna', schede.length,
      schede.length === used.size ? 'Controllo OK: schede = codici usati' : 'ANOMALIA: schede e codici usati non coincidono'));
    if (inCorso) { push(R('Conteggi e schede visibili dopo la chiusura.')); return; }
    push(R('Schede bianche', schede.filter(s => !s.length).length));
    const voti = {};
    nomi.forEach(n => voti[n] = 0);
    schede.forEach(s => s.forEach(n => { voti[n] = (voti[n] || 0) + 1; }));
    push(R('Candidato', 'Preferenze', 'Nota'), 'b');
    Object.keys(voti).sort((a, b) => voti[b] - voti[a] || a.localeCompare(b, 'it'))
      .forEach(n => push(R(n, voti[n], nomi.indexOf(n) < 0 ? 'Non presente tra i candidati' : '')));
    push(R('Scheda n. (ordine casuale)', 'Preferenze'), 'b');
    schede.forEach((s, i) => push(R(i + 1, s.length ? s.join(', ') : '(bianca)')));
    if (ric && ric.length) {
      push(R('Ricevute di voto (ordine alfabetico)', ric.join('  ·  '),
        'Ogni votante trova qui la propria: vuol dire che la sua scheda e nell\'urna ed e stata contata. ' +
        'La ricevuta non dice come ha votato e non corrisponde al numero di scheda qui sopra.'));
    }
  }

  const rAtt = roundAttivo_(c), bAtt = ballottaggioAttivo_(c);
  [1, 2, 3].forEach(r => {
    const votanti = r === 1
      ? (function () { const m = codiciMap_(); return Object.keys(m).map(k => ({ nome: m[k], codice: k })); })()
      : commissari_().filter(x => norm_(x.codice)).map(x => ({ nome: x.nome, codice: norm_(x.codice) }));
    sezione('Round ' + r + ' – ' + ROUND[r].nome, votanti, new Set(usati_(r, 0)), schede_(r, 0),
      candidatiRound_(r, c).map(x => x.nome), aperta_(c) && rAtt === r && !bAtt, ricevute_(r, 0));

    const st = balState_(r);
    if (!st) return;
    st.storico.forEach(b => sezione('Round ' + r + ' · Ballottaggio ' + b.n + ' (' + b.posti + (b.posti === 1 ? ' posto' : ' posti') + ')',
      [], new Set(usati_(r, b.n)), schede_(r, b.n), b.candidati, false, ricevute_(r, b.n)));
    if (st.stato === 'preparato') {
      const bal = ss.getSheetByName(SH.BAL);
      const vot = bal && bal.getLastRow() > 1
        ? bal.getRange(2, 1, bal.getLastRow() - 1, 2).getValues().filter(x => norm_(x[1])).map(x => ({ nome: String(x[0]), codice: norm_(x[1]) }))
        : [];
      sezione('Round ' + r + ' · Ballottaggio ' + st.n + ' (' + st.posti + (st.posti === 1 ? ' posto' : ' posti') + ')',
        vot, new Set(usati_(r, st.n)), schede_(r, st.n), st.candidati, aperta_(c) && rAtt === r && bAtt === st.n,
        ricevute_(r, st.n));
    }
  });

  push(R(''));
  push(R('Le schede non contengono né codice, né votante, né orario: l\'ordine è casuale e non corrisponde all\'ordine di voto.'));
  altezzeRighe_(sh);
  const o = scriviLogo_(sh, 1, c) ? 1 : 0;
  sh.getRange(1 + o, 1, rows.length, W).setValues(rows);
  sh.getRange(1 + o, 1).setFontSize(14);
  bold.forEach(i => sh.getRange(i + o, 1, 1, W).setFontWeight('bold'));
  head.forEach(i => sh.getRange(i + o, 1, 1, W).setFontWeight('bold').setBackground(BLU));
  scriviLinkRepo_(sh, rows.length + 1 + o);
  sh.autoResizeColumns(1, W);
}

/* ================= Azzeramento ================= */

function azzeraRound() {
  const ui = ui_();
  const p = ui.prompt('Azzera round', 'Quale round azzerare (compresi i suoi ballottaggi)? Scrivi 1, 2, 3 oppure TUTTI.\nLe schede cancellate non si recuperano.', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  const t = p.getResponseText().trim().toUpperCase();
  const rounds = t === 'TUTTI' ? [1, 2, 3] : ([1, 2, 3].indexOf(parseInt(t, 10)) >= 0 ? [parseInt(t, 10)] : []);
  if (!rounds.length) return ui.alert('Valore non valido.');
  const c = cfg_();
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  rounds.forEach(r => azzeraUnRound_(r, c));
  if (t === 'TUTTI') {
    props.setProperty(P_SALT, Utilities.getUuid());
    setCfg_('Stato', 'CHIUSA');
    setCfg_('Round attivo', 1);
    setCfg_('Ballottaggio', 0);
  }
  if (ss.getSheetByName(SH.RB)) scriviRisultatiBallottaggi_();
  aggiornaReport();
  aggiornaUrna();
  ui.alert('Azzerato: round ' + rounds.join(', ') + ' (con i relativi ballottaggi). I codici di società e commissari restano validi.');
}

/** Cancella schede, codici usati, ballottaggi e risultati di un solo round. */
function azzeraUnRound_(r, c) {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActive();
  props.deleteProperty(ROUND[r].ballots);
  props.deleteProperty(ROUND[r].used);
  props.deleteProperty(ROUND[r].ric);
  for (let b = 1; b <= MAX_BALLOTTAGGI; b++) {
    props.deleteProperty(chiave_(r, b, 'BALLOTS'));
    props.deleteProperty(chiave_(r, b, 'USED'));
    props.deleteProperty(chiave_(r, b, 'RIC'));
  }
  if (balState_(r) && ss.getSheetByName(SH.BAL)) ss.getSheetByName(SH.BAL).clearContents();
  props.deleteProperty('BALSTATE_' + r);
  if (roundAttivo_(c) === r) { setCfg_('Stato', 'CHIUSA'); setCfg_('Ballottaggio', 0); }
  if (r === 1) {
    const soc = sheet_(SH.SOC);
    if (soc.getLastRow() > 1) soc.getRange(2, 4, soc.getLastRow() - 1, 1).clearContent();
    const ris = sheet_(SH.RIS);
    if (ris.getLastRow() > 1) ris.getRange(2, 1, ris.getLastRow() - 1, ris.getLastColumn()).clearContent();
  } else {
    setCfg_(ROUND[r].cfg, '');
    const com = sheet_(SH.COM);
    if (com.getLastRow() > 1) com.getRange(2, COM_HEADER.indexOf(ROUND[r].col) + 1, com.getLastRow() - 1, 1).clearContent();
    const ris = ss.getSheetByName(ROUND[r].ris);
    if (ris) ris.clearContents();
  }
}

/* ================= Azzeramento totale: riuso per l'elezione successiva ================= */

/**
 * Riporta il foglio allo stato "pronto per una nuova elezione", in qualunque
 * momento e anche a votazione aperta: ferma tutto, cancella schede, codici usati,
 * ballottaggi, commissari e risultati, annulla le aperture e chiusure programmate
 * e rigenera i codici, cosi i link vecchi non funzionano piu.
 *
 * Non tocca il deployment della app web: l'indirizzo resta quello, non serve
 * ripubblicare niente. Restano anche i parametri di Config (sezione, logo,
 * interfaccia, deroghe) e, se si vuole, societa, squadre e candidati.
 */
/**
 * Motore dei tre azzeramenti. Ferma qualunque votazione in corso, annulla le
 * aperture e chiusure programmate e cancella tutto cio che riguarda la tornata:
 * schede e codici usati dei tre round e dei ballottaggi, commissari, Presidente,
 * Vice, risultati, report e riepilogo urna.
 *
 * svuotaAnagrafiche = true azzera anche societa, squadre e candidati.
 * Non tocca mai il deployment della app web ne i parametri di Config.
 */
function azzeraElezione_(svuotaAnagrafiche) {
  const ss = SpreadsheetApp.getActive();
  eliminaTrigger_(null);
  ['Apertura voto commissari', 'Chiusura voto commissari', 'Apertura voto presidente', 'Chiusura voto presidente']
    .forEach(k => setCfg_(k, ''));
  setCfg_('Stato', 'CHIUSA');

  const c = cfg_();
  [1, 2, 3].forEach(r => azzeraUnRound_(r, c));
  setCfg_('Stato', 'CHIUSA');
  setCfg_('Round attivo', 1);
  setCfg_('Ballottaggio', 0);
  setCfg_('Presidente', '');
  setCfg_('Vice', '');

  svuotaFoglio_(ss, SH.COM, COM_HEADER);
  svuotaFoglio_(ss, SH.BAL, BAL_HEADER);
  svuotaFoglio_(ss, SH.RIS, RIS_HEADER);
  svuotaFoglio_(ss, SH.MSG, MSG_HEADER);
  [SH.RP, SH.RV, SH.RB].forEach(n => { const sh = ss.getSheetByName(n); if (sh) sh.clearContents(); });

  if (svuotaAnagrafiche) {
    PropertiesService.getScriptProperties().setProperty(P_SALT, Utilities.getUuid());
    svuotaFoglio_(ss, SH.SOC, SOC_HEADER);
    svuotaFoglio_(ss, SH.SQ, SQ_HEADER);
    svuotaFoglio_(ss, SH.CAND, CAND_HEADER);
    setCfg_('Formatore di riferimento', '');
  }
  applicaValidazioni_();
}

/** Chiude il lavoro dei tre azzeramenti: rigenera i resoconti vuoti. */
function dopoAzzeramento_() {
  aggiornaReport();
  aggiornaUrna();
  messaggiSicuro_();
}

/** Rigenera i messaggi senza far fallire l'operazione in corso se qualcosa manca. */
function messaggiSicuro_() {
  try { return preparaMessaggi(); } catch (e) { return 0; }
}

/**
 * 1) Solo i risultati. Societa, squadre, candidati E CODICI restano come sono:
 * si rivota subito con i link gia inviati. Per una prova andata storta, una
 * votazione annullata o un secondo giro con gli stessi iscritti.
 */
function azzeraRisultati() {
  const ui = ui_();
  if (ui.alert('Azzera solo i risultati',
    'Interrompe qualunque votazione in corso e cancella schede, codici usati, ballottaggi, commissari eletti, ' +
    'Presidente, Vice, risultati, report e riepilogo urna.\n\n' +
    'RESTANO societa, squadre, candidati e i codici di voto: i link gia inviati continuano a funzionare e si ' +
    'puo rivotare subito con gli stessi.\n\n' +
    'Le schede cancellate non si recuperano. Procedere?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  azzeraElezione_(false);
  dopoAzzeramento_();
  ui.alert('Risultati azzerati.\n\n' + numSocieta_() + ' societa, ' + squadre_().length + ' squadre e ' +
    candidati_().length + ' candidati restano al loro posto, con i codici di prima.\n\n' +
    'Apri il round 1 quando vuoi: i votanti usano il link che hanno gia.\n' +
    'Se invece vuoi codici nuovi, lancia dopo "Rigenera TUTTI i codici e link societa".');
}

/**
 * 2) Azzeramento totale: via anche societa, squadre e candidati, per una nuova
 * elezione, un'altra Sezione Territoriale o un'altra stagione.
 */
function azzeraTutto() {
  const ui = ui_();
  if (ui.alert('Azzera tutto',
    'Interrompe qualunque votazione in corso e cancella TUTTO: schede, codici usati, ballottaggi, commissari, ' +
    'Presidente, Vice, risultati, report, riepilogo urna, aperture e chiusure programmate, e anche ' +
    'SOCIETA, SQUADRE, CANDIDATI e i loro codici.\n\n' +
    'Restano solo i parametri di Config (sezione, anno, logo, interfaccia, deroghe).\n' +
    'NON tocca la pubblicazione della app web: stesso indirizzo, nessuna ripubblicazione.\n\n' +
    'Niente di tutto questo si recupera. Procedere?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  azzeraElezione_(true);
  dopoAzzeramento_();
  ui.alert('Azzerato tutto.\n\nI fogli "Societa", "Squadre" e "Candidati" sono vuoti: compilali e poi ' +
    '"Round 1 → Genera codici e link mancanti".\n\n' +
    'La app web non e stata toccata: stesso indirizzo, nessuna ripubblicazione.');
}

/* ================= App web (votanti) ================= */

function doGet(e) {
  const c0 = cfg_();
  if (interfaccia_(c0) === 'HTML') return cartello_(c0, (e && e.parameter && e.parameter.c) || '');
  const t = HtmlService.createTemplateFromFile('Index');
  t.codice = (e && e.parameter && e.parameter.c) || '';
  t.repo = REPO_URL;
  t.versione = VERSIONE;
  t.logo = String(cfg_()['Logo pagina web'] || '').trim();
  t.proprietaLogo = PROPRIETA_LOGO;
  return t.evaluate()
    .setTitle(cfg_()['Titolo'] || 'Votazione')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Pagina mostrata dalla app Google quando per questa votazione è attiva
 * l'interfaccia HTML: non un errore, ma un cartello con il link giusto,
 * perché i vecchi link continuano a circolare nelle chat.
 */
function cartello_(c, codice) {
  const u = urlHtml_(c);
  const dest = u ? u + (norm_(codice) ? '#c=' + norm_(codice) : '') : '';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const html =
    '<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"><style>' +
    'body{margin:0;background:#ecebe5;color:#1d2433;font:17px/1.55 Georgia,"Times New Roman",serif}' +
    'main{max-width:520px;margin:0 auto;padding:40px 16px}' +
    '.k{background:#fbfaf6;border:1px solid #d9d4c7;border-radius:6px;padding:26px 20px;box-shadow:0 2px 0 #d9d4c7}' +
    'h1{font-size:1.3rem;margin:0 0 12px}p{margin:0 0 14px}' +
    'a.b{display:block;text-align:center;background:#1f4e8c;color:#fff;text-decoration:none;' +
    'font:600 17px system-ui,sans-serif;padding:14px;border-radius:6px;margin-top:18px}' +
    '.n{color:#5b6475;font:13px/1.5 system-ui,sans-serif;margin-top:18px}' +
    '</style></head><body><main><div class="k">' +
    '<h1>Si vota da un\'altra pagina</h1>' +
    '<p>Per questa votazione le schede si compilano sulla pagina web della Sezione Territoriale, ' +
    'non su questa app.</p>' +
    (dest
      ? '<a class="b" href="' + esc(dest) + '" target="_top">Vai alla pagina di voto</a>' +
        '<p class="n">Se il pulsante non funziona, copia questo indirizzo: ' + esc(dest) + '</p>'
      : '<p class="n">L\'indirizzo della pagina non è ancora stato configurato: chiedilo al Coordinatore della Sezione Tecnica.</p>') +
    '<p class="n">Il tuo codice resta lo stesso: vale su entrambe le pagine, ma si può usare una volta sola.</p>' +
    '</div></main></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(String(c['Titolo'] || 'Votazione'))
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ================= Ponte per l'interfaccia statica (GitHub Pages) ================= */

/**
 * Secondo ingresso, usato solo quando in Config l'interfaccia attiva è HTML.
 * Riceve una richiesta "semplice" (text/plain, nessuna intestazione aggiunta) per
 * non far scattare il preflight CORS, che Apps Script non sa gestire, e risponde JSON.
 * Usa le stesse funzioni della app Google, quindi stessa urna, stessi controlli,
 * stesso formato della scheda: le due porte non possono divergere.
 */
function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    switch (String(req.azione || '')) {
      case 'info': out = getInfo('html'); break;
      case 'verifica': out = verificaCodice(req.codice, 'html'); break;
      case 'voto': out = inviaVoto(req.codice, req.scelte, req.ctx, 'html'); break;
      default: out = { ok: false, err: 'Azione non riconosciuta.' };
    }
  } catch (err) {
    out = { ok: false, err: 'Richiesta non valida: ' + ((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Contesto di voto attivo: round, ballottaggio, candidati e massimo di preferenze. */
function contesto_(c) {
  const r = roundAttivo_(c), b = ballottaggioAttivo_(c);
  let cand = candidatiRound_(r, c), max = maxPrefRound_(r, c, cand.length), st = null;
  if (b) {
    st = balState_(r);
    if (!st || st.n !== b || st.stato !== 'preparato') return { r: r, b: b, cand: [], max: 0, errore: true };
    cand = st.candidati.map(n => cand.filter(x => x.nome === n)[0] || { nome: n, qualifica: '', squadra: '' });
    max = st.posti;
  }
  return { r: r, b: b, cand: cand, max: max, st: st, id: r + '-' + b };
}

function getInfo(origine) {
  const c = cfg_();
  const x = contesto_(c);
  const avviso = guardiaIngresso_(c, origine);
  const titolo = String(c['Titolo'] || 'Votazione');
  let messaggio;
  if (x.b) {
    messaggio = 'Ballottaggio ' + x.b + ' tra candidati a pari merito: ' + x.max + (x.max === 1 ? ' posto' : ' posti') +
      ' da assegnare. Esprimi fino a ' + x.max + (x.max === 1 ? ' preferenza.' : ' preferenze.');
  } else if (x.r === 1) messaggio = String(c['Messaggio'] || '');
  else if (x.r === 2) messaggio = 'Scegli il Presidente della CTL: una sola preferenza, vince chi ne ottiene di più.';
  else messaggio = 'Scegli il Vice della CTL tra i commissari rimanenti: una sola preferenza.';
  const soc = mappaSquadraSocieta_();
  return {
    ctx: x.id,
    intestazione: intestazione_(c),
    titolo: titolo + (x.r > 1 ? ' — ' + ROUND[x.r].nome : '') + (x.b ? ' — Ballottaggio ' + x.b : ''),
    sottotitolo: x.r === 1 ? 'Voto anonimo — una scheda per società' : 'Voto anonimo — una scheda per commissario',
    messaggio: messaggio,
    prefisso: ROUND[x.r].prefisso,
    aperta: aperta_(c) && !x.errore && !avviso,
    avviso: avviso || '',
    candidati: x.cand.map(k => ({
      nome: k.nome,
      qualifica: x.r === 1 ? k.qualifica : '',
      auto: !!k.auto,
      squadra: k.squadra + (soc[k.squadra] && soc[k.squadra] !== k.squadra ? ' (' + soc[k.squadra] + ')' : ''),
      // campi separati: la pagina statica raggruppa i candidati per società
      squadraNome: k.squadra,
      societa: soc[k.squadra] || ''
    })),
    max: x.max,
    // identita della votazione: ogni Sezione Territoriale ha la sua CTL
    sezione: sezione_(c),
    anno: anno_(c),
    logo: String(c['Logo pagina web'] || '').trim(),
    proprietaLogo: PROPRIETA_LOGO,
    repo: REPO_URL,
    versione: VERSIONE,
    programma: testoProgramma_(c),
    eletti: x.r === 1 && !x.b ? posti_(c) : 0,
    maxAiuti: x.r === 1 && !x.b ? maxAiuti_(c) : 0
  };
}

/** Frase da mostrare ai votanti quando apertura o chiusura sono programmate. */
function testoProgramma_(c) {
  const p = pianificazione_(c);
  const r = roundAttivo_(c), ora = new Date();
  if (aperta_(c)) {
    const fine = r === 1 ? p.ch1 : r === 2 ? p.ch2 : null;
    return fine && fine > ora ? 'La votazione si chiude il ' + dataTesto_(fine) + '.' : '';
  }
  const inizio = r === 2 ? (p.ap2 || null) : p.ap1;
  if (inizio && inizio > ora) return 'La votazione apre il ' + dataTesto_(inizio) + '.';
  if (r === 1 && p.ch1 && p.ch1 > ora) return 'La votazione apre a breve e si chiude il ' + dataTesto_(p.ch1) + '.';
  return '';
}

function verificaCodice(codice, origine) {
  const c = cfg_();
  const avviso = guardiaIngresso_(c, origine);
  if (avviso) return { ok: false, err: avviso, motivo: 'interfaccia' };
  if (!aperta_(c)) return { ok: false, err: 'La votazione non è aperta.', motivo: 'chiusa' };
  const x = contesto_(c);
  if (x.errore) return { ok: false, err: 'Votazione non disponibile.', motivo: 'chiusa' };
  const chi = votantiMap_(x.r, x.b)[norm_(codice)];
  // motivo "codice": e il solo caso che conta per il blocco dopo tre tentativi
  if (!chi) return { ok: false, motivo: 'codice', err: x.b ? 'Codice non valido per il ballottaggio: serve il nuovo link ricevuto per il ballottaggio.' : 'Codice non valido per la votazione in corso.' };
  if (usati_(x.r, x.b).indexOf(hash_(codice)) >= 0) return { ok: false, err: 'Con questo codice è già stato espresso il voto.', motivo: 'usato' };
  return { ok: true, votante: chi, ctx: x.id };
}

function inviaVoto(codice, scelte, ctx, origine) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const v = verificaCodice(codice, origine);
    if (!v.ok) return v;
    if (ctx && String(ctx) !== v.ctx) return { ok: false, err: 'Nel frattempo la votazione è cambiata: ricarica la pagina.' };
    const c = cfg_();
    const x = contesto_(c);
    const nomi = x.cand.map(k => k.nome);
    if (!Array.isArray(scelte)) return { ok: false, err: 'Scheda non valida.' };
    const sel = Array.from(new Set(scelte.map(String)));
    if (sel.length !== scelte.length || sel.some(s => nomi.indexOf(s) < 0))
      return { ok: false, err: 'Scheda non valida: ricarica la pagina.' };
    if (sel.length > x.max) return { ok: false, err: 'Puoi esprimere al massimo ' + x.max + (x.max === 1 ? ' preferenza.' : ' preferenze.') };

    const schede = schede_(x.r, x.b);
    schede.splice(Math.floor(Math.random() * (schede.length + 1)), 0, sel.sort());
    const used = usati_(x.r, x.b);
    used.push(hash_(codice));
    used.sort();
    // la ricevuta va in un elenco suo, mescolato a parte: cosi non si puo
    // risalire dalla ricevuta alla scheda confrontando le posizioni
    const ric = ricevute_(x.r, x.b);
    const mia = ricevutaNuova_(ric);
    ric.push(mia);
    ric.sort();
    PropertiesService.getScriptProperties().setProperties({
      [chiave_(x.r, x.b, 'BALLOTS')]: JSON.stringify(schede), [chiave_(x.r, x.b, 'USED')]: JSON.stringify(used),
      [chiave_(x.r, x.b, 'RIC')]: JSON.stringify(ric)
    });
    return { ok: true, votante: v.votante, ricevuta: mia };
  } finally {
    lock.releaseLock();
  }
}

/* ================= Utilità ================= */

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Foglio "' + name + '" mancante: usa Votazione → Inizializza / aggiorna fogli.');
  return sh;
}

function colonna_(sh, col) {
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, col, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]).trim()).filter(Boolean);
}

function cfg_() {
  const sh = sheet_(SH.CONFIG);
  const m = {};
  sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 2).getValues()
    .forEach(r => { if (r[0]) m[String(r[0]).trim()] = r[1]; });
  return m;
}

function setCfg_(key, val) {
  const sh = sheet_(SH.CONFIG);
  const keys = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues();
  const i = keys.findIndex(r => String(r[0]).trim() === key);
  if (i >= 0) sh.getRange(i + 1, 2).setValue(val);
  else sh.appendRow([key, val, '']);
}

function cfgCell_(key) {
  const sh = sheet_(SH.CONFIG);
  const keys = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues();
  const i = keys.findIndex(r => String(r[0]).trim() === key);
  return sh.getRange(i >= 0 ? i + 1 : sh.getLastRow() + 1, 2);
}

function sezione_(c) { return String(c['Sezione Territoriale'] || c['Sezione territoriale'] || '').trim(); }

function anno_(c) {
  const v = c['Anno sportivo'];
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Rome', 'yyyy/MM');
  return String(v || '').trim();
}

/** "Sezione Territoriale X · Anno sportivo Y" (solo le parti compilate). */
function intestazione_(c) {
  return [sezione_(c) ? 'Sezione Territoriale ' + sezione_(c) : '', anno_(c) ? 'Anno sportivo ' + anno_(c) : '']
    .filter(Boolean).join(' · ');
}

/** Riga con link cliccabile al codice sorgente (trasparenza) e nota di proprietà del logo. */
function scriviLinkRepo_(sh, riga) {
  const testo = 'Codice sorgente aperto e verificabile (licenza MIT, versione ' + VERSIONE + '): ' + REPO_URL +
    ' · ' + PROPRIETA_LOGO;
  const da = testo.indexOf(REPO_URL);
  const rt = SpreadsheetApp.newRichTextValue().setText(testo).setLinkUrl(da, da + REPO_URL.length, REPO_URL).build();
  sh.getRange(riga, 1).setRichTextValue(rt).setFontSize(9);
}

/** Logo in una cella (formula IMAGE, adattato alla cella). Restituisce true se inserito. */
function scriviLogo_(sh, riga, c) {
  const url = String((c || cfg_())['Logo fogli (PNG)'] || '').trim();
  if (!/^https:\/\//i.test(url)) return false;
  sh.getRange(riga, 1).setFormula('=IMAGE("' + url.replace(/"/g, '') + '", 1)');
  sh.setRowHeight(riga, 110);
  return true;
}

/** Piede dei fogli tabellari: logo e, sotto, il link al codice sorgente. */
function scriviPiede_(sh, riga, c) {
  const logo = scriviLogo_(sh, riga, c);
  scriviLinkRepo_(sh, riga + (logo ? 1 : 0));
}

/** Riporta tutte le righe all'altezza standard (il logo alza la sua riga). */
function altezzeRighe_(sh) {
  try { sh.setRowHeights(1, sh.getMaxRows(), 21); } catch (e) {}
}

function aperta_(c) { return String(c['Stato']).trim().toUpperCase() === 'APERTA'; }

function roundAttivo_(c) {
  const r = parseInt(c['Round attivo'], 10);
  return ROUND[r] ? r : 1;
}

function ballottaggioAttivo_(c) {
  const b = parseInt(c['Ballottaggio'], 10);
  return b >= 1 && b <= MAX_BALLOTTAGGI ? b : 0;
}

/** Trova le colonne del foglio Candidati dall'intestazione (robusto a spostamenti). */
function headers_(sh) {
  const h = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(x => String(x).toLowerCase());
  const find = p => { const i = h.findIndex(x => x.indexOf(p) === 0); return i >= 0 ? i + 1 : 0; };
  return { nome: find('candidat') || 1, qualifica: find('qualific'), squadra: find('squadr'), anni: find('anni') };
}

function candidati_() {
  const sh = sheet_(SH.CAND);
  if (sh.getLastRow() < 2) return [];
  const h = headers_(sh);
  const v = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  const col = (r, i) => i ? r[i - 1] : '';
  return v.filter(r => String(col(r, h.nome)).trim()).map(r => {
    const q = String(col(r, h.qualifica)).trim();
    return {
      nome: String(col(r, h.nome)).trim(),
      qualifica: q,
      aiuto: /aiuto/i.test(q),
      squadra: String(col(r, h.squadra)).trim(),
      auto: /autocand/i.test(String(col(r, h.squadra))),
      anni: Number(col(r, h.anni)) || 0
    };
  });
}

function squadre_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.SQ);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
    .filter(r => String(r[0]).trim())
    .map(r => ({ squadra: String(r[0]).trim(), societa: String(r[1]).trim() }));
}

function mappaSquadraSocieta_() {
  const brevi = nomiBrevi_(), m = {};
  squadre_().forEach(x => m[x.squadra] = brevi[x.societa] || x.societa);
  return m;
}

/**
 * Ragione sociale -> nome breve. Nel foglio "Societa" la prima colonna porta la
 * ragione sociale esatta, che serve per gli atti ma e illeggibile in un messaggio
 * o in un elenco; il nome breve e quello con cui la societa si chiama davvero, ed
 * e quello che compare ai votanti, nei messaggi e nei resoconti.
 */
function nomiBrevi_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.SOC);
  const m = {};
  if (!sh || sh.getLastRow() < 2) return m;
  const n = sh.getLastRow() - 1;
  const rag = sh.getRange(2, 1, n, 1).getValues();
  const br = sh.getLastColumn() >= 5 ? sh.getRange(2, 5, n, 1).getValues() : rag.map(() => ['']);
  rag.forEach((r, i) => {
    const k = String(r[0]).trim();
    if (k) m[k] = String(br[i][0]).trim() || k;
  });
  return m;
}

/** Nomi brevi delle societa, nell'ordine del foglio. */
function nomiSocieta_() {
  const brevi = nomiBrevi_();
  return colonna_(sheet_(SH.SOC), 1).map(x => brevi[x] || x);
}

function maxPref_(c, n) {
  const v = parseInt(c['Max preferenze'], 10);
  return v > 0 ? Math.min(v, n) : Math.ceil(n / 2);
}

function maxAiuti_(c) {
  const v = parseInt(c['Max aiuti allenatore'], 10);
  return isNaN(v) ? 1 : Math.max(v, 0);
}

/**
 * Numero di eletti. Se "Numero eletti" è compilato vale quello; altrimenti
 * regola CTL: metà delle società partecipanti arrotondata per eccesso,
 * minimo 3, massimo 6.
 */
function posti_(c) {
  const v = parseInt(c['Numero eletti'], 10);
  if (v > 0) return v;
  return Math.min(6, Math.max(3, Math.ceil(numSocieta_() / 2)));
}

function numSocieta_() { return colonna_(sheet_(SH.SOC), 1).length; }

function postiRound_(r, c) { return r === 1 ? posti_(c) : 1; }
function maxPrefRound_(r, c, n) { return r === 1 ? maxPref_(c, n) : 1; }

/** Candidati di ogni round: 1 = foglio Candidati; 2 = tutti i commissari; 3 = commissari tranne il Presidente. */
function candidatiRound_(r, c) {
  if (r === 1) return candidati_();
  const anni = {};
  candidati_().forEach(x => anni[x.nome] = x.anni);
  let com = commissari_().map(x => ({ nome: x.nome, qualifica: x.qualifica, squadra: x.squadra, aiuto: false, anni: anni[x.nome] || 0 }));
  if (r === 3) {
    const pres = String(c['Presidente'] || '').trim();
    if (!pres) return [];
    com = com.filter(x => x.nome !== pres);
  }
  return com;
}

function commissari_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.COM);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues()
    .filter(r => String(r[0]).trim())
    .map(r => ({ nome: String(r[0]).trim(), qualifica: String(r[1]).trim(), squadra: String(r[2]).trim(), codice: String(r[3]).trim() }));
}

function norm_(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function hash_(codice) {
  const salt = PropertiesService.getScriptProperties().getProperty(P_SALT) || '';
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + norm_(codice), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(b);
}

/** Codici delle società (round 1): codice normalizzato → società. */
function codiciMap_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.SOC);
  const m = {};
  if (!sh || sh.getLastRow() < 2) return m;
  const brevi = nomiBrevi_();
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
    .forEach(r => { const k = norm_(r[1]); const rag = String(r[0]).trim(); if (k && rag) m[k] = brevi[rag] || rag; });
  return m;
}

/** Votanti del contesto: società (round 1), commissari (round 2 e 3), foglio Ballottaggio (ballottaggi). */
function votantiMap_(r, b) {
  const m = {};
  if (b) {
    const sh = SpreadsheetApp.getActive().getSheetByName(SH.BAL);
    if (sh && sh.getLastRow() > 1)
      sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(x => { const k = norm_(x[1]); if (k && String(x[0]).trim()) m[k] = String(x[0]).trim(); });
    return m;
  }
  if (r === 1) return codiciMap_();
  commissari_().forEach(x => { const k = norm_(x.codice); if (k) m[k] = x.nome; });
  return m;
}

function chiave_(r, b, tipo) {
  if (!b) return tipo === 'BALLOTS' ? ROUND[r].ballots : (tipo === 'RIC' ? ROUND[r].ric : ROUND[r].used);
  return 'BAL_' + r + '_' + b + '_' + tipo;
}

/** Ricevute del round (o ballottaggio): una per scheda, in ordine casuale. */
function ricevute_(r, b) { return JSON.parse(PropertiesService.getScriptProperties().getProperty(chiave_(r, b || 0, 'RIC')) || '[]'); }

/**
 * Ricevuta di voto: un codice casuale, generato al momento del deposito e
 * scollegato sia dal codice del votante sia dal contenuto della scheda. Serve
 * solo a far ritrovare al votante la propria riga nel riepilogo dell'urna, per
 * sapere che la sua scheda e stata contata. Non dice COME ha votato: e proprio
 * quello che rende possibile tenerla anonima.
 */
function ricevutaNuova_(gia) {
  for (let i = 0; i < 500; i++) {
    const n = Utilities.getUuid().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const k = n.slice(0, 4) + '-' + n.slice(4, 8);
    if (gia.indexOf(k) < 0) return k;
  }
  return 'R' + new Date().getTime();
}
function schede_(r, b) { return JSON.parse(PropertiesService.getScriptProperties().getProperty(chiave_(r, b || 0, 'BALLOTS')) || '[]'); }
function usati_(r, b) { return JSON.parse(PropertiesService.getScriptProperties().getProperty(chiave_(r, b || 0, 'USED')) || '[]'); }
