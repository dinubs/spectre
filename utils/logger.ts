import colors from 'yoctocolors-cjs';

type LogType = 'info' | 'success' | 'warn' | 'error' | 'ai';

const logStyles: Record<LogType, (text: string) => string> = {
  info: colors.blue,
  success: colors.green,
  warn: colors.yellow,
  error: colors.red,
  ai: colors.magenta
};

export function log(message: string, type: LogType = 'info'): void {
  console.log(type);
  console.log(logStyles[type](`> ${message}`));
}