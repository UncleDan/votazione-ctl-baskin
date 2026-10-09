/*
 * Simulazione delle due interfacce di voto: app Google ("Semplice") e pagina
 * statica su GitHub Pages ("HTML"), con una sola attiva per votazione.
 * Verifica che l'ingresso non attivo rifiuti le schede, che il ponte doPost
 * scriva nella stessa urna e che i link seguano l'interfaccia scelta.
 * Uso: node test/simulazione-interfaccia.js      (VERBOSE=1 per vedere gli avvisi)
 * Copyright (c) 2026 Daniele Lolli (UncleDan) — Licenza MIT
 */
global.VERBOSE = !!process.env.VERBOSE;
const path = require('path'), fs = require('fs');
const M = require('./mock-apps-script.js');
eval(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'));

let errori = 0;
const verifica = (cond, testo) => { console.log((cond ? '  ✔ ' : '  ✘ ') + testo); if (!cond) errori++; };
const foglio = n => M.SS.getSheetByName(n);
const codici = (sh, col) => foglio(sh).d.slice(1).filter(r => r[0] && r[col]).map(r => r[col]);
const PAGES = 'https://uncledan.github.io/votazione-ctl-baskin';
/** Chiama il ponte come farebbe la pagina statica e restituisce la risposta già letta. */
const ponte = payload => JSON.parse(doPost({ postData: { contents: JSON.stringify(payload) } }).getContent());

// ---------------- Preparazione ----------------
setup();
verifica(interfaccia_(cfg_()) === 'HTML', 'interfaccia predefinita dopo l\'inizializzazione: HTML');
setCfg_('Interfaccia di voto', 'Semplice');      // la prima parte prova la porta "app Google"
setCfg_('Sezione Territoriale', 'Emilia-Romagna');
setCfg_('Anno sportivo', '2026/2027');
foglio('Squadre').getRange(2, 1, 4, 2).setValues([
  ['Squadra 1', 'Società 1'], ['Squadra 2', 'Società 1'],
  ['Squadra 3', 'Società 2'], ['Squadra 4', 'Società 3']
]);
foglio('Candidati').getRange(2, 1, 4, 4).setValues([
  ['Candidato A', 'Allenatore', 'Squadra 1', 3],
  ['Candidato B', 'Allenatore', 'Squadra 3', 2],
  ['Candidato C', 'Aiuto allenatore', 'Squadra 4', 5],
  ['Candidato D', 'Altro', 'Autocandidatura', 1]     // autocandidato: non occupa il posto di nessuna societa
]);
generaCodici();
const cod = codici('Società', 1);
verifica(cod.length === 3, '3 società con codice: ' + cod.join(', '));

// ---------------- Interfaccia Semplice ----------------
console.log('\n=== Interfaccia "Semplice": si vota dalla app Google');
apri1();
verifica(interfaccia_(cfg_()) === 'SEMPLICE', 'interfaccia attiva: Semplice');
verifica(getInfo().aperta === true, 'la app Google vede la votazione aperta');

const infoHtmlChiusa = getInfo('html');
verifica(infoHtmlChiusa.aperta === false, 'la pagina statica NON vede la votazione aperta');
verifica(/app Google/.test(infoHtmlChiusa.avviso), 'e riceve il rimando: "' + infoHtmlChiusa.avviso + '"');
verifica(ponte({ azione: 'voto', codice: cod[0], scelte: ['Candidato A'], ctx: infoHtmlChiusa.ctx }).ok === false,
  'una scheda inviata al ponte viene rifiutata quando l\'interfaccia attiva è la app');
verifica(schede_(1, 0).length === 0, 'urna ancora vuota: nessuna scheda è entrata dalla porta chiusa');

verifica(inviaVoto(cod[0], ['Candidato A'], getInfo().ctx).ok === true, 'dalla app Google la scheda entra');
verifica(schede_(1, 0).length === 1, 'urna: 1 scheda');
verifica(/\?c=/.test(foglio('Società').d[1][2]), 'il link della società punta alla app: ' + foglio('Società').d[1][2]);

// ---------------- Passaggio a HTML ----------------
console.log('\n=== Passaggio all\'interfaccia "HTML"');
setCfg_('Indirizzo interfaccia HTML', PAGES);
M.UI.promptAnswer = PAGES;
usaInterfacciaHtml();
verifica(interfaccia_(cfg_()) === 'HTML', 'interfaccia attiva: HTML');
const link = foglio('Società').d[1][2];
verifica(link === PAGES + '#c=' + norm_(cod[0]), 'i link sono stati riscritti verso la pagina: ' + link);
verifica(/#c=/.test(link) && !/\?c=/.test(link), 'il codice viaggia nel frammento, quindi non finisce nei log del server');

const info = ponte({ azione: 'info' });
verifica(info.aperta === true, 'il ponte vede la votazione aperta');
verifica(info.candidati.length === 4 && info.candidati[0].societa === 'Società 1',
  'il ponte serve i 4 candidati con la società, per raggrupparli nella pagina');
verifica(info.avviso === '', 'nessun rimando: la pagina statica è l\'ingresso attivo');

const v = ponte({ azione: 'verifica', codice: cod[1] });
verifica(v.ok === true && v.votante === 'Società 2', 'il ponte riconosce il codice e restituisce il votante');
verifica(ponte({ azione: 'voto', codice: cod[1], scelte: ['Candidato B'], ctx: info.ctx }).ok === true,
  'dal ponte la scheda entra');
verifica(schede_(1, 0).length === 2, 'urna: 2 schede, nella stessa urna della app');
verifica(ponte({ azione: 'voto', codice: cod[1], scelte: ['Candidato A'], ctx: info.ctx }).ok === false,
  'secondo voto con lo stesso codice rifiutato anche dal ponte');

// ---- ricevuta di voto ----
const ric1 = ponte({ azione: 'voto', codice: cod[2], scelte: ['Candidato A'], ctx: info.ctx });
verifica(ric1.ok === true && /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(String(ric1.ricevuta || '')),
  'il deposito restituisce una ricevuta: ' + ric1.ricevuta);
verifica(ricevute_(1, 0).length === 3, 'le ricevute sono tante quante le schede: ' + ricevute_(1, 0).length);
verifica(ricevute_(1, 0).indexOf(ric1.ricevuta) >= 0, 'la ricevuta del votante e nell\'elenco dell\'urna');
verifica(new Set(ricevute_(1, 0)).size === ricevute_(1, 0).length, 'ricevute tutte diverse fra loro');
verifica(ricevute_(1, 0).join() === ricevute_(1, 0).slice().sort().join(),
  'elenco in ordine alfabetico: la posizione non rivela l\'ordine di arrivo');
chiudiVotazione(); apri1();

const bloccata = inviaVoto(cod[0], ['Candidato A'], info.ctx);
verifica(bloccata.ok === false && /pagina web/.test(bloccata.err),
  'ora è la app Google a essere chiusa: "' + bloccata.err + '"');
verifica(schede_(1, 0).length === 3, 'urna invariata: la porta chiusa non scrive');

verifica(/Si vota da un'altra pagina/.test(doGet({ parameter: { c: cod[2] } }).getContent()),
  'chi apre il vecchio link della app trova il cartello con il rimando');
verifica(doGet({ parameter: { c: cod[2] } }).getContent().indexOf(PAGES + '#c=' + norm_(cod[2])) > 0,
  'e il cartello porta il suo codice sulla pagina giusta');

// ---- motivo del rifiuto, per il freno dopo tre tentativi ----
verifica(ponte({ azione: 'verifica', codice: 'ZZZZ-0000' }).motivo === 'codice',
  'codice inesistente: motivo "codice", il solo che fa scattare il freno');
verifica(ponte({ azione: 'verifica', codice: cod[1] }).motivo === 'usato',
  'codice valido ma gia usato: motivo "usato", non fa scattare il freno');

verifica(ponte({ azione: 'pasticcio' }).ok === false, 'azione sconosciuta rifiutata');
verifica(doPost({ postData: { contents: 'non è json' } }).getContent().indexOf('"ok":false') >= 0,
  'richiesta malformata rifiutata senza eccezioni');

// ---------------- Ritorno alla app, urna intatta ----------------
console.log('\n=== Ritorno a "Semplice" a votazione aperta');
usaInterfacciaSemplice();
verifica(interfaccia_(cfg_()) === 'SEMPLICE', 'interfaccia attiva: Semplice');
verifica(schede_(1, 0).length === 3, 'le 3 schede già depositate restano valide');
verifica(inviaVoto(cod[0], ['Candidato A'], getInfo().ctx).ok === false, 'il codice già usato resta rifiutato anche dalla app');
chiudiVotazione();
calcola1();
const ris = foglio('Risultati').d;
const riga = ris.find(r => r[1] === 'Candidato A');
verifica(Number(riga[4]) === 2, 'Candidato A: 2 preferenze, una per porta — il conteggio somma le due interfacce');
verifica(usati_(1, 0).length === 3, '3 codici usati, uno per società');

// ---------------- Azzeramento totale e riuso ----------------
console.log('\n=== Messaggi per il Presidente, con le email dei commissari');
preparaCommissari();
const shCom = foglio('Commissari');
verifica(shCom.d[0][7] === 'Email', 'il foglio Commissari ha la colonna "Email"');
shCom.getRange(2, 8).setValue('commissario@esempio-valido.it');
messaggiPresidente();
const msg2 = foglio('Messaggi').d.slice(1).filter(r => r[0]);
verifica(msg2.length === commissari_().length, 'una riga per commissario: ' + msg2.length);
verifica(msg2[0][2] === 'commissario@esempio-valido.it' || msg2.some(r => r[2] === 'commissario@esempio-valido.it'),
  'e l\'email del commissario finisce nel foglio Messaggi');
verifica(msgContesto_().r === 2, 'i messaggi sanno di essere del round 2, anche se e aperto il round 1');
verifica(msg2.every(r => /Presidente/.test(String(r[3]))), 'e il testo parla del Presidente');
messaggiVice();
verifica(foglio('Messaggi').d.slice(1).filter(r => r[0]).every(r => /Vice/.test(String(r[3]))),
  'e con l\'altra voce di menu parla del Vice');

console.log('\n=== Azzeramento 1: solo i risultati, stessi codici');
const urlPrima = (function () { try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; } })();
const codPrima = codici('Società', 1).slice();
azzeraRisultati();

verifica(schede_(1, 0).length === 0 && usati_(1, 0).length === 0, 'urna e codici usati del round 1 svuotati');
verifica([2, 3].every(r => schede_(r, 0).length === 0), 'urne dei round 2 e 3 svuotate');
verifica(String(cfg_()['Stato']).toUpperCase() === 'CHIUSA', 'votazione chiusa');
verifica(Number(cfg_()['Round attivo']) === 1 && Number(cfg_()['Ballottaggio']) === 0, 'si riparte dal round 1');
verifica(!String(cfg_()['Presidente']) && !String(cfg_()['Vice']), 'Presidente e Vice azzerati');
verifica(commissari_().length === 0, 'foglio Commissari svuotato');
verifica(foglio('Risultati').d.slice(1).every(r => !r.some(Boolean)), 'foglio Risultati svuotato');
verifica(!foglio('Società').d.slice(1).some(r => r[3]), 'colonna "Ha votato" svuotata');
verifica(ScriptApp.getProjectTriggers().length === 0, 'aperture e chiusure programmate annullate');
verifica(numSocieta_() === 3 && squadre_().length === 4 && candidati_().length === 4,
  'societa, squadre e candidati conservati');
const codDopo = codici('Società', 1);
verifica(codDopo.length === 3 && codDopo.every((k, i2) => k === codPrima[i2]),
  'codici invariati: i link gia inviati continuano a funzionare');
verifica((function () { try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; } })() === urlPrima,
  'la app web non e stata toccata: stesso indirizzo, nessuna ripubblicazione');
