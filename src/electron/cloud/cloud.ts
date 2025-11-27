import { CLOUD } from "../../types/Channels"
import type { DriveData } from "../../types/Main"
import type { Message } from "../../types/Socket"
import { _store } from "../data/store"
import { authenticate, listFiles, listFolders, syncDataDrive } from "./drive"

export async function cloudConnect(e: Electron.IpcMainEvent, { channel, data }: Message) {
    const id = channel as keyof typeof cloudHelpers
    if (!cloudHelpers[id]) return

    const reply = await cloudHelpers[id](data)
    if (reply || data?.closeWhenFinished) {
        e.reply(CLOUD, { channel, data: { ...reply, closeWhenFinished: !!data?.closeWhenFinished } })
    }
}

const cloudHelpers = {
    DRIVE_CONNECT: async () => {
        const keysFilePath = _store.DRIVE_API_KEY?.path || ""

        const status = await authenticate(keysFilePath)

        return status
    },
    GET_MAIN_FOLDER: async ({ method }: { method: string | null }) => {
        const folders = await listFolders()
        if (folders === null) return { error: "Error: No access to the service account!" }
        if (!folders?.[0]) return { error: "Error: Could not find any folders! Have you shared it with the service account?" }

        let existingData = false
        if (!method) {
            const files = await listFiles(5)
            if (files && files.length > 1) existingData = true
        }

        return { id: folders[0].id, existingData }
    },
    SYNC_DATA: async (data: DriveData) => {
        if (!data.mainFolderId) return {}

        const changes = await syncDataDrive(data)
        return { changes }
    }
}
