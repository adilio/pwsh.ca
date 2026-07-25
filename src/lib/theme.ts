import { useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";
export type Resolved = "light" | "dark";

const KEY = "pwsh-theme";
const DARK = "(prefers-color-scheme: dark)";

/** Ground colors, mirrored from styles.css, for the address-bar chrome. */
const THEME_COLOR: Record<Resolved, string> = {
  light: "#f3f5fa",
  dark: "#0b1220",
};

function readPref(): ThemePref {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === "light" || raw === "dark" || raw === "system"
      ? raw
      : "system";
  } catch {
    // Private mode, storage disabled, the system setting still works.
    return "system";
  }
}

export function resolve(pref: ThemePref): Resolved {
  if (pref !== "system") return pref;
  return window.matchMedia(DARK).matches ? "dark" : "light";
}

let pref: ThemePref = readPref();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/**
 * Stamps the resolved theme on <html>. The same attribute is set by the boot
 * script in index.html before first paint, so the page never flashes the
 * wrong ground.
 */
function apply() {
  const resolved = resolve(pref);
  document.documentElement.dataset.theme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[resolved]);
}

export function setPref(next: ThemePref) {
  pref = next;
  try {
    // "system" is the absence of a preference, not a third stored value.
    if (next === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // Not persisting is survivable; not applying is not.
  }
  apply();
  emit();
}

/** While the choice is "system", follow the OS as it changes, live. */
if (typeof window !== "undefined") {
  window.matchMedia(DARK).addEventListener("change", () => {
    if (pref === "system") {
      apply();
      emit();
    }
  });
}

export function useTheme(): {
  pref: ThemePref;
  resolved: Resolved;
  setPref: (next: ThemePref) => void;
} {
  const current = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => pref,
    () => "system" as ThemePref,
  );
  return { pref: current, resolved: resolve(current), setPref };
}
