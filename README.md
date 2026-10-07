# Votazione CTL Baskin

Sistema di voto online **anonimo**, con **un solo voto per società**, utilizzabile da telefono, per l'elezione della Commissione Tecnica Locale (CTL) di una Sezione Territoriale Baskin.

Funziona con un Foglio Google e Google Apps Script: nessun server da gestire, nessun account richiesto a chi vota.

## Cosa fa

- **Round 1 – Commissari CTL**: ogni società vota con un codice o link personale, fino a metà dei candidati (arrotondata per eccesso). Numero di commissari = metà delle società, per eccesso, minimo 3 e massimo 6. Le squadre sono abbinate alla loro società. Qualifiche dei candidati (Allenatore, Aiuto allenatore, Autocandidatura) con deroga configurabile: gli aiuti allenatore entrano solo se mancano allenatori e autocandidature (max 1). Spareggio per anni di tesseramento/incarichi.
- **Round 2 – Presidente** e **Round 3 – Vice**: i commissari eletti votano con un link personale, a maggioranza semplice.
- **Ballottaggi**: parità non risolvibili con gli anni (pari preferenze e pari anni) sui posti in palio si risolvono con fino a 3 ballottaggi a voto multiplo tra i soli candidati a pari merito, ciascuno con nuovi link. Se la parità resiste, il sorteggio (voce di menu o automatico nelle votazioni programmate) la chiude e resta registrato nei risultati. Con le votazioni programmate il ballottaggio si prepara e si apre da solo.
- **Votazioni programmate**: il voto commissari e quello per il Presidente possono aprirsi e chiudersi a tempo. Alla chiusura, se hanno votato tutti, i risultati vengono calcolati, i commissari eletti ricevono codice e link e si apre il voto per il Presidente; alla sua chiusura arrivano i risultati finali. Se c'è una parità, il ballottaggio viene preparato e aperto in automatico, con nuovi link per tutti e chiusura programmata; se nemmeno i 3 ballottaggi la risolvono si procede per **sorteggio**, registrato nei risultati, e la catena prosegue. Se manca anche un solo voto la votazione resta aperta e la chiusura è prorogata (ore configurabili, di base 24), con email che elenca chi non ha votato. La chiusura manuale è sempre possibile e ferma la proroga.
- **Codici** nel formato `XXXX-9999` (quattro lettere A–H e quattro cifre), generabili e rigenerabili senza azzerare società, squadre, candidati o voti già espressi.
- **Formatore di riferimento** indicato senza votazione (votante solo se candidato come Autocandidatura).
- **Report** finale e **Riepilogo urna** per il custode, con controllo di coerenza e schede anonime per il riconteggio.
- **Sezione Territoriale** e **anno sportivo** sulla pagina di voto e nei report.
- Link diretto al codice sorgente, con numero di versione, sulla pagina di voto e in tutti i resoconti, per trasparenza.

## Anonimato

Le schede sono salvate senza codice, votante né orario, in posizione casuale, fuori dal foglio (quindi non ricostruibili dalla cronologia versioni). Dei codici usati resta solo un hash: si sa *chi* ha votato, non *come*.

## File

| File | Contenuto |
|---|---|
| `Code.gs` | logica lato server (Apps Script) |
| `Index.html` | pagina di voto (da chiamare `Index` nell'editor Apps Script) |
| `ISTRUZIONI.md` | installazione e uso passo per passo |
| `CHANGELOG.md` | storico delle versioni |
| `test/` | mock di Apps Script e simulazioni (`simulazione.js`, `simulazione-programmata.js`, `simulazione-ballottaggio-automatico.js`) |
| `LICENSE` | licenza MIT (codice) |
| `NOTICE` | avvisi di copyright e proprietà del logo EISI |

## Copia e incolla il codice

Apri il file su GitHub e usa il pulsante **Copy raw file** (l'icona di copia in alto a destra), oppure apri direttamente il contenuto grezzo e copia tutto:

| File | Su GitHub (pulsante copia) | Contenuto grezzo |
|---|---|---|
| `Code.gs` | <a href="https://github.com/UncleDan/votazione-ctl-baskin/blob/main/Code.gs" target="_blank" rel="noopener">apri in una nuova scheda</a> | <a href="https://raw.githubusercontent.com/UncleDan/votazione-ctl-baskin/main/Code.gs" target="_blank" rel="noopener">raw</a> |
| `Index.html` | <a href="https://github.com/UncleDan/votazione-ctl-baskin/blob/main/Index.html" target="_blank" rel="noopener">apri in una nuova scheda</a> | <a href="https://raw.githubusercontent.com/UncleDan/votazione-ctl-baskin/main/Index.html" target="_blank" rel="noopener">raw</a> |

Nell'editor Apps Script incolla `Code.gs` nel file omonimo e `Index.html` in un file HTML chiamato esattamente `Index`.

## Installazione rapida

1. Crea un Foglio Google → **Estensioni → Apps Script**.
2. Incolla `Code.gs`; aggiungi un file HTML chiamato `Index` con il contenuto di `Index.html`.
3. Ricarica il foglio → **🗳️ Votazione → Inizializza / aggiorna fogli**.
4. **Esegui il deployment → App web** (Esegui come: Me — Accesso: Chiunque).

Dettagli in [ISTRUZIONI.md](ISTRUZIONI.md).

## Logo

La pagina di voto e i resoconti mostrano il logo di Ente Italiano Sport Inclusivi, caricato in **hotlinking** dal sito eisi.it (SVG per la pagina web, PNG per i fogli Google, che non visualizzano SVG). Gli indirizzi si cambiano o si svuotano in *Config*.

## Licenza e citazione

Rilasciato con **licenza MIT**: puoi usarlo, modificarlo, ridistribuirlo e riutilizzarlo anche per altre discipline o scopi commerciali, a condizione di **mantenere l'avviso di copyright e il testo della licenza** in tutte le copie o parti sostanziali.

**Il logo EISI è di proprietà di Ente Italiano Sport Inclusivi**: non è coperto dalla licenza MIT, non è incluso nel repository e per usarlo serve l'autorizzazione di EISI (dettagli in [NOTICE](NOTICE)).

Se lo usi o lo adatti, cita il progetto originale:

> Votazione CTL Baskin — Daniele Lolli (UncleDan), https://github.com/UncleDan/votazione-ctl-baskin
