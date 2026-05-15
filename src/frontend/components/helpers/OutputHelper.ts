import { get } from "svelte/store"
import { activeFocus, activeProject, activeShow, focusMode, outLocked, outputs, projects, showsCache } from "../../stores"
import { openProjectItem } from "../show/project"
import { getAllActiveOutputIds, setOutput } from "./output"
import { _show } from "./shows"
import { checkActionTrigger, updateOut } from "./showActions"

export class OutputHelper {
    static advanceOutputs(e: KeyboardEvent) {
        getAllActiveOutputIds().forEach((id) => {
            this.advanceOutput(id, e.key, !e.altKey)
        })
    }

    // play next slide or item in project
    // continue from outputted, or play active
    static advanceOutput(outputId: string, triggerKey: string = "", extra: boolean = true) {
        if (get(outLocked)) return

        // outputId = outputId || getFirstActiveOutput()?.id

        if (triggerKey === "Home") return this.playFirstSlide(outputId)
        if (triggerKey === "End") return this.playLastSlide(outputId)
        if (triggerKey === "ArrowLeft" || triggerKey === "PageUp") return this.playPrevious(outputId)

        const fromActive = triggerKey === " " // space key
        this.playNext(outputId, fromActive, extra) // ArrowRight, PageDown, Space
    }

    /////

    private static playFirstSlide(outputId: string) {
        const show = this.getShow(outputId)
        if (!show) return
    }

    private static playLastSlide(outputId: string) {
        const show = this.getShow(outputId)
        if (!show) return
    }

    private static playPrevious(outputId: string) {
        const show = this.getShow(outputId)
        if (!show) return // go to previous ...
    }

    // order of next:
    // 1. Any "Lines" set in output style which splits a slide into multiple parts
    // 1. Any Item "Reveal on click", then any "Reveal line by line"
    // 2. Any slides in outputted show
    // 3. Next project item when reached end
    // 4. Active show/item
    private static playNext(outputId: string, fromActive: boolean = false, extra: boolean = true) {
        const show = this.getShow(outputId, fromActive)
        if (show) {
            const nextSlide = this.getNextSlide(show)
            if (!nextSlide) {
                // go to next project item
                const projectItems = this.getProjectItems()
                const projectItemIndex = projectItems.findIndex((item) => item.id === show.id && (item.layout ? item.layout === show.layout : true))
                const newIndex = projectItemIndex + 1
                if (projectItems[newIndex]) openProjectItem(projectItems[newIndex].id, newIndex)

                // WIP play directly in focus mode

                return
            }

            // WIP play next slide
            this.playSlide(outputId, show.id, show.layout || "", nextSlide.index, extra)
        }

        // WIP check if outputted bg exists as project item
        // WIP play any active item....
    }

    /////

    private static getShow(outputId: string, fromActive: boolean = false) {
        // get outputted show if any
        if (!fromActive) {
            const outSlide = OutputHelper.getOutputtedSlide(outputId)
            const isShow = (outSlide?.type || "show") === "show"
            if (outSlide && isShow) return { id: outSlide.id, index: outSlide.index!, layout: outSlide.layout } // , layoutIndex: outSlide.layoutIndex
        }

        // get active show if any
        const activeItem = OutputHelper.getActiveItem()
        if (activeItem) {
            const show = get(showsCache)[activeItem.id]
            if (show) return { id: activeItem.id, index: -1, layout: show.settings?.activeLayout }
        }

        return null
    }

    private static getNextSlide(data: { id: string; index: number; layout?: string | null }) {
        const show = get(showsCache)[data.id]
        if (!show) return null

        const layoutRef =
            _show(data.id)
                .layouts(data.layout ? [data.layout] : "active")
                .ref()[0] || []

        let newIndex = data.index + 1
        while (layoutRef[newIndex] && !layoutRef[newIndex]?.data?.disabled) {
            newIndex++
        }

        // WIP multiple "lines" per slide

        return layoutRef[newIndex] ? { index: newIndex } : null
    }

    private static getProjectItems() {
        return get(projects)[get(activeProject) || ""]?.shows || []
    }

    private static getActiveItem() {
        return get(focusMode) ? get(activeFocus) : get(activeShow)
    }

    private static getOutputtedSlide(outputId: string) {
        const currentOutput = get(outputs)[outputId] || {}
        return currentOutput.out?.slide || null

        // const currentProject = get(projects)[get(activeProject) || ""]
        // const activeItem = OutputHelper.getActiveItem()
        // const currentShow = get(showsCache)[activeItem?.id || ""]

        // let currentLayoutId = (get(focusMode) ? currentProject?.shows?.[activeItem?.index ?? -1]?.layout : null) || currentShow?.settings?.activeLayout
        // let slide: null | OutSlide = currentOutput.out?.slide || null
        // if (!slide) {
        //     const cachedSlide: null | OutSlide = get(outputSlideCache)[outputId] || null
        //     if (cachedSlide && cachedSlide?.id === currentShow?.id && cachedSlide?.layout === currentLayoutId) slide = cachedSlide
        // }

        // return slide
    }

    // private static getOutputtedBackground() {}

    /////

    private static playSlide(outputId: string, showId: string, layoutId: string, slideIndex: number, extra: boolean = true) {
        const layout =
            _show(showId)
                .layouts(layoutId ? [layoutId] : "active")
                .ref()?.[0] || []
        const data = layout[slideIndex]?.data
        checkActionTrigger(data, slideIndex)
        // allow custom actions to trigger first
        setTimeout(() => {
            setOutput("slide", { id: showId, layout: layoutId, index: slideIndex }, false, outputId)
            updateOut(showId, slideIndex!, layout, extra, outputId)
        })
    }

    static playItem() {}
}
