// VOICE COMMAND DISPATCHER & REGISTRY
// features register a FeatureCommandSpec; the dispatcher runs each feature's stream over its
// transcript segments, enforces the declared cooldowns and wraps a recognized command in the
// generic envelope. The registry maps envelopes to executors by feature.

import type { AiCommandEnvelope } from "../../../types/ai/AiCommands"
import type { CommandContext, FeatureCommandSpec } from "./commandStream"
import { CommandStream } from "./commandStream"
import { executeScriptureCommand } from "../scripture/voiceCommands"

const DEFAULT_COOLDOWN_MS = 3000

export class CommandDispatcher {
    private entries = new Map<string, { spec: FeatureCommandSpec<any>; stream: CommandStream<any>; cooldowns: Map<string, number> }>()

    /** A fresh stream & cooldown clock per registration - registering again resets both. */
    register<C extends { type: string; phrase: string }>(spec: FeatureCommandSpec<C>): void {
        this.entries.set(spec.feature, { spec, stream: new CommandStream(spec), cooldowns: new Map() })
    }

    unregister(feature: string): void {
        this.entries.delete(feature)
    }

    /** null: feature not registered, nothing recognized, or the command is inside its cooldown window. */
    handleSegment(feature: string, segment: { text: string; endMs: number }, context: CommandContext): AiCommandEnvelope | null {
        const entry = this.entries.get(feature)
        if (!entry) return null

        const command = entry.stream.detect(segment, context)
        if (!command) return null

        // engine segments can overlap, so the same spoken command may be detected twice - cooldown per
        // command type, feature-qualified so equal command names in two features never share a clock
        const now = Date.now()
        const key = feature + ":" + command.type
        const cooldownMs = entry.spec.cooldownByType?.[command.type] ?? entry.spec.cooldownMs ?? DEFAULT_COOLDOWN_MS
        if (now - (entry.cooldowns.get(key) || 0) < cooldownMs) return null
        entry.cooldowns.set(key, now)

        const { phrase, ...rest } = command
        return { feature, command: rest, phrase } as AiCommandEnvelope
    }
}

// ===== COMMAND REGISTRY =====
// executors stay per-feature: this registry maps an envelope's feature to its executor. The
// mapped type is exhaustive over the envelope union, so a feature without an executor is a
// compile error - and the static imports keep module load order identical to a direct import

const executors: { [F in AiCommandEnvelope["feature"]]: (envelope: Extract<AiCommandEnvelope, { feature: F }>) => void } = {
    scripture: (envelope) => void executeScriptureCommand({ ...envelope.command, phrase: envelope.phrase })
}

export function dispatchAiCommand(envelope: AiCommandEnvelope): void {
    executors[envelope.feature]?.(envelope as never)
}
