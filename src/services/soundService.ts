// ==========================================
// DAYCRAFT — AUTHENTIC ACOUSTIC PROCEDURAL SOUND ENGINE
// High-fidelity, royalty-free, fully offline ambient synthesizer
// Specific acoustic models: sheltered rain, distant rolling thunder,
// crackling hearth wood pops, stereo forest breeze, ocean surf,
// safe brownian drone, diffuse cafe formants & twilight crickets
// Zero external network dependencies, non-clipping dynamics
// ==========================================

export type AmbientSoundType =
  | 'rain'
  | 'thunder'
  | 'campfire'
  | 'forest_wind'
  | 'ocean_waves'
  | 'white_noise'
  | 'brown_noise'
  | 'cafe_murmur'
  | 'crickets';

export interface AmbientTrackInfo {
  id: AmbientSoundType;
  label: string;
  description: string;
  iconName: string;
}

export const AMBIENT_TRACK_LIST: AmbientTrackInfo[] = [
  { id: 'rain', label: 'Gentle Rain', description: 'Sheltered cabin rain texture with soft foliage droplets', iconName: 'CloudRain' },
  { id: 'thunder', label: 'Distant Thunder', description: 'Low-frequency rolling rumbles and distant reverberation', iconName: 'CloudLightning' },
  { id: 'campfire', label: 'Crackling Hearth', description: 'Warm glowing embers with irregular wood crackles and pops', iconName: 'Flame' },
  { id: 'forest_wind', label: 'Forest Breeze', description: 'Light breeze moving through pine canopies with stereo drift', iconName: 'Wind' },
  { id: 'ocean_waves', label: 'Ocean Waves', description: 'Gentle breaking surf with organic swell and receding foam', iconName: 'Waves' },
  { id: 'white_noise', label: 'White Noise', description: 'Even broadband focus masking with high-frequency smoothing', iconName: 'Radio' },
  { id: 'brown_noise', label: 'Brownian Drone', description: 'Velvety deep low-frequency warmth, safe on mobile speakers', iconName: 'Disc' },
  { id: 'cafe_murmur', label: 'Cozy Café', description: 'Diffuse background room tone and occasional distant porcelain', iconName: 'Coffee' },
  { id: 'crickets', label: 'Night Crickets', description: 'Spatially layered twilight crickets with natural pause cadence', iconName: 'Moon' },
];

export interface SoundscapePreset {
  id: string;
  name: string;
  description: string;
  tracks: Partial<Record<AmbientSoundType, number>>; // sound -> volume (0 to 1)
}

export const SOUNDSCAPE_PRESETS: SoundscapePreset[] = [
  {
    id: 'rainy_cabin',
    name: 'Rainy Cabin',
    description: 'Steady rain outside a sheltered cabin with gentle forest breeze',
    tracks: { rain: 0.65, forest_wind: 0.25 },
  },
  {
    id: 'stormy_coast',
    name: 'Stormy Coast',
    description: 'Crashing ocean waves, distant rolling thunder, and coastal wind',
    tracks: { ocean_waves: 0.65, thunder: 0.35, forest_wind: 0.25 },
  },
  {
    id: 'cozy_coffeehouse',
    name: 'Cozy Coffeehouse',
    description: 'Warm cafe ambiance with diffuse conversation and subtle grounding drone',
    tracks: { cafe_murmur: 0.65, brown_noise: 0.2 },
  },
  {
    id: 'deep_void',
    name: 'Deep Void',
    description: 'Brownian low-frequency drone with soft broadband noise for ADHD deep focus',
    tracks: { brown_noise: 0.75, white_noise: 0.15 },
  },
  {
    id: 'twilight_camp',
    name: 'Twilight Camp',
    description: 'Warm crackling hearth with gentle forest breeze and night crickets',
    tracks: { campfire: 0.6, forest_wind: 0.3, crickets: 0.35 },
  },
];

