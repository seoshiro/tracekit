import { describe, expect, it } from 'vitest';
import {
  compareStates,
  exportTrace,
  importTrace,
  initialState,
  MAX_EVENTS,
  recordTrace,
  reduceCheckout,
  replayTrace,
  scenarioEvents,
  type CheckoutState,
  type DemoEvent,
  type LogicMode,
  type ScenarioId,
  type Trace,
} from '../packages/tracekit/src/index';

describe('deterministic checkout reports', () => {
  it('starts with canonical integer-cent state and independent objects', () => {
    const first = initialState();
    first.quantity = 9;
    expect(initialState()).toEqual({
      quantity: 1,
      unitPriceCents: 8900,
      coupon: null,
      shipping: 'standard',
      subtotalCents: 8900,
      discountCents: 0,
      shippingCents: 500,
      totalCents: 9400,
      submitted: false,
    });
  });

  it.each([
    ['coupon-ghost', 16520, 18300, ['discountCents', 'totalCents']],
    ['shipping-drift', 18300, 19300, ['shippingCents', 'totalCents']],
  ] as const)(
    'reproduces %s and proves the fixed result',
    (scenario, buggyTotal, fixedTotal, fields) => {
      const trace = recordTrace(scenarioEvents(scenario), scenario, 'buggy');
      const actual = replayTrace(trace).at(-1)!;
      const expected = replayTrace(trace, 'fixed').at(-1)!;
      expect(actual.totalCents).toBe(buggyTotal);
      expect(expected.totalCents).toBe(fixedTotal);
      expect(actual.submitted).toBe(true);
      expect(compareStates(expected, actual).map((diff) => diff.field)).toEqual(fields);
      expect(replayTrace(trace)).toEqual([
        initialState(),
        ...trace.entries.map((entry) => entry.state),
      ]);
    },
  );

  it.each(['coupon-ghost', 'shipping-drift'] as const)(
    'has no mismatch under fixed %s logic',
    (scenario) => {
      const trace = recordTrace(scenarioEvents(scenario), scenario, 'fixed');
      expect(
        compareStates(replayTrace(trace, 'fixed').at(-1)!, replayTrace(trace).at(-1)!),
      ).toEqual([]);
      expect(
        trace.entries.every(
          (entry, index) => entry.seq === index + 1 && entry.at === (index + 1) * 420,
        ),
      ).toBe(true);
      expect(recordTrace(scenarioEvents(scenario), scenario, 'fixed')).toEqual(trace);
      expect(exportTrace(importTrace(exportTrace(trace)))).toBe(exportTrace(trace));
    },
  );

  it('records empty and maximum-length traces', () => {
    const empty = recordTrace([], 'coupon-ghost', 'buggy');
    expect(empty.entries).toEqual([]);
    expect(replayTrace(empty)).toEqual([initialState()]);
    const full = recordTrace(
      Array.from({ length: MAX_EVENTS }, (): DemoEvent => ({ type: 'checkout.submit' })),
      'coupon-ghost',
      'fixed',
    );
    expect(importTrace(exportTrace(full)).entries).toHaveLength(MAX_EVENTS);
    expect(() =>
      recordTrace(
        [...full.entries.map((entry) => entry.event), { type: 'checkout.submit' }],
        'coupon-ghost',
        'fixed',
      ),
    ).toThrow(/at most 100/);
  });

  it('does not mutate frozen inputs or share snapshots, replay output or restored objects', () => {
    const event = Object.freeze({ type: 'coupon.apply', code: 'TRACE10' } as const);
    const state = Object.freeze(initialState());
    const next = reduceCheckout(state, event, 'fixed', 'coupon-ghost');
    expect(state.coupon).toBeNull();
    expect(next.coupon).toBe('TRACE10');
    const input: DemoEvent[] = [
      { type: 'cart.quantity', quantity: 2 },
      { type: 'checkout.submit' },
    ];
    const trace = recordTrace(input, 'coupon-ghost', 'fixed');
    input[0] = { type: 'cart.quantity', quantity: 9 };
    expect(trace.entries[0].state.quantity).toBe(2);
    const replayed = replayTrace(trace);
    replayed[1]!.quantity = 8;
    expect(trace.entries[0].state.quantity).toBe(2);
    expect(replayed[2]!.quantity).toBe(2);
    trace.entries[0].state.quantity = 8;
    expect(trace.entries[1].state.quantity).toBe(2);
    expect(trace.initialState.submitted).toBe(false);
    const events = scenarioEvents('coupon-ghost');
    events[0] = { type: 'checkout.submit' };
    expect(scenarioEvents('coupon-ghost')[0]).toEqual({ type: 'cart.quantity', quantity: 2 });
  });

  it('clears submission when editing and clears stale coupon on a later cart update', () => {
    const trace = recordTrace(scenarioEvents('coupon-ghost'), 'coupon-ghost', 'buggy');
    const corrected = reduceCheckout(
      trace.entries.at(-1)!.state,
      { type: 'cart.quantity', quantity: 3 },
      'buggy',
      'coupon-ghost',
    );
    expect(corrected).toMatchObject({
      quantity: 3,
      discountCents: 0,
      totalCents: 27200,
      submitted: false,
    });
  });

  it('switches express back to standard and isolates each deliberate bug to its scenario', () => {
    const events: DemoEvent[] = [
      { type: 'shipping.select', method: 'express' },
      { type: 'shipping.select', method: 'standard' },
    ];
    const trace = recordTrace(events, 'coupon-ghost', 'buggy');
    expect(trace.entries.map((entry) => entry.state.shippingCents)).toEqual([1500, 500]);
    const couponTrace = recordTrace(scenarioEvents('coupon-ghost'), 'shipping-drift', 'buggy');
    expect(couponTrace.entries.at(-1)!.state.discountCents).toBe(0);
  });

  it('calculates fixed totals across all supported quantities, delivery methods and coupon states', () => {
    for (let quantity = 1; quantity <= 9; quantity += 1) {
      for (const method of ['standard', 'express'] as const) {
        for (const coupon of [false, true]) {
          const events: DemoEvent[] = [
            { type: 'cart.quantity', quantity },
            { type: 'shipping.select', method },
          ];
          if (coupon) events.push({ type: 'coupon.apply', code: 'TRACE10' });
          events.push({ type: 'checkout.submit' });
          const state = recordTrace(events, 'shipping-drift', 'fixed').entries.at(-1)!.state;
          const subtotal = 8900 * quantity;
          expect(state.totalCents).toBe(
            subtotal - (coupon ? subtotal / 10 : 0) + (method === 'express' ? 1500 : 500),
          );
          expect(Number.isSafeInteger(state.totalCents)).toBe(true);
        }
      }
    }
  });
});

