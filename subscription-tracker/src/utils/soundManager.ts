class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user interaction to comply with browser autoplay policies.
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMute(mute: boolean) {
    this.isMuted = mute;
  }

  getMute(): boolean {
    return this.isMuted;
  }

  // Soft high-frequency tick for hovers
  playTick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.015, this.ctx.currentTime); // Very soft
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.03);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.04);
  }

  // Slick mechanical click for standard selections
  playClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.06);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.06);
  }

  // Rising electronic chime for adding log counts
  playLogSuccess() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    // Low bell chime
    this.playTone(523.25, 'sine', 0.15, 0.05); // C5
    
    // High crystal chime slightly delayed
    setTimeout(() => {
      if (this.isMuted) return;
      this.playTone(783.99, 'sine', 0.25, 0.04); // G5
    }, 60);
  }

  // Descending soft sound for decreasing values
  playLogDecrease() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime); // A4
    osc.frequency.linearRampToValueAtTime(220, this.ctx.currentTime + 0.15); // A3

    gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + 0.16);
  }

  // Celestial success chord for unlocking achievements or completing goals!
  playCosmicSuccess() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    // Arpeggiate standard celestial C-Major 7th / 9th chord in a retro-synth fashion
    const notes = [
      261.63, // C4
      392.00, // G4
      523.25, // C5
      587.33, // D5 (adds that cosmic floating suspended flavor)
      783.99, // G5
      1046.50 // C6
    ];

    notes.forEach((freq, index) => {
      setTimeout(() => {
        if (this.isMuted) return;
        this.playTone(freq, 'triangle', 0.6, 0.02, 0.05);
        this.playTone(freq * 1.005, 'sine', 0.8, 0.03, 0.03); // Slight detuned layer for warmth
      }, index * 80);
    });
  }

  // Private helper to play standard tones with attack and decay envelopes
  private playTone(
    freq: number, 
    type: OscillatorType, 
    duration: number, 
    volume = 0.05,
    attackTime = 0.01
  ) {
    if (!this.ctx) return;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

    // Apply soft high cut to triangle oscillators to make them warmer and less harsh
    if (type === 'triangle') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 3, this.ctx.currentTime);
    } else {
      filter.type = 'allpass';
    }

    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attackTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }
}

export const soundManager = new SoundManager();
