# Votazione CTL — istruzioni (v3)

Voto online anonimo, una scheda per squadra, utilizzabile da telefono senza account Google.

## Installazione (una volta, 10 minuti)

1. Crea un nuovo **Foglio Google** (es. "Elezione CTL 2026").
2. Menu **Estensioni → Apps Script**.
3. Nel file `Code.gs` incolla il contenuto di `Votazione_CTL_Code_…gs`.
4. **＋ → HTML**, chiamalo esattamente `Index` e incolla il contenuto di `Votazione_CTL_Index_…html`.
5. Salva, torna al foglio e ricaricalo: compare il menu **🗳️ Votazione**.
6. **🗳️ Votazione → 1. Inizializza / aggiorna fogli** (la prima volta Google chiede l'autorizzazione: accetta).
7. In Apps Script: **Esegui il deployment → Nuovo deployment → App web**
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque**

### Aggiornamento da v1/v2
Sostituisci `Code.gs` e `Index`, poi rilancia **1. Inizializza / aggiorna fogli**: il foglio *Codici* diventa *Squadre* (codici già generati conservati) e in *Candidati* vengono aggiunte le colonne Qualifica e Squadra. Infine **Gestisci deployment → modifica → Nuova versione** (l'URL resta lo stesso).

## Preparazione di ogni votazione

1. Foglio **Squadre**: il nome di ogni squadra avente diritto nella colonna A. **Una riga = un voto**: se una società ha più squadre ma deve votare una volta sola, inseriscila una volta sola.
2. Foglio **Candidati**, una riga per candidato:
   - **Candidato** (in ordine alfabetico: è l'ordine della scheda);
   - **Qualifica** dal menu a tendina: Allenatore, Aiuto allenatore, Autocandidatura;
   - **Squadra** dal menu a tendina (legge il foglio Squadre);
   - **Anni** di tesseramento/incarichi, per lo spareggio.
3. **🗳️ Votazione → 2. Genera codici e link**: ogni squadra riceve un codice e un **link diretto** che apre la scheda già con il codice. I link si rigenerano ogni volta, così seguono sempre l'URL attuale dell'app.
4. Foglio **Config**: lascia vuoti "Numero eletti" e "Max preferenze" per applicare il regolamento:
   - commissari = metà delle squadre, arrotondata per eccesso, minimo 3, massimo 6;
   - preferenze per scheda = metà dei candidati, arrotondata per eccesso;
   - "Max aiuti allenatore" = 1 (deroga attuale; 0 = nessuno).
5. Invia a ciascuna squadra **solo il suo** link (mail o messaggio privato).

## Come vengono assegnati i posti

1. Si raccolgono le preferenze per tutti i candidati, aiuti allenatore compresi.
2. Allenatori e autocandidature occupano i posti per primi, in ordine di preferenze. Se bastano, passano loro **indipendentemente dai voti** degli aiuti allenatore.
3. Solo se non bastano, entra l'aiuto allenatore più votato (fino al limite della deroga).
4. Eventuali posti ancora scoperti risultano **vacanti**; se gli eletti sono meno di 3 compare un avviso.
5. Spareggio a pari preferenze: più anni di tesseramento/incarichi. Se pari anche negli anni: "PARITÀ — da risolvere".

Il foglio *Risultati* mostra la graduatoria completa con qualifica, squadra, esito e motivazione.

## Durante e dopo

- **Apri votazione** → controlla nomi duplicati, qualifiche mancanti e numero di candidati.
- **Aggiorna partecipazione** → quali squadre hanno votato (non cosa).
- **Chiudi votazione** → poi **Calcola risultati**.

## Anonimato

- Le schede non contengono né codice, né squadra, né orario, e vengono salvate in posizione casuale nelle proprietà dello script (non nel foglio, quindi nemmeno nella cronologia versioni).
- Dei codici usati resta solo un'impronta (hash): si sa *che* una squadra ha votato, non *come*.
- Chi amministra lo script è il "custode dell'urna": per trasparenza si può far verificare il codice a un secondo membro prima di aprire il voto.

## Elezione di Responsabile e vice CTL

Nuovo foglio (o "Azzera votazione"): in *Candidati* i membri della CTL (qualifica non necessaria), in *Squadre* una riga per ogni membro votante, *Max preferenze* = 1, *Numero eletti* = 2 (o separa in due votazioni se il regolamento lo richiede), *Max aiuti allenatore* vuoto o come da regolamento.

## Note

- Non rinominare candidati o squadre a votazione aperta.
- Codice smarrito: cancellalo nel foglio *Squadre* e rigenera (solo se quella squadra non ha ancora votato).
