<script lang="ts">
    import { moveBox, resizeBox } from "./textbox"

    export let lines: [string, number][]
    export let mouse: any
    export let newStyles: any
    export let ratio: number
    export let active: any

    let styles: any = {}
    function mousemove(e: any) {
        if (!mouse || mouse.rightClick) return

        let notTextBox: boolean = mouse.item.type !== undefined && mouse.item.type !== "text"
        if (!notTextBox && !e.ctrlKey && !e.metaKey && !mouse.e.target.closest(".line") && !mouse.e.target.closest(".square")) return

        e?.preventDefault()
        styles = {}

        // TODO: move multiple!

        let moveCondition: boolean = mouse.e.target.closest(".line") || ((!mouse.e.target.closest(".edit") || notTextBox || mouse.e.altKey) && !mouse.e.target.closest(".square")) || mouse.e.ctrlKey || mouse.e.metaKey || mouse.e.buttons === 4

        let square = e.shiftKey
        if (mouse.item.type === "icon") square = true

        if (moveCondition) [styles, lines] = moveBox(e, mouse, ratio, active, lines)
        else if (mouse.e.target.closest(".square")) {
            styles = resizeBox(e, mouse, square, ratio)
            if (!e.altKey) [styles, lines] = moveBox(e, mouse, ratio, active, lines, styles)
        }

        Object.keys(styles).forEach((key) => {
            if (styles[key] === undefined || styles[key].toString().includes("px")) return
            if (key === "width" || key === "height") styles[key] = Math.max(16 / ratio, styles[key])
            styles[key] = styles[key].toFixed(2) + "px"
        })

        newStyles = styles
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
        left: 0;
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
