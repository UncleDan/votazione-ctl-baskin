# Changelog

## v18
- La GitHub Action non si ferma più se manca la variabile `PONTE`: pubblica lo stesso e lascia un avviso. Così si vede subito la pagina e si imposta l'indirizzo del ponte dopo, senza il giro vizioso "non pubblico finché non ho l'URL, non ho l'URL finché non pubblico". Finché la variabile manca, la pagina si apre ma rifiuta di votare, dicendo che l'indirizzo non è configurato.

## v17
- Nuova colonna **Nome breve** nel foglio "Società", in coda alle altre. La prima colonna continua a portare la ragione sociale esatta, che serve per gli atti; il nome breve è quello con cui la società si chiama davvero, ed è quello che vedono i votanti e che compare **nei messaggi, nella pagina di voto, nel Riepilogo urna, nel Report e nei ballottaggi**.
- All'inizializzazione il nome breve parte uguale alla ragione sociale, così niente cambia finché non lo accorci tu; dove è vuoto il programma usa comunque la ragione sociale.

## v16
- Nuovo foglio **Messaggi**: una riga per votante del round attivo, con il testo già pronto in **una sola cella**, da copiare e incollare nella chat della società. Contiene il link personale, il codice, quante preferenze si possono dare, l'eventuale data di chiusura e la spiegazione della ricevuta di voto. Si rigenera da *Prepara i messaggi per i votanti* e da solo ogni volta che i codici cambiano o si azzera qualcosa.
- **Freno sui tentativi a vuoto**: dopo tre codici sbagliati, il voto da quel dispositivo resta sospeso per un'ora. Il conteggio sta in una memoria tecnica del browser — niente di personale, niente che raggiunga un server, nessun tracciamento, quindi nessun banner da mostrare. Sopravvive al ricaricamento della pagina. È un freno, non una difesa: chi svuota i dati del sito riparte da zero, e la difesa vera resta la lunghezza del codice (otto caratteri su un alfabeto di diciotto).
- `verificaCodice` restituisce anche `motivo` (`codice`, `usato`, `chiusa`, `interfaccia`): solo `codice` fa scattare il freno, così chi ha già votato o arriva dall'ingresso sbagliato non viene bloccato per errore.

## v15
- **Ricevuta di voto.** Al deposito della scheda il votante riceve un codice `XXXX-XXXX`, generato al momento, scollegato sia dal suo codice di voto sia dal contenuto della scheda. Compare in grande su entrambe le pagine di voto, con l'invito a **fare subito uno screenshot o a trascriverla**: non è recuperabile, chiusa la pagina non la conosce più nessuno.
- Le ricevute sono elencate in ordine alfabetico nel **Riepilogo urna**, in coda a ogni round e ballottaggio: ritrovare la propria significa che la scheda è nell'urna ed è stata contata. Non dice come si è votato, e l'ordine alfabetico impedisce di risalire all'ordine di arrivo. Sono conservate in un elenco separato da quello delle schede, mescolato a parte, così nemmeno il confronto fra le due posizioni lega una ricevuta a una scheda.
- Gli azzeramenti cancellano anche le ricevute.

## v14
- **Tre azzeramenti distinti**, raccolti nel sottomenu *Azzeramenti*:
  - **Solo i risultati, stessi codici**: cancella schede, codici usati, ballottaggi, commissari, Presidente, Vice e resoconti, ma lascia società, squadre, candidati **e i codici di voto**. Si rivota subito con i link già inviati: serve per una prova andata storta, una votazione annullata o un secondo giro con gli stessi iscritti.
  - **Un round solo**: la vecchia voce *Azzera round…*, invariata.
  - **Tutto, per una nuova elezione**: come sopra, più società, squadre, candidati e i loro codici. Restano solo i parametri di Config.
  - **Tutto e riempi con dati di prova**: l'azzeramento totale seguito dal seed fittizio.
  In nessuno dei casi viene toccata la pubblicazione della app web: stesso indirizzo, nessuna ripubblicazione fra una tornata e l'altra.
