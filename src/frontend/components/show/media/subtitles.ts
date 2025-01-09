// Convert SRT subtitle format to WebVTT
export function SRTtoVTT(srt: string) {
    // normalize line breaks
    srt = srt.replace(/\r\n|\r/g, "\n")

    let vtt = "WEBVTT\n\n"
    const srtBlocks = srt.split("\n\n")

    srtBlocks.forEach((block) => {
        const lines = block.split("\n")
        if (lines.length < 2) return

        let timestampIndex = 0
        if (!/\d+/.test(lines[0])) timestampIndex = 0
        else timestampIndex = 1

        // convert timestamps from SRT (00:00:00,000) to VTT format (00:00:00.000)
        let timestamp = lines[timestampIndex].replaceAll(",", ".")

        const subtitleText = lines
            .slice(timestampIndex + 1)
            .join("\n")
            .trim()
        vtt += `${timestamp}\n${subtitleText}\n\n`
    })

    return vtt.trim()
}
