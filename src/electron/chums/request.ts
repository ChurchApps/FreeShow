//import path from "path"
import { uid } from "uid"
import { ToMain } from "../../types/IPC/ToMain"
import type { Show, Slide, SlideData } from "../../types/Show"
//import { downloadMedia } from "../data/downloadMedia"
import { sendToMain } from "../IPC/main"
//import { dataFolderNames, getDataFolder } from "../utils/files"
import { httpsRequest } from "../utils/requests"
import { DOING_API_URL, chumsConnect, type ChumsScopes } from "./connect"


type ChumsRequestData = {
  scope: ChumsScopes
  endpoint: string
  params?: Record<string, string> // Add params type
}

export async function doingApiRequest(data: ChumsRequestData): Promise<any> {
  const CHUMS_ACCESS = await chumsConnect(data.scope)
  if (!CHUMS_ACCESS) {
    sendToMain(ToMain.ALERT, "Not authorized at Chums (try logging out and in again)!")
    return null
  }

  const headers = { Authorization: `Bearer ${CHUMS_ACCESS.access_token}` }
  return new Promise((resolve) => {
    httpsRequest(DOING_API_URL, data.endpoint, "GET", headers, {}, async (err, result) => {
      if (err) {
        let message = err.message?.includes("401") ? "Make sure you have created some 'plans' in your account!" : err.message
        sendToMain(ToMain.ALERT, "Could not get data! " + message)
        return resolve(null)
      }
      let data = result.data
      if (!Array.isArray(data)) data = [data]
      resolve(data)
    })
  })
}

// LOAD PLANS

//const ONE_WEEK_MS = 604800000

//let projects: any[] = []
let shows: Show[] = []
//let downloadableMedia: any[] = []

export async function chumsLoadServices(dataPath: string) {
  console.log("datapath", dataPath)

  sendToMain(ToMain.TOAST, "Getting schedules from Chums")


  let plansEndpoint = `/plans/presentation`
  const SERVICE_PLANS = await doingApiRequest({
    scope: "plans",
    endpoint: plansEndpoint
  })

  if (!SERVICE_PLANS[0]?.id) return

  await Promise.all(
    SERVICE_PLANS.map(async (plan: any) => {
      loadPlanItems(plan);
    })
  )
}

async function loadPlanItems(plan: any) {

  //Amazing Grace
  let projectItems: any[] = []
  //projectItems.push({ type: "section", id: uid(5), name: item.attributes.title || "", scheduleLength: item.attributes.length, notes: item.attributes.description || "" })

  //const show = getShow(SONG_DATA, SONG, SECTIONS)
  //let showId = `chumssong_${SONG_DATA.id}`
  //shows.push({ id: showId, ...show })
  //projectItems.push({ type: "show", id: showId, scheduleLength: item.attributes.length })


  const planItems: any = await doingApiRequest({
    scope: "plans",
    endpoint: "/planItems/presenter/" + plan.id
  });

  if (!planItems?.length) return
  for (const pi of planItems) {

    //Create the section for plan item headers
    projectItems.push({ type: "section", id: uid(5), name: pi.label || "", scheduleLength: pi.seconds, notes: pi.description || "" })
    for (const child of pi.children) {

      if (child.itemType === "arrangmentKey") {
        const { showId, show } = await loadArrangementKey(child.id);

        shows.push({ id: showId, ...show })
      }
    }
  }


  //Easter Sunday
  let projectData = {
    id: plan.id,
    name: plan.title || getDateTitle(plan.attributes.sort_date),
    scheduledTo: new Date(plan.attributes.sort_date).getTime(),
    created: new Date(plan.attributes.created_at).getTime(),
    folderId: "",
    folderName: "",
    items: projectItems,
  }

}

const loadArrangementKey = async (arrangementId: string) => {

  const data: any = await doingApiRequest({
    scope: "plans",
    endpoint: "/arrangmentKeys/presenter/" + arrangementId
  })

  //if (!data?.arrangementKey) return

  //const SONG = songArrangement.attributes

  // let lyrics = SONG.lyrics || ""
  //let sequence: string[] = plan.custom_arrangement_sequence || SONG.sequence || []
  //let SECTIONS: any[] = (await chumsRequest({ scope: "plans", endpoint: `${arrangementEndpoint}/${songArrangement.id}/sections` }))[0]?.attributes.sections || []
  //if (!SECTIONS.length) SECTIONS = sequence.map((id) => ({ label: id, lyrics: "" }))
  const sections: any[] = []

  return getShow(data.arrangementKey, data.arrangement, data.song, data.songDetails, sections)
}


