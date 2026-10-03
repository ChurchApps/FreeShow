import path from "path"
import type { RtmpDestination } from "../../types/Output"
import { CaptureHelper } from "../capture/CaptureHelper"
import { createFolder, getDataFolderPath, openInSystem } from "../utils/files"

// Recording an output is one more destination of its hardware encode (RtmpStreamer, in the capture
// worker): a relay copies the encoded stream into a file. No frame is read, converted or encoded on main or
// in the app window, and an output that is also streaming is still encoded only once.
export class OutputRecording {
    private static active = new Map<string, string>()
    private static folderOpened = false

    static start(outputId: string, name: string, folder?: string) {
        const dir = folder ? createFolder(folder) : getDataFolderPath("recordings")
        this.active.set(outputId, path.join(dir, name))
        CaptureHelper.Lifecycle.updateRtmpState()
    }

    static stop(outputId: string) {
        const file = this.active.get(outputId)
        if (!file) return
        this.active.delete(outputId)
        CaptureHelper.Lifecycle.updateRtmpState()
        if (!this.folderOpened) {
            this.folderOpened = true
            openInSystem(path.dirname(file))
        }
    }

    static isRecording(outputId: string): boolean {
        return this.active.has(outputId)
    }

    static destination(outputId: string): RtmpDestination | null {
        const file = this.active.get(outputId)
        return file ? { id: "recording", url: file, key: "", enabled: true, file: true } : null
    }
}
