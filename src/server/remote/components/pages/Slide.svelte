<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { GetLayout, getNextSlide, next, nextSlide, previous } from "../../util/output"
    import { _set, dictionary, outLayout, outputMode, outShow, outSlide } from "../../util/stores"
    import Clear from "../show/Clear.svelte"
    import Slide from "../show/Slide.svelte"
    import Lyrics from "./Lyrics.svelte"

    let transition: any = { type: "fade", duration: 500 }

    $: layout = $outShow ? GetLayout($outShow, $outLayout) : null
    $: _set("layout", layout)

    $: totalSlides = layout ? layout.length : 0

    // click on content
    function click(e: any) {
        if (e.clientX < window.innerWidth / 3) previous()
        else next()
    }
</script>

{#if $outShow}
    <h2>{$outShow.name || ""}</h2>

    {#if $outputMode === "lyrics"}
        <Lyrics />
    {:else}
        <div on:click={click} class="outSlides">
            <Slide outSlide={$outSlide} {transition} />
            {#if nextSlide(layout, $outSlide) && getNextSlide($outShow, $outSlide, $outLayout)}
                <Slide outSlide={nextSlide(layout, $outSlide) || 0} {transition} />
            {:else}
                <div style="display: flex;align-items: center;justify-content: center;flex: 1;opacity: 0.5;">{translate("remote.end", $dictionary)}</div>
            {/if}
        </div>
    {/if}

    <div class="buttons" style="display: flex;width: 100%;">
        <span style="flex: 3;align-self: center;text-align: center;opacity: 0.8;font-size: 0.6em;padding: 6px;">{$outSlide + 1}/{totalSlides}</span>
    </div>

    <div class="buttons">
        <Clear outSlide={$outSlide} on:clear={() => _set("activeTab", "show")} />
    </div>

    <div class="modes">
        <Button on:click={() => _set("outputMode", $outputMode === "slide" ? "lyrics" : "slide")} style="width: 100%;" center dark>
            <Icon id={$outputMode} right />
            {translate(`remote.${$outputMode}`, $dictionary)}
        </Button>
    </div>
{:else}
    <Center faded>{translate("remote.no_output", $dictionary)}</Center>
{/if}

<style>
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
</style>
