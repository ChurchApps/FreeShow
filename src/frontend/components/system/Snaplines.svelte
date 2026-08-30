<script lang="ts">
    import { onDestroy } from "svelte"
    import { outputs } from "../../stores"
    import { throttle } from "../../utils/common"
    import { stopResizing } from "../../utils/cursor"
    import { DEFAULT_BOUNDS, getActiveOutputs, getOutputResolution, getStageResolution } from "../helpers/output"
    import { getRadius, moveBox, resizeBox, rotateBox } from "./textbox"

    export let lines: [string, number][]
    export let mouse: any
    export let newStyles: { [key: string]: string | number }
    export let ratio: number
    export let active: (number | string)[]
    export let isStage = false

    let styles: { [key: string]: any } = {}
    function mousemove(e: any) {
        if (!mouse?.item || mouse.rightClick) return

        let notTextBox: boolean = mouse.item.type !== undefined && mouse.item.type !== "text"
        if (!notTextBox && !e.ctrlKey && !e.metaKey && !mouse.e.target.closest(".line") && !mouse.e.target.closest(".square") && !mouse.e.target.closest(".rotate") && !mouse.e.target.closest(".radius")) return

        e?.preventDefault()
        styles = {}

        let control = mouse.e.ctrlKey || mouse.e.metaKey
        let moveCondition: boolean = mouse.e.target.closest(".line") || ((!mouse.e.target.closest(".edit") || notTextBox || mouse.e.altKey) && !mouse.e.target.closest(".square")) || (control && !mouse.e.target.closest(".square")) || mouse.e.buttons === 4

        let keepAspectRatio = e.shiftKey
        // WIP square option currently not working well (also custom SVG icons can be any ratio)
        const square = false // mouse.item.type === "icon"

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

        // deduplicate lines that have the exact same position
        const uniqueLines: [string, number][] = []
        for (const line of lines) {
            const lineType = line[0][0] // "x" or "y"
            const duplicateIndex = uniqueLines.findIndex((existing) => existing[0][0] === lineType && Math.abs(existing[1] - line[1]) < 0.5)
            if (duplicateIndex === -1) {
                uniqueLines.push(line)
            } else if (line[0].endsWith("c") && !uniqueLines[duplicateIndex][0].endsWith("c")) {
                // Prefer center line marker over standard line marker if at the same position
                uniqueLines[duplicateIndex] = line
            }
        }
        lines = uniqueLines

        // show max 3 lines of each orientation at once
        const MAX_LINES = 3
        let xLines = lines.filter((line) => line[0] === "x" || line[0] === "xc").slice(0, MAX_LINES)
        let yLines = lines.filter((line) => line[0] === "y" || line[0] === "yc").slice(0, MAX_LINES)
        lines = [...xLines, ...yLines]

        // percentage scale
        let outputId = isStage ? "" : getActiveOutputs($outputs, true, true, true)[0]
        let outputResolution = isStage ? getStageResolution() : getOutputResolution(outputId, $outputs, true)
        const aspectRatio = outputResolution.width / outputResolution.height
        const width = DEFAULT_BOUNDS.width
        const height = DEFAULT_BOUNDS.width / aspectRatio

        if (styles.__multiPositions) {
            const multiPositions = styles.__multiPositions as any
            Object.keys(multiPositions).forEach((id) => {
                let pos = multiPositions[id]
                let scaledLeft = DEFAULT_BOUNDS.width * (Number(pos.left) / width)
                let scaledTop = DEFAULT_BOUNDS.height * (Number(pos.top) / height)
                multiPositions[id] = {
                    left: scaledLeft.toFixed(2) + "px",
                    top: scaledTop.toFixed(2) + "px"
                }
            })
        } else {
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
        }

        throttle("EDIT_ITEM_MOVE", styles, (value) => (newStyles = value), 50)
    }

    function mouseup() {
        stopResizing()
        mouse = null
        lines = []
        newStyles = {}
    }

    onDestroy(() => {
        stopResizing()
    })
</script>

<svelte:window on:mousemove={mousemove} on:mouseup={mouseup} />

{#each lines as line}
    {@const isX = line[0].includes("x")}
    {@const isCenter = line[0].endsWith("c")}
    {@const thickness = (isCenter ? 2.5 : 1.25) / ratio}
    <div
        class="line {line[0]}"
        style="{isX ? `left: ${line[1]}px; width: ${thickness}px; height: 100%;` : `top: ${line[1]}px; height: ${thickness}px; width: 100%;`}transform: translate{isX ? 'X' : 'Y'}(-50%);"
    />
{/each}

<style>
    .line {
        position: absolute;
        top: 0;
        left: 0; /* stylelint-disable-line csstools/use-logical */
        z-index: 1000;
        background-color: var(--secondary);
    }
</style>
