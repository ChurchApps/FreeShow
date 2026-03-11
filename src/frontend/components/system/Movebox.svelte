<script lang="ts">
    import { openToolsTab } from "../../stores"
    import { getStyles } from "../helpers/style"
    import { radiusSliderOffset, radiusSliderRatio } from "./textbox"

    export let ratio = 1
    export let itemStyle = ""
    export let active: boolean
    export let onlyCorners = false

    const corners = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
    const sides = ["n", "e", "s", "w"]
    const DEG_PER_RAD = 180 / Math.PI
    let moveboxElem: HTMLElement | undefined

    $: styles = getStyles(itemStyle, true)
    $: styleRotationDeg = getRotationDeg(itemStyle)

    function getRotationDeg(style: string) {
        if (!style) return 0
        const match = style.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/)
        const rotation = Number(match?.[1])
        return Number.isFinite(rotation) ? rotation : 0
    }

    function getRotationDegFromComputedTransform(transform: string) {
        if (!transform || transform === "none") return null

        const values = parseMatrixValues(transform)
        if (values.length >= 2 && Number.isFinite(values[0]) && Number.isFinite(values[1])) {
            return Math.atan2(values[1], values[0]) * DEG_PER_RAD
        }

        return null
    }

    function parseMatrixValues(transform: string) {
        const match = transform.match(/matrix3d?\(([^)]+)\)/)
        if (!match) return []
        return match[1].split(",").map((v) => Number(v.trim()))
    }

    function readLiveRotation() {
        if (!moveboxElem) return null
        const itemElem = moveboxElem.closest(".item") as HTMLElement | null
        if (!itemElem) return null

        const inlineRotation = getRotationDeg(itemElem.getAttribute("style") || "")
        if (inlineRotation) return inlineRotation

        const transform = getComputedStyle(itemElem).transform
        return getRotationDegFromComputedTransform(transform)
    }

    function getHandleVector(handle: string) {
        return {
            x: handle.includes("w") ? -1 : handle.includes("e") ? 1 : 0,
            y: handle.includes("n") ? -1 : handle.includes("s") ? 1 : 0
        }
    }

    function rotateVector(vector: { x: number; y: number }, degrees: number) {
        if (!degrees || !Number.isFinite(degrees)) return vector
        const rad = (degrees * Math.PI) / 180
        const cos = Math.cos(rad)
        const sin = Math.sin(rad)
        return {
            x: vector.x * cos - vector.y * sin,
            y: vector.x * sin + vector.y * cos
        }
    }

    function getResizeCursor(handle: string, degrees = styleRotationDeg) {
        const { x, y } = rotateVector(getHandleVector(handle), degrees)

        if (handle.length === 1) {
            return Math.abs(x) > Math.abs(y) ? "ew-resize" : "ns-resize"
        }

        const invSqrt2 = 1 / Math.sqrt(2)
        const dotNwSe = Math.abs(x * invSqrt2 + y * invSqrt2)
        const dotNeSw = Math.abs(x * invSqrt2 + y * -invSqrt2)
        return dotNwSe >= dotNeSw ? "nwse-resize" : "nesw-resize"
    }

    function syncHandleCursor(e: MouseEvent, handle: string) {
        const target = e.currentTarget as HTMLElement | null
        if (!target) return
        const liveDeg = readLiveRotation() ?? styleRotationDeg
        target.style.cursor = getResizeCursor(handle, liveDeg)
    }
    // WIP radius icon should be max styles.width and relative to height (max possible radius)
</script>

