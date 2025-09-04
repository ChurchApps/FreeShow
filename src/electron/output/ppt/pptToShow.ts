import path from 'path'
// @ts-ignore (strange Rollup TS build problem, suddenly not realizing that the decleration exists)
import PPTX2Json from "pptx2json"
import { createFolder, dataFolderNames, writeFile } from "../../utils/files"

export async function pptToShow(filePath: string, dataPath: string) {
    const pptx2json = new PPTX2Json()
    const json = await pptx2json.toJson(filePath)

    const fileName = path.basename(filePath, path.extname(filePath))
    const mediaFolder = createFolder(path.join(dataPath, dataFolderNames.imports, "PowerPoint", fileName))

    let mediaPaths: { [key: string]: string } = {}

    // save images
    Object.keys(json).forEach(key => {
        if (key.includes("ppt/media/image")) {
            if (key.includes("jpg")) {
                // get actual title?
                const fileName = key.slice(key.lastIndexOf("/") + 1)
                const binary: Buffer = json[key]
                const filePath = path.join(mediaFolder, fileName)
                writeFile(filePath, binary)
                delete json[key]
                mediaPaths[key] = filePath
            }
        }
    })

    json.mediaPaths = mediaPaths

    return json
}


// import { extractPptx } from 'pptx-content-extractor'

// export async function pptToShow(filePath: string) {
//     const result = await extractPptx(filePath)

//     const media = result.media
//     const notes = result.notes
//     console.log(media.length, notes)

//     for (let i = 0; i < result.slides.length; i++) {
//         const slide = result.slides[i]
//         const mediaNames = slide.mediaNames
//         console.log(mediaNames)

//         for (const item of slide.content) {
//             console.log(i, item)
//         }
//     }

//     return {}
// }