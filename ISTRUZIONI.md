# Votazione CTL Baskin — istruzioni (v21)

Voto online anonimo, utilizzabile da telefono senza account Google:

| Fase | Chi vota | Chi è votabile | Preferenze | Esito |
|---|---|---|---|---|
| Round 1 – Commissari CTL | una scheda per **società** | foglio *Candidati* | metà dei candidati (per eccesso) | commissari eletti |
| Round 2 – Presidente | ogni commissario eletto | tutti i commissari | 1 | il più votato |
| Round 3 – Vice | ogni commissario eletto | commissari tranne il Presidente | 1 | il più votato |
| Ballottaggio (fino a 3) | gli stessi votanti del round | solo i candidati a pari merito | quanti sono i posti in parità | i più votati |

Il **Formatore di riferimento** non si vota: si indica in *Config*.

Codice sorgente aperto: <https://github.com/UncleDan/votazione-ctl-baskin> (licenza MIT). Per trasparenza il link diretto e cliccabile, con il numero di versione, compare in fondo alla pagina di voto e in tutti i fogli di resoconto.

## Da dove si vota: app Google o pagina web

Il sistema ha due ingressi, e per ogni votazione **ne vale uno solo**.

- **Semplice**: si vota dalla app Google, come sempre. Non serve altro.
- **HTML** (predefinito su un foglio nuovo): si vota da una pagina pubblicata su GitHub Pages, che parla con questo stesso foglio. Più curata da telefono, ma dipende da una pubblicazione in più.

Si sceglie da **🗳️ Votazione → Interfaccia di voto**. Cambiando ingresso, tutti i link di società, commissari ed eventuali ballottaggi vengono riscritti: **rimandali ai votanti**, perché i vecchi smettono di funzionare. Chi apre un vecchio link trova un cartello che lo porta alla pagina giusta, con il suo codice già inserito, quindi nessuno resta a piedi.

Il controllo non è solo un'indicazione a schermo: una scheda che arriva dall'ingresso chiuso viene rifiutata dal lato che scrive. Si può cambiare interfaccia anche a votazione aperta — le schede già depositate restano valide, perché l'urna e il formato sono gli stessi — ma conviene deciderlo prima di mandare i link.

### Per attivare l'interfaccia HTML

1. Nel repository GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Questo passaggio va fatto a mano una volta sola e non si può automatizzare: accendere Pages dall'API richiede diritti di amministrazione che il token del workflow non ha.
   Controlla anche **Settings → Actions → General → Workflow permissions**: dev'essere *Read and write permissions*, altrimenti al workflow viene negato il permesso di pubblicare.
2. **Settings → Secrets and variables → Actions → Variables → New variable**: nome `PONTE`, valore l'indirizzo `/exec` della tua web app Apps Script (lo stesso che usi per votare dalla app). Dev'essere una **Variable**, non un **Secret**: i secret non sono leggibili come `vars.PONTE` e la pagina resterebbe senza indirizzo. Se la variabile manca il workflow pubblica lo stesso, con un avviso, e la pagina si apre ma rifiuta di votare.
3. Fai un push (o lancia il workflow a mano): la Action pubblica solo la cartella `scheda-html/` e ci inserisce l'indirizzo del ponte, **codificato in base64**.
4. Nel foglio: **Interfaccia di voto → Usa la pagina web (HTML)…** e incolla l'indirizzo della pagina pubblicata.
**I due errori del primo giro, e cosa vogliono dire.** *Get Pages site failed — Not Found*: Pages non è ancora acceso, fai il punto 1. *Resource not accessible by integration*: al workflow mancano i permessi, controlla che *Workflow permissions* sia su *Read and write*.

5. Provala tu con un codice vero prima di mandare i link. Se qualcosa non va, torna a **Usa la app Google (semplice)**: nessuno se ne accorge.

Il ponte è lo stesso script: le due pagine usano le stesse funzioni, quindi la stessa urna, gli stessi controlli e lo stesso formato della scheda. Con l'interfaccia HTML il codice viaggia dopo il cancelletto (`#c=…`): i browser non inviano quella parte al server, quindi il codice non finisce nei log.

### L'indirizzo del ponte e il base64

