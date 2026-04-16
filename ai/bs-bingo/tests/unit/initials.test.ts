import { describe, it, expect } from "vitest";
import { getInitials } from "../../src/lib/util/initials";

describe("getInitials", () => {
  it("returns first 2 chars uppercase for single-word name", () => {
    expect(getInitials("alice")).toBe("AL");
  });

  it("returns first char of first and last word for multi-word name", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
  });

  it("trims leading/trailing whitespace", () => {
    expect(getInitials("  bob ")).toBe("BO");
  });

  it("returns single char uppercase for single-char name", () => {
    expect(getInitials("X")).toBe("X");
  });

  it("uses first and last word initials for 3+ word names", () => {
    expect(getInitials("John Paul Jones")).toBe("JJ");
  });

  it("handles all-caps input", () => {
    expect(getInitials("ALICE")).toBe("AL");
  });

  it("handles two-word names", () => {
    expect(getInitials("Bob Smith")).toBe("BS");
  });
});
