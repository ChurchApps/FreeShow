import path from "path"
import { uid } from "uid"
import { ToMain } from "../../types/IPC/ToMain"
import type { Show, Slide, SlideData } from "../../types/Show"
import { downloadLessonsMedia } from "../data/downloadMedia"
import { sendToMain } from "../IPC/main"
import { dataFolderNames, getDataFolder } from "../utils/files"
import { httpsRequest } from "../utils/requests"
import { PCO_API_URL, pcoConnect, type PCOScopes } from "./connect"
import { Media } from "../../types/Main"
import { Project } from "../../types/Projects"

const PCO_API_version = 2

type PCORequestData = {
    scope: PCOScopes
    endpoint: string
    params?: Record<string, string> // Add params type
}

interface ServiceType {
    id: string
    attributes: {
        name: string
    }
}

interface Plan {
    id: string
    attributes: {
        title: string
        sort_date: string
        created_at: string
        items_count: number
    }
}

interface ProjectItem {
    id: string
    attributes: {
        item_type: string
        title?: string
        description?: string
        length?: number
    }
    custom_arrangement_sequence?: any[]
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
    const serviceTypes = await fetchServiceTypes()
    if (!serviceTypes) {
        console.info("No service types found in Planning Center")
        return
    }

    sendToMain(ToMain.TOAST, "Getting schedules from Planning Center")

    const results = await processAllServiceTypes(serviceTypes, dataPath)

    console.debug("PCO shows count:", results.shows.length)

    if (results.downloadableMedia.length > 0) {
        downloadLessonsMedia(results.downloadableMedia)
    }

    sendToMain(ToMain.PCO_PROJECTS, { shows: results.shows, projects: results.projects })
}

async function fetchServiceTypes() {
    const typesEndpoint = "service_types"
    const serviceTypes = await pcoRequest({
        scope: "services",
        endpoint: typesEndpoint
    })

    if (!serviceTypes || !serviceTypes[0]?.id) {
        sendToMain(ToMain.ALERT, "No service types found in Planning Center! Please create some services first.")
        return null
    }

    return serviceTypes
}

async function processAllServiceTypes(serviceTypes: ServiceType[], dataPath: string): Promise<any> {
    const projects: Project[] = []
    const shows: Show[] = []
    const downloadableMedia: Media[] = []

    await Promise.all(
        serviceTypes.map(async (serviceType) => {
            const servicePlans = await fetchServicePlans(serviceType)
            if (!servicePlans || !servicePlans.length) return

            const results = await processServicePlans(servicePlans, serviceType, dataPath)

            projects.push(...results.projects)
            shows.push(...results.shows)
            downloadableMedia.push(...results.downloadableMedia)
        })
    )

    return { projects, shows, downloadableMedia }
}

async function fetchServicePlans(serviceType: ServiceType) {
    const typesEndpoint = "service_types"
    const plansEndpoint = `${typesEndpoint}/${serviceType.id}/plans`

    const servicePlans = await pcoRequest({
        scope: "services",
        endpoint: plansEndpoint,
        params: {
            order: "sort_date",
            filter: "future"
        }
    })

    if (!servicePlans || !servicePlans[0]?.id) {
        console.warn(`No plans found for service type ${serviceType.attributes.name} (${serviceType.id})`)
        return null
    }

    // Filter for the one week window
    const filteredPlans = servicePlans.filter(({ attributes: a }: any) => {
        if (a.items_count === 0) return false
        const date = new Date(a.sort_date).getTime()
        const today = Date.now()
        return date < today + ONE_WEEK_MS
    })

    console.debug(`Found ${filteredPlans.length} plans for service type ${serviceType.attributes.name} (${serviceType.id})`)
    return filteredPlans
}

async function processServicePlans(plans: Plan[], serviceType: ServiceType, dataPath: string) {
    const projects: Project[] = []
    const shows: Show[] = []
    const downloadableMedia: Media[] = []

    await Promise.all(
        plans.map(async (plan: Plan) => {
            const results = await processPlan(plan, serviceType, dataPath)
            if (results) {
                if (results.project) projects.push(results.project)
                if (results.shows.length) shows.push(...results.shows)
                if (results.downloadableMedia.length) downloadableMedia.push(...results.downloadableMedia)
            }
        })
    )

    return { projects, shows, downloadableMedia }
}

