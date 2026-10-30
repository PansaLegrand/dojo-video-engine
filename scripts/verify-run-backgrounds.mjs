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
    : path.join(os.tmpdir(), "dojo-video-engine-run-backgrounds-proof"),
);
await mkdir(outputDirectory, { recursive: true });
const fixtureDirectory = await mkdtemp(
  path.join(os.tmpdir(), "dojo-video-engine-run-backgrounds-"),
);
const config = JSON.parse(
  await readFile(path.join(repo, "tsconfig.base.json"), "utf8"),
);
const aliases = Object.entries(config.compilerOptions.paths)
  .map(([find, values]) => ({ find, replacement: path.join(repo, values[0]) }))
  .sort((a, b) => b.find.length - a.find.length);
aliases.push({
  find: "mediabunny",
  replacement: path.resolve(
    path.dirname(require.resolve("mediabunny")),
    "../modules/src/index.js",
  ),
});
await writeFile(
  path.join(fixtureDirectory, "index.html"),
  '<canvas width="320" height="180"></canvas><script type="module" src="/main.ts"></script>',
);
await writeFile(
  path.join(fixtureDirectory, "main.ts"),
  `
import { parseScene } from '@dojo-video-engine/schema';
import { renderStill, compileCanvas2DDisplayList, disposeMediaInputSafely } from '@dojo-video-engine/renderer-canvas2d';
import { exportVideo } from '@dojo-video-engine/export';
import { Input, BlobSource, ALL_FORMATS, CanvasSink } from 'mediabunny';
window.runBackgroundProof = async () => {
 const canvas=document.querySelector('canvas');canvas.width=320;canvas.height=180;const context=canvas.getContext('2d',{willReadFrequently:true});const images={};
 const make=(style={},active={})=>parseScene({schemaVersion:1,width:320,height:180,fps:30,duration:1,assets:{},nodes:[{id:'bg',type:'div',style:{width:320,height:180,backgroundColor:'#000000'}},{id:'caption',type:'text',runs:[{text:'Word',style:{textBackgroundColor:'#ff00ff',...active}},{text:' rest'}],style:{position:'absolute',left:60,top:60,width:220,height:48,fontSize:32,lineHeight:1,color:'#ffffff',textBackgroundPaddingX:0,textBackgroundPaddingY:0,textBackgroundRadius:0,...style}}]});
 function metrics(pixels){const point=(x,y)=>{const at=(y*320+x)*4;return pixels[at]>170&&pixels[at+1]<130&&pixels[at+2]>170;};let left=320,right=-1,top=180,bottom=-1,count=0;for(let y=0;y<180;y++)for(let x=0;x<320;x++)if(point(x,y)){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}let corner=0;for(let y=top;y<top+8;y++)for(let x=left;x<left+8;x++)if(point(x,y))corner++;return {left,top,width:right-left+1,height:bottom-top+1,count,cornerOccupancy:corner/64};}
 function capture(name,scene){renderStill(context,scene,0);images[name]=canvas.toDataURL('image/png');const operation=compileCanvas2DDisplayList(context,scene,0).groups[1].content;return {...metrics(context.getImageData(0,0,320,180).data),positions:operation.lines[0].runs.map(run=>[run.x,run.width])};}
 const plain=capture('plate-plain',make());
 const x=capture('plate-padding-x',make({textBackgroundPaddingX:24}));
 const y=capture('plate-padding-y',make({textBackgroundPaddingY:12}));
 const square=capture('plate-square-padded',make({textBackgroundPaddingX:24,textBackgroundPaddingY:12}));
 const roundedScene=make({textBackgroundPaddingX:24,textBackgroundPaddingY:12,textBackgroundRadius:24});
 const rounded=capture('plate-rounded',roundedScene);
 const isolated=capture('plate-isolated',make({textBackgroundPaddingX:24,textBackgroundPaddingY:12,textBackgroundRadius:24,isolation:true}));
 const override=capture('plate-run-override',make({}, {textBackgroundPaddingX:18,textBackgroundPaddingY:9,textBackgroundRadius:999}));
 const result=await exportVideo({scene:roundedScene,codecs:['avc'],verification:'sampled'});const input=new Input({formats:ALL_FORMATS,source:new BlobSource(result.blob)});let decoded;try{const track=await input.getPrimaryVideoTrack();const frame=await new CanvasSink(track).getCanvas(0);if(!frame)throw new Error('No decoded exported frame');const c=frame.canvas.getContext('2d');decoded=metrics(c.getImageData(0,0,320,180).data);}finally{disposeMediaInputSafely(input);}
 const checks={horizontalPaddingWidensPlate:Math.abs(x.width-plain.width-48)<=1,verticalPaddingRaisesPlate:Math.abs(y.height-plain.height-24)<=1,cornersChangePaint:rounded.cornerOccupancy<0.25&&square.cornerOccupancy>0.8,paintDoesNotReflow:JSON.stringify(plain.positions)===JSON.stringify(rounded.positions),runOverridesRespected:Math.abs(override.width-plain.width-36)<=1,isolatedInkPreserved:isolated.width===rounded.width&&isolated.height===rounded.height,exportKeepsRoundedPlate:decoded.cornerOccupancy<0.3&&Math.abs(decoded.width-rounded.width)<=2&&result.verification.status==='verified'};
 return {images,checks,plain,x,y,square,rounded,isolated,override,decoded};
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
  page.setDefaultTimeout(30_000);
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`);
  await page.waitForFunction(
    () => typeof window.runBackgroundProof === "function",
  );
  const result = await page.evaluate(() => window.runBackgroundProof());
  const files = [
    "packages/schema/src/index.ts",
    "packages/core/src/display-list.ts",
    "packages/renderer-canvas2d/src/index.ts",
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
  const checks = result.checks;
  for (const [name, data] of Object.entries(result.images))
    await writeFile(
      path.join(outputDirectory, name + ".png"),
      Buffer.from(data.split(",")[1], "base64"),
    );
  delete result.images;
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
    throw new Error("Run background verification failed");
} finally {
  await browser?.close();
  await server.close();
  await rm(fixtureDirectory, { recursive: true, force: true });
}
