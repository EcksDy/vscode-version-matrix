import * as core from '@actions/core';
import { getVersionsForVscode, getVscodeRelease } from './utils';

export async function run(): Promise<void> {
  const versionInput: string = core.getInput('version');
  const version = versionInput || undefined;

  const { name, tag_name } = await getVscodeRelease(version);
  const { electron, node, chromium } = await getVersionsForVscode(tag_name);

  core.setOutput('vscode-version-name', name);
  core.setOutput('vscode-version', tag_name);
  core.setOutput('electron-version', electron);
  core.setOutput('node-version', node);
  core.setOutput('chromium-version', chromium);
}
