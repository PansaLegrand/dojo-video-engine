import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import {
  createMotionforgeMcpAdapter,
  jsonRpcParseError,
  type MotionforgeMcpAdapter,
} from "./index.js";

export async function runMotionforgeMcpStdio(
  adapter: MotionforgeMcpAdapter = createMotionforgeMcpAdapter(),
): Promise<void> {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      let input: unknown;
      try {
        input = JSON.parse(line);
      } catch {
        process.stdout.write(`${JSON.stringify(jsonRpcParseError())}\n`);
        continue;
      }
      const response = await adapter.handle(input);
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  } finally {
    await adapter.dispose();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void runMotionforgeMcpStdio().catch((error) => {
    process.stderr.write(
      `MotionForge MCP stdio failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
