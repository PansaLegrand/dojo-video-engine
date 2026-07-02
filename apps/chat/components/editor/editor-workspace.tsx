import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileAudio,
  FileVideo,
  GripHorizontal,
  Image as ImageIcon,
  Info,
  Layers,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Scissors,
  Send,
  Sparkles,
  type LucideIcon,
  Trash2,
  Upload,
} from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { Scene } from "@motionforge/schema";
import {
  describeExportReadiness,
  describePreviewOverlay,
} from "@/lib/editor/capability-messages";
import type { InspectorEditableField } from "@/lib/editor/inspector-patches";
import {
  collectEditorLayerDescendantIds,
  displayLayerType,
  type EditorLayer,
} from "@/lib/editor/layers";
import {
  describeTimelineMediaLayer,
  type TimelineMediaInfo,
} from "@/lib/editor/timeline-media";
import {
  describeLocalMediaAssetReadiness,
  formatFileSize,
  formatMediaDuration,
  isLocalMediaAssetUsed,
  type LocalMediaAsset,
} from "@/lib/media/assets";
import { mediaMentionToken } from "@/lib/media/mentions";
import {
  describeMediaPlanStep,
  type MediaOperationPlan,
  type MediaOperationPlanStep,
} from "@/lib/media/plan";
import {
  createPreviewSelectionOverlay,
  movePreviewLayerBoundsFromDrag,
  resizePreviewLayerBoundsFromDrag,
  type PreviewCanvasRect,
  type PreviewLayerBounds,
  type PreviewLayerMove,
  type PreviewLayerResizeHandle,
} from "@/lib/editor/preview-selection";
import {
  formatFrameTime,
  formatSeconds,
  frameFromTimelinePoint,
  retimeLayerFromTimelineDrag,
  resizeLayerDurationFromTimelineDrag,
} from "@/lib/editor/time";
import { cn } from "@/lib/ui/cn";
import type { ChatMessage, EditorPanel, PlayerUiState } from "./types";

export function ToolRail({
  activePanel,
  onPanelChange,
}: {
  activePanel: EditorPanel;
  onPanelChange: (panel: EditorPanel) => void;
}) {
  const items: Array<{ id: EditorPanel; label: string; icon: LucideIcon }> = [
    { id: "chat", label: "Assistant", icon: MessageSquare },
    { id: "assets", label: "Assets", icon: ImageIcon },
    { id: "layers", label: "Layers", icon: Layers },
    { id: "inspector", label: "Inspector", icon: Info },
  ];

  return (
    <nav className="col-span-full flex min-h-0 shrink-0 items-center border-b border-border bg-[hsl(220_18%_12%)] px-2 py-1 text-white lg:col-span-1 lg:row-span-full lg:flex-col lg:border-b-0 lg:border-r lg:px-0 lg:py-2">
      <div className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-[hsl(186_80%_72%)] lg:mb-3 lg:mr-0 lg:h-9 lg:w-9">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="flex flex-1 items-center gap-1 lg:flex-col">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPanelChange(item.id)}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md text-white/62 transition lg:h-10 lg:w-10",
              activePanel === item.id
                ? "bg-white text-[hsl(220_18%_12%)]"
                : "hover:bg-white/10 hover:text-white",
            )}
            title={item.label}
          >
            <item.icon className="h-4.5 w-4.5" />
          </button>
        ))}
      </div>
    </nav>
  );
}

export function PanelSwitcher({
  activePanel,
  messages,
  messagesScrollerRef,
  textareaRef,
  input,
  isSending,
  scene,
  mediaAssets,
  durationLabel,
  editorLayers,
  selectedLayer,
  selectedLayerId,
  fps,
  onInputChange,
  onSubmitPrompt,
  onShowExamples,
  onNewSession,
  onAddMediaFiles,
  onInsertMediaAsset,
  onRemoveMediaAsset,
  onSelectLayer,
  onDeleteLayer,
  onSelectPlanStep,
  onEditLayer,
}: {
  activePanel: EditorPanel;
  messages: ChatMessage[];
  messagesScrollerRef: RefObject<HTMLDivElement>;
  textareaRef: RefObject<HTMLTextAreaElement>;
  input: string;
  isSending: boolean;
  scene: Scene | null;
  mediaAssets: LocalMediaAsset[];
  durationLabel: string;
  editorLayers: EditorLayer[];
  selectedLayer: EditorLayer | null;
  selectedLayerId: string | null;
  fps: number;
  onInputChange: (value: string) => void;
  onSubmitPrompt: (value?: string) => Promise<void>;
  onShowExamples: () => void;
  onNewSession: () => void;
  onAddMediaFiles: (files: File[]) => void;
  onInsertMediaAsset: (id: string) => void;
  onRemoveMediaAsset: (id: string) => void;
  onSelectLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onSelectPlanStep: (id: string) => void;
  onEditLayer: (
    id: string,
    field: InspectorEditableField,
    value: string,
  ) => void;
}) {
  if (activePanel === "assets") {
    return (
      <AssetsPanel
        assets={mediaAssets}
        scene={scene}
        onAddMediaFiles={onAddMediaFiles}
        onInsertMediaAsset={onInsertMediaAsset}
        onRemoveMediaAsset={onRemoveMediaAsset}
      />
    );
  }

  if (activePanel === "layers") {
    return (
      <LayersPanel
        layers={editorLayers}
        selectedLayerId={selectedLayerId}
        onSelectLayer={onSelectLayer}
        onDeleteLayer={onDeleteLayer}
      />
    );
  }

  if (activePanel === "inspector") {
    return (
      <InspectorPanel
        fps={fps}
        selectedLayer={selectedLayer}
        onDeleteLayer={onDeleteLayer}
        onEditLayer={onEditLayer}
      />
    );
  }

  return (
    <ChatPanel
      messages={messages}
      messagesScrollerRef={messagesScrollerRef}
      textareaRef={textareaRef}
      input={input}
      isSending={isSending}
      scene={scene}
      mediaAssets={mediaAssets}
      durationLabel={durationLabel}
      onInputChange={onInputChange}
      onSubmitPrompt={onSubmitPrompt}
      onShowExamples={onShowExamples}
      onNewSession={onNewSession}
      onSelectPlanStep={onSelectPlanStep}
    />
  );
}