describe('runtime boundaries', () => {
  const valid = (): Trace => recordTrace(scenarioEvents('coupon-ghost'), 'coupon-ghost', 'buggy');
  const jsonMutation = (mutate: (trace: Trace) => void): string => {
    const trace = valid();
    mutate(trace);
    return JSON.stringify(trace);
  };

  it.each([0, 10, -1, 1.5, NaN, Infinity])(
    'rejects invalid quantity %s during recording',
    (quantity) => {
      expect(() =>
        recordTrace([{ type: 'cart.quantity', quantity }], 'coupon-ghost', 'buggy'),
      ).toThrow(/quantity/);
    },
  );

  it('rejects unknown events, unknown fields, unsupported values and incorrect public inputs', () => {
    for (const event of [
      { type: 'network.request', url: 'https://example.com' },
      { type: 'coupon.apply', code: 'PERSONAL' },
      { type: 'shipping.select', method: 'secret' },
      { type: 'checkout.submit', email: 'synthetic@example.com' },
      null,
    ])
      expect(() => recordTrace([event as DemoEvent], 'coupon-ghost', 'buggy')).toThrow();
    expect(() => recordTrace([], 'unknown' as ScenarioId, 'buggy')).toThrow(/scenario/);
    expect(() => recordTrace([], 'coupon-ghost', 'unknown' as LogicMode)).toThrow(/logic/);
    expect(() => replayTrace(valid(), 'unknown' as LogicMode)).toThrow(/logic/);
    expect(() => scenarioEvents('unknown' as ScenarioId)).toThrow(/scenario/);
    expect(() =>
      reduceCheckout(
        { ...initialState(), totalCents: 0 },
        { type: 'checkout.submit' },
        'fixed',
        'coupon-ghost',
      ),
    ).toThrow(/total/);
    expect(() => compareStates(initialState(), { ...initialState(), quantity: 0 })).toThrow(
      /quantity/,
    );
  });

  it.each([
    (trace: Trace) => {
      (trace as unknown as Record<string, unknown>).password = 'example';
    },
    (trace: Trace) => {
      trace.schemaVersion = 2 as 1;
    },
    (trace: Trace) => {
      trace.app = 'other-app' as 'tracekit-demo';
    },
    (trace: Trace) => {
      trace.entries[0]!.seq = 2;
    },
    (trace: Trace) => {
      trace.entries[0]!.at = 421;
    },
    (trace: Trace) => {
      trace.entries[0]!.state.totalCents = 18301;
    },
    (trace: Trace) => {
      trace.initialState.submitted = true;
    },
    (trace: Trace) => {
      trace.entries[2]!.state.discountCents = 0;
      trace.entries[2]!.state.totalCents = 18300;
    },
    (trace: Trace) => {
      delete (trace.entries[0] as unknown as Record<string, unknown>).event;
    },
  ])('rejects modified report data %# on every trace boundary', (mutate) => {
    const trace = valid();
    mutate(trace);
    expect(() => importTrace(JSON.stringify(trace))).toThrow(/Invalid trace/);
    expect(() => exportTrace(trace)).toThrow(/Invalid trace/);
    expect(() => replayTrace(trace)).toThrow(/Invalid trace/);
  });

  it('rejects invalid JSON, primitives, arrays and excessive input', () => {
    for (const json of ['{', 'null', '[]', '1', '"hello"', '{}'])
      expect(() => importTrace(json)).toThrow(/Invalid trace/);
    expect(() => importTrace(' '.repeat(128 * 1024 + 1))).toThrow(/128 KiB/);
    expect(() => importTrace('\u{1F9EA}'.repeat(40000))).toThrow(/128 KiB/);
    const excessive = jsonMutation((trace) => {
      trace.entries.push(...Array.from({ length: 101 }, () => trace.entries[0]!));
    });
    expect(() => importTrace(excessive)).toThrow(/at most 100/);
  });

  it('rejects accessors without executing them and foreign prototypes', () => {
    let called = false;
    const event = Object.defineProperty({}, 'type', {
      enumerable: true,
      get: () => {
        called = true;
        return 'checkout.submit';
      },
    });
    expect(() => recordTrace([event as DemoEvent], 'coupon-ghost', 'buggy')).toThrow(/data field/);
    expect(called).toBe(false);
    const inherited = Object.create({ personal: 'data' }) as DemoEvent;
    Object.assign(inherited, { type: 'checkout.submit' });
    expect(() => recordTrace([inherited], 'coupon-ghost', 'buggy')).toThrow(/plain object/);
    const state = { ...initialState() } as CheckoutState & { [key: symbol]: string };
    state[Symbol('hidden')] = 'data';
    expect(() =>
      reduceCheckout(state, { type: 'checkout.submit' }, 'fixed', 'coupon-ghost'),
    ).toThrow(/unsupported fields/);
  });
});
