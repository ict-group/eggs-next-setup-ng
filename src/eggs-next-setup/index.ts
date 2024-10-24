import { chain, Rule, SchematicContext, Tree } from "@angular-devkit/schematics";
import { execSync } from "child_process";
import prompts from "prompts";
import * as path from "path";
import axios from "axios";
import * as fs from "fs";
import 'dotenv/config';


const dependenciesToCheck = [
  { name: "rxjs", version: "latest" },
  { name: "primeng", version: "latest" },
  { name: "primeflex", version: "latest" },
  { name: "keycloak-js", version: "latest" },
  { name: "keycloak-angular", version: "latest" }
];

async function getGitHubToken(): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  console.log(token)
  if (!token) {
    console.error("Errore: La variabile d'ambiente GITHUB_TOKEN non è impostata.");
    process.exit(1); // Termina lo script se non è presente il token
  }
  return token;
}

// Funzione per verificare se esiste un repository con lo stesso nome
async function checkIfRepoExists(repoName: string, token: string): Promise<boolean> {
  try {
    const response = await axios.get(`https://api.github.com/user/repos`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data.some((repo: any) => repo.name === repoName);
  } catch (error) {
    console.error('Errore durante la verifica dell\'esistenza del repository:', error.message);
    return false;
  }
}

async function createGitRepo(repoName: string, privateRepo: boolean, token: string): Promise<string> {
  try {
    // Verifica se esiste già un repository con lo stesso nome
    const exists = await checkIfRepoExists(repoName, token);
    if (exists) {
      throw new Error(`Esiste già un repository con il nome "${repoName}".`);
    }

    const response = await axios.post(
        'https://api.github.com/user/repos',
        { name: repoName, private: privateRepo },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
    );

    if (!response.data.clone_url) {
      throw new Error(`Failed to create GitHub repository`);
    }

    return response.data.clone_url;
  } catch (error: any) {
    if (error.response && error.response.status === 422) {
      console.error('Errore durante la creazione del repository: Repository già esistente o nome non valido.');
    } else {
      console.error('Errore durante la richiesta Axios:', error.message);
    }
    throw error;
  }
}
async function getPeerDependencies(packageName: string, version: string): Promise<any> {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageName}/${version}`);
    const data = response.data;
    return typeof data === 'object' ? (data as any).peerDependencies || {} : {};
  } catch (error) {
    console.warn(`Could not fetch peer dependencies for ${packageName}@${version}`);
    return {};
  }
}

async function getCompatibleVersion(packageName: string, angularVersion: string): Promise<string> {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageName}`);
    const data = response.data;
    if (typeof data === 'object' && data !== null) {
      const versions = (data as any).versions;
      const compatibleVersion = Object.keys(versions)
          .filter(v => (versions[v].peerDependencies || {})['@angular/core'] === angularVersion)
          .sort()[0];
      return compatibleVersion || 'latest';
    }
    return 'latest';
  } catch (error) {
    console.warn(`Could not fetch version for ${packageName}, using 'latest'`);
    return 'latest';
  }
}

async function resolveDependencies(angularVersion: string): Promise<{ packages: string[], forceInstall: boolean }> {
  const resolvedPackages: string[] = [`@schematics/angular@${angularVersion}`];
  const compatibilityMap: Map<string, Set<string>> = new Map();

  for (const pkg of dependenciesToCheck) {
    const version = await getCompatibleVersion(pkg.name, angularVersion);
    const peerDeps = await getPeerDependencies(pkg.name, version);

    resolvedPackages.push(`${pkg.name}@${version}`);

    Object.entries(peerDeps).forEach(([depName, depVersion]) => {
      if (!compatibilityMap.has(depName)) {
        compatibilityMap.set(depName, new Set());
      }
      if (typeof depVersion === "string") {
        compatibilityMap.get(depName)?.add(depVersion);
      }
    });
  }

  let forceInstall = false;
  compatibilityMap.forEach((versions, depName) => {
    if (versions.size > 1) {
      console.warn(`Detected conflicting versions for ${depName}: ${Array.from(versions).join(", ")}`);
      forceInstall = true;
    }
  });

  return { packages: resolvedPackages, forceInstall };
}

// function runCommand(command: string, args: string[]) {
//   try {
//     execSync(`${command} ${args.join(' ')}`, { stdio: 'inherit' });
//   } catch (error) {
//     console.error(`Errore durante l'esecuzione del comando: ${command} ${args.join(' ')}`);
//     throw error;
//   }
// }

