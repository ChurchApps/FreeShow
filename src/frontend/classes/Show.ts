import { get } from "svelte/store"
import { uid } from "uid"
import type { Show } from "../../types/Show"
import { _show } from "../components/helpers/shows"
import { activeShow, dictionary, templates } from "../stores"

export class ShowObj implements Show {
    name: string
    origin?: string
    private?: boolean
    reference?: any
    category: any
    settings: any
    timestamps: any
    quickAccess: any
    message?: {
        text: string
        template?: string
    }
    metadata?: {
        autoMedia?: boolean
        override: boolean
        display: string
        template: string
        tags?: string[]
    }
    meta: any
    slides: any
    layouts: any
    media: any

    constructor(isPrivate = false, category: null | string = null, layoutId: string = uid(), created: number = new Date().getTime(), template: string | boolean = true) {
        if (template !== false) {
            // get template from active show (if it's not default with the "Header" template)
            if (typeof template !== "string" && get(activeShow)?.id !== "default") template = _show().get("settings.template") || null
            else if (template === true) template = ""
            if (!template && get(templates).default) template = "default"
        }

        this.name = ""
        this.private = isPrivate
        this.category = category
        this.settings = { activeLayout: layoutId, template }
        this.timestamps = {
            created,
            modified: null,
            used: null,
        }
        this.quickAccess = {}
        this.meta = {}
        this.slides = {}
        this.layouts = { [layoutId]: { name: get(dictionary).example?.default || "Default", notes: "", slides: [] } }
        this.media = {}
    }
}
