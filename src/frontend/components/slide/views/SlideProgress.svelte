<script lang="ts">
    import { allOutputs, groups, outputs, showsCache } from "../../../stores"
    import { translateText } from "../../../utils/language"
    import { getActiveOutputs } from "../../helpers/output"
    import { getGroupName, getLayoutRef } from "../../helpers/show"
    import type { LayoutRef, Show, ShowGroups, Slide } from "../../../../types/Show"

    export let tracker: any
    export let outputId = ""
    export let item: any = {}
    export let autoSize = 0

    let type: "number" | "bar" | "group" = "number"
    $: type = tracker.type || "number"
    let accent: string | undefined
    $: accent = tracker.accent

    interface LayoutGroupInfo {
        name: string
        oneLetterName: string
        index: number
        child: number
        hide?: boolean
    }

    interface ProgressEntry {
        layoutGroups: LayoutGroupInfo[]
        slidesLength: number
        layoutSeed: string
        groupSeed: string
        trackerKey: string
    }

    const layoutCache = new Map<string, { seed: string; ref: LayoutRef[] }>()
    const progressCache = new Map<string, ProgressEntry>()

    let currentOutput: any = {}
    let currentSlideOut: any = null
    let currentShowId = ""
    let currentShowSlide = -1
    let currentShow: Show | null = null
    let currentLayoutRef: LayoutRef[] = []
    let currentShowSlides: Record<string, Slide | undefined> = {}
    let currentGroups: ShowGroups = {}
    let layoutGroups: LayoutGroupInfo[] = []
    let slidesLength = 0
    let progressData: ProgressEntry = { layoutGroups: [], slidesLength: 0, layoutSeed: "", groupSeed: "", trackerKey: "" }

    $: if (!outputId) outputId = getActiveOutputs()[0]
    $: currentOutput = $outputs[outputId] || $allOutputs[outputId] || {}
    $: currentSlideOut = currentOutput?.out?.slide || null
    $: currentShowId = currentSlideOut?.id || ""
    $: currentShowSlide = currentSlideOut?.index ?? -1
    $: currentShow = currentShowId ? $showsCache[currentShowId] : null
    $: currentLayoutRef = getCachedLayoutRef(currentShowId, currentShow, $showsCache)
    $: currentShowSlides = currentShow?.slides || {}
    $: currentGroups = $groups
    $: progressData = getProgress(currentShowId, currentShow, currentLayoutRef, currentShowSlides, currentGroups, tracker)
    $: layoutGroups = progressData.layoutGroups
    $: slidesLength = progressData.slidesLength

    let progressElem: HTMLElement | undefined
    $: column = (progressElem?.offsetWidth || 0) < (progressElem?.offsetHeight || 0)

    function getLayoutSeed(show: Show | null) {
        if (!show) return "0"

        const layoutId = show.settings?.activeLayout || ""
        const layoutSlides = show.layouts?.[layoutId]?.slides || []
        if (!layoutSlides.length) return layoutId

        let seed = `${layoutId}:`
        layoutSlides.forEach((layoutSlide) => {
            const slide = show.slides?.[layoutSlide.id]
            const slideChildren = Array.isArray(slide?.children) ? (slide?.children as string[]) : []
            const children = slideChildren.join(",")
            const group = slide?.group || ""
            const globalGroup = slide?.globalGroup || ""
            const disabled = layoutSlide?.disabled ? 1 : 0
            seed += `${layoutSlide.id}:${disabled}:${children}:${group}:${globalGroup}|`
        })

        return seed
    }

    function getGroupSeed(groupsStore: ShowGroups) {
        if (!groupsStore) return "0"
        return Object.entries(groupsStore)
            .map(([id, value]) => `${id}:${value?.name || ""}:${value?.default ? 1 : 0}`)
            .join("|")
    }

    function getCachedLayoutRef(showId: string, show: Show | null, cacheSource: any): LayoutRef[] {
        if (!showId || !show) return []

        const seed = getLayoutSeed(show)
        const cached = layoutCache.get(showId)
        if (cached && cached.seed === seed) return cached.ref

        const ref = getLayoutRef(showId, cacheSource)
        layoutCache.set(showId, { seed, ref })
        return ref
    }

    function getProgress(
        showId: string,
        show: Show | null,
        layoutRef: LayoutRef[],
        slides: { [key: string]: Slide | undefined },
        groupsStore: ShowGroups,
        trackerData: any
    ): ProgressEntry {
        if (!showId || !show || !layoutRef.length) return { layoutGroups: [], slidesLength: 0, layoutSeed: "", groupSeed: "", trackerKey: "" }

        const layoutSeed = getLayoutSeed(show)
        const groupSeed = getGroupSeed(groupsStore)
        const trackerKey = trackerData?.oneLetter ? "one" : "full"
        const cacheKey = `${showId}:${trackerKey}`
        const cached = progressCache.get(cacheKey)
        if (cached && cached.layoutSeed === layoutSeed && cached.groupSeed === groupSeed) return cached

        const parentChildrenMap = new Map<string, string[]>()
        layoutRef.forEach((ref) => {
            if (ref.type === "parent" && Array.isArray(ref.children)) parentChildrenMap.set(ref.id, ref.children)
        })

    const showData = { show: show as Show, showId }
        const layoutGroups: LayoutGroupInfo[] = layoutRef.map((entry) => {
            const ref = entry.parent || entry
            const slide = slides[ref.id]
            if (!slide) return { name: "—", oneLetterName: "—", index: ref.layoutIndex, child: 0 }

            if (entry.data?.disabled || slide.group?.startsWith("~")) {
                return { name: "—", oneLetterName: "—", index: ref.layoutIndex, child: 0, hide: true }
            }

            let groupName: string = slide.group || "—"
            if (slide.globalGroup && groupsStore?.[slide.globalGroup]) {
                const globalGroup = groupsStore[slide.globalGroup]
                groupName = globalGroup.default ? translateText(`groups.${globalGroup.name}`) : globalGroup.name
            }

            if (typeof groupName !== "string") groupName = ""

            const fullName = (getGroupName(showData, ref.id, groupName, ref.layoutIndex) || "—").replace(/ *\([^)]*\) */g, "")
            const oneLetterSource = groupName ? groupName[0]?.toUpperCase() || "" : ""
            const oneLetterName = (getGroupName(showData, ref.id, oneLetterSource, ref.layoutIndex) || "—").replace(/ *\([^)]*\) */g, "").replace(" ", "")

            let childIndex = 0
            if (entry.type === "child") {
                const parentChildren = parentChildrenMap.get(ref.id) || []
                const childPos = parentChildren.indexOf(entry.id)
                childIndex = childPos >= 0 ? childPos + 1 : 0
            }

            return {
                name: fullName || "—",
                oneLetterName: oneLetterName || "—",
                index: ref.layoutIndex,
                child: childIndex
            }
        })

        const entry: ProgressEntry = { layoutGroups, slidesLength: layoutRef.length, layoutSeed, groupSeed, trackerKey }
        progressCache.set(cacheKey, entry)
        return entry
    }