Nel repository l'indirizzo non c'è: nel sorgente resta il segnaposto `__PONTE__`, e la Action lo sostituisce al momento della pubblicazione pescandolo dalla variabile. Nella pagina pubblicata ci finisce **in base64**, e il log della Action non lo stampa — su un repository pubblico anche il log è pubblico.

Sia chiaro cos'è e cosa non è. **Non è cifratura.** La pagina deve usare quell'indirizzo, quindi deve poterlo leggere, e chi apre gli strumenti per sviluppatori lo vede comunque nella prima chiamata: è lì che la richiesta deve andare. Serve solo a non lasciarlo in chiaro nel sorgente, dove lo raccoglierebbe qualunque crawler a caccia di endpoint Apps Script. Una tendina, non una serratura.

E non è una perdita grave se si sa: senza un codice valido il ponte risponde solo a `info`, cioè titolo, sezione e lista dei candidati — le stesse cose che si leggono aprendo la pagina. A proteggere il voto è il codice per società, non questo indirizzo.

### Pubblicare altrove (per esempio sul sito della Sezione Territoriale)

La pagina è un unico file senza dipendenze: funziona da qualunque dominio, perché il ponte non guarda da dove arriva la richiesta. Per spostarla:

1. Copia nel nuovo repository la cartella `scheda-html/` **e** il workflow `.github/workflows/pages.yml`, poi crea lì la variabile `PONTE`. Conviene molto di più che pubblicare a mano: pubblicando a mano l'indirizzo finisce committato nel sorgente, che è proprio quello che il workflow evita.
2. Se proprio lo fai a mano, l'indirizzo va messo **già in base64** al posto di `__PONTE__`. Lo ottieni dalla console del browser con `btoa("https://script.google.com/…/exec")`, oppure da terminale con `printf '%s' 'https://…/exec' | base64 -w0`.
3. Nel foglio: *Interfaccia di voto → Usa la pagina web (HTML)…* con il nuovo indirizzo, poi rigenera i messaggi. I link già inviati puntano al vecchio indirizzo e vanno rimandati.
4. **Spegni la copia vecchia.** Il programma distingue l'app Google dalla pagina web, non una pagina web dall'altra: se resta online, continua a funzionare e le schede finiscono nella stessa urna. Non è un rischio per il voto, ma confonde chi ha il link vecchio.


## Una società, un solo candidato

Ogni società può presentare **un solo candidato**. Il programma lo controlla: se una società ne ha più di uno il round 1 **non si apre**, e la segnalazione dice quale società e con quali nomi, così sai esattamente quali righe sistemare nel foglio *Candidati*. Lo stesso controllo compare fra gli avvisi di *Inizializza / aggiorna fogli*, quindi te ne accorgi mentre inserisci i dati e non il giorno dell'apertura.

Gli **autocandidati** sono fuori dal conteggio: non essendo tesserati con nessun club non occupano il posto di nessuna società. Una società può quindi avere il suo candidato anche se un suo ex allenatore, oggi non tesserato, si è candidato da sé.

## Qualifiche e autocandidature

La colonna **Qualifica** dice che cosa è il candidato: `Allenatore`, `Aiuto allenatore` oppure `Altro`, quest'ultimo per i rari casi di persone candidabili che non rientrano nelle prime due.

L'**autocandidatura** non è una qualifica: è il modo in cui si arriva in lista. Chi si candida da sè senza essere tesserato con un club si indica scrivendo `Autocandidatura` nella colonna **Squadra**, che la accetta dal menu a tendina insieme alle squadre iscritte. Così un allenatore attualmente non tesserato che *non* si candida semplicemente non compare, mentre chi si candida ha la sua riga senza doversi inventare una squadra.

La deroga sugli aiuto allenatore si legge di conseguenza: entrano solo se **non bastano gli altri candidati** — allenatori e `Altro`, autocandidati compresi — e comunque al massimo quanti ne indica *Config → Max aiuti allenatore*.

Se arrivi da una versione precedente, dove `Autocandidatura` era una qualifica, l'inizializzazione converte le righe da sola: la qualifica diventa `Altro` e, se la squadra era vuota, ci mette `Autocandidatura`. Chi aveva sia la qualifica sia una squadra tiene la squadra: controlla quelle righe.

