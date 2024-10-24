import axios from 'axios';
import { chain, externalSchematic, Rule, SchematicContext, Tree } from "@angular-devkit/schematics";
import {execa} from "execa";

const dependenciesToCheck = [
  { name: "rxjs", version: "latest" },
  { name: "primeng", version: "latest" },
  { name: "primeflex", version: "latest" },
  { name: "keycloak-js", version: "latest" },
  { name: "keycloak-angular", version: "latest" }
];

async function getPeerDependencies(packageName: string, version: string): Promise<any> {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageName}/${version}`);
    return response.data.peerDependencies || {};
  } catch (error) {
    console.warn(`Could not fetch peer dependencies for ${packageName}@${version}`);
    return {};
  }
}

async function getCompatibleVersion(packageName: string, angularVersion: string): Promise<string> {
  try {
    const response = await axios.get(`https://registry.npmjs.org/${packageName}`);
    const versions = response.data.versions;
    const compatibleVersion = Object.keys(versions)
        .filter(v => (versions[v].peerDependencies || {})['@angular/core'] === angularVersion)
        .sort()[0];
    return compatibleVersion || 'latest';
  } catch (error) {
    console.warn(`Could not fetch version for ${packageName}, using 'latest'`);
    return 'latest';
  }
}

async function resolveDependencies(): Promise<{ packages: string[], forceInstall: boolean }> {
  const resolvedPackages: string[] = [];
  const compatibilityMap: Map<string, Set<string>> = new Map();

  for (const pkg of dependenciesToCheck) {
    const version = pkg.version === "latest" ? await getCompatibleVersion(pkg.name, "latest") : pkg.version;
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

async function runCommand(command: string, args: string[]) {
  try {
    await execa(command, args, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Error executing command: ${command} ${args.join(' ')}`, error);
    throw error;
  }
}

function installDependencies(): (tree: Tree, context: SchematicContext) => Promise<Tree> {
  return async (tree: Tree) => {
    const { packages, forceInstall } = await resolveDependencies();
    const additionalArgs = forceInstall ? ['--legacy-peer-deps'] : [];
    await runCommand('npm', ['install', ...packages, ...additionalArgs]);
    return tree;
  };
}

async function installAngularSchematics(version: string) {
  await runCommand('npm', ['install', `@schematics/angular@${version}`, '--legacy-peer-deps']);
}

export function eggsNextSetup(options: any): Rule {
  return async (_tree: Tree) => {
    const angularVersion = options['angular-version'] || 'latest';
    const projectName = options.name || 'my-angular-app';

    // Installa @schematics/angular nella versione specificata
    await installAngularSchematics(angularVersion);

    // @ts-ignore
    return chain([
      externalSchematic('@schematics/angular', 'ng-new', {
        name: projectName,
        version: angularVersion,
        routing: true,
        style: 'scss'
      }),
      installDependencies()
    ]);
  };
}
