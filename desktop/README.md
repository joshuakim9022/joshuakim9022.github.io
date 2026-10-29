# Skill Tracker desktop app

Electron wrapper around the web app in `../skills`. `npm run sync` copies the web app into `app/`, so the web version stays the single source of truth.

## Run locally

```bash
cd desktop
npm install
npm start
```

## Build an installer for your OS

```bash
npm run dist
```

The installer ends up in `desktop/dist/`.

## Release installers for all platforms

Push a version tag. The `Build desktop app` workflow builds Windows, macOS and Linux installers and attaches them to a GitHub Release.

```bash
git tag v1.0.0
git push origin v1.0.0
```

The workflow can also be run by hand from the Actions tab (it builds but does not publish).

The app's data is stored separately from the browser version. Use the Backup tab to export from one and import into the other.
