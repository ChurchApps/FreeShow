import { app } from "electron"
import fs from "fs"
import path from "path"
import type { AiSetupOptions, EngineStatus } from "../../../types/ai/AiModels"
import { createFolder } from "../../utils/files"

export async function aiHandleLocalSetup(data: AiSetupOptions): Promise<unknown> {
    const { action, engineId, modelId, customPath } = data

    if (action === "verify") {
        return await LocalModelManager.verifyCustomPath(engineId, customPath || "")
    }

    const isModelAction = Boolean(modelId)
    switch (action) {
        case "download":
            return isModelAction ? LocalModelManager.downloadModel(engineId, modelId!) : LocalModelManager.downloadEngine(engineId)
        case "cancel":
            return isModelAction ? LocalModelManager.cancelModelDownload(engineId, modelId!) : LocalModelManager.cancelEngineDownload(engineId)
        case "delete":
            return isModelAction ? LocalModelManager.deleteModel(engineId, modelId!) : LocalModelManager.deleteEngine(engineId)
        default:
            return false
    }
}

const BIN_DIR = path.join(app.getPath("userData"), "bin")

export class LocalModelManager {
    private static getManager(engineId: string) {
        // require lazily to avoid circular imports when models import these helpers
        if (engineId === "whisper") return require("./models/whisper").WhisperSetupManager
        if (engineId === "nemotron") return require("./models/nemotron").NemotronSetupManager
        return null
    }

    private static removePath(targetPath: string, isDir = false): boolean {
        try {
            if (isDir) fs.rmSync(targetPath, { recursive: true, force: true })
            else fs.unlinkSync(targetPath)
            return true
        } catch (err) {
            console.error(`Could not remove ${targetPath}:`, err)
            return false
        }
    }

    static getEngineDir(engineId: string) {
        return path.join(BIN_DIR, engineId)
    }

    static getEnginePath(engineId: string) {
        const manager = this.getManager(engineId)
        return manager ? path.join(this.getEngineDir(engineId), manager.getBinaryName()) : null
    }

    static getModelDir(engineId: string) {
        return path.join(this.getEngineDir(engineId), "models")
    }

    static getModelPath(engineId: string, modelId: string) {
        return path.join(this.getModelDir(engineId), `ggml-${modelId}.bin`)
    }

    static async getStatus(engineId: string, modelId?: string, customPath?: string): Promise<EngineStatus> {
        const manager = this.getManager(engineId)
        if (!manager) return { ready: false }

        if (modelId) {
            const modelPath = customPath || this.getModelPath(engineId, modelId)
            return { ready: await manager.verifyModel(modelPath), localPath: modelPath }
        }

        if (engineId === "whisper") {
            const binary = await manager.resolveWhisper(customPath)
            const downloadedModels = (await Promise.all(manager.WHISPER_MODELS.map(async (id: string) => ({ id, ready: manager.isModelReady(id) })))).filter(({ ready }) => ready).map(({ id }) => id)

            return { ready: !!binary, localPath: binary?.binaryPath || null, downloadedModels }
        }

        if (engineId === "nemotron") {
            const { NEMOTRON_MODEL_FILES, NEMOTRON_VAD_FILE } = require("./models/nemotron")
            const modelDir = this.getModelDir(engineId)
            const requiredFiles = [...Object.values(NEMOTRON_MODEL_FILES).map((e: any) => e.file), NEMOTRON_VAD_FILE]
            const checks = await Promise.all(requiredFiles.map((file) => manager.verifyEngine(path.join(modelDir, file))))
            const ready = checks.every(Boolean)
            return { ready, localPath: ready ? modelDir : null }
        }

        const enginePath = customPath || this.getEnginePath(engineId)
        return { ready: enginePath ? await manager.verifyEngine(enginePath) : false, localPath: enginePath }
    }

    static async verifyCustomPath(engineId: string, customPath: string) {
        const manager = this.getManager(engineId)
        return Boolean(manager && customPath && (await manager.verifyEngine(customPath)))
    }

    static async downloadEngine(engineId: string) {
        if (!engineId) return false

        const manager = this.getManager(engineId)
        if (!manager) return false

        // the nemotron "engine" download is its model files - they belong in the models dir the runtime loader reads
        const outputFolder = engineId === "nemotron" ? this.getModelDir(engineId) : this.getEngineDir(engineId)
        createFolder(outputFolder)

        const result = await manager.downloadEngine(outputFolder)
        if (result?.ok !== true) return false

        // whisper unzips a binary - make sure it actually runs
        if (engineId === "whisper") {
            const outputPath = this.getEnginePath(engineId)
            if (!outputPath || !(await manager.verifyEngine(outputPath))) return false
        }

        return true
    }

    static cancelEngineDownload(engineId: string) {
        this.getManager(engineId)?.cancelEngineDownload()
        return true
    }

    static async downloadModel(engineId: string, modelId: string) {
        if (!engineId || !modelId) return false
        const manager = this.getManager(engineId)
        if (!manager) return false

        createFolder(this.getModelDir(engineId))
        const outputPath = this.getModelPath(engineId, modelId)

        const result = await manager.downloadModel(modelId, outputPath)
        if (result?.ok !== true) return false

        if (!(await manager.verifyModel(outputPath))) return false

        return true
    }

    static cancelModelDownload(engineId: string, modelId: string) {
        this.getManager(engineId)?.cancelModelDownload(modelId)
        return true
    }

    static deleteModel(engineId: string, modelId: string) {
        return this.getManager(engineId) ? this.removePath(this.getModelPath(engineId, modelId)) : false
    }

    static deleteEngine(engineId: string) {
        return this.getManager(engineId) ? this.removePath(this.getEngineDir(engineId), true) : false
    }
}
