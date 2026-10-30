# RFC 0006 — Bounded media and audio runtime

- Status: Accepted
- Date: 2026-08-24
- Target release: 0.9.0

## Summary

Dojo Video Engine media resolution becomes reachable, streamable, proxy-aware, and
budgeted. The audio path gains named buses, panning, ducking, crossfades,
loudness measurement, limiting, waveform caching, and bounded preview chunks.

## Reachability and sources

`resolveAssets()` loads only assets referenced by nodes, effect parameters,
font families, or extension requirements. Unused declarations stay available
for future edits without consuming decode/network resources.

HTTP(S) audio/video uses Mediabunny `UrlSource`, which performs optimized range
requests under a bounded cache. Data/blob sources and explicit `buffer` mode
remain blob-backed. Assets may declare original metadata and a proxy source;
preview prefers proxies while final export defaults to originals.

## Resource budgets and estimates

Hosts may bound:

- per-source network cache bytes;
- decoded image bytes;
- simultaneous video decoders.

Inspection/preflight estimates reachable assets, declared image decode bytes,
proxy availability, and maximum overlapping video decoders. Runtime checks
still enforce actual decoded sizes and active cursor counts.

## Video edge behavior

Video nodes support explicit `hold` (freeze) and `loop` behavior. Negative
playback rate walks visual source time backward. Reverse audio is deliberately
unsupported; reverse video must be muted or paired with a separately reversed
audio asset. Inspection reports these capabilities instead of implying parity.

## Waveform and analysis cache

Reachable audio may opt into a bounded streaming waveform pass. Audio-reactive
effects reuse the same cache entry for spectrum plus waveform data. Ordinary
play/export does not pay waveform analysis cost unless requested.

## Audio graph

Scenes may define named buses with gain, pan, and optional limiting. Audio and
video nodes route to a bus, apply node pan, and may duck another bus with
bounded attack/release frames. Buses sum into implicit `master`, whose peak
limiter prevents clipping. Public helpers measure peak/RMS/dBFS and compile
paired crossfade envelopes.

## Long preview

Default Web Audio preview mixes only the bounded chunk surrounding the current
play/seek position and chains the next chunk on demand. Silent gaps schedule
the next chunk rather than eagerly mixing the entire project. Export remains
chunked independently.

## Determinism

1. Source/proxy selection is explicit in host options.
2. Budgets fail with actionable errors rather than evicting nondeterministically.
3. Ducking curves use scene frames and absolute chunk positions.
4. Limiting uses one deterministic peak gain per mixed chunk.
5. Preview and export share the same bus/pan/ducking mixer.
