import { createTheme } from '@mantine/core';

// Waypoint brand theme. Colours, type, and scale come straight from the brand
// sheet: dark navy surfaces, teal primary, amber secondary, Satoshi + Inter.

// Brand navy mapped onto Mantine's `dark` scale (index 7 = body background,
// 6 = cards/surfaces, 5 = inputs/hover, 4 = borders, 0–2 = text).
const dark = [
  '#EEF2F6', // 0 brightest text
  '#E5E7EB', // 1 primary text (brand light)
  '#9FB0C0', // 2 dimmed text
  '#6B7C8F', // 3 faint text / placeholders
  '#2C3E52', // 4 borders
  '#1F2D3D', // 5 inputs, hover (brand slate)
  '#172233', // 6 cards / surfaces (brand navy)
  '#0E1621', // 7 app background (brand darkest)
  '#0A1119', // 8
  '#070C12', // 9
];

// Light-mode neutrals: a navy-tinted grey ramp (light → dark) from the brand
// kit, so borders, dimmed text, and surfaces stay on-brand in light mode.
// Mantine derives light-scheme tokens from this: hover = gray.0, default border
// = gray.4, dimmed text = gray.6, body text = theme.black.
const gray = [
  '#EDF0F4', // 0 subtle hover (just under the body background)
  '#E3E8EF', // 1 hairline / subtle border
  '#D3DBE5', // 2
  '#BFC9D6', // 3
  '#A7B3C4', // 4 default border
  '#8A98AC', // 5
  '#5E6C80', // 6 dimmed text
  '#43505F', // 7
  '#2B3543', // 8
  '#16202C', // 9 strongest text
];

// Full brand navy ramp (light → dark), kept available for brand accents.
const navy = [
  '#E9ECF1',
  '#C7D0DC',
  '#A5B3C6',
  '#8397B1',
  '#61799B',
  '#3F5C86',
  '#2A4570',
  '#1A2E4D',
  '#131F36',
  '#0D1B2A',
];

// Brand teal (#14B8A6 at index 6).
const teal = [
  '#E6FBF7',
  '#C7F2EA',
  '#96E7D9',
  '#5FDCC6',
  '#37CFB6',
  '#1FC6AB',
  '#14B8A6',
  '#0E9C8C',
  '#0A7C6F',
  '#065C52',
];

// Brand amber (#F59E0B at index 6).
const amber = [
  '#FFF8EB',
  '#FDECC8',
  '#FADFA3',
  '#F8D07A',
  '#F6C24F',
  '#F5B62F',
  '#F59E0B',
  '#C77E06',
  '#9A6104',
  '#6E4402',
];

export const theme = createTheme({
  primaryColor: 'teal',
  // Slightly brighter teal for filled controls so they pop on navy.
  primaryShade: { light: 6, dark: 5 },
  colors: { dark, gray, navy, teal, amber },
  white: '#FFFFFF',
  black: '#0E1621',

  fontFamily:
    "'Inter Variable', Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",

  headings: {
    fontFamily: "'Satoshi', 'Inter Variable', sans-serif",
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '2rem', lineHeight: '2.5rem', fontWeight: '700' }, // 32/40
      h2: { fontSize: '1.5rem', lineHeight: '2rem', fontWeight: '600' }, // 24/32
      h3: { fontSize: '1.25rem', lineHeight: '1.75rem', fontWeight: '600' },
      h4: { fontSize: '1.0625rem', lineHeight: '1.5rem', fontWeight: '600' },
    },
  },

  defaultRadius: 'md',
  radius: { md: '10px', lg: '14px' },

  components: {
    // Surfaces flip with the scheme: white cards on light, brand navy on dark.
    Paper: {
      defaultProps: { bg: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-6))' },
    },
    Modal: {
      styles: {
        content: {
          backgroundColor: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-6))',
        },
        header: {
          backgroundColor: 'light-dark(var(--mantine-color-white), var(--mantine-color-dark-6))',
        },
      },
    },
  },
});
