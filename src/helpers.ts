const msDay = 1000 * 60 * 60 * 24
export const toDays = (t: number): number => Math.ceil(t / msDay)

export const toUpperCaseFirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)
