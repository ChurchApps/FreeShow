import { auth, drive } from "@googleapis/drive"

let driveClient: any = null

export async function authenticate(keysFilePath: string) {
    // TODO: try catch, test wrong file data...
    const authData = new auth.GoogleAuth({ keyFile: keysFilePath, scopes: ["https://www.googleapis.com/auth/drive"] })
    const authClient = await authData.getClient()
    const client = drive({ version: "v3", auth: authClient })

    driveClient = client
    return client
}

export async function listFolders(pageSize = 20) {
    if (!driveClient) return

    const res = await driveClient.files.list({
        pageSize,
        q: "mimeType='application/vnd.google-apps.folder'",
        fields: "nextPageToken, files(id, name)",
    })

    return res.data.files || []
}

export async function listFiles(pageSize = 50, q: string = "") {
    if (!driveClient) return

    // let q = "mimeType!='application/vnd.google-apps.folder'"
    // if (query) q += " and " + query

    const res = await driveClient.files.list({
        pageSize,
        q,
        fields: "nextPageToken, files(id, name, mimeType)",
    })

    return res.data.files || []
}

export const types: any = {
    jpg: "image/jpg",
    png: "image/png",
    json: "application/json",
    txt: "application/txt",
    folder: "application/vnd.google-apps.folder",
}

export function createFile(parent: string, { type, name }: any, body: string) {
    let metaData = { name, parents: [parent] }
    let media = { mimeType: types[type], body }

    return { resource: metaData, media }
}

export async function createFolder(parent: string, name: string) {
    let metaData = { name, parents: [parent], mimeType: types.folder }

    return { resource: metaData }
}

export async function getFile(id: string, q: string = "") {
    if (!id || !driveClient) return null

    // fileId: id
    let data: any = { fields: "id,modifiedTime" }
    if (id) data.fileId = id
    if (q) data.q = q
    return await driveClient.files.get(data)
}

export async function uploadFile(data: any, updateId: string = "") {
    if (!driveClient) return

    let response: any = null
    if (updateId) {
        delete data.resource.parents
        response = await driveClient.files.update({ fileId: updateId, ...data })
    } else {
        response = await driveClient.files.create({ ...data, fields: "id" })
    }

    // switch (response) {
    //     case 200:
    //         console.log("File created, id:", response.data.id)
    //         break

    //     default:
    //         console.error("Error creating file:", response.errors)
    //         break
    // }

    return response
}

export async function deleteFile(id: string) {
    if (!driveClient) return

    let response = await driveClient.files.delete({ fileId: id })

    return response
}

export async function downloadFile(fileId: string) {
    if (!driveClient || !fileId) return

    // https://developers.google.com/drive/api/guides/manage-downloads#node.js

    return new Promise((resolve, reject) => {
        driveClient.files.get({ fileId: fileId, alt: "media" }, (err: any, res: any) => {
            if (err) {
                reject(err)
                return console.log("The API returned an error: " + err)
            }
            resolve(res.data)
        })
    })
}
