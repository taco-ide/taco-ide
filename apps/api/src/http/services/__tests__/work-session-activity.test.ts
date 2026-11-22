import { describe, it, expect } from "vitest";
import {
  deriveWorkSessionStatus,
  inactivityCutoff,
  inactivityThresholdMs,
} from "../work-session-activity";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-11-22T12:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("deriveWorkSessionStatus", () => {
  it("defaults the threshold to 24 hours", () => {
    expect(inactivityThresholdMs()).toBe(24 * HOUR);
    expect(inactivityCutoff(now).toISOString()).toBe("2026-11-21T12:00:00.000Z");
  });

  it("is active when the last activity is within the threshold", () => {
    expect(
      deriveWorkSessionStatus({ endedAt: null, lastActivityAt: ago(HOUR) }, now, 24 * HOUR)
    ).toBe("active");
  });

  it("is inactive once the threshold has fully elapsed", () => {
    expect(
      deriveWorkSessionStatus({ endedAt: null, lastActivityAt: ago(24 * HOUR) }, now, 24 * HOUR)
    ).toBe("inactive");
    expect(
      deriveWorkSessionStatus({ endedAt: null, lastActivityAt: ago(24 * HOUR - 1) }, now, 24 * HOUR)
    ).toBe("active");
  });

  it("is submitted whenever endedAt is set, however old the activity", () => {
    expect(
      deriveWorkSessionStatus(
        { endedAt: ago(HOUR), lastActivityAt: ago(30 * 24 * HOUR) },
        now,
        24 * HOUR
      )
    ).toBe("submitted");
  });

  it("honours a custom threshold", () => {
    expect(
      deriveWorkSessionStatus({ endedAt: null, lastActivityAt: ago(2 * HOUR) }, now, HOUR)
    ).toBe("inactive");
  });
});
