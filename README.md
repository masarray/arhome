# MasAri Smart Apartment Automation

Premium smart apartment automation and energy-management simulation built with Vite, React, and TypeScript.

## Run locally

```bash
npm ci
npm run dev
```

## Validate

```bash
npm run typecheck
npm run build
```

## GitHub Pages deployment

This repository is ready for GitHub Pages through `.github/workflows/deploy.yml`.

1. Push the repository to GitHub, usually branch `main`.
2. Open **Settings → Pages**.
3. Set source to **GitHub Actions**.
4. Push to `main` or run the workflow manually.

The app uses `HashRouter` and Vite `base: "./"`, so it works safely from a project URL such as `https://username.github.io/repository-name/` without breaking refreshes or static asset paths.

## Notes

- Demo state is client-side only and stored in `localStorage`.
- Add-device pairing, live energy readings, and invoice creation are simulations for product demo purposes.
- No builder-specific runtime metadata or external builder lockfile is required.