## Provare senza dati veri

**🗳️ Votazione → Azzeramenti → Tutto e riempi con dati di prova…** sostituisce società, squadre e candidati con dati inventati, ma negli stessi numeri dell'Emilia-Romagna 2026/2027: 11 società, 16 squadre, 11 candidati di cui 3 aiuto allenatore e uno autocandidato, una società senza candidati, 6 commissari da eleggere e 6 preferenze per scheda. Rispettano la regola "una società, un solo candidato".

I nomi sono città e personaggi Disney — *Società Sportiva Paperopoli ASD* → squadra *Paperopoli 1* → candidato *Paolino Paperino* —: nessuna persona e nessun club reale, e nessun nome confondibile con quelli veri. Anche gli indirizzi email ci sono, ma finiscono per `@example.invalid`: per costruzione non recapitano a nessuno, e l'invio diretto li salta.

Il titolo viene marcato **(PROVA)**, così non si confonde con una votazione vera: toglilo quando passi ai dati definitivi. La voce si rifiuta di partire se c'è una votazione aperta o se ci sono già voti espressi.


## Ricominciare da capo

Nel sottomenu **🗳️ Votazione → Azzeramenti** ci sono quattro voci. Tutte interrompono qualunque votazione in corso, e **nessuna tocca la pubblicazione della app web**: l'indirizzo resta lo stesso e non devi ripubblicare niente, né fra un'elezione e l'altra né fra una prova e l'altra.

**Solo i risultati, stessi codici.** Cancella schede, codici usati, ballottaggi, commissari eletti, Presidente, Vice, risultati, report e riepilogo urna. Restano società, squadre, candidati **e i codici**: si rivota subito e i link già inviati continuano a funzionare. È la voce giusta per una prova andata storta, per una votazione annullata o per rifare il giro con gli stessi iscritti.

**Un round solo.** Azzera un round per volta, con i suoi ballottaggi, lasciando in piedi tutto il resto.

**Tutto, per una nuova elezione.** Come la prima, più società, squadre, candidati e i loro codici. Restano solo i parametri di *Config* — sezione, anno, logo, interfaccia di voto, deroghe — che di solito non cambiano. Da usare per un'altra Sezione Territoriale o un'altra stagione.

**Tutto e riempi con dati di prova.** L'azzeramento totale seguito dal seed fittizio descritto sopra.

Se ti serve la via di mezzo — stessi iscritti ma codici nuovi, per esempio perché i vecchi link hanno girato troppo — usa *Solo i risultati* e subito dopo *Round 1 → Rigenera TUTTI i codici e link società*.

## La ricevuta di voto

Chi deposita la scheda riceve un codice tipo `7K2M-94QD`, mostrato in grande con l'invito a fare uno screenshot o a trascriverlo. **Non è recuperabile**: non è scritto da nessuna parte accanto al nome del votante, quindi chiusa la pagina non lo conosce più nessuno, nemmeno tu.

A spoglio concluso le ricevute compaiono nel foglio **Riepilogo urna**, in fondo a ogni round, in ordine alfabetico. Chi ritrova la propria sa che la sua scheda è nell'urna ed è stata contata.

Quello che la ricevuta **non** fa è dire come si è votato: è generata a caso al momento del deposito, non deriva né dal codice del votante né dalle preferenze, e sta in un elenco separato da quello delle schede, mescolato per conto suo. Nemmeno confrontando le posizioni nei due elenchi si può legare una ricevuta a una scheda. È la condizione perché resti un voto anonimo e insieme verificabile.

Vale la pena spiegarlo nella comunicazione che accompagna i link: una ricevuta che nessuno sa a cosa serve viene buttata via.


## I messaggi per i votanti

Il foglio **Messaggi** ha una riga per ogni votante del round attivo: *Destinatario · Codice · Email · Messaggio da copiare e incollare · Apri la mail già scritta*. Il testo sta tutto in **una sola cella**: la copi e la incolli nella chat della società, senza ricomporlo ogni volta. Dentro c'è il link personale, il codice, quante preferenze si possono dare, l'eventuale data di chiusura, la spiegazione della ricevuta e l'avvertenza che il messaggio **si può inoltrare** a un'altra persona della società — il voto è identificato dal codice, non da chi lo usa, e vale una volta sola.

