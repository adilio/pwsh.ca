import type { ReactElement } from "react";
import { useTheme, type ThemePref } from "../lib/theme";

/* One hand-rolled 16px set, 1.6 stroke, currentColor, the project has no icon
   library and doesn't need one for three glyphs. */
function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1v1.6M8 13.4V15M15 8h-1.6M2.6 8H1M12.95 3.05l-1.13 1.13M4.18 11.82l-1.13 1.13M12.95 12.95l-1.13-1.13M4.18 4.18L3.05 3.05" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="1.8" y="2.6" width="12.4" height="8.6" rx="1.4" />
      <path d="M6 14h4" />
    </svg>
  );
}

const OPTIONS: {
  value: ThemePref;
  label: string;
  icon: () => ReactElement;
}[] = [
  { value: "system", label: "Match system", icon: SystemIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

/**
 * Real radio inputs, visually hidden behind styled labels: arrow-key
 * navigation, grouping, and checked state all come from the browser rather
 * than from hand-rolled ARIA.
 */
export function ThemeToggle() {
  const { pref, setPref } = useTheme();

  return (
    <fieldset className="theme-toggle">
      <legend className="visually-hidden">Color theme</legend>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <label
          key={value}
          className="theme-option"
          title={label}
          data-checked={pref === value}
        >
          <input
            type="radio"
            name="theme"
            value={value}
            checked={pref === value}
            onChange={() => setPref(value)}
          />
          <Icon />
          <span className="visually-hidden">{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
