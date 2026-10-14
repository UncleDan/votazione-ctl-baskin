# Votazione CTL Baskin — istruzioni (v42)

Voto online anonimo, utilizzabile da telefono senza account Google:

| Fase | Chi vota | Chi è votabile | Preferenze | Esito |
|---|---|---|---|---|
| Round 1 – Commissari CTL | una scheda per **società** | foglio *Candidati* | quante sono i posti da assegnare | commissari eletti |
| Round 2 – Presidente | ogni commissario eletto | tutti i commissari | 1 | il più votato |
| Round 3 – Vice | ogni commissario eletto | commissari tranne il Presidente | 1 | il più votato |
| Ballottaggio (fino a 3) | gli stessi votanti del round | solo i candidati a pari merito | quanti sono i posti in parità | i più votati |

Il **Formatore di riferimento** non si vota: si indica in *Config*.

Codice sorgente aperto: <https://github.com/UncleDan/votazione-ctl-baskin> (licenza MIT). Per trasparenza il link diretto e cliccabile, con il numero di versione, compare in fondo alla pagina di voto e in tutti i fogli di resoconto.

## La checklist, dentro al foglio

Il secondo foglio del file si chiama **Checklist** ed è la procedura dall'inizio alla fine: una riga per passo, con la casella da spuntare, divisa nelle sette fasi (controlli preliminari, candidature, round 1, ballottaggio, Presidente, Vice, chiusura, posti vacanti). Cita le voci di menu con il loro nome esatto, così non c'è da ricordarsi dove stava cosa.

Si aggiorna da **🗳️ Votazione → Checklist della procedura**, e si rigenera da sola a ogni *Inizializza / aggiorna fogli*, per restare allineata alla versione del programma. **Le spunte e le Note non si perdono**: vengono riconosciute dal testo del passo e riscritte dov'erano. La colonna *Note* è tua — date, chi manca ancora, decisioni prese.

A ricominciare da zero ci pensa *Azzeramenti → Tutto*, che insieme ai dati azzera anche le spunte. Il foglio è impaginato per la stampa in A4 verticale, se la si vuole su carta.

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

## Candidati almeno quanti i posti

La CTL ha bisogno di **almeno un candidato per posto**: con 11 società i commissari da eleggere sono 6, quindi servono almeno 6 candidature. Con meno, la commissione nascerebbe incompleta e la votazione non servirebbe a niente, perciò il round 1 **non si apre** e il messaggio dice quanti ne mancano. L'avviso compare già in *Inizializza / aggiorna fogli*, mentre stai inserendo i dati, non il giorno dell'apertura.

Se la Sezione Territoriale decide una commissione più piccola, scrivi il numero in *Config → Numero eletti*: quello ha la precedenza sulla regola, e con esso si abbassano sia i posti sia le preferenze per scheda.

## Il primo passo: aprire la raccolta delle candidature

**🗳️ Votazione → Richieste e conferme → 1. Apri la raccolta delle candidature** scrive nel foglio *Conferme* un messaggio per ogni società, da mandare quando ancora non c'è nessun nome in elenco. Dice quante poltrone ci sono — il numero calcolato dalla regola, o quello scritto in *Config → Numero eletti* — e che **ogni società presenta un solo candidato**; elenca cosa deve contenere la mail di candidatura (nome e cognome, qualifica, squadra, anni di tesseramento o di incarichi); ricorda che in commissione entra al massimo un Aiuto allenatore, lasciando però la scelta alla società; e chiede un cenno di risposta **anche a chi decide di non presentare nessuno**, altrimenti resti ad aspettare una mail che non arriverà.

Non c'è nessun modulo: le candidature arrivano per mail all'indirizzo della Sezione e le trascrivi tu nel foglio *Candidati*, **tutte**, anche le doppie e quelle incomplete. A sistemarle serve il passo successivo.

## Prima di aprire: far confermare le candidature

Il giro giusto è: **si raccoglie tutto** — comprese le candidature doppie, tardive o incomplete — **si fa confermare a ciascuna società quello che la riguarda**, si sistema l'elenco con le risposte in mano, e solo allora si apre il voto. Correggere prima costa una mail; correggere dopo non si può.