Si rigenera da **🗳️ Votazione → Messaggi ai votanti → Prepara i messaggi**, e da solo ogni volta che i codici cambiano o che azzeri qualcosa. Per il round 2 lancialo dopo *Prepara commissari e link*: i destinatari diventano i commissari eletti.

### Le email

Gli indirizzi stanno nella colonna **Email** del foglio *Società*. Puoi scriverli anche direttamente nel foglio *Messaggi*: alla rigenerazione successiva vengono ricopiati in *Società*, dove restano (il foglio *Messaggi* si riscrive da capo ogni volta).

**Più indirizzi per la stessa società** si scrivono nella stessa cella separati da virgola (o punto e virgola): una società ha spesso due referenti. Il messaggio arriva a tutti insieme, in una mail sola, e la scheda resta comunque una — il codice si usa una volta, chiunque dei due lo apra. Prima di mandare, l'avviso ti dice quali società hanno più di un indirizzo. Un indirizzo scritto male in mezzo agli altri non blocca gli altri: viene elencato a parte come da sistemare.

Con un indirizzo presente hai due strade.

**Apri la mail già scritta** — l'ultima colonna. È un link `mailto:` con destinatario, oggetto e testo compilati: apre il tuo programma di posta, non manda niente. Rileggi e spedisci tu. Un avvertimento: i programmi di posta **tagliano i `mailto:` troppo lunghi**, e il nostro testo è lungo. Il limite cambia da client a client; se il corpo arriva troncato, usa la via qui sotto.

**Invia per email a chi ha l'indirizzo…** — nel sottomenu *Messaggi ai votanti*. Manda un messaggio per votante **dal tuo account Google**, uno alla volta e senza copia conoscenza, perché ogni link è personale. Come mittente i votanti vedono *Sezione Territoriale Baskin EISI* seguito dalla Sezione; si cambia in *Config → Mittente email*, e l'indirizzo di posta resta comunque quello del tuo account. Prima di partire ti dice chi riceverà, chi resta da avvisare a mano e quanta quota email ti resta per oggi. Gli indirizzi di prova (`@example.invalid` e simili) vengono saltati. A invio concluso controlla la posta inviata: quello che vedi lì è esattamente quello che hanno ricevuto.

### L'avviso automatico all'apertura

Quando apri la votazione — dal menu o per apertura programmata — il programma manda **da solo** il messaggio a tutte le società che hanno un indirizzo, con dentro il link personale e **la data di chiusura**. Se hai aperto a mano e non c'è una chiusura programmata, il messaggio lo dice e invita a non rimandare.

Parte **una volta per round**: chiudere e riaprire non lo ripete, così nessuno riceve due volte la stessa cosa. Se ti serve rimandarlo, azzera il round oppure usa *Invia per email* dal menu. Chi non ha indirizzo resta da avvisare a mano, e l'avviso di apertura ti dice chi.

## Tre codici sbagliati

Dopo tre tentativi con un codice inesistente, il voto da quel dispositivo resta sospeso per un'ora, con il tempo che manca scritto a schermo. Il conteggio sta in una memoria tecnica del browser: non contiene niente di personale, non raggiunge nessun server e non traccia nessuno, quindi non serve alcun avviso sui cookie.

Due precisazioni oneste. Chi ha un codice valido ma ha **già votato** non fa scattare il freno: è un caso diverso e riceve il suo messaggio. E il freno vale per dispositivo: chi svuota i dati del sito o apre una finestra anonima riparte da zero. Serve a fermare chi prova a caso, non un attacco: contro quello vale la lunghezza del codice, otto caratteri su un alfabeto di diciotto.


## Ragione sociale e nome breve

Il foglio **Società** ha due nomi per ogni riga. La prima colonna è la **ragione sociale** esatta, quella dell'affiliazione: serve per gli atti, ma in un messaggio o in un elenco è illeggibile. Poi c'è il **Nome breve**, quello con cui la società si chiama davvero.

