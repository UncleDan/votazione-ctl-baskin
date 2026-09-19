/**
 * Votazione CTL Baskin — voto online anonimo, un voto per società
 * v8 — Google Apps Script legato a un Foglio Google
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
  RP: 'Risultati Presidente', RV: 'Risultati Vice', REP: 'Report', URNA: 'Riepilogo urna'
};
const REPO_URL = 'https://github.com/UncleDan/votazione-ctl-baskin';
const VERSIONE = 'v8';
const LOGO_SVG = 'https://eisi.it/wp-content/uploads/2026/09/logo-eisi-epp-cip.svg';
const LOGO_PNG = 'https://eisi.it/wp-content/uploads/2026/09/logo-eisi-epp-cip.png';
const PROPRIETA_LOGO = 'Logo © Ente Italiano Sport Inclusivi (EISI), tutti i diritti riservati';
const P_SALT = 'SALT';
const MAX_BALLOTTAGGI = 3;
const ROUND = {
  1: { nome: 'Commissari CTL', ballots: 'BALLOTS', used: 'USED', prefisso: 'Stai votando per la società: ' },
  2: { nome: 'Presidente CTL', ballots: 'BALLOTS_2', used: 'USED_2', ris: SH.RP, col: 'Votato Presidente', cfg: 'Presidente', prefisso: 'Stai votando come: ' },
  3: { nome: 'Vice CTL', ballots: 'BALLOTS_3', used: 'USED_3', ris: SH.RV, col: 'Votato Vice', cfg: 'Vice', prefisso: 'Stai votando come: ' }
};
const SOC_HEADER = ['Società', 'Codice', 'Link diretto di voto', 'Ha votato'];
const SQ_HEADER = ['Squadra', 'Società'];
const CAND_HEADER = ['Candidato', 'Qualifica', 'Squadra', 'Anni tesseramento/incarichi (spareggio)', 'Note'];
const COM_HEADER = ['Commissario', 'Qualifica', 'Squadra', 'Codice', 'Link diretto di voto', 'Votato Presidente', 'Votato Vice'];
const BAL_HEADER = ['Votante', 'Codice ballottaggio', 'Link diretto di voto', 'Ha votato'];
const RIS_HEADER = ['Posizione', 'Candidato', 'Qualifica', 'Squadra', 'Preferenze', 'Anni (spareggio)', 'Esito', 'Note'];
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente 0/O, 1/I
const QUALIFICHE = ['Allenatore', 'Aiuto allenatore', 'Autocandidatura'];
const BLU = '#e8eaf6';

/* ================= Menu ================= */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🗳️ Votazione')
    .addItem('Inizializza / aggiorna fogli', 'setup')
    .addSubMenu(ui.createMenu('Round 1 – Commissari CTL')
      .addItem('Genera codici e link società', 'generaCodici')
      .addItem('Apri', 'apri1')
      .addItem('Chiudi', 'chiudiVotazione')
      .addItem('Calcola risultati', 'calcola1'))
    .addSubMenu(ui.createMenu('Round 2 – Presidente')
      .addItem('Prepara commissari e link', 'preparaCommissari')
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
      .addItem('Calcola ballottaggio', 'calcolaBallottaggio'))
    .addSeparator()
    .addItem('Aggiorna partecipazione', 'aggiornaPartecipazione')
    .addItem('Aggiorna report', 'aggiornaReport')
    .addItem('Aggiorna riepilogo urna', 'aggiornaUrna')
    .addItem('Azzera round…', 'azzeraRound')
    .addToUi();
}

