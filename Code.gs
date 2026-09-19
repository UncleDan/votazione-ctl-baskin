/**
 * Votazione CTL Baskin — voto online anonimo, un voto per squadra
 * v6 — Google Apps Script legato a un Foglio Google
 *
 * Codice sorgente: https://github.com/UncleDan/votazione-ctl-baskin
 * Copyright (c) 2026 Daniele Lolli (UncleDan) — Licenza MIT (vedi LICENSE)
 * SPDX-License-Identifier: MIT
 *
 * Round 1: le squadre eleggono i commissari CTL (qualifiche, deroga aiuto
 *          allenatore, regola metà squadre min 3 max 6).
 * Round 2: i commissari eletti eleggono il Presidente (maggioranza semplice).
 * Round 3: i commissari eleggono il Vice tra i rimanenti.
 * Formatore di riferimento: indicato senza votazione (Config); se votante
 * deve candidarsi al round 1 come Autocandidatura.
 * Report: eletti, Presidente, Vice, Formatore di riferimento.
 * Riepilogo urna: conteggi, partecipazione e schede anonime per il custode.
 *
 * Anonimato: le schede sono salvate nelle Script Properties (non nel foglio,
 * quindi senza cronologia versioni), senza codice né orario, e inserite in
 * posizione casuale. Dei codici usati si conserva solo un hash con sale.
 */

const SH = {
  CONFIG: 'Config', CAND: 'Candidati', COD: 'Squadre', RIS: 'Risultati',
  COM: 'Commissari', RP: 'Risultati Presidente', RV: 'Risultati Vice', REP: 'Report', URNA: 'Riepilogo urna'
};
const REPO_URL = 'https://github.com/UncleDan/votazione-ctl-baskin';
const VERSIONE = 'v6';
const P_SALT = 'SALT';
const ROUND = {
  1: { nome: 'Commissari CTL', ballots: 'BALLOTS', used: 'USED' },
  2: { nome: 'Presidente CTL', ballots: 'BALLOTS_2', used: 'USED_2', ris: SH.RP, col: 'Votato Presidente', cfg: 'Presidente' },
  3: { nome: 'Vice CTL', ballots: 'BALLOTS_3', used: 'USED_3', ris: SH.RV, col: 'Votato Vice', cfg: 'Vice' }
};
const COM_HEADER = ['Commissario', 'Qualifica', 'Squadra', 'Codice', 'Link diretto di voto', 'Votato Presidente', 'Votato Vice'];
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente 0/O, 1/I
const QUALIFICHE = ['Allenatore', 'Aiuto allenatore', 'Autocandidatura'];

/* ---------------- Menu amministratore ---------------- */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🗳️ Votazione')
    .addItem('Inizializza / aggiorna fogli', 'setup')
    .addSubMenu(ui.createMenu('Round 1 – Commissari CTL')
      .addItem('Genera codici e link squadre', 'generaCodici')
      .addItem('Apri', 'apri1')
      .addItem('Chiudi', 'chiudiVotazione')
      .addItem('Calcola risultati', 'calcolaRisultati'))
    .addSubMenu(ui.createMenu('Round 2 – Presidente')
      .addItem('Prepara commissari e link', 'preparaCommissari')
      .addItem('Apri', 'apri2')
      .addItem('Chiudi', 'chiudiVotazione')
      .addItem('Calcola risultati', 'calcola2'))
    .addSubMenu(ui.createMenu('Round 3 – Vice')
      .addItem('Apri', 'apri3')
      .addItem('Chiudi', 'chiudiVotazione')
      .addItem('Calcola risultati', 'calcola3'))
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
function calcola2() { calcolaCarica_(2); }
function calcola3() { calcolaCarica_(3); }