function runCommand(command: string, args: string[], cwd?: string) {
  try {
    execSync(`${command} ${args.join(' ')}`, { stdio: 'inherit', cwd });
  } catch (error) {
    console.error(`Errore durante l'esecuzione del comando: ${command} ${args.join(' ')}`);
    throw error;
  }
}

async function setupGitRepository(projectPath: string, repoUrl: string, token: string) {
  if (!fs.existsSync(projectPath)) {
    fs.mkdirSync(projectPath, { recursive: true });
  }
  process.chdir(projectPath);

  try {
    execSync('git init', { stdio: 'inherit' });

    // Configura le informazioni di Git, nel caso non siano state già impostate
    execSync('git config user.name "Your Name"', { stdio: 'inherit' });
    execSync('git config user.email "your-email@example.com"', { stdio: 'inherit' });

    // Aggiungi il token direttamente all'URL remoto
    const authRepoUrl = repoUrl.replace('https://', `https://${token}@`);
    execSync(`git remote add origin ${authRepoUrl}`, { stdio: 'inherit' });

    // Aggiungi e committa solo se ci sono file da committare
    execSync('git add .', { stdio: 'inherit' });

    try {
      execSync('git commit -m "Initial commit"', { stdio: 'inherit' });
    } catch (error) {
      console.warn('Nessun file da committare o commit già presente.');
    }

    // Prova a fare push solo se il commit è andato a buon fine
    execSync('git push -u origin master', { stdio: 'inherit' });
  } catch (error) {
    console.error('Errore durante la configurazione del repository Git:', error);
  }
}



function installDependenciesRule(angularVersion: string): Rule {
  return async (_tree: Tree) => {
    const { packages, forceInstall } = await resolveDependencies(angularVersion);
    const additionalArgs = forceInstall ? ['--legacy-peer-deps'] : [];
    const installCommand = 'npm';
    const installArgs = ['install', ...packages, ...additionalArgs];

    console.log(`Esecuzione comando: ${installCommand} ${installArgs.join(' ')}`);
    runCommand(installCommand, installArgs);
  };
}

export function eggsNextSetup(options: any): Rule {
  return async (_tree: Tree, _context: SchematicContext) => {
    const angularVersion = options['angular-version'] || 'latest';
    const projectName = options.name || 'my-angular-app';
    let targetDirectory = options['target-directory'] || './';

    if (!options['target-directory']) {
      const response = await prompts({
        type: 'text',
        name: 'targetDirectory',
        message: 'Inserisci la directory di destinazione per il progetto Angular:',
        initial: './'
      });
      targetDirectory = response.targetDirectory;
    }

    const fullPath = path.isAbsolute(targetDirectory)
        ? path.join(targetDirectory, projectName)
        : path.resolve(process.cwd(), targetDirectory, projectName);

    // Cambia directory di lavoro temporaneamente per evitare problemi
    const workingDir = path.dirname(fullPath);
    const projectDirName = path.basename(fullPath);

    const gitResponse = await prompts({
      type: 'confirm',
      name: 'createRepo',
      message: 'Vuoi creare anche un repository GitHub per questo progetto?',
      initial: true
    });

    let repoUrl = '';
    let token = '';
    if (gitResponse.createRepo) {
      const token = await getGitHubToken();
      try {
        repoUrl = await createGitRepo(projectDirName, true, token);
        console.log(`Repository GitHub creato con successo: ${repoUrl}`);
      } catch (error) {
        console.error('Errore durante la creazione del repository:', error);
      }
    }

    return chain([
      (_tree, _context) => {
        runCommand('npx', ['ng', 'new', projectDirName, '--version', angularVersion, '--routing', '--style', 'scss'], workingDir);
      },
      ()=> installDependenciesRule(angularVersion),
      (_tree, _context) => {
        if (repoUrl) {
          setupGitRepository(fullPath, repoUrl,token);
        }
      }
    ]);
    // return chain([
    //   externalSchematic('@schematics/angular', 'ng-new', {
    //     name: projectName,
    //     version: angularVersion,
    //     routing: true,
    //     style: 'scss',
    //     directory: fullPath
    //   }),
    //   installDependenciesRule(angularVersion),
    //   (_tree, _context) => {
    //     if (repoUrl) {
    //       setupGitRepository(fullPath, repoUrl);
    //     }
    //   }
    // ]);
  };
}