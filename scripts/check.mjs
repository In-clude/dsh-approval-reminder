/**
 * Dependency-free static checks for this package.
 *
 * `index.js` is the Host half (an ES module the DSH Loader imports) and
 * `client.js` is the browser bundle (a classic script served through
 * `dsh.client`). Both are parsed here without being executed, so a syntax error
 * fails in CI instead of in the browser console.
 *
 * Run with `node scripts/check.mjs` (also wired to `npm test`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const passes = [];

/** @param {string} message */
function fail(message) {
  failures.push(message);
}

/** @param {string} message */
function pass(message) {
  passes.push(message);
}

/** @param {string} relative */
function readText(relative) {
  return readFileSync(join(root, relative), 'utf8');
}

/** @param {string} relative */
function assertFile(relative, label) {
  if (!existsSync(join(root, relative))) {
    fail(`${label}: missing file ${relative}`);
    return false;
  }
  pass(`${label}: ${relative}`);
  return true;
}

/** Parse one JSON file and return its value, or undefined on failure. */
function readJson(relative) {
  if (!assertFile(relative, 'json')) return undefined;
  try {
    const value = JSON.parse(readText(relative));
    pass(`json: ${relative} parses`);
    return value;
  } catch (error) {
    fail(`json: ${relative} does not parse: ${error.message}`);
    return undefined;
  }
}

/** Parse a classic script without executing it. */
function checkScript(relative) {
  try {
    new Script(readText(relative), { filename: relative });
    pass(`syntax: ${relative} (classic script)`);
    return true;
  } catch (error) {
    fail(`syntax: ${relative}: ${error.message}`);
    return false;
  }
}

/**
 * Parse an ES module body without executing it. `node:vm` only compiles classic
 * scripts, so the `export` keywords this package uses are stripped first; the
 * body itself is still compiled, which is what the check is for.
 */
function checkModule(relative) {
  try {
    const source = readText(relative).replace(
      /^export\s+(?=(?:async\s+)?function\b|const\b|let\b|var\b|class\b|default\b)/gm,
      '',
    );
    new Script(source, { filename: relative });
    pass(`syntax: ${relative} (module body)`);
    return true;
  } catch (error) {
    fail(`syntax: ${relative}: ${error.message}`);
    return false;
  }
}

