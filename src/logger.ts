export type LoggerOptions = typeof Logger.prototype.options | undefined;

class Logger {
  options = { verbose: false };

  constructor(options: Partial<LoggerOptions> = undefined) {
    this.setOptions(options);
  }
  setOptions(options: Partial<LoggerOptions>) {
    this.options = { ...this.options, ...options };
  }
  // rome-ignore lint/suspicious/noExplicitAny: <explanation>
  log(...args: any[]) {
    console.log(...args);
  }

  // rome-ignore lint/suspicious/noExplicitAny: <explanation>
  error(...args: any[]) {
    console.error(...args);
  }

  // rome-ignore lint/suspicious/noExplicitAny: <explanation>
  debug(...args: any[]) {
    if (this.options.verbose) {
      console.log(...args);
    }
  }
}
const logger = new Logger();

export default logger;
