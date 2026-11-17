import { get } from "svelte/store"
import { Main } from "../../types/IPC/Main"
import { requestMain } from "../IPC/main"
import { contentProviderData, pcoPlansWithUpdates, projects, providerConnections } from "../stores"

const ONE_MINUTE = 60 * 1000

let checkInterval: ReturnType<typeof setInterval> | null = null
export function startPcoPlanChangeWatcher() {
    stopPcoPlanChangeWatcher()
    checkPcoPlanChanges()
    checkInterval = setInterval(checkPcoPlanChanges, 5 * ONE_MINUTE)
}

export function stopPcoPlanChangeWatcher() {
    if (checkInterval) {
        clearInterval(checkInterval)
        checkInterval = null
    }
}

let checking = false
async function checkPcoPlanChanges() {
    if (checking || !get(providerConnections).planningcenter) return

    const allProjects = get(projects)
    const plans = (get(contentProviderData).planningcenter?.availablePlans || []) as any[]
    const tracked = plans.filter((p) => allProjects[p.planId] && !allProjects[p.planId].deleted)
    if (!tracked.length) return

    checking = true
    try {
        const changes = await requestMain(Main.PCO_CHECK_PLANS, { plans: tracked.map((p) => ({ serviceTypeId: p.serviceTypeId, planId: p.planId })) })
        if (!changes?.length) return

        const updated = tracked
            .filter((p) => {
                const r = changes.find((c: any) => c.planId === p.planId)
                return r && !r.missing && p.updatedAt && (r.updatedAt !== p.updatedAt || r.itemsCount !== p.itemsCount)
            })
            .map((p) => p.planId)

        pcoPlansWithUpdates.set(updated)
    } catch (err) {
        console.error("[PCO] plan change check failed:", err)
    } finally {
        checking = false
    }
}