function apri1() { apriRound_(1); }
function apri2() { apriRound_(2); }
function apri3() { apriRound_(3); }
function calcola1() { calcolaRisultati_(false); }
function calcola2() { calcolaCarica_(2, false); }
function calcola3() { calcolaCarica_(3, false); }

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
    ['Max aiuti allenatore', 1, 'Deroga: aiuti allenatore ammessi, solo se mancano allenatori/autocandidature'],
    ['Messaggio', 'Seleziona i candidati a cui dai la preferenza.', 'Testo sopra la scheda (round 1)'],
    ['Formatore di riferimento', '', 'Nome, senza votazione. Se vuole essere votante va inserito anche tra i Candidati come Autocandidatura'],
    ['Presidente', '', 'Compilato dal round 2; parità non risolte: scrivilo a mano'],
    ['Vice', '', 'Compilato dal round 3; parità non risolte: scrivilo a mano'],
    ['Logo pagina web', LOGO_SVG, 'URL del logo sulla pagina di voto (hotlinking, SVG o PNG). Vuoto = nessun logo'],
    ['Logo fogli (PNG)', LOGO_PNG, 'URL del logo nei resoconti: i fogli Google non mostrano SVG, serve PNG/JPG. Vuoto = nessun logo']
  ].forEach(r => ensureCfgRow_(r[0], r[1], r[2]));
  cfgCell_('Anno sportivo').setNumberFormat('@');  // testo: "2026/27" non diventa una data

  ensureSheet_(ss, SH.SOC, SOC_HEADER);
  ensureSheet_(ss, SH.SQ, SQ_HEADER);
  const cand = ensureSheet_(ss, SH.CAND, CAND_HEADER);
  if (!headers_(cand).qualifica) {  // v1/v2: Candidato | Anni | Note
    cand.insertColumnsAfter(1, 2);
    cand.getRange(1, 2, 1, 2).setValues([['Qualifica', 'Squadra']]).setFontWeight('bold').setBackground(BLU);
  }
  ensureSheet_(ss, SH.COM, COM_HEADER);
  ensureSheet_(ss, SH.RIS, RIS_HEADER);

  applicaValidazioni_();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(P_SALT)) props.setProperty(P_SALT, Utilities.getUuid());
  SpreadsheetApp.getUi().alert(
    'Fogli pronti.\n\n1) "Società": una riga per società (una riga = un voto).\n' +
    '2) "Squadre": squadra e società di appartenenza.\n' +
    '3) "Candidati": nome, qualifica, squadra, anni.\n' +
    '4) Round 1 → "Genera codici e link società".' + (avvisi.length ? '\n\n' + avvisi.join('\n\n') : ''));
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
  cand.getRange(2, h.squadra, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(sq.getRange('A2:A'), true).setAllowInvalid(true).build());
  sq.getRange(2, 2, Math.max(sq.getMaxRows() - 1, 1), 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(soc.getRange('A2:A'), true).setAllowInvalid(true).build());
}

/* ================= Round 1: codici società ================= */

function generaCodici() {
  const ui = SpreadsheetApp.getUi();
  const soc = sheet_(SH.SOC);
  // aggiunge le società indicate in "Squadre" ma non ancora elencate
  const presenti = new Set(colonna_(soc, 1).map(x => x.toLowerCase()));
  squadre_().forEach(x => {
    if (x.societa && !presenti.has(x.societa.toLowerCase())) {
      presenti.add(x.societa.toLowerCase());
      soc.appendRow([x.societa, '', '', '']);
    }
  });
  const n = soc.getLastRow() - 1;
  if (n < 1) return ui.alert('Inserisci le società nel foglio "Società" (o la società di ogni squadra in "Squadre").');
  const rows = soc.getRange(2, 1, n, 3).getValues();
  const usati = codiciEsistenti_();
  let nuovi = 0;
  rows.forEach(r => {
    if (!String(r[0]).trim()) { r[2] = ''; return; }
    if (!norm_(r[1])) { r[1] = codiceNuovo_(usati); nuovi++; }
    r[2] = link_(r[1]);
  });
  soc.getRange(2, 1, n, 3).setValues(rows);
  applicaValidazioni_();
  ui.alert(nuovi + ' nuovi codici generati, link aggiornati. Società aventi diritto: ' + numSocieta_() +
    ' → commissari da eleggere: ' + posti_(cfg_()) + '.' +
    (link_('X') ? '\n\nInvia a ogni società solo il SUO link.'
      : '\n\nLink non disponibili: pubblica prima l\'app web (Esegui il deployment → App web), poi rilancia questa voce.'));
}

