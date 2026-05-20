import { get } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import type { OutData } from "../../../types/Output"
import type { ShowRef } from "../../../types/Projects"
import type { OutSlide, Slide } from "../../../types/Show"
import { AudioPlayer } from "../../audio/audioPlayer"
import { sendMain } from "../../IPC/main"
import { activeFocus, activeProject, activeShow, focusMode, outLocked, outputs, projects, showsCache, special } from "../../stores"
import { playFolder, togglePlayingMedia } from "../../utils/shortcuts"
import { openProjectItem } from "../show/project"
import { clone } from "./array"
import { getAllActiveOutputIds, setOutput } from "./output"
import { checkActionTrigger, getFewestOutputLines, getItemWithMostLines, playPdf, updateOut } from "./showActions"
import { _show } from "./shows"

type Options = { isSpace: boolean; slideLayers: boolean; playNext: boolean }

export class OutputHelper {
    static advanceOutputs(e: KeyboardEvent | "next" | "previous" = "next") {
        getAllActiveOutputIds().forEach((id) => {
            if (typeof e === "string") this.advanceOutput(id, e === "next" ? "ArrowRight" : "ArrowLeft")
            else this.advanceOutput(id, e.key, { slideLayers: !e.altKey })
        })
    }

    // play next slide or item in project
    // continue from outputted, or play active
    static advanceOutput(outputId: string, triggerKey: string = "", options: { slideLayers?: boolean; playNext?: boolean } = {}) {
        if (get(outLocked)) return

        // blur to remove tab highlight from slide after clicked, and using arrows
        if (document.activeElement?.closest(".slide") && !document.activeElement?.closest(".edit")) (document.activeElement as HTMLElement).blur()

        // outputId = outputId || getFirstActiveOutput()?.id

        let opts: Options = {
            isSpace: triggerKey === " ",
            slideLayers: options.slideLayers !== false,
            playNext: options.playNext === true
        }

        if (triggerKey === "Home") return this.playFirstSlide(outputId)
        if (triggerKey === "End") return this.playLastSlide(outputId)
        if (triggerKey === "ArrowLeft" || triggerKey === "PageUp") return this.playPrevious(outputId, opts)

        this.playNext(outputId, opts) // ArrowRight, PageDown, Space
    }

    /////

    private static playFirstSlide(outputId: string) {
        const show = this.getShow(outputId)
        if (!show) return

        const nextSlide = this.getNextSlide({ ...show, index: undefined })
        if (!nextSlide) return

        this.playSlide(outputId, nextSlide)
    }

    private static playLastSlide(outputId: string) {
        const show = this.getShow(outputId)
        if (!show) return

        const previousSlide = this.getPreviousSlide({ ...show, index: undefined })
        if (!previousSlide) return

        this.playSlide(outputId, previousSlide)
    }

    private static playPrevious(outputId: string, options: Options) {
        this.play(outputId, false, options)
    }

    private static playNext(outputId: string, options: Options) {
        this.play(outputId, true, options)
    }

    private static play(outputId: string, next: boolean, options: Options) {
        const show = this.getShow(outputId, next, options)
        if (show) {
            const newSlide = this.getSubsequent(show, next)
            if (!newSlide) return this.changeProjectItem(outputId, show, next, options)

            if (this.quickChangeBack(outputId, show, next, options)) return

            this.playSlide(outputId, newSlide, options.slideLayers)
            return
        }

        const item = this.getItem(outputId, next, options)
        if (!item) {
            // don't go to next if active is video and it's currently outputted
            const outBg = this.getOut(outputId).background
            if ((options.isSpace && outBg?.type === "video") || (outBg?.type === "player" && outBg?.path === this.getActiveItem()?.id)) {
                togglePlayingMedia()
                return
            }

            return this.changeProjectItem(outputId, this.getActiveItem(), next, options)
        }

        this.playItem(outputId, item, next, options)
    }

    // this allows changing back to the previous project item with keyboard instead of advancing the slide if the active show is right before/after the outputted show
    private static quickChangeBack(outputId: string, show: OutSlide, next: boolean, options: Options) {
        let active = this.getActiveItem()
        let projectItems = this.getProjectItems()
        if (active?.index === undefined || active.id === show.id) return false
        if (projectItems[active.index + (next ? 1 : -1)]?.id !== show.id) return false
        if (next ? this.getPreviousSlide(show) : this.getNextSlide(show)) return false

        this.changeProjectItem(outputId, active, next, options)
        return true
    }

