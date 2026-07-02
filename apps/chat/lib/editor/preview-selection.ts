import type { EditorLayer } from "./layers";

export type PreviewCanvasRect = {
  width: number;
  height: number;
};

export type PreviewSelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PreviewSelectionOverlay =
  | {
      kind: "bounds";
      rect: PreviewSelectionRect;
      label: string;
      visible: boolean;
    }
  | {
      kind: "unbounded";
      label: string;
      visible: boolean;
    };

export type PreviewLayerMove = {
  left: number;
  top: number;
};

export type PreviewLayerResizeHandle =
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw";

export type PreviewLayerBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function createPreviewSelectionOverlay({
  layer,
  sceneWidth,
  sceneHeight,
  canvasRect,
  frame,
}: {
  layer: EditorLayer | null;
  sceneWidth: number;
  sceneHeight: number;
  canvasRect: PreviewCanvasRect;
  frame: number;
}): PreviewSelectionOverlay | null {
  if (!layer) {
    return null;
  }

  const visible = frame >= layer.from && frame < layer.end;
  const label = layer.descendantCount
    ? `${layer.label} · block`
    : `${layer.label} · ${layer.type}`;

  if (!layer.bounds || sceneWidth <= 0 || sceneHeight <= 0) {
    return { kind: "unbounded", label, visible };
  }

  const scaleX = canvasRect.width / sceneWidth;
  const scaleY = canvasRect.height / sceneHeight;
  const left = (layer.bounds.left ?? 0) * scaleX;
  const top = (layer.bounds.top ?? 0) * scaleY;
  const width = Math.max(1, (layer.bounds.width ?? sceneWidth) * scaleX);
  const height = Math.max(1, (layer.bounds.height ?? sceneHeight) * scaleY);

  return {
    kind: "bounds",
    label,
    visible,
    rect: { left, top, width, height },
  };
}

export function movePreviewLayerBoundsFromDrag({
  initialLeft,
  initialTop,
  startClientX,
  startClientY,
  currentClientX,
  currentClientY,
  sceneWidth,
  sceneHeight,
  canvasRect,
}: {
  initialLeft: number;
  initialTop: number;
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
  sceneWidth: number;
  sceneHeight: number;
  canvasRect: PreviewCanvasRect;
}): PreviewLayerMove {
  if (
    sceneWidth <= 0 ||
    sceneHeight <= 0 ||
    canvasRect.width <= 0 ||
    canvasRect.height <= 0
  ) {
    return { left: initialLeft, top: initialTop };
  }

  const sceneDeltaX =
    ((currentClientX - startClientX) / canvasRect.width) * sceneWidth;
  const sceneDeltaY =
    ((currentClientY - startClientY) / canvasRect.height) * sceneHeight;

  return {
    left: Math.round(initialLeft + sceneDeltaX),
    top: Math.round(initialTop + sceneDeltaY),
  };
}

export function resizePreviewLayerBoundsFromDrag({
  handle,
  initialLeft,
  initialTop,
  initialWidth,
  initialHeight,
  startClientX,
  startClientY,
  currentClientX,
  currentClientY,
  sceneWidth,
  sceneHeight,
  canvasRect,
  minSize = 8,
}: {
  handle: PreviewLayerResizeHandle;
  initialLeft: number;
  initialTop: number;
  initialWidth: number;
  initialHeight: number;
  startClientX: number;
  startClientY: number;
  currentClientX: number;
  currentClientY: number;
  sceneWidth: number;
  sceneHeight: number;
  canvasRect: PreviewCanvasRect;
  minSize?: number;
}): PreviewLayerBounds {
  if (
    sceneWidth <= 0 ||
    sceneHeight <= 0 ||
    canvasRect.width <= 0 ||
    canvasRect.height <= 0
  ) {
    return {
      left: initialLeft,
      top: initialTop,
      width: initialWidth,
      height: initialHeight,
    };
  }

  const sceneDeltaX =
    ((currentClientX - startClientX) / canvasRect.width) * sceneWidth;
  const sceneDeltaY =
    ((currentClientY - startClientY) / canvasRect.height) * sceneHeight;
  const leftEdge = initialLeft;
  const rightEdge = initialLeft + initialWidth;
  const topEdge = initialTop;
  const bottomEdge = initialTop + initialHeight;
  let nextLeft = leftEdge;
  let nextRight = rightEdge;
  let nextTop = topEdge;
  let nextBottom = bottomEdge;

  if (handle.includes("w")) {
    nextLeft = Math.min(leftEdge + sceneDeltaX, rightEdge - minSize);
  }

  if (handle.includes("e")) {
    nextRight = Math.max(rightEdge + sceneDeltaX, leftEdge + minSize);
  }

  if (handle.includes("n")) {
    nextTop = Math.min(topEdge + sceneDeltaY, bottomEdge - minSize);
  }

  if (handle.includes("s")) {
    nextBottom = Math.max(bottomEdge + sceneDeltaY, topEdge + minSize);
  }

  return {
    left: Math.round(nextLeft),
    top: Math.round(nextTop),
    width: Math.round(nextRight - nextLeft),
    height: Math.round(nextBottom - nextTop),
  };
}
