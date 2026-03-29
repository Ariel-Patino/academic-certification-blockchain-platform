import { describe, expect, it } from "vitest";

import { computeRecipientIdentityMatch, hashRecipientEmailWithSalt } from "./verification.service";

describe("verification.service recipient identity checks", () => {
  it("returns true when recipientEmail and salted identity match", () => {
    const recipientEmail = "student@example.edu";
    const salt = "abc123salt";
    const identity = hashRecipientEmailWithSalt(recipientEmail, salt);

    const result = computeRecipientIdentityMatch(recipientEmail, salt, identity);

    expect(result).toBe(true);
  });

  it("returns false when recipientEmail does not match the salted identity", () => {
    const salt = "abc123salt";
    const identity = hashRecipientEmailWithSalt("student@example.edu", salt);

    const result = computeRecipientIdentityMatch("other@example.edu", salt, identity);

    expect(result).toBe(false);
  });

  it("returns null when optional recipient fields are not provided", () => {
    const result = computeRecipientIdentityMatch(null, null, null);

    expect(result).toBeNull();
  });
});
