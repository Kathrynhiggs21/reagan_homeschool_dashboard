import { describe, it, expect } from "vitest";
import {
  parseStartTime,
  parseTimeBudget,
  parseBudgetAndStart,
  layoutInsertedBlocks,
} from "./_lib/agendaBudget";

describe("parseStartTime", () => {
  it("parses 'start at 1pm' as 13:00", () => {
    expect(parseStartTime("start at 1pm").startTime).toBe("13:00");
  });

  it("parses 'today starts at 1' as 13:00 (school afternoon default)", () => {
    expect(parseStartTime("today starts at 1").startTime).toBe("13:00");
  });

  it("parses 'tomorrow at 10' as 10:00 (morning default)", () => {
    expect(parseStartTime("tomorrow at 10am").startTime).toBe("10:00");
  });

  it("parses 'begin 9:30' as 09:30", () => {
    expect(parseStartTime("begin 9:30").startTime).toBe("09:30");
  });

  it("parses 'start at 10' as 10:00 (morning, no pm bump)", () => {
    expect(parseStartTime("start at 10").startTime).toBe("10:00");
  });

  it("returns null when no start is present", () => {
    expect(parseStartTime("make it shorter and fun").startTime).toBeNull();
  });

  it("does not grab 'worksheet at the end' as a time", () => {
    expect(parseStartTime("add a worksheet at the end").startTime).toBeNull();
  });
});

describe("parseTimeBudget", () => {
  it("parses '2-4 hours' as 120..240", () => {
    const b = parseTimeBudget("2-4 hours total");
    expect(b.minMinutes).toBe(120);
    expect(b.maxMinutes).toBe(240);
  });

  it("parses '2 to 4 hrs'", () => {
    const b = parseTimeBudget("about 2 to 4 hrs");
    expect(b.minMinutes).toBe(120);
    expect(b.maxMinutes).toBe(240);
  });

  it("parses en-dash '2–4 hour'", () => {
    const b = parseTimeBudget("2–4 hour day");
    expect(b.minMinutes).toBe(120);
    expect(b.maxMinutes).toBe(240);
  });

  it("parses single '3 hours'", () => {
    const b = parseTimeBudget("3 hours total");
    expect(b.minMinutes).toBe(180);
    expect(b.maxMinutes).toBe(180);
  });

  it("parses '90 minutes'", () => {
    const b = parseTimeBudget("90 minutes");
    expect(b.minMinutes).toBe(90);
    expect(b.maxMinutes).toBe(90);
  });

  it("parses 'hour and a half' as 90", () => {
    const b = parseTimeBudget("an hour and a half");
    expect(b.minMinutes).toBe(90);
    expect(b.maxMinutes).toBe(90);
  });

  it("treats 'no more than 3 hours' as a max-only cap", () => {
    const b = parseTimeBudget("no more than 3 hours");
    expect(b.minMinutes).toBeNull();
    expect(b.maxMinutes).toBe(180);
  });

  it("returns nulls when no budget present", () => {
    const b = parseTimeBudget("add a math block");
    expect(b.minMinutes).toBeNull();
    expect(b.maxMinutes).toBeNull();
  });
});

describe("parseBudgetAndStart combined", () => {
  it("parses Katy's today prompt", () => {
    const p = parseBudgetAndStart(
      "today starts at 1, 2-4 hours total, measurement types, conversions, metric info, worksheet, then a fun duck activity",
    );
    expect(p.startTime).toBe("13:00");
    expect(p.minMinutes).toBe(120);
    expect(p.maxMinutes).toBe(240);
    expect(p.targetMinutes).toBe(180);
  });

  it("parses tomorrow prompt", () => {
    const p = parseBudgetAndStart("tomorrow at 10am, 2-4 hrs, volume and start haiku");
    expect(p.startTime).toBe("10:00");
    expect(p.targetMinutes).toBe(180);
  });
});

