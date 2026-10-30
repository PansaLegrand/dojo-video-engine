# Dojo Video Engine governance

Dojo Video Engine is a maintainer-led open-source project. This document explains
how authority is earned and exercised; it does not imply a foundation,
corporate steering committee, or guaranteed release schedule.

## Roles

- **Users** consume Dojo Video Engine and report requirements or defects.
- **Contributors** submit issues, designs, documentation, tests, or code.
- **Reviewers** are contributors whom a maintainer trusts to review a defined
  area. Review authority does not include release or security credentials.
- **Maintainers** have repository write access and steward architecture,
  compatibility, community safety, and contributor review.
- **Release managers** are maintainers explicitly authorized to prepare tags,
  approve the protected release environment, and coordinate registry state.
- **Security responders** are maintainers explicitly given access to private
  vulnerability reports.

One person may hold several roles. Repository/environment permissions are the
authoritative record for privileged maintainer, release, and security roles;
review assignments and maintainer decisions record non-privileged reviewers.
This file does not grant access. Maintainers may add or remove reviewers and
maintainers by documented consensus based on sustained, constructive work,
technical judgment, availability, and adherence to the Code of Conduct.
Inactivity alone is not misconduct, but long-unused privileged access should be
removed after private notice when practical.

## Decision process

Routine changes use lazy consensus through pull-request review. A maintainer
may merge when required checks pass, relevant owners have had a reasonable
chance to respond, and no unresolved technical objection remains.

Material decisions require an RFC. Examples include:

- a new or changed Scene version;
- a public package, entry point, tool name, extension/display ABI, or dependency
  direction;
- renderer semantics or defaults that can change existing pixels;
- a deprecation or removal plan;
- a security boundary, release policy, or governance change.

An RFC starts as `Draft` under `docs/rfcs/`, states alternatives and
compatibility impact, and normally remains open for at least seven calendar
days. Maintainers resolve objections with evidence and record `Accepted`,
`Rejected`, or `Superseded`; silence is not treated as approval for a breaking
change. Security fixes may use a private, expedited decision record and publish
the non-sensitive rationale with the advisory.

Maintainers seek consensus, but a designated maintainer may make the final call
when consensus cannot be reached. The decision must summarize the competing
arguments and may be appealed once with new technical or project evidence.

## Contributions and review

[`CONTRIBUTING.md`](CONTRIBUTING.md) defines development and verification
requirements. Changes should be small enough to review, preserve unrelated
work, and include compatibility, migration, and test evidence proportional to
risk. Authors do not approve their own material architecture, security, or
release-policy changes when another maintainer is available.

Contributors retain copyright and submit contributions under the repository's
MIT license. They must have the right to contribute the work and identify
third-party material and its license.

## Releases and compatibility

Public packages version together. A release manager follows
[`docs/release-process.md`](docs/release-process.md), and no source version,
changelog heading, CI run, tag, or registry package alone proves a complete
release. Release evidence must connect the exact commit, signed tag, package
set, schemas/tool manifests, checks, SBOM, and registry provenance.

The compatibility and deprecation rules are defined in
[`docs/compatibility.md`](docs/compatibility.md) and
[`docs/public-api-ownership.md`](docs/public-api-ownership.md). A maintainer may
ship an urgent security patch outside the normal cadence, but must still record
its scope and verification evidence.

## Deprecation

Deprecations require replacement guidance, a changelog entry, tests, and the
notice period in the compatibility policy. A minor release cannot remove a
public 1.x API. A security issue may require immediate safe rejection, but the
advisory must explain why the ordinary notice period was unsafe.

## Conduct and enforcement

All project spaces and representation are governed by
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Maintainers handling a report must
recuse themselves when they are directly involved or cannot be impartial. A
different maintainer reviews an appeal when one is available. Private reports
are shared only with people necessary to investigate and respond.

## Policy changes

Changes to this document use the RFC process. Pure link, spelling, or role-name
maintenance may use an ordinary pull request.
