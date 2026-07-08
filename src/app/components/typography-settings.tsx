"use client";

import { useEffect, useRef, useState } from "react";

/* A bottom-bar popover for tuning the typography of each of the three columns
   independently. It writes CSS custom properties onto :root that the
   `.typo-*` rules in globals.css consume (see TYPOGRAPHY.md). State is persisted
   to localStorage so a reader's choices survive navigation and reloads. */

// The Local Font Access API (queryLocalFonts) is Chromium-only and not yet in
// the TS DOM lib; declare the slice we use.
declare global {
  interface Window {
    queryLocalFonts?: () => Promise<{ family: string }[]>;
  }
}

type ColumnKey = "list" | "article" | "outline";

type ColumnSettings = {
  // Either a preset key ("sans" | "serif" | "mono") or a device font family name.
  font: string;
  scale: number; // multiplier on the documented font sizes
  leading: number; // multiplier on the documented line-heights
  tracking: number; // letter-spacing in em
};

type Settings = Record<ColumnKey, ColumnSettings>;

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: "list", label: "Post list" },
  { key: "article", label: "Article" },
  { key: "outline", label: "Outline" },
];

const PRESET_STACKS: Record<string, string> = {
  sans: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
  serif: "Georgia, Cambria, 'Times New Roman', serif",
  mono: "var(--font-geist-mono), ui-monospace, monospace",
};

const PRESETS: { key: string; label: string }[] = [
  { key: "sans", label: "Sans" },
  { key: "serif", label: "Serif" },
  { key: "mono", label: "Mono" },
];

// Resolve a stored `font` value into a CSS font-family. Presets map to their
// stacks; anything else is treated as a device font family name.
function fontStack(font: string): string {
  return PRESET_STACKS[font] ?? `"${font}", var(--font-geist-sans), sans-serif`;
}

const DEFAULT_COLUMN: ColumnSettings = { font: "sans", scale: 1, leading: 1, tracking: 0 };

// Baked-in defaults (kept in sync with the `--typo-*` values in globals.css).
const DEFAULTS: Settings = {
  list: { font: "Arial", scale: 1, leading: 0.8, tracking: -0.025 },
  article: { font: "Helvetica", scale: 0.8, leading: 0.95, tracking: -0.03 },
  outline: { font: "Arial", scale: 1, leading: 0.8, tracking: -0.025 },
};

const STORAGE_KEY = "typo-settings-v1";

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    // Merge over defaults so a future added field can't leave a column undefined.
    return {
      list: { ...DEFAULT_COLUMN, ...parsed.list },
      article: { ...DEFAULT_COLUMN, ...parsed.article },
      outline: { ...DEFAULT_COLUMN, ...parsed.outline },
    };
  } catch {
    return DEFAULTS;
  }
}

// Push a column's settings out to the CSS variables the stylesheet reads.
function applyColumn(key: ColumnKey, c: ColumnSettings) {
  const root = document.documentElement.style;
  root.setProperty(`--typo-${key}-font`, fontStack(c.font));
  root.setProperty(`--typo-${key}-scale`, String(c.scale));
  root.setProperty(`--typo-${key}-leading`, String(c.leading));
  root.setProperty(`--typo-${key}-tracking`, `${c.tracking}em`);
}

