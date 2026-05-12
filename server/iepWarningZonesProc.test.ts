import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

const ctx: any = { user: null };

describe("iep router exposes warningZones / crisisProtocol / whatWorksMatrix as public procedures", () => {
  it("warningZones returns 4 zones in canonical order", async () => {
    const caller = appRouter.createCaller(ctx);
    const zones = await caller.iep.warningZones();
    expect(zones.map((z: any) => z.zone)).toEqual(["green", "yellow", "red", "black"]);
  });

  it("crisisProtocol returns 3 ordered steps", async () => {
    const caller = appRouter.createCaller(ctx);
    const steps = await caller.iep.crisisProtocol();
    expect(steps).toHaveLength(3);
    expect(steps[2].actions.join(" ")).toContain("513-926-5808");
  });

  it("whatWorksMatrix returns the 6-situation matrix", async () => {
    const caller = appRouter.createCaller(ctx);
    const m = await caller.iep.whatWorksMatrix();
    expect(m.length).toBe(6);
    const writing = m.find((r: any) => r.situation === "writing_tasks");
    expect(writing).toBeTruthy();
    expect(writing.doesWork).toContain("Verbal first");
  });
});
