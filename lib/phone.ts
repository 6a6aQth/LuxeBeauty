/** Stored phone: `+` and digits only, 8–15 digits. Malawi local forms become `+265` plus 9 digits. */

const SEPARATOR_OR_MARK = /[\s\u00a0\u202f\u2007\u2009\u2013\u2014\-() \u200e\u200f\u202a-\u202e\u2066-\u2069]/

/** Drop spaces, dashes, brackets, Unicode spaces, and bidi marks. A leading O standing in for 0 becomes 0. */
export function stripPhoneDecorations(input: string): string {
  let out = ""
  for (const ch of input.normalize("NFKC").trim()) {
    if (SEPARATOR_OR_MARK.test(ch)) continue
    out += ch
  }
  if (/^[Oo]\d{9}$/.test(out)) out = "0" + out.slice(1)
  return out
}

export function canonicalPhone(input: string): string | null {
  const s = stripPhoneDecorations(input)
  if (!s) return null

  const local = s.match(/^0(\d{9})$/)
  if (local) return "+265" + local[1]

  const bare = s.match(/^([1-9]\d{8})$/)
  if (bare) return "+265" + bare[1]

  const national = s.match(/^265(\d{9})$/)
  if (national) return "+265" + national[1]

  const plus = s.match(/^\+265(\d{9})$/)
  if (plus) return "+265" + plus[1]

  const extraZero = s.match(/^\+2650(\d{9})$/)
  if (extraZero) return "+265" + extraZero[1]

  if (s.startsWith("+265") || s.startsWith("265")) return null

  if (/^\+[1-9]\d{7,14}$/.test(s)) return s
  return null
}

export function phonesMatch(a: string, b: string): boolean {
  const left = canonicalPhone(a)
  const right = canonicalPhone(b)
  return left !== null && left === right
}

/** Keep characters that can become a canonical phone. Letters are dropped, except a leading O. */
export function sanitizePhoneInput(value: string): string {
  let out = ""
  let seenSignificant = false
  for (const ch of value) {
    if (/[0-9]/.test(ch)) {
      out += ch
      seenSignificant = true
      continue
    }
    if (ch === "+" && !seenSignificant && !out.includes("+")) {
      out += ch
      seenSignificant = true
      continue
    }
    if (/[\s\-–—()]/.test(ch)) {
      out += ch
      continue
    }
    if ((ch === "O" || ch === "o") && !seenSignificant) {
      out += ch
      seenSignificant = true
    }
  }
  return out
}
