<script lang="ts">
    import { activePopup, dictionary, popupData } from "../../../stores"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"
    import Checkbox from "../../inputs/Checkbox.svelte"
    import CombinedInput from "../../inputs/CombinedInput.svelte"
    import Dropdown from "../../inputs/Dropdown.svelte"
    import NumberInput from "../../inputs/NumberInput.svelte"

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
        [2.39, 1],
        // vertical
        // [9, 16],
    ]

    let active = $popupData.active || { width: 16, height: 9 }

    const alignOptions = [
        { id: "center", name: "$:edit.align_center:$" },
        { id: "start", name: "$:edit.align_start:$" },
        { id: "end", name: "$:edit.align_end:$" },
    ]

    const isChecked = (e: any) => e.target.checked

    function setAspectRatio(value: any) {
        if ($popupData.action !== "style_ratio") return
        // if (!value.width || !value.height) return

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
</script>

<div class="grid">
    {#each ratios as [width, height]}
        {@const isActive = !active.outputResolutionAsRatio && active.width === width && active.height === height}
        <Button disabled={active.outputResolutionAsRatio} outline={isActive} active={isActive} on:click={() => setAspectRatio({ ...active, width, height })} bold={false}>
            <!-- tallest ratio for all to get center align -->
            <!-- <div style="aspect-ratio: 1/1;padding: 0;display: flex;align-items: center;"> -->
            <div class="box" style="padding: 0;aspect-ratio: {width}/{height};">
                <p>{width}:{height}</p>
            </div>
            <!-- </div> -->
        </Button>
    {/each}
</div>

<CombinedInput>
    <p><T id="settings.output_resolution_ratio" /></p>
    <div class="alignRight">
        <Checkbox checked={active.outputResolutionAsRatio === true} on:change={(e) => setAspectRatio({ ...active, outputResolutionAsRatio: isChecked(e) })} />
    </div>
</CombinedInput>
<CombinedInput>
    <p><T id="edit.position" /></p>
    <Dropdown disabled={active.outputResolutionAsRatio} options={alignOptions} value={alignOptions.find((a) => a.id === (active.alignPosition || "center"))?.name || ""} on:click={(e) => setAspectRatio({ ...active, alignPosition: e.detail.id })} />
</CombinedInput>
<CombinedInput>
    <p><T id="actions.custom_key" /></p>
    <div class="inputs">
        <NumberInput
            style="flex: 1;"
            disabled={active.outputResolutionAsRatio}
            title={$dictionary.screen?.width}
            value={active.width || 1920}
            min={1}
            max={100}
            decimals={2}
            fixed={2}
            buttons={false}
            on:change={(e) => setAspectRatio({ width: Number(e.detail), height: active.height || 9 })}
        />
        <NumberInput
            style="flex: 1;"
            disabled={active.outputResolutionAsRatio}
            title={$dictionary.screen?.height}
            value={active.height || 1080}
            min={1}
            max={100}
            decimals={2}
            fixed={2}
            buttons={false}
            on:change={(e) => setAspectRatio({ height: Number(e.detail), width: active.width || 16 })}
        />
    </div>
</CombinedInput>

{#if !active.outputResolutionAsRatio && !ratios.find(([width, height]) => active.width === width && active.height === height)}
    <div class="preview">
        <div class="box" role="button" tabindex="0" style="padding: 0;aspect-ratio: {active.width}/{active.height};" on:click={() => activePopup.set(null)} on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activePopup.set(null); } }}>
            <p>{active.width}:{active.height}</p>
        </div>
    </div>
{/if}

<CombinedInput>
    <p><T id="settings.font_size_ratio" /></p>
    <div class="inputs">
        <NumberInput style="flex: 1;" value={active.fontSizeRatio ?? 100} min={10} max={500} step={10} buttons={false} on:change={(e) => setAspectRatio({ ...active, fontSizeRatio: Number(e.detail) })} />
    </div>
</CombinedInput>

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

    .box {
        width: 100px;
        /* max-height: 500px; */
        background-color: black;
        border-radius: 2px;
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
        width: 100%;
        margin-top: 10px;

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