function setup() {
  const ss = SpreadsheetApp.getActive();

  // Migrazione v1/v2: il foglio "Codici" diventa "Squadre"
  const vecchio = ss.getSheetByName('Codici');
  if (vecchio && !ss.getSheetByName(SH.COD)) {
    vecchio.setName(SH.COD);
    vecchio.getRange('A1').setValue('Squadra');
  }

  ensureSheet_(ss, SH.CONFIG, [
    ['Parametro', 'Valore', 'Note'],
    ['Titolo', 'Elezione CTL Baskin', 'Titolo della pagina di voto'],
    ['Sezione territoriale', '', 'Es. Emilia-Romagna — compare sulla pagina di voto e nei report'],
    ['Anno sportivo', '', 'Testo libero, es. 2026/2027 — compare sulla pagina di voto e nei report'],
    ['Stato', 'CHIUSA', 'APERTA / CHIUSA — usa il menu'],
    ['Max preferenze', '', 'Vuoto = metà dei candidati arrotondata per eccesso'],
    ['Numero eletti', '', 'Vuoto = regola CTL: metà delle squadre per eccesso, min 3, max 6'],
    ['Max aiuti allenatore', 1, 'Deroga: aiuti allenatore ammessi, solo se mancano allenatori/autocandidature'],
    ['Messaggio', 'Seleziona i candidati a cui dai la preferenza.', 'Testo sopra la scheda']
  ]);
  ensureCfgRow_('Max aiuti allenatore', 1, 'Deroga: aiuti allenatore ammessi, solo se mancano allenatori/autocandidature');
  ensureCfgRow_('Sezione territoriale', '', 'Es. Emilia-Romagna — compare sulla pagina di voto e nei report');
  ensureCfgRow_('Anno sportivo', '', 'Testo libero, es. 2026/2027 — compare sulla pagina di voto e nei report');
  cfgCell_('Anno sportivo').setNumberFormat('@');  // testo: evita che "2026/27" diventi una data
  ensureCfgRow_('Round attivo', 1, 'Gestito dal menu (1 commissari, 2 presidente, 3 vice)');
  ensureCfgRow_('Formatore di riferimento', '', 'Nome, senza votazione. Se vuole essere votante va inserito anche tra i Candidati come Autocandidatura');
  ensureCfgRow_('Presidente', '', 'Compilato dal round 2; in caso di parità scrivilo a mano');
  ensureCfgRow_('Vice', '', 'Compilato dal round 3; in caso di parità scrivilo a mano');
  ensureSheet_(ss, SH.COM, [COM_HEADER]);

  ensureSheet_(ss, SH.COD, [['Squadra', 'Codice', 'Link diretto di voto', 'Ha votato']]);
  const cand = ensureSheet_(ss, SH.CAND, [['Candidato', 'Qualifica', 'Squadra', 'Anni tesseramento/incarichi (spareggio)', 'Note']]);
  // Migrazione v1/v2: Candidato | Anni | Note  →  aggiunge Qualifica e Squadra
  if (!headers_(cand).qualifica) {
    cand.insertColumnsAfter(1, 2);
    cand.getRange(1, 2, 1, 2).setValues([['Qualifica', 'Squadra']]).setFontWeight('bold').setBackground('#e8eaf6');
  }
  ensureSheet_(ss, SH.RIS, [RIS_HEADER]);

  applicaValidazioni_();
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(P_SALT)) props.setProperty(P_SALT, Utilities.getUuid());
  SpreadsheetApp.getUi().alert(
    'Fogli pronti.\n\n1) "Squadre": un nome per riga (una riga = un voto).\n' +
    '2) "Candidati": nome, qualifica e squadra (menu a tendina).\n' +
    '3) Menu → "Genera codici e link".');
}

function ensureSheet_(ss, name, rows) {
  let sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#e8eaf6');
  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, rows[0].length);
  return sh;
}

function ensureCfgRow_(key, val, note) {
  const sh = sheet_(SH.CONFIG);
  const keys = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => String(r[0]).trim());
  if (keys.indexOf(key) < 0) sh.appendRow([key, val, note]);
}

function applicaValidazioni_() {
  const cand = sheet_(SH.CAND), sq = sheet_(SH.COD);
  const h = headers_(cand);
  const n = Math.max(cand.getMaxRows() - 1, 1);
  cand.getRange(2, h.qualifica, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(QUALIFICHE, true).setAllowInvalid(false).build());
  cand.getRange(2, h.squadra, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(sq.getRange('A2:A'), true).setAllowInvalid(true).build());
}

function generaCodici() {
  const sh = sheet_(SH.COD);
  const n = sh.getLastRow() - 1;
  if (n < 1) return SpreadsheetApp.getUi().alert('Inserisci prima i nomi delle squadre nella colonna A del foglio "Squadre".');
  const rows = sh.getRange(2, 1, n, 3).getValues();
  const esistenti = new Set(rows.map(r => norm_(r[1])).filter(Boolean));
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  let nuovi = 0;
  rows.forEach(r => {
    if (!String(r[0]).trim()) { r[2] = ''; return; }
    if (!norm_(r[1])) {
      let c;
      do { c = codiceCasuale_(); } while (esistenti.has(c));
      esistenti.add(c);
      r[1] = c.slice(0, 4) + '-' + c.slice(4);
      nuovi++;
    }
    r[2] = url ? url + '?c=' + norm_(r[1]) : '';  // rigenerati sempre: seguono l'URL attuale
  });
  sh.getRange(2, 1, n, 3).setValues(rows);
  applicaValidazioni_();
  SpreadsheetApp.getUi().alert(nuovi + ' nuovi codici generati, link aggiornati.' +
    (url ? '\n\nInvia a ogni squadra solo il SUO link.' :
      '\n\nLink non ancora disponibili: pubblica prima l\'app web (Esegui il deployment → App web), poi rilancia questa voce.'));
}

function codiceCasuale_() {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO[(bytes[i] + 256) % ALFABETO.length];
  return s;
}

