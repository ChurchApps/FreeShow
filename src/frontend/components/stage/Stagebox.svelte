<script lang="ts">
    import { activeStage, stageShows, timers } from "../../stores"
    import { getAutoSize } from "../edit/scripts/autoSize"
    import { getStyles } from "../helpers/style"
    import T from "../helpers/T.svelte"
    import Timer from "../slide/views/Timer.svelte"
    import Clock from "../system/Clock.svelte"
    import Movebox from "../system/Movebox.svelte"
    import SlideNotes from "./items/SlideNotes.svelte"
    import SlideText from "./items/SlideText.svelte"
    import VideoTime from "./items/VideoTime.svelte"

    export let id: string
    export let item: any
    export let show: any = null
    export let ratio: number
    export let edit: boolean = false
    $: currentShow = show === null ? ($activeStage.id ? $stageShows[$activeStage.id] : null) : show

    export let mouse: any = null
    function mousedown(e: any) {
        if (edit) {
            console.log(e)
            activeStage.update((ae) => {
                if (e.ctrlKey || e.metaKey) {
                    if (ae.items.includes(id)) {
                        if (e.target.closest(".line")) ae.items.splice(ae.items.indexOf(id), 1)
                    } else ae.items.push(id)
                } else ae.items = [id]
                return ae
            })

            // if (
            //   (e.target.closest(".line") && !e.ctrlKey && !e.metaKey) ||
            //   e.target.closest(".square") ||
            //   ((e.ctrlKey || e.metaKey) && !e.target.closest(".line")) ||
            //   e.altKey ||
            //   e.buttons === 4
            // ) {
            let target = e.target.closest(".stage_item")

            mouse = {
                x: e.clientX,
                y: e.clientY,
                width: target.offsetWidth,
                height: target.offsetHeight,
                top: target.offsetTop,
                left: target.offsetLeft,
                offset: {
                    x: (e.clientX - e.target.closest(".slide").offsetLeft) / ratio - target.offsetLeft,
                    y: (e.clientY - e.target.closest(".slide").offsetTop) / ratio - target.offsetTop,
                    width: e.clientX / ratio - target.offsetWidth,
                    height: e.clientY / ratio - target.offsetHeight,
                },
                item: { type: "stage", ...item },
                e: e,
            }
        }
    }

    function keydown(e: any) {
        if (edit) {
            if ((e.key === "Backspace" || e.key === "Delete") && $activeStage.items.includes(id) && !document.activeElement?.closest(".stage_item") && !document.activeElement?.closest(".edit")) {
                // TODO: history??
                $stageShows[$activeStage.id!].items[id].enabled = false
                activeStage.set({ id: $activeStage.id, items: [] })
            }
        }
    }

    function deselect(e: any) {
        if (!e.target.closest(".stageTools")) {
            if ((edit && !e.ctrlKey && !e.metaKey && e.target.closest(".stage_item")?.id !== id && $activeStage.items.includes(id) && !e.target.closest(".stage_item")) || e.target.closest(".panel")) {
                activeStage.update((ae) => {
                    ae.items = []
                    return ae
                })
            }
        }
    }

    // timer
    let today = new Date()
    setInterval(() => (today = new Date()), 1000)

    let height: number = 0
    let width: number = 0
    $: fontSize = Number(getStyles(item.style, true)?.["font-size"] || 0)
    $: console.log(fontSize)

    $: size = getAutoSize(item, { width, height })
    // $: size = Math.min(height, width) / 2
    $: autoSize = fontSize ? Math.min(fontSize, size) : size
</script>

<svelte:window on:keydown={keydown} on:mousedown={deselect} />

<div
    {id}
    bind:offsetHeight={height}
    bind:offsetWidth={width}
    class="stage_item item"
    class:outline={edit}
    class:selected={edit && $activeStage.items.includes(id)}
    style="{item.style};{edit ? `outline: ${3 / ratio}px solid rgb(255 255 255 / 0.2);` : ''}"
    on:mousedown={mousedown}
>
    {#if currentShow?.settings.labels}
        <div class="label">
            {#key id}
                <T id="stage.{id.split('#')[1]}" />
            {/key}
        </div>
    {/if}
    {#if edit}
        <Movebox {ratio} active={$activeStage.items.includes(id)} />
    {/if}
    <!-- TODO: auto size! -->
    <div class="align" style={item.align}>
        <div>
            {#if id.split("#")[0] === "countdowns"}
                <!--  -->
            {:else if id.includes("notes")}
                <SlideNotes next={id.includes("next")} />
            {:else if id.includes("slide_text")}
                <SlideText next={id.includes("next")} chords={item.chords} ref={{ type: "stage", id }} {autoSize} parent={{ width, height }} />
            {:else if id.includes("slide")}
                <span style="pointer-events: none;">
                    <SlideText next={id.includes("next")} chords={item.chords} ref={{ type: "stage", id }} parent={{ width, height }} style />
                </span>
            {:else if id.includes("clock")}
                <Clock style={false} {autoSize} />
            {:else if id.includes("video")}
                <VideoTime {autoSize} reverse={id.includes("countdown")} />
            {:else if id.includes("timers")}
                {#if $timers[id.split("#")[1]]}
                    <Timer id={id.split("#")[1]} {today} style="font-size: {autoSize}px;" />
                {/if}
            {:else}
                {id}
            {/if}
        </div>
    </div>
</div>

<style>
    .stage_item.outline {
        outline: 5px solid rgb(255 255 255 / 0.2);
    }
    .stage_item.selected {
        outline: 5px solid var(--secondary);
        overflow: visible;
    }

    .align {
        height: 100%;
        display: flex;
        text-align: center;
        align-items: center;
    }

    .align div,
    .align :global(.item) {
        width: 100%;
        height: 100%;
        color: unset;
        /* overflow-wrap: break-word; */
    }
</style>
