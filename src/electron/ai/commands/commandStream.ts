// VOICE COMMAND STREAM
// the generic utterance stream every voice feature shares: recent segments are joined (a pause
// mid-command splits it - "next" / "verse"), and a command only fires when the NEWEST segment
// completes it, so text that already fired (or failed) never re-fires from later joins.
// Features declare their matcher and policies in a FeatureCommandSpec - the stream owns the clocks.

const SEGMENT_JOIN_MS = 4000

export interface CommandContext {
    // a passage is live on the output (reading in progress) - features gate shortcuts on it
    anchored?: boolean
}

export interface FeatureCommandSpec<C extends { type: string; phrase: string }> {
    feature: string // qualifies cooldown keys & the command envelope
    // the feature's matcher, run against the joined recent speech
    match: (joinedText: string, context: CommandContext) => C | null
    // the matcher's own text normalization - used only to compute the re-fire boundary, so the
    // boundary math sees the same text the matcher saw (default: the raw text)
    normalize?: (text: string) => string
    segmentJoinMs?: number // default 4000
    cooldownMs?: number // per command type, default 3000 - enforced by the dispatcher
    cooldownByType?: { [commandType: string]: number } // per-command override
    // a whole-utterance shape that acts without the matcher, tested against the RAW newest
    // segment only ("next" alone while a passage is live)
    contextShortcuts?: {
        when: (context: CommandContext) => boolean
        pattern: RegExp
        command: (rawSegmentText: string) => C
    }[]
    // a short reply that only means something right after one of the feature's own commands
    // ("another one" after a translation switch) - checked only when the matcher declined,
    // clocked on segment time against the last detected command
    followUps?: {
        appliesAfter: (lastCommandType: string) => boolean
        windowMs: number
        pattern: RegExp
        command: (cleanedPhrase: string) => C
    }[]
}

export class CommandStream<C extends { type: string; phrase: string }> {
    private segments: { text: string; endMs: number }[] = []
    private lastCommandType = ""
    private lastCommandAtMs = 0

    constructor(private spec: FeatureCommandSpec<C>) {}

    detect(segment: { text: string; endMs: number }, context: CommandContext = {}): C | null {
        const joinMs = this.spec.segmentJoinMs ?? SEGMENT_JOIN_MS
        this.segments.push(segment)
        while (this.segments.length > 1 && segment.endMs - this.segments[0].endMs > joinMs) this.segments.shift()

        // whole-utterance shortcuts see the raw newest segment - inside a sentence they never stand alone
        for (const shortcut of this.spec.contextShortcuts || []) {
            if (shortcut.when(context) && shortcut.pattern.test(segment.text)) return this.record(shortcut.command(segment.text), segment.endMs)
        }

        const joined = this.segments.map((entry) => entry.text).join(" ")
        const command = this.spec.match(joined, context)
        if (!command) {
            for (const followUp of this.spec.followUps || []) {
                const match = followUp.pattern.exec(joined)
                if (match && followUp.appliesAfter(this.lastCommandType) && segment.endMs - this.lastCommandAtMs <= followUp.windowMs) {
                    return this.record(followUp.command(match[0].replace(/^[^a-z0-9]+/i, "").replace(/[\s.,!?]+$/, "")), segment.endMs)
                }
            }
            return null
        }

        // the matched phrase must reach into the newest segment - an instruction wholly inside older text already
        // had its chance when that text was newest (normalization is word-by-word, so lengths compose across the join)
        const withoutNewest = this.segments
            .slice(0, -1)
            .map((entry) => entry.text)
            .join(" ")
        const normalize = this.spec.normalize || ((text: string) => text)
        const boundary = withoutNewest ? normalize(withoutNewest).length : 0
        const at = normalize(joined).lastIndexOf(command.phrase)
        if (at >= 0 && at + command.phrase.length <= boundary) return null

        return this.record(command, segment.endMs)
    }

    private record(command: C, atMs: number): C {
        this.lastCommandType = command.type
        this.lastCommandAtMs = atMs
        return command
    }
}
