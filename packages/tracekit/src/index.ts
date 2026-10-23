/** TRACEKIT: deterministic, allowlisted instrumentation for its synthetic checkout demo. */
export type ScenarioId = 'coupon-ghost' | 'shipping-drift';
export type LogicMode = 'buggy' | 'fixed';
export type DemoEvent =
  | { type: 'cart.quantity'; quantity: number }
  | { type: 'coupon.apply'; code: 'TRACE10' }
  | { type: 'coupon.remove' }
  | { type: 'shipping.select'; method: 'standard' | 'express' }
  | { type: 'checkout.submit' };

export type CheckoutState = {
  quantity: number;
  unitPriceCents: number;
  coupon: 'TRACE10' | null;
  shipping: 'standard' | 'express';
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  submitted: boolean;
};

export type TraceEntry = { seq: number; at: number; event: DemoEvent; state: CheckoutState };
export type Trace = {
  schemaVersion: 1;
  app: 'tracekit-demo';
  scenario: ScenarioId;
  logic: LogicMode;
  initialState: CheckoutState;
  entries: TraceEntry[];
};
export type Difference = { field: keyof CheckoutState; expected: unknown; actual: unknown };

export const MAX_EVENTS = 100;
export const MAX_JSON_BYTES = 128 * 1024;
export const SCHEMA_VERSION = 1 as const;

const STATE_KEYS = [
  'quantity',
  'unitPriceCents',
  'coupon',
  'shipping',
  'subtotalCents',
  'discountCents',
  'shippingCents',
  'totalCents',
  'submitted',
] as const satisfies readonly (keyof CheckoutState)[];

function fail(message: string): never {
  throw new Error(`Invalid trace: ${message}`);
}

function exactObject(
  value: unknown,
  keys: readonly string[],
  label: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) fail(`${label} must be a plain object.`);
  const own = Reflect.ownKeys(value);
  if (
    own.length !== keys.length ||
    own.some((key) => typeof key !== 'string' || !keys.includes(key))
  ) {
    fail(`${label} has missing or unsupported fields.`);
  }
  // Reject accessors: instrumentation records data, never executable properties.
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor) || !descriptor.enumerable)
      fail(`${label} must contain enumerable data fields only.`);
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, min: number, max: number, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    fail(`${label} must be an integer between ${min} and ${max}.`);
  }
}

function scenarioValue(value: unknown): asserts value is ScenarioId {
  if (value !== 'coupon-ghost' && value !== 'shipping-drift') fail('unsupported scenario.');
}

function logicValue(value: unknown): asserts value is LogicMode {
  if (value !== 'buggy' && value !== 'fixed') fail('unsupported logic mode.');
}

function stateValue(value: unknown): asserts value is CheckoutState {
  const data = exactObject(value, STATE_KEYS, 'state');
  integer(data.quantity, 1, 9, 'quantity');
  if (data.unitPriceCents !== 8900) fail('unsupported product price.');
  if (data.coupon !== null && data.coupon !== 'TRACE10') fail('unsupported coupon.');
  if (data.shipping !== 'standard' && data.shipping !== 'express')
    fail('unsupported shipping method.');
  integer(data.subtotalCents, 8900, 80100, 'subtotalCents');
  integer(data.discountCents, 0, 8010, 'discountCents');
  integer(data.shippingCents, 500, 1500, 'shippingCents');
  integer(data.totalCents, 0, 81600, 'totalCents');
  if (typeof data.submitted !== 'boolean') fail('submitted must be boolean.');
  if (data.subtotalCents !== data.quantity * 8900) fail('subtotal does not match quantity.');
  if (data.discountCents !== 0 && data.discountCents !== data.subtotalCents / 10) {
    fail('unsupported discount amount.');
  }
  if (data.coupon === 'TRACE10' && data.discountCents !== data.subtotalCents / 10) {
    fail('coupon does not match discount.');
  }
  if (data.shippingCents !== 500 && data.shippingCents !== 1500)
    fail('unsupported shipping price.');
  if (data.totalCents !== data.subtotalCents - data.discountCents + data.shippingCents) {
    fail('total does not match its components.');
  }
}

