import { writeFileSync } from "fs"
import path from "path"
import pdf from "pdf2img-electron"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"
import { dataFolderNames, makeDir } from "../utils/files"

// this should not return a promise to "responses.ts"
export function convertPDFToImages(data: { dataPath: string; path: string }) {
    PDFtoIMG(data)
}

async function PDFtoIMG(data: { dataPath: string; path: string }) {
    const PDF = pdf(data.path)
    let imageBuffers: Buffer[] = []

    try {
        imageBuffers = await PDF.toPNG({ scale: 1.5 })
    } catch (err) {
        // try two times
        try {
            imageBuffers = await PDF.toPNG({ scale: 1.5 })
        } catch (err) {
            console.error(err)
        }
    }

    let outputPath = path.join(data.dataPath, dataFolderNames.imports, PDF.name)
    makeDir(outputPath)

    let images: string[] = []

    for (let i = 0; i < imageBuffers.length; i++) {
        const image = imageBuffers[i]
        const p = path.join(outputPath, i + 1 + ".png")
        images.push(p)
        writeFileSync(p, image)
    }

    if (images.length) toApp(MAIN, { channel: "IMAGES_TO_SHOW", data: { images, name: PDF.name } })
}
