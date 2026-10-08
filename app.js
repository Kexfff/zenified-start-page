"use strict";

const webext = globalThis.browser;
const STORAGE_KEY = "zenifiedState";
const BACKGROUND_KEY = "zenifiedBackground";
const MAX_BACKGROUND_FILE_SIZE = 15 * 1024 * 1024;
const BACKGROUND_POSITIONS = ["center", "top", "bottom", "left", "right"];
const BACKGROUND_HELP = "JPG, PNG, WebP, GIF or AVIF · up to 15 MB. Pictures are resized for faster tabs; animations become still images.";
const MAX_SHORTCUTS = 12;
const FOCUS_DURATION = 25 * 60;
const THEMES = {
  auto: { name: "Auto", light: false },
  prism: { name: "Prism", light: false },
  still: { name: "Still", light: true },
  material: { name: "Material 3", light: true },
  "material-dark": { name: "Material Elevated", light: false },
  nocturne: { name: "Nocturne", light: false },
  amoled: { name: "AMOLED black", light: false },
  aurora: { name: "Aurora", light: false },
  dawn: { name: "Dawn", light: true },
  slate: { name: "Slate", light: false },
  sakura: { name: "Sakura", light: true },
  ultraviolet: { name: "Ultraviolet", light: false },
  blueprint: { name: "Blueprint", light: false },
  porcelain: { name: "Porcelain", light: true },
  ember: { name: "Ember", light: false },
  terminal: { name: "Terminal", light: false },
  redline: { name: "Redline", light: false }
};
const LAYOUTS = ["centered", "split", "compact", "dashboard", "sidebar", "panorama"];
const DECORATION_THEMES = {
  auto: "bubble", prism: "confetti", still: "bubble", material: "cookie",
  "material-dark": "cookie", nocturne: "star", amoled: "star", aurora: "bubble",
  dawn: "leaf", slate: "orbit", sakura: "petal", ultraviolet: "star",
  blueprint: "orbit", porcelain: "bubble", ember: "spark", terminal: "bit", redline: "spark"
};
const DECORATION_MOTIFS = {
  petal: { label: "Soft petals drifting on a spring breeze.", count: 18, size: 28, paths: ["M22 2C9 2 1 13 5 25c4 11 15 16 22 8 7-8 5-16 1-19l-4 5 1-8-3-9Z", "M8 27c8-2 13-8 15-18"], viewBox: "0 0 36 40" },
  cookie: { label: "Little cookies, baked for your Material theme.", count: 10, size: 54, paths: ["M31 4c-1 5 2 8 7 8-1 4 2 7 7 6 1 18-15 28-30 18C0 33-1 16 10 7c6-4 14-5 21-3Z", "M13 13l4-1 1 4-4 2-1-5Zm11 11 4-2 2 4-4 2-2-4ZM9 26l3-1 2 3-4 2-1-4Zm16 9 3-1 1 3-3 1-1-3Z", "M21 10h.1M34 30h.1M18 27h.1M10 20h.1"], viewBox: "0 0 48 48" },
  star: { label: "A quiet constellation of little stars.", count: 14, size: 32, paths: ["M20 3 24 16 37 20 24 24 20 37 16 24 3 20 16 16 20 3Z", "M33 2v6m-3-3h6"], viewBox: "0 0 40 40" },
  bubble: { label: "Weightless bubbles catching the light.", count: 10, size: 52, paths: ["M20 3a17 17 0 1 0 0 34 17 17 0 1 0 0-34Z", "M9 17a12 12 0 0 1 8-8"], viewBox: "0 0 40 40" },
  leaf: { label: "Tiny leaves wandering across your page.", count: 12, size: 38, paths: ["M5 34C0 13 14 2 34 5c1 19-9 34-29 29Z", "M5 34 27 12M13 26l-1-9m8 2 8 1"], viewBox: "0 0 40 40" },
  confetti: { label: "Floating shapes for a tiny everyday celebration.", count: 14, size: 30, paths: ["M7 5h22v22H7Z", "M10 33h23"], viewBox: "0 0 40 40" },
  orbit: { label: "Small satellites tracing imaginary orbits.", count: 10, size: 44, paths: ["M20 12a8 8 0 1 0 0 16 8 8 0 1 0 0-16Z", "M3 27C-1 17 29-1 36 9s-27 30-33 18Z"], viewBox: "0 0 40 40" },
  spark: { label: "Slow sparks and glimmers of light.", count: 14, size: 26, paths: ["M23 2 7 23h11l-3 15 18-23H22l1-13Z"], viewBox: "0 0 40 40" },
  bit: { label: "A few stray pixels from a friendly console.", count: 14, size: 26, paths: ["M5 5h10v10H5Zm20 10h10v10H25ZM15 25h10v10H15Z"], viewBox: "0 0 40 40" }
};

const SEARCH_ENGINES = {
  duckduckgo: {
    name: "DuckDuckGo",
    glyph: "D",
    url: "https://duckduckgo.com/?q="
  },
  google: {
    name: "Google",
    glyph: "G",
    url: "https://www.google.com/search?q="
  },
  brave: {
    name: "Brave Search",
    glyph: "B",
    url: "https://search.brave.com/search?q="
  },
  bing: {
    name: "Bing",
    glyph: "B",
    url: "https://www.bing.com/search?q="
  }
};

const DEFAULT_SHORTCUTS = [
  { id: "github", name: "GitHub", url: "https://github.com" },
  { id: "youtube", name: "YouTube", url: "https://youtube.com" },
  { id: "reddit", name: "Reddit", url: "https://reddit.com" },
  { id: "mail", name: "Gmail", url: "https://mail.google.com" },
  { id: "calendar", name: "Calendar", url: "https://calendar.google.com" }
];

const DEFAULT_STATE = {
  theme: "auto",
  colors: null,
  layout: "centered",
  background: { dim: 35, blur: 0, position: "center" },
  showAddTile: true,
  decorations: false,
  searchEngine: "duckduckgo",
  clockFormat: "24",
  shortcuts: DEFAULT_SHORTCUTS,
  note: "",
  focus: {
    total: FOCUS_DURATION,
    remaining: FOCUS_DURATION,
    running: false,
    endAt: null,
    completed: false
  }
};

const AUTO_STYLE_PROPERTIES = [
  "--bg", "--bg-rgb", "--surface", "--surface-strong", "--surface-solid",
  "--border", "--border-strong", "--text", "--muted", "--faint",
  "--accent", "--accent-rgb", "--accent-2", "--accent-2-rgb",
  "--accent-text", "--accent-2-text", "--danger", "--shadow"
];
const CUSTOM_COLOR_PROPERTIES = [
  ...AUTO_STYLE_PROPERTIES, "--primary-container", "--on-primary-container",
  "--secondary-container", "--on-secondary-container", "--decor-primary-rgb", "--decor-secondary-rgb"
];

const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
const clone = value => JSON.parse(JSON.stringify(value));

let state = clone(DEFAULT_STATE);
let bookmarkTree = null;
let flatBookmarks = [];
let bookmarkLoadPromise = null;
let activeDrawer = null;
let focusInterval = null;
let noteSaveTimer = null;
let toastTimer = null;
let activeDragId = null;
let dragStartOrder = "";
let pointerDragId = null;
let suggestionTimer = null;
let suggestionRequestId = 0;
let searchSuggestions = [];
let activeSuggestionIndex = -1;
let backgroundImage = "";
let backgroundBusy = false;
let activePickerColor = "primary";
let pickerHsv = { h: 0, s: 0, v: 100 };
let defaultThemeColors = null;
let colorSaveTimer = null;
let colorPointerId = null;
let themeApplicationId = 0;

const elements = {
  root: document.documentElement,
  clock: $("#clock"),
  date: $("#date"),
  greeting: $("#greeting"),
  clockToggle: $("#clockToggle"),
  searchForm: $("#searchForm"),
  searchInput: $("#searchInput"),
  searchSuggestions: $("#searchSuggestions"),
  suggestionList: $("#suggestionList"),
  engineButton: $("#engineButton"),
  engineGlyph: $("#engineGlyph"),
  engineLabel: $("#engineLabel"),
  engineMenu: $("#engineMenu"),
  engineSelect: $("#engineSelect"),
  shortcutGrid: $("#shortcutGrid"),
  shortcutDialog: $("#shortcutDialog"),
  shortcutForm: $("#shortcutForm"),
  shortcutDialogTitle: $("#shortcutDialogTitle"),
  shortcutId: $("#shortcutId"),
  shortcutName: $("#shortcutName"),
  shortcutUrl: $("#shortcutUrl"),
  shortcutError: $("#shortcutError"),
  deleteShortcut: $("#deleteShortcut"),
  bookmarksDrawer: $("#bookmarksDrawer"),
  settingsDrawer: $("#settingsDrawer"),
  scrim: $("#scrim"),
  bookmarkSearch: $("#bookmarkSearch"),
  bookmarkContent: $("#bookmarkContent"),
  bookmarkCount: $("#bookmarkCount"),
  paletteStatus: $("#paletteStatus"),
  syncBadge: $("#syncBadge"),
  themeGrid: $("#themeGrid"),
  themeLibrary: $("#themeLibrary"),
  currentThemeName: $("#currentThemeName"),
  themeDecorations: $("#themeDecorations"),
  enableDecorations: $("#enableDecorations"),
  decorationHint: $("#decorationHint"),
  colorEditor: $("#colorEditor"),
  colorTargets: $("#colorTargets"),
  colorField: $("#colorField"),
  colorCursor: $("#colorCursor"),
  colorHue: $("#colorHue"),
  colorHex: $("#colorHex"),
  colorMode: $("#colorMode"),
  resetColors: $("#resetColors"),
  colorStatus: $("#colorStatus"),
  layoutGrid: $("#layoutGrid"),
  customBackground: $("#customBackground"),
  backgroundPreview: $("#backgroundPreview"),
  backgroundFile: $("#backgroundFile"),
  chooseBackground: $("#chooseBackground"),
  removeBackground: $("#removeBackground"),
  backgroundStatus: $("#backgroundStatus"),
  backgroundControls: $("#backgroundControls"),
  backgroundDim: $("#backgroundDim"),
  backgroundDimValue: $("#backgroundDimValue"),
  backgroundBlur: $("#backgroundBlur"),
  backgroundBlurValue: $("#backgroundBlurValue"),
  backgroundPosition: $("#backgroundPosition"),
  showAddTile: $("#showAddTile"),
  addShortcutTop: $("#addShortcutTop"),
  quickNote: $("#quickNote"),
  noteStatus: $("#noteStatus"),
  focusTime: $("#focusTime"),
  focusStatus: $("#focusStatus"),
  focusToggle: $("#focusToggle"),
  focusReset: $("#focusReset"),
  focusProgress: $("#focusProgress"),
  clockFormat: $("#clockFormat"),
  toast: $("#toast")
};

