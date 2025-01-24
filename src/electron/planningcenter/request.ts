import { toApp } from ".."
import { MAIN } from "../../types/Channels"
import { httpsRequest } from "../utils/requests"
import { PCO_API_URL, pcoConnect, type PCOScopes } from "./connect"

const PCO_API_version = 2

type PCORequestData = {
    scope: PCOScopes
    endpoint: string
    // params?: object
}
export async function pcoRequest(data: PCORequestData): Promise<object | null> {
    const PCO_ACCESS = await pcoConnect(data.scope)
    if (!PCO_ACCESS) {
        toApp(MAIN, { channel: "ALERT", data: "Not authorized at Planning Center!" })
        return null
    }

    const path = `/${data.scope || "services"}/v${PCO_API_version}/${data.endpoint}`
    const headers = { Authorization: `Bearer ${PCO_ACCESS.access_token}` }

    return new Promise((resolve) => {
        httpsRequest(PCO_API_URL, path, "GET", headers, {}, (err: any, result: any) => {
            if (err) {
                console.log(path, err)
                toApp(MAIN, { channel: "ALERT", data: err.message })
                return resolve(null)
            }

            return result
        })
    })
}

// LOAD SERVICES

const ONE_WEEK_MS = 604800000
export async function loadServices() {
    let typesEndpoint = "service_types"
    const SERVICE_TYPES = await pcoRequest({ scope: "services", endpoint: typesEndpoint })
    console.log("TYPES", SERVICE_TYPES)
    if (!Array.isArray(SERVICE_TYPES)) return
    // if (!SERVICE_TYPES) return

    let projects: any[] = []

    await Promise.all(
        SERVICE_TYPES.map(async ({ id: typeId }) => {
            let plansEndpoint = typesEndpoint + `/${typeId}/plans`
            const SERVICE_PLANS = await pcoRequest({ scope: "services", endpoint: plansEndpoint })
            if (!Array.isArray(SERVICE_PLANS)) return
            console.log("PLANS", SERVICE_PLANS.length, SERVICE_PLANS[0])

            // only get plans from today to max a week in the future & with items
            const filteredPlans = SERVICE_PLANS.filter((a) => {
                if (!a.items.length) return false
                let date = new Date(a.sort_date).getTime()
                let today = Date.now()
                return date > today && date < today + ONE_WEEK_MS
            })

            await Promise.all(
                filteredPlans.map(async (plan: any) => {
                    let itemsEndpoint = plansEndpoint + `/${plan.id}/items`
                    const PLAN_ITEMS = await pcoRequest({ scope: "services", endpoint: itemsEndpoint })
                    if (!Array.isArray(PLAN_ITEMS)) return
                    console.log("ITEMS", PLAN_ITEMS.length)
                    console.log("VIDEO", PLAN_ITEMS[0])
                    console.log("SONG", PLAN_ITEMS[1])
                    console.log("TITLE", PLAN_ITEMS[2])

                    let projectItems: any[] = []
                    await Promise.all(
                        PLAN_ITEMS.map(async (item) => {
                            let type: "song" | "header" | "media" | "item" = item.item_type
                            if (type === "song") {
                                let songDataEndpoint = itemsEndpoint + `/${item.id}/song`
                                const SONG_DATA: any = await pcoRequest({ scope: "services", endpoint: songDataEndpoint })
                                let SONG: any = await pcoRequest({ scope: "services", endpoint: `/songs/${SONG_DATA?.id}/arrangements` })
                                if (!SONG) return

                                SONG.custom_arrangement_sequence = plan.custom_arrangement_sequence
                                SONG.id = `pcosong_${SONG.id}`

                                projectItems.push(SONG)
                            } else if (type === "media") {
                                let mediaEndpoint = itemsEndpoint + `/${item.id}/media`
                                const MEDIA = await pcoRequest({ scope: "services", endpoint: mediaEndpoint })

                                projectItems.push(MEDIA)
                            } else if (type === "header" || type === "item") {
                                projectItems.push(item)
                            }
                        })
                    )

                    if (!projectItems.length) return

                    let projectData = {
                        name: plan.attributes.title,
                        items: projectItems,
                    }
                    if (Object.keys(projectData).length) projects.push(projectData)
                })
            )
        })
    )

    console.log("PROJECTS", projects.length)
    toApp(MAIN, { channel: "PCO_PROJECTS", data: projects })
}
