import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain, sendMain } from "../IPC/main"
import { contentProviderData, projects, providerConnections } from "../stores"

export interface PcoAvailablePlan {
    planId: string
    serviceTypeId: string
    name: string
    date: string
    updatedAt?: string // baseline: remote state at last successful import
    itemsCount?: number // baseline item count at last successful import
    remoteUpdatedAt?: string // last observed remote state (from change check)
    remoteItemsCount?: number
}

const PCO_CHECK_INTERVAL_MS = 5 * 60 * 1000

let checkInterval: ReturnType<typeof setInterval> | null = null
let checking = false

function getAvailablePlans(): PcoAvailablePlan[] {
    return (get(contentProviderData).planningcenter?.availablePlans || []) as PcoAvailablePlan[]
}

// plans that are still imported as a (non-deleted) project
export function getTrackedPlans(): PcoAvailablePlan[] {
    const allProjects = get(projects)
    return getAvailablePlans().filter((p) => {
        const project = allProjects[p.planId]
        return !!project && !project.deleted
    })
}

export function planHasRemoteChanges(planId: string | null | undefined): boolean {
    if (!planId) return false
    const p = getAvailablePlans().find((a) => a.planId === planId)
    if (!p?.updatedAt) return false
    if (p.remoteUpdatedAt && p.remoteUpdatedAt !== p.updatedAt) return true
    if (typeof p.remoteItemsCount === "number" && typeof p.itemsCount === "number" && p.remoteItemsCount !== p.itemsCount) return true
    return false
}

// `manual` = user explicitly asked; skips the "already connected" guard (backend may open OAuth)
export async function checkPcoPlanChanges(manual = false): Promise<void> {
    if (checking) return
    if (!manual && !get(providerConnections).planningcenter) return

    const tracked = getTrackedPlans()
    if (!tracked.length) return

    checking = true
    try {
        const changes = await requestMain(Main.PCO_CHECK_PLANS, { plans: tracked.map((p) => ({ serviceTypeId: p.serviceTypeId, planId: p.planId })) })
        if (!changes?.length) return

        contentProviderData.update((a) => {
            if (!a.planningcenter) return a
            const plans = (a.planningcenter.availablePlans || []) as PcoAvailablePlan[]
            a.planningcenter.availablePlans = plans.map((p) => {
                const r = changes.find((c) => c.planId === p.planId)
                if (!r || r.missing) return p
                return { ...p, remoteUpdatedAt: r.updatedAt, remoteItemsCount: r.itemsCount }
            })
            return a
        })
    } catch (err) {
        console.error("[PCO] plan change check failed:", err)
    } finally {
        checking = false
    }
}

export function startPcoPlanChangeWatcher(): void {
    stopPcoPlanChangeWatcher()
    checkPcoPlanChanges()
    checkInterval = setInterval(() => checkPcoPlanChanges(), PCO_CHECK_INTERVAL_MS)
}

export function stopPcoPlanChangeWatcher(): void {
    if (checkInterval) {
        clearInterval(checkInterval)
        checkInterval = null
    }
}

// re-import a single plan; the PROVIDER_PROJECTS handler refreshes the stored baseline
export function resyncPcoPlan(serviceTypeId: string, planId: string): void {
    sendMain(Main.PCO_LOAD_PLAN, { serviceTypeId, planId })
}
