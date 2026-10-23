import { describe, expect, it } from 'vitest';
import {
  exportTrace,
  importTrace,
  initialState,
  recordTrace,
  reduceCheckout,
  replayTrace,
  scenarioEvents,
  type Trace,
  type DemoEvent,
} from '../packages/tracekit/src/index';

const sample = (): Trace => recordTrace(scenarioEvents('coupon-ghost'), 'coupon-ghost', 'buggy');
const mutable = (): any => JSON.parse(exportTrace(sample()));

function rejects(value: unknown) {
  expect(() => importTrace(JSON.stringify(value))).toThrow(Error);
}

describe('untrusted trace import boundary', () => {
  it('round-trips only the instrumented synthetic schema', () => {
    for (const scenario of ['coupon-ghost', 'shipping-drift'] as const) {
      for (const mode of ['buggy', 'fixed'] as const) {
        const trace = recordTrace(scenarioEvents(scenario), scenario, mode);
        expect(importTrace(exportTrace(trace))).toEqual(trace);
      }
    }
  });

  it.each(['', '{', '<script>alert(1)</script>', 'null', '[]', 'true', '1', '"trace"'])(
    'rejects malformed or non-object JSON: %s',
    (json) => {
      expect(() => importTrace(json)).toThrow(Error);
    },
  );

  it.each([
    ['schemaVersion', 0],
    ['schemaVersion', 2],
    ['schemaVersion', '1'],
    ['app', 'other-site'],
    ['scenario', 'arbitrary-site'],
    ['logic', 'production'],
  ])('rejects unsupported discriminator %s=%s', (key, value) => {
    const trace = mutable();
    trace[key] = value;
    rejects(trace);
  });

  it('rejects all missing root keys', () => {
    for (const key of Object.keys(mutable())) {
      const trace = mutable();
      delete trace[key];
      rejects(trace);
    }
  });

  it('rejects unknown fields, including personal data, at every level', () => {
    for (const level of ['root', 'initial', 'entry', 'event', 'state']) {
      const trace = mutable();
      const target =
        level === 'root'
          ? trace
          : level === 'initial'
            ? trace.initialState
            : level === 'entry'
              ? trace.entries[0]
              : trace.entries[0][level];
      target.email = 'synthetic@example.invalid';
      rejects(trace);
    }
  });

  it.each(['__proto__', 'constructor', 'prototype'])(
    'rejects prototype-shaped key %s without prototype pollution',
    (key) => {
      const trace = mutable();
      Object.defineProperty(trace.entries[0].event, key, {
        value: { polluted: true },
        enumerable: true,
      });
      rejects(trace);
      expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    },
  );

  it('rejects event and state payloads with wrong types and nulls', () => {
    for (const value of [null, [], 'event', 1, true]) {
      const eventTrace = mutable();
      eventTrace.entries[0].event = value;
      rejects(eventTrace);
      const stateTrace = mutable();
      stateTrace.entries[0].state = value;
      rejects(stateTrace);
    }
  });

  it('rejects collection shape abuse and over 100 events', () => {
    for (const entries of [null, {}, 'events', new Array(101).fill(mutable().entries[0])]) {
      const trace = mutable();
      trace.entries = entries;
      rejects(trace);
    }
  });

  it('rejects input above the 128 KB resource limit before replay', () => {
    expect(() => importTrace(' '.repeat(128 * 1024 + 1))).toThrow(Error);
  });

  it('rejects noncanonical initial snapshots', () => {
    const trace = mutable();
    trace.initialState.totalCents += 1;
    rejects(trace);
    const withCoupon = mutable();
    withCoupon.initialState.coupon = 'TRACE10';
    rejects(withCoupon);
  });

  it('rejects forged snapshots even when their shape is valid', () => {
    for (const field of [
      'quantity',
      'unitPriceCents',
      'subtotalCents',
      'discountCents',
      'shippingCents',
      'totalCents',
    ]) {
      const trace = mutable();
      trace.entries[0].state[field] += 1;
      rejects(trace);
    }
    const trace = mutable();
    trace.entries[0].state.submitted = !trace.entries[0].state.submitted;
    rejects(trace);
  });

  it('rejects reordered, duplicate, negative, fractional and unsafe sequence/time metadata', () => {
    for (const field of ['seq', 'at']) {
      for (const value of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
        const trace = mutable();
        trace.entries[0][field] = value;
        rejects(trace);
      }
      const duplicate = mutable();
      duplicate.entries[1][field] = duplicate.entries[0][field];
      rejects(duplicate);
    }
  });

  it('rejects unknown events, coupons, shipping methods and invalid quantities', () => {
    const invalidEvents = [
      { type: 'dom.capture', html: '<input value="secret">' },
      { type: 'request.capture', url: 'https://example.invalid' },
      { type: 'coupon.apply', code: 'ANYTHING' },
      { type: 'shipping.select', method: 'teleport' },
      ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, null, '2'].map((quantity) => ({
        type: 'cart.quantity',
        quantity,
      })),
    ];
    for (const event of invalidEvents) {
      const trace = mutable();
      trace.entries[0].event = event;
      rejects(trace);
    }
  });
});

describe('runtime/export safety boundaries', () => {
  it('rejects non-enumerable fields before cloning can drop validated data', () => {
    for (const key of ['type', 'quantity']) {
      const event: DemoEvent = { type: 'cart.quantity', quantity: 2 };
      Object.defineProperty(event, key, { enumerable: false });
      expect(() => recordTrace([event], 'coupon-ghost', 'fixed')).toThrow(Error);
    }
    for (const key of ['quantity', 'coupon', 'totalCents']) {
      const state = initialState();
      Object.defineProperty(state, key, { enumerable: false });
      expect(() =>
        reduceCheckout(state, { type: 'checkout.submit' }, 'fixed', 'coupon-ghost'),
      ).toThrow(Error);
    }
    const trace = sample();
    Object.defineProperty(trace, 'schemaVersion', { enumerable: false });
    expect(() => exportTrace(trace)).toThrow(Error);
    expect(() => replayTrace(trace)).toThrow(Error);
  });

  it('does not let callers bypass validation with TypeScript casts', () => {
    expect(() =>
      recordTrace(
        [{ type: 'dom.capture', password: 'never-record' } as unknown as DemoEvent],
        'coupon-ghost',
        'buggy',
      ),
    ).toThrow(Error);
    expect(() =>
      recordTrace(new Array(101).fill({ type: 'checkout.submit' }), 'coupon-ghost', 'fixed'),
    ).toThrow(Error);
  });

  it('rejects tampered data when exported or replayed directly', () => {
    const trace = sample();
    trace.entries[0].state.totalCents += 1;
    expect(() => exportTrace(trace)).toThrow(Error);
    expect(() => replayTrace(trace)).toThrow(Error);
  });

  it('returns detached imported and replayed snapshots', () => {
    const source = sample();
    const before = exportTrace(source);
    const imported = importTrace(before);
    imported.entries[0].state.totalCents = 0;
    expect(exportTrace(source)).toBe(before);
    const states = replayTrace(source);
    states[0].quantity = 99;
    expect(source.initialState).toEqual(initialState());
    expect(exportTrace(source)).toBe(before);
  });
});
