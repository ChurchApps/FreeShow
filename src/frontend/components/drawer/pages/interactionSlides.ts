import qrcode from "qrcode-generator"
import { get } from "svelte/store"
import type { Item, Slide } from "../../../../types/Show"
import { ShowObj } from "../../../classes/Show"
import { activeProject, activeShow, interactions, openedInteractionId, shows, showsCache } from "../../../stores"
import { history } from "../../helpers/history"
import { loadShows } from "../../helpers/setShow"
import { checkName } from "../../helpers/show"
import { uid } from "uid"
import { clone } from "../../helpers/array"

type SlideTypes = "join" | "players" | "question" | "leaderboard"

export async function generateSlide(type: SlideTypes) {
    const id = get(openedInteractionId)
    if (!id) return

    const showId = await createInteractionShow(id)
    if (!showId) return

    if (get(activeShow)?.id !== showId) activeShow.set({ id: showId })

    let slide: Slide | null = null
    if (type === "join") slide = generateJoinSlide(id)
    else if (type === "players") slide = generatePlayersSlide()
    else if (type === "question") slide = generateQuestionSlide()
    else if (type === "leaderboard") slide = generateLeaderboardSlide()

    if (!slide) return

    const currentShow = get(showsCache)[showId]
    const activeLayout = currentShow?.settings?.activeLayout
    history({ id: "SLIDES", newData: { data: [slide] }, location: { page: "show", show: { id: showId }, layout: activeLayout } })
}

async function createInteractionShow(id: string) {
    const showId = `interaction-${id}`

    // might exist already
    if (get(shows)[showId]) {
        await loadShows([showId])
        return showId
    }

    const interaction = get(interactions)[id]
    if (!interaction) return null

    const category = "presentation"
    const layoutId = uid()
    let show = new ShowObj(false, category, layoutId, Date.now(), false)
    show.name = checkName(interaction.name || "")

    show.origin = "interaction"
    show.reference = { type: "interaction", data: { name: interaction.name || "", id } }

    const selectedIndex = typeof get(activeShow)?.index !== "number" ? undefined : get(activeShow)!.index! + 1
    history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject), index: selectedIndex } }, oldData: { id: showId }, location: { page: "show", id: "show" } })
    return showId
}

const BG_item: Item = { type: "text", style: "left: 0;top: 0;width: 1920px;height: 1080px;background: radial-gradient(circle,rgba(11, 46, 99, 1) 0%, rgba(2, 9, 23, 1) 100%);", lines: [] }
const arrowImage =
    "iVBORw0KGgoAAAANSUhEUgAAAx0AAAMeCAMAAABP05kPAAACr1BMVEUAAAD///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8n1AFEAAAA5HRSTlMAAQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyAhIiMkJSYnKCkqKywtLi8wMTIzNDU2Nzg5Ojs8PT4/QEFCQ0RFRkdISUpLTE1OT1BRUlNUVVZXWFlaW1xdXl9gYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXp7fH1+f4CBgoOEhYaHiImKi4yNjo+QkZKTlJWWl5iZmpucnZ6f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"

function generateJoinSlide(id: string) {
    const interaction = get(interactions)[id]
    const joinId = interaction?.lastConnection?.id
    if (!joinId) return null

    const url = `https://freeshow.net/interaction#id=${joinId}`
    const qrData = generateQR(url)

    const slide: Slide = {
        group: "Join",
        color: null,
        settings: {},
        notes: "",
        items: [
            BG_item,
            { type: "media", style: "left:710.00px;top:340.50px;width: 500px;height: 500px;border-radius: 20px;border-color: #000000;border-width: 10px;", src: qrData },
            { type: "text", style: "top:100px;left:461.00px;height:152.67px;width:998.00px;", lines: [{ align: "", text: [{ style: "font-weight:bold;text-transform:uppercase;font-size:120px;text-shadow:0 0 0 rgb(0 0 0 / 0);-webkit-text-stroke-width:15px;", value: "Join now!" }] }] },
            // Use your phone to scan the QR code or go to freeshow.net/interaction and enter the code:
            { type: "text", style: "top:850px;left:380px;height:75px;width:1160px;", lines: [{ align: "", text: [{ style: "font-size:28px;color:rgb(255 255 255 / 0.8);text-shadow:0 0 0 rgb(0 0 0 / 0);", value: "Scan the QR Code with your phone!" }] }] },
            { type: "icon", style: "height:130px;width:130px;color:#FFFFFF;left:1375px;top:403.5px;", id: "phone" },
            { type: "media", style: "top:509.50px;left:1196.00px;height:280.65px;width:279.00px;", src: `data:image/png;base64,${arrowImage}` }
        ]
        // optionally add an action to start the interaction
    }

    return clone(slide)

    function generateQR(text) {
        var qr = qrcode(0, "L")
        qr.addData(text)
        qr.make()
        return qr.createDataURL(10, 20)
    }
}