**🗳️ Votazione → Richieste e conferme → 2. Chiedi conferma delle candidature** scrive nel foglio *Conferme* un messaggio per società, con l'elenco dei suoi candidati — nome, qualifica, squadra, anni — e **le Note di ciascuno**. È lì che il meccanismo diventa utile: quello che scrivi nella colonna *Note* del foglio *Candidati* finisce nella mail, quindi è il posto dove annotare «arrivata dopo la scadenza», «qualifica non indicata nel modulo», «da verificare». Scrivi, rigenera, e il messaggio si aggiorna.

Tre cose che il messaggio fa da solo:

- a chi ha **più di un candidato** ricorda che se ne può presentare uno solo e chiede quale conferma;
- a chi **non ha candidature** dice che non ne risultano, e invita a segnalare un modulo che si fosse perso — è il modo per accorgersene finché si è in tempo;
- gli **autocandidati** non compaiono in nessuna mail, perché non appartengono a una società: quelli li confermi direttamente con loro, e il programma te li elenca a parte.

Non esiste un modulo da compilare: **basta una mail alla Sezione Territoriale**, e il messaggio lo dice. A chi non ha candidature elenca anche cosa scrivere — nome e cognome, qualifica, squadra, anni — così la risposta arriva completa invece di aprire un giro di chiarimenti.

Due parametri in *Config*: **Scadenza per le conferme** (testo libero, per esempio «venerdì 7 novembre», e vale sia per la raccolta sia per la conferma) e **Indirizzo per le candidature**. Quest'ultimo lasciato vuoto vale l'account che possiede il foglio — che è poi la casella della Sezione, la stessa da cui partono le mail — ma conviene scriverlo: se un giorno apri il foglio con un altro account, l'indirizzo nel messaggio cambierebbe senza che te ne accorga.

**Preparare non è inviare.** Le voci che riempiono il foglio *Conferme* scrivono soltanto i messaggi: non parte nessuna mail, e l'avviso finale lo dice a chiare lettere, perché un foglio pieno di righe già spuntate sembra dire il contrario. Prima di mandare puoi rileggere i testi e togliere la spunta a chi non vuoi scrivere.

**Richieste e conferme → Invia le richieste per email** manda alle righe spuntate nella colonna *Da inviare*, che alla preparazione sono tutte spuntate, e prima di partire mostra oggetto e destinatari e chiede conferma: finché non rispondi di sì non parte niente. Dopo l'invio le spunte si tolgono, così per sollecitare qualcuno basta rispuntare la sua riga. L'oggetto cambia da solo secondo la richiesta preparata per ultima — raccolta, conferma, accettazione dell'incarico, candidatura per un posto vacante — così chi riceve capisce dal titolo di che si tratta. Queste mail **non contengono link di voto**: chiedono solo una risposta.

Il foglio *Conferme* ne ospita **una richiesta alla volta**: ogni voce lo riscrive da capo. È voluto — in giro ce n'è sempre una sola — ma vuol dire che se prepari la richiesta successiva prima di aver mandato la precedente, quella precedente la perdi.

Poi aggiorni il foglio *Candidati* a mano con le risposte, e procedi con l'apertura.

## Prima del Presidente: far confermare l'incarico

Una rinuncia ha due prezzi diversi a seconda di quando arriva. **Finché il Presidente non è eletto**, il posto passa al primo dei non eletti seguendo la graduatoria e non serve rivotare. **Dopo**, la commissione che ha espresso il Presidente non è più quella, e qualche volta si deve tornare al voto.

Per questo, fra *Prepara commissari e link* e l'apertura del round 2, c'è **🗳️ Votazione → Richieste e conferme → 3. Chiedi ai commissari se accettano l'incarico**. Scrive nel foglio *Conferme* un messaggio per ogni eletto: gli dice che risulta eletto e con quante preferenze, gli chiede un sì o un no, e gli spiega perché conviene dirlo adesso. Non contiene link di voto.

La risposta si chiede **entro poche ore**, non entro la settimana: il voto per il Presidente è fermo in attesa, e una scadenza larga vuol dire solo che qualcuno risponderà l'ultimo giorno. Quante ore lo decidi in *Config → Ore per confermare l'incarico* (di base 6); il messaggio riporta le ore **e** la data e ora precise — «entro 6 ore, cioè entro il 13/10/2026 19:30» — perché «entro venerdì» si rimanda e un'ora esatta no. Senza risposta l'incarico si considera accettato, e il messaggio lo dice.