function apriRound_(r) {
  const ui = SpreadsheetApp.getUi();
  const c = cfg_();
  if (aperta_(c)) {
    return ui.alert(roundAttivo_(c) === r ? 'Questo round è già aperto.'
      : 'È aperto il round ' + roundAttivo_(c) + ' (' + ROUND[roundAttivo_(c)].nome + '): chiudilo prima.');
  }
  const cand = candidatiRound_(r, c);
  if (!cand.length) {
    return ui.alert(r === 1 ? 'Nessun candidato inserito.'
      : r === 2 ? 'Nessun commissario: usa "Round 2 → Prepara commissari e link".'
      : 'Presidente non ancora eletto: calcola il round 2 (o scrivi il nome in Config → Presidente).');
  }
  if (r === 1) {
    const nomi = cand.map(x => x.nome);
    const doppi = nomi.filter((x, i) => nomi.indexOf(x) !== i);
    if (doppi.length) return ui.alert('Candidati con lo stesso nome: ' + doppi.join(', ') + '. Rendili distinguibili (es. iniziale del secondo nome).');
    const senzaQ = cand.filter(x => !x.qualifica).map(x => x.nome);
    if (senzaQ.length && ui.alert('Qualifica mancante', 'Senza qualifica (trattati come allenatori): ' + senzaQ.join(', ') + '.\nAprire comunque?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    if (cand.length < posti_(c) && ui.alert('Candidati insufficienti', 'Ci sono ' + cand.length + ' candidati per ' + posti_(c) + ' posti. Aprire comunque?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  } else if (!Object.keys(votantiMap_(r)).length) {
    return ui.alert('I commissari non hanno codici: usa "Round 2 → Prepara commissari e link".');
  }
  setCfg_('Round attivo', r);
  setCfg_('Stato', 'APERTA');
  ui.alert('Round ' + r + ' – ' + ROUND[r].nome + ' APERTO.\nPosti: ' + postiRound_(r, c) +
    ', max preferenze per scheda: ' + maxPrefRound_(r, c, cand.length) +
    '.\nNon modificare candidati e votanti finché è in corso.');
}

/** Crea il foglio Commissari dagli ELETTI del round 1, con codici e link per i round 2 e 3. */
function preparaCommissari() {
  const ui = SpreadsheetApp.getUi();
  const c = cfg_();
  if (aperta_(c)) return ui.alert('Chiudi prima il round aperto.');
  const ris = sheet_(SH.RIS);
  if (ris.getLastRow() < 2) return ui.alert('Calcola prima i risultati del round 1.');
  const h = ris.getRange(1, 1, 1, ris.getLastColumn()).getValues()[0].map(x => String(x).toLowerCase());
  const col = p => h.findIndex(x => x.indexOf(p) === 0);
  const iN = col('candidat'), iQ = col('qualific'), iS = col('squadr'), iE = col('esito');
  const v = ris.getRange(2, 1, ris.getLastRow() - 1, ris.getLastColumn()).getValues();
  if (v.some(r => /^PARIT/i.test(String(r[iE]))))
    return ui.alert('Ci sono parità da risolvere in "Risultati": scrivi a mano ELETTO o Non eletto nella colonna Esito, poi riprova.');
  const eletti = v.filter(r => /^ELETT/i.test(String(r[iE])) && String(r[iN]).trim());
  if (!eletti.length) return ui.alert('Nessun eletto in "Risultati".');

  const sh = sheet_(SH.COM);
  const vecchi = {};
  commissari_().forEach(x => { if (x.codice) vecchi[x.nome] = x.codice; });
  const usati = new Set(Object.values(vecchi).map(norm_).concat(Object.keys(codiciMap_())));
  const rows = eletti.map(r => {
    const nome = String(r[iN]).trim();
    let cod = vecchi[nome];
    if (!cod) {
      let k;
      do { k = codiceCasuale_(); } while (usati.has(k));
      usati.add(k);
      cod = k.slice(0, 4) + '-' + k.slice(4);
    }
    return [nome, String(r[iQ]).trim(), String(r[iS]).trim(), cod, link_(cod), '', ''];
  });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, COM_HEADER.length).clearContent();
  sh.getRange(2, 1, rows.length, COM_HEADER.length).setValues(rows);
  sh.autoResizeColumns(1, COM_HEADER.length);
  sh.activate();
  aggiornaReport();
  ui.alert(rows.length + ' commissari pronti.' + (link_('X') ? '\nInvia a ciascuno il SUO link: vale sia per il Presidente sia per il Vice.'
    : '\nLink non disponibili: pubblica prima l\'app web.'));
}

function link_(cod) {
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  return url ? url + '?c=' + norm_(cod) : '';
}

function chiudiVotazione() {
  setCfg_('Stato', 'CHIUSA');
  aggiornaPartecipazione();
  aggiornaUrna();
}

function aggiornaPartecipazione() {
  const r = roundAttivo_(cfg_());
  const used = new Set(usati_(r));
  let sh, colCod, colOut;
  if (r === 1) { sh = sheet_(SH.COD); colCod = 2; colOut = 4; }
  else { sh = sheet_(SH.COM); colCod = 4; colOut = COM_HEADER.indexOf(ROUND[r].col) + 1; }
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const codici = sh.getRange(2, colCod, n, 1).getValues();
  const out = codici.map(x => [norm_(x[0]) && used.has(hash_(x[0])) ? 'SÌ' : '']);
  sh.getRange(2, colOut, n, 1).setValues(out);
  const votanti = out.filter(x => x[0]).length;
  const aventi = codici.filter(x => norm_(x[0])).length;
  SpreadsheetApp.getActive().toast('Round ' + r + ' – ' + ROUND[r].nome + ': hanno votato ' + votanti + ' su ' + aventi + '.', 'Partecipazione', 8);
}

/* ---------------- Risultati ---------------- */

const RIS_HEADER = ['Posizione', 'Candidato', 'Qualifica', 'Squadra', 'Preferenze', 'Anni (spareggio)', 'Esito', 'Note'];

function calcolaRisultati() {
  const ui = SpreadsheetApp.getUi();
  const c = cfg_();
  if (aperta_(c) && roundAttivo_(c) === 1) return ui.alert('Chiudi prima il round 1.');
  const cand = candidati_();
  const schede = schede_(1);
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
  const maxAiuti = maxAiuti_(c);
  const ass = assegna_(lista, posti, maxAiuti);

  // posizione in graduatoria generale (pari voti e pari anni = stessa posizione)
  const out = [];
  lista.forEach((x, i) => {
    const pos = (i > 0 && pari_(x, lista[i - 1])) ? out[i - 1][0] : i + 1;
    out.push([pos, x.nome, x.qualifica || '—', x.squadra, x.voti, x.anni, ass.esito[x.nome].esito, ass.esito[x.nome].nota]);
  });

  const eletti = lista.filter(x => ass.esito[x.nome].esito === 'ELETTO').length;
  const sh = sheet_(SH.RIS);
  sh.clearContents();
  sh.getRange(1, 1, 1, RIS_HEADER.length).setValues([RIS_HEADER]).setFontWeight('bold').setBackground('#e8eaf6');
  if (out.length) sh.getRange(2, 1, out.length, RIS_HEADER.length).setValues(out);

  const r = (a, b, c3) => [a, b, c3 || '', '', '', '', '', ''];
  const riepilogo = [
    r('', ''),
    r('Riepilogo', ''),
    r('Sezione territoriale', sezione_(c)),
    r('Anno sportivo', anno_(c)),
    r('Squadre aventi diritto', numSquadre_()),
    r('Schede votate', schede.length),
    r('di cui bianche', bianche),
    r('Preferenze espresse', totPref),
    r('Max preferenze per scheda', maxPref_(c, cand.length)),
    r('Commissari da eleggere', posti),
    r('Eletti', eletti, ass.parita ? 'ATTENZIONE: parità da risolvere' : ''),
    r('Posti vacanti', ass.vacanti, (!ass.parita && eletti < 3) ? 'ATTENZIONE: CTL sotto il minimo di 3 membri' : ''),
    r('Calcolato il', Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm'))
  ];
  sh.getRange(out.length + 2, 1, riepilogo.length, RIS_HEADER.length).setValues(riepilogo);
  scriviLinkRepo_(sh, out.length + 2 + riepilogo.length + 1);
  sh.autoResizeColumns(1, RIS_HEADER.length);
  sh.activate();
  aggiornaReport();
  aggiornaUrna();
}

/** Round 2 e 3: una preferenza, vince chi ha più voti (spareggio per anni). */
function calcolaCarica_(r) {
  const ui = SpreadsheetApp.getUi();
  const c = cfg_();
  if (aperta_(c) && roundAttivo_(c) === r) return ui.alert('Chiudi prima il round ' + r + '.');
  const cand = candidatiRound_(r, c);
  if (!cand.length) return ui.alert('Nessun candidato per questo round.');
  const schede = schede_(r);
  const voti = {};
  cand.forEach(x => voti[x.nome] = 0);
  let bianche = 0;
  schede.forEach(s => { if (!s.length) bianche++; s.forEach(n => { if (n in voti) voti[n]++; }); });
  const lista = cand.map(x => Object.assign({}, x, { voti: voti[x.nome] }))
    .sort((a, b) => b.voti - a.voti || b.anni - a.anni || a.nome.localeCompare(b.nome, 'it'));

  const parita = lista.length > 1 && pari_(lista[0], lista[1]);
  const vincitore = (!parita && lista[0].voti > 0) ? lista[0].nome : '';
  const out = lista.map((x, i) => {
    let esito = '', nota = '';
    if (i === 0 && vincitore) {
      esito = 'ELETTO';
      if (lista.length > 1 && lista[1].voti === x.voti) nota = 'Pari voti: precedenza per anni';
    } else if (parita && pari_(x, lista[0])) {
      esito = 'PARITÀ — da risolvere';
      nota = 'Scrivi il nome scelto in Config → ' + ROUND[r].cfg;
    }
    return [0, x.nome, x.squadra, x.voti, x.anni, esito, nota];
  });
  out.forEach((row, i) => row[0] = (i > 0 && pari_(lista[i], lista[i - 1])) ? out[i - 1][0] : i + 1);

  const head = ['Posizione', 'Candidato', 'Squadra', 'Voti', 'Anni (spareggio)', 'Esito', 'Note'];
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(ROUND[r].ris) || ss.insertSheet(ROUND[r].ris);
  sh.clearContents();
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#e8eaf6');
  sh.getRange(2, 1, out.length, head.length).setValues(out);
  const f = (a, b) => [a, b, '', '', '', '', ''];
  const riep = [f('', ''), f('Riepilogo', ''), f('Sezione territoriale', sezione_(c)), f('Anno sportivo', anno_(c)),
    f('Commissari aventi diritto', Object.keys(votantiMap_(r)).length),
    f('Schede votate', schede.length), f('di cui bianche', bianche),
    f('Calcolato il', Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm'))];
  sh.getRange(out.length + 2, 1, riep.length, head.length).setValues(riep);
  scriviLinkRepo_(sh, out.length + 2 + riep.length + 1);
  sh.autoResizeColumns(1, head.length);
  sh.activate();

  setCfg_(ROUND[r].cfg, vincitore);
  aggiornaReport();
  aggiornaUrna();
  if (!vincitore) ui.alert('Nessun eletto (parità o nessun voto). Risolvi e scrivi il nome in Config → ' + ROUND[r].cfg + ', poi "Aggiorna report".');
}

/* ---------------- Report ---------------- */

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
  if (!form) statoForm = '';
  else if (nomiCom.indexOf(form) >= 0) statoForm = 'Votante — componente eletto della CTL';
  else if (candForm) statoForm = 'Non votante — candidato non eletto al round 1';
  else statoForm = 'Non votante';
  if (candForm && !/autocand/i.test(candForm.qualifica))
    statoForm += ' (attenzione: da regolamento il formatore votante si candida come Autocandidatura)';

  const R = (a, b, c3, d) => [a, b || '', c3 || '', d || ''];
  const rows = [
    R(String(c['Titolo'] || 'Elezione CTL') + (intestazione_(c) ? ' — ' + intestazione_(c) : '') + ' — Report'),
    R('Sezione territoriale', sezione_(c) || '(non indicata)'),
    R('Anno sportivo', anno_(c) || '(non indicato)'),
    R('Aggiornato il', Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm')),
    R(''),
    R('Presidente', pres || '(da eleggere)'),
    R('Vice', vice || '(da eleggere)'),
    R('Formatore di riferimento', form || '(non indicato)', statoForm),
    R('Commissari eletti', com.length + ' su ' + posti_(c) + ' posti'),
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

  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  sh.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  sh.getRange(6, 1, 4, 1).setFontWeight('bold');
  scriviLinkRepo_(sh, rows.length + 2);
  sh.getRange(headRow, 1, 1, 4).setFontWeight('bold').setBackground('#e8eaf6');
  sh.autoResizeColumns(1, 4);
}

function pari_(a, b) { return !!a && !!b && a.voti === b.voti && a.anni === b.anni; }

/**
 * Assegna i posti:
 * - allenatori e autocandidature entrano per primi, in ordine di preferenze
 *   (spareggio per anni), indipendentemente dal confronto con gli aiuti;
 * - solo se non bastano a coprire i posti entrano gli aiuti allenatore, in
 *   ordine di preferenze, fino al limite della deroga (default 1);
 * - gli eventuali posti rimanenti restano vacanti.
 */
function assegna_(lista, posti, maxAiuti) {
  const esito = {};
  lista.forEach(x => esito[x.nome] = { esito: 'Non eletto', nota: '' });
  let parita = false;

  function eleggi(arr, n, nota) {
    if (n <= 0 || !arr.length) return 0;
    if (arr.length <= n) {
      arr.forEach(x => esito[x.nome] = { esito: 'ELETTO', nota: nota });
      return arr.length;
    }
    const taglio = pari_(arr[n - 1], arr[n]);  // parità a cavallo dell'ultimo posto
    arr.forEach((x, i) => {
      if (taglio && pari_(x, arr[n - 1])) {
        esito[x.nome] = { esito: 'PARITÀ — da risolvere', nota: 'Pari preferenze e pari anni sull\'ultimo posto' };
        parita = true;
      } else if (i < n) {
        const pariVoti = arr.some(y => y !== x && y.voti === x.voti);
        esito[x.nome] = { esito: 'ELETTO', nota: [nota, pariVoti ? 'precedenza per anni' : ''].filter(Boolean).join('; ') };
      }
    });
    return n;
  }

  const A = lista.filter(x => !x.aiuto);   // allenatori, autocandidature, senza qualifica
  const B = lista.filter(x => x.aiuto);    // aiuti allenatore
  const daA = eleggi(A, posti, '');
  const resto = posti - daA;
  let daB = 0;
  if (resto > 0) {
    daB = eleggi(B, Math.min(resto, maxAiuti), 'Deroga aiuto allenatore');
    B.forEach(x => { if (esito[x.nome].esito === 'Non eletto') esito[x.nome].nota = 'Oltre il limite di aiuti allenatore'; });
  } else {
    B.forEach(x => esito[x.nome].nota = 'Aiuto allenatore: entra solo se mancano allenatori/autocandidature');
  }
  return { esito: esito, vacanti: Math.max(posti - daA - daB, 0), parita: parita };
}

/* ---------------- Riepilogo per il custode dell'urna ---------------- */

/**
 * Per ogni round: aventi diritto, chi ha votato, controllo di coerenza
 * (schede nell'urna = codici usati), bianche, preferenze per candidato e
 * elenco delle schede anonime (ordine casuale, nessun legame col votante).
 * A round APERTO mostra solo partecipazione e numero di schede: i conteggi
 * compaiono dopo la chiusura.
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
  push(R('Sezione territoriale', sezione_(c) || '(non indicata)'));
  push(R('Anno sportivo', anno_(c) || '(non indicato)'));
  push(R('Aggiornato il', Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm')));
  push(R('Stato', 'Round ' + roundAttivo_(c) + ' – ' + ROUND[roundAttivo_(c)].nome + ': ' + (aperta_(c) ? 'APERTO' : 'CHIUSO')));

  [1, 2, 3].forEach(r => {
    const votanti = r === 1
      ? (function () { const m = codiciMap_(); return Object.keys(m).map(k => ({ nome: m[k], codice: k })); })()
      : commissari_().filter(x => norm_(x.codice)).map(x => ({ nome: x.nome, codice: norm_(x.codice) }));
    const used = new Set(usati_(r));
    const schede = schede_(r);
    const hanno = votanti.filter(v => used.has(hash_(v.codice))).map(v => v.nome);
    const nonHanno = votanti.filter(v => !used.has(hash_(v.codice))).map(v => v.nome);
    const inCorso = aperta_(c) && roundAttivo_(c) === r;

    push(R(''));
    push(R('Round ' + r + ' – ' + ROUND[r].nome + (inCorso ? ' (IN CORSO)' : '')), 'h');
    if (!votanti.length && !schede.length) { push(R('Non ancora preparato.')); return; }
    push(R('Aventi diritto', votanti.length));
    push(R('Hanno votato (codici usati)', used.size));
    push(R('Schede nell\'urna', schede.length,
      schede.length === used.size ? 'Controllo OK: schede = codici usati' : 'ANOMALIA: schede e codici usati non coincidono'));
    push(R('Hanno votato', hanno.join(', ') || '—'));
    push(R('Non hanno votato', nonHanno.join(', ') || '—'));
    if (inCorso) { push(R('Conteggi e schede visibili dopo la chiusura del round.')); return; }

    const bianche = schede.filter(s => !s.length).length;
    push(R('Schede bianche', bianche));
    const nomi = candidatiRound_(r, c).map(x => x.nome);
    const voti = {};
    nomi.forEach(n => voti[n] = 0);
    schede.forEach(s => s.forEach(n => { voti[n] = (voti[n] || 0) + 1; }));
    const tot = Object.keys(voti).reduce((a, k) => a + voti[k], 0);
    push(R('Preferenze espresse', tot));
    push(R('Candidato', 'Preferenze', 'Nota'), 'b');
    Object.keys(voti).sort((a, b) => voti[b] - voti[a] || a.localeCompare(b, 'it'))
      .forEach(n => push(R(n, voti[n], nomi.indexOf(n) < 0 ? 'Non più presente tra i candidati' : '')));
    push(R('Scheda n. (ordine casuale)', 'Preferenze'), 'b');
    schede.forEach((s, i) => push(R(i + 1, s.length ? s.join(', ') : '(bianca)')));
  });

  push(R(''));
  push(R('Le schede non contengono né codice, né votante, né orario: l\'ordine è casuale e non corrisponde all\'ordine di voto.'));

  sh.getRange(1, 1, rows.length, W).setValues(rows);
  scriviLinkRepo_(sh, rows.length + 1);
  sh.getRange(1, 1).setFontSize(14);
  bold.forEach(i => sh.getRange(i, 1, 1, W).setFontWeight('bold'));
  head.forEach(i => sh.getRange(i, 1, 1, W).setFontWeight('bold').setBackground('#e8eaf6'));
  sh.autoResizeColumns(1, W);
}

function azzeraRound() {
  const ui = SpreadsheetApp.getUi();
  const p = ui.prompt('Azzera round', 'Quale round azzerare? Scrivi 1, 2, 3 oppure TUTTI.\nLe schede cancellate non si recuperano.', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  const t = p.getResponseText().trim().toUpperCase();
  const rounds = t === 'TUTTI' ? [1, 2, 3] : ([1, 2, 3].indexOf(parseInt(t, 10)) >= 0 ? [parseInt(t, 10)] : []);
  if (!rounds.length) return ui.alert('Valore non valido.');
  const props = PropertiesService.getScriptProperties();
  const c = cfg_();
  rounds.forEach(r => {
    props.deleteProperty(ROUND[r].ballots);
    props.deleteProperty(ROUND[r].used);
    if (aperta_(c) && roundAttivo_(c) === r) setCfg_('Stato', 'CHIUSA');
    if (r === 1) {
      const cod = sheet_(SH.COD);
      if (cod.getLastRow() > 1) cod.getRange(2, 4, cod.getLastRow() - 1, 1).clearContent();
      const ris = sheet_(SH.RIS);
      if (ris.getLastRow() > 1) ris.getRange(2, 1, ris.getLastRow() - 1, ris.getLastColumn()).clearContent();
    } else {
      setCfg_(ROUND[r].cfg, '');
      const com = sheet_(SH.COM);
      if (com.getLastRow() > 1) com.getRange(2, COM_HEADER.indexOf(ROUND[r].col) + 1, com.getLastRow() - 1, 1).clearContent();
      const ris = SpreadsheetApp.getActive().getSheetByName(ROUND[r].ris);
      if (ris) ris.clearContents();
    }
  });
  if (t === 'TUTTI') {
    props.setProperty(P_SALT, Utilities.getUuid());
    setCfg_('Stato', 'CHIUSA');
    setCfg_('Round attivo', 1);
  }
  aggiornaReport();
  aggiornaUrna();
  ui.alert('Azzerato: round ' + rounds.join(', ') + '. I codici esistenti restano validi.');
}

/* ---------------- App web (votanti) ---------------- */

function doGet(e) {
  const t = HtmlService.createTemplateFromFile('Index');
  t.codice = (e && e.parameter && e.parameter.c) || '';
  t.repo = REPO_URL;
  t.versione = VERSIONE;
  return t.evaluate()
    .setTitle(cfg_()['Titolo'] || 'Votazione')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getInfo() {
  const c = cfg_();
  const r = roundAttivo_(c);
  const cand = candidatiRound_(r, c);
  const titolo = String(c['Titolo'] || 'Votazione');
  return {
    round: r,
    sezione: sezione_(c),
    intestazione: intestazione_(c),
    repo: REPO_URL,
    titolo: r === 1 ? titolo : titolo + ' — ' + ROUND[r].nome,
    sottotitolo: r === 1 ? 'Voto anonimo — una scheda per squadra' : 'Voto anonimo — una scheda per commissario',
    messaggio: r === 1 ? String(c['Messaggio'] || '')
      : r === 2 ? 'Scegli il Presidente della CTL: una sola preferenza, vince chi ne ottiene di più.'
      : 'Scegli il Vice della CTL tra i commissari rimanenti: una sola preferenza.',
    prefisso: r === 1 ? 'Stai votando per la squadra: ' : 'Stai votando come: ',
    aperta: aperta_(c),
    candidati: cand.map(x => ({ nome: x.nome, qualifica: r === 1 ? x.qualifica : '', squadra: x.squadra })),
    max: maxPrefRound_(r, c, cand.length),
    eletti: r === 1 ? posti_(c) : 0,
    maxAiuti: r === 1 ? maxAiuti_(c) : 0
  };
}

function verificaCodice(codice) {
  const c = cfg_();
  if (!aperta_(c)) return { ok: false, err: 'La votazione non è aperta.' };
  const r = roundAttivo_(c);
  const chi = votantiMap_(r)[norm_(codice)];
  if (!chi) return { ok: false, err: 'Codice non valido per la votazione in corso.' };
  if (usati_(r).indexOf(hash_(codice)) >= 0) return { ok: false, err: 'Con questo codice è già stato espresso il voto.' };
  return { ok: true, votante: chi, round: r };
}

function inviaVoto(codice, scelte, round) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const v = verificaCodice(codice);
    if (!v.ok) return v;
    const r = v.round;
    if (round && Number(round) !== r) return { ok: false, err: 'Nel frattempo la votazione è cambiata: ricarica la pagina.' };
    const c = cfg_();
    const nomi = candidatiRound_(r, c).map(x => x.nome);
    const max = maxPrefRound_(r, c, nomi.length);
    if (!Array.isArray(scelte)) return { ok: false, err: 'Scheda non valida.' };
    const sel = Array.from(new Set(scelte.map(String)));
    if (sel.length !== scelte.length || sel.some(s => nomi.indexOf(s) < 0))
      return { ok: false, err: 'Scheda non valida: ricarica la pagina.' };
    if (sel.length > max) return { ok: false, err: 'Puoi esprimere al massimo ' + max + (max === 1 ? ' preferenza.' : ' preferenze.') };

    const schede = schede_(r);
    schede.splice(Math.floor(Math.random() * (schede.length + 1)), 0, sel.sort());
    const used = usati_(r);
    used.push(hash_(codice));
    used.sort();
    PropertiesService.getScriptProperties().setProperties({
      [ROUND[r].ballots]: JSON.stringify(schede), [ROUND[r].used]: JSON.stringify(used)
    });
    return { ok: true, votante: v.votante };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Utilità ---------------- */

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Foglio "' + name + '" mancante: usa Votazione → Inizializza / aggiorna fogli.');
  return sh;
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
  const keys = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  const i = keys.findIndex(r => String(r[0]).trim() === key);
  if (i >= 0) sh.getRange(i + 2, 2).setValue(val);
  else sh.appendRow([key, val, '']);
}

function sezione_(c) { return String(c['Sezione territoriale'] || '').trim(); }

function anno_(c) {
  const v = c['Anno sportivo'];
  if (v instanceof Date) return Utilities.formatDate(v, 'Europe/Rome', 'yyyy/MM');
  return String(v || '').trim();
}

/** "Sezione territoriale X · Anno sportivo Y" (solo le parti compilate). */
function intestazione_(c) {
  return [sezione_(c) ? 'Sezione territoriale ' + sezione_(c) : '', anno_(c) ? 'Anno sportivo ' + anno_(c) : '']
    .filter(Boolean).join(' · ');
}

/** Riga con link cliccabile al codice sorgente, per trasparenza. */
function scriviLinkRepo_(sh, riga) {
  const testo = 'Codice sorgente aperto e verificabile (licenza MIT, versione ' + VERSIONE + '): ' + REPO_URL;
  const rt = SpreadsheetApp.newRichTextValue().setText(testo)
    .setLinkUrl(testo.length - REPO_URL.length, testo.length, REPO_URL).build();
  sh.getRange(riga, 1).setRichTextValue(rt).setFontSize(9);
}

function cfgCell_(key) {
  const sh = sheet_(SH.CONFIG);
  const keys = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  const i = keys.findIndex(r => String(r[0]).trim() === key);
  return sh.getRange(i >= 0 ? i + 1 : sh.getLastRow() + 1, 2);
}

function aperta_(c) { return String(c['Stato']).trim().toUpperCase() === 'APERTA'; }

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

function maxPref_(c, n) {
  const v = parseInt(c['Max preferenze'], 10);
  return v > 0 ? Math.min(v, n) : Math.ceil(n / 2);
}

function maxAiuti_(c) {
  const v = parseInt(c['Max aiuti allenatore'], 10);
  return isNaN(v) ? 1 : Math.max(v, 0);
}

/**
 * Numero di eletti. Se "Numero eletti" è compilato vale quello (es. 2 per
 * Responsabile + vice); altrimenti regola CTL: metà delle squadre
 * partecipanti arrotondata per eccesso, minimo 3, massimo 6.
 */
function posti_(c) {
  const v = parseInt(c['Numero eletti'], 10);
  if (v > 0) return v;
  return Math.min(6, Math.max(3, Math.ceil(numSquadre_() / 2)));
}

function numSquadre_() {
  const sh = sheet_(SH.COD);
  if (sh.getLastRow() < 2) return 0;
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().filter(r => String(r[0]).trim()).length;
}

function norm_(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

function hash_(codice) {
  const salt = PropertiesService.getScriptProperties().getProperty(P_SALT) || '';
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + norm_(codice), Utilities.Charset.UTF_8);
  return Utilities.base64Encode(b);
}

function codiciMap_() {
  const sh = sheet_(SH.COD);
  const m = {};
  if (sh.getLastRow() < 2) return m;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
    .forEach(r => { const k = norm_(r[1]); if (k && String(r[0]).trim()) m[k] = String(r[0]).trim(); });
  return m;
}

function schede_(r) { return JSON.parse(PropertiesService.getScriptProperties().getProperty(ROUND[r].ballots) || '[]'); }
function usati_(r) { return JSON.parse(PropertiesService.getScriptProperties().getProperty(ROUND[r].used) || '[]'); }

function roundAttivo_(c) {
  const r = parseInt(c['Round attivo'], 10);
  return ROUND[r] ? r : 1;
}

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

/** Mappa codice normalizzato → votante (squadra al round 1, commissario ai round 2 e 3). */
function votantiMap_(r) {
  if (r === 1) return codiciMap_();
  const m = {};
  commissari_().forEach(x => { const k = norm_(x.codice); if (k) m[k] = x.nome; });
  return m;
}
