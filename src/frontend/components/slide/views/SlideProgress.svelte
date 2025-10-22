<script lang="ts">
    import { allOutputs, dictionary, groups, outputs, showsCache } from "../../../stores"
    import { getActiveOutputs } from "../../helpers/output"
    import { getGroupName, getLayoutRef } from "../../helpers/show"
    import { _show } from "../../helpers/shows"

    export let tracker: any
    export let outputId = ""
    export let item: any = {}
    export let autoSize = 0

    let type: "number" | "bar" | "group" = "number"
    $: type = tracker.type || "number"
    $: accent = tracker.accent

    $: if (!outputId) outputId = getActiveOutputs()[0]
    $: currentOutput = $outputs[outputId] || $allOutputs[outputId] || {}
    $: currentSlideOut = currentOutput?.out?.slide || null
    $: currentShowId = currentSlideOut?.id || ""
    $: currentShowSlide = currentSlideOut?.index ?? -1
    $: currentLayoutRef = getLayoutRef(currentShowId, $showsCache)
    $: currentShowSlides = _show(currentShowId).get("slides") || {}
    $: slidesLength = currentLayoutRef.length || 0

    // get custom group names
    $: layoutGroups = currentLayoutRef.map((a) => {
        let ref = a.parent || a
        let slide = currentShowSlides[ref.id]
        if (!slide) return { name: "—" }

        if (a.data.disabled || slide.group?.startsWith("~")) return { hide: true }

        let group = slide.group || "—"
        if (slide.globalGroup && $groups[slide.globalGroup]) {
            group = $groups[slide.globalGroup].default ? $dictionary.groups?.[$groups[slide.globalGroup].name] : $groups[slide.globalGroup].name
        }

        if (typeof group !== "string") group = ""
        if (tracker.oneLetter) group = group[0].toUpperCase()
        let name = getGroupName({ show: _show(currentShowId).get(), showId: currentShowId }, ref.id, group, ref.layoutIndex)?.replace(/ *\([^)]*\) */g, "")
        if (tracker.oneLetter) name = name?.replace(" ", "")
        return { name: name || "—", index: ref.layoutIndex, child: a.type === "child" ? (currentLayoutRef[ref.layoutIndex]?.children || []).findIndex((id) => id === a.id) + 1 : 0 }
    })

    let progressElem: HTMLElement | undefined
    $: column = (progressElem?.offsetWidth || 0) < (progressElem?.offsetHeight || 0)
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
                        {group.name}{#if tracker.childProgress && (activeGroup?.child || nextSlide?.child)}<span style="opacity: 0.8;font-size: 0.7em;">.{(activeGroup?.child ?? -1) + 1}</span>{/if}
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