Quando qualcuno risponde di no, la rinuncia si spunta nel foglio **Candidati**, non in *Commissari*: è lì che il posto scorre al primo dei non eletti. L'ordine è: spunta *Rinuncia* in *Candidati* → *Round 1 → Calcola risultati* → *Prepara commissari e link*. Saltare il ricalcolo è l'errore facile — in *Risultati* resterebbe scritto ELETTO e il posto non scorrerebbe — quindi *Prepara commissari e link* si ferma e te lo dice invece di rigenerare l'elenco sbagliato.

Il foglio *Commissari* è un foglio **derivato**: ogni *Prepara commissari e link* lo riscrive da capo dagli eletti di *Risultati*. Le uniche cose scritte a mano che conserva sono gli indirizzi email e le spunte *Rinuncia alla carica*; tutto il resto, se lo scrivi lì, alla rigenerazione successiva sparisce.

## Quando un posto resta vacante

Le dimissioni di un commissario si risolvono con lo **scorrimento della graduatoria**: subentra il primo dei non eletti, con i limiti spiegati più sotto. Ma la graduatoria finisce, e qualche volta finisce subito — se in fase di costituzione le rinunce sono molte, o se le riserve che restano sono tutte aiuto allenatore oltre il limite.

Quando non basta più, **🗳️ Votazione → Richieste e conferme → Chiedi candidati alle società senza commissario** scrive un messaggio alle sole società che **non hanno un proprio commissario in commissione** — chi ha rinunciato non copre la sua società, perché il suo posto è vacante. Il messaggio dice quanti posti sono vacanti, che le riserve non bastano, e chiede una candidatura con le stesse regole di prima: una per società, nome, qualifica, squadra, anni.

Chiederlo a chi non è rappresentato è il modo più equo di riempire il posto. Poi le candidature nuove vanno nel foglio *Candidati* e si torna al voto delle società: *Azzera un round* sul round 1 e di nuovo *Apri il round 1*. Se invece la Commissione Tecnica Nazionale concede la deroga, non serve votare: la deroga si annota nel Verbale.

Il programma segnala anche i commissari la cui squadra non è nel foglio *Squadre*: non sono attribuibili a nessuna società, quindi la loro società risulterebbe scoperta per sbaglio. Si sistema aggiungendo la squadra.

## Rinuncia di un candidato

Capita che qualcuno dichiari, anche a votazione già aperta, che non accetterebbe l'incarico. Spunta la casella **Rinuncia** nell'ultima colonna del foglio *Candidati*: è una decisione di spoglio, non di scheda.

Cosa succede, e perché:

- **La scheda non cambia.** Chi ha rinunciato resta votabile fino alla chiusura. Toglierlo a urna aperta darebbe schede diverse a chi ha votato prima e a chi vota dopo, e le schede già depositate contengono il suo nome.
- **I suoi voti si contano e restano nei risultati**, con esito `RINUNCIA`. Sono preferenze realmente espresse: cancellarle falserebbe il conteggio e il controllo «schede = codici usati».
- **Non occupa il posto**: il posto scorre al primo dei non eletti, e *Prepara commissari e link* non lo include.
- **Rinunciare a una carica è un'altra cosa**: chi resta commissario ma non accetta la Presidenza o il ruolo di Vice si spunta nel foglio *Commissari*, ultima colonna, che per questo si chiama **Rinuncia alla carica**. Le due caselle non sono intercambiabili, e la rinuncia all'incarico va sempre e solo nel foglio *Candidati*.
- **Conta nel vincolo sul numero**: chi rinuncia non fa più numero per il minimo di candidati.

- **Finisce a verbale.** Nel *Verbale* la rinuncia è scritta per esteso, con il nome e la spiegazione: i voti restano contati, il posto non viene occupato.

Avvisa comunque le società per email: il programma non può dirlo sulla scheda senza cambiarla in corsa.

## La graduatoria finale

Il *Verbale* chiude con la **graduatoria finale del round 1**: tutti i candidati in ordine, con preferenze e posizione. Serve per il verbale, e serve soprattutto dopo: se un commissario si dimette, subentra il primo dei non eletti seguendo quell'ordine, e averlo messo nero su bianco il giorno dello spoglio evita di doverlo ricostruire mesi più tardi.

