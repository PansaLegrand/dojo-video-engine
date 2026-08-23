// "Edgy" capability demos — motion-design-grade scenes that push choreography,
// audio sync, multi-decoder video, layout animation, and i18n all at once.
// Untracked; render with the golden harness for visual review.
import { writeFileSync } from "node:fs";
import { lottieBadgeDataUrl } from "../packages/showcase/dist/index.js";
import { timeline, popIn, fadeUp, slideIn } from "../packages/presets/dist/index.js";

const PHOTO = "https://images.pexels.com/photos/255527/pexels-photo-255527.jpeg";
const CLIP = "https://videos.pexels.com/video-files/2821900/2821900-hd_1280_720_25fps.mp4";

// Deterministic 8s beat track @120bpm: kick thump every beat, bright blip on
// off-beats, seeded-LCG noise burst every 4th beat (deterministic "snare").
function beatTrack8s() {
  const rate = 8000, seconds = 8, n = rate * seconds;
  const pcm = new Int16Array(n);
  let seed = 1337;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  const noise = Array.from({ length: rate }, rand);
  for (let i = 0; i < n; i += 1) {
    const t = i / rate;
    let v = 0;
    const beat = Math.floor(t * 2);          // 0.5s grid
    const dt = t - beat * 0.5;
    if (dt < 0.16) v += 0.7 * Math.exp(-dt * 30) * Math.sin(2 * Math.PI * 70 * dt);          // kick
    if (dt >= 0.25 && dt < 0.32) v += 0.25 * Math.exp(-(dt - 0.25) * 60) * Math.sin(2 * Math.PI * 1800 * (dt - 0.25)); // hat
    if (beat % 4 === 2 && dt < 0.12) v += 0.3 * Math.exp(-dt * 35) * (noise[Math.floor(dt * rate)] ?? 0); // snare
    pcm[i] = Math.round(Math.max(-1, Math.min(1, v)) * 32767);
  }
  const buf = new Uint8Array(44 + n * 2);
  const v2 = new DataView(buf.buffer);
  const ascii = (o, t) => [...t].forEach((c, i) => (buf[o + i] = c.charCodeAt(0)));
  ascii(0, "RIFF"); v2.setUint32(4, 36 + n * 2, true); ascii(8, "WAVEfmt ");
  v2.setUint32(16, 16, true); v2.setUint16(20, 1, true); v2.setUint16(22, 1, true);
  v2.setUint32(24, rate, true); v2.setUint32(28, rate * 2, true);
  v2.setUint16(32, 2, true); v2.setUint16(34, 16, true);
  ascii(36, "data"); v2.setUint32(40, n * 2, true);
  new Int16Array(buf.buffer, 44).set(pcm);
  return `data:audio/wav;base64,${Buffer.from(buf).toString("base64")}`;
}

const scenes = {};

