<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { GetLayout, getNextSlide, nextSlide } from "../../util/output"
    import { send } from "../../util/socket"
    import { _set, dictionary, outLayout, outputMode, outShow, outSlide } from "../../util/stores"
    import Clear from "../show/Clear.svelte"
    import Slide from "../show/Slide.svelte"
    import SlideControls from "../show/SlideControls.svelte"
    import Lyrics from "./Lyrics.svelte"

    let transition: any = { type: "fade", duration: 500 }

    $: slideNum = $outSlide ?? -1

    $: layout = $outShow ? GetLayout($outShow, $outLayout) : null
    $: _set("layout", layout)

    $: totalSlides = layout ? layout.length : 0

    // click on content
    function click(e: any) {
        // if (e.clientX < window.innerWidth / 3) previous()
        // else next()
        // if (!($outSlide + 1 >= totalSlides))
        if (e.clientX < window.innerWidth / 3) send("API:previous_slide")
        else send("API:next_slide")
    }
</script>

{#if $outShow}
    <div class="slide-container">
        <h2 class="header">{$outShow.name || ""}</h2>

        {#if $outputMode === "lyrics"}
            <Lyrics />
        {:else}
            <div on:click={click} class="outSlides">
                <Slide outSlide={slideNum} {transition} />
                {#if $outLayout && nextSlide(layout, slideNum) && getNextSlide($outShow, slideNum, $outLayout)}
                    <Slide outSlide={nextSlide(layout, slideNum) || 0} {transition} />
                {:else}
                    <div style="display: flex;align-items: center;justify-content: center;flex: 1;opacity: 0.5;">{translate("remote.end", $dictionary)}</div>
                {/if}
            </div>
        {/if}

        <div class="controls-section">
            <SlideControls {slideNum} {totalSlides} />

            <div class="buttons">
            <Clear outSlide={slideNum} on:clear={() => _set("activeTab", "show")} />
            </div>
        </div>

        <div class="modes">
            <Button on:click={() => _set("outputMode", $outputMode === "slide" ? "lyrics" : "slide")} style="width: 100%;" center dark>
                <Icon id={$outputMode} right />
                {translate(`remote.${$outputMode}`, $dictionary)}
            </Button>
        </div>
    </div>
{:else}
    <Center faded>{translate("remote.no_output", $dictionary)}</Center>
{/if}

<style>
    /* Slide container - flex layout to push buttons to bottom */
    .slide-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        flex: 1;
        min-height: 0;
    }

    .controls-section {
        display: flex;
        flex-direction: column;
        gap: 4px; /* consistent spacing between SlideControls and Clear */
    }

    .outSlides {
        height: 100%;
        flex: 1;
        display: flex;
        gap: 10px;
        overflow: hidden;
    }
    .outSlides :global(.main) {
        width: 50%;
    }

    @media screen and (max-width: 550px) {
        .outSlides {
            flex-direction: column;
        }
        .outSlides :global(.main) {
            height: 50%;
            width: inherit;
        }
    }

    /* Push bottom buttons to align with tabs bar */
    .buttons:last-of-type {
        margin-top: auto;
    }

    /* Mobile styles - align bottom buttons with tabs bar */
    @media screen and (max-width: 1000px) {
        .modes {
            display: none;
        }

        /* Ensure buttons align with tabs bar at bottom */
        .slide-container {
            justify-content: space-between;
        }

        .buttons:last-of-type {
            margin-top: 0;
            margin-bottom: 0;
        }
    }
</style>
