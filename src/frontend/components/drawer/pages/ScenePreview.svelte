<script lang="ts">
    import type { Scene } from "../../../../types/Show"
    import { outputs, overlays } from "../../../stores"
    import { keysToID } from "../../helpers/array"
    import Output from "../../output/Output.svelte"
    import SceneMedia from "../../output/layers/SceneMedia.svelte"
    import Textbox from "../../slide/Textbox.svelte"

    export let scene: Scene
    export let miniPreview = false

    $: content = scene?.content || {}
    $: mediaInput = content.media || null

    $: enabledOutputs = keysToID($outputs).filter((a) => a.enabled && !a.stageOutput)
    $: filteredOutputs = scene?.bindings?.length ? enabledOutputs.filter((a) => scene.bindings!.includes(a.id)) : enabledOutputs
    $: firstOutputId = filteredOutputs[0]?.id || enabledOutputs[0]?.id || Object.keys($outputs)[0] || ""

    $: styleId = content.style || ""

    $: outputData = $outputs[firstOutputId]?.out
    $: outOverride = outputData?.slide ? outputData : null

    $: overlayList = (content.overlays || []).map((id) => ({ id, ...$overlays[id] })).filter((o) => o && Array.isArray(o.items))
</script>

<div class="scene-preview" style="background-color: #000000;">
    <!-- Output style preview layer -->
    {#if styleId && firstOutputId}
        <div class="layer output-layer">
            {#key styleId + "_" + firstOutputId}
                <Output outputId={firstOutputId} style="width: 100%; height: 100%;" styleIdOverride={styleId} outOverride={{ ...(outOverride || {}), scene: mediaInput ? { media: mediaInput } : null }} mirror={true} />
            {/key}
        </div>
    {:else if mediaInput}
        <!-- Media input layer without output style -->
        <SceneMedia media={mediaInput} preview={miniPreview} />
    {/if}

    <!-- Overlays stack layer -->
    {#if overlayList.length}
        <div class="layer overlays-layer">
            {#each [...overlayList].reverse() as overlay (overlay.id)}
                {#each overlay.items as item}
                    <Textbox {item} ref={{ type: "overlay", id: overlay.id }} preview {miniPreview} mirror />
                {/each}
            {/each}
        </div>
    {/if}
</div>

<style>
    .scene-preview {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: flex;
        isolation: isolate;
    }

    .layer {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .output-layer {
        z-index: 2;
    }

    .overlays-layer {
        z-index: 3;
    }
</style>