apri1();
verifica(inviaVoto(codDopo[0], ['Candidato A'], getInfo().ctx).ok === true, 'si puo rivotare subito con gli stessi codici');
chiudiVotazione();

// ---------------- Azzeramento 2: totale ----------------
console.log('\n=== Azzeramento 2: tutto, per una nuova elezione');
azzeraTutto();
verifica(numSocieta_() === 0 && squadre_().length === 0 && candidati_().length === 0,
  'societa, squadre e candidati svuotati');
verifica(schede_(1, 0).length === 0 && usati_(1, 0).length === 0, 'urna vuota');
verifica(String(cfg_()['Sezione Territoriale']) === 'Emilia-Romagna', 'i parametri di Config restano');
verifica((function () { try { return ScriptApp.getService().getUrl(); } catch (e) { return ''; } })() === urlPrima,
  'la app web non e stata toccata nemmeno stavolta');

// ---------------- Azzeramento 3: dati di prova ----------------
console.log('\n=== Azzeramento 3: tutto e dati di prova');
inizializzaDatiProva();
verifica(numSocieta_() === 11 && squadre_().length === 16 && candidati_().length === 11,
  'ricaricati 11 societa, 16 squadre, 11 candidati');
verifica(societaDoppie_().length === 0, 'i dati di prova rispettano "una societa, un solo candidato"');
verifica(candidati_().filter(k => k.auto).length === 1, 'e c\'e un autocandidato, che dalla regola e escluso');
verifica(codici('Società', 1).length === 11, 'e 11 codici nuovi');
verifica(foglio('Messaggi').d.slice(1).filter(r => r[0]).length === 11,
  'il foglio "Messaggi" ha una riga per societa');
