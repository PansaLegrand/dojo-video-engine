# Supply-chain policy

This policy covers public MotionForge packages, private repository apps and
tools, release artifacts, host-installed extensions, media/codec dependencies,
and the infrastructure used to publish them.

## Principles

1. A dependency is code and authority, not merely convenience.
2. A lockfile, source commit, build, tag, package, SBOM, and provenance
   attestation answer different questions; release evidence connects all of
   them.
3. Release builds start from a clean, reviewed commit and a frozen lockfile.
4. No credential, signed asset URL, private media, or registry token belongs in
   source, fixtures, logs, tarballs, SBOMs, or attestations.
5. Provenance proves origin and build context, not safety.

## Dependency intake and updates

Every new production dependency needs pull-request rationale covering:

- the capability it supplies and why existing code or a smaller dependency is
  insufficient;
- browser/Node/framework reachability and the public package that owns it;
- maintenance activity, release history, known vulnerabilities, install
  scripts, transitive dependency count, and package ownership risk;
- license and patent implications;
- deterministic, bundle-size, worker, and runtime-lifecycle impact;
- a removal or replacement path.

Public browser-engine packages must retain the dependency direction enforced
by `pnpm check:contracts`. Frameworks, model SDKs, product services,
authentication, databases, billing, cloud SDKs, and application state belong
outside those packages. A private app dependency is not automatically
acceptable for a public library.

Use exact versions for build/release tooling where practical and a committed
`pnpm-lock.yaml` for all workspace resolution. Dependency pull requests must
not combine unrelated feature changes. Review lockfile changes for unexpected
packages, registries, integrity changes, lifecycle scripts, native binaries,
and duplicated major versions.

Registry dependency scans do not necessarily cover the package manager,
Corepack, Node, browser binaries, native libraries, or GitHub Actions. Review
those toolchains against their own advisories before a credentialed build. In
particular, never run a package manager with release secrets in an untrusted
pull-request checkout. Release workflows pin actions to reviewed commit SHAs,
not mutable major tags.

## License policy

The repository is MIT-licensed. MIT, BSD-2-Clause, BSD-3-Clause, ISC, and
Apache-2.0 dependencies are normally compatible after notice review.

Dependencies or assets under copyleft, source-available, non-commercial,
field-of-use, data, font, model, or custom licenses require explicit maintainer
and legal review before merge. GPL/AGPL/LGPL classification is not decided from
the package name alone; linking, distribution, optionality, and the exact
license version matter. Unknown or missing licenses block release.

Generate and review a production license inventory for every candidate:

```sh
pnpm licenses list --prod --json > motionforge-licenses.json
```

The inventory is release evidence, not a substitute for preserving required
copyright and license notices in packages or distributions.

## Vulnerability management

Run a current registry advisory scan during candidate preparation:

```sh
pnpm audit --prod --audit-level high
```

This networked scan is intentionally separate from deterministic offline unit
tests. A high or critical result blocks publication until it is upgraded,
removed, shown unreachable for the released artifacts, or covered by a written
time-bounded exception. An exception records the advisory, affected package,
reachability, compensating controls, owner, expiry, and upgrade plan. Private
apps and public packages are triaged separately, but neither is silently
ignored.

Automated scanner output is only one input. Maintainers also review upstream
advisories, compromised-maintainer reports, suspicious package ownership or
install-script changes, and reports received under [`../SECURITY.md`](../SECURITY.md).

For a credible incident:

1. preserve evidence and stop publishing;
2. revoke affected tokens, trusted publishers, keys, or signed URLs;
3. determine affected commits, packages, versions, extensions, and downstream
   consumers;
4. prepare a private advisory and coordinated fix;
5. restore from a reviewed commit and clean release environment;
6. publish fixed versions, provenance, indicators, mitigations, and a timeline;
7. rotate remaining credentials and document corrective controls.

## SBOM

Every externally published package must be represented in a machine-readable
CycloneDX or SPDX graph for its runtime dependency closure, exact frozen
lockfile, tarball, and release commit. It must identify the generator and
version, direct/transitive dependencies, package versions, licenses, and the
commit/tag. Hash the SBOM and retain it with the release evidence. A private
whole-workspace graph is not a substitute.

