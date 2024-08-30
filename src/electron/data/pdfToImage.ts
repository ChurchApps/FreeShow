import { writeFileSync } from "original-fs"
import path from "path"
import pdf from "pdf2img-electron"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"
import { dataFolderNames, makeDir } from "../utils/files"

export async function convertPDFToImages(data: { dataPath: string; path: string }) {
    const PDF = pdf(data.path)
    const imageBuffers = await PDF.toPNG({ scale: 2 })

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
