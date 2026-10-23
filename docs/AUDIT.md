# Independent QA and security audit

Status: independent source audit complete, including the final SDK descriptor follow-up. All reproduced P2 and important P3 findings are resolved. Published-site results are reported separately in the release evidence.

## Scope

Review the typed event/replay library, checkout demonstration, browser import/export, localization, accessibility, dependency/build surface and release evidence. Only allowlisted synthetic demo events belong in a trace. Universal DOM/session recording is outside the product scope.

## Verification performed

- Independent adversarial unit coverage for malformed JSON, schema/version/enum mismatches, missing and extra keys, personal-data injection, prototype keys, resource bounds, metadata order and forged snapshots.
- Post-implementation source audit of core, UI, localization, CSS, configuration, README, manifest scripts and release workflow.
- Integrator-run local production checks: **59 unit/security tests passed**, core declarations and production build passed, **7/7 Chromium E2E tests passed** with one worker (11.4 seconds reported for the local browser run). The final descriptor regression is included in the 59-test result; exact-commit browser checks are also run by CI.
- Browser journeys cover guided reproduction, timeline/fixed replay, manual recording/reset, quantity bounds, both defect scenarios, JSON round-trip/download, hostile and oversized imports, Escape/focus return, RU/EN and a 390 px viewport with reduced motion. The first journey rejects page exceptions, browser console errors and failed requests.

## Findings

| ID    | Severity | Finding                                                                                                                                                    | Status                                                                                                                                                                         |
| ----- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TK-01 | P2       | Quantity increment was enabled at quantity 9 although the core only accepts 1–9. Clicking once more sends quantity 10 and throws during rendering.         | Fixed: increment is disabled at 9. The boundary E2E passed without a page error.                                                                                               |
| TK-02 | P3       | Initial release verifier checked the remote manifest's claimed commit and asset self-consistency without comparing a fresh local build.                    | Fixed: live CI rebuilds the expected commit; verification compares local and remote file paths, byte lengths and SHA-256 before downloading and hashing every published asset. |
| TK-03 | P3       | Essential small text had insufficient contrast, including event detail (2.85:1), coupon hint (2.49:1), scope copy (2.43:1) and divergence status (3.41:1). | Fixed and recalculated: 5.06:1, 5.21:1, 4.89:1 and 5.45:1 respectively. Small 7–8 px UI text was promoted to 9 px.                                                             |
| TK-04 | P3       | An empty data-URL CSS import served no purpose and conflicted with production CSP.                                                                         | Removed. Production E2E's console-error check passed.                                                                                                                          |
| TK-05 | P3       | README scenario labels and release-check ordering differed from the actual UI/workflow.                                                                    | Aligned with the implemented labels and source-to-manifest-to-live-test order.                                                                                                 |

TK-06 (important P3, fixed): non-enumerable required fields passed the descriptor checks but were lost by object spread. A non-enumerable event `type` produced a recorded empty event, and non-enumerable state `quantity` produced `NaN` totals. JSON imports were unaffected because JSON-parsed fields are enumerable. The validator now requires enumerable data descriptors. The independent regression covers event, state and trace boundaries and passed in the integrator's 59-test run. The reviewer also reran the original reproduction through native Node: all seven descriptor cases were rejected, while a valid trace retained its expected result.

No unresolved reproducible P1/P2 or important P3 findings remain in the audited source.

This is a focused review of this demonstration, not a certification of arbitrary integrations or trace authenticity.

## Core evidence

The independent reviewer inspected every public boundary and the private validator/reducer in `packages/tracekit/src/index.ts`. The library rejects accessors, foreign prototypes, symbol/extra/missing keys, unsupported events and enums, unsafe integers, excessive JSON and event collections. Imported snapshots are checked against deterministic replay and reconstructed into fresh objects. No DOM, network, storage, cookies, password fields or arbitrary capture API are present.

In addition to the committed adversarial unit suite, an independent native Node check generated 1,000 event sequences with deterministic seed 1729 across both scenarios and modes, with 0–100 mixed events per trace. All traces passed stable export/import and incremental-reducer versus full-replay equality. Result: **1,000 passed, 0 failed**. No browser was launched by the reviewer.

## UI and build source evidence

The reviewer inspected `src/App.tsx`, `src/i18n.ts`, `src/styles.css`, the design context, Vite/TypeScript/Vitest/Playwright configuration, CSP, the release workflow and manifest scripts. React renders imported content as text. Native `dialog` supplies modal focus containment; Escape and focus return have explicit handlers. JSON file reads check the byte cap before reading. The core's strict validator is the only import boundary, and a successful import replays and reconstructs events. No external fonts, analytics, payment integrations, account creation, network capture or DOM capture are present in the application source.

The final CSS has visible keyboard focus, a stacked narrow-screen layout, bounded scroll containers, wrapping field content and a reduced-motion media query. Final color pairs were recalculated directly from the source using the sRGB relative-luminance contrast formula. The local-development Vite plugin removes the restrictive meta CSP only during `serve`, allowing the local HMR preamble/WebSocket; production builds retain the policy from `index.html`.

CI separates quality, Pages deployment and live verification, with one browser worker. Actions use pinned commits. Deployment requires the quality job; the live job rebuilds the expected source, compares manifests and checks served asset bytes, then runs the full browser suite at the public URL. Generated outputs, local coordination/design files, environment files and browser reports are ignored by the source repository.

The reviewer also inspected the final formatting delta: readable Prettier-formatted source, a pinned formatter dependency and `format:check` in CI. The development-only CSP matcher handles the formatted multiline meta tag and still applies only during `serve`. The integrator reported a passing development smoke check with console/network assertions. The final E2E source includes page-error, console-error and request-failure checks; a duplicate console listener was removed during the final review. No browser or package manager was run by the reviewer for this follow-up.

The 21st UI review skill was read and applied. The deterministic CLI review could not run because no `21st` command or project binary was installed. The reviewer continued with direct source inspection and committed browser regression tests. No browser was launched by the independent reviewer; the integrator ran browsers sequentially and owns the actual screenshots and published-site verification.

## Release boundary

Local test success is not evidence that production was deployed or verified. The exact published commit, manifest checks, CI outcome, live E2E results and real screenshots belong in `docs/RELEASE.md` and the final release report. This audit does not substitute a green build for those checks.
