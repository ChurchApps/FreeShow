import { execFile } from "child_process"
import fs from "fs"
import path from "path"
import { promisify } from "util"
import { isWindows } from "../.."
import { ToMain } from "../../../types/IPC/ToMain"
import { sendToMain } from "../../IPC/main"
import { openURL } from "../../IPC/responsesMain"
import { getDataFolderPath, selectFilesDialog, sanitizeFileName } from "../../utils/files"

const execFileAsync = promisify(execFile)

function getSofficePath(): string {
    const defaultPaths: Record<string, string[]> = {
        win32: [path.join(process.env.PROGRAMFILES || "C:\\Program Files", "LibreOffice", "program", "soffice.exe"), path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "LibreOffice", "program", "soffice.exe")],
        darwin: ["/Applications/LibreOffice.app/Contents/MacOS/soffice"],
        linux: ["/usr/bin/soffice", "/usr/bin/libreoffice"]
    }

    const standardPaths = defaultPaths[process.platform] || []
    for (const p of standardPaths) {
        try {
            if (fs.existsSync(p) && fs.lstatSync(p).isFile()) return p
        } catch (err) {
            // ignore
        }
    }

    return "soffice"
}

export function libreConvert(data: { type: string }) {
    if (data.type !== "powerpoint") return

    const files = selectFilesDialog("", { name: "PowerPoint", extensions: ["ppt", "pptx"] }, false)
    if (!files.length) return

    const pptPath = files[0]
    const outputFolder = getDataFolderPath("imports", "PowerPoint")
    const rawName = path.basename(pptPath, path.extname(pptPath))
    const safeName = sanitizeFileName(rawName)
    const pdfPath = path.join(outputFolder, safeName + ".pdf")

    convertPptToPdf(pptPath, pdfPath, outputFolder)
}

async function convertPptToPdf(inputPath: string, outputPath: string, outputFolder: string) {
    try {
        if (!fs.existsSync(inputPath) || !fs.lstatSync(inputPath).isFile()) {
            throw new Error("Input file does not exist or is a directory")
        }

        sendToMain(ToMain.ALERT, "popup.importing")

        const sofficePath = getSofficePath()
        await execFileAsync(sofficePath, ["--headless", "--convert-to", "pdf", "--outdir", outputFolder, inputPath])

        if (!fs.existsSync(outputPath)) {
            throw new Error("Conversion failed: Output PDF not found")
        }

        sendToMain(ToMain.IMPORT2, { channel: "pdf", data: [outputPath] })
    } catch (err: any) {
        if (err.code === "ENOENT" || (err.message && (err.message.includes("soffice") || err.message.includes("not found")))) {
            sendToMain(ToMain.ALERT, isWindows ? "LibreOffice is not installed or not found in default location.<br>Upon installation, it's recommended to enable the 'Add to PATH' option." : "LibreOffice is not installed or not found")
            setTimeout(() => openURL("https://www.libreoffice.org/download/download-libreoffice/"), 500)
        } else {
            console.error("Error converting file:", err)
            sendToMain(ToMain.TOAST, err.message || "Failed to convert file")
        }
    }
}