Ovunque due candidati vicini in graduatoria abbiano **le stesse preferenze**, accanto alla posizione compare fra parentesi che cosa ne ha deciso l'ordine: gli anni di tesseramento di ciascuno — *(4 anni)*, *(2 anni)* — oppure *(Ballottaggio)*, o *(Sorteggio)* se si è arrivati fin lì. Vale per gli eletti e **anche fra le riserve**, perché quello è l'ordine con cui subentrano e va giustificato allo stesso modo. Senza, righe con lo stesso numero di voti ed esiti diversi sembrano messe a caso.

Il confine fra l'ultimo eletto e il primo dei non eletti, quando è un pari merito, ha anche una riga sua sotto la tabella: è la decisione che più facilmente verrà contestata.

La tabella è in tre blocchi: prima gli **eletti**, dal più votato in giù; poi le **riserve**, nell'ordine in cui subentrano; infine le **rinunce**, in ordine alfabetico, perché fra loro non c'è nulla da graduare.

Fra le riserve vale **la stessa regola dell'elezione**, ed è il punto che conta: prima gli allenatori e i candidati di qualifica `Altro`, **anche con una sola preferenza**, e solo quando non ne restano gli aiuto allenatore. Un allenatore con un voto subentra prima dell'aiuto allenatore più votato — altrimenti la sostituzione contraddirebbe la regola che ha deciso l'elezione. Resta il limite di *Max aiuti allenatore* in commissione, e la tabella lo ricorda.

Il limite di *Max aiuti allenatore* vale anche per lo scorrimento: un aiuto subentra solo se in commissione ce ne sono meno del limite. Gli aiuti oltre quel limite restano in graduatoria ma sono segnati come **subentrabili solo con deroga della Commissione Tecnica Nazionale (CTN)**.

Sotto la tabella il Verbale scrive **quante sostituzioni reggono senza deroga**, divise fra allenatori e aiuti: *«Sostituzioni possibili senza deroga: 2 (1 fra allenatori e "Altro", 1 fra gli aiuto allenatore). Esaurite queste, per sostituire un commissario serve una deroga della Commissione Tecnica Nazionale (CTN), oppure si torna al voto.»* È il numero da avere in mente quando arrivano le dimissioni: dice subito se la commissione regge o se bisogna muoversi.

Ogni riga dice cosa quella posizione significa: *Commissario*, *1° dei non eletti — subentra per primo*, *2° dei non eletti — aiuto allenatore: subentra solo se non restano allenatori o "Altro"*, *3° dei non eletti — aiuto allenatore: oltre il limite, subentra solo con deroga della CTN*, *Rinuncia*. Sotto la tabella le regole sono scritte a chiare lettere, così il verbale si spiega da sé.

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

Le ricevute compaiono nel foglio **Riepilogo urna**, una per cella e in ordine alfabetico, **già a votazione aperta**: chi ha votato può controllare subito, senza aspettare lo spoglio. Conteggi e schede restano invece nascosti fino alla chiusura.

Una conseguenza da conoscere, perché è il prezzo di questa comodità: a urna aperta il foglio mostra sia *chi ha votato* sia le ricevute, quindi chi lo guarda in due momenti diversi può abbinare un nome comparso a una ricevuta comparsa. Non svela **come** ha votato — ricevute e schede stanno in due elenchi separati, mescolati l'uno indipendentemente dall'altro — ma se preferisci che nessuno possa fare quell'abbinamento, aggiorna il Riepilogo urna solo a votazione chiusa.

Quello che la ricevuta **non** fa è dire come si è votato: è generata a caso al momento del deposito, non deriva né dal codice del votante né dalle preferenze, e sta in un elenco separato da quello delle schede, mescolato per conto suo. Nemmeno confrontando le posizioni nei due elenchi si può legare una ricevuta a una scheda. È la condizione perché resti un voto anonimo e insieme verificabile.

Vale la pena spiegarlo nella comunicazione che accompagna i link: una ricevuta che nessuno sa a cosa serve viene buttata via.


## I messaggi per i votanti

Il foglio **Messaggi** ha una riga per ogni votante del round attivo: *Destinatario · Codice · Email · Messaggio da copiare e incollare · Apri la mail già scritta*. Il testo sta tutto in **una sola cella**: la copi e la incolli nella chat della società, senza ricomporlo ogni volta. Dentro c'è il link personale, il codice, quante preferenze si possono dare, l'eventuale data di chiusura, la spiegazione della ricevuta e l'avvertenza che il messaggio **si può inoltrare** a un'altra persona della società — il voto è identificato dal codice, non da chi lo usa, e vale una volta sola.

