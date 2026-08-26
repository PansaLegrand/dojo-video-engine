import { describe, expect, it } from "vitest";
import { assistantResponseRevisionAction } from "./agent-revision";

describe("agent/UI revision coordination", () => {
  it("applies matching responses, retries newer Scenes once, and discards stale work", () => {
    expect(
      assistantResponseRevisionAction({
        requestedRevision: 4,
        currentRevision: 4,
        requestedEpoch: 2,
        currentEpoch: 2,
        retryCount: 0,
        hasCurrentScene: true,
      }),
    ).toBe("apply");
    expect(
      assistantResponseRevisionAction({
        requestedRevision: 4,
        currentRevision: 5,
        requestedEpoch: 2,
        currentEpoch: 2,
        retryCount: 0,
        hasCurrentScene: true,
      }),
    ).toBe("retry");
    expect(
      assistantResponseRevisionAction({
        requestedRevision: 4,
        currentRevision: 6,
        requestedEpoch: 2,
        currentEpoch: 2,
        retryCount: 1,
        hasCurrentScene: true,
      }),
    ).toBe("discard");
    expect(
      assistantResponseRevisionAction({
        requestedRevision: 4,
        currentRevision: 5,
        requestedEpoch: 2,
        currentEpoch: 2,
        retryCount: 0,
        hasCurrentScene: false,
      }),
    ).toBe("discard");
    expect(
      assistantResponseRevisionAction({
        requestedRevision: 4,
        currentRevision: 5,
        requestedEpoch: 2,
        currentEpoch: 3,
        retryCount: 0,
        hasCurrentScene: true,
      }),
    ).toBe("discard");
  });
});
