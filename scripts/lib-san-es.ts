/** Notación algebraica española (R, D, T, A, C; 0-0; "++" como mate; coronación "=D" o pegada "a1D") → SAN inglés. */
const PIEZA: Record<string, string> = { R: 'K', D: 'Q', T: 'R', A: 'B', C: 'N' }
export const sanIngles = (t: string) =>
  t
    .replace(/[–—]/g, '-')
    .replace(/^0-0-0/, 'O-O-O')
    .replace(/^0-0/, 'O-O')
    .replace(/\+\+$/, '#')
    .replace(/^[RDTAC]/, (p) => PIEZA[p])
    .replace(/=?([DTAC])([+#]?)$/, (x, p, j, i, s) => (/[a-h][18]=?[DTAC]/.test(s) ? '=' + PIEZA[p] + j : x))
