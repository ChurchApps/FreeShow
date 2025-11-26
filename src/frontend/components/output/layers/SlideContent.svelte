<script lang="ts">
    import { onDestroy, onMount } from "svelte"
    import type { Item, OutSlide, SlideData } from "../../../../types/Show"
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
    let carryOverItems: { item: Item; state: { outSlide: any; slideData: any; currentSlide: any; lines: any; currentStyle: any } }[] = []
    let lastRenderedItems: Item[] = []
    let persistentHold = false
    let carryOverReleaseTimeout: NodeJS.Timeout | null = null
    let show = false
    // maintain a hidden workload that primes autosize results ahead of the visible reveal
    let precomputeTargets: { item: Item; index: number; key: string }[] = []
    let precomputePending = new Set<string>()

    const showItemRef = { outputId, slideIndex: outSlide?.index }
    // $: videoTime = $videosTime[outputId] || 0 // WIP only update if the items text has a video dynamic value
    // $: if ($activeTimers || $variables || $playingAudio || $playingAudioPaths || videoTime) updateValues()
    let updater = 0
    const updaterInterval = setInterval(() => {
        if (isClearing) return
        if (currentItems.find((a) => a.conditions)) updater++
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
            current = {
                outSlide: clone(outSlide),
                slideData: clone(slideData),
                currentSlide: clone(currentSlide),
                lines: clone(lines),
                currentStyle: clone(currentStyle)
            }
            lastRenderedItems = []
            clearCarryOverItems(true)
            if (show) {
                show = false
                if (import.meta.env?.DEV) console.debug("[SlideContent] forced hide due to empty slide")
            }
            return
        }

        cancelPendingBlank()
        scheduleAutoSizePrecompute(currentSlide.items)

        const previousItemsSnapshot = lastRenderedItems.length ? lastRenderedItems : currentItems
        const previousSignatures = buildSignatureMap(previousItemsSnapshot)
        const nextSignatures = buildSignatureMap(currentSlide.items)
        const nextItemsById = buildItemIdMap(currentSlide.items)
        let fallbackTransition: any = null
        const previousCount = previousItemsSnapshot.length
        const nextCount = currentSlide.items.length

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
        const hasActiveItemTransition = itemsHaveVisibleTransition(currentItems) || itemsHaveVisibleTransition(currentSlide.items)
        const hasVisualGlobalTransition = transitionEnabled && transitionHasVisibleEffect(transition)
        const allowPersistentCarryOver = !hasVisualGlobalTransition
        if (allowPersistentCarryOver && transitionEnabled) fallbackTransition = transition

        const outgoingTransitionDuration = Math.max(currentTransitionDuration, getMaxItemTransitionDuration(previousItemsSnapshot))
        // reveal the next slide midway through the outgoing fade so text does not feel delayed
        const waitToShow = outgoingTransitionDuration > 0 ? Math.max(100, Math.round(outgoingTransitionDuration / 2)) : 0

        const hasContentOnBothSlides = previousCount > 0 && nextCount > 0
        const shouldBlank = hasContentOnBothSlides
        transitioningBetween = hasContentOnBothSlides

        if (import.meta.env?.DEV) {
            console.debug("[SlideContent] transition snapshot", {
                transitionEnabled,
                transition: sanitizeTransitionDebug(transition),
                currentTransition: sanitizeTransitionDebug(currentTransition),
                hasVisualGlobalTransition,
                hasActiveItemTransition
            })
            console.debug("[SlideContent] update", {
                previousCount,
                nextCount,
                hasContentOnBothSlides,
                shouldBlank,
                allowPersistentCarryOver,
                fallbackTransition: sanitizeTransitionDebug(fallbackTransition),
                hasVisualGlobalTransition,
                showState: show,
                transitionEnabled,
                globalTransitionType: currentTransition?.type || "unknown",
                itemTransitionDuration,
                currentTransitionDuration,
                outgoingTransitionDuration
            })
        }

        // cache any textboxes whose content did not change so they can stay visible during the blank
        if (shouldBlank && allowPersistentCarryOver) {
            const nextSignatureCounts = buildPersistableSignatureCounts(currentSlide.items, fallbackTransition)
            const persistent = findPersistentItems(
                previousItemsSnapshot,
                previousSignatures,
                nextSignatures,
                nextSignatureCounts,
                nextItemsById,
                fallbackTransition
            )
            if (import.meta.env?.DEV) console.debug("[SlideContent] persistent items", persistent.map((item) => item.id || getItemSignature(item)))
            carryOverItems = persistent.map((item) => ({
                item: clone(item),
                state: {
                    outSlide: clone(current.outSlide || outSlide),
                    slideData: clone(current.slideData || slideData),
                    currentSlide: clone(current.currentSlide || currentSlide),
                    lines: clone(current.lines || lines),
                    currentStyle: clone(current.currentStyle || currentStyle)
                }
            }))
            persistentHold = carryOverItems.length > 0
        } else {
            clearCarryOverItems(true)
            persistentHold = false
        }

        if (timeout) clearTimeout(timeout)

        if (!shouldBlank) {
            applyCurrentSlideState()
            show = true
            if (import.meta.env?.DEV) console.debug("[SlideContent] show true without blank")
            clearCarryOverItems(true)
            return
        }

        // wait for between to update out transition
        timeout = setTimeout(() => {
            show = false
            if (import.meta.env?.DEV) console.debug("[SlideContent] show false starting blank")

            // wait for previous items to start fading out (svelte will keep them until the transition is done!)
            timeout = setTimeout(() => {
                applyCurrentSlideState()
                transitioningBetween = false
                // wait until half transition duration of previous items have passed as it looks better visually
                timeout = setTimeout(() => {
                    show = true
                    if (import.meta.env?.DEV) console.debug("[SlideContent] show true after blank")
                    scheduleCarryOverRelease(outgoingTransitionDuration)
                }, waitToShow)
            })
        })
    }

    function applyCurrentSlideState() {
        currentItems = clone(currentSlide?.items || [])
        current = {
            outSlide: clone(outSlide),
            slideData: clone(slideData),
            currentSlide: clone(currentSlide),
            lines: clone(lines),
            currentStyle: clone(currentStyle)
        }
        lastRenderedItems = clone(currentItems)
    }

    function buildSignatureMap(items: Item[] = []) {
        const map = new Map<string, string>()
        items.forEach((item) => {
            if (!item?.id) return
            const signature = getItemSignature(item)
            map.set(item.id, signature)
        })
        return map
    }

    function buildSignatureCounts(items: Item[] = []) {
        const counts = new Map<string, number>()
        items.forEach((item, index) => {
            const signature = getItemSignature(item)
            if (!signature) return
            const previousCount = counts.get(signature) || 0
            counts.set(signature, previousCount + 1)
        })
        return counts
    }

    function buildPersistableSignatureCounts(items: Item[] = [], fallbackTransition?: any) {
        const counts = new Map<string, number>()
        items.forEach((item) => {
            if (!canItemPersist(item, fallbackTransition)) return
            const signature = getItemSignature(item)
            if (!signature) return
            counts.set(signature, (counts.get(signature) || 0) + 1)
        })
        return counts
    }

    function isStickyMetadata(item: Item) {
        if (!item?.lines?.length) return false
        return JSON.stringify(item.lines).includes("{meta_")
    }

    function buildItemIdMap(items: Item[] = []) {
        const map = new Map<string, Item>()
        items.forEach((item) => {
            if (!item?.id) return
            map.set(item.id, item)
        })
        return map
    }

    function getItemSignature(item: Item) {
        if (!item) return ""
        const safeLines = (item.lines || []).map((line) => ({
            text: (line.text || []).map((part) => ({ value: part.value ?? part.text ?? "" }))
        }))
        return JSON.stringify({ lines: safeLines, list: item.list, text: (item as any).text || "", variable: item.variable || null })
    }

    function itemsHaveVisibleTransition(items: Item[] = []) {
        if (!items?.length) return false
        return items.some((item) => transitionHasVisibleEffect(item?.actions?.transition))
    }

    function getMaxItemTransitionDuration(items: Item[] = []) {
        if (!items?.length) return 0
        return items.reduce((max, item) => {
            const duration = getTransitionDuration(item?.actions?.transition)
            return Math.max(max, duration)
        }, 0)
    }

    function getTransitionDuration(transitionData: any) {
        if (!transitionData) return 0
        const parts = [transitionData.out, transitionData.between, transitionData.in, transitionData]
        return parts.reduce((max, part) => Math.max(max, getTransitionPartDuration(part)), 0)
    }

    function getTransitionPartDuration(part: any) {
        if (!part) return 0
        const type = typeof part.type === "string" ? part.type.toLowerCase() : ""
        const duration = toNumericDuration(part.duration)
        if (type === "none" && duration <= 0) return 0
        if (!type && duration <= 0) return 0
        return Math.max(duration, 0)
    }

    function canItemPersist(item: Item, fallbackTransition?: any) {
        if (!item) return false
        const itemTransition = item?.actions?.transition
        const effectiveTransition = itemTransition ?? fallbackTransition
        if (transitionHasVisibleEffect(effectiveTransition)) return false
        return true
    }

    function toNumericDuration(value: any) {
        if (typeof value === "number" && Number.isFinite(value)) return value
        if (typeof value === "string") {
            const parsed = parseFloat(value)
            if (Number.isFinite(parsed)) return parsed
        }
        return 0
    }

    function sanitizeTransitionDebug(value: any) {
        if (!value) return value
        const cloneValue = typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value))
        const normalize = (part: any) => {
            if (!part) return part
            const duration = toNumericDuration(part.duration)
            return { type: part.type || "", duration }
        }
        return {
            between: normalize(cloneValue.between || cloneValue),
            in: normalize(cloneValue.in || cloneValue),
            out: normalize(cloneValue.out || cloneValue),
            type: cloneValue.type || "",
            duration: toNumericDuration(cloneValue.duration)
        }
    }

    function transitionHasVisibleEffect(transitionData: any) {
        if (!transitionData) return false
        const parts = [transitionData.between, transitionData.in, transitionData.out, transitionData]
        return parts.some((part) => isTransitionPartVisible(part))
    }

    function isTransitionPartVisible(part: any) {
        if (!part) return false
        const duration = toNumericDuration(part.duration)
        const type = typeof part.type === "string" ? part.type.toLowerCase() : ""
        if (type === "none") return false
        if (!type && duration <= 0) return false
        return duration > 0 || !!type
    }

    function findPersistentItems(
        previousItems: Item[],
        previousSignatures: Map<string, string>,
        nextSignatures: Map<string, string>,
        nextSignatureCounts: Map<string, number>,
        nextItemsById: Map<string, Item>,
        fallbackTransition?: any
    ) {
        if (!previousItems?.length) return []
        const availableSignatureCounts = new Map(nextSignatureCounts)
        return previousItems.filter((prev) => {
            if (!canItemPersist(prev, fallbackTransition)) {
                if (import.meta.env?.DEV) console.debug("[SlideContent] skip persist (prev transition)", prev.id, prev.actions?.transition)
                return false
            }
            const prevId = prev?.id
            const prevSignature = prevId ? previousSignatures.get(prevId) : getItemSignature(prev)
            if (!prevSignature) return false

            if (prevId) {
                const nextItem = nextItemsById.get(prevId)
                if (!nextItem) return false
                if (!canItemPersist(nextItem, fallbackTransition)) {
                    if (import.meta.env?.DEV)
                        console.debug("[SlideContent] skip persist (next transition)", prevId, nextItem.actions?.transition)
                    return false
                }
                const nextSignature = nextSignatures.get(prevId)
                if (nextSignature && nextSignature === prevSignature) return true
            }

            const remaining = availableSignatureCounts.get(prevSignature) || 0
            if (!remaining) {
                if (isStickyMetadata(prev)) return true
                return false
            }
            availableSignatureCounts.set(prevSignature, remaining - 1)
            return true
        })
    }

    function scheduleCarryOverRelease(duration: number) {
        if (!persistentHold || !carryOverItems.length) {
            clearCarryOverItems(true)
            return
        }

        const delay = Math.max(100, duration || 0)
        if (carryOverReleaseTimeout) clearTimeout(carryOverReleaseTimeout)
        carryOverReleaseTimeout = setTimeout(() => {
            persistentHold = false
            clearCarryOverItems(true)
        }, delay)
    }

    function clearCarryOverItems(force = false) {
        if (!force && persistentHold) return
        if (carryOverReleaseTimeout) {
            clearTimeout(carryOverReleaseTimeout)
            carryOverReleaseTimeout = null
        }
        carryOverItems = []
        persistentHold = false
    }

    function cancelPendingBlank() {
        if (timeout) {
            clearTimeout(timeout)
            timeout = null
        }
        transitioningBetween = false
        show = true
    }
