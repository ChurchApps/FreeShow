<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Item, OutSlide, SlideData, TimelineAction } from "../../../../types/Show"
    import { scriptureSettings, showsCache, slideTimelineSpeedMultiplier, templates } from "../../../stores"
    import { waitUntilValueIsDefined } from "../../../utils/common"
    import { shouldItemBeShown } from "../../edit/scripts/itemHelpers"
    import { clone } from "../../helpers/array"
    import { loadCustomFonts } from "../../helpers/fonts"
    import { getStyleTemplate, itemNeedsAutoSize, slideHasAutoSizeItem } from "../../helpers/output"
    import Textbox from "../../slide/Textbox.svelte"
    import { SlideTimeline } from "../../timeline/SlideTimeline"
    import SlideItemTransition from "../transitions/SlideItemTransition.svelte"

    export let outputId: string
    export let outSlide: OutSlide
    export let isClearing = false

    export let slideData: SlideData | null
    export let currentSlide: any // Slide | null
    export let currentStyle: any

    export let animationData: any
    export let currentLineId: string | undefined
    export let lines: any

    export let ratio: number
    export let mirror = false
    export let preview = false
    export let transition: any = {}
    export let transitionEnabled = false
    export let styleIdOverride = ""
    export let refreshCounter = 0

    let origin = ""
    $: if (outSlide.id) updateShow()
    function updateShow() {
        // custom fonts
        const currentShow = $showsCache[outSlide.id]
        loadCustomFonts(currentShow?.settings?.customFonts || [])
        origin = currentShow?.origin || ""
    }

    // TEST:
    // conditions
    // transitions
    // overlays
    // style lines
    // starting slide while clearing

    let currentItems: Item[] = []
    let current: any = {}
    let show = false
    let renderVersion = 0

    // Strip text content and computed autoFontSize so we can compare the item/box shell itself
    function getItemBase(item: Item | undefined): Partial<Item> | null {
        if (!item) return null
        const { lines: _lines, autoFontSize: _auto, ...base } = item
        return base
    }

    // Compare two items to see if their visible content is identical (ignoring cached autoFontSize)
    function itemsAreEqual(oldItem: Item | undefined, newItem: Item | undefined): boolean {
        if (!oldItem || !newItem) return false
        return JSON.stringify(getItemBase(oldItem)) === JSON.stringify(getItemBase(newItem)) && JSON.stringify(oldItem.lines) === JSON.stringify(newItem.lines)
    }

    // Compare two items ignoring their text content and computed autoFontSize
    function itemBoxesAreEqual(oldItem: Item | undefined, newItem: Item | undefined): boolean {
        if (!oldItem || !newItem) return false
        return JSON.stringify(getItemBase(oldItem)) === JSON.stringify(getItemBase(newItem))
    }
    // maintain a hidden workload that primes autosize results ahead of the visible reveal
    let precomputeTargets: { item: Item; index: number; key: string }[] = []
    let precomputePending = new Set<string>()

    const showItemRef = { outputId, slideIndex: outSlide?.index }
    let conditionsUpdater = 0
    let isMic = false
    $: isMic = JSON.stringify(currentItems.map((a) => a?.conditions) || "").includes('"element":"volume"')

    let updaterInterval: NodeJS.Timeout
    $: {
        clearInterval(updaterInterval)
        updaterInterval = setInterval(
            () => {
                if (isClearing || !Array.isArray(currentItems)) return
                if (currentItems.find((a) => a?.conditions)) conditionsUpdater++
            },
            isMic ? 100 : 300
        )
    }
    onDestroy(() => clearInterval(updaterInterval))

    // do not update if only line has changed
    $: currentOutSlide = "{}"
    $: if (outSlide) {
        let newOutSlide = clone(outSlide)
        delete newOutSlide.line
        delete newOutSlide.revealCount
        delete newOutSlide.itemClickReveal
        let outSlideString = JSON.stringify(newOutSlide)
        if (outSlideString !== currentOutSlide) currentOutSlide = outSlideString
    }
    // do not update if lines has no changes for this output
    $: currentLines = "{}"
    $: if (lines) {
        let outLinesString = JSON.stringify(lines)
        if (outLinesString !== currentLines) currentLines = outLinesString
    }
    // do not update if style has no changes for this output
    $: currentStyleHash = "{}"
    $: {
        const styleString = JSON.stringify(currentStyle || {})
        if (styleString !== currentStyleHash) currentStyleHash = styleString
    }
    // only update if changed (no update when another output changes)
    let currentSlideItems: Item[] | null = null
    $: if (currentSlide?.items !== 0) {
        if (JSON.stringify(currentSlide?.items) !== JSON.stringify(currentSlideItems)) currentSlideItems = clone(currentSlide?.items || null)
    }
    $: if (current && outSlide) {
        if (current.outSlide && current.outSlide.id === outSlide.id && current.outSlide.index === outSlide.index) {
            current.outSlide.itemClickReveal = outSlide.itemClickReveal
            current.outSlide.revealCount = outSlide.revealCount
            current.outSlide.line = outSlide.line
        }
    }
    $: if (current && lines) {
        current.lines = clone(lines)
    }

    $: if (currentSlideItems !== undefined || currentOutSlide || currentLines || currentStyleHash || refreshCounter) updateItems()
    let timeout: NodeJS.Timeout | null = null
    let updateGeneration = 0
    let handledRefreshCounter = 0

    // if anything is outputted & changing to something that's outputted
    let transitioningBetween = false

    let onPrecomputeDone: (() => void) | null = null

    function setCurrentState() {
        currentItems = clone(currentSlide.items || [])
        current = {
            outSlide: clone(outSlide),
            slideData: clone(slideData),
            currentSlide: clone(currentSlide),
            lines: clone(lines),
            currentStyle: clone(currentStyle),
            currentStyleHash
        }
    }

    // kick off hidden textbox renders that warm the autosize cache before we flip "show" on
    function scheduleAutoSizePrecompute(items: Item[]) {
        onPrecomputeDone = null
        if (!Array.isArray(items) || !items.length) {
            precomputeTargets = []
            precomputePending.clear()
            return
        }

        const targets: { item: Item; index: number; key: string }[] = []
        const pendingKeys = new Set<string>()

        items.forEach((item, index) => {
            if (!itemNeedsAutoSize(item)) return
            const key = createAutoSizeKey(item, index)
            if (!key) return
            if (item.autoFontSize) return // skip entries that already have cached measurements

            pendingKeys.add(key)
            targets.push({ item: clone(item), index, key })
        })

        precomputeTargets = targets
        precomputePending = pendingKeys
    }

    // remove hidden probes once the underlying textbox reports that its autosize cache is hot
    function handlePrecomputeReady(event: CustomEvent<{ key: string; fontSize: number }>) {
        const key = event.detail?.key
        if (!key || !precomputePending.has(key)) return
        precomputePending.delete(key)
        if (!precomputePending.size) {
            precomputeTargets = []
            onPrecomputeDone?.()
            onPrecomputeDone = null
        }
    }

    // create a stable identifier for precompute + visible textbox coordination
    function createAutoSizeKey(item: Item, index: number) {
        return item?.id ? String(item.id) : `idx-${index}`
    }

    // outgoing items hold for auto size delay while incoming content calculates font size
    $: incomingNeedsAutoSize = slideNeedsAutoSize(currentSlide, outSlide, currentStyle)
    function slideNeedsAutoSize(slide: any, out: OutSlide, style: any) {
        if (slide?.items?.some(itemNeedsAutoSize)) return true

        let customTemplate = getStyleTemplate(out, style)
        if (!Object.keys(customTemplate).length && out?.id === "temp") customTemplate = $templates[$scriptureSettings.template] || {}

        return slideHasAutoSizeItem(customTemplate)
    }

    let isClearingToEmpty = false
    async function updateItems() {
        let betweenClearingTransition = transition.between || transition
        if (betweenClearingTransition?.type === "none") betweenClearingTransition.duration = 0

        if (!currentSlideItems?.length) {
            scheduleAutoSizePrecompute([])
            currentItems = []
            current = {
                outSlide: clone(outSlide),
                slideData: clone(slideData),
                currentSlide: clone(currentSlide),
                lines: clone(lines),
                currentStyle: clone(currentStyle)
            }

            // wait for items to properly clear
            // if changing quickly from text to empty to text again, the first text will be displayed again (due to Svelte transition bug)
            if (transitionEnabled) {
                isClearingToEmpty = true
                setTimeout(() => (isClearingToEmpty = false), betweenClearingTransition.duration)
            }
            return
        }

        if (isClearingToEmpty) await waitUntilValueIsDefined(() => !isClearingToEmpty, 10, betweenClearingTransition.duration)

        const forceRemount = refreshCounter !== handledRefreshCounter
        if (forceRemount) handledRefreshCounter = refreshCounter

        const isTempSlide = outSlide?.id === "temp" || outSlide?.id === "tempText"
        const isDifferentSlide = isTempSlide || current.currentSlide?.id !== currentSlide?.id || current.outSlide?.index !== outSlide?.index || current.outSlide?.id !== outSlide?.id
        // Same-slide refreshes (line reveal / dynamic values / metadata churn) should update in place.
        // Running the full hide/show transition cycle here can briefly output an empty frame.
        if (!isDifferentSlide && !forceRemount) {
            if (timeout) clearTimeout(timeout)
            updateGeneration++
            setCurrentState()
            show = true
            transitioningBetween = false
            return
        }

        scheduleAutoSizePrecompute(currentSlide.items)

        // get any items with no transition between the two slides
        let oldItemTransition = currentItems.find((a) => a.actions?.transition)?.actions?.transition
        let newItemTransition = currentSlide.items.find((a) => a.actions?.transition)?.actions?.transition
        let itemTransitionDuration: number | null = null
        if (oldItemTransition && JSON.stringify(oldItemTransition) === JSON.stringify(newItemTransition)) {
            itemTransitionDuration = oldItemTransition.duration ?? null
            if (oldItemTransition.type === "none") itemTransitionDuration = 0
            // find any item that should have no transition!
            else if (currentSlide.items.find((a) => a.actions?.transition?.duration === 0 || a.actions?.transition?.type === "none")) itemTransitionDuration = 0
        }

        let currentTransition = transition.between || transition.in || transition
        if (currentTransition?.type === "none") currentTransition.duration = 0

        let currentTransitionDuration = transitionEnabled ? (itemTransitionDuration ?? currentTransition?.duration ?? 0) : 0
        let waitToShow = currentTransitionDuration * ((currentTransition?.fadeInOffset ?? 50) / 100)
        const hasNoVisualTransition = currentTransitionDuration === 0

        // Identify if any item or text content needs transitioning
        const isSameSlideRefresh = !isTempSlide && current.currentSlide?.id === currentSlide?.id && current.outSlide?.id === outSlide?.id && current.outSlide?.layout === outSlide?.layout && current.outSlide?.index === outSlide?.index
        const hasStyleChange = current.currentStyleHash !== currentStyleHash
        const forceRefreshItems = isSameSlideRefresh || hasStyleChange || forceRemount
        if (forceRefreshItems) renderVersion++

        const hasTransitioningItems = forceRefreshItems || currentSlide.items.some((newItem: Item, i: number) => !itemsAreEqual(currentItems[i], newItem))

        // between
        if (isDifferentSlide && currentItems.length && currentSlide.items.length) transitioningBetween = true

        if (timeout) clearTimeout(timeout)

        // If all items are unchanged, skip the show/hide cycle entirely
        if (!hasTransitioningItems && currentSlide.items.length > 0 && currentSlide.items.length === currentItems.length) {
            // Just update the context without triggering transitions
            setCurrentState()
            show = true
            transitioningBetween = false
            return
        }

        // Keep currently visible items mounted when transition is "none", then swap instantly
        // once incoming autosize precompute has completed. This avoids the brief fade/flash.
        if (hasNoVisualTransition) {
            const gen = ++updateGeneration

            const applyInstantSwap = () => {
                if (gen !== updateGeneration) return
                renderVersion++
                setCurrentState()
                show = true
                transitioningBetween = false
            }

            if (precomputePending.size) {
                const safetyTimer = setTimeout(applyInstantSwap, 150)
                onPrecomputeDone = () => {
                    clearTimeout(safetyTimer)
                    applyInstantSwap()
                }
            } else {
                applyInstantSwap()
            }
            return
        }

        const gen = ++updateGeneration

        // wait for between to update out transition
        timeout = setTimeout(() => {
            if (gen !== updateGeneration) return
            show = false

            // wait for previous items to start fading out (svelte will keep them until the transition is done!)
            timeout = setTimeout(() => {
                if (gen !== updateGeneration) return
                // Only include items that need transitioning in currentItems
                // Persistent items are rendered separately
                setCurrentState()

                // wait until half transition duration of previous items have passed as it looks better visually
                timeout = setTimeout(() => {
                    if (gen !== updateGeneration) return

                    const showSlide = () => {
                        if (gen !== updateGeneration) return
                        show = true

                        // wait for between to set in transition
                        timeout = setTimeout(() => {
                            if (gen !== updateGeneration) return
                            transitioningBetween = false
                        })
                    }

                    if (precomputePending.size) {
                        const safetyTimer = setTimeout(showSlide, 150)
                        onPrecomputeDone = () => {
                            clearTimeout(safetyTimer)
                            showSlide()
                        }
                    } else {
                        showSlide()
                    }
                }, waitToShow)
            })
        })
    }

    // OUTPUT SLIDE TIMELINE
    // get current slide timeline position
    let timelinePos = 0
    let timelineItems = new Map<string, Item[]>()
    let timelineActions: TimelineAction[] = []
    let isReady = false
    $: if (outSlide) isReady = false
    $: if (currentSlide) setupTimeline()
    function setupTimeline() {
        if (isReady) return
        timelinePos = 0
        timelineActions = currentSlide?.timeline?.actions || []
        // timelineItems = new Set<Item[]>() // WIP reset eventually?
        setTimeout(() => (isReady = true))
    }
    onMount(() => {
        const interval = setInterval(() => {
            if (isClearing || !isReady || !timelineActions.length) return
            // WIP use actual slide timeline pos when available?
            timelinePos += 15 * $slideTimelineSpeedMultiplier
            styleActions(timelineActions)

            // loop back when reached last action
            if (currentSlide?.timeline?.loop) {
                const lastActionTime = Math.max(...timelineActions.map((a) => a.time + (a.duration || 0) * 1000))
                if (timelinePos >= lastActionTime) timelinePos = 0
            }
        }, 15)

        function styleActions(actions: TimelineAction[]) {
            const itemStyleActions = actions.filter((a) => a.type === "style")
            // group by style key & indexes
            const groupedActions = new Map<string, TimelineAction[]>()
            for (const action of itemStyleActions) {
                const key = action.data?.key
                if (!key) continue

                const indexes = action.data?.indexes ? action.data.indexes.join(",") : ""
                const groupKey = `${key}-${indexes}`

                if (!groupedActions.has(groupKey)) groupedActions.set(groupKey, [])
                groupedActions.get(groupKey)?.push(action)
            }

            const slideKey = `${outSlide?.id}-${outSlide?.layout}-${outSlide?.index}`
            const items = clone(timelineItems.get(slideKey) || currentItems)

            const currentTime = timelinePos
            groupedActions.forEach((actions, _key) => {
                const previous = getPreviousAction(actions)
                const next = getNextAction(actions)
                const value = SlideTimeline.interpolateValue(previous, next, currentTime)
                if (value === null) return

                const action = (previous || next)!
                // const ref = _show(outSlide?.id || "").layouts([outSlide?.layout]).ref()[0] || []
                // const slideId = ref[outSlide?.index || 0]?.id
                // SlideTimeline.triggerAction(action, value, { id: outSlide.id, slideId: slideId })

                const itemIndexes = action.data.indexes ?? [0]
                itemIndexes.forEach((itemIndex) => {
                    const item = items[itemIndex]
                    if (!item) return

                    const updatedItem = SlideTimeline.updateStyle(action, item, value)
                    items[itemIndex] = updatedItem
                })
            })

            timelineItems.set(slideKey, items)
            timelineItems = timelineItems
        }

        function getPreviousAction(actions: TimelineAction[]) {
            const now = timelinePos
            return actions.reduce((prev, curr) => (curr.time > (prev?.time ?? -1) && curr.time <= now ? curr : prev), null as TimelineAction | null)
        }

        function getNextAction(actions: TimelineAction[]) {
            const now = timelinePos
            return actions.reduce((next, curr) => (curr.time > now && (next === null || curr.time < next.time) ? curr : next), null as TimelineAction | null)
        }

        return () => {
            clearInterval(interval)
        }
    })
