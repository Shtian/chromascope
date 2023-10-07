export type LoggerOptions = typeof Logger.prototype.options | undefined;

class Logger {
  options = { verbose: false };

  constructor(options: Partial<LoggerOptions> = undefined) {
    this.setOptions(options);
  }

  setOptions(options: Partial<LoggerOptions>) {
    this.options = { ...this.options, ...options };
  }

  log(...args: unknown[]) {
    console.log(...args);
  }

  error(...args: unknown[]) {
    console.error(...args);
  }

  debug(...args: unknown[]) {
    if (this.options.verbose) {
      console.log(...args);
    }
  }
}
const logger = new Logger();

export default logger;