**La riga c'è per tutti**, anche per chi non ha un indirizzo email: quei messaggi si mandano per chat o a voce, e il testo è lì pronto da copiare. A fine preparazione il programma ti dice chi è rimasto senza indirizzo.

Si rigenera da **🗳️ Votazione → Messaggi ai votanti → Prepara i messaggi del round attivo**, e da solo ogni volta che i codici cambiano o che azzeri qualcosa.

Per i round 2 e 3 ci sono due voci apposta — **Prepara i messaggi per il Presidente** e **per il Vice** — che funzionano anche a round chiuso, dopo *Prepara commissari e link*: così i messaggi sono pronti prima di aprire. I destinatari diventano i commissari eletti, e il foglio si ricorda per quale round è stato preparato, quindi l'invio manda la cosa giusta anche se il round attivo è un altro.

### Le email

Gli indirizzi stanno nella colonna **Email**: nel foglio *Società* per le società, nel foglio *Commissari* per i commissari (round 2 e 3). Conviene però scriverli già nel foglio **Candidati**: quando *Prepara commissari e link* crea la riga di un eletto, l'indirizzo lo porta con sé, e per il voto del Presidente non c'è più niente da cercare. Puoi scriverli anche direttamente nel foglio *Messaggi*: alla rigenerazione successiva vengono ricopiati in *Società*, dove restano (il foglio *Messaggi* si riscrive da capo ogni volta).

**Più indirizzi per la stessa società** si scrivono nella stessa cella separati da virgola (o punto e virgola): una società ha spesso due referenti. Il messaggio arriva a tutti insieme, in una mail sola, e la scheda resta comunque una — il codice si usa una volta, chiunque dei due lo apra. Prima di mandare, l'avviso ti dice quali società hanno più di un indirizzo. Un indirizzo scritto male in mezzo agli altri non blocca gli altri: viene elencato a parte come da sistemare.

Anche qui, **preparare non è inviare**: *Prepara i messaggi* riempie soltanto il foglio, e l'avviso finale lo dice. Le mail partono da sole in un caso solo, ed è l'apertura del round: l'avviso con il link personale va a tutti quelli che hanno un indirizzo, senza chiedere niente. Negli altri casi hai due strade.

**Invia per email a chi ha l'indirizzo…** — nel sottomenu *Messaggi ai votanti*. Manda un messaggio per votante **dal tuo account Google**, uno alla volta e senza copia conoscenza, perché ogni link è personale. Come mittente i votanti vedono *Sezione Territoriale Baskin EISI* seguito dalla Sezione; si cambia in *Config → Mittente email*, e l'indirizzo di posta resta comunque quello del tuo account. Prima di partire ti dice chi riceverà, chi resta da avvisare a mano e quanta quota email ti resta per oggi. Gli indirizzi di prova (`@example.invalid` e simili) vengono saltati. A invio concluso controlla la posta inviata: quello che vedi lì è esattamente quello che hanno ricevuto.

**Rimanda le email spuntate…** — quando qualcuno dice di non aver ricevuto niente. Metti la spunta nella colonna **Rimanda** del foglio *Messaggi*, sulle righe che ti interessano, e lancia la voce: parte solo a quelli. A invio fatto le spunte si tolgono da sole, così non si rimanda due volte per distrazione.

**Le date sono nel messaggio**, se la votazione è programmata: preparandolo prima dell'apertura si legge *«La votazione apre il 16/11/2026 09:00. Si chiude il 23/11/2026 20:00.»*, e nella mail automatica dell'apertura *«La votazione si chiude il 23/11/2026 20:00.»* Sono le date del round di quel messaggio, non di quello in corso: i messaggi del Presidente preparati mentre si vota per i Commissari portano le date del round 2. Se non hai programmato niente, la riga non compare e la chiusura va comunicata a parte.

**L'oggetto dice di quale votazione si tratta** — *Elezione CTL Baskin — Presidente: il link per votare* — e cambia a ogni round e a ogni ballottaggio. Chi riceve il secondo o il terzo messaggio ha già votato una volta: con un oggetto sempre uguale lo scambierebbe per un doppione e lo lascerebbe lì.

### I promemoria prima della chiusura

Con la votazione programmata, il sistema manda da solo un promemoria **a chi non ha ancora votato**, a poche ore dalla scadenza. Di base a **4 ore e 2 ore** prima; si cambia in *Config → Solleciti prima della chiusura (ore)* scrivendo gli anticipi separati da virgola (per esempio `24, 6, 1`), e lasciando il campo vuoto non ne parte nessuno.

