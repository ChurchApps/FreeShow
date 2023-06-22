<script lang="ts">
    import { activeShow, dictionary, media, outLocked } from "../../stores"
    import Image from "../drawer/media/Image.svelte"
    import { createGlobalTimerFromLocalTimer } from "../drawer/timers/timers"
    import { setOutput } from "../helpers/output"
    import HoverButton from "../inputs/HoverButton.svelte"
    import Splash from "../main/Splash.svelte"
    import Layouts from "../slide/Layouts.svelte"
    import AudioPreview from "./AudioPreview.svelte"
    import Section from "./Section.svelte"
    import Slides from "./Slides.svelte"
    import VideoShow from "./VideoShow.svelte"

    $: show = $activeShow

    let filter = ""
    let flipped = false
    let fit = "contain"
    let speed = "1"

    $: if (show) {
        filter = $media[show.id]?.filter || ""
        flipped = $media[show.id]?.flipped || false
        fit = $media[show.id]?.fit || "contain"
        speed = $media[show.id]?.speed || "1"
    }

    // check for timer & create global
    $: if (show?.id) createGlobalTimerFromLocalTimer(show?.id)
</script>

<div class="main">
    {#if show}
        {#if show.type === "video" || show.type === "image" || show.type === "player"}
            <div style="display: flex;flex-direction: column;height: 100%;">
                {#if show.type === "video" || show.type === "player"}
                    <VideoShow {show} {filter} {flipped} {fit} {speed} />
                {:else}
                    <div class="media context #media_preview" style="flex: 1;overflow: hidden;">
                        <HoverButton
                            icon="play"
                            size={10}
                            on:click={() => {
                                if (!$outLocked) setOutput("background", { path: show?.id, filter, flipped, fit, speed })
                            }}
                            title={$dictionary.media?.show}
                        >
                            <Image style="width: 100%;height: 100%;object-fit: contain;filter: {filter};{flipped ? 'transform: scaleX(-1);' : ''};object-fit: {fit}" src={show.id} alt={show.name || ""} />
                        </HoverButton>
                    </div>
                {/if}
            </div>
        {:else if show.type === "audio"}
            <AudioPreview />
        {:else if show.type === "section"}
            <Section section={show} />
        {:else}
            <Slides />
            <Layouts />
        {/if}
    {:else}
        <Splash />
    {/if}
</div>

<style>
    .main {
        height: 100%;
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
</style>
