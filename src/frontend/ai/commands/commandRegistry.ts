// VOICE COMMAND DISPATCH
// executors stay per-feature: this registry maps an envelope's feature to its executor. The
// mapped type is exhaustive over the envelope union, so a feature without an executor is a
// compile error - and the static imports keep module load order identical to a direct import

import type { AiCommandEnvelope } from "../../../types/ai/AiCommands"
import { executeScriptureCommand } from "../scripture/voiceCommands"

const executors: { [F in AiCommandEnvelope["feature"]]: (envelope: Extract<AiCommandEnvelope, { feature: F }>) => void } = {
    scripture: (envelope) => void executeScriptureCommand({ ...envelope.command, phrase: envelope.phrase })
}

export function dispatchAiCommand(envelope: AiCommandEnvelope): void {
    executors[envelope.feature]?.(envelope as never)
}
