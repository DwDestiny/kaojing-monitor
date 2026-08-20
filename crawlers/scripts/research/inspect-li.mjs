import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/dw/Desktop/张晗/粉笔/考情监测/crawlers/scripts/x.js');
const $ = require('cheerio').load(readFileSync(process.argv[2], 'utf8'));
const sel = process.argv[3];
const $c = $(sel);
console.log(`容器: ${sel}, 直接li数: ${$c.children('li').length}, find li 数: ${$c.find('li').length}`);
$c.children('li').slice(0, 6).each((i, el) => {
  const $li = $(el);
  const $a = $li.find('a').first();
  const dateTxt = $li.find('span,em,i,font').map((_, s) => $(s).text().trim()).get().join('|');
  console.log(`[${i}] ${$a.text().trim().slice(0, 40)} | ${$a.attr('href')} | 日期元素: ${dateTxt.slice(0, 40)}`);
  console.log('   HTML:', $.html($li).replace(/\s+/g, ' ').slice(0, 220));
});
