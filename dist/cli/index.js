#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./app");
(0, app_1.runCli)(process.argv.slice(2), (0, app_1.createNodeCliDeps)())
    .then((exitCode) => {
    process.exitCode = exitCode;
})
    .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});
