/**
 * Votazione CTL — voto online anonimo, un voto per società
 * v1 — Google Apps Script legato a un Foglio Google
 *
 * Anonimato: le schede sono salvate nelle Script Properties (non nel foglio,
 * quindi senza cronologia versioni), senza codice né orario, e inserite in
 * posizione casuale. Dei codici usati si conserva solo un hash con sale.
 */

const SH = { CONFIG: 'Config', CAND: 'Candidati', COD: 'Codici', RIS: 'Risultati' };
const P_BALLOTS = 'BALLOTS', P_USED = 'USED', P_SALT = 'SALT';
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente 0/O, 1/I

/* ---------------- Menu amministratore ---------------- */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🗳️ Votazione')
    .addItem('1. Inizializza fogli', 'setup')
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
  ensureSheet_(ss, SH.CONFIG, [
    ['Parametro', 'Valore', 'Note'],
    ['Titolo', 'Elezione CTL Baskin', 'Titolo della pagina di voto'],
    ['Stato', 'CHIUSA', 'APERTA / CHIUSA — usa il menu'],
    ['Max preferenze', '', 'Vuoto = metà dei candidati arrotondata per eccesso'],
    ['Numero eletti', '', 'Posti da assegnare (vuoto = solo graduatoria)'],
    ['Messaggio', 'Seleziona i candidati a cui dai la preferenza.', 'Testo sopra la scheda']
  ]);
  ensureSheet_(ss, SH.CAND, [['Candidato', 'Anni tesseramento/incarichi (spareggio)', 'Note']]);
  ensureSheet_(ss, SH.COD, [['Società', 'Codice', 'Link personale', 'Ha votato']]);
  ensureSheet_(ss, SH.RIS, [['Posizione', 'Candidato', 'Preferenze', 'Anni (spareggio)', 'Esito', 'Note']]);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(P_SALT)) props.setProperty(P_SALT, Utilities.getUuid());
  SpreadsheetApp.getUi().alert('Fogli pronti. Compila "Candidati" e "Codici" (solo la colonna Società), poi usa "Genera codici e link".');
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

function generaCodici() {
  const sh = sheet_(SH.COD);
  const n = sh.getLastRow() - 1;
  if (n < 1) return SpreadsheetApp.getUi().alert('Inserisci prima le società nella colonna A del foglio "Codici".');
  const rows = sh.getRange(2, 1, n, 3).getValues();
  const esistenti = new Set(rows.map(r => norm_(r[1])).filter(Boolean));
  let url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {}
  let nuovi = 0;
  rows.forEach(r => {
    if (!String(r[0]).trim()) return;
    if (!norm_(r[1])) {
      let c;
      do { c = codiceCasuale_(); } while (esistenti.has(c));
      esistenti.add(c);
      r[1] = c.slice(0, 4) + '-' + c.slice(4);
      nuovi++;
    }
    if (url && !r[2]) r[2] = url + '?c=' + norm_(r[1]);
  });
  sh.getRange(2, 1, n, 3).setValues(rows);
  SpreadsheetApp.getUi().alert(nuovi + ' codici generati.' +
    (url ? '' : '\n\nLink non ancora disponibili: pubblica prima l\'app web (Esegui il deployment → App web), poi rilancia questa voce.'));
}

function codiceCasuale_() {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Math.random());
  let s = '';
  for (let i = 0; i < 8; i++) s += ALFABETO[(bytes[i] + 256) % ALFABETO.length];
  return s;
}

function apriVotazione() {
  if (candidati_().length < 1) return SpreadsheetApp.getUi().alert('Nessun candidato inserito.');
  setCfg_('Stato', 'APERTA');
  SpreadsheetApp.getUi().alert('Votazione APERTA. Non modificare i nomi dei candidati finché è in corso.');
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
  SpreadsheetApp.getActive().toast('Hanno votato ' + votanti + ' società su ' + aventi + '.', 'Partecipazione', 8);
}

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

  const lista = cand.map(x => ({ nome: x.nome, anni: x.anni, voti: voti[x.nome] }))
    .sort((a, b) => b.voti - a.voti || b.anni - a.anni || a.nome.localeCompare(b.nome, 'it'));

  const posti = parseInt(c['Numero eletti'], 10) || 0;
  const out = [];
  let i = 0;
  while (i < lista.length) {
    let j = i;
    while (j + 1 < lista.length && lista[j + 1].voti === lista[i].voti && lista[j + 1].anni === lista[i].anni) j++;
    for (let k = i; k <= j; k++) {
      const x = lista[k];
      const pariVoti = lista.filter(y => y.voti === x.voti).length > 1;
      let esito = '';
      if (posti) esito = j < posti ? 'ELETTO' : (i >= posti ? 'Non eletto' : 'PARITÀ — da risolvere');
      else if (j > i) esito = 'PARITÀ — da risolvere';
      const nota = j > i ? 'Pari preferenze e pari anni'
        : (pariVoti ? 'Pari preferenze: precedenza per anni' : '');
      out.push([i + 1, x.nome, x.voti, x.anni, esito, nota]);
    }
    i = j + 1;
  }

  const sh = sheet_(SH.RIS);
  sh.getRange(2, 1, Math.max(sh.getMaxRows() - 1, 1), 6).clearContent();
  if (out.length) sh.getRange(2, 1, out.length, 6).setValues(out);
  const aventi = sheet_(SH.COD).getLastRow() - 1;
  const riepilogo = [
    ['', '', '', '', '', ''],
    ['Riepilogo', '', '', '', '', ''],
    ['Società aventi diritto', Math.max(aventi, 0), '', '', '', ''],
    ['Schede votate', schede.length, '', '', '', ''],
    ['di cui bianche', bianche, '', '', '', ''],
    ['Preferenze espresse', totPref, '', '', '', ''],
    ['Max preferenze per scheda', maxPref_(c, cand.length), '', '', '', ''],
    ['Calcolato il', Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm'), '', '', '', '']
  ];
  sh.getRange(out.length + 2, 1, riepilogo.length, 6).setValues(riepilogo);
  sh.activate();
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
  if (ris.getLastRow() > 1) ris.getRange(2, 1, ris.getLastRow() - 1, 6).clearContent();
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
    candidati: cand.map(x => x.nome),
    max: maxPref_(c, cand.length)
  };
}

function verificaCodice(codice) {
  const c = cfg_();
  if (!aperta_(c)) return { ok: false, err: 'La votazione non è aperta.' };
  const soc = codiciMap_()[norm_(codice)];
  if (!soc) return { ok: false, err: 'Codice non valido. Controlla di averlo scritto correttamente.' };
  if (usati_().indexOf(hash_(codice)) >= 0) return { ok: false, err: 'Con questo codice è già stato espresso il voto.' };
  return { ok: true, societa: soc };
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
    return { ok: true, societa: v.societa };
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Utilità ---------------- */

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Foglio "' + name + '" mancante: usa Votazione → Inizializza fogli.');
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

function candidati_() {
  const sh = sheet_(SH.CAND);
  if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues()
    .filter(r => String(r[0]).trim())
    .map(r => ({ nome: String(r[0]).trim(), anni: Number(r[1]) || 0 }));
}

function maxPref_(c, n) {
  const v = parseInt(c['Max preferenze'], 10);
  return v > 0 ? Math.min(v, n) : Math.ceil(n / 2);
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
