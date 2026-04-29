import { describe, it, expect } from "vitest";
import { createPrize, updatePrize, deletePrize, listPrizes } from "./db";

describe("prize CRUD (Mom-editable rewards)", () => {
  it("creates, updates and deletes a prize end-to-end", async () => {
    const created: any = await createPrize({
      title: `__crud_test_${Date.now()}`,
      emoji: "🧪",
      description: "vitest fixture",
      coinCost: 42,
      category: "experience",
      active: true,
    });
    expect(created?.id).toBeGreaterThan(0);
    expect(created.coinCost).toBe(42);

    await updatePrize(created.id, { coinCost: 99, active: false });
    const all: any[] = await listPrizes(false);
    const found = all.find((p) => p.id === created.id);
    expect(found?.coinCost).toBe(99);
    expect(found?.active).toBe(false);

    // active-only filter should hide it
    const activeOnly: any[] = await listPrizes(true);
    expect(activeOnly.find((p) => p.id === created.id)).toBeUndefined();

    await deletePrize(created.id);
    const after: any[] = await listPrizes(false);
    expect(after.find((p) => p.id === created.id)).toBeUndefined();
  });

  it("clamps coinCost to >= 0", async () => {
    const created: any = await createPrize({
      title: `__crud_clamp_${Date.now()}`,
      emoji: "⚠️",
      coinCost: -5,
      category: "custom",
    });
    expect(created.coinCost).toBe(0);
    await deletePrize(created.id);
  });
});
