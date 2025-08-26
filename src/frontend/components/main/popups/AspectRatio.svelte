<script lang="ts">
    import { activePopup, popupData } from "../../../stores"
    import { triggerClickOnEnterSpace } from "../../../utils/clickable"
    import { translateText } from "../../../utils/language"
    import HRule from "../../input/HRule.svelte"
    import InputRow from "../../input/InputRow.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialDropdown from "../../inputs/MaterialDropdown.svelte"
    import MaterialNumberInput from "../../inputs/MaterialNumberInput.svelte"
    import MaterialToggleSwitch from "../../inputs/MaterialToggleSwitch.svelte"

    // https://blog.depositphotos.com/common-aspect-ratios.html
    const ratios = [
        // television
        [16, 9],
        [4, 3],
        // widescreen
        [21, 9],
        // square
        [1, 1],
        // photography
        [3, 2],
        // cinematography
        [1.85, 1],
        [2.39, 1]
        // vertical
        // [9, 16],
    ]

    let active = $popupData.active || { width: 16, height: 9 }

    const alignOptions = [
        { value: "center", label: translateText("edit.align_center") },
        { value: "start", label: translateText("edit.align_start") },
        { value: "end", label: translateText("edit.align_end") }
    ]

    function setAspectRatio(value: any) {
        if ($popupData.trigger) {
            $popupData.trigger(value)
        }

        let previousActive = JSON.stringify(active)
        active = value
        if (previousActive !== JSON.stringify(value)) return
        // if (value.width === 1 || value.height === 1 || value.width === 100 || value.height === 100) return

        popupData.set({})
        activePopup.set(null)
    }

    // get any output that uses this style and preview ratio based on its resolution ??
    // $: outputResolution =

    let showMore = false
</script>

<MaterialButton class="popup-options {showMore ? 'active' : ''}" icon="options" iconSize={1.3} title={showMore ? "actions.close" : "create_show.more_options"} on:click={() => (showMore = !showMore)} white />

<div class="grid">
    {#each ratios as [width, height]}
        {@const isActive = !active.outputResolutionAsRatio && active.width === width && active.height === height}
        <MaterialButton disabled={active.outputResolutionAsRatio} showOutline={isActive} {isActive} on:click={() => setAspectRatio({ ...active, width, height })}>
            <div class="box" style="padding: 0;aspect-ratio: {width}/{height};">
                <p>{width}:{height}</p>
            </div>
        </MaterialButton>
    {/each}
</div>

{#if showMore || (!active.outputResolutionAsRatio && !ratios.find(([width, height]) => active.width === width && active.height === height))}
    <div style="display: flex;justify-content: space-between;margin-bottom: 10px;">
        <div style="width: 200px;" data-title={translateText("actions.custom_key")}>
            <InputRow>
                <MaterialNumberInput disabled={active.outputResolutionAsRatio} label="screen.width" value={active.width || 16} min={1} max={100} on:change={(e) => setAspectRatio({ width: e.detail, height: active.height || 9 })} />
                <MaterialNumberInput disabled={active.outputResolutionAsRatio} label="screen.height" value={active.height || 9} min={1} max={100} on:change={(e) => setAspectRatio({ height: e.detail, width: active.width || 16 })} />
            </InputRow>
        </div>

        {#if !active.outputResolutionAsRatio && !ratios.find(([width, height]) => active.width === width && active.height === height)}
            <div class="preview">
                <div class="box" role="button" tabindex="0" style="padding: 0;aspect-ratio: {active.width}/{active.height};" on:click={() => activePopup.set(null)} on:keydown={triggerClickOnEnterSpace}>
                    <p>{active.width}:{active.height}</p>
                </div>
            </div>
        {/if}

        <MaterialDropdown
            style="width: 200px;"
            label="edit.position"
            disabled={active.outputResolutionAsRatio}
            options={alignOptions}
            value={active.alignPosition || "center"}
            on:change={(e) => setAspectRatio({ ...active, alignPosition: e.detail })}
        />
    </div>
{/if}

<MaterialToggleSwitch label="settings.output_resolution_ratio" checked={active.outputResolutionAsRatio} defaultValue={false} on:change={(e) => setAspectRatio({ ...active, outputResolutionAsRatio: e.detail })} />

{#if showMore}
    <HRule />

    <MaterialNumberInput label="settings.font_size_ratio" value={active.fontSizeRatio ?? 100} min={10} max={500} step={10} on:change={(e) => setAspectRatio({ ...active, fontSizeRatio: e.detail })} />
{/if}

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
        padding: 15px 0;
    }

    .grid :global(button) {
        padding: 0.4em;
        flex-direction: column;
        gap: 5px;
        justify-content: center;
    }
    .grid :global(button.isActive) {
        background-color: var(--primary-darker) !important;
    }

    .box {
        width: 100px;
        /* max-height: 500px; */
        background-color: black;
        border-radius: 3px;
    }

    .box p,
    .preview p {
        position: absolute;
        inset-inline-start: 50%;
        top: 50%;
        transform: translate(-50%, -50%);

        font-weight: bold;
    }

    .inputs {
        display: flex;
    }

    .preview {
        position: relative;
        flex: 1;

        display: flex;
        justify-content: center;
        /* padding: 0.6em; */
    }

    .preview .box {
        /* always active */
        outline-offset: -2px;
        outline: 2px solid var(--secondary);
    }
</style>
