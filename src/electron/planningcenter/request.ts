import path from "path"
import { uid } from "uid"
import { ToMain } from "../../types/IPC/ToMain"
import type { Show, Slide, SlideData } from "../../types/Show"
import { downloadMedia } from "../data/downloadMedia"
import { sendToMain } from "../IPC/main"
import { dataFolderNames, getDataFolder } from "../utils/files"
import { httpsRequest } from "../utils/requests"
import { PCO_API_URL, pcoConnect, type PCOScopes } from "./connect"

const PCO_API_version = 2

type PCORequestData = {
    scope: PCOScopes
    endpoint: string
    params?: Record<string, string> // Add params type
}

export async function pcoRequest(data: PCORequestData, attempt = 0): Promise<any> {
    const MAX_RETRIES = 3
    const PCO_ACCESS = await pcoConnect(data.scope)

    if (!PCO_ACCESS) {
        sendToMain(ToMain.ALERT, "Not authorized at Planning Center (try logging out and in again)!")
        return null
    }

    // Build the path with query parameters if they exist
    let apiPath = `/${data.scope || "services"}/v${PCO_API_version}/${data.endpoint}`
    if (data.params) {
        const queryParams = new URLSearchParams(data.params).toString()
        apiPath = `${apiPath}?${queryParams}`
    }

    const headers = { Authorization: `Bearer ${PCO_ACCESS.access_token}` }

    return new Promise((resolve) => {
        httpsRequest(PCO_API_URL, apiPath, "GET", headers, {}, (err, result) => {
            if (err) {
                // handle rate limit
                // https://developer.planning.center/docs/#/overview/rate-limiting
                if (err.statusCode === 429) {
                    const retryAfter = parseInt(err?.headers?.["retry-after"], 10) || 2
                    rateLimit(retryAfter)
                    return
                }

                // console.log(apiPath, err)
                const message = err.message?.includes("401") ? "Make sure you have created some 'services' in your account!" : err.message
                sendToMain(ToMain.ALERT, "Could not get data! " + message)
                return resolve(null)
            }

            let resultData = result.data

            // convert to array
            if (!Array.isArray(resultData)) resultData = [resultData]

            // console.debug("PCO Request Result:", apiPath, resultData)

            resolve(resultData)
        })

        function rateLimit(retryAfter: number) {
            if (attempt >= MAX_RETRIES) {
                sendToMain(ToMain.ALERT, "Planning Center rate limit reached! Please try again later")
                resolve(null)
                return
            }

            console.warn(`Rate limited. Retrying after ${retryAfter} seconds... (attempt ${attempt + 1})`)
            sendToMain(ToMain.ALERT, `Planning Center rate limit reached! Trying again in ${retryAfter} seconds`)

            setTimeout(async () => {
                const retryResult = await pcoRequest(data, attempt + 1)
                resolve(retryResult)
            }, retryAfter * 1000)
        }
    })
}

// LOAD SERVICES

