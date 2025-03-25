<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import { activeEdit, activeShow, openToolsTab, os, outputs, showsCache, variables } from "../../../stores"
    import { deleteAction } from "../../helpers/clipboard"
    import { getActiveOutputs, getOutputResolution, percentageStylePos } from "../../helpers/output"
    import EditboxLines from "./EditboxLines.svelte"
    import EditboxOther from "./EditboxOther.svelte"
    import EditboxPlain from "./EditboxPlain.svelte"

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
    export let chordsAction: string = ""

    let itemElem: HTMLElement | undefined

    export let mouse: any = {}
    function mousedown(e: any) {
        if (e.target.closest(".chords") || e.target.closest(".editTools")) return
        if (!e.target.closest(".line") && !e.target.closest(".square") && !e.target.closest(".rotate") && !e.target.closest(".radius")) openToolsTab.set("text")

        const rightClick: boolean = e.button === 2 || e.buttons === 2 || ($os.platform === "darwin" && e.ctrlKey)

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
            rightClick,
        }
    }

    $: active = $activeShow?.id
    $: layout = active && $showsCache[active] ? $showsCache[active].settings.activeLayout : ""
    // $: slide = layout && $activeEdit.slide !== null && $activeEdit.slide !== undefined ? [$showsCache, GetLayoutRef(active, layout)[$activeEdit.slide].id][1] : null

    function keydown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            ;(document.activeElement as HTMLElement).blur()
            window.getSelection()?.removeAllRanges()
            if ($activeEdit.items.length) {
                // give time so output don't clear
                setTimeout(() => {
                    activeEdit.update((a) => {
                        a.items = []
                        return a
                    })
                })
            }
        }

        if (!$activeEdit.items.includes(index) || document.activeElement?.closest(".item") || document.activeElement?.closest("input")) return

        if (e.key === "Backspace" || e.key === "Delete") {
            // delete slide item using shortcut
            deleteAction({ id: "item", data: { layout, slideId: ref.id } })
        }
    }

    function deselect(e: any) {
        if (e.target.closest(".menus") || e.target.closest(".popup") || e.target.closest(".drawer") || e.target.closest(".chords") || e.target.closest(".contextMenu") || e.target.closest(".editTools")) return

        if (e.ctrlKey || e.metaKey || e.target.closest(".item") === itemElem || !$activeEdit.items.includes(index) || e.target.closest(".item")) return

        if (window.getSelection()) window.getSelection()?.removeAllRanges()

        // timeout to allow CSS to update selected items first if any
        setTimeout(() => {
            activeEdit.update((ae) => {
                ae.items = []
                return ae
            })
        })
    }

    $: customOutputId = getActiveOutputs($outputs, true, true, true)[0]
    function getCustomStyle(style: string, outputId: string = "") {
        if (outputId) {
            let outputResolution = getOutputResolution(outputId, $outputs, true)
            style = percentageStylePos(style, outputResolution)
        }

        return style
    }

    $: isDisabledVariable = item?.type === "variable" && $variables[item?.variable?.id]?.enabled === false
    // SHOW IS LOCKED FOR EDITING
    $: isLocked = (ref.type || "show") !== "show" ? false : $showsCache[active || ""]?.locked
</script>

<!-- on:mouseup={() => chordUp({ showRef: ref, itemIndex: index, item })} -->
<svelte:window on:mousedown={deselect} on:keydown={keydown} />

<!-- WIP item with opacity 0 is completely hidden! Even the align elements! -->

<!-- bind:offsetHeight={height}
bind:offsetWidth={width} -->
<div
    bind:this={itemElem}
    class={plain ? "editItem" : `editItem item ${isLocked ? "" : "context #edit_box"}`}
    class:selected={$activeEdit.items.includes(index)}
    class:isDisabledVariable
    style={plain
        ? "width: 100%;"
        : `${getCustomStyle(item?.style || "", customOutputId)}; outline: ${3 / ratio}px solid rgb(255 255 255 / 0.2);z-index: ${index + 1 + ($activeEdit.items.includes(index) ? 100 : 0)};${filter ? "filter: " + filter + ";" : ""}${
              backdropFilter ? "backdrop-filter: " + backdropFilter + ";" : ""
          }`}
    data-index={index}
    on:mousedown={mousedown}
>
    {#if !plain}
        <EditboxPlain {item} {index} {ratio} />
    {/if}
    {#if item?.lines}
        <EditboxLines {item} {ref} {index} {editIndex} {plain} {chordsMode} {chordsAction} {isLocked} />
    {:else}
        <EditboxOther {item} {ratio} {ref} {itemElem} />
    {/if}
</div>

<style>
    .item {
        outline: 5px solid rgb(255 255 255 / 0.2);
        transition: background-color 0.3s;
        /* cursor: text; */

        /* media items */
        overflow: hidden;
    }
    .item.selected {
        overflow: visible;
    }
    .item.selected :global(.align) {
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
