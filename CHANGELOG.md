# Changelog

## v9
- Codici di voto nel formato **XXXX-9999** (quattro lettere maiuscole A–H e quattro cifre), assegnati anche dall'inizializzazione.
- **Genera codici e link mancanti**: assegna il codice solo a chi non ce l'ha e aggiorna i link, senza azzerare società, squadre, candidati o voti già espressi. Nuove voci **Rigenera TUTTI i codici e link società** e **Rigenera codici e link commissari**, rifiutate se ci sono già voti nel round interessato.
- **Votazioni programmate**: apertura e chiusura a tempo del voto commissari e del voto per il Presidente (nuovi parametri in Config e sottomenu dedicato). Alla chiusura del round 1 i risultati vengono calcolati, i commissari eletti ricevono codice e link e si apre il voto per il Presidente; alla sua chiusura si calcolano i risultati finali. Avvisi per email a ogni passaggio.
- **Proroga automatica**: se alla chiusura programmata manca anche un solo voto, la votazione resta aperta, la chiusura slitta delle ore indicate in Config (24 di base, proroghe illimitate) e arriva una email con l'elenco di chi non ha ancora votato.
- La **chiusura manuale** vale anche per le votazioni a tempo: annulla il trigger pendente e ferma la proroga.
- La pagina di voto indica quando la votazione apre o si chiude. Seconda simulazione `test/simulazione-programmata.js`.

## v8
- Logo EISI in hotlinking dal sito eisi.it: SVG sulla pagina di voto, PNG nei resoconti (in testa a Report, Riepilogo urna e Risultati ballottaggi, nel piede dei fogli tabellari). URL configurabili in Config.
- File NOTICE e nota nei resoconti e sulla pagina: il logo è di proprietà di Ente Italiano Sport Inclusivi e non è coperto dalla licenza MIT.

## v7
- Voto per **società**: nuovo foglio "Società" (codici e link) e foglio "Squadre" con squadra → società; commissari = metà delle società. Migrazione automatica dalla v6.
- **Ballottaggi** per parità non risolvibili (pari preferenze e pari anni) su round 1, Presidente e Vice: fino a 3, a voto multiplo tra i soli candidati pari, nuovi link a ogni ballottaggio; foglio "Risultati ballottaggi"; ballottaggi inclusi nel Riepilogo urna e nel Report.
- "Sezione Territoriale" con le maiuscole (parametro rinominato automaticamente).
- Nota "precedenza per anni" solo su chi effettivamente precede.
- Cartella `test/` con mock di Apps Script e simulazione completa.

## v6
- Link diretto e cliccabile al repository, con numero di versione, in fondo alla pagina di voto e in tutti i fogli di resoconto (Risultati, Risultati Presidente, Risultati Vice, Report, Riepilogo urna).
- Parametro "Anno sportivo" (testo libero) sulla pagina di voto e nei resoconti.

## v5
- Parametro "Sezione territoriale" sulla pagina di voto, nei risultati, nel report e nel riepilogo urna.
- Foglio "Riepilogo urna" per il custode: partecipazione, controllo schede = codici usati, preferenze, schede anonime (conteggi nascosti a round aperto).
- Riferimento al repository GitHub nella pagina di voto e nei report; licenza MIT.

## v4
- Round 2 (Presidente) e Round 3 (Vice) votati dai commissari eletti con link personale, maggioranza semplice.
- Formatore di riferimento indicato senza votazione.
- Foglio "Report" con eletti, Presidente, Vice e Formatore di riferimento.

## v3
- Qualifica dei candidati (Allenatore / Aiuto allenatore / Autocandidatura) con deroga "max 1 aiuto allenatore".
- Foglio "Squadre" con abbinamento candidato→squadra e link diretti di voto.

## v2
- Numero di commissari automatico: metà delle società per eccesso, min 3, max 6.

## v1
- Prima versione: voto anonimo con codice per società, max preferenze pari a metà dei candidati, spareggio per anni.
