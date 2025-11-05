/**
 * Fast Fourier Transform implementation
 * Computes the FFT of a signal using the Cooley-Tukey algorithm
 */

export interface ComplexNumber {
  real: number;
  imag: number;
}

/**
 * Compute FFT of input signal
 * @param input - Real-valued input signal
 * @returns Array of complex numbers representing frequency domain
 */
export function fft(input: number[]): ComplexNumber[] {
  const n = input.length;
  
  // Base case
  if (n === 1) {
    return [{ real: input[0], imag: 0 }];
  }
  
  // Ensure n is a power of 2
  if (n <= 0 || (n & (n - 1)) !== 0) {
    throw new Error('FFT input length must be a power of 2');
  }
  
  // Split into even and odd indices
  const even: number[] = [];
  const odd: number[] = [];
  
  for (let i = 0; i < n; i++) {
    if (i % 2 === 0) {
      even.push(input[i]);
    } else {
      odd.push(input[i]);
    }
  }
  
  // Recursive FFT on even and odd parts
  const evenFFT = fft(even);
  const oddFFT = fft(odd);
  
  // Combine results
  const result: ComplexNumber[] = new Array(n);
  
  for (let k = 0; k < n / 2; k++) {
    const angle = -2 * Math.PI * k / n;
    const wk = { real: Math.cos(angle), imag: Math.sin(angle) };
    
    const t = complexMultiply(wk, oddFFT[k]);
    
    result[k] = complexAdd(evenFFT[k], t);
    result[k + n / 2] = complexSubtract(evenFFT[k], t);
  }
  
  return result;
}

/**
 * Compute magnitude spectrum from FFT output
 * @param fftOutput - FFT output as complex numbers
 * @returns Array of magnitudes
 */
export function getMagnitudeSpectrum(fftOutput: ComplexNumber[]): number[] {
  return fftOutput.map(c => Math.sqrt(c.real * c.real + c.imag * c.imag));
}

/**
 * Helper: Complex number multiplication
 */
function complexMultiply(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return {
    real: a.real * b.real - a.imag * b.imag,
    imag: a.real * b.imag + a.imag * b.real,
  };
}

/**
 * Helper: Complex number addition
 */
function complexAdd(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return {
    real: a.real + b.real,
    imag: a.imag + b.imag,
  };
}

/**
 * Helper: Complex number subtraction
 */
function complexSubtract(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return {
    real: a.real - b.real,
    imag: a.imag - b.imag,
  };
}

/**
 * Pad signal to next power of 2
 */
export function padToPowerOf2(signal: number[]): number[] {
  const n = signal.length;
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));
  
  if (n === nextPow2) {
    return signal;
  }
  
  const padded = new Array(nextPow2).fill(0);
  for (let i = 0; i < n; i++) {
    padded[i] = signal[i];
  }
  
  return padded;
}
