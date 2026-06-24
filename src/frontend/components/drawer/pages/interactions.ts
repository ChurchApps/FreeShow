import { get } from "svelte/store"
import { activeInteractions, activePopup, alertMessage, interactions } from "../../../stores"
import { clone, keysToID } from "../../helpers/array"
import { createInteractionDb, deleteInteractionDb, getInteractionDb, subscribeInteraction, updateInteractionDb } from "./firebaseUtils"

let existingInteractions = new Map<string, Interaction>()

function updateActiveInteractions() {
    activeInteractions.set(Array.from(existingInteractions.keys()))
}

export function getInteraction(id: string): Interaction | undefined {
    return existingInteractions.get(id)
}

export async function startInteraction(id: string) {
    if (existingInteractions.has(id)) {
        console.warn(`Interaction with ID: ${id} is already started`)
        return existingInteractions.get(id)!
    }

    const interactionClass = new Interaction(id)
    const success = await interactionClass.init() // Adjusted to be async because DB initialization is network-bound
    if (!success) {
        alertMessage.set("Failed to connect to Firebase. Please check your internet connection, or might be too many active users.")
        activePopup.set("alert")

        console.error(`Failed to start interaction with ID: ${id}`)
        return null
    }

    existingInteractions.set(id, interactionClass)
    updateActiveInteractions()
    return interactionClass
}

export async function stopInteraction(id: string) {
    await existingInteractions.get(id)?.destroy()
    existingInteractions.delete(id)
    updateActiveInteractions()
}

