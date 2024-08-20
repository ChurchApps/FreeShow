<script lang="ts">
    import { outLocked, outputs, slidesOptions } from "../../../stores"
    import { getActiveOutputs, setOutput } from "../../helpers/output"

    export let show

    let pages = 0
    $: if (show.id) getPages()

    async function getPages() {
        pages = 0

        let response = await fetch(show.id)
        let data = await response.blob()

        const reader = new FileReader()
        reader.onload = (_) => {
            const dataURL = reader.result?.toString() || ""
            pages = dataURL.match(/\/Type[\s]*\/Page[^s]/g)?.length || 0
        }

        reader.readAsText(data)
    }

    // set active if output
    // $: active = false
    // WIP multiple otuputs
    $: activeOutput = getActiveOutputs($outputs, false, true)[0]
    $: output = { color: $outputs[activeOutput].color }
    $: active = false

    function outputPdf(e: any, page: number) {
        if ($outLocked || e.ctrlKey || e.metaKey || e.shiftKey) return

        setOutput("slide", { type: "pdf", id: show.id, page, pages })
    }

    // WIP duplicate of Slides.svelte
    let nextScrollTimeout: any = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return

        slidesOptions.set({ ...$slidesOptions, columns: Math.max(2, Math.min(10, $slidesOptions.columns + (e.deltaY < 0 ? -1 : 1))) })

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    // WIP custom background color if possible
</script>

<!-- SHOW FULL PREVIEW: -->
<!-- https://stackoverflow.com/a/64490933/10803046 -->
<!-- <iframe src="{show.id}#toolbar=1" frameborder="0"></iframe> -->

<div class="grid" on:wheel={wheel}>
    {#each [...Array(pages)] as _, page}
        <div class="main" class:active style="{output?.color ? 'outline: 2px solid ' + output.color + ';' : ''}width: {100 / $slidesOptions.columns}%;">
            <div class="slide" tabindex={0} on:click={(e) => outputPdf(e, page + 1)}>
                <iframe src="{show.id}#toolbar=0&view=fit&page={page + 1}" class:hideScrollbar={pages > 1} frameborder="0" scrolling="no"></iframe>
            </div>
        </div>
    {/each}
</div>

<style>
    iframe {
        width: 100%;
        /* height: 100%; */
        aspect-ratio: 16 / 9;

        pointer-events: none;
    }

    iframe.hideScrollbar {
        /* do this to hide scrollbar until the url parameter to hide is supported */
        width: calc(100% + 18px);
    }

    .grid {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        padding: 5px;
        width: 100%;
        height: 100%;
    }

    .main {
        display: flex;
        position: relative;
        /* height: fit-content; */
        padding: 2px;
    }

    .slide {
        background-color: var(--primary-darkest);
        z-index: 0;
        outline-offset: 0;
        width: 100%;

        position: relative;

        /* display: flex; */
        overflow: hidden;
    }

    .main.active {
        outline: 2px solid var(--secondary);
        outline-offset: -1px;
    }
</style>
