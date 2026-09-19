# Votazione CTL Baskin

Sistema di voto online **anonimo**, con **un solo voto per squadra**, utilizzabile da telefono, per l'elezione della Commissione Tecnica Locale (CTL) di una sezione territoriale Baskin.

Funziona con un Foglio Google e Google Apps Script: nessun server da gestire, nessun account richiesto a chi vota.

## Cosa fa

- **Round 1 – Commissari CTL**: ogni squadra vota con un codice o link personale, fino a metà dei candidati (arrotondata per eccesso). Numero di commissari = metà delle squadre, per eccesso, minimo 3 e massimo 6. Qualifiche dei candidati (Allenatore, Aiuto allenatore, Autocandidatura) con deroga configurabile: gli aiuti allenatore entrano solo se mancano allenatori e autocandidature (max 1). Spareggio per anni di tesseramento/incarichi.
- **Round 2 – Presidente** e **Round 3 – Vice**: i commissari eletti votano con un link personale, a maggioranza semplice.
- **Formatore di riferimento** indicato senza votazione (votante solo se candidato come Autocandidatura).
- **Report** finale e **Riepilogo urna** per il custode, con controllo di coerenza e schede anonime per il riconteggio.
- **Sezione territoriale** e **anno sportivo** sulla pagina di voto e nei report.
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
| `LICENSE` | licenza MIT |

## Installazione rapida

1. Crea un Foglio Google → **Estensioni → Apps Script**.
2. Incolla `Code.gs`; aggiungi un file HTML chiamato `Index` con il contenuto di `Index.html`.
3. Ricarica il foglio → **🗳️ Votazione → Inizializza / aggiorna fogli**.
4. **Esegui il deployment → App web** (Esegui come: Me — Accesso: Chiunque).

Dettagli in [ISTRUZIONI.md](ISTRUZIONI.md).

## Licenza e citazione

Rilasciato con **licenza MIT**: puoi usarlo, modificarlo, ridistribuirlo e riutilizzarlo anche per altre discipline o scopi commerciali, a condizione di **mantenere l'avviso di copyright e il testo della licenza** in tutte le copie o parti sostanziali.

Se lo usi o lo adatti, cita il progetto originale:

> Votazione CTL Baskin — Daniele Lolli (UncleDan), https://github.com/UncleDan/votazione-ctl-baskin
