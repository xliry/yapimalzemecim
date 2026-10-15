import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../site.config.mjs';

// Deterministic checks for the generated static site. This is not a ranking score.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distRoot = path.join(root, 'dist');
const reportPath = path.join(root, 'output', 'static-check.json');
const errors = [];
const pages = [];
const references = [];
const checkedReferences = new Set();
const fileSet = new Set();
const pageByFile = new Map();
let checks = 0;
let origin;

const slash = value => value.split(path.sep).join('/');
const fail = (code, file, message) => errors.push({ code, file, message });
function assert(condition, code, file, message) {
  checks += 1;
  if (!condition) fail(code, file, message);
  return Boolean(condition);
}
function decode(value = '') {
  return String(value).replace(/&(?:#(x[\da-f]+|\d+)|([a-z]+));/gi, (full, numeric, named) => {
    if (numeric) {
      const point = numeric[0].toLowerCase() === 'x' ? parseInt(numeric.slice(1), 16) : parseInt(numeric, 10);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : full;
    }
    return ({ amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' })[named.toLowerCase()] ?? full;
  });
}
const textContent = value => decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
function attributes(source) {
  const result = {};
  const pattern = /([^\s=<>`]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) result[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4] ?? '');
  return result;
}
function tags(html) {
  const source = html.replace(/<!--[\s\S]*?-->/g, '').replace(/(<(?:script|style)\b(?:[^>"']|"[^"]*"|'[^']*')*>)[\s\S]*?<\/(?:script|style)\s*>/gi, '$1');
  return [...source.matchAll(/<([a-z][\w:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)]
    .map(match => ({ name: match[1].toLowerCase(), attrs: attributes(match[2]) }));
}
function routeFor(file) {
  if (file === 'index.html') return '/';
  return `/${file.replace(/\/index\.html$/i, '/')}`;
}
async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if (entry.isFile()) fileSet.add(slash(path.relative(distRoot, absolute)));
  }
}
function parseUrl(value, base, file, kind) {
  try { return new URL(value, base); }
  catch { fail('INVALID_URL', file, `${kind}: geçersiz adres ${JSON.stringify(value)}`); return null; }
}
function resolveTarget(url, file, kind) {
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { fail('INVALID_URL_ENCODING', file, `${kind}: adres kodlaması geçersiz: ${url.href}`); return null; }
  const absolute = path.resolve(distRoot, `.${pathname}`);
  const relative = slash(path.relative(distRoot, absolute));
  if (relative.startsWith('../') || path.isAbsolute(relative) || relative.includes('\0')) {
    fail('OUTSIDE_DIST', file, `${kind}: hedef dist dışında: ${url.href}`);
    return null;
  }
  if (fileSet.has(relative)) return relative;
  const index = `${relative.replace(/\/$/, '')}${relative ? '/' : ''}index.html`;
  return fileSet.has(index) ? index : null;
}
function checkReference(value, base, file, kind, options = {}) {
  const ref = String(value ?? '').trim();
  const key = `${file}\n${kind}\n${ref}`;
  if (checkedReferences.has(key)) return null;
  checkedReferences.add(key);
  checks += 1;
  if (!ref) { fail('EMPTY_REFERENCE', file, `${kind}: boş adres`); return null; }
  if (/^(?:data|blob|mailto|tel):/i.test(ref)) return null;
  if (/^javascript:/i.test(ref)) { fail('JAVASCRIPT_URL', file, `${kind}: JavaScript adresi kullanılmamalı`); return null; }
  const url = parseUrl(ref, base, file, kind);
  if (!url || !/^https?:$/.test(url.protocol)) return null;
  if (url.origin !== origin) {
    if (options.sameOrigin) fail('WRONG_ORIGIN', file, `${kind}: ${origin} bekleniyor, bulundu: ${url.href}`);
    return null;
  }
  const target = resolveTarget(url, file, kind);
  references.push({ file, kind, url: url.href, target });
  if (!target) { fail('MISSING_TARGET', file, `${kind}: hedef dosya bulunamadı: ${url.pathname}`); return null; }
  if (options.fragment !== false && url.hash && target.endsWith('.html')) {
    let fragment;
    try { fragment = decodeURIComponent(url.hash.slice(1)); }
    catch { fail('INVALID_FRAGMENT', file, `${kind}: geçersiz fragment: ${url.hash}`); return target; }
    const page = pageByFile.get(target);
    if (fragment && fragment !== 'top' && page && !page.ids.has(fragment)) fail('MISSING_FRAGMENT', file, `${kind}: ${target} içinde #${fragment} yok`);
  }
  return target;
}
function absoluteSiteUrl(value, file, kind, expected) {
  checks += 1;
  if (!/^https?:\/\//i.test(String(value ?? ''))) {
    fail('ABSOLUTE_URL_REQUIRED', file, `${kind}: mutlak HTTP(S) adresi gerekli`);
    return null;
  }
  const url = parseUrl(value, origin, file, kind);
  if (!url) return null;
  assert(url.origin === origin, 'WRONG_ORIGIN', file, `${kind}: ${origin} bekleniyor, bulundu: ${url.origin}`);
  if (expected) assert(url.href === expected, 'WRONG_PAGE_URL', file, `${kind}: ${expected} bekleniyor, bulundu: ${url.href}`);
  return url;
}
function srcsetUrls(value) {
  // URL tokens may themselves contain commas (for example data URLs).
  const result = [];
  let position = 0;
  while (position < value.length) {
    while (/[\s,]/.test(value[position] ?? '') && position < value.length) position += 1;
    const start = position;
    while (position < value.length && !/\s/.test(value[position])) position += 1;
    let url = value.slice(start, position);
    if (!url) break;
    if (url.endsWith(',')) { result.push(url.replace(/,+$/, '')); continue; }
    result.push(url);
    let parentheses = 0;
    while (position < value.length) {
      const char = value[position++];
      if (char === '(') parentheses += 1;
      if (char === ')') parentheses = Math.max(0, parentheses - 1);
      if (char === ',' && parentheses === 0) break;
    }
  }
  return result;
}
function inspectSchema(value, file, base, parentKey = '') {
  if (Array.isArray(value)) { for (const item of value) inspectSchema(item, file, base, parentKey); return; }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && ['@id', 'url', 'logo', 'image', 'contentUrl', 'thumbnailUrl', 'item'].includes(parentKey)) {
      absoluteSiteUrl(value, file, `JSON-LD ${parentKey}`);
      checkReference(value, base, file, `JSON-LD ${parentKey}`, { sameOrigin: true, fragment: false });
    }
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    // External vocabulary and source/social references are not site identity URLs.
    if (['@context', 'sameAs', 'citation', 'subjectOf'].includes(key)) continue;
    inspectSchema(item, file, base, key);
  }
}
async function inspectHtml() {
  for (const file of [...fileSet].filter(name => name.endsWith('.html')).sort()) {
    const html = await fs.readFile(path.join(distRoot, file), 'utf8');
    const allTags = tags(html);
    const meta = allTags.filter(tag => tag.name === 'meta');
    const titles = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)];
    const descriptions = meta.filter(tag => tag.attrs.name?.toLowerCase() === 'description');
    const canonicals = allTags.filter(tag => tag.name === 'link' && tag.attrs.rel?.toLowerCase().split(/\s+/).includes('canonical'));
    const expected = new URL(routeFor(file), origin).href;
    const robots = meta.filter(tag => ['robots', 'googlebot'].includes(tag.attrs.name?.toLowerCase())).map(tag => tag.attrs.content ?? '').join(',');
    const page = {
      file, url: expected, title: textContent(titles[0]?.[1] ?? ''), description: descriptions[0]?.attrs.content?.trim() ?? '',
      is404: /(?:^|\/)404(?:\.html|\/index\.html)$/i.test(file), indexable: !/(?:^|[,\s])noindex(?:$|[,\s])/i.test(robots),
      ids: new Set(allTags.flatMap(tag => [tag.attrs.id, ...(tag.name === 'a' ? [tag.attrs.name] : [])]).filter(Boolean)),
      html, tags: allTags, jsonLdBlocks: 0, images: 0,
    };
    pageByFile.set(file, page);
    pages.push(page);
    assert(titles.length === 1 && page.title.length > 0, 'TITLE', file, 'Tam bir adet, içeriği dolu title gerekli');
    assert(descriptions.length === 1 && page.description.length > 0, 'DESCRIPTION', file, 'Tam bir adet, içeriği dolu meta description gerekli');
    const htmlTags = allTags.filter(tag => tag.name === 'html');
    assert(htmlTags.length === 1 && htmlTags[0].attrs.lang?.toLowerCase() === 'tr', 'LANG', file, 'html lang="tr" gerekli');
    const headings = allTags.filter(tag => tag.name === 'h1');
    assert(headings.length === 1, 'H1_COUNT', file, `Bir h1 gerekli; bulunan: ${headings.length}`);
    assert(canonicals.length === 1 && Boolean(canonicals[0]?.attrs.href), 'CANONICAL', file, 'Tam bir adet canonical adresi gerekli');
    if (canonicals[0]?.attrs.href) absoluteSiteUrl(canonicals[0].attrs.href, file, 'canonical', expected);
    assert(!allTags.some(tag => tag.name === 'base'), 'BASE_ELEMENT', file, 'Yerel hedef denetimi için base elementi kullanılmamalı');
  }
  assert(pages.length > 0, 'HTML_MISSING', 'dist', 'Denetlenecek HTML sayfası bulunamadı');
  for (const field of ['title', 'description']) {
    const seen = new Map();
    for (const page of pages.filter(item => !item.is404)) {
      const value = page[field].replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr');
      if (!value) continue;
      assert(!seen.has(value), `DUPLICATE_${field.toUpperCase()}`, page.file, `${field} başka sayfada da kullanılıyor: ${seen.get(value) ?? ''}`);
      if (!seen.has(value)) seen.set(value, page.file);
    }
  }
  // A second pass allows fragment targets in pages read later to be checked.
  for (const page of pages) {
    for (const tag of page.tags) {
      const { attrs } = tag;
      for (const attr of ['href', 'src', 'poster', 'data', 'action', 'xlink:href']) {
        if (Object.hasOwn(attrs, attr)) checkReference(attrs[attr], page.url, page.file, `${tag.name}[${attr}]`);
      }
      for (const attr of ['srcset', 'imagesrcset']) {
        if (Object.hasOwn(attrs, attr)) {
          const urls = srcsetUrls(attrs[attr]);
          assert(urls.length > 0, 'EMPTY_SRCSET', page.file, `${tag.name}[${attr}]: boş kaynak listesi`);
          for (const url of urls) checkReference(url, page.url, page.file, `${tag.name}[${attr}]`);
        }
      }
      if (tag.name === 'img' || (tag.name === 'input' && attrs.type?.toLowerCase() === 'image')) {
        page.images += 1;
        // Empty alt is valid for decorative images; the attribute itself is mandatory.
        assert(Object.hasOwn(attrs, 'alt'), 'IMAGE_ALT', page.file, `alt niteliği eksik: ${attrs.src ?? '(src yok)'}`);
      }
      if (tag.name === 'meta') {
        const property = (attrs.property ?? attrs.name ?? '').toLowerCase();
        if (['og:url', 'og:image', 'og:image:url', 'og:image:secure_url', 'twitter:url', 'twitter:image', 'twitter:image:src'].includes(property)) {
          absoluteSiteUrl(attrs.content, page.file, property, property.endsWith(':url') && !property.startsWith('og:image') ? page.url : undefined);
          checkReference(attrs.content, page.url, page.file, property, { sameOrigin: true, fragment: false });
        }
      }
    }
    const scriptBlocks = [...page.html.matchAll(/<script\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/script\s*>/gi)];
    for (const block of scriptBlocks) {
      if (attributes(block[1]).type?.toLowerCase() !== 'application/ld+json') continue;
      page.jsonLdBlocks += 1;
      checks += 1;
      try {
        const schema = JSON.parse(block[2]);
        assert(Boolean(schema) && typeof schema === 'object', 'JSONLD_ROOT', page.file, 'JSON-LD kökü nesne veya nesne dizisi olmalı');
        inspectSchema(schema, page.file, page.url);
      } catch (error) { fail('JSONLD_SYNTAX', page.file, `JSON-LD ayrıştırılamadı: ${error.message}`); }
    }
    assert(page.jsonLdBlocks > 0, 'JSONLD_MISSING', page.file, 'application/ld+json bloğu gerekli');
  }
}
async function inspectCss() {
  for (const file of [...fileSet].filter(name => name.endsWith('.css')).sort()) {
    const css = (await fs.readFile(path.join(distRoot, file), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    const base = new URL(`/${file}`, origin).href;
    for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
      const ref = (match[1] ?? match[2] ?? match[3]).trim();
      if (!ref.startsWith('#')) checkReference(ref, base, file, 'CSS url()', { fragment: false });
    }
    for (const match of css.matchAll(/@import\s+["']([^"']+)["']/gi)) checkReference(match[1], base, file, 'CSS @import', { fragment: false });
  }
}
async function requiredText(file) {
  if (!assert(fileSet.has(file), 'REQUIRED_FILE', file, `${file} bulunamadı`)) return null;
  const content = await fs.readFile(path.join(distRoot, file), 'utf8');
  assert(content.trim().length > 0, 'EMPTY_FILE', file, `${file} boş`);
  return content;
}
async function inspectDiscovery() {
  const sitemap = await requiredText('sitemap.xml');
  if (sitemap) {
    assert(/<urlset\b/i.test(sitemap) && /<\/urlset\s*>/i.test(sitemap), 'SITEMAP_URLSET', 'sitemap.xml', 'urlset site haritası gerekli');
    const entries = [...sitemap.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc\s*>/gi)].map(match => decode(match[1].trim()));
    assert(entries.length > 0, 'SITEMAP_EMPTY', 'sitemap.xml', 'En az bir loc adresi gerekli');
    const seen = new Set();
    for (const entry of entries) {
      const url = absoluteSiteUrl(entry, 'sitemap.xml', 'loc');
      if (!url) continue;
      assert(!url.search && !url.hash, 'SITEMAP_QUERY_HASH', 'sitemap.xml', `loc sorgu veya fragment içeriyor: ${entry}`);
      assert(!seen.has(url.href), 'SITEMAP_DUPLICATE', 'sitemap.xml', `Tekrarlanan loc: ${entry}`);
      seen.add(url.href);
      const target = checkReference(entry, `${origin}/sitemap.xml`, 'sitemap.xml', 'loc', { sameOrigin: true, fragment: false });
      const page = pageByFile.get(target);
      assert(Boolean(page), 'SITEMAP_NON_HTML', 'sitemap.xml', `loc bir HTML sayfasını hedeflemeli: ${entry}`);
      if (page) {
        assert(page.indexable && !page.is404, 'SITEMAP_NOINDEX', 'sitemap.xml', `Index dışı sayfa site haritasında: ${entry}`);
        assert(url.href === page.url, 'SITEMAP_CANONICAL', 'sitemap.xml', `loc canonical yoluyla aynı olmalı: ${page.url}`);
      }
    }
    for (const page of pages.filter(item => item.indexable && !item.is404)) assert(seen.has(page.url), 'SITEMAP_PAGE_MISSING', page.file, 'Indexlenebilir sayfa sitemap.xml içinde bulunamadı');
  }
  const robots = await requiredText('robots.txt');
  if (robots) {
    const lines = robots.split(/\r?\n/).map(line => line.replace(/\s*#.*$/, '').trim()).filter(Boolean);
    assert(lines.some(line => /^user-agent\s*:/i.test(line)), 'ROBOTS_USER_AGENT', 'robots.txt', 'User-agent satırı gerekli');
    assert(!lines.some(line => /^disallow\s*:\s*\/\s*$/i.test(line)), 'ROBOTS_BLOCK_ALL', 'robots.txt', 'Disallow: / tüm siteyi engelliyor');
    const sitemapLines = lines.filter(line => /^sitemap\s*:/i.test(line)).map(line => line.replace(/^sitemap\s*:\s*/i, ''));
    assert(sitemapLines.includes(`${origin}/sitemap.xml`), 'ROBOTS_SITEMAP', 'robots.txt', `Sitemap: ${origin}/sitemap.xml gerekli`);
    for (const value of sitemapLines) {
      absoluteSiteUrl(value, 'robots.txt', 'Sitemap');
      checkReference(value, `${origin}/robots.txt`, 'robots.txt', 'Sitemap', { sameOrigin: true, fragment: false });
    }
  }
  for (const file of ['llms.txt', 'llms-full.txt']) {
    const content = await requiredText(file);
    if (!content) continue;
    const urls = new Set();
    for (const match of content.matchAll(/\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g)) urls.add(match[1].replace(/^<|>$/g, ''));
    for (const match of content.matchAll(/https?:\/\/[^\s<>"'\])]+/g)) urls.add(match[0].replace(/[.,;]+$/, ''));
    let localPages = 0;
    for (const value of urls) {
      const target = checkReference(value, `${origin}/${file}`, file, 'doküman bağlantısı');
      if (pageByFile.has(target)) localPages += 1;
    }
    assert(localPages > 0, 'LLMS_PAGE_LINKS', file, 'En az bir geçerli yerel HTML sayfa bağlantısı gerekli');
  }
}

try {
  const configured = new URL(config.origin);
  origin = configured.origin;
  assert(configured.protocol === 'https:', 'ORIGIN_HTTPS', 'site.config.mjs', 'SITE_ORIGIN HTTPS olmalı');
  assert(configured.pathname === '/' && !configured.search && !configured.hash && !configured.username && !configured.password, 'ORIGIN_FORMAT', 'site.config.mjs', 'SITE_ORIGIN yalnız protokol ve alan adı içermeli');
  assert(!/^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(configured.hostname) && !/(?:^|\.)(?:example\.(?:com|org|net)|invalid|test)$/.test(configured.hostname), 'ORIGIN_PLACEHOLDER', 'site.config.mjs', 'SITE_ORIGIN gerçek yayın adresi olmalı');
  try { await walk(distRoot); }
  catch (error) {
    if (error.code === 'ENOENT') fail('DIST_MISSING', 'dist', 'dist bulunamadı; önce siteyi build edin');
    else throw error;
  }
  await inspectHtml();
  await inspectCss();
  await inspectDiscovery();
} catch (error) {
  fail('CHECKER_ERROR', 'scripts/check.mjs', error.stack ?? error.message);
}

const report = {
  generatedAt: new Date().toISOString(),
  status: errors.length ? 'failed' : 'passed',
  origin: origin ?? config.origin,
  summary: { htmlPages: pages.length, indexedPages: pages.filter(page => page.indexable && !page.is404).length, checks, errors: errors.length, localReferences: references.length },
  pages: pages.map(({ file, url, title, description, indexable, is404, jsonLdBlocks, images }) => ({ file, url, title, description, indexable, is404, jsonLdBlocks, images, errors: errors.filter(error => error.file === file).length })),
  errors,
  references,
};
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`${report.status === 'passed' ? 'PASS' : 'FAIL'}: ${pages.length} HTML sayfası, ${checks} kontrol, ${errors.length} hata. Rapor: output/static-check.json`);
for (const error of errors.slice(0, 30)) console.error(`[${error.code}] ${error.file}: ${error.message}`);
if (errors.length > 30) console.error(`Diğer ${errors.length - 30} hata JSON raporunda.`);
process.exitCode = errors.length ? 1 : 0;
