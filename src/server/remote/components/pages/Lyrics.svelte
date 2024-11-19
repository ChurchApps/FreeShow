<script lang="ts">
    import { GetLayout, next, previous } from "../../util/output"
    import { _set, activeTab, outLayout, outShow, outSlide } from "../../util/stores"

    $: layout = $outShow ? GetLayout($outShow, $outLayout) : null
    $: _set("layout", layout)

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
