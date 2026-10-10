import { describe, expect, it } from "vitest";
import { formatSwissPhone, swissPhoneError } from "@/lib/swiss-phone";

describe("Swiss phone numbers", () => {
  it("formats a mobile number", () => {
    expect(formatSwissPhone("0791234567")).toBe("+41 79 123 45 67");
  });

  it("formats a fixed-line number", () => {
    expect(formatSwissPhone("0041 21 123 45 67")).toBe("+41 21 123 45 67");
  });

  it("rejects foreign and malformed numbers", () => {
    expect(swissPhoneError("+33 6 12 34 56 78")).not.toBeNull();
    expect(swissPhoneError("021 HELLO")).not.toBeNull();
  });
});
