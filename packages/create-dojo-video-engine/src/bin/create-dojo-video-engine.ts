#!/usr/bin/env node
import { runCreateDojoVideoEngineCli } from "../index.js";

process.exitCode = await runCreateDojoVideoEngineCli(process.argv.slice(2));
