# Release process

This is the maintainer runbook for synchronized Dojo Video Engine releases. It
separates a source release candidate from a Git tag and an externally published
npm release so repository documentation never treats one as proof of another.

## Current publication status

The synchronized **1.2.2** package set is published with MIT licenses and GitHub
provenance. All 17 public packages resolve `latest` to 1.2.2. See the
[release record](releases/1.2.2.md) and its exact artifacts and workflow receipts.
The earlier 1.1.0 publication exposed npm 12's changed JSON output shape and
registry processing delays. The release controller now reads anonymous public
registry endpoints, waits for propagation without retrying uploads, and checks
exact bytes before promoting tags. Renderer APIs and behavior are unchanged.

The root is a private workspace. Publish the coordinated public package set through
the checked-in workflow, including `@dojo-video-engine/create`; its executable is
`create-dojo-video-engine`. Do not publish an unscoped starter from this repository.

See [runtime reconciliation](runtime-reconciliation-2026-10-31.md) for the changes
and verification boundary. npm login/scope access remains an external prerequisite.

## Authority and prerequisites

Only an authorized release manager may create the release tag, approve the
protected release environment, or change npm trusted-publisher/dist-tag state.
Before the first external release, maintainers must:

- prove control of the `@dojo-video-engine` npm scope and every package identity;
- preserve the tested `@dojo-video-engine/create` identity and reject regressions to
  the unrelated unscoped package;
- establish a maintainer tag-signing identity, publish its verification
  instructions, and protect release tags from force updates;
- review and enable the checked-in tag-bound release workflow on a GitHub-hosted runner;
- keep the pinned pnpm 10.x toolchain on a security-supported version (the 1.1
  candidate uses 10.34.5 for the advisories known while planning it) and pin
  release workflow actions to reviewed commit SHAs;
- use a release-job Node/npm combination that satisfies npm's current trusted
  publishing prerequisites (currently Node 22.14+ and npm 11.5.1+; Node 24 with
  a current npm is the documented baseline), independently of the normal test
  matrix;
- plan one protected, token-authenticated provenance bootstrap for package
  identities that do not yet exist, then configure npm trusted publishing for
  the exact workflow/environment and revoke the bootstrap token;
- verify the checked-in lock-aware release-set SBOM/license/audit generator and
  artifact attestation under the protected environment;
- verify the checked-in pack-once release bundle and staged publisher against
  the owned npm scope without bypassing their exact-byte checks;
- verify every public package's Node `engines` declaration still agrees with
  all production dependencies and the compatibility policy;
- rerun the production advisory inventory and resolve or explicitly triage any
  new high/critical finding under [`supply-chain.md`](supply-chain.md).

Until those prerequisites are committed and reviewed, stop after candidate
verification. Do not create a public tag or run a registry publish command.

### Current local candidate evidence

The 2026-08-26 source audit upgraded the pinned package manager to pnpm 10.34.5,
pinned the existing CI actions to reviewed commit SHAs, aligned the CLI/starter
Node floor to 20.19, and removed the then-current production advisories through
dependency upgrades/overrides. The repository production audit exited
successfully with zero reported advisories:

```sh
pnpm audit --prod --audit-level high --json
```

That result is time- and lockfile-specific. The release bundler separately
audits the exact tarball install constrained to the locked production graph.
Neither result closes the remaining scope-ownership, protected-environment,
tag, registry, or provenance prerequisites.

## Version agreement

For candidate `1.1.0`, all of the following refer to the same reviewed commit:

1. every public `packages/*/package.json` version is exactly `1.1.0`;
2. internal workspace dependencies remain `workspace:*` in source and are
   rewritten to exact publishable versions by pnpm packaging;
3. `CHANGELOG.md` contains `## 1.1.0 — YYYY-MM-DD`, with no `Unreleased`
   change accidentally omitted;
4. the signed tag is exactly `v1.1.0` and points to that commit;
5. the migration note is
   [`migrations/1.0-to-1.1.md`](migrations/1.0-to-1.1.md);
6. `CURRENT_SCENE_VERSION` and the committed generated
   `packages/schema/scene.schema.json` agree;
7. Scene migration fixtures agree with the supported input versions;
8. public entry points agree with `docs/public-api-baseline.json` and
   `docs/public-api-ownership.md`;
9. command, layout-intent, extension, legacy agent-tool, and workflow tool
   names, manifest versions, draft-07 schemas, examples, and required fields
   pass their package contract tests;
