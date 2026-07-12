import { Group, Text } from '@mantine/core';

// The official Waypoint mark: two angled ink bars accelerating into a
// teal→blue gradient arrow — motion toward a destination. Inline SVG (from the
// brand source) so it scales crisply and stays offline. The two ink bars use
// `currentColor`, so they flip with the colour scheme (navy on light, white on
// dark); the gradient arrow stays fixed to the brand palette. `size` is the
// mark height in px; the tight viewBox keeps the lockup balanced.
export function LogoMark({ size = 28 }) {
  return (
    <svg
      width={(size * 125) / 66}
      height={size}
      viewBox="36 67 125 66"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="wp-mark" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#19D3C5" />
          <stop offset="100%" stopColor="#228BE6" />
        </linearGradient>
      </defs>
      {/* two accelerating ink bars */}
      <path
        d="M 68.85 75.51 Q 72.60 69.60 79.60 69.60 L 87.50 69.60 Q 94.50 69.60 90.74 75.50 L 59.66 124.30 Q 55.90 130.20 48.90 130.20 L 41.10 130.20 Q 34.10 130.20 37.85 124.29 Z"
        fill="currentColor"
      />
      <path
        d="M 101.24 75.50 Q 105.00 69.60 112.00 69.60 L 119.80 69.60 Q 126.80 69.60 123.05 75.51 L 92.05 124.29 Q 88.30 130.20 81.30 130.20 L 73.40 130.20 Q 66.40 130.20 70.16 124.30 Z"
        fill="currentColor"
      />
      {/* gradient arrow */}
      <path
        d="M 132.71 76.35 Q 137.00 69.60 142.65 75.27 L 158.65 91.33 Q 164.30 97.00 157.16 100.60 L 105.64 126.60 Q 98.50 130.20 102.79 123.45 Z"
        fill="url(#wp-mark)"
      />
    </svg>
  );
}

// Mark + wordmark lockup. `color` sets the wordmark colour (mark uses it too).
// Defaults to the scheme-aware text colour so it stays legible in both light
// and dark; pass an explicit colour (e.g. white) on fixed-dark hero panels.
export default function Logo({
  size = 28,
  withWordmark = true,
  color = 'var(--mantine-color-text)',
}) {
  return (
    <Group gap="sm" wrap="nowrap" align="center" style={{ color }}>
      <LogoMark size={size} />
      {withWordmark && (
        <Text
          span
          style={{
            fontFamily: "'Satoshi', sans-serif",
            fontWeight: 700,
            fontSize: size * 0.72,
            letterSpacing: '0.14em',
            lineHeight: 1,
            color,
          }}
        >
          WAYPOINT
        </Text>
      )}
    </Group>
  );
}