    private static changeProjectItem(outputId: string, item: OutSlide | ShowRef | null = null, next: boolean, options: Options) {
        if (!get(focusMode) && get(special).nextItemOnLastSlide === false) return

        const projectItems = this.getProjectItems()
        const projectItemIndex = this.getProjectItemIndex(item)
        let newIndex = projectItemIndex + (next ? 1 : -1)
        if (!projectItems[newIndex]) return

        // update mark as played
        projects.update((a) => {
            if (typeof a[get(activeProject)!]?.shows?.[projectItemIndex] !== "object") return a
            a[get(activeProject)!].shows[projectItemIndex].played = next ? true : false
            return a
        })

        if (get(focusMode)) {
            // skip sections & skip overlays when going back
            while (projectItems[newIndex]?.type === "section" || (next ? false : projectItems[newIndex]?.type === "overlay")) newIndex += next ? 1 : -1
            const newItem = projectItems[newIndex]
            if (!newItem) return

            activeFocus.set({ id: newItem.id, index: newIndex, type: newItem.type || "show" })

            // play directly in focus mode
            if ((newItem?.type || "show") === "show") {
                const newOut = this.getSubsequent({ id: newItem.id, layout: newItem.layout }, next)
                if (newOut) this.playSlide(outputId, newOut, options.slideLayers)
            } else {
                this.playItem(outputId, newItem, next, options)
            }
            return
        }

        openProjectItem(get(activeProject) || "", newIndex)

        // play directly from "Next slide timer" & "nextAfterMedia"
        if (options.playNext) {
            const newItem = projectItems[newIndex]
            if ((newItem?.type || "show") === "show") {
                // allow show to load first
                setTimeout(() => {
                    const newOut = this.getSubsequent({ id: newItem.id, layout: newItem.layout }, next)
                    if (newOut) this.playSlide(outputId, newOut, options.slideLayers)
                }, 10)
            } else {
                this.playItem(outputId, newItem, next, options)
            }
        }
    }

    private static getProjectItemIndex(item: OutSlide | ShowRef | null = null) {
        if (!item) return -1

        const projectItems = this.getProjectItems()
        const activeShow = this.getActiveItem()

        const outLayout = (item as OutSlide)?.layout
        const activeIndex = activeShow?.index ?? -1

        // get active if it's the same as the outputted
        if (activeShow?.id === item?.id && (projectItems[activeIndex]?.layout ? projectItems[activeIndex]?.layout === outLayout : true)) return activeIndex

        // get the first matching project item, after any active show
        let index = projectItems.findIndex((projectItem, i) => i >= activeIndex && projectItem.id === item?.id && (projectItem.layout ? projectItem.layout === outLayout : true))
        if (index !== -1) return index

        // get the first matching project item
        index = projectItems.findIndex((projectItem) => projectItem.id === item?.id && (projectItem.layout ? projectItem.layout === outLayout : true))
        return index
    }

    /////

    private static getShow(outputId: string, nextCheck: boolean | null = null, options: Partial<Options> = {}): OutSlide | null {
        const projectItems = this.getProjectItems()
        const activeItem = this.getActiveItem()
        const currentShow = get(showsCache)[activeItem?.id || ""]
        const activeOutShow: OutSlide | null = currentShow && !options.playNext ? { id: activeItem?.id || "", layout: projectItems[activeItem?.index ?? -1]?.layout || currentShow?.settings?.activeLayout } : null

        const outSlide = this.getOut(outputId).slide || null

        // force active show if it's not the same as outputted
        if (options.isSpace && !this.outShowIsSameAsActive(outSlide, activeOutShow)) return activeOutShow

        // prioritize outputted show in focus mode, if not reached end
        if (get(focusMode) && outSlide && (nextCheck ? this.getSubsequent(outSlide, nextCheck) : true)) return this.isShow(outSlide) ? outSlide : null

        // must be a show item
        if (!this.isShow(outSlide)) return activeOutShow

        // Home & End keys
        if (nextCheck === null) return outSlide

        // outputted show if not reached end, or if active show is the same
        if (this.getSubsequent(outSlide, nextCheck) || this.outShowIsSameAsActive(outSlide, activeOutShow)) return outSlide

        // active show if any
        return activeOutShow
    }

    private static isShow(data: OutSlide | ShowRef | null) {
        return data && (data.type || "show") === "show"
    }

    private static getItem(outputId: string, next: boolean, options: Options) {
        if (options.playNext) return this.getOut(outputId).slide || null // auto timer with looping (pdf)

        const activeItem = this.getActiveItem()
        if (!activeItem) return null
        if (activeItem.type === "section") return null
        if (this.isOutputted(outputId, activeItem, next, options)) return null

        return activeItem
    }

    // store previous in case it has been cleared after being played (e.g. when a playing video has finished)
    private static previousOutputted: OutData | null = null

