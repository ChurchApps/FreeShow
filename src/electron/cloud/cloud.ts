import { CLOUD } from "../../types/Channels"
import { stores } from "../data/store"
import { listFiles } from "./drive"
import { authenticate, listFolders, syncDataDrive } from "./drive"

export async function cloudConnect(e: any, { channel, data }: any) {
    if (!cloudHelpers[channel]) return

    let reply = await cloudHelpers[channel](data)
    if (reply || data?.closeWhenFinished) {
        if (data?.closeWhenFinished) reply.closeWhenFinished = data.closeWhenFinished
        e.reply(CLOUD, { channel, data: reply })
    }
}

const cloudHelpers: any = {
    DRIVE_CONNECT: async () => {
        let keysFilePath = stores.DRIVE_API_KEY.path

        let status = await authenticate(keysFilePath)

        return status
    },
    GET_MAIN_FOLDER: async ({ method }: any) => {
        let folders = await listFolders()
        if (folders === null) return { error: "Error: No access to the service account!" }
        if (!folders?.[0]) return { error: "Error: Could not find any folders! Have you shared it with the service account?" }

        let existingData: boolean = false
        if (!method) {
            let files = await listFiles(5)
            if (files.length > 1) existingData = true
        }

        return { id: folders[0].id, existingData }
    },
    SYNC_DATA: async (data: any) => {
        if (!data.mainFolderId) return

        let changes = await syncDataDrive(data)
        return { changes }
    },
}