function codiceCasuale_() {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO[(bytes[i] + 256) % ALFABETO.length];
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

function link_(cod) {
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  return url ? url + '?c=' + norm_(cod) : '';
}

/* ================= Apertura / chiusura ================= */

function apriRound_(r) {
  const ui = SpreadsheetApp.getUi();
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
    if (!Object.keys(codiciMap_()).length) return ui.alert('Nessun codice: usa "Round 1 → Genera codici e link società".');
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

function chiudiVotazione() {
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
  const ui = SpreadsheetApp.getUi();
  const c = cfg_();
  if (aperta_(c)) return ui.alert('Chiudi prima la votazione aperta.');
  const ris = sheet_(SH.RIS);
  if (ris.getLastRow() < 2) return ui.alert('Calcola prima i risultati del round 1.');
  const h = ris.getRange(1, 1, 1, ris.getLastColumn()).getValues()[0].map(x => String(x).toLowerCase());
  const col = p => h.findIndex(x => x.indexOf(p) === 0);
  const iN = col('candidat'), iQ = col('qualific'), iS = col('squadr'), iE = col('esito');
  const v = ris.getRange(2, 1, ris.getLastRow() - 1, ris.getLastColumn()).getValues();
  if (v.some(r => /^PARIT/i.test(String(r[iE]))))
    return ui.alert('Ci sono parità da risolvere in "Risultati": usa il menu Ballottaggio oppure scrivi a mano ELETTO o Non eletto nella colonna Esito.');
  const eletti = v.filter(r => /^ELETT/i.test(String(r[iE])) && String(r[iN]).trim());
  if (!eletti.length) return ui.alert('Nessun eletto in "Risultati".');

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
  const ui = SpreadsheetApp.getUi();
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
 * - allenatori e autocandidature entrano per primi, in ordine di preferenze
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
    B.forEach(x => esito[x.nome].nota = 'Aiuto allenatore: entra solo se mancano allenatori/autocandidature');
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
  const ui = SpreadsheetApp.getUi();
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
  st.eletti.forEach(e => ass.esito[e.nome] = { esito: 'ELETTO', nota: 'Eletto al ballottaggio ' + e.n });
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
  const ui = SpreadsheetApp.getUi();
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

  const votanti = r === 1 ? colonna_(sheet_(SH.SOC), 1) : commissari_().map(x => x.nome);
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
  const ui = SpreadsheetApp.getUi();
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
  const ui = SpreadsheetApp.getUi();
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
      rows.push(R('Round ' + r + ' – ' + ROUND[r].nome + ' · Ballottaggio ' + b.n + ': ' + b.posti +
        (b.posti === 1 ? ' posto' : ' posti') + ' tra ' + b.candidati.length + ' candidati'));
      head.push(rows.length);
      rows.push(R('Candidato', 'Voti', 'Esito'));
      const pari = b.pari || [];
      b.candidati.forEach(n => rows.push(R(n, b.voti[n],
        b.eletti.indexOf(n) >= 0 ? 'ELETTO' : (pari.indexOf(n) >= 0 ? 'Ancora in parità' : 'Non eletto'))));
      rows.push(R('Schede', b.schede, 'di cui bianche: ' + b.bianche));
    });
    rows.push(R('Stato finale round ' + r, st.stato === 'risolto' ? 'Parità risolta'
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
  if (candForm && !/autocand/i.test(candForm.qualifica))
    statoForm += ' (attenzione: da regolamento il formatore votante si candida come Autocandidatura)';

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

  function sezione(titolo, votanti, used, schede, nomi, inCorso) {
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
  }

  const rAtt = roundAttivo_(c), bAtt = ballottaggioAttivo_(c);
  [1, 2, 3].forEach(r => {
    const votanti = r === 1
      ? (function () { const m = codiciMap_(); return Object.keys(m).map(k => ({ nome: m[k], codice: k })); })()
      : commissari_().filter(x => norm_(x.codice)).map(x => ({ nome: x.nome, codice: norm_(x.codice) }));
    sezione('Round ' + r + ' – ' + ROUND[r].nome, votanti, new Set(usati_(r, 0)), schede_(r, 0),
      candidatiRound_(r, c).map(x => x.nome), aperta_(c) && rAtt === r && !bAtt);

    const st = balState_(r);
    if (!st) return;
    st.storico.forEach(b => sezione('Round ' + r + ' · Ballottaggio ' + b.n + ' (' + b.posti + (b.posti === 1 ? ' posto' : ' posti') + ')',
      [], new Set(usati_(r, b.n)), schede_(r, b.n), b.candidati, false));
    if (st.stato === 'preparato') {
      const bal = ss.getSheetByName(SH.BAL);
      const vot = bal && bal.getLastRow() > 1
        ? bal.getRange(2, 1, bal.getLastRow() - 1, 2).getValues().filter(x => norm_(x[1])).map(x => ({ nome: String(x[0]), codice: norm_(x[1]) }))
        : [];
      sezione('Round ' + r + ' · Ballottaggio ' + st.n + ' (' + st.posti + (st.posti === 1 ? ' posto' : ' posti') + ')',
        vot, new Set(usati_(r, st.n)), schede_(r, st.n), st.candidati, aperta_(c) && rAtt === r && bAtt === st.n);
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
  const ui = SpreadsheetApp.getUi();
  const p = ui.prompt('Azzera round', 'Quale round azzerare (compresi i suoi ballottaggi)? Scrivi 1, 2, 3 oppure TUTTI.\nLe schede cancellate non si recuperano.', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  const t = p.getResponseText().trim().toUpperCase();
  const rounds = t === 'TUTTI' ? [1, 2, 3] : ([1, 2, 3].indexOf(parseInt(t, 10)) >= 0 ? [parseInt(t, 10)] : []);
  if (!rounds.length) return ui.alert('Valore non valido.');
  const props = PropertiesService.getScriptProperties();
  const c = cfg_();
  const ss = SpreadsheetApp.getActive();
  rounds.forEach(r => {
    props.deleteProperty(ROUND[r].ballots);
    props.deleteProperty(ROUND[r].used);
    for (let b = 1; b <= MAX_BALLOTTAGGI; b++) { props.deleteProperty(chiave_(r, b, 'BALLOTS')); props.deleteProperty(chiave_(r, b, 'USED')); }
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
  });
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

/* ================= App web (votanti) ================= */

function doGet(e) {
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

function getInfo() {
  const c = cfg_();
  const x = contesto_(c);
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
    aperta: aperta_(c) && !x.errore,
    candidati: x.cand.map(k => ({
      nome: k.nome,
      qualifica: x.r === 1 ? k.qualifica : '',
      squadra: k.squadra + (soc[k.squadra] && soc[k.squadra] !== k.squadra ? ' (' + soc[k.squadra] + ')' : '')
    })),
    max: x.max,
    eletti: x.r === 1 && !x.b ? posti_(c) : 0,
    maxAiuti: x.r === 1 && !x.b ? maxAiuti_(c) : 0
  };
}

function verificaCodice(codice) {
  const c = cfg_();
  if (!aperta_(c)) return { ok: false, err: 'La votazione non è aperta.' };
  const x = contesto_(c);
  if (x.errore) return { ok: false, err: 'Votazione non disponibile.' };
  const chi = votantiMap_(x.r, x.b)[norm_(codice)];
  if (!chi) return { ok: false, err: x.b ? 'Codice non valido per il ballottaggio: serve il nuovo link ricevuto per il ballottaggio.' : 'Codice non valido per la votazione in corso.' };
  if (usati_(x.r, x.b).indexOf(hash_(codice)) >= 0) return { ok: false, err: 'Con questo codice è già stato espresso il voto.' };
  return { ok: true, votante: chi, ctx: x.id };
}

function inviaVoto(codice, scelte, ctx) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const v = verificaCodice(codice);
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
    PropertiesService.getScriptProperties().setProperties({
      [chiave_(x.r, x.b, 'BALLOTS')]: JSON.stringify(schede), [chiave_(x.r, x.b, 'USED')]: JSON.stringify(used)
    });
    return { ok: true, votante: v.votante };
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
  const m = {};
  squadre_().forEach(x => m[x.squadra] = x.societa);
  return m;
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
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
    .forEach(r => { const k = norm_(r[1]); if (k && String(r[0]).trim()) m[k] = String(r[0]).trim(); });
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
  if (!b) return tipo === 'BALLOTS' ? ROUND[r].ballots : ROUND[r].used;
  return 'BAL_' + r + '_' + b + '_' + tipo;
}
function schede_(r, b) { return JSON.parse(PropertiesService.getScriptProperties().getProperty(chiave_(r, b || 0, 'BALLOTS')) || '[]'); }
function usati_(r, b) { return JSON.parse(PropertiesService.getScriptProperties().getProperty(chiave_(r, b || 0, 'USED')) || '[]'); }