</script>

<!-- Updating this with another "store" causes svelte transition bug! -->
{#key show}
    {#each currentItems as item, index}
        {#if show && shouldItemBeShown(item, currentItems, showItemRef, updater) && (!item.clickReveal || current.outSlide?.itemClickReveal)}
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

{#if carryOverItems.length && (!show || persistentHold)}
    {#each carryOverItems as carry, index}
        {#if shouldItemBeShown(carry.item, carryOverItems.map((a) => a.item), showItemRef, updater)}
            <SlideItemTransition
                {preview}
                transitionEnabled={false}
                transitioningBetween={false}
                globalTransition={transition}
                currentSlide={carry.state.currentSlide}
                item={carry.item}
                outSlide={carry.state.outSlide}
                lines={carry.state.lines}
                currentStyle={carry.state.currentStyle}
                let:customSlide
                let:customItem
                let:customLines
                let:customOut
                let:transition
            >
                <Textbox
                    backdropFilter={carry.state.slideData?.["backdrop-filter"] || ""}
                    disableListTransition={mirror}
                    chords={customItem.chords?.enabled}
                    animationStyle={animationData.style || {}}
                    item={customItem}
                    {transition}
                    {ratio}
                    {outputId}
                    ref={{ showId: customOut?.id, slideId: customSlide?.id, id: customSlide?.id || "", layoutId: customOut?.layout }}
                    linesStart={customLines?.[currentLineId || ""]?.[carry.item.lineReveal ? "linesStart" : "start"]}
                    linesEnd={customLines?.[currentLineId || ""]?.[carry.item.lineReveal ? "linesEnd" : "end"]}
                    clickRevealed={!!customLines?.[currentLineId || ""]?.clickRevealed}
                    outputStyle={carry.state.currentStyle}
                    {mirror}
                    {preview}
                    slideIndex={customOut?.index}
                    {styleIdOverride}
                    autoSizeKey={`carry-${createAutoSizeKey(carry.item, index)}`}
                />
            </SlideItemTransition>
        {/if}
    {/each}
{/if}

{#if precomputeTargets.length}
    <div class="autosize-precompute" aria-hidden="true">
        {#each precomputeTargets as target (target.key)}
            <Textbox
                item={target.item}
                {ratio}
                {outputId}
                outputStyle={currentStyle}
                {mirror}
                {preview}
                {styleIdOverride}
                ref={{ showId: outSlide?.id, slideId: currentSlide?.id, id: currentSlide?.id || "", layoutId: outSlide?.layout }}
                autoSizeKey={target.key}
                on:autosizeReady={handlePrecomputeReady}
            />
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
