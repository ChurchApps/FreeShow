import { CLOUD } from "../../types/Channels"
import { stores } from "../utils/store"
import { authenticate, listFolders, syncDataDrive } from "./drive"

export async function cloudConnect(e: any, { channel, data }: any) {
    if (!cloudHelpers[channel]) return

    let reply = await cloudHelpers[channel](data)
    if (reply) e.reply(CLOUD, { channel, data: reply })
}

const cloudHelpers: any = {
    DRIVE_CONNECT: async () => {
        let keysFilePath = stores.DRIVE_API_KEY.path

        let status = await authenticate(keysFilePath)

        return status
    },
    GET_MAIN_FOLDER: async () => {
        let folders = await listFolders()
        if (folders === null) return { error: "Error: No access to the service account!" }
        if (!folders?.[0]) return { error: "Error: Could not find any folders! Have you shared it with the service account?" }

        return { id: folders[0].id }
    },
    SYNC_DATA: async (data: any) => {
        if (!data.mainFolderId) return

        let changes = await syncDataDrive(data)
        return { changes }
    },
}