// === A. Kinetic typography (1080x1920 @60) ==================================
{
  const lines = [
    { text: "STOP", color: "#ffffff", size: 220, rot: -6 },
    { text: "SCROLLING", color: "#ffd166", size: 150, rot: 3 },
    { text: "THIS", color: "#ffffff", size: 200, rot: 0 },
    { text: "ENGINE", color: "#66f5d7", size: 170, rot: -3 },
    { text: "RENDERS", color: "#ffffff", size: 150, rot: 4 },
    { text: "IN YOUR", color: "#ef9aa9", size: 140, rot: 0 },
    { text: "BROWSER", color: "#ffd166", size: 160, rot: -5 },
  ];
  const per = 22; // frames per word at 60fps
  const nodes = [
    { id: "bg", type: "div", style: { width: "100%", height: "100%", backgroundColor: "#0b0d12" } },
    // animated accent bar sweeping behind the words
    { id: "sweep", type: "div", from: 0, duration: lines.length * per + 80,
      style: { position: "absolute", left: -200, top: 0, width: 160, height: "100%", background: "linear-gradient(90deg, rgba(102,245,215,0) 0%, rgba(102,245,215,0.18) 50%, rgba(102,245,215,0) 100%)" },
      animations: [{ kind: "keyframes", property: "transform", frames: [
        { frame: 0, value: "translate(0px, 0px)" },
        { frame: lines.length * per + 79, value: "translate(1400px, 0px)", easing: "easeInOut" } ] }] },
    ...lines.map((line, i) => ({
      id: `word-${i}`, type: "text", text: line.text, from: i * per, duration: lines.length * per - i * per + 80,
      style: { position: "absolute", left: 0, width: "100%", top: 760, height: 280, fontSize: line.size, fontWeight: 900,
        color: line.color, textAlign: "center", textStroke: "10px #000000", transform: `rotate(${line.rot}deg)` },
      animations: [
        { kind: "keyframes", property: "transform", frames: [
          { frame: 0, value: `rotate(${line.rot}deg) scale(3)` },
          { frame: 7, value: `rotate(${line.rot}deg) scale(1)`, easing: "spring(0.35)" },
          { frame: per - 1, value: `rotate(${line.rot}deg) scale(1)` },
          { frame: per + 6, value: `rotate(${line.rot}deg) scale(0.92)` , easing: "easeOut" } ] },
        { kind: "keyframes", property: "opacity", frames: [
          { frame: 0, value: 0 }, { frame: 4, value: 1 },
          ...(i < lines.length - 1 ? [{ frame: per - 1, value: 1 }, { frame: per + 8, value: 0.12, easing: "easeOut" }] : []) ] },
      ],
    })),
    { id: "tagline", type: "text", text: "no servers were harmed", from: lines.length * per + 10, duration: 70,
      style: { position: "absolute", left: 0, width: "100%", top: 1180, height: 60, fontSize: 42, color: "#9fb3c8", textAlign: "center", letterSpacing: 6 },
      animations: fadeUp({ durationInFrames: 16 }) },
  ];
  scenes["edgy-kinetic-typography"] = { schemaVersion: 1, width: 1080, height: 1920, fps: 60, duration: lines.length * per + 90, assets: {}, nodes };
}

