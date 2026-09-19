# Votazione CTL Baskin — istruzioni (v6)

Voto online anonimo in tre round, utilizzabile da telefono senza account Google:

| Round | Chi vota | Chi è votabile | Preferenze | Esito |
|---|---|---|---|---|
| 1 – Commissari CTL | una scheda per squadra | foglio *Candidati* | metà dei candidati (per eccesso) | commissari eletti |
| 2 – Presidente | ogni commissario eletto | tutti i commissari | 1 | il più votato |
| 3 – Vice | ogni commissario eletto | commissari tranne il Presidente | 1 | il più votato |

Il **Formatore di riferimento** non si vota: si indica in *Config*.

Codice sorgente aperto: <https://github.com/UncleDan/votazione-ctl-baskin> (licenza MIT). Per trasparenza il link diretto e cliccabile al repository, con il numero di versione, compare in fondo alla pagina di voto e in tutti i fogli di resoconto (*Risultati*, *Risultati Presidente*, *Risultati Vice*, *Report*, *Riepilogo urna*).

## Installazione (una volta)

1. Crea un **Foglio Google** → **Estensioni → Apps Script**.
2. In `Code.gs` incolla `Votazione_CTL_Code_…gs`; **＋ → HTML** chiamato esattamente `Index` con `Votazione_CTL_Index_…html`.
3. Ricarica il foglio → menu **🗳️ Votazione → Inizializza / aggiorna fogli** (autorizza).
4. Apps Script: **Esegui il deployment → Nuovo deployment → App web**, Esegui come **Me**, accesso **Chiunque**.

**Aggiornamento da versioni precedenti:** sostituisci `Code.gs` e `Index`, rilancia **Inizializza / aggiorna fogli**, poi **Gestisci deployment → modifica → Nuova versione** (l'URL resta lo stesso).

## Round 1 – Commissari CTL

1. *Squadre*: una riga per squadra avente diritto (una riga = un voto).
2. *Candidati*: nome, **Qualifica** (Allenatore / Aiuto allenatore / Autocandidatura), **Squadra**, anni per lo spareggio.
3. *Config*: compila **Sezione territoriale** (es. Emilia-Romagna) e **Anno sportivo** (testo libero, es. 2026/2027): compaiono sulla pagina di voto, nei risultati, nel report e nel riepilogo urna. Lascia vuoti "Numero eletti" e "Max preferenze" per applicare il regolamento (commissari = metà delle squadre per eccesso, min 3, max 6). "Max aiuti allenatore" = 1.
4. **Round 1 → Genera codici e link squadre**, invia a ogni squadra il suo link.
5. **Round 1 → Apri**, poi **Chiudi**, poi **Calcola risultati**.

Assegnazione dei posti: allenatori e autocandidature entrano per primi in ordine di preferenze; solo se non bastano entra l'aiuto allenatore più votato (max 1); i posti ancora scoperti restano vacanti. Spareggio: anni di tesseramento/incarichi.
Se compare **PARITÀ — da risolvere**, scrivi a mano ELETTO o Non eletto nella colonna Esito di *Risultati*.

## Round 2 – Presidente

1. **Round 2 → Prepara commissari e link**: crea il foglio *Commissari* con gli ELETTI del round 1, ciascuno con codice e link personale. **Lo stesso link vale anche per il round 3.**
2. Invia a ogni commissario il suo link.
3. **Round 2 → Apri / Chiudi / Calcola risultati**. Vince chi ha più voti (maggioranza semplice); a pari voti precede chi ha più anni. Il nome viene scritto in *Config → Presidente*.

## Round 3 – Vice

**Round 3 → Apri / Chiudi / Calcola risultati**: stessi link, si vota tra i commissari rimanenti. Il nome va in *Config → Vice*.

Se in round 2 o 3 resta una parità, la risolvi come da regolamento e scrivi il nome a mano in *Config*, poi **Aggiorna report**.

## Formatore di riferimento

- Scrivi il nome in *Config → Formatore di riferimento* (nessuna votazione).
- Preferibilmente **non votante**: non compare tra i candidati e non fa parte della CTL.
- Se vuole essere **votante**, va inserito anche in *Candidati* come **Autocandidatura** (stesso nome, scritto identico). Se viene eletto, nel report risulta sia commissario sia formatore di riferimento, e vota nei round 2 e 3.

## Report

Il foglio *Report* si aggiorna da solo dopo ogni calcolo (o da **Aggiorna report**): Presidente, Vice, Formatore di riferimento con la sua condizione (votante / non votante), elenco dei commissari con qualifica, squadra e ruolo (es. "Commissario · Presidente", "Commissario · Formatore di riferimento"). Si stampa o si esporta in PDF da **File → Scarica**.

## Riepilogo urna (per il custode)

Il foglio *Riepilogo urna* si aggiorna alla chiusura di ogni round, dopo ogni calcolo e da **Aggiorna riepilogo urna**. Per ciascun round riporta:

- aventi diritto, chi ha votato e chi no;
- **controllo di coerenza**: numero di schede nell'urna = numero di codici usati (altrimenti "ANOMALIA");
- schede bianche e preferenze per candidato;
- l'elenco delle **schede anonime** una per riga, in ordine casuale, per poter ricontare a mano.

A round **aperto** mostra solo partecipazione e numero di schede: conteggi e schede compaiono dopo la chiusura.

## Anonimato

- Le schede non contengono codice, votante né orario, sono salvate in posizione casuale nelle proprietà dello script (fuori dal foglio e dalla sua cronologia).
- Dei codici usati resta solo un hash: si sa *chi* ha votato, non *come*.
- Nei round 2 e 3 i votanti sono pochi (3–6): l'anonimato tecnico c'è, ma con numeri così piccoli l'esito può comunque far intuire i voti.
- Chi amministra lo script è il "custode dell'urna": per trasparenza si può far verificare il codice a un secondo membro.

## Altre voci del menu

- **Aggiorna partecipazione**: chi ha già votato nel round in corso.
- **Azzera round…**: cancella le schede di un round (1, 2, 3) o di TUTTI. I codici restano validi.
- Un solo round alla volta può essere aperto; non modificare candidati o votanti a round aperto.