const ONE_WEEK_MS = 604800000
export async function pcoLoadServices(dataPath: string) {
    const typesEndpoint = "service_types"
    const SERVICE_TYPES = await pcoRequest({
        scope: "services",
        endpoint: typesEndpoint
    })

    if (!SERVICE_TYPES || !SERVICE_TYPES[0]?.id) {
        sendToMain(ToMain.ALERT, "No service types found in Planning Center! Please create some services first.")
        return
    }

    sendToMain(ToMain.TOAST, "Getting schedules from Planning Center")

    const projects: any[] = []
    const shows: Show[] = []
    const downloadableMedia: any[] = []

    await Promise.all(
        SERVICE_TYPES.map(async (serviceType: any) => {
            const plansEndpoint = typesEndpoint + `/${serviceType.id}/plans`
            const SERVICE_PLANS = await pcoRequest({
                scope: "services",
                endpoint: plansEndpoint,
                params: {
                    order: "sort_date",
                    filter: "future"
                }
            })

            if (!SERVICE_PLANS || !SERVICE_PLANS[0]?.id) {
                console.warn(`No plans found for service type ${serviceType.attributes.name} (${serviceType.id})`)
                return
            }

            // Now we only need to filter for the one week window since we're already getting future plans
            const filteredPlans = SERVICE_PLANS.filter(({ attributes: a }: any) => {
                if (a.items_count === 0) return false
                const date = new Date(a.sort_date).getTime()
                const today = Date.now()
                return date < today + ONE_WEEK_MS
            })

            await Promise.all(
                filteredPlans.map(async (plan: any) => {
                    const itemsEndpoint = plansEndpoint + `/${plan.id}/items`
                    const PLAN_ITEMS = await pcoRequest({ scope: "services", endpoint: itemsEndpoint })
                    if (!PLAN_ITEMS[0]?.id) return

                    // const orderedItems = PLAN_ITEMS.sort((a, b) => a.attributes.sequence - b.attributes.sequence)

                    const projectItems: any[] = []
                    for (const item of PLAN_ITEMS) {
                        const type: "song" | "header" | "media" | "item" = item.attributes.item_type
                        if (type === "song") {
                            const songDataEndpoint = itemsEndpoint + `/${item.id}/song`
                            const SONG_DATA: any = (await pcoRequest({ scope: "services", endpoint: songDataEndpoint }))[0]
                            if (!SONG_DATA?.id) return
                            const arrangementEndpoint = `/songs/${SONG_DATA.id}/arrangements`
                            const songArrangement: any = (await pcoRequest({ scope: "services", endpoint: arrangementEndpoint }))[0]
                            if (!songArrangement?.id) return

                            const SONG = songArrangement.attributes

                            // let lyrics = SONG.lyrics || ""
                            const sequence: string[] = plan.custom_arrangement_sequence || SONG.sequence || []
                            let SECTIONS: any[] = (await pcoRequest({ scope: "services", endpoint: `${arrangementEndpoint}/${songArrangement.id}/sections` }))[0]?.attributes.sections || []
                            if (!SECTIONS.length) SECTIONS = sequence.map((id) => ({ label: id, lyrics: "" }))

                            const show = getShow(SONG_DATA, SONG, SECTIONS)
                            const showId = `pcosong_${SONG_DATA.id}`
                            shows.push({ id: showId, ...show })

                            projectItems.push({ type: "show", id: showId, scheduleLength: item.attributes.length })
                        } else if (type === "item") {
                            const showId = `pcosong_${item.id}`
                            const show = getShow(item, {}, [])
                            shows.push({ id: showId, ...show })
                            projectItems.push({ type: "show", id: showId, scheduleLength: item.attributes.length })
                        } else if (type === "media") {
                            const mediaEndpoint = itemsEndpoint + `/${item.id}/media`
                            const MEDIA = (await pcoRequest({ scope: "services", endpoint: mediaEndpoint }))[0]
                            if (!MEDIA?.id) return
                            const ATTACHEMENT = (await pcoRequest({ scope: "services", endpoint: `media/${MEDIA.id}/attachments` }))[0]
                            if (!ATTACHEMENT?.id) return
                            const DOWNLOAD_URL = await getMediaStreamUrl(`attachments/${ATTACHEMENT.id}/open`)

                            // ATTACHEMENT.attributes.url (this is not streamable, just web downloadable)
                            const downloadURL = DOWNLOAD_URL

                            downloadableMedia.push({ path: dataPath, name: serviceType.attributes.name, type: "planningcenter", files: [{ name: ATTACHEMENT.attributes.filename, url: downloadURL }] })

                            const fileFolderPath = getDataFolder(dataPath, dataFolderNames.planningcenter)
                            const filePath = path.join(fileFolderPath, serviceType.attributes.name, ATTACHEMENT.attributes.filename)

                            projectItems.push({ name: MEDIA.attributes.title, scheduleLength: item.attributes.length, type: MEDIA.attributes.length ? "video" : "image", id: filePath })
                        } else if (type === "header") {
                            projectItems.push({ type: "section", id: uid(5), name: item.attributes.title || "", scheduleLength: item.attributes.length, notes: item.attributes.description || "" })
                        }
                    }

                    if (!projectItems.length) return

                    const projectData = {
                        id: plan.id,
                        name: plan.attributes.title || getDateTitle(plan.attributes.sort_date),
                        scheduledTo: new Date(plan.attributes.sort_date).getTime(),
                        created: new Date(plan.attributes.created_at).getTime(),
                        folderId: serviceType.id || "",
                        folderName: serviceType.attributes.name || "",
                        items: projectItems
                    }
                    if (Object.keys(projectData).length) projects.push(projectData)
                })
            )
        })
    )

    downloadMedia(downloadableMedia)

    sendToMain(ToMain.PCO_PROJECTS, { shows, projects })
}

function getDateTitle(dateString: string) {
    const date = new Date(dateString)
    return date.toISOString().slice(0, 10)
}

const itemStyle = "inset-inline-start:50px;top:120px;width:1820px;height:840px;"
function getShow(SONG_DATA: any, SONG: any, SECTIONS: any[]) {
    const slides: { [key: string]: Slide } = {}
    const layoutSlides: SlideData[] = []
    SECTIONS.forEach((section) => {
        const slideId = uid()

        const items = [
            {
                style: itemStyle,
                lines: section.lyrics.split("\n").map((a: string) => ({ align: "", text: [{ style: "", value: a }] }))
            }
        ]

        slides[slideId] = {
            group: section.label,
            globalGroup: section.label.toLowerCase(),
            color: null,
            settings: {},
            notes: "",
            items
        }
        layoutSlides.push({ id: slideId })
    })

    const title = SONG_DATA.attributes.title || ""

    const metadata = {
        title,
        author: SONG_DATA.attributes.author || "",
        publisher: SONG.name || "",
        copyright: SONG_DATA.attributes.copyright || "",
        CCLI: SONG_DATA.attributes.ccli_number || "",
        key: SONG.chord_chart_key || "",
        BPM: SONG.bpm || ""
    }

    const layoutId = uid()

    const show: Show = {
        name: title,
        category: "planning_center",
        timestamps: { created: new Date(SONG.created_at).getTime() || Date.now(), modified: new Date(SONG.updated_at).getTime() || null, used: null },
        meta: metadata,
        settings: {
            activeLayout: layoutId,
            template: null
        },
        layouts: {
            [layoutId]: {
                name: "Default",
                notes: SONG.notes || "",
                slides: layoutSlides
            }
        },
        slides,
        media: {}
    }

    return show
}

async function getMediaStreamUrl(endpoint: string): Promise<string> {
    const PCO_ACCESS = await pcoConnect("services")
    if (!PCO_ACCESS) return ""

    const apiPath = `/services/v${PCO_API_version}/${endpoint}`
    const headers = { Authorization: `Bearer ${PCO_ACCESS.access_token}` }

    return new Promise((resolve) => {
        httpsRequest(PCO_API_URL, apiPath, "POST", headers, {}, (err, result) => {
            if (err) {
                console.error("Could not get media stream URL:", err)
                return resolve("")
            }

            resolve(result.data.attributes.attachment_url)
        })
    })
}
