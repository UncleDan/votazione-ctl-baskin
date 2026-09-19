# Changelog

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
