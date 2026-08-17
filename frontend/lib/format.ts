/** 展示层格式化工具 */

/** 千分位数字 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("zh-CN");
}

/** 招聘人数 */
export function formatRecruitCount(count: number | null | undefined): string {
  if (count == null) return "待定";
  return `${formatNumber(count)} 人`;
}

/** 笔试时间：日期 + 时段 */
export function formatExamSchedule(
  examDate: string | null | undefined,
  examTime: string | null | undefined
): string {
  if (!examDate && !examTime) return "待定";
  if (examDate && examTime) return `${examDate} ${examTime}`;
  return examDate || examTime || "待定";
}

/** 科目列表 */
export function formatSubjects(subjects: string[] | null | undefined): string {
  if (!subjects || subjects.length === 0) return "待定";
  return subjects.join("、");
}

/** 相对/本地时间 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

/** 构建带筛选参数的查询字符串 */
export function buildQueryString(
  params: Record<string, string | number | undefined | null>
): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
