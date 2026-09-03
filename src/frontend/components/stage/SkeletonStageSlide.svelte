<script lang="ts">
    import type { StageLayout } from "../../../types/Stage"
    import { outputs } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import { getStageOutputId, getStageResolution } from "../helpers/output"
    import { translateText } from "../../utils/language"

    export let layout: StageLayout
    export let columns = 1
    export let active = false
    export let list = false

    $: stageOutputId = getStageOutputId($outputs)
    $: resolution = getStageResolution(stageOutputId, $outputs)
</script>

<div class="main" class:active style="width: {100 / columns}%" class:list role="none" on:click>
    <div class="slide" class:disabled={layout?.disabled} style={layout?.settings?.color ? `background-color: ${layout.settings.color};` : ""}>
        <div style="width: 100%;">
            <div class="preview" style="aspect-ratio: {resolution.width} / {resolution.height}; background-color: {layout?.items?.length ? 'black' : 'transparent'};" />
            <div class="label" style="position: relative;" data-title={layout?.name}>
                {#if layout?.password}
                    <span style="position: absolute;left: 5px;" data-title={translateText("remote.password")}>
                        <Icon id="locked" size={0.8} style="opacity: 0.5;" white />
                    </span>
                {/if}

                <span class="text">
                    <p>{layout?.name || "—"}</p>
                </span>
            </div>
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

    .preview {
        width: 100%;
    }

    .label {
        background-color: var(--primary-darkest);

        display: flex;
        padding: 0 5px;
        font-size: 0.8em;
        font-weight: bold;
        align-items: center;
    }

    .label .text {
        width: 100%;
        margin: 0 15px;
        text-align: center;
        overflow-x: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .text p {
        margin: 4px;
        text-align: center;
    }
</style>
