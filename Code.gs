/**
 * Votazione CTL — voto online anonimo, un voto per squadra/società
 * v3 — Google Apps Script legato a un Foglio Google
 *
 * Novità v3: qualifica dei candidati (Allenatore / Aiuto allenatore /
 * Autocandidatura) con deroga "max 1 aiuto allenatore", foglio Squadre con
 * abbinamento candidato→squadra e link diretti di voto.
 *
 * Anonimato: le schede sono salvate nelle Script Properties (non nel foglio,
 * quindi senza cronologia versioni), senza codice né orario, e inserite in
 * posizione casuale. Dei codici usati si conserva solo un hash con sale.
 */

const SH = { CONFIG: 'Config', CAND: 'Candidati', COD: 'Squadre', RIS: 'Risultati' };
const P_BALLOTS = 'BALLOTS', P_USED = 'USED', P_SALT = 'SALT';
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente 0/O, 1/I
const QUALIFICHE = ['Allenatore', 'Aiuto allenatore', 'Autocandidatura'];

/* ---------------- Menu amministratore ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🗳️ Votazione')
    .addItem('1. Inizializza / aggiorna fogli', 'setup')
    .addItem('2. Genera codici e link', 'generaCodici')
    .addSeparator()
    .addItem('Apri votazione', 'apriVotazione')
    .addItem('Chiudi votazione', 'chiudiVotazione')
    .addItem('Aggiorna partecipazione', 'aggiornaPartecipazione')
    .addSeparator()
    .addItem('Calcola risultati', 'calcolaRisultati')
    .addItem('Azzera votazione…', 'azzeraVotazione')
    .addToUi();
}

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
    ['Stato', 'CHIUSA', 'APERTA / CHIUSA — usa il menu'],
    ['Max preferenze', '', 'Vuoto = metà dei candidati arrotondata per eccesso'],
    ['Numero eletti', '', 'Vuoto = regola CTL: metà delle squadre per eccesso, min 3, max 6'],
    ['Max aiuti allenatore', 1, 'Deroga: aiuti allenatore ammessi, solo se mancano allenatori/autocandidature'],
    ['Messaggio', 'Seleziona i candidati a cui dai la preferenza.', 'Testo sopra la scheda']
  ]);
  ensureCfgRow_('Max aiuti allenatore', 1, 'Deroga: aiuti allenatore ammessi, solo se mancano allenatori/autocandidature');

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

function apriVotazione() {
  const ui = SpreadsheetApp.getUi();
  const cand = candidati_(), c = cfg_(), posti = posti_(c);
  if (cand.length < 1) return ui.alert('Nessun candidato inserito.');
  const nomi = cand.map(x => x.nome);
  const doppi = nomi.filter((x, i) => nomi.indexOf(x) !== i);
  if (doppi.length) return ui.alert('Candidati con lo stesso nome: ' + doppi.join(', ') + '. Rendili distinguibili (es. iniziale del secondo nome).');
  const senzaQ = cand.filter(x => !x.qualifica).map(x => x.nome);
  if (senzaQ.length && ui.alert('Qualifica mancante', 'Senza qualifica (trattati come allenatori): ' + senzaQ.join(', ') + '.\nAprire comunque?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  if (cand.length < posti && ui.alert('Candidati insufficienti', 'Ci sono ' + cand.length + ' candidati per ' + posti + ' posti. Aprire comunque?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  setCfg_('Stato', 'APERTA');
  ui.alert('Votazione APERTA — posti: ' + posti + ', max preferenze per scheda: ' + maxPref_(c, cand.length) +
    '.\nNon modificare candidati e squadre finché è in corso.');
}

function chiudiVotazione() {
  setCfg_('Stato', 'CHIUSA');
  aggiornaPartecipazione();
}

function aggiornaPartecipazione() {
  const sh = sheet_(SH.COD);
  const n = sh.getLastRow() - 1;
  if (n < 1) return;
  const used = new Set(usati_());
  const codici = sh.getRange(2, 2, n, 1).getValues();
  const out = codici.map(r => [norm_(r[0]) && used.has(hash_(r[0])) ? 'SÌ' : '']);
  sh.getRange(2, 4, n, 1).setValues(out);
  const votanti = out.filter(r => r[0]).length;
  const aventi = codici.filter(r => norm_(r[0])).length;
  SpreadsheetApp.getActive().toast('Hanno votato ' + votanti + ' squadre su ' + aventi + '.', 'Partecipazione', 8);
}

/* ---------------- Risultati ---------------- */

