import { execFile } from "child_process"
import fs from "fs"
import path from "path"
import { promisify } from "util"
import { isMac, isWindows } from "../.."
import { ToMain } from "../../../types/IPC/ToMain"
import { sendToMain } from "../../IPC/main"
import { openURL } from "../../IPC/responsesMain"
import { getDataFolderPath, sanitizeFileName, selectFilesDialog } from "../../utils/files"

export async function pptToPdf() {
    const files = await selectFilesDialog("", { name: "PowerPoint", extensions: ["ppt", "pptx"] }, false)
    if (!files.length) return

    const pptPath = files[0]
    const outputFolder = getDataFolderPath("imports", "PowerPoint")
    const safeName = sanitizeFileName(path.basename(pptPath, path.extname(pptPath)))
    const pdfPath = path.join(outputFolder, `${safeName}.pdf`)

    processPptToPdf(pptPath, pdfPath, outputFolder)
}

async function processPptToPdf(inputPath: string, outputPath: string, outputFolder: string) {
    if (!fs.existsSync(inputPath) || !fs.lstatSync(inputPath).isFile()) {
        sendToMain(ToMain.TOAST, "Input file does not exist or is a directory")
        return
    }

    sendToMain(ToMain.ALERT, "popup.importing")

    // 1. Try LibreOffice first
    if (await convertWithLibreOffice(inputPath, outputPath, outputFolder)) {
        sendToMain(ToMain.IMPORT2, { channel: "pdf", data: [outputPath] })
        return
    }

    // 2. Try PowerPoint if LibreOffice is not installed or failed
    if (await convertWithPowerPoint(inputPath, outputPath)) {
        sendToMain(ToMain.IMPORT2, { channel: "pdf", data: [outputPath] })
        return
    }

    // 3. Both failed or not installed -> Alert user and open LibreOffice download link
    sendToMain(ToMain.ALERT, isWindows ? "LibreOffice or PowerPoint is not installed or not found in default location.<br>Upon LibreOffice installation, it's recommended to enable the 'Add to PATH' option." : isMac ? "LibreOffice or PowerPoint is not installed or not found" : "LibreOffice is not installed or not found")
    setTimeout(() => openURL("https://www.libreoffice.org/download/"), 500)
}

// SHELL

const execFileAsync = promisify(execFile)

const DEFAULT_SOFFICE_PATHS: Record<string, string[]> = {
    win32: [path.join(process.env.PROGRAMFILES || "C:\\Program Files", "LibreOffice", "program", "soffice.exe"), path.join(process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)", "LibreOffice", "program", "soffice.exe")],
    darwin: ["/Applications/LibreOffice.app/Contents/MacOS/soffice"],
    linux: ["/usr/bin/soffice", "/usr/bin/libreoffice"]
}

function getSofficePath(): string {
    const paths = DEFAULT_SOFFICE_PATHS[process.platform] || []
    return paths.find((p) => fs.existsSync(p)) || "soffice"
}

async function convertWithLibreOffice(inputPath: string, outputPath: string, outputFolder: string): Promise<boolean> {
    try {
        const sofficePath = getSofficePath()
        await execFileAsync(sofficePath, ["--headless", "--convert-to", "pdf", "--outdir", outputFolder, inputPath], { timeout: 120000 })
        return fs.existsSync(outputPath)
    } catch (err) {
        return false
    }
}

async function convertWithPowerPoint(inputPath: string, outputPath: string): Promise<boolean> {
    if (!isWindows && !isMac) return false

    try {
        if (isWindows) {
            const script = `param($in,$out); $ppt = New-Object -ComObject PowerPoint.Application; try { $ppt.DisplayAlerts = 1; $doc = $ppt.Presentations.Open([IO.Path]::GetFullPath($in), -1, 0, 0); $doc.SaveAs([IO.Path]::GetFullPath($out), 32); $doc.Close() } finally { $ppt.Quit(); [Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null }`
            await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script, inputPath, outputPath], { timeout: 60000 })
        } else if (isMac) {
            const script = `tell application "Microsoft PowerPoint"\nset theDoc to open (POSIX file "${inputPath.replace(/"/g, '\\"')}")\nsave theDoc in (POSIX file "${outputPath.replace(/"/g, '\\"')}") as save as PDF\nclose theDoc saving no\nend tell`
            await execFileAsync("osascript", ["-e", script], { timeout: 60000 })
        }
    } catch (err) {
        // PowerPoint not available or failed
    }
    return fs.existsSync(outputPath)
}
