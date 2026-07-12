import { Group, Text } from '@mantine/core';

// The Waypoint mark: two forward slashes accelerating into a teal "play"
// triangle — motion toward a destination. Recreated as inline SVG so it scales
// crisply and inherits the brand gradient. `size` is the mark height in px.
export function LogoMark({ size = 28 }) {
  return (
    <svg
      width={(size * 74) / 40}
      height={size}
      viewBox="0 0 74 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="wp-mark" x1="34" y1="6" x2="70" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5FDCC6" />
          <stop offset="1" stopColor="#14B8A6" />
        </linearGradient>
      </defs>
      {/* two accelerating slashes */}
      <path d="M6 34 L22 6 H31 L15 34 Z" fill="currentColor" opacity="0.55" />
      <path d="M20 34 L36 6 H45 L29 34 Z" fill="currentColor" />
      {/* play triangle */}
      <path d="M44 6 L70 20 L44 34 Z" fill="url(#wp-mark)" />
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
