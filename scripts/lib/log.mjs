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

export const log = {
  step: (msg) => console.log(`${color.magenta('>')} ${color.bold(msg)}`),
  info: (msg) => console.log(`  ${msg}`),
  detail: (msg) => console.log(`  ${color.dim(msg)}`),
  ok: (msg) => console.log(`  ${color.green('ok')} ${msg}`),
  skip: (msg) => console.log(`  ${color.dim('--')} ${color.dim(msg)}`),
  warn: (msg) => {
    warnings += 1;
    console.warn(`  ${color.yellow('warn')} ${msg}`);
  },
  fail: (msg) => console.error(`  ${color.red('fail')} ${msg}`),
  warningCount: () => warnings,
};
