<script lang="ts">
    import type { MediaStyle } from "../../../../types/Main"
    import type { Styles } from "../../../../types/Settings"
    import type { OutBackground, Transition } from "../../../../types/Show"
    import { media, playerVideos, special } from "../../../stores"
    import BmdStream from "../../drawer/live/BMDStream.svelte"
    import NdiStream from "../../drawer/live/NDIStream.svelte"
    import { getMediaStyle } from "../../helpers/media"
    import Player from "../../system/Player.svelte"
    import Camera from "../Camera.svelte"
    import OutputTransition from "../transitions/OutputTransition.svelte"
    import Window from "../Window.svelte"
    import Media from "./Media.svelte"

    export let outputId = ""

    export let data: OutBackground
    export let transition: Transition
    export let fadingOut = false
    export let currentStyle: Styles | null = null
    export let animationStyle = ""
    export let mirror = false

    $: id = data.path || data.id || ""

    let type = "media"
    $: type = data.type || "media"
    $: if (type === "video" || type === "image") type = "media"

    let mediaStyle: MediaStyle = {}
    $: if (data && currentStyle) mediaStyle = getMediaStyle({ ...$media[id], ...data }, currentStyle)
</script>

<OutputTransition {transition} inTransition={transition.in} outTransition={transition.out} on:outrostart={() => (fadingOut = true)}>
    {#if type === "media"}
        <!-- on:ended={videoEnded} -->
        <Media {outputId} path={id} {data} {animationStyle} {mirror} {mediaStyle} on:loaded />
    {:else if type === "screen"}
        <Window {id} class="media" style="width: 100%;height: 100%;" on:loaded />
    {:else if type === "ndi"}
        {#key id}
            <NdiStream screen={{ id, name: "" }} background {mirror} />
        {/key}
    {:else if type === "blackmagic"}
        <BmdStream screen={{ id, name: "" }} background {mirror} />
    {:else if type === "camera"}
        <Camera {id} groupId={data.cameraGroup || ""} class="media" style="width: 100%;height: 100%;" on:loaded />
    {:else if type === "player"}
        <!-- prevent showing controls in output -->
        {#if $special.hideCursor || $playerVideos[id]?.type !== "youtube"}<div class="overlay" />{/if}
        <!-- on:ended={videoEnded} -->
        <Player {outputId} {id} on:loaded />
    {/if}
</OutputTransition>

<style>
    /* div :global(.media) {
        max-width: 100%;
        max-height: 100%;
    } */

    .overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: transparent;
        z-index: 1;
    }
</style>
