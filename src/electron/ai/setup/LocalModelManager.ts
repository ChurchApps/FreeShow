import { app } from "electron"
import path from "path"
import type { AiSetupOptions, EngineStatus } from "../../../types/ai/AiModels"
import { createFolder } from "../../utils/files"
import { NemotronSetupManager } from "./models/nemotron"
import { WhisperSetupManager } from "./models/whisper"

export async function aiHandleLocalSetup(data: AiSetupOptions) {
    if (data.customPath) console.log("TODO: custom path support for local setup:", data.customPath)

    if (data.action === "download") {
        if (data.modelId) return await LocalModelManager.downloadModel(data.engineId, data.modelId)
        return await LocalModelManager.downloadEngine(data.engineId)
    }

    // if (data.action === "verify") {
    //     return await LocalModelManager.getStatus(data.engineId, data.modelId)
    // }

    if (data.action === "cancel") {
        if (data.modelId) return LocalModelManager.cancelModelDownload(data.engineId, data.modelId)
        return LocalModelManager.cancelEngineDownload(data.engineId)
    }

    // TODO: delete engine/model
    // if (data.action === "delete")

    return false
}

const BIN_DIR = path.join(app.getPath("userData"), "bin")

export class LocalModelManager {
    private static getManager(engineId: string) {
        if (engineId === "whisper") return WhisperSetupManager
        if (engineId === "nemotron") return NemotronSetupManager
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

        const enginePath = customPath || this.getEnginePath(engineId)
        const isReady = enginePath ? await manager.verifyEngine(enginePath) : false
        return { ready: isReady, localPath: enginePath }
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

        const outputFolder = this.getEngineDir(engineId)
        createFolder(outputFolder)

        const isDownloaded = await manager.downloadEngine(outputFolder)
        if (!isDownloaded) return false

        const outputPath = this.getEnginePath(engineId)
        const isValid = outputPath ? await manager.verifyEngine(outputPath) : false
        if (!isValid) return false

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

        const isDownloaded = await manager.downloadModel(modelId, outputPath)
        if (!isDownloaded) return false

        const isValid = await manager.verifyModel(outputPath)
        if (!isValid) return false

        return true
    }

    static cancelModelDownload(engineId: string, modelId: string) {
        const manager = this.getManager(engineId)
        if (manager) manager.cancelModelDownload(modelId)
        return true
    }
}
