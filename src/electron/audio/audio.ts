import { parseFile } from "music-metadata"

export async function getAudioMetadata(filePath: string) {
    if (!filePath) return null

    try {
        const metadata = await parseFile(filePath)
        return metadata?.common || null
    } catch (err: any) {
        console.error("Error parsing audio metadata:", err.message)
        return null
    }
}
