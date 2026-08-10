/**
 * Noga UF items encode their abrasive grade with a colour letter in the
 * description, e.g. UF-FB-M-D025-L75 -> "M".
 * This maps that letter to the physical colour of the tool so the price list
 * can show a colour chip per grit.
 */
export interface GritColor {
  code: string;
  name: string;
  /** CSS colour used for the swatch */
  hex: string;
}

const GRIT_COLORS: Record<string, GritColor> = {
  W: { code: 'W', name: 'White', hex: '#f5f5f4' },
  A: { code: 'A', name: 'Grey', hex: '#9ca3af' },
  Z: { code: 'Z', name: 'Black', hex: '#1f2937' },
  M: { code: 'M', name: 'Brown', hex: '#92400e' },
  R: { code: 'R', name: 'Red', hex: '#ef4444' },
  O: { code: 'O', name: 'Orange', hex: '#f97316' },
  Y: { code: 'Y', name: 'Yellow', hex: '#eab308' },
  G: { code: 'G', name: 'Green', hex: '#22c55e' },
  B: { code: 'B', name: 'Blue', hex: '#3b82f6' },
  V: { code: 'V', name: 'Violet', hex: '#8b5cf6' },
  P: { code: 'P', name: 'Pink', hex: '#ec4899' },
};

/** Extract the grit colour from an item description (returns undefined when absent). */
export function getGritColor(description?: string | null): GritColor | undefined {
  if (!description) return undefined;
  const tokens = description.trim().toUpperCase().split('-').filter(Boolean);
  // Family is the first two tokens (UF-FB), the colour letter follows it.
  const letter = tokens[2];
  if (!letter || letter.length !== 1) return undefined;
  return GRIT_COLORS[letter];
}

export { GRIT_COLORS };