    private static isOutputted(outputId: string, item: ShowRef, next: boolean, options: Options) {
        const out = this.getOut(outputId)

        if (item.type === "image" || item.type === "video" || item.type === "player") {
            let outBackground = out.background
            // restore previously playing video in focus mode - so we can automatically go to next even when it has been cleared
            if (get(focusMode) && !outBackground) outBackground = this.previousOutputted?.background

            return (outBackground?.path || outBackground?.id) === item.id
        }

        if (item.type === "overlay") {
            const outOverlays = out.overlays || []
            return outOverlays.includes(item.id || "")
        }

        if (item.type === "audio") {
            const outAudio = AudioPlayer.getAllPlaying(false)
            return outAudio.includes(item.id || "")
        }

        const outSlide = out.slide || null

        if (item.type === "pdf") {
            if (outSlide?.id !== item.id) return false
            if (!outSlide?.pages || typeof outSlide.page !== "number") return false
            if (options.playNext) return false // auto timer (might loop)
            return next ? outSlide.page + 1 >= outSlide.pages : outSlide.page <= 0
        }

        // if (item.type === "folder") return false

        return outSlide?.id === item.id
    }

    private static outShowIsSameAsActive(outSlide: OutSlide | null, active: OutSlide | null) {
        if (!outSlide || !active) return false
        return outSlide.id === active.id && outSlide.layout === active.layout
    }

    // order of next:
    // 1. Any "Lines" set in output style which splits a slide into multiple parts
    // 1. Any Item "Reveal on click", then any "Reveal line by line"
    // 2. Any slides in outputted show
    // 3. Next project item when reached end
    // 4. Active show/item
    private static getSubsequent(data: OutSlide | null, next: boolean): OutSlide | null {
        return next ? this.getNextSlide(data) : this.getPreviousSlide(data)
    }

    private static getNextSlide(data: OutSlide | null): OutSlide | null {
        if (!data) return null
        data = clone(data)

        const currentShow = get(showsCache)[data.id]
        if (!currentShow) return null

        if (!data.layout) data.layout = currentShow.settings?.activeLayout
        const layoutRef = this.getShowLayout(data)

        if (typeof data.index !== "number") data.index = -1

        const showSlide: Slide | null = _show(data.id).slides([layoutRef?.[data.index]?.id]).get()?.[0] || null

        let outSlideData: OutSlide = { id: data.id }

        const styleLines = this.checkStyleLines(data, showSlide)
        const clickReveal = this.checkClickReveal(data, showSlide)
        const linesReveal = this.checkLinesReveal(data, showSlide)

        if (!styleLines.hasEnded || !clickReveal.isRevealed || !linesReveal.isRevealed) {
            if (styleLines.nextLine !== null) outSlideData.line = styleLines.nextLine
            if (clickReveal.shouldReveal) outSlideData.itemClickReveal = true
            if (clickReveal.isRevealed && linesReveal.shouldReveal) outSlideData.revealCount = linesReveal.nextReveal
        } else {
            // loop to start
            if (layoutRef[data.index]?.data?.end) data.index = -1

            data.index++
            while (layoutRef[data.index]?.data?.disabled) data.index++
        }

        return layoutRef[data.index] ? { layout: data.layout, index: data.index, ...outSlideData } : null
    }

    private static getPreviousSlide(data: OutSlide | null): OutSlide | null {
        if (!data) return null
        data = clone(data)

        const currentShow = get(showsCache)[data.id]
        if (!currentShow) return null

        if (!data.layout) data.layout = currentShow.settings?.activeLayout
        const layoutRef = this.getShowLayout(data)

        if (typeof data.index !== "number") data.index = layoutRef.length

        const showSlide: Slide | null = _show(data.id).slides([layoutRef?.[data.index]?.id]).get()?.[0] || null

        let outSlideData: OutSlide = { id: data.id }

        const styleLines = this.checkStyleLines(data, showSlide)
        const clickReveal = this.checkClickReveal(data, showSlide)
        const linesReveal = this.checkLinesReveal(data, showSlide)

        if (!styleLines._hasEnded || data.itemClickReveal || !linesReveal._isRevealed) {
            if (styleLines.previousLine !== null) outSlideData.line = styleLines.previousLine
            if (linesReveal.shouldReveal) outSlideData.revealCount = linesReveal.previousReveal
            if (linesReveal.previousReveal > -1 && clickReveal._isRevealed) outSlideData.itemClickReveal = true
        } else {
            data.index--
            while (layoutRef[data.index]?.data?.disabled) data.index--

            const newShowSlide: Slide | null = _show(data.id).slides([layoutRef?.[data.index]?.id]).get()?.[0] || null
            const styleLines = this.checkStyleLines(data, newShowSlide)
            const clickReveal = this.checkClickReveal(data, newShowSlide)
            const linesReveal = this.checkLinesReveal(data, newShowSlide)

            if (styleLines.lastLine) outSlideData.line = styleLines.lastLine
            if (clickReveal.shouldReveal) outSlideData.itemClickReveal = true
            if (linesReveal._isRevealed) outSlideData.revealCount = linesReveal.lastReveal
        }

        return layoutRef[data.index] ? { layout: data.layout, index: data.index, ...outSlideData } : null
    }

