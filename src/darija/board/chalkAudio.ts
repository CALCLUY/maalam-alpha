/**
 * Procedural Web Audio effects for the blackboard:
 * Synthesizes realistic felt-eraser friction on dry slate using filtered noise
 * bursts and dynamic envelope curves. Runs entirely in the client with zero
 * external audio files or network latency.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Plays a realistic 4-stroke felt blackboard eraser sound:
 * Generates pink-like noise through a dynamic bandpass and lowpass filter
 * matched to the sweeping motions of the eraser duster.
 */
export function playChalkEraseSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const duration = 1.15;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // Pink-ish / textured granular noise
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2 + white * 0.12) * 0.38;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter isolating the felt-on-slate chalk friction frequencies (~1200 - 2400 Hz)
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(1350, ctx.currentTime);
    bandpass.Q.setValueAtTime(1.9, ctx.currentTime);

    // Dynamic frequency sweeps corresponding to each stroke
    const t0 = ctx.currentTime;
    bandpass.frequency.setValueAtTime(1250, t0);
    bandpass.frequency.exponentialRampToValueAtTime(1950, t0 + 0.22);
    bandpass.frequency.exponentialRampToValueAtTime(1300, t0 + 0.44);
    bandpass.frequency.exponentialRampToValueAtTime(1850, t0 + 0.68);
    bandpass.frequency.exponentialRampToValueAtTime(1200, t0 + 0.92);
    bandpass.frequency.exponentialRampToValueAtTime(1500, t0 + 1.10);

    // Lowpass filter to avoid harsh digital static and give warm felt friction
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(3200, t0);
    lowpass.frequency.linearRampToValueAtTime(2800, t0 + duration);

    // Master gain envelope matching 4 eraser sweep strokes across the board
    const gain = ctx.createGain();
    const vol = 0.28;

    gain.gain.setValueAtTime(0.001, t0);

    // Stroke 1: Top sweep (0.00s - 0.28s)
    gain.gain.exponentialRampToValueAtTime(vol * 0.9, t0 + 0.07);
    gain.gain.exponentialRampToValueAtTime(vol * 0.18, t0 + 0.25);

    // Stroke 2: Diagonal down-right sweep (0.28s - 0.55s)
    gain.gain.exponentialRampToValueAtTime(vol * 1.0, t0 + 0.36);
    gain.gain.exponentialRampToValueAtTime(vol * 0.22, t0 + 0.52);

    // Stroke 3: Diagonal down-left sweep (0.55s - 0.82s)
    gain.gain.exponentialRampToValueAtTime(vol * 0.92, t0 + 0.64);
    gain.gain.exponentialRampToValueAtTime(vol * 0.18, t0 + 0.79);

    // Stroke 4: Bottom sweep & lift (0.82s - 1.15s)
    gain.gain.exponentialRampToValueAtTime(vol * 0.75, t0 + 0.90);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    source.connect(bandpass);
    bandpass.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(ctx.destination);

    source.start(t0);
    source.stop(t0 + duration);
  } catch {
    // Graceful fallback if Web Audio is unavailable or restricted
  }
}
