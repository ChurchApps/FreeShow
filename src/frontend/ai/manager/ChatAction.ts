import { get } from "svelte/store"
import { overlays, templates } from "../../stores"
import { uid } from "uid"
import type { Item, Overlay } from "../../../types/Show"
import { newToast } from "../../utils/common"

export interface FreeShowAction {
    type: "CREATE_SLIDE" | "CREATE_TEMPLATE" | "CREATE_OVERLAY" | "CREATE_OUTPUT"
    data: {
        name?: string
        color?: string | null
        category?: string
        items?: Array<{
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

export const chatActionLabels = {
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

        if (action.type === "CREATE_OVERLAY") {
            // validate
            if (!this.validateSlide(action.data)) return

            const items: Item[] =
                action.data.items?.map((_item) => {
                    const item: Item = {
                        style: _item.style || "",
                        align: _item.align || "",
                        lines: _item.lines || []
                    }
                    if (_item.textFit === "shrinkToFit") item.textFit = "shrinkToFit"
                    return item
                }) || []

            const overlay: Overlay = {
                name: action.data.name || "Untitled",
                color: action.data.color || null,
                category: null, // "generated",
                items
            }

            overlays.set({ ...get(overlays), [uid()]: overlay })
            return
        }

        if (action.type === "CREATE_TEMPLATE") {
            // validate
            if (!this.validateSlide(action.data)) return

            const items: Item[] =
                action.data.items?.map((_item) => {
                    const item: Item = {
                        style: _item.style || "",
                        align: _item.align || "",
                        lines: _item.lines || []
                    }
                    if (_item.textFit === "shrinkToFit") item.textFit = "shrinkToFit"
                    return item
                }) || []

            const template: Overlay = {
                name: action.data.name || "Untitled",
                color: action.data.color || null,
                category: null, // "generated",
                items
            }

            templates.set({ ...get(templates), [uid()]: template })
            return
        }

        newToast("Not implemented yet.")
    }

    private static validateSlide(data: FreeShowAction["data"]) {
        if (!data) return false
        if (!data.name || !data.items) return false
        return true
    }
}
