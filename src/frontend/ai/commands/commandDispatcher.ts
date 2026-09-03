// VOICE COMMAND DISPATCHER
// features register a FeatureCommandSpec; the dispatcher runs each feature's stream over its
// transcript segments, enforces the declared cooldowns and wraps a recognized command in the
// generic envelope the renderer routes by feature

import type { AiCommandEnvelope } from "../../../types/ai/AiCommands"
import type { CommandContext, FeatureCommandSpec } from "./commandStream"
import { CommandStream } from "./commandStream"

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
