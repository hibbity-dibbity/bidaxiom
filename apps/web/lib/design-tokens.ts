/**
 * Design tokens for Procore-style construction software UI.
 * Use these constants in React components when dynamic styling is needed.
 */

export const SPACING = {
  COMPACT_XS: "4px",
  COMPACT_SM: "8px",
  COMPACT_MD: "12px",
  COMPACT_LG: "16px",
  COMPACT_XL: "24px",
} as const;

export const COLORS = {
  CONSTRUCTION: {
    LIGHT: "hsl(25 95% 53%)",
    DARK: "hsl(25 95% 58%)",
  },
  // Add more as needed
} as const;

export const TYPOGRAPHY = {
  SIZE: {
    XS: "0.75rem",   // 12px
    SM: "0.875rem",  // 14px
    BASE: "1rem",    // 16px
    LG: "1.125rem",  // 18px
    XL: "1.25rem",   // 20px
    XXL: "1.5rem",   // 24px
  },
  WEIGHT: {
    NORMAL: 400,
    MEDIUM: 500,
    SEMIBOLD: 600,
    BOLD: 700,
  },
} as const;

export const RADIUS = {
  SHARP: "0",
  SHARP_SM: "2px",
  SM: "4px",
  MD: "6px",
} as const;

// Example usage:
// <div style={{ padding: SPACING.COMPACT_MD }}>...</div>
// <Button className="bg-construction">...</Button>
