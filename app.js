"use strict";

const webext = globalThis.browser;
const STORAGE_KEY = "zenifiedState";
const MAX_SHORTCUTS = 12;
const FOCUS_DURATION = 25 * 60;
const THEMES = {
  auto: { name: "Auto", light: false },
  amoled: { name: "AMOLED black", light: false },
  aurora: { name: "Aurora", light: false },
  dawn: { name: "Dawn", light: true },
  slate: { name: "Slate", light: false },
  sakura: { name: "Sakura", light: true },
  ultraviolet: { name: "Ultraviolet", light: false },
  blueprint: { name: "Blueprint", light: false }
};
const LAYOUTS = ["centered", "split", "compact"];

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
  layout: "centered",
  showAddTile: true,
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
  "--accent-text", "--danger", "--shadow"
];

const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
const clone = value => JSON.parse(JSON.stringify(value));

let state = clone(DEFAULT_STATE);
let bookmarkTree = null;
let flatBookmarks = [];
let activeDrawer = null;
let focusInterval = null;
let noteSaveTimer = null;
let toastTimer = null;
let activeDragId = null;
let dragStartOrder = "";
let pointerDragId = null;

const elements = {
  root: document.documentElement,
  clock: $("#clock"),
  date: $("#date"),
  greeting: $("#greeting"),
  clockToggle: $("#clockToggle"),
  searchForm: $("#searchForm"),
  searchInput: $("#searchInput"),
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
  layoutGrid: $("#layoutGrid"),
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
  } catch (error) {
    console.warn("Zenified could not save preferences.", error);
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
  AUTO_STYLE_PROPERTIES.forEach(property => elements.root.style.removeProperty(property));
  elements.root.removeAttribute("data-auto-mode");
}

async function applyAutoTheme() {
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
  clearAutoPalette();
  elements.root.dataset.theme = theme;
  elements.root.style.colorScheme = "";

  if (theme === "auto") {
    await applyAutoTheme();
  } else {
    elements.paletteStatus.textContent = `${THEMES[theme].name} palette`;
    setSyncBadge("Manual");
    $("meta[name='color-scheme']").content = THEMES[theme].light ? "light" : "dark";
  }

  $$("[data-theme-choice]", elements.themeGrid).forEach(button => {
    const selected = button.dataset.themeChoice === theme;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
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
  return nodes.reduce((count, node) => count + (node.url ? 1 : countBookmarks(node.children || [])), 0);
}

function flattenBookmarkNodes(nodes, folderNames = []) {
  return nodes.flatMap(node => {
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
    children.append(node.url ? createBookmarkItem(node) : createBookmarkFolder(node, depth + 1));
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
  roots.forEach(root => elements.bookmarkContent.append(root.url ? createBookmarkItem(root) : createBookmarkFolder(root)));
}

async function loadBookmarks(force = false) {
  if (bookmarkTree && !force) return;
  if (!webext?.bookmarks?.getTree) {
    elements.bookmarkCount.textContent = "Preview mode";
    renderEmptyBookmarks("Firefox access needed", "Load this folder as an extension to browse your real Firefox bookmarks.");
    return;
  }

  try {
    bookmarkTree = await webext.bookmarks.getTree();
    flatBookmarks = flattenBookmarkNodes(bookmarkTree);
    elements.bookmarkCount.textContent = `${flatBookmarks.length} bookmark${flatBookmarks.length === 1 ? "" : "s"}`;
    renderBookmarkTree();
  } catch (error) {
    console.warn("Zenified could not access bookmarks.", error);
    renderEmptyBookmarks("Bookmarks unavailable", "Check that bookmark permission is enabled for Zenified Start Page.");
  }
}

function openDrawer(name) {
  closeEngineMenu();
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
    setTimeout(() => elements.bookmarkSearch.focus(), 220);
  } else {
    setTimeout(() => $("[data-theme-choice]", drawer)?.focus(), 220);
  }
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

function handleGlobalKeydown(event) {
  const targetIsField = /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable;

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

  if (targetIsField) return;
  if (event.key === "/") {
    event.preventDefault();
    if (activeDrawer === elements.bookmarksDrawer) {
      elements.bookmarkSearch.focus();
    } else {
      closeDrawers();
      elements.searchInput.focus();
    }
  } else if (event.key.toLowerCase() === "b") {
    event.preventDefault();
    openDrawer("bookmarks");
  }
}

function bindEvents() {
  elements.searchForm.addEventListener("submit", handleSearch);
  elements.engineButton.addEventListener("click", () => toggleEngineMenu());
  elements.engineSelect.addEventListener("change", event => setSearchEngine(event.target.value));
  document.addEventListener("click", event => {
    if (!event.target.closest(".engine-picker")) closeEngineMenu();
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
      await applyTheme();
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
    if (state.theme === "auto") void applyAutoTheme();
  });

  if (webext?.theme?.onUpdated) {
    webext.theme.onUpdated.addListener(() => {
      if (state.theme === "auto") void applyAutoTheme();
    });
  }

  if (webext?.bookmarks) {
    const refresh = () => {
      bookmarkTree = null;
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
  if (!LAYOUTS.includes(state.layout)) state.layout = "centered";
  if (typeof state.showAddTile !== "boolean") state.showAddTile = true;
  if (!["12", "24"].includes(state.clockFormat)) state.clockFormat = "24";

  elements.quickNote.value = state.note || "";
  renderSearchEngines();
  applyLayout();
  renderShortcuts();
  updateClockControls();
  updateFocusUI();
  runFocusInterval();
  bindEvents();
  await applyTheme();
}

void initialize();
