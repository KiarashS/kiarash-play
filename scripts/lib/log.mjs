const ESC = String.fromCharCode(27);
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (tty ? `${ESC}[${code}m${s}${ESC}[0m` : String(s));

export const color = {
  dim: paint(2),
  bold: paint(1),
  red: paint(31),
  green: paint(32),
  yellow: paint(33),
  blue: paint(34),
  magenta: paint(35),
  cyan: paint(36),
};

let warnings = 0;
/** When set, lines go here instead of the console so a caller can return them. */
let sink = null;

/** Start collecting log lines; the returned function stops and hands them back. */
export function captureLog() {
  const previous = sink;
  const lines = [];
  sink = lines;
  return () => {
    sink = previous;
    return lines;
  };
}

const emit = (stream, prefix, msg) => {
  if (sink) sink.push(`${prefix}${msg}`);
  else stream(msg);
};

export const log = {
  step: (msg) => emit((m) => console.log(`${color.magenta('>')} ${color.bold(m)}`), '', msg),
  info: (msg) => emit((m) => console.log(`  ${m}`), '', msg),
  detail: (msg) => emit((m) => console.log(`  ${color.dim(m)}`), '', msg),
  ok: (msg) => emit((m) => console.log(`  ${color.green('ok')} ${m}`), 'ok ', msg),
  skip: (msg) => emit((m) => console.log(`  ${color.dim('--')} ${color.dim(m)}`), '', msg),
  warn: (msg) => {
    warnings += 1;
    emit((m) => console.warn(`  ${color.yellow('warn')} ${m}`), 'warn ', msg);
  },
  fail: (msg) => emit((m) => console.error(`  ${color.red('fail')} ${m}`), 'failed ', msg),
  warningCount: () => warnings,
};