In coda ci sono **Email** (vedi sopra) e **Codice affiliazione**: quest'ultimo serve solo per gli atti e non entra in nessun messaggio né nella pagina di voto.

Il nome breve è quello che vedono i votanti: compare nei messaggi, sulla pagina di voto ("stai votando per…"), nel Riepilogo urna, nel Report e nei fogli dei ballottaggi. All'inizializzazione parte uguale alla ragione sociale, quindi finché non lo accorci non cambia niente; se lo lasci vuoto il programma usa comunque la ragione sociale.


## Logo

Il logo di Ente Italiano Sport Inclusivi è caricato in **hotlinking** (non è nel foglio né nel codice):

- pagina di voto: `https://eisi.it/wp-content/uploads/2026/09/logo-eisi-epp-cip.svg`
- resoconti nei fogli: `https://eisi.it/wp-content/uploads/2026/09/logo-eisi-epp-cip.png` — i fogli Google (funzione IMAGE) **non visualizzano SVG**, quindi va caricata sul sito anche la versione PNG.

Gli indirizzi sono in *Config* ("Logo pagina web", "Logo fogli (PNG)"): lasciandoli vuoti il logo non compare. Nei fogli la formula **punta alla cella di Config** (`=IMAGE(Config!$B$n)`) invece di avere l'indirizzo scritto dentro: se il logo cambia indirizzo basta aggiornare *Config* e i resoconti si allineano da soli. Nei fogli *Report*, *Riepilogo urna* e *Risultati ballottaggi* il logo è in testa; nei fogli tabellari (*Risultati*, *Risultati Presidente*, *Risultati Vice*) è nel piede, per non spostare le intestazioni delle colonne.

Il logo è di proprietà di Ente Italiano Sport Inclusivi e non è coperto dalla licenza MIT (vedi `NOTICE`).

## Installazione (una volta)

1. Crea un **Foglio Google** → **Estensioni → Apps Script**.
2. In `Code.gs` incolla il file `Code.gs`; **＋ → HTML** chiamato esattamente `Index` con il contenuto di `Index.html`.
3. Ricarica il foglio → menu **🗳️ Votazione → Inizializza / aggiorna fogli** (autorizza).
4. Apps Script: **Esegui il deployment → Nuovo deployment → App web**, Esegui come **Me**, accesso **Chiunque**.

