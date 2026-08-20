/**
 * 合并子代理调研结果到 sites.json（P1 扩源，2026-08-20）
 * 运行: node scripts/merge-sites.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const current = JSON.parse(readFileSync('./config/sites.json', 'utf-8'));
const existing = current.sites.filter(s => s.id !== 'chongqing_hrss'); // 重庆将被更新后的配置替换

const newSites = [
  // ── 直辖市 ──
  {
    id: 'shanghai_hrss', name: '上海市人力资源和社会保障局', enabled: true, region: '上海',
    listPageUrl: 'https://rsj.sh.gov.cn/tsydwgkzp_17406/index.html',
    paginationType: 'static-file', paginationPattern: 'index_{page}.html', maxPages: 2,
    baseUrl: 'https://rsj.sh.gov.cn/', encoding: 'utf-8',
    containerSelector: 'ul.uli14', itemSelector: 'li',
    titleSelector: 'a', titleAttr: null, urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'span.time',
  },
  {
    id: 'chongqing_hrss', name: '重庆市人力资源和社会保障局', enabled: true, region: '重庆',
    listPageUrl: 'https://rlsbj.cq.gov.cn/zwxx_182/sydw/sydwgkzp2026/',
    paginationType: 'static-file', paginationPattern: 'index_{page}.html', maxPages: 2,
    baseUrl: 'https://rlsbj.cq.gov.cn/zwxx_182/sydw/sydwgkzp2026/', encoding: 'utf-8',
    containerSelector: 'ul.rsj-list1', itemSelector: 'li',
    titleSelector: 'a', titleAttr: null, urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'span',
  },
  // ── 华东 ──
  {
    id: 'guizhou_hrss', name: '贵州省人力资源和社会保障厅', enabled: true, region: '贵州',
    listPageUrl: 'https://rst.guizhou.gov.cn/zwgk/zdlyxx/sydwgkzp/index.html',
    paginationType: 'static-file', paginationPattern: 'index_{page}.html', pageOffset: -1, maxPages: 2,
    baseUrl: 'https://rst.guizhou.gov.cn/zwgk/zdlyxx/sydwgkzp/', encoding: 'utf-8',
    containerSelector: 'div.right-list-box ul', itemSelector: 'li',
    titleSelector: 'a', titleAttr: 'title', urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'span',
  },
  {
    id: 'hubei_hrss', name: '湖北省人力资源和社会保障厅', enabled: true, region: '湖北',
    listPageUrl: 'https://rst.hubei.gov.cn/bmdt/ztzl/ywzl/hbsszsydwgkzp/zpgg/index.shtml',
    paginationType: 'static-file', paginationPattern: 'index_{page}.shtml', pageOffset: -1, maxPages: 2,
    baseUrl: 'https://rst.hubei.gov.cn/bmdt/ztzl/ywzl/hbsszsydwgkzp/zpgg/', encoding: 'utf-8',
    containerSelector: 'ul.list-t.border6', itemSelector: 'li',
    titleSelector: 'a', titleAttr: 'title', urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'span.date',
  },
  {
    id: 'hunan_hrss', name: '湖南省人力资源和社会保障厅', enabled: true, region: '湖南',
    listPageUrl: 'http://rst.hunan.gov.cn/rst/xxgk/zpzl/sydwzp/index.html',
    paginationType: 'static-file', paginationPattern: 'index_{page}.html', maxPages: 2,
    baseUrl: 'http://rst.hunan.gov.cn', encoding: 'utf-8',
    containerSelector: 'div.box', itemSelector: 'li',
    titleSelector: 'a', titleAttr: null, urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'span',
  },
  {
    id: 'henan_hrss', name: '河南省人力资源和社会保障厅', enabled: true, region: '河南',
    listPageUrl: 'https://ywzl.hrss.henan.gov.cn/viewCmsCac.do?cacId=4aef1408279926e601279e53eac517a5',
    paginationType: 'url-param', paginationParamName: 'offset', paginationStep: 30, maxPages: 2,
    baseUrl: 'https://ywzl.hrss.henan.gov.cn/', encoding: 'utf-8',
    containerSelector: 'td.xin2zuo', itemSelector: 'tr[height=20]',
    titleSelector: 'a', titleAttr: 'title', urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'td[align=right]',
  },
  // ── 西南 ──
  {
    id: 'sichuan_pta', name: '四川省人事考试中心', enabled: true, region: '四川',
    listPageUrl: 'https://www.scpta.com.cn/front/Special/Info/8c14387e5b5b4a47a596fcd85694aaac',
    paginationType: 'single', paginationPattern: null, maxPages: 1,
    baseUrl: 'https://www.scpta.com.cn', encoding: 'utf-8',
    containerSelector: '.column-list', itemSelector: '.news-item',
    titleSelector: 'a', titleAttr: null, urlSelector: 'a', urlAttr: 'href',
    dateSelector: null, defaultDate: 'today',
  },
  {
    id: 'yunnan_hrss', name: '云南省人力资源和社会保障厅', enabled: true, region: '云南',
    listPageUrl: 'https://hrss.yn.gov.cn/NewsLsit.aspx?ClassID=602',
    paginationType: 'url-param', paginationPattern: null, maxPages: 2,
    baseUrl: 'https://hrss.yn.gov.cn', encoding: 'utf-8',
    containerSelector: 'ul.ul13.pd20', itemSelector: 'li',
    titleSelector: 'a', titleAttr: null, urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'span',
  },
  {
    id: 'guangxi_pta', name: '广西人事考试院', enabled: true, region: '广西',
    listPageUrl: 'https://www.gxpta.com.cn/ksxm/sydwzpks/',
    paginationType: 'static-file', paginationPattern: 'index_{page}.html', maxPages: 2,
    baseUrl: 'https://www.gxpta.com.cn/ksxm/sydwzpks/', encoding: 'utf-8',
    containerSelector: 'ul.articles', itemSelector: 'li',
    titleSelector: 'a', titleAttr: null, urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'span',
  },
  {
    id: 'xinjiang_hrss', name: '新疆维吾尔自治区人力资源和社会保障厅', enabled: true, region: '新疆',
    listPageUrl: 'https://rst.xinjiang.gov.cn/xjrst/c112746/list.shtml',
    paginationType: 'static-file', paginationPattern: 'list_{page}.shtml', maxPages: 2,
    baseUrl: 'https://rst.xinjiang.gov.cn', encoding: 'utf-8',
    containerSelector: 'ul.com-pic-news-list', itemSelector: 'li',
    titleSelector: 'a.cpn-title', titleAttr: null, urlSelector: 'a.cpn-title', urlAttr: 'href',
    dateSelector: 'span.cpn-date',
  },
  // ── 华北 ──
  {
    id: 'shanxi_hrss', name: '山西省人力资源和社会保障厅', enabled: true, region: '山西',
    listPageUrl: 'https://rst.shanxi.gov.cn/ztzl/zpxx/',
    paginationType: 'single', paginationPattern: null, maxPages: 1,
    baseUrl: 'https://rst.shanxi.gov.cn/ztzl/zpxx/', encoding: 'utf-8',
    containerSelector: 'div.ztzl_dt_content ul.second_right_ul', itemSelector: 'li',
    titleSelector: 'a', titleAttr: null, urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'span.pull-right',
  },
  {
    id: 'inner_mongolia_hrss', name: '内蒙古自治区人力资源和社会保障厅', enabled: true, region: '内蒙古',
    listPageUrl: 'https://rst.nmg.gov.cn/zhuantizhuanlan/ssdwzp/',
    paginationType: 'single', paginationPattern: null, maxPages: 1,
    baseUrl: 'https://rst.nmg.gov.cn/zhuantizhuanlan/ssdwzp/', encoding: 'utf-8',
    containerSelector: 'div.lanMu_con ul.ml0', itemSelector: 'li',
    titleSelector: 'a', titleAttr: 'title', urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'span',
  },
  {
    id: 'jilin_hrss', name: '吉林省人力资源和社会保障厅', enabled: true, region: '吉林',
    listPageUrl: 'https://hrss.jl.gov.cn/rsrc/sydwrsgl/gkzp/',
    paginationType: 'static-file', paginationPattern: 'index_{page}.html', maxPages: 2,
    baseUrl: 'https://hrss.jl.gov.cn/rsrc/sydwrsgl/gkzp/', encoding: 'utf-8',
    containerSelector: 'div.news_list4 > ul', itemSelector: 'li',
    titleSelector: 'a:not([target])', titleAttr: null, urlSelector: 'a:not([target])', urlAttr: 'href',
    dateSelector: 'span',
  },
  // ── 华南/东南 ──
  {
    id: 'liaoning_pta', name: '辽宁人事考试网', enabled: true, region: '辽宁',
    listPageUrl: 'https://www.lnrsks.com/html/shiyedanweikaoshi/',
    paginationType: 'static-file', paginationPattern: '65_{page}.html', maxPages: 2,
    baseUrl: 'https://www.lnrsks.com/', encoding: 'utf-8',
    containerSelector: 'div.listleftback', itemSelector: 'div.kaoshilist',
    titleSelector: 'div.kaoshilistrighttitle a', titleAttr: null, urlSelector: 'div.kaoshilistrighttitle a', urlAttr: 'href',
    dateSelector: 'div.kaoshilistleftbottom1|div.kaoshilistlefttop1',
  },
  {
    id: 'hainan_hrss', name: '海南省人力资源和社会保障厅', enabled: true, region: '海南',
    listPageUrl: 'https://hrss.hainan.gov.cn/hrss/sydwzp/list3.shtml?ddtab=true',
    paginationType: 'single', paginationPattern: null, maxPages: 1,
    baseUrl: 'https://hrss.hainan.gov.cn/', encoding: 'utf-8',
    containerSelector: 'div.cen-div-1', itemSelector: 'div.list_div',
    titleSelector: 'div.list-right_title a', titleAttr: null, urlSelector: 'div.list-right_title a', urlAttr: 'href',
    dateSelector: 'table tr td',
  },
  {
    id: 'ningxia_pta', name: '宁夏人事考试中心', enabled: true, region: '宁夏',
    listPageUrl: 'https://www.nxpta.com/sydwzk/',
    paginationType: 'static-file', paginationPattern: 'index_{page}.html', maxPages: 2,
    baseUrl: 'https://www.nxpta.com/sydwzk/', encoding: 'utf-8',
    containerSelector: 'article', itemSelector: 'p.title-li',
    titleSelector: 'a', titleAttr: null, urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'span',
  },
  {
    id: 'qgsydw', name: '全国事业单位招聘网', enabled: true, region: '全国',
    listPageUrl: 'https://www.qgsydw.com/qgsydw/recruit/insrecruit/index.html',
    paginationType: 'static-file', paginationPattern: 'index_{page}.html', maxPages: 2,
    baseUrl: 'https://www.qgsydw.com/', encoding: 'gbk',
    containerSelector: 'div.recruit-box-content-mainR-main-list', itemSelector: 'li',
    titleSelector: 'span.title', titleAttr: 'text', urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'span.time',
  },
  // ── 禁用备用（JS 渲染 / 无专版，需 API 模式适配）──
  {
    id: 'zhejiang_hrss', name: '浙江省人力资源和社会保障厅', enabled: false, region: '浙江',
    listPageUrl: 'https://rlsbt.zj.gov.cn/col/col1229743683/index.html',
    paginationType: 'single', paginationPattern: null, maxPages: 1,
    baseUrl: 'https://rlsbt.zj.gov.cn', encoding: 'utf-8',
    containerSelector: null, itemSelector: null,
    titleSelector: null, titleAttr: null, urlSelector: null, urlAttr: 'href',
    dateSelector: null,
    notes: 'jcms 全采通系统 JS 渲染，无静态列表；数据走 API 网关 pageId=1229743683（api-gateway/jpaas-publish-server/front/page/build/unit），需 engine API 模式适配',
  },
  {
    id: 'hebei_hrss', name: '河北省人力资源和社会保障厅', enabled: false, region: '河北',
    listPageUrl: null,
    paginationType: 'single', paginationPattern: null, maxPages: 1,
    baseUrl: 'https://rst.hebei.gov.cn/', encoding: 'utf-8',
    containerSelector: null, itemSelector: null,
    titleSelector: null, titleAttr: null, urlSelector: null, urlAttr: 'href',
    dateSelector: null,
    notes: '全站 Vue SPA（febs），数据走 JSON API：POST /rsmhapi/door/listArticleByTab（通知公告 sectionId=1006），需 engine API 模式适配',
  },
  {
    id: 'heilongjiang_hrss', name: '黑龙江省人力资源和社会保障厅', enabled: false, region: '黑龙江',
    listPageUrl: 'https://hrss.hlj.gov.cn/hrss/c111741/list.shtml',
    paginationType: 'single', paginationPattern: null, maxPages: 1,
    baseUrl: 'https://hrss.hlj.gov.cn/', encoding: 'utf-8',
    containerSelector: 'ul#list', itemSelector: 'li',
    titleSelector: 'a', titleAttr: 'title', urlSelector: 'a', urlAttr: 'href',
    dateSelector: 'span.date',
    notes: '无事业单位招聘专版，统招公告混发通知公告(c111741)一页仅1-2条；主渠道为黑龙江省事业单位公开招聘服务平台 gkzp.renshenet.org.cn',
  },
];

const sites = [...existing, ...newSites];
const out = { sites };
writeFileSync('./config/sites.json', JSON.stringify(out, null, 2) + '\n', 'utf-8');

const enabled = sites.filter(s => s.enabled).length;
console.log(`合并完成：总源 ${sites.length}，启用 ${enabled}，禁用 ${sites.length - enabled}`);
