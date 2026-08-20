/**
 * 抓取网页并解码(utf-8/gbk/gb2312)，输出到 stdout
 * 用法: node fetch-html.mjs <url> [输出文件]
 */
const [url, out] = process.argv.slice(2);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const ctrl = new AbortController();
const t = setTimeout(() => ctrl.abort(), 20000);
const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' } });
clearTimeout(t);
if (!res.ok) { console.error(`HTTP ${res.status}`); process.exit(1); }
const buf = new Uint8Array(await res.arrayBuffer());
const ct = res.headers.get('content-type') || '';
const metaMatch = new TextDecoder('utf-8').decode(buf.slice(0, 4096)).match(/charset=["']?([\w-]+)/i);
const enc = /gbk|gb2312/i.test(ct) || (metaMatch && /gbk|gb2312/i.test(metaMatch[1])) ? 'gbk' : 'utf-8';
let html;
try { html = new TextDecoder(enc, { fatal: false }).decode(buf); } catch { html = new TextDecoder('utf-8').decode(buf); }
if (out) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(out, html);
  console.log(`saved ${html.length} bytes -> ${out} (enc=${enc}, finalUrl=${res.url})`);
} else {
  console.log(html);
}
