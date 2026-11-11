/**
 * The mark (Figma «Logo / Mark» 4:8): an upright 9:16 frame — the way the footage is shot — holding four
 * rungs that fade downwards, the steps a piece of media takes from the camera to the association.
 * Colours come from tokens; `onField` is the version that sits on the deep turquoise field.
 */
const RUNGS = [
  { y: 6, opacity: 1 },
  { y: 15.67, opacity: 0.74 },
  { y: 25.34, opacity: 0.5 },
  { y: 35.01, opacity: 0.3 },
];

export function BrandGlyph({ size = 32, onField = false }: { size?: number; onField?: boolean }) {
  return (
    <svg width={(size * 27) / 48} height={size} viewBox="0 0 27 48" aria-hidden="true" focusable="false" data-brand-glyph>
      <rect width="27" height="48" rx="7" style={{ fill: onField ? 'var(--color-bg-brand-mark-on-field)' : 'var(--color-bg-brand-mark)' }} />
      {RUNGS.map((r) => (
        <rect key={r.y} x="6" y={r.y} width="15" height="7" rx="2" opacity={r.opacity} style={{ fill: 'var(--color-bg-accent)' }} />
      ))}
    </svg>
  );
}
