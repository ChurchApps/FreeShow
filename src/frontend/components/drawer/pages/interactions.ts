import { get } from "svelte/store"
import { interactions } from "../../../stores"
import { createInteractionDb, deleteInteractionDb, getInteractionDb, subscribeInteraction, updateInteractionDb } from "./firebaseUtils"

let existingInteractions = new Map<string, Interaction>()

export function getInteraction(id: string): Interaction | undefined {
    return existingInteractions.get(id)
}

export async function startInteraction(id: string) {
    const interactionClass = new Interaction(id)
    const success = await interactionClass.init() // Adjusted to be async because DB initialization is network-bound
    if (!success) {
        console.error(`Failed to start interaction with ID: ${id}`)
        return null
    }

    existingInteractions.set(id, interactionClass)
    return interactionClass
}

export async function stopInteraction(id: string) {
    await existingInteractions.get(id)?.destroy()
    existingInteractions.delete(id)
}

export async function stopAllInteractions() {
    for (const interaction of existingInteractions.values()) {
        await interaction.destroy()
    }
    existingInteractions.clear()
}

export function getActiveInteractions() {
    return Array.from(existingInteractions.keys())
}

// only numbers
function generateId(length: number = 5) {
    let result = ""
    while (result.length < length) {
        result += Math.floor(Math.random() * 10).toString()
    }
    return result.substring(0, length)
}

function generateSecret(id: string, length = 16) {
    let result = ""
    while (result.length < length) result += Math.random().toString(36).substring(2)
    return `${id}-${result.substring(0, length)}`
}

class Interaction {
    id: string
    dbid: string
    dbsecret: string
    inputIndex: number = -1
    private unsubscribe: (() => void) | null = null
    private callbacks: ((data: { answers: any; clients: any }) => void)[] = []
    private lastData: { answers: any; clients: any } | null = null

    constructor(id: string) {
        this.id = id
    }

    onUpdate(callback: (data: { answers: any; clients: any }) => void) {
        this.callbacks.push(callback)
        if (this.lastData !== null) {
            callback(this.lastData)
        }
    }

    private getData() {
        return get(interactions)[this.id]
    }

    // Helper to format data for DB pushes
    private getDbPayload() {
        const data = this.getData()
        return {
            lastUpdate: Date.now(),
            public: {
                options: { requireName: true },
                name: data.name,
                inputIndex: this.inputIndex,
                inputCount: data.inputs.length,
                // If inputIndex is valid, upload the specific input data, otherwise null
                currentInput: this.inputIndex >= 0 && data.inputs[this.inputIndex] ? data.inputs[this.inputIndex] : null
            }
        }
    }

    async init() {
        let isIdValid = false

        const data = this.getData()
        let lastConnection = data.lastConnection || null

        // Keep generating IDs until we successfully write to a unique, non-existent slot
        const MAX_ATTEMPTS = 5
        let attempts = 0
        while (!isIdValid && attempts < MAX_ATTEMPTS) {
            this.dbid = lastConnection?.id || generateId(attempts > 2 ? 6 : 5)
            this.dbsecret = lastConnection?.secret || generateSecret(this.dbid)

            if (lastConnection) {
                const existingData = await getInteractionDb(this.dbid, this.dbsecret)
                if (existingData) {
                    // recover existing state
                    if (existingData.public?.inputIndex !== undefined) {
                        this.inputIndex = existingData.public.inputIndex
                    }
                    if (existingData.answers || existingData.clients) {
                        this.lastData = {
                            answers: existingData.answers || {},
                            clients: existingData.clients || {}
                        }
                    }

                    isIdValid = true
                    break
                }
            }

            const initialPayload = this.getDbPayload()

            // createInteractionDb returns true if write succeeds, false if rule blocks it (ID collision)
            isIdValid = await createInteractionDb(this.dbid, this.dbsecret, initialPayload)

            if (!isIdValid) lastConnection = null
            attempts++
        }

        if (!isIdValid) {
            console.error(`Failed to provision interaction after ${MAX_ATTEMPTS} attempts`)
            return false
        }

        // store last connection details, so users can connect with the same ID in case of a crash or something
        interactions.update((a) => {
            if (a[this.id]) {
                a[this.id].lastConnection = { id: this.dbid, secret: this.dbsecret }
            }
            return a
        })

        console.log(`Interaction successfully provisioned at ID: ${this.dbid}`)

        this.unsubscribe = subscribeInteraction(this.dbid, this.dbsecret, (raw) => {
            if (raw) {
                const data = {
                    answers: raw.answers || {},
                    clients: raw.clients || {}
                }
                this.lastData = data
                this.callbacks.forEach((cb) => cb(data))
            } else {
                this.lastData = null
                // Maybe notify callbacks about null data if needed
            }
        })

        return true
    }

    async destroy() {
        if (this.unsubscribe) {
            this.unsubscribe()
            this.unsubscribe = null
        }

        if (!this.dbid || !this.dbsecret) return

        await deleteInteractionDb(this.dbid, this.dbsecret)
    }

    async previous() {
        if (this.inputIndex < 0) return // allow -1
        this.inputIndex--

        // Sync the updated index and current input to Firebase
        const updatePayload = this.getDbPayload()
        await updateInteractionDb(this.dbid, this.dbsecret, updatePayload)
    }

    async next() {
        const data = this.getData()
        // Prevent going out of bounds
        if (this.inputIndex < data.inputs.length - 1) {
            this.inputIndex++

            // Sync the updated index and current input to Firebase
            const updatePayload = this.getDbPayload()
            await updateInteractionDb(this.dbid, this.dbsecret, updatePayload)
        }
    }
}