**Aggiornamento da versioni precedenti:** sostituisci `Code.gs` e `Index`, rilancia **Inizializza / aggiorna fogli**, poi **Gestisci deployment → modifica → Nuova versione** (l'URL resta lo stesso). Dalla v6 o precedenti il vecchio foglio *Squadre* con i codici diventa *Società* (codici conservati) e viene creato il nuovo *Squadre* (squadra → società): se più squadre sono della stessa società, correggi la colonna Società ed elimina in *Società* le righe in eccesso.

## Preparazione

1. *Config*: **Sezione Territoriale** (es. Emilia-Romagna) e **Anno sportivo** (testo libero, es. 2026/2027): compaiono sulla pagina di voto e in tutti i resoconti. Lascia vuoti "Numero eletti" e "Max preferenze" per applicare il regolamento. "Max aiuti allenatore" = 1.
2. *Squadre*: una riga per squadra con la **società** di appartenenza (menu a tendina).
3. *Società*: una riga per società partecipante. **Una riga = un voto.** Le società indicate in *Squadre* vengono aggiunte da sole alla generazione dei codici.
4. *Candidati*: nome (in ordine alfabetico: è l'ordine della scheda), **Qualifica**, **Squadra**, anni di tesseramento/incarichi.

Numero di commissari = metà delle **società**, arrotondata per eccesso, minimo 3, massimo 6. Esempio: 16 squadre di 11 società → 11 schede, 6 commissari.

## Round 1 – Commissari CTL

1. **Round 1 → Genera codici e link mancanti**: assegna il codice alle società che non ce l'hanno (già fatto anche dall'inizializzazione) e aggiorna tutti i link. Si può rilanciare in qualsiasi momento: codici già assegnati, candidati, squadre e voti espressi restano intatti. Invia a ogni società solo il suo link.
2. **Round 1 → Rigenera TUTTI i codici e link società…**: dà a tutte le società un codice nuovo senza toccare società, squadre e candidati. È rifiutata se ci sono già voti nel round 1 (i vecchi codici risulterebbero inutilizzati e si potrebbe votare due volte): azzera prima il round.
3. **Round 1 → Apri**, poi **Chiudi**, poi **Calcola risultati**.

I codici hanno il formato **XXXX-9999**: quattro lettere maiuscole dalla A alla H e quattro cifre (es. `BHAD-7193`).

Assegnazione dei posti: allenatori e autocandidature entrano per primi in ordine di preferenze; solo se non bastano entra l'aiuto allenatore più votato (max 1); i posti scoperti restano vacanti. A pari preferenze precede chi ha più anni di tesseramento/incarichi.

## Ballottaggio (parità non risolvibili)

Se sull'ultimo posto utile ci sono candidati con **pari preferenze e pari anni**, i risultati li segnano "PARITÀ — da risolvere" e si procede con il ballottaggio:

1. **Ballottaggio → Prepara ballottaggio e nuovi link**: crea il foglio *Ballottaggio* con un **nuovo codice e link per ogni votante** (tutte le società al round 1, tutti i commissari ai round 2 e 3). I link precedenti non valgono per il ballottaggio.
2. **Ballottaggio → Apri / Chiudi / Calcola ballottaggio**.
3. Sulla scheda compaiono solo i candidati a pari merito; si esprimono fino a tante preferenze quanti sono i posti in parità (es. 2 posti tra 3 nomi → 2 preferenze). Si sommano i voti.
4. Se resta una parità, per esempio tra due candidati per l'ultimo posto, chi ha già superato la soglia è eletto e si prepara il ballottaggio successivo, con nuovi link, solo tra i rimasti pari.
5. **Massimo 3 ballottaggi**: se la parità persiste si usa **Ballottaggio → Sorteggia la parità residua…** (chiede conferma, estrae i nomi mancanti e aggiorna i risultati con la nota "Eletto per sorteggio"); in alternativa si può sempre scrivere l'esito a mano nella colonna Esito di *Risultati* (round 1) o il nome in *Config* (Presidente/Vice). Con le votazioni programmate il sorteggio è automatico.

Il foglio *Risultati ballottaggi* riporta ogni ballottaggio con voti ed esito; i risultati del round vengono ricalcolati da soli ("Eletto al ballottaggio 1", ecc.).

## Round 2 – Presidente e Round 3 – Vice

1. **Round 2 → Prepara commissari e link**: foglio *Commissari* con gli eletti del round 1, ciascuno con il suo link (vale per i round 2 e 3). **Rigenera codici e link commissari…** rifà solo i codici lasciando l'elenco com'è (rifiutato se ci sono già voti nei round 2 o 3).
2. **Round 2 → Apri / Chiudi / Calcola risultati**: vince chi ha più voti; a pari voti precede chi ha più anni; se pari anche negli anni → ballottaggio tra i commissari.
3. **Round 3 → Apri / Chiudi / Calcola risultati**: si vota il Vice tra i commissari rimanenti, con le stesse regole.

## Votazioni programmate (apertura e chiusura a tempo)

Il voto commissari e il voto per il Presidente possono aprirsi e chiudersi da soli.

1. In *Config* compila le date nel formato **gg/mm/aaaa hh:mm**:
   - **Apertura voto commissari** (vuoto = apri a mano dal menu);
   - **Chiusura voto commissari**;
   - **Apertura voto presidente** (vuoto = subito dopo la chiusura del voto commissari);
   - **Chiusura voto presidente**;
   - **Durata ballottaggio (ore)**: quanto resta aperto un ballottaggio aperto in automatico (predefinita 24);
   - **Proroga automatica (ore)**: predefinita 24;
   - **Email avvisi**: dove arrivano gli avvisi (vuoto = indirizzo di chi possiede il foglio).
2. **Votazioni programmate → Programma apertura e chiusura** (la prima volta autorizza i trigger). *Mostra pianificazione* riepiloga date e automatismi attivi, *Annulla pianificazione* li rimuove.

Cosa succede alla chiusura programmata:

- **Se hanno votato tutti**: la votazione si chiude, i risultati vengono calcolati e, per il round 1, i commissari eletti ricevono codice e link e si apre il voto per il Presidente (subito o alla data indicata). Alla chiusura del voto Presidente vengono calcolati i risultati finali. Ogni passaggio è notificato per email, con codici e link da inoltrare.
- **Se c'è una parità** (e hanno votato tutti): il **ballottaggio viene preparato e aperto in automatico** fra i soli candidati a pari merito, con nuovi codici e link per tutti i votanti inviati nell'email, e con chiusura programmata dopo le ore indicate in Config. Alla chiusura vale la stessa regola: se manca qualcuno si proroga, se hanno votato tutti si calcola e, se la parità resta, parte da solo il ballottaggio successivo (massimo 3). Risolta la parità la catena riprende: commissari pronti e voto per il Presidente aperto, oppure risultati finali.
- **Se nemmeno i 3 ballottaggi risolvono**: il sistema esegue il **sorteggio** fra i candidati rimasti pari, lo registra (data e ora nel foglio *Risultati ballottaggi*, nota "Eletto per sorteggio" nei risultati del round), avvisa per email e prosegue da solo con il round successivo.
- **Se manca anche un solo voto**: non si calcola e non si prosegue. La votazione **resta aperta** e la chiusura è **prorogata** delle ore indicate in Config, con una email che elenca chi non ha ancora votato. Le proroghe non hanno limite.
- **In qualsiasi momento puoi chiudere a mano** dal menu: la chiusura manuale annulla la proroga automatica e la decisione su come proseguire resta a te.

Mentre la pianificazione è attiva, la pagina di voto indica quando la votazione apre o si chiude.

## Formatore di riferimento

- Nome in *Config → Formatore di riferimento*, senza votazione, preferibilmente **non votante**.
- Se vuole essere **votante**, va inserito anche in *Candidati* come **Autocandidatura**: se eletto, nel report risulta sia commissario sia formatore di riferimento e vota nei round 2 e 3.

## Resoconti

- *Risultati*, *Risultati ballottaggi*, *Risultati Presidente*, *Risultati Vice*.
- *Report*: Presidente, Vice, Formatore di riferimento (votante/non votante), ballottaggi svolti, commissari con qualifica, squadra e ruolo.
- *Riepilogo urna* (per il custode): per ogni round e ballottaggio aventi diritto, chi ha votato e chi no, **controllo schede = codici usati**, bianche, preferenze e schede anonime una per riga per il riconteggio. A votazione aperta mostra solo la partecipazione.

## Anonimato

- Le schede non contengono codice, votante né orario, sono salvate in posizione casuale nelle proprietà dello script (fuori dal foglio e dalla sua cronologia).
- Dei codici usati resta solo un hash: si sa *chi* ha votato, non *come*.
- Nei round 2 e 3 i votanti sono pochi (3–6): con numeri così piccoli l'esito può comunque far intuire i voti.
- Chi amministra lo script è il "custode dell'urna": per trasparenza si può far verificare il codice a un secondo membro.

## Verifica del codice

La cartella `test/` contiene due simulazioni eseguibili con Node.js:

- `node test/simulazione.js`: 11 società e 16 squadre, parità al round 1 risolta con due ballottaggi, parità sul Presidente risolta con un ballottaggio, parità irrisolta dopo 3 ballottaggi;
- `node test/simulazione-programmata.js`: generazione e rigenerazione dei codici, apertura e chiusura a tempo, proroga automatica con elenco dei mancanti, catena commissari → Presidente, chiusura manuale che ferma la proroga;
- `node test/simulazione-ballottaggio-automatico.js`: parità alla chiusura programmata, ballottaggio preparato e aperto da solo con nuovi link, proroga del ballottaggio, parità risolta e catena che riprende da sola, parità che resiste a 3 ballottaggi e viene chiusa dal sorteggio.

## Altre voci del menu

- **Aggiorna partecipazione**: chi ha già votato nella votazione in corso.
- **Azzera round…**: cancella le schede di un round (1, 2, 3) con i suoi ballottaggi, o di TUTTI. I codici di società e commissari restano validi.
- Si può aprire una sola votazione alla volta; non modificare candidati o votanti a votazione aperta.
