<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Item, OutSlide, SlideData, Transition } from "../../../../types/Show"
    import { showsCache } from "../../../stores"
    import { shouldItemBeShown } from "../../edit/scripts/itemHelpers"
    import { clone } from "../../helpers/array"
    import { loadCustomFonts } from "../../helpers/fonts"
    import Textbox from "../../slide/Textbox.svelte"
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

    onMount(() => {
        // custom fonts
        const currentShow = $showsCache[outSlide.id]
        if (currentShow?.settings?.customFonts) loadCustomFonts(currentShow.settings.customFonts)
    })

    // TEST:
    // conditions
    // transitions
    // overlays
    // style lines
    // starting slide while clearing

    let currentItems: Item[] = []
    let current: any = {}
    let show = false

    // Track items that are unchanged between slides and have no transition (to avoid redraw flicker)
    let persistentItems: Item[] = []
    let persistentItemIndexes: number[] = []

    // Check if a transition is "meaningful" (not none and duration > 0)
    function hasRealTransition(itemTransition: Transition | undefined, globalTrans: Transition | undefined): boolean {
        // Item-level transition takes priority
        const trans = itemTransition || globalTrans
        if (!trans) return false
        // If type is "none" or duration is 0/undefined, no real transition
        if (trans.type === "none") return false
        if (!trans.duration || trans.duration === 0) return false
        return true
    }

    // Compare two items to see if their visible content is identical
    function itemsAreEqual(oldItem: Item | undefined, newItem: Item | undefined): boolean {
        if (!oldItem || !newItem) return false
        // Compare the full serialized content (lines, style, etc.)
        return JSON.stringify(oldItem) === JSON.stringify(newItem)
    }
    // maintain a hidden workload that primes autosize results ahead of the visible reveal
    let precomputeTargets: { item: Item; index: number; key: string }[] = []
    let precomputePending = new Set<string>()

    const showItemRef = { outputId, slideIndex: outSlide?.index }
    // $: videoTime = $videosTime[outputId] || 0 // WIP only update if the items text has a video dynamic value
    // $: if ($activeTimers || $variables || $playingAudio || $playingAudioPaths || videoTime) updateValues()
    let updater = 0
    const updaterInterval = setInterval(() => {
        if (isClearing) return
        if (currentItems.find(a => a.conditions)) updater++
    }, 300)
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
    // only update if changed (no update when another output changes)
    let currentSlideItems: Item[] | null = null
    $: if (currentSlide?.items !== 0) {
        if (JSON.stringify(currentSlide?.items) !== JSON.stringify(currentSlideItems)) currentSlideItems = clone(currentSlide?.items || null)
    }

    $: if (currentSlideItems !== undefined || currentOutSlide || currentLines) updateItems()
    let timeout: NodeJS.Timeout | null = null

    // if anything is outputted & changing to something that's outputted
    let transitioningBetween = false

    // lightweight guard so we only precompute for text items that actually rely on autosize
    function shouldPrecomputeAutoSize(item: Item) {
        if (!item) return false
        const type = item.type || "text"
        if (type !== "text") return false
        return !!item.auto
    }

    // kick off hidden textbox renders that warm the autosize cache before we flip "show" on
    function scheduleAutoSizePrecompute(items: Item[]) {
        if (preview || !Array.isArray(items) || !items.length) {
            precomputeTargets = []
            precomputePending.clear()
            return
        }

        const targets: { item: Item; index: number; key: string }[] = []
        const pendingKeys = new Set<string>()

        items.forEach((item, index) => {
            if (!shouldPrecomputeAutoSize(item)) return
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
        if (!precomputePending.size) precomputeTargets = []
    }

    // create a stable identifier for precompute + visible textbox coordination
    function createAutoSizeKey(item: Item, index: number) {
        return item?.id ? String(item.id) : `idx-${index}`
    }

    function updateItems() {
        if (!currentSlideItems?.length) {
            scheduleAutoSizePrecompute([])
            currentItems = []
            // Clear persistent items when no slide content
            persistentItems = []
            persistentItemIndexes = []
            current = {
                outSlide: clone(outSlide),
                slideData: clone(slideData),
                currentSlide: clone(currentSlide),
                lines: clone(lines),
                currentStyle: clone(currentStyle)
            }
            return
        }

        scheduleAutoSizePrecompute(currentSlide.items)

        // get any items with no transition between the two slides
        let oldItemTransition = currentItems.find(a => a.actions?.transition)?.actions?.transition
        let newItemTransition = currentSlide.items.find(a => a.actions?.transition)?.actions?.transition
        let itemTransitionDuration: number | null = null
        if (oldItemTransition && JSON.stringify(oldItemTransition) === JSON.stringify(newItemTransition)) {
            itemTransitionDuration = oldItemTransition.duration ?? null
            if (oldItemTransition.type === "none") itemTransitionDuration = 0
            // find any item that should have no transition!
            else if (currentSlide.items.find(a => a.actions?.transition?.duration === 0 || a.actions?.transition?.type === "none")) itemTransitionDuration = 0
        }

        let currentTransition = transition.between || transition.in || transition
        if (currentTransition?.type === "none") currentTransition.duration = 0

        let currentTransitionDuration = transitionEnabled ? (itemTransitionDuration ?? currentTransition?.duration ?? 0) : 0
        let waitToShow = currentTransitionDuration * 0.5

        // Identify items that are unchanged and have no real transition (to skip redraw)
        const newPersistentIndexes: number[] = []
        const newPersistentItems: Item[] = []
        const transitioningItems: Item[] = []
        const transitioningIndexes: number[] = []

        // First, check if ANY item on the slide has a real transition
        // If so, all items should animate together (no persistent items)
        const slideHasAnyTransition = currentSlide.items.some((item: Item) => {
            const itemTrans = item.actions?.transition
            return hasRealTransition(itemTrans, currentTransition)
        })

        currentSlide.items.forEach((newItem: Item, newIndex: number) => {
            // Find matching old item by index (position-based matching for slides)
            const oldItem = currentItems[newIndex]

            // Item is persistent only if:
            // 1. Content is unchanged AND
            // 2. No real transition on this item AND
            // 3. No other item on the slide has a transition (so whole slide animates together)
            if (itemsAreEqual(oldItem, newItem) && !slideHasAnyTransition) {
                newPersistentIndexes.push(newIndex)
                newPersistentItems.push(clone(newItem))
            } else {
                // Item needs to be re-rendered (changed, has transition, or another item has transition)
                transitioningIndexes.push(newIndex)
                transitioningItems.push(clone(newItem))
            }
        })

        // Update persistent items (these won't flash)
        persistentItemIndexes = newPersistentIndexes
        persistentItems = newPersistentItems

        // between
        if (currentItems.length && currentSlide.items.length) transitioningBetween = true

        if (timeout) clearTimeout(timeout)

        // If all items are persistent (unchanged), skip the show/hide cycle entirely
        if (transitioningItems.length === 0 && persistentItems.length > 0) {
            // Just update the context without triggering transitions
            current = {
                outSlide: clone(outSlide),
                slideData: clone(slideData),
                currentSlide: clone(currentSlide),
                lines: clone(lines),
                currentStyle: clone(currentStyle)
            }
            // Keep currentItems in sync but don't toggle show
            currentItems = clone(currentSlide.items || [])
            transitioningBetween = false
            return
        }

        // wait for between to update out transition
        timeout = setTimeout(() => {
            show = false

            // wait for previous items to start fading out (svelte will keep them until the transition is done!)
            timeout = setTimeout(() => {
                // Only include items that need transitioning in currentItems
                // Persistent items are rendered separately
                currentItems = clone(currentSlide.items || [])
                current = {
                    outSlide: clone(outSlide),
                    slideData: clone(slideData),
                    currentSlide: clone(currentSlide),
                    lines: clone(lines),
                    currentStyle: clone(currentStyle)
                }

                // wait until half transition duration of previous items have passed as it looks better visually
                timeout = setTimeout(() => {
                    show = true

                    // wait for between to set in transition
                    timeout = setTimeout(() => {
                        transitioningBetween = false
                    })
                }, waitToShow)
            })
        })
    }
</script>

<!-- Persistent items: unchanged content with no transition, rendered outside {#key} to avoid flicker -->
{#each persistentItems as item, idx}
    {@const index = persistentItemIndexes[idx]}
    {#if shouldItemBeShown(item, currentItems, showItemRef, updater) && (!item.clickReveal || current.outSlide?.itemClickReveal)}
        <Textbox
            backdropFilter={current.slideData?.["backdrop-filter"] || ""}
            disableListTransition={mirror}
            chords={item.chords?.enabled}
            animationStyle={animationData.style || {}}
            {item}
            transition={null}
            {ratio}
            {outputId}
            ref={{ showId: current.outSlide?.id, slideId: current.currentSlide?.id, id: current.currentSlide?.id || "", layoutId: current.outSlide?.layout }}
            linesStart={current.lines?.[currentLineId || ""]?.[item.lineReveal ? "linesStart" : "start"]}
            linesEnd={current.lines?.[currentLineId || ""]?.[item.lineReveal ? "linesEnd" : "end"]}
            clickRevealed={!!current.lines?.[currentLineId || ""]?.clickRevealed}
            outputStyle={current.currentStyle}
            {mirror}
            {preview}
            slideIndex={current.outSlide?.index}
            {styleIdOverride}
            autoSizeKey={createAutoSizeKey(item, index)}
        />
    {/if}
{/each}

<!-- Transitioning items: changed content or items with transitions, rendered inside {#key} for proper animation -->
{#key show}
    {#each currentItems as item, index}
        {#if show && !persistentItemIndexes.includes(index) && shouldItemBeShown(item, currentItems, showItemRef, updater) && (!item.clickReveal || current.outSlide?.itemClickReveal)}
            <SlideItemTransition
                {preview}
                {transitionEnabled}
                {transitioningBetween}
                globalTransition={transition}
                currentSlide={current.currentSlide}
                {item}
                outSlide={current.outSlide}
                lines={current.lines}
                currentStyle={current.currentStyle}
                let:customSlide
                let:customItem
                let:customLines
                let:customOut
                let:transition
            >
                <!-- filter={current.slideData?.filterEnabled?.includes("foreground") ? current.slideData?.filter : ""} -->
                <!-- backdropFilter={current.slideData?.filterEnabled?.includes("foreground") ? current.slideData?.["backdrop-filter"] : ""} -->
                <Textbox
                    backdropFilter={current.slideData?.["backdrop-filter"] || ""}
                    disableListTransition={mirror}
                    chords={customItem.chords?.enabled}
                    animationStyle={animationData.style || {}}
                    item={customItem}
                    {transition}
                    {ratio}
                    {outputId}
                    ref={{ showId: customOut?.id, slideId: customSlide?.id, id: customSlide?.id || "", layoutId: customOut?.layout }}
                    linesStart={customLines?.[currentLineId || ""]?.[item.lineReveal ? "linesStart" : "start"]}
                    linesEnd={customLines?.[currentLineId || ""]?.[item.lineReveal ? "linesEnd" : "end"]}
                    clickRevealed={!!customLines?.[currentLineId || ""]?.clickRevealed}
                    outputStyle={current.currentStyle}
                    {mirror}
                    {preview}
                    slideIndex={customOut?.index}
                    {styleIdOverride}
                    autoSizeKey={createAutoSizeKey(item, index)}
                />
            </SlideItemTransition>
        {/if}
    {/each}
{/key}

{#if precomputeTargets.length}
    <div class="autosize-precompute" aria-hidden="true">
        {#each precomputeTargets as target (target.key)}
            <Textbox item={target.item} {ratio} {outputId} outputStyle={currentStyle} {mirror} {preview} {styleIdOverride} ref={{ showId: outSlide?.id, slideId: currentSlide?.id, id: currentSlide?.id || "", layoutId: outSlide?.layout }} autoSizeKey={target.key} on:autosizeReady={handlePrecomputeReady} />
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