async function processPlan(plan: Plan, serviceType: ServiceType, dataPath: string): Promise<any> {
    const typesEndpoint = "service_types"
    const plansEndpoint = `${typesEndpoint}/${serviceType.id}/plans`
    const itemsEndpoint = `${plansEndpoint}/${plan.id}/items`

    const planItems = await pcoRequest({ scope: "services", endpoint: itemsEndpoint })
    if (!planItems[0]?.id) return null

    const projectItems = []
    const shows = []
    const downloadableMedia = []

    for (const item of planItems) {
        const type = item.attributes.item_type
        let result: any

        if (type === "song") {
            result = await processSongItem(item, itemsEndpoint)
        } else if (type === "item") {
            result = processRegularItem(item)
        } else if (type === "media") {
            result = await processMediaItem(item, itemsEndpoint, serviceType, dataPath)
        } else if (type === "header") {
            result = processHeaderItem(item)
        }

        if (result) {
            if (result.projectItem) projectItems.push(result.projectItem)
            if (result.show) shows.push(result.show)
            if (result.downloadableMedia) downloadableMedia.push(result.downloadableMedia)
        }
    }

    if (!projectItems.length) return null

    const project = createProjectData(plan, serviceType, projectItems)

    return { project, shows, downloadableMedia }
}

async function processSongItem(item: ProjectItem, itemsEndpoint: string) {
    const songDataEndpoint = `${itemsEndpoint}/${item.id}/song`
    const songData = (await pcoRequest({ scope: "services", endpoint: songDataEndpoint }))[0]
    if (!songData?.id) return null

    const arrangementEndpoint = `/songs/${songData.id}/arrangements`
    const songArrangement = (await pcoRequest({ scope: "services", endpoint: arrangementEndpoint }))[0]
    if (!songArrangement?.id) return null

    const song = songArrangement.attributes
    const sequence = item.custom_arrangement_sequence || song.sequence || []

    let sections = (await pcoRequest({
        scope: "services",
        endpoint: `${arrangementEndpoint}/${songArrangement.id}/sections`
    }))[0]?.attributes.sections || []

    if (!sections.length) {
        sections = sequence.map((id: any) => ({ label: id, lyrics: "" }))
    }

    const show = getShow(songData, song, sections)
    const showId = `pcosong_${songData.id}`

    return {
        show: { id: showId, ...show },
        projectItem: { type: "show", id: showId, scheduleLength: item.attributes.length }
    }
}

function processRegularItem(item: ProjectItem) {
    const showId = `pcosong_${item.id}`
    const show = getShow(item, {}, [])

    return {
        show: { id: showId, ...show },
        projectItem: { type: "show", id: showId, scheduleLength: item.attributes.length }
    }
}

async function processMediaItem(item: ProjectItem, itemsEndpoint: string, serviceType: ServiceType, dataPath: string) {
    const mediaEndpoint = `${itemsEndpoint}/${item.id}/media`
    const media = (await pcoRequest({ scope: "services", endpoint: mediaEndpoint }))[0]
    if (!media?.id) return null

    const attachment = (await pcoRequest({ scope: "services", endpoint: `media/${media.id}/attachments` }))[0]
    if (!attachment?.id) return null

    const downloadUrl = await getMediaStreamUrl(`attachments/${attachment.id}/open`)

    const fileFolderPath = getDataFolder(dataPath, dataFolderNames.planningcenter)
    const filePath = path.join(fileFolderPath, serviceType.attributes.name, attachment.attributes.filename)

    return {
        projectItem: {
            name: media.attributes.title,
            scheduleLength: item.attributes.length,
            type: media.attributes.length ? "video" : "image",
            id: filePath
        },
        downloadableMedia: {
            path: dataPath,
            name: serviceType.attributes.name,
            type: "planningcenter",
            files: [{ name: attachment.attributes.filename, url: downloadUrl }]
        }
    }
}

function processHeaderItem(item: ProjectItem) {
    return {
        projectItem: {
            type: "section",
            id: uid(5),
            name: item.attributes.title || "",
            scheduleLength: item.attributes.length,
            notes: item.attributes.description || ""
        }
    }
}

function createProjectData(plan: Plan, serviceType: ServiceType, projectItems: ProjectItem[]) {
    return {
        id: plan.id,
        name: plan.attributes.title || getDateTitle(plan.attributes.sort_date),
        scheduledTo: new Date(plan.attributes.sort_date).getTime(),
        created: new Date(plan.attributes.created_at).getTime(),
        folderId: serviceType.id || "",
        folderName: serviceType.attributes.name || "",
        items: projectItems
    }
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
