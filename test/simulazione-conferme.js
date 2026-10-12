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
const riga = nome => foglio('Conferme candidature').d.find(r => r[0] === nome) || [];

// ---------------- Preparazione: 4 societa, candidature grezze ----------------
setup();
setCfg_('Sezione Territoriale', 'Emilia-Romagna');
setCfg_('Anno sportivo', '2026/27');
setCfg_('Scadenza conferma candidature', 'venerdì 7 novembre');
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

console.log('=== Prepara le richieste');
preparaConferme();
const sh = foglio('Conferme candidature');
verifica(sh.d[0][0] === 'Società' && sh.d[0][4] === 'Da inviare', 'il foglio ha le colonne giuste');
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

console.log(errori ? '\n' + errori + ' verifiche fallite.' : '\nTutte le verifiche superate.');
process.exit(errori ? 1 : 0);
