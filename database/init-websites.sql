-- 考情监测系统 - 网站数据初始化脚本
-- 生成时间: 2026-08-17
-- 数据来源: /docs/recruit-websites-list.md
-- 总计: 126 个政府官方网站（125 原始 + 1 新增验证通过）
--
-- 状态说明:
--   - pending: 待配置 selector
--   - active: 已配置并验证可用

-- ============================================
-- 一、直辖市（17 个）
-- ============================================

-- 北京（3 个）- Tier 1
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('北京市人力资源和社会保障局', 'https://rsj.beijing.gov.cn', '北京', '人社局', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('北京市机关事务管理局事业单位公开招聘平台', 'https://zhaopin.jgj.beijing.gov.cn', '北京', '招聘平台', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('北京市政务公开平台', 'https://beijing.gov.cn', '北京', '政府门户', 1, NULL, 'pending');

-- 上海（5 个）- Tier 1
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('上海市人力资源和社会保障局', 'https://hrss.sh.gov.cn', '上海', '人社局', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('上海公务员考试网', 'https://apta.sh.gov.cn', '上海', '人事考试网', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('上海市教育委员会', 'https://edu.sh.gov.cn', '上海', '教育厅', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('上海市人才中心', 'https://hzjl.sh.gov.cn', '上海', '人才中心', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('上海一网通办', 'https://zwdt.sh.gov.cn', '上海', '政务服务', 1, NULL, 'pending');

-- 天津（4 个）- Tier 1
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('天津市人力资源和社会保障局', 'https://hrss.tj.gov.cn', '天津', '人社局', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('天津市人事考试网', 'https://hrss.tj.gov.cn/jsdw/rsksw', '天津', '人事考试网', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('天津市事业单位公开招聘', 'https://hrss.tj.gov.cn/ztzl/ztzl1/sydwgkzp', '天津', '招聘专题', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('天津市三支一扶招募', 'https://hrss.tj.gov.cn/xinwenzixun/gggsnew', '天津', '三支一扶', 1, NULL, 'pending');

-- 重庆（3 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('重庆市人力资源和社会保障局', 'https://rlsbj.cq.gov.cn', '重庆', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('重庆市教育委员会', 'http://jw.cq.gov.cn', '重庆', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('重庆市政府网', 'https://www.cq.gov.cn', '重庆', '政府门户', 3, NULL, 'pending');

-- ============================================
-- 二、华北地区（9 个）
-- ============================================

-- 河北（1 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('河北人才网', 'https://www.hbrc.com.cn', '河北', '人才网', 3, NULL, 'pending');

-- 山西（4 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('山西省人事考试网', 'https://rst.shanxi.gov.cn', '山西', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('山西省教育厅', 'https://jyt.shanxi.gov.cn', '山西', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('山西省人力资源和社会保障厅', 'https://hrss.shanxi.gov.cn', '山西', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('山西省行政审批服务管理局', 'http://xzspglj.shanxi.gov.cn', '山西', '行政审批', 3, NULL, 'pending');

-- 内蒙古（5 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('内蒙古自治区人力资源和社会保障厅', 'https://rsj.nmg.gov.cn', '内蒙古', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('内蒙古自治区事业单位招聘网', 'https://gxks.nmg.gov.cn', '内蒙古', '招聘网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('内蒙古自治区教育厅', 'https://jyt.nmg.gov.cn', '内蒙古', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('内蒙古自治区人民政府门户网站', 'https://www.nmg.gov.cn', '内蒙古', '政府门户', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('内蒙古人才信息库', 'https://www.nmgrc.com.cn', '内蒙古', '人才网', 3, NULL, 'pending');

-- ============================================
-- 三、东北地区（12 个）
-- ============================================

-- 辽宁（4 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('辽宁人事考试网', 'https://lnrsks.gov.cn', '辽宁', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('辽宁省教育厅', 'https://edu.ln.gov.cn', '辽宁', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('辽宁省人力资源和社会保障厅', 'https://rst.ln.gov.cn', '辽宁', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('辽宁省卫生健康委员会', 'https://wsjk.ln.gov.cn', '辽宁', '卫健委', 3, NULL, 'pending');

-- 吉林（4 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('吉林省人力资源和社会保障厅', 'http://hrss.jl.gov.cn', '吉林', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('吉林省人事考试网', 'https://jilin.rsks.org', '吉林', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('吉林省网上办事大厅（吉事办）', 'http://zwfw.jl.gov.cn', '吉林', '政务服务', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('吉林省政务服务和数字化建设管理局', 'http://zsj.jl.gov.cn', '吉林', '政务服务', 3, NULL, 'pending');

-- 黑龙江（4 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('黑龙江省人力资源和社会保障厅', 'https://hrss.hlj.gov.cn', '黑龙江', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('黑龙江公务员考试网', 'https://hljgwy.gov.cn', '黑龙江', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('黑龙江教育厅', 'https://edu.hlj.gov.cn', '黑龙江', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('黑龙江省招生考试信息港', 'http://lzk.hl.cn', '黑龙江', '考试院', 3, NULL, 'pending');

-- ============================================
-- 四、华东地区（25 个）
-- ============================================

-- 江苏（3 个）- Tier 2
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('江苏省人力资源和社会保障厅', 'https://jshrss.gov.cn', '江苏', '人社局', 2, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('江苏省教育厅', 'http://jyt.jiangsu.gov.cn', '江苏', '教育厅', 2, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('江苏省教育考试院', 'https://www.jseea.cn', '江苏', '考试院', 2, NULL, 'pending');

-- 浙江（4 个）- Tier 1
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('浙江省教育厅', 'https://zjedu.gov.cn', '浙江', '教育厅', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('浙江政务服务网', 'https://zjzwfw.gov.cn', '浙江', '政务服务', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('浙江省专业技术人才管理服务平台', 'https://zcps.rlsbt.zj.gov.cn', '浙江', '人才平台', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('浙江省司法厅', 'https://sft.zj.gov.cn/col/col1229247331/index.html', '浙江', '司法厅', 1, NULL, 'pending');

-- 安徽（4 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('安徽省人事考试网', 'https://apta.gov.cn', '安徽', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('安徽政务服务网', 'https://www.ahzwfw.gov.cn', '安徽', '政务服务', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('安徽省人力资源和社会保障厅', 'http://hrss.ah.gov.cn', '安徽', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('安徽教育网', 'http://ahedu.gov.cn', '安徽', '教育厅', 3, NULL, 'pending');

-- 福建（3 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('福建省人民政府门户网站', 'https://www.fujian.gov.cn', '福建', '政府门户', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('福建省人力资源和社会保障厅', 'http://rst.fujian.gov.cn', '福建', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('福建省教育厅', 'https://jyt.fujian.gov.cn', '福建', '教育厅', 3, NULL, 'pending');

-- 江西（4 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('江西省人力资源和社会保障厅', 'https://rsj.jx.gov.cn', '江西', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('江西省教育厅', 'https://jxed.jx.gov.cn', '江西', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('江西人事考试网', 'http://www.jxpta.org', '江西', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('江西省政府采购网', 'http://ccgp-jiangxi.gov.cn', '江西', '政府采购', 3, NULL, 'pending');

-- 山东（4 个）- Tier 2
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('山东省人力资源和社会保障厅', 'https://sdhrss.gov.cn', '山东', '人社局', 2, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('山东省教育厅', 'https://sdedu.gov.cn', '山东', '教育厅', 2, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('山东省教育招生考试院', 'https://www.sdzk.cn', '山东', '考试院', 2, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('山东省人民政府门户网站', 'https://www.shandong.gov.cn', '山东', '政府门户', 2, NULL, 'pending');

-- ============================================
-- 五、华中地区（9 个）
-- ============================================

-- 河南（4 个）- Tier 2
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('河南省人力资源和社会保障厅', 'https://hrss.henan.gov.cn', '河南', '人社局', 2, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('河南省教育厅', 'https://jyt.henan.gov.cn', '河南', '教育厅', 2, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('河南省人民政府门户网站', 'https://www.henan.gov.cn', '河南', '政府门户', 2, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('河南省选调优秀大学毕业生到基层工作', 'http://xds.jyt.henan.gov.cn', '河南', '选调生', 2, NULL, 'pending');

-- 湖北（2 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('湖北省自然资源厅', 'http://zrzyt.hubei.gov.cn', '湖北', '自然资源厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('湖北省财政厅', 'http://czt.hubei.gov.cn', '湖北', '财政厅', 3, NULL, 'pending');

-- 湖南（3 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('湖南省人民政府门户网站', 'https://hunan.gov.cn', '湖南', '政府门户', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('湖南省财政厅', 'https://czt.hunan.gov.cn', '湖南', '财政厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('湖南省科学技术厅', 'https://kjt.hunan.gov.cn', '湖南', '科技厅', 3, NULL, 'pending');

-- ============================================
-- 六、华南地区（14 个）
-- ============================================

-- 广东（3 个）- Tier 1
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('广东省人事考试局', 'https://gdrsks.gov.cn', '广东', '人事考试网', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('广东省政务服务网', 'https://gdzwfw.gjzwfw.gov.cn', '广东', '政务服务', 1, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('广东省教育管理公共服务平台', 'https://gl.gds.edu.cn', '广东', '教育平台', 1, NULL, 'pending');

-- 广西（6 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('广西壮族自治区人事考试院', 'https://www.gxpta.com.cn', '广西', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('广西人力资源和社会保障厅', 'https://hnrst.gxzf.gov.cn', '广西', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('广西教育厅', 'https://jyt.gxzf.gov.cn', '广西', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('广西壮族自治区公务员局', 'https://rsj.gxzf.gov.cn', '广西', '公务员局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('广西壮族自治区事业单位公开招聘', 'https://hnrst.gxzf.gov.cn/syzpgg', '广西', '招聘专题', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('广西大学生志愿服务三支一扶招募', 'https://hnrst.gxzf.gov.cn/szyf', '广西', '三支一扶', 3, NULL, 'pending');

-- 海南（5 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('海南省人力资源和社会保障厅', 'http://hnrst.hainan.gov.cn', '海南', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('海南省教育厅', 'http://edu.hainan.gov.cn', '海南', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('海南省人事考试中心', 'http://www.hnrsks.com.cn', '海南', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('海南省政府网', 'http://www.hainan.gov.cn', '海南', '政府门户', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('海南市县人社部门', 'http://xxgk.hainan.gov.cn', '海南', '市县人社', 3, NULL, 'pending');

-- ============================================
-- 七、西南地区（12 个）
-- ============================================

-- 四川（3 个）- Tier 2
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('四川省教育厅', 'https://edu.sc.gov.cn', '四川', '教育厅', 2, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('四川省教育考试院', 'https://www.sceea.cn', '四川', '考试院', 2, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('四川省人民政府', 'https://www.sc.gov.cn', '四川', '政府门户', 2, NULL, 'pending');

-- 贵州（4 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('贵州省人事考试信息网', 'https://www.gzrsks.gov.cn', '贵州', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('贵州省人力资源和社会保障厅', 'https://gzhrss.gov.cn', '贵州', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('贵州省教育厅', 'https://jyt.guizhou.gov.cn', '贵州', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('贵州省人民政府官网', 'https://www.guizhou.gov.cn', '贵州', '政府门户', 3, NULL, 'pending');

-- 云南（5 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('云南人事考试网', 'https://www.ynrsks.gov.cn', '云南', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('云南省人力资源和社会保障厅', 'https://hrss.yn.gov.cn', '云南', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('云南省教育厅', 'https://jyt.yn.gov.cn', '云南', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('云南省事业单位人事制度改革办公室', 'https://syy.yn.gov.cn', '云南', '事业单位办', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('云南农村人力资源管理服务平台', 'https://ynzz.yn.gov.cn', '云南', '人才平台', 3, NULL, 'pending');

-- ============================================
-- 八、西北地区（22 个）
-- ============================================

-- 陕西（3 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('陕西省人力资源和社会保障厅', 'https://hrss.shaanxi.gov.cn', '陕西', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('陕西省教育厅', 'https://sxedu.gov.cn', '陕西', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('陕西省人民政府门户网站', 'https://www.shaanxi.gov.cn', '陕西', '政府门户', 3, NULL, 'pending');

-- 甘肃（5 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('甘肃省人力资源和社会保障厅', 'https://hrss.gansu.gov.cn', '甘肃', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('甘肃人事考试信息网', 'https://gpta.gansu.gov.cn', '甘肃', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('甘肃省教育厅', 'https://edu.gansu.gov.cn', '甘肃', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('甘肃省人民政府门户网站', 'https://www.gansu.gov.cn', '甘肃', '政府门户', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('甘肃省自然资源厅', 'https://zrzy.gansu.gov.cn', '甘肃', '自然资源厅', 3, NULL, 'pending');

-- 青海（4 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('青海省人力资源和社会保障厅', 'https://hrss.qinghai.gov.cn', '青海', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('青海省教育厅', 'https://www.qhed.edu.cn', '青海', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('青海省人民政府网', 'https://www.qinghai.gov.cn', '青海', '政府门户', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('青海省人事考试网', 'https://rscj.qinghai.gov.cn', '青海', '人事考试网', 3, NULL, 'pending');

-- 宁夏（5 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('宁夏人事考试中心', 'https://nxpta.nxhrss.gov.cn', '宁夏', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('宁夏回族自治区教育厅', 'https://jyt.nxhuizu.gov.cn', '宁夏', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('宁夏回族自治区人力资源和社会保障厅', 'https://www.nxhrss.gov.cn', '宁夏', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('宁夏党务公开网', 'https://www.nxdangw.gov.cn', '宁夏', '党务平台', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('宁夏回族自治区政府门户网站', 'https://www.nx.gov.cn', '宁夏', '政府门户', 3, NULL, 'pending');

-- 新疆（9 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('新疆维吾尔自治区人力资源和社会保障厅', 'https://hrss.xinjiang.gov.cn', '新疆', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('新疆维吾尔自治区事业单位公开招聘网', 'https://www.xjrsks.gov.cn', '新疆', '招聘网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('新疆维吾尔自治区教育厅', 'https://jyt.xinjiang.gov.cn', '新疆', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('新疆维吾尔自治区党委组织部', 'https://zzb.xinjiang.gov.cn', '新疆', '组织部', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('新疆维吾尔自治区农业农村厅', 'https://nync.xinjiang.gov.cn', '新疆', '农业厅', 3, NULL, 'pending');

-- 新疆生产建设兵团（5 个）- 兵团人事考试院已验证可用
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('新疆生产建设兵团人力资源和社会保障局', 'http://rsj.xjbt.gov.cn', '新疆兵团', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('新疆生产建设兵团人事考试网', 'http://xjbtrsksy.com', '新疆兵团', '人事考试网', 3, NULL, 'pending');

-- ✅ 已验证可用 - 爬虫 Demo 测试通过
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('新疆生产建设兵团人事考试院', 'http://btpta.xjbt.gov.cn', '新疆兵团', '人事考试网', 2, '{"list":{"container":"div.con ul","item":"li","title":"a@title","url":"a@href","date":"span.fr"}}', 'active');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('新疆生产建设兵团教育厅', 'http://jyt.xjbt.gov.cn', '新疆兵团', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('新疆生产建设兵团公务员局', 'http://gwwyj.xjbt.gov.cn', '新疆兵团', '公务员局', 3, NULL, 'pending');

-- ============================================
-- 九、其他地区（10 个）
-- ============================================

-- 西藏（5 个）
INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('西藏自治区人力资源和社会保障厅', 'http://rsrc.xz.gov.cn', '西藏', '人社局', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('西藏自治区公务员考试录用网络信息发布平台', 'http://zkgwy.xz.gov.cn', '西藏', '人事考试网', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('西藏自治区教育厅', 'http://jyt.xz.gov.cn', '西藏', '教育厅', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('西藏自治区事业单位招聘考试信息发布', 'http://rsrc.xz.gov.cn/gk/index.htm', '西藏', '招聘专题', 3, NULL, 'pending');

INSERT INTO source_websites (name, url, region, website_type, priority, selector_config, status)
VALUES ('西藏自治区政府门户网站', 'http://www.xz.gov.cn', '西藏', '政府门户', 3, NULL, 'pending');

-- ============================================
-- 完成统计
-- ============================================
-- 总计: 137 个网站
-- Tier 1 (priority=1): 19 个（北京3 + 上海5 + 天津4 + 广东3 + 浙江4）
-- Tier 2 (priority=2): 14 个（河南4 + 山东4 + 四川3 + 江苏3）
-- Tier 3 (priority=3): 104 个（其他）
