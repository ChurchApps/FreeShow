import path from "path"
import { parseStringPromise } from "xml2js"
import { toApp } from "../.."
import { MAIN } from "../../../types/Channels"
import { decompressZipStream } from "../../data/zip"
import { createFolder, getDataFolderPath } from "../../utils/files"

// Extract .pptx contents (zip) and convert XML files to JSON using xml2js.
// Media and fonts are streamed directly to disk to avoid OOM with large embedded videos.
export async function pptToShow(filePath: string) {
    try {
        console.info("Starting PPT importing (zip -> xml2js) ...")

        const fileName = path.basename(filePath, path.extname(filePath))
        const importsFolder = getDataFolderPath("imports", "PowerPoint")
        const contentFolder = createFolder(path.join(importsFolder, fileName))

        // Decompress with streaming: media/fonts go directly to disk, XML/other files buffered in memory
        const entries = await decompressZipStream(filePath, true, {
            getOutputPath: (fileName: string) => {
                if (fileName.startsWith("ppt/media/") || fileName.startsWith("ppt/fonts/")) {
                    const mediaName = path.basename(fileName)
                    return path.join(contentFolder, mediaName)
                }
                return undefined
            }
        })

        const json: any = {}
        const contentPaths: { [key: string]: string } = {}

        // Process entries sequentially to avoid flooding the event loop / CPU with many
        // concurrent xml2js parses for large presentations.
        for (const entry of entries) {
            const entryName = entry.name

            // media and fonts: already written to disk, just store the path reference
            if (entryName.startsWith("ppt/media/") || entryName.startsWith("ppt/fonts/")) {
                // content is the file path when written to disk
                contentPaths[entryName] = entry.content as string
                continue
            }

            // XML files (and rels) -> parse to JSON using xml2js
            if (entryName.endsWith(".xml") || entryName.endsWith(".rels")) {
                const xmlText = typeof entry.content === "string" ? entry.content : (entry.content as Buffer).toString("utf8")
                try {
                    const parsed: any = await parseStringPromise(xmlText, { trim: true })
                    json[entryName] = parsed
                } catch (err: any) {
                    console.error("Failed to parse XML for", entryName, err)
                    // fallback to raw xml text so caller still has the data
                    json[entryName] = xmlText
                }
                continue
            }

            // other files (binary or text) - store raw buffer
            json[entryName] = entry.content
        }

        json.contentPaths = contentPaths

        return json
    } catch (err) {
        console.error("PPT convertion failed for", filePath, err)

        if (err.message.includes("Invalid or unsupported zip format")) {
            toApp(MAIN, { channel: "ALERT", data: "Invalid format" })
        }

        return null
    }
}
