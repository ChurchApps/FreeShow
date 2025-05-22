<script lang="ts">
    import type { StageLayout } from "../../../types/Stage"
    import { activeTimers, allOutputs, outputs, playingAudio, playingAudioPaths, stageShows, variables, videosTime } from "../../stores"
    import { getSortedStageItems, shouldItemBeShown } from "../edit/scripts/itemHelpers"
    import { clone } from "../helpers/array"
    import { getStageOutputId, getStageResolution } from "../helpers/output"
    import HiddenInput from "../inputs/HiddenInput.svelte"
    import Zoomed from "../slide/Zoomed.svelte"
    import SelectElem from "../system/SelectElem.svelte"
    import { getSlideTextItems, stageItemToItem } from "./stage"
    import Stagebox from "./Stagebox.svelte"

    export let layout: StageLayout
    export let id: string
    export let columns = 1
    export let active = false
    export let list = false

    let ratio = 1
    $: stageOutputId = getStageOutputId($outputs)
    $: resolution = getStageResolution(stageOutputId, $outputs)

    function edit(e: any) {
        let name = e.detail.value
        stageShows.update((a) => {
            a[id].name = name
            return a
        })
    }

    $: stageItems = getSortedStageItems(id, $stageShows)

    $: videoTime = $videosTime[stageOutputId] || 0
</script>

<!-- WIP duplicate of StageLayout.svelte (pretty much) -->
<div class="main" class:active style="width: {100 / columns}%" class:list>
    <div class="slide context #stage_slide" class:disabled={layout.disabled} style={layout.settings.color ? `background-color: ${layout.settings.color};` : ""} tabindex={0} on:click>
        <div style="width: 100%;">
            <SelectElem id="stage" data={{ id }}>
                <Zoomed background={layout.items.length ? "black" : "transparent"} style="width: 100%;" {resolution} id={stageOutputId} isStage disableStyle center bind:ratio>
                    {#each stageItems as item}
                        {#if (item.type || item.enabled !== false) && shouldItemBeShown(stageItemToItem(item), item.type === "slide_text" ? getSlideTextItems(layout, item, $outputs || $allOutputs) : [], { type: "stage" }, { $activeTimers, $variables, $playingAudio, $playingAudioPaths, videoTime })}
                            <Stagebox id={item.id} item={clone(item)} {ratio} stageLayout={layout} />
                        {/if}
                    {/each}
                </Zoomed>
                <div class="label" title={layout.name}>
                    <!-- no need to display index number -->
                    <!-- <span style="position: absolute;display: contents;">{index + 1}</span> -->
                    <span class="text">
                        <!-- {#if show.name}
              {show.name}
            {:else}
              <span style="opacity: 0.5;"><T id="main.unnamed" /></span>
            {/if} -->
                        <HiddenInput value={layout.name} id={"stage_" + id} on:edit={edit} allowEmpty={false} />
                    </span>
                </div>
            </SelectElem>
        </div>
    </div>
</div>

<style>
    .main {
        display: flex;
        position: relative;
        padding: 2px;
    }
    .main.list {
        width: 100%;
    }
    .main.active {
        outline: 2px solid var(--secondary-opacity);
        outline-offset: -1px;
        z-index: 2;
    }

    .slide {
        background-color: #000000;
        z-index: 0;
        outline-offset: 0;
        width: 100%;

        position: relative;
        display: flex;
    }
    .slide.disabled {
        opacity: 0.2;
    }

    .slide :global(.isSelected) {
        outline-offset: -2px;
    }

    .label {
        background-color: var(--primary-darkest);

        display: flex;
        padding: 0 5px;
        /* padding-bottom: 2px; */
        font-size: 0.8em;
        font-weight: bold;
        align-items: center;
        /* opacity: 0.8; */
    }

    .label .text {
        width: 100%;
        margin: 0 15px;
        text-align: center;
        overflow-x: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .text :global(p) {
        margin: 4px;
        text-align: center;
    }
</style>