// ---- nome breve ----
const shSoc = foglio('Società');
verifica(shSoc.d[0][4] === 'Nome breve', 'il foglio Società ha la colonna "Nome breve"');
verifica(shSoc.d.slice(1).filter(r => r[0]).every(r => r[4] && r[4] !== r[0]),
  'i dati di prova portano un nome breve piu corto della ragione sociale');
verifica(shSoc.d[0][5] === 'Email' && shSoc.d[0][6] === 'Codice affiliazione',
  'il foglio Società ha le colonne "Email" e "Codice affiliazione"');
verifica(shSoc.d.slice(1).filter(r => r[0]).every(r => /@example\.invalid$/.test(String(r[5])) && r[6]),
  'con email di prova non recapitabili e codice di affiliazione');
shSoc.getRange(2, 5).setValue('Alfa');     // il Coordinatore lo accorcia
preparaMessaggi();
const rAlfa = foglio('Messaggi').d.find(r => r[0] === 'Alfa') || [];
verifica(rAlfa.length > 0, 'nei messaggi il destinatario e il nome breve');
verifica(/Ciao Alfa,/.test(String(rAlfa[3])), 'e il saluto usa il nome breve');
verifica(codiciMap_()[Object.keys(codiciMap_())[0]] !== undefined, 'i codici restano mappati');
verifica(codiciMap_()[norm_(codici('Società', 1)[0])] === 'Alfa',
  'la pagina di voto riceve il nome breve, non la ragione sociale');

verifica(/link riservato alla vostra società/.test(String(foglio('Messaggi').d[1][3])) &&
  /RICEVUTA/.test(String(foglio('Messaggi').d[1][3])),
  'e il messaggio contiene link e spiegazione della ricevuta');
verifica(/inoltr/i.test(String(foglio('Messaggi').d[1][3])),
  'e dice che il messaggio si puo inoltrare a un\'altra persona della societa');
verifica(foglio('Messaggi').d[0][4] === 'Rimanda' && foglio('Messaggi').d[1][4] === false,
  'l\'ultima colonna e la spunta "Rimanda", che parte vuota');
verifica(foglio('Messaggi').d.slice(1).filter(r => r[0]).every(r => String(r[3]).length > 100),
  'il messaggio c\'e per tutti, anche per chi non ha email');
verifica(foglio('Società').d[0][0] === 'Società' && foglio('Candidati').d[0][0] === 'Candidato',
  'le intestazioni dei fogli sono al loro posto dopo gli azzeramenti');

console.log(errori ? '\n' + errori + ' verifiche fallite.' : '\nTutte le verifiche superate.');
process.exit(errori ? 1 : 0);
