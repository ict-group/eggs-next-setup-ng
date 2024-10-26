# eggs-next-setup-ng
Questo repository contiene uno script per configurare rapidamente un nuovo progetto Angular con opzioni personalizzabili e integrazione automatica con GitHub.
## Prerequisiti

1. **Node.js**: Assicurati di avere Node.js installato sulla tua macchina. Puoi scaricarlo da [nodejs.org](https://nodejs.org/).

2. **Git**: Assicurati di avere Git installato e configurato.

3. **Token GitHub**: Lo script richiede un token GitHub per poter creare automaticamente un repository. Segui questi passaggi per generarlo:
    - Vai su [github.com/settings/tokens](https://github.com/settings/tokens) e crea un token personale con permessi `repo`.
    - Copia il token generato.

4. **Configura la Variabile d'Ambiente per il Token GitHub**:
    - Apri il terminale e crea una variabile d'ambiente per il token GitHub:
      ```bash
      export GITHUB_TOKEN=your_personal_token_here
      ```
    - Sostituisci `your_personal_token_here` con il token copiato.
    - Se desideri rendere questa variabile permanente, aggiungila al file `.bashrc` (o `.zshrc` se usi zsh) nel tuo sistema:
      ```bash
      echo "export GITHUB_TOKEN=your_personal_token_here" >> ~/.bashrc
      source ~/.bashrc
      ```

## Installazione

1. **Clona il Repository**:
   ```bash
   git clone https://github.com/username/eggs-next-setup-ng.git
   cd eggs-next-setup-ng
   ```

2. **Installa le dipendenze**:
    Esegui questo comando per installare le dipendenze richieste dal progetto:
   ```bash
   npm install --legacy-peer-deps

   ```
3. **Esecuzione dello Script**:
   Per avviare lo script e configurare un nuovo progetto Angular, esegui il comando seguente nel terminale all'interno della directory del progetto:
   ```bash
   schematics .:eggs-next-setup --dry-run=false


   ```   
## Esecuzione dello Script
## Passo1
Clona questo repository o scarica i file del progetto sulla tua macchina.

## Passo2
Naviga nella directory del progetto ed esegui il seguente comando:
```bash
schematics .:eggs-next-setup --dry-run=false
```

## Passaggi dell'Interfaccia Interattiva

Durante l'esecuzione, lo script ti guiderà attraverso una serie di domande interattive:

1. **Nome del Progetto Angular:** Inserisci il nome del nuovo progetto.  
2. **Versione di Angular:** Specifica la versione di Angular da installare.
3. **Directory di Destinazione:**  Inserisci la directory in cui desideri creare il progetto.
4. **Creazione del Repository GitHub:** Conferma se vuoi creare un nuovo repository su GitHub.