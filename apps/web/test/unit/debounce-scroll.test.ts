/**
 * Tests for debounce + scroll-aware behavior
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Debounce utility (same as useDebounce hook logic) ────────────────────────
function createDebounce<T extends (...args: any[]) => any>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, ms);
  };
}

// ── Scroll-hide timer logic ───────────────────────────────────────────────────
class ScrollAwareVisibility {
  private visible = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private lastScrollY = 0;
  private readonly threshold: number;
  private readonly revealDelay: number;
  private _onChange?: (visible: boolean) => void;

  constructor(threshold = 30, revealDelay = 5000) {
    this.threshold = threshold;
    this.revealDelay = revealDelay;
  }

  show() {
    this.visible = true;
    this._onChange?.(true);
  }

  onScroll(currentY: number) {
    const delta = Math.abs(currentY - this.lastScrollY);
    if (delta > this.threshold) {
      this.visible = false;
      this._onChange?.(false);
      if (this.hideTimer) clearTimeout(this.hideTimer);
      this.hideTimer = setTimeout(() => {
        // On desktop: no auto-re-show; user must click filter button
      }, this.revealDelay);
      this.lastScrollY = currentY;
    }
  }

  onChange(fn: (visible: boolean) => void) {
    this._onChange = fn;
  }

  isVisible() {
    return this.visible;
  }

  cleanup() {
    if (this.hideTimer) clearTimeout(this.hideTimer);
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Debounce utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays function execution', () => {
    const fn = vi.fn();
    const debounced = createDebounce(fn, 350);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(350);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('only calls once for rapid sequential calls', () => {
    const fn = vi.fn();
    const debounced = createDebounce(fn, 350);

    debounced();
    debounced();
    debounced();

    vi.advanceTimersByTime(350);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on each call', () => {
    const fn = vi.fn();
    const debounced = createDebounce(fn, 350);

    debounced();
    vi.advanceTimersByTime(200);
    debounced(); // reset timer
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes arguments to the debounced function', () => {
    const fn = vi.fn();
    const debounced = createDebounce(fn, 100);

    debounced('hello', 42);
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('hello', 42);
  });

  it('handles multiple independent debounced functions', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const d1 = createDebounce(fn1, 100);
    const d2 = createDebounce(fn2, 200);

    d1();
    d2();

    vi.advanceTimersByTime(100);
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});

describe('Scroll-Aware Filter Visibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts as not visible', () => {
    const sav = new ScrollAwareVisibility();
    expect(sav.isVisible()).toBe(false);
  });

  it('can be shown explicitly', () => {
    const sav = new ScrollAwareVisibility();
    sav.show();
    expect(sav.isVisible()).toBe(true);
  });

  it('hides on scroll when delta exceeds threshold', () => {
    const sav = new ScrollAwareVisibility(30);
    sav.show();
    const onChange = vi.fn();
    sav.onChange(onChange);

    sav.onScroll(50); // delta = 50 > 30

    expect(sav.isVisible()).toBe(false);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not hide on small scroll delta', () => {
    const sav = new ScrollAwareVisibility(30);
    sav.show();
    const onChange = vi.fn();
    sav.onChange(onChange);

    sav.onScroll(20); // delta = 20 < 30

    expect(sav.isVisible()).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange(false) when scroll exceeds threshold', () => {
    const sav = new ScrollAwareVisibility(30);
    sav.show();
    const onChange = vi.fn();
    sav.onChange(onChange);

    sav.onScroll(100);

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('updates lastScrollY after hiding', () => {
    const sav = new ScrollAwareVisibility(30);
    sav.show();

    sav.onScroll(100); // moves to y=100
    sav.show(); // re-show
    sav.onScroll(110); // delta = 10 < 30, should NOT hide

    expect(sav.isVisible()).toBe(true);
  });

  it('cleans up timer on cleanup()', () => {
    const sav = new ScrollAwareVisibility(30, 5000);
    sav.show();
    sav.onScroll(100); // starts hide timer

    sav.cleanup(); // should not throw
    // Just verify it does not cause issues
    vi.advanceTimersByTime(5000);
    expect(sav.isVisible()).toBe(false);
  });
});