const RIS_HEADER = ['Posizione', 'Candidato', 'Qualifica', 'Squadra', 'Preferenze', 'Anni (spareggio)', 'Esito', 'Note'];

function calcolaRisultati() {
  const ui = SpreadsheetApp.getUi();
  const c = cfg_();
  if (aperta_(c)) return ui.alert('Chiudi prima la votazione.');
  const cand = candidati_();
  const schede = schede_();
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
  sh.autoResizeColumns(1, RIS_HEADER.length);
  sh.activate();
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

function azzeraVotazione() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.alert('Azzera votazione', 'Cancello TUTTE le schede e lo stato dei codici. Operazione irreversibile. Procedo?', ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(P_BALLOTS);
  props.deleteProperty(P_USED);
  props.setProperty(P_SALT, Utilities.getUuid());
  setCfg_('Stato', 'CHIUSA');
  const cod = sheet_(SH.COD);
  if (cod.getLastRow() > 1) cod.getRange(2, 4, cod.getLastRow() - 1, 1).clearContent();
  const ris = sheet_(SH.RIS);
  if (ris.getLastRow() > 1) ris.getRange(2, 1, ris.getLastRow() - 1, RIS_HEADER.length).clearContent();
  ui.alert('Votazione azzerata. I codici esistenti restano validi per una nuova votazione.');
}

/* ---------------- App web (votanti) ---------------- */

function doGet(e) {
  const t = HtmlService.createTemplateFromFile('Index');
  t.codice = (e && e.parameter && e.parameter.c) || '';
  return t.evaluate()
    .setTitle(cfg_()['Titolo'] || 'Votazione')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getInfo() {
  const c = cfg_();
  const cand = candidati_();
  return {
    titolo: String(c['Titolo'] || 'Votazione'),
    messaggio: String(c['Messaggio'] || ''),
    aperta: aperta_(c),
    candidati: cand.map(x => ({ nome: x.nome, qualifica: x.qualifica, squadra: x.squadra })),
    max: maxPref_(c, cand.length),
    eletti: posti_(c),
    maxAiuti: maxAiuti_(c)
  };
}

function verificaCodice(codice) {
  const c = cfg_();
  if (!aperta_(c)) return { ok: false, err: 'La votazione non è aperta.' };
  const sq = codiciMap_()[norm_(codice)];
  if (!sq) return { ok: false, err: 'Codice non valido. Controlla di averlo scritto correttamente.' };
  if (usati_().indexOf(hash_(codice)) >= 0) return { ok: false, err: 'Con questo codice è già stato espresso il voto.' };
  return { ok: true, squadra: sq };
}

function inviaVoto(codice, scelte) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const v = verificaCodice(codice);
    if (!v.ok) return v;
    const c = cfg_();
    const nomi = candidati_().map(x => x.nome);
    const max = maxPref_(c, nomi.length);
    if (!Array.isArray(scelte)) return { ok: false, err: 'Scheda non valida.' };
    const sel = Array.from(new Set(scelte.map(String)));
    if (sel.length !== scelte.length || sel.some(s => nomi.indexOf(s) < 0))
      return { ok: false, err: 'Scheda non valida: ricarica la pagina.' };
    if (sel.length > max) return { ok: false, err: 'Puoi esprimere al massimo ' + max + ' preferenze.' };

    const props = PropertiesService.getScriptProperties();
    const schede = schede_();
    schede.splice(Math.floor(Math.random() * (schede.length + 1)), 0, sel.sort());
    const used = usati_();
    used.push(hash_(codice));
    used.sort();
    props.setProperties({ [P_BALLOTS]: JSON.stringify(schede), [P_USED]: JSON.stringify(used) });
    return { ok: true, squadra: v.squadra };
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

function schede_() { return JSON.parse(PropertiesService.getScriptProperties().getProperty(P_BALLOTS) || '[]'); }
function usati_() { return JSON.parse(PropertiesService.getScriptProperties().getProperty(P_USED) || '[]'); }
