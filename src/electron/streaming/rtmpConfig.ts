export interface StreamConfig {
    /** dimensions to broadcast at */
    width: number
    height: number
    fps: number
    bitrate: number
    enableAudio: boolean
    /** "auto", an explicit encoder id, or undefined */
    encoder?: string
}

/** Destination changes are relay-only; anything here means the encoder has to be respawned. */
export function configRequiresRestart(prev: StreamConfig, next: StreamConfig): boolean {
    return prev.width !== next.width || prev.height !== next.height || prev.fps !== next.fps || prev.bitrate !== next.bitrate || prev.enableAudio !== next.enableAudio || prev.encoder !== next.encoder
}

export function buildDestinationUrl(destination: { url: string; key: string }): string {
    const url = destination.url.replace(/\/+$/, "")
    return destination.key ? `${url}/${destination.key}` : url
}
