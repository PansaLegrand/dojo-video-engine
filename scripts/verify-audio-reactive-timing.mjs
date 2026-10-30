import { createRequire } from "node:module";
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  rm,
  access,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(repo, "tools/golden/package.json"));
const { createServer } = await import(require.resolve("vite"));
const { chromium } = require("playwright");
const argumentsList = process.argv.slice(2);
const outputIndex = argumentsList.indexOf("--output-dir");
if (outputIndex >= 0 && !argumentsList[outputIndex + 1])
  throw new Error("--output-dir requires a path");
const outputDirectory = path.resolve(
  outputIndex >= 0
    ? argumentsList[outputIndex + 1]
    : path.join(os.tmpdir(), "dojo-video-engine-audio-reactive-proof"),
);
await mkdir(outputDirectory, { recursive: true });
const fixtureDirectory = await mkdtemp(
  path.join(os.tmpdir(), "dojo-video-engine-audio-reactive-"),
);
const config = JSON.parse(
  await readFile(path.join(repo, "tsconfig.base.json"), "utf8"),
);
const aliases = Object.entries(config.compilerOptions.paths)
  .map(([find, values]) => ({ find, replacement: path.join(repo, values[0]) }))
  .sort((a, b) => b.find.length - a.find.length);
await writeFile(
  path.join(fixtureDirectory, "index.html"),
  '<canvas width="320" height="180"></canvas><script type="module" src="/main.ts"></script>',
);
await writeFile(
  path.join(fixtureDirectory, "main.ts"),
  `
import { parseScene } from '@dojo-video-engine/schema';
import { resolveAssets, disposeAssetsAsync, renderStill } from '@dojo-video-engine/renderer-canvas2d';
import { exportVideo } from '@dojo-video-engine/export';
function sourceWav() {
  const rate=48000, buffer=new ArrayBuffer(44+rate*4*2), view=new DataView(buffer);
  const text=(offset,value)=>[...value].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  text(0,'RIFF');view.setUint32(4,buffer.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,rate*4*2,true);
  for(let i=0;i<rate*4;i++){const time=i/rate;const audible=(time>=1&&time<2)||(time>=3&&time<4);view.setInt16(44+i*2,audible?Math.sin(i*2*Math.PI*440/rate)*12000:0,true);}
  return URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));
}
window.runAudioReactiveTiming = async () => {
  const source=sourceWav(), canvas=document.querySelector('canvas'), context=canvas.getContext('2d',{willReadFrequently:true});
  const scene=(offset=0,rate=1,from=0)=>parseScene({schemaVersion:1,width:320,height:180,fps:30,duration:from+30,assets:{music:{id:'music',type:'audio',src:source}},nodes:[{id:'bars',type:'effect',effect:'spectrumBars',from,duration:30,style:{width:320,height:180},params:{audioAssetId:'music',audioStartTime:offset,audioPlaybackRate:rate,barCount:16,smoothing:false}}]});
  async function inspect(input,frame){const assets=await resolveAssets(input);try{renderStill(context,input,frame,{assets});const rgba=context.getImageData(0,0,320,180).data;let energy=0,hash=2166136261;for(let i=0;i<rgba.length;i++){hash=Math.imul(hash^rgba[i],16777619)>>>0;if(i%4!==3)energy+=rgba[i];}const spectrum=assets.audioSpectra.get('music');return {energy,hash,startTime:spectrum.startTime,duration:spectrum.duration};}finally{await disposeAssetsAsync(assets);}}
  try {
    const silent=await inspect(scene(),15);
    const late=await inspect(scene(3),15);
    const retimed=await inspect(scene(1,2),18);
    const natural=await inspect(scene(1),18);
    const reference=await inspect(scene(2.2),0);
    const moved=await inspect(scene(3,1,30),45);
    const exhausted=await inspect(scene(10),0);
    const exported=await exportVideo({scene:scene(3),codecs:['avc'],verification:'sampled'});
    return {silent,late,retimed,natural,reference,moved,exhausted,export:{bytes:exported.blob.size,verification:exported.verification}};
  } finally {URL.revokeObjectURL(source);}
};
`,
);
const server = await createServer({
  root: fixtureDirectory,
  configFile: false,
  logLevel: "error",
  resolve: { alias: aliases },
  server: {
    host: "127.0.0.1",
    port: 0,
    fs: { allow: [fixtureDirectory, repo] },
  },
});
const defaultChrome =
  process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined;
const executablePath =
  process.env.CHROME_PATH ??
  (defaultChrome &&
    (await access(defaultChrome).then(
      () => defaultChrome,
      () => undefined,
    )));
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
  await page.waitForFunction(
    () => typeof window.runAudioReactiveTiming === "function",
  );
  const result = await page.evaluate(() => window.runAudioReactiveTiming());
  const files = [
    "packages/schema/src/index.ts",
    "packages/renderer-canvas2d/src/index.ts",
    "packages/renderer-canvas2d/src/audio-reactive.ts",
  ];
  const sourceHashes = Object.fromEntries(
    await Promise.all(
      files.map(async (file) => [
        file,
        createHash("sha256")
          .update(await readFile(path.join(repo, file)))
          .digest("hex"),
      ]),
    ),
  );
  const checks = {
    lateTrimUsesSourceWindow:
      result.late.energy > result.silent.energy * 1.2 &&
      result.late.startTime > 2.9 &&
      result.late.duration < 1.2,
    rateSelectsDifferentSourceTime:
      result.natural.energy > result.retimed.energy * 1.2,
    equalSourceTimeEqualPixels: result.retimed.hash === result.reference.hash,
    movingEffectKeepsSourceTime: result.late.hash === result.moved.hash,
    pastSourceEndIsSilent: result.exhausted.hash === result.silent.hash,
    sampledExportVerified: result.export.verification.status === "verified",
  };
  const report = {
    timestamp: new Date().toISOString(),
    browser: browser.version(),
    sourceHashes,
    checks,
    ...result,
  };
  await writeFile(
    path.join(outputDirectory, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  await page.screenshot({ path: path.join(outputDirectory, "preview.png") });
  console.log(
    JSON.stringify(
      { report: path.join(outputDirectory, "report.json"), checks },
      null,
      2,
    ),
  );
  if (Object.values(checks).some((value) => !value))
    throw new Error("Audio-reactive timing verification failed");
} finally {
  await browser?.close();
  await server.close();
  await rm(fixtureDirectory, { recursive: true, force: true });
}