<section bind:this={moveboxElem} class="hideFromAutosize">
    {#each sides as line}
        <div class="line {line}l" class:active style="{line === 'n' || line === 's' ? 'height' : 'width'}: {active ? 25 : 50}px;" />
    {/each}
    {#each corners as square}
        {#if !onlyCorners || square.length > 1}
            <div on:mousedown={() => openToolsTab.set("item")} on:mouseenter={(e) => syncHandleCursor(e, square)} on:mousemove={(e) => syncHandleCursor(e, square)} class="square {square}" class:active style="width: {10 / ratio}px; cursor: {getResizeCursor(square)};" />
        {/if}
    {/each}
    <div class="rotate" style="width: {8 / ratio}px;--line-width: {3 / ratio}px;" class:active></div>
    <div class="radius" style="width: {6 / ratio}px;left: {(Number(styles['border-radius']) || 0) * radiusSliderRatio + radiusSliderOffset}px;" class:active></div>
</section>

<style>
    /* stylelint-disable csstools/use-logical */
    .square {
        position: absolute;
        transform: translate(-50%, -50%);
        /* width: 15px;
    height: 15px; */
        aspect-ratio: 1/1;
        background-color: transparent;
        z-index: 3;

        /* border: 5px solid transparent; */
        /* outline: 1px solid white; */
        /* border-radius: 50%; */
    }
    .square.active {
        background-color: rgb(255 255 255 / 0.8);
        border: 0.5px solid rgb(0 0 0 / 0.8);
    }
    .nw,
    .n,
    .ne {
        top: 0;
    }
    .e,
    .w {
        top: 50%;
    }
    .se,
    .s,
    .sw {
        top: 100%;
    }
    .nw,
    .sw,
    .w {
        left: 0;
    }
    .n,
    .s {
        left: 50%;
    }
    .ne,
    .e,
    .se {
        left: 100%;
    }

    .line {
        position: absolute;
        background-color: transparent;
        cursor: move;
        z-index: 1;
    }
    /* .line.invisible {
    background-color: transparent;
    cursor: move;
  } */
    /* .line::after {
    content: "";
    background-color: red;
    position: absolute;
    left: 0;
    width: 100%;
    height: 100%;
    cursor: move;
  } */

    .nl {
        top: 0;
        left: 0;
        width: 100%;
        /* height: lineWidth; */
        transform: translateY(-50%);
    }
    .el {
        top: 0;
        left: 100%;
        /* width: lineWidth; */
        height: 100%;
        transform: translateX(-50%);
    }
    .sl {
        top: 100%;
        left: 0;
        /* height: lineWidth; */
        width: 100%;
        transform: translateY(-50%);
    }
    .wl {
        top: 0;
        left: 0;
        /* width: lineWidth; */
        height: 100%;
        transform: translateX(-50%);
    }

    .active.nl {
        transform: translateY(-100%);
    }
    .active.el {
        transform: none;
    }
    .active.sl {
        transform: none;
    }
    .active.wl {
        transform: translateX(-100%);
    }

    .rotate {
        position: absolute;
        left: 50%;
        top: -45px;
        transform: translate(-50%, -50%);

        background-color: rgb(255 255 255 / 0.8);
        border: 0.5px solid rgb(0 0 0 / 0.8);
        aspect-ratio: 1/1;
        border-radius: 50%;
        z-index: 2;

        cursor: crosshair;
        /* cursor: pointer; */

        opacity: 0;
    }
    .rotate.active {
        opacity: 1;
    }
    .rotate::after {
        content: "";

        position: absolute;
        left: 50%;
        bottom: 0;
        transform: translate(-50%, 100%);

        height: 45px;
        width: var(--line-width);

        background-color: var(--secondary-opacity);
        /* border-right: 4px solid var(--secondary);
        border-right-style: dashed; */
    }

    .radius {
        position: absolute;
        left: 20px;
        top: 0;

        background-color: rgb(255 255 255 / 0.8);
        border: 0.5px solid rgb(0 0 0 / 0.8);
        aspect-ratio: 1/1;
        transform: translateY(-50%) rotate(45deg);
        z-index: 2;

        cursor: pointer;

        opacity: 0;
    }
    .radius.active {
        opacity: 1;
    }
    /* stylelint-enable csstools/use-logical */
</style>