function generatePlayersSlide() {
    const slide: Slide = {
        group: "Players",
        color: null,
        settings: {},
        notes: "",
        items: [
            BG_item,
            { type: "text", style: "top:72.50px;left:461.00px;height:152.67px;width:998.00px;", lines: [{ align: "", text: [{ style: "font-weight:bold;font-size:120px;text-shadow:0 0 0 rgb(0 0 0 / 0);-webkit-text-stroke-width:15px;", value: "Players" }] }] },

            // these dynamic values use the show reference to get the correct interaction id - otherwise fallback to first active
            { type: "text", style: "top:285.02px;left:50.00px;height:706.98px;width:1820.00px;", lines: [{ align: "", text: [{ style: "font-size:80px;text-shadow:0 0 0 rgb(0 0 0 / 0);-webkit-text-stroke-width:10px;", value: "{interaction_players|Waiting...}" }] }] },
            { type: "text", style: "top:55.17px;height:170.00px;width:245.38px;left:1625.00px;", lines: [{ align: "", text: [{ style: "font-feature-settings: 'tnum' 1;font-family:monospace;font-weight:bold;text-shadow:0 0 0 rgb(0 0 0 / 0);-webkit-text-stroke-width: 4px;font-size:90px;", value: "{interaction_players_count}" }] }] }
        ]
    }

    return clone(slide)
}

function generateQuestionSlide() {
    const slide: Slide = {
        group: "Question",
        color: null,
        settings: {},
        notes: "",
        items: [
            BG_item,
            { type: "text", style: "top:117.50px;left:194.50px;height:846.00px;width:1534.08px;", lines: [{ align: "", text: [{ style: "font-weight:bold;font-size:120px;text-shadow:0 0 0 rgb(0 0 0 / 0);-webkit-text-stroke-width:15px;", value: "{interaction_question}" }] }] },
            { type: "text", style: "top:800px;left:194.50px;height:100px;width:1534.08px;", lines: [{ align: "", text: [{ style: "font-size:90px;text-shadow:0 0 0 rgb(0 0 0 / 0);-webkit-text-stroke-width:15px;", value: "Answer: {interaction_answer}" }] }], conditions: { showItem: [[[[{ element: "dynamicValue", elementId: "interaction_answer", operator: "isNot", value: "" }]]]] } },
            { type: "text", style: "top:79.64px;left:1406.85px;height:197.02px;width:451.60px;", lines: [{ align: "", text: [{ style: "font-feature-settings: 'tnum' 1;font-family:monospace;font-weight:bold;text-shadow:0 0 0 rgb(0 0 0 / 0);-webkit-text-stroke-width: 4px;color:linear-gradient(120deg, #FF851B 0%, #b91533 70%);font-size:120px;", value: "{interaction_time}" }] }] }
        ]
    }

    return clone(slide)
}

function generateLeaderboardSlide() {
    const slide: Slide = {
        group: "Leaderboard",
        color: null,
        settings: {},
        notes: "",
        items: [
            BG_item,
            { type: "text", style: "top:72.50px;left:461.00px;height:152.67px;width:998.00px;", lines: [{ align: "", text: [{ style: "font-weight:bold;font-size:120px;text-shadow:0 0 0 rgb(0 0 0 / 0);-webkit-text-stroke-width:15px;", value: "Leaderboard" }] }] },
            { type: "text", style: "top:285.02px;left:80.00px;height:706.98px;width:1760.00px;", align: "align-items:flex-start;", lines: [{ align: "text-align: left;", text: [{ style: "font-size:80px;text-shadow:0 0 0 rgb(0 0 0 / 0);-webkit-text-stroke-width:10px;", value: "{interaction_leaderboard}" }] }] }
        ]
    }

    return clone(slide)
}