10. every registry package and provenance record reports the same package
    version, repository, directory, and tag commit.

`pnpm check:contracts` mechanically checks synchronized source versions,
changelog presence, dependency direction, and public entry-point baseline. It
does not verify a Git tag, npm ownership/publication, provenance, SBOM, or
registry contents; the release manager records those separately.

Scene v1 remains canonical for 1.1.0. If `CURRENT_SCENE_VERSION` changes, stop:
that needs a separately accepted Scene RFC, deterministic migration, fixtures,
compatibility review, and release plan. A package minor bump alone cannot make
a breaking Scene version change.

Tool/manifest changes are reviewed independently of package SemVer. Adding a
new optional tool or result field may fit 1.1.0; removing/renaming a stable tool
or adding a required field does not. If an existing manifest or ABI cannot
remain compatible, version that contract explicitly and follow its migration
policy before proceeding.

## Preparing the 1.1.0 candidate

Use a clean release branch based on current `main`:

1. Update all public package versions to `1.1.0`, including
   `@dojo-video-engine/create`, and refresh `pnpm-lock.yaml`.
2. Move completed entries from `Unreleased` into the dated 1.1.0 changelog
   section. State compatibility and known limitations.
3. Finalize the 1.0 → 1.1 migration note and release evidence.
4. Update public API ownership/baselines for deliberate additive entry points.
5. Regenerate committed artifacts through their checked-in scripts; never edit
   generated schemas manually.
6. Review dependency/license/advisory changes and all time-bounded exceptions.

Run from the repository root with the pinned pnpm version:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm exec prettier --check .
git diff --check
pnpm check:contracts
pnpm check:schema
pnpm check:migrations
pnpm release:full
pnpm audit --prod --audit-level high
node scripts/pack-release.mjs /path/to/empty/release-directory
RELEASE_VERSION=1.1.0 node scripts/publish-release.mjs \
  /path/to/empty/release-directory --verify-only
node scripts/verify-clean-machine.mjs \
  --pack-dir /path/to/empty/release-directory
