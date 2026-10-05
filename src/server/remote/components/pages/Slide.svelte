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

        <div class="slide-progress-text">{slideNum + 1}/{totalSlides}</div>

        <div class="controls-section">
            <div class="slide-progress desktop-only">
                <Button class="desktop-nav" on:click={() => send("API:previous_slide")} disabled={slideNum <= 0} variant="outlined" center compact>
                    <Icon id="previous" size={1.2} />
                </Button>
                <span class="counter">{slideNum + 1}/{totalSlides}</span>
                <Button class="desktop-nav" on:click={() => send("API:next_slide")} disabled={slideNum + 1 >= totalSlides} variant="outlined" center compact>
                    <Icon id="next" size={1.2} />
                </Button>
            </div>

            <div class="buttons">
                <Clear outSlide={slideNum} on:clear={() => _set("activeTab", "show")} />
            </div>

            <div class="mode-toggle">
                <Button on:click={() => _set("outputMode", $outputMode === "slide" ? "lyrics" : "slide")} style="width: 100%;" center dark>
                    <Icon id={$outputMode} right />
                    {translate(`remote.${$outputMode}`, $dictionary)}
                </Button>
            </div>
        </div>

        <div class="modes desktop-only">
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

    .slide-progress-text,
    .slide-progress .counter {
        font-size: 0.85em;
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.3px;
        color: white;
    }

    .slide-progress-text {
        text-align: center;
        padding: 8px 0;
    }

    .controls-section {
        display: flex;
        flex-direction: column;
        gap: 0;
        background-color: var(--primary-darkest);
        border-radius: 8px 8px 0 0;
        overflow: hidden;
        margin-bottom: 0;
    }

    .controls-section .buttons {
        border-radius: 0;
    }

    .controls-section :global(.clearAll) {
        border-radius: 8px 8px 0 0 !important;
    }

    .slide-progress {
        display: none;
    }

    .mode-toggle {
        padding: 4px;
        background-color: var(--primary-darkest);
        border-radius: 0;
    }

    .mode-toggle :global(button) {
        width: 100%;
        border-radius: 0 !important;
    }

    .desktop-only {
        display: none;
    }

    @media screen and (min-width: 1001px) {
        .slide-progress-text {
            display: none;
        }

        .slide-progress {
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: relative;
            gap: 12px;
            padding: 2px 6px;
            background-color: var(--primary-darkest);
            border-radius: 8px 8px 0 0;
            min-height: 36px;
        }

        .slide-progress :global(.desktop-nav) {
            display: flex;
            min-width: 32px;
            min-height: 32px !important;
            padding: 2px 6px !important;
            flex-shrink: 0;
        }

        .slide-progress :global(.desktop-nav) :global(svg) {
            fill: var(--secondary);
        }

        .slide-progress .counter {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            padding: 0 8px;
            pointer-events: none;
        }

        .controls-section .buttons {
            border-radius: 0;
        }

        .mode-toggle {
            display: none;
        }

        .desktop-only {
            display: block;
        }
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
        .desktop-only {
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
