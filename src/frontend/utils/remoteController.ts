import { initializeApp } from "firebase/app"
import { get, getDatabase, onValue, ref, remove, set } from "firebase/database"
import { get as getStore } from "svelte/store"
import { activePopup, alertMessage, special } from "../stores"
import { OutputHelper } from "../components/helpers/OutputHelper"

// same config as firebaseUtils.ts
const firebaseConfig = { apiKey: "AIzaSyD-2gS7z6g80igXOfj_j0oQcJk4TkZsa18", authDomain: "freeshow-net.firebaseapp.com", databaseURL: "https://freeshow-net-default-rtdb.europe-west1.firebasedatabase.app", projectId: "freeshow-net", storageBucket: "freeshow-net.firebasestorage.app", messagingSenderId: "100356822840", appId: "1:100356822840:web:55f56b5b65cb0bbcb1d3cd", measurementId: "G-SD9S3Z96DQ" }
const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

const commands = {
    next: () => OutputHelper.advanceOutputs("next"),
    previous: () => OutputHelper.advanceOutputs("previous")
}

let unsubscribe: (() => void) | null = null

export async function startRemoteController(id?: string) {
    id = id ?? getStore(special).remoteControllerId

    stopRemoteController(id)

    const controlRef = ref(db, `control/${id}`)

    try {
        const snapshot = await get(controlRef)
        if (!snapshot.exists()) {
            await set(controlRef, { isOpen: true })
        }
    } catch (error) {
        alertMessage.set("Remote Clicker: Failed to connect to Firebase. Please check your internet connection, or might be too many active users.")
        activePopup.set("alert")

        console.error("Error initializing remote controller db path:", error)
        special.update((a) => ({ ...a, remoteController: false }))
        return
    }

    unsubscribe = onValue(controlRef, (snapshot) => {
        const value = snapshot.val()
        const command = value?.command
        if (command) {
            commands[command]?.()

            // clear it again in the db
            const commandRef = ref(db, `control/${id}/command`)
            set(commandRef, null).catch((err) => {
                console.error("Error clearing remote command:", err)
            })
        }
    })
}

export async function stopRemoteController(id?: string) {
    id = id ?? getStore(special).remoteControllerId
    if (!id) return

    if (unsubscribe) {
        unsubscribe()
        unsubscribe = null
    }
    try {
        const controlRef = ref(db, `control/${id}`)
        await remove(controlRef)
    } catch (error) {
        console.error("Error removing remote controller db path:", error)
    }
}