function AssetsPanel({
  assets,
  scene,
  onAddMediaFiles,
  onInsertMediaAsset,
  onRemoveMediaAsset,
}: {
  assets: LocalMediaAsset[];
  scene: Scene | null;
  onAddMediaFiles: (files: File[]) => void;
  onInsertMediaAsset: (id: string) => void;
  onRemoveMediaAsset: (id: string) => void;
}) {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);

    if (files.length) {
      onAddMediaFiles(files);
    }

    event.currentTarget.value = "";
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files ?? []);

    if (files.length) {
      onAddMediaFiles(files);
    }
  };

  return (
    <>
      <PanelHeader
        icon={ImageIcon}
        title="Assets"
        detail={`${assets.length} files`}
      />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3">
        <div
          className="rounded-md border border-dashed border-border bg-muted/35 p-3"
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted">
            <Upload className="h-4 w-4 text-muted-foreground" />
            Upload media
            <input
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              className="sr-only"
              onChange={handleInputChange}
            />
          </label>
        </div>

        {assets.length ? (
          <div className="mt-3 space-y-2">
            {assets.map((asset) => (
              <AssetCard
                key={`${asset.id}:${asset.objectUrl}`}
                asset={asset}
                used={isLocalMediaAssetUsed(asset, scene)}
                onInsert={() => onInsertMediaAsset(asset.id)}
                onRemove={() => onRemoveMediaAsset(asset.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyPanelText text="No local media assets." />
        )}
      </div>
    </>
  );
}

function AssetCard({
  asset,
  used,
  onInsert,
  onRemove,
}: {
  asset: LocalMediaAsset;
  used: boolean;
  onInsert: () => void;
  onRemove: () => void;
}) {
  const previewSrc =
    asset.thumbnailUrl ??
    (asset.type === "image" ? asset.objectUrl : undefined);
  const metadata = assetMetadata(asset);
  const readiness = describeLocalMediaAssetReadiness(asset);

  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-2 rounded-md border border-border bg-white p-2 shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
        {previewSrc ? (
          <img src={previewSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <AssetTypeIcon type={asset.type} />
        )}
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-foreground">
            {asset.label}
          </p>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
            {used ? "used" : "unused"}
          </span>
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase",
              readiness.severity === "error"
                ? "bg-destructive/10 text-destructive"
                : readiness.severity === "warning"
                  ? "bg-[hsl(38_92%_92%)] text-[hsl(32_95%_30%)]"
                  : readiness.severity === "probing"
                    ? "bg-primary/10 text-primary"
                    : "bg-[hsl(154_55%_92%)] text-[hsl(154_70%_24%)]",
            )}
          >
            {readiness.label}
          </span>
        </div>
        <p
          className="mt-0.5 truncate text-xs text-muted-foreground"
          title={asset.fileName}
        >
          {asset.fileName}
        </p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {metadata}
        </p>
        {readiness.severity !== "ready" ? (
          <p
            className={cn(
              "mt-1 max-h-8 overflow-hidden text-[11px] leading-4",
              readiness.severity === "error"
                ? "text-destructive"
                : "text-muted-foreground",
            )}
            title={readiness.detail}
          >
            {readiness.detail}
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onInsert}
            disabled={readiness.blocksUse}
            className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md bg-[hsl(220_18%_12%)] px-2 text-xs font-medium text-white hover:bg-[hsl(220_18%_18%)] disabled:cursor-not-allowed disabled:opacity-45"
            title={
              !readiness.blocksUse
                ? `Add ${asset.label} to scene`
                : readiness.detail
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={used}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-destructive disabled:cursor-not-allowed disabled:opacity-45"
            title={
              used
                ? `${asset.label} is used in the scene`
                : `Remove ${asset.label}`
            }
            aria-label={`Remove ${asset.label}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetTypeIcon({ type }: { type: LocalMediaAsset["type"] }) {
  if (type === "video") {
    return <FileVideo className="h-5 w-5" />;
  }

  if (type === "audio") {
    return <FileAudio className="h-5 w-5" />;
  }

  return <ImageIcon className="h-5 w-5" />;
}

function assetMetadata(asset: LocalMediaAsset) {
  const parts = [formatFileSize(asset.sizeBytes)];

  if (asset.type === "video" || asset.type === "audio") {
    parts.push(formatMediaDuration(asset.durationSeconds));
  }

  if (asset.width && asset.height) {
    parts.push(`${asset.width}x${asset.height}`);
  }

  if (asset.status === "probing") {
    parts.push("reading");
  }

  return parts.join(" · ");
}

function localAssetMentionItem(asset: LocalMediaAsset) {
  return {
    id: asset.id,
    sceneAssetId: asset.sceneAssetId,
    type: asset.type,
    src: asset.objectUrl,
    label: asset.label,
    aliases: asset.aliases,
    fileName: asset.fileName,
    durationSeconds: asset.durationSeconds,
    width: asset.width,
    height: asset.height,
    alreadyInScene: false,
  };
}

function appendMentionToken(input: string, asset: LocalMediaAsset) {
  const token = mediaMentionToken(localAssetMentionItem(asset));
  const separator = input.trim() ? " " : "";
  return `${input}${separator}${token} `;
}

function activeMentionQuery(input: string, caretIndex: number) {
  const beforeCaret = input.slice(0, caretIndex);
  const atIndex = beforeCaret.lastIndexOf("@");

  if (atIndex < 0) {
    return null;
  }

  const query = beforeCaret.slice(atIndex + 1);

  if (/[\s\n.,;:!?()[\]{}]/.test(query)) {
    return null;
  }

  return { start: atIndex, end: caretIndex, query };
}

function insertMentionTokenAtQuery({
  input,
  query,
  asset,
}: {
  input: string;
  query: { start: number; end: number };
  asset: LocalMediaAsset;
}) {
  const token = mediaMentionToken(localAssetMentionItem(asset));
  const before = input.slice(0, query.start);
  const after = input.slice(query.end);
  const separator = after.length === 0 || !/^\s/.test(after) ? " " : "";

  return {
    value: `${before}${token}${separator}${after}`,
    caret: query.start + token.length + separator.length,
  };
}

function ChatPanel({
  messages,
  messagesScrollerRef,
  textareaRef,
  input,
  isSending,
  scene,
  mediaAssets,
  durationLabel,
  onInputChange,
  onSubmitPrompt,
  onShowExamples,
  onNewSession,
  onSelectPlanStep,
}: {
  messages: ChatMessage[];
  messagesScrollerRef: RefObject<HTMLDivElement>;
  textareaRef: RefObject<HTMLTextAreaElement>;
  input: string;
  isSending: boolean;
  scene: Scene | null;
  mediaAssets: LocalMediaAsset[];
  durationLabel: string;
  onInputChange: (value: string) => void;
  onSubmitPrompt: (value?: string) => Promise<void>;
  onShowExamples: () => void;
  onNewSession: () => void;
  onSelectPlanStep: (id: string) => void;
}) {
  const [mentionQuery, setMentionQuery] = useState<{
    start: number;
    end: number;
    query: string;
  } | null>(null);
  const mentionSuggestions = mentionQuery
    ? mediaAssets
        .filter((asset) => !describeLocalMediaAssetReadiness(asset).blocksUse)
        .filter((asset) => {
          const query = mentionQuery.query.trim().toLowerCase();

          if (!query) {
            return true;
          }

          return [
            asset.label,
            asset.fileName,
            asset.id,
            asset.sceneAssetId,
            ...asset.aliases,
          ].some((value) => value.toLowerCase().includes(query));
        })
        .slice(0, 6)
    : [];
  const updateMentionQuery = (textarea: HTMLTextAreaElement) => {
    setMentionQuery(
      activeMentionQuery(textarea.value, textarea.selectionStart),
    );
  };
  const insertMentionAsset = (asset: LocalMediaAsset) => {
    if (!mentionQuery) {
      onInputChange(appendMentionToken(input, asset));
      window.setTimeout(() => textareaRef.current?.focus(), 0);
      return;
    }

    const nextInput = insertMentionTokenAtQuery({
      input,
      query: mentionQuery,
      asset,
    });

    onInputChange(nextInput.value);
    setMentionQuery(null);
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextInput.caret, nextInput.caret);
    }, 0);
  };

  return (
    <>
      <PanelHeader
        icon={MessageSquare}
        title="Assistant"
        detail={scene ? durationLabel : "new draft"}
        action={
          <button
            type="button"
            onClick={onNewSession}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground"
            title="New session"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        }
      />
      <div
        ref={messagesScrollerRef}
        className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-3"
        aria-live="polite"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(message.role === "user" ? "flex justify-end" : "")}
          >
            <div
              className={cn(
                "max-w-[92%] rounded-md px-3 py-2 text-sm leading-6",
                message.role === "user"
                  ? "bg-[hsl(220_18%_12%)] text-white"
                  : "border border-border bg-white text-foreground",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase",
                  message.role === "user"
                    ? "justify-end text-white/65"
                    : "text-muted-foreground",
                )}
              >
                {message.role === "user" ? "You" : "Agent"}
                {message.source ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 normal-case text-muted-foreground">
                    {message.source}
                  </span>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.mediaPlan ? (
                <MediaPlanView
                  plan={message.mediaPlan}
                  onSelectPlanStep={onSelectPlanStep}
                />
              ) : null}
              {message.diagnostics?.length ? (
                <pre className="mt-2 max-h-24 overflow-auto rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-800">
                  {message.diagnostics.join("\n")}
                </pre>
              ) : null}
            </div>
          </div>
        ))}
        {isSending ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-primary/15 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking
          </div>
        ) : null}
      </div>

      <form
        className="shrink-0 border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmitPrompt();
        }}
      >
        <div className="overflow-hidden rounded-md border border-border bg-white">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => {
              onInputChange(event.target.value);
              updateMentionQuery(event.currentTarget);
            }}
            onClick={(event) => updateMentionQuery(event.currentTarget)}
            onKeyUp={(event) => {
              if (["Enter", "Escape", "Tab"].includes(event.key)) {
                return;
              }
              updateMentionQuery(event.currentTarget);
            }}
            onKeyDown={(event) => {
              const firstSuggestion = mentionSuggestions[0];
              if (
                firstSuggestion &&
                !event.shiftKey &&
                (event.key === "Enter" || event.key === "Tab")
              ) {
                event.preventDefault();
                insertMentionAsset(firstSuggestion);
                return;
              }

              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (input.trim() && !isSending) {
                  event.currentTarget.form?.requestSubmit();
                }
              }
              if (event.key === "Escape") {
                setMentionQuery(null);
              }
            }}
            placeholder="Describe or refine the video... Use @ to specify the file."
            rows={6}
            className="min-h-40 w-full resize-y border-0 bg-transparent px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSending}
          />
          {mentionSuggestions.length ? (
            <div className="border-t border-border/70 bg-white px-2.5 py-2">
              <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-white shadow-sm">
                {mentionSuggestions.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => insertMentionAsset(asset)}
                    className="grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <MentionAssetPreview asset={asset} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {mediaMentionToken(localAssetMentionItem(asset))}
                      </span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {asset.fileName}
                      </span>
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {asset.type}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between border-t border-border/70 px-2.5 py-2">
            <button
              type="button"
              onClick={onShowExamples}
              disabled={isSending}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Examples
            </button>
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[hsl(220_18%_12%)] px-3 text-xs font-medium text-white hover:bg-[hsl(220_18%_18%)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send
            </button>
          </div>
          {mediaAssets.length ? (
            <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto border-t border-border/70 px-2.5 py-2">
              {mediaAssets.slice(0, 5).map((asset) => (
                <MentionAssetButton
                  key={asset.id}
                  asset={asset}
                  input={input}
                  isSending={isSending}
                  onInputChange={onInputChange}
                />
              ))}
            </div>
          ) : null}
        </div>
      </form>
    </>
  );
}

function MentionAssetButton({
  asset,
  input,
  isSending,
  onInputChange,
}: {
  asset: LocalMediaAsset;
  input: string;
  isSending: boolean;
  onInputChange: (value: string) => void;
}) {
  const readiness = describeLocalMediaAssetReadiness(asset);

  return (
    <button
      type="button"
      onClick={() => onInputChange(appendMentionToken(input, asset))}
      disabled={isSending || readiness.blocksUse}
      className={cn(
        "inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border px-1.5 pr-2 text-xs hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45",
        readiness.severity === "warning"
          ? "border-[hsl(38_80%_72%)] bg-[hsl(38_92%_94%)] text-[hsl(32_95%_30%)]"
          : "border-border bg-muted text-muted-foreground",
      )}
      title={readiness.blocksUse ? readiness.detail : `Mention ${asset.label}`}
    >
      <MentionAssetPreview asset={asset} />
      <span className="truncate">
        {mediaMentionToken(localAssetMentionItem(asset))}
      </span>
    </button>
  );
}

function MentionAssetPreview({ asset }: { asset: LocalMediaAsset }) {
  const previewSrc =
    asset.thumbnailUrl ?? (asset.type === "image" ? asset.objectUrl : null);

  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border/80 bg-white text-muted-foreground">
      {previewSrc ? (
        <img src={previewSrc} alt="" className="h-full w-full object-cover" />
      ) : (
        <AssetTypeIcon type={asset.type} />
      )}
    </span>
  );
}

function MediaPlanView({
  plan,
  onSelectPlanStep,
}: {
  plan: MediaOperationPlan;
  onSelectPlanStep: (id: string) => void;
}) {
  if (!plan.steps.length) {
    return null;
  }

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border/80 bg-muted/25">
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-2 py-1.5">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          Operation plan
        </span>
        <span className="text-[10px] text-muted-foreground">
          {plan.steps.length} step{plan.steps.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="divide-y divide-border/70">
        {plan.steps.map((step, index) => {
          const description = describeMediaPlanStep(step, plan.fps);

          return (
            <button
              key={`${step.type}:${step.nodeId}:${index}`}
              type="button"
              onClick={() => onSelectPlanStep(step.nodeId)}
              className="grid w-full grid-cols-[18px_minmax(0,1fr)_16px] items-center gap-2 px-2 py-1.5 text-left transition hover:bg-white"
              title={`Select ${description.title}`}
            >
              <MediaPlanStepIcon step={step} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-foreground">
                  {description.title}
                </span>
                <span className="block truncate text-[11px] leading-4 text-muted-foreground">
                  {description.detail}
                </span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MediaPlanStepIcon({ step }: { step: MediaOperationPlanStep }) {
  if (step.type === "text-overlay") {
    return <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />;
  }

  if (step.mediaType === "image") {
    return <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />;
  }

  return <FileVideo className="h-3.5 w-3.5 text-muted-foreground" />;
}

function LayersPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
  onDeleteLayer,
}: {
  layers: EditorLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
}) {
  const selectedDescendantIds = collectEditorLayerDescendantIds(
    layers,
    selectedLayerId,
  );

  return (
    <>
      <PanelHeader
        icon={Layers}
        title="Layers"
        detail={`${layers.length} nodes`}
      />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        {layers.length ? (
          <div className="space-y-1">
            {layers.map((layer) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                selected={selectedLayerId === layer.id}
                included={selectedDescendantIds.has(layer.id)}
                onSelect={() => onSelectLayer(layer.id)}
                onDelete={() => onDeleteLayer(layer.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyPanelText text="Generate a scene to inspect editable layers." />
        )}
      </div>
    </>
  );
}

function InspectorPanel({
  fps,
  selectedLayer,
  onDeleteLayer,
  onEditLayer,
}: {
  fps: number;
  selectedLayer: EditorLayer | null;
  onDeleteLayer: (id: string) => void;
  onEditLayer: (
    id: string,
    field: InspectorEditableField,
    value: string,
  ) => void;
}) {
  const hasVisualAssetLayer =
    selectedLayer?.type === "img" || selectedLayer?.type === "video";
  const hasAudioControls =
    selectedLayer?.type === "audio" || selectedLayer?.type === "video";
  const hasPlaybackRate =
    selectedLayer?.type === "video" || selectedLayer?.type === "lottie";

  return (
    <>
      <PanelHeader
        icon={Info}
        title="Inspector"
        detail="selection"
        action={
          selectedLayer ? (
            <button
              type="button"
              onClick={() => onDeleteLayer(selectedLayer.id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-destructive"
              title={deleteLayerTitle(selectedLayer)}
              aria-label={deleteLayerTitle(selectedLayer)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : undefined
        }
      />
      {selectedLayer ? (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
            <InspectorField label="Id" value={selectedLayer.id} mono wide />
            <InspectorField
              label="Type"
              value={displayLayerType(selectedLayer.type)}
            />
            {selectedLayer.assetId ? (
              <InspectorField
                label="Asset"
                value={selectedLayer.assetId}
                mono
                wide
              />
            ) : null}
            {selectedLayer.type === "text" ? (
              <>
                <InspectorTextArea
                  label="Text"
                  value={selectedLayer.text ?? ""}
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "text", value)
                  }
                />
                <InspectorTextInput
                  label="Color"
                  value={selectedLayer.color ?? ""}
                  placeholder="#ffffff"
                  swatch
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "color", value)
                  }
                />
                <InspectorTextInput
                  label="Font size"
                  value={formatOptionalStyleValue(selectedLayer.fontSize)}
                  placeholder="default"
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "fontSize", value)
                  }
                />
                <InspectorTextInput
                  label="Font weight"
                  value={formatOptionalStyleValue(selectedLayer.fontWeight)}
                  placeholder="default"
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "fontWeight", value)
                  }
                />
                <InspectorSelectInput
                  label="Align"
                  value={selectedLayer.textAlign ?? ""}
                  options={[
                    { label: "Default", value: "" },
                    { label: "Left", value: "left" },
                    { label: "Center", value: "center" },
                    { label: "Right", value: "right" },
                  ]}
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "textAlign", value)
                  }
                />
                <InspectorTextInput
                  label="Stroke"
                  value={selectedLayer.textStroke ?? ""}
                  placeholder="4px #000000"
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "textStroke", value)
                  }
                />
              </>
            ) : null}
            {selectedLayer.type === "video" ? (
              <InspectorNumberInput
                label="Source start"
                value={formatOptionalNumber(selectedLayer.videoStartTime)}
                placeholder="0"
                step="0.1"
                min="0"
                suffix="seconds"
                onCommit={(value) =>
                  onEditLayer(selectedLayer.id, "videoStartTime", value)
                }
              />
            ) : null}
            {selectedLayer.type === "audio" ? (
              <InspectorNumberInput
                label="Source start"
                value={formatOptionalNumber(selectedLayer.audioStartTime)}
                placeholder="0"
                step="0.1"
                min="0"
                suffix="seconds"
                onCommit={(value) =>
                  onEditLayer(selectedLayer.id, "audioStartTime", value)
                }
              />
            ) : null}
            {hasPlaybackRate ? (
              <InspectorNumberInput
                label="Playback"
                value={formatOptionalNumber(selectedLayer.playbackRate)}
                placeholder="1"
                step="0.05"
                min="0.05"
                suffix="rate"
                onCommit={(value) =>
                  onEditLayer(selectedLayer.id, "playbackRate", value)
                }
              />
            ) : null}
            {hasAudioControls ? (
              <InspectorNumberInput
                label="Volume"
                value={formatOptionalNumber(selectedLayer.volume)}
                placeholder="1"
                step="0.05"
                min="0"
                max="1"
                onCommit={(value) =>
                  onEditLayer(selectedLayer.id, "volume", value)
                }
              />
            ) : null}
            {hasVisualAssetLayer ? (
              <>
                <InspectorSelectInput
                  label="Fit"
                  value={selectedLayer.objectFit ?? ""}
                  options={[
                    { label: "Default", value: "" },
                    { label: "Cover", value: "cover" },
                    { label: "Contain", value: "contain" },
                    { label: "Fill", value: "fill" },
                    { label: "None", value: "none" },
                    { label: "Scale down", value: "scale-down" },
                  ]}
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "objectFit", value)
                  }
                />
                <InspectorTextInput
                  label="Position"
                  value={selectedLayer.objectPosition ?? ""}
                  placeholder="center center"
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "objectPosition", value)
                  }
                />
              </>
            ) : null}
            <InspectorNumberInput
              label="Start"
              value={String(selectedLayer.localFrom)}
              suffix={`${formatSeconds(selectedLayer.localFrom, fps)} local`}
              onCommit={(value) => onEditLayer(selectedLayer.id, "from", value)}
            />
            <InspectorNumberInput
              label="Duration"
              value={String(selectedLayer.localDuration)}
              suffix={`${formatSeconds(selectedLayer.localDuration, fps)} local`}
              onCommit={(value) =>
                onEditLayer(selectedLayer.id, "duration", value)
              }
            />
            <InspectorNumberInput
              label="Left"
              value={formatOptionalNumber(selectedLayer.bounds?.left)}
              onCommit={(value) => onEditLayer(selectedLayer.id, "left", value)}
            />
            <InspectorNumberInput
              label="Top"
              value={formatOptionalNumber(selectedLayer.bounds?.top)}
              onCommit={(value) => onEditLayer(selectedLayer.id, "top", value)}
            />
            <InspectorNumberInput
              label="Width"
              value={formatOptionalNumber(selectedLayer.bounds?.width)}
              onCommit={(value) =>
                onEditLayer(selectedLayer.id, "width", value)
              }
            />
            <InspectorNumberInput
              label="Height"
              value={formatOptionalNumber(selectedLayer.bounds?.height)}
              onCommit={(value) =>
                onEditLayer(selectedLayer.id, "height", value)
              }
            />
            <InspectorNumberInput
              label="Opacity"
              value={formatOptionalNumber(selectedLayer.opacity)}
              placeholder="default"
              step="0.05"
              min="0"
              max="1"
              onCommit={(value) =>
                onEditLayer(selectedLayer.id, "opacity", value)
              }
            />
            <InspectorField
              label="zIndex"
              value={String(selectedLayer.zIndex)}
            />
            <InspectorField
              label="Parent"
              value={selectedLayer.parentId ?? "root"}
              mono={Boolean(selectedLayer.parentId)}
              wide
            />
            <InspectorField
              label="Bounds"
              value={formatBounds(selectedLayer.bounds)}
              wide
            />
          </dl>
        </div>
      ) : (
        <EmptyPanelText text="Select a layer to inspect timing and geometry." />
      )}
    </>
  );
}

export function PreviewWorkspace({
  canvasRef,
  scene,
  playerState,
  selectedLayer,
  onMoveLayer,
}: {
  canvasRef: RefObject<HTMLCanvasElement>;
  scene: Scene | null;
  playerState: Pick<PlayerUiState, "frame" | "loading" | "error">;
  selectedLayer: EditorLayer | null;
  onMoveLayer: (
    id: string,
    move: PreviewLayerMove | PreviewLayerBounds,
  ) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingLayerRef = useRef<PreviewDraggingLayer | null>(null);
  const [canvasRect, setCanvasRect] = useState<
    (PreviewCanvasRect & { left: number; top: number }) | null
  >(null);
  const [draggingLayer, setDraggingLayerState] =
    useState<PreviewDraggingLayer | null>(null);
  const setDraggingLayer = (state: PreviewDraggingLayer | null) => {
    draggingLayerRef.current = state;
    setDraggingLayerState(state);
  };
  const overlay = describePreviewOverlay({
    hasScene: Boolean(scene),
    previewLoading: playerState.loading,
    previewError: playerState.error,
  });
  const selectionOverlay =
    scene && canvasRect
      ? createPreviewSelectionOverlay({
          layer: selectedLayer,
          sceneWidth: scene.width,
          sceneHeight: scene.height,
          canvasRect,
          frame: playerState.frame,
        })
      : null;
  const displaySelectionOverlay =
    selectionOverlay?.kind === "bounds" && draggingLayer
      ? {
          ...selectionOverlay,
          rect: {
            ...selectionOverlay.rect,
            left:
              (draggingLayer.previewLeft / (scene?.width ?? 1)) *
              (canvasRect?.width ?? 1),
            top:
              (draggingLayer.previewTop / (scene?.height ?? 1)) *
              (canvasRect?.height ?? 1),
            width:
              (draggingLayer.previewWidth / (scene?.width ?? 1)) *
              (canvasRect?.width ?? 1),
            height:
              (draggingLayer.previewHeight / (scene?.height ?? 1)) *
              (canvasRect?.height ?? 1),
          },
        }
      : selectionOverlay;
  const canDragSelection =
    Boolean(scene && canvasRect && selectedLayer?.bounds) &&
    displaySelectionOverlay?.kind === "bounds";

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;

    if (!canvas || !stage) {
      setCanvasRect(null);
      return;
    }

    const measure = () => {
      const canvasBounds = canvas.getBoundingClientRect();
      const stageBounds = stage.getBoundingClientRect();
      setCanvasRect({
        left: canvasBounds.left - stageBounds.left,
        top: canvasBounds.top - stageBounds.top,
        width: canvasBounds.width,
        height: canvasBounds.height,
      });
    };

    measure();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    observer.observe(stage);

    return () => observer.disconnect();
  }, [canvasRef, scene?.height, scene?.width]);

  const previewLayerGeometryDrag = (
    currentClientX: number,
    currentClientY: number,
  ): PreviewDraggingLayer | null => {
    const activeDrag = draggingLayerRef.current;

    if (!activeDrag || !scene || !canvasRect) {
      return activeDrag;
    }

    const move =
      activeDrag.mode === "resize" && activeDrag.handle
        ? resizePreviewLayerBoundsFromDrag({
            handle: activeDrag.handle,
            initialLeft: activeDrag.initialLeft,
            initialTop: activeDrag.initialTop,
            initialWidth: activeDrag.initialWidth,
            initialHeight: activeDrag.initialHeight,
            startClientX: activeDrag.startClientX,
            startClientY: activeDrag.startClientY,
            currentClientX,
            currentClientY,
            sceneWidth: scene.width,
            sceneHeight: scene.height,
            canvasRect,
          })
        : {
            ...movePreviewLayerBoundsFromDrag({
              initialLeft: activeDrag.initialLeft,
              initialTop: activeDrag.initialTop,
              startClientX: activeDrag.startClientX,
              startClientY: activeDrag.startClientY,
              currentClientX,
              currentClientY,
              sceneWidth: scene.width,
              sceneHeight: scene.height,
              canvasRect,
            }),
            width: activeDrag.initialWidth,
            height: activeDrag.initialHeight,
          };
    const nextDrag = {
      ...activeDrag,
      previewLeft: move.left,
      previewTop: move.top,
      previewWidth: move.width,
      previewHeight: move.height,
    };

    setDraggingLayer(nextDrag);
    return nextDrag;
  };
  const commitLayerDrag = (
    currentClientX?: number,
    currentClientY?: number,
  ) => {
    const activeDrag = draggingLayerRef.current;

    if (!activeDrag) {
      setDraggingLayer(null);
      return;
    }

    const finalDrag =
      currentClientX !== undefined && currentClientY !== undefined
        ? (previewLayerGeometryDrag(currentClientX, currentClientY) ??
          activeDrag)
        : activeDrag;

    if (
      finalDrag.previewLeft !== finalDrag.initialLeft ||
      finalDrag.previewTop !== finalDrag.initialTop ||
      finalDrag.previewWidth !== finalDrag.initialWidth ||
      finalDrag.previewHeight !== finalDrag.initialHeight
    ) {
      const nextBounds =
        finalDrag.mode === "resize"
          ? {
              left: finalDrag.previewLeft,
              top: finalDrag.previewTop,
              width: finalDrag.previewWidth,
              height: finalDrag.previewHeight,
            }
          : {
              left: finalDrag.previewLeft,
              top: finalDrag.previewTop,
            };

      onMoveLayer(finalDrag.id, nextBounds);
    }

    setDraggingLayer(null);
  };
  const startPreviewGeometryDrag = ({
    mode,
    handle,
    clientX,
    clientY,
  }: {
    mode: PreviewDraggingLayer["mode"];
    handle?: PreviewLayerResizeHandle;
    clientX: number;
    clientY: number;
  }) => {
    if (!canDragSelection || !selectedLayer?.bounds) {
      return false;
    }

    const initialLeft = selectedLayer.bounds.left ?? 0;
    const initialTop = selectedLayer.bounds.top ?? 0;
    const initialWidth = selectedLayer.bounds.width ?? scene?.width ?? 1;
    const initialHeight = selectedLayer.bounds.height ?? scene?.height ?? 1;

    if (
      !Number.isFinite(initialLeft) ||
      !Number.isFinite(initialTop) ||
      !Number.isFinite(initialWidth) ||
      !Number.isFinite(initialHeight)
    ) {
      return false;
    }

    setDraggingLayer({
      mode,
      id: selectedLayer.id,
      handle,
      startClientX: clientX,
      startClientY: clientY,
      initialLeft,
      initialTop,
      initialWidth,
      initialHeight,
      previewLeft: initialLeft,
      previewTop: initialTop,
      previewWidth: initialWidth,
      previewHeight: initialHeight,
    });

    return true;
  };
  const handleSelectionPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (
      startPreviewGeometryDrag({
        mode: "move",
        clientX: event.clientX,
        clientY: event.clientY,
      })
    ) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const handleSelectionPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    previewLayerGeometryDrag(event.clientX, event.clientY);
  };
  const handleSelectionPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    commitLayerDrag(event.clientX, event.clientY);
  };
  const handleSelectionPointerCancel = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDraggingLayer(null);
  };
  const handleSelectionMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (
      draggingLayerRef.current ||
      !canDragSelection ||
      !selectedLayer?.bounds
    ) {
      return;
    }

    event.stopPropagation();
    startPreviewGeometryDrag({
      mode: "move",
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };
  const handleResizeHandlePointerDown = (
    handle: PreviewLayerResizeHandle,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();

    if (
      startPreviewGeometryDrag({
        mode: "resize",
        handle,
        clientX: event.clientX,
        clientY: event.clientY,
      })
    ) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const handleResizeHandlePointerMove = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    previewLayerGeometryDrag(event.clientX, event.clientY);
  };
  const handleResizeHandlePointerUp = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    commitLayerDrag(event.clientX, event.clientY);
  };
  const handleResizeHandlePointerCancel = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDraggingLayer(null);
  };
  const handleResizeHandleMouseDown = (
    handle: PreviewLayerResizeHandle,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    if (draggingLayerRef.current) {
      return;
    }

    event.stopPropagation();
    startPreviewGeometryDrag({
      mode: "resize",
      handle,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  useEffect(() => {
    if (!draggingLayer) {
      return;
    }

    const handleWindowMouseMove = (event: globalThis.MouseEvent) => {
      previewLayerGeometryDrag(event.clientX, event.clientY);
    };
    const handleWindowMouseUp = (event: globalThis.MouseEvent) => {
      commitLayerDrag(event.clientX, event.clientY);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [draggingLayer]);

  return (
    <div
      className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[hsl(218_18%_92%)] bg-[linear-gradient(to_right,hsl(218_16%_82%/.55)_1px,transparent_1px),linear-gradient(to_bottom,hsl(218_16%_82%/.55)_1px,transparent_1px)] bg-[size:16px_16px]"
      data-editor-workspace
    >
      <div className="absolute inset-3 flex items-center justify-center">
        <div
          ref={stageRef}
          className="relative flex h-full max-h-full w-full items-center justify-center"
        >
          <canvas
            ref={canvasRef}
            className="h-auto max-h-full w-auto max-w-full object-contain shadow-xl ring-1 ring-black/10"
            style={{
              aspectRatio: `${scene?.width ?? 1080} / ${scene?.height ?? 1920}`,
              background: "hsl(220 18% 12%)",
            }}
          />
          {displaySelectionOverlay?.kind === "bounds" ? (
            <div
              className="pointer-events-none absolute"
              data-preview-selection-overlay
              style={{
                left: `${canvasRect?.left ?? 0}px`,
                top: `${canvasRect?.top ?? 0}px`,
                width: `${canvasRect?.width ?? 0}px`,
                height: `${canvasRect?.height ?? 0}px`,
              }}
            >
              <div
                className={cn(
                  "absolute rounded-sm px-1.5 py-0.5 text-[10px] font-semibold shadow-sm",
                  displaySelectionOverlay.visible
                    ? "bg-primary text-primary-foreground"
                    : "bg-amber-400 text-amber-950",
                )}
                style={{
                  left: `${displaySelectionOverlay.rect.left}px`,
                  top: `${Math.max(0, displaySelectionOverlay.rect.top - 22)}px`,
                }}
              >
                {displaySelectionOverlay.visible
                  ? displaySelectionOverlay.label
                  : `${displaySelectionOverlay.label} · hidden at playhead`}
              </div>
              <div
                className={cn(
                  "absolute border-2 shadow-[0_0_0_1px_rgba(0,0,0,.28)]",
                  canDragSelection
                    ? "pointer-events-auto cursor-move touch-none"
                    : "",
                  displaySelectionOverlay.visible
                    ? "border-[hsl(var(--primary))]"
                    : "border-dashed border-amber-400",
                )}
                data-preview-selection-handle
                onPointerDown={handleSelectionPointerDown}
                onPointerMove={handleSelectionPointerMove}
                onPointerUp={handleSelectionPointerUp}
                onPointerCancel={handleSelectionPointerCancel}
                onMouseDown={handleSelectionMouseDown}
                style={{
                  left: `${displaySelectionOverlay.rect.left}px`,
                  top: `${displaySelectionOverlay.rect.top}px`,
                  width: `${displaySelectionOverlay.rect.width}px`,
                  height: `${displaySelectionOverlay.rect.height}px`,
                }}
              >
                {canDragSelection
                  ? PREVIEW_RESIZE_HANDLES.map(({ handle, className }) => (
                      <button
                        key={handle}
                        type="button"
                        aria-label={`Resize ${displaySelectionOverlay.label} ${handle}`}
                        title={`Resize ${displaySelectionOverlay.label}`}
                        className={cn(
                          "absolute z-10 h-3 w-3 rounded-sm border border-white bg-primary shadow touch-none",
                          className,
                        )}
                        onPointerDown={(event) =>
                          handleResizeHandlePointerDown(handle, event)
                        }
                        onPointerMove={handleResizeHandlePointerMove}
                        onPointerUp={handleResizeHandlePointerUp}
                        onPointerCancel={handleResizeHandlePointerCancel}
                        onMouseDown={(event) =>
                          handleResizeHandleMouseDown(handle, event)
                        }
                      />
                    ))
                  : null}
              </div>
            </div>
          ) : null}
          {displaySelectionOverlay?.kind === "unbounded" ? (
            <div
              className={cn(
                "pointer-events-none absolute rounded-sm px-2 py-1 text-[11px] font-semibold shadow-sm",
                displaySelectionOverlay.visible
                  ? "bg-primary text-primary-foreground"
                  : "bg-amber-400 text-amber-950",
              )}
              data-preview-selection-overlay
              style={{
                left: `${(canvasRect?.left ?? 0) + 8}px`,
                top: `${(canvasRect?.top ?? 0) + 8}px`,
              }}
            >
              {displaySelectionOverlay.visible
                ? displaySelectionOverlay.label
                : `${displaySelectionOverlay.label} · hidden at playhead`}
            </div>
          ) : null}
          {overlay?.kind === "empty" ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
              <div className="rounded-md bg-[hsl(220_18%_12%/.86)] px-5 py-4 text-white shadow-xl">
                <Sparkles className="mx-auto mb-2 h-5 w-5" />
                <p className="text-sm font-medium">{overlay.title}</p>
                <p className="mt-1 text-xs text-white/70">{overlay.detail}</p>
              </div>
            </div>
          ) : null}
          {playerState.loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
          ) : null}
          {overlay?.kind === "error" ? (
            <div className="absolute inset-x-6 top-6 rounded-md border border-destructive/30 bg-white p-3 text-sm text-destructive shadow-lg">
              <p className="font-semibold">{overlay.title}</p>
              <p className="mt-1 leading-5">{overlay.detail}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type TimelineDraggingLayer = {
  mode: "move" | "resize-end";
  id: string;
  startFrame: number;
  initialFrom: number;
  initialAbsoluteFrom: number;
  duration: number;
  previewFrom: number;
  previewDuration: number;
};

type TimelineResizeDrag = {
  startClientY: number;
  startHeight: number;
};

const TIMELINE_TRACK_ROW_HEIGHT = 32;
const TIMELINE_TRACK_HEADER_HEIGHT = 24;
const TIMELINE_BLOCK_TOP_OFFSET = 34;
const TIMELINE_TRACK_ROW_TOP_PADDING =
  TIMELINE_BLOCK_TOP_OFFSET - TIMELINE_TRACK_HEADER_HEIGHT;
const TIMELINE_CONTENT_BOTTOM_PADDING = 8;
const TIMELINE_COLLAPSED_HEIGHT = 44;
const TIMELINE_MIN_PANEL_HEIGHT = 104;
const TIMELINE_PREVIEW_MIN_HEIGHT = 140;
const PREVIEW_RESIZE_HANDLES: Array<{
  handle: PreviewLayerResizeHandle;
  className: string;
}> = [
  {
    handle: "nw",
    className: "-left-1.5 -top-1.5 cursor-nwse-resize",
  },
  {
    handle: "n",
    className: "left-1/2 -top-1.5 -translate-x-1/2 cursor-ns-resize",
  },
  {
    handle: "ne",
    className: "-right-1.5 -top-1.5 cursor-nesw-resize",
  },
  {
    handle: "e",
    className: "-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
  },
  {
    handle: "se",
    className: "-bottom-1.5 -right-1.5 cursor-nwse-resize",
  },
  {
    handle: "s",
    className: "bottom-[-6px] left-1/2 -translate-x-1/2 cursor-ns-resize",
  },
  {
    handle: "sw",
    className: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
  },
  {
    handle: "w",
    className: "-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize",
  },
];

type PreviewDraggingLayer = {
  mode: "move" | "resize";
  id: string;
  handle?: PreviewLayerResizeHandle;
  startClientX: number;
  startClientY: number;
  initialLeft: number;
  initialTop: number;
  initialWidth: number;
  initialHeight: number;
  previewLeft: number;
  previewTop: number;
  previewWidth: number;
  previewHeight: number;
};

export function TimelinePanel({
  scene,
  layers,
  mediaAssets,
  selectedLayerId,
  playerState,
  exportStatus,
  timelineHeight,
  timelineCollapsed,
  onSelectLayer,
  onTogglePlayback,
  onSeek,
  onRetimeLayer,
  onResizeLayerDuration,
  onSplitSelectedLayer,
  onDeleteLayer,
  onTimelineHeightChange,
  onTimelineCollapsedChange,
}: {
  scene: Scene | null;
  layers: EditorLayer[];
  mediaAssets: LocalMediaAsset[];
  selectedLayerId: string | null;
  playerState: PlayerUiState;
  exportStatus: string;
  timelineHeight: number;
  timelineCollapsed: boolean;
  onSelectLayer: (id: string) => void;
  onTogglePlayback: () => void;
  onSeek: (frame: number) => void;
  onRetimeLayer: (id: string, from: number) => void;
  onResizeLayerDuration: (id: string, duration: number) => void;
  onSplitSelectedLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onTimelineHeightChange: (height: number) => void;
  onTimelineCollapsedChange: (collapsed: boolean) => void;
}) {
  const duration = scene?.duration ?? 1;
  const timelineContentHeight =
    TIMELINE_BLOCK_TOP_OFFSET +
    Math.max(1, layers.length) * TIMELINE_TRACK_ROW_HEIGHT +
    TIMELINE_CONTENT_BOTTOM_PADDING;
  const canScrub = Boolean(scene && !playerState.loading && !playerState.error);
  const selectedTimelineLayer =
    layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const canSplitSelectedLayer = Boolean(
    scene &&
    selectedTimelineLayer &&
    selectedTimelineLayer.childCount === 0 &&
    playerState.frame > selectedTimelineLayer.from &&
    playerState.frame <
      selectedTimelineLayer.from + selectedTimelineLayer.duration,
  );
  const draggingLayerRef = useRef<TimelineDraggingLayer | null>(null);
  const timelineResizeRef = useRef<TimelineResizeDrag | null>(null);
  const trackListRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollerRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const [draggingLayer, setDraggingLayerState] =
    useState<TimelineDraggingLayer | null>(null);
  const [resizingTimeline, setResizingTimeline] = useState(false);
  const setDraggingLayer = (state: TimelineDraggingLayer | null) => {
    draggingLayerRef.current = state;
    setDraggingLayerState(state);
  };
  const exportReadiness = describeExportReadiness({
    hasScene: Boolean(scene),
    previewLoading: playerState.loading,
    previewError: playerState.error,
    exportSupported: playerState.exportSupported,
    isExporting: false,
    exportStatus,
    layerCount: layers.length,
  });
  const syncVerticalScroll = (
    source: HTMLDivElement | null,
    target: HTMLDivElement | null,
  ) => {
    if (!source || !target || syncingScrollRef.current) {
      return;
    }

    syncingScrollRef.current = true;
    target.scrollTop = source.scrollTop;
    window.requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  };
  const scrubTimelineAtClientX = (
    clientX: number,
    timelineElement: HTMLDivElement,
  ) => {
    if (!canScrub) {
      return;
    }

    const bounds = timelineElement.getBoundingClientRect();
    onSeek(
      frameFromTimelinePoint({
        clientX,
        timelineLeft: bounds.left,
        timelineWidth: bounds.width,
        duration,
      }),
    );
  };
  const scrubPointerTimeline = (event: PointerEvent<HTMLDivElement>) => {
    scrubTimelineAtClientX(event.clientX, event.currentTarget);
  };
  const scrubMouseTimeline = (event: MouseEvent<HTMLDivElement>) => {
    scrubTimelineAtClientX(event.clientX, event.currentTarget);
  };
  const frameForTimelineEvent = (
    clientX: number,
    timelineElement: HTMLDivElement,
  ) => {
    const bounds = timelineElement.getBoundingClientRect();
    return frameFromTimelinePoint({
      clientX,
      timelineLeft: bounds.left,
      timelineWidth: bounds.width,
      duration,
    });
  };
  const previewLayerDrag = (
    clientX: number,
    timelineElement: HTMLDivElement,
  ): TimelineDraggingLayer | null => {
    const activeDrag = draggingLayerRef.current;

    if (!activeDrag) {
      return null;
    }

    const currentFrame = frameForTimelineEvent(clientX, timelineElement);
    const nextDrag =
      activeDrag.mode === "move"
        ? {
            ...activeDrag,
            previewFrom: retimeLayerFromTimelineDrag({
              startFrame: activeDrag.startFrame,
              currentFrame,
              initialFrom: activeDrag.initialFrom,
              layerDuration: activeDrag.previewDuration,
              sceneDuration: duration,
            }),
          }
        : {
            ...activeDrag,
            previewDuration: resizeLayerDurationFromTimelineDrag({
              startFrame: activeDrag.startFrame,
              currentFrame,
              initialDuration: activeDrag.duration,
              layerFrom: activeDrag.previewFrom,
              sceneDuration: duration,
            }),
          };

    setDraggingLayer(nextDrag);
    return nextDrag;
  };
  const commitLayerDrag = (
    clientX?: number,
    timelineElement?: HTMLDivElement | null,
  ) => {
    const activeDrag = draggingLayerRef.current;

    if (!activeDrag) {
      setDraggingLayer(null);
      return;
    }

    const finalDrag =
      clientX !== undefined && timelineElement
        ? previewDragWithoutState(activeDrag, {
            currentFrame: frameForTimelineEvent(clientX, timelineElement),
            sceneDuration: duration,
          })
        : activeDrag;

    if (
      finalDrag.mode === "move" &&
      finalDrag.previewFrom !== finalDrag.initialFrom
    ) {
      onRetimeLayer(finalDrag.id, finalDrag.previewFrom);
    }

    if (
      finalDrag.mode === "resize-end" &&
      finalDrag.previewDuration !== finalDrag.duration
    ) {
      onResizeLayerDuration(finalDrag.id, finalDrag.previewDuration);
    }

    setDraggingLayer(null);
  };
  const startLayerDrag = (
    mode: TimelineDraggingLayer["mode"],
    layer: EditorLayer,
    clientX: number,
    timelineElement: HTMLDivElement,
  ) => {
    setDraggingLayer({
      mode,
      id: layer.id,
      startFrame: frameForTimelineEvent(clientX, timelineElement),
      initialFrom: layer.localFrom,
      initialAbsoluteFrom: layer.from,
      duration: layer.localDuration,
      previewFrom: layer.localFrom,
      previewDuration: layer.localDuration,
    });
    onSelectLayer(layer.id);
  };
  const beginLayerDragFromElement = (
    mode: TimelineDraggingLayer["mode"],
    layer: EditorLayer,
    clientX: number,
    element: HTMLElement,
  ) => {
    if (!canScrub) {
      return false;
    }

    const timelineElement = timelineElementForBlock(element);

    if (!(timelineElement instanceof HTMLDivElement)) {
      return false;
    }

    startLayerDrag(mode, layer, clientX, timelineElement);
    return true;
  };
  const handleLayerPointerDown = (
    mode: TimelineDraggingLayer["mode"],
    layer: EditorLayer,
    event: PointerEvent<HTMLElement>,
  ) => {
    event.stopPropagation();

    if (
      beginLayerDragFromElement(mode, layer, event.clientX, event.currentTarget)
    ) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const handleLayerPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const timelineElement = timelineElementForBlock(event.currentTarget);

    if (timelineElement instanceof HTMLDivElement) {
      previewLayerDrag(event.clientX, timelineElement);
    }
  };
  const handleLayerPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    commitLayerDrag(
      event.clientX,
      timelineElementForBlock(event.currentTarget),
    );
  };
  const handleLayerPointerCancel = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDraggingLayer(null);
  };
  const handleLayerMouseDown = (
    mode: TimelineDraggingLayer["mode"],
    layer: EditorLayer,
    event: MouseEvent<HTMLElement>,
  ) => {
    event.stopPropagation();
    beginLayerDragFromElement(mode, layer, event.clientX, event.currentTarget);
  };
  const handleLayerMouseMove = (event: MouseEvent<HTMLElement>) => {
    if (!draggingLayer) {
      return;
    }

    const timelineElement = timelineElementForBlock(event.currentTarget);

    if (timelineElement instanceof HTMLDivElement) {
      previewLayerDrag(event.clientX, timelineElement);
    }
  };
  const handleLayerMouseUp = (event: MouseEvent<HTMLElement>) => {
    commitLayerDrag(
      event.clientX,
      timelineElementForBlock(event.currentTarget),
    );
  };
  const startTimelineResize = (clientY: number) => {
    timelineResizeRef.current = {
      startClientY: clientY,
      startHeight: timelineHeight,
    };
    onTimelineCollapsedChange(false);
    setResizingTimeline(true);
  };
  const beginTimelineResize = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    startTimelineResize(event.clientY);
  };
  const beginTimelineMouseResize = (event: MouseEvent<HTMLButtonElement>) => {
    if (timelineResizeRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    startTimelineResize(event.clientY);
  };
  const resizeTimeline = (clientY: number) => {
    const activeResize = timelineResizeRef.current;

    if (!activeResize) {
      return;
    }

    onTimelineHeightChange(
      activeResize.startHeight + activeResize.startClientY - clientY,
    );
  };
  const finishTimelineResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    resizeTimeline(event.clientY);
    timelineResizeRef.current = null;
    setResizingTimeline(false);
  };
  const cancelTimelineResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    timelineResizeRef.current = null;
    setResizingTimeline(false);
  };

  useEffect(() => {
    if (!resizingTimeline) {
      return;
    }

    const handleWindowMouseMove = (event: globalThis.MouseEvent) => {
      resizeTimeline(event.clientY);
    };
    const handleWindowMouseUp = (event: globalThis.MouseEvent) => {
      resizeTimeline(event.clientY);
      timelineResizeRef.current = null;
      setResizingTimeline(false);
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [resizingTimeline]);

  function previewDragWithoutState(
    activeDrag: TimelineDraggingLayer,
    {
      currentFrame,
      sceneDuration,
    }: { currentFrame: number; sceneDuration: number },
  ): TimelineDraggingLayer {
    if (activeDrag.mode === "move") {
      const nextFrom = retimeLayerFromTimelineDrag({
        startFrame: activeDrag.startFrame,
        currentFrame,
        initialFrom: activeDrag.initialFrom,
        layerDuration: activeDrag.previewDuration,
        sceneDuration,
      });

      return { ...activeDrag, previewFrom: nextFrom };
    }

    const nextDuration = resizeLayerDurationFromTimelineDrag({
      startFrame: activeDrag.startFrame,
      currentFrame,
      initialDuration: activeDrag.duration,
      layerFrom: activeDrag.previewFrom,
      sceneDuration,
    });

    return { ...activeDrag, previewDuration: nextDuration };
  }

  return (
    <div
      className={cn(
        "relative flex min-h-0 shrink-0 flex-col border-t border-border bg-card",
        resizingTimeline ? "select-none" : "",
      )}
      style={{
        height: timelineCollapsed
          ? TIMELINE_COLLAPSED_HEIGHT
          : `min(${timelineHeight}px, max(${TIMELINE_MIN_PANEL_HEIGHT}px, calc(100% - ${TIMELINE_PREVIEW_MIN_HEIGHT}px)))`,
      }}
    >
      <button
        type="button"
        onPointerDown={beginTimelineResize}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            resizeTimeline(event.clientY);
          }
        }}
        onPointerUp={finishTimelineResize}
        onPointerCancel={cancelTimelineResize}
        onMouseDown={beginTimelineMouseResize}
        className={cn(
          "absolute inset-x-0 top-0 z-20 flex h-4 cursor-ns-resize items-start justify-center text-muted-foreground hover:text-foreground",
          resizingTimeline ? "text-foreground ring-2 ring-primary/25" : "",
        )}
        title="Resize tracks"
        aria-label="Resize tracks"
      >
        <span className="pointer-events-none flex h-4 w-20 items-center justify-center rounded-b-md border border-t-0 border-border bg-white shadow-sm">
          <GripHorizontal className="h-3.5 w-3.5" />
        </span>
      </button>

      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={
              !scene || playerState.loading || Boolean(playerState.error)
            }
            onClick={onTogglePlayback}
            className="inline-flex h-7 w-8 items-center justify-center rounded-md bg-muted text-foreground hover:bg-border disabled:cursor-not-allowed disabled:opacity-50"
            title={playerState.playing ? "Pause" : "Play"}
          >
            {playerState.playing ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
          <output className="w-24 text-center font-mono text-xs tabular-nums text-foreground">
            {scene ? formatFrameTime(playerState.frame, scene.fps) : "00:00"}
          </output>
          <button
            type="button"
            disabled={!canSplitSelectedLayer}
            onClick={onSplitSelectedLayer}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
            title="Split selected layer at playhead"
          >
            <Scissors className="h-3.5 w-3.5" />
          </button>
        </div>

        <input
          type="range"
          min={0}
          max={duration - 1}
          value={Math.min(playerState.frame, duration - 1)}
          disabled={!scene}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="mx-4 h-1.5 flex-1 accent-[hsl(var(--primary))]"
        />

        <div className="flex min-w-0 items-center gap-1.5">
          <div className="hidden w-40 truncate text-right text-xs text-muted-foreground sm:block lg:w-56">
            {exportReadiness.status}
          </div>
          <button
            type="button"
            onClick={() => onTimelineCollapsedChange(!timelineCollapsed)}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground"
            title={timelineCollapsed ? "Show tracks" : "Hide tracks"}
            aria-label={timelineCollapsed ? "Show tracks" : "Hide tracks"}
          >
            {timelineCollapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {timelineCollapsed ? null : (
        <div className="grid min-h-0 flex-1 grid-cols-[120px_minmax(0,1fr)] overflow-hidden sm:grid-cols-[164px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col border-r border-border bg-[hsl(220_14%_98%)]">
            <div className="h-6 shrink-0 border-b border-border px-3 text-[10px] font-semibold uppercase leading-6 text-muted-foreground">
              Tracks
            </div>
            <div
              ref={trackListRef}
              className="scrollbar-thin min-h-0 flex-1 overflow-y-auto"
              onScroll={() =>
                syncVerticalScroll(
                  trackListRef.current,
                  timelineScrollerRef.current,
                )
              }
            >
              {layers.length ? (
                <>
                  <div style={{ height: TIMELINE_TRACK_ROW_TOP_PADDING }} />
                  {layers.map((layer) => (
                    <TimelineTrackButton
                      key={layer.id}
                      layer={layer}
                      mediaInfo={describeTimelineMediaLayer({
                        layer,
                        mediaAssets,
                      })}
                      selected={selectedLayerId === layer.id}
                      onSelect={() => onSelectLayer(layer.id)}
                      onDelete={() => onDeleteLayer(layer.id)}
                    />
                  ))}
                  <div style={{ height: TIMELINE_CONTENT_BOTTOM_PADDING }} />
                </>
              ) : (
                <div className="px-2 py-4 text-xs leading-5 text-muted-foreground sm:px-3">
                  No tracks yet.
                </div>
              )}
            </div>
          </div>

          <div
            ref={timelineScrollerRef}
            className={cn(
              "scrollbar-thin relative min-h-0 overflow-y-auto bg-white",
              canScrub ? "cursor-col-resize touch-none" : "",
            )}
            onScroll={() =>
              syncVerticalScroll(
                timelineScrollerRef.current,
                trackListRef.current,
              )
            }
            onPointerDown={(event) => {
              if (!canScrub) {
                return;
              }

              event.currentTarget.setPointerCapture(event.pointerId);
              scrubPointerTimeline(event);
            }}
            onPointerMove={(event) => {
              if (
                !event.currentTarget.hasPointerCapture(event.pointerId) ||
                draggingLayer
              ) {
                return;
              }

              scrubPointerTimeline(event);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              commitLayerDrag(event.clientX, event.currentTarget);
            }}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              setDraggingLayer(null);
            }}
            onMouseDown={(event) => {
              scrubMouseTimeline(event);
            }}
            onMouseMove={(event) => {
              if (draggingLayer) {
                previewLayerDrag(event.clientX, event.currentTarget);
                return;
              }

              if (event.buttons !== 1) {
                return;
              }

              scrubMouseTimeline(event);
            }}
            onMouseUp={(event) =>
              commitLayerDrag(event.clientX, event.currentTarget)
            }
            aria-label="Timeline scrub area"
          >
            <div
              className="relative min-h-full"
              style={{ height: layers.length ? timelineContentHeight : "100%" }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(214_18%_86%/.8)_1px,transparent_1px)] bg-[size:64px_100%]" />
              <div
                className="absolute bottom-0 top-0 w-px bg-accent"
                style={{
                  left: `${scene ? (playerState.frame / Math.max(1, duration - 1)) * 100 : 0}%`,
                }}
              />
              <div className="pointer-events-none sticky inset-x-0 top-0 z-10 h-7 border-b border-border/70 bg-white/80 backdrop-blur-sm" />
              <div className="absolute inset-0">
                {layers.length ? (
                  layers.map((layer, index) => {
                    const mediaInfo = describeTimelineMediaLayer({
                      layer,
                      mediaAssets,
                    });
                    const dragPreview =
                      draggingLayer?.id === layer.id
                        ? draggingLayer.initialAbsoluteFrom +
                          draggingLayer.previewFrom -
                          draggingLayer.initialFrom
                        : layer.from;
                    const durationPreview =
                      draggingLayer?.id === layer.id
                        ? draggingLayer.previewDuration
                        : layer.duration;
                    const blockWidth = Math.max(
                      4,
                      (durationPreview / duration) * 100,
                    );
                    const timelineBlockStyle = {
                      top: `${index * TIMELINE_TRACK_ROW_HEIGHT + TIMELINE_BLOCK_TOP_OFFSET}px`,
                      left: `${(dragPreview / duration) * 100}%`,
                      width: `${blockWidth}%`,
                    };

                    return (
                      <div
                        key={layer.id}
                        data-timeline-block-id={layer.id}
                        className={cn(
                          "absolute flex h-7 min-w-12 overflow-hidden rounded-md border text-left text-[11px] font-medium shadow-sm transition",
                          selectedLayerId === layer.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-primary/30 bg-primary/15 text-primary hover:bg-primary/20",
                        )}
                        style={timelineBlockStyle}
                      >
                        <button
                          type="button"
                          className="grid min-w-0 flex-1 cursor-grab grid-cols-[18px_minmax(0,1fr)] items-center gap-1 px-1.5 text-left active:cursor-grabbing"
                          data-timeline-block-body-id={layer.id}
                          onPointerDown={(event) =>
                            handleLayerPointerDown("move", layer, event)
                          }
                          onPointerMove={handleLayerPointerMove}
                          onPointerUp={handleLayerPointerUp}
                          onPointerCancel={handleLayerPointerCancel}
                          onMouseDown={(event) =>
                            handleLayerMouseDown("move", layer, event)
                          }
                          onMouseMove={handleLayerMouseMove}
                          onMouseUp={handleLayerMouseUp}
                          onClick={() => onSelectLayer(layer.id)}
                        >
                          <TimelineMediaBadge
                            mediaInfo={mediaInfo}
                            selected={selectedLayerId === layer.id}
                          />
                          <span className="min-w-0">
                            <span className="block truncate leading-3">
                              {mediaInfo.label}
                            </span>
                            {mediaInfo.detailLabel ? (
                              <span
                                className={cn(
                                  "block truncate text-[9px] leading-3",
                                  selectedLayerId === layer.id
                                    ? "text-primary-foreground/72"
                                    : "text-primary/70",
                                )}
                              >
                                {mediaInfo.detailLabel}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Resize ${layer.label} duration`}
                          className={cn(
                            "flex h-full w-3 shrink-0 cursor-ew-resize items-center justify-center border-l",
                            selectedLayerId === layer.id
                              ? "border-primary-foreground/30 bg-primary-foreground/15"
                              : "border-primary/25 bg-primary/10",
                          )}
                          data-timeline-resize-end-id={layer.id}
                          onPointerDown={(event) =>
                            handleLayerPointerDown("resize-end", layer, event)
                          }
                          onPointerMove={handleLayerPointerMove}
                          onPointerUp={handleLayerPointerUp}
                          onPointerCancel={handleLayerPointerCancel}
                          onMouseDown={(event) =>
                            handleLayerMouseDown("resize-end", layer, event)
                          }
                          onMouseMove={handleLayerMouseMove}
                          onMouseUp={handleLayerMouseUp}
                        >
                          <span className="h-3 w-px rounded bg-current opacity-70" />
                        </button>
                        <button
                          type="button"
                          aria-label={deleteLayerTitle(layer)}
                          title={deleteLayerTitle(layer)}
                          className={cn(
                            "flex h-full w-6 shrink-0 items-center justify-center border-l transition",
                            selectedLayerId === layer.id
                              ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/20 hover:text-primary-foreground"
                              : "border-primary/25 bg-primary/5 text-primary/70 hover:bg-destructive/10 hover:text-destructive",
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteLayer(layer.id);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-6 text-xs text-muted-foreground sm:px-4 sm:py-8">
                    Generated layers will appear on the timeline.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineTrackButton({
  layer,
  mediaInfo,
  selected,
  onSelect,
  onDelete,
}: {
  layer: EditorLayer;
  mediaInfo: TimelineMediaInfo;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "grid h-8 w-full grid-cols-[minmax(0,1fr)_28px] items-center border-b border-border/70 text-xs",
        selected
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-center gap-2 px-2 text-left sm:px-3"
      >
        <TimelineMediaBadge mediaInfo={mediaInfo} selected={selected} />
        <span className="min-w-0">
          <span className="block truncate leading-4">{mediaInfo.label}</span>
          {mediaInfo.detailLabel ? (
            <span className="block truncate text-[10px] leading-3 text-muted-foreground">
              {mediaInfo.detailLabel}
            </span>
          ) : (
            <span className="block truncate text-[10px] leading-3 text-muted-foreground">
              {displayLayerType(layer.type)}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={cn(
          "mr-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
          selected ? "bg-white/60" : "",
        )}
        title={deleteLayerTitle(layer)}
        aria-label={deleteLayerTitle(layer)}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function TimelineMediaBadge({
  mediaInfo,
  selected,
}: {
  mediaInfo: TimelineMediaInfo;
  selected: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-sm border",
        selected
          ? "border-primary-foreground/35 bg-primary-foreground/15"
          : "border-primary/25 bg-white/65",
      )}
    >
      {mediaInfo.thumbnailUrl ? (
        <img
          src={mediaInfo.thumbnailUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <TimelineMediaIcon mediaInfo={mediaInfo} />
      )}
    </span>
  );
}

function TimelineMediaIcon({ mediaInfo }: { mediaInfo: TimelineMediaInfo }) {
  switch (mediaInfo.kind) {
    case "video":
      return <FileVideo className="h-3 w-3" />;
    case "image":
      return <ImageIcon className="h-3 w-3" />;
    case "audio":
      return <FileAudio className="h-3 w-3" />;
    default:
      return <Layers className="h-3 w-3" />;
  }
}

function timelineElementForBlock(element: HTMLElement): HTMLDivElement | null {
  const timelineElement = element.closest('[aria-label="Timeline scrub area"]');
  return timelineElement instanceof HTMLDivElement ? timelineElement : null;
}

function LayerRow({
  layer,
  selected,
  included,
  onSelect,
  onDelete,
}: {
  layer: EditorLayer;
  selected: boolean;
  included: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const title = deleteLayerTitle(layer);

  return (
    <div
      data-editor-layer-row-id={layer.id}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center rounded-md border pr-1 transition",
        selected
          ? "border-primary/40 bg-primary/10 text-foreground"
          : included
            ? "border-primary/20 bg-primary/5 text-foreground"
            : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
      )}
      style={{ paddingLeft: `${8 + layer.depth * 14}px` }}
    >
      <button
        type="button"
        onClick={onSelect}
        className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 py-2 pl-2 pr-1 text-left"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            layer.childCount ? "opacity-80" : "opacity-0",
          )}
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">
            {layer.label}
          </span>
          <span className="mt-0.5 block truncate text-[10px] uppercase text-muted-foreground">
            {layerKindLabel(layer)} · {layer.id}
          </span>
        </span>
        <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {layer.from}
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive",
          selected ? "bg-white/70" : "hover:bg-white",
        )}
        title={title}
        aria-label={title}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function deleteLayerTitle(layer: EditorLayer): string {
  return layer.descendantCount
    ? `Delete ${layer.label} block and ${layer.descendantCount} child layer${layer.descendantCount === 1 ? "" : "s"}`
    : `Delete ${layer.label}`;
}

function layerKindLabel(layer: EditorLayer): string {
  const type = displayLayerType(layer.type);

  return layer.descendantCount
    ? `${type} block · ${layer.descendantCount} ${layer.descendantCount === 1 ? "child" : "children"}`
    : type;
}

function PanelHeader({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate text-sm font-semibold">{title}</span>
      </div>
      <span className="truncate pl-2 text-[11px] text-muted-foreground">
        {detail}
      </span>
      {action ? <div className="ml-2 shrink-0">{action}</div> : null}
    </div>
  );
}

function InspectorField({
  label,
  value,
  mono = false,
  wide = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={cn(wide ? "col-span-2" : "min-w-0")}>
      <dt className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "min-h-8 overflow-hidden rounded-md border border-border bg-muted/45 px-2 py-1.5 text-foreground",
          mono ? "font-mono text-xs" : "text-sm",
        )}
        title={value}
      >
        <span className="block truncate">{value}</span>
      </dd>
    </div>
  );
}

function InspectorTextArea({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const fieldId = inspectorFieldId(label);

  return (
    <div className="col-span-2">
      <label
        htmlFor={fieldId}
        className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground"
      >
        {label}
      </label>
      <textarea
        id={fieldId}
        defaultValue={value}
        key={value}
        rows={3}
        onBlur={(event) => {
          if (event.currentTarget.value !== value) {
            onCommit(event.currentTarget.value);
          }
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className="min-h-20 w-full resize-none rounded-md border border-border bg-white px-2 py-1.5 text-sm leading-5 text-foreground outline-none focus:border-primary"
      />
    </div>
  );
}

function InspectorTextInput({
  label,
  value,
  placeholder,
  swatch = false,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  swatch?: boolean;
  onCommit: (value: string) => void;
}) {
  const fieldId = inspectorFieldId(label);

  return (
    <div className="min-w-0">
      <label
        htmlFor={fieldId}
        className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground"
      >
        {label}
      </label>
      <div className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2 focus-within:border-primary">
        {swatch ? (
          <span
            className="h-4 w-4 shrink-0 rounded-sm border border-border"
            style={{ background: value || "transparent" }}
          />
        ) : null}
        <input
          id={fieldId}
          type="text"
          defaultValue={value}
          key={value}
          placeholder={placeholder}
          onBlur={(event) => {
            if (event.currentTarget.value !== value) {
              onCommit(event.currentTarget.value);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="min-w-0 flex-1 border-0 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

function InspectorNumberInput({
  label,
  value,
  suffix,
  placeholder,
  step = "1",
  min,
  max,
  onCommit,
}: {
  label: string;
  value: string;
  suffix?: string;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
  onCommit: (value: string) => void;
}) {
  const fieldId = inspectorFieldId(label);

  return (
    <div className="min-w-0">
      <label
        htmlFor={fieldId}
        className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={fieldId}
        type="number"
        defaultValue={value}
        key={value}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        onBlur={(event) => {
          if (event.currentTarget.value !== value) {
            onCommit(event.currentTarget.value);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className="h-8 w-full rounded-md border border-border bg-white px-2 font-mono text-xs text-foreground outline-none focus:border-primary"
      />
      {suffix ? (
        <div className="mt-1 truncate text-[10px] text-muted-foreground">
          {suffix}
        </div>
      ) : null}
    </div>
  );
}

function InspectorSelectInput({
  label,
  value,
  options,
  onCommit,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onCommit: (value: string) => void;
}) {
  const fieldId = inspectorFieldId(label);

  return (
    <div className="min-w-0">
      <label
        htmlFor={fieldId}
        className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground"
      >
        {label}
      </label>
      <select
        id={fieldId}
        value={value}
        onChange={(event) => onCommit(event.currentTarget.value)}
        className="h-8 w-full rounded-md border border-border bg-white px-2 text-xs text-foreground outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function EmptyPanelText({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center p-6 text-center text-sm leading-6 text-muted-foreground">
      {text}
    </div>
  );
}

function formatBounds(bounds: EditorLayer["bounds"]): string {
  if (!bounds) {
    return "no numeric bounds";
  }

  return [
    bounds.left === undefined ? null : `x ${bounds.left}`,
    bounds.top === undefined ? null : `y ${bounds.top}`,
    bounds.width === undefined ? null : `w ${bounds.width}`,
    bounds.height === undefined ? null : `h ${bounds.height}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatOptionalNumber(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function formatOptionalStyleValue(value: number | string | undefined): string {
  return value === undefined ? "" : String(value);
}

function inspectorFieldId(label: string): string {
  return `inspector-${label.toLowerCase().replace(/\s+/g, "-")}`;
}
