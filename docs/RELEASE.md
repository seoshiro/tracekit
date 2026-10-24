# Original v1.0 release evidence

This page records the original 23 October 2026 release. Its test counts and screenshots are historical. See the [24 October design and functional audit](audit/UIUX-2026-10-24.md) for current regression counts, repairs, limitations and release verification.

TRACEKIT v1.0 is a static application and a private repository-local TypeScript package. No npm publication, credentials, paid APIs, backend or database are involved.

## Local pre-release validation

- 59 unit/security tests pass, with one worker, including the final descriptor-boundary regression.
- TypeScript app check and core ESM/declaration build pass.
- Seven production-preview browser journeys pass in Chromium, one worker: guided repro/fix, manual recording/reset, quantity boundary, shipping defect, safe export/import/download, hostile and oversized JSON, keyboard dialog focus, RU/EN, mobile layout and reduced motion.
- Independent source audit: all reproduced P2 and important P3 findings fixed; see [AUDIT.md](AUDIT.md). An additional 1000 deterministic generated traces were checked by the independent reviewer.
- The current dependency installation reports zero known npm audit vulnerabilities.
- Visual inspection was performed in **Chrome on the user's computer**, through browser automation, including the actual $165.20 / $183.00 discrepancy and fixed PASS state. Screenshots below are actual rendered local production pages, not mockups.

| View                         | Screenshot                                 |
| ---------------------------- | ------------------------------------------ |
| Desktop overview             | [desktop.png](screenshots/desktop.png)     |
| Recorded defect and timeline | [workbench.png](screenshots/workbench.png) |
| Fixed logic                  | [fixed.png](screenshots/fixed.png)         |
| Russian mobile layout        | [mobile-ru.png](screenshots/mobile-ru.png) |

## Published verification

[Release workflow runs](https://github.com/seoshiro/tracekit/actions/workflows/release.yml) separate `quality`, `deploy`, and `live` jobs. A build passing `quality` alone is not a production verification claim.

The `live` job checks out the release SHA, rebuilds it, compares the local and remote manifests, verifies every served asset's SHA-256 and byte count, then runs all seven journeys against [the published app](https://seoshiro.github.io/tracekit/). Browser reports are uploaded as `live-browser-evidence` artifacts, retained seven days. A successful `live` job is the production verification evidence for that exact run and SHA.

The served [release manifest](https://seoshiro.github.io/tracekit/release-manifest.json) identifies the deployed source commit and asset hashes. The final user handoff records the exact verified commit, workflow URL, manifest SHA-256 and live screenshots. Production evidence is generated only after deployment; local screenshots above illustrate the tested build.

## Boundaries

The intentionally buggy checkout is part of the demonstration. The fixed mode is the expected reducer. The schema validates only this instrumented synthetic demo; arbitrary site replay, real payment and personal-data capture are outside the product. Import validation provides structural integrity, not authorship or a signed session attestation.
