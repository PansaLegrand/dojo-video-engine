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
    : path.join(os.tmpdir(), "dojo-video-engine-text-proof"),
);
await mkdir(outputDirectory, { recursive: true });
const fixtureDirectory = await mkdtemp(
  path.join(os.tmpdir(), "dojo-video-engine-text-"),
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
const fontIndex = argumentsList.indexOf("--variable-font");
const variableFont =
  fontIndex >= 0
    ? `data:font/woff2;base64,${(await readFile(path.resolve(argumentsList[fontIndex + 1]))).toString("base64")}`
    : null;
await writeFile(
  path.join(fixtureDirectory, "main.ts"),
  `
import { parseScene } from '@dojo-video-engine/schema';
import { resolveAssets, disposeAssetsAsync, renderStill, compileCanvas2DDisplayList } from '@dojo-video-engine/renderer-canvas2d';
const variableFont = ${JSON.stringify(variableFont)};
window.runTextProof = async () => {
  const canvas=document.querySelector('canvas');canvas.width=640;canvas.height=220;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  const make=(text,runs,style={},assets={})=>parseScene({schemaVersion:1,width:640,height:220,fps:30,duration:1,assets,nodes:[{id:'text',type:'text',...(text===undefined?{runs}:{text}),style:{position:'absolute',left:30,top:30,width:580,height:160,fontSize:56,color:'#ffffff',direction:'rtl',textAlign:'left',...style}}]});
  const images={};
  let drawnLines=[];const nativeFillText=context.fillText.bind(context);context.fillText=(value,...args)=>{drawnLines.push(value);nativeFillText(value,...args);};
  async function capture(label,scene){drawnLines=[];const assets=await resolveAssets(scene);try{renderStill(context,scene,0,{assets});const rgba=context.getImageData(0,0,640,220).data;let hash=2166136261,minimumX=640;const mask=[];for(let i=0;i<rgba.length;i++){hash=Math.imul(hash^rgba[i],16777619)>>>0;if(i%4===3){mask.push(rgba[i]>127?1:0);if(rgba[i]>64)minimumX=Math.min(minimumX,((i-3)/4)%640);}}images[label]=canvas.toDataURL('image/png');const display=compileCanvas2DDisplayList(context,scene,0,{assets});return {hash,mask,minimumX,drawnLines:[...drawnLines],fontSize:display.groups[0].content.font.size,bounds:display.groups[0].content.bounds,lines:display.groups[0].content.lines};}finally{await disposeAssetsAsync(assets);}}
  const arabic='السلام عليكم';
  const plain=await capture('plain-arabic',make(arabic));
  const same=await capture('same-color-runs-arabic',make(undefined,[{text:'الس'},{text:'لام '},{text:'عليكم'}]));
  const highlight=await capture('highlight-arabic',make(undefined,[{text:'الس',style:{color:'#ffff00'}},{text:'لام '},{text:'عليكم'}]));
  const rtl=await capture('rtl-words',make(undefined,[{text:'مرحبا',style:{color:'#ffff00'}},{text:' بالعالم'}]));
  const mixed=await capture('mixed-bidi',make(undefined,[{text:'مرحبا '},{text:'hello',style:{color:'#ffff00'}},{text:' world'}]));
  const dom=document.createElement('div');Object.assign(dom.style,{position:'absolute',left:'30px',top:'30px',width:'580px',fontSize:'56px',fontWeight:'400',fontFamily:'system-ui, sans-serif',direction:'rtl',textAlign:'left',whiteSpace:'pre'});const target=document.createElement('span');target.textContent='hello';dom.append(document.createTextNode('مرحبا '),target,document.createTextNode(' world'));document.body.append(dom);const referenceRect=target.getBoundingClientRect();const referenceCenter=referenceRect.left+referenceRect.width/2;dom.remove();const targetRun=mixed.lines[0].runs.find(run=>run.text==='hello');const mixedCenter=targetRun.x+targetRun.width/2;
  const padding=await capture('padding',make('Padding',undefined,{direction:'ltr',padding:24,fontSize:32}));
  const latinPlain=await capture('latin-plain',make('office',undefined,{direction:'ltr',fontFamily:'serif'}));
  const latinRuns=await capture('latin-runs',make(undefined,[{text:'of'},{text:'fi'},{text:'ce'}],{direction:'ltr',fontFamily:'serif'}));
  const caption='Every word must fit inside this narrow caption box';
  const shrinkAssets=variableFont?{'shrink-face':{id:'shrink-face',type:'font',src:variableFont,metadata:{fontFamily:'ShrinkVariable',fontWeight:'100 900'}}}:{};
  const shrinkStyle={direction:'ltr',width:210,height:80,fontSize:40,fontWeight:600,maxLines:2,textFit:'shrink',minFontSize:12,...(variableFont?{fontFamily:'ShrinkVariable'}:{})};
  const shrink=await capture('shrink-full-caption',make(caption,undefined,shrinkStyle,shrinkAssets));
  let impossibleFit=null;try{await capture('shrink-impossible',make(caption,undefined,{...shrinkStyle,minFontSize:40},shrinkAssets));}catch(error){impossibleFit={code:error.code,message:error.message};}
  const truncate=await capture('explicit-truncate',make(caption,undefined,{...shrinkStyle,textFit:'truncate',textOverflow:'ellipsis'},shrinkAssets));
  let font=null;
  if(variableFont){
    const asset={id:'font-face',type:'font',src:variableFont,metadata:{fontFamily:'EngineVariable',fontWeight:'100 900'}};
    const five=await capture('variable-500',make('Variable Weight',undefined,{direction:'ltr',fontFamily:'EngineVariable',fontWeight:500},{'font-face':asset}));
    const eight=await capture('variable-800',make('Variable Weight',undefined,{direction:'ltr',fontFamily:'EngineVariable',fontWeight:800},{'font-face':asset}));
    const face=new FontFace('ReferenceVariable',await (await fetch(variableFont)).arrayBuffer(),{weight:'100 900'});await face.load();document.fonts.add(face);
    const reference=await capture('variable-reference-500',make('Variable Weight',undefined,{direction:'ltr',fontFamily:'ReferenceVariable',fontWeight:500}));document.fonts.delete(face);
    font={five:five.hash,eight:eight.hash,reference:reference.hash};
  }
  const changedMask=plain.mask.reduce((count,value,index)=>count+(value!==highlight.mask[index]?1:0),0);
  return {images,checks:{shrinkRetainsEveryDrawnWord:shrink.drawnLines.join(' ')===caption&&shrink.lines.length<=2&&shrink.fontSize<40,impossibleFitIsExplicit:impossibleFit?.code==='TEXT_DOES_NOT_FIT',explicitTruncateUnchanged:truncate.drawnLines.length===1&&truncate.drawnLines[0].includes('…'),sameColorArabicMatchesPlain:plain.hash===same.hash,highlightPreservesArabicGlyphs:changedMask/plain.mask.length<0.002,rtlLogicalOrder:rtl.lines[0].runs[0].x>rtl.lines[0].runs[1].x,mixedBidiMatchesDomRange:Math.abs(mixedCenter-referenceCenter)<1,textPaddingHonored:padding.minimumX>=54&&padding.bounds.x===54&&padding.bounds.width===532,latinLigaturesPreserved:latinPlain.hash===latinRuns.hash,...(font?{variableWeightsDiffer:font.five!==font.eight,variableWeightMatchesBrowserReference:font.five===font.reference}:{})},arabic:{plain:plain.hash,same:same.hash,highlightMaskChangedPixels:changedMask},shrink:{drawnLines:shrink.drawnLines,fontSize:shrink.fontSize,source:caption,impossibleFit},padding:{minimumX:padding.minimumX,bounds:padding.bounds},mixedBidi:{mixedCenter,referenceCenter},font};
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
  await page.waitForFunction(() => typeof window.runTextProof === "function");
  const result = await page.evaluate(() => window.runTextProof());
  const files = [
    "packages/schema/src/index.ts",
    "packages/schema/src/font-assets.ts",
    "packages/core/src/index.ts",
    "packages/core/src/display-list.ts",
    "packages/core/src/bidi-text.ts",
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
    throw new Error("Text layout verification failed");
} finally {
  await browser?.close();
  await server.close();
  await rm(fixtureDirectory, { recursive: true, force: true });
}
