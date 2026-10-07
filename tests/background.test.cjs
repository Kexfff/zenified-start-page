const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8').replace('void initialize();', '');
const picture = 'data:image/jpeg;base64,dGVzdA==';

function harness(extension = false) {
  const nodes = new Map();
  const storage = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      value: '', textContent: '', dataset: {}, firstElementChild: {},
      style: { setProperty() {} }, classList: { add() {}, remove() {} }
    });
    return nodes.get(selector);
  };
  const context = vm.createContext({
    document: { documentElement: node('root'), querySelector: node },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    console: { warn() {} }, setTimeout() {}, clearTimeout() {},
    FileReader: class { readAsDataURL() { this.result = picture; this.onload(); } },
    Image: class { naturalWidth = 4000; naturalHeight = 2000; async decode() {} }
  });
  if (extension) context.browser = { storage: { local: {
    get: async key => ({ [key]: storage.get(key) }),
    set: async object => Object.entries(object).forEach(([key, value]) => storage.set(key, value)),
    remove: async key => storage.delete(key)
  } } };
  vm.runInContext(source, context);
  return { context, storage, nodes, run: code => vm.runInContext(code, context) };
}

for (const extension of [false, true]) {
  test(`${extension ? 'Firefox' : 'preview'} storage keeps pictures separate and preserves them when replacement/removal fails`, async () => {
    const h = harness(extension);
    h.context.document.createElement = () => ({
      getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => picture
    });
    await h.run('chooseBackground({target:{files:[{type:"image/png",size:100}]}})');
    assert.equal(h.storage.get('zenifiedBackground'), picture);
    assert.equal(h.run('backgroundImage'), picture);
    await h.run('saveState()');
    const preferences = h.storage.get('zenifiedState');
    assert.equal(JSON.stringify(preferences).includes('data:image'), false);
    h.run('backgroundImage = ""');
    await h.run('loadBackground()');
    assert.equal(h.run('backgroundImage'), picture);
    if (extension) h.context.browser.storage.local.set = async () => { throw Error('quota'); };
    else h.context.localStorage.setItem = () => { throw Error('quota'); };
    await h.run('chooseBackground({target:{files:[{type:"image/png",size:100}]}})');
    assert.equal(h.run('backgroundImage'), picture);
    assert.match(h.nodes.get('#backgroundStatus').textContent, /Could not save/);
    assert.equal(h.run('backgroundBusy'), false);
    if (extension) h.context.browser.storage.local.remove = async () => { throw Error('storage'); };
    else h.context.localStorage.removeItem = () => { throw Error('storage'); };
    await h.run('removeBackground()');
    assert.equal(h.run('backgroundImage'), picture);
    if (extension) h.context.browser.storage.local.remove = async key => h.storage.delete(key);
    else h.context.localStorage.removeItem = key => h.storage.delete(key);
    await h.run('removeBackground()');
    assert.equal(h.run('backgroundImage'), '');
    assert.equal(h.storage.has('zenifiedBackground'), false);
    assert.equal(h.nodes.get('#backgroundControls').disabled, true);
  });
}

test('rejects oversized, unsupported, and unreadable files before saving', async () => {
  const h = harness();
  await assert.rejects(h.run('prepareBackground({type:"image/png",size:16*1024*1024})'), /15 MB/);
  await assert.rejects(h.run('prepareBackground({type:"image/svg+xml",size:10})'), /Choose a JPG/);
  h.context.Image = class { async decode() { throw Error('decode'); } };
  await assert.rejects(h.run('prepareBackground({type:"image/jpeg",size:100})'), /Could not open/);
  assert.equal(h.storage.size, 0);
});

test('rescales a large picture while preserving aspect ratio', async () => {
  const h = harness();
  const canvas = { getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => picture };
  h.context.document.createElement = () => canvas;
  await h.run('prepareBackground({type:"image/png",size:100})');
  assert.equal(canvas.width, 2560);
  assert.equal(canvas.height, 1280);
});

test('old or invalid preferences get safe defaults and remote backgrounds are ignored', async () => {
  const h = harness();
  for (const data of ['null', '"broken"', '{dim:NaN,blur:Infinity,position:"url(https://example.com)"}']) {
    const result = h.run(`JSON.stringify(normalizeBackground(${data}))`);
    assert.deepEqual(JSON.parse(result), { dim: 35, blur: 0, position: 'center' });
  }
  assert.deepEqual(JSON.parse(h.run('JSON.stringify(normalizeBackground({dim:999,blur:-1,position:"top"}))')), { dim: 90, blur: 0, position: 'top' });
  h.storage.set('zenifiedBackground', 'https://example.com/photo.jpg');
  await h.run('loadBackground()');
  assert.equal(h.run('backgroundImage'), '');
});
