<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { GetLayout, getNextSlide, nextSlide } from "../../util/output"
    import { send } from "../../util/socket"
    import { _set, dictionary, outLayout, outputMode, outShow, outSlide, outputDisplay } from "../../util/stores"
    import Clear from "../show/Clear.svelte"
    import Slide from "../show/Slide.svelte"
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

    function keyNav(e: KeyboardEvent) {
        if (e.key === "ArrowLeft" || e.key === "PageUp") {
            send("API:previous_slide")
        } else if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) {
            send("API:next_slide")
        }
    }
</script>

{#if $outShow}
    <h2 class="header">{$outShow.name || ""}</h2>

    {#if $outputMode === "lyrics"}
        <Lyrics />
    {:else}
        <div on:click={click} on:keydown={keyNav} role="button" tabindex="0" aria-label="Slide navigation area" class="outSlides">
            <Slide outSlide={slideNum} {transition} />
            {#if $outLayout && nextSlide(layout, slideNum) && getNextSlide($outShow, slideNum, $outLayout)}
                <Slide outSlide={nextSlide(layout, slideNum) || 0} {transition} />
            {:else}
                <div style="display: flex;align-items: center;justify-content: center;flex: 1;opacity: 0.5;">{translate("remote.end", $dictionary)}</div>
            {/if}
        </div>
    {/if}

    <div class="buttons" style="display: flex;width: 100%;">
        <span style="flex: 3;align-self: center;text-align: center;opacity: 0.8;font-size: 0.6em;padding: 6px;">{slideNum + 1}/{totalSlides}</span>
    </div>

    <div class="buttons" style="display: flex; width: 100%;">
        <Button on:click={() => send("API:toggle_output_windows")} style="flex: 0 0 44px; margin: 0;" center dark red={$outputDisplay}>
            <Icon id={$outputDisplay ? "cancelDisplay" : "display"} size={1.3} white />
        </Button>

        <div style="flex: 1 1 auto; margin: 0;">
            <Clear outSlide={slideNum} on:clear={() => _set("activeTab", "show")} />
        </div>
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
