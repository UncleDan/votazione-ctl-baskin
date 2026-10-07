# Votazione CTL Baskin — istruzioni (v9)

Voto online anonimo, utilizzabile da telefono senza account Google:

| Fase | Chi vota | Chi è votabile | Preferenze | Esito |
|---|---|---|---|---|
| Round 1 – Commissari CTL | una scheda per **società** | foglio *Candidati* | metà dei candidati (per eccesso) | commissari eletti |
| Round 2 – Presidente | ogni commissario eletto | tutti i commissari | 1 | il più votato |
| Round 3 – Vice | ogni commissario eletto | commissari tranne il Presidente | 1 | il più votato |
| Ballottaggio (fino a 3) | gli stessi votanti del round | solo i candidati a pari merito | quanti sono i posti in parità | i più votati |

Il **Formatore di riferimento** non si vota: si indica in *Config*.

Codice sorgente aperto: <https://github.com/UncleDan/votazione-ctl-baskin> (licenza MIT). Per trasparenza il link diretto e cliccabile, con il numero di versione, compare in fondo alla pagina di voto e in tutti i fogli di resoconto.

## Logo

Il logo di Ente Italiano Sport Inclusivi è caricato in **hotlinking** (non è nel foglio né nel codice):

- pagina di voto: `https://eisi.it/wp-content/uploads/2026/09/logo-eisi-epp-cip.svg`
- resoconti nei fogli: `https://eisi.it/wp-content/uploads/2026/09/logo-eisi-epp-cip.png` — i fogli Google (funzione IMAGE) **non visualizzano SVG**, quindi va caricata sul sito anche la versione PNG.

Gli indirizzi sono in *Config* ("Logo pagina web", "Logo fogli (PNG)"): lasciandoli vuoti il logo non compare. Nei fogli *Report*, *Riepilogo urna* e *Risultati ballottaggi* il logo è in testa; nei fogli tabellari (*Risultati*, *Risultati Presidente*, *Risultati Vice*) è nel piede, per non spostare le intestazioni delle colonne.

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
