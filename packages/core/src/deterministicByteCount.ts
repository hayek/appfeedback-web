/** Locale-invariant, deterministic human-readable byte-count formatter. Decimal
 *  (1000-based) units; the unit is chosen by magnitude, then the value is rounded
 *  half-up within it and never re-promoted (so 999_999 -> "1000 KB"). JS numbers
 *  are doubles, so integer division uses Math.floor. Pinned by the wire spec. */
export function deterministicByteCount(bytes: number): string {
  // The Int-typed Swift/Kotlin ports can't represent NaN/Infinity, so coerce any
  // non-finite input to 0 here to keep all ports byte-identical (NaN/∞ -> "0 B").
  const n = Number.isFinite(bytes) ? bytes : 0
  const b = Math.min(Math.max(0, Math.trunc(n)), 100_000_000_000_000)
  const units: ReadonlyArray<readonly [string, number]> = [
    ['GB', 1_000_000_000],
    ['MB', 1_000_000],
    ['KB', 1_000],
  ]
  for (const [name, factor] of units) {
    if (b >= factor) {
      const tenths = Math.floor((b * 10 + Math.floor(factor / 2)) / factor) // half-up
      const whole = Math.floor(tenths / 10)
      const frac = tenths % 10
      return frac === 0 ? `${whole} ${name}` : `${whole}.${frac} ${name}`
    }
  }
  return `${b} B`
}
