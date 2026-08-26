export type AssistantResponseRevisionAction = "apply" | "retry" | "discard";

/** Prevent an in-flight agent response from overwriting newer manual edits. */
export function assistantResponseRevisionAction(options: {
  requestedRevision: number;
  currentRevision: number;
  requestedEpoch: number;
  currentEpoch: number;
  retryCount: number;
  maxRetries?: number;
  hasCurrentScene: boolean;
}): AssistantResponseRevisionAction {
  const maxRetries = options.maxRetries ?? 1;
  if (
    !Number.isSafeInteger(options.requestedRevision) ||
    options.requestedRevision < 0 ||
    !Number.isSafeInteger(options.currentRevision) ||
    options.currentRevision < 0 ||
    !Number.isSafeInteger(options.requestedEpoch) ||
    options.requestedEpoch < 0 ||
    !Number.isSafeInteger(options.currentEpoch) ||
    options.currentEpoch < 0 ||
    !Number.isSafeInteger(options.retryCount) ||
    options.retryCount < 0 ||
    !Number.isSafeInteger(maxRetries) ||
    maxRetries < 0 ||
    maxRetries > 8
  ) {
    throw new RangeError("Assistant response revisions/retries are invalid.");
  }
  if (options.currentEpoch !== options.requestedEpoch) return "discard";
  if (options.currentRevision === options.requestedRevision) return "apply";
  return options.hasCurrentScene && options.retryCount < maxRetries
    ? "retry"
    : "discard";
}
