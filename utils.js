/**
 * Run-length encode a WaveDrom character sequence.
 * Consecutive identical characters are replaced with '.' (continue).
 * @param {string[]} chars
 * @returns {string}
 */
export function wavedromRunLength(chars) {
  let result = '';
  let prev = null;
  for (const ch of chars) {
    result += (ch === prev) ? '.' : ch;
    prev = ch;
  }
  return result;
}

/**
 * Convert a signal to WaveDrom format.
 * @param {{ name: string, type: string, wave: (number|null)[], data?: string[] }} signal
 * @returns {{ name: string, wave: string, data?: string[] }}
 */
export function convertSignalToWaveDrom(signal) {
  const dataArr = [];
  let waveStr = '';

  if (signal.type === 'clk' || signal.type === 'binary') {
    waveStr = wavedromRunLength(signal.wave.map(v => v === null ? 'x' : String(v)));
  } else if (signal.type === 'bus') {
    let lastData = null;
    for (const data of (signal.data ?? [])) {
      if (data) {
        if (data !== lastData) {
          waveStr += '2';
          dataArr.push(data);
          lastData = data;
        } else {
          waveStr += '.';
        }
      } else {
        waveStr += 'x';
        lastData = null;
      }
    }
  }

  const sig = { name: signal.name, wave: waveStr };
  if (dataArr.length > 0) sig.data = dataArr;
  return sig;
}

/**
 * Format a value for use in a SystemVerilog literal.
 * @param {string|number} value
 * @param {number} width
 * @returns {string}
 */
export function formatSvValue(value, width) {
  if (width <= 1) return String(value);
  const s = String(value).toLowerCase();
  if (s.startsWith('0x')) return `${width}'h${s.slice(2)}`;
  if (s.startsWith('0b')) return `${width}'b${s.slice(2)}`;
  return `${width}'d${s}`;
}

/**
 * Calculate an appropriate grid step size for the given number of time steps.
 * @param {number} timeSteps
 * @returns {number}
 */
export function calculateGridStep(timeSteps) {
  const minGridStep = 20;
  const maxGridStep = 100;
  const targetWidth = 1200;
  return Math.floor(Math.max(minGridStep, Math.min(maxGridStep, targetWidth / timeSteps)));
}
