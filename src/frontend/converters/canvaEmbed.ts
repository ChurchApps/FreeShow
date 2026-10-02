import { get } from "svelte/store"
import { uid } from "uid"
import type { Item } from "../../types/Show"
import { ShowObj } from "../classes/Show"
import { history } from "../components/helpers/history"
import { checkName } from "../components/helpers/show"
import { activeProject } from "../stores"

// Canva designs shared publicly can be shown live as a website (with videos & animations),
// no Canva account/API key needed. Next/previous slide is sent to the website (see websiteControls.ts).

export type CanvaLinkResult = { url: string; designId: string } | { error: "invalid" | "edit" | "short" }

// accepts a Smart embed link, a public view link, or the embed HTML code
export function parseCanvaLink(input: string): CanvaLinkResult {
    let value = (input || "").trim()

    // embed code: <iframe ... src="https://www.canva.com/design/.../view?embed">
    const iframeSrc = value.match(/src=["']([^"']+)["']/i)?.[1]
    if (iframeSrc) value = iframeSrc
    value = value.replaceAll("&amp;", "&")
    if (!value.includes("://")) value = "https://" + value

    let url: URL
    try {
        url = new URL(value)
    } catch {
        return { error: "invalid" }
    }

    const host = url.hostname.toLowerCase()
    if (host === "canva.link" || host.endsWith(".canva.link")) return { error: "short" }
    if (host !== "canva.com" && !host.endsWith(".canva.com")) return { error: "invalid" }

    // /design/{designId}/{shareToken?}/{view|watch|edit}
    const parts = url.pathname.split("/").filter(Boolean)
    if (parts[0] !== "design" || !parts[1]) return { error: "invalid" }

    const designId = parts[1]
    const mode = parts.find((part, i) => i > 1 && ["view", "watch", "edit"].includes(part))
    if (mode === "edit") return { error: "edit" }

    const shareToken = parts[2] && !["view", "watch"].includes(parts[2]) ? parts[2] : ""
    const embedUrl = `https://www.canva.com/design/${designId}/${shareToken ? shareToken + "/" : ""}${mode || "view"}?embed`

    return { url: embedUrl, designId }
}

export function addCanvaLinkAsShow(url: string, name = "") {
    const showId = uid()
    const layoutId = uid()
    const slideId = uid()

    const show = new ShowObj(false, "presentation", layoutId, Date.now(), false)
    show.name = checkName(name.trim() || "Canva presentation", showId)

    const item: Item = {
        type: "web",
        style: "top:0px;left:0px;height:1080px;width:1920px;",
        web: { src: url, noNavigation: true, slideControls: true }
    }
    show.slides = { [slideId]: { group: "Canva", color: null, settings: {}, notes: "", items: [item] } }
    show.layouts[layoutId].slides = [{ id: slideId }]

    history({ id: "UPDATE", newData: { data: show, remember: { project: get(activeProject) } }, oldData: { id: showId }, location: { page: "show", id: "show" } })
    return showId
}