- Per avere gli stessi iscritti ma codici nuovi: *Solo i risultati* seguito da *Round 1 → Rigenera TUTTI i codici e link società*.
- Corretto un difetto che si vedeva solo azzerando: `clearContents()` porta via anche la riga di intestazione e `ensureSheet_` non la riscriveva, perché il foglio esisteva già. Ora c'è `svuotaFoglio_`, che la rimette. Senza, dopo un azzeramento totale il foglio "Squadre" perdeva l'intestazione e il conteggio delle società sbagliava.

## v13
- **Logo EISI e Sezione Territoriale sulla scheda HTML.** La pagina statica ha ora la stessa testata della app Google: logo in hotlinking dal sito EISI (indirizzo da *Config → Logo pagina web*), **Sezione Territoriale** in evidenza sopra il titolo — ogni Sezione ha la propria CTL, quindi deve essere chiaro a quale elezione si sta votando — e anno sportivo sotto. Nel piede compaiono il link al codice sorgente, la versione e la nota di proprietà del logo, serviti dallo script invece che scritti nella pagina.
- `getInfo` restituisce anche `sezione`, `anno`, `proprietaLogo`, `repo` e `versione`, così la pagina statica non duplica nulla che sia già in Config.
- Allineato alla v11 il testo della deroga nelle due pagine di voto: gli aiuto allenatore entrano solo se *non bastano gli altri candidati*.

## v12
- Nuova voce **Azzera tutto e prepara una nuova elezione…**: interrompe qualunque votazione in corso e riporta il foglio allo stato iniziale — schede e codici usati dei tre round e di tutti i ballottaggi, commissari, Presidente, Vice, risultati, report, riepilogo urna, aperture e chiusure programmate — e rigenera i codici, così i link già inviati smettono di funzionare. Chiede a parte se cancellare anche società, squadre e candidati: rispondendo di no si rivota con gli stessi iscritti. **Non tocca la pubblicazione della app web**, quindi l'indirizzo resta lo stesso e lo stesso foglio si riusa per le elezioni successive senza ripubblicare nulla.
- I dati di prova comprendono ora anche un'**autocandidatura** (allenatore non tesserato, senza squadra): 13 candidati, 9 allenatori e 4 aiuto allenatore, 7 preferenze per scheda.
- Rifattorizzato l'azzeramento del singolo round in `azzeraUnRound_`, usato sia da *Azzera round…* sia dall'azzeramento totale.

## v11
- **Qualifica "Altro"** al posto di "Autocandidatura": la qualifica dice che cosa è il candidato (Allenatore, Aiuto allenatore, Altro), per i rari casi di candidabili che non sono nè allenatori nè aiuto allenatore.
- **L'autocandidatura si indica al posto della squadra.** Non è una qualifica ma il modo in cui si arriva in lista: chi si candida da sè senza essere tesserato con un club scrive `Autocandidatura` nella colonna Squadra, che ora la accetta dal menu a tendina. Così si distingue un allenatore non tesserato che *non* si candida da uno che lo fa. Le righe delle versioni precedenti vengono convertite all'inizializzazione: qualifica → `Altro` e, se la squadra era vuota, `Autocandidatura` al suo posto.
- Di conseguenza la deroga si legge: gli aiuto allenatore entrano solo se **non bastano gli altri candidati** (allenatori e Altro), al massimo quanti ne indica Config.
- Nuova voce di menu **Riempi con dati di prova…**: società, squadre e candidati inventati ma negli stessi numeri dell'Emilia-Romagna 2026/2027 — 11 società, 16 squadre, 12 candidati di cui 4 aiuto allenatore, due società senza candidati, 6 commissari da eleggere e 6 preferenze per scheda. Nomi dall'alfabeto fonetico: nessuna persona e nessun club reale. Rifiutata se c'è una votazione aperta o se ci sono già voti.
- **L'interfaccia predefinita è ora HTML**: un foglio nuovo nasce con la pagina web come ingresso di voto. Per restare sulla app Google basta *Interfaccia di voto → Usa la app Google (semplice)*.
- Nuova simulazione `test/simulazione-dati-prova.js`; le altre quattro restano verdi.

