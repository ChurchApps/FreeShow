import path from 'path'
// @ts-ignore (strange Rollup TS build problem, suddenly not realizing that the declaration exists)
import PPTX2Json from "pptx2json"
import { createFolder, dataFolderNames, writeFile } from "../../utils/files"

export async function pptToShow(filePath: string, dataPath: string) {
    const pptx2json = new PPTX2Json()
    const json = await pptx2json.toJson(filePath)

    const fileName = path.basename(filePath, path.extname(filePath))
    const contentFolder = createFolder(path.join(dataPath, dataFolderNames.imports, "PowerPoint", fileName))

    let contentPaths: { [key: string]: string } = {}

    // save images / fonts
    Object.keys(json).forEach(key => {
        // get actual image title?
        if (key.includes("ppt/media/image") || key.includes("ppt/fonts/")) {
            const fileName = key.slice(key.lastIndexOf("/") + 1)
            const binary: Buffer = json[key]
            const filePath = path.join(contentFolder, fileName)
            writeFile(filePath, binary)
            delete json[key]
            contentPaths[key] = filePath
        }
    })

    json.contentPaths = contentPaths

    return json
}