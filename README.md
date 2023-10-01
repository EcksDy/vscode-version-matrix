# VSCode Version Matrix - GitHub Action

This action retrieves the versions of VSCode dependencies: Electron, Node, and Chromium.

## Usage

```yaml
steps:
  - name: Retrieve VSCode dependency versions
    id: vscode-versions
    uses: EcksDy/vscode-version-matrix
    with:
      token: ${{ secrets.GITHUB_TOKEN }}
      # Required: This is to allow the action to access github repos of VSCode and electron

      version: 1.82.0
      # Optional: The version of VSCode to retrieve the dependencies for
      # Default: latest

  - name: Print Output
    id: output
      run: |
        echo "vscode-version-name = ${{ steps.vscode-versions.outputs.vscode-version-name }}"
        echo "vscode-version = ${{ steps.vscode-versions.outputs.vscode-version }}"
        echo "released-at = ${{ steps.vscode-versions.outputs.released-at }}"
        echo "electron-version = ${{ steps.vscode-versions.outputs.electron-version }}"
        echo "node-version = ${{ steps.vscode-versions.outputs.node-version }}"
        echo "chromium-version = ${{ steps.vscode-versions.outputs.chromium-version }}"
```

## Gotchas

In case the VSCode/electron repos have changed their setup, this will stop working for `latest` or
newer versions. The versions that couldn't be retrieved will be `Unknown` and the action will not
throw or fail.

There is a cache mechanism in place(see [/src/cache/index.json](/src/cache/index.json)) to prevent
the action from making too many requests to the GitHub API. The cache is updated once a week.

## Acknowledgements

I've found myself referring to
[ewanharris/vscode-versions](https://github.com/ewanharris/vscode-versions) one too many times, and
needed a dynamic solution.  
This repo is basically his script adapted to a GitHub Action.

Thanks @ewanharris ! :)
