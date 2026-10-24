import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleDot,
  Code2,
  FileJson,
  GitBranch,
  Globe2,
  Keyboard,
  Layers2,
  LockKeyhole,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import {
  compareStates,
  exportTrace,
  importTrace,
  recordTrace,
  replayTrace,
  scenarioEvents,
} from '../packages/tracekit/src';
import type { CheckoutState, DemoEvent, LogicMode, ScenarioId } from '../packages/tracekit/src';
import { copy } from './i18n';
import type { Language } from './i18n';
import './styles.css';
import './refinements.css';

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
const stateKeys: (keyof CheckoutState)[] = [
  'quantity',
  'unitPriceCents',
  'coupon',
  'shipping',
  'subtotalCents',
  'discountCents',
  'shippingCents',
  'totalCents',
  'submitted',
];

function KeyBoardArt() {
  return (
    <div className="keyboard-art" aria-hidden="true">
      <div className="keyboard-body">
        <div className="key-indicator" />
        {Array.from({ length: 44 }, (_, i) => (
          <span key={i} className={`key key-${i}`} />
        ))}
        <span className="key-space" />
      </div>
      <span className="keyboard-caption">STUDIO / 001</span>
    </div>
  );
}

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [scenario, setScenario] = useState<ScenarioId>('coupon-ghost');
  const [logic, setLogic] = useState<LogicMode>('buggy');
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [dialogTab, setDialogTab] = useState<'export' | 'import' | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [readingFile, setReadingFile] = useState(false);
  const fileSequence = useRef(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const t = copy[language];

  const trace = useMemo(() => recordTrace(events, scenario, logic), [events, scenario, logic]);
  const actualStates = useMemo(() => replayTrace(trace), [trace]);
  const expectedStates = useMemo(() => replayTrace(trace, 'fixed'), [trace]);
  const actual = actualStates[cursor] ?? actualStates[0]!;
  const expected = expectedStates[cursor] ?? expectedStates[0]!;
  const differences = compareStates(expected, actual);
  const divergent = differences.length > 0;
  const firstDivergence = actualStates.findIndex(
    (state, index) => compareStates(expectedStates[index]!, state).length > 0,
  );
  const traceJson = useMemo(() => exportTrace(trace), [trace]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    if (!playing) return;
    if (cursor >= events.length) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setCursor((value) => value + 1), 650);
    return () => window.clearTimeout(timer);
  }, [playing, cursor, events.length]);
  useEffect(() => {
    if (dialogTab && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [dialogTab]);

  function stopAndSelect(index: number) {
    setPlaying(false);
    setCursor(index);
  }
  function reset(nextScenario: ScenarioId = scenario) {
    setScenario(nextScenario);
    setEvents([]);
    setCursor(0);
    setPlaying(false);
    setNotice('');
  }
  function runDemo() {
    const sequence = scenarioEvents(scenario);
    setEvents(sequence);
    setCursor(sequence.length);
    setPlaying(false);
    setNotice('');
    focusComparison();
  }
  function focusComparison() {
    window.requestAnimationFrame(() => {
      const comparison = document.getElementById('comparison-title');
      comparison?.focus({ preventScroll: true });
      comparison?.scrollIntoView({ block: 'nearest' });
    });
  }
  function dispatch(event: DemoEvent) {
    if (cursor >= 100) {
      setNotice(t.limit);
      return;
    }
    const next = [...events.slice(0, cursor), event];
    setEvents(next);
    setCursor(next.length);
    setPlaying(false);
    setNotice('');
  }
  function openJson(tab: 'export' | 'import') {
    invalidateFile();
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setError('');
    setDialogTab(tab);
  }
  function closeJson() {
    invalidateFile();
    dialogRef.current?.close();
    setDialogTab(null);
    setError('');
    openerRef.current?.focus();
  }
  function loadJson() {
    if (readingFile) return;
    try {
      const imported = importTrace(jsonInput);
      setScenario(imported.scenario);
      setLogic(imported.logic);
      setEvents(imported.entries.map((entry) => entry.event));
      setCursor(imported.entries.length);
      setPlaying(false);
      setNotice(t.importSuccess);
      setJsonInput('');
      closeJson();
    } catch {
      setError(t.invalid);
    }
  }
  function invalidateFile() {
    fileSequence.current++;
    setReadingFile(false);
  }
  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const operation = ++fileSequence.current;
    setReadingFile(false);
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 128 * 1024) {
      setError(t.tooLarge);
      return;
    }
    try {
      setReadingFile(true);
      const text = await file.text();
      if (operation !== fileSequence.current) return;
      setJsonInput(text);
      setError('');
    } catch {
      if (operation !== fileSequence.current) return;
      setError(t.fileError);
    } finally {
      if (operation === fileSequence.current) setReadingFile(false);
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([traceJson], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `tracekit-${scenario}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function eventTitle(event: DemoEvent) {
    switch (event.type) {
      case 'cart.quantity':
        return t.eventQuantity;
      case 'coupon.apply':
        return t.eventApply;
      case 'coupon.remove':
        return t.eventRemove;
      case 'shipping.select':
        return t.eventShipping;
      case 'checkout.submit':
        return t.eventSubmit;
    }
  }
  function eventDetail(event: DemoEvent) {
    switch (event.type) {
      case 'cart.quantity':
        return `quantity: ${event.quantity}`;
      case 'coupon.apply':
        return 'code: TRACE10';
      case 'coupon.remove':
        return 'coupon: null';
      case 'shipping.select':
        return `method: ${event.method}`;
      case 'checkout.submit':
        return 'submitted: true';
    }
  }
  function valueLabel(key: keyof CheckoutState, value: unknown) {
    if (key.endsWith('Cents')) return money(value as number);
    if (value === null) return t.none;
    if (typeof value === 'boolean') return value ? t.yes : t.no;
    if (key === 'shipping') return value === 'express' ? t.expressShort : t.standardShort;
    return String(value);
  }
  const fieldLabels: Record<keyof CheckoutState, string> = {
    quantity: t.quantityField,
    unitPriceCents: t.unitPriceCents,
    coupon: t.couponField,
    shipping: t.shippingField,
    subtotalCents: t.subtotalCents,
    discountCents: t.discountCents,
    shippingCents: t.shippingCents,
    totalCents: t.totalCents,
    submitted: t.submittedField,
  };

  return (
    <>
      <a className="skip-link" href="#workbench">
        {t.skip}
      </a>
      <header className="site-header">
        <a className="brand" href="#" aria-label="TRACEKIT">
          <span className="brand-mark">
            <span />
            <span />
            <span />
            <span />
          </span>
          TRACEKIT<span className="version">v1.0</span>
        </a>
        <div className="header-center">
          <span className="tiny-square" />
          {t.workspace}
        </div>
        <nav className="header-actions" aria-label={t.workspace}>
          <a href="https://github.com/seoshiro/tracekit#readme" target="_blank" rel="noreferrer">
            {t.api}
            <ArrowUpRight size={14} />
          </a>
          <span className="header-divider" />
          <button
            data-testid="language-toggle"
            className="language-button"
            onClick={() => setLanguage(language === 'en' ? 'ru' : 'en')}
            aria-label={language === 'en' ? 'Switch to Russian' : 'Переключить на английский'}
          >
            <Globe2 size={15} />
            {language === 'en' ? 'EN' : 'RU'}
          </button>
        </nav>
      </header>
      <main>
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <div className="eyebrow">
              <span />
              {t.eyebrow}
            </div>
            <h1 id="page-title">
              {t.titleA}
              <br />
              <span>{t.titleB}</span>
            </h1>
            <p>{t.intro}</p>
            <div className="intro-actions">
              <button data-testid="run-demo" className="button primary" onClick={runDemo}>
                <Play size={15} fill="currentColor" />
                {t.run}
                <ArrowRight size={16} />
              </button>
              <button
                className="button text-button"
                aria-expanded={showGuide}
                aria-controls="quick-guide"
                onClick={() => setShowGuide((value) => !value)}
              >
                {t.how}
                <ChevronRight size={15} className={showGuide ? 'rotate' : ''} />
              </button>
            </div>
          </div>
          <div className="trace-graphic" aria-hidden="true">
            <div className="graphic-label">
              <GitBranch size={13} />
              TRACE / 001
            </div>
            <div className="trace-line">
              <span className="trace-node">
                <Check size={13} />
              </span>
              <i />
              <span className="trace-node">
                <Check size={13} />
              </span>
              <i />
              <span className="trace-node bug-node">
                <X size={14} />
              </span>
              <i className="dashed" />
              <span className="trace-node end-node">
                <CheckCheck size={15} />
              </span>
            </div>
            <div className="graphic-bottom">
              <span>EVENT → STATE → EVIDENCE</span>
              <span className="graphic-tag">REPLAYABLE</span>
            </div>
            <div className="graphic-code">
              <span>trace.replay(</span>
              <b>'fixed'</b>
              <span>)</span>
              <span className="code-cursor" />
            </div>
          </div>
        </section>
        {showGuide && (
          <section className="quick-guide" id="quick-guide">
            {[
              [t.step1, t.step1body],
              [t.step2, t.step2body],
              [t.step3, t.step3body],
            ].map(([heading, body]) => (
              <div key={heading}>
                <b>{heading}</b>
                <p>{body}</p>
              </div>
            ))}
          </section>
        )}

        <section className="scenario-strip" aria-label={t.scenario}>
          <div className="scenario-label">
            <Layers2 size={15} />
            {t.scenario}
          </div>
          <button
            data-testid="scenario-coupon"
            className={`scenario-button ${scenario === 'coupon-ghost' ? 'active' : ''}`}
            onClick={() => reset('coupon-ghost')}
            aria-pressed={scenario === 'coupon-ghost'}
          >
            <span className="scenario-number">01</span>
            <span>
              <strong>{t.couponName}</strong>
              <small>{t.couponDesc}</small>
            </span>
            {scenario === 'coupon-ghost' && <CircleCheck size={17} />}
          </button>
          <button
            data-testid="scenario-shipping"
            className={`scenario-button ${scenario === 'shipping-drift' ? 'active' : ''}`}
            onClick={() => reset('shipping-drift')}
            aria-pressed={scenario === 'shipping-drift'}
          >
            <span className="scenario-number">02</span>
            <span>
              <strong>{t.shippingName}</strong>
              <small>{t.shippingDesc}</small>
            </span>
            {scenario === 'shipping-drift' && <CircleCheck size={17} />}
          </button>
        </section>

        <section className="workbench" id="workbench" aria-label={t.workbench}>
          <div className="workbench-top">
            <div className="workbench-title">
              <Terminal size={17} />
              <strong>{t.workbench}</strong>
              <span className="workbench-slash">/</span>
              <span className="demo-label">{t.instrumented}</span>
            </div>
            <span className="recording">
              <span />
              {t.live}
            </span>
          </div>
          <div className="workbench-toolbar">
            <div className="logic-control">
              <button
                role="switch"
                aria-checked={logic === 'fixed'}
                aria-label={t.logicLabel}
                data-testid="logic-toggle"
                className={`switch ${logic === 'fixed' ? 'on' : ''}`}
                onClick={() => {
                  setLogic(logic === 'buggy' ? 'fixed' : 'buggy');
                  setPlaying(false);
                }}
              >
                <span />
              </button>
              <span>{logic === 'buggy' ? t.buggy : t.fixed}</span>
              <span className={`logic-dot ${logic}`} />
            </div>
            <div className="toolbar-actions">
              <button
                className="tool-button"
                data-testid="reset"
                aria-label={t.reset}
                onClick={() => reset()}
              >
                <RotateCcw size={14} />
                <span>{t.reset}</span>
              </button>
              <span className="toolbar-divider" />
              <button
                className="tool-button"
                data-testid="json-import"
                onClick={() => openJson('import')}
              >
                <Upload size={14} />
                <span>{t.import}</span>
              </button>
              <button
                className="tool-button export-button"
                data-testid="json-export"
                onClick={() => openJson('export')}
              >
                <ArrowDownToLine size={14} />
                <span>{t.export}</span>
              </button>
            </div>
          </div>
          <div className="workspace-grid">
            <section className="timeline-panel" aria-labelledby="timeline-title">
              <div className="panel-heading">
                <h2 id="timeline-title">{t.timeline}</h2>
                <span className="count-badge">{events.length.toString().padStart(2, '0')}</span>
              </div>
              <div className="timeline-list">
                <button
                  className={`timeline-item initial-item ${cursor === 0 ? 'selected' : ''}`}
                  data-testid="timeline-step-0"
                  aria-current={cursor === 0 ? 'step' : undefined}
                  onClick={() => stopAndSelect(0)}
                >
                  <span className="timeline-node">
                    <CircleDot size={13} />
                  </span>
                  <span className="event-copy">
                    <strong>{t.initial}</strong>
                    <small>{t.initialDetail}</small>
                  </span>
                  <span className="event-time">0.00s</span>
                </button>
                {trace.entries.map((entry, index) => {
                  const isBad =
                    compareStates(expectedStates[index + 1]!, actualStates[index + 1]!).length > 0;
                  return (
                    <button
                      key={entry.seq}
                      className={`timeline-item ${cursor === index + 1 ? 'selected' : ''} ${isBad ? 'diverged' : ''}`}
                      data-testid={`timeline-step-${index + 1}`}
                      aria-current={cursor === index + 1 ? 'step' : undefined}
                      onClick={() => stopAndSelect(index + 1)}
                    >
                      <span className="timeline-node">
                        {isBad ? <X size={12} /> : <Check size={12} />}
                      </span>
                      <span className="event-copy">
                        <strong>{eventTitle(entry.event)}</strong>
                        <small>{eventDetail(entry.event)}</small>
                      </span>
                      <span className="event-time">{(entry.at / 1000).toFixed(2)}s</span>
                    </button>
                  );
                })}
                {events.length === 0 && (
                  <div className="empty-timeline">
                    <div className="empty-icon">
                      <GitBranch size={26} />
                    </div>
                    <strong>{t.emptyTitle}</strong>
                    <p>{t.emptyBody}</p>
                    <span className="empty-arrow">↗</span>
                  </div>
                )}
              </div>
              <div className="timeline-bottom">
                <span className="micro-label">{t.replay}</span>
                <div className="replay-controls">
                  <button
                    className="icon-button"
                    aria-label={t.previous}
                    onClick={() => stopAndSelect(Math.max(0, cursor - 1))}
                    disabled={cursor === 0}
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    className="replay-play"
                    data-testid="replay-play"
                    aria-label={playing ? t.pause : t.play}
                    onClick={() => {
                      if (playing) setPlaying(false);
                      else {
                        if (cursor >= events.length) setCursor(0);
                        setPlaying(true);
                      }
                    }}
                    disabled={events.length === 0}
                  >
                    {playing ? (
                      <Pause size={15} fill="currentColor" />
                    ) : (
                      <Play size={15} fill="currentColor" />
                    )}
                  </button>
                  <button
                    className="icon-button"
                    aria-label={t.next}
                    onClick={() => stopAndSelect(Math.min(events.length, cursor + 1))}
                    disabled={cursor === events.length}
                  >
                    <ChevronRight size={17} />
                  </button>
                  <span className="replay-position">
                    {cursor.toString().padStart(2, '0')}
                    <span>/ {events.length.toString().padStart(2, '0')}</span>
                  </span>
                </div>
                <div className="replay-progress">
                  <span
                    style={{ width: `${events.length ? (cursor / events.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </section>

            <section className="checkout-panel" aria-labelledby="checkout-title">
              <div className="panel-heading">
                <h2 id="checkout-title">{t.checkout}</h2>
                <span className="panel-icon">
                  <Keyboard size={15} />
                </span>
              </div>
              <div className="checkout-content">
                <div className="product-card">
                  <KeyBoardArt />
                  <div className="product-details">
                    <div>
                      <h3>{t.product}</h3>
                      <p>{t.productSub}</p>
                    </div>
                    <strong>{money(actual.unitPriceCents)}</strong>
                  </div>
                </div>
                <div className="quantity-row">
                  <label>{t.quantity}</label>
                  <div className="quantity-control">
                    <button
                      aria-label={t.decrease}
                      data-testid="quantity-minus"
                      disabled={actual.quantity <= 1}
                      onClick={() =>
                        dispatch({ type: 'cart.quantity', quantity: actual.quantity - 1 })
                      }
                    >
                      <Minus size={13} />
                    </button>
                    <output aria-label={t.quantity}>{actual.quantity}</output>
                    <button
                      aria-label={t.increase}
                      data-testid="quantity-plus"
                      disabled={actual.quantity >= 9}
                      onClick={() =>
                        dispatch({ type: 'cart.quantity', quantity: actual.quantity + 1 })
                      }
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
                <div className="coupon-row">
                  <span>{t.coupon}</span>
                  <button
                    data-testid="coupon-toggle"
                    className={`coupon-button ${actual.coupon ? 'applied' : ''}`}
                    onClick={() =>
                      dispatch(
                        actual.coupon
                          ? { type: 'coupon.remove' }
                          : { type: 'coupon.apply', code: 'TRACE10' },
                      )
                    }
                  >
                    {actual.coupon ? <X size={12} /> : <Plus size={12} />}
                    {actual.coupon ? t.remove : t.apply}
                  </button>
                </div>
                <p className="coupon-hint">{t.couponHint}</p>
                <label className="shipping-label" htmlFor="shipping">
                  {t.shipping}
                </label>
                <select
                  id="shipping"
                  data-testid="shipping-select"
                  value={actual.shipping}
                  onChange={(event) =>
                    dispatch({
                      type: 'shipping.select',
                      method: event.target.value as 'standard' | 'express',
                    })
                  }
                >
                  <option value="standard">{t.standard}</option>
                  <option value="express">{t.express}</option>
                </select>
                <dl className="checkout-summary">
                  <div>
                    <dt>{t.subtotal}</dt>
                    <dd>{money(actual.subtotalCents)}</dd>
                  </div>
                  <div>
                    <dt>{t.discount}</dt>
                    <dd className={actual.discountCents ? 'discount-value' : ''}>
                      {actual.discountCents ? '−' : ''}
                      {money(actual.discountCents)}
                    </dd>
                  </div>
                  <div>
                    <dt>{t.delivery}</dt>
                    <dd>{money(actual.shippingCents)}</dd>
                  </div>
                  <div className="total-row">
                    <dt>{t.total}</dt>
                    <dd data-testid="checkout-total">{money(actual.totalCents)}</dd>
                  </div>
                </dl>
                <button
                  data-testid="checkout-submit"
                  className={`checkout-submit ${actual.submitted ? 'is-submitted' : ''}`}
                  disabled={actual.submitted}
                  onClick={() => dispatch({ type: 'checkout.submit' })}
                >
                  {actual.submitted ? <CheckCheck size={15} /> : null}
                  {actual.submitted ? t.submitted : t.submit}
                  {!actual.submitted && <ArrowRight size={15} />}
                </button>
                <p className="no-payment">
                  <LockKeyhole size={10} />
                  {t.noPayment}
                </p>
                <p className="branch-note">
                  <GitBranch size={11} />
                  {t.branch}
                </p>
              </div>
            </section>

            <section
              className={`comparison-panel ${divergent ? 'has-divergence' : ''}`}
              aria-labelledby="comparison-title"
            >
              <div className="panel-heading">
                <h2 id="comparison-title" tabIndex={-1}>
                  {t.comparison}
                </h2>
                <span className="panel-icon">
                  <Braces size={15} />
                </span>
              </div>
              <div className="comparison-content">
                <div
                  data-testid="diff-status"
                  role="status"
                  className={`diff-status ${divergent ? 'bad' : 'good'}`}
                >
                  {divergent ? <X size={15} /> : <Check size={15} />}
                  <strong>{divergent ? t.mismatch : t.match}</strong>
                  <span>{divergent ? 'DIFF' : 'PASS'}</span>
                </div>
                <p className="comparison-description">{divergent ? t.mismatchBody : t.matchBody}</p>
                {divergent && logic === 'buggy' && (
                  <button
                    className="button comparison-fix"
                    data-testid="compare-fix"
                    onClick={() => {
                      setPlaying(false);
                      setLogic('fixed');
                      focusComparison();
                    }}
                  >
                    <CheckCheck size={15} />
                    {language === 'en' ? 'Replay with fixed logic' : 'Повторить с исправлением'}
                  </button>
                )}
                <div className="totals-comparison">
                  <div>
                    <span>{t.expected}</span>
                    <strong data-testid="expected-total">{money(expected.totalCents)}</strong>
                    <small>fixed.reducer</small>
                  </div>
                  <div className={divergent ? 'actual-bad' : ''}>
                    <span>{t.actual}</span>
                    <strong data-testid="actual-total">{money(actual.totalCents)}</strong>
                    <small>{logic}.reducer</small>
                  </div>
                </div>
                <div className={`delta-row ${divergent ? 'delta-bad' : ''}`}>
                  <span>{t.delta}</span>
                  <strong>
                    {actual.totalCents - expected.totalCents > 0
                      ? '+'
                      : actual.totalCents - expected.totalCents < 0
                        ? '−'
                        : ''}
                    {money(Math.abs(actual.totalCents - expected.totalCents))}
                  </strong>
                </div>
                <div className="state-diff">
                  <div className="state-diff-heading">
                    <span>
                      <Code2 size={13} />
                      {divergent ? 'state.diff' : 'state.snapshot'}
                    </span>
                    <span>{cursor.toString().padStart(2, '0')}</span>
                  </div>
                  {(divergent
                    ? differences.map((d) => d.field)
                    : (['coupon', 'shipping', 'totalCents'] as (keyof CheckoutState)[])
                  ).map((key) => (
                    <div className={`diff-field ${divergent ? 'changed' : ''}`} key={key}>
                      <code>{key}</code>
                      <div>
                        {divergent ? (
                          <>
                            <del>{valueLabel(key, expected[key])}</del>
                            <ArrowRight size={11} />
                            <b>{valueLabel(key, actual[key])}</b>
                          </>
                        ) : (
                          <span>{valueLabel(key, actual[key])}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <details className="state-details">
                  <summary>
                    {t.inspect}
                    <ChevronRight size={13} />
                  </summary>
                  <div className="state-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t.field}</th>
                          <th>{t.expectedShort}</th>
                          <th>{t.actualShort}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stateKeys.map((key) => (
                          <tr key={key} className={expected[key] !== actual[key] ? 'changed' : ''}>
                            <th scope="row">{fieldLabels[key]}</th>
                            <td>{valueLabel(key, expected[key])}</td>
                            <td>{valueLabel(key, actual[key])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
                <div className="tip">
                  <Sparkles size={16} />
                  <div>
                    <strong>{t.tip}</strong>
                    <p>{t.tipBody}</p>
                  </div>
                </div>
                {firstDivergence > 0 && (
                  <button
                    className="first-divergence"
                    onClick={() => {
                      stopAndSelect(firstDivergence);
                      window.requestAnimationFrame(() =>
                        document
                          .querySelector<HTMLButtonElement>(
                            `[data-testid="timeline-step-${firstDivergence}"]`,
                          )
                          ?.focus(),
                      );
                    }}
                  >
                    <span className="red-dot" />
                    {language === 'en'
                      ? `First divergence · event ${firstDivergence}`
                      : `Первое расхождение · шаг ${firstDivergence}`}
                    <ArrowRight size={13} />
                  </button>
                )}
              </div>
            </section>
          </div>
          <div className="workbench-bottom">
            <span>
              <ShieldCheck size={12} />
              {t.sandbox}
            </span>
            <span>
              {t.traceLimit}
              <i />
              {t.safe}
            </span>
          </div>
        </section>
        <div className="notice" role="status">
          {notice}
        </div>
        <section className="scope-section" id="scope">
          <div className="scope-copy">
            <div className="scope-icon">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2>{t.scope}</h2>
              <p>{t.scopeBody}</p>
            </div>
          </div>
          <div className="scope-facts">
            <div>
              <FileJson size={17} />
              <strong>{t.portable}</strong>
              <span>{t.portableBody}</span>
            </div>
            <div>
              <CheckCheck size={17} />
              <strong>{t.deterministic}</strong>
              <span>{t.deterministicBody}</span>
            </div>
            <div>
              <Zap size={17} />
              <strong>{t.client}</strong>
              <span>{t.clientBody}</span>
            </div>
          </div>
        </section>
        <p className="format-note">{t.format}</p>
      </main>
      <footer>
        <span className="footer-brand">
          TRACEKIT<span> / </span>
          {t.footer}
        </span>
        <div>
          <a href="#scope">{t.scopeLink}</a>
          <a href="https://github.com/seoshiro/tracekit" target="_blank" rel="noreferrer">
            {t.made}
            <ArrowUpRight size={12} />
          </a>
        </div>
      </footer>

      <dialog
        ref={dialogRef}
        className="json-dialog"
        aria-labelledby="json-title"
        onCancel={(event) => {
          event.preventDefault();
          closeJson();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < rect.left ||
              event.clientX > rect.right ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom
            )
              closeJson();
          }
        }}
      >
        <div className="dialog-header">
          <span className="dialog-icon">
            <FileJson size={22} />
          </span>
          <button
            data-testid="json-close"
            className="icon-button"
            aria-label={t.close}
            onClick={closeJson}
          >
            <X size={19} />
          </button>
        </div>
        <h2 id="json-title">{t.jsonTitle}</h2>
        <p>{t.jsonIntro}</p>
        <div className="dialog-tabs">
          <button
            className={dialogTab === 'export' ? 'active' : ''}
            onClick={() => {
              invalidateFile();
              setDialogTab('export');
              setError('');
            }}
          >
            {t.exportTab}
          </button>
          <button
            className={dialogTab === 'import' ? 'active' : ''}
            onClick={() => {
              invalidateFile();
              setDialogTab('import');
              setError('');
            }}
          >
            {t.importTab}
          </button>
        </div>
        <label htmlFor="trace-json" className="sr-only">
          {t.jsonLabel}
        </label>
        <textarea
          id="trace-json"
          data-testid={dialogTab === 'export' ? 'json-output' : 'json-input'}
          spellCheck={false}
          readOnly={dialogTab === 'export'}
          value={dialogTab === 'export' ? traceJson : jsonInput}
          placeholder={t.jsonPlaceholder}
          onChange={(event) => {
            invalidateFile();
            setJsonInput(event.target.value);
            setError('');
          }}
          aria-describedby="json-help json-error"
        />
        <p id="json-help" className="json-help">
          {t.importHelp}
        </p>
        <p id="json-error" data-testid="import-error" className="json-error" role="alert">
          {error}
        </p>
        <div className="dialog-footer">
          {dialogTab === 'export' ? (
            <button data-testid="json-download" className="button primary" onClick={download}>
              <ArrowDownToLine size={15} />
              {t.download}
            </button>
          ) : (
            <>
              <label className="button file-button">
                <Upload size={15} />
                {t.pickFile}
                <input type="file" accept=".json,application/json" onChange={loadFile} />
              </label>
              <button
                data-testid="json-apply"
                className="button primary"
                onClick={loadJson}
                disabled={readingFile || !jsonInput.trim()}
              >
                <ShieldCheck size={15} />
                {t.load}
              </button>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}