// === B. App promo: phone mockup with sliding screens (1080x1920 @30) ========
{
  const screen = (id, color, title, rows) => ({
    id, type: "div",
    style: { position: "absolute", left: 0, top: 0, width: 460, height: 940, backgroundColor: color },
    children: [
      { id: `${id}-bar`, type: "div", style: { position: "absolute", left: 24, top: 28, width: 412, height: 56, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16 } },
      { id: `${id}-title`, type: "text", text: title, style: { position: "absolute", left: 40, top: 40, width: 380, height: 34, fontSize: 26, fontWeight: 800, color: "#ffffff" } },
      ...rows.map((c, i) => ({
        id: `${id}-row-${i}`, type: "div",
        style: { position: "absolute", left: 24, top: 120 + i * 96, width: 412, height: 80, backgroundColor: "rgba(255,255,255,0.10)", borderRadius: 18 },
        children: [
          { id: `${id}-dot-${i}`, type: "div", style: { position: "absolute", left: 16, top: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: c } },
          { id: `${id}-line-${i}`, type: "div", style: { position: "absolute", left: 76, top: 28, width: 220 - i * 24, height: 12, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.35)" } },
        ],
      })),
    ],
  });
  const tl = timeline();
  tl.add("promo-title", popIn({ durationInFrames: 14, easing: "spring(0.3)" }));
  tl.stagger(["feat-1", "feat-2", "feat-3"], (i) => slideIn(i % 2 ? "right" : "left", { durationInFrames: 12 }), { after: "promo-title", overlap: 4, every: 8 });
  const anims = tl.compile();
  scenes["edgy-app-promo"] = {
    schemaVersion: 1, width: 1080, height: 1920, fps: 30, duration: 210, assets: {},
    nodes: [
      { id: "bg", type: "div", style: { width: "100%", height: "100%", background: "linear-gradient(160deg, #131a2a 0%, #1d2c3a 60%, #16222e 100%)" } },
      { id: "blob-a", type: "div", from: 0, duration: 210,
        style: { position: "absolute", left: -150, top: 200, width: 500, height: 500, borderRadius: 250, background: "linear-gradient(120deg, rgba(102,245,215,0.20), rgba(17,138,178,0.05))" },
        animations: [{ kind: "keyframes", property: "transform", frames: [{ frame: 0, value: "translate(0px, 0px)" }, { frame: 209, value: "translate(60px, -80px)", easing: "easeInOut" }] }] },
      { id: "blob-b", type: "div", from: 0, duration: 210,
        style: { position: "absolute", left: 760, top: 1300, width: 460, height: 460, borderRadius: 230, background: "linear-gradient(300deg, rgba(239,71,111,0.18), rgba(155,93,229,0.06))" },
        animations: [{ kind: "keyframes", property: "transform", frames: [{ frame: 0, value: "translate(0px, 0px)" }, { frame: 209, value: "translate(-50px, 60px)", easing: "easeInOut" }] }] },
      { id: "promo-title", type: "text", text: "Ship video features in a weekend", from: 0, duration: 210,
        style: { position: "absolute", left: 80, right: 80, top: 130, height: 150, fontSize: 60, fontWeight: 900, color: "#ffffff", textAlign: "center", lineHeight: 1.15 },
        animations: anims["promo-title"] },
      // phone frame with screens sliding inside an overflow clip
      { id: "phone", type: "div", from: 20, duration: 190,
        style: { position: "absolute", left: 290, top: 420, width: 500, height: 1000, backgroundColor: "#05070b", borderRadius: 64, border: "10px solid #2a3744", boxShadow: "0 40 120 rgba(0,0,0,0.6)" },
        animations: popIn({ durationInFrames: 16, fromScale: 0.92 }),
        children: [
          { id: "notch", type: "div", style: { position: "absolute", left: 170, top: 18, width: 160, height: 26, borderRadius: 13, backgroundColor: "#1d2733", zIndex: 3 } },
          { id: "viewport", type: "div", style: { position: "absolute", left: 20, top: 30, width: 460, height: 940, borderRadius: 40, overflow: "hidden", backgroundColor: "#0b1118" },
            children: [
              { id: "screens", type: "div",
                style: { position: "absolute", left: 0, top: 0, width: 1380, height: 940 },
                animations: [{ kind: "keyframes", property: "transform", frames: [
                  { frame: 0, value: "translate(0px, 0px)" },
                  { frame: 50, value: "translate(0px, 0px)" },
                  { frame: 62, value: "translate(-460px, 0px)", easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
                  { frame: 110, value: "translate(-460px, 0px)" },
                  { frame: 122, value: "translate(-920px, 0px)", easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
                  { frame: 189, value: "translate(-920px, 0px)" } ] }],
                children: [
                  screen("scr-1", "#118ab2", "Projects", [0, 1, 2, 3, 4].map(() => "#66f5d7")),
                  { ...screen("scr-2", "#9b5de5", "Editor", [0, 1, 2, 3].map(() => "#ffd166")), style: { position: "absolute", left: 460, top: 0, width: 460, height: 940, backgroundColor: "#3a2a55" } },
                  { ...screen("scr-3", "#244f46", "Export", [0, 1, 2].map(() => "#ef9aa9")), style: { position: "absolute", left: 920, top: 0, width: 460, height: 940, backgroundColor: "#244f46" } },
                ] },
            ] },
        ] },
      { id: "feat-1", type: "text", text: "● JSON scenes, validated", from: 0, duration: 210,
        style: { position: "absolute", left: 60, top: 1500, width: 500, height: 40, fontSize: 30, color: "#66f5d7" }, animations: anims["feat-1"] },
      { id: "feat-2", type: "text", text: "● preview = export, same pixels", from: 0, duration: 210,
        style: { position: "absolute", left: 520, top: 1580, width: 520, height: 40, fontSize: 30, color: "#ffd166", textAlign: "right" }, animations: anims["feat-2"] },
      { id: "feat-3", type: "text", text: "● MP4 out, no servers", from: 0, duration: 210,
        style: { position: "absolute", left: 60, top: 1660, width: 500, height: 40, fontSize: 30, color: "#ef9aa9" }, animations: anims["feat-3"] },
    ],
  };
}

// === C. Animated chart (1280x720 @30) =======================================
{
  const data = [
    { label: "render", value: 92, color: "#66f5d7" },
    { label: "decode", value: 78, color: "#ffd166" },
    { label: "encode", value: 64, color: "#ef476f" },
    { label: "mix", value: 41, color: "#9b5de5" },
    { label: "layout", value: 23, color: "#118ab2" },
  ];
  scenes["edgy-animated-chart"] = {
    schemaVersion: 1, width: 1280, height: 720, fps: 30, duration: 150, assets: {},
    nodes: [
      { id: "bg", type: "div", style: { width: "100%", height: "100%", backgroundColor: "#0d141c" } },
      { id: "title", type: "text", text: "Where the milliseconds go", from: 0, duration: 150,
        style: { position: "absolute", left: 80, top: 50, width: 700, height: 50, fontSize: 40, fontWeight: 800, color: "#ffffff" },
        animations: fadeUp({ durationInFrames: 12 }) },
      // grid lines
      ...[0, 1, 2, 3, 4].map((i) => ({
        id: `grid-${i}`, type: "div",
        style: { position: "absolute", left: 280 + i * 200, top: 140, width: 2, height: 460, backgroundColor: "rgba(255,255,255,0.07)" } })),
      ...data.map((d, i) => {
        const grow = 18 + i * 8;
        return {
          id: `bar-${d.label}`, type: "div", from: 0, duration: 150,
          style: { position: "absolute", left: 280, top: 160 + i * 88, width: 0, height: 56, backgroundColor: d.color, borderRadius: 12 },
          animations: [{ kind: "keyframes", property: "width", frames: [
            { frame: grow, value: 0 },
            { frame: grow + 30, value: d.value * 8.8, easing: "cubic-bezier(0.22, 1, 0.36, 1)" } ] }],
        };
      }),
      ...data.map((d, i) => ({
        id: `label-${d.label}`, type: "text", text: d.label, from: 10 + i * 8, duration: 140,
        style: { position: "absolute", left: 80, top: 168 + i * 88, width: 180, height: 40, fontSize: 30, color: "#9fb3c8", textAlign: "right" },
        animations: [{ kind: "keyframes", property: "opacity", frames: [{ frame: 0, value: 0 }, { frame: 8, value: 1 }] }] })),
      ...data.map((d, i) => ({
        id: `value-${d.label}`, type: "text", text: `${d.value}%`, from: 52 + i * 8, duration: 98,
        style: { position: "absolute", left: 292 + d.value * 8.8, top: 168 + i * 88, width: 110, height: 40, fontSize: 30, fontWeight: 800, color: d.color },
        animations: popIn({ durationInFrames: 8, fromScale: 0.6 }) })),
      { id: "footnote", type: "text", text: "bars are width keyframes driving real layout - not transforms", from: 110, duration: 40,
        style: { position: "absolute", left: 80, top: 650, width: 900, height: 30, fontSize: 22, color: "#5b6c7d" },
        animations: [{ kind: "keyframes", property: "opacity", frames: [{ frame: 0, value: 0 }, { frame: 10, value: 1 }] }] },
    ],
  };
}

// === D. Beat edit (720x1280 @30, 8s, audio-synced everything) ===============
{
  const beats = Array.from({ length: 16 }, (_, i) => i * 15); // every 0.5s @30fps
  const punch = beats.flatMap((f, i) => [
    { frame: Math.max(0, f - 1), value: "scale(1.0)" },
    { frame: f, value: i % 4 === 0 ? "scale(1.12)" : "scale(1.06)" },
    { frame: f + 7, value: "scale(1.0)", easing: "easeOut" },
  ]).filter((kf, idx, arr) => idx === 0 || kf.frame > arr[idx - 1].frame);
  const flashes = beats.filter((_, i) => i % 4 === 2).flatMap((f) => [
    { frame: Math.max(0, f - 1), value: 0 }, { frame: f, value: 0.35 }, { frame: f + 5, value: 0, easing: "easeOut" },
  ]).filter((kf, idx, arr) => idx === 0 || kf.frame > arr[idx - 1].frame);
  const hueSections = [
    { frame: 0, value: "hue-rotate(0deg) saturate(120%)" },
    { frame: 60, value: "hue-rotate(0deg) saturate(120%)" },
    { frame: 61, value: "hue-rotate(40deg) saturate(150%)" },
    { frame: 120, value: "hue-rotate(40deg) saturate(150%)" },
    { frame: 121, value: "hue-rotate(300deg) saturate(140%)" },
    { frame: 180, value: "hue-rotate(300deg) saturate(140%)" },
    { frame: 181, value: "hue-rotate(0deg) saturate(160%)" },
  ];
  const words = ["FOUR", "ON", "THE", "FLOOR"];
  scenes["edgy-beat-edit"] = {
    schemaVersion: 1, width: 720, height: 1280, fps: 30, duration: 240,
    assets: {
      photo: { id: "photo", type: "image", src: PHOTO },
      kit: { id: "kit", type: "audio", src: beatTrack8s() },
      badge: { id: "badge", type: "lottie", src: lottieBadgeDataUrl() },
    },
    nodes: [
      { id: "bg", type: "div", style: { width: "100%", height: "100%", backgroundColor: "#05070b" } },
      // photo with beat punch + sectioned color grade (filter steps per section)
      { id: "photo-node", type: "img", assetId: "photo", from: 0, duration: 240,
        style: { position: "absolute", left: -40, top: 200, width: 800, height: 800, objectFit: "cover", borderRadius: 32 },
        animations: [
          { kind: "keyframes", property: "transform", frames: punch },
          { kind: "keyframes", property: "filter", frames: hueSections },
        ] },
      // white flash overlay on every 3rd-of-4 beat
      { id: "flash", type: "div", from: 0, duration: 240,
        style: { position: "absolute", left: 0, top: 0, width: "100%", height: "100%", backgroundColor: "#ffffff", opacity: 0 },
        animations: [{ kind: "keyframes", property: "opacity", frames: flashes }] },
      // lottie badge pops on every 4th beat, alternating corners
      ...beats.filter((_, i) => i % 4 === 0).map((f, j) => ({
        id: `badge-pop-${j}`, type: "lottie", assetId: "badge", from: f, duration: 14,
        style: { position: "absolute", left: j % 2 ? 480 : 60, top: j % 2 ? 1020 : 80, width: 180, height: 180, objectFit: "contain" },
        animations: popIn({ durationInFrames: 6, fromScale: 0.4, easing: "spring(0.5)" }) })),
      // beat-timed words, one per bar
      ...words.map((w, i) => ({
        id: `bar-word-${i}`, type: "text", text: w, from: i * 60, duration: 60,
        style: { position: "absolute", left: 0, width: "100%", top: 1060, height: 140, fontSize: 120, fontWeight: 900, color: "#ffffff", textAlign: "center", textStroke: "10px #000000" },
        animations: [
          { kind: "keyframes", property: "transform", frames: [
            { frame: 0, value: "scale(1.6) rotate(-3deg)" },
            { frame: 5, value: "scale(1) rotate(0deg)", easing: "spring(0.4)" } ] } ] })),
      { id: "kit-audio", type: "audio", assetId: "kit", from: 0, duration: 240 },
    ],
  };
}

// === E. Cinematic title (1920x1080 @24, Ken Burns + letterbox) ==============
scenes["edgy-cinematic-title"] = {
  schemaVersion: 1, width: 1920, height: 1080, fps: 24, duration: 168,
  assets: { photo: { id: "photo", type: "image", src: PHOTO } },
  nodes: [
    { id: "bg", type: "div", style: { width: "100%", height: "100%", backgroundColor: "#000000" } },
    // Ken Burns: slow zoom + drift, graded film look
    { id: "plate", type: "img", assetId: "photo", from: 0, duration: 168,
      style: { position: "absolute", left: 0, top: 0, width: 1920, height: 1080, objectFit: "cover", filter: "sepia(35%) contrast(112%) brightness(82%) saturate(85%)" },
      animations: [{ kind: "keyframes", property: "transform", frames: [
        { frame: 0, value: "translate(0px, 0px) scale(1.0)" },
        { frame: 167, value: "translate(-60px, -30px) scale(1.16)", easing: "easeInOut" } ] }] },
    // edge vignette via four gradients
    { id: "vig-top", type: "div", style: { position: "absolute", left: 0, top: 0, width: "100%", height: 280, background: "linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)" } },
    { id: "vig-bottom", type: "div", style: { position: "absolute", left: 0, bottom: 0, width: "100%", height: 280, background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)" } },
    { id: "vig-left", type: "div", style: { position: "absolute", left: 0, top: 0, width: 320, height: "100%", background: "linear-gradient(90deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)" } },
    { id: "vig-right", type: "div", style: { position: "absolute", right: 0, top: 0, width: 320, height: "100%", background: "linear-gradient(270deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)" } },
    // letterbox bars
    { id: "bar-top", type: "div", style: { position: "absolute", left: 0, top: 0, width: "100%", height: 130, backgroundColor: "#000000", zIndex: 5 } },
    { id: "bar-bottom", type: "div", style: { position: "absolute", left: 0, bottom: 0, width: "100%", height: 130, backgroundColor: "#000000", zIndex: 5 } },
    // title: tracking-in letterSpacing animation (animating a layout-affecting text style)
    { id: "title", type: "text", text: "OPEN HAND", from: 24, duration: 144,
      style: { position: "absolute", left: 0, width: "100%", top: 470, height: 120, fontSize: 96, fontWeight: 300, color: "#f5f1e8", textAlign: "center", letterSpacing: 60 },
      animations: [
        { kind: "keyframes", property: "letterSpacing", frames: [
          { frame: 0, value: 60 }, { frame: 60, value: 14, easing: "easeOut" } ] },
        { kind: "keyframes", property: "opacity", frames: [
          { frame: 0, value: 0 }, { frame: 36, value: 1, easing: "easeIn" } ] } ] },
    { id: "subtitle", type: "text", text: "a motionforge picture", from: 84, duration: 84,
      style: { position: "absolute", left: 0, width: "100%", top: 610, height: 40, fontSize: 28, color: "#bdb4a3", textAlign: "center", letterSpacing: 10 },
      animations: [{ kind: "keyframes", property: "opacity", frames: [{ frame: 0, value: 0 }, { frame: 30, value: 0.9, easing: "easeIn" }] }] },
  ],
};

// === F. Multicam grid -> hero zoom (4 simultaneous decoders) =================
{
  const cam = (id, x, y, trim, rate, label) => [
    { id, type: "video", assetId: "clip", videoStartTime: trim, playbackRate: rate, volume: 0, from: 0, duration: 150,
      style: { position: "absolute", left: x, top: y, width: 600, height: 330, objectFit: "cover", borderRadius: 10, border: "3px solid #2a3744" } },
    { id: `${id}-tag`, type: "div", from: 0, duration: 150,
      style: { position: "absolute", left: x + 16, top: y + 16, width: 150, height: 36, backgroundColor: "rgba(8,10,14,0.78)", borderRadius: 8, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" },
      children: [{ id: `${id}-tag-text`, type: "text", text: label, style: { width: "100%", height: 22, fontSize: 18, color: "#66f5d7", textAlign: "center" } }] },
  ];
  scenes["edgy-multicam"] = {
    schemaVersion: 1, width: 1280, height: 720, fps: 30, duration: 150,
    assets: { clip: { id: "clip", type: "video", src: CLIP } },
    nodes: [
      { id: "bg", type: "div", style: { width: "100%", height: "100%", backgroundColor: "#05070b" } },
      ...cam("cam-1", 25, 25, 0, 1, "CAM 1 - LIVE"),
      ...cam("cam-2", 655, 25, 4, 1, "CAM 2 - +4s"),
      ...cam("cam-3", 25, 365, 8, 1, "CAM 3 - +8s"),
      // hero cam: grid cell for 2s, then ANIMATES ITS LAYOUT to fullscreen
      { id: "cam-hero", type: "video", assetId: "clip", videoStartTime: 2, playbackRate: 2, volume: 0.7, from: 0, duration: 150,
        style: { position: "absolute", left: 655, top: 365, width: 600, height: 330, objectFit: "cover", borderRadius: 10, border: "3px solid #ffd166", zIndex: 4 },
        animations: [
          { kind: "keyframes", property: "left", frames: [{ frame: 60, value: 655 }, { frame: 84, value: 0, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }] },
          { kind: "keyframes", property: "top", frames: [{ frame: 60, value: 365 }, { frame: 84, value: 0, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }] },
          { kind: "keyframes", property: "width", frames: [{ frame: 60, value: 600 }, { frame: 84, value: 1280, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }] },
          { kind: "keyframes", property: "height", frames: [{ frame: 60, value: 330 }, { frame: 84, value: 720, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }] },
          { kind: "keyframes", property: "borderRadius", frames: [{ frame: 60, value: 10 }, { frame: 84, value: 0 }] } ] },
      { id: "hero-tag", type: "div", from: 90, duration: 60,
        style: { position: "absolute", left: 40, top: 620, width: 360, height: 56, backgroundColor: "rgba(8,10,14,0.78)", borderRadius: 10, zIndex: 5, display: "flex", alignItems: "center", justifyContent: "center" },
        animations: slideIn("left", { durationInFrames: 10 }),
        children: [{ id: "hero-tag-text", type: "text", text: "CAM 4 - 2x SPEED - FULLSCREEN", style: { width: "100%", height: 26, fontSize: 20, color: "#ffd166", textAlign: "center" } }] },
    ],
  };
}

for (const [name, scene] of Object.entries(scenes)) {
  writeFileSync(`verification/${name}.json`, JSON.stringify(scene, null, 2));
  console.log(`wrote verification/${name}.json`);
}
