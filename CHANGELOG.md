# Changelog

## v22
- **Tolto il link `mailto:`** dal foglio "Messaggi": dava errore nei client, e per sua natura non poteva funzionare bene — i programmi di posta tagliano gli indirizzi `mailto:` lunghi, e il nostro testo lo è. Al suo posto c'è qualcosa di più utile.
- **Colonna "Rimanda"** nel foglio "Messaggi", con una casella per riga, e la voce *Messaggi ai votanti → Rimanda le email spuntate…*: si spunta chi dice di non aver ricevuto niente e si rimanda solo a quelli. A invio fatto le spunte si tolgono da sole.
- **Colonna "Email" anche nel foglio "Commissari"**, per i round 2 e 3. Gli indirizzi si cercano per **nome** e non per codice, così continuano a valere anche nei ballottaggi, dove i codici cambiano.
- **Due voci apposta per i messaggi del Presidente e del Vice**, che funzionano anche a round chiuso: si preparano prima di aprire. Il foglio "Messaggi" si ricorda per quale round è stato fatto, e l'invio usa quello, non il round attivo.
- **Il messaggio c'è per tutti**, anche per chi non ha un indirizzo: quei messaggi si mandano per un altro canale, e a fine preparazione il programma dice chi è rimasto senza.
- **Report e Riepilogo urna stanno in un A4 verticale**: quattro colonne di larghezza fissa (660 px in tutto) e testo a capo, al posto del ridimensionamento automatico che su una riga lunga allargava la colonna all'infinito e mandava la stampa su due pagine affiancate.
- **"Inizializza / aggiorna fogli" rigenera anche Report, Riepilogo urna e Messaggi.** Prima no, e il risultato era che dopo un aggiornamento di versione quei fogli restavano com'erano — niente impaginazione A4, niente colonna "Rimanda" — e sembrava che il programma non fosse cambiato. Era una trappola: l'unica voce che uno lancia dopo aver aggiornato il codice è proprio quella.
- Nelle righe che occupano la sola prima colonna (titoli, note, piede) le celle vengono **unite** sulle quattro colonne: col testo a capo, altrimenti, un titolo lungo si incolonnava dentro 180 pixel.
- *Mostra interfaccia attiva e indirizzi* dice ora **la versione del codice**, da confrontare con quella in fondo alla pagina di voto: se la pagina ne mostra una più vecchia, la web app non è stata ridistribuita.
- Versione aggiornata ovunque la si legge — pagina di voto, app Google, piede di tutti i resoconti — perché la prende dalla costante `VERSIONE`.

