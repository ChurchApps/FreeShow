<script lang="ts">
    import { onDestroy } from "svelte"
    import { OUTPUT } from "../../../../types/Channels"
    import type { ItemType } from "../../../../types/Show"
    import { activeEdit, outputs, overlays, styles } from "../../../stores"
    import { send } from "../../../utils/request"
    import T from "../../helpers/T.svelte"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import { getResolution } from "../../helpers/output"
    import { getStyles } from "../../helpers/style"
    import FloatingInputs from "../../input/FloatingInputs.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"
    import MaterialZoom from "../../inputs/MaterialZoom.svelte"
    import Zoomed from "../../slide/Zoomed.svelte"
    import { getStyleResolution } from "../../slide/getStyleResolution"
    import Center from "../../system/Center.svelte"
    import Snaplines from "../../system/Snaplines.svelte"
    import Editbox from "../editbox/Editbox.svelte"
    import Icon from "../../helpers/Icon.svelte"
    import { addItem } from "../scripts/itemHelpers"
    import { translateText } from "../../../utils/language"

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
    function updateZoom(e: any) {
        zoom = e.detail
        centerZoom()
    }

    function centerZoom() {
        if (zoom >= 1) return
        // allow elem to update after zooming

        setTimeout(() => {
            if (!scrollElem) return

            const centerX = (scrollElem.scrollWidth - scrollElem.clientWidth) / 2
            const centerY = (scrollElem.scrollHeight - scrollElem.clientHeight) / 2

            scrollElem.scrollTo({ left: centerX, top: centerY })
        })
    }

    const shortcutItems: { id: ItemType; icon?: string }[] = [{ id: "text" }, { id: "media", icon: "image" }, { id: "timer" }]

    $: widthOrHeight = getStyleResolution(resolution, width, height, "fit", { zoom })
</script>

{#if Slide?.isDefault}
    <div class="default" data-title={translateText("example.default")}>
        <Icon id="protected" white />
    </div>
{/if}

<div class="editArea">
    <div class="parent" class:noOverflow={zoom >= 1} bind:this={scrollElem} bind:offsetWidth={width} bind:offsetHeight={height}>
        <!--  && !Slide.isDefault -->
        {#if Slide}
            <Zoomed background="transparent" checkered border style={widthOrHeight} bind:ratio hideOverflow={false} center={zoom >= 1}>
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

    {#if !widthOrHeight.includes("height")}
        <FloatingInputs side="center">
            {#each shortcutItems as item}
                <MaterialButton title="settings.add: items.{item.id}" on:click={() => addItem(item.id)}>
                    <Icon id={item.icon || item.id} size={1.3} white />
                </MaterialButton>
            {/each}
        </FloatingInputs>
    {/if}

    <FloatingInputs>
        <MaterialZoom columns={zoom} min={0.2} max={4} defaultValue={1} addValue={0.1} on:change={updateZoom} />
    </FloatingInputs>
</div>

<style>
    .default {
        position: absolute;
        top: 10px;
        left: 10px;

        width: 42px;
        height: 42px;

        display: flex;
        align-items: center;
        justify-content: center;

        background-color: var(--primary-darkest);
        border: 1px solid var(--primary-lighter);

        padding: 10px;
        border-radius: 50%;

        z-index: 999;
    }

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
</style>
