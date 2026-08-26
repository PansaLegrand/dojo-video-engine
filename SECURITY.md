# Security policy

MotionForge accepts untrusted Scene JSON and media references at its public
validation boundaries, but it also executes host-installed extensions and uses
browser media, Canvas, WebCodecs, and Web Audio APIs. Please report failures in
those boundaries privately when they may affect confidentiality, integrity, or
availability.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

1. Prefer a private GitHub security advisory at
   <https://github.com/PansaLegrand/motionforge/security/advisories/new>.
2. Include the affected package/version or commit, impact, prerequisites, a
   minimal reproduction, and any suggested mitigation.
3. Remove credentials, private media, signed URLs, and personal data from the
   report. If a secret was exposed, revoke it before reporting it.
4. If private vulnerability reporting is unavailable, contact a repository
   maintainer through a private contact method listed on their GitHub profile.
   A public issue may ask only for a private contact channel; do not include the
   vulnerability details there.

Reports about a dependency should explain how MotionForge reaches the affected
code. Scanner output without reachability or impact context is still useful,
but it may be triaged differently from an exploitable report.

## Response targets

These are project targets, not a service-level agreement:

- acknowledgement within three business days;
- an initial severity and scope assessment within seven calendar days;
- a remediation or mitigation target of 14 days for critical issues, 30 days
  for high issues, and 90 days for medium issues;
- coordinated disclosure after a fix is available, or within 90 days of the
  initial report when coordination permits.

The security response team may shorten or extend disclosure when active
exploitation, downstream coordination, incomplete evidence, or reporter safety
requires it. Reporters receive credit unless they request anonymity or the
report is not made in good faith.

## Supported versions

Support is based on versions that can be verified in the public registry and
repository tags, not merely versions written in a working-tree manifest.

| Version line                           | Security support                                                     |
| -------------------------------------- | -------------------------------------------------------------------- |
| Newest externally published 1.x minor  | Critical, high, medium, and low fixes                                |
| Immediately previous 1.x minor         | Critical and high fixes for 90 days after its successor is published |
| Older 1.x minors                       | Upgrade required unless a maintainer announces an exception          |
| 0.x and untagged/unpublished snapshots | No security support; best-effort reports are welcome                 |

The repository history documents a 1.0.0 source compatibility baseline and may
contain newer candidate manifests, but this policy found no repository tag or
npm publication receipt it could verify. Those files are not by themselves
evidence of an externally supported release. See
[`docs/release-process.md`](docs/release-process.md).

The `engines` range in a package manifest describes technical compatibility,
not upstream security maintenance. Run MotionForge on a Node.js and browser
version that its vendor still supports.

## Security boundaries

- Scene parsing, repair, migration, patches, commands, workflow tools, and
  extension parameters must retain their documented strictness and budgets.
- Scene JSON never authorizes executable code, module URLs, credentials, or
  extension installation.
- Extensions are trusted host code. Their separate trust and failure-isolation
  contract is documented in [`docs/extension-abi.md`](docs/extension-abi.md).
- Asset authorization, credential injection, signed-URL refresh, network
  policy, storage, and user isolation belong to the host application.
- Codec/container support is capability-gated. Codec patent or licensing
  questions are not security reports; see
  [`docs/supply-chain.md`](docs/supply-chain.md).

## Advisories and fixes

Security fixes follow the normal compatibility contract where possible. A fix
may intentionally reject previously accepted unsafe input in a patch release
when preserving that behavior would retain the vulnerability. The advisory and
changelog must identify the compatibility impact, affected versions, fixed
versions, mitigations, and whether pixels or serialized output can change.

Release rollback and advisory steps are in
[`docs/release-process.md`](docs/release-process.md). The broader dependency and
provenance policy is in [`docs/supply-chain.md`](docs/supply-chain.md).
