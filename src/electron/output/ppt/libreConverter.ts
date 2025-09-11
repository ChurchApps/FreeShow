import fs from "fs"
import libre from "libreoffice-convert"
import path from "path"
import { promisify } from "util"
import { isWindows } from "../.."
import { ToMain } from "../../../types/IPC/ToMain"
import { sendToMain } from "../../IPC/main"
import { openURL } from "../../IPC/responsesMain"
import { createFolder, dataFolderNames, selectFilesDialog } from "../../utils/files"

const convertAsync = promisify(libre.convert)

export function libreConvert(data: { type: string, dataPath: string }) {
    if (data.type === "powerpoint") {
        const files: string[] = selectFilesDialog("", { name: "PowerPoint", extensions: ["ppt", "pptx"] }, false)
        if (!files.length) return

        const pptPath = files[0]

        const ext = path.extname(pptPath)
        const fileName = path.basename(pptPath, ext)
        const outputFolder = createFolder(path.join(data.dataPath, dataFolderNames.imports, "PowerPoint"))
        const pdfPath = path.join(outputFolder, fileName + ".pdf")

        convertPptToPdf(pptPath, pdfPath)
    }
}

async function convertPptToPdf(inputPath: string, outputPath: string) {
    const ext = ".pdf"
    const file = fs.readFileSync(inputPath)

    try {
        const pdfBuf = await convertAsync(file, ext, undefined)
        sendToMain(ToMain.ALERT, "popup.importing")

        fs.writeFileSync(outputPath, pdfBuf)
        sendToMain(ToMain.IMPORT2, { channel: "pdf", data: [outputPath] })
    } catch (err) {
        if (err.message === "Could not find soffice binary") {
            if (isWindows) {
                sendToMain(ToMain.ALERT, "LibreOffice is not installed or not found in default location.<br>Upon installation, it's recommended to enable the 'Add to PATH' option.")
            } else {
                sendToMain(ToMain.TOAST, "LibreOffice is not installed or not found")
            }

            setTimeout(() => openURL("https://www.libreoffice.org/download/download-libreoffice/"), 500)
            return
        }

        console.error("Error converting file:", err)
        sendToMain(ToMain.TOAST, err.message)
    }
}