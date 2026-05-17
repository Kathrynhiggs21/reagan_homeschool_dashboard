import { describe, it, expect } from "vitest";
import {
  sanitizeClassFolderName,
  planClassroomDrivePath,
  planAllLifecycleSubfolders,
  planClassroomDriveMove,
  LIFECYCLE_FOLDER_NAME,
  LIFECYCLE_ORDER,
} from "./_lib/classroomDrivePathPlanner";

describe("classroomDrivePathPlanner", () => {
  describe("sanitizeClassFolderName", () => {
    it("trims and collapses whitespace", () => {
      expect(sanitizeClassFolderName("   Math   5  ")).toBe("Math 5");
    });

    it("strips slashes so no path injection happens", () => {
      // Forward AND back slashes must be neutralized so a course called
      // "Science / Lab" doesn't accidentally create a "Lab" subfolder
      // outside the class folder.
      expect(sanitizeClassFolderName("Science / Lab")).toBe("Science - Lab");
      expect(sanitizeClassFolderName("Foo\\Bar")).toBe("Foo-Bar");
    });

    it("strips control characters", () => {
      expect(sanitizeClassFolderName("Math\u0007Five")).toBe("MathFive");
    });

    it("returns null for empty / whitespace-only / non-string input", () => {
      expect(sanitizeClassFolderName("")).toBeNull();
      expect(sanitizeClassFolderName("   ")).toBeNull();
      expect(sanitizeClassFolderName(null)).toBeNull();
      expect(sanitizeClassFolderName(undefined)).toBeNull();
      // Tab + space only -> null
      expect(sanitizeClassFolderName("\t \t")).toBeNull();
    });

    it("caps at 80 chars and re-trims", () => {
      const long = "A".repeat(120);
      const result = sanitizeClassFolderName(long);
      expect(result).not.toBeNull();
      expect(result!.length).toBe(80);
    });
  });

  describe("planClassroomDrivePath", () => {
    it("plans a single lifecycle path", () => {
      const plan = planClassroomDrivePath("Math 5", "in_progress");
      expect(plan).not.toBeNull();
      expect(plan!.classFolderName).toBe("Math 5");
      expect(plan!.pathSegments).toEqual(["Classes", "Math 5", "In Progress"]);
      expect(plan!.fullPath).toBe("Classes/Math 5/In Progress");
    });

    it("uses the canonical English label for each lifecycle state", () => {
      // Guard rails: if anyone renames the buckets in the planner, this
      // test fails before we ship it to Drive.
      expect(LIFECYCLE_FOLDER_NAME.to_do).toBe("To Do");
      expect(LIFECYCLE_FOLDER_NAME.in_progress).toBe("In Progress");
      expect(LIFECYCLE_FOLDER_NAME.turned_in).toBe("Turned In");
      expect(LIFECYCLE_FOLDER_NAME.graded).toBe("Graded");
    });

    it("returns null when the course name is empty after sanitization", () => {
      expect(planClassroomDrivePath("   ", "to_do")).toBeNull();
      expect(planClassroomDrivePath(null, "graded")).toBeNull();
    });
  });

  describe("planAllLifecycleSubfolders", () => {
    it("returns four plans in the canonical lifecycle order", () => {
      const plans = planAllLifecycleSubfolders("ELA Reading");
      expect(plans).not.toBeNull();
      expect(plans!).toHaveLength(4);
      expect(plans!.map((p) => p.fullPath)).toEqual([
        "Classes/ELA Reading/To Do",
        "Classes/ELA Reading/In Progress",
        "Classes/ELA Reading/Turned In",
        "Classes/ELA Reading/Graded",
      ]);
      // Order must match LIFECYCLE_ORDER so drive provisioning, UI columns,
      // and DB enum stay aligned.
      expect(LIFECYCLE_ORDER).toEqual(["to_do", "in_progress", "turned_in", "graded"]);
    });

    it("returns null for an empty course name", () => {
      expect(planAllLifecycleSubfolders("")).toBeNull();
    });
  });

  describe("planClassroomDriveMove", () => {
    it("plans a real lifecycle move (in_progress -> turned_in)", () => {
      const move = planClassroomDriveMove("Social Studies", "in_progress", "turned_in");
      expect(move).not.toBeNull();
      expect(move!.from.fullPath).toBe("Classes/Social Studies/In Progress");
      expect(move!.to.fullPath).toBe("Classes/Social Studies/Turned In");
      expect(move!.isNoop).toBe(false);
      // The class folder name is identical on both ends — only the
      // lifecycle subfolder differs.
      expect(move!.from.classFolderName).toBe(move!.to.classFolderName);
    });

    it("flags a same-state move as a no-op (idempotency contract)", () => {
      const move = planClassroomDriveMove("Math 5", "graded", "graded");
      expect(move).not.toBeNull();
      expect(move!.isNoop).toBe(true);
      expect(move!.from.fullPath).toBe(move!.to.fullPath);
    });

    it("returns null when the course name is unusable", () => {
      expect(planClassroomDriveMove("", "to_do", "in_progress")).toBeNull();
    });
  });
});
