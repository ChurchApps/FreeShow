<script lang="ts">
    import type { Scene } from "../../../../types/Show"
    import { outputs, overlays } from "../../../stores"
    import { keysToID } from "../../helpers/array"
    import Camera from "../../output/Camera.svelte"
    import Output from "../../output/Output.svelte"
    import Window from "../../output/Window.svelte"
    import Textbox from "../../slide/Textbox.svelte"
    import BmdStream from "../live/BMDStream.svelte"
    import NdiStream from "../live/NDIStream.svelte"
    import OmtStream from "../live/OMTStream.svelte"

    export let scene: Scene
    export let mirror = false
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
                <Output outputId={firstOutputId} style="width: 100%; height: 100%;" styleIdOverride={styleId} {outOverride} mirror={true} preview={false}>
                    <svelte:fragment slot="scene_media">
                        {#if mediaInput}
                            <div class="layer media-layer">
                                {#if mediaInput.type === "camera"}
                                    <Camera id={mediaInput.id} groupId={mediaInput.group || ""} class="media" style="width: 100%;height: 100%;object-fit: cover;" preview={miniPreview} />
                                {:else if mediaInput.type === "screen"}
                                    <Window id={mediaInput.id} class="media" style="width: 100%;height: 100%;object-fit: cover;" />
                                {:else if mediaInput.type === "ndi"}
                                    <NdiStream screen={{ id: mediaInput.id, name: mediaInput.name || "" }} background {mirror} />
                                {:else if mediaInput.type === "omt"}
                                    <OmtStream screen={{ id: mediaInput.id, name: mediaInput.name || "" }} background {mirror} />
                                {:else if mediaInput.type === "blackmagic"}
                                    <BmdStream screen={{ id: mediaInput.id, name: mediaInput.name || "" }} background {mirror} />
                                {/if}
                            </div>
                        {/if}
                    </svelte:fragment>
                </Output>
            {/key}
        </div>
    {:else if mediaInput}
        <!-- Media input layer without output style -->
        <div class="layer media-layer">
            {#if mediaInput.type === "camera"}
                <Camera id={mediaInput.id} groupId={mediaInput.group || ""} class="media" style="width: 100%;height: 100%;object-fit: cover;" preview={miniPreview} />
            {:else if mediaInput.type === "screen"}
                <Window id={mediaInput.id} class="media" style="width: 100%;height: 100%;object-fit: cover;" />
            {:else if mediaInput.type === "ndi"}
                <NdiStream screen={{ id: mediaInput.id, name: mediaInput.name || "" }} background {mirror} />
            {:else if mediaInput.type === "omt"}
                <OmtStream screen={{ id: mediaInput.id, name: mediaInput.name || "" }} background {mirror} />
            {:else if mediaInput.type === "blackmagic"}
                <BmdStream screen={{ id: mediaInput.id, name: mediaInput.name || "" }} background {mirror} />
            {/if}
        </div>
    {/if}

    <!-- Overlays stack layer -->
    {#if overlayList.length}
        <div class="layer overlays-layer">
            {#each [...overlayList].reverse() as overlay (overlay.id)}
                {#each overlay.items as item}
                    <Textbox {item} ref={{ type: "overlay", id: overlay.id }} preview {miniPreview} {mirror} />
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

    .media-layer {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .scene-preview > .media-layer {
        z-index: 1;
    }

    .output-layer {
        z-index: 2;
    }

    .overlays-layer {
        z-index: 3;
    }
</style>
