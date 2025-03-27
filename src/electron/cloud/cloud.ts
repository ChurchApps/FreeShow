import { CLOUD } from "../../types/Channels"
import type { DriveData } from "../../types/Main"
import type { Message } from "../../types/Socket"
import { stores } from "../data/store"
import { authenticate, listFiles, listFolders, syncDataDrive } from "./drive"

export async function cloudConnect(e: Electron.IpcMainEvent, { channel, data }: Message) {
    const id = channel as keyof typeof cloudHelpers
    if (!cloudHelpers[id]) return

    let reply = await cloudHelpers[id](data)
    if (reply || data?.closeWhenFinished) {
        e.reply(CLOUD, { channel, data: { ...reply, closeWhenFinished: !!data?.closeWhenFinished } })
    }
}

const cloudHelpers = {
    DRIVE_CONNECT: async () => {
        let keysFilePath = stores.DRIVE_API_KEY.path

        let status = await authenticate(keysFilePath)

        return status
    },
    GET_MAIN_FOLDER: async ({ method }: { method: string | null }) => {
        let folders = await listFolders()
        if (folders === null) return { error: "Error: No access to the service account!" }
        if (!folders?.[0]) return { error: "Error: Could not find any folders! Have you shared it with the service account?" }

        let existingData: boolean = false
        if (!method) {
            let files = await listFiles(5)
            if (files && files.length > 1) existingData = true
        }

        return { id: folders[0].id, existingData }
    },
    SYNC_DATA: async (data: DriveData) => {
        if (!data.mainFolderId) return {}

        let changes = await syncDataDrive(data)
        return { changes }
    },
}
