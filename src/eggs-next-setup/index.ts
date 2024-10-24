import { chain, externalSchematic, Rule, SchematicContext, Tree } from "@angular-devkit/schematics";
import { execSync } from "child_process";

const dependenciesToCheck = [
  { name: "rxjs", version: "latest" },
  { name: "primeng", version: "latest" },
  { name: "primeflex", version: "latest" },
  { name: "keycloak-js", version: "latest" },
  { name: "keycloak-angular", version: "latest" }
];

async function getPeerDependencies(packageName: string, version: string): Promise<any> {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://registry.npmjs.org/${packageName}/${version}`);
    const data = await response.json() as { peerDependencies?: Record<string, string> };
    return data.peerDependencies || {};
  } catch (error) {
    console.warn(`Could not fetch peer dependencies for ${packageName}@${version}`);
    return {};
  }
}

async function getCompatibleVersion(packageName: string, angularVersion: string): Promise<string> {
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    const data = await response.json() as { versions: Record<string, { peerDependencies?: Record<string, string> }> };
    const versions = data.versions;
    const compatibleVersion = Object.keys(versions)
        .filter(v => (versions[v].peerDependencies || {})['@angular/core'] === angularVersion)
        .sort()[0];
    return compatibleVersion || 'latest';
  } catch (error) {
    console.warn(`Could not fetch version for ${packageName}, using 'latest'`);
    return 'latest';
  }
}

async function resolveDependencies(angularVersion: string): Promise<{ packages: string[], forceInstall: boolean }> {
  const resolvedPackages: string[] = [`@schematics/angular@${angularVersion}`];
  const compatibilityMap: Map<string, Set<string>> = new Map();

  for (const pkg of dependenciesToCheck) {
    const version = pkg.version === "latest" ? await getCompatibleVersion(pkg.name, angularVersion) : pkg.version;
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
    execSync(`${command} ${args.join(' ')}`, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Error executing command: ${command} ${args.join(' ')}`, error);
    throw error;
  }
}

function installDependencies(angularVersion: string): (tree: Tree, context: SchematicContext) => Promise<Tree> {
  return async (tree: Tree) => {
    const { packages, forceInstall } = await resolveDependencies(angularVersion);
    const additionalArgs = forceInstall ? ['--legacy-peer-deps'] : [];
    await runCommand('npm', ['install', ...packages, ...additionalArgs]);
    return tree;
  };
}

export function eggsNextSetup(options: any): Rule {
  return async (_tree: Tree) => {
    const angularVersion = options['angular-version'] || 'latest';
    const projectName = options.name || 'my-angular-app';

    // @ts-ignore
    return chain([
      externalSchematic('@schematics/angular', 'ng-new', {
        name: projectName,
        version: angularVersion,
        routing: true,
        style: 'scss'
      }),
      installDependencies(angularVersion)
    ]);
  };
}