    private static checkStyleLines(data: OutSlide, slide: Slide | null) {
        const amountOfLinesToShow = getFewestOutputLines()
        const linesIndex = amountOfLinesToShow ? data.line || 0 : null
        const slideLines = slide ? getItemWithMostLines(slide) : null

        const nextLine = linesIndex === null ? null : linesIndex + amountOfLinesToShow
        const previousLine = linesIndex === null ? null : linesIndex - amountOfLinesToShow
        const hasEnded = slideLines === null || linesIndex === null ? true : linesIndex + amountOfLinesToShow >= slideLines
        const _hasEnded = linesIndex === null || linesIndex < 1

        const maxIndex = slideLines ? amountOfLinesToShow * Math.ceil(slideLines / amountOfLinesToShow) : 0
        const lastLine = maxIndex ? maxIndex - amountOfLinesToShow : 0

        return { hasEnded, nextLine, _hasEnded, previousLine, lastLine }
    }
    private static checkClickReveal(data: OutSlide, slide: Slide | null) {
        const clickRevealItems = (slide?.items || []).filter((a) => a?.clickReveal)
        const isRevealed = clickRevealItems.length ? !!data.itemClickReveal : true
        const _isRevealed = !clickRevealItems.length || !!data?.itemClickReveal

        return { isRevealed, shouldReveal: !!clickRevealItems.length, _isRevealed }
    }
    private static checkLinesReveal(data: OutSlide, slide: Slide | null) {
        const linesRevealItems = (slide?.items || []).filter((a) => a?.lineReveal)
        const shouldLinesReveal = !!linesRevealItems.length
        const maxRevealLines = getItemWithMostLines({ items: linesRevealItems })
        const currentReveal = data?.revealCount ?? 0

        const nextReveal = currentReveal + 1
        const previousReveal = currentReveal - 1
        const isRevealed = shouldLinesReveal ? currentReveal >= maxRevealLines : true
        const _isRevealed = !shouldLinesReveal || currentReveal === 0

        const lastReveal = Math.max(0, maxRevealLines)

        return { isRevealed, shouldReveal: shouldLinesReveal, nextReveal, _isRevealed, previousReveal, lastReveal }
    }

    private static getShowLayout(outSlide: OutSlide) {
        return (
            _show(outSlide.id)
                .layouts(outSlide.layout ? [outSlide.layout] : "active")
                .ref()?.[0] || []
        )
    }

    private static getProjectItems() {
        return get(projects)[get(activeProject) || ""]?.shows || []
    }

    private static getActiveItem() {
        return (get(focusMode) ? get(activeFocus) : get(activeShow)) as ShowRef | null
    }

    private static getOut(outputId: string) {
        const currentOutput = get(outputs)[outputId] || {}
        return currentOutput.out || {}
    }

    /////

    private static playSlide(outputId: string, data: OutSlide, slideLayers: boolean = true) {
        this.previousOutputted = null

        const layout = this.getShowLayout(data)
        const layoutData = layout[data.index ?? -1]?.data

        checkActionTrigger(layoutData, data.index)
        // allow custom actions to trigger first
        setTimeout(() => {
            setOutput("slide", data, false, outputId)
            updateOut(data.id, data.index!, layout, slideLayers, outputId)
        })
    }

    static playItem(outputId: string, item: ShowRef | OutSlide | undefined, next: boolean, options: Options) {
        if (!item || this.isOutputted(outputId, item, next, options)) return

        this.previousOutputted = null
        const out = this.getOut(outputId)

        // Overlays
        if (item.type === "overlay") {
            return setOutput("overlays", item.id, false, "", true)
        }

        // Media (Background & Audio)
        if (item.type === "image" || item.type === "video" || item.type === "player" || item.type === "audio") {
            setTimeout(() => (this.previousOutputted = clone(this.getOut(outputId))))
            return togglePlayingMedia()
        }

        let outSlide = out.slide || null

        // PDF
        if (item.type === "pdf") {
            if (!options.playNext && outSlide?.id !== item.id) outSlide = item
            playPdf(outSlide, next, options.playNext)
            return
        }

        // Folder
        if (item.type === "folder") {
            const path = outSlide?.type === "folder" ? outSlide.id : item.id || ""
            playFolder(path)
            return
        }

        // PPT (deprecated)
        if (item.type === "ppt") {
            sendMain(Main.PRESENTATION_CONTROL, { action: next ? "next" : "previous" }) // e?.key === "PageDown" ? "last" :
            return
        }
    }
}
