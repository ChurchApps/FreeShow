<script lang="ts">
    import BmdStream from "../../drawer/live/BMDStream.svelte"
    import NdiStream from "../../drawer/live/NDIStream.svelte"
    import OmtStream from "../../drawer/live/OMTStream.svelte"
    import Camera from "../Camera.svelte"
    import Window from "../Window.svelte"

    export let media: any = null
    export let preview = false
</script>

{#if media}
    <div class="layer media-layer {$$props.class || ''}" style={$$props.style || ""}>
        {#if media.type === "camera"}
            <Camera id={media.id} groupId={media.group || ""} class="media" style="width: 100%;height: 100%;object-fit: cover;" {preview} />
        {:else if media.type === "screen"}
            <Window id={media.id} class="media" style="width: 100%;height: 100%;object-fit: cover;" />
        {:else if media.type === "ndi"}
            <NdiStream screen={{ id: media.id, name: media.name || "" }} background mirror={preview} />
        {:else if media.type === "omt"}
            <OmtStream screen={{ id: media.id, name: media.name || "" }} background mirror={preview} />
        {:else if media.type === "blackmagic"}
            <BmdStream screen={{ id: media.id, name: media.name || "" }} background mirror={preview} />
        {/if}
    </div>
{/if}

<style>
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
</style>
