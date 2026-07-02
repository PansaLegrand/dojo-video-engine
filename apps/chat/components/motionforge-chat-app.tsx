"use client";

import {
  Check,
  Copy,
  Download,
  FileJson,
  Loader2,
  PanelLeftClose,
  Redo2,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectExportCapability, exportVideo } from "@motionforge/export";
import { createPlayer, type Player } from "@motionforge/player";
import {
  disposeAssets,
  resolveAssets,
  type ResolvedAssets,
} from "@motionforge/renderer-canvas2d";
import {
  applyScenePatch,
  type Scene,
  type ScenePatch,
} from "@motionforge/schema";
import {
  createInspectorPatch,
  type InspectorEditableField,
} from "@/lib/editor/inspector-patches";
import { deriveEditorLayers, findEditorLayer } from "@/lib/editor/layers";
import {
  createSceneHistory,
  recordSceneHistory,
  redoSceneHistory,
  undoSceneHistory,
  type SceneHistory,
} from "@/lib/editor/scene-history";
import { createSplitLayerPatch } from "@/lib/editor/split-layer";
import {
  PanelSwitcher,
  PreviewWorkspace,
  TimelinePanel,
  ToolRail,
} from "@/components/editor/editor-workspace";
import { ExamplesDialog } from "@/components/editor/examples-dialog";
import type {
  ChatMessage,
  EditorPanel,
  PlayerUiState,
} from "@/components/editor/types";
import { describeExportReadiness } from "@/lib/editor/capability-messages";
import type {
  PreviewLayerBounds,
  PreviewLayerMove,
} from "@/lib/editor/preview-selection";
import {
  createChatMediaAssetManifest,
  createLocalMediaAssetShell,
  describeLargeLocalMediaAsset,
  describeLocalMediaAssetReadiness,
  probeLocalMediaAsset,
  revokeLocalMediaAssetUrls,
  type LocalMediaAsset,
} from "@/lib/media/assets";
import { createInsertLocalMediaAssetPatch } from "@/lib/media/insert";
import { promptChips } from "@/lib/motionforge/examples";
import type { MotionforgeAgentResult } from "@/lib/motionforge/local-agent";
import {
  cloneReadmeShowcaseScene,
  readmeShowcaseExamples,
  type ReadmeShowcaseExample,
} from "@/lib/motionforge/readme-showcases";

type ChatApiResponse =
  | { ok: true; result: MotionforgeAgentResult }
  | { ok: false; error: string };

const initialMessages: ChatMessage[] = [
  {
    id: "new-session",
    role: "assistant",
    content: "New session ready. Describe a video to generate the first scene.",
    source: "local",
  },
];

const DEFAULT_TIMELINE_HEIGHT = 188;
const MIN_TIMELINE_HEIGHT = 104;
const MAX_TIMELINE_HEIGHT = 420;

type SceneChangeSource =
  | "assistant"
  | "template"
  | "showcase"
  | "inspector"
  | "delete";

