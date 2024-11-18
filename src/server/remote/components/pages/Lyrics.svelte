<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import { translate } from "../../util/helpers"
    import { GetLayout, next, previous } from "../../util/output"
    import { send } from "../../util/socket"
    import { _set, activeTab, dictionary, outLayout, outShow, outSlide } from "../../util/stores"
    import Clear from "../show/Clear.svelte"

    $: layout = $outShow ? GetLayout($outShow, $outLayout) : null
    $: _set("layout", layout)

    $: totalSlides = layout ? layout.length : 0

    function click(e: any) {
        if (e.clientX < window.innerWidth / 3) previous()
        else next()
    }

    let lyricsScroll: any
    // auto scroll
    $: {
        if (lyricsScroll && outSlide !== null && $activeTab === "lyrics") {
            let offset = lyricsScroll.children[$outSlide]?.offsetTop - lyricsScroll.offsetTop - 5
            lyricsScroll.scrollTo(0, offset)
        }
    }
</script>

{#if $outShow}
    <h2>{$outShow.name || ""}</h2>

    <div on:click={click} bind:this={lyricsScroll} class="lyrics">
        {#each layout || [] as layoutSlide, i}
            {#if !layoutSlide.disabled}
                <span style="padding: 5px;{$outSlide === i ? 'background-color: rgba(0 0 0 / 0.6);' : ''}">
                    <span class="group" style="opacity: 0.6;font-size: 0.8em;display: flex;justify-content: center;position: relative;">
                        <span style="left: 0;position: absolute;">{i + 1}</span>
                        <span>{$outShow.slides[layoutSlide.id].group === null ? "" : $outShow.slides[layoutSlide.id].group || "—"}</span>
                    </span>
                    {#each $outShow.slides[layoutSlide.id].items as item}
                        {#if item.lines}
                            <div class="lyric">
                                {#each item.lines as line}
                                    <div class="break">
                                        {#each line.text || [] as text}
                                            <span>{@html text.value}</span>
                                        {/each}
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <span style="opacity: 0.5;">—</span>
                        {/if}
                    {/each}
                </span>
            {/if}
        {/each}
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
    .lyrics {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0 10px;
        /* gap: 10px; */
        scroll-behavior: smooth;
    }
    .lyric {
        font-size: 1.1em;
        text-align: center;
    }
</style>
