import * as core from '@actions/core';
import cachedVersions from './cache/index.json';
import { getVersionsForVscode, getVscodeRelease } from './utils';

export async function run(): Promise<void> {
  const versionInput: string = core.getInput('version');
  const targetVersion = versionInput || undefined;

  const { name, version, electron, node, chromium, created_at } =
    await getVersionFromCache(targetVersion);

  core.setOutput('vscode-version-name', name);
  core.setOutput('vscode-version', version);
  core.setOutput('electron-version', electron);
  core.setOutput('node-version', node);
  core.setOutput('chromium-version', chromium);
  core.setOutput('released-at', created_at);
}

async function getVersionFromCache(targetVersion: string = 'latest') {
  const cachedVersion = cachedVersions?.find(vscode => vscode.version === targetVersion);
  if (cachedVersion) return cachedVersion;

  const { name, tag_name, created_at } = await getVscodeRelease(targetVersion);
  const { electron, node, chromium, version } = await getVersionsForVscode(tag_name);

  return {
    name,
    version,
    electron,
    node,
    chromium,
    created_at,
  };
}
