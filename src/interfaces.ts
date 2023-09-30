export interface Release {
  created_at: string;
  name: string;
  tag_name: string;
}

export interface VsCodeVersions {
  created_at: string;
  electron: string;
  name: string;
  node: string;
  chromium: string;
  version: string;
}

export interface Repo {
  owner: string;
  repo: string;
}