## v21
- **Una società, un solo candidato.** Era la sola regola di candidatura che il programma non controllava. Ora il round 1 non si apre finché una società ne presenta più di uno: la segnalazione dice quale società e con quali nomi, e la stessa verifica compare fra gli avvisi di *Inizializza / aggiorna fogli*. Gli **autocandidati** sono esclusi dal conteggio, perché non sono tesserati con nessun club e quindi non occupano il posto di nessuno.
- **Nuovi dati di prova**, con città e personaggi Disney al posto dell'alfabeto fonetico: `Società Sportiva Paperopoli ASD` → squadra `Paperopoli 1` → candidato `Paolino Paperino`. Stessi numeri dell'Emilia-Romagna — 11 società, 16 squadre, 11 candidati, uno per società più un autocandidato, una società senza candidati — e rispettano la regola nuova. Le email di prova sono `@example.invalid`: per costruzione non recapitano a nessuno, e l'invio diretto le salta.
- **Nella scheda, il nome della società per cui si sta votando è grande e in evidenza**, in un riquadro con l'etichetta sopra: è l'unico modo che ha il votante di accorgersi di avere in mano il codice di un'altra società. Prima era un occhiello da dieci pixel.
- **Il contatore delle preferenze è grande e riquadrato**, e diventa verde quando sono esaurite: molti non sanno di poterne dare più di una, e un `5/7` in piccolo non glielo dice. Lo stesso vale per la app Google.
- **Due colonne nuove nel foglio "Società"**, in coda alle altre: **Email** e **Codice affiliazione**. L'email è il solo posto dove l'indirizzo resta; il codice di affiliazione serve per gli atti e non entra in nessun messaggio.
- **Il foglio "Messaggi" porta l'indirizzo e un link che apre la mail già scritta** (`Destinatario · Codice · Email · Messaggio · Apri la mail già scritta`). Il link è un `mailto:` con destinatario, oggetto e testo compilati: apre la mail, non la manda. Attenzione alla lunghezza — i programmi di posta tagliano i `mailto:` oltre un limite che cambia da client a client, e il nostro testo è lungo: se il corpo arriva troncato si usa l'invio diretto. Gli indirizzi scritti nel foglio "Messaggi" vengono ricopiati in "Società", così non si perdono quando i messaggi si rifanno.
- **Più indirizzi per la stessa società**, separati da virgola o punto e virgola nella stessa cella: il messaggio arriva a tutti i referenti in una mail sola, e la scheda resta una (il codice si usa una volta). Vale per il `mailto:` e per l'invio diretto; un indirizzo scritto male non blocca quelli buoni della stessa cella, viene solo elencato fra quelli da sistemare.
- **Mittente delle email in Config** (*Mittente email*): lasciandolo vuoto vale `Sezione Territoriale Baskin EISI` seguito dalla Sezione. L'indirizzo di posta resta quello dell'account che manda — questo è solo il nome visualizzato.
- **Invio diretto dal menu** (*Messaggi ai votanti → Invia per email a chi ha l'indirizzo…*): un messaggio per votante, dal proprio account Google, senza copia conoscenza, perché ogni link è personale. Prima dell'invio dice chi riceverà, chi resta da avvisare a mano e quanta quota email resta per oggi.
- **All'apertura della votazione l'avviso parte da solo** a tutte le società che hanno un indirizzo, con dentro il link personale e **la data di chiusura**; se la votazione è stata aperta a mano e non c'è una chiusura programmata, il messaggio lo dice. Parte una volta per round: chiudere e riaprire non lo ripete, e l'azzeramento del round lo rimette in gioco. Vale anche per le aperture programmate e per i ballottaggi.
- **Nel messaggio alle società c'è ora un paragrafo sull'inoltro**: se preferiscono che voti un'altra persona della società possono semplicemente inoltrare il messaggio, perché il voto è identificato dal codice e vale una volta sola — con l'avvertenza di mettersi d'accordo, visto che la prima scheda depositata chiude il voto della società.
- **L'indirizzo del ponte entra nella pagina codificato in base64**, e il log della Action non lo stampa più (su un repository pubblico anche il log è pubblico). Non è cifratura e non vuole esserlo: la pagina deve usare quell'URL, quindi deve poterlo leggere, e chi apre gli strumenti per sviluppatori lo vede comunque nella prima chiamata. Serve a non lasciarlo in chiaro nel sorgente, dove lo raccoglierebbe qualunque crawler a caccia di endpoint Apps Script. Nel repository non c'era e continua a non esserci: resta il segnaposto `__PONTE__`.
- Messaggio più chiaro quando la pagina è pubblicata senza indirizzo del ponte: dice che manca la pubblicazione, invece di aggiungere la spiegazione sulla rete del telefono che non c'entra.
- Corretto in tutti i testi: **Coordinatore della Sezione Territoriale**, non "della Sezione Tecnica". Vale anche per il mittente delle email.
- **Il logo nei fogli punta alla cella di Config invece di avere l'indirizzo scritto dentro** (`=IMAGE(Config!$B$n)`): cambiando *Logo fogli (PNG)* si aggiornano tutti i resoconti da soli. Tolto il secondo argomento di `IMAGE`, che faceva dare errore alla formula.

## v20
- Tolto `enablement: true` da `configure-pages`, introdotto nella v19: non funziona. Creare il sito Pages dall'API richiede diritti di amministrazione che il `GITHUB_TOKEN` del workflow non ha, e il passo fallisce con *Resource not accessible by integration*. **Pages va acceso una volta a mano**, in *Settings → Pages → Source: GitHub Actions*; è l'unico passaggio della pubblicazione che non si può automatizzare. Il motivo è scritto nel workflow, accanto al passo.
- Nelle istruzioni, i due errori del primo giro e cosa significano: *Get Pages site failed — Not Found* (Pages non ancora acceso) e *Resource not accessible by integration* (permessi del workflow in sola lettura, da mettere su *Read and write* in Settings → Actions → General).

## v19
- La GitHub Action attiva GitHub Pages da sola al primo giro (`enablement: true`). Prima, su un repository dove Pages non era ancora acceso, il workflow si fermava con *Get Pages site failed — Not Found*: ora lo accende e prosegue, e resta comunque possibile farlo a mano da *Settings → Pages → Source: GitHub Actions*.

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
