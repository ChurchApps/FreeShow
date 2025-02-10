<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import autosize, { AutosizeTypes } from "../../../common/util/autosize"
    import { getStyles } from "../../../common/util/style"

    export let item: Item

    $: lineGap = item?.specialStyle?.lineGap
    $: lineBg = item?.specialStyle?.lineBg

    // AUTO SIZE

    let fontSize: number = 0
    let itemElem: any

    let previousItem = "{}"
    $: newItem = JSON.stringify(item)
    $: if (itemElem && newItem !== previousItem) calculateAutosize()

    let loopStop: any = null
    let newCall: boolean = false
    function calculateAutosize() {
        if (loopStop) {
            newCall = true
            return
        }
        loopStop = setTimeout(() => {
            loopStop = null
            if (newCall) calculateAutosize()
            newCall = false
        }, 200)
        previousItem = newItem

        let type = (item?.textFit || "shrinkToFit") as AutosizeTypes

        let defaultFontSize
        let maxFontSize

        if ((item.type || "text") === "text" && !item.auto) {
            fontSize = 0
            return
        }

        const itemText = item?.lines?.[0]?.text?.filter((a) => !a.customType?.includes("disableTemplate")) || []
        let itemFontSize = Number(getStyles(itemText[0]?.style, true)?.["font-size"] || "") || 100

        defaultFontSize = itemFontSize
        if (type === "growToFit") maxFontSize = itemFontSize

        let elem = itemElem
        if (!elem) return

        let textQuery = ""
        if ((item.type || "text") === "text") {
            elem = elem.querySelector(".align")
            textQuery = ".lines .break span"
        } else {
            type = "growToFit"
            if (item.type === "slide_tracker") textQuery = ".progress div"
        }

        fontSize = autosize(elem, { type, textQuery, defaultFontSize, maxFontSize })
    }
</script>

<div class="item" style={item.style} bind:this={itemElem}>
    {#if item.lines}
        <div class="align" style={item.align}>
            <div class="lines" style={lineGap ? `gap: ${lineGap}px;` : ""}>
                {#each item.lines as line}
                    <div class="break" style="{lineBg ? `background-color: ${lineBg};` : ''}{line.align}">
                        {#each line.text || [] as text}
                            <span style="{text.style};{fontSize ? `font-size: ${fontSize}px;` : ''}">{@html text.value?.replaceAll("\n", "<br>") || "<br>"}</span>
                        {/each}
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .align {
        height: 100%;
        display: flex;
        text-align: center;
        align-items: center;
    }

    .lines {
        /* overflow-wrap: break-word;
  font-size: 0; */
        width: 100%;

        display: flex;
        flex-direction: column;
        text-align: center;
        justify-content: center;
    }

    .break {
        width: 100%;

        /* height: 100%; */

        overflow-wrap: break-word;
        /* line-break: after-white-space;
    -webkit-line-break: after-white-space; */
    }

    /* span {
    display: inline;
    white-space: initial;
    color: white;
  } */

    .break :global(span) {
        font-size: 100px;
    }
</style>
