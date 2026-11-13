import pino from "pino";

/** 结构化日志：线上用 journald 收，字段名固定，方便 grep。 */
export function createLogger(level: string) {
  return pino({ level, base: { svc: "house-api" }, timestamp: pino.stdTimeFunctions.isoTime });
}