</script>

<!-- Render all items in original order to maintain z-index layering -->
{#each currentItems as item, index}
    {#if item && shouldItemBeShown(item, [], showItemRef, conditionsUpdater) && (!item.clickReveal || current.outSlide?.itemClickReveal)}
        {@const currentTransition = transition.between || transition.in || transition}
        {#if !transitionEnabled || currentTransition?.type === "none" || currentTransition?.duration === 0}
            <!-- No transition enabled: render directly without transition wrapper -->
            <Textbox
                backdropFilter={current.slideData?.["backdrop-filter"] || ""}
                chords={item.chords?.enabled}
                animationStyle={animationData.style || {}}
                item={timelineItems.get(`${current.outSlide?.id}-${current.outSlide?.layout}-${current.outSlide?.index}`)?.[index] || item}
                transition={null}
                {ratio}
                {outputId}
                ref={{ type: "show", showId: current.outSlide?.id, slideId: current.currentSlide?.id, id: current.currentSlide?.id || "", layoutId: current.outSlide?.layout, origin }}
                linesStart={current.lines?.[currentLineId || ""]?.[item.lineReveal ? "linesStart" : "start"]}
                linesEnd={current.lines?.[currentLineId || ""]?.[item.lineReveal ? "linesEnd" : "end"]}
                clickRevealed={!!current.lines?.[currentLineId || ""]?.clickRevealed}
                outputStyle={current.currentStyle}
                {mirror}
                {preview}
                slideIndex={current.outSlide?.index}
                {styleIdOverride}
                autoSizeKey={createAutoSizeKey(item, index)}
                itemIndex={index}
                updateDynamicValues={!isClearing}
            />
        {:else}
            <!-- Keep outer item/box mounted across slides when its base properties match; transition inner text content if only lines changed -->
            {@const itemBox = getItemBase(item) || item}
            {@const boxChanged = !itemBoxesAreEqual(currentItems[index], currentSlide?.items?.[index])}
            {#key `${boxChanged ? show : true}-${renderVersion}-${index}-${JSON.stringify(itemBox)}`}
                {#if !boxChanged || show}
                    <SlideItemTransition {preview} {transitionEnabled} {transitioningBetween} {isClearing} {incomingNeedsAutoSize} globalTransition={transition} item={itemBox} let:transition={boxTransition}>
                        <Textbox
                            backdropFilter={current.slideData?.["backdrop-filter"] || ""}
                            chords={item.chords?.enabled}
                            animationStyle={animationData.style || {}}
                            item={timelineItems.get(`${current.outSlide?.id}-${current.outSlide?.layout}-${current.outSlide?.index}`)?.[index] || item}
                            transition={boxTransition}
                            textTransition={show || !boxChanged
                                ? {
                                      show: itemsAreEqual(currentItems[index], currentSlide?.items?.[index]) ? true : show,
                                      renderVersion,
                                      transitionEnabled,
                                      transitioningBetween,
                                      isClearing,
                                      incomingNeedsAutoSize,
                                      globalTransition: transition,
                                      lines: current.lines,
                                      currentLineId
                                  }
                                : null}
                            {ratio}
                            {outputId}
                            ref={{ type: "show", showId: current.outSlide?.id, slideId: current.currentSlide?.id, id: current.currentSlide?.id || "", layoutId: current.outSlide?.layout, origin }}
                            linesStart={current.lines?.[currentLineId || ""]?.[item.lineReveal ? "linesStart" : "start"]}
                            linesEnd={current.lines?.[currentLineId || ""]?.[item.lineReveal ? "linesEnd" : "end"]}
                            clickRevealed={!!current.lines?.[currentLineId || ""]?.clickRevealed}
                            outputStyle={current.currentStyle}
                            {mirror}
                            {preview}
                            slideIndex={current.outSlide?.index}
                            {styleIdOverride}
                            autoSizeKey={createAutoSizeKey(item, index)}
                            itemIndex={index}
                            updateDynamicValues={!isClearing}
                        />
                    </SlideItemTransition>
                {/if}
            {/key}
        {/if}
    {/if}
{/each}

{#if precomputeTargets.length}
    <div class="autosize-precompute" aria-hidden="true">
        {#each precomputeTargets as target (target.key)}
            <Textbox item={target.item} {ratio} {outputId} outputStyle={currentStyle} {mirror} {preview} {styleIdOverride} ref={{ type: "show", showId: outSlide?.id, slideId: currentSlide?.id, id: currentSlide?.id || "", layoutId: outSlide?.layout }} autoSizeKey={target.key} itemIndex={target.index} on:autosizeReady={handlePrecomputeReady} updateDynamicValues={!isClearing} />
        {/each}
    </div>
{/if}

<style>
    /* park precompute textboxes far off-screen so they never flash during transitions */
    .autosize-precompute {
        position: absolute;
        top: -10000px;
        left: -10000px;
        width: 0;
        height: 0;
        overflow: hidden;
        pointer-events: none;
        visibility: hidden;
    }
</style>
