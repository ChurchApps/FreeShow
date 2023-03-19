import { get } from "svelte/store"
import { uid } from "uid"
import type { Show } from "../../types/Show"
import { _show } from "../components/helpers/shows"
import { dictionary, templates } from "../stores"

export class ShowObj implements Show {
    name: string
    private?: boolean
    reference?: any
    category: any
    settings: any
    timestamps: any
    meta: any
    slides: any
    layouts: any
    media: any
    constructor(isPrivate: boolean = false, category: null | string = null, layoutID: string = uid(), created: number = new Date().getTime(), template: string | boolean = true) {
        if (template !== false) {
            template = _show("active").get("settings.template") || null
            if (!template && get(templates).default) template = "default"
        }

        // private?: boolean,
        this.name = ""
        this.private = isPrivate
        // this.private = private
        this.category = category
        this.settings = { activeLayout: layoutID, template }
        this.timestamps = {
            created,
            modified: null,
            used: null,
        }
        this.meta = {}
        this.slides = {}
        this.layouts = { [layoutID]: { name: get(dictionary).example?.default || "Default", notes: "", slides: [] } }
        this.media = {}
    }
}
