import semver from 'semver';
import { VsCodeVersions } from '../interfaces';
import { getVersionsForVscode, getVscodeReleases } from '../utils';
import cache from './index.json';

async function generateCache() {
  const versions = await getVersions();
  // TODO: Write to file and commit in CI
}

async function getVersions() {
  const cachedVersions = cache.map((vscode: VsCodeVersions) => vscode.version);
  const releases = await getVscodeReleases(cachedVersions);

  const versions: VsCodeVersions[] = [...cache];
  for (const release of releases) {
    const { name, tag_name, created_at } = release;
    if (cachedVersions.includes(tag_name)) continue;

    const vscodeVersions = await getVersionsForVscode(tag_name);
    versions.push({
      ...vscodeVersions,
      name,
      created_at,
    });
  }

  return versions.sort((a, b) => semver.rcompare(a.version, b.version));
}
