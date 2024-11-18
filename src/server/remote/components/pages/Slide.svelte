<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { GetLayout, getNextSlide, next, nextSlide, previous } from "../../util/output"
    import { send } from "../../util/socket"
    import { _set, dictionary, outLayout, outShow, outSlide } from "../../util/stores"
    import Clear from "../show/Clear.svelte"
    import Slide from "../show/Slide.svelte"

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

    <div on:click={click} class="outSlides">
        <Slide outSlide={$outSlide} {transition} />
        {#if nextSlide(layout, $outSlide) && getNextSlide($outShow, $outSlide, $outLayout)}
            <Slide outSlide={nextSlide(layout, $outSlide) || 0} {transition} />
        {:else}
            <div style="display: flex;align-items: center;justify-content: center;flex: 1;opacity: 0.5;">{translate("remote.end", $dictionary)}</div>
        {/if}
    </div>

    <div class="buttons">
        <Clear
            {dictionary}
            outSlide={$outSlide}
            on:click={(e) => {
                send(e.detail.id, e.detail.value)
                _set("activeTab", "show")
            }}
        />
    </div>

    <div class="buttons" style="display: flex;width: 100%;">
        <!-- <Button style="flex: 1;" center><Icon id="previousFull" /></Button> -->
        <Button style="flex: 1;" on:click={previous} disabled={$outSlide <= 0} center><Icon size={1.8} id="previous" /></Button>
        <span style="flex: 3;align-self: center;text-align: center;opacity: 0.8;font-size: 0.8em;">{$outSlide + 1}/{totalSlides}</span>
        <Button style="flex: 1;" on:click={next} disabled={$outSlide + 1 >= totalSlides} center><Icon size={1.8} id="next" /></Button>
        <!-- <Button style="flex: 1;" center><Icon id="nextFull" /></Button> -->
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
