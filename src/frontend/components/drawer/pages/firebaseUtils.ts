import { initializeApp } from "firebase/app"
import { equalTo, get, getDatabase, onValue, orderByChild, query, ref, remove, set, update } from "firebase/database"

const firebaseConfig = {
    apiKey: "AIzaSyD-2gS7z6g80igXOfj_j0oQcJk4TkZsa18",
    authDomain: "freeshow-net.firebaseapp.com",
    databaseURL: "https://freeshow-net-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "freeshow-net",
    storageBucket: "freeshow-net.firebasestorage.app",
    messagingSenderId: "100356822840",
    appId: "1:100356822840:web:55f56b5b65cb0bbcb1d3cd",
    measurementId: "G-SD9S3Z96DQ"
}

const app = initializeApp(firebaseConfig)
const db = getDatabase(app)

// try to create a new node - can't overwrite existing ones
export async function createInteractionDb(dbid: string, secret: string, initialData: any): Promise<boolean> {
    const interactionRef = ref(db, `interactions/${dbid}`)
    try {
        await set(interactionRef, { ...initialData, secret })
        return true
    } catch {
        return false
    }
}

// update existing node - can only update existing id if the secret matches
export async function updateInteractionDb(dbid: string, secret: string, updateData: any): Promise<boolean> {
    const interactionRef = ref(db, `interactions/${dbid}`)
    try {
        await update(interactionRef, { ...updateData, secret })
        return true
    } catch {
        return false
    }
}

// delete existing node - can only delete if the secret matches
export async function deleteInteractionDb(dbid: string, secret: string): Promise<boolean> {
    const db = getDatabase()
    const interactionRef = ref(db, `interactions/${dbid}`)

    try {
        // only matching secret can write
        await update(interactionRef, { shouldDelete: true, secret })

        // anyone can delete if shouldDelete is true
        await remove(interactionRef)

        return true
    } catch {
        return false
    }
}

export async function getInteractionDb(dbid: string, secret: string): Promise<any> {
    const interactionsRef = ref(db, "interactions")
    const secretQuery = query(interactionsRef, orderByChild("secret"), equalTo(secret))
    try {
        const snapshot = await get(secretQuery)
        if (snapshot.exists()) {
            let data = null
            snapshot.forEach((child) => {
                if (child.key === dbid) {
                    data = child.val()
                    return true // stop iteration
                }
                return false
            })
            return data
        }
    } catch (e) {
        console.error("Error fetching interaction:", e)
    }
    return null
}

export function subscribeInteraction(dbid: string, secret: string, callback: (data: any | null) => void): () => void {
    const interactionsRef = ref(db, "interactions")
    const secretQuery = query(interactionsRef, orderByChild("secret"), equalTo(secret))

    return onValue(secretQuery, (snapshot) => {
        if (snapshot.exists()) {
            let data = null
            snapshot.forEach((child) => {
                if (child.key === dbid) {
                    data = child.val()
                    return true // stop iteration
                }
                return false
            })
            callback(data)
        } else {
            callback(null)
        }
    })
}
