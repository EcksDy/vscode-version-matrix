import * as core from '@actions/core';
import * as github from '@actions/github';
import semver from 'semver';
import { Release, Repo } from './interfaces';

const token = core.getInput('token');
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
    console.log(error);
  }
  return null;
}

export async function getElectronVersion(version: string): Promise<string> {
  let electronVersion = 'Unknown';

  const yarnrc = await getFile(VSCODE_REPO, `.yarnrc`, version);
  if (!yarnrc) return electronVersion;

  const target = yarnrc.match(/target "(\d.*)"/);
  if (target?.[1]) electronVersion = target[1];

  return electronVersion;
}

export async function getChromiumVersion(electronVersion: string): Promise<string> {
  let chromiumVersion = 'Unknown';

  const file = await getFile(ELECTRON_REPO, `DEPS`, `v${electronVersion}`);
  if (!file) return chromiumVersion;

  const version = file.match(/'chromium_version':\s+'(\d.*)'/);
  if (version && version.length > 1) chromiumVersion = version[1];

  return chromiumVersion;
}

export async function getNodeVersion(electronVersion: string): Promise<string> {
  let nodeVersion = 'Unknown';

  const file = await getFile(ELECTRON_REPO, `DEPS`, `v${electronVersion}`);
  if (!file) return nodeVersion;

  const version = file.match(/'node_version':\s+'(v\d.*)'/);
  const versionOrSha = version?.[1];

  if (versionOrSha?.startsWith('v')) nodeVersion = versionOrSha.substring(1);

  return nodeVersion;
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

export async function getVscodeRelease(version: string = 'latest') {
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
  console.log(`Get versions for VSCode ${version}`);
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
