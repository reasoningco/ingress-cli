# Publishing

This repository contains the publishable Ingress CLI package payload only. It does not include the private Ingress application source tree.

Do not publish without explicit release approval.

## Verify

```bash
npm pack --dry-run
node dist/cli/index.js version --json
```

The dry run should include only:

- `LICENSE`
- `README.md`
- `dist/cli/app.js`
- `dist/cli/index.js`
- `dist/lib/ingress-version.js`
- `package.json`

## Publish Later

This repo is intended to publish through npm trusted publishing, not a stored npm token.

Configure the npm package trusted publisher with these values:

- Organization or user: `reasoningco`
- Repository: `ingress-cli`
- Workflow filename: `release.yml`
- Allowed actions: `npm publish`

```bash
npm login
npm publish --tag beta
```

The package name is `@reasoningco/ingress`, and `publishConfig.access` is `public`.

Manual local publishing should only be used as a fallback when CI publishing is unavailable.
