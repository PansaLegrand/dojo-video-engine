// Playground end-to-end test: drives the real UI in headless Chromium —
// player controls, scene switching (including the audio and lottie scenes),
// and the agent console's patch/validate loop.
//
// Run: pnpm e2e   (or: pnpm --filter @motionforge/golden run e2e)

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const checks: Array<{ label: string; pass: boolean; detail?: string }> = [];

function check(label: string, pass: boolean, detail?: string): void {
  checks.push({ label, pass, detail });
  console.log(
    `${pass ? "ok " : "not ok"} ${label}${detail ? ` (${detail})` : ""}`,
  );
}

async function waitForCanvasPaint(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas");
    const context = canvas?.getContext("2d");
    return (
      !!context &&
      context.getImageData(canvas!.width / 2, canvas!.height / 2, 1, 1)
        .data[3] !== 0
    );
  });
}

async function waitForSceneLoaded(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (document.querySelector("#export-status") as HTMLOutputElement)?.value ===
      "",
  );
}

const readFrame = async (page: Page): Promise<number> =>
  Number(await page.locator("#frame-readout").textContent());

const server: ViteDevServer = await createServer({
  root: resolve(rootDir, "apps/playground"),
  logLevel: "error",
  resolve: {
    alias: {
      "@motionforge/schema/values": resolve(
        rootDir,
        "packages/schema/src/values.ts",
      ),
      ...Object.fromEntries(
        [
          "schema",
          "core",
          "presets",
          "showcase",
          "renderer-canvas2d",
          "export",
          "player",
        ].map((name) => [
          `@motionforge/${name}`,
          resolve(rootDir, `packages/${name}/src/index.ts`),
        ]),
      ),
    },
  },
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});

let browser: Browser | undefined;

try {
  await server.listen();
  const url = server.resolvedUrls?.local[0];

  if (!url) {
    throw new Error("Playground dev server did not expose a local URL.");
  }

  browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage();
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  page.on(
    "console",
    (message) =>
      message.type() === "error" && consoleErrors.push(message.text()),
  );

  await page.goto(url, { waitUntil: "load" });
  await waitForCanvasPaint(page);
  check("playground loads and paints the poster frame", true);

  // --- player controls -----------------------------------------------------
  const poster = await readFrame(page);
  await page.click("#play");
  await page.waitForTimeout(700);
  const during = await readFrame(page);
  check("play advances frames", during !== poster, `${poster} -> ${during}`);

  await page.click("#play");
  const paused = await readFrame(page);
  await page.waitForTimeout(400);
  check("pause freezes the frame", (await readFrame(page)) === paused);

  await page.fill("#frame", "5");
  await page.waitForTimeout(200);
  check("slider seeks", (await readFrame(page)) === 5);

  // --- agent console -------------------------------------------------------
  await page.fill(
    "#agent-input",
    JSON.stringify([
      { op: "setStyle", id: "subtitel", style: { opacity: 0.5 } },
    ]),
  );
  await page.click("#agent-apply");
  const hint = (await page.locator("#agent-output").textContent()) ?? "";
  check(
    "misspelled patch id gets a closest-id suggestion",
    hint.includes('No node with id "subtitel"') && hint.includes('"subtitle"'),
  );

  await page.fill(
    "#agent-input",
    JSON.stringify([
      { op: "setText", id: "subtitle", text: "PATCHED BY E2E" },
      {
        op: "setStyle",
        id: "background",
        style: { background: "#ff0000", backgroundColor: null },
      },
    ]),
  );
  await page.click("#agent-apply");
  await page.waitForFunction(() =>
    document
      .querySelector("#agent-output")
      ?.textContent?.includes("patch applied"),
  );
  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas")!;
    const pixel = canvas.getContext("2d")!.getImageData(5, 5, 1, 1).data;
    return pixel[0]! > 200 && pixel[1]! < 80;
  });
  check("valid patch applies and repaints (pixel-verified)", true);

  // --- audio scene ----------------------------------------------------------
  await page.selectOption("#scene", "audio-sync-pulse");
  await waitForSceneLoaded(page);
  await page.click("#play");
  await page.waitForTimeout(600);
  const audioFrame = await readFrame(page);
  check(
    "audio scene plays with WebAudio attached",
    audioFrame > 3,
    `frame ${audioFrame}`,
  );
  await page.click("#play");

  // --- lottie scene ---------------------------------------------------------
  await page.selectOption("#scene", "lottie-sticker");
  await waitForSceneLoaded(page);
  await page.waitForFunction(() => {
    // the gold star must be on screen: scan a center row for a warm pixel
    const canvas = document.querySelector("canvas")!;
    const row = canvas
      .getContext("2d")!
      .getImageData(0, Math.floor(canvas.height * 0.42), canvas.width, 1).data;
    for (let x = 0; x < row.length; x += 4) {
      if (row[x]! > 200 && row[x + 1]! > 150 && row[x + 2]! < 140) {
        return true;
      }
    }
    return false;
  });
  check("lottie scene loads and draws the vector star", true);

  await page.click("#play");
  await page.waitForTimeout(500);
  check("lottie scene plays", (await readFrame(page)) > 3);

  check(
    "no console errors across the run",
    consoleErrors.length === 0,
    consoleErrors.slice(0, 2).join("; ") || undefined,
  );
} finally {
  await browser?.close();
  await server.close();
}

const failed = checks.filter((entry) => !entry.pass);

if (failed.length > 0) {
  console.error(`\n${failed.length}/${checks.length} E2E checks failed`);
  process.exit(1);
}

console.log(`\nall ${checks.length} E2E checks passed`);
