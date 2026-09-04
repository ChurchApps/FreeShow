import { app } from "electron"
import fs from "fs"
import path from "path"
import type { AiSetupOptions, EngineStatus } from "../../../types/ai/AiModels"
import { createFolder } from "../../utils/files"

export async function aiHandleLocalSetup(data: AiSetupOptions) {
    if (data.action === "download") {
        if (data.modelId) return await LocalModelManager.downloadModel(data.engineId, data.modelId)
        return await LocalModelManager.downloadEngine(data.engineId)
    }

    if (data.action === "verify") {
        // custom binary path check (e.g. a manually selected whisper-cli)
        return await LocalModelManager.verifyCustomPath(data.engineId, data.customPath || "")
    }

    if (data.action === "cancel") {
        if (data.modelId) return LocalModelManager.cancelModelDownload(data.engineId, data.modelId)
        return LocalModelManager.cancelEngineDownload(data.engineId)
    }

    if (data.action === "delete") {
        if (data.modelId) return LocalModelManager.deleteModel(data.engineId, data.modelId)
        return LocalModelManager.deleteEngine(data.engineId)
    }

    return false
}

const BIN_DIR = path.join(app.getPath("userData"), "bin")

export class LocalModelManager {
    private static getManager(engineId: string) {
        // require lazily to avoid circular imports when models import these helpers
        if (engineId === "whisper") return require("./models/whisper").WhisperSetupManager
        if (engineId === "nemotron") return require("./models/nemotron").NemotronSetupManager
        return null
    }

    static async getStatus(engineId: string, modelId?: string, customPath?: string): Promise<EngineStatus> {
        const manager = this.getManager(engineId)
        if (!manager) return { ready: false }

        if (modelId) {
            const modelPath = customPath || this.getModelPath(engineId, modelId)
            const isReady = await manager.verifyModel(modelPath)
            return { ready: isReady, localPath: modelPath }
        }

        // engine readiness comes from the same resolvers the transcribers use,
        // so a system installed binary or an already downloaded model always counts
        if (engineId === "whisper") {
            const binary = await (manager as any).resolveWhisper(customPath)
            const downloadedModels = (await Promise.all(((manager as any).WHISPER_MODELS as string[]).map(async (id: string) => ({ id, ready: (manager as any).isModelReady(id) })))).filter(({ ready }) => ready).map(({ id }) => id)
            return { ready: !!binary, localPath: binary?.binaryPath || null, downloadedModels }
        }

        if (engineId === "nemotron") {
            const nemotron = require("./models/nemotron") as {
                NEMOTRON_MODEL_FILES: Record<string, { file: string }>
                NEMOTRON_VAD_FILE: string
            }

            const modelDir = this.getModelDir(engineId)
            const requiredFiles = [...Object.values(nemotron.NEMOTRON_MODEL_FILES).map((entry) => entry.file), nemotron.NEMOTRON_VAD_FILE]
            const checks = await Promise.all(requiredFiles.map((file) => manager.verifyEngine(path.join(modelDir, file))))
            const ready = checks.every(Boolean)
            return { ready, localPath: ready ? modelDir : null }
        }

        const enginePath = customPath || this.getEnginePath(engineId)
        const isReady = enginePath ? await manager.verifyEngine(enginePath) : false
        return { ready: isReady, localPath: enginePath }
    }

    static async verifyCustomPath(engineId: string, customPath: string) {
        const manager = this.getManager(engineId)
        if (!manager || !customPath) return false
        return await manager.verifyEngine(customPath)
    }

    static getEngineDir(engineId: string) {
        return path.join(BIN_DIR, engineId)
    }
    static getEnginePath(engineId: string) {
        const manager = this.getManager(engineId)
        if (!manager) return null
        return path.join(this.getEngineDir(engineId), manager.getBinaryName())
    }

    static async downloadEngine(engineId: string) {
        if (!engineId) return false

        const manager = this.getManager(engineId)
        if (!manager) return false

        // the nemotron "engine" download is its model files - they belong in the models dir the runtime loader reads
        const outputFolder = engineId === "nemotron" ? this.getModelDir(engineId) : this.getEngineDir(engineId)
        createFolder(outputFolder)

        const result = await manager.downloadEngine(outputFolder)
        if ((result as { ok?: boolean })?.ok !== true) return false

        // whisper unzips a binary - make sure it actually runs before reporting success
        if (engineId === "whisper") {
            const outputPath = this.getEnginePath(engineId)
            const isValid = outputPath ? await manager.verifyEngine(outputPath) : false
            if (!isValid) return false
        }

        return true
    }

    static cancelEngineDownload(engineId: string) {
        const manager = this.getManager(engineId)
        if (manager) manager.cancelEngineDownload()
        return true
    }

    static getModelDir(engineId: string) {
        return path.join(this.getEngineDir(engineId), "models")
    }
    static getModelPath(engineId: string, modelId: string) {
        return path.join(this.getModelDir(engineId), `ggml-${modelId}.bin`)
    }

    static async downloadModel(engineId: string, modelId: string) {
        if (!engineId || !modelId) return false

        const manager = this.getManager(engineId)
        if (!manager) return false

        const outputFolder = this.getModelDir(engineId)
        createFolder(outputFolder)

        const outputPath = this.getModelPath(engineId, modelId)

        const result = await manager.downloadModel(modelId, outputPath)
        if ((result as { ok?: boolean })?.ok !== true) return false

        const isValid = await manager.verifyModel(outputPath)
        if (!isValid) return false

        return true
    }

    static cancelModelDownload(engineId: string, modelId: string) {
        const manager = this.getManager(engineId)
        if (manager) manager.cancelModelDownload(modelId)
        return true
    }

    static deleteModel(engineId: string, modelId: string) {
        if (!this.getManager(engineId)) return false

        try {
            fs.unlinkSync(this.getModelPath(engineId, modelId))
            return true
        } catch (err) {
            console.error(`Could not delete ${engineId} model ${modelId}:`, err)
            return false
        }
    }

    static deleteEngine(engineId: string) {
        if (!this.getManager(engineId)) return false

        try {
            fs.rmSync(this.getEngineDir(engineId), { recursive: true, force: true })
            return true
        } catch (err) {
            console.error(`Could not delete ${engineId} engine files:`, err)
            return false
        }
    }
}