export function TypographySettings() {
  const [open, setOpen] = useState(false);
  // Lazily hydrate from localStorage during the initial render (client only);
  // markup doesn't depend on these values, so there's no hydration mismatch.
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [deviceFonts, setDeviceFonts] = useState<string[]>([]);
  const [fontStatus, setFontStatus] = useState<"idle" | "loading" | "error">("idle");
  const panelRef = useRef<HTMLDivElement>(null);

  const canQueryFonts = typeof window !== "undefined" && "queryLocalFonts" in window;

  // Enumerate fonts installed on the device. Requires a user gesture and the
  // `local-fonts` permission, so it's triggered by an explicit button.
  async function loadDeviceFonts() {
    if (!window.queryLocalFonts) return;
    setFontStatus("loading");
    try {
      const fonts = await window.queryLocalFonts();
      const families = [...new Set(fonts.map((f) => f.family))].sort((a, b) =>
        a.localeCompare(b),
      );
      setDeviceFonts(families);
      setFontStatus("idle");
    } catch {
      // Permission denied or unavailable — keep the presets working.
      setFontStatus("error");
    }
  }

  // Apply the hydrated settings to :root once on mount.
  useEffect(() => {
    for (const { key } of COLUMNS) applyColumn(key, settings[key]);
    // Mount-only: `settings` is the lazily-hydrated initial value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click / Escape while the panel is open.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function update(key: ColumnKey, patch: Partial<ColumnSettings>) {
    setSettings((prev) => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } };
      applyColumn(key, next[key]);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures (private mode, quota) — settings still apply.
      }
      return next;
    });
  }

  function reset() {
    setSettings(DEFAULTS);
    for (const { key } of COLUMNS) applyColumn(key, DEFAULTS[key]);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  const isDefault = COLUMNS.every(({ key }) => {
    const c = settings[key];
    const d = DEFAULTS[key];
    return c.font === d.font && c.scale === d.scale && c.leading === d.leading && c.tracking === d.tracking;
  });

  return (
    <div ref={panelRef} className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
      {open && (
        <div className="absolute bottom-full left-1/2 mb-2 w-80 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-zinc-200 bg-white/95 p-4 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Typography
            </h2>
            <button
              type="button"
              onClick={reset}
              disabled={isDefault}
              className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline disabled:cursor-default disabled:text-zinc-300 disabled:no-underline dark:text-zinc-400 dark:hover:text-white dark:disabled:text-zinc-600"
            >
              Reset all
            </button>
          </div>

          <div className="mb-3 flex items-center justify-between gap-2 rounded-md bg-zinc-50 px-2 py-1.5 dark:bg-zinc-800/60">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {deviceFonts.length > 0
                ? `${deviceFonts.length} device fonts loaded`
                : "Use fonts installed on this device"}
            </span>
            {canQueryFonts ? (
              <button
                type="button"
                onClick={loadDeviceFonts}
                disabled={fontStatus === "loading"}
                className="shrink-0 rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {fontStatus === "loading"
                  ? "Loading…"
                  : deviceFonts.length > 0
                    ? "Reload"
                    : "Load device fonts"}
              </button>
            ) : (
              <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                Not supported
              </span>
            )}
          </div>
          {fontStatus === "error" && (
            <p className="mb-3 text-xs text-red-500">
              Couldn&rsquo;t access device fonts (permission denied).
            </p>
          )}

          <div className="flex flex-col gap-4">
            {COLUMNS.map(({ key, label }) => (
              <ColumnControls
                key={key}
                label={label}
                settings={settings[key]}
                deviceFonts={deviceFonts}
                onChange={(patch) => update(key, patch)}
              />
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Typography settings"
        className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/95 px-4 py-2 text-sm font-medium text-zinc-700 shadow-lg backdrop-blur transition-colors hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-300 dark:hover:text-white"
      >
        <span className="text-base leading-none">
          A<span className="text-xs">a</span>
        </span>
        Typography
      </button>
    </div>
  );
}

function ColumnControls({
  label,
  settings,
  deviceFonts,
  onChange,
}: {
  label: string;
  settings: ColumnSettings;
  deviceFonts: string[];
  onChange: (patch: Partial<ColumnSettings>) => void;
}) {
  // A previously-saved device font may not be in the loaded list (or the list
  // isn't loaded yet); surface it so the select still reflects the choice.
  const isPreset = settings.font in PRESET_STACKS;
  const orphan = !isPreset && !deviceFonts.includes(settings.font) ? settings.font : null;

  return (
    <section className="border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0 dark:border-zinc-800">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </h3>

      <select
        value={settings.font}
        onChange={(e) => onChange({ font: e.target.value })}
        aria-label={`${label} font`}
        className="mb-2 w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
      >
        <optgroup label="Presets">
          {PRESETS.map((opt) => (
            <option key={opt.key} value={opt.key}>
              {opt.label}
            </option>
          ))}
        </optgroup>
        {(deviceFonts.length > 0 || orphan) && (
          <optgroup label="Device fonts">
            {orphan && (
              <option value={orphan} style={{ fontFamily: `"${orphan}"` }}>
                {orphan}
              </option>
            )}
            {deviceFonts.map((family) => (
              <option key={family} value={family} style={{ fontFamily: `"${family}"` }}>
                {family}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <Slider
        label="Size"
        min={0.8}
        max={1.4}
        step={0.05}
        value={settings.scale}
        display={`${Math.round(settings.scale * 100)}%`}
        onChange={(scale) => onChange({ scale })}
      />
      <Slider
        label="Line height"
        min={0.8}
        max={1.4}
        step={0.05}
        value={settings.leading}
        display={`${Math.round(settings.leading * 100)}%`}
        onChange={(leading) => onChange({ leading })}
      />
      <Slider
        label="Letter spacing"
        min={-0.03}
        max={0.06}
        step={0.005}
        value={settings.tracking}
        display={`${settings.tracking > 0 ? "+" : ""}${settings.tracking.toFixed(3)}em`}
        onChange={(tracking) => onChange({ tracking })}
      />
    </section>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 py-0.5 text-xs text-zinc-600 dark:text-zinc-300">
      <span className="w-24 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-zinc-900 dark:accent-white"
      />
      <span className="w-14 shrink-0 text-right tabular-nums text-zinc-400 dark:text-zinc-500">
        {display}
      </span>
    </label>
  );
}