```

`pnpm release:full` includes typecheck, unit tests, lint/contract checks, build,
fuzz/corpus/agent/resource gates, pinned browser goldens and cross-browser
probes, performance, browser E2E, CLI/starter smoke, and package dry-runs.
The bundle command uses **pnpm pack** once, records SHA-256 and SHA-512 SRI,
copies the exact lockfile, produces CycloneDX/license/audit evidence and
`SHA256SUMS`, and verifies the tarball dependency graph. The clean verifier then
installs those retained bytes outside the workspace and exercises Node, ESM,
browser, worker, CLI, authoring, inspection, and build entry points. Record the
exact CI run and gate counts; do not copy counts from an older milestone.

The license and advisory commands are network/environment-sensitive candidate
evidence rather than deterministic unit tests. A nonzero advisory result blocks
publication unless every result is fixed or has the documented exception
required by [`supply-chain.md`](supply-chain.md).

The root audit covers the whole workspace, including private apps and tools.
Keep that repository-wide evidence separately from the release-set SBOM,
license inventory, and audit emitted for the exact public tarballs. Do not
attribute a private app dependency to a library tarball or omit a library's
transitive runtime dependency because the monorepo view is noisy.

Generate the pinned SBOM after dependency resolution and before publishing.
Record its generator/version and SHA-256 next to the license inventory,
candidate commit, tool versions, gate results, schema/tool-manifest hashes, and
approved exceptions. Do not commit secrets or signed asset URLs into evidence.

Before review, the working tree must contain only intentional candidate files:

```sh
git status --short
git diff --check
```

Open a release pull request. A maintainer other than the author reviews version
agreement, changelog/migration content, package contents, security/license
triage, and publish-workflow changes when another maintainer is available.

## Packaging rule

Do not use `npm pack` or `npm publish` directly in a source package directory:
npm does not rewrite pnpm's internal `workspace:*` dependency specifiers.
Use `pnpm pack` to perform the required workspace-version rewrite. The
candidate must inspect the resulting tarballs and prove them through the clean
install. Publishing one of those retained tarball paths with the current npm
CLI is permitted and is the preferred way to combine pack-once bytes with npm
OIDC/provenance; the prohibition is against npm repacking the source directory.

Without `--pack-dir`, the clean verifier still creates disposable local
tarballs for development. The protected release path always supplies the
retained bundle directory; it verifies manifest/lock/evidence hashes and never
repacks. `npm pack --dry-run` remains only a contents preview and is not publish
evidence.

Before external publication, inspect each tarball for only declared `files`,
the expected version/repository, concrete internal dependency versions, its
README/LICENSE, generated schema where applicable, and no tests, build info,
credentials, absolute local paths, or private app source.

## Tag and trusted publication

After the release pull request is merged and the exact `main` commit has a green
full CI run, a release manager creates and verifies a signed tag:

```sh
git switch main
git pull --ff-only
test -z "$(git status --porcelain)"
git tag -s v1.1.0 -m "Dojo Video Engine 1.1.0"
git tag -v v1.1.0
git push origin v1.1.0
```

The protected workflow is manually dispatched against that exact tag—not a
branch or developer laptop—and then:

1. checks out the exact tag on a GitHub-hosted runner with cache disabled;
2. uses actions pinned to reviewed commit SHAs and grants the candidate job
   only the permissions needed for artifact/SBOM attestation; the protected
   publish job receives `contents: write` only to attach durable release assets;
3. installs the pinned pnpm/Node versions with a frozen lockfile;
4. verifies tag/package/changelog/schema/tool agreement again;
5. creates the retained bundle once, verifies its manifest/checksums, and runs
   the clean external ESM/browser/worker/CLI smokes against those exact bytes;
6. attests every bundle file and retains hashes/evidence;
7. preflights immutable registry integrity and dist tags, publishes only
   missing packages under a version-specific temporary tag, verifies the whole
   synchronized set, then promotes and verifies `latest`;
8. supports an idempotent resume only when already-published package integrity
   is identical, and refuses conflicts or version downgrades;
9. attaches tarballs, lockfile, SBOM, licenses, audit, manifest, and checksums
   to the durable GitHub release and records provenance/registry receipts.

With npm trusted publishing, eligible public packages receive provenance
automatically. If an approved third-party publish command is used, set
`NPM_CONFIG_PROVENANCE=true` and verify the result; do not silently fall back to
a token-only, provenance-free publish. Follow npm's current
[trusted-publisher](https://docs.npmjs.com/trusted-publishers/) and
[provenance](https://docs.npmjs.com/generating-provenance-statements/)
requirements when the workflow is reviewed.

### First-publication bootstrap

The immutable `v1.2.0` tag was not published: its workflow passed all candidate
checks but stopped before any upload because npm returns HTTP 401 from the
anonymous dist-tag endpoint for a nonexistent package. Release 1.2.1 reads tags
from the public package document, where absence is HTTP 404. Authorization
failures still fail closed. The failed run is
[42261999577](https://github.com/PansaLegrand/dojo-video-engine/actions/runs/42261999577).

The 1.2.1 release introduces `@dojo-video-engine/three`. Its first publication
uses the explicit `bootstrap_three=true` input and the short-lived
`NPM_THREE_BOOTSTRAP_TOKEN` secret in the protected `npm-release` environment.
The controller sends that credential only to this package's publish/dist-tag
operations; all existing packages remain OIDC-only. It rejects other versions,
missing secrets, accidental token activation and token-bearing OIDC verification.
After verified publication, configure the new package's trusted publisher for
`release.yml` / `npm-release`, verify token-free access, revoke the bootstrap
token and delete the secret. This does not weaken existing package settings.

npm package settings cannot be assumed to offer trusted-publisher configuration
for a package identity that does not yet exist. For the first publication of
each new `@dojo-video-engine/*` identity:

1. confirm scope ownership and reserve/verify the intended identity;
2. create a short-lived granular npm token limited to the new package set and
   publication task;
3. store it only in the protected release environment;
4. publish from the same GitHub-hosted, tag-bound workflow with
   `id-token: write` and provenance enabled;
5. verify registry package contents, integrity, repository, tag, and provenance;
6. configure that package's trusted publisher for the exact workflow file and
   environment;
7. revoke the bootstrap token and restrict token publishing once every package
   has a working trusted publisher.

This is a token-authenticated bootstrap with provenance, not trusted
publishing. Record it as such. If any identity cannot be reserved or scoped
correctly, stop and rename it before publication.

Do not publish from forks, self-hosted runners, mutable unreviewed actions, or a
dirty checkout. Do not use `--no-git-checks` to bypass version/tag agreement.

## Post-publication verification

For every public package:

- `npm view <name>@1.1.0` reports the expected version, repository, directory,
  dist integrity, and public access;
- the package has registry provenance linked to the tagged repository commit;
- installing the registry package set into a new temporary project reproduces
  the clean-install smoke;
- `npm audit signatures` verifies available registry signatures/attestations;
- the SBOM and source/release evidence hashes verify;
- the GitHub release notes link the migration, compatibility, security,
  extension ABI, SBOM, and evidence.

Only after those checks may documentation call 1.1.0 externally published.
Upgrade downstream applications in separate commits pinned to the verified
version or integrity.

## Partial failure and rollback

npm name/version pairs are immutable. Never rebuild or overwrite 1.1.0 from a
different commit.

If publication stops partway:

1. stop the workflow and list exactly which packages/versions reached the
   registry;
2. if failure was transient and every already-published tarball is correct,
   resume only the missing packages from the same tag and artifacts;
3. if any content is wrong, restore each affected `latest` dist-tag to its last
   known-good version, deprecate the partial/broken version with upgrade
   guidance, and publish a synchronized 1.1.1 correction;
4. use unpublish only when npm policy, incident severity, and maintainer review
   justify the ecosystem breakage; deprecation plus a fixed version is the
   default;
5. do not move or delete the signed source tag. Add a corrective release/tag
   and document the relationship;
6. notify downstream consumers and record the incident timeline.

For a security failure, keep details private until coordinated disclosure,
revoke compromised credentials/trusted-publisher access, open a private GitHub
security advisory, request a CVE when appropriate, and publish affected/fixed
versions, impact, mitigations, and verification instructions. Follow
[`../SECURITY.md`](../SECURITY.md).

## Release record

The final record includes:

- release manager and reviewers;
- source commit and verified signed tag;
- public package list/version and registry integrity/provenance links;
- CI workflow/run and exact Node, pnpm, browser, and generator versions;
- full gate, clean-install, registry-install, audit/signature results;
- Scene schema/migration and public tool/manifest hashes;
- SBOM, license inventory, source archive, checksums, and exceptions;
- changelog, migration note, compatibility changes, advisories, rollback notes,
  and known limitations.

Source version files, a changelog entry, or a local successful gate remain
candidate evidence until this record is complete.

### Keyless release-tag signing

Maintainers can dispatch `.github/workflows/tag-release.yml` on `main` with the
exact version and a successful `Release candidate` run ID. It verifies the retained
bundle and candidate source commit, then signs the tag using the GitHub Actions
OIDC identity and pinned Gitsign 0.18.0. It uses no persistent signing key and
never force-updates a tag. The expected signer identity is:

`https://github.com/PansaLegrand/dojo-video-engine/.github/workflows/tag-release.yml@refs/heads/main`

Verify with `gitsign verify-tag --certificate-identity=<identity-above>
--certificate-oidc-issuer=https://token.actions.githubusercontent.com v1.1.1`.
GitHub may not display its native Verified badge for Sigstore X.509 tags; the
identity-constrained Gitsign verification and Rekor record are authoritative.
The workflow retains a signed Git bundle rather than pushing with `GITHUB_TOKEN`,
which cannot introduce workflow files through a tag. A maintainer downloads the
bundle, runs `git bundle verify`, fetches its tag into the local repository,
verifies it with the identity-constrained command above, and pushes the unchanged
tag with their existing GitHub credentials. Never force-update the tag. Then
dispatch the release workflow against that exact tag.

### Verify trusted publishing before removing the bootstrap secret

The publish job pins npm 12.2.1 for OIDC-aware dist-tag operations. After every
package has its trusted publisher configured, dispatch `release.yml` on the
published version tag with `verify_trusted_publishers=true` and `publish=false`.
This job receives no npm token, verifies the retained release against the registry,
adds and removes a run-specific temporary dist-tag on each package, and never
publishes a new version or changes `latest`. Remove the bootstrap secret only
after this check succeeds.

Each package must trust only `PansaLegrand/dojo-video-engine`, workflow
`release.yml`, and environment `npm-release`, with `createPackage`,
`createStagedPackage`, and `manageDistTags` permissions. Dist-tag permission is
independent of publish permission. npm 12.2.1's `trust github` command does not
expose that last permission; use package settings or npm's documented
[trust API](https://api-docs.npmjs.com/#tag/Trust) with interactive authentication.
Do not use a bypass-2FA token to configure trust.