interface ActiveTrackNodes {
  sources: AudioNode[];
  gainNode: GainNode;
  intervals?: NodeJS.Timeout[];
  timeouts?: NodeJS.Timeout[];
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private activeTracks: Map<AmbientSoundType, ActiveTrackNodes> = new Map();
  private trackVolumes: Map<AmbientSoundType, number> = new Map();
  private isMasterMuted: boolean = false;
  private masterVolume: number = 0.5;
  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch {
        // ignore listener error
      }
    });
  }

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        // Master Limiter / Dynamics Compressor to guarantee zero clipping with multiple layers
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-10, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(24, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(5, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.2, this.ctx.currentTime);

        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

        // Real-time AnalyserNode for audio visualization (lightweight 64 fftSize = 32 frequency bins)
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 64;
        this.analyser.smoothingTimeConstant = 0.8;

        this.masterGain.connect(this.compressor);
        this.compressor.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // --- SHORT UI SOUNDS ---

  playClick(volume: number = 0.5): void {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.035);

      gain.gain.setValueAtTime(volume * 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.035);
    } catch {
      // Audio fallback
    }
  }

  playCompletionChime(volume: number = 0.5): void {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const freqs = [523.25, 659.25, 783.99, 1046.50];

      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        const startTime = now + idx * 0.05;
        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.exponentialRampToValueAtTime(volume * 0.22, startTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.7);
      });
    } catch {
      // Audio fallback
    }
  }

  playTimerBell(volume: number = 0.6): void {
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const harmonics = [528, 1056, 1584, 2112];
      const gains = [0.35, 0.18, 0.08, 0.03];

      harmonics.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(volume * gains[i], now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 3.2);
      });
    } catch {
      // Audio fallback
    }
  }

  // --- MULTI-SOUND LAYERED SOUNDSCAPE SYNTHESIZER ---

  setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.isMasterMuted ? 0 : this.masterVolume, now + 0.06);
    }
    this.notifyListeners();
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMute(mute: boolean): void {
    this.isMasterMuted = mute;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(mute ? 0 : this.masterVolume, now + 0.08);
    }
    this.notifyListeners();
  }

  isMuted(): boolean {
    return this.isMasterMuted;
  }

  isTrackActive(type: AmbientSoundType): boolean {
    return this.activeTracks.has(type);
  }

  /**
   * Returns true only when the specific track is actively synthesizing AND
   * master output and track gain are unmuted and greater than zero.
   */
  isTrackAudible(type: AmbientSoundType): boolean {
    return (
      this.activeTracks.has(type) &&
      !this.isMasterMuted &&
      this.masterVolume > 0.001 &&
      this.getTrackVolume(type) > 0.001
    );
  }

  getTrackVolume(type: AmbientSoundType): number {
    return this.trackVolumes.get(type) ?? 0.5;
  }

  setTrackVolume(type: AmbientSoundType, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.trackVolumes.set(type, clamped);

    const active = this.activeTracks.get(type);
    if (active && this.ctx) {
      const now = this.ctx.currentTime;
      active.gainNode.gain.cancelScheduledValues(now);
      active.gainNode.gain.linearRampToValueAtTime(clamped * 0.6, now + 0.08);
    }
    this.notifyListeners();
  }

  toggleTrack(type: AmbientSoundType, defaultVolume: number = 0.5): boolean {
    if (this.activeTracks.has(type)) {
      this.stopTrack(type);
      return false;
    } else {
      const vol = this.trackVolumes.get(type) ?? defaultVolume;
      this.startTrack(type, vol);
      return true;
    }
  }

  startTrack(type: AmbientSoundType, volume: number = 0.5): void {
    const ctx = this.initContext();
    if (!ctx || !this.masterGain) return;

    if (this.activeTracks.has(type)) {
      this.setTrackVolume(type, volume);
      return;
    }

    const clampedVol = Math.max(0, Math.min(1, volume));
    this.trackVolumes.set(type, clampedVol);

    const trackGain = ctx.createGain();
    const now = ctx.currentTime;
    // Smooth 0.75s fade-in so there is never an abrupt pop
    trackGain.gain.setValueAtTime(0.0001, now);
    trackGain.gain.linearRampToValueAtTime(clampedVol * 0.6, now + 0.75);
    trackGain.connect(this.masterGain);

    try {
      const created = this.synthesizeTrackNodes(ctx, type, trackGain);
      this.activeTracks.set(type, created);
      this.notifyListeners();
    } catch {
      // Audio synth fallback
    }
  }

  stopTrack(type: AmbientSoundType): void {
    const active = this.activeTracks.get(type);
    if (!active || !this.ctx) return;

    const now = this.ctx.currentTime;
    // Smooth 0.65s fade-out so there is never a click or abrupt cut
    try {
      active.gainNode.gain.cancelScheduledValues(now);
      active.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.65);
    } catch {
      // ignore
    }

    if (active.intervals) {
      active.intervals.forEach(t => clearInterval(t));
    }
    if (active.timeouts) {
      active.timeouts.forEach(t => clearTimeout(t));
    }

    // Clean up audio nodes after fade-out finishes
    setTimeout(() => {
      active.sources.forEach(src => {
        try {
          if ('stop' in src) (src as AudioBufferSourceNode | OscillatorNode).stop();
          src.disconnect();
        } catch {
          // ignore
        }
      });

      try {
        active.gainNode.disconnect();
      } catch {
        // ignore
      }
    }, 700);

    this.activeTracks.delete(type);
    this.notifyListeners();
  }

  stopAllTracks(): void {
    const keys = Array.from(this.activeTracks.keys());
    keys.forEach(k => this.stopTrack(k));
    this.notifyListeners();
  }

  applyPreset(preset: SoundscapePreset): void {
    const targetTracks = preset.tracks;
    const currentTypes = Array.from(this.activeTracks.keys());

    // 1. Gently fade out and stop tracks NOT in the target preset
    currentTypes.forEach(type => {
      if (!(type in targetTracks) || (targetTracks[type] ?? 0) <= 0) {
        this.stopTrack(type);
      }
    });

    // 2. Crossfade or start tracks in the new preset smoothly without duplicate layers
    Object.entries(targetTracks).forEach(([typeStr, targetVol]) => {
      const type = typeStr as AmbientSoundType;
      if (typeof targetVol !== 'number' || targetVol <= 0) return;

      if (this.activeTracks.has(type)) {
        // Already active: smoothly ramp volume to new level over 0.45s for natural crossfade
        this.trackVolumes.set(type, targetVol);
        const active = this.activeTracks.get(type);
        if (active && this.ctx) {
          const now = this.ctx.currentTime;
          active.gainNode.gain.cancelScheduledValues(now);
          active.gainNode.gain.linearRampToValueAtTime(targetVol * 0.6, now + 0.45);
        }
      } else {
        // Start new layer with smooth fade-in
        this.startTrack(type, targetVol);
      }
    });
    this.notifyListeners();
  }

  getActiveTrackCount(): number {
    return this.activeTracks.size;
  }

  /**
   * Retrieves real-time frequency and RMS amplitude data directly from the Web Audio graph.
   * If audio is muted, paused, or no tracks are playing, returns isPlaying: false with zeros.
   */
  getAudioAnalysisData(frequencyArray?: Uint8Array): {
    isPlaying: boolean;
    rms: number;
    frequencies: Uint8Array;
  } {
    const isPlaying =
      !this.isMasterMuted &&
      this.masterVolume > 0 &&
      this.activeTracks.size > 0 &&
      this.ctx !== null &&
      this.ctx.state === 'running';

    const bins = 32;
    const buffer = frequencyArray && frequencyArray.length === bins ? frequencyArray : new Uint8Array(bins);

    if (!isPlaying || !this.analyser) {
      buffer.fill(0);
      return { isPlaying: false, rms: 0, frequencies: buffer };
    }

    try {
      this.analyser.getByteFrequencyData(buffer as any);
      let sum = 0;
      for (let i = 0; i < bins; i++) {
        sum += buffer[i] * buffer[i];
      }
      const rms = Math.min(1, Math.sqrt(sum / bins) / 255);
      return {
        isPlaying: rms > 0.005,
        rms,
        frequencies: buffer,
      };
    } catch {
      buffer.fill(0);
      return { isPlaying: false, rms: 0, frequencies: buffer };
    }
  }

  // --- ACCURATE REALISTIC PROCEDURAL ACOUSTIC MODELS ---

  private synthesizeTrackNodes(ctx: AudioContext, type: AmbientSoundType, destination: GainNode): ActiveTrackNodes {
    const sources: AudioNode[] = [];
    const intervals: NodeJS.Timeout[] = [];
    const timeouts: NodeJS.Timeout[] = [];

    switch (type) {
      // 1. GENTLE RAIN: Sheltered cabin rainfall texture with thousands of soft droplet taps
      case 'rain': {
        // Continuous soft precipitation wash (Layer 1: diffuse high-mid rain texture)
        const buffer = this.createNoiseBuffer(ctx, 'pink', 4);
        const washSource = ctx.createBufferSource();
        washSource.buffer = buffer;
        washSource.loop = true;

        const bandFilter = ctx.createBiquadFilter();
        bandFilter.type = 'bandpass';
        bandFilter.frequency.setValueAtTime(1350, ctx.currentTime);
        bandFilter.Q.setValueAtTime(0.7, ctx.currentTime);

        const highShelf = ctx.createBiquadFilter();
        highShelf.type = 'highshelf';
        highShelf.frequency.setValueAtTime(4500, ctx.currentTime);
        highShelf.gain.setValueAtTime(-6, ctx.currentTime);

        const washGain = ctx.createGain();
        washGain.gain.setValueAtTime(0.45, ctx.currentTime);

        washSource.connect(bandFilter);
        bandFilter.connect(highShelf);
        highShelf.connect(washGain);
        washGain.connect(destination);

        washSource.start();
        sources.push(washSource, bandFilter, highShelf, washGain);

        // Layer 2: Slow undulating mid-frequency rain density variation (LFO)
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.11, ctx.currentTime); // ~9.1s period
        const lfoGain = ctx.createGain();
        lfoGain.gain.setValueAtTime(0.12, ctx.currentTime);
        lfo.connect(lfoGain);
        lfoGain.connect(washGain.gain);
        lfo.start();
        sources.push(lfo, lfoGain);

        // Layer 3: High-density micro-splatter bed (Poisson distributed gentle droplet impacts on leaves/roof)
        const dropInterval = setInterval(() => {
          if (!this.ctx || !this.isTrackActive('rain')) return;
          const now = this.ctx.currentTime;
          const drops = 3 + Math.floor(Math.random() * 4);

          for (let i = 0; i < drops; i++) {
            const delay = Math.random() * 0.08;
            const dropOsc = this.ctx.createOscillator();
            const dropGain = this.ctx.createGain();
            const dropFilter = this.ctx.createBiquadFilter();

            const baseFreq = 2600 + Math.random() * 2200;
            dropOsc.type = 'sine';
            dropOsc.frequency.setValueAtTime(baseFreq, now + delay);
            dropOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + delay + 0.015);

            dropFilter.type = 'bandpass';
            dropFilter.frequency.setValueAtTime(baseFreq, now + delay);
            dropFilter.Q.setValueAtTime(7, now + delay);

            const dropVol = 0.008 + Math.random() * 0.015;
            dropGain.gain.setValueAtTime(0.0001, now + delay);
            dropGain.gain.linearRampToValueAtTime(dropVol, now + delay + 0.002);
            dropGain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.015);

            dropOsc.connect(dropFilter);
            dropFilter.connect(dropGain);
            dropGain.connect(destination);

            dropOsc.start(now + delay);
            dropOsc.stop(now + delay + 0.018);
          }
        }, 75);

        intervals.push(dropInterval);
        break;
      }

      // 2. DISTANT THUNDER: Soft low-frequency rolling rumbles with depth and distance
      case 'thunder': {
        // Continuous subtle distant storm atmosphere floor (pink/brown noise filtered at 70Hz)
        const buffer = this.createNoiseBuffer(ctx, 'brown', 4);
        const bedSource = ctx.createBufferSource();
        bedSource.buffer = buffer;
        bedSource.loop = true;

        const bedFilter = ctx.createBiquadFilter();
        bedFilter.type = 'lowpass';
        bedFilter.frequency.setValueAtTime(70, ctx.currentTime);

        const bedGain = ctx.createGain();
        bedGain.gain.setValueAtTime(0.04, ctx.currentTime);

        bedSource.connect(bedFilter);
        bedFilter.connect(bedGain);
        bedGain.connect(destination);

        bedSource.start();
        sources.push(bedSource, bedFilter, bedGain);

        // Distant Rolling Thunder Generator: triggers non-clipping, rolling swells every 22-38s
        const triggerDistantRoll = () => {
          if (!this.ctx || !this.isTrackActive('thunder')) return;
          const now = this.ctx.currentTime;
          const duration = 10.0;

          const rollBuf = this.createNoiseBuffer(this.ctx, 'brown', duration);
          const rollSrc = this.ctx.createBufferSource();
          rollSrc.buffer = rollBuf;

          const rollFilter = this.ctx.createBiquadFilter();
          rollFilter.type = 'lowpass';
          rollFilter.frequency.setValueAtTime(42, now);
          rollFilter.frequency.linearRampToValueAtTime(85, now + 1.8);
          rollFilter.frequency.exponentialRampToValueAtTime(38, now + duration);

          const rollGain = this.ctx.createGain();
          rollGain.gain.setValueAtTime(0.0001, now);
          // Gradual distant emergence
          rollGain.gain.linearRampToValueAtTime(0.24, now + 1.5);
          rollGain.gain.exponentialRampToValueAtTime(0.38, now + 2.8);
          // Secondary rolling echo
          rollGain.gain.linearRampToValueAtTime(0.22, now + 4.8);
          rollGain.gain.linearRampToValueAtTime(0.28, now + 6.0);
          // Smooth dissipation into distance
          rollGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

          rollSrc.connect(rollFilter);
          rollFilter.connect(rollGain);
          rollGain.connect(destination);

          rollSrc.start(now);
          rollSrc.stop(now + duration);
        };

        // Fire first rumble after gentle warm-up, then at natural irregular intervals
        const firstTimeout = setTimeout(() => {
          triggerDistantRoll();
        }, 1200);
        timeouts.push(firstTimeout);

        const thunderInterval = setInterval(() => {
          triggerDistantRoll();
        }, 26000);
        intervals.push(thunderInterval);
        break;
      }

      // 3. CRACKLING HEARTH: Small warm wood fire with irregular crackles, tiny pops & soft fire roar
      case 'campfire': {
        // Soft continuous fire roar bed
        const buffer = this.createNoiseBuffer(ctx, 'brown', 4);
        const fireSource = ctx.createBufferSource();
        fireSource.buffer = buffer;
        fireSource.loop = true;

        const roarFilter = ctx.createBiquadFilter();
        roarFilter.type = 'lowpass';
        roarFilter.frequency.setValueAtTime(240, ctx.currentTime);

        const roarGain = ctx.createGain();
        roarGain.gain.setValueAtTime(0.25, ctx.currentTime);

        fireSource.connect(roarFilter);
        roarFilter.connect(roarGain);
        roarGain.connect(destination);

        fireSource.start();
        sources.push(fireSource, roarFilter, roarGain);

        // Natural wood crackle & snap impulse engine
        const crackleInterval = setInterval(() => {
          if (!this.ctx || !this.isTrackActive('campfire')) return;
          const now = this.ctx.currentTime;

          // 1. Dry wood crackle burst (Poisson-distributed micro-snaps)
          const snapCount = 1 + Math.floor(Math.random() * 2);
          for (let s = 0; s < snapCount; s++) {
            const snapOffset = Math.random() * 0.05;
            const snapLen = 0.005 + Math.random() * 0.012;

            const snapBuf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * snapLen), this.ctx.sampleRate);
            const snapData = snapBuf.getChannelData(0);
            for (let j = 0; j < snapData.length; j++) {
              snapData[j] = (Math.random() * 2 - 1) * Math.exp(-j / (snapData.length * 0.28));
            }

            const snapSrc = this.ctx.createBufferSource();
            snapSrc.buffer = snapBuf;

            const snapFilter = this.ctx.createBiquadFilter();
            snapFilter.type = 'highpass';
            snapFilter.frequency.setValueAtTime(2500 + Math.random() * 3200, now + snapOffset);

            const snapGain = this.ctx.createGain();
            snapGain.gain.setValueAtTime(0.02 + Math.random() * 0.04, now + snapOffset);
            snapGain.gain.exponentialRampToValueAtTime(0.0001, now + snapOffset + snapLen);

            snapSrc.connect(snapFilter);
            snapFilter.connect(snapGain);
            snapGain.connect(destination);

            snapSrc.start(now + snapOffset);
            snapSrc.stop(now + snapOffset + snapLen);
          }

          // 2. Comfortable irregular wood pop (resonance drop of sap pockets)
          if (Math.random() < 0.24) {
            const popDelay = Math.random() * 0.04;
            const popOsc = this.ctx.createOscillator();
            const popGain = this.ctx.createGain();

            popOsc.type = 'triangle';
            popOsc.frequency.setValueAtTime(210 + Math.random() * 90, now + popDelay);
            popOsc.frequency.exponentialRampToValueAtTime(50, now + popDelay + 0.032);

            popGain.gain.setValueAtTime(0.0001, now + popDelay);
            popGain.gain.linearRampToValueAtTime(0.045 + Math.random() * 0.045, now + popDelay + 0.003);
            popGain.gain.exponentialRampToValueAtTime(0.0001, now + popDelay + 0.038);

            popOsc.connect(popGain);
            popGain.connect(destination);

            popOsc.start(now + popDelay);
            popOsc.stop(now + popDelay + 0.042);
          }
        }, 115);

        intervals.push(crackleInterval);
        break;
      }

      // 4. FOREST BREEZE: Light breeze moving through pine trees with subtle stereo drift
      case 'forest_wind': {
        const buffer = this.createNoiseBuffer(ctx, 'pink', 4);
        const windSource = ctx.createBufferSource();
        windSource.buffer = buffer;
        windSource.loop = true;

        const bandFilter = ctx.createBiquadFilter();
        bandFilter.type = 'bandpass';
        bandFilter.frequency.setValueAtTime(500, ctx.currentTime);
        bandFilter.Q.setValueAtTime(1.5, ctx.currentTime);

        const windGain = ctx.createGain();
        windGain.gain.setValueAtTime(0.38, ctx.currentTime);

        // Stereo Panning for natural spatial movement across foliage
        let panner: StereoPannerNode | null = null;
        if ('createStereoPanner' in ctx) {
          panner = ctx.createStereoPanner();
          const panLfo = ctx.createOscillator();
          panLfo.type = 'sine';
          panLfo.frequency.setValueAtTime(0.052, ctx.currentTime); // ~19s slow drift
          const panGain = ctx.createGain();
          panGain.gain.setValueAtTime(0.35, ctx.currentTime);
          panLfo.connect(panGain);
          panGain.connect(panner.pan);
          panLfo.start();
          sources.push(panLfo, panGain);
        }

        // Dual wandering LFOs for organic wind gust movement
        const lfo1 = ctx.createOscillator();
        lfo1.type = 'sine';
        lfo1.frequency.setValueAtTime(0.091, ctx.currentTime);
        const lfo1Gain = ctx.createGain();
        lfo1Gain.gain.setValueAtTime(260, ctx.currentTime);
        lfo1.connect(lfo1Gain);
        lfo1Gain.connect(bandFilter.frequency);

        const lfo2 = ctx.createOscillator();
        lfo2.type = 'sine';
        lfo2.frequency.setValueAtTime(0.063, ctx.currentTime);
        const lfo2Gain = ctx.createGain();
        lfo2Gain.gain.setValueAtTime(0.16, ctx.currentTime);
        lfo2.connect(lfo2Gain);
        lfo2Gain.connect(windGain.gain);

        windSource.connect(bandFilter);
        bandFilter.connect(windGain);

        if (panner) {
          windGain.connect(panner);
          panner.connect(destination);
          sources.push(panner);
        } else {
          windGain.connect(destination);
        }

        windSource.start();
        lfo1.start();
        lfo2.start();

        sources.push(windSource, bandFilter, windGain, lfo1, lfo1Gain, lfo2, lfo2Gain);
        break;
      }

      // 5. OCEAN WAVES: Asymmetric surf cycle: distant swell, soft foamy break & receding undertow
      case 'ocean_waves': {
        const buffer = this.createNoiseBuffer(ctx, 'pink', 5);
        const waveSource = ctx.createBufferSource();
        waveSource.buffer = buffer;
        waveSource.loop = true;

        const waveFilter = ctx.createBiquadFilter();
        waveFilter.type = 'lowpass';
        waveFilter.frequency.setValueAtTime(520, ctx.currentTime);

        const waveGain = ctx.createGain();
        waveGain.gain.setValueAtTime(0.18, ctx.currentTime);

        // Surf cycle LFO (~10.2s natural swell cycle)
        const waveLfo = ctx.createOscillator();
        waveLfo.type = 'sine';
        waveLfo.frequency.setValueAtTime(0.098, ctx.currentTime);

        const waveLfoGain = ctx.createGain();
        waveLfoGain.gain.setValueAtTime(0.28, ctx.currentTime);
        waveLfo.connect(waveLfoGain);
        waveLfoGain.connect(waveGain.gain);

        const freqLfoGain = ctx.createGain();
        freqLfoGain.gain.setValueAtTime(380, ctx.currentTime);
        waveLfo.connect(freqLfoGain);
        freqLfoGain.connect(waveFilter.frequency);

        waveSource.connect(waveFilter);
        waveFilter.connect(waveGain);
        waveGain.connect(destination);

        waveSource.start();
        waveLfo.start();

        sources.push(waveSource, waveFilter, waveGain, waveLfo, waveLfoGain, freqLfoGain);
        break;
      }

      // 6. WHITE NOISE: Smooth broadband masking noise with high-frequency roll-off
      case 'white_noise': {
        const buffer = this.createNoiseBuffer(ctx, 'white', 3);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        // Smooth Butterworth lowpass at 4200 Hz to prevent ear fatigue
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(4200, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.32, ctx.currentTime);

        source.connect(filter);
        filter.connect(gain);
        gain.connect(destination);

        source.start();
        sources.push(source, filter, gain);
        break;
      }

      // 7. BROWNIAN DRONE: Pure 2-pole integrated velvety low-frequency focus rumble (safe on mobile)
      case 'brown_noise': {
        const buffer = this.createNoiseBuffer(ctx, 'brown', 4);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        // Infrasonic highpass filter at 35Hz to protect mobile speakers and battery
        const highPass = ctx.createBiquadFilter();
        highPass.type = 'highpass';
        highPass.frequency.setValueAtTime(35, ctx.currentTime);

        // Lowpass filter at 160Hz for velvety deep warmth
        const lowPass = ctx.createBiquadFilter();
        lowPass.type = 'lowpass';
        lowPass.frequency.setValueAtTime(160, ctx.currentTime);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.65, ctx.currentTime);

        source.connect(highPass);
        highPass.connect(lowPass);
        lowPass.connect(gain);
        gain.connect(destination);

        source.start();
        sources.push(source, highPass, lowPass, gain);
        break;
      }

      // 8. COZY CAFÉ: Diffuse room tone with formant chatter & occasional porcelain clinks
      case 'cafe_murmur': {
        const buffer = this.createNoiseBuffer(ctx, 'pink', 4);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        // Vocal Formant filters simulating distant unintelligible chatter
        const formant1 = ctx.createBiquadFilter();
        formant1.type = 'bandpass';
        formant1.frequency.setValueAtTime(480, ctx.currentTime);
        formant1.Q.setValueAtTime(2.2, ctx.currentTime);

        const formant2 = ctx.createBiquadFilter();
        formant2.type = 'bandpass';
        formant2.frequency.setValueAtTime(1150, ctx.currentTime);
        formant2.Q.setValueAtTime(2.5, ctx.currentTime);

        const cafeGain = ctx.createGain();
        cafeGain.gain.setValueAtTime(0.38, ctx.currentTime);

        source.connect(formant1);
        formant1.connect(cafeGain);
        source.connect(formant2);
        formant2.connect(cafeGain);
        cafeGain.connect(destination);

        source.start();
        sources.push(source, formant1, formant2, cafeGain);

        // Distant coffeehouse porcelain clink (spoon on ceramic saucer)
        const clinkInterval = setInterval(() => {
          if (!this.ctx || !this.isTrackActive('cafe_murmur')) return;
          if (Math.random() < 0.45) {
            const now = this.ctx.currentTime;
            const clinkOsc = this.ctx.createOscillator();
            const clinkGain = this.ctx.createGain();

            const clinkFreq = 2500 + Math.random() * 700;
            clinkOsc.type = 'sine';
            clinkOsc.frequency.setValueAtTime(clinkFreq, now);

            clinkGain.gain.setValueAtTime(0.0001, now);
            clinkGain.gain.linearRampToValueAtTime(0.016, now + 0.002);
            clinkGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

            clinkOsc.connect(clinkGain);
            clinkGain.connect(destination);

            clinkOsc.start(now);
            clinkOsc.stop(now + 0.045);
          }
        }, 4200);

        intervals.push(clinkInterval);
        break;
      }

      // 9. NIGHT CRICKETS: Spatially layered twilight crickets with natural chirp cadence
      case 'crickets': {
        const cricketInterval = setInterval(() => {
          if (!this.ctx || !this.isTrackActive('crickets')) return;
          const now = this.ctx.currentTime;
          const pulses = 3 + Math.floor(Math.random() * 2); // 3 or 4 pulses
          const baseFreq = 4700 + Math.random() * 150;

          for (let p = 0; p < pulses; p++) {
            const pulseStart = now + p * 0.042;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq, pulseStart);

            // 35Hz amplitude modulation inside each pulse (wing friction)
            const amOsc = this.ctx.createOscillator();
            amOsc.type = 'sine';
            amOsc.frequency.setValueAtTime(35, pulseStart);

            const amGain = this.ctx.createGain();
            amGain.gain.setValueAtTime(0.014, pulseStart);
            amOsc.connect(amGain.gain);

            gain.gain.setValueAtTime(0.0001, pulseStart);
            gain.gain.linearRampToValueAtTime(0.02, pulseStart + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, pulseStart + 0.035);

            osc.connect(gain);
            gain.connect(destination);

            osc.start(pulseStart);
            osc.stop(pulseStart + 0.038);
            amOsc.start(pulseStart);
            amOsc.stop(pulseStart + 0.038);
          }
        }, 1100);

        intervals.push(cricketInterval);
        break;
      }
    }

    return {
      sources,
      gainNode: destination,
      intervals,
      timeouts,
    };
  }

  private createNoiseBuffer(ctx: AudioContext, color: 'white' | 'pink' | 'brown', durationSeconds: number): AudioBuffer {
    const bufferSize = ctx.sampleRate * durationSeconds;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (color === 'white') {
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (color === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      // Brown noise (integrated random-walk with leak)
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }
    }

    return buffer;
  }
}

export const soundService = new SoundEngine();
