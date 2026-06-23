"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCli = runCli;
exports.createNodeCliDeps = createNodeCliDeps;
const nodeFs = __importStar(require("node:fs"));
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const ingress_version_1 = require("../lib/ingress-version");
const CLI_VERSION = ingress_version_1.INGRESS_RELEASE_VERSION;
const CLI_USER_AGENT = `ingress-forms-cli/${CLI_VERSION}`;
const PRODUCTION_HOST = "https://ingresshq.com";
const PLACEHOLDER_API_KEY = "ing_...";
async function runCli(argv, deps = createNodeCliDeps()) {
    const ctx = createCliContext(deps);
    const parsed = parseArgs(argv);
    const output = parsed.flags.json === true ? "json" : "text";
    try {
        await main(ctx, parsed, output);
        return ctx.exitCode;
    }
    catch (error) {
        return handleCliError(ctx, error, output);
    }
}
function createNodeCliDeps() {
    return {
        env: process.env,
        fetch: globalThis.fetch.bind(globalThis),
        fs: {
            existsSync: nodeFs.existsSync,
            mkdirSync: nodeFs.mkdirSync,
            readFileSync: nodeFs.readFileSync,
            writeFileSync: nodeFs.writeFileSync,
            rmSync: nodeFs.rmSync,
        },
        cwd: () => process.cwd(),
        homeDir: node_os_1.homedir,
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr,
    };
}
function createCliContext(deps) {
    const env = deps.env ?? process.env;
    const cwd = deps.cwd?.() ?? process.cwd();
    const homeDir = deps.homeDir?.() ?? (0, node_os_1.homedir)();
    const configPath = resolveConfigPath(env, homeDir);
    return {
        env,
        fetch: deps.fetch ?? globalThis.fetch.bind(globalThis),
        fs: deps.fs ?? {
            existsSync: nodeFs.existsSync,
            mkdirSync: nodeFs.mkdirSync,
            readFileSync: nodeFs.readFileSync,
            writeFileSync: nodeFs.writeFileSync,
            rmSync: nodeFs.rmSync,
        },
        cwd,
        homeDir,
        configPath,
        legacyConfigPath: (0, node_path_1.resolve)(cwd, ".ingress-cli.json"),
        stdin: deps.stdin,
        stdout: deps.stdout ?? process.stdout,
        stderr: deps.stderr ?? process.stderr,
        exitCode: 0,
    };
}
async function main(ctx, parsed, output) {
    const [domain, command, ...rest] = parsed.positionals;
    if (parsed.flags.version === true || domain === "version") {
        printVersion(ctx, output);
        return;
    }
    if (!domain) {
        printGlobalHelp(ctx);
        return;
    }
    if (parsed.flags.help === true || parsed.flags.h === true) {
        printHelp(ctx, domain);
        return;
    }
    if (domain === "auth") {
        await runAuth(ctx, command, rest, parsed.flags, output);
        return;
    }
    if (domain === "capabilities") {
        const result = await apiRequest(ctx, "GET", "/capabilities");
        print(ctx, result, output);
        return;
    }
    if (domain === "doctor") {
        await runDoctor(ctx, output);
        return;
    }
    if (domain === "analytics") {
        await runAnalytics(ctx, command, rest, parsed.flags, output);
        return;
    }
    if (domain === "forms") {
        await runForms(ctx, command, rest, parsed.flags, output);
        return;
    }
    if (domain === "mcp") {
        await runMcp(ctx, command, parsed.flags, output);
        return;
    }
    throw new UserError(`Unknown command group: ${domain}`, {
        hint: "Run `ingress --help` to see available command groups.",
    });
}
async function runAnalytics(ctx, command, args, flags, output) {
    switch (command) {
        case "report": {
            const result = await apiRequest(ctx, "GET", queryPath("/analytics", flags, ["range", "from", "to", "form"]));
            printOrWriteJson(ctx, result, flags, output, "report");
            return;
        }
        case "funnel": {
            const formId = requiredArg(args[0], "form id");
            const result = await apiRequest(ctx, "GET", queryPath(`/forms/${encodeURIComponent(formId)}/analytics/funnel`, flags, [
                "range",
                "from",
                "to",
            ]));
            printOrWriteJson(ctx, result, flags, output, "funnel");
            return;
        }
        default:
            throw new UserError("Unknown analytics command", {
                hint: "Run `ingress analytics --help` to see analytics commands.",
            });
    }
}
async function runAuth(ctx, command, _args, flags, output) {
    switch (command) {
        case "login": {
            const host = stringFlag(flags, "host");
            const apiKey = stringFlag(flags, "api-key");
            if (!host || !apiKey) {
                throw new UserError("auth login requires --host and --api-key", {
                    hint: `Example: ingress auth login --host ${PRODUCTION_HOST} --api-key ${PLACEHOLDER_API_KEY}`,
                });
            }
            saveConfig(ctx, { host, apiKey });
            print(ctx, { ok: true, configPath: configPath(ctx) }, output, `Saved CLI credentials to ${configPath(ctx)}`);
            return;
        }
        case "logout": {
            clearConfig(ctx);
            print(ctx, { ok: true }, output, "Removed local CLI credentials");
            return;
        }
        case "status": {
            const result = await apiRequest(ctx, "GET", "/cli/whoami");
            print(ctx, result, output);
            return;
        }
        default:
            throw new UserError("Unknown auth command", {
                hint: "Run `ingress auth --help` to see auth commands.",
            });
    }
}
async function runForms(ctx, command, args, flags, output) {
    switch (command) {
        case "list": {
            const result = await apiRequest(ctx, "GET", queryPath("/forms", flags, [
                "limit",
                "cursor",
                "status",
                "tag",
                "q",
            ]));
            print(ctx, result, output);
            return;
        }
        case "get": {
            const formId = requiredArg(args[0], "form id");
            const result = await apiRequest(ctx, "GET", `/forms/${encodeURIComponent(formId)}`);
            print(ctx, result, output);
            return;
        }
        case "create": {
            const title = stringFlag(flags, "title");
            if (!title)
                throw new UserError("forms create requires --title");
            const description = stringFlag(flags, "description");
            const result = await apiRequest(ctx, "POST", "/forms", {
                title,
                ...(description ? { description } : {}),
            }, idempotencyOptions(flags));
            print(ctx, result, output);
            return;
        }
        case "drafts": {
            const formId = stringFlag(flags, "form") ?? requiredArg(args[0], "form id");
            const result = await apiRequest(ctx, "GET", queryPath(`/forms/${encodeURIComponent(formId)}/agent-drafts`, flags, [
                "limit",
                "cursor",
                "status",
            ]));
            print(ctx, result, output);
            return;
        }
        case "agent-drafts": {
            const subcommand = args[0] ?? "list";
            if (subcommand !== "list") {
                throw new UserError("Usage: ingress forms agent-drafts list --form <form-id>");
            }
            const formId = stringFlag(flags, "form") ?? requiredArg(args[1], "form id");
            const result = await apiRequest(ctx, "GET", queryPath(`/forms/${encodeURIComponent(formId)}/agent-drafts`, flags, [
                "limit",
                "cursor",
                "status",
            ]));
            print(ctx, result, output);
            return;
        }
        case "agent-timeline": {
            const formId = stringFlag(flags, "form") ?? requiredArg(args[0], "form id");
            const limit = limitFlag(flags, 100, 200);
            const result = await apiRequest(ctx, "GET", queryPath(`/forms/${encodeURIComponent(formId)}/agent-timeline`, { ...flags, limit: String(limit) }, ["limit", "cursor", "action", "via"]));
            print(ctx, result, output);
            return;
        }
        case "branches": {
            const formId = requiredArg(args[0], "form id");
            const result = await apiRequest(ctx, "GET", queryPath(`/forms/${encodeURIComponent(formId)}/branches`, flags, [
                "limit",
                "cursor",
                "branch-name",
            ]));
            print(ctx, result, output);
            return;
        }
        case "commits": {
            const formId = requiredArg(args[0], "form id");
            const limit = limitFlag(flags, 200, 500);
            const result = await apiRequest(ctx, "GET", queryPath(`/forms/${encodeURIComponent(formId)}/commits`, { ...flags, limit: String(limit) }, ["limit", "cursor", "branch"]));
            print(ctx, result, output);
            return;
        }
        case "submissions": {
            const formId = requiredArg(args[0], "form id");
            const limit = limitFlag(flags, 200, 500);
            const result = await apiRequest(ctx, "GET", queryPath(`/forms/${encodeURIComponent(formId)}/submissions`, { ...flags, limit: String(limit) }, ["limit", "cursor", "status", "tag"]));
            print(ctx, result, output);
            return;
        }
        case "submission-history": {
            const submissionId = requiredArg(args[0], "submission id");
            const result = await apiRequest(ctx, "GET", queryPath(`/submissions/${encodeURIComponent(submissionId)}/history`, flags, [
                "limit",
                "cursor",
            ]));
            print(ctx, result, output);
            return;
        }
        case "workflows": {
            const formId = requiredArg(args[0], "form id");
            const result = await apiRequest(ctx, "GET", queryPath(`/forms/${encodeURIComponent(formId)}/workflows`, flags, ["active"]));
            print(ctx, normalizeWorkflowCliResult(result), output);
            return;
        }
        case "workspace-workflows": {
            const workspaceId = requiredArg(args[0], "workspace id");
            const result = await apiRequest(ctx, "GET", queryPath(`/workspaces/${encodeURIComponent(workspaceId)}/workflows`, flags, [
                "active",
                "limit",
                "cursor",
            ]));
            print(ctx, normalizeWorkflowCliResult(result), output);
            return;
        }
        case "workflow-get": {
            const formId = requiredArg(args[0], "form id");
            const workflowId = requiredArg(args[1], "workflow id");
            const result = await apiRequest(ctx, "GET", `/forms/${encodeURIComponent(formId)}/workflows/${encodeURIComponent(workflowId)}`);
            print(ctx, normalizeWorkflowCliResult(result), output);
            return;
        }
        case "workflow-create": {
            const formId = requiredArg(args[0], "form id");
            const name = stringFlag(flags, "name");
            if (!name)
                throw new UserError("forms workflow-create requires --name <name>");
            const result = await apiRequest(ctx, "POST", `/forms/${encodeURIComponent(formId)}/workflows`, { name }, idempotencyOptions(flags));
            print(ctx, normalizeWorkflowCliResult(result), output);
            return;
        }
        case "workflow-plan": {
            const formId = requiredArg(args[0], "form id");
            const workflowId = requiredArg(args[1], "workflow id");
            const opsPath = stringFlag(flags, "ops");
            if (!opsPath)
                throw new UserError("forms workflow-plan requires --ops <file>");
            const operations = readOperationsFile(ctx, opsPath);
            const result = await apiRequest(ctx, "POST", `/forms/${encodeURIComponent(formId)}/workflows/${encodeURIComponent(workflowId)}/plan`, { operations });
            print(ctx, normalizeWorkflowCliResult(result), output);
            return;
        }
        case "workflow-apply": {
            const formId = requiredArg(args[0], "form id");
            const workflowId = requiredArg(args[1], "workflow id");
            const opsPath = stringFlag(flags, "ops");
            if (!opsPath)
                throw new UserError("forms workflow-apply requires --ops <file>");
            const operations = readOperationsFile(ctx, opsPath);
            const dryRun = workflowApplyDryRun(flags);
            const result = await apiRequest(ctx, "POST", `/forms/${encodeURIComponent(formId)}/workflows/${encodeURIComponent(workflowId)}/apply`, { dryRun, operations }, idempotencyOptions(flags));
            print(ctx, normalizeWorkflowCliResult(result), output);
            return;
        }
        case "workflow-delete": {
            const formId = requiredArg(args[0], "form id");
            const workflowId = requiredArg(args[1], "workflow id");
            const result = await apiRequest(ctx, "DELETE", `/forms/${encodeURIComponent(formId)}/workflows/${encodeURIComponent(workflowId)}`, undefined, idempotencyOptions(flags));
            print(ctx, normalizeWorkflowCliResult(result ?? { ok: true }), output);
            return;
        }
        case "workflow-reorder": {
            const formId = requiredArg(args[0], "form id");
            const workflowIds = csvFlag(flags, "workflow-ids");
            if (!workflowIds?.length) {
                throw new UserError("forms workflow-reorder requires --workflow-ids <id,id>");
            }
            const result = await apiRequest(ctx, "PATCH", `/forms/${encodeURIComponent(formId)}/workflows/reorder`, { workflowIds }, idempotencyOptions(flags));
            print(ctx, normalizeWorkflowCliResult(result), output);
            return;
        }
        case "workflow-runs": {
            const formId = requiredArg(args[0], "form id");
            const workflowId = requiredArg(args[1], "workflow id");
            const limit = limitFlag(flags, 50, 100);
            const result = await apiRequest(ctx, "GET", queryPath(`/forms/${encodeURIComponent(formId)}/workflows/${encodeURIComponent(workflowId)}/runs`, { ...flags, limit: String(limit) }, ["limit", "cursor", "status"]));
            print(ctx, normalizeWorkflowCliResult(result), output);
            return;
        }
        case "workflow-run": {
            const runId = requiredArg(args[0], "workflow run id");
            const result = await apiRequest(ctx, "GET", `/workflows/runs/${encodeURIComponent(runId)}`);
            print(ctx, normalizeWorkflowCliResult(result), output);
            return;
        }
        case "workflow-cases": {
            const workspaceId = requiredArg(args[0], "workspace id");
            const workflowId = requiredArg(args[1], "workflow id");
            const result = await apiRequest(ctx, "GET", queryPath(`/workspaces/${encodeURIComponent(workspaceId)}/workflows/${encodeURIComponent(workflowId)}/cases`, flags, ["limit", "cursor", "status"]));
            print(ctx, normalizeWorkflowCliResult(result), output);
            return;
        }
        case "workflow-case": {
            const workspaceId = requiredArg(args[0], "workspace id");
            const workflowId = requiredArg(args[1], "workflow id");
            const caseId = requiredArg(args[2], "workflow case id");
            const result = await apiRequest(ctx, "GET", `/workspaces/${encodeURIComponent(workspaceId)}/workflows/${encodeURIComponent(workflowId)}/cases/${encodeURIComponent(caseId)}`);
            print(ctx, normalizeWorkflowCliResult(result), output);
            return;
        }
        case "workflow-rerun": {
            const runId = requiredArg(args[0], "workflow run id");
            const result = await apiRequest(ctx, "POST", `/workflows/runs/${encodeURIComponent(runId)}/rerun`, {}, idempotencyOptions(flags));
            print(ctx, normalizeWorkflowCliResult(result), output);
            return;
        }
        case "plan": {
            const formId = requiredArg(args[0], "form id");
            const opsPath = stringFlag(flags, "ops");
            if (!opsPath)
                throw new UserError("forms plan requires --ops <file>");
            const branchId = stringFlag(flags, "branch");
            const operations = readOperationsFile(ctx, opsPath);
            const result = await apiRequest(ctx, "POST", `/forms/${encodeURIComponent(formId)}/agent-drafts/plan`, { branchId, operations });
            print(ctx, result, output);
            return;
        }
        case "apply": {
            const formId = requiredArg(args[0], "form id");
            const opsPath = stringFlag(flags, "ops");
            if (!opsPath)
                throw new UserError("forms apply requires --ops <file>");
            const operations = readOperationsFile(ctx, opsPath);
            await applyAgentDraftOperationsFromCli(ctx, formId, operations, flags, output);
            return;
        }
        case "settings": {
            const formId = requiredArg(args[0], "form id");
            const settingsPath = stringFlag(flags, "settings");
            if (!settingsPath)
                throw new UserError("forms settings requires --settings <file>");
            await applyAgentDraftOperationsFromCli(ctx, formId, [{ op: "set_form_settings", settings: readJsonObjectFile(ctx, settingsPath, "settings") }], flags, output);
            return;
        }
        case "theme": {
            const formId = requiredArg(args[0], "form id");
            const themePath = stringFlag(flags, "theme");
            if (!themePath)
                throw new UserError("forms theme requires --theme <file>");
            await applyAgentDraftOperationsFromCli(ctx, formId, [{ op: "set_theme", theme: readJsonObjectFile(ctx, themePath, "theme") }], flags, output);
            return;
        }
        case "css": {
            const formId = requiredArg(args[0], "form id");
            const cssPath = stringFlag(flags, "css");
            if (!cssPath)
                throw new UserError("forms css requires --css <file>");
            const mode = stringFlag(flags, "mode");
            if (mode !== "append" && mode !== "replace") {
                throw new UserError("forms css requires --mode append|replace");
            }
            await applyAgentDraftOperationsFromCli(ctx, formId, [
                {
                    op: "set_custom_css",
                    mode,
                    css: readTextFile(ctx, cssPath),
                    enabled: enabledFlag(flags, true),
                },
            ], flags, output);
            return;
        }
        case "custom-js": {
            const formId = requiredArg(args[0], "form id");
            const ownerType = stringFlag(flags, "owner");
            if (ownerType !== "page" && ownerType !== "field") {
                throw new UserError("forms custom-js requires --owner page|field");
            }
            const owner = stringFlag(flags, "target");
            if (!owner)
                throw new UserError("forms custom-js requires --target <ref>");
            const scriptPath = stringFlag(flags, "script");
            if (!scriptPath)
                throw new UserError("forms custom-js requires --script <file>");
            await applyAgentDraftOperationsFromCli(ctx, formId, [
                {
                    op: "set_custom_js_rule",
                    ownerType,
                    owner,
                    config: {
                        enabled: enabledFlag(flags, true),
                        watchedFieldIds: csvFlag(flags, "watch"),
                        script: readTextFile(ctx, scriptPath),
                    },
                },
            ], flags, output);
            return;
        }
        case "commit": {
            const formId = requiredArg(args[0], "form id");
            const branchId = stringFlag(flags, "branch");
            if (!branchId)
                throw new UserError("forms commit requires --branch <agent-branch-id>");
            const message = stringFlag(flags, "message") ?? stringFlag(flags, "commit");
            if (!message)
                throw new UserError("forms commit requires --message <message>");
            const result = await apiRequest(ctx, "POST", `/forms/${encodeURIComponent(formId)}/agent-drafts/${encodeURIComponent(branchId)}/commit`, { message }, idempotencyOptions(flags));
            print(ctx, result, output);
            return;
        }
        case "abandon-draft": {
            const formId = stringFlag(flags, "form") ?? requiredArg(args[0], "form id");
            const branchId = stringFlag(flags, "branch");
            if (!branchId)
                throw new UserError("forms abandon-draft requires --branch <agent-branch-id>");
            const reason = stringFlag(flags, "reason");
            const result = await apiRequest(ctx, "POST", `/forms/${encodeURIComponent(formId)}/agent-drafts/${encodeURIComponent(branchId)}/abandon`, {
                ...(reason ? { reason } : {}),
            }, idempotencyOptions(flags));
            print(ctx, result, output);
            return;
        }
        case "export": {
            const formId = requiredArg(args[0], "form id");
            const branchId = stringFlag(flags, "branch");
            const out = stringFlag(flags, "out");
            const result = branchId
                ? await apiRequest(ctx, "GET", `/forms/${encodeURIComponent(formId)}/agent-drafts/${encodeURIComponent(branchId)}`)
                : await apiRequest(ctx, "GET", `/forms/${encodeURIComponent(formId)}`);
            const schema = "schema" in result ? result.schema : result.form.draft_schema ?? result.form.schema;
            if (out) {
                ctx.fs.writeFileSync(out, JSON.stringify(schema, null, 2) + "\n");
                print(ctx, { ok: true, out }, output, `Wrote schema to ${out}`);
            }
            else {
                print(ctx, schema, "json");
            }
            return;
        }
        case "validate": {
            const formId = requiredArg(args[0], "form id");
            const branchId = stringFlag(flags, "branch");
            if (!branchId)
                throw new UserError("forms validate requires --branch <agent-branch-id>");
            const result = await apiRequest(ctx, "GET", `/forms/${encodeURIComponent(formId)}/agent-drafts/${encodeURIComponent(branchId)}`);
            print(ctx, result, output);
            return;
        }
        default:
            throw new UserError("Unknown forms command", {
                hint: "Run `ingress forms --help` to see forms commands.",
            });
    }
}
async function applyAgentDraftOperationsFromCli(ctx, formId, operations, flags, output) {
    const commitMessage = stringFlag(flags, "commit");
    const branchId = stringFlag(flags, "branch");
    const dryRun = agentDraftApplyDryRun(flags, commitMessage);
    const result = await apiRequest(ctx, "POST", `/forms/${encodeURIComponent(formId)}/agent-drafts/apply`, {
        branchId,
        dryRun,
        commitMessage,
        operations,
    }, idempotencyOptions(flags));
    print(ctx, result, output);
}
async function runMcp(ctx, command, flags, output) {
    if (command === "config") {
        printMcpConfig(ctx, flags, output);
        return;
    }
    if (command === "smoke") {
        await runMcpSmoke(ctx, flags, output);
        return;
    }
    if (command) {
        throw new UserError("Unknown mcp command", {
            hint: "Run `ingress mcp --help` to see MCP commands.",
        });
    }
    // MCP stdio mode must keep stdout reserved for JSON-RPC messages only.
    requireConfig(ctx);
    ctx.stdin?.setEncoding?.("utf8");
    let buffer = "";
    for await (const chunk of ctx.stdin ?? []) {
        buffer += chunk;
        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (line)
                await handleMcpLine(ctx, line);
            newlineIndex = buffer.indexOf("\n");
        }
    }
    const trailing = buffer.trim();
    if (trailing)
        await handleMcpLine(ctx, trailing);
}
async function runDoctor(ctx, output) {
    const configInfo = loadConfigInfo(ctx);
    const checks = [];
    const record = (name, ok, detail) => {
        checks.push({ name, ok, ...(detail ? { detail } : {}) });
    };
    record("config.host", Boolean(configInfo.config.host), configInfo.sources.host ?? "missing");
    record("config.apiKey", Boolean(configInfo.config.apiKey), configInfo.sources.apiKey ?? "missing");
    let capabilities = null;
    if (configInfo.config.host && configInfo.config.apiKey) {
        try {
            capabilities = await apiRequest(ctx, "GET", "/capabilities");
            record("api.capabilities", true);
        }
        catch (error) {
            record("api.capabilities", false, error instanceof Error ? error.message : String(error));
        }
        try {
            const initialized = rpcResult(await mcpJsonRpcRequest(ctx, {
                jsonrpc: "2.0",
                id: "doctor",
                method: "initialize",
                params: {
                    protocolVersion: "2025-06-18",
                    capabilities: {},
                    clientInfo: { name: "ingress-cli-doctor", version: CLI_VERSION },
                },
            }), "initialize");
            record("mcp.initialize", initialized.protocolVersion === "2025-06-18");
        }
        catch (error) {
            record("mcp.initialize", false, error instanceof Error ? error.message : String(error));
        }
    }
    const ok = checks.every((check) => check.ok);
    const result = {
        ok,
        config: {
            host: configInfo.config.host ?? null,
            apiKey: configInfo.config.apiKey ? redactSecret(configInfo.config.apiKey) : null,
            configPath: configPath(ctx),
            legacyConfigPath: ctx.legacyConfigPath,
            sources: configInfo.sources,
        },
        checks,
        capabilities,
    };
    print(ctx, result, output, checks.map((check) => `${check.ok ? "PASS" : "FAIL"} ${check.name}${check.detail ? ` - ${check.detail}` : ""}`).join("\n"));
    if (!ok)
        ctx.exitCode = 1;
}
function printMcpConfig(ctx, flags, output) {
    const transport = stringFlag(flags, "transport");
    if (transport !== "stdio" && transport !== "http") {
        throw new UserError("mcp config requires --transport stdio|http", {
            hint: "Example: ingress mcp config --transport stdio --json",
        });
    }
    const config = loadConfig(ctx);
    const host = config.host ?? PRODUCTION_HOST;
    const server = transport === "stdio"
        ? {
            command: "ingress",
            args: ["mcp"],
        }
        : {
            url: new URL("/api/mcp", normalizeHost(host)).toString(),
            headers: {
                Authorization: `Bearer ${config.apiKey ?? PLACEHOLDER_API_KEY}`,
            },
        };
    print(ctx, {
        transport,
        mcpServers: {
            "ingress-forms": server,
        },
    }, output, JSON.stringify({ mcpServers: { "ingress-forms": server } }, null, 2));
}
function parseArgs(argv) {
    const flags = {};
    const positionals = [];
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === "-h") {
            flags.h = true;
            continue;
        }
        if (arg === "-v") {
            flags.version = true;
            continue;
        }
        if (!arg.startsWith("--")) {
            positionals.push(arg);
            continue;
        }
        const eqIndex = arg.indexOf("=");
        if (eqIndex > -1) {
            flags[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
            continue;
        }
        const name = arg.slice(2);
        const next = argv[i + 1];
        if (!next || next.startsWith("--")) {
            flags[name] = true;
            continue;
        }
        flags[name] = next;
        i += 1;
    }
    return { flags, positionals };
}
function stringFlag(flags, name) {
    const value = flags[name];
    return typeof value === "string" ? value : undefined;
}
function limitFlag(flags, defaultValue, max) {
    const raw = stringFlag(flags, "limit");
    if (!raw)
        return defaultValue;
    const value = Number.parseInt(raw, 10);
    if (!Number.isInteger(value) || value < 1) {
        throw new UserError("--limit must be a positive integer");
    }
    return Math.min(value, max);
}
function queryPath(basePath, flags, names) {
    const query = new URLSearchParams();
    for (const name of names) {
        const value = stringFlag(flags, name);
        if (value)
            query.set(name, value);
    }
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
}
function idempotencyOptions(flags) {
    const key = stringFlag(flags, "idempotency-key");
    return key ? { headers: { "Idempotency-Key": key } } : undefined;
}
function requiredArg(value, label) {
    if (!value) {
        throw new UserError(`Missing ${label}`, {
            hint: `Provide <${label}> after the command, or run the command group with --help.`,
        });
    }
    return value;
}
function readJsonDocument(ctx, path) {
    if (!ctx.fs.existsSync(path)) {
        throw new UserError(`File not found: ${path}`, {
            hint: "Check the path and try again.",
        });
    }
    try {
        return JSON.parse(ctx.fs.readFileSync(path, "utf8"));
    }
    catch (error) {
        throw new UserError(`Invalid JSON in file: ${path}`, {
            hint: error instanceof Error ? error.message : "Fix the file or pass a different path.",
        });
    }
}
function readOperationsFile(ctx, path) {
    const parsed = readJsonDocument(ctx, path);
    if (Array.isArray(parsed))
        return parsed;
    if (parsed && typeof parsed === "object" && "operations" in parsed) {
        return parsed.operations;
    }
    throw new UserError("Ops file must contain a JSON array or an object with an operations array", {
        hint: "Pass --ops with a JSON array, or an object like {\"operations\": [...]}.",
    });
}
function readJsonObjectFile(ctx, path, label) {
    const parsed = readJsonDocument(ctx, path);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
    }
    throw new UserError(`${label} file must contain a JSON object`, {
        hint: `Pass --${label} with a JSON object file.`,
    });
}
function readTextFile(ctx, path) {
    if (!ctx.fs.existsSync(path)) {
        throw new UserError(`File not found: ${path}`, {
            hint: "Check the path and try again.",
        });
    }
    return ctx.fs.readFileSync(path, "utf8");
}
function enabledFlag(flags, defaultValue) {
    if (flags.enable === true && flags.disable === true) {
        throw new UserError("Use only one of --enable or --disable", {
            hint: "Choose --enable to turn it on or --disable to turn it off.",
        });
    }
    if (flags.enable === true)
        return true;
    if (flags.disable === true)
        return false;
    return defaultValue;
}
function workflowApplyDryRun(flags) {
    assertNotBoth(flags, "dry-run", "write", "Omit both to preview workflow changes.");
    return flags["dry-run"] === true || flags.write !== true;
}
function agentDraftApplyDryRun(flags, commitMessage) {
    assertNotBoth(flags, "dry-run", "write", "Omit both to preview form changes.");
    return flags["dry-run"] === true || (!commitMessage && flags.write !== true);
}
function assertNotBoth(flags, first, second, hint) {
    if (flags[first] === true && flags[second] === true) {
        throw new UserError(`Use only one of --${first} or --${second}`, { hint });
    }
}
function csvFlag(flags, name) {
    const raw = stringFlag(flags, name);
    if (!raw)
        return undefined;
    const values = raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
    return values.length > 0 ? values : undefined;
}
function print(ctx, value, output, text) {
    if (output === "json") {
        writeLine(ctx.stdout, JSON.stringify(value, null, 2));
        return;
    }
    if (text) {
        writeLine(ctx.stdout, text);
        return;
    }
    writeLine(ctx.stdout, JSON.stringify(value, null, 2));
}
function printOrWriteJson(ctx, value, flags, output, label) {
    const out = stringFlag(flags, "out");
    if (!out) {
        print(ctx, value, output);
        return;
    }
    ctx.fs.writeFileSync(out, JSON.stringify(value, null, 2) + "\n");
    print(ctx, { ok: true, out }, output, `Wrote ${label} to ${out}`);
}
const CLI_FIELD_ALIASES = {
    attempt_number: "attemptNumber",
    case_id: "caseId",
    closed_at: "closedAt",
    created_at: "createdAt",
    created_by_submission_id: "createdBySubmissionId",
    decided_at: "decidedAt",
    entry_form_id: "entryFormId",
    finished_at: "finishedAt",
    form_id: "formId",
    is_active: "isActive",
    node_id: "nodeId",
    run_id: "runId",
    started_at: "startedAt",
    submission_id: "submissionId",
    updated_at: "updatedAt",
    workflow_id: "workflowId",
    workflow_run_id: "workflowRunId",
    workspace_id: "workspaceId",
};
const CLI_FIELD_NORMALIZER_SKIP_KEYS = new Set([
    "config",
    "data",
    "definition",
    "metadata",
    "payload",
    "plan",
    "validation",
]);
function normalizeWorkflowCliResult(value) {
    return normalizeCliFields(value);
}
function normalizeCliFields(value) {
    if (Array.isArray(value))
        return value.map((item) => normalizeCliFields(item));
    if (!isRecord(value))
        return value;
    const normalized = {};
    for (const [key, rawValue] of Object.entries(value)) {
        const outputKey = CLI_FIELD_ALIASES[key] ?? key;
        const outputValue = CLI_FIELD_NORMALIZER_SKIP_KEYS.has(outputKey)
            ? rawValue
            : normalizeCliFields(rawValue);
        if (!(outputKey in normalized))
            normalized[outputKey] = outputValue;
    }
    return normalized;
}
function writeLine(writer, text) {
    writer.write(`${text}\n`);
}
function printGlobalHelp(ctx) {
    writeLine(ctx.stdout, `Ingress forms CLI

Auth:
  ingress auth login --host ${PRODUCTION_HOST} --api-key ${PLACEHOLDER_API_KEY}
  ingress auth status --json
  ingress auth logout

Capabilities:
  ingress capabilities --json
  ingress doctor --json

Analytics:
  ingress analytics report --range 30d --json
  ingress analytics report --from 2026-05-01 --to 2026-05-26 --form <form-id> --out report.json
  ingress analytics funnel <form-id> --range 7d --json

Forms:
  ingress forms list --limit 100 --cursor <cursor> --status draft --tag onboarding --q intake --json
  ingress forms create --title "Lead capture" --json
  ingress forms drafts <form-id> --status pending_changes --json
  ingress forms agent-drafts list --form <form-id> --limit 100 --cursor <cursor> --json
  ingress forms agent-timeline --form <form-id> --limit 100 --cursor <cursor> --action agent_draft.apply --json
  ingress forms branches <form-id> --limit 100 --cursor <cursor> --json
  ingress forms commits <form-id> --branch <branch-id> --limit 200 --cursor <cursor> --json
  ingress forms submissions <form-id> --limit 200 --cursor <cursor> --status new --json
  ingress forms submission-history <submission-id> --limit 100 --cursor <cursor> --json
  ingress forms workflows <form-id> --active true --json
  ingress forms workspace-workflows <workspace-id> --active true --json
  ingress forms workflow-get <form-id> <workflow-id> --json
  ingress forms workflow-create <form-id> --name "Notify team" --json
  ingress forms workflow-plan <form-id> <workflow-id> --ops workflow-ops.json --json
  ingress forms workflow-apply <form-id> <workflow-id> --ops workflow-ops.json --dry-run --json
  ingress forms workflow-apply <form-id> <workflow-id> --ops workflow-ops.json --write --idempotency-key retry-key --json
  ingress forms workflow-delete <form-id> <workflow-id> --json
  ingress forms workflow-reorder <form-id> --workflow-ids id-a,id-b --json
  ingress forms workflow-runs <form-id> <workflow-id> --limit 50 --cursor <cursor> --json
  ingress forms workflow-run <run-id> --json
  ingress forms workflow-cases <workspace-id> <workflow-id> --limit 50 --json
  ingress forms workflow-case <workspace-id> <workflow-id> <case-id> --json
  ingress forms workflow-rerun <run-id> --json
  ingress forms plan <form-id> --ops ops.json --json
  ingress forms apply <form-id> --ops ops.json --dry-run --idempotency-key retry-key --json
  ingress forms apply <form-id> --ops ops.json --write --json
  ingress forms apply <form-id> --ops ops.json --commit "Agent draft" --json
  ingress forms settings <form-id> --settings settings.json --write --json
  ingress forms theme <form-id> --theme theme.json --write --json
  ingress forms css <form-id> --css styles.css --mode append --enable --json
  ingress forms custom-js <form-id> --owner field --target email --script rule.js --watch plan --json
  ingress forms commit <form-id> --branch <branch-id> --message "Agent draft" --json
  ingress forms abandon-draft <form-id> --branch <branch-id> --reason "User rejected this direction" --json
  ingress forms export <form-id> --branch <branch-id> --out schema.json
  ingress forms validate <form-id> --branch <branch-id> --json

MCP:
  ingress mcp
  ingress mcp config --transport stdio --json
  ingress mcp config --transport http --json
  ingress mcp smoke --json

Version:
  ingress version
  ingress --version`);
}
function printHelp(ctx, domain) {
    switch (domain) {
        case "auth":
            printAuthHelp(ctx);
            return;
        case "analytics":
            printAnalyticsHelp(ctx);
            return;
        case "forms":
            printFormsHelp(ctx);
            return;
        case "mcp":
            printMcpHelp(ctx);
            return;
        default:
            printGlobalHelp(ctx);
    }
}
function printAuthHelp(ctx) {
    writeLine(ctx.stdout, `Ingress auth commands

Usage:
  ingress auth login --host <url> --api-key <key>
  ingress auth status --json
  ingress auth logout`);
}
function printAnalyticsHelp(ctx) {
    writeLine(ctx.stdout, `Ingress analytics commands

Usage:
  ingress analytics report --range 30d --json
  ingress analytics report --from 2026-05-01 --to 2026-05-26 --form <form-id> --out report.json
  ingress analytics funnel <form-id> --range 7d --json`);
}
function printFormsHelp(ctx) {
    writeLine(ctx.stdout, `Ingress forms commands

Usage:
  ingress forms list --limit 100 --cursor <cursor> --status draft --tag onboarding --q intake --json
  ingress forms get <form-id> --json
  ingress forms create --title "Lead capture" --json
  ingress forms drafts <form-id> --status pending_changes --json
  ingress forms agent-drafts list --form <form-id> --limit 100 --cursor <cursor> --json
  ingress forms agent-timeline --form <form-id> --limit 100 --cursor <cursor> --action agent_draft.apply --json
  ingress forms branches <form-id> --limit 100 --cursor <cursor> --json
  ingress forms commits <form-id> --branch <branch-id> --limit 200 --cursor <cursor> --json
  ingress forms submissions <form-id> --limit 200 --cursor <cursor> --status new --json
  ingress forms submission-history <submission-id> --limit 100 --cursor <cursor> --json
  ingress forms workflows <form-id> --active true --json
  ingress forms workspace-workflows <workspace-id> --active true --json
  ingress forms workflow-get <form-id> <workflow-id> --json
  ingress forms workflow-create <form-id> --name "Notify team" --json
  ingress forms workflow-plan <form-id> <workflow-id> --ops workflow-ops.json --json
  ingress forms workflow-apply <form-id> <workflow-id> --ops workflow-ops.json --dry-run --json
  ingress forms workflow-apply <form-id> <workflow-id> --ops workflow-ops.json --write --idempotency-key retry-key --json
  ingress forms workflow-delete <form-id> <workflow-id> --json
  ingress forms workflow-reorder <form-id> --workflow-ids id-a,id-b --json
  ingress forms workflow-runs <form-id> <workflow-id> --limit 50 --cursor <cursor> --json
  ingress forms workflow-run <run-id> --json
  ingress forms workflow-cases <workspace-id> <workflow-id> --limit 50 --json
  ingress forms workflow-case <workspace-id> <workflow-id> <case-id> --json
  ingress forms workflow-rerun <run-id> --json
  ingress forms plan <form-id> --ops ops.json --json
  ingress forms apply <form-id> --ops ops.json --dry-run --idempotency-key retry-key --json
  ingress forms apply <form-id> --ops ops.json --write --json
  ingress forms apply <form-id> --ops ops.json --commit "Agent draft" --json
  ingress forms settings <form-id> --settings settings.json --write --json
  ingress forms theme <form-id> --theme theme.json --write --json
  ingress forms css <form-id> --css styles.css --mode append --enable --json
  ingress forms custom-js <form-id> --owner field --target email --script rule.js --watch plan --json
  ingress forms commit <form-id> --branch <branch-id> --message "Agent draft" --json
  ingress forms abandon-draft <form-id> --branch <branch-id> --reason "User rejected this direction" --json
  ingress forms export <form-id> --branch <branch-id> --out schema.json
  ingress forms validate <form-id> --branch <branch-id> --json`);
}
function printMcpHelp(ctx) {
    writeLine(ctx.stdout, `Ingress MCP commands

Usage:
  ingress mcp
  ingress mcp config --transport stdio --json
  ingress mcp config --transport http --json
  ingress mcp smoke --json`);
}
function printVersion(ctx, output) {
    print(ctx, {
        name: "ingress",
        version: CLI_VERSION,
        apiVersion: ingress_version_1.INGRESS_API_VERSION,
        mcpToolsVersion: ingress_version_1.INGRESS_MCP_TOOLS_VERSION,
        compatibility: ingress_version_1.INGRESS_COMPATIBILITY,
    }, output, `ingress ${CLI_VERSION}`);
}
class UserError extends Error {
    code;
    exitCode;
    hint;
    constructor(message, options = {}) {
        super(message);
        this.code = options.code ?? "usage_error";
        this.exitCode = options.exitCode ?? 2;
        this.hint = options.hint;
    }
}
class CliHttpError extends Error {
    status;
    body;
    requestId;
    code;
    constructor(message, status, body, requestId = null) {
        super(message);
        this.status = status;
        this.body = body;
        this.requestId = requestId;
        this.code =
            body && typeof body === "object" && "code" in body
                ? String(body.code)
                : null;
    }
}
function loadConfig(ctx) {
    return loadConfigInfo(ctx).config;
}
function loadConfigInfo(ctx) {
    const fileConfig = readFileConfig(ctx);
    const envHost = nonEmptyString(ctx.env.INGRESS_FORMS_HOST);
    const envApiKey = nonEmptyString(ctx.env.INGRESS_FORMS_API_KEY);
    return {
        config: {
            host: envHost ?? fileConfig.host,
            apiKey: envApiKey ?? fileConfig.apiKey,
        },
        sources: {
            host: envHost
                ? "INGRESS_FORMS_HOST"
                : fileConfig.host
                    ? fileConfig.sourcePath
                    : undefined,
            apiKey: envApiKey
                ? "INGRESS_FORMS_API_KEY"
                : fileConfig.apiKey
                    ? fileConfig.sourcePath
                    : undefined,
        },
    };
}
function requireConfig(ctx) {
    const configInfo = loadConfigInfo(ctx);
    const config = configInfo.config;
    if (!config.host || !config.apiKey) {
        const missing = [
            config.host ? null : "host",
            config.apiKey ? null : "api key",
        ].filter(Boolean).join(" and ");
        throw new UserError(`Missing CLI ${missing}`, {
            code: "not_authenticated",
            exitCode: 3,
            hint: "Run `ingress auth login --host <url> --api-key <key>`, or set INGRESS_FORMS_HOST and INGRESS_FORMS_API_KEY.",
        });
    }
    return config;
}
function saveConfig(ctx, config) {
    ctx.fs.mkdirSync((0, node_path_1.dirname)(ctx.configPath), { recursive: true });
    ctx.fs.writeFileSync(ctx.configPath, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
}
function clearConfig(ctx) {
    for (const path of configRemovalPaths(ctx)) {
        if (ctx.fs.existsSync(path))
            ctx.fs.rmSync(path);
    }
}
function configPath(ctx) {
    return ctx.configPath;
}
function readFileConfig(ctx) {
    for (const path of configReadCandidatePaths(ctx)) {
        if (!ctx.fs.existsSync(path))
            continue;
        try {
            const parsed = JSON.parse(ctx.fs.readFileSync(path, "utf8"));
            return {
                host: nonEmptyString(parsed.host),
                apiKey: nonEmptyString(parsed.apiKey),
                sourcePath: path,
            };
        }
        catch {
            return { sourcePath: path };
        }
    }
    return {};
}
function resolveConfigPath(env, homeDir) {
    if (env.INGRESS_CONFIG)
        return env.INGRESS_CONFIG;
    if (env.XDG_CONFIG_HOME) {
        return (0, node_path_1.resolve)(env.XDG_CONFIG_HOME, "ingress", "config.json");
    }
    return (0, node_path_1.resolve)(homeDir, ".config", "ingress", "config.json");
}
function configReadCandidatePaths(ctx) {
    if (hasExplicitConfigPath(ctx))
        return [ctx.configPath];
    if (ctx.configPath === ctx.legacyConfigPath)
        return [ctx.configPath];
    if (hasEnvCredential(ctx))
        return [ctx.configPath];
    return [ctx.configPath, ctx.legacyConfigPath];
}
function configRemovalPaths(ctx) {
    if (hasExplicitConfigPath(ctx))
        return [ctx.configPath];
    if (ctx.configPath === ctx.legacyConfigPath)
        return [ctx.configPath];
    return [ctx.configPath, ctx.legacyConfigPath];
}
function hasExplicitConfigPath(ctx) {
    return Boolean(ctx.env.INGRESS_CONFIG?.trim());
}
function hasEnvCredential(ctx) {
    return Boolean(ctx.env.INGRESS_FORMS_HOST?.trim() || ctx.env.INGRESS_FORMS_API_KEY?.trim());
}
function nonEmptyString(value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function redactSecret(value) {
    if (value.length <= 10)
        return "***";
    return `${value.slice(0, 7)}...${value.slice(-4)}`;
}
async function apiRequest(ctx, method, path, body, options = {}) {
    const config = requireConfig(ctx);
    const url = new URL(path.startsWith("/api/") ? path : `/api${path}`, normalizeHost(config.host));
    let response;
    try {
        response = await ctx.fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
                "User-Agent": CLI_USER_AGENT,
                "X-Ingress-API-Version": ingress_version_1.INGRESS_API_VERSION,
                "X-Ingress-CLI-Version": CLI_VERSION,
                ...(options.headers ?? {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    }
    catch (error) {
        throw new CliHttpError(connectionFailureMessage(url, error), 0, {
            code: "network_error",
            cause: errorMessage(error),
            host: url.origin,
        });
    }
    const text = await response.text();
    const parsed = text ? parseJson(text) : null;
    if (!response.ok) {
        throw new CliHttpError(httpErrorMessage(url, response.status, parsed), response.status, compactErrorBody(parsed, response.headers.get("content-type")), response.headers.get("x-request-id"));
    }
    return parsed;
}
async function runMcpSmoke(ctx, flags, output) {
    const config = requireConfig(ctx);
    if (!isLocalHost(config.host) && flags["allow-remote"] !== true) {
        throw new UserError("mcp smoke creates a test form and only runs against localhost by default", {
            hint: "Pass --allow-remote to run against a remote host.",
        });
    }
    const title = stringFlag(flags, "title") ?? `MCP smoke ${new Date().toISOString()}`;
    const checks = [];
    const initialized = rpcResult(await mcpJsonRpcRequest(ctx, {
        jsonrpc: "2.0",
        id: "initialize",
        method: "initialize",
        params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "ingress-cli-smoke", version: CLI_VERSION },
        },
    }), "initialize");
    const serverInfo = initialized.serverInfo;
    const experimental = initialized.experimental;
    const ingressCompatibility = isRecord(experimental)
        ? experimental.ingress
        : null;
    if (!isRecord(serverInfo) || serverInfo.version !== CLI_VERSION) {
        throw new UserError("MCP initialize did not return the expected server version");
    }
    if (!isRecord(ingressCompatibility) ||
        ingressCompatibility.apiVersion !== ingress_version_1.INGRESS_API_VERSION ||
        ingressCompatibility.mcpToolsVersion !== ingress_version_1.INGRESS_MCP_TOOLS_VERSION) {
        throw new UserError("MCP initialize did not return Ingress compatibility metadata");
    }
    checks.push("initialize");
    const toolsResult = rpcResult(await mcpJsonRpcRequest(ctx, { jsonrpc: "2.0", id: "tools", method: "tools/list" }), "tools/list");
    const toolNames = Array.isArray(toolsResult.tools)
        ? toolsResult.tools
            .map((tool) => (isRecord(tool) && typeof tool.name === "string" ? tool.name : null))
            .filter((name) => !!name)
        : [];
    for (const required of [
        "ingress_whoami",
        "ingress_get_capabilities",
        "ingress_create_form",
        "ingress_list_agent_drafts",
        "ingress_list_agent_timeline",
        "ingress_plan_agent_draft",
        "ingress_apply_agent_draft",
        "ingress_abandon_agent_draft",
    ]) {
        if (!toolNames.includes(required)) {
            throw new UserError(`MCP tools/list did not include ${required}`);
        }
    }
    checks.push("tools/list");
    const resourcesResult = rpcResult(await mcpJsonRpcRequest(ctx, { jsonrpc: "2.0", id: "resources", method: "resources/list" }), "resources/list");
    const resourceUris = Array.isArray(resourcesResult.resources)
        ? resourcesResult.resources
            .map((resource) => (isRecord(resource) && typeof resource.uri === "string" ? resource.uri : null))
            .filter((uri) => !!uri)
        : [];
    if (!resourceUris.includes("ingress://specs/mcp-tools")) {
        throw new UserError("MCP resources/list did not include ingress://specs/mcp-tools");
    }
    checks.push("resources/list");
    toolStructuredContent(await mcpJsonRpcRequest(ctx, {
        jsonrpc: "2.0",
        id: "whoami",
        method: "tools/call",
        params: { name: "ingress_whoami", arguments: {} },
    }), "ingress_whoami");
    checks.push("ingress_whoami");
    toolStructuredContent(await mcpJsonRpcRequest(ctx, {
        jsonrpc: "2.0",
        id: "capabilities",
        method: "tools/call",
        params: { name: "ingress_get_capabilities", arguments: {} },
    }), "ingress_get_capabilities");
    checks.push("ingress_get_capabilities");
    const created = toolStructuredContent(await mcpJsonRpcRequest(ctx, {
        jsonrpc: "2.0",
        id: "create",
        method: "tools/call",
        params: {
            name: "ingress_create_form",
            arguments: { title },
        },
    }), "ingress_create_form");
    const form = created.form;
    if (!isRecord(form) || typeof form.id !== "string") {
        throw new UserError("ingress_create_form did not return a form id");
    }
    checks.push("ingress_create_form");
    const planned = toolStructuredContent(await mcpJsonRpcRequest(ctx, {
        jsonrpc: "2.0",
        id: "plan",
        method: "tools/call",
        params: {
            name: "ingress_plan_agent_draft",
            arguments: {
                formId: form.id,
                operations: [
                    {
                        op: "set_success_message",
                        message: "MCP smoke validation succeeded.",
                    },
                ],
            },
        },
    }), "ingress_plan_agent_draft");
    if (planned.dryRun !== true) {
        throw new UserError("ingress_plan_agent_draft did not return a dry-run plan");
    }
    checks.push("ingress_plan_agent_draft");
    toolStructuredContent(await mcpJsonRpcRequest(ctx, {
        jsonrpc: "2.0",
        id: "apply-dry-run",
        method: "tools/call",
        params: {
            name: "ingress_apply_agent_draft",
            arguments: {
                formId: form.id,
                dryRun: true,
                operations: [
                    {
                        op: "set_success_message",
                        message: "MCP smoke validation succeeded.",
                    },
                ],
            },
        },
    }), "ingress_apply_agent_draft");
    checks.push("ingress_apply_agent_draft");
    print(ctx, {
        ok: true,
        host: config.host,
        formId: form.id,
        title,
        checks,
    }, output, `MCP smoke passed. Created test form ${form.id}.`);
}
async function handleMcpLine(ctx, line) {
    let id = null;
    let parsed;
    try {
        parsed = JSON.parse(line);
        id = getJsonRpcId(parsed);
    }
    catch {
        writeJsonRpc(ctx, mcpError(null, -32700, "Parse error"));
        return;
    }
    try {
        const responseText = await mcpProxyRequest(ctx, line);
        if (!responseText)
            return;
        const response = parseJson(responseText);
        if (isJsonRpcResponse(response)) {
            writeJsonRpc(ctx, response);
            return;
        }
        const message = response && typeof response === "object" && "error" in response
            ? String(response.error)
            : "MCP endpoint returned a non-JSON-RPC response";
        writeJsonRpc(ctx, mcpError(id, -32603, message, response));
    }
    catch (error) {
        writeJsonRpc(ctx, mcpError(id, -32603, error instanceof Error ? error.message : "MCP request failed"));
    }
}
async function mcpProxyRequest(ctx, rawLine) {
    const config = requireConfig(ctx);
    const url = new URL("/api/mcp", normalizeHost(config.host));
    let response;
    try {
        response = await ctx.fetch(url, {
            method: "POST",
            headers: {
                Accept: "application/json, text/event-stream",
                Authorization: `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
                "MCP-Protocol-Version": "2025-06-18",
                "User-Agent": `${CLI_USER_AGENT} mcp-stdio`,
                "X-Ingress-API-Version": ingress_version_1.INGRESS_API_VERSION,
                "X-Ingress-CLI-Version": CLI_VERSION,
            },
            body: rawLine,
        });
    }
    catch (error) {
        throw new CliHttpError(connectionFailureMessage(url, error), 0, {
            code: "network_error",
            cause: errorMessage(error),
            host: url.origin,
        });
    }
    const text = await response.text();
    if (response.status === 202 || response.status === 204)
        return null;
    if (!response.ok && !text) {
        throw new CliHttpError(`MCP request failed with status ${response.status}`, response.status, null);
    }
    return text || null;
}
async function mcpJsonRpcRequest(ctx, message) {
    const responseText = await mcpProxyRequest(ctx, JSON.stringify(message));
    if (!responseText)
        throw new UserError("MCP request produced no response");
    const response = parseJson(responseText);
    if (!isJsonRpcResponse(response)) {
        throw new UserError("MCP endpoint returned a non-JSON-RPC response");
    }
    return response;
}
function normalizeHost(host) {
    return host.endsWith("/") ? host : `${host}/`;
}
function connectionFailureMessage(url, error) {
    const hint = isLocalHost(url.origin)
        ? "Start the local app with `pnpm dev`, or update the CLI host with `ingress auth login --host <url> --api-key <key>`."
        : "Check the CLI host with `ingress auth status`, or update it with `ingress auth login --host <url> --api-key <key>`.";
    return `Could not reach Ingress API at ${url.origin}${url.pathname}. ${hint} Cause: ${errorMessage(error)}`;
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function parseJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
function httpErrorMessage(url, status, body) {
    if (isRecord(body) && "error" in body) {
        return String(body.error);
    }
    if (status === 404 && url.pathname === "/api/capabilities") {
        return `The server at ${url.origin} does not expose /api/capabilities. Deploy the Ingress API ${ingress_version_1.INGRESS_API_VERSION} server changes to that host, or use a CLI version that matches the deployed server.`;
    }
    if (status === 404 && typeof body === "string" && looksLikeHtml(body)) {
        return `API route not found at ${url.origin}${url.pathname}`;
    }
    return `Request failed with status ${status}`;
}
function compactErrorBody(body, contentType) {
    if (typeof body !== "string")
        return body;
    if (looksLikeHtml(body)) {
        return {
            contentType,
            preview: textPreview(htmlToText(body), 500),
        };
    }
    return textPreview(body, 1000);
}
function looksLikeHtml(value) {
    return /^\s*(?:<!doctype html|<html|<head|<body)\b/i.test(value);
}
function htmlToText(value) {
    return value
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function textPreview(value, maxLength) {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}
function isLocalHost(host) {
    try {
        const parsed = new URL(normalizeHost(host));
        return ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    }
    catch {
        return false;
    }
}
function getJsonRpcId(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return null;
    const id = value.id;
    return typeof id === "string" || typeof id === "number" || id === null ? id : null;
}
function isJsonRpcResponse(value) {
    return (!!value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        value.jsonrpc === "2.0" &&
        ("result" in value || "error" in value));
}
function rpcResult(response, label) {
    if ("error" in response) {
        throw new UserError(`MCP ${label} failed: ${JSON.stringify(response.error)}`);
    }
    if (!("result" in response) || !isRecord(response.result)) {
        throw new UserError(`MCP ${label} did not return an object result`);
    }
    return response.result;
}
function toolStructuredContent(response, label) {
    const result = rpcResult(response, label);
    if (result.isError === true) {
        throw new UserError(`MCP ${label} returned a tool error: ${JSON.stringify(result.structuredContent)}`);
    }
    if (!isRecord(result.structuredContent)) {
        throw new UserError(`MCP ${label} did not return structured content`);
    }
    return result.structuredContent;
}
function isRecord(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function mcpError(id, code, message, data) {
    return {
        jsonrpc: "2.0",
        id,
        error: data === undefined ? { code, message } : { code, message, data },
    };
}
function writeJsonRpc(ctx, value) {
    ctx.stdout.write(`${JSON.stringify(value)}\n`);
}
function handleCliError(ctx, error, output) {
    if (error instanceof UserError) {
        writeCliError(ctx, output, {
            error: error.message,
            code: error.code,
            exitCode: error.exitCode,
            requestId: null,
        }, error.hint);
        return error.exitCode;
    }
    if (error instanceof CliHttpError) {
        const exitCode = httpExitCode(error.status);
        writeCliError(ctx, output, {
            error: error.message,
            status: error.status,
            code: error.code,
            requestId: error.requestId,
            body: error.body,
            exitCode,
        });
        return exitCode;
    }
    writeCliError(ctx, output, {
        error: error instanceof Error ? error.message : String(error),
        code: "internal_error",
        exitCode: 1,
        requestId: null,
    });
    return 1;
}
function writeCliError(ctx, output, payload, hint) {
    if (output === "json") {
        writeLine(ctx.stderr, JSON.stringify(payload, null, 2));
        return;
    }
    writeLine(ctx.stderr, `Error: ${payload.error}`);
    if (hint)
        writeLine(ctx.stderr, `Hint: ${hint}`);
}
function httpExitCode(status) {
    if (status === 401)
        return 3;
    if (status === 403)
        return 4;
    return 5;
}
