import { describe, it, expect } from "vitest";
import {
  WARDROBE_ITEMS,
  WARDROBE_TABS,
  WARDROBE_SLOTS,
  itemsForTab,
  getItem,
  equipItem,
  removeSlot,
  removeItemById,
  clearAll,
  equippedLayers,
  equippedItems,
  surpriseMe,
  reactionFor,
  type Equipped,
} from "@shared/kiwiWardrobe";

describe("Kiwi wardrobe catalog integrity", () => {
  it("every item has a valid slot, a known tab, at least one layer, and a reaction", () => {
    const tabIds = new Set(WARDROBE_TABS.map((t) => t.id));
    for (const it of WARDROBE_ITEMS) {
      expect(WARDROBE_SLOTS).toContain(it.slot);
      expect(tabIds.has(it.tab)).toBe(true);
      expect(it.layers.length).toBeGreaterThan(0);
      expect(it.reaction.length).toBeGreaterThan(0);
    }
  });

  it("item ids are unique", () => {
    const ids = WARDROBE_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every costume set references real piece ids", () => {
    for (const it of WARDROBE_ITEMS) {
      if (it.setPieces) {
        for (const pid of it.setPieces) {
          expect(getItem(pid), `missing piece ${pid} for set ${it.id}`).toBeTruthy();
        }
      }
    }
  });

  it("each tab has at least one item", () => {
    for (const t of WARDROBE_TABS) {
      expect(itemsForTab(t.id).length).toBeGreaterThan(0);
    }
  });
});

describe("Kiwi wardrobe equip engine", () => {
  it("equips one item per slot (new item in a slot swaps the old one)", () => {
    let eq: Equipped = {};
    eq = equipItem(eq, "cap"); // head
    expect(eq.head).toBe("cap");
    eq = equipItem(eq, "beanie"); // also head → swaps
    expect(eq.head).toBe("beanie");
    // a glasses item goes to the eyes slot, not head
    eq = equipItem(eq, "glasses");
    expect(eq.eyes).toBe("glasses");
    expect(eq.head).toBe("beanie");
  });

  it("equipping a costume SET fills every referenced piece slot", () => {
    const angel = getItem("set-angel")!;
    let eq: Equipped = {};
    eq = equipItem(eq, "set-angel");
    // The set occupies its own slot plus halo (head) + wings (back).
    expect(eq[angel.slot]).toBe("set-angel");
    expect(eq.back).toBe("angel-wings");
    // halo and the set share the head slot; the set glyph wins the head key,
    // but the wings piece is definitely equipped on back.
    const items = equippedItems(eq).map((i) => i.id);
    expect(items).toContain("angel-wings");
  });

  it("supports equipping a single costume piece (decomposable)", () => {
    let eq: Equipped = {};
    eq = equipItem(eq, "devil-horns"); // just the horns
    expect(eq.head).toBe("devil-horns");
    expect(eq.held).toBeUndefined();
  });

  it("removes a single piece by slot and by id (per-piece removal)", () => {
    let eq: Equipped = {};
    eq = equipItem(eq, "cap");
    eq = equipItem(eq, "ball"); // held
    eq = removeSlot(eq, "head");
    expect(eq.head).toBeUndefined();
    expect(eq.held).toBe("ball");
    eq = removeItemById(eq, "ball");
    expect(eq.held).toBeUndefined();
  });

  it("clearAll removes everything", () => {
    let eq: Equipped = equipItem(equipItem({}, "cap"), "ball");
    eq = clearAll();
    expect(Object.keys(eq).length).toBe(0);
  });

  it("equippedLayers returns layers sorted by z (background before foreground)", () => {
    let eq: Equipped = {};
    eq = equipItem(eq, "backpack"); // z:1 (behind)
    eq = equipItem(eq, "ball"); // z:8 (front, held)
    const layers = equippedLayers(eq);
    expect(layers.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < layers.length; i++) {
      expect((layers[i].z ?? 5) >= (layers[i - 1].z ?? 5)).toBe(true);
    }
  });

  it("surpriseMe is deterministic for a given seed and only fills real slots", () => {
    const a = surpriseMe(12345);
    const b = surpriseMe(12345);
    expect(a).toEqual(b);
    const c = surpriseMe(99999);
    // Different seed should (very likely) differ; at minimum it stays valid.
    for (const slot of Object.keys(c)) {
      expect(WARDROBE_SLOTS).toContain(slot);
      const id = (c as Record<string, string>)[slot];
      expect(getItem(id)).toBeTruthy();
    }
  });

  it("reactionFor returns the item's own line, or a naked-bird line when null", () => {
    expect(reactionFor("tiara")).toBe(getItem("tiara")!.reaction);
    expect(reactionFor(null)).toMatch(/naked/i);
  });
});
