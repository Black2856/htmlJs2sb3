/**
 * External-time and external-randomness seams. The Runtime never touches
 * Date.now()/performance.now() or Math.random() directly: it goes through
 * these ports so headless tests can inject deterministic fakes and so the
 * engine stays free of DOM/browser assumptions (per Phase 2 constraints).
 */
export interface ClockPort {
    /** Monotonic current time in milliseconds. */
    now(): number;
}

export interface RandomPort {
    /** Uniform random number in [0, 1), mirrors Math.random()'s contract. */
    random(): number;
}

/** Default ClockPort backed by Date.now(). Node-only, no DOM dependency. */
export class SystemClockPort implements ClockPort {
    now(): number {
        return Date.now();
    }
}

/** Default RandomPort backed by Math.random(). */
export class SystemRandomPort implements RandomPort {
    random(): number {
        return Math.random();
    }
}
