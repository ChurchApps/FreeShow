// AI AUTO SCRIPTURE - transcription driver contract
// Both the whisper.cpp Transcriber and the streaming Nemotron driver implement this,
// so the session in index.ts can swap engines without knowing how either one works.

/** A finished piece of transcript. Timings are relative to the start of the session. */
export interface TranscriberSegment {
    text: string
    startMs: number
    endMs: number
    language?: string // detected language of the window (whisper cli -oj with "-l auto" only)
    music?: boolean // marked as sung content - lyrics are unreliable & never feed detection
}

export interface TranscriptionDriver {
    /** Prepare the engine. Rejects if the model/binary cannot be loaded. */
    start(): Promise<void>
    /** Release everything. Safe to call more than once. */
    stop(): Promise<void>
    /** Int16 LE PCM @ 16 kHz mono, as sent by the renderer. */
    pushAudio(buffer: Uint8Array): void
}

export interface DriverCallbacks {
    onSegment: (segment: TranscriberSegment) => void
    onError: (message: string) => void
}
