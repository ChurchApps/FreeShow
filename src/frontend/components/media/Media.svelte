<script lang="ts">
    import type { MediaFit } from "../../../types/Main"
    import type { Transition } from "../../../types/Show"
    import { activeEdit, activeShow, media } from "../../stores"
    import { custom } from "../../utils/transitions"
    import { getExtension, getMediaType } from "../helpers/media"
    import Image from "./Image.svelte"
    import MediaControls from "./MediaControls.svelte"
    import Video from "./Video.svelte"

    export let path: string
    export let controls: boolean = false
    export let transition: Transition = { type: "none", duration: 0, easing: "linear" }

    export let filter: string = ""
    export let flipped: boolean = false
    export let fit: MediaFit = "contain"

    export let video: any = null
    export let videoData: any = { paused: false, muted: true, duration: 0, loop: false }
    export let videoTime: number = 0
    export let startAt: number = 0
    export let mirror: boolean = false

    // get styling
    $: mediaId = $activeEdit.id || $activeShow?.id
    $: if (mediaId && $media[mediaId]) {
        // TODO: get local show styles?!
        filter = $media[mediaId]?.filter || ""
        flipped = $media[mediaId]?.flipped || false
        fit = $media[mediaId]?.fit || "contain"
    }

    $: extension = getExtension(path)
    $: type = getMediaType(extension)
</script>

{#if type === "video"}
    <!-- svelte transition bug, this is to remove media when changing from "draw" view -->
    {#if transition.type === "none"}
        <div style="height: 100%;">
            <Video {path} bind:video bind:videoData bind:videoTime {startAt} {mirror} {filter} {flipped} {fit} on:playing on:loaded />
        </div>
    {:else}
        <div style="height: 100%;" transition:custom={transition}>
            <Video {path} bind:video bind:videoData bind:videoTime {startAt} {mirror} {filter} {flipped} {fit} on:playing on:loaded />
        </div>
    {/if}
    {#if controls}
        <MediaControls bind:videoData bind:videoTime />
    {/if}
{:else}
    {#key path}
        <!-- svelte transition bug, this is to remove media when changing from "draw" view -->
        {#if transition.type === "none"}
            <div style="height: 100%;">
                <Image {path} {filter} {flipped} {fit} />
            </div>
        {:else}
            <div style="height: 100%;" transition:custom={transition}>
                <Image {path} {filter} {flipped} {fit} />
            </div>
        {/if}
    {/key}
{/if}
