/**
 * 时区工具（共享知识 §8.5 红线）：
 * 所有"自然日/自然月"均为 Asia/Shanghai，日键统一 shanghaiDay(): 'YYYY-MM-DD'。
 * 禁止 new Date().toISOString().slice(0,10)。
 */

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 取指定时刻（默认当前）的上海日键 YYYY-MM-DD */
export function shanghaiDay(date: Date = new Date()): string {
  // en-CA 输出即 YYYY-MM-DD 格式
  return dayFormatter.format(date);
}

/** 取上海月键 YYYY-MM（由日键截取，避免再次换算） */
export function shanghaiMonth(date: Date = new Date()): string {
  return shanghaiDay(date).slice(0, 7);
}

/** 上海昨日日键 */
export function shanghaiYesterday(date: Date = new Date()): string {
  return shanghaiDay(addDays(date, -1));
}

/** 日期加减天数 */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** 加年（套餐有效期） */
export function addYears(date: Date, years: number): Date {
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

/** 减小时（订单自动关闭窗口） */
export function subHours(date: Date, hours: number): Date {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

/** 未来 N 天后的过期时间点（入账时刻起算） */
export function expiresFromNow(ttlDays: number, from: Date = new Date()): Date {
  return addDays(from, ttlDays);
}
