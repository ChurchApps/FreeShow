import { uid } from "uid"
import { ToMain } from "../../types/IPC/ToMain"
import type { Show, Slide, SlideData } from "../../types/Show"
import { sendToMain } from "../IPC/main"
import { httpsRequest } from "../utils/requests"
import { CONTENT_API_URL, DOING_API_URL, chumsConnect, type ChumsScopes } from "./connect"


type ChumsRequestData = {
  api: "doing" | "content"
  scope: ChumsScopes
  endpoint: string
  authenticated: boolean
  params?: Record<string, string> // Add params type
}

async function apiRequest(data: ChumsRequestData): Promise<any> {
  let CHUMS_ACCESS: any = {}
  if (data.authenticated) {
    CHUMS_ACCESS = await chumsConnect(data.scope)
    if (!CHUMS_ACCESS) {
      sendToMain(ToMain.ALERT, "Not authorized at Chums (try logging out and in again)!")
      return null
    }
  }
  return new Promise((resolve) => {
    const apiUrl = data.api === "doing" ? DOING_API_URL : CONTENT_API_URL;
    const headers = (data.authenticated) ? { Authorization: `Bearer ${CHUMS_ACCESS.access_token}` } : {}
    console.log(apiUrl, data.endpoint, "GET", headers, {})
    httpsRequest(apiUrl, data.endpoint, "GET", headers, {}, async (err, result) => {
      if (err) { sendToMain(ToMain.ALERT, "Could not get data! " + err.message); return resolve(null); }
      else resolve(result)
    })
  })
}


// LOAD PLANS
let projects: any[] = []
let shows: Show[] = []
//let downloadableMedia: any[] = []

export async function chumsLoadServices(dataPath: string) {
  console.log("datapath", dataPath)
  sendToMain(ToMain.TOAST, "Getting schedules from Chums")
  const SERVICE_PLANS = await apiRequest({ api: "doing", authenticated: true, scope: "plans", endpoint: "/plans/presenter" })
  if (!SERVICE_PLANS[0]?.id) return
  await Promise.all(
    SERVICE_PLANS.map(async (plan: any) => { loadPlanItems(plan); })
  )
  sendToMain(ToMain.CHUMS_PROJECTS, { shows, projects })
}

async function loadPlanItems(plan: any) {
  //Amazing Grace
  let projectItems: any[] = []
  const planItems: any = await apiRequest({ api: "doing", authenticated: false, scope: "plans", endpoint: "/planItems/presenter/" + plan.churchId + "/" + plan.id });
  //http://localhost:8088/planItems/presenter/AOjIt0W-SeY/t7rNlvByhFO

  if (!planItems?.length) return
  for (const pi of planItems) {
    //Create the section for plan item headers
    projectItems.push({ type: "section", id: uid(5), name: pi.label || "", scheduleLength: pi.seconds, notes: pi.description || "" })
    for (const child of pi.children) {
      if (child.itemType === "arrangementKey") {
        const { showId, show, seconds } = await loadArrangementKey(child.churchId, child.relatedId);
        if (showId && show) {
          shows.push({ id: showId, ...show })
          projectItems.push({ type: "show", id: showId, scheduleLength: seconds })
        }
      }
    }
  }


  //Easter Sunday
  let projectData = {
    id: plan.id,
    name: plan.name,
    scheduledTo: new Date(plan.serviceDate).getTime(),
    created: new Date(plan.serviceDate).getTime(),
    folderId: "",
    folderName: "",
    items: projectItems,
  }
  if (Object.keys(projectData).length) projects.push(projectData)
  console.log(projectData)

}

const loadArrangementKey = async (churchId: string, arrangementId: string) => {
  let data: any = {};
  try {
    data = await apiRequest({ api: "content", authenticated: false, scope: "plans", endpoint: "/arrangementKeys/presenter/" + churchId + "/" + arrangementId })
  } catch (error) {
    console.log("ERROR!!", error);
  }

  if (!data?.arrangementKey) return { showId: "", show: null, seconds: 0 }
  //http://localhost:8089/arrangementKeys/presenter/AOjIt0W-SeY/lVKJIwjcSTL

  const sections = parseLyrics(data.arrangement.lyrics)
  return getShow(data.arrangementKey, data.arrangement, data.song, data.songDetail, sections)
}

const parseLyrics = (lyrics: string) => {
  if (!lyrics) return []
  if (!lyrics.startsWith("[")) return [{ label: "Lyrics", lyrics }]
  const sections: any[] = []
  const lines = lyrics.split("\n");
  lines.forEach((line) => {
    if (line.startsWith("[") && line.endsWith("]")) {
      const label = line.slice(1, -1);
      sections.push({ label, lyrics: "" });
    } else {
      const lastSection = sections[sections.length - 1];
      if (lastSection) lastSection.lyrics += line + "\n";
    }
  });
  return sections;
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
    category: "chums",
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
  return { showId, show, seconds: SONG_DETAILS.seconds || 0 }
}
