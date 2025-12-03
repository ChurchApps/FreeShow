import { get } from "svelte/store"
import type { Item, Template } from "../../types/Show"
import { getItemText } from "../components/edit/scripts/textStyle"
import { clone } from "../components/helpers/array"
import { mergeWithTemplate } from "../components/helpers/output"
import { overlays, templates } from "../stores"

const DEFAULT_TEMPLATE: Template = { name: "", color: null, category: null, items: [] }

export class TemplateHelper {
    template: Template

    constructor(templateId: string) {
        this.template = clone(get(templates)[templateId])
        if (!this.template) this.template = clone(DEFAULT_TEMPLATE)
    }

    getItems() {
        return clone(this.template?.items || [])
    }

    getPlainText() {
        return this.getItems().reduce((value, item) => (value += getItemText(item)), "")
    }

    getTextboxItems() {
        return this.getItems().filter(a => {
            if (getItemText(a).includes("{")) return false
            return a.lines
        })
    }
    getNonTextboxItems() {
        return this.getItems().filter(a => {
            if (getItemText(a).includes("{")) return true
            return !a.lines && a.type !== "text"
        })
    }

    // used for scripture slides
    createSlides(count: number = 1, isChild: boolean = false): Item[][] {
        const slides: Item[][] = []

        if (this.template.settings?.firstSlideTemplate && !isChild) {
            const firstSlideTemplate = new TemplateHelper(this.template.settings.firstSlideTemplate)
            slides.push(firstSlideTemplate.createSlides(1, true)[0])
        }

        for (let i = 0; i < count; i++) {
            const items = mergeWithTemplate([], this.getItems(), true)

            // add overlay items
            if (this.template.settings?.overlayId) {
                const overlayItems = get(overlays)[this.template.settings.overlayId]?.items || []
                items.push(...overlayItems)
            }

            slides.push(items)
        }

        return slides
    }
}