function eventValue(value: unknown): asserts value is DemoEvent {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    fail('event must be an object.');
  const typeDescriptor = Object.getOwnPropertyDescriptor(value, 'type');
  if (!typeDescriptor || !('value' in typeDescriptor))
    fail('event must contain a type data field.');
  const type: unknown = typeDescriptor.value;
  switch (type) {
    case 'cart.quantity': {
      const data = exactObject(value, ['type', 'quantity'], 'cart.quantity event');
      integer(data.quantity, 1, 9, 'quantity');
      return;
    }
    case 'coupon.apply': {
      const data = exactObject(value, ['type', 'code'], 'coupon.apply event');
      if (data.code !== 'TRACE10') fail('only the synthetic TRACE10 coupon is allowed.');
      return;
    }
    case 'shipping.select': {
      const data = exactObject(value, ['type', 'method'], 'shipping.select event');
      if (data.method !== 'standard' && data.method !== 'express')
        fail('unsupported shipping method.');
      return;
    }
    case 'coupon.remove':
    case 'checkout.submit':
      exactObject(value, ['type'], `${type} event`);
      return;
    default:
      fail('unsupported event type. Only synthetic checkout events are allowed.');
  }
}

function cloneEvent(event: DemoEvent): DemoEvent {
  return { ...event };
}

/** A fresh canonical demo state. All money is represented in integer cents. */
export function initialState(): CheckoutState {
  return {
    quantity: 1,
    unitPriceCents: 8900,
    coupon: null,
    shipping: 'standard',
    subtotalCents: 8900,
    discountCents: 0,
    shippingCents: 500,
    totalCents: 9400,
    submitted: false,
  };
}

/** Pure reducer. The buggy mode intentionally reproduces one named stale-value defect. */
export function reduceCheckout(
  state: CheckoutState,
  event: DemoEvent,
  mode: LogicMode,
  scenario: ScenarioId,
): CheckoutState {
  stateValue(state);
  eventValue(event);
  logicValue(mode);
  scenarioValue(scenario);
  return reduceValidated(state, event, mode, scenario);
}

function reduceValidated(
  state: CheckoutState,
  event: DemoEvent,
  mode: LogicMode,
  scenario: ScenarioId,
): CheckoutState {
  const next = { ...state, submitted: event.type === 'checkout.submit' };
  if (event.type === 'cart.quantity') next.quantity = event.quantity;
  if (event.type === 'coupon.apply') next.coupon = event.code;
  if (event.type === 'coupon.remove') next.coupon = null;
  if (event.type === 'shipping.select') next.shipping = event.method;
  // A submission in the legacy implementation accepts the displayed stale total.
  if (mode === 'buggy' && event.type === 'checkout.submit') return next;
  next.subtotalCents = next.quantity * next.unitPriceCents;
  next.discountCents = next.coupon === 'TRACE10' ? next.subtotalCents / 10 : 0;
  next.shippingCents = next.shipping === 'express' ? 1500 : 500;
  if (mode === 'buggy' && scenario === 'coupon-ghost' && event.type === 'coupon.remove') {
    next.discountCents = state.discountCents;
  }
  if (
    mode === 'buggy' &&
    scenario === 'shipping-drift' &&
    event.type === 'shipping.select' &&
    event.method === 'express'
  ) {
    next.shippingCents = state.shippingCents;
  }
  next.totalCents = next.subtotalCents - next.discountCents + next.shippingCents;
  return next;
}

/** Explicit instrumentation boundary: accepts only this demo's allowlisted event data. */
export function recordTrace(
  events: readonly DemoEvent[],
  scenario: ScenarioId,
  logic: LogicMode,
): Trace {
  scenarioValue(scenario);
  logicValue(logic);
  if (!Array.isArray(events) || events.length > MAX_EVENTS)
    fail(`events must be an array with at most ${MAX_EVENTS} entries.`);
  const entries: TraceEntry[] = [];
  let state = initialState();
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    eventValue(event);
    state = reduceValidated(state, event, logic, scenario);
    const seq = index + 1;
    entries.push({ seq, at: seq * 420, event: cloneEvent(event), state: { ...state } });
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    app: 'tracekit-demo',
    scenario,
    logic,
    initialState: initialState(),
    entries,
  };
}

