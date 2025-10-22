import * as core from '@actions/core';
import * as github from '@actions/github';
import semver from 'semver';
import { Release, Repo } from './interfaces';

const token = (core.getInput('token') || process.env.GITHUB_TOKEN) ?? '';
const octokit = github.getOctokit(token);
const { repos } = octokit.rest;
const VSCODE_REPO = {
  owner: 'microsoft',
  repo: 'vscode',
};
const ELECTRON_REPO = {
  owner: 'electron',
  repo: 'electron',
};

export async function getFile(repo: Repo, path: string, ref?: string): Promise<string | null> {
  const hasContent = (value: any): value is { content: string } =>
    typeof value.content === 'string';

  try {
    const { data, status } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
      ...repo,
      path,
      ref,
    });
    if (status !== 200 || !hasContent(data)) return null;

    const buff = Buffer.from(data.content, 'base64');
    const text = buff.toString('ascii');

    return text;
  } catch (error) {
    console.debug(error);
  }
  return null;
}

/**
 * Extraction strategy type - a function that attempts to extract a version string
 */
type ExtractionStrategy = () => Promise<string | null>;

/**
 * Tries multiple extraction strategies in order, returning the first successful result
 */
async function tryStrategies(
  strategies: ExtractionStrategy[],
  fallbackValue = 'Unknown'
): Promise<string> {
  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = await strategies[i]();
      if (result) {
        console.debug(`Strategy ${i + 1}/${strategies.length} succeeded`);
        return result;
      }
    } catch (error) {
      console.debug(`Strategy ${i + 1}/${strategies.length} failed:`, error);
    }
  }
  console.debug(`All ${strategies.length} strategies failed, returning: ${fallbackValue}`);
  return fallbackValue;
}

export async function getElectronVersion(version: string): Promise<string> {
  const strategies: ExtractionStrategy[] = [
    // Strategy 1: Extract from package.json (works for all versions including v1.94.0+)
    async () => {
      const packageJson = await getFile(VSCODE_REPO, 'package.json', version);
      if (!packageJson) return null;

      try {
        const pkg = JSON.parse(packageJson);
        const electronVersion = pkg.devDependencies?.electron;
        if (electronVersion) {
          console.debug(`Extracted Electron version from package.json: ${electronVersion}`);
          return electronVersion;
        }
      } catch (error) {
        console.debug('Failed to parse package.json', error);
      }
      return null;
    },

    // Strategy 2: Extract from .yarnrc (legacy, works for v1.0-1.93)
    async () => {
      const yarnrc = await getFile(VSCODE_REPO, `.yarnrc`, version);
      if (!yarnrc) return null;

      const target = yarnrc.match(/target "(\d.*)"/);
      if (target?.[1]) {
        console.debug(`Extracted Electron version from .yarnrc: ${target[1]}`);
        return target[1];
      }
      return null;
    },

    // Strategy 3: Extract from yarn.lock (legacy fallback)
    async () => {
      const yarnLock = await getFile(VSCODE_REPO, 'yarn.lock', version);
      if (!yarnLock) return null;

      // Match pattern: electron@<version>:\n  version "<version>"
      const match = yarnLock.match(/electron@([\d.]+):\s+version\s+"([\d.]+)"/);
      if (match?.[2]) {
        console.debug(`Extracted Electron version from yarn.lock: ${match[2]}`);
        return match[2];
      }
      return null;
    },
  ];

  return tryStrategies(strategies);
}

