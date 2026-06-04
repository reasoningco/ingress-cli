# Ingress CLI Private Beta

The `ingress` command is the private beta CLI and MCP stdio server for Ingress forms.

## Install

Log in with an npm account that has access to the beta package through the npm org team:

```bash
npm login
npm install -g @reasoningco/ingress-cli@beta
ingress version --json
```

The package installs the `ingress` command.

## Authenticate

```bash
ingress auth login --host <url> --api-key <key>
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

Do not commit bearer tokens, API keys, local Ingress CLI config, or generated HTTP MCP configs. Prefer the stdio MCP config above for local agent clients. The HTTP config can include an `Authorization` bearer token when generated from an authenticated machine.
