import { get } from "svelte/store"
import type { Project } from "../../../types/Projects"
import { overlays, showsCache } from "../../stores"
import { newToast } from "../../utils/common"
import { loadShows } from "../helpers/setShow"
import { _show } from "../helpers/shows"
import { LinkGenericItem, LinkOverlayItem, LinkShowItem, LinkSlide, LinkSlideGenericItem, LinkSlideItems, LinkSlideLine, LinkSlideMediaItem, LinkSlideTextItem, ProjectLink } from "./ProjectLinkTypes"

export async function exportProjectAsData(project: Project, projectId: string): Promise<ProjectLink | null> {
    if (!project) return null

    const items = project.shows || []

    // load shows
    const showIds = items.filter((a) => (a.type || "show") === "show").map((a) => a.id)
    await loadShows(showIds)

    const cachedShows = get(showsCache)
    const cachedOverlays = get(overlays)

    console.log("Compressing project:", projectId)
    const projectLink: ProjectLink = {
        // id: projectId,
        name: project.name,
        sharedAt: Date.now(),
        items: items
            .map((item) => {
                const type = item.type || "show"
                if (type === "DIVIDER" || type === "show_placeholder") return null

                if (type === "show") {
                    const show = cachedShows[item.id]

                    const layoutId = item.layout || show?.settings?.activeLayout
                    const layoutRef = _show(item.id).layouts([layoutId]).ref()[0] || []
                    const showSlides = show?.slides || {}
                    const slides = layoutRef.map((a) => {
                        const slide = showSlides[a.id] || {}

                        const group = slide.group
                        const color = slide.color
                        const notes = slide.notes

                        const items = mapSlideItems(slide.items || [])

                        let data: LinkSlide = { items }
                        if (group !== null) data.group = group
                        if (color) data.color = color
                        if (notes) data.notes = notes

                        return data
                    })

                    return {
                        // id: item.id,
                        name: show?.name || item.name,
                        // type, // no type = "show"
                        data: { slides }
                    } as LinkShowItem
                }

                if (type === "overlay") {
                    const overlay = cachedOverlays[item.id]

                    return {
                        // id: item.id,
                        name: overlay?.name || item.name,
                        type,
                        data: { items: mapSlideItems(overlay?.items || []) }
                    } as LinkOverlayItem
                }

                return {
                    // id: item.id,
                    name: item.name,
                    type
                } as LinkGenericItem
            })
            .filter(Boolean)
    }

    return projectLink
}

function mapSlideItems(slideItems: any[] = []): LinkSlideItems {
    return slideItems.map((slideItem) => {
        const type = slideItem.type || "text"

        if (type === "text") {
            let item: LinkSlideTextItem = {
                // type: "text",
                style: encodeStyle(slideItem.style),
                lines: (slideItem.lines || []).map((line) => {
                    let newLine: LinkSlideLine = {
                        text: (line.text || []).map((t) => ({
                            value: t.value,
                            style: encodeStyle(t.style)
                        }))
                    }
                    if (line.align && line.align.replaceAll(";", "") !== "") newLine.align = line.align

                    return newLine
                })
            }
            if (slideItem.align) item.align = slideItem.align

            return item
        }

        if (type === "media" || type === "icon") {
            return {
                type,
                style: encodeStyle(slideItem.style),
                src: slideItem.customSvg || slideItem.src
            } as LinkSlideMediaItem
        }

        return {
            type: slideItem.type,
            style: encodeStyle(slideItem.style)
        } as LinkSlideGenericItem
    }) as LinkSlideItems
}

const keyMap = {
    "font-weight": "fw",
    "font-style": "fs",
    "text-decoration": "td",

    "line-height": "lh",
    "letter-spacing": "ls",
    "font-size": "fz",
    "font-family": "ff",
    "text-shadow": "ts",

    "border-width": "bw",
    "border-color": "brc",
    "border-radius": "br",

    "background-color": "bc",
    background: "bg",
    color: "c",

    width: "w",
    height: "h",
    top: "t",
    left: "l"
}

function encodeStyle(style: string | undefined): string {
    if (!style) return ""

    style = style.replaceAll(": ", ":").replaceAll("; ", ";").replaceAll(";;;", ";").replaceAll(";;", ";").trim()

    // remove any style values without any values
    // example: "font-size:100px;color:;" -> "font-size:100px;"
    style = style.replace(/[^:;]+:\s*;/g, "")

    // replace common keys with _{shortkey}_
    for (const [fullKey, shortKey] of Object.entries(keyMap)) {
        style = style.replaceAll(fullKey, `_${shortKey}_`)
    }

    return style
}

// SHARE

export async function shareProjectLink(project: Project, projectId: string) {
    try {
        const compiled = await exportProjectAsData(project, projectId)
        if (!compiled) return

        const compressed = await compressToUrlSafeBase64(compiled)
        const shareLink = `https://freeshow.net/project#data=${compressed}`

        // We could shorten the URL: https://ulvis.net/

        await navigator.clipboard.writeText(shareLink)
        newToast("actions.copied")
    } catch (err: any) {
        console.error("Failed to share project:", err)
        newToast("Could not copy project URL")
    }
}

// export async function importFromLink() {
//     const linkOrCode = await promptCustom("Paste Shareable Link or Code", "text")
//     if (!linkOrCode) return
//     try {
//         let hash = linkOrCode.trim()
//         if (hash.includes("#project=")) {
//             hash = hash.split("#project=")[1]
//         } else if (hash.includes("?project=")) {
//             hash = hash.split("?project=")[1]
//         }
//         const decompressed = await decompressFromUrlSafeBase64(hash)
//         if (!decompressed || !decompressed.project) {
//             throw new Error("Invalid project data")
//         }
//         // @ts-ignore
//         runImportProject([{ content: JSON.stringify(decompressed) }])
//     } catch (err: any) {
//         console.error("Failed to import project:", err)
//         newToast("Invalid shareable link or code")
//     }
// }

// COMPRESSION

export async function compressToUrlSafeBase64(data: any): Promise<string> {
    const inputBytes = new TextEncoder().encode(JSON.stringify(data))
    const compressionStream = new CompressionStream("gzip")
    const writer = compressionStream.writable.getWriter()
    writer.write(inputBytes)
    writer.close()

    const compressedBuffer = await new Response(compressionStream.readable).arrayBuffer()
    return toUrlSafeBase64(new Uint8Array(compressedBuffer))
}

function toUrlSafeBase64(bytes: Uint8Array): string {
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

// async function decompressFromUrlSafeBase64(base64Url: string): Promise<any> {
//     const compressedBytes = fromUrlSafeBase64(base64Url)
//     const decompressionStream = new DecompressionStream("gzip")
//     const writer = decompressionStream.writable.getWriter()
//     await writer.write(compressedBytes)
//     await writer.close()

//     const decompressedText = await new Response(decompressionStream.readable).text()
//     return JSON.parse(decompressedText)
// }

// function fromUrlSafeBase64(base64Url: string): Uint8Array<ArrayBuffer> {
//     const padding = "=".repeat((4 - (base64Url.length % 4)) % 4)
//     const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/") + padding

//     const binary = atob(base64)
//     const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(binary.length))
//     for (let i = 0; i < binary.length; i++) {
//         bytes[i] = binary.charCodeAt(i)
//     }
//     return bytes
// }