/** Stable field-level differences, useful for assertions and timeline inspection. */
export function compareStates(expected: CheckoutState, actual: CheckoutState): Difference[] {
  stateValue(expected);
  stateValue(actual);
  return STATE_KEYS.filter((field) => expected[field] !== actual[field]).map((field) => ({
    field,
    expected: expected[field],
    actual: actual[field],
  }));
}

function validatedTrace(value: unknown): Trace {
  const data = exactObject(
    value,
    ['schemaVersion', 'app', 'scenario', 'logic', 'initialState', 'entries'],
    'trace',
  );
  if (data.schemaVersion !== SCHEMA_VERSION) fail('unsupported schemaVersion. Expected 1.');
  if (data.app !== 'tracekit-demo') fail('unsupported app. Expected tracekit-demo.');
  scenarioValue(data.scenario);
  logicValue(data.logic);
  stateValue(data.initialState);
  if (compareStates(initialState(), data.initialState).length > 0)
    fail('initial state must match the canonical demo state.');
  if (!Array.isArray(data.entries) || data.entries.length > MAX_EVENTS)
    fail(`entries must be an array with at most ${MAX_EVENTS} entries.`);
  const events: DemoEvent[] = [];
  let state = initialState();
  for (let index = 0; index < data.entries.length; index += 1) {
    const entry = exactObject(data.entries[index], ['seq', 'at', 'event', 'state'], 'entry');
    integer(entry.seq, 1, MAX_EVENTS, 'seq');
    integer(entry.at, 420, MAX_EVENTS * 420, 'at');
    if (entry.seq !== index + 1 || entry.at !== entry.seq * 420)
      fail('entry sequence and logical timestamp must match recording order.');
    eventValue(entry.event);
    stateValue(entry.state);
    state = reduceValidated(state, entry.event, data.logic, data.scenario);
    if (compareStates(state, entry.state).length > 0)
      fail(`snapshot ${index + 1} does not match deterministic replay.`);
    events.push(cloneEvent(entry.event));
  }
  // Reconstruct instead of returning caller-owned or imported snapshot objects.
  return recordTrace(events, data.scenario, data.logic);
}

/** Recompute every state from events. An optional mode enables a fixed-logic comparison. */
export function replayTrace(trace: Trace, mode?: LogicMode): CheckoutState[] {
  const safe = validatedTrace(trace);
  if (mode !== undefined) logicValue(mode);
  const selectedMode = mode ?? safe.logic;
  const states = [initialState()];
  let state = initialState();
  for (const entry of safe.entries) {
    state = reduceValidated(state, entry.event, selectedMode, safe.scenario);
    states.push({ ...state });
  }
  return states;
}

/** Validate and serialize a portable, versioned report with no user data fields. */
export function exportTrace(trace: Trace): string {
  const json = JSON.stringify(validatedTrace(trace), null, 2);
  if (new TextEncoder().encode(json).byteLength > MAX_JSON_BYTES) fail('JSON exceeds 128 KiB.');
  return json;
}

/** Strict, bounded JSON import. Unknown fields, tampered snapshots and versions fail closed. */
export function importTrace(json: string): Trace {
  if (typeof json !== 'string') fail('JSON must be a string.');
  if (json.length > MAX_JSON_BYTES || new TextEncoder().encode(json).byteLength > MAX_JSON_BYTES)
    fail('JSON exceeds 128 KiB.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(json) as unknown;
  } catch {
    fail('JSON could not be parsed.');
  }
  return validatedTrace(parsed);
}

/** A compact, reproducible synthetic bug report. Every call returns independent event objects. */
export function scenarioEvents(scenario: ScenarioId): DemoEvent[] {
  scenarioValue(scenario);
  if (scenario === 'coupon-ghost') {
    return [
      { type: 'cart.quantity', quantity: 2 },
      { type: 'coupon.apply', code: 'TRACE10' },
      { type: 'coupon.remove' },
      { type: 'checkout.submit' },
    ];
  }
  return [
    { type: 'cart.quantity', quantity: 2 },
    { type: 'shipping.select', method: 'express' },
    { type: 'checkout.submit' },
  ];
}
