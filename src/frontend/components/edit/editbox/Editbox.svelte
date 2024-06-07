<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import { activeEdit, os, variables } from "../../../stores"
    import { _show } from "../../helpers/shows"
    import EditboxPlain from "./EditboxPlain.svelte"
    import EditboxOther from "./EditboxOther.svelte"
    import EditboxLines from "./EditboxLines.svelte"

    export let item: Item
    export let filter: string = ""
    export let backdropFilter: string = ""
    export let ref: {
        type?: "show" | "overlay" | "template"
        showId?: string
        id: string
    }
    export let index: number
    export let editIndex: number = -1
    export let ratio: number = 1
    export let plain: boolean = false
    export let chordsMode: boolean = false

    let itemElem: any

    export let mouse: any = {}
    function mousedown(e: any) {
        if (e.target.closest(".chords") || e.target.closest(".editTools")) return
        let rightClick: boolean = e.buttons === 2 || ($os.platform === "darwin" && e.ctrlKey)

        activeEdit.update((ae) => {
            if (rightClick) {
                if (ae.items.includes(index)) return ae
                ae.items = [index]

                return ae
            }

            if (e.ctrlKey || e.metaKey) {
                if (ae.items.includes(index)) {
                    if (e.target.closest(".line")) ae.items.splice(ae.items.indexOf(index), 1)
                } else {
                    ae.items.push(index)
                }

                return ae
            }

            ae.items = [index]

            return ae
        })

        let target = e.target.closest(".item")
        if (!target) return

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
            item,
            e: e,
        }
    }

    function deselect(e: any) {
        if (e.target.closest(".menus") || e.target.closest(".popup") || e.target.closest(".drawer") || e.target.closest(".chords") || e.target.closest(".contextMenu") || e.target.closest(".editTools")) return

        if (e.ctrlKey || e.metaKey || e.target.closest(".item") === itemElem || !$activeEdit.items.includes(index) || e.target.closest(".item")) return

        if (window.getSelection()) window.getSelection()?.removeAllRanges()

        activeEdit.update((ae) => {
            ae.items = []
            return ae
        })
    }

    $: isDisabledVariable = item?.type === "variable" && $variables[item?.variable?.id]?.enabled === false
</script>

<!-- on:mouseup={() => chordUp({ showRef: ref, itemIndex: index, item })} -->
<svelte:window on:mousedown={deselect} />

<!-- bind:offsetHeight={height}
bind:offsetWidth={width} -->
<div
    bind:this={itemElem}
    class={plain ? "editItem" : "editItem item context #edit_box"}
    class:selected={$activeEdit.items.includes(index)}
    class:isDisabledVariable
    style={plain
        ? "width: 100%;"
        : `${item?.style}; outline: ${3 / ratio}px solid rgb(255 255 255 / 0.2);z-index: ${index + 1 + ($activeEdit.items.includes(index) ? 100 : 0)};${filter ? "filter: " + filter + ";" : ""}${
              backdropFilter ? "backdrop-filter: " + backdropFilter + ";" : ""
          }`}
    data-index={index}
    on:mousedown={mousedown}
>
    {#if !plain}
        <EditboxPlain {item} {index} {ratio} />
    {/if}
    {#if item?.lines}
        <EditboxLines {chordsMode} {item} {ref} {index} {editIndex} {plain} />
    {:else}
        <EditboxOther {item} {ratio} {ref} />
    {/if}
</div>

<style>
    .item {
        outline: 5px solid rgb(255 255 255 / 0.2);
        transition: background-color 0.3s;
        /* cursor: text; */
    }
    .item:global(.selected .align) {
        outline: 5px solid var(--secondary-opacity);
        overflow: visible !important;
    }

    .item.isDisabledVariable {
        opacity: 0.5;
    }

    .item:hover {
        /* .item:hover > .edit { */
        background-color: rgb(255 255 255 / 0.05);
        backdrop-filter: blur(20px);
    }
</style>
