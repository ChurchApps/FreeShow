import { uid } from "uid"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"
import type { Show, Slide } from "../../types/Show"
import { httpsRequest } from "../utils/requests"
import { PCO_API_URL, pcoConnect, type PCOScopes } from "./connect"

const PCO_API_version = 2

type PCORequestData = {
    scope: PCOScopes
    endpoint: string
    // params?: object
}
export async function pcoRequest(data: PCORequestData): Promise<any> {
    const PCO_ACCESS = await pcoConnect(data.scope)
    if (!PCO_ACCESS) {
        toApp(MAIN, { channel: "ALERT", data: "Not authorized at Planning Center (try logging out and in again)!" })
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

            // console.log("RESULT", path, result) // DEBUG
            resolve(result)
        })
    })
}

// LOAD SERVICES

const ONE_WEEK_MS = 604800000
export async function pcoLoadServices() {
    let typesEndpoint = "service_types"
    const SERVICE_TYPES = (await pcoRequest({ scope: "services", endpoint: typesEndpoint }))?.data
    if (!Array.isArray(SERVICE_TYPES)) return
    toApp(MAIN, { channel: "TOAST", data: "Getting schedules from Planning Center" })

    let projects: any[] = []
    let shows: Show[] = []

    await Promise.all(
        SERVICE_TYPES.map(async (serviceType) => {
            let plansEndpoint = typesEndpoint + `/${serviceType.id}/plans`
            const SERVICE_PLANS = (await pcoRequest({ scope: "services", endpoint: plansEndpoint }))?.data
            if (!Array.isArray(SERVICE_PLANS)) return

            // only get plans from today to max a week in the future & with items
            const filteredPlans = SERVICE_PLANS.filter(({ attributes: a }) => {
                if (a.items_count === 0) return false
                let date = new Date(a.sort_date).getTime()
                // let today = Date.now()
                let today = new Date("2025.01.24").getTime() // DEBUG
                return date > today && date < today + ONE_WEEK_MS
            })

            await Promise.all(
                filteredPlans.map(async (plan: any) => {
                    let itemsEndpoint = plansEndpoint + `/${plan.id}/items`
                    const PLAN_ITEMS = (await pcoRequest({ scope: "services", endpoint: itemsEndpoint }))?.data
                    if (!Array.isArray(PLAN_ITEMS)) return

                    // const orderedItems = PLAN_ITEMS.sort((a, b) => a.attributes.sequence - b.attributes.sequence)

                    let projectItems: any[] = []
                    for (let item of PLAN_ITEMS) {
                        let type: "song" | "header" | "media" | "item" = item.attributes.item_type
                        if (type === "song") {
                            let songDataEndpoint = itemsEndpoint + `/${item.id}/song`
                            const SONG_DATA: any = (await pcoRequest({ scope: "services", endpoint: songDataEndpoint }))?.data
                            if (!SONG_DATA) return
                            let songArrangement: any = (await pcoRequest({ scope: "services", endpoint: `/songs/${SONG_DATA.id}/arrangements` }))?.data[0]
                            if (!songArrangement) return

                            const SONG = songArrangement.attributes

                            // let lyrics = SONG.lyrics || ""
                            let sequence: string[] = plan.custom_arrangement_sequence || SONG.sequence || []
                            let SECTIONS: any[] = (await pcoRequest({ scope: "services", endpoint: `/songs/${SONG_DATA.id}/arrangements/${songArrangement.id}/sections` }))?.data.attributes.sections || []
                            if (!SECTIONS.length) SECTIONS = sequence.map((id) => ({ label: id, lyrics: "" }))

                            const show = getShow(SONG_DATA, SONG, SECTIONS)
                            let showId = `pcosong_${SONG_DATA.id}`
                            shows.push({ id: showId, ...show })

                            projectItems.push({ type: "show", id: showId })
                        } else if (type === "media") {
                            let mediaEndpoint = itemsEndpoint + `/${item.id}/media`
                            const MEDIA = (await pcoRequest({ scope: "services", endpoint: mediaEndpoint }))?.data[0].attributes

                            // WIP download actual media file!
                            // projectItems.push({ type: "image/video", name: MEDIA.title, length: MEDIA.length })
                            projectItems.push({ name: MEDIA.title, type: "image", id: MEDIA.thumbnail_url })
                        } else if (type === "header" || type === "item") {
                            projectItems.push({ type: "section", id: uid(5), name: item.attributes.title || "", notes: item.attributes.description || "" })
                        }
                    }

                    if (!projectItems.length) return

                    let projectData = {
                        id: plan.id,
                        name: plan.attributes.title || getDateTitle(plan.attributes.sort_date),
                        created: new Date(plan.attributes.created_at),
                        folderId: serviceType.id || "",
                        folderName: serviceType.attributes.name || "",
                        items: projectItems,
                    }
                    if (Object.keys(projectData).length) projects.push(projectData)
                })
            )
        })
    )

    toApp(MAIN, { channel: "PCO_PROJECTS", data: { shows, projects } })
}

function getDateTitle(dateString: string) {
    const date = new Date(dateString)
    return date.toISOString().slice(0, 10)
}

const itemStyle = "left:50px;top:120px;width:1820px;height:840px;"
function getShow(SONG_DATA: any, SONG: any, SECTIONS: any[]) {
    const slides: { [key: string]: Slide } = {}
    let layoutSlides: any[] = []
    SECTIONS.forEach((section) => {
        let slideId = uid()

        let items = [
            {
                style: itemStyle,
                lines: section.lyrics.split("\n").map((a: any) => ({ align: "", text: [{ style: "", value: a }] })),
            },
        ]

        slides[slideId] = {
            group: section.label,
            globalGroup: section.label.toLowerCase(),
            color: null,
            settings: {},
            notes: "",
            items,
        }
        layoutSlides.push({ id: slideId })
    })

    const metadata = {
        bpm: SONG.bpm,
        key: SONG.chord_chart_key,
        copyright: SONG_DATA.attributes.copyright,
        author: SONG_DATA.attributes.author,
        CCLI: SONG_DATA.attributes.ccli_number,
        title: SONG_DATA.attributes.title,
    }

    let layoutId = uid()

    let show: Show = {
        name: SONG.name,
        category: "planning_center",
        timestamps: { created: new Date(SONG.created_at).getTime(), modified: new Date(SONG.updated_at).getTime(), used: null },
        meta: metadata,
        settings: {
            activeLayout: layoutId,
            template: null,
        },
        layouts: {
            [layoutId]: {
                name: "Default",
                notes: SONG.notes || "",
                slides: layoutSlides,
            },
        },
        slides,
        media: {},
    }

    return show
}
