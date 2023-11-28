import { get } from "svelte/store"
import { CLOUD } from "../../types/Channels"
import { activePopup, dataPath, driveData, driveKeys, popupData, showsPath } from "../stores"
import { newToast } from "./messages"
import { send } from "./request"
import { closeApp, save } from "./save"
import { uid } from "uid"

export function validateKeys(file: string) {
    let keys = JSON.parse(file)

    // check keys
    let error = ""
    if (!keys.client_id) error = "Invalid key file: Missing 'client_id'"
    else if (!keys.private_key) error = "Invalid key file: Missing 'private_key'"
    else if (!keys.project_id) error = "Invalid key file: Missing 'project_id'"

    if (error) {
        activePopup.set(null)
        newToast(error)
        return
    }

    // set media id
    driveData.update((a) => {
        if (!a.mediaId || a.mediaId === "default") a.mediaId = uid(8)
        return a
    })

    driveKeys.set(keys)
    save()
}

export function driveConnect(keys: any) {
    if (typeof keys !== "object" || !Object.keys(keys).length) return

    // give time for the keys file to save
    setTimeout(() => {
        // authenticate("C:\\Users\\Kristoffer\\AppData\\Roaming\\freeshow\\DRIVE_API_KEY.json")
        send(CLOUD, ["DRIVE_CONNECT"])
    }, 100)
}

export function syncDrive(force: boolean = false, closeWhenFinished: boolean = false) {
    if (!force && get(driveData).disabled === true) {
        if (closeWhenFinished) closeApp()
        return
    }

    let method = get(driveData).initializeMethod
    if (get(driveData).disableUpload) method = "download"
    send(CLOUD, ["SYNC_DATA"], { mainFolderId: get(driveData).mainFolderId, path: get(showsPath), dataPath: get(dataPath), method, closeWhenFinished })
    popupData.set({})
    activePopup.set("cloud_update")
}

// import { auth, drive } from "@googleapis/drive"
// // import { google } from "googleapis"

// export async function authenticate(keysFilePath: string) {
//     // console.log(drive, auth)
//     console.log("PATH", keysFilePath)
//     console.log(typeof keysFilePath)

//     const authData = new auth.GoogleAuth({
//         keyFile: keysFilePath, // "PATH_TO_SERVICE_ACCOUNT_KEY.json",
//         // Scopes can be specified either as an array or as a single, space-delimited string.
//         scopes: ["https://www.googleapis.com/auth/drive"],
//     })

//     console.log("DATA", authData)

//     const authClient = await authData.getClient()

//     console.log("CLIENT", authClient)

//     const client = drive({
//         version: "v3",
//         auth: authData,
//     })

//     console.log("DRIVE", client)

//     // let about = client.about
//     // console.log("ABOUT", about)

//     const res = await client.files.list({
//         pageSize: 3,
//     })

//     // fields: "nextPageToken, files(id, name)",
//     console.log("RES", res)
//     const files = res.data.files
//     console.log("FILES", files)

//     if (!files) return

//     if (files.length === 0) {
//         console.log("No files found.")
//     } else {
//         console.log("Files:")
//         for (const file of files) {
//             console.log(`${file.name} (${file.id})`)
//         }
//     }
// }

// // ///////////////

// // const path = require('path');
// // const {authenticate} = require('@google-cloud/local-auth');
// // const {google} = require('googleapis');

// // /**
// //  * Lists the names and IDs of up to 10 files.
// //  */
// // async function runSample() {
// //   // Obtain user credentials to use for the request
// //   const auth = await authenticate({
// //     keyfilePath: path.join(__dirname, '../oauth2.keys.json'),
// //     scopes: 'https://www.googleapis.com/auth/drive.metadata.readonly',
// //   });
// //   google.options({auth});

// //   const service = google.drive('v3');
// //   const res = await service.files.list({
// //     pageSize: 10,
// //     fields: 'nextPageToken, files(id, name)',
// //   });
// //   const files = res.data.files;
// //   if (files.length === 0) {
// //     console.log('No files found.');
// //   } else {
// //     console.log('Files:');
// //     for (const file of files) {
// //       console.log(`${file.name} (${file.id})`);
// //     }
// //   }
// // }
// // if (module === require.main) {
// //   runSample().catch(console.error);
// // }
// // // [END main_body]
// // module.exports = runSample;
