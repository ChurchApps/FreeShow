import { app } from "electron"
import fs from "fs"
import path from "path"
import type { AiSetupOptions, EngineStatus } from "../../../types/ai/Ai"
import { createFolder, getFolderSize } from "../../utils/files"

export async function aiHandleLocalSetup(data: AiSetupOptions): Promise<boolean> {
    const { action, engineId, modelId, customPath } = data

    if (action === "verify") return LocalModelManager.verifyCustomPath(engineId, customPath || "")

    const actions = {
        download: () => (modelId ? LocalModelManager.downloadModel(engineId, modelId) : LocalModelManager.downloadEngine(engineId)),
        cancel: () => (modelId ? LocalModelManager.cancelModelDownload(engineId, modelId) : LocalModelManager.cancelEngineDownload(engineId)),
        delete: () => (modelId ? LocalModelManager.deleteModel(engineId, modelId) : LocalModelManager.deleteEngine(engineId))
    }

    return actions[action as keyof typeof actions]?.() ?? false
}

const BIN_DIR = path.join(app.getPath("userData"), "bin")

export class LocalModelManager {
    private static getManager(engineId: string) {
        // require lazily to avoid circular imports when models import these helpers
        if (engineId === "nemotron") return require("./models/nemotron").NemotronSetupManager
        return null
    }

    private static removePath(targetPath: string, isDir = false): boolean {
        try {
            fs.rmSync(targetPath, { recursive: isDir, force: true })
            return true
        } catch (err) {
            console.error(`Could not remove ${targetPath}:`, err)
            return false
        }
    }

    static getEngineDir = (engineId: string) => path.join(BIN_DIR, engineId)
    static getModelDir = (engineId: string) => path.join(BIN_DIR, engineId, "models")
    static getModelPath = (engineId: string, modelId: string) => path.join(this.getModelDir(engineId), `ggml-${modelId}.bin`)

    static getEnginePath(engineId: string) {
        const manager = this.getManager(engineId)
        return manager ? path.join(this.getEngineDir(engineId), manager.getBinaryName()) : null
    }

    static async getStatus(engineId: string, modelId?: string, customPath?: string): Promise<EngineStatus> {
        const manager = this.getManager(engineId)
        if (!manager) return { ready: false }

        if (modelId) {
            const modelPath = customPath || this.getModelPath(engineId, modelId)
            return { ready: await manager.verifyModel?.(modelPath), localPath: modelPath }
        }

        if (engineId === "nemotron") {
            const modelDir = this.getModelDir(engineId)
            const integrity = await manager.checkIntegrity(modelDir)
            if (integrity === "ok") return { ready: true, localPath: modelDir }
            return { ready: false, error: `The local model is ${integrity}` }
        }

        const enginePath = customPath || this.getEnginePath(engineId)
        return { ready: Boolean(enginePath && (await manager.verifyEngine(enginePath))), localPath: enginePath }
    }

    static async verifyCustomPath(engineId: string, customPath: string) {
        const manager = this.getManager(engineId)
        return Boolean(manager && customPath && (await manager.verifyEngine(customPath)))
    }

    static async downloadEngine(engineId: string) {
        const manager = this.getManager(engineId)
        if (!manager) return false

        const outputFolder = engineId === "nemotron" ? this.getModelDir(engineId) : this.getEngineDir(engineId)
        createFolder(outputFolder)

        const result = await manager.downloadEngine(outputFolder)
        return result?.ok === true
    }

    static cancelEngineDownload(engineId: string) {
        this.getManager(engineId)?.cancelEngineDownload()
        return true
    }

    static async downloadModel(engineId: string, modelId: string) {
        const manager = this.getManager(engineId)
        if (!manager) return false

        createFolder(this.getModelDir(engineId))
        const outputPath = this.getModelPath(engineId, modelId)

        const result = await manager.downloadModel(modelId, outputPath)
        return result?.ok === true && (await manager.verifyModel(outputPath))
    }

    static cancelModelDownload(engineId: string, modelId: string) {
        this.getManager(engineId)?.cancelModelDownload(modelId)
        return true
    }

    static deleteModel = (engineId: string, modelId: string) => this.removePath(this.getModelPath(engineId, modelId))
    static deleteEngine = (engineId: string) => this.removePath(this.getEngineDir(engineId), true)

    private static ENGINES = ["nemotron"]
    static async getDownloadedBinFiles() {
        const files = this.ENGINES.map((engineFolder) => {
            const filePath = path.join(BIN_DIR, engineFolder)
            const size = getFolderSize(filePath)
            return size > 0 ? { path: filePath, name: engineFolder, size } : null
        })
        return files.filter(Boolean) as { path: string; name: string; size: number }[]
    }

    static deleteBinFile = (data: { path: string }) => this.removePath(data.path)
}
