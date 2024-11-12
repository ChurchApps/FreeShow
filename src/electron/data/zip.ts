import AdmZip from "adm-zip"
import { getExtension } from "../utils/files"

// https://www.npmjs.com/package/adm-zip

export function decompress(files: string[]) {
    let data: any[] = []

    files.forEach((file) => {
        const zip = new AdmZip(file)
        const zipEntries = zip.getEntries()

        zipEntries.forEach((zipEntry) => {
            let content: Buffer | string = zipEntry.getData()
            const name = zipEntry.entryName
            const extension = getExtension(name)

            if (extension !== "pro") content = content.toString("utf8")

            data.push({ content, name, extension })
        })
    })

    return data
}
