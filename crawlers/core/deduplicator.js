/**
 * 数据去重和变更检测模块
 */

import crypto from 'crypto';

/**
 * 生成 URL 的 hash 值（用于去重）
 * @param {string} url - 公告 URL
 * @returns {string} MD5 hash
 */
export function generateUrlHash(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

/**
 * 生成内容的 hash 值（用于变更检测）
 * @param {object} announcement - 公告对象
 * @returns {string} MD5 hash
 */
export function generateContentHash(announcement) {
  const { title, publishDate, rawHtml } = announcement;
  const content = `${title}|${publishDate}|${rawHtml}`;
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * 去重：基于 URL hash
 * @param {Array} announcements - 公告数组
 * @returns {Array} 去重后的公告数组
 */
export function deduplicateByUrl(announcements) {
  const seen = new Set();
  const unique = [];

  for (const item of announcements) {
    const hash = generateUrlHash(item.url);
    if (!seen.has(hash)) {
      seen.add(hash);
      unique.push({
        ...item,
        urlHash: hash,
        contentHash: generateContentHash(item)
      });
    }
  }

  return unique;
}

/**
 * 检测变更：对比新旧数据
 * @param {Array} newData - 新数据
 * @param {Array} oldData - 旧数据（需包含 urlHash 和 contentHash）
 * @returns {object} { added, updated, unchanged }
 */
export function detectChanges(newData, oldData) {
  const oldMap = new Map(oldData.map(item => [item.urlHash, item]));

  const added = [];
  const updated = [];
  const unchanged = [];

  for (const item of newData) {
    const urlHash = generateUrlHash(item.url);
    const contentHash = generateContentHash(item);
    const old = oldMap.get(urlHash);

    if (!old) {
      // 新增
      added.push({
        ...item,
        urlHash,
        contentHash
      });
    } else if (old.contentHash !== contentHash) {
      // 更新
      updated.push({
        ...item,
        urlHash,
        contentHash,
        oldContentHash: old.contentHash
      });
    } else {
      // 未变更
      unchanged.push(item);
    }
  }

  return { added, updated, unchanged };
}

/**
 * 批量添加 hash 字段
 * @param {Array} announcements - 公告数组
 * @returns {Array} 添加 hash 后的数组
 */
export function addHashes(announcements) {
  return announcements.map(item => ({
    ...item,
    urlHash: generateUrlHash(item.url),
    contentHash: generateContentHash(item)
  }));
}