async function loadState() {
  try {
    let saved;
    if (webext?.storage?.local) {
      const result = await webext.storage.local.get(STORAGE_KEY);
      saved = result[STORAGE_KEY];
    } else {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    }

    if (saved && typeof saved === "object") {
      state = {
        ...clone(DEFAULT_STATE),
        ...saved,
        focus: { ...clone(DEFAULT_STATE.focus), ...(saved.focus || {}) },
        shortcuts: Array.isArray(saved.shortcuts) ? saved.shortcuts : clone(DEFAULT_SHORTCUTS)
      };
    }
  } catch (error) {
    console.warn("Zenified could not load saved preferences.", error);
  }
}

async function saveState() {
  try {
    const snapshot = clone(state);
    if (webext?.storage?.local) {
      await webext.storage.local.set({ [STORAGE_KEY]: snapshot });
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    }
    return true;
  } catch (error) {
    console.warn("Zenified could not save preferences.", error);
    return false;
  }
}

function svg(pathData, viewBox = "0 0 24 24") {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  node.setAttribute("viewBox", viewBox);
  node.setAttribute("aria-hidden", "true");
  const paths = Array.isArray(pathData) ? pathData : [pathData];
  paths.forEach(data => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", data);
    node.append(path);
  });
  return node;
}

function setSyncBadge(label) {
  const dot = document.createElement("span");
  elements.syncBadge.replaceChildren(dot, document.createTextNode(label));
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  toastTimer = setTimeout(() => elements.toast.classList.remove("visible"), 2200);
}

function updateClock() {
  const now = new Date();
  const uses12Hour = state.clockFormat === "12";
  elements.clock.textContent = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: uses12Hour
  }).format(now);
  elements.date.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(now);

  const hour = now.getHours();
  const greeting = hour < 5 ? "A quiet night." : hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening.";
  elements.greeting.textContent = greeting;
}

function updateClockControls() {
  $$('[data-format]', elements.clockFormat).forEach(button => {
    button.classList.toggle("active", button.dataset.format === state.clockFormat);
  });
  updateClock();
}

function parseColor(value) {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 3) return value.slice(0, 3).map(Number);
  if (typeof value === "object" && [value.r, value.g, value.b].every(Number.isFinite)) {
    return [value.r, value.g, value.b];
  }
  if (typeof value !== "string") return null;

  const probe = document.createElement("span");
  probe.style.color = "";
  probe.style.color = value;
  if (!probe.style.color) return null;
  probe.style.display = "none";
  document.body.append(probe);
  const normalized = getComputedStyle(probe).color;
  probe.remove();
  const channels = normalized.match(/[\d.]+/g);
  return channels?.length >= 3 ? channels.slice(0, 3).map(Number) : null;
}

function mixColor(first, second, secondWeight) {
  return first.map((channel, index) => Math.round(channel * (1 - secondWeight) + second[index] * secondWeight));
}

