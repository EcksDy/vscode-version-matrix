import { writeFile } from 'fs/promises';
import path from 'path';
import semver from 'semver';
import { VsCodeVersions } from '../interfaces';
import { getVersionsForVscode, getVscodeReleases } from '../utils';
import cache from './index.json';

(async function generateCache() {
  console.log(`Generating cache`);
  const versions = await getVersions();
  console.log(`Generated`);

  const cachePath = path.join(__dirname, `..`, `src`, `cache`, `index.json`);
  await writeFile(cachePath, JSON.stringify(versions));

  console.log(`Wrote to ${cachePath}`);
})();

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

    console.log(`Added ${tag_name} to cache`);
  }

  return versions.sort((a, b) => semver.rcompare(a.version, b.version));
}