</script>

<div class="progress" bind:this={progressElem} class:barBG={type === "bar"} style={accent ? "--accent: " + accent : ""}>
    {#if type === "number"}
        <div class="align autoFontSize" style="{autoSize ? 'font-size: ' + autoSize + 'px;' : ''}{item?.alignX ? '' : (item?.align || 'justify-content: center;').replaceAll('text-align', 'justify-content')}">
            <span style="color: var(--accent);">{currentShowSlide + 1}</span>/{slidesLength}
        </div>
    {:else if type === "bar"}
        <!-- progress bar -->
        <div class="bar" style="width: {slidesLength ? ((currentShowSlide + 1) / slidesLength) * 100 : 0}%;"></div>
    {:else if type === "group"}
        <!-- group sequence -->
        <div class="align groups autoFontSize" class:column style="{autoSize ? 'font-size: ' + autoSize + 'px;' : ''}{item?.alignX ? '' : (item?.align || 'justify-content: center;').replaceAll('text-align', 'justify-content')}">
            {#each layoutGroups as group}
                {#if !group.child && !group.hide}
                    {@const activeGroup = layoutGroups.find((a, i) => a.index === group.index && i === currentShowSlide)}
                    {@const nextSlide = layoutGroups.find((a, i) => a.index === group.index && i === currentShowSlide + 1)}

                    <div class="group" class:active={group.index === layoutGroups.find((_, i) => i === currentShowSlide)?.index}>
                        {tracker.oneLetter ? group.oneLetterName : group.name}{#if tracker.childProgress && (activeGroup?.child || nextSlide?.child)}<span style="opacity: 0.8;font-size: 0.7em;">.{(activeGroup?.child ?? -1) + 1}</span>{/if}
                    </div>
                {/if}
            {/each}
        </div>
    {/if}
</div>

<style>
    .progress {
        width: 100%;
        height: 100%;

        display: flex;
        align-items: center;
        justify-content: center;

        --accent: var(--secondary);
    }

    .progress.barBG {
        justify-content: flex-start;
    }
    .bar {
        height: 100%;
        background-color: var(--accent);
        transition: width 0.5s;
    }

    .align {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        /* stage align */
        justify-content: var(--text-align);
        outline: none !important;
    }

    .groups {
        display: flex;
        gap: 25px;
        flex-wrap: wrap;
    }
    .groups.column {
        flex-direction: column;
        text-align: start;
        width: 100%;
    }
    .group {
        transition: color 0.2s;
    }
    .group.active {
        color: var(--accent);
    }
</style>
