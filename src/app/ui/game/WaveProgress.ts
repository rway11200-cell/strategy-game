export interface WaveProgressState {
  current: number;
  total: number;
}

type WaveProgressListener = (state: WaveProgressState) => void;

export class WaveProgress {
  private state: WaveProgressState = { current: 0, total: 0 };
  private listeners = new Set<WaveProgressListener>();

  setTotal(total: number): void {
    const normalizedTotal = Math.max(0, Math.floor(total));
    this.state = {
      current: normalizedTotal > 0 ? 1 : 0,
      total: normalizedTotal,
    };
    this.emit();
  }

  setCurrent(current: number): void {
    const normalizedCurrent = Math.max(0, Math.min(Math.floor(current), this.state.total));
    if (normalizedCurrent === this.state.current) return;

    this.state = { ...this.state, current: normalizedCurrent };
    this.emit();
  }

  subscribe(listener: WaveProgressListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  get value(): WaveProgressState {
    return { ...this.state };
  }

  private emit(): void {
    const state = this.value;
    this.listeners.forEach((listener) => listener(state));
  }
}

export const waveProgress = new WaveProgress();
