# @tracekit/core

A dependency-free TypeScript package for explicitly instrumented synthetic checkout events. It is checked into this repository, marked private, and is not published to npm. There is no automatic capture, DOM observation, persistence or network activity.

```ts
import {
  recordTrace,
  scenarioEvents,
  replayTrace,
  compareStates,
  exportTrace,
  importTrace,
} from './src/index';

const report = recordTrace(scenarioEvents('coupon-ghost'), 'coupon-ghost', 'buggy');
const actual = replayTrace(report).at(-1)!;
const expected = replayTrace(report, 'fixed').at(-1)!;
const differences = compareStates(expected, actual);
// discountCents: expected 0, actual 1780; totalCents: expected 18300, actual 16520.
const portable = exportTrace(report);
const restored = importTrace(portable);
```

The reducer uses integer cents, explicit inputs, a canonical initial state, and logical timestamps (`seq * 420`). Replay returns the initial state followed by one newly allocated state per event. Recording, exporting and replaying reject unknown event fields, invalid enums, amounts or modes. Import additionally checks the schema version, strict object shape, snapshot integrity and recording order. Imported snapshots are validated and then reconstructed from events.

`cart.quantity` permits integers 1 through 9. `coupon.apply` permits only `TRACE10`. `shipping.select` permits `standard` or `express`. The remaining events are `coupon.remove` and `checkout.submit`. A trace supports up to 100 events and import supports at most 128 KiB of UTF-8 JSON. Schema version 1 stores no arbitrary text, URLs, passwords, cookies, request bodies or identifiers.

The intentionally buggy reducer represents two small stale-value defects; the fixed reducer recalculates the complete total on every event. A later cart update can clear a stale value, just as it can in a real application. This library demonstrates reproducible reports for one instrumented application; it is not a universal replay SDK. Integrating other applications requires defining a separate explicit event schema, reducer and validation contract.

Validation errors are thrown as `Error` instances. Callers should present an import failure without replacing the existing report. State snapshots are evidence of deterministic execution, not authenticity proofs or signatures.