describe("layoutInsertedBlocks", () => {
  it("scales an over-budget set down into the window and lays times forward", () => {
    const blocks = [
      { ref: 1, durationMin: 60 },
      { ref: 2, durationMin: 60 },
      { ref: 3, durationMin: 60 },
      { ref: 4, durationMin: 60 },
      { ref: 5, durationMin: 60 }, // total 300
    ];
    const out = layoutInsertedBlocks(blocks, {
      startTime: "13:00",
      minMinutes: 120,
      maxMinutes: 240,
    });
    const total = out.reduce((s, b) => s + b.durationMin, 0);
    expect(total).toBeLessThanOrEqual(240);
    expect(total).toBeGreaterThanOrEqual(120);
    expect(out[0].startTime).toBe("13:00");
    // Second block starts after the first
    expect(out[1].startTime).toBe(addMin("13:00", out[0].durationMin));
  });

  it("scales an under-budget set up to the minimum", () => {
    const blocks = [
      { ref: 1, durationMin: 20 },
      { ref: 2, durationMin: 20 }, // total 40, below 120 min
    ];
    const out = layoutInsertedBlocks(blocks, {
      startTime: "13:00",
      minMinutes: 120,
      maxMinutes: 240,
    });
    const total = out.reduce((s, b) => s + b.durationMin, 0);
    expect(total).toBeGreaterThanOrEqual(120);
  });

  it("leaves total alone when already inside the window", () => {
    const blocks = [
      { ref: 1, durationMin: 60 },
      { ref: 2, durationMin: 60 },
      { ref: 3, durationMin: 60 }, // total 180, inside 120..240
    ];
    const out = layoutInsertedBlocks(blocks, {
      startTime: "13:00",
      minMinutes: 120,
      maxMinutes: 240,
    });
    const total = out.reduce((s, b) => s + b.durationMin, 0);
    expect(total).toBe(180);
  });

  it("flows around a fixed appointment block", () => {
    const blocks = [
      { ref: 1, durationMin: 60 },
      { ref: 99, durationMin: 30, fixed: true, startTime: "14:00" },
      { ref: 2, durationMin: 60 },
    ];
    const out = layoutInsertedBlocks(blocks, {
      startTime: "13:00",
      minMinutes: null,
      maxMinutes: null,
    });
    const b1 = out.find((b) => b.ref === 1)!;
    const b2 = out.find((b) => b.ref === 2)!;
    const fixed = out.find((b) => b.ref === 99)!;
    expect(b1.startTime).toBe("13:00");
    expect(fixed.startTime).toBe("14:00"); // unchanged
    // b2 must not overlap the fixed 14:00-14:30 window
    expect(toMin(b2.startTime!)).toBeGreaterThanOrEqual(toMin("14:30"));
  });

  it("leaves start times null when there is no anchor", () => {
    const out = layoutInsertedBlocks([{ ref: 1, durationMin: 30 }], {
      startTime: null,
      minMinutes: null,
      maxMinutes: null,
    });
    expect(out[0].startTime).toBeNull();
  });
});

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}
function addMin(hhmm: string, mins: number): string {
  const t = toMin(hhmm) + mins;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}


import { applyBudgetLayout } from "./_lib/aiScheduleGenerator";

describe("applyBudgetLayout (generator post-pass)", () => {
  const mk = (blockType: string, durationMin: number, startTime?: string) =>
    ({ blockType, title: "t", description: "d", durationMin, startTime, subjectSlug: null, curriculumTopicCode: null } as any);

  it("is a no-op when no anchor and no budget", () => {
    const blocks = [mk("math", 30), mk("choice", 45)];
    const out = applyBudgetLayout(blocks, { startTime: null, minMinutes: null, maxMinutes: null });
    expect(out).toEqual(blocks);
  });

  it("anchors start times forward from 13:00", () => {
    const blocks = [mk("morning_warmup", 30), mk("math", 45), mk("choice", 30)];
    const out = applyBudgetLayout(blocks, { startTime: "13:00", minMinutes: null, maxMinutes: null });
    expect(out[0].startTime).toBe("13:00");
    expect(out[1].startTime).toBe("13:30");
    expect(out[2].startTime).toBe(addMin2(out[1].startTime!, out[1].durationMin));
  });

  it("scales an over-budget day down into the 2-4h window", () => {
    const blocks = [mk("math", 90), mk("choice", 90), mk("read_aloud", 90), mk("custom", 90)]; // 360
    const out = applyBudgetLayout(blocks, { startTime: "13:00", minMinutes: 120, maxMinutes: 240 });
    const total = out.reduce((s, b) => s + b.durationMin, 0);
    expect(total).toBeLessThanOrEqual(240);
    expect(total).toBeGreaterThanOrEqual(120);
  });

  it("never exceeds the 300-min day ceiling even if budget asks for more", () => {
    const blocks = [mk("math", 60), mk("choice", 60), mk("read_aloud", 60)]; // 180
    const out = applyBudgetLayout(blocks, { startTime: "10:00", minMinutes: 360, maxMinutes: 360 });
    const total = out.reduce((s, b) => s + b.durationMin, 0);
    expect(total).toBeLessThanOrEqual(300);
  });

  it("keeps an appointment block's own time and flows around it", () => {
    const blocks = [mk("math", 60), mk("appointment", 30, "14:00"), mk("choice", 60)];
    const out = applyBudgetLayout(blocks, { startTime: "13:00", minMinutes: null, maxMinutes: null });
    expect(out[1].startTime).toBe("14:00");
    expect(toMin2(out[2].startTime!)).toBeGreaterThanOrEqual(toMin2("14:30"));
  });
});

function toMin2(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}
function addMin2(hhmm: string, mins: number): string {
  const t = toMin2(hhmm) + mins;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