export async function getChromiumVersion(electronVersion: string): Promise<string> {
  const strategies: ExtractionStrategy[] = [
    // Strategy 1: Extract from DEPS file with single-quoted 'chromium_version' pattern
    async () => {
      const file = await getFile(ELECTRON_REPO, `DEPS`, `v${electronVersion}`);
      if (!file) return null;

      const version = file.match(/'chromium_version':\s+'([\d.]+)'/);
      if (version?.[1]) {
        console.debug(`Extracted Chromium version from DEPS (pattern 1): ${version[1]}`);
        return version[1];
      }
      return null;
    },

    // Strategy 2: Extract from DEPS file with double-quoted "chromium_version" pattern
    async () => {
      const file = await getFile(ELECTRON_REPO, `DEPS`, `v${electronVersion}`);
      if (!file) return null;

      const version = file.match(/"chromium_version":\s+"([\d.]+)"/);
      if (version?.[1]) {
        console.debug(`Extracted Chromium version from DEPS (pattern 2): ${version[1]}`);
        return version[1];
      }
      return null;
    },

    // Strategy 3: Extract from DEPS file with alternative format
    async () => {
      const file = await getFile(ELECTRON_REPO, `DEPS`, `v${electronVersion}`);
      if (!file) return null;

      const version = file.match(/['"]chromium_version['"]:\s+['"](\d[\d.]+)['"]/);
      if (version?.[1]) {
        console.debug(`Extracted Chromium version from DEPS (pattern 3): ${version[1]}`);
        return version[1];
      }
      return null;
    },
  ];

  return tryStrategies(strategies);
}

export async function getNodeVersion(electronVersion: string): Promise<string> {
  const strategies: ExtractionStrategy[] = [
    // Strategy 1: Extract from DEPS file with single-quoted 'node_version' pattern
    async () => {
      const file = await getFile(ELECTRON_REPO, `DEPS`, `v${electronVersion}`);
      if (!file) return null;

      const version = file.match(/'node_version':\s+'(v\d[\d.]+)'/);
      const versionOrSha = version?.[1];

      if (versionOrSha?.startsWith('v')) {
        const nodeVersion = versionOrSha.substring(1);
        console.debug(`Extracted Node version from DEPS (pattern 1): ${nodeVersion}`);
        return nodeVersion;
      }
      return null;
    },

    // Strategy 2: Extract from DEPS file with double-quoted "node_version" pattern
    async () => {
      const file = await getFile(ELECTRON_REPO, `DEPS`, `v${electronVersion}`);
      if (!file) return null;

      const version = file.match(/"node_version":\s+"(v\d[\d.]+)"/);
      const versionOrSha = version?.[1];

      if (versionOrSha?.startsWith('v')) {
        const nodeVersion = versionOrSha.substring(1);
        console.debug(`Extracted Node version from DEPS (pattern 2): ${nodeVersion}`);
        return nodeVersion;
      }
      return null;
    },

    // Strategy 3: Extract from DEPS file with alternative format (no 'v' prefix)
    async () => {
      const file = await getFile(ELECTRON_REPO, `DEPS`, `v${electronVersion}`);
      if (!file) return null;

      const version = file.match(/['"]node_version['"]:\s+['"](\d[\d.]+)['"]/);
      if (version?.[1]) {
        console.debug(`Extracted Node version from DEPS (pattern 3): ${version[1]}`);
        return version[1];
      }
      return null;
    },
  ];

  return tryStrategies(strategies);
}

export async function getVscodeReleases(cachedVersions?: string[]) {
  const releases = [] as Release[];

  const releasesIterator = octokit.paginate.iterator(repos.listReleases, {
    ...VSCODE_REPO,
    per_page: 100,
  });

  for await (const { data } of releasesIterator) {
    for (const { name, tag_name, created_at } of data) {
      if (cachedVersions?.includes(tag_name)) break;

      releases.push({
        name: name ?? tag_name,
        tag_name,
        created_at,
      });
    }
  }

  return releases.sort((a, b) => semver.rcompare(a.tag_name, b.tag_name));
}

export async function getVscodeRelease(version: string) {
  const normalizedVersion = version.toLowerCase();
  const shouldGetLatest = normalizedVersion === 'latest';
  const action = shouldGetLatest ? 'getLatestRelease' : 'getReleaseByTag';

  const {
    data: { name, tag_name, created_at },
  } = await repos[action]({ ...VSCODE_REPO, tag: version });

  return {
    name: name ?? tag_name,
    tag_name,
    created_at,
  };
}

export async function getVersionsForVscode(version: string) {
  console.debug(`Get versions for VSCode ${version}`);
  const electron = await getElectronVersion(version);

  const [chromium, node] = await Promise.all([
    getChromiumVersion(electron),
    getNodeVersion(electron),
  ]);

  return {
    version,
    electron,
    chromium,
    node,
  };
}
