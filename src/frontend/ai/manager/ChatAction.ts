import { get } from "svelte/store"
import { uid } from "uid"
import { OUTPUT } from "../../../types/Channels"
import type { Item, Overlay, Slide } from "../../../types/Show"
import { history } from "../../components/helpers/history"
import { getLayoutRef } from "../../components/helpers/show"
import { getStyles, removeText } from "../../components/helpers/style"
import { activeEdit, activeShow, overlays, refreshEditSlide, showsCache, templates } from "../../stores"
import { newToast } from "../../utils/common"
import { translateText } from "../../utils/language"
import { send } from "../../utils/request"

export interface FreeShowAction {
    type: "APPLY_TO_SLIDE" | "CREATE_SLIDE" | "CREATE_TEMPLATE" | "CREATE_OVERLAY" | "CREATE_OUTPUT"
    data: {
        name?: string
        color?: string | null
        category?: string
        items?: Array<{
            type?: string
            style: string
            align: string
            textFit?: string
            lines: Array<{
                align: string
                text: Array<{
                    value: string
                    style: string
                }>
            }>
        }>
        [key: string]: any
    }
}

export const chatActionLabels: Record<string, string> = {
    APPLY_TO_SLIDE: "timer.create",
    CREATE_SLIDE: "new.slide",
    CREATE_TEMPLATE: "new.template",
    CREATE_OVERLAY: "new.overlay",
    CREATE_OUTPUT: "settings.new_output"
}

export class ChatAction {
    static handle(action: FreeShowAction | undefined) {
        if (!action) return

        console.log("Chat action:", action)

        // Create "Generated" category

        const formattedItems = this.formatItems(action.data?.items)

        if (action.type === "APPLY_TO_SLIDE") {
            if (!formattedItems.length) {
                newToast(translateText("error.unknown"))
                return
            }

            const active = get(activeEdit)

            if (!active.id) {
                // Show slide
                const currentShowId = get(activeShow)?.id || active.showId || ""
                const ref = getLayoutRef(currentShowId)
                const slideIndex = active.slide ?? 0
                const slideId = ref[slideIndex]?.id

                if (slideId && currentShowId) {
                    history({
                        id: "UPDATE",
                        newData: { data: formattedItems, key: "slides", dataIsArray: true, keys: [slideId], subkey: "items" },
                        oldData: { id: currentShowId },
                        location: { page: "edit", id: "show_key", override: "ai_generated_items" }
                    })
                    refreshEditSlide.set(true)
                    newToast(translateText("actions.done"))
                    return
                }
            } else if (active.type === "overlay") {
                history({
                    id: "UPDATE",
                    newData: { data: formattedItems, key: "items" },
                    oldData: { id: active.id },
                    location: { page: "edit", id: "overlay_items", override: "ai_generated_items" }
                })
                send(OUTPUT, ["OVERLAY"], get(overlays))
                refreshEditSlide.set(true)
                newToast(translateText("actions.done"))
                return
            } else if (active.type === "template") {
                history({
                    id: "UPDATE",
                    newData: { data: formattedItems, key: "items" },
                    oldData: { id: active.id },
                    location: { page: "edit", id: "template_items", override: "ai_generated_items" }
                })
                refreshEditSlide.set(true)
                newToast(translateText("actions.done"))
                return
            }
        }

        if (action.type === "CREATE_OVERLAY") {
            const overlay: Overlay = {
                name: action.data.name || "Untitled",
                color: action.data.color || null,
                category: null,
                items: formattedItems
            }

            const id = uid()
            overlays.update((cur) => ({ ...cur, [id]: overlay }))
            send(OUTPUT, ["OVERLAY"], get(overlays))
            newToast(translateText("new.overlay"))
            return
        }

        if (action.type === "CREATE_TEMPLATE") {
            const template: Overlay = {
                name: action.data.name || "Untitled",
                color: action.data.color || null,
                category: null,
                items: formattedItems
            }

            const id = uid()
            templates.update((cur) => ({ ...cur, [id]: template }))
            newToast(translateText("new.template"))
            return
        }

        if (action.type === "CREATE_SLIDE") {
            const currentShowId = get(activeShow)?.id || get(activeEdit).showId || ""
            if (!currentShowId) {
                newToast("No active show")
                return
            }

            const slideId = uid()
            const newSlide: Slide = {
                group: null,
                color: action.data.color || null,
                notes: "",
                settings: {},
                items: formattedItems
            }

            showsCache.update((cache) => {
                if (!cache[currentShowId]) return cache
                if (!cache[currentShowId].slides) cache[currentShowId].slides = {}
                cache[currentShowId].slides[slideId] = newSlide
                return cache
            })

            refreshEditSlide.set(true)
            newToast(translateText("new.slide"))
            return
        }

        newToast("Action not supported")
    }

    private static formatItems(rawItems?: any[]): Item[] {
        if (!Array.isArray(rawItems)) return []

        return rawItems.map((_item) => {
            const item: Item = {
                style: this.normalizeItemStyle(_item.style),
                align: _item.align || "",
                lines: Array.isArray(_item.lines) ? _item.lines : []
            }
            if (_item.type) item.type = _item.type
            if (_item.textFit === "shrinkToFit" || _item.textFit === "none") item.textFit = _item.textFit
            return item
        })
    }

    private static normalizeItemStyle(style?: string): string {
        if (!style) return "top: 100px; left: 100px; width: 1720px; height: 880px;"

        const parsed = getStyles(style)
        const CANVAS_WIDTH = 1920
        const CANVAS_HEIGHT = 1080

        let width = 0
        let height = 0
        let hasWidth = false
        let hasHeight = false

        if (parsed.width) {
            hasWidth = true
            if (parsed.width.endsWith("%")) {
                const pct = parseFloat(parsed.width) / 100
                width = Math.round(CANVAS_WIDTH * pct)
                parsed.width = `${width}px`
            } else {
                width = parseFloat(removeText(parsed.width)) || 0
            }
        }

        if (parsed.height) {
            hasHeight = true
            if (parsed.height.endsWith("%")) {
                const pct = parseFloat(parsed.height) / 100
                height = Math.round(CANVAS_HEIGHT * pct)
                parsed.height = `${height}px`
            } else {
                height = parseFloat(removeText(parsed.height)) || 0
            }
        }

        if (parsed.left) {
            if (parsed.left.endsWith("%")) {
                const pct = parseFloat(parsed.left) / 100
                if (pct === 0.5 && !parsed.transform && hasWidth) {
                    parsed.left = `${Math.round((CANVAS_WIDTH - width) / 2)}px`
                } else {
                    parsed.left = `${Math.round(CANVAS_WIDTH * pct)}px`
                }
            }
        }

        if (parsed.top) {
            if (parsed.top.endsWith("%")) {
                const pct = parseFloat(parsed.top) / 100
                if (pct === 0.5 && !parsed.transform && hasHeight) {
                    parsed.top = `${Math.round((CANVAS_HEIGHT - height) / 2)}px`
                } else {
                    parsed.top = `${Math.round(CANVAS_HEIGHT * pct)}px`
                }
            }
        }

        if (!hasWidth) {
            parsed.width = "1720px"
            width = 1720
        }
        if (!hasHeight) {
            parsed.height = "880px"
            height = 880
        }
        if (!parsed.left) {
            parsed.left = `${Math.round((CANVAS_WIDTH - width) / 2)}px`
        }
        if (!parsed.top) {
            parsed.top = `${Math.round((CANVAS_HEIGHT - height) / 2)}px`
        }

        return Object.entries(parsed)
            .map(([k, v]) => `${k}: ${v};`)
            .join(" ")
    }
}