export function MotionforgeChatApp() {
  const [scene, setScene] = useState<Scene | null>(null);
  const [sceneHistory, setSceneHistory] = useState<SceneHistory>(() =>
    createSceneHistory(),
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [showExamples, setShowExamples] = useState(false);
  const [activePanel, setActivePanel] = useState<EditorPanel>("chat");
  const [mediaAssets, setMediaAssets] = useState<LocalMediaAsset[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<PlayerUiState>({
    loading: true,
    frame: 0,
    playing: false,
    error: null,
    exportSupported: false,
  });
  const [showJson, setShowJson] = useState(false);
  const [timelineHeight, setTimelineHeight] = useState(DEFAULT_TIMELINE_HEIGHT);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const assetsRef = useRef<ResolvedAssets | undefined>(undefined);
  const mediaAssetsRef = useRef<LocalMediaAsset[]>([]);
  const loadIdRef = useRef(0);
  const messagesScrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const durationLabel = useMemo(
    () => (scene ? `${(scene.duration / scene.fps).toFixed(1)}s` : "new"),
    [scene],
  );
  const sceneJson = useMemo(
    () => (scene ? JSON.stringify(scene, null, 2) : ""),
    [scene],
  );
  const editorLayers = useMemo(
    () => (scene ? deriveEditorLayers(scene) : []),
    [scene],
  );
  const selectedLayer = useMemo(
    () => findEditorLayer(editorLayers, selectedLayerId),
    [editorLayers, selectedLayerId],
  );
  const canUndo = Boolean(scene && sceneHistory.past.length);
  const canRedo = Boolean(scene && sceneHistory.future.length);
  const exportReadiness = useMemo(
    () =>
      describeExportReadiness({
        hasScene: Boolean(scene),
        previewLoading: playerState.loading,
        previewError: playerState.error,
        exportSupported: playerState.exportSupported,
        isExporting,
        exportStatus,
        layerCount: editorLayers.length,
      }),
    [editorLayers.length, exportStatus, isExporting, playerState, scene],
  );
  const mediaAssetManifest = useMemo(
    () => createChatMediaAssetManifest({ assets: mediaAssets, scene }),
    [mediaAssets, scene],
  );

  useEffect(() => {
    mediaAssetsRef.current = mediaAssets;
  }, [mediaAssets]);

  useEffect(() => {
    if (!scene) {
      setSelectedLayerId(null);
      return;
    }

    if (
      selectedLayerId &&
      editorLayers.some((layer) => layer.id === selectedLayerId)
    ) {
      return;
    }

    setSelectedLayerId(editorLayers[0]?.id ?? null);
  }, [editorLayers, scene, selectedLayerId]);

  useEffect(() => {
    return () => {
      for (const asset of mediaAssetsRef.current) {
        revokeLocalMediaAssetUrls(asset);
      }
    };
  }, []);

  const loadScene = useCallback(async (nextScene: Scene | null) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      setPlayerState((state) => ({
        ...state,
        loading: false,
        error: "Canvas2D is unavailable.",
      }));
      return;
    }

    const loadId = ++loadIdRef.current;
    playerRef.current?.dispose();
    playerRef.current = null;
    const previousAssets = assetsRef.current;
    assetsRef.current = undefined;
    setPlayerState((state) => ({
      ...state,
      loading: Boolean(nextScene),
      playing: false,
      frame: 0,
      error: null,
      exportSupported: detectExportCapability().videoEncoder,
    }));

    if (!nextScene) {
      canvas.width = 1080;
      canvas.height = 1920;
      context.clearRect(0, 0, canvas.width, canvas.height);
      previousAssets && disposeAssets(previousAssets);
      setPlayerState((state) => ({
        ...state,
        loading: false,
        playing: false,
        frame: 0,
        error: null,
      }));
      return;
    }

    canvas.width = nextScene.width;
    canvas.height = nextScene.height;
    context.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const assets = await resolveAssets(nextScene);

      if (loadId !== loadIdRef.current) {
        disposeAssets(assets);
        return;
      }

      previousAssets && disposeAssets(previousAssets);
      assetsRef.current = assets;

      const player = await createPlayer({
        context,
        scene: nextScene,
        assets,
        loop: true,
      });

      if (loadId !== loadIdRef.current) {
        player.dispose();
        return;
      }

      player.on("frame", (frame) => {
        setPlayerState((state) => ({ ...state, frame }));
      });
      const posterFrame = Math.min(
        Math.max(Math.round(nextScene.fps * 1.2), 0),
        nextScene.duration - 1,
      );

      playerRef.current = player;
      await player.seek(posterFrame);
      setPlayerState((state) => ({
        ...state,
        loading: false,
        frame: posterFrame,
        playing: false,
        error: null,
      }));
    } catch (error) {
      if (loadId === loadIdRef.current) {
        previousAssets && disposeAssets(previousAssets);
        setPlayerState((state) => ({
          ...state,
          loading: false,
          playing: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    }
  }, []);

  useEffect(() => {
    void loadScene(scene);

    return () => {
      loadIdRef.current += 1;
      playerRef.current?.dispose();
      playerRef.current = null;
      if (assetsRef.current) {
        disposeAssets(assetsRef.current);
        assetsRef.current = undefined;
      }
    };
  }, [loadScene, scene]);

  useEffect(() => {
    if (!showExamples) {
      return;
    }

    const closeExamples = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowExamples(false);
      }
    };

    window.addEventListener("keydown", closeExamples);

    return () => window.removeEventListener("keydown", closeExamples);
  }, [showExamples]);

  useEffect(() => {
    const scroller = messagesScrollerRef.current;

    if (!scroller) {
      return;
    }

    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }, [isSending, messages.length]);

  useEffect(() => {
    if (isSending) {
      return;
    }

    const timer = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isSending, messages.length]);

  const commitSceneChange = useCallback(
    (nextScene: Scene, source: SceneChangeSource) => {
      setSceneHistory((history) => recordSceneHistory(history, scene));
      setScene(nextScene);
      setExportStatus("");

      if (source !== "inspector") {
        setEditorError(null);
      }
    },
    [scene],
  );

  const clearMediaAssets = useCallback(() => {
    for (const asset of mediaAssetsRef.current) {
      revokeLocalMediaAssetUrls(asset);
    }

    mediaAssetsRef.current = [];
    setMediaAssets([]);
  }, []);

  const addMediaFiles = useCallback((files: File[]) => {
    const currentAssets = mediaAssetsRef.current;
    const nextAssets = [...currentAssets];
    const createdAssets: LocalMediaAsset[] = [];
    const unsupportedFiles: string[] = [];

    for (const file of files) {
      const objectUrl = URL.createObjectURL(file);
      const asset = createLocalMediaAssetShell({
        file,
        objectUrl,
        existingAssets: nextAssets,
      });

      if (!asset) {
        URL.revokeObjectURL(objectUrl);
        unsupportedFiles.push(file.name);
        continue;
      }

      nextAssets.push(asset);
      createdAssets.push(asset);
    }

    if (!createdAssets.length && unsupportedFiles.length) {
      setEditorError(`Unsupported media file: ${unsupportedFiles.join(", ")}`);
      return;
    }

    if (createdAssets.length) {
      mediaAssetsRef.current = nextAssets;
      setMediaAssets(nextAssets);
      setActivePanel("assets");
      setEditorError(
        unsupportedFiles.length
          ? `Skipped unsupported file: ${unsupportedFiles.join(", ")}`
          : null,
      );
      setExportStatus("");
    }

    for (const asset of createdAssets) {
      void probeLocalMediaAsset(asset).then((probedAsset) => {
        setMediaAssets((current) => {
          const next = current.map((item) =>
            item.id === probedAsset.id &&
            item.objectUrl === probedAsset.objectUrl
              ? probedAsset
              : item,
          );
          mediaAssetsRef.current = next;
          return next;
        });
      });
    }
  }, []);

  const removeMediaAsset = useCallback(
    (id: string) => {
      const currentAssets = mediaAssetsRef.current;
      const asset = currentAssets.find((item) => item.id === id);

      if (asset && scene?.assets[asset.sceneAssetId]) {
        setEditorError(
          `${asset.label} is used in the scene. Undo or remove the layer before removing the asset.`,
        );
        return;
      }

      if (asset) {
        revokeLocalMediaAssetUrls(asset);
      }

      const nextAssets = currentAssets.filter((item) => item.id !== id);
      mediaAssetsRef.current = nextAssets;
      setMediaAssets(nextAssets);
      setEditorError(null);
    },
    [scene],
  );

  const insertMediaAsset = useCallback(
    (id: string) => {
      const asset = mediaAssetsRef.current.find((item) => item.id === id);

      if (!asset) {
        setEditorError("Choose a media asset before adding it.");
        return;
      }

      const readiness = describeLocalMediaAssetReadiness(asset);

      if (readiness.blocksUse) {
        setEditorError(readiness.detail);
        return;
      }

      const insertResult = createInsertLocalMediaAssetPatch({
        scene,
        asset,
        insertAtFrame: playerState.frame,
      });

      if (!insertResult.ok) {
        setEditorError(insertResult.error);
        return;
      }

      const patchResult = applyScenePatch(
        insertResult.baseScene,
        insertResult.patch,
      );

      if (!patchResult.ok) {
        setEditorError(
          patchResult.errors.map((error) => error.message).join("\n"),
        );
        return;
      }

      setSceneHistory((history) =>
        recordSceneHistory(history, scene ?? insertResult.baseScene),
      );
      setScene(patchResult.scene);
      setSelectedLayerId(insertResult.nodeId);
      setEditorError(null);
      setExportStatus("");
      setShowJson(false);
      setActivePanel("layers");
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: insertResult.summary,
          source: "local",
        },
      ]);
    },
    [playerState.frame, scene],
  );

  const undoSceneChange = useCallback(() => {
    const result = undoSceneHistory(scene, sceneHistory);

    if (!result.changed) {
      return;
    }

    setScene(result.scene);
    setSceneHistory(result.history);
    setEditorError(null);
    setExportStatus("");
  }, [scene, sceneHistory]);

  const redoSceneChange = useCallback(() => {
    const result = redoSceneHistory(scene, sceneHistory);

    if (!result.changed) {
      return;
    }

    setScene(result.scene);
    setSceneHistory(result.history);
    setEditorError(null);
    setExportStatus("");
  }, [scene, sceneHistory]);

  const submitPrompt = useCallback(
    async (value?: string) => {
      const instruction = (value ?? input).trim();

      if (!instruction || isSending) {
        return;
      }

      setInput("");
      setIsSending(true);
      setExportStatus("");
      setEditorError(null);
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: instruction,
      };
      setMessages((items) => [...items, userMessage]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instruction,
            scene,
            mediaAssets: mediaAssetManifest,
            history: messages.slice(-8).map(({ role, content }) => ({
              role,
              content,
            })),
          }),
        });
        const payload = (await response.json()) as ChatApiResponse;

        if (!payload.ok) {
          throw new Error(payload.error);
        }

        commitSceneChange(payload.result.scene, "assistant");
        const firstPlanNodeId = payload.result.mediaPlan?.steps[0]?.nodeId;

        if (firstPlanNodeId) {
          setSelectedLayerId(firstPlanNodeId);
        }
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: payload.result.summary,
            source: payload.result.source,
            diagnostics: payload.result.diagnostics,
            mediaPlan: payload.result.mediaPlan,
          },
        ]);
      } catch (error) {
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: error instanceof Error ? error.message : String(error),
            diagnostics: ["The scene was not changed."],
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [commitSceneChange, input, isSending, mediaAssetManifest, messages, scene],
  );

  const togglePlayback = useCallback(() => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    if (player.playing) {
      player.pause();
      setPlayerState((state) => ({ ...state, playing: false }));
    } else {
      player.play();
      setPlayerState((state) => ({ ...state, playing: true }));
    }
  }, []);

  const seek = useCallback((frame: number) => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    player.pause();
    setPlayerState((state) => ({ ...state, playing: false, frame }));
    void player.seek(frame);
  }, []);

  const startNewSession = useCallback(() => {
    setScene(null);
    setSceneHistory(createSceneHistory());
    clearMediaAssets();
    setSelectedLayerId(null);
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "New session ready. Describe a video to generate the first scene.",
        source: "local",
      },
    ]);
    setInput("");
    setExportStatus("");
    setEditorError(null);
    setShowJson(false);
  }, [clearMediaAssets]);

  const editSelectedLayer = useCallback(
    (id: string, field: InspectorEditableField, value: string) => {
      if (!scene) {
        setEditorError("Create or load a scene before editing.");
        return;
      }

      const patchResult = createInspectorPatch(id, field, value);

      if (!patchResult.ok) {
        setEditorError(patchResult.error);
        return;
      }

      const result = applyScenePatch(scene, patchResult.patch);

      if (!result.ok) {
        setEditorError(result.errors.map((error) => error.message).join("\n"));
        return;
      }

      commitSceneChange(result.scene, "inspector");
      setEditorError(null);
      setExportStatus("");
    },
    [commitSceneChange, scene],
  );

  const retimeLayerFromTimeline = useCallback(
    (id: string, from: number) => {
      editSelectedLayer(id, "from", String(from));
    },
    [editSelectedLayer],
  );

  const resizeLayerDurationFromTimeline = useCallback(
    (id: string, duration: number) => {
      editSelectedLayer(id, "duration", String(duration));
    },
    [editSelectedLayer],
  );

  const moveLayerFromPreview = useCallback(
    (id: string, move: PreviewLayerMove | PreviewLayerBounds) => {
      if (!scene) {
        setEditorError("Create or load a scene before editing.");
        return;
      }

      const patch: ScenePatch = [
        {
          op: "setStyle",
          id,
          style: {
            left: move.left,
            top: move.top,
            ...("width" in move ? { width: move.width } : {}),
            ...("height" in move ? { height: move.height } : {}),
          },
        },
      ];
      const result = applyScenePatch(scene, patch);

      if (!result.ok) {
        setEditorError(result.errors.map((error) => error.message).join("\n"));
        return;
      }

      commitSceneChange(result.scene, "inspector");
      setSelectedLayerId(id);
      setEditorError(null);
      setExportStatus("");
    },
    [commitSceneChange, scene],
  );

  const deleteLayer = useCallback(
    (id: string) => {
      if (!scene) {
        setEditorError("Create or load a scene before deleting layers.");
        return;
      }

      const patch: ScenePatch = [{ op: "removeNode", id }];
      const result = applyScenePatch(scene, patch);

      if (!result.ok) {
        setEditorError(result.errors.map((error) => error.message).join("\n"));
        return;
      }

      commitSceneChange(result.scene, "delete");
      setSelectedLayerId(null);
      setEditorError(null);
      setExportStatus("");
      setShowJson(false);
    },
    [commitSceneChange, scene],
  );

  const splitSelectedLayerAtPlayhead = useCallback(() => {
    if (!scene || !selectedLayerId || !selectedLayer) {
      setEditorError("Select a layer before splitting.");
      return;
    }

    const splitResult = createSplitLayerPatch({
      scene,
      nodeId: selectedLayerId,
      splitFrame: playerState.frame - selectedLayer.parentFrom,
    });

    if (!splitResult.ok) {
      setEditorError(splitResult.error);
      return;
    }

    const result = applyScenePatch(scene, splitResult.patch);

    if (!result.ok) {
      setEditorError(result.errors.map((error) => error.message).join("\n"));
      return;
    }

    commitSceneChange(result.scene, "inspector");
    setSelectedLayerId(splitResult.leftId);
    setEditorError(null);
    setExportStatus("");
  }, [
    commitSceneChange,
    playerState.frame,
    scene,
    selectedLayer,
    selectedLayerId,
  ]);

  const exportCurrentScene = useCallback(async () => {
    if (!scene || exportReadiness.disabled) {
      return;
    }

    setIsExporting(true);
    setExportStatus(
      describeLargeUsedLocalMediaForExport(scene, mediaAssetsRef.current) ??
        "Starting export...",
    );

    try {
      const { blob, codec, totalFrames } = await exportVideo({
        scene,
        assets: assetsRef.current,
        onProgress: ({ frameIndex, totalFrames: total }) => {
          setExportStatus(`Encoding ${frameIndex + 1}/${total}`);
        },
      });
      downloadBlob(blob, `motionforge-chat-${Date.now()}.mp4`);
      setExportStatus(
        `MP4 ready · ${(blob.size / 1024).toFixed(0)} KiB · ${codec} · ${totalFrames} frames`,
      );
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsExporting(false);
    }
  }, [exportReadiness.disabled, scene]);

  const copySceneJson = useCallback(async () => {
    if (!sceneJson) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sceneJson);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1400);
    } catch {
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    }
  }, [sceneJson]);

  const selectExample = useCallback((example: string) => {
    setInput(example);
    setShowExamples(false);
  }, []);

  const selectMediaPlanStep = useCallback((nodeId: string) => {
    setSelectedLayerId(nodeId);
    setActivePanel("layers");
  }, []);

  const loadReadmeShowcase = useCallback(
    (example: ReadmeShowcaseExample) => {
      commitSceneChange(cloneReadmeShowcaseScene(example), "template");
      setSelectedLayerId(null);
      setExportStatus("");
      setCopyStatus("idle");
      setEditorError(null);
      setShowJson(false);
      setShowExamples(false);
      setActivePanel("layers");
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Loaded starter template: ${example.title}.`,
          source: "local",
          diagnostics: [`Source JSON: ${example.jsonPath}`],
        },
      ]);
    },
    [commitSceneChange],
  );
  const changeTimelineHeight = useCallback((height: number) => {
    setTimelineHeight(
      Math.min(
        MAX_TIMELINE_HEIGHT,
        Math.max(MIN_TIMELINE_HEIGHT, Math.round(height)),
      ),
    );
  }, []);

  return (
    <main className="h-[100dvh] min-h-0 overflow-hidden bg-[hsl(220_14%_96%)] text-foreground">
      <div className="grid h-full min-h-0 grid-rows-[48px_minmax(180px,34dvh)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[56px_460px_minmax(0,1fr)] lg:grid-rows-1">
        <ToolRail activePanel={activePanel} onPanelChange={setActivePanel} />

        <aside className="flex min-h-0 min-w-0 flex-col border-b border-border bg-card lg:border-b-0 lg:border-r">
          <PanelSwitcher
            activePanel={activePanel}
            messages={messages}
            messagesScrollerRef={messagesScrollerRef}
            textareaRef={textareaRef}
            input={input}
            isSending={isSending}
            scene={scene}
            mediaAssets={mediaAssets}
            durationLabel={durationLabel}
            editorLayers={editorLayers}
            selectedLayer={selectedLayer}
            selectedLayerId={selectedLayerId}
            fps={scene?.fps ?? 30}
            onInputChange={setInput}
            onSubmitPrompt={submitPrompt}
            onShowExamples={() => setShowExamples(true)}
            onNewSession={startNewSession}
            onAddMediaFiles={addMediaFiles}
            onInsertMediaAsset={insertMediaAsset}
            onRemoveMediaAsset={removeMediaAsset}
            onSelectLayer={setSelectedLayerId}
            onDeleteLayer={deleteLayer}
            onSelectPlanStep={selectMediaPlanStep}
            onEditLayer={editSelectedLayer}
          />
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 lg:h-12 lg:flex-nowrap lg:py-0">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setActivePanel("chat")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground lg:hidden"
                title="Open assistant"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold">
                  motionforge editor
                </h1>
                <p className="truncate text-[11px] text-muted-foreground">
                  {scene
                    ? `${scene.width}x${scene.height} · ${scene.fps}fps · ${durationLabel} · ${editorLayers.length} layers`
                    : "New draft"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={undoSceneChange}
                disabled={!canUndo}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Undo"
                title="Undo"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={redoSceneChange}
                disabled={!canRedo}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Redo"
                title="Redo"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowJson((value) => !value)}
                disabled={!scene}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-2.5"
                title={showJson ? "Hide JSON" : "View JSON"}
              >
                <FileJson className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {showJson ? "Hide JSON" : "JSON"}
                </span>
              </button>
              <button
                type="button"
                onClick={exportCurrentScene}
                disabled={exportReadiness.disabled}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-foreground shadow-sm hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3"
                title={exportReadiness.title}
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <PreviewWorkspace
              canvasRef={canvasRef}
              scene={scene}
              playerState={playerState}
              selectedLayer={selectedLayer}
              onMoveLayer={moveLayerFromPreview}
            />

            <TimelinePanel
              scene={scene}
              layers={editorLayers}
              mediaAssets={mediaAssets}
              selectedLayerId={selectedLayerId}
              playerState={playerState}
              exportStatus={exportStatus}
              timelineHeight={timelineHeight}
              timelineCollapsed={timelineCollapsed}
              onSelectLayer={setSelectedLayerId}
              onTogglePlayback={togglePlayback}
              onSeek={seek}
              onRetimeLayer={retimeLayerFromTimeline}
              onResizeLayerDuration={resizeLayerDurationFromTimeline}
              onSplitSelectedLayer={splitSelectedLayerAtPlayhead}
              onDeleteLayer={deleteLayer}
              onTimelineHeightChange={changeTimelineHeight}
              onTimelineCollapsedChange={setTimelineCollapsed}
            />
          </div>

          {showJson ? (
            <div className="h-44 border-t border-border bg-[hsl(220_18%_12%)] sm:h-56">
              <div className="flex h-10 items-center justify-between border-b border-white/10 px-4">
                <span className="text-xs font-medium uppercase text-[hsl(180_40%_78%)]">
                  Scene JSON
                </span>
                <button
                  type="button"
                  onClick={copySceneJson}
                  className="inline-flex h-7 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-2.5 text-xs text-[hsl(180_40%_86%)] hover:bg-white/15"
                >
                  {copyStatus === "copied" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copyStatus === "copied"
                    ? "Copied"
                    : copyStatus === "error"
                      ? "Copy failed"
                      : "Copy JSON"}
                </button>
              </div>
              <pre className="scrollbar-thin h-[calc(100%-2.5rem)] overflow-auto p-4 font-mono text-xs leading-5 text-[hsl(180_50%_86%)]">
                {sceneJson}
              </pre>
            </div>
          ) : null}
          {editorError ? (
            <div className="flex min-h-10 shrink-0 items-center gap-2 border-t border-border bg-card px-3 py-2 text-xs sm:gap-3 sm:px-4">
              <span className="min-w-0 truncate text-destructive">
                {editorError}
              </span>
            </div>
          ) : null}
        </section>
      </div>

      {showExamples ? (
        <ExamplesDialog
          templates={readmeShowcaseExamples}
          prompts={promptChips.slice(0, 5)}
          onLoadTemplate={loadReadmeShowcase}
          onSelectPrompt={selectExample}
          onClose={() => setShowExamples(false)}
        />
      ) : null}
    </main>
  );
}

function describeLargeUsedLocalMediaForExport(
  scene: Scene,
  assets: LocalMediaAsset[],
) {
  const largestAsset = assets
    .filter((asset) => scene.assets[asset.sceneAssetId])
    .sort((left, right) => right.sizeBytes - left.sizeBytes)[0];
  const warning = largestAsset
    ? describeLargeLocalMediaAsset(largestAsset.sizeBytes)
    : null;

  return largestAsset && warning
    ? `Starting export · ${largestAsset.label}: ${warning}`
    : null;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
