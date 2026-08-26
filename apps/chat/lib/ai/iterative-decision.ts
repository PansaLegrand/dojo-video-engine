import { sceneCommandsSchema } from "@motionforge/agent-tools";
import { z } from "zod";
import type { IterativeAgentTurnContext } from "../motionforge/iterative-agent";
import type { ChatMediaAssetManifestItem } from "../media/assets";
import { formatMediaAssetManifestForPrompt } from "../media/manifest";

const boundedMessage = z.string().trim().min(1).max(8_192);
const observationNodeTypeSchema = z.enum([
  "audio",
  "div",
  "effect",
  "extension",
  "img",
  "lottie",
  "shape",
  "text",
  "video",
]);
const observationSchema = z
  .discriminatedUnion("kind", [
    z
      .object({ kind: z.literal("node"), id: z.string().min(1).max(191) })
      .strict(),
    z
      .object({
        kind: z.literal("search"),
        query: z.string().trim().min(1).max(512).optional(),
        types: z.array(observationNodeTypeSchema).max(9).optional(),
        limit: z.number().int().min(1).max(200).optional(),
      })
      .strict(),
  ])
  .superRefine((value, ctx) => {
    if (
      value.kind === "search" &&
      value.query === undefined &&
      (value.types?.length ?? 0) === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Search observations need a query, node types, or both.",
      });
    }
  });

/**
 * One small planner decision, not a Scene response. The host executes command
 * decisions, observes checks/evidence, and calls the planner again when repair
 * is needed.
 */
export const iterativeAgentDecisionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("command"),
      commands: sceneCommandsSchema.max(32),
      reason: boundedMessage.optional(),
      summary: boundedMessage.optional(),
      requireRender: z.boolean().optional(),
      continueAfterSuccess: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("observe"),
      observation: observationSchema,
      reason: boundedMessage.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("finish"),
      summary: boundedMessage,
    })
    .strict(),
  z
    .object({
      kind: z.literal("fail"),
      message: boundedMessage,
      code: z.string().trim().min(1).max(128).optional(),
    })
    .strict(),
]);

export type IterativeAgentModelDecision = z.infer<
  typeof iterativeAgentDecisionSchema
>;

/**
 * Host authorization boundary for model-proposed asset.set commands. Uploaded
 * sources are rewritten from a manifest alias to the exact canonical tuple;
 * unknown ids or model-invented type/src values are rejected.
 */
export function authorizeIterativeAgentDecision(
  input: unknown,
  mediaAssets: ChatMediaAssetManifestItem[],
): IterativeAgentModelDecision {
  const decision = iterativeAgentDecisionSchema.parse(input);
  if (decision.kind !== "command") return decision;
  return {
    ...decision,
    commands: decision.commands.map((command) => {
      if (command.kind !== "asset.set") return command;
      const requestedCanonical = command.asset.id.trim().replace(/^@/, "");
      const canonicalMatches = mediaAssets.filter(
        (asset) =>
          asset.sceneAssetId === requestedCanonical ||
          asset.id === requestedCanonical,
      );
      const requestedAlias = normalizeAssetReference(command.asset.id);
      const matches =
        canonicalMatches.length > 0
          ? canonicalMatches
          : mediaAssets.filter((asset) =>
              [asset.label, asset.fileName, ...asset.aliases]
                .map(normalizeAssetReference)
                .includes(requestedAlias),
            );
      if (matches.length !== 1) {
        throw new Error(
          matches.length === 0
            ? `asset.set references an unauthorized uploaded asset ${JSON.stringify(command.asset.id)}.`
            : `asset.set reference ${JSON.stringify(command.asset.id)} is ambiguous.`,
        );
      }
      const asset = matches[0]!;
      if (
        command.asset.type !== asset.type ||
        command.asset.src !== asset.src
      ) {
        throw new Error(
          `asset.set must use the exact authorized type and src for ${JSON.stringify(asset.sceneAssetId)}.`,
        );
      }
      return {
        kind: "asset.set" as const,
        asset: {
          id: asset.sceneAssetId,
          type: asset.type,
          src: asset.src,
        },
      };
    }),
  };
}

function normalizeAssetReference(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, " ");
}

export function buildIterativeDecisionSystemPrompt(
  mediaAssets: ChatMediaAssetManifestItem[] = [],
): string {
  return `You are the planning component of an iterative MotionForge video editor.

The host has already loaded the latest user/UI Scene into a revisioned workspace. You never emit or replace a complete Scene. You receive a flat inspection of the current revision and return exactly one typed decision:
- command: apply the smallest non-recursive MotionForge command batch;
- observe: request one bounded exact-node read or flat search when the target is absent from a truncated inspection;
- finish: only when the requested edit is already complete and no failure remains;
- fail: only when the request cannot be represented safely.

The host will apply commands transactionally, run deterministic checks, optionally plan or render evidence, and call you again with failures for repair. Respect the exact node ids and revision in the observation. If inspection is truncated or the named target is absent, use observe before editing; never guess an id. Prefer scene.set, asset.set/remove, text.set, style.set, placement.set, resize.set, timing.set, media.trim, media.gain, node.add/remove/move/group, motion.preset, macro.insert, and layout.apply. Keep untouched nodes untouched. Never include a complete scene, raw patch ops, HTML, code, markdown, or commentary outside the decision object.

For a simple local edit, return one command decision and let the host finish after checks. For a complex request, set continueAfterSuccess only when another inspect/edit pass is genuinely required. Set requireRender for spatial, timing, animation, media, or visual-quality changes; text-only copy and gain-only changes normally need deterministic checks but not rendered proof.

Uploaded media are host-owned references. Use only ids and URLs present in this manifest. When a listed asset is not yet in the workspace, issue asset.set before node.add; never invent an id or URL.

Uploaded media manifest:
${formatMediaAssetManifestForPrompt(mediaAssets)}`;
}

export function buildIterativeDecisionPrompt(
  context: IterativeAgentTurnContext,
  recentHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
): string {
  const history = recentHistory.slice(-8).map((message) => ({
    role: message.role,
    content: message.content.slice(0, 4_096),
  }));
  return JSON.stringify(
    {
      task: context.instruction,
      workspace: {
        handle: context.handle,
        revision: context.revision,
        turn: context.turn,
        mode: context.mode,
      },
      inspection: context.inspection,
      ...(context.observation === undefined
        ? {}
        : { observation: context.observation }),
      ...(context.previousFailure === undefined
        ? {}
        : { previousFailure: context.previousFailure }),
      ...(context.previousEvidence === undefined
        ? {}
        : { previousEvidence: context.previousEvidence }),
      ...(history.length === 0 ? {} : { recentConversation: history }),
    },
    null,
    2,
  );
}
