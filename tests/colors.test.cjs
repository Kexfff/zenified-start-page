const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const source = readFileSync(join(__dirname, '../app.js'), 'utf8').replace('void initialize();', '');

function harness(extension = false) {
  const nodes = new Map(), storage = new Map();
  const node = selector => {
    if (!nodes.has(selector)) {
      const properties = new Map();
      nodes.set(selector, {
        textContent: '', dataset: {}, value: '',
        style: {
          setProperty: (name, value) => properties.set(name, value),
          removeProperty: name => properties.delete(name),
          getPropertyValue: name => properties.get(name) || ''
        },
        setAttribute(name, value) { if (name === 'data-auto-mode') this.dataset.autoMode = value; },
        removeAttribute(name) {
          if (name === 'data-auto-mode') delete this.dataset.autoMode;
          if (name === 'data-custom-colors') delete this.dataset.customColors;
        },
        querySelectorAll: () => [], replaceChildren() {}
      });
    }
    return nodes.get(selector);
  };
  const context = vm.createContext({
    document: { documentElement: node('root'), querySelector: node, querySelectorAll: () => [], createElement: node, createTextNode: value => value },
    getComputedStyle: element => ({ getPropertyValue: name => element.style.getPropertyValue(name) || ({ '--accent-rgb': '147, 132, 255', '--accent-2-rgb': '84, 216, 194' }[name] || '') }),
    matchMedia: () => ({ matches: true }),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    console: { warn() {}, info() {} }, clearTimeout() {}
  });
  if (extension) context.browser = { storage: { local: {
    get: async key => ({ [key]: storage.get(key) }),
    set: async object => Object.entries(object).forEach(([key, value]) => storage.set(key, value))
  } } };
  vm.runInContext(source, context);
  return { context, nodes, storage, run: code => vm.runInContext(code, context) };
}

test('old preferences use original colors; malformed saved colors cannot inject CSS', async () => {
  const h = harness();
  h.storage.set('zenifiedState', JSON.stringify({ theme: 'nocturne', note: 'Keep this note' }));
  await h.run('loadState()');
  assert.equal(h.run('state.colors'), null);
  assert.equal(h.run('state.note'), 'Keep this note');
  for (const value of [null, 'broken', {}, { primary: '#123456', secondary: 'url(https://example.com)', mode: 'dark' }, { primary: '#123456', secondary: '#abcdef', mode: 'invalid' }]) {
    h.context.savedColor = value;
    assert.equal(h.run('normalizeColors(savedColor)'), null);
  }
  assert.deepEqual(JSON.parse(h.run('JSON.stringify(normalizeColors({primary:"#ABCDEF",secondary:"#123456",mode:"light"}))')), { primary: '#abcdef', secondary: '#123456', mode: 'light' });
});

test('generated text, accents and Material container pairs remain readable at extreme colors', () => {
  const h = harness();
  const samples = ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#777777'];
  for (const mode of ['light', 'dark']) for (const primary of samples) for (const secondary of samples) {
    h.context.colors = { primary, secondary, mode };
    const ratios = JSON.parse(h.run(`JSON.stringify((() => {
      const p = buildColorPalette(colors);
      return [
        ['--text', '--bg'], ['--muted', '--surface-strong'], ['--faint', '--surface-strong'],
        ['--accent', '--bg'], ['--accent-2', '--bg'], ['--accent-text', '--accent'],
        ['--accent-2-text', '--accent-2'],
        ['--on-primary-container', '--primary-container'], ['--on-secondary-container', '--secondary-container']
      ].map(([a, b]) => contrastRatio(colorRgb(p[a]), colorRgb(p[b])));
    })())`));
    assert.ok(ratios.every(ratio => ratio >= 4.5), `${mode} ${primary} ${secondary}: ${ratios}`);
  }
});

for (const extension of [false, true]) {
  test(`${extension ? 'Firefox' : 'preview'} preserves independent colors and can save a reset`, async () => {
    const h = harness(extension);
    h.run('state.colors = {primary:"#0099cc",secondary:"#cc6600",mode:"dark"}; state.theme = "material"');
    assert.equal(await h.run('saveState()'), true);
    h.run('state = clone(DEFAULT_STATE)');
    await h.run('loadState()');
    assert.equal(h.run('state.theme'), 'material');
    assert.equal(h.run('state.colors.primary'), '#0099cc');
    h.run('state.theme = "nocturne"');
    assert.equal(h.run('state.colors.primary'), '#0099cc');
    h.run('state.colors = null');
    await h.run('saveState()');
    h.run('state = clone(DEFAULT_STATE)');
    await h.run('loadState()');
    assert.equal(h.run('state.colors'), null);
    assert.equal(h.run('state.theme'), 'nocturne');
  });
}

test('a failed color save is reported instead of appearing successful', async () => {
  const h = harness();
  h.context.localStorage.setItem = () => { throw Error('quota'); };
  await h.run('persistColors()');
  assert.match(h.nodes.get('#colorStatus').textContent, /Could not save/);
});

test('color conversion keeps gradient edges and grey hue selection stable', () => {
  const h = harness();
  assert.equal(h.run('hexColor(hsvToRgb({h:120,s:100,v:100}))'), '#00ff00');
  assert.equal(h.run('hexColor(hsvToRgb({h:230,s:0,v:100}))'), '#ffffff');
  assert.equal(h.run('hexColor(hsvToRgb({h:230,s:100,v:0}))'), '#000000');
  assert.equal(h.run('rgbToHsv([0,0,0],230).h'), 230);
  assert.equal(h.run('hexColor(hsvToRgb(rgbToHsv([42,135,210])))'), '#2a87d2');
});

test('browser palette updates keep custom colors until reset', async () => {
  const h = harness(true);
  h.context.browser.theme = { getCurrent: async () => ({ colors: { toolbar: [30, 20, 40], icons_attention: [20, 220, 180] } }) };
  h.run('state.colors = {primary:"#dd8800",secondary:"#0088dd",mode:"light"}');
  await h.run('applyTheme()');
  const expected = h.run('buildColorPalette(state.colors)["--accent"]');
  assert.equal(h.nodes.get('root').style.getPropertyValue('--accent'), expected);
  assert.equal(h.nodes.get('root').style.colorScheme, 'light');
  await h.run('applyTheme()');
  assert.equal(h.nodes.get('root').style.getPropertyValue('--accent'), expected);
  h.run('state.colors = null');
  await h.run('applyTheme()');
  assert.equal(h.nodes.get('root').dataset.customColors, undefined);
  assert.equal(h.nodes.get('root').style.getPropertyValue('--accent'), '#14dcb4');
  assert.equal(h.nodes.get('root').style.getPropertyValue('--primary-container'), '');
});

test('a delayed browser theme cannot overwrite a newer style selection', async () => {
  const h = harness(true);
  let resolveTheme;
  h.context.browser.theme = { getCurrent: () => new Promise(resolve => { resolveTheme = resolve; }) };
  const pending = h.run('applyTheme()');
  h.run('state.theme = "nocturne"; state.colors = {primary:"#dd8800",secondary:"#0088dd",mode:"dark"}');
  await h.run('applyTheme()');
  resolveTheme({ colors: { toolbar: [255, 255, 255], icons_attention: [0, 0, 0] } });
  await pending;
  assert.equal(h.nodes.get('root').dataset.theme, 'nocturne');
  assert.equal(h.nodes.get('#currentThemeName').textContent, 'Nocturne');
  assert.equal(h.nodes.get('root').style.getPropertyValue('--accent'), h.run('buildColorPalette(state.colors)["--accent"]'));
});