Il messaggio è quello di sempre — link personale, codice, preferenze — con davanti la riga che dice perché arriva: *«dalla vostra società non risulta ancora una scheda, e la votazione si chiude il…»*. L'oggetto dice quanto manca.

Non parte se hanno già votato tutti, se la votazione è chiusa o se la chiusura non è programmata. I promemoria si rifanno da soli quando la chiusura si sposta per proroga, e cadono se chiudi a mano. Chi non ha indirizzo email resta da sollecitare a voce: te lo dice la notifica che ricevi a ogni invio, insieme all'elenco di chi è stato sollecitato.

I ballottaggi non hanno una data di chiusura ma una durata in ore, quindi lì i promemoria non si applicano.

### L'avviso automatico all'apertura

Quando apri la votazione — dal menu o per apertura programmata — il programma manda **da solo** il messaggio a tutte le società che hanno un indirizzo, con dentro il link personale e **la data di chiusura**. Se hai aperto a mano e non c'è una chiusura programmata, il messaggio lo dice e invita a non rimandare.

Parte **una volta per round**: chiudere e riaprire non lo ripete, così nessuno riceve due volte la stessa cosa. Se ti serve rimandarlo, azzera il round oppure usa *Invia per email* dal menu. Chi non ha indirizzo resta da avvisare a mano, e l'avviso di apertura ti dice chi.

## Tre codici sbagliati

Dopo tre tentativi con un codice inesistente, il voto da quel dispositivo resta sospeso per un'ora, con il tempo che manca scritto a schermo. Il conteggio sta in una memoria tecnica del browser: non contiene niente di personale, non raggiunge nessun server e non traccia nessuno, quindi non serve alcun avviso sui cookie.

Due precisazioni oneste. Chi ha un codice valido ma ha **già votato** non fa scattare il freno: è un caso diverso e riceve il suo messaggio. E il freno vale per dispositivo: chi svuota i dati del sito o apre una finestra anonima riparte da zero. Serve a fermare chi prova a caso, non un attacco: contro quello vale la lunghezza del codice, otto caratteri su un alfabeto di diciotto.


## Ragione sociale e nome breve

Il foglio **Società** ha due nomi per ogni riga. La prima colonna è la **ragione sociale** esatta, quella dell'affiliazione: serve per gli atti, ma in un messaggio o in un elenco è illeggibile. Poi c'è il **Nome breve**, quello con cui la società si chiama davvero.

In coda ci sono **Email** (vedi sopra) e **Codice affiliazione**: quest'ultimo serve solo per gli atti e non entra in nessun messaggio né nella pagina di voto.

Il nome breve è quello che vedono i votanti: compare nei messaggi, sulla pagina di voto ("stai votando per…"), nel Riepilogo urna, nel Verbale e nei fogli dei ballottaggi. All'inizializzazione parte uguale alla ragione sociale, quindi finché non lo accorci non cambia niente; se lo lasci vuoto il programma usa comunque la ragione sociale.


## Dopo aver aggiornato il codice

Tre passaggi, e il secondo è quello che si dimentica.

1. **Salva** `Code.gs` e `Index.html` nell'editor.
2. **Distribuisci → Gestisci distribuzioni → matita → Versione: Nuova versione → Distribuisci.** L'URL `/exec` resta lo stesso. Salvare non basta: il menu del foglio usa il codice salvato, ma la pagina di voto passa dal ponte `/exec`, che serve la **versione distribuita**. Finché non ridistribuisci, la pagina continua a comportarsi come la versione precedente — e lo dichiara, scrivendo in fondo il numero di versione vecchio.
3. **Ricarica il foglio** e lancia **Inizializza / aggiorna fogli**, che aggiunge le colonne nuove e rigenera Verbale, Riepilogo urna e Messaggi.

Per controllare: *Interfaccia di voto → Mostra interfaccia attiva e indirizzi* ti dice la versione del codice salvato; in fondo alla pagina di voto c'è quella servita dal ponte. Devono coincidere. Se non coincidono, o non hai ridistribuito, oppure la pagina punta a una distribuzione diversa da quella che hai aggiornato — in *Gestisci distribuzioni* controlla che l'URL sia quello che hai messo nella pagina.

## Stampare i resoconti

