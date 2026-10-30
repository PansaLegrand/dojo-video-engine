import { createRequire } from "node:module";
import {
  readFile,
  writeFile,
  mkdir,
  mkdtemp,
  rm,
  access,
  realpath,
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
    : path.join(os.tmpdir(), "dojo-video-engine-audio-intent-proof"),
);
await mkdir(outputDirectory, { recursive: true });
const fixtureDirectory = await mkdtemp(
  path.join(os.tmpdir(), "dojo-video-engine-audio-intent-"),
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
  path.join(fixtureDirectory, "worker.ts"),
  `import { installExportWorker } from '/@fs/${repo}/packages/export/src/worker.ts'; installExportWorker(self);`,
);
await writeFile(
  path.join(fixtureDirectory, "main.ts"),
  `
import { parseScene } from '@dojo-video-engine/schema';
import { exportVideo } from '@dojo-video-engine/export';
import { ExportWorkerClient } from '/@fs/${repo}/packages/export/src/worker.ts';
function sourceWav(silent=false){const rate=48000,buffer=new ArrayBuffer(44+rate*2),v=new DataView(buffer);const text=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));text(0,'RIFF');v.setUint32(4,buffer.byteLength-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,rate*2,true);for(let i=0;i<rate;i++)v.setInt16(44+i*2,silent?0:Math.sin(i*2*Math.PI*440/rate)*12000,true);return URL.createObjectURL(new Blob([buffer],{type:'audio/wav'}));}
window.runAudioIntent = async () => {
 const tone=sourceWav(),silence=sourceWav(true);const urls=[tone,silence];
 const make=(src=tone,patch={},audioBuses)=>parseScene({schemaVersion:1,width:320,height:180,fps:30,duration:30,assets:{sound:{id:'sound',type:'audio',src}},nodes:[{id:'bg',type:'div',style:{width:320,height:180,backgroundColor:'#ff6600'}},{id:'sound',type:'audio',assetId:'sound',duration:30,...patch}],audioBuses});
 const render=async(scene,options={})=>{const result=await exportVideo({scene,verification:'sampled',codecs:['avc'],...options});return {blob:result.blob,verification:result.verification,audioCodec:result.audioCodec};};
 const summarize=result=>({bytes:result.blob.size,audioCodec:result.audioCodec,verification:result.verification});
 const reject=async(scene,options)=>{try{await render(scene,options);return null;}catch(error){return error.verification?.issues?.map(issue=>issue.code)??[error.message];}};
 try{
  const audible=await render(make(),{requireAudibleAudio:true});
  const videoUrl=URL.createObjectURL(audible.blob);urls.push(videoUrl);
  const video=parseScene({schemaVersion:1,width:320,height:180,fps:30,duration:30,assets:{video:{id:'video',type:'video',src:videoUrl,metadata:{hasAudio:true}}},nodes:[{id:'video',type:'video',assetId:'video',duration:30,volume:0,style:{width:320,height:180}}]});
  const results={audible:summarize(audible)};
  const track=make();track.nodes[1]={id:'muted-track',type:'div',duration:30,children:[{id:'a',type:'audio',assetId:'sound',duration:30,volume:0},{id:'b',type:'audio',assetId:'sound',duration:30,volume:0}]};
  const cases={nodeMute:make(tone,{volume:0}),trackMute:parseScene(track),busMute:make(tone,{audioBus:'music'},{music:{gain:0}}),masterMute:make(tone,{audioBus:'music'},{music:{gain:1},master:{gain:0}}),envelopeMute:make(tone,{volumeEnvelope:[{frame:0,value:0},{frame:29,value:0}]}),silentSource:make(silence),videoMute:video};
  for(const [name,scene] of Object.entries(cases))results[name]=summarize(await render(scene));
  const worker=new Worker(new URL('/worker.ts',import.meta.url),{type:'module'});try{results.workerMute=summarize(await new ExportWorkerClient(worker).export(video,{verification:'sampled',codecs:['avc']}).result);}finally{worker.terminate();}
  const strictSilent=await reject(make(silence),{requireAudibleAudio:true});
  const strictContainerSilent=await reject(make(silence),{requireAudibleAudio:true,verification:'container'});
  const noAudio=parseScene({schemaVersion:1,width:320,height:180,fps:30,duration:30,assets:{},nodes:[{id:'bg',type:'div',style:{width:320,height:180,backgroundColor:'#00bb66'}}]});
  const strictMissingTrack=await reject(noAudio,{requireAudibleAudio:true});
  return {results,strictSilent,strictContainerSilent,strictMissingTrack};
 }finally{urls.forEach(url=>URL.revokeObjectURL(url));}
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
    fs: { allow: [fixtureDirectory, await realpath(fixtureDirectory), repo] },
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
  await page.waitForFunction(() => typeof window.runAudioIntent === "function");
  const result = await page.evaluate(() => window.runAudioIntent());
  const files = [
    "packages/export/src/index.ts",
    "packages/export/src/verification.ts",
    "packages/export/src/worker.ts",
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
  const checks = {};
  for (const [name, value] of Object.entries(result.results)) {
    const get = (id) =>
      value.verification.checks.find((check) => check.id === id);
    checks[name] =
      value.verification.status === "verified" &&
      [
        "audio_track_presence_match",
        "audio_video_sync",
        "audio_samples_decoded",
      ].every((id) => get(id)?.status === "passed") &&
      (name === "audible"
        ? get("audio_audible")?.status === "passed"
        : get("audio_audible")?.status === "skipped" &&
          get("audio_audible")?.actual === false);
  }
  checks.strictSilentRejected = result.strictSilent?.includes(
    "audio_samples_silent",
  );
  checks.strictContainerSilentRejected = result.strictContainerSilent?.includes(
    "audio_samples_silent",
  );
  checks.strictMissingTrackRejected = result.strictMissingTrack?.includes(
    "audio_track_presence_mismatch",
  );
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
    throw new Error("Audio intent verification failed");
} finally {
  await browser?.close();
  await server.close();
  await rm(fixtureDirectory, { recursive: true, force: true });
}
