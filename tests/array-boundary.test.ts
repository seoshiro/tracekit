import { expect, it } from 'vitest';
import { recordTrace, exportTrace, replayTrace } from '../packages/tracekit/src';
import type { DemoEvent } from '../packages/tracekit/src';

it('rejects accessor, hidden, inherited and sparse event indexes without execution', () => {
  let calls = 0;
  const accessor: DemoEvent[] = [];
  Object.defineProperty(accessor, '0', {
    enumerable: true,
    get() {
      calls++;
      return { type: 'checkout.submit' };
    },
  });
  const hidden: DemoEvent[] = [];
  Object.defineProperty(hidden, '0', { value: { type: 'checkout.submit' } });
  const inherited: DemoEvent[] = new Array(1);
  Object.setPrototypeOf(inherited, { 0: { type: 'checkout.submit' }, __proto__: Array.prototype });
  for (const events of [accessor, hidden, inherited, new Array<DemoEvent>(1)]) {
    expect(() => recordTrace(events, 'coupon-ghost', 'fixed')).toThrow();
  }
  expect(calls).toBe(0);
});

it('guards the replay and export collection boundary as well as individual objects', () => {
  for (const operation of [exportTrace, replayTrace]) {
    let calls = 0;
    const trace = recordTrace([{ type: 'checkout.submit' }], 'coupon-ghost', 'fixed');
    const entry = trace.entries[0];
    Object.defineProperty(trace.entries, '0', {
      enumerable: true,
      get() {
        calls++;
        return entry;
      },
    });
    expect(() => operation(trace)).toThrow();
    expect(calls).toBe(0);
  }
});
