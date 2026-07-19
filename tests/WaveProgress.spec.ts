import { describe, expect, it, vi } from "vitest";
import { WaveProgress } from "../src/app/ui/game/WaveProgress";

describe("WaveProgress", () => {
  it("starts at the first wave and notifies when the wave changes", () => {
    const progress = new WaveProgress();
    const listener = vi.fn();
    progress.subscribe(listener);

    progress.setTotal(10);
    progress.setCurrent(3);

    expect(progress.value).toEqual({ current: 3, total: 10 });
    expect(listener).toHaveBeenLastCalledWith({ current: 3, total: 10 });
  });

  it("keeps the current wave inside the available range", () => {
    const progress = new WaveProgress();
    progress.setTotal(2);

    progress.setCurrent(8);

    expect(progress.value).toEqual({ current: 2, total: 2 });
  });
});
