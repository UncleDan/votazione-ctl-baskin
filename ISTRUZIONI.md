# Votazione CTL — istruzioni (v2)

Voto online anonimo, una scheda per società, utilizzabile da telefono senza account Google.

## Installazione (una volta, 10 minuti)

1. Crea un nuovo **Foglio Google** (es. "Elezione CTL 2026").
2. Menu **Estensioni → Apps Script**.
3. Nel file `Code.gs` incolla il contenuto di `Votazione_CTL_Code_…gs`.
4. **＋ → HTML**, chiamalo esattamente `Index` e incolla il contenuto di `Votazione_CTL_Index_…html`.
5. Salva, torna al foglio e ricaricalo: compare il menu **🗳️ Votazione**.
6. **🗳️ Votazione → 1. Inizializza fogli** (la prima volta Google chiede l'autorizzazione: accetta).
7. In Apps Script: **Esegui il deployment → Nuovo deployment → App web**
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque**
   Copia l'URL che termina in `/exec`.

## Preparazione di ogni votazione

1. Foglio **Candidati**: un nome per riga (in ordine alfabetico, così appaiono sulla scheda) e, nella colonna B, gli anni di tesseramento/incarichi per lo spareggio.
2. Foglio **Codici**: il nome di ogni società avente diritto nella colonna A.
3. **🗳️ Votazione → 2. Genera codici e link**: ogni società riceve un codice e un link personale (il link apre la scheda già col codice).
4. Foglio **Config**: titolo. Lascia vuoti "Numero eletti" e "Max preferenze" per applicare il regolamento:
   - commissari da eleggere = metà delle società elencate in *Codici*, arrotondata per eccesso, minimo 3 e massimo 6;
   - preferenze per scheda = metà dei candidati, arrotondata per eccesso.
   Il foglio *Codici* deve quindi contenere **tutte e sole** le società partecipanti al campionato locale.
5. Invia a ciascun referente di società il **suo** link o codice (mail o messaggio privato).

## Durante e dopo

- **Apri votazione** → le società votano.
- **Aggiorna partecipazione** → vedi quali società hanno già votato (non cosa hanno votato).
- **Chiudi votazione** → poi **Calcola risultati**: graduatoria nel foglio *Risultati*, con spareggio automatico per anni. Se due candidati sono pari anche negli anni la riga è segnata "PARITÀ — da risolvere".

## Anonimato

- Le schede non contengono né codice, né società, né orario, e vengono salvate in posizione casuale nelle proprietà dello script (non nel foglio, quindi nemmeno nella cronologia versioni).
- Dei codici usati resta solo un'impronta (hash): si sa *che* una società ha votato, non *come*.
- Chi amministra lo script è comunque il "custode dell'urna": in teoria potrebbe modificarne il codice. Per trasparenza si può far verificare il codice a un secondo membro prima di aprire il voto.

## Elezione di Responsabile e vice CTL

Usa lo stesso strumento con un **nuovo foglio** (o "Azzera votazione"): in *Candidati* i membri della CTL, in *Codici* un codice per ogni membro (colonna Società = nome del membro), *Max preferenze* = 1 e *Numero eletti* compilato a mano (es. 2). Il regolamento non specifica se il vice sia il secondo classificato o una votazione separata: in caso di dubbio fai due votazioni distinte.

## Note

- Se il foglio era stato creato con la v1, aggiorna a mano la nota di "Numero eletti" in *Config*: il comportamento vale comunque.

- Non rinominare i candidati a votazione aperta.
- Un codice smarrito: cancellalo nel foglio *Codici* e rigenera (solo se quella società non ha ancora votato).
- Se modifichi il codice dello script: **Gestisci deployment → modifica → Nuova versione** (l'URL resta lo stesso).