const itemStyle = "left:50px;top:120px;width:1820px;height:840px;"
function getShow(ARRANGEMENT_KEY: any, ARRANGEMENT: any, SONG: any, SONG_DETAILS: any, SECTIONS: any[]) {
  const slides: { [key: string]: Slide } = {}
  let layoutSlides: SlideData[] = []
  SECTIONS.forEach((section) => {
    let slideId = uid()

    let items = [
      {
        style: itemStyle,
        lines: section.lyrics.split("\n").map((a: string) => ({ align: "", text: [{ style: "", value: a }] })),
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

  const title = SONG_DETAILS.title + " (" + ARRANGEMENT.name + " - " + ARRANGEMENT_KEY.keySignature + ")" || ""

  const metadata = {
    title,
    author: SONG_DETAILS.artist || "",
    publisher: "",
    copyright: "",
    CCLI: "",
    key: SONG_DETAILS.keySignature || "",
    BPM: SONG_DETAILS.bpm || "",
  }

  let layoutId = uid()

  let show: Show = {
    name: title || "",
    category: "planning_center",
    timestamps: { created: new Date(SONG.dateAdded).getTime() || Date.now(), modified: new Date(SONG.dateAdded).getTime() || null, used: null },
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

  let showId = `chumssong_${ARRANGEMENT_KEY.id}`
  return { showId, show }
}

function getDateTitle(dateString: string) {
  const date = new Date(dateString)
  return date.toISOString().slice(0, 10)
}


/*
export async function chumsLoadServicesSample(dataPath: string) {
  let typesEndpoint = "service_types"
  const SERVICE_TYPES = await chumsRequest({
    scope: "plans",
    endpoint: typesEndpoint,
  })

  if (!SERVICE_TYPES[0]?.id) return
  sendToMain(ToMain.TOAST, "Getting schedules from Chums")

  let projects: any[] = []
  let shows: Show[] = []
  let downloadableMedia: any[] = []

  await Promise.all(
    SERVICE_TYPES.map(async (serviceType: any) => {
      let plansEndpoint = typesEndpoint + `/${serviceType.id}/plans`
      const SERVICE_PLANS = await chumsRequest({
        scope: "plans",
        endpoint: plansEndpoint,
        params: {
          order: "sort_date",
          filter: "future",
        },
      })

      if (!SERVICE_PLANS[0]?.id) return

      // Now we only need to filter for the one week window since we're already getting future plans
      const filteredPlans = SERVICE_PLANS.filter(({ attributes: a }: any) => {
        if (a.items_count === 0) return false
        let date = new Date(a.sort_date).getTime()
        let today = Date.now()
        return date < today + ONE_WEEK_MS
      })

      await Promise.all(
        filteredPlans.map(async (plan: any) => {
          let itemsEndpoint = plansEndpoint + `/${plan.id}/items`
          const PLAN_ITEMS = await chumsRequest({ scope: "plans", endpoint: itemsEndpoint })
          if (!PLAN_ITEMS[0]?.id) return

          // const orderedItems = PLAN_ITEMS.sort((a, b) => a.attributes.sequence - b.attributes.sequence)

          let projectItems: any[] = []
          for (let item of PLAN_ITEMS) {
            let type: "song" | "header" | "media" | "item" = item.attributes.item_type
            if (type === "song") {
              let songDataEndpoint = itemsEndpoint + `/${item.id}/song`
              const SONG_DATA: any = (await chumsRequest({ scope: "plans", endpoint: songDataEndpoint }))[0]
              if (!SONG_DATA?.id) return
              let arrangementEndpoint = `/songs/${SONG_DATA.id}/arrangements`
              let songArrangement: any = (await chumsRequest({ scope: "plans", endpoint: arrangementEndpoint }))[0]
              if (!songArrangement?.id) return

              const SONG = songArrangement.attributes

              // let lyrics = SONG.lyrics || ""
              let sequence: string[] = plan.custom_arrangement_sequence || SONG.sequence || []
              let SECTIONS: any[] = (await chumsRequest({ scope: "plans", endpoint: `${arrangementEndpoint}/${songArrangement.id}/sections` }))[0]?.attributes.sections || []
              if (!SECTIONS.length) SECTIONS = sequence.map((id) => ({ label: id, lyrics: "" }))

              const show = getShow(SONG_DATA, SONG, SECTIONS)
              let showId = `chumssong_${SONG_DATA.id}`
              shows.push({ id: showId, ...show })

              projectItems.push({ type: "show", id: showId, scheduleLength: item.attributes.length })
            } else if (type === "item") {
              let showId = `chumssong_${item.id}`
              const show = getShow(item, {}, [])
              shows.push({ id: showId, ...show })
              projectItems.push({ type: "show", id: showId, scheduleLength: item.attributes.length })
            } else if (type === "media") {
              let mediaEndpoint = itemsEndpoint + `/${item.id}/media`
              const MEDIA = (await chumsRequest({ scope: "plans", endpoint: mediaEndpoint }))[0]
              if (!MEDIA?.id) return
              const ATTACHEMENT = (await chumsRequest({ scope: "plans", endpoint: `media/${MEDIA.id}/attachments` }))[0]
              if (!ATTACHEMENT?.id) return
              const DOWNLOAD_URL = await getMediaStreamUrl(`attachments/${ATTACHEMENT.id}/open`)

              // ATTACHEMENT.attributes.url (this is not streamable, just web downloadable)
              let downloadURL = DOWNLOAD_URL

              downloadableMedia.push({ path: dataPath, name: serviceType.attributes.name, type: "planningcenter", files: [{ name: ATTACHEMENT.attributes.filename, url: downloadURL }] })

              let fileFolderPath = getDataFolder(dataPath, dataFolderNames.planningcenter)
              const filePath = path.join(fileFolderPath, serviceType.attributes.name, ATTACHEMENT.attributes.filename)

              projectItems.push({ name: MEDIA.attributes.title, scheduleLength: item.attributes.length, type: MEDIA.attributes.length ? "video" : "image", id: filePath })
            } else if (type === "header") {
              projectItems.push({ type: "section", id: uid(5), name: item.attributes.title || "", scheduleLength: item.attributes.length, notes: item.attributes.description || "" })
            }
          }

          if (!projectItems.length) return

          let projectData = {
            id: plan.id,
            name: plan.attributes.title || getDateTitle(plan.attributes.sort_date),
            scheduledTo: new Date(plan.attributes.sort_date).getTime(),
            created: new Date(plan.attributes.created_at).getTime(),
            folderId: serviceType.id || "",
            folderName: serviceType.attributes.name || "",
            items: projectItems,
          }
          if (Object.keys(projectData).length) projects.push(projectData)
        })
      )
    })
  )

  downloadMedia(downloadableMedia)

  sendToMain(ToMain.CHUMS_PROJECTS, { shows, projects })
}*/
/*


const itemStyle = "left:50px;top:120px;width:1820px;height:840px;"
function getShow(SONG_DATA: any, SONG: any, SECTIONS: any[]) {
  const slides: { [key: string]: Slide } = {}
  let layoutSlides: SlideData[] = []
  SECTIONS.forEach((section) => {
    let slideId = uid()

    let items = [
      {
        style: itemStyle,
        lines: section.lyrics.split("\n").map((a: string) => ({ align: "", text: [{ style: "", value: a }] })),
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

  const title = SONG_DATA.attributes.title || ""

  const metadata = {
    title,
    author: SONG_DATA.attributes.author || "",
    publisher: SONG.name || "",
    copyright: SONG_DATA.attributes.copyright || "",
    CCLI: SONG_DATA.attributes.ccli_number || "",
    key: SONG.chord_chart_key || "",
    BPM: SONG.bpm || "",
  }

  let layoutId = uid()

  let show: Show = {
    name: title,
    category: "planning_center",
    timestamps: { created: new Date(SONG.created_at).getTime() || Date.now(), modified: new Date(SONG.updated_at).getTime() || null, used: null },
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

async function getMediaStreamUrl(endpoint: string): Promise<string> {
  const CHUMS_ACCESS = await chumsConnect("plans")
  if (!CHUMS_ACCESS) return ""

  const path = `/plans/${endpoint}`
  const headers = { Authorization: `Bearer ${CHUMS_ACCESS.access_token}` }

  return new Promise((resolve) => {
    httpsRequest(MEMBERSHIP_API_URL, path, "POST", headers, {}, (err, result) => {
      if (err) {
        console.log("Could not get media stream URL:", err)
        return resolve("")
      }

      resolve(result.data.attributes.attachment_url)
    })
  })
}
*/