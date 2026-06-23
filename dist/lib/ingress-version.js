"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INGRESS_COMPATIBILITY = exports.INGRESS_MIN_CLI_VERSION = exports.INGRESS_MCP_TOOLS_VERSION = exports.INGRESS_API_VERSION = exports.INGRESS_RELEASE_VERSION = void 0;
exports.getCliCompatibilityError = getCliCompatibilityError;
exports.INGRESS_RELEASE_VERSION = "0.2.3";
exports.INGRESS_API_VERSION = "2026-05-26";
exports.INGRESS_MCP_TOOLS_VERSION = "0.7";
exports.INGRESS_MIN_CLI_VERSION = "0.1.0";
exports.INGRESS_COMPATIBILITY = {
    releaseVersion: exports.INGRESS_RELEASE_VERSION,
    apiVersion: exports.INGRESS_API_VERSION,
    mcpToolsVersion: exports.INGRESS_MCP_TOOLS_VERSION,
    minCliVersion: exports.INGRESS_MIN_CLI_VERSION,
};
function getCliCompatibilityError(cliVersion) {
    if (!cliVersion)
        return null;
    if (compareSemver(cliVersion, exports.INGRESS_MIN_CLI_VERSION) >= 0)
        return null;
    return {
        error: "Unsupported CLI version",
        minCliVersion: exports.INGRESS_MIN_CLI_VERSION,
        cliVersion,
    };
}
function compareSemver(left, right) {
    const leftParts = parseSemver(left);
    const rightParts = parseSemver(right);
    for (let index = 0; index < 3; index += 1) {
        const delta = leftParts[index] - rightParts[index];
        if (delta !== 0)
            return delta;
    }
    return 0;
}
function parseSemver(value) {
    const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)/);
    if (!match)
        return [0, 0, 0];
    return [
        Number.parseInt(match[1], 10),
        Number.parseInt(match[2], 10),
        Number.parseInt(match[3], 10),
    ];
}
