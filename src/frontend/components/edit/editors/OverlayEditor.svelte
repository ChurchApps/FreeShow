<script lang="ts">
    import { slide } from "svelte/transition"
    import { OUTPUT } from "../../../../types/Channels"
    import { activeEdit, dictionary, outputs, overlays, styles } from "../../../stores"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import { history } from "../../helpers/history"
    import { getResolution } from "../../helpers/output"
    import { getStyles } from "../../helpers/style"
    import Button from "../../inputs/Button.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Center from "../../system/Center.svelte"
    import Snaplines from "../../system/Snaplines.svelte"
    import Editbox from "../editbox/Editbox.svelte"
    import { clone } from "../../helpers/array"
    import { onDestroy } from "svelte"
    import { send } from "../../../utils/request"

    const update = () => (Slide = clone($overlays[currentId]))
    $: currentId = $activeEdit.id!
    $: if (currentId) update()
    let Slide = clone($overlays[currentId])
    const unsubscribe = overlays.subscribe((a) => clone((Slide = a[currentId])))
    onDestroy(unsubscribe)

    let lines: [string, number][] = []
    let mouse: any = null
    let newStyles: { [key: string]: string | number } = {}
    $: active = $activeEdit.items

    let width = 0
    let height = 0
    $: resolution = getResolution(null, { $outputs, $styles })

    let ratio = 1

    $: {
        if (active.length) updateStyles()
        else newStyles = {}
    }

    function updateStyles() {
        if (!Object.keys(newStyles).length) return

        let items = Slide.items
        let values: string[] = []
        active.forEach((id) => {
            let item = items[id]
            let styles = getStyles(item.style)
            let textStyles = ""

            Object.entries(newStyles).forEach(([key, value]) => (styles[key] = value.toString()))
            Object.entries(styles).forEach((obj) => (textStyles += obj[0] + ":" + obj[1] + ";"))

            // TODO: move multiple!
            values.push(textStyles)
        })

        let override = "overlay_items#" + $activeEdit.id + "indexes#" + active.join(",")
        history({ id: "UPDATE", newData: { key: "items", indexes: active, subkey: "style", data: values }, oldData: { id: $activeEdit.id }, location: { page: "edit", id: "overlay_items", override } })
        send(OUTPUT, ["OVERLAY"], $overlays)
    }

    // ZOOM
    let scrollElem: HTMLDivElement | undefined
    let zoom = 1

    // shortcut
    let nextScrollTimeout: NodeJS.Timeout | null = null
    function wheel(e: any) {
        if (!e.ctrlKey && !e.metaKey) return
        if (nextScrollTimeout) return
        if (!e.target.closest(".editArea")) return

        zoom = Number(Math.max(0.2, Math.min(4, zoom + (e.deltaY < 0 ? -0.1 : 0.1))).toFixed(2))

        // always center scroll when zooming
        if (zoom < 1) {
            // allow elem to update after zooming
            setTimeout(() => {
                if (!scrollElem) return

                const centerX = (scrollElem.scrollWidth - scrollElem.clientWidth) / 2
                const centerY = (scrollElem.scrollHeight - scrollElem.clientHeight) / 2

                scrollElem.scrollTo({ left: centerX, top: centerY })
            })
        }

        // don't start timeout if scrolling with mouse
        if (e.deltaY >= 100 || e.deltaY <= -100) return
        nextScrollTimeout = setTimeout(() => {
            nextScrollTimeout = null
        }, 500)
    }

    // menu
    let zoomOpened = false
    function mousedown(e: any) {
        if (e.target.closest(".zoom_container") || e.target.closest("button")) return

        zoomOpened = false
    }
</script>

<svelte:window on:mousedown={mousedown} on:wheel={wheel} />

<div class="editArea">
    <div class="parent" class:noOverflow={zoom >= 1} bind:this={scrollElem} bind:offsetWidth={width} bind:offsetHeight={height}>
        {#if Slide && !Slide.isDefault}
            <Zoomed background="transparent" checkered border style={getStyleResolution(resolution, width, height, "fit", { zoom })} bind:ratio hideOverflow={false} center={zoom >= 1}>
                <Snaplines bind:lines bind:newStyles bind:mouse {ratio} {active} />
                {#each Slide.items as item, index}
                    <Editbox ref={{ type: "overlay", id: currentId }} {item} {index} {ratio} bind:mouse />
                {/each}
            </Zoomed>
        {:else}
            <Center size={2} faded>
                <T id="empty.slide" />
            </Center>
        {/if}
    </div>

    <div class="actions">
        <div class="actions" style="height: 100%;justify-content: end;">
            <Button on:click={() => (zoomOpened = !zoomOpened)} title={$dictionary.actions?.zoom}>
                <Icon size={1.3} id="zoomIn" white />
            </Button>
            {#if zoomOpened}
                <div class="zoom_container" transition:slide={{ duration: 150 }}>
                    <Button style="padding: 0 !important;width: 100%;" on:click={() => (zoom = 1)} bold={false} center>
                        <p class="text" title={$dictionary.actions?.resetZoom}>{(100 / zoom).toFixed()}%</p>
                    </Button>
                    <Button disabled={zoom <= 0.2} on:click={() => (zoom = Number((zoom - 0.1).toFixed(2)))} title={$dictionary.actions?.zoomIn}>
                        <Icon size={1.3} id="add" white />
                    </Button>
                    <Button disabled={zoom >= 4} on:click={() => (zoom = Number((zoom + 0.1).toFixed(2)))} title={$dictionary.actions?.zoomOut}>
                        <Icon size={1.3} id="remove" white />
                    </Button>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .editArea {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .parent {
        width: 100%;
        height: 100%;
        display: flex;
        overflow: auto;
    }

    /* disable "glitchy" scroll bars */
    .parent.noOverflow {
        overflow: hidden;
    }

    .actions {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        background-color: var(--primary-darkest);
        /* border-top: 3px solid var(--primary-lighter); */
    }

    /* fixed height for consistent heights */
    .actions :global(button) {
        min-height: 28px;
        padding: 0 0.8em !important;
    }

    .text {
        opacity: 0.8;
        text-align: center;
        padding: 0.5em 0;
    }

    .zoom_container {
        position: absolute;
        inset-inline-end: 0;
        top: 0;
        transform: translateY(-100%);
        overflow: hidden;
        z-index: 30;

        flex-direction: column;
        width: auto;
        /* border-left: 3px solid var(--primary-lighter);
        border-top: 3px solid var(--primary-lighter); */
        background-color: inherit;
    }
</style>
