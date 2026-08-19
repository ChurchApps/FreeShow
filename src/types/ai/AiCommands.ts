// GENERIC VOICE COMMANDS
// one IPC event carries every feature's recognized voice commands from the electron matcher to
// the renderer - the feature field discriminates the envelope, so a future feature (slides,
// shows...) extends this union and the renderer's executor registry is compile-checked against it

import type { AiScriptureCommand } from "./AiScripture"

export type AiCommandEnvelope = { feature: "scripture"; command: AiScriptureCommand; phrase: string }
