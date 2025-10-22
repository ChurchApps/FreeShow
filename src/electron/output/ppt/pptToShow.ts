import AdmZip from 'adm-zip'
import path from 'path'
import { parseStringPromise } from 'xml2js'
import { toApp } from "../.."
import { MAIN } from "../../../types/Channels"
import { createFolder, dataFolderNames, writeFile } from '../../utils/files'

// Extract .pptx contents directly from the ZIP using adm-zip and convert XML files to JSON
// using xml2js. Media and fonts are written to disk and referenced in json.contentPaths
export async function pptToShow(filePath: string, dataPath: string) {
    try {
        console.info('Starting PPT importing (zip -> xml2js) ...')

        const fileName = path.basename(filePath, path.extname(filePath))
        const contentFolder = createFolder(path.join(dataPath, dataFolderNames.imports, 'PowerPoint', fileName))

        const zip = new AdmZip(filePath)
        const entries = zip.getEntries()

        const json: any = {}
        const contentPaths: { [key: string]: string } = {}

        // Process entries sequentially to avoid flooding the event loop / CPU with many
        // concurrent xml2js parses for large presentations.
        for (const entry of entries) {
            if (entry.isDirectory) continue
            const entryName = entry.entryName

            // media and fonts: extract directly to disk and reference via contentPaths
            if (entryName.startsWith('ppt/media/') || entryName.startsWith('ppt/fonts/')) {
                const mediaName = path.basename(entryName)
                const mediaPath = path.join(contentFolder, mediaName)
                try {
                    // extractEntryTo writes the entry directly to disk without buffering the whole
                    // file into memory (avoids OOM with very large embedded videos)
                    // targetPath is a directory; maintainEntryPath=false ensures the file is
                    // written into the contentFolder and not nested by its original path.
                    zip.extractEntryTo(entryName, contentFolder, false, true)
                    contentPaths[entryName] = mediaPath
                } catch (err) {
                    console.error('Failed to extract media entry to disk', entryName, mediaPath, err)
                    // last resort: try to read into memory (may fail if OOM)
                    try {
                        const data = entry.getData()
                        writeFile(mediaPath, data)
                        contentPaths[entryName] = mediaPath
                    } catch (err2) {
                        console.error('Fallback write also failed for', mediaPath, err2)
                    }
                }
                continue
            }

            // XML files (and rels) -> parse to JSON using xml2js
            if (entryName.endsWith('.xml') || entryName.endsWith('.rels')) {
                const xmlText = entry.getData().toString('utf8')
                try {
                    // explicitArray: false, mergeAttrs: true, 
                    const parsed: any = await parseStringPromise(xmlText, { trim: true })
                    json[entryName] = parsed
                } catch (err: any) {
                    console.error('Failed to parse XML for', entryName, err)
                    // fallback to raw xml text so caller still has the data
                    json[entryName] = xmlText
                }
                continue
            }

            // other files (binary or text) - store raw buffer for now
            try {
                const data = entry.getData()
                json[entryName] = data
            } catch (err) {
                console.error('Failed to read entry', entryName, err)
            }
        }

        json.contentPaths = contentPaths

        return json
    } catch (err) {
        console.error('PPT convertion failed for', filePath, err)

        if (err.message.includes('Invalid or unsupported zip format')) {
            toApp(MAIN, { channel: "ALERT", data: "Invalid format" })
        }

        return null
    }
}