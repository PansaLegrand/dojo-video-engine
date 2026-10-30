import { z } from "zod/v3";
import {
  expandMacroNodeInput,
  registerMacro,
} from "@dojo-video-engine/presets/macros";

export const calloutMacro = {
  name: "example.callout",
  description: "Small typed text-callout macro starter.",
  usage: '{"macro":"example.callout","text":"Ship it"}',
  params: z.object({ text: z.string().min(1).max(120) }).strict(),
  expand({ text }, runtime) {
    return {
      id: runtime.uniqueId("example-callout"),
      type: "text",
      text,
      style: {
        position: "absolute",
        left: 48,
        top: 48,
        fontSize: 48,
        color: "#ffffff",
      },
    };
  },
};

registerMacro(calloutMacro);

export function expandCallout(text = "Ship it") {
  return expandMacroNodeInput(
    { macro: "example.callout", text },
    { width: 320, height: 180, fps: 30, duration: 30 },
  );
}