export async function stopAllInteractions() {
    for (const interaction of existingInteractions.values()) {
        await interaction.destroy()
    }
    existingInteractions.clear()
    updateActiveInteractions()
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

export function initConnection() {
    const id = generateId()
    const secret = generateSecret(id)
    return { id, secret }
}

const ADJECTIVES = ["Flying", "Dancing", "Happy", "Clever", "Swift", "Silent", "Golden", "Bright", "Sneaky", "Jolly", "Brave", "Calm", "Witty", "Lively", "Roaring", "Chubby", "Silly", "Gentle", "Sleepy", "Hungry", "Mighty", "Lucky"]
const NOUNS = ["Pigeon", "Panda", "Fox", "Koala", "Eagle", "Lion", "Tiger", "Dolphin", "Otter", "Rabbit", "Owl", "Squirrel", "Falcon", "Panther", "Badger", "Cheetah", "Penguin", "Wolf", "Beaver", "Monkey", "Giraffe", "Elephant", "Kangaroo"]

function generateRandomName(usedNames: Set<string>): string {
    let name = ""
    let attempts = 0
    do {
        const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
        const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
        name = `${adj}${noun}`
        attempts++
    } while (usedNames.has(name) && attempts < 100)

    if (usedNames.has(name)) {
        name = `${name}${Math.floor(Math.random() * 1000)}`
    }
    return name
}

class Interaction {
    id: string
    dbid: string
    dbsecret: string
    inputIndex: number = -1
    currentAnswer: any = null
    closed: boolean = false
    seconds: number = 0
    startTime: number = 0
    startTimes: Record<number, number> = {}
    usedRandomNames: Set<string> = new Set()
    private timer: any = null
    private unsubscribe: (() => void) | null = null
    private callbacks: ((data: { answers: any[]; clients: any; currentAnswer: any; inputIndex: number; closed: boolean }) => void)[] = []
    private tickCallbacks: ((data: { seconds: number; startTime: number; startTimes: Record<number, number>; closed: boolean }) => void)[] = []
    private lastData: { answers: any[]; clients: any; currentAnswer: any; inputIndex: number; closed: boolean } | null = null

    constructor(id: string) {
        this.id = id
    }

    onUpdate(callback: (data: { answers: any[]; clients: any; currentAnswer: any; inputIndex: number; closed: boolean }) => void) {
        this.callbacks.push(callback)
        if (this.lastData !== null) {
            callback(this.lastData)
        }
        return () => {
            this.callbacks = this.callbacks.filter((cb) => cb !== callback)
        }
    }

    onTick(callback: (data: { seconds: number; startTime: number; startTimes: Record<number, number>; closed: boolean }) => void) {
        this.tickCallbacks.push(callback)
        callback({ seconds: this.seconds, startTime: this.startTime, startTimes: this.startTimes, closed: this.closed })
        return () => {
            this.tickCallbacks = this.tickCallbacks.filter((cb) => cb !== callback)
        }
    }

    private getData() {
        return get(interactions)[this.id]
    }

    private startTimer() {
        if (this.timer) clearInterval(this.timer)
        this.timer = setInterval(async () => {
            this.seconds++

            const data = this.getData()
            const maxTime = data.options?.maxTime ?? 0
            if (maxTime > 0 && this.seconds >= maxTime) {
                this.closed = true
                this.stopTimer()
                this.tickCallbacks.forEach((cb) => cb({ seconds: this.seconds, startTime: this.startTime, startTimes: this.startTimes, closed: this.closed }))
                if (this.lastData) {
                    this.lastData.closed = true
                    this.callbacks.forEach((cb) => cb(this.lastData!))
                }

                const updatePayload = this.getDbPayload()
                await updateInteractionDb(this.dbid, this.dbsecret, updatePayload)
            } else {
                this.tickCallbacks.forEach((cb) => cb({ seconds: this.seconds, startTime: this.startTime, startTimes: this.startTimes, closed: this.closed }))
            }
        }, 1000)
    }

    private stopTimer() {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = null
        }
    }

    // Helper to format data for DB pushes
    private getDbPayload() {
        const data = this.getData()
        return {
            lastUpdate: Date.now(),
            public: {
                options: {
                    requireName: data.options?.requireName ?? true,
                    allAtOnce: data.options?.allAtOnce || false,
                    maxTime: data.options?.allAtOnce ? 0 : (data.options?.maxTime ?? 0)
                },
                name: data.name,
                inputIndex: this.inputIndex, // does not matter if allAtOnce is enabled
                inputCount: data.inputs.length,
                startTime: this.startTime,
                closed: this.closed,

                currentInputs: this.getCurrentInputs(),
                currentAnswer: this.currentAnswer
            }
        }
    }

    private getCurrentInputs() {
        const data = this.getData()

        if (data.options?.allAtOnce) {
            return clone(data.inputs)
        }

        if (this.inputIndex < 0) return null

        const input = clone(data.inputs[this.inputIndex])
        if (!input) return null

        if (input.type === "multi_choice" && input.options) {
            // remove answers
            input.options = input.options.map((o: any) => ({ value: o.value }))

            if (input.randomize) {
                // randomize options order
                const shuffledOptions = [...input.options]
                for (let i = shuffledOptions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1))
                    ;[shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]]
                }
                input.options = shuffledOptions
            }
        }

        return [input]
    }

    async init() {
        let isIdValid = false

        const data = this.getData()
        if (data?.inputs?.length === 1) {
            this.inputIndex = 0
            this.startTime = Date.now()
            this.startTimes[0] = this.startTime
            this.startTimer()
        }
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
                        if (this.inputIndex >= 0) {
                            this.startTime = existingData.public.startTime || Date.now()
                            this.startTimes[this.inputIndex] = this.startTime
                            this.closed = existingData.public.closed || false
                            this.seconds = Math.floor((Date.now() - this.startTime) / 1000)
                            if (!this.closed) this.startTimer()
                        }
                    }
                    if (existingData.public?.currentAnswer !== undefined) {
                        this.currentAnswer = existingData.public.currentAnswer
                    }
                    if (existingData.answers || existingData.clients) {
                        this.lastData = {
                            answers: existingData.answers || [],
                            clients: existingData.clients || {},
                            currentAnswer: this.currentAnswer,
                            inputIndex: this.inputIndex,
                            closed: this.closed
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
            this.stopTimer()
            if (this.unsubscribe) {
                this.unsubscribe()
                this.unsubscribe = null
            }
            return false
        }

        // store last connection details, so users can connect with the same ID in case of a crash or something
        interactions.update((a) => {
            if (a[this.id]) {
                a[this.id].lastConnection = { id: this.dbid, secret: this.dbsecret }
            }
            return a
        })

        console.info(`Interaction successfully provisioned at ID: ${this.dbid}`)

        this.unsubscribe = subscribeInteraction(this.dbid, this.dbsecret, (raw) => {
            // Controller
            if (raw.action === "next") {
                updateInteractionDb(this.dbid, this.dbsecret, { action: null })
                this.next()
                return
            } else if (raw.action === "prev") {
                updateInteractionDb(this.dbid, this.dbsecret, { action: null })
                this.previous()
                return
            }

            if (raw) {
                this.currentAnswer = raw.public?.currentAnswer || null
                this.closed = raw.public?.closed || false

                const clientsObj = raw.clients || {}
                this.handleRandomNames(clientsObj)

                const data = {
                    answers: raw.answers || [],
                    clients: clientsObj,
                    currentAnswer: this.currentAnswer,
                    inputIndex: raw.public?.inputIndex ?? -1,
                    closed: this.closed
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

    private handleRandomNames(clientsObj: any) {
        const clientKeys = Object.keys(clientsObj)

        const dataConfig = this.getData()
        const requireName = dataConfig?.options?.requireName ?? true
        const randomNames = dataConfig?.options?.randomNames ?? false

        if (!requireName && randomNames) {
            for (const clientId of clientKeys) {
                const clientData = clientsObj[clientId]
                if (!clientData.name || !this.usedRandomNames.has(clientData.name)) {
                    const hasValidRandomName = clientData.name && ADJECTIVES.some((adj) => clientData.name.startsWith(adj)) && NOUNS.some((n) => clientData.name.endsWith(n))

                    if (hasValidRandomName) {
                        this.usedRandomNames.add(clientData.name)
                    } else {
                        const newName = generateRandomName(this.usedRandomNames)
                        this.usedRandomNames.add(newName)
                        this.setClientName(clientId, newName)
                        clientData.name = newName
                    }
                }
            }
        }
    }

    async destroy() {
        this.saveHistory()

        this.stopTimer()

        if (this.unsubscribe) {
            this.unsubscribe()
            this.unsubscribe = null
        }

        if (!this.dbid || !this.dbsecret) return

        await deleteInteractionDb(this.dbid, this.dbsecret)
    }

    private saveHistory() {
        if (!this.lastData || !(this.lastData.answers || []).length) return

        const clients = this.getClients()
        const leaderboard = clients
            .map((c) => ({
                name: c.name || "",
                score: c.score || 0
            }))
            .sort((a, b) => b.score - a.score)

        const historyData: any = {
            time: Date.now(),
            inputs: this.getData().inputs.map((a, i) => ({
                question: a.question,
                answers: keysToID(this.lastData?.answers[i]).map((a) => {
                    return {
                        name: clients.find((c) => c.id === a.id)?.name || "",
                        value: a.value
                    }
                })
            }))
        }

        if (leaderboard.some((p) => p.score > 0)) {
            historyData.leaderboard = leaderboard
        }

        interactions.update((a) => {
            if (!a[this.id]) return a

            if (!a[this.id].history) a[this.id].history = []
            a[this.id].history!.push(historyData)

            return a
        })
    }

    private resetTimer() {
        if (this.inputIndex >= 0) {
            this.seconds = 0
            this.startTime = Date.now()
            this.startTimes[this.inputIndex] = this.startTime
            this.closed = false
            this.tickCallbacks.forEach((cb) => cb({ seconds: this.seconds, startTime: this.startTime, startTimes: this.startTimes, closed: this.closed }))
            this.startTimer()
        } else {
            this.stopTimer()
            this.seconds = 0
            this.startTime = 0
            this.closed = false
            this.tickCallbacks.forEach((cb) => cb({ seconds: this.seconds, startTime: this.startTime, startTimes: this.startTimes, closed: this.closed }))
        }
    }

    async previous() {
        if (this.inputIndex < 0) return // allow -1
        this.inputIndex--
        this.currentAnswer = null

        this.resetTimer()

        // Sync the updated index and current input to Firebase
        const updatePayload = this.getDbPayload()
        await updateInteractionDb(this.dbid, this.dbsecret, updatePayload)
    }

    async next() {
        const data = this.getData()

        const input = data.inputs[this.inputIndex]
        if (hasAnswer(input) && (this.currentAnswer === null || this.currentAnswer === undefined || this.currentAnswer === "")) {
            await this.revealAnswer()
            return
        }

        // Prevent going out of bounds
        if (this.inputIndex < data.inputs.length - 1) {
            this.inputIndex++
            this.currentAnswer = null

            this.resetTimer()

            // Sync the updated index and current input to Firebase
            const updatePayload = this.getDbPayload()
            await updateInteractionDb(this.dbid, this.dbsecret, updatePayload)
        }
    }

    async goto(index: number) {
        const data = this.getData()
        if (index < 0 || index >= data.inputs.length) return

        this.inputIndex = index
        this.currentAnswer = null

        this.resetTimer()

        const updatePayload = this.getDbPayload()
        await updateInteractionDb(this.dbid, this.dbsecret, updatePayload)
    }

    async revealAnswer() {
        const data = this.getData()
        const input = data.inputs[this.inputIndex]
        if (!input) return

        if (input.type === "text" || input.type === "number") {
            this.currentAnswer = input.answer
        } else if (input.type === "multi_choice") {
            this.currentAnswer = input.options?.filter((o: any) => o.isAnswer).map((o: any) => o.value)
        }

        if (this.currentAnswer === null || this.currentAnswer === undefined || this.currentAnswer === "") return
        this.closed = true

        const scoreUpdates = this.getScoreUpdates()

        const updatePayload = {
            ...this.getDbPayload(),
            ...scoreUpdates
        }
        await updateInteractionDb(this.dbid, this.dbsecret, updatePayload)
    }

    private scoredPlayers: Set<string> = new Set()
    getScoreUpdates() {
        const data = this.getData()
        if (!data || !this.lastData) return {}

        const input = data.inputs[this.inputIndex]
        if (!input || !hasAnswer(input)) return {}

        const scoreSystem = data.options?.scoreSystem || "incremental"
        const scorePoints = data.options?.scorePoints ?? (scoreSystem === "falloff" ? 10 : scoreSystem === "speed" ? 100 : 1)

        const inputAnswers = this.lastData.answers?.[this.inputIndex] || {}

        // find all correct answers and the times
        const correctAnswers = Object.entries(inputAnswers)
            .filter(([_clientId, ans]: [string, any]) => ans && isCorrect(input, ans.value))
            .map(([clientId, ans]: [string, any]) => ({ clientId, time: ans.time || 0 }))
            .sort((a, b) => a.time - b.time)

        const updatePayload: any = {}

        correctAnswers.forEach((ans, index) => {
            const key = `${this.inputIndex}-${ans.clientId}`

            // don't count twice for the same player on the same question
            if (this.scoredPlayers.has(key)) return

            let points = 0
            if (scoreSystem === "incremental") {
                points = scorePoints
            } else if (scoreSystem === "falloff") {
                points = Math.max(1, scorePoints - index)
            } else if (scoreSystem === "speed") {
                let elapsed = 0
                if (this.startTime && ans.time) {
                    elapsed = Math.max(0, (ans.time - this.startTime) / 1000)
                } else {
                    const times = Object.values(inputAnswers)
                        .map((a: any) => a?.time)
                        .filter(Boolean) as number[]
                    if (times.length > 0) {
                        const firstAnswerTime = Math.min(...times)
                        elapsed = Math.max(0, (ans.time - firstAnswerTime) / 1000)
                    } else {
                        elapsed = 0
                    }
                }
                const limit = data.options?.maxTime && data.options.maxTime > 0 ? data.options.maxTime : 30
                const ratio = Math.max(0, Math.min(1, elapsed / limit))
                points = Math.round(scorePoints * (1 - ratio))
            }

            // Get current score of the client from lastData
            const clientObj = this.lastData?.clients?.[ans.clientId]
            const currentScore = clientObj?.score || 0
            const newScore = currentScore + points

            // Add update to DB payload
            updatePayload[`clients/${ans.clientId}/score`] = newScore

            this.scoredPlayers.add(key)
        })

        return updatePayload
    }

    async kick(clientId: string) {
        // Prepare payload to remove client and their answers
        const updatePayload: any = {
            [`clients/${clientId}`]: null
        }

        // If answers exist, remove the specific client's answer from each input
        if (this.lastData?.answers) {
            const currentAnswers = this.lastData.answers
            const isArray = Array.isArray(currentAnswers)

            if (isArray) {
                updatePayload.answers = currentAnswers.map((ans: any) => {
                    const newAns = { ...ans }
                    delete newAns[clientId]
                    return newAns
                })
            }
        }

        await updateInteractionDb(this.dbid, this.dbsecret, updatePayload)
    }

    async setScore(clientId: string, score: number) {
        await updateInteractionDb(this.dbid, this.dbsecret, {
            [`clients/${clientId}/score`]: score
        })
    }

    async setClientName(clientId: string, name: string) {
        await updateInteractionDb(this.dbid, this.dbsecret, {
            [`clients/${clientId}/name`]: name
        })
    }

    ///

    getClients(): { id: string; name?: string; time?: number; connected?: boolean; score?: number }[] {
        const clients = keysToID(this.lastData?.clients || {})

        const data = this.getData()
        const requireName = data?.options?.requireName ?? true
        const randomNames = data?.options?.randomNames ?? false

        // joined order
        clients.sort((a, b) => (a.time || 0) - (b.time || 0))

        // ensure name and score is set
        clients.forEach((a, i) => {
            if (!requireName) {
                if (randomNames && a.name) {
                    // keep a.name (the random name)
                } else {
                    a.name = `User #${i + 1}`
                }
            } else {
                a.name = a.name || `User #${i + 1}`
            }
            a.score = a.score || 0
        })

        return clients
    }

    getClientsCount() {
        return Object.keys(this.lastData?.clients || {}).length
    }

    getQuestion(): string[] {
        const data = this.getData()

        if (data.options?.allAtOnce) {
            return (data.inputs || []).map((input: any) => input.question || "")
        }

        const input = data.inputs[this.inputIndex]
        return input ? [input.question || ""] : []
    }

    getInputOptions(): string[] {
        const data = this.getData()
        if (data.options?.allAtOnce) return []

        const input = data.inputs[this.inputIndex]
        if (input && input.type === "multi_choice" && input.options) {
            return input.options.map((o: any) => o.value || "")
        }
        return []
    }

    getTime() {
        if (this.closed || this.inputIndex < 0) return ""

        const data = this.getData()
        if (data.options?.allAtOnce) return ""

        if (data.options?.maxTime) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000)
            return formatTimeInteraction(Math.max(0, (data.options.maxTime || 0) - elapsed))
        }

        return formatTimeInteraction(this.seconds)
    }

    getAnswer() {
        if (Array.isArray(this.currentAnswer)) {
            return this.currentAnswer.join(", ")
        }

        if (this.currentAnswer === null || this.currentAnswer === undefined) return ""
        return String(this.currentAnswer)
    }

    getPlayerAnswers() {
        const answers = clone(this.lastData?.answers || [])
        return Object.values(answers[this.inputIndex] || {}).map((a: any) => (Array.isArray(a.value) ? a.value.join(", ") : String(a.value))) as string[]
    }

    getPlayerAnswerLatest() {
        const answers = clone(this.lastData?.answers || [])

        // sort by time
        const sortedAnswers = Object.values(answers[this.inputIndex] || {}).sort((a: any, b: any) => (a.time || 0) - (b.time || 0))

        const latestAnswers = sortedAnswers.map((a: any) => String(Array.isArray(a.value) ? a.value.at(-1) : a.value)) as string[]
        return latestAnswers[latestAnswers.length - 1] || ""
    }

    getLeaderboard() {
        const clients = this.getClients()
        return clients
            .map((c) => ({
                name: c.name || "",
                score: c.score || 0
            }))
            .sort((a, b) => b.score - a.score)
            .map((c) => `${c.name}: ${c.score}`)
    }

    getOptionPercentages(): string[] {
        const data = this.getData()
        if (data.options?.allAtOnce) return []

        const input = data.inputs[this.inputIndex]
        if (input && input.type === "multi_choice" && input.options) {
            const inputAnswers = this.lastData?.answers?.[this.inputIndex] || {}
            const answersList = Object.values(inputAnswers)
            const totalAnswers = answersList.length

            const percentages = input.options.map((o: any) => {
                if (totalAnswers === 0) return "0%"
                const chosenCount = answersList.filter((ans: any) => {
                    if (!ans || ans.value === undefined) return false
                    const clientValues = Array.isArray(ans.value) ? ans.value : [ans.value]
                    return clientValues.includes(o.value)
                }).length
                const percent = Math.round((chosenCount / totalAnswers) * 100)
                return `${percent}%`
            })
            return [percentages.join("<br>"), ...percentages]
        }
        return []
    }
}

export function formatTimeInteraction(s: number) {
    const sign = s < 0 ? "-" : ""
    s = Math.abs(s)
    const min = Math.floor(s / 60)
    const sec = s % 60
    return `${sign}${min}:${sec < 10 ? "0" : ""}${sec}`
}

function hasAnswer(input: any) {
    if (!input) return false
    if (input.type === "text" || input.type === "number") return input.answer !== undefined && input.answer !== ""
    if (input.type === "multi_choice") return input.options?.some((o: any) => o.isAnswer)
    return false
}

function isCorrect(input: any, value: any) {
    if (!input) return false
    if (input.type === "text" || input.type === "number") {
        if (input.answer === undefined || input.answer === "") return false
        return String(value).toLowerCase().trim() === String(input.answer).toLowerCase().trim()
    }
    if (input.type === "multi_choice") {
        const correctValues = input.options?.filter((o: any) => o.isAnswer).map((o: any) => o.value) || []
        const clientValues = Array.isArray(value) ? value : [value]
        if (correctValues.length === 0 || clientValues.length === 0) return false
        if (clientValues.length !== correctValues.length) return false
        return clientValues.every((v: any) => correctValues.includes(v))
    }
    return false
}