Sono formattati per stare in un **A4 verticale** *Verbale*, *Riepilogo urna*, *Risultati*, *Risultati Presidente*, *Risultati Vice* e *Risultati ballottaggi*: colonne di larghezza fissa, 660 pixel in tutto, con il testo che va a capo invece di allargare la colonna. Prima, con le colonne ridimensionate automaticamente, una riga lunga — l'elenco di chi non ha votato, una scheda con sei preferenze — allargava tutto e la stampa finiva su due pagine affiancate.

Nel dialogo di stampa scegli **Foglio corrente**, formato **A4**, orientamento **Verticale** e scala **Normale (100%)**. Se aggiungi tu delle colonne o allarghi le esistenti, il conto non torna più: il programma rimette le larghezze a posto ogni volta che rigenera i fogli.

## L'ordine dei fogli

*Inizializza / aggiorna fogli* rimette le schede in quest'ordine: prima *Config* e la *Checklist*, poi i dati da compilare (*Società*, *Squadre*, *Conferme*, *Candidati*), poi i documenti da leggere (*Verbale*, *Riepilogo urna*), poi quello che serve durante la votazione (*Ballottaggio*, *Commissari*), infine i risultati (*Risultati*, *Risultati Presidente*, *Risultati Vice*, *Risultati ballottaggi*) e i *Messaggi*.

I fogli non ancora creati si saltano, e un foglio aggiunto da te resta in coda dov'è: il programma non lo sposta e non lo tocca.

## Logo

Il logo di Ente Italiano Sport Inclusivi è caricato in **hotlinking** (non è nel foglio né nel codice):

- pagina di voto: `https://eisi.it/wp-content/uploads/2026/09/logo-eisi-epp-cip.svg`
- resoconti nei fogli: `https://eisi.it/wp-content/uploads/2026/09/logo-eisi-epp-cip.png` — i fogli Google (funzione IMAGE) **non visualizzano SVG**, quindi va caricata sul sito anche la versione PNG.

Gli indirizzi sono in *Config* ("Logo pagina web", "Logo fogli (PNG)"): lasciandoli vuoti il logo non compare. Nei fogli la formula **punta alla cella di Config** (`=IMAGE(Config!$B$n)`) invece di avere l'indirizzo scritto dentro: se il logo cambia indirizzo basta aggiornare *Config* e i resoconti si allineano da soli. Nei fogli *Verbale*, *Riepilogo urna* e *Risultati ballottaggi* il logo è in testa; nei fogli tabellari (*Risultati*, *Risultati Presidente*, *Risultati Vice*) è nel piede, per non spostare le intestazioni delle colonne.

Il logo è di proprietà di Ente Italiano Sport Inclusivi e non è coperto dalla licenza MIT (vedi `NOTICE`).

## Installazione (una volta)

1. Crea un **Foglio Google** → **Estensioni → Apps Script**.
2. In `Code.gs` incolla il file `Code.gs`; **＋ → HTML** chiamato esattamente `Index` con il contenuto di `Index.html`.
3. Ricarica il foglio → menu **🗳️ Votazione → Inizializza / aggiorna fogli** (autorizza).
4. Apps Script: **Esegui il deployment → Nuovo deployment → App web**, Esegui come **Me**, accesso **Chiunque**.

**Aggiornamento da versioni precedenti:** sostituisci `Code.gs` e `Index`, rilancia **Inizializza / aggiorna fogli**, poi **Gestisci deployment → modifica → Nuova versione** (l'URL resta lo stesso). Dalla v6 o precedenti il vecchio foglio *Squadre* con i codici diventa *Società* (codici conservati) e viene creato il nuovo *Squadre* (squadra → società): se più squadre sono della stessa società, correggi la colonna Società ed elimina in *Società* le righe in eccesso.

## Preparazione

1. *Config*: **Sezione Territoriale** (es. Emilia-Romagna) e **Anno sportivo** (testo libero, es. 2026/2027): compaiono sulla pagina di voto e in tutti i resoconti. Lascia vuoti "Numero eletti" e "Max preferenze" per applicare il regolamento: i commissari da eleggere sono metà delle società arrotondata per eccesso (da 3 a 6), e le preferenze per scheda sono altrettante. "Max aiuti allenatore" = 1.
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
- *Verbale*: Presidente, Vice, Formatore di riferimento (votante/non votante), ballottaggi svolti, commissari con qualifica, squadra e ruolo.
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
