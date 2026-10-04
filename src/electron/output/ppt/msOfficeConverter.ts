import { execFile } from "child_process"
import fs from "fs"
import path from "path"
import { promisify } from "util"
import { ToMain } from "../../../types/IPC/ToMain"
import { sendToMain } from "../../IPC/main"
import { getDataFolderPath, sanitizeFileName } from "../../utils/files"

const execFileAsync = promisify(execFile)

async function convertWithOfficePowerShell(inputPath: string, outputPath: string): Promise<boolean> {
    const q = (s: string) => s.replace(/'/g, "''")
    const script = [
        "$ErrorActionPreference = 'Stop'",
        "$app = New-Object -ComObject PowerPoint.Application",
        `$pres = $app.Presentations.Open('${q(inputPath)}', $false, $false, $true)`,
        `$pres.SaveAs('${q(outputPath)}', 32)`,
        "$pres.Close()",
        "$app.Quit()"
    ].join("\n")
    const encoded = Buffer.from(script, "utf16le").toString("base64")
    try {
        const result = await execFileAsync("powershell", ["-NonInteractive", "-NoProfile", "-EncodedCommand", encoded], { timeout: 120_000 })
        const ok = fs.existsSync(outputPath)
        if (!ok) console.warn("msOfficeConverter: script ran but no PDF produced. stderr:", result.stderr)
        return ok
    } catch (err: any) {
        console.warn("msOfficeConverter: Office COM failed:", err.stderr || err.message)
        return false
    }
}

async function convertWithOfficeAppleScript(inputPath: string, outputPath: string): Promise<boolean> {
    const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    const script = `tell application "Microsoft PowerPoint"\n    set pres to open POSIX file "${q(inputPath)}"\n    save pres in POSIX file "${q(outputPath)}" as save as PDF\n    close pres saving no\nend tell`
    try {
        await execFileAsync("osascript", ["-e", script], { timeout: 120_000 })
        return fs.existsSync(outputPath)
    } catch {
        return false
    }
}

// Returns true if Office converted successfully; false means fall back to LibreOffice
export async function convertWithOffice(inputPath: string, outputPath: string): Promise<boolean> {
    if (process.platform === "win32") return convertWithOfficePowerShell(inputPath, outputPath)
    if (process.platform === "darwin") return convertWithOfficeAppleScript(inputPath, outputPath)
    return false
}

// Convert a PPTX/PPT file already on disk and import its slides into FreeShow.
// Tries Office 365 first, then falls back to LibreOffice via IMPORT2 "pdf".
export async function convertPptFileToSlides(pptPath: string): Promise<void> {
    const outputFolder = getDataFolderPath("imports", "PowerPoint")
    const safeName = sanitizeFileName(path.basename(pptPath, path.extname(pptPath)))
    const pdfPath = path.join(outputFolder, safeName + ".pdf")

    // Try Office first; if it fails the caller must handle LibreOffice fallback
    const ok = await convertWithOffice(pptPath, pdfPath)
    if (!ok) {
        sendToMain(ToMain.TOAST, `Office conversion failed for "${path.basename(pptPath)}" — install LibreOffice as a fallback`)
        return
    }

    if (!fs.existsSync(pdfPath)) {
        sendToMain(ToMain.TOAST, `Conversion produced no output for "${path.basename(pptPath)}"`)
        return
    }

    sendToMain(ToMain.IMPORT2, { channel: "pdf", data: [pdfPath] })
}
