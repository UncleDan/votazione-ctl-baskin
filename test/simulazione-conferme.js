/*
 * Richiesta di conferma delle candidature, prima di aprire la votazione:
 * ogni societa riceve i nominativi che la riguardano, con le note, e anche
 * chi non ha candidati riceve il messaggio.
 * Uso: node test/simulazione-conferme.js      (VERBOSE=1 per vedere gli avvisi)
 * Copyright (c) 2026 Daniele Lolli (UncleDan) — Licenza MIT
 */
global.VERBOSE = !!process.env.VERBOSE;
const path = require('path'), fs = require('fs');
const M = require('./mock-apps-script.js');
eval(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'));

let errori = 0;
const verifica = (cond, testo) => { console.log((cond ? '  ✔ ' : '  ✘ ') + testo); if (!cond) errori++; };
const foglio = n => M.SS.getSheetByName(n);
const riga = nome => foglio('Conferme').d.find(r => r[0] === nome) || [];
const sq_ = x => (x ? mappaSquadraSocieta_()[x.squadra] || '' : '');
const sqCoperte_ = () => commissari_().filter(x => !x.rinuncia).map(sq_).filter(Boolean);

// ---------------- Preparazione: 4 societa, candidature grezze ----------------
setup();
setCfg_('Sezione Territoriale', 'Emilia-Romagna');
setCfg_('Anno sportivo', '2026/27');
setCfg_('Scadenza per le conferme', 'venerdì 7 novembre');
setCfg_('Indirizzo per le candidature', 'baskin.emiliaromagna@esempio-valido.it');
foglio('Squadre').getRange(2, 1, 5, 2).setValues([
  ['Alfa 1', 'Società Alfa'], ['Alfa 2', 'Società Alfa'],
  ['Bravo', 'Società Bravo'], ['Charlie', 'Società Charlie'], ['Delta', 'Società Delta']
]);
// Alfa ne presenta due (caso da sanare), Bravo uno con una nota, Charlie nessuno,
// Delta uno, piu un autocandidato che non appartiene a nessuna societa
foglio('Candidati').getRange(2, 1, 5, 6).setValues([
  ['Primo Candidato', 'Allenatore', 'Alfa 1', 4, '', ''],
  ['Secondo Candidato', 'Aiuto allenatore', 'Alfa 2', 2, 'arrivato dopo la scadenza: da verificare', ''],
  ['Terzo Candidato', '', 'Bravo', 3, 'qualifica non indicata nel modulo', ''],
  ['Quarto Candidato', 'Allenatore', 'Delta', 1, '', ''],
  ['Quinto Candidato', 'Allenatore', 'Autocandidatura', 0, 'non tesserato', '']
]);
generaCodici();
const soc = sheet_('Società');
foglio('Società').d.slice(1).forEach((r, i) => { if (r[0]) soc.getRange(i + 2, 6).setValue('s' + (i + 1) + '@esempio-valido.it'); });
soc.getRange(4, 6).setValue('');                       // una societa resta senza indirizzo

// ---------------- Passo zero: si aprono le candidature ----------------
console.log('=== Apre la raccolta delle candidature');
setCfg_('Numero eletti', '');                          // la regola calcola i posti da se
M.alerts.length = 0;
richiestaCandidature();
verifica(/NESSUNA MAIL È STATA INVIATA/.test(String(M.alerts[M.alerts.length - 1])),
  'l\'avviso dice che preparare non e inviare');
const apertura = foglio('Conferme').d.slice(1).filter(r => r[0]);
verifica(apertura.length === 4, 'una richiesta per societa, anche a chi non si e ancora mosso: ' + apertura.length);
verifica(apertura.every(r => r[2] === 'Richiesta di candidatura'), 'la colonna "Riguarda" dice di che si tratta');
const inv = String(apertura[0][3]);
verifica(/UN SOLO candidato/.test(inv), 'dice subito che la candidatura e una per societa');
verifica(/3 commissari/.test(inv), 'e quanti commissari si eleggono: meta delle 4 societa, minimo 3');
verifica(/nessun modulo da compilare/.test(inv) && /baskin.emiliaromagna@esempio-valido\.it/.test(inv),
  'basta una mail all\'indirizzo della Sezione');
verifica(/qualifica: Allenatore, Aiuto allenatore o Altro/.test(inv) && /anni di tesseramento/.test(inv),
  'elencando cosa scrivere nella mail');
verifica(/entro venerdì 7 novembre/.test(inv), 'con la scadenza presa da Config');
verifica(/al massimo un Aiuto allenatore/.test(inv), 'e il limite di un solo Aiuto allenatore in Commissione');
verifica(apertura.every(r => !/#c=|\?c=/.test(String(r[3]))), 'nessun link di voto: qui non si vota ancora');
M.email.length = 0;
inviaConferme();
verifica(M.email.length === 3, 'partono 3 email, una societa non ha indirizzo (' + M.email.length + ')');
verifica(M.email.every(e => /candidature aperte per la CTL$/.test(e.subject)),
  'con l\'oggetto della raccolta: "' + (M.email[0] || {}).subject + '"');

console.log('\n=== Prepara le richieste');
M.alerts.length = 0;
preparaConferme();
verifica(/NESSUNA MAIL È STATA INVIATA/.test(String(M.alerts[M.alerts.length - 1])),
  'anche qui l\'avviso lo dice');
const sh = foglio('Conferme');
verifica(sh.d[0][0] === 'Destinatario' && sh.d[0][4] === 'Da inviare', 'il foglio ha le colonne giuste');
const righe = sh.d.slice(1).filter(r => r[0]);
verifica(righe.length === 4, 'una riga per societa: ' + righe.length);
verifica(righe.every(r => r[4] === true), 'tutte spuntate "Da inviare"');

console.log('\n=== Contenuto dei messaggi');
const alfa = String(riga('Società Alfa')[3]);
verifica(/Primo Candidato/.test(alfa) && /Secondo Candidato/.test(alfa), 'Alfa vede entrambi i suoi candidati');
verifica(/UN SOLO candidato/.test(alfa) && /ne risultano 2/.test(alfa), 'e il messaggio le fa notare che sono due');
verifica(/Nota: arrivato dopo la scadenza/.test(alfa), 'le note dei candidati sono nel messaggio');
const bravo = String(riga('Società Bravo')[3]);
verifica(/qualifica non indicata/.test(bravo), 'anche quando sono una sola riga');
verifica(/entro venerdì 7 novembre/.test(bravo), 'e c\'e la scadenza presa da Config');
verifica(/baskin.emiliaromagna@esempio-valido\.it/.test(bravo) && /nessun modulo/.test(bravo),
  'con l\'indirizzo della Sezione a cui rispondere');
const charlie = String(riga('Società Charlie')[3]);
verifica(/NON risulta nessuna candidatura/.test(charlie), 'chi non ha candidati riceve comunque la richiesta');
verifica(/riscriveteci subito/.test(charlie), 'con l\'invito a riscrivere se la candidatura si e persa');
verifica(/nessun modulo da compilare/.test(charlie) && /baskin.emiliaromagna@esempio-valido\.it/.test(charlie),
  'e dice che basta una mail all\'indirizzo della Sezione, senza moduli');
verifica(/qualifica \(Allenatore, Aiuto allenatore o Altro\)/.test(charlie),
  'elencando cosa serve scrivere, visto che non c\'e un modulo');
verifica(!/Primo Candidato|Quarto Candidato/.test(charlie), 'e non vede i candidati delle altre societa');
verifica(righe.every(r => !/Quinto Candidato/.test(String(r[3]))),
  'l\'autocandidato non compare in nessun messaggio: non appartiene a una societa');

console.log('\n=== Invio');
M.email.length = 0;
inviaConferme();
verifica(M.email.length === 3, 'partono 3 email, non 4: una societa non ha indirizzo (' + M.email.length + ')');
verifica(M.email.every(e => /conferma delle candidature/.test(e.subject)), 'oggetto: "' + M.email[0].subject + '"');
verifica(M.email.every(e => !/#c=|\?c=/.test(e.body)), 'nessun link di voto nelle richieste');
verifica(sh.d.slice(1).filter(r => r[0]).every(r => r[4] === false), 'le spunte sono state tolte dopo l\'invio');
M.email.length = 0;
inviaConferme();
verifica(M.email.length === 0, 'senza spunte non parte niente');

console.log('\n=== Dopo le risposte: si sistema a mano e si apre');
sheet_('Candidati').getRange(3, 1, 1, 6).setValues([['', '', '', '', '', '']]);   // Alfa ritira il secondo
verifica(societaDoppie_().length === 0, 'tolto il doppione, il vincolo e rispettato');
setCfg_('Numero eletti', 3);
apri1();
verifica(String(cfg_()['Stato']).toUpperCase() === 'APERTA', 'e la votazione si apre');

// ---------------- Conferma dell'incarico ai commissari ----------------
console.log('\n=== Prima del voto per il Presidente: i commissari confermano');
const ris = sheet_('Risultati');
chiudiVotazione();
calcola1();
preparaCommissari();
const shCom = foglio('Commissari');
shCom.d.slice(1).forEach((r, k) => { if (r[0]) shCom.getRange(k + 2, 8).setValue('c' + k + '@esempio-valido.it'); });
shCom.getRange(2, 9).setValue(true);                      // il primo non accetta cariche
M.alerts.length = 0;
preparaConfermeCommissari();
const conf = foglio('Conferme').d.slice(1).filter(r => r[0]);
const nomiCom = commissari_().map(x => x.nome);
verifica(conf.length === nomiCom.length, 'un messaggio per ogni commissario in elenco (' + conf.length + ')');
verifica(conf.every(r => r[2] === 'Accettazione incarico in CTL'), 'la colonna "Riguarda" dice di che si tratta');
verifica(conf.every(r => /risulti ELETTO/.test(String(r[3]))), 'il messaggio annuncia l\'elezione');
verifica(conf.every(r => /accetti l'incarico/.test(String(r[3]))), 'e chiede di confermare l\'incarico');
verifica(conf.every(r => /passa al primo dei non eletti/.test(String(r[3]))),
  'spiegando che adesso il posto scorre, dopo no');
verifica(conf.every(r => !/#c=|\?c=/.test(String(r[3]))), 'e non contiene nessun link di voto');
verifica(M.alerts.some(a2 => /Rinuncia alla carica/.test(String(a2))),
  'chi non accetta cariche viene segnalato, ma la richiesta la riceve: riguarda il posto, non la carica');
verifica(M.alerts.some(a2 => /"Rinuncia" nel foglio "Candidati"/.test(String(a2))),
  'e l\'avviso dice dove si spunta la rinuncia all\'incarico');
verifica(/NESSUNA MAIL È STATA INVIATA/.test(String(M.alerts[M.alerts.length - 1])),
  'e l\'avviso ricorda che le mail non sono partite');

M.email.length = 0;
inviaConferme();
const inviate = M.email.filter(e => !/^\[CTL Baskin\]/.test(e.subject));
verifica(inviate.length === conf.length, 'partono ' + inviate.length + ' richieste');
verifica(inviate.every(e => /accetti l'incarico in CTL\?$/.test(e.subject)),
  'con l\'oggetto giusto: "' + (inviate[0] || {}).subject + '"');

console.log('\n=== La finestra per accettare e di poche ore, con data e ora');
verifica(scadenzaIncarico_(cfg_()).ore === 6, 'senza parametro sono 6 ore');
verifica(conf.every(r => /entro 6 ore, cioè entro il \d\d\/\d\d\/\d{4} \d\d:\d\d/.test(String(r[3]))),
  'il messaggio dice le ore e la data e ora precise');
verifica(conf.every(r => /finestra è stretta/.test(String(r[3]))), 'e spiega perche e cosi stretta');
setCfg_('Ore per confermare l\'incarico', 2);
const s2 = scadenzaIncarico_(cfg_());
verifica(s2.ore === 2 && Math.abs(s2.quando - new Date()) > 1.9 * 3600000,
  'il parametro di Config cambia la finestra: ' + s2.ore + ' ore');
preparaConfermeCommissari();
verifica(foglio('Conferme').d.slice(1).filter(r => r[0]).every(r => /entro 2 ore/.test(String(r[3]))),
  'e i messaggi lo seguono');

// ---------------- Posto vacante: si chiede a chi non e rappresentato ----------------
console.log('\n=== Un posto resta vacante: candidature alle societa senza commissario');
const quadro = societaScoperte_();
verifica(quadro.scoperte.length > 0, 'qualche societa non ha un commissario: ' + quadro.scoperte.join(', '));
verifica(quadro.scoperte.indexOf('Società Charlie') >= 0,
  'chi non ha presentato nessuno risulta scoperta');
verifica(quadro.scoperte.indexOf(sq_(commissari_().filter(x => x.rinuncia)[0])) >= 0,
  'e anche la societa di chi ha rinunciato: il suo posto e vacante');
verifica(!quadro.scoperte.some(n => sqCoperte_().indexOf(n) >= 0),
  'mentre chi ha un commissario in carica non viene disturbato');
M.alerts.length = 0;
richiestaCandidatureScoperte();
verifica(/NESSUNA MAIL È STATA INVIATA/.test(String(M.alerts[M.alerts.length - 1])),
  'lo dice anche la richiesta alle societa scoperte');
const scoperte = foglio('Conferme').d.slice(1).filter(r => r[0]);
verifica(scoperte.length === quadro.scoperte.length, 'un messaggio per societa scoperta: ' + scoperte.length);
verifica(scoperte.every(r => r[2] === 'Candidatura per un posto vacante'), 'la colonna "Riguarda" lo dice');
const vac = String(scoperte[0][3]);
verifica(/vacant/.test(vac) && /graduatoria delle riserve non basta/.test(vac),
  'il messaggio spiega perche si richiede: le riserve non bastano');
verifica(/non ha un proprio commissario in Commissione/.test(vac), 'e perche proprio a loro');
verifica(/Una sola candidatura per società/.test(vac), 'la regola di una candidatura per societa resta');
verifica(/qualifica: Allenatore, Aiuto allenatore o Altro/.test(vac), 'con le stesse cose da scrivere');
verifica(scoperte.every(r => !/#c=|\?c=/.test(String(r[3]))), 'e nessun link di voto');
M.email.length = 0;
inviaConferme();
const vacEmail = M.email.filter(e => !/^\[CTL Baskin\]/.test(e.subject));
verifica(vacEmail.every(e => /serve un candidato per la CTL$/.test(e.subject)),
  'oggetto distinto dagli altri: "' + (vacEmail[0] || {}).subject + '"');

console.log(errori ? '\n' + errori + ' verifiche fallite.' : '\nTutte le verifiche superate.');
process.exit(errori ? 1 : 0);