## v10
- **Due interfacce di voto, una sola attiva per votazione.** Nuovo parametro *Config → Interfaccia di voto*: `Semplice` (la app Google di sempre) oppure `HTML` (pagina statica pubblicata su GitHub Pages). Si cambia dal sottomenu **Interfaccia di voto**, che riscrive anche tutti i link di società, commissari e ballottaggio verso l'ingresso scelto.
- Il controllo sta dal lato che scrive: una scheda che arriva dall'ingresso non attivo viene **rifiutata** e il votante riceve l'indirizzo giusto. Chi apre un vecchio link della app, quando è attiva l'interfaccia HTML, trova un cartello con il collegamento alla pagina e il proprio codice già inserito.
- Nuovo **ponte `doPost`**: stesse funzioni della app Google (`getInfo`, `verificaCodice`, `inviaVoto`), quindi stessa urna, stessi controlli, stesso formato della scheda. Risponde in JSON a richieste "semplici" in `text/plain`, per non far scattare il preflight CORS che Apps Script non gestisce.
- Nuova cartella **`scheda-html/`** con l'interfaccia statica, e workflow **`.github/workflows/pages.yml`** che pubblica su GitHub Pages solo quella cartella, inserendo l'indirizzo del ponte dalla variabile `PONTE` del repository.
- Con l'interfaccia HTML il codice viaggia nel **frammento** del link (`#c=…`), che i browser non inviano al server: non finisce nei log di nessuno.
- `getInfo` restituisce anche `societa` e `squadraNome` separati (per raggruppare i candidati) e l'indirizzo del logo.
- Nuova simulazione `test/simulazione-interfaccia.js`: le due porte, il rifiuto dall'ingresso chiuso, il cartello, e il conteggio che somma le schede entrate dall'una e dall'altra.

## v9
- README con i link diretti a `Code.gs` e `Index.html` su GitHub (pulsante *Copy raw file*) e al contenuto grezzo, apribili in una nuova scheda.
- Codici di voto nel formato **XXXX-9999** (quattro lettere maiuscole A–H e quattro cifre), assegnati anche dall'inizializzazione.
- **Genera codici e link mancanti**: assegna il codice solo a chi non ce l'ha e aggiorna i link, senza azzerare società, squadre, candidati o voti già espressi. Nuove voci **Rigenera TUTTI i codici e link società** e **Rigenera codici e link commissari**, rifiutate se ci sono già voti nel round interessato.
- **Votazioni programmate**: apertura e chiusura a tempo del voto commissari e del voto per il Presidente (nuovi parametri in Config e sottomenu dedicato). Alla chiusura del round 1 i risultati vengono calcolati, i commissari eletti ricevono codice e link e si apre il voto per il Presidente; alla sua chiusura si calcolano i risultati finali. Avvisi per email a ogni passaggio.
- **Proroga automatica**: se alla chiusura programmata manca anche un solo voto, la votazione resta aperta, la chiusura slitta delle ore indicate in Config (24 di base, proroghe illimitate) e arriva una email con l'elenco di chi non ha ancora votato.
- **Ballottaggio automatico**: se alla chiusura programmata hanno votato tutti ma c'è una parità, il ballottaggio viene preparato e aperto da solo (nuovi codici e link per tutti i votanti nell'email) e chiuso dopo le ore indicate in Config ("Durata ballottaggio (ore)"); risolta la parità la catena riprende da sola, altrimenti parte il ballottaggio successivo fino al massimo di 3.
- **Sorteggio della parità residua**: se dopo i 3 ballottaggi la parità resta, nuova voce di menu *Ballottaggio → Sorteggia la parità residua…* e, nelle votazioni programmate, sorteggio automatico con avviso per email; l'estrazione è registrata nel foglio "Risultati ballottaggi" (con data e ora) e nei risultati del round ("Eletto per sorteggio"), e la catena prosegue da sola.
- La **chiusura manuale** vale anche per le votazioni a tempo: annulla il trigger pendente e ferma la proroga.
- La pagina di voto indica quando la votazione apre o si chiude. Nuove simulazioni `test/simulazione-programmata.js` e `test/simulazione-ballottaggio-automatico.js`.

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
