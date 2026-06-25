import Pusher from "pusher-js"
import { get } from "svelte/store"
import { STAGE } from "../../types/Channels"
import { Main } from "../../types/IPC/Main"
import type { Timer } from "../../types/Show"
import { activeProject, activeTimers, contentProviderData, timers } from "../stores"
import { requestMain } from "../IPC/main"
import { send } from "./request"

const PUSHER_APP_KEY = "6d1601960fdf505090b8"
const PUSHER_CLUSTER = "mt1"
const TICK_INTERVAL_MS = 1_000
// Recovery poll debounce for unknown Pusher events (e.g. going back to pre-service).
// goToPlanItemTime is handled directly from the event payload — no poll needed.
const RECOVERY_POLL_DEBOUNCE_MS = 500

interface LiveCacheEntry {
    liveId: string | null
    liveChannel: string | null
    liveStartAt: Date | null
    liveEndAt: Date | null
    length: number | null
    pusherLength: number | null // length from goToPlanItemTime event; takes priority over REST API length
    isPreService: boolean
    serviceStartAt: Date | null
    serviceEndAt: Date | null
}

const liveCache = new Map<string, LiveCacheEntry>()

// Parses PCO's non-standard datetime format: "2026/06/16 11:24:29 -0500"
function parseActualStart(s: string | null | undefined): Date | null {
    if (!s) return null
    const m = s.match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/)
    if (!m) return null
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}${m[5]}:${m[6]}`)
    return isNaN(d.getTime()) ? null : d
}

function serviceScheduleFallback(cached: LiveCacheEntry, now: number): number {
    const target = cached.serviceStartAt && cached.serviceStartAt.getTime() > now ? cached.serviceStartAt : cached.serviceEndAt
    return target ? Math.round((target.getTime() - now) / 1000) : 0
}

let tickInterval: ReturnType<typeof setInterval> | null = null
let pusherInstance: Pusher | null = null

const subscribedChannels = new Set<string>()
const channelToTimerIds = new Map<string, string[]>()
const recoveryPollDebounce = new Map<string, ReturnType<typeof setTimeout>>()
const prevTimerPlanKey = new Map<string, string>() // tracks last known serviceTypeId:planId per timer

let activePcoTimerIds: string[] = []
let lastTimerKey = ""

function resolveTimerPlan(timer: Timer): { serviceTypeId: string; planId: string } | null {
    const pco = timer.pco
    if (!pco) return null
    if (pco.serviceTypeId && pco.planId) return { serviceTypeId: pco.serviceTypeId, planId: pco.planId }

    const activeProjId = get(activeProject)
    if (!activeProjId) return null
    const plans = get(contentProviderData)?.planningcenter?.availablePlans
    return plans?.find((p: any) => p.planId === activeProjId) ?? null
}

export function initPcoLiveSync(allTimers: { [key: string]: Timer }) {
    if (!get(contentProviderData)?.planningcenter) return

    const pcoTimers = Object.entries(allTimers).filter(([, t]) => t.type === "pco_live" && t.pco)

    const newIds: string[] = []
    const keyParts: string[] = []
    for (const [id, t] of pcoTimers) {
        newIds.push(id)
        const p = resolveTimerPlan(t)
        keyParts.push(`${id}:${p?.serviceTypeId ?? ""}:${p?.planId ?? ""}:${t.pco?.countdownType ?? ""}`)
    }
    newIds.sort()
    const newKey = keyParts.sort().join(",")

    if (newKey === lastTimerKey) return // nothing changed
    lastTimerKey = newKey
    activePcoTimerIds = newIds

    // Only clear cache for timers whose plan changed — not for countdown-type-only changes,
    // which would wipe pusherLength and cause the display to show 00:00.
    for (const [id, t] of pcoTimers) {
        const plan = resolveTimerPlan(t)
        const planKey = `${plan?.serviceTypeId ?? ""}:${plan?.planId ?? ""}`
        if (prevTimerPlanKey.get(id) !== planKey) liveCache.delete(id)
        prevTimerPlanKey.set(id, planKey)
    }
    for (const id of prevTimerPlanKey.keys()) {
        if (!activePcoTimerIds.includes(id)) prevTimerPlanKey.delete(id)
    }

    if (!activePcoTimerIds.length) {
        stopPcoLiveSync()
        return
    }

    // Seed the activeTimers store with pco_live entries so the stage sees them
    activeTimers.update((a) => [...a.filter((t) => !t.pcoLive), ...activePcoTimerIds.map((id) => ({ id, currentTime: 0, start: 0, end: 0, paused: false, pcoLive: true }))])

    startTick()
    // One-time initial poll to get serviceStartAt/serviceEndAt and subscribe to Pusher.
    // After this, Pusher events drive all state updates — no periodic polling.
    pollAllTimers()
}

function stopPcoLiveSync() {
    liveCache.clear()

    if (tickInterval) {
        clearInterval(tickInterval)
        tickInterval = null
    }

    if (pusherInstance) {
        subscribedChannels.forEach((ch) => pusherInstance!.unsubscribe(ch))
    }
    subscribedChannels.clear()
    channelToTimerIds.clear()
    recoveryPollDebounce.forEach((t) => clearTimeout(t))
    recoveryPollDebounce.clear()
    prevTimerPlanKey.clear()

    activeTimers.update((a) => a.filter((t) => !t.pcoLive))
}

function startTick() {
    if (tickInterval) clearInterval(tickInterval)
    tickInterval = setInterval(tickPcoTimers, TICK_INTERVAL_MS)
}

function tickPcoTimers() {
    if (!activePcoTimerIds.length) return

    const now = Date.now()
    const allTimers = get(timers)
    const getDiffSeconds = (targetMs: number) => Math.round((targetMs - now) / 1000)

    activeTimers.update((a) => {
        for (const id of activePcoTimerIds) {
            const timer = allTimers[id] as Timer | undefined
            if (!timer) continue

            const cached = liveCache.get(id)
            let currentTime = 0

            if (cached) {
                const effectiveLength = cached.pusherLength ?? cached.length
                const type = timer.pco?.countdownType

                if (type === "end_service" && cached.serviceEndAt) {
                    currentTime = getDiffSeconds(cached.serviceEndAt.getTime())
                } else if (!cached.liveStartAt || cached.isPreService) {
                    currentTime = serviceScheduleFallback(cached, now)
                } else if (effectiveLength) {
                    currentTime = getDiffSeconds(cached.liveStartAt.getTime() + effectiveLength * 1000)
                }

                if (currentTime < 0 && !timer.overflow) currentTime = 0
            }

            const existing = a.find((t) => t.id === id)
            if (existing) {
                existing.currentTime = currentTime
            } else {
                a.push({ id, currentTime, start: 0, end: 0, paused: false, pcoLive: true })
            }
        }
        return a
    })

    // Broadcast updated activeTimers to stage display
    send(STAGE, ["ACTIVE_TIMERS"], get(activeTimers))
}

function getPusher(): Pusher {
    if (!pusherInstance) {
        pusherInstance = new Pusher(PUSHER_APP_KEY, { cluster: PUSHER_CLUSTER })

        // Re-sync on reconnect in case events were missed while disconnected
        pusherInstance.connection.bind("connected", () => {
            if (activePcoTimerIds.length) pollAllTimers()
        })
    }
    return pusherInstance
}

function subscribePusherChannel(timerId: string, liveChannel: string) {
    const existingIds = channelToTimerIds.get(liveChannel)
    if (existingIds) {
        if (!existingIds.includes(timerId)) existingIds.push(timerId)
        return
    }

    channelToTimerIds.set(liveChannel, [timerId])
    subscribedChannels.add(liveChannel)

    const channel = getPusher().subscribe(liveChannel)

    channel.bind_global((eventName: string, eventData: any) => {
        if (eventName.startsWith("pusher:") || eventName.startsWith("pusher_internal:")) return
        const ids = channelToTimerIds.get(liveChannel) ?? []

        if (eventName === "goToPlanItemTime" && eventData?.item_id) {
            // Real service item — update cache directly from event, no API call needed.
            const pusherStart = parseActualStart(eventData?.actual_start)
            const pusherLen = typeof eventData?.length === "number" ? eventData.length : null
            for (const id of ids) {
                const entry = liveCache.get(id)
                if (!entry) continue
                if (pusherStart) entry.liveStartAt = pusherStart
                if (pusherLen !== null) entry.pusherLength = pusherLen
                entry.isPreService = false
            }
            return
        }

        // Unknown event or goToPlanItemTime without item_id (pre-service state) —
        // do one recovery poll to resync isPreService and related fields.
        for (const id of ids) {
            const pending = recoveryPollDebounce.get(id)
            if (pending) clearTimeout(pending)
            recoveryPollDebounce.set(
                id,
                setTimeout(() => {
                    recoveryPollDebounce.delete(id)
                    pollTimer(id)
                }, RECOVERY_POLL_DEBOUNCE_MS)
            )
        }
    })
}

async function pollTimer(id: string) {
    const allTimers = get(timers)
    const timer = allTimers[id] as Timer | undefined
    if (!timer) return
    const plan = resolveTimerPlan(timer)
    if (!plan?.serviceTypeId || !plan?.planId) return

    try {
        const data = await requestMain(Main.PCO_LIVE_GET, { serviceTypeId: plan.serviceTypeId, planId: plan.planId })

        const parseDate = (d: any) => (d ? new Date(d) : null)
        liveCache.set(id, {
            liveId: data?.liveId ?? null,
            liveChannel: data?.liveChannel ?? null,
            liveStartAt: parseDate(data?.liveStartAt),
            liveEndAt: parseDate(data?.liveEndAt),
            length: data?.length ?? null,
            pusherLength: liveCache.get(id)?.pusherLength ?? null,
            isPreService: data?.isPreService ?? false,
            serviceStartAt: parseDate(data?.serviceStartAt),
            serviceEndAt: parseDate(data?.serviceEndAt)
        })

        if (data?.liveChannel) subscribePusherChannel(id, data.liveChannel)
    } catch (err) {
        console.error("[PCO Live] pollTimer error:", err)
    }
}

async function pollAllTimers() {
    await Promise.all(activePcoTimerIds.map((id) => pollTimer(id)))
}
