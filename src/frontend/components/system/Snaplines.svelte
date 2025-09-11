<script lang="ts">
    import { outputs } from "../../stores"
    import { throttle } from "../../utils/common"
    import { DEFAULT_BOUNDS, getActiveOutputs, getOutputResolution, getStageResolution } from "../helpers/output"
    import { getRadius, moveBox, resizeBox, rotateBox } from "./textbox"

    export let lines: [string, number][]
    export let mouse: any
    export let newStyles: { [key: string]: string | number }
    export let ratio: number
    export let active: (number | string)[]
    export let isStage = false

    let styles: { [key: string]: string | number } = {}
    function mousemove(e: any) {
        if (!mouse || mouse.rightClick) return

        let notTextBox: boolean = mouse.item.type !== undefined && mouse.item.type !== "text"
        if (!notTextBox && !e.ctrlKey && !e.metaKey && !mouse.e.target.closest(".line") && !mouse.e.target.closest(".square") && !mouse.e.target.closest(".rotate") && !mouse.e.target.closest(".radius")) return

        e?.preventDefault()
        styles = {}

        // TODO: move multiple!

        let control = mouse.e.ctrlKey || mouse.e.metaKey
        let moveCondition: boolean =
            mouse.e.target.closest(".line") || ((!mouse.e.target.closest(".edit") || notTextBox || mouse.e.altKey) && !mouse.e.target.closest(".square")) || (control && !mouse.e.target.closest(".square")) || mouse.e.buttons === 4

        let keepAspectRatio = e.shiftKey
        const square = mouse.item.type === "icon"

        if (mouse.e.target.closest(".rotate")) {
            let rotation = rotateBox(e, mouse, ratio)
            styles = { transform: `rotate(${rotation.toFixed(2)}deg);` }
        } else if (mouse.e.target.closest(".radius")) {
            let radius = getRadius(e, mouse, ratio)
            styles = { "border-radius": `${radius.toFixed(2)}px;` }
        } else if (moveCondition) {
            const moved = moveBox(e, mouse, ratio, active, lines)
            styles = moved.styles
            lines = moved.lines
        } else if (mouse.e.target.closest(".square")) {
            styles = resizeBox(e, mouse, keepAspectRatio, ratio, control, square)
            if (!e.altKey) {
                const moved = moveBox(e, mouse, ratio, active, lines, styles)
                styles = moved.styles
                lines = moved.lines
            }
        }

        // percentage scale
        let outputId = isStage ? "" : getActiveOutputs($outputs, true, true, true)[0]
        let outputResolution = isStage ? getStageResolution() : getOutputResolution(outputId, $outputs, true)
        const aspectRatio = outputResolution.width / outputResolution.height
        const width = DEFAULT_BOUNDS.width
        const height = DEFAULT_BOUNDS.width / aspectRatio

        if (styles.left) styles.left = DEFAULT_BOUNDS.width * (Number(styles.left) / width)
        if (styles.top) styles.top = DEFAULT_BOUNDS.height * (Number(styles.top) / height)
        if (styles.width) styles.width = DEFAULT_BOUNDS.width * (Number(styles.width) / width)
        if (styles.height) styles.height = DEFAULT_BOUNDS.height * (Number(styles.height) / height)

        // finalize values
        Object.keys(styles).forEach((key) => {
            if (styles[key] === undefined || styles[key].toString().includes("px") || styles[key].toString().includes("deg")) return
            if (key === "width" || key === "height") styles[key] = Math.max(16 / ratio, Number(styles[key]))
            styles[key] = Number(styles[key]).toFixed(2) + "px"
        })

        throttle("EDIT_ITEM_MOVE", styles, (value) => (newStyles = value), 50)
    }

    function mouseup() {
        mouse = null
        lines = []
        newStyles = {}
    }
</script>

<svelte:window on:mousemove={mousemove} on:mouseup={mouseup} />

{#each lines as line}
    <div class="line {line[0]}" style="{line[0].includes('x') ? 'left' : 'top'}: {line[1]}px;transform:translate{line[0].includes('x') ? 'X' : 'Y'}(-50%);" />
{/each}

<style>
    .line {
        position: absolute;
        top: 0;
        left: 0; /* stylelint-disable-line csstools/use-logical */
        z-index: 1000;
        background-color: var(--secondary);
    }
    .line.x {
        width: 2px;
        height: 100%;
    }
    .line.xc {
        width: 5px;
        height: 100%;
    }
    .line.y {
        width: 100%;
        height: 2px;
    }
    .line.yc {
        width: 100%;
        height: 5px;
    }
</style>