function luminance(rgb) {
  const channels = rgb.map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function rgbString(rgb) {
  return rgb.map(channel => Math.max(0, Math.min(255, Math.round(channel)))).join(", ");
}

function hexColor(rgb) {
  return `#${rgb.map(channel => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0")).join("")}`;
}

function setAutoProperty(name, value) {
  elements.root.style.setProperty(name, value);
}

function clearAutoPalette() {
  CUSTOM_COLOR_PROPERTIES.forEach(property => elements.root.style.removeProperty(property));
  elements.root.removeAttribute("data-auto-mode");
  elements.root.removeAttribute("data-custom-colors");
}

async function applyAutoTheme(applicationId) {
  clearAutoPalette();
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  let colors = {};
  let syncedWithBrowser = false;

  try {
    const current = await webext?.theme?.getCurrent?.();
    if (current?.colors && Object.keys(current.colors).length) {
      colors = current.colors;
      syncedWithBrowser = true;
    }
  } catch (error) {
    console.info("Browser theme colors are not exposed in this context.", error);
  }
  if (applicationId !== themeApplicationId) return;

  const base = parseColor(colors.toolbar) || parseColor(colors.frame) || parseColor(colors.sidebar) || (systemDark ? [19, 18, 27] : [242, 240, 237]);
  const suppliedText = parseColor(colors.toolbar_text) || parseColor(colors.tab_text) || parseColor(colors.sidebar_text);
  const isDark = suppliedText ? luminance(suppliedText) > luminance(base) : luminance(base) < 0.42;
  const neutral = isDark ? [7, 8, 12] : [250, 248, 245];
  const background = syncedWithBrowser ? mixColor(base, neutral, isDark ? 0.64 : 0.72) : base;
  const text = suppliedText && Math.abs(luminance(suppliedText) - luminance(background)) > 0.28
    ? suppliedText
    : (isDark ? [246, 244, 250] : [35, 32, 40]);

  let accent = parseColor(colors.icons_attention)
    || parseColor(colors.toolbar_field_focus_border)
    || parseColor(colors.tab_line)
    || parseColor(colors.button_background_active)
    || parseColor(colors.frame)
    || (isDark ? [147, 132, 255] : [112, 94, 205]);

  if (Math.abs(luminance(accent) - luminance(background)) < 0.12) {
    accent = mixColor(accent, isDark ? [255, 255, 255] : [0, 0, 0], isDark ? 0.34 : 0.2);
  }

  const secondarySource = parseColor(colors.bookmark_text) || parseColor(colors.icons);
  const accentTwo = secondarySource && Math.abs(luminance(secondarySource) - luminance(background)) > 0.14
    ? mixColor(secondarySource, isDark ? [83, 225, 195] : [49, 151, 134], 0.46)
    : (isDark ? [83, 220, 195] : [49, 151, 134]);
  const surfaceSolid = mixColor(background, isDark ? [255, 255, 255] : [255, 255, 255], isDark ? 0.055 : 0.62);
  const muted = mixColor(text, background, isDark ? 0.34 : 0.32);
  const faint = mixColor(text, background, isDark ? 0.53 : 0.48);

  elements.root.setAttribute("data-auto-mode", isDark ? "dark" : "light");
  elements.root.style.colorScheme = isDark ? "dark" : "light";
  setAutoProperty("--bg", hexColor(background));
  setAutoProperty("--bg-rgb", rgbString(background));
  setAutoProperty("--surface", `rgba(${rgbString(text)}, ${isDark ? 0.052 : 0.28})`);
  setAutoProperty("--surface-strong", `rgba(${rgbString(text)}, ${isDark ? 0.09 : 0.48})`);
  setAutoProperty("--surface-solid", hexColor(surfaceSolid));
  setAutoProperty("--border", `rgba(${rgbString(text)}, ${isDark ? 0.09 : 0.11})`);
  setAutoProperty("--border-strong", `rgba(${rgbString(text)}, ${isDark ? 0.17 : 0.2})`);
  setAutoProperty("--text", hexColor(text));
  setAutoProperty("--muted", hexColor(muted));
  setAutoProperty("--faint", hexColor(faint));
  setAutoProperty("--accent", hexColor(accent));
  setAutoProperty("--accent-rgb", rgbString(accent));
  setAutoProperty("--accent-2", hexColor(accentTwo));
  setAutoProperty("--accent-2-rgb", rgbString(accentTwo));
  setAutoProperty("--accent-text", luminance(accent) > 0.48 ? "#0a090d" : "#ffffff");
  setAutoProperty("--danger", isDark ? "#ff7b89" : "#bf3d51");
  setAutoProperty("--shadow", isDark ? "0 24px 70px rgba(0, 0, 0, .3)" : "0 24px 70px rgba(38, 30, 44, .13)");

  elements.paletteStatus.textContent = syncedWithBrowser ? "Synced with Zen / Firefox" : "Following system palette";
  setSyncBadge(syncedWithBrowser ? "Synced" : "System");
  $("meta[name='color-scheme']").content = isDark ? "dark" : "light";
}

async function applyTheme(theme = state.theme) {
  const applicationId = ++themeApplicationId;
  clearAutoPalette();
  elements.root.dataset.theme = theme;
  elements.root.style.colorScheme = "";

  if (theme === "auto") {
    await applyAutoTheme(applicationId);
    if (applicationId !== themeApplicationId) return;
  } else {
    elements.paletteStatus.textContent = `${THEMES[theme].name} · default colors`;
    setSyncBadge("Default");
    $("meta[name='color-scheme']").content = THEMES[theme].light ? "light" : "dark";
  }

  const defaults = getComputedStyle(elements.root);
  defaultThemeColors = {
    primary: hexColor(defaults.getPropertyValue("--accent-rgb").split(",").map(Number)),
    secondary: hexColor(defaults.getPropertyValue("--accent-2-rgb").split(",").map(Number)),
    mode: theme === "auto" ? elements.root.dataset.autoMode : (THEMES[theme].light ? "light" : "dark")
  };
  elements.root.style.setProperty("--accent-2-text", hexColor(onColor(colorRgb(defaultThemeColors.secondary))));
  applyColorPalette();
  renderColorPicker();
  elements.currentThemeName.textContent = THEMES[theme].name;
  renderDecorations();

  $$("[data-theme-choice]", elements.themeGrid).forEach(button => {
    const selected = button.dataset.themeChoice === theme;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderDecorations() {
  const layer = elements.themeDecorations;
  const kind = DECORATION_THEMES[state.theme] || "bubble";
  const motif = DECORATION_MOTIFS[kind];
  elements.enableDecorations.checked = state.decorations;
  elements.decorationHint.textContent = motif.label;
  layer.hidden = !state.decorations;
  if (!state.decorations) {
    layer.replaceChildren();
    delete layer.dataset.motif;
    return;
  }
  // Palette changes recolor the existing art without restarting its motion.
  if (layer.dataset.motif === kind) return;
  layer.replaceChildren();
  layer.dataset.motif = kind;
  layer.dataset.paused = String(document.hidden);
  for (let index = 0; index < motif.count; index++) {
    const particle = document.createElement("span");
    particle.className = "theme-particle";
    const duration = 24 + index % 6 * 4;
    particle.style.setProperty("--x", `${(index * 97 / motif.count + 2) % 98}%`);
    particle.style.setProperty("--mobile-x", `${(index * 97 / Math.min(motif.count, 9) + 2) % 98}%`);
    particle.style.setProperty("--size", `${motif.size * (.65 + index % 4 * .16)}px`);
    particle.style.setProperty("--duration", `${duration}s`);
    particle.style.setProperty("--delay", `${-duration * ((index * 37 + 17) % 100) / 100}s`);
    particle.style.setProperty("--rest", `${8 + (index * 31 + 17) % 80}vh`);
    particle.style.setProperty("--turn", `${index * 47 % 360}deg`);
    particle.style.setProperty("--drift", `${index % 2 ? -32 : 32}px`);
    particle.append(svg(motif.paths, motif.viewBox));
    layer.append(particle);
  }
}

function normalizeColors(value) {
  if (!value || typeof value !== "object") return null;
  if (![value.primary, value.secondary].every(color => typeof color === "string" && /^#[\da-f]{6}$/i.test(color))) return null;
  if (!["light", "dark"].includes(value.mode)) return null;
  return { primary: value.primary.toLowerCase(), secondary: value.secondary.toLowerCase(), mode: value.mode };
}

function colorRgb(hex) {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
}

function contrastRatio(first, second) {
  const a = luminance(first), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

function onColor(color) {
  return contrastRatio([0, 0, 0], color) > contrastRatio([255, 255, 255], color) ? [0, 0, 0] : [255, 255, 255];
}

function readableColor(color, background, ratio = 4.5) {
  if (contrastRatio(color, background) >= ratio) return color;
  const target = contrastRatio([0, 0, 0], background) > contrastRatio([255, 255, 255], background) ? [0, 0, 0] : [255, 255, 255];
  for (let step = 1; step <= 100; step++) {
    const candidate = mixColor(color, target, step / 100);
    if (contrastRatio(candidate, background) >= ratio) return candidate;
  }
  return target;
}

function buildColorPalette(colors) {
  const dark = colors.mode === "dark";
  const primary = colorRgb(colors.primary), secondary = colorRgb(colors.secondary);
  const bg = mixColor(primary, dark ? [12, 13, 17] : [251, 250, 253], .94);
  const surface = mixColor(primary, dark ? [26, 27, 33] : [244, 242, 248], .9);
  const strong = mixColor(primary, dark ? [40, 41, 49] : [229, 225, 235], .88);
  const text = dark ? [248, 246, 252] : [27, 25, 33];
  const accent = readableColor(primary, bg);
  const accentTwo = readableColor(secondary, bg);
  const onAccent = onColor(accent);
  const primaryContainer = mixColor(primary, dark ? [25, 23, 31] : [249, 246, 255], dark ? .72 : .8);
  const secondaryContainer = mixColor(secondary, dark ? [25, 23, 31] : [249, 246, 255], dark ? .78 : .84);
  return {
    "--bg": hexColor(bg), "--bg-rgb": rgbString(bg),
    "--surface": hexColor(surface), "--surface-strong": hexColor(strong), "--surface-solid": hexColor(surface),
    "--border": `rgba(${rgbString(text)}, .13)`, "--border-strong": `rgba(${rgbString(text)}, .28)`,
    "--text": hexColor(text), "--muted": hexColor(readableColor(mixColor(text, bg, .28), strong)),
    "--faint": hexColor(readableColor(mixColor(text, bg, .43), strong)),
    "--accent": hexColor(accent), "--accent-rgb": rgbString(accent),
    "--accent-2": hexColor(accentTwo), "--accent-2-rgb": rgbString(accentTwo), "--accent-text": hexColor(onAccent),
    "--accent-2-text": hexColor(onColor(accentTwo)),
    "--danger": dark ? "#ff909e" : "#a82c42",
    "--shadow": dark ? "0 24px 70px rgba(0, 0, 0, .26)" : "0 16px 44px rgba(25, 20, 35, .09)",
    "--primary-container": hexColor(primaryContainer), "--on-primary-container": hexColor(readableColor(text, primaryContainer)),
    "--secondary-container": hexColor(secondaryContainer), "--on-secondary-container": hexColor(readableColor(text, secondaryContainer)),
    "--decor-primary-rgb": rgbString(accent), "--decor-secondary-rgb": rgbString(accentTwo)
  };
}

function applyColorPalette() {
  if (!state.colors) return;
  Object.entries(buildColorPalette(state.colors)).forEach(([property, value]) => elements.root.style.setProperty(property, value));
  elements.root.dataset.customColors = "true";
  elements.root.style.colorScheme = state.colors.mode;
  $("meta[name='color-scheme']").content = state.colors.mode;
  elements.paletteStatus.textContent = `${THEMES[state.theme].name} · your colors`;
  setSyncBadge("Custom");
}

function rgbToHsv(rgb, fallbackHue = 0) {
  const [r, g, b] = rgb.map(channel => channel / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  let h = fallbackHue;
  if (delta) {
    h = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    h = ((h * 60) + 360) % 360;
  }
  return { h, s: max ? delta / max * 100 : 0, v: max * 100 };
}

function hsvToRgb({ h, s, v }) {
  const saturation = s / 100, value = v / 100;
  const channel = offset => {
    const k = (offset + h / 60) % 6;
    return Math.round(255 * value * (1 - saturation * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [channel(5), channel(3), channel(1)];
}

function renderColorPicker(syncHsv = true) {
  const colors = state.colors || defaultThemeColors;
  if (!colors) return;
  if (syncHsv) pickerHsv = rgbToHsv(colorRgb(colors[activePickerColor]), pickerHsv.h);
  elements.colorEditor.style.setProperty("--picker-hue", `hsl(${pickerHsv.h} 100% 50%)`);
  elements.colorEditor.style.setProperty("--picker-primary", colors.primary);
  elements.colorEditor.style.setProperty("--picker-secondary", colors.secondary);
  elements.colorCursor.style.left = `${pickerHsv.s}%`;
  elements.colorCursor.style.top = `${100 - pickerHsv.v}%`;
  elements.colorCursor.style.background = colors[activePickerColor];
  elements.colorField.setAttribute("aria-label", `${activePickerColor === "primary" ? "Primary" : "Secondary"} color gradient`);
  elements.colorField.setAttribute("aria-valuenow", String(Math.round(pickerHsv.s)));
  elements.colorField.setAttribute("aria-valuetext", `${colors[activePickerColor]}, saturation ${Math.round(pickerHsv.s)}%, brightness ${Math.round(pickerHsv.v)}%`);
  elements.colorHue.value = String(Math.round(pickerHsv.h));
  elements.colorHex.value = colors[activePickerColor];
  elements.colorHex.removeAttribute("aria-invalid");
  $$('[data-color-target]', elements.colorTargets).forEach(button => button.setAttribute("aria-pressed", String(button.dataset.colorTarget === activePickerColor)));
  $$('[data-color-mode]', elements.colorMode).forEach(button => {
    const selected = button.dataset.colorMode === colors.mode;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  elements.resetColors.disabled = !state.colors;
  elements.colorStatus.textContent = state.colors ? "Your colors · shades adjust for readability." : "Default colors · choose a color to make them yours.";
}

async function persistColors() {
  clearTimeout(colorSaveTimer);
  if (!await saveState()) elements.colorStatus.textContent = "Could not save your colors. Try adjusting them again.";
}

function editColors(changes, syncHsv = true) {
  state.colors = { ...(state.colors || defaultThemeColors), ...changes };
  applyColorPalette();
  renderColorPicker(syncHsv);
  clearTimeout(colorSaveTimer);
  colorSaveTimer = setTimeout(() => void persistColors(), 200);
}

function pickColorAt(event) {
  const rect = elements.colorField.getBoundingClientRect();
  pickerHsv.s = Math.min(100, Math.max(0, (event.clientX - rect.left) / rect.width * 100));
  pickerHsv.v = 100 - Math.min(100, Math.max(0, (event.clientY - rect.top) / rect.height * 100));
  editColors({ [activePickerColor]: hexColor(hsvToRgb(pickerHsv)) }, false);
}

function bindColorEvents() {
  $$('[data-color-target]', elements.colorTargets).forEach(button => button.addEventListener("click", () => {
    activePickerColor = button.dataset.colorTarget;
    renderColorPicker();
  }));
  elements.colorField.addEventListener("pointerdown", event => {
    if (event.button !== 0 || colorPointerId !== null) return;
    event.preventDefault();
    elements.colorField.focus({ preventScroll: true });
    colorPointerId = event.pointerId;
    elements.colorField.setPointerCapture(event.pointerId);
    pickColorAt(event);
  });
  elements.colorField.addEventListener("pointermove", event => {
    if (colorPointerId === event.pointerId) pickColorAt(event);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    elements.colorField.addEventListener(type, event => {
      if (colorPointerId !== event.pointerId) return;
      colorPointerId = null;
      void persistColors();
    });
  }
  elements.colorField.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    if (event.key === "ArrowLeft") pickerHsv.s = Math.max(0, pickerHsv.s - step);
    if (event.key === "ArrowRight") pickerHsv.s = Math.min(100, pickerHsv.s + step);
    if (event.key === "ArrowUp") pickerHsv.v = Math.min(100, pickerHsv.v + step);
    if (event.key === "ArrowDown") pickerHsv.v = Math.max(0, pickerHsv.v - step);
    if (event.key === "Home") pickerHsv.s = 0;
    if (event.key === "End") pickerHsv.s = 100;
    editColors({ [activePickerColor]: hexColor(hsvToRgb(pickerHsv)) }, false);
  });
  elements.colorHue.addEventListener("input", () => {
    pickerHsv.h = Number(elements.colorHue.value);
    editColors({ [activePickerColor]: hexColor(hsvToRgb(pickerHsv)) }, false);
  });
  elements.colorHue.addEventListener("change", () => void persistColors());
  elements.colorHex.addEventListener("input", () => {
    let hex = elements.colorHex.value.trim().replace(/^#/, "");
    if (/^[\da-f]{3}$/i.test(hex)) hex = hex.split("").map(character => character.repeat(2)).join("");
    if (!/^[\da-f]{6}$/i.test(hex)) {
      elements.colorHex.setAttribute("aria-invalid", "true");
      return;
    }
    // Keep the caret in place while typing a valid code.
    const value = elements.colorHex.value, caret = elements.colorHex.selectionStart;
    editColors({ [activePickerColor]: `#${hex.toLowerCase()}` });
    elements.colorHex.value = value;
    elements.colorHex.setSelectionRange(caret, caret);
  });
  elements.colorHex.addEventListener("blur", () => renderColorPicker());
  $$('[data-color-mode]', elements.colorMode).forEach(button => button.addEventListener("click", () => editColors({ mode: button.dataset.colorMode })));
  elements.resetColors.addEventListener("click", async () => {
    clearTimeout(colorSaveTimer);
    state.colors = null;
    await applyTheme();
    await persistColors();
  });
}

function applyLayout(layout = state.layout) {
  elements.root.dataset.layout = layout;
  $$('[data-layout-choice]', elements.layoutGrid).forEach(button => {
    const selected = button.dataset.layoutChoice === layout;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function normalizeBackground(preferences) {
  const value = preferences && typeof preferences === "object" ? preferences : {};
  return {
    dim: Number.isFinite(value.dim) ? Math.round(Math.min(90, Math.max(20, value.dim))) : 35,
    blur: Number.isFinite(value.blur) ? Math.round(Math.min(20, Math.max(0, value.blur))) : 0,
    position: BACKGROUND_POSITIONS.includes(value.position) ? value.position : "center"
  };
}

async function loadBackground() {
  try {
    const saved = webext?.storage?.local
      ? (await webext.storage.local.get(BACKGROUND_KEY))[BACKGROUND_KEY]
      : localStorage.getItem(BACKGROUND_KEY);
    // Only accept locally generated JPEG data, never URLs or arbitrary CSS.
    if (typeof saved === "string" && saved.length <= 4 * 1024 * 1024
      && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(saved)) {
      backgroundImage = saved;
    }
  } catch (error) {
    console.warn("Zenified could not load the background picture.", error);
    elements.backgroundStatus.textContent = "Could not load the saved picture. Try choosing it again.";
  }
}

function applyBackground() {
  const hasImage = Boolean(backgroundImage);
  const imageStyle = hasImage ? `url("${backgroundImage}")` : "none";
  elements.root.dataset.customBackground = String(hasImage);
  elements.customBackground.hidden = !hasImage;
  elements.customBackground.style.backgroundImage = imageStyle;
  elements.customBackground.style.backgroundPosition = state.background.position;
  elements.customBackground.style.setProperty("--background-blur", `${state.background.blur}px`);
  elements.root.style.setProperty("--background-overlay", state.background.dim / 100);
  elements.backgroundPreview.style.backgroundImage = imageStyle;
  elements.backgroundPreview.style.backgroundPosition = state.background.position;
  elements.backgroundPreview.firstElementChild.hidden = hasImage;
  elements.backgroundControls.disabled = !hasImage || backgroundBusy;
  elements.chooseBackground.disabled = backgroundBusy;
  elements.removeBackground.disabled = !hasImage || backgroundBusy;
  elements.chooseBackground.textContent = hasImage ? "Change picture" : "Choose picture";
  elements.backgroundDim.value = state.background.dim;
  elements.backgroundDimValue.value = `${state.background.dim}%`;
  elements.backgroundBlur.value = state.background.blur;
  elements.backgroundBlurValue.value = `${state.background.blur} px`;
  elements.backgroundPosition.value = state.background.position;
}

async function prepareBackground(file) {
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) {
    throw new Error("Choose a JPG, PNG, WebP, GIF or AVIF picture.");
  }
  if (file.size > MAX_BACKGROUND_FILE_SIZE) throw new Error("Choose a picture smaller than 15 MB.");
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read this picture. Try another file."));
    reader.readAsDataURL(file);
  });
  const image = new Image();
  image.src = data;
  try {
    await image.decode();
  } catch {
    throw new Error("Could not open this picture. Try another file.");
  }
  const scale = Math.min(1, 2560 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare this picture. Try again.");
  context.fillStyle = "#15141c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  let result = canvas.toDataURL("image/jpeg", 0.85);
  if (result.length > 4 * 1024 * 1024) result = canvas.toDataURL("image/jpeg", 0.65);
  if (result.length > 4 * 1024 * 1024) throw new Error("This picture is too detailed to save. Try a smaller picture.");
  return result;
}

async function chooseBackground(event) {
  const file = event.target.files?.[0];
  if (!file || backgroundBusy) return;
  backgroundBusy = true;
  applyBackground();
  elements.backgroundStatus.textContent = "Preparing your picture…";
  let prepared = false;
  try {
    const picture = await prepareBackground(file);
    prepared = true;
    if (webext?.storage?.local) {
      await webext.storage.local.set({ [BACKGROUND_KEY]: picture });
    } else {
      localStorage.setItem(BACKGROUND_KEY, picture);
    }
    backgroundImage = picture;
    elements.backgroundStatus.textContent = "Picture saved in this browser. Adjust its appearance below.";
    showToast("Background picture saved");
  } catch (error) {
    elements.backgroundStatus.textContent = prepared
      ? "Could not save the picture. Browser storage may be full. Try a smaller picture."
      : error.message;
  } finally {
    backgroundBusy = false;
    elements.backgroundFile.value = "";
    applyBackground();
  }
}

async function removeBackground() {
  if (backgroundBusy) return;
  backgroundBusy = true;
  applyBackground();
  try {
    if (webext?.storage?.local) await webext.storage.local.remove(BACKGROUND_KEY);
    else localStorage.removeItem(BACKGROUND_KEY);
    backgroundImage = "";
    elements.backgroundStatus.textContent = BACKGROUND_HELP;
    showToast("Background picture removed");
  } catch {
    elements.backgroundStatus.textContent = "Could not remove the saved picture. Please try again.";
  } finally {
    backgroundBusy = false;
    applyBackground();
  }
}

function renderSearchEngines() {
  elements.engineMenu.replaceChildren();
  elements.engineSelect.replaceChildren();

  Object.entries(SEARCH_ENGINES).forEach(([id, engine]) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = `engine-option${id === state.searchEngine ? " selected" : ""}`;
    option.dataset.engine = id;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(id === state.searchEngine));

    const glyph = document.createElement("span");
    glyph.className = "engine-glyph";
    glyph.textContent = engine.glyph;
    const name = document.createElement("span");
    name.textContent = engine.name;
    option.append(glyph, name, svg("m5 10 3 3 7-7", "0 0 20 20"));
    option.addEventListener("click", () => setSearchEngine(id));
    elements.engineMenu.append(option);

    const selectOption = document.createElement("option");
    selectOption.value = id;
    selectOption.textContent = engine.name;
    elements.engineSelect.append(selectOption);
  });

  updateSearchEngineUI();
}

function updateSearchEngineUI() {
  if (!SEARCH_ENGINES[state.searchEngine]) state.searchEngine = "duckduckgo";
  const engine = SEARCH_ENGINES[state.searchEngine];
  elements.engineGlyph.textContent = engine.glyph;
  elements.engineLabel.textContent = engine.name;
  elements.engineButton.title = `Search with ${engine.name}`;
  elements.engineSelect.value = state.searchEngine;
  $$(".engine-option", elements.engineMenu).forEach(option => {
    const selected = option.dataset.engine === state.searchEngine;
    option.classList.toggle("selected", selected);
    option.setAttribute("aria-selected", String(selected));
  });
}

function setSearchEngine(id) {
  if (!SEARCH_ENGINES[id]) return;
  state.searchEngine = id;
  updateSearchEngineUI();
  closeEngineMenu();
  void saveState();
  elements.searchInput.focus();
}

function toggleEngineMenu(force) {
  const shouldOpen = force ?? !elements.engineMenu.classList.contains("open");
  if (shouldOpen) closeSearchSuggestions();
  elements.engineMenu.classList.toggle("open", shouldOpen);
  elements.engineButton.setAttribute("aria-expanded", String(shouldOpen));
}

function closeEngineMenu() {
  toggleEngineMenu(false);
}

function normalizeAddress(value) {
  const input = value.trim();
  if (!input) return null;

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(input);
  const candidate = hasScheme ? input : `https://${input}`;
  try {
    const url = new URL(candidate);
    const allowed = ["http:", "https:", "ftp:"];
    return allowed.includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function looksLikeAddress(query) {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(query)
    || /^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(query)
    || (/^[^\s]+\.[a-z]{2,}(\/[^\s]*)?$/i.test(query) && !query.includes(" "));
}

function handleSearch(event) {
  event.preventDefault();
  closeSearchSuggestions();
  const query = elements.searchInput.value.trim();
  if (!query) return;

  if (query === "/bookmarks" || query.toLowerCase() === "@bookmarks") {
    elements.searchInput.value = "";
    openDrawer("bookmarks");
    return;
  }
  if (query === "/settings") {
    elements.searchInput.value = "";
    openDrawer("settings");
    return;
  }

  if (looksLikeAddress(query)) {
    const address = normalizeAddress(query);
    if (address) {
      location.assign(address);
      return;
    }
  }

  const engine = SEARCH_ENGINES[state.searchEngine] || SEARCH_ENGINES.duckduckgo;
  location.assign(`${engine.url}${encodeURIComponent(query)}`);
}

function isSuggestableUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function canonicalSuggestionUrl(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.pathname === "/" && !url.search) url.pathname = "";
    return url.href;
  } catch {
    return value;
  }
}

function suggestionDisplayUrl(value) {
  try {
    const url = new URL(value);
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${url.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return value;
  }
}

function suggestionMatchScore(title, url, query) {
  const normalizedQuery = query.toLowerCase();
  const normalizedTitle = String(title || "").toLowerCase();
  const normalizedUrl = String(url || "").toLowerCase();
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    // The URL is filtered before scoring.
  }

  let score = 0;
  if (normalizedTitle === normalizedQuery) score += 70;
  else if (normalizedTitle.startsWith(normalizedQuery)) score += 52;
  else if (normalizedTitle.includes(normalizedQuery)) score += 30;
  if (hostname === normalizedQuery) score += 64;
  else if (hostname.startsWith(normalizedQuery)) score += 48;
  else if (hostname.includes(normalizedQuery)) score += 28;
  if (normalizedUrl.includes(normalizedQuery)) score += 15;
  return score;
}

function appendHighlightedText(container, text, query) {
  const value = String(text || "");
  const terms = query.trim().split(/\s+/).filter(Boolean).sort((first, second) => second.length - first.length);
  const term = terms.find(candidate => value.toLowerCase().includes(candidate.toLowerCase()));
  if (!term) {
    container.textContent = value;
    return;
  }

  const index = value.toLowerCase().indexOf(term.toLowerCase());
  container.append(document.createTextNode(value.slice(0, index)));
  const mark = document.createElement("mark");
  mark.textContent = value.slice(index, index + term.length);
  container.append(mark, document.createTextNode(value.slice(index + term.length)));
}

function hideSearchSuggestions() {
  elements.searchSuggestions.hidden = true;
  elements.searchInput.setAttribute("aria-expanded", "false");
  elements.searchInput.removeAttribute("aria-activedescendant");
  activeSuggestionIndex = -1;
}

function closeSearchSuggestions() {
  clearTimeout(suggestionTimer);
  suggestionRequestId += 1;
  searchSuggestions = [];
  elements.suggestionList.replaceChildren();
  hideSearchSuggestions();
}

function openSearchSuggestion(suggestion) {
  closeSearchSuggestions();
  location.assign(suggestion.url);
}

function setActiveSuggestion(index) {
  if (!searchSuggestions.length) return;
  activeSuggestionIndex = (index + searchSuggestions.length) % searchSuggestions.length;
  $$(".suggestion-item", elements.suggestionList).forEach((item, itemIndex) => {
    const selected = itemIndex === activeSuggestionIndex;
    item.classList.toggle("active", selected);
    item.setAttribute("aria-selected", String(selected));
    if (selected) {
      elements.searchInput.setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView({ block: "nearest" });
    }
  });
}

function renderSearchSuggestions(query, suggestions) {
  searchSuggestions = suggestions;
  activeSuggestionIndex = -1;
  elements.suggestionList.replaceChildren();
  elements.searchInput.removeAttribute("aria-activedescendant");

  if (!suggestions.length) {
    hideSearchSuggestions();
    return;
  }

  suggestions.forEach((suggestion, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.id = `search-suggestion-${index}`;
    item.className = "suggestion-item";
    item.tabIndex = -1;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", "false");

    const icon = document.createElement("span");
    icon.className = `suggestion-icon ${suggestion.source}`;
    icon.append(suggestion.source === "bookmark"
      ? svg("M7 4.5h10v15L12 16.6 7 19.5v-15Z")
      : svg("M12 7v5l3.5 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"));

    const copy = document.createElement("span");
    copy.className = "suggestion-copy";
    const title = document.createElement("strong");
    appendHighlightedText(title, suggestion.title, query);
    const address = document.createElement("small");
    appendHighlightedText(address, suggestionDisplayUrl(suggestion.url), query);
    copy.append(title, address);

    const source = document.createElement("span");
    source.className = "suggestion-source";
    source.textContent = suggestion.source === "bookmark" ? "Bookmark" : "History";
    item.append(icon, copy, source, svg("M8 16 16 8M9 8h7v7"));
    item.addEventListener("click", event => {
      event.preventDefault();
      openSearchSuggestion(suggestion);
    });
    item.addEventListener("mouseenter", () => setActiveSuggestion(index));
    elements.suggestionList.append(item);
  });

  elements.searchSuggestions.hidden = false;
  elements.searchInput.setAttribute("aria-expanded", "true");
}

async function updateSearchSuggestions() {
  const query = elements.searchInput.value.trim();
  if (!query) {
    closeSearchSuggestions();
    return;
  }

  const requestId = ++suggestionRequestId;
  const historyPromise = webext?.history?.search
    ? webext.history.search({ text: query, startTime: 0, maxResults: 50 }).catch(() => [])
    : Promise.resolve([]);
  await ensureBookmarkData().catch(() => false);
  const historyItems = await historyPromise;
  if (requestId !== suggestionRequestId || elements.searchInput.value.trim() !== query) return;

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const candidates = new Map();
  const addCandidate = candidate => {
    if (!isSuggestableUrl(candidate.url)) return;
    const key = canonicalSuggestionUrl(candidate.url);
    const existing = candidates.get(key);
    if (!existing) {
      candidates.set(key, candidate);
      return;
    }
    existing.score = Math.max(existing.score, candidate.score) + Math.min(existing.score, candidate.score) * .12;
    if (candidate.source === "bookmark") {
      existing.source = "bookmark";
      if (candidate.title) existing.title = candidate.title;
    }
  };

  flatBookmarks.forEach(bookmark => {
    const searchable = `${bookmark.title || ""} ${bookmark.url || ""}`.toLowerCase();
    if (!terms.every(term => searchable.includes(term))) return;
    addCandidate({
      title: bookmark.title || suggestionDisplayUrl(bookmark.url),
      url: bookmark.url,
      source: "bookmark",
      score: 42 + suggestionMatchScore(bookmark.title, bookmark.url, query)
    });
  });

  historyItems.forEach(historyItem => {
    if (!historyItem.url) return;
    const ageInDays = Math.max(0, (Date.now() - (historyItem.lastVisitTime || 0)) / 86_400_000);
    const visitBoost = Math.min(20, Math.log2((historyItem.visitCount || 0) + 1) * 4);
    const typedBoost = Math.min(14, (historyItem.typedCount || 0) * 2.8);
    const recencyBoost = Math.max(0, 15 - Math.log2(ageInDays + 1) * 2.4);
    addCandidate({
      title: historyItem.title || suggestionDisplayUrl(historyItem.url),
      url: historyItem.url,
      source: "history",
      score: suggestionMatchScore(historyItem.title, historyItem.url, query) + visitBoost + typedBoost + recencyBoost
    });
  });

  const ranked = [...candidates.values()]
    .sort((first, second) => second.score - first.score || first.title.localeCompare(second.title))
    .slice(0, 7);
  renderSearchSuggestions(query, ranked);
}

function scheduleSearchSuggestions() {
  clearTimeout(suggestionTimer);
  activeSuggestionIndex = -1;
  if (!elements.searchInput.value.trim()) {
    closeSearchSuggestions();
    return;
  }
  suggestionTimer = setTimeout(() => void updateSearchSuggestions(), 90);
}

function handleSearchSuggestionKeys(event) {
  if (event.key === "ArrowDown" && searchSuggestions.length) {
    event.preventDefault();
    setActiveSuggestion(activeSuggestionIndex + 1);
  } else if (event.key === "ArrowUp" && searchSuggestions.length) {
    event.preventDefault();
    setActiveSuggestion(activeSuggestionIndex < 0 ? searchSuggestions.length - 1 : activeSuggestionIndex - 1);
  } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
    event.preventDefault();
    openSearchSuggestion(searchSuggestions[activeSuggestionIndex]);
  } else if (event.key === "Escape" && !elements.searchSuggestions.hidden) {
    event.preventDefault();
    event.stopPropagation();
    closeSearchSuggestions();
  } else if (event.key === "Tab") {
    closeSearchSuggestions();
  }
}

function colorFromText(text) {
  const palette = ["#7767dd", "#3d9e88", "#bd6e5f", "#437fc1", "#9b669d", "#b08545", "#557b67"];
  const hash = [...String(text)].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0);
  return palette[Math.abs(hash) % palette.length];
}

function shortcutInitial(shortcut) {
  return (shortcut.name || new URL(shortcut.url).hostname || "?").trim().charAt(0).toUpperCase();
}

function shortcutFaviconUrl(shortcutUrl) {
  try {
    const url = new URL(shortcutUrl);
    if (url.protocol !== "https:") return null;
    return new URL("/favicon.ico", url.origin).href;
  } catch {
    return null;
  }
}

function shortcutOrderFromGrid() {
  return $$(".shortcut[data-shortcut-id]", elements.shortcutGrid).map(item => item.dataset.shortcutId);
}

function beginShortcutDrag(id, wrapper, mode) {
  activeDragId = id;
  dragStartOrder = state.shortcuts.map(shortcut => shortcut.id).join("|");
  wrapper.classList.add("dragging", `${mode}-dragging`);
  wrapper.setAttribute("aria-grabbed", "true");
  elements.shortcutGrid.classList.add("is-reordering");
}

function moveDraggedShortcut(clientX, clientY) {
  const dragging = $(`.shortcut[data-shortcut-id="${CSS.escape(activeDragId)}"]`, elements.shortcutGrid);
  const target = document.elementFromPoint(clientX, clientY)?.closest(".shortcut[data-shortcut-id]");
  if (!dragging || !target || target === dragging || target.parentElement !== elements.shortcutGrid) return;

  const rect = target.getBoundingClientRect();
  const verticalOffset = clientY - (rect.top + rect.height / 2);
  const sameRow = Math.abs(verticalOffset) < rect.height * 0.34;
  const insertAfter = sameRow ? clientX > rect.left + rect.width / 2 : verticalOffset > 0;
  target[insertAfter ? "after" : "before"](dragging);
}

function finishShortcutDrag() {
  if (!activeDragId) return;
  const newOrder = shortcutOrderFromGrid();
  const shortcutsById = new Map(state.shortcuts.map(shortcut => [shortcut.id, shortcut]));
  const reordered = newOrder.map(id => shortcutsById.get(id)).filter(Boolean);
  state.shortcuts.forEach(shortcut => {
    if (!newOrder.includes(shortcut.id)) reordered.push(shortcut);
  });
  state.shortcuts = reordered;

  const changed = dragStartOrder !== state.shortcuts.map(shortcut => shortcut.id).join("|");
  $$(".shortcut", elements.shortcutGrid).forEach(item => {
    item.classList.remove("dragging", "pointer-dragging", "native-dragging");
    item.setAttribute("aria-grabbed", "false");
  });
  elements.shortcutGrid.classList.remove("is-reordering");
  activeDragId = null;
  pointerDragId = null;

  if (changed) {
    void saveState();
    showToast("Shortcut order saved");
  }
}

function moveShortcutWithKeyboard(id, key) {
  const currentIndex = state.shortcuts.findIndex(shortcut => shortcut.id === id);
  if (currentIndex < 0) return;
  const columns = Math.max(1, getComputedStyle(elements.shortcutGrid).gridTemplateColumns.split(" ").length);
  const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
  const targetIndex = Math.max(0, Math.min(state.shortcuts.length - 1, currentIndex + offsets[key]));
  if (targetIndex === currentIndex) return;

  const [shortcut] = state.shortcuts.splice(currentIndex, 1);
  state.shortcuts.splice(targetIndex, 0, shortcut);
  renderShortcuts();
  void saveState();
  showToast(`${shortcut.name} moved to position ${targetIndex + 1}`);
  requestAnimationFrame(() => {
    $(`.shortcut[data-shortcut-id="${CSS.escape(id)}"] .shortcut-drag-handle`, elements.shortcutGrid)?.focus();
  });
}

function attachShortcutReordering(wrapper, handle, shortcut) {
  wrapper.draggable = true;
  wrapper.dataset.shortcutId = shortcut.id;
  wrapper.setAttribute("aria-grabbed", "false");

  wrapper.addEventListener("dragstart", event => {
    if (pointerDragId) {
      event.preventDefault();
      return;
    }
    beginShortcutDrag(shortcut.id, wrapper, "native");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", shortcut.id);
  });
  wrapper.addEventListener("dragend", finishShortcutDrag);

  handle.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    moveShortcutWithKeyboard(shortcut.id, event.key);
  });
  handle.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.focus({ preventScroll: true });
    pointerDragId = shortcut.id;
    handle.setPointerCapture(event.pointerId);
    beginShortcutDrag(shortcut.id, wrapper, "pointer");
  });
  handle.addEventListener("pointermove", event => {
    if (pointerDragId !== shortcut.id || !handle.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    moveDraggedShortcut(event.clientX, event.clientY);
  });
  const finishPointerDrag = event => {
    if (pointerDragId !== shortcut.id) return;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    finishShortcutDrag();
  };
  handle.addEventListener("pointerup", finishPointerDrag);
  handle.addEventListener("pointercancel", finishPointerDrag);
}

function renderShortcuts() {
  elements.shortcutGrid.replaceChildren();

  state.shortcuts.slice(0, MAX_SHORTCUTS).forEach(shortcut => {
    const wrapper = document.createElement("div");
    wrapper.className = "shortcut";

    const link = document.createElement("a");
    link.className = "shortcut-link";
    link.href = shortcut.url;
    link.title = shortcut.url;
    link.draggable = false;

    const icon = document.createElement("span");
    icon.className = "shortcut-icon";
    icon.style.setProperty("--shortcut-color", colorFromText(shortcut.url));
    const initial = document.createElement("span");
    initial.className = "shortcut-initial";
    initial.textContent = shortcutInitial(shortcut);
    icon.append(initial);

    const faviconUrl = shortcutFaviconUrl(shortcut.url);
    if (faviconUrl) {
      const favicon = document.createElement("img");
      favicon.className = "shortcut-favicon";
      favicon.src = faviconUrl;
      favicon.alt = "";
      favicon.width = 28;
      favicon.height = 28;
      favicon.decoding = "async";
      favicon.referrerPolicy = "no-referrer";
      favicon.addEventListener("load", () => icon.classList.add("has-favicon"), { once: true });
      favicon.addEventListener("error", () => favicon.remove(), { once: true });
      icon.append(favicon);
    }

    const name = document.createElement("span");
    name.className = "shortcut-name";
    name.textContent = shortcut.name;
    link.append(icon, name);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "shortcut-edit";
    edit.title = `Edit ${shortcut.name}`;
    edit.setAttribute("aria-label", `Edit ${shortcut.name}`);
    edit.append(svg(["M5 12h.01", "M12 12h.01", "M19 12h.01"]));
    edit.addEventListener("click", () => openShortcutDialog(shortcut));

    const dragHandle = document.createElement("button");
    dragHandle.type = "button";
    dragHandle.className = "shortcut-drag-handle";
    dragHandle.title = `Drag to reorder ${shortcut.name}`;
    dragHandle.setAttribute("aria-label", `Reorder ${shortcut.name}. Use arrow keys or drag.`);
    dragHandle.draggable = false;
    dragHandle.append(svg([
      "M8 7h.01M12 7h.01M16 7h.01",
      "M8 12h.01M12 12h.01M16 12h.01",
      "M8 17h.01M12 17h.01M16 17h.01"
    ]));

    wrapper.append(link, dragHandle, edit);
    attachShortcutReordering(wrapper, dragHandle, shortcut);
    elements.shortcutGrid.append(wrapper);
  });

  if (state.showAddTile && state.shortcuts.length < MAX_SHORTCUTS) {
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add-shortcut";
    const addIcon = document.createElement("span");
    addIcon.className = "add-icon";
    addIcon.append(svg("M10 4v12M4 10h12", "0 0 20 20"));
    const addLabel = document.createElement("span");
    addLabel.className = "shortcut-name";
    addLabel.textContent = "Add new";
    add.append(addIcon, addLabel);
    add.addEventListener("click", () => openShortcutDialog());
    elements.shortcutGrid.append(add);
  }

  const atLimit = state.shortcuts.length >= MAX_SHORTCUTS;
  elements.addShortcutTop.disabled = atLimit;
  elements.addShortcutTop.title = atLimit ? `Maximum of ${MAX_SHORTCUTS} shortcuts reached` : "Add a shortcut";
  elements.showAddTile.checked = state.showAddTile;
}

function openShortcutDialog(shortcut = null) {
  elements.shortcutForm.reset();
  elements.shortcutError.textContent = "";
  elements.shortcutId.value = shortcut?.id || "";
  elements.shortcutName.value = shortcut?.name || "";
  elements.shortcutUrl.value = shortcut?.url || "";
  elements.shortcutDialogTitle.textContent = shortcut ? "Edit this place" : "Add a new place";
  elements.deleteShortcut.hidden = !shortcut;
  elements.shortcutDialog.showModal();
  requestAnimationFrame(() => elements.shortcutName.focus());
}

function closeShortcutDialog() {
  elements.shortcutDialog.close();
}

async function saveShortcut(event) {
  event.preventDefault();
  const name = elements.shortcutName.value.trim();
  const url = normalizeAddress(elements.shortcutUrl.value);

  if (!name) {
    elements.shortcutError.textContent = "Give this shortcut a name.";
    elements.shortcutName.focus();
    return;
  }
  if (!url) {
    elements.shortcutError.textContent = "Enter a valid http or https address.";
    elements.shortcutUrl.focus();
    return;
  }

  const id = elements.shortcutId.value;
  if (id) {
    const existing = state.shortcuts.find(shortcut => shortcut.id === id);
    if (existing) Object.assign(existing, { name, url });
  } else if (state.shortcuts.length < MAX_SHORTCUTS) {
    state.shortcuts.push({
      id: globalThis.crypto?.randomUUID?.() || `shortcut-${Date.now()}`,
      name,
      url
    });
  }

  await saveState();
  renderShortcuts();
  closeShortcutDialog();
  showToast(id ? "Shortcut updated" : "Shortcut added");
}

async function deleteCurrentShortcut() {
  const id = elements.shortcutId.value;
  if (!id) return;
  state.shortcuts = state.shortcuts.filter(shortcut => shortcut.id !== id);
  await saveState();
  renderShortcuts();
  closeShortcutDialog();
  showToast("Shortcut removed");
}

function countBookmarks(nodes) {
  return nodes.reduce((count, node) => {
    if (node.type === "separator") return count;
    return count + (node.url ? 1 : countBookmarks(node.children || []));
  }, 0);
}

function flattenBookmarkNodes(nodes, folderNames = []) {
  return nodes.flatMap(node => {
    if (node.type === "separator") return [];
    if (node.url) return [{ ...node, folderPath: folderNames.join(" / ") }];
    const nextFolders = node.title ? [...folderNames, node.title] : folderNames;
    return flattenBookmarkNodes(node.children || [], nextFolders);
  });
}

function bookmarkDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function createBookmarkItem(bookmark) {
  const link = document.createElement("a");
  link.className = "bookmark-item";
  link.href = bookmark.url;
  link.title = bookmark.url;

  const favicon = document.createElement("span");
  favicon.className = "bookmark-favicon";
  favicon.style.setProperty("--bookmark-color", colorFromText(bookmark.url));
  favicon.textContent = (bookmark.title || bookmarkDomain(bookmark.url)).charAt(0);

  const meta = document.createElement("span");
  meta.className = "bookmark-meta";
  const title = document.createElement("span");
  title.className = "bookmark-title";
  title.textContent = bookmark.title || bookmarkDomain(bookmark.url);
  const address = document.createElement("span");
  address.className = "bookmark-url";
  address.textContent = bookmark.folderPath || bookmarkDomain(bookmark.url);
  meta.append(title, address);

  link.append(favicon, meta, svg("M8 16 16 8M9 8h7v7"));
  return link;
}

function createBookmarkSeparator() {
  const separator = document.createElement("div");
  separator.className = "bookmark-separator";
  separator.setAttribute("role", "separator");
  separator.setAttribute("aria-orientation", "horizontal");
  const diamond = document.createElement("span");
  diamond.setAttribute("aria-hidden", "true");
  separator.append(diamond);
  return separator;
}

function createBookmarkNode(node, depth = 0) {
  if (node.type === "separator") return createBookmarkSeparator();
  return node.url ? createBookmarkItem(node) : createBookmarkFolder(node, depth);
}

function createBookmarkFolder(folder, depth = 0) {
  const details = document.createElement("details");
  details.className = "bookmark-folder";
  if (depth === 0) details.open = true;

  const summary = document.createElement("summary");
  summary.append(svg("M3.5 6.5h6l2 2h9v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-11Z"));
  const name = document.createElement("span");
  name.textContent = folder.title || "Bookmarks";
  const count = document.createElement("span");
  count.className = "folder-count";
  count.textContent = countBookmarks(folder.children || []);
  const chevron = svg("m8 5 5 5-5 5", "0 0 20 20");
  chevron.classList.add("folder-chevron");
  summary.append(name, count, chevron);
  details.append(summary);

  const children = document.createElement("div");
  children.className = "bookmark-children";
  (folder.children || []).forEach(node => {
    children.append(createBookmarkNode(node, depth + 1));
  });
  details.append(children);
  return details;
}

function renderEmptyBookmarks(title, message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  const icon = document.createElement("span");
  icon.className = "empty-state-icon";
  icon.append(svg("M6.75 4.75A1.75 1.75 0 0 1 8.5 3h7a1.75 1.75 0 0 1 1.75 1.75V20l-5.25-3.1L6.75 20V4.75Z"));
  const strong = document.createElement("strong");
  strong.textContent = title;
  const text = document.createElement("p");
  text.textContent = message;
  empty.append(icon, strong, text);
  elements.bookmarkContent.replaceChildren(empty);
}

function renderBookmarkTree() {
  const query = elements.bookmarkSearch.value.trim().toLowerCase();
  elements.bookmarkContent.replaceChildren();

  if (!flatBookmarks.length) {
    renderEmptyBookmarks("No bookmarks yet", "Save a page in Firefox and it will appear here automatically.");
    return;
  }

  if (query) {
    const matches = flatBookmarks.filter(bookmark => {
      const searchable = `${bookmark.title || ""} ${bookmark.url || ""} ${bookmark.folderPath || ""}`.toLowerCase();
      return searchable.includes(query);
    }).slice(0, 250);

    if (!matches.length) {
      renderEmptyBookmarks("Nothing found", `No bookmark matches “${elements.bookmarkSearch.value.trim()}”.`);
      return;
    }
    matches.forEach(bookmark => elements.bookmarkContent.append(createBookmarkItem(bookmark)));
    return;
  }

  const roots = bookmarkTree?.[0]?.children || [];
  roots.forEach(root => elements.bookmarkContent.append(createBookmarkNode(root)));
}

async function ensureBookmarkData(force = false) {
  if (force) {
    bookmarkTree = null;
    flatBookmarks = [];
    bookmarkLoadPromise = null;
  }
  if (bookmarkTree) return true;
  if (!webext?.bookmarks?.getTree) return false;

  if (!bookmarkLoadPromise) {
    bookmarkLoadPromise = webext.bookmarks.getTree().then(tree => {
      bookmarkTree = tree;
      flatBookmarks = flattenBookmarkNodes(tree);
      return true;
    }).catch(error => {
      bookmarkLoadPromise = null;
      throw error;
    });
  }
  await bookmarkLoadPromise;
  return true;
}

async function loadBookmarks(force = false) {
  if (!webext?.bookmarks?.getTree) {
    elements.bookmarkCount.textContent = "Preview mode";
    renderEmptyBookmarks("Firefox access needed", "Load this folder as an extension to browse your real Firefox bookmarks.");
    return;
  }

  try {
    await ensureBookmarkData(force);
    elements.bookmarkCount.textContent = `${flatBookmarks.length} bookmark${flatBookmarks.length === 1 ? "" : "s"}`;
    renderBookmarkTree();
  } catch (error) {
    console.warn("Zenified could not access bookmarks.", error);
    renderEmptyBookmarks("Bookmarks unavailable", "Check that bookmark permission is enabled for Zenified Start Page.");
  }
}

function openDrawer(name) {
  closeEngineMenu();
  closeSearchSuggestions();
  const drawer = name === "bookmarks" ? elements.bookmarksDrawer : elements.settingsDrawer;
  const other = name === "bookmarks" ? elements.settingsDrawer : elements.bookmarksDrawer;
  other.classList.remove("open");
  other.setAttribute("aria-hidden", "true");
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  elements.scrim.hidden = false;
  requestAnimationFrame(() => elements.scrim.classList.add("visible"));
  activeDrawer = drawer;

  if (name === "bookmarks") {
    void loadBookmarks();
  }
  setTimeout(() => {
    // Keep focus on a control the user already selected during the opening animation.
    if (activeDrawer !== drawer || drawer.contains(document.activeElement)) return;
    const target = name === "bookmarks" ? elements.bookmarkSearch : $("[data-close-drawer]", drawer);
    target?.focus({ preventScroll: true });
  }, 220);
}

function closeDrawers() {
  if (!activeDrawer) return;
  elements.bookmarksDrawer.classList.remove("open");
  elements.settingsDrawer.classList.remove("open");
  elements.bookmarksDrawer.setAttribute("aria-hidden", "true");
  elements.settingsDrawer.setAttribute("aria-hidden", "true");
  elements.scrim.classList.remove("visible");
  activeDrawer = null;
  setTimeout(() => {
    if (!activeDrawer) elements.scrim.hidden = true;
  }, 250);
}

function syncFocusFromEndTime() {
  if (!state.focus.running || !state.focus.endAt) return;
  state.focus.remaining = Math.max(0, Math.ceil((state.focus.endAt - Date.now()) / 1000));
  if (state.focus.remaining === 0) completeFocus();
}

function updateFocusUI() {
  syncFocusFromEndTime();
  const minutes = Math.floor(state.focus.remaining / 60);
  const seconds = state.focus.remaining % 60;
  elements.focusTime.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  elements.focusToggle.classList.toggle("running", state.focus.running);
  elements.focusToggle.setAttribute("aria-label", state.focus.running ? "Pause focus timer" : "Start focus timer");
  elements.focusStatus.textContent = state.focus.completed
    ? "A focused moment, complete"
    : state.focus.running ? "Protect this time" : state.focus.remaining < state.focus.total ? "Paused" : "Ready when you are";
  const progress = Math.max(0, Math.min(100, ((state.focus.total - state.focus.remaining) / state.focus.total) * 100));
  elements.focusProgress.style.setProperty("--timer-progress", `${progress}%`);
}

function runFocusInterval() {
  clearInterval(focusInterval);
  if (!state.focus.running) return;
  focusInterval = setInterval(updateFocusUI, 500);
}

async function toggleFocus() {
  syncFocusFromEndTime();
  state.focus.completed = false;
  if (state.focus.running) {
    state.focus.running = false;
    state.focus.endAt = null;
  } else {
    if (state.focus.remaining <= 0) state.focus.remaining = state.focus.total;
    state.focus.running = true;
    state.focus.endAt = Date.now() + state.focus.remaining * 1000;
  }
  updateFocusUI();
  runFocusInterval();
  await saveState();
}

async function resetFocus() {
  state.focus = clone(DEFAULT_STATE.focus);
  clearInterval(focusInterval);
  updateFocusUI();
  await saveState();
  showToast("Focus timer reset");
}

function completeFocus() {
  if (!state.focus.running) return;
  state.focus.running = false;
  state.focus.endAt = null;
  state.focus.remaining = 0;
  state.focus.completed = true;
  clearInterval(focusInterval);
  void saveState();
  showToast("Focus session complete");
}

function handleNoteInput() {
  clearTimeout(noteSaveTimer);
  elements.noteStatus.textContent = "Saving…";
  elements.noteStatus.classList.add("visible");
  noteSaveTimer = setTimeout(async () => {
    state.note = elements.quickNote.value;
    await saveState();
    elements.noteStatus.textContent = "Saved locally";
    setTimeout(() => elements.noteStatus.classList.remove("visible"), 1300);
  }, 450);
}

function insertTypedCharacter(input, character) {
  const wasFocused = document.activeElement === input;
  input.focus();
  const start = wasFocused ? (input.selectionStart ?? input.value.length) : input.value.length;
  const end = wasFocused ? (input.selectionEnd ?? start) : input.value.length;
  input.setRangeText(character, start, end, "end");
  input.dispatchEvent(new InputEvent("input", {
    bubbles: true,
    inputType: "insertText",
    data: character
  }));
}

function handleGlobalKeydown(event) {
  const targetIsField = /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable;
  const targetIsInteractive = Boolean(event.target.closest?.("button, a, summary, [role='button']"));

  if (event.key === "Escape") {
    closeEngineMenu();
    closeDrawers();
    if (elements.shortcutDialog.open) closeShortcutDialog();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    closeDrawers();
    elements.searchInput.focus();
    elements.searchInput.select();
    return;
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey && event.code === "KeyB") {
    event.preventDefault();
    openDrawer("bookmarks");
    return;
  }

  if (targetIsField || elements.shortcutDialog.open) return;
  if (event.key === "/") {
    event.preventDefault();
    if (activeDrawer === elements.bookmarksDrawer) {
      elements.bookmarkSearch.focus();
    } else {
      closeDrawers();
      elements.searchInput.focus();
    }
    return;
  }

  const canCaptureTyping = !event.ctrlKey
    && !event.metaKey
    && !event.altKey
    && !event.isComposing
    && event.key.length === 1
    && activeDrawer !== elements.settingsDrawer;
  if (canCaptureTyping) {
    if (event.key === " " && targetIsInteractive) return;
    event.preventDefault();
    const input = activeDrawer === elements.bookmarksDrawer ? elements.bookmarkSearch : elements.searchInput;
    if (input === elements.searchInput) closeEngineMenu();
    if (event.key !== " " || input.value) insertTypedCharacter(input, event.key);
    else input.focus();
  }
}

function bindEvents() {
  bindColorEvents();
  elements.searchForm.addEventListener("submit", handleSearch);
  elements.searchInput.addEventListener("input", scheduleSearchSuggestions);
  elements.searchInput.addEventListener("keydown", handleSearchSuggestionKeys);
  elements.searchInput.addEventListener("focus", () => {
    if (elements.searchInput.value.trim()) scheduleSearchSuggestions();
  });
  elements.engineButton.addEventListener("click", () => toggleEngineMenu());
  elements.engineSelect.addEventListener("change", event => setSearchEngine(event.target.value));
  document.addEventListener("click", event => {
    if (!event.target.closest(".engine-picker")) closeEngineMenu();
    if (!event.target.closest(".search-section")) closeSearchSuggestions();
  });

  $("#bookmarksButton").addEventListener("click", () => openDrawer("bookmarks"));
  $("#settingsButton").addEventListener("click", () => openDrawer("settings"));
  elements.scrim.addEventListener("click", closeDrawers);
  $$('[data-close-drawer]').forEach(button => button.addEventListener("click", closeDrawers));

  elements.bookmarkSearch.addEventListener("input", renderBookmarkTree);
  elements.addShortcutTop.addEventListener("click", () => openShortcutDialog());
  elements.shortcutGrid.addEventListener("dragover", event => {
    if (!activeDragId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    moveDraggedShortcut(event.clientX, event.clientY);
  });
  elements.shortcutGrid.addEventListener("drop", event => {
    if (activeDragId) event.preventDefault();
  });
  $("#closeShortcutDialog").addEventListener("click", closeShortcutDialog);
  $("#cancelShortcut").addEventListener("click", closeShortcutDialog);
  elements.shortcutForm.addEventListener("submit", saveShortcut);
  elements.deleteShortcut.addEventListener("click", deleteCurrentShortcut);

  $$("[data-theme-choice]", elements.themeGrid).forEach(button => {
    button.addEventListener("click", async () => {
      state.theme = button.dataset.themeChoice;
      elements.themeLibrary.open = false;
      await applyTheme();
      $("summary", elements.themeLibrary).focus({ preventScroll: true });
      await saveState();
    });
  });

  $$("[data-layout-choice]", elements.layoutGrid).forEach(button => {
    button.addEventListener("click", async () => {
      state.layout = button.dataset.layoutChoice;
      applyLayout();
      await saveState();
    });
  });

  elements.showAddTile.addEventListener("change", async () => {
    state.showAddTile = elements.showAddTile.checked;
    renderShortcuts();
    await saveState();
  });

  elements.enableDecorations.addEventListener("change", async () => {
    state.decorations = elements.enableDecorations.checked;
    renderDecorations();
    if (!await saveState()) showToast("Could not save your flourishes setting. Please try again.");
  });
  document.addEventListener("visibilitychange", () => {
    elements.themeDecorations.dataset.paused = String(document.hidden);
  });

  elements.chooseBackground.addEventListener("click", () => elements.backgroundFile.click());
  elements.backgroundFile.addEventListener("change", chooseBackground);
  elements.removeBackground.addEventListener("click", removeBackground);
  [elements.backgroundDim, elements.backgroundBlur].forEach(input => {
    input.addEventListener("input", () => {
      state.background[input === elements.backgroundDim ? "dim" : "blur"] = Number(input.value);
      applyBackground();
    });
    input.addEventListener("change", () => void saveState());
  });
  elements.backgroundPosition.addEventListener("change", async () => {
    state.background.position = elements.backgroundPosition.value;
    applyBackground();
    await saveState();
  });

  $$("[data-format]", elements.clockFormat).forEach(button => {
    button.addEventListener("click", async () => {
      state.clockFormat = button.dataset.format;
      updateClockControls();
      await saveState();
    });
  });

  elements.clockToggle.addEventListener("click", async () => {
    state.clockFormat = state.clockFormat === "24" ? "12" : "24";
    updateClockControls();
    await saveState();
  });

  elements.quickNote.addEventListener("input", handleNoteInput);
  elements.focusToggle.addEventListener("click", toggleFocus);
  elements.focusReset.addEventListener("click", resetFocus);
  document.addEventListener("keydown", handleGlobalKeydown);

  const systemScheme = matchMedia("(prefers-color-scheme: dark)");
  systemScheme.addEventListener("change", () => {
    if (state.theme === "auto") void applyTheme();
  });

  if (webext?.theme?.onUpdated) {
    webext.theme.onUpdated.addListener(() => {
      if (state.theme === "auto") void applyTheme();
    });
  }

  if (webext?.bookmarks) {
    const refresh = () => {
      bookmarkTree = null;
      flatBookmarks = [];
      bookmarkLoadPromise = null;
      if (activeDrawer === elements.bookmarksDrawer) void loadBookmarks(true);
    };
    webext.bookmarks.onCreated?.addListener(refresh);
    webext.bookmarks.onRemoved?.addListener(refresh);
    webext.bookmarks.onChanged?.addListener(refresh);
    webext.bookmarks.onMoved?.addListener(refresh);
  }
}

async function initialize() {
  updateClock();
  setInterval(updateClock, 1000);
  await loadState();
  if (!SEARCH_ENGINES[state.searchEngine]) state.searchEngine = "duckduckgo";
  if (!THEMES[state.theme]) state.theme = "auto";
  state.colors = normalizeColors(state.colors);
  if (!LAYOUTS.includes(state.layout)) state.layout = "centered";
  if (typeof state.showAddTile !== "boolean") state.showAddTile = true;
  if (typeof state.decorations !== "boolean") state.decorations = false;
  if (!["12", "24"].includes(state.clockFormat)) state.clockFormat = "24";
  state.background = normalizeBackground(state.background);
  await loadBackground();

  elements.quickNote.value = state.note || "";
  renderSearchEngines();
  applyLayout();
  applyBackground();
  renderShortcuts();
  updateClockControls();
  updateFocusUI();
  runFocusInterval();
  bindEvents();
  await applyTheme();
}

void initialize();