`scripts/pack-release.mjs` is the pinned in-repository generator for 1.1. It
derives an explicit 16-root CycloneDX release-set graph from `pnpm list --prod`
under the frozen `pnpm-lock.yaml`, excludes peer-only development injection,
records platform-optional components, and verifies an install of the exact
tarballs with external resolutions constrained to those locked versions. It
also emits lock-bound license and audit evidence. The publisher rejects
absolute `file:` SBOM references, missing license evidence, hash drift, and
high/critical audit results. `npm sbom` is deliberately not used as a second
resolution source.

The protected workflow attests every release-bundle file and, after authorized
publication, attaches the SBOM, manifest, lockfile, checksums, licenses, audit,
and exact tarballs to the GitHub release. See GitHub's
[artifact-attestation guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations).

## Provenance, signing, and publishing identity

After package bootstrap, public npm packages should use npm trusted publishing
from a GitHub-hosted runner with OIDC, a protected release environment,
least-privilege workflow permissions, and no long-lived publish token. Trusted
publishing automatically produces npm provenance for eligible public packages;
otherwise the approved workflow must use the registry's documented provenance
option. See npm's
[trusted publishing](https://docs.npmjs.com/trusted-publishers/) and
[provenance](https://docs.npmjs.com/generating-provenance-statements/)
documentation.

The exact repository URL and directory in every package manifest must match the
public source repository. Configure the trusted publisher separately for every
package identity and restrict it to the reviewed release workflow/environment.
Sign the version tag with a maintainer-controlled signing identity and protect
release tags from force updates.

When npm cannot configure a trusted publisher until a new package identity
exists, its one-time bootstrap publish uses the same protected cloud workflow,
a short-lived granular token scoped to only the new packages, OIDC provenance,
environment approval, and pinned actions. Configure trusted publishing
immediately after bootstrap, verify it with the next publication, then revoke
the bootstrap token. Never describe this token-authenticated bootstrap as
trusted publishing.

The repository now contains a pinned manual release workflow, staged/idempotent
publisher, bundle verifier, and SBOM generator. Their presence is not evidence
that npm trusted publishers, protected environments, scope ownership,
provenance receipts, or a repository tag have been configured externally.

## Reproducibility and artifact retention

Release verification uses the committed pnpm version, the CI Node version, a
frozen lockfile, Playwright-pinned browser engines, fixed fuzz seeds, generated
schema checks, deterministic goldens, package dry-runs, and clean tarball
installation. The exact commands are in [`release-process.md`](release-process.md).

Candidate tarballs are pack-once artifacts: the release workflow creates the
retained bundle first, then the clean verifier installs, exercises, hashes,
attests, and publishes those same bytes. Repacking after clean verification
weakens the evidence chain even when source is unchanged.

MotionForge currently claims functional reproducibility under those pinned
inputs, not byte-for-byte identical tarballs across arbitrary operating
systems. Release evidence retains:

- commit and signed tag;
- CI run and tool/runtime versions;
- full gate and clean-install results;
- package names, versions, tarball integrity values, and registry provenance;
- schema/tool-manifest hashes;
- SBOM, license inventory, advisory scan/triage, and approved exceptions;
- source archive and evidence-file SHA-256 hashes.

Never rebuild an already published name/version from a different commit. npm
package versions are immutable; a correction receives a new patch version.

## Media codecs, patents, and native components

Browser or operating-system codec availability is not a grant of patent or
distribution rights. Container code, codecs, fonts, Lottie files, sample media,
native binaries, and optional headless encoders each require separate license,
export-control, and patent review for the jurisdictions and distribution model
of the host application.

MotionForge capability detection says whether an implementation is available;
it does not say that using or distributing it is legally permitted. Public
packages must not silently download codec binaries. A host that supplies an
encoder, decoder, or codec pack owns its installation, licensing, update, and
vulnerability policy.

## Extensions

Host-installed extensions are part of the executable supply chain. A manifest
or Scene descriptor is not a signature. Hosts allowlist exact extension
identities, acquire code from a trusted channel, verify publisher/integrity
metadata, and keep incompatible versions side by side when stored Scenes need
them. The engine intentionally does not fetch or execute extension code named
by a Scene. See [`extension-abi.md`](extension-abi.md).
