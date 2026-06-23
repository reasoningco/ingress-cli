# Ingress CLI

The `ingress` command is the Ingress forms CLI and MCP stdio server. The npm
package is published as `@reasoningco/ingress`.

## Install

Install the current release from npm:

```bash
npm install -g @reasoningco/ingress
ingress version --json
```

The package installs the `ingress` command.

Maintainers should build and validate the package contents before publishing:

```bash
pnpm package:ingress
cd packages/ingress
npm publish
```

Do not publish, change package metadata, or create release tags unless the
release plan has been approved.

## Authenticate

```bash
ingress auth login --host https://ingresshq.com --api-key ing_...
ingress doctor --json
```

`doctor` checks local config, authentication, server capabilities, and MCP reachability.

## Codex MCP

For Codex, configure an MCP server that starts the local stdio process:

```json
{
  "mcpServers": {
    "ingress-forms": {
      "command": "ingress",
      "args": ["mcp"]
    }
  }
}
```

You can print the same stdio server config with:

```bash
ingress mcp config --transport stdio --json
```

## Claude Code MCP

For Claude Code, add the installed CLI as a stdio MCP server:

```bash
claude mcp add ingress-forms -- ingress mcp
```

The server process reads the authenticated local Ingress CLI config created by `ingress auth login`.

## Secret Handling

Do not commit bearer tokens, API keys, local Ingress CLI config, or generated HTTP MCP configs. Prefer the stdio MCP config above for local agent clients. The HTTP config can include an `Authorization` bearer token when generated from an authenticated machine, so treat it as a secret-bearing file.
