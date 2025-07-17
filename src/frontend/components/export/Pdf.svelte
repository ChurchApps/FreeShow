<script lang="ts">
    import { EXPORT } from "../../../types/Channels"
    import type { Show } from "../../../types/Show"
    import { currentWindow } from "../../stores"
    import { send } from "../../utils/request"
    import Media from "../output/layers/Media.svelte"
    import Textbox from "../slide/Textbox.svelte"
    import Zoomed from "../slide/Zoomed.svelte"

    export let shows: Show[] = []
    export let options: any = {}
    export let path = ""

    window.api.receive(EXPORT, (a: any) => {
        if (a.channel === "PDF") {
            shows = a.data.shows
            options = a.data.options
            path = a.data.path
        } else if (a.channel === "NEXT") {
            index++
            if (shows.length > index) exportPDF()
            else send(EXPORT, ["DONE"], { path, name: shows[index - 1].name })
        }
    })

    let layoutSlides: any = {}

    $: if (shows.length) getRefs()

    // WIP get ref...
    function getRefs() {
        shows.forEach((show: any) => {
            let a: any[] = []

            show.layouts?.[show.settings?.activeLayout]?.slides?.forEach((layoutSlide: any) => {
                let slide = show.slides[layoutSlide.id]
                if (!slide) return

                slide.data = layoutSlide
                a.push(slide)
                if (!slide.children) return

                slide.children.forEach((childId: string) => {
                    let slide = show.slides[childId]
                    slide.data = layoutSlide
                    a.push(slide)
                })
            })

            layoutSlides[show.id!] = a
            show.meta = Object.values((show.meta || {}) as { [key: string]: string })
                .filter((a) => a.length)
                .join("; ")
        })

        if ($currentWindow === "pdf") exportPDF()
    }

    let index = 0
    function exportPDF() {
        setTimeout(
            () => {
                send(EXPORT, ["EXPORT"], { type: "pdf", path, name: shows[index].name })
            },
            20 * (pages + 1) + 400
        )
    }

    $: pages = shows.length ? Math.ceil(layoutSlides[shows[0].id!].length / options.grid[1] / (options.text && options.slides ? 1 : options.slides ? options.grid[0] : 1.5)) : 0

    // dynamic counter
    function getGroupName(show: Show, group: string, slideID: string) {
        let name = group
        if (name) {
            let added: any = {}
            Object.entries(show.slides).forEach(([id, a]: any) => {
                if (added[a.group]) {
                    added[a.group]++
                    if (id === slideID) name += " #" + added[a.group]
                } else added[a.group] = 1
            })
        }
        return name
    }
</script>

<main class:flow={!options.text}>
    {#if shows.length}
        {#if options.title}
            <div style="position: absolute;width: 100%;">
                <h1>{shows[index].name}</h1>
            </div>
        {/if}
        {#each layoutSlides[shows[index].id || ""] as slide, i}
            <div class="slide" class:padding={options.text ? i === 0 : i < options.grid[0]} style={options.slides ? `height: calc(842pt / ${options.grid[1]} - 0.1px);` + (options.text ? "" : `width: calc(100% / ${options.grid[0]});`) : ""}>
                <!-- TODO: different slide heights! -->
                <!-- style={settings.slides ? `height: calc(842pt / ${settings.grid[1]});` : "" + settings.text ? "" : `width: calc(100% / ${settings.grid[0]});`} -->
                {#if options.groups}
                    <p class="group" style={options.slides ? "" : "padding: 0 60px;margin-top: -6px;"}>
                        {slide.group ? getGroupName(shows[index], slide.group, slide.id) : ""}
                    </p>
                {/if}
                {#if options.numbers}
                    <p class="number" style={options.slides ? "" : "padding: 0 60px;margin-top: -6px;"}>
                        {i + 1}
                    </p>
                {/if}
                {#if options.slides}
                    <div class="slides" class:invert={options.invert}>
                        <Zoomed style="display: flex;justify-content: center;width: 100%;" let:ratio>
                            {#if shows[index].media?.[slide.data?.background]?.path}
                                <div class="media" style="height: 100%;zoom: {1 / ratio};">
                                    <!-- {filter} {flipped} {fit} -->
                                    <Media path={shows[index].media[slide.data.background].path || ""} mirror />
                                </div>
                            {/if}

                            {#if slide.items}
                                {#each slide.items as item}
                                    <Textbox {item} ref={{ showId: shows[index].id, id: slide.id }} chords={item.chords?.enabled} />
                                {/each}
                            {/if}
                        </Zoomed>
                    </div>
                {/if}
                {#if options.text}
                    <div class="text" class:margin={!options.slides}>
                        {#if slide.items}
                            {#each slide.items as item}
                                {#if item.type === undefined || item.type === "text" || item.type === "timer"}
                                    <Textbox {item} ref={{ showId: shows[index].id, id: slide.id }} customFontSize={options.originalTextSize ? null : options.textSize} style={false} />
                                {/if}
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>
            {#if options.pageNumbers && i > 0 && i % options.grid[0] === 0 && i / options.grid[0] < pages}
                <div class="page" style="top: calc(842pt * {i / options.grid[0] - 0.012} - 30px)">
                    {i / options.grid[0]}/{pages}
                </div>
            {/if}
        {/each}
        {#if options.pageNumbers && (layoutSlides[shows[index].id || ""].length - 1) / (options.text ? 1 : options.grid[0]) / pages < pages}
            <div class="page" style="top: calc(842pt * {pages - 0.012} - 30px);">
                {pages}/{pages}
            </div>
        {/if}
        {#if options.metadata}
            <div style="position: absolute;top: calc(842pt * {pages} - 25px);width: 100%;">
                <p style="text-align: center;font-size: 12px;opacity: 0.8;">
                    {shows[index].meta}
                </p>
            </div>
        {/if}
    {/if}
</main>

<style>
    main {
        display: flex;
        flex-direction: column;
        position: relative;
        background-color: white;
        color: black;
        /* scroll-snap-type: y mandatory; */
        /* page-break-inside: avoid;
    max-height: inherit; */
    }

    main.flow {
        flex-direction: row;
        flex-wrap: wrap;
    }

    h1 {
        zoom: 0.5;
        margin: 20px;
        text-align: center;
        color: black;
    }

    .slide {
        display: flex;
        position: relative;
        /* page-break-before: always; */
    }
    .slide.padding {
        padding-top: 30px;
    }

    .slide .group {
        position: absolute;
        font-weight: bold;
        padding: 0 10px;
    }
    .slide .number {
        position: absolute;
        inset-inline-end: 0px;
        padding: 0 10px;
    }

    .slides {
        display: flex;
        align-self: center;
        justify-content: center;
        flex: 1;
        margin: 10px;
    }
    .flow .slides {
        margin: 40px 10px;
    }
    .slides.invert {
        filter: invert(1);
    }

    .text {
        display: flex;
        flex: 2;
        margin: 10px;
        zoom: 0.2;
    }
    .text :global(.align) {
        text-align: start;
    }

    .text.margin {
        margin: 50px 200px;
        zoom: 0.3;
    }

    /* @page {
    size: 595pt 842pt;
  } */

    .page {
        position: absolute;
        inset-inline-end: 10px;
        /* transform: translateY(-30px); */
    }
</style>
