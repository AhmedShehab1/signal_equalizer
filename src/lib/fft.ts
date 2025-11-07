/**
 * Fast Fourier Transform implementation
 * Computes the FFT of a signal using the Cooley-Tukey algorithm (power-of-2)
 */

export type Complex = {
  re: number;  // Real part
  im: number;  // Imaginary part
};

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Compute FFT of input signal
 * @param x - Array of complex numbers
 * @returns Array of complex numbers representing frequency domain
 */
export function fft(x: Complex[]): Complex[] {
  const N = x.length;

  // 1. Base case for the recursion
  if (N <= 1) {
    return x;
  }

  if (!isPowerOfTwo(N)) {
    throw new Error(`fft: input length ${N} is not a power of 2`);
  }

  // 2. Divide
  const evens: Complex[] = [];
  const odds: Complex[] = [];
  for (let i = 0; i < N; i++) {
    if (i % 2 === 0) {
      evens.push(x[i]);
    } else {
      odds.push(x[i]);
    }
  }

  // 3. Conquer (Recursive calls)
  const X_evens = fft(evens);
  const X_odds = fft(odds);

  // 4. Combine
  const X: Complex[] = new Array(N);
  for (let k = 0; k < N / 2; k++) {
    // Calculate the twiddle factor
    const angle = (-2 * Math.PI * k) / N;
    const twiddle: Complex = {
      re: Math.cos(angle),
      im: Math.sin(angle),
    };

    // t = twiddle * X_odds[k] (complex multiplication)
    const t: Complex = {
      re: twiddle.re * X_odds[k].re - twiddle.im * X_odds[k].im,
      im: twiddle.re * X_odds[k].im + twiddle.im * X_odds[k].re,
    };

    // Butterfly operation
    X[k] = {
      re: X_evens[k].re + t.re,
      im: X_evens[k].im + t.im,
    };
    X[k + N / 2] = {
      re: X_evens[k].re - t.re,
      im: X_evens[k].im - t.im,
    };
  }
  return X;
}

/**
 * Compute magnitude spectrum from FFT output
 * @param fftOutput - FFT output as complex numbers
 * @returns Array of magnitudes
 */
export function getMagnitudeSpectrum(fftOutput: Complex[]): number[] {
  return fftOutput.map(c => Math.sqrt(c.re * c.re + c.im * c.im));
}

/**
 * Pad signal to next power of 2
 */
export function padToPowerOf2(signal: number[]): Complex[] {
  const n = signal.length;
  const nextPow2 = Math.pow(2, Math.ceil(Math.log2(n)));

  const padded: Complex[] = new Array(nextPow2);
  for (let i = 0; i < nextPow2; i++) {
    padded[i] = {
      re: i < n ? signal[i] : 0,
      im: 0,
    };
  }

  return padded;
}


// Inverse FFT using conjugation identity:
// ifft(X) = (1/N) * conjugate( fft( conjugate(X) ) )
export function ifft(X: Complex[]): Complex[] {
  const N = X.length;
  if (N === 0) return [];
  if (!isPowerOfTwo(N)) {
    throw new Error(`ifft: input length ${N} is not a power of 2`);
  }

  const X_conj = X.map(x => ({ re: x.re, im: -x.im }));
  const x_conj = fft(X_conj);
  const x = x_conj.map(xc => ({ re: xc.re / N, im: -xc.im / N }));
  return x;
}
