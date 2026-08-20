/**
 * 候选数据源连通性扫描
 * 用法: node crawlers/scripts/probe-sources.mjs
 * 对每个候选源首页做 HEAD/GET 探测，输出可达性结果
 */
import { writeFileSync } from 'node:fs';

const UA = 'KaoQingBot/1.0 (Recruitment Info Aggregator)';

const candidates = [
  // —— S 级：省级人社厅 / 人事考试院 ——
  { id: 'shanghai_hrss',   name: '上海市人力资源和社会保障局', home: 'https://rsj.sh.gov.cn/',         target: '事业单位' },
  { id: 'zhejiang_hrss',   name: '浙江省人力资源和社会保障厅', home: 'https://rlsbt.zj.gov.cn/',       target: '事业单位' },
  { id: 'sichuan_pta',     name: '四川省人事考试中心',         home: 'https://www.scpta.com.cn/',      target: '事业单位' },
  { id: 'guizhou_hrss',    name: '贵州省人力资源和社会保障厅', home: 'https://rst.guizhou.gov.cn/',    target: '事业单位' },
  { id: 'hunan_hrss',      name: '湖南省人力资源和社会保障厅', home: 'https://rst.hunan.gov.cn/',      target: '事业单位' },
  { id: 'hubei_hrss',      name: '湖北省人力资源和社会保障厅', home: 'https://rst.hubei.gov.cn/',      target: '事业单位' },
  { id: 'hebei_hrss',      name: '河北省人力资源和社会保障厅', home: 'https://rst.hebei.gov.cn/',      target: '事业单位' },
  { id: 'henan_hrss',      name: '河南省人力资源和社会保障厅', home: 'https://hrss.henan.gov.cn/',     target: '事业单位' },
  { id: 'yunnan_hrss',     name: '云南省人力资源和社会保障厅', home: 'https://hrss.yn.gov.cn/',        target: '事业单位' },
  { id: 'guangxi_pta',     name: '广西人事考试院',             home: 'https://www.gxpta.com.cn/',      target: '事业单位' },
  { id: 'liaoning_pta',    name: '辽宁人事考试网',             home: 'https://www.lnrsks.com/',        target: '事业单位' },
  { id: 'qinghai_pta',     name: '青海省人事考试信息网',       home: 'https://www.qhpta.com/ncms/index.shtml', target: '事业单位' },
  { id: 'xinjiang_hrss',   name: '新疆维吾尔自治区人社厅',     home: 'https://rst.xinjiang.gov.cn/',    target: '事业单位' },
  { id: 'heilongjiang_hrss', name: '黑龙江省人力资源和社会保障厅', home: 'https://hrss.hlj.gov.cn/',   target: '事业单位' },
  { id: 'jilin_hrss',      name: '吉林省人力资源和社会保障厅', home: 'https://hrss.jl.gov.cn/',        target: '事业单位' },
  { id: 'shanxi_hrss',     name: '山西省人力资源和社会保障厅', home: 'https://rst.shanxi.gov.cn/',     target: '事业单位' },
  { id: 'shaanxi_hrss',    name: '陕西省人力资源和社会保障厅', home: 'https://hrss.shaanxi.gov.cn/',   target: '事业单位' },
  { id: 'gansu_hrss',      name: '甘肃省人力资源和社会保障厅', home: 'https://rst.gansu.gov.cn/',      target: '事业单位' },
  { id: 'ningxia_pta',     name: '宁夏人事考试中心',           home: 'https://www.nxpta.com/',         target: '事业单位' },
  { id: 'inner_mongolia_hrss', name: '内蒙古自治区人社厅',     home: 'https://rst.nmg.gov.cn/',        target: '事业单位' },
  { id: 'hainan_hrss',     name: '海南省人力资源和社会保障厅', home: 'https://hrss.hainan.gov.cn/',    target: '事业单位' },
  { id: 'jiangxi_hrss',    name: '江西省人力资源和社会保障厅', home: 'https://rst.jiangxi.gov.cn/',    target: '事业单位' },
  { id: 'anhui_apta',      name: '安徽省人事考试网',           home: 'https://apta.gov.cn/',           target: '事业单位' },
  { id: 'chongqing_hrss',  name: '重庆市人力资源和社会保障局', home: 'https://rlsbj.cq.gov.cn/',       target: '事业单位' },
  // —— A 级：综合平台 ——
  { id: 'qgsydw',          name: '全国事业单位招聘网',         home: 'https://www.qgsydw.com/',        target: '事业单位' },
  { id: 'gxrc_sydw',       name: '广西人才网事业单位',         home: 'https://sydw.gxrc.com/',         target: '事业单位' },
];

const results = [];
const CONCURRENCY = 6;

async function probe(c) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(c.home, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
    });
    clearTimeout(timer);
    const ct = res.headers.get('content-type') || '';
    return {
      id: c.id, name: c.name, home: c.home,
      ok: res.ok, status: res.status, type: ct.split(';')[0],
      size: res.headers.get('content-length') || '?',
      ms: Date.now() - t0, finalUrl: res.url,
    };
  } catch (e) {
    return { id: c.id, name: c.name, home: c.home, ok: false, status: 0, err: e.name + ': ' + e.message.slice(0, 80), ms: Date.now() - t0 };
  }
}

// 并发控制
async function run() {
  const queue = [...candidates];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const c = queue.shift();
      results.push(await probe(c));
    }
  });
  await Promise.all(workers);

  // 输出结果表
  console.log('\n== 连通性扫描结果 ==\n');
  for (const r of results.sort((a, b) => (b.ok - a.ok) || (a.ms - b.ms))) {
    if (r.ok) {
      console.log(`✅ ${r.id.padEnd(20)} ${String(r.status).padEnd(4)} ${String(r.ms).padEnd(5)}ms ${r.type} ${r.finalUrl}`);
    } else {
      console.log(`❌ ${r.id.padEnd(20)} ${(r.err || 'FAIL').slice(0, 60)}`);
    }
  }

  const ok = results.filter(r => r.ok);
  console.log(`\n可达: ${ok.length}/${results.length}`);
  // 输出 JSON 供后续使用
  writeFileSync(new URL('./probe-results.json', import.meta.url), JSON.stringify(results, null, 2));
}

run();
