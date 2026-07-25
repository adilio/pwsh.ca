/**
 * The pwsh.ca mark: the prompt itself, a chevron and a caret rule, drawn in
 * `currentColor` so it takes the ink of whatever it sits in. A stamp is one
 * color; the console's blue arrives from the surface behind it, not here.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 21 L33 32 L20 43" />
        <path d="M37 44 H46" />
      </g>
    </svg>
  );
}