// ---- package manifest -------------------------------------------------------
const pkg = readJson('package.json');
if (pkg !== undefined) {
  if (typeof pkg.name === 'string' && pkg.name !== '') pass(`manifest: name ${pkg.name}`);
  else fail('manifest: package.json needs a non-empty "name"');

  if (typeof pkg.version === 'string' && /^\d+\.\d+\.\d+/.test(pkg.version)) pass(`manifest: version ${pkg.version}`);
  else fail('manifest: package.json needs a semver "version"');

  if (pkg.type === 'module') pass('manifest: type module');
  else fail('manifest: package.json must declare "type": "module"');

  const bundle = pkg.dsh === undefined ? undefined : pkg.dsh.bundle;
  const patch = bundle === undefined ? undefined : bundle.patch;
  if (typeof patch === 'string' && patch !== '') {
    assertFile(patch.replace(/^\.\//, ''), 'bundle patch');
  } else {
    fail('manifest: dsh.bundle.patch must name the Loader patch file');
  }

  const client = pkg.dsh === undefined ? undefined : pkg.dsh.client;
  if (client === undefined) {
    fail('manifest: dsh.client is missing, so no browser bundle is served');
  } else {
    if (client.platform === 'web') pass('manifest: dsh.client.platform web');
    else fail('manifest: dsh.client.platform must be "web"');
    if (client.immediately === true) pass('manifest: dsh.client.immediately');
    else fail('manifest: dsh.client.immediately must be true (nothing requires this bundle lazily)');
    if (Array.isArray(client.inject) && client.inject.every((entry) => typeof entry === 'string')) {
      pass(`manifest: dsh.client.inject (${client.inject.length} entries)`);
    } else {
      fail('manifest: dsh.client.inject must be an array of package names');
    }
  }

  const exportsMap = pkg.exports === undefined ? undefined : pkg.exports;
  for (const key of ['.', './client']) {
    const target = exportsMap === undefined ? undefined : exportsMap[key];
    if (typeof target !== 'string') {
      fail(`manifest: exports["${key}"] must map to a file`);
      continue;
    }
    assertFile(target.replace(/^\.\//, ''), `exports["${key}"]`);
  }

  const icon = pkg.icon;
  if (typeof icon === 'string') assertFile(icon.replace(/^\.\//, ''), 'manifest: icon');
  else fail('manifest: a relative "icon" path is required for the plugin card');

  if (Array.isArray(pkg.files)) pass(`manifest: files whitelist (${pkg.files.length} entries)`);
  else fail('manifest: a "files" whitelist keeps the published tarball honest');
}

// ---- locales ----------------------------------------------------------------
const locales = ['en', 'zh'].map((id) => ({ id, value: readJson(`locale/${id}.json`) }));
const metaKeys = locales
  .filter((entry) => entry.value !== undefined)
  .map((entry) => {
    const meta = entry.value.meta;
    if (meta === undefined || typeof meta.title !== 'string' || meta.title === ''
      || typeof meta.description !== 'string' || meta.description === '') {
      fail(`locale ${entry.id}: meta.title and meta.description must be non-empty strings`);
      return undefined;
    }
    pass(`locale ${entry.id}: meta.title/description`);
    return Object.keys(meta).sort().join(',');
  })
  .filter((entry) => entry !== undefined);
if (metaKeys.length === 2 && metaKeys[0] !== metaKeys[1]) {
  fail('locale en/zh: meta key sets differ');
}

// ---- bundle patch -----------------------------------------------------------
if (assertFile('cordis.patch.yml', 'patch')) {
  const patch = readText('cordis.patch.yml');
  for (const needle of ['id: approval-reminder', "name: 'dsh-approval-reminder'"]) {
    if (patch.includes(needle)) pass(`patch: ${needle}`);
    else fail(`patch: cordis.patch.yml must contain ${needle}`);
  }
}

// ---- javascript -------------------------------------------------------------
const clientParsed = checkScript('client.js');
if (clientParsed) {
  const source = readText('client.js');
  if (source.includes('__ModuleLoader__.load')) pass('client: registers through __ModuleLoader__');
  else fail('client: bundle must register through window.__ModuleLoader__.load');
  const id = pkg === undefined ? undefined : pkg.name;
  if (typeof id === 'string' && source.includes(`id: '${id}'`)) pass(`client: factory id equals package name ${id}`);
  else fail('client: the factory id must equal the package name');
}

const hostParsed = checkModule('index.js');
if (hostParsed && !readText('index.js').includes('export function apply')) {
  fail('host: index.js must export the Host plugin body `apply`');
} else if (hostParsed) {
  pass('host: exports apply');
}

// ---- project rules ----------------------------------------------------------
assertFile('AGENTS.md', 'rules');

// ---- documentation ----------------------------------------------------------
// Chinese is the primary README; the English one is a full translation, so both
// files must exist and point at each other.
assertFile('README.md', 'docs');
assertFile('README.en.md', 'docs');
for (const [file, needle] of [['README.md', 'README.en.md'], ['README.en.md', 'README.md']]) {
  if (!existsSync(join(root, file))) continue;
  if (readText(file).includes(needle)) pass(`docs: ${file} links to ${needle}`);
  else fail(`docs: ${file} must link to ${needle} so readers can switch language`);
}

// ---- privacy ----------------------------------------------------------------
// Absolute Windows paths leak the developer's account name, so tracked docs may
// only use the documented placeholders. This scan is what catches an accidental
// real path before it is pushed; the manual grep in AGENTS.md missed one once.
const privacyDocs = ['AGENTS.md', 'README.md', 'README.en.md', 'CHANGELOG.md'];
for (const relative of privacyDocs) {
  if (!existsSync(join(root, relative))) continue;
  const candidates = readText(relative).match(/[A-Za-z]:\\[^\s`'"|)]+/g) ?? [];
  const leaks = candidates.filter(
    (value) => !/^[A-Za-z]:\\path\\to\\/.test(value) && !/^C:\\Users\\(<用户名>|<username>)/.test(value),
  );
  if (leaks.length === 0) pass(`privacy: ${relative} only uses placeholder paths`);
  else fail(`privacy: ${relative} leaks local path(s): ${[...new Set(leaks)].join(', ')}`);
}

// ---- type checking opt-in ---------------------------------------------------
if (assertFile('jsconfig.json', 'typecheck')) {
  const config = readJson('jsconfig.json');
  if (config !== undefined && config.compilerOptions !== undefined && config.compilerOptions.checkJs === true) {
    pass('typecheck: jsconfig.json enables checkJs');
  } else {
    fail('typecheck: jsconfig.json must set compilerOptions.checkJs to true');
  }
}

{
  const firstLine = readText('client.js').split('\n')[0].trim();
  if (firstLine === '// @ts-check') {
    pass('typecheck: client.js opts in with // @ts-check');
  } else {
    fail('typecheck: client.js must start with // @ts-check — that directive is what makes editors and `npm run typecheck` check the file');
  }
}

// ---- report -----------------------------------------------------------------
for (const line of passes) console.log(`ok   ${line}`);
if (failures.length > 0) {
  console.error('');
  for (const line of failures) console.error(`FAIL ${line}`);
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nall ${passes.length} checks passed`);
