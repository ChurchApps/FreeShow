<script lang="ts">
    import type { Item } from "../../../../types/Show"
    import { activeShow } from "../../../stores"
    import { history } from "../../helpers/history"
    import { clampCrop, clampPan, getCropCenter, getCropValues, isSameCrop, type CropValues } from "../../helpers/cropping"

    type CropSide = "top" | "right" | "bottom" | "left" | "topLeft" | "topRight" | "bottomRight" | "bottomLeft"

    export let item: Item | null
    export let index: number
    export let ref: {
        type?: "show" | "overlay" | "template"
        id: string
    }
    export let itemElem: HTMLElement | undefined
    export let plain = false
    export let isLocked = false
    export let selected = false

    export let cropActive = false
    export let cropPreview: CropValues = { top: 0, right: 0, bottom: 0, left: 0 }

    let cropEditMode = false
    let cropDragSide: CropSide | null = null
    let cropMoveActive = false
    let cropStart = { x: 0, y: 0, crop: { top: 0, right: 0, bottom: 0, left: 0 } as CropValues }

    function persistMissingTypeAsClipIfNeeded() {
        if (!item || !$activeShow || (ref?.type || "show") !== "show") return
        if (!item.cropping || item.cropping.type) return

        history({
            id: "setItems",
            newData: { style: { key: "cropping", values: [{ ...getCropValues(item.cropping), type: "clip" }] } },
            location: { page: "edit", show: $activeShow, slide: ref.id, items: [index] }
        })
    }

    export function handleDblclick(e: MouseEvent) {
        if (item?.type !== "media" || isLocked || (ref?.type || "show") !== "show" || !$activeShow) return false
        if (e.target instanceof HTMLElement && (e.target.closest(".line") || e.target.closest(".square") || e.target.closest(".rotate") || e.target.closest(".radius") || e.target.closest(".editTools"))) return false

        const wasActive = cropEditMode
        cropEditMode = !cropEditMode
        cropPreview = getCropValues(item.cropping)
        if (wasActive) persistMissingTypeAsClipIfNeeded()
        return true
    }

    export function handleKeydown(e: KeyboardEvent) {
        if (e.key !== "Escape" || !cropEditMode) return false

        persistMissingTypeAsClipIfNeeded()
        cropEditMode = false
        cropDragSide = null
        cropMoveActive = false
        return true
    }

    function startCropDrag(side: CropSide, e: MouseEvent) {
        if (item?.type !== "media" || !itemElem || isLocked) return

        e.preventDefault()
        e.stopPropagation()

        cropEditMode = true
        cropDragSide = side
        cropMoveActive = false
        cropPreview = getCropValues(item.cropping)
        cropStart = { x: e.clientX, y: e.clientY, crop: { ...cropPreview } }
    }

    function startCropMove(e: MouseEvent) {
        if (item?.type !== "media" || !itemElem || isLocked) return

        e.preventDefault()
        e.stopPropagation()

        cropEditMode = true
        cropMoveActive = true
        cropDragSide = null
        cropPreview = getCropValues(item.cropping)
        cropStart = { x: e.clientX, y: e.clientY, crop: { ...cropPreview } }
    }

    function cropMousemove(e: MouseEvent) {
        if ((!cropDragSide && !cropMoveActive) || !itemElem) return

        const rect = itemElem.getBoundingClientRect()
        const width = Math.max(rect.width, 1)
        const height = Math.max(rect.height, 1)
        const dxPercent = ((e.clientX - cropStart.x) / width) * 100
        const dyPercent = ((e.clientY - cropStart.y) / height) * 100

        const next = { ...cropStart.crop }

        if (cropMoveActive) {
            const totalX = cropStart.crop.left + cropStart.crop.right
            const totalY = cropStart.crop.top + cropStart.crop.bottom

            next.left = clampPan(cropStart.crop.left + dxPercent, totalX)
            next.right = totalX - next.left
            next.top = clampPan(cropStart.crop.top + dyPercent, totalY)
            next.bottom = totalY - next.top
        } else if (cropDragSide === "left") next.left = cropStart.crop.left + dxPercent
        else if (cropDragSide === "right") next.right = cropStart.crop.right - dxPercent
        else if (cropDragSide === "top") next.top = cropStart.crop.top + dyPercent
        else if (cropDragSide === "bottom") next.bottom = cropStart.crop.bottom - dyPercent
        else if (cropDragSide === "topLeft") {
            next.top = cropStart.crop.top + dyPercent
            next.left = cropStart.crop.left + dxPercent
        } else if (cropDragSide === "topRight") {
            next.top = cropStart.crop.top + dyPercent
            next.right = cropStart.crop.right - dxPercent
        } else if (cropDragSide === "bottomRight") {
            next.bottom = cropStart.crop.bottom - dyPercent
            next.right = cropStart.crop.right - dxPercent
        } else if (cropDragSide === "bottomLeft") {
            next.bottom = cropStart.crop.bottom - dyPercent
            next.left = cropStart.crop.left + dxPercent
        }

        cropPreview = clampCrop(next)
    }

    function cropMouseup() {
        if (!cropDragSide && !cropMoveActive) return

        cropDragSide = null
        cropMoveActive = false

        if (!item || !$activeShow || (ref?.type || "show") !== "show") return

        const nextCrop = clampCrop(cropPreview)
        const oldCrop = getCropValues(item.cropping)
        const nextType = item.cropping?.type === "ppt" ? "ppt" : "clip"
        const needsTypeUpdate = !!item.cropping && !item.cropping.type
        if (!needsTypeUpdate && JSON.stringify(nextCrop) === JSON.stringify(oldCrop)) return

        history({
            id: "setItems",
            newData: { style: { key: "cropping", values: [{ ...nextCrop, type: nextType }] } },
            location: { page: "edit", show: $activeShow, slide: ref.id, items: [index] }
        })

        cropPreview = nextCrop
    }

    $: cropActive = item?.type === "media" && cropEditMode && selected && !plain && !isLocked
    $: cropCenter = getCropCenter(cropPreview)
    $: cropCenterX = cropCenter.x
    $: cropCenterY = cropCenter.y

    // Keep editbox crop preview in sync with external updates (e.g. BoxStyle values).
    $: if (!cropDragSide && !cropMoveActive) {
        const externalCrop = getCropValues(item?.cropping)
        if (!isSameCrop(cropPreview, externalCrop)) cropPreview = externalCrop
    }

    // Deselecting the item should always exit crop mode.
    $: if (!selected && cropEditMode) {
        persistMissingTypeAsClipIfNeeded()
        cropEditMode = false
        cropDragSide = null
        cropMoveActive = false
    }
</script>

<svelte:window on:mousemove={cropMousemove} on:mouseup={cropMouseup} />

{#if cropActive}
    <div class="cropOverlay" on:mousedown={startCropMove}></div>

    <div class="cropMask top" style="height: {cropPreview.top}%;" />
    <div class="cropMask right" style="width: {cropPreview.right}%;" />
    <div class="cropMask bottom" style="height: {cropPreview.bottom}%;" />
    <div class="cropMask left" style="width: {cropPreview.left}%;" />

    <div class="cropHandle top" style="top: {cropPreview.top}%;left: {cropCenterX}%;" on:mousedown={(e) => startCropDrag("top", e)} />
    <div class="cropHandle right" style="right: {cropPreview.right}%;top: {cropCenterY}%;" on:mousedown={(e) => startCropDrag("right", e)} />
    <div class="cropHandle bottom" style="bottom: {cropPreview.bottom}%;left: {cropCenterX}%;" on:mousedown={(e) => startCropDrag("bottom", e)} />
    <div class="cropHandle left" style="left: {cropPreview.left}%;top: {cropCenterY}%;" on:mousedown={(e) => startCropDrag("left", e)} />

    <div class="cropHandle corner topLeft" style="top: {cropPreview.top}%;left: {cropPreview.left}%;" on:mousedown={(e) => startCropDrag("topLeft", e)} />
    <div class="cropHandle corner topRight" style="top: {cropPreview.top}%;right: {cropPreview.right}%;" on:mousedown={(e) => startCropDrag("topRight", e)} />
    <div class="cropHandle corner bottomRight" style="bottom: {cropPreview.bottom}%;right: {cropPreview.right}%;" on:mousedown={(e) => startCropDrag("bottomRight", e)} />
    <div class="cropHandle corner bottomLeft" style="bottom: {cropPreview.bottom}%;left: {cropPreview.left}%;" on:mousedown={(e) => startCropDrag("bottomLeft", e)} />
{/if}

<style>
    .cropOverlay {
        position: absolute;
        inset: 0;
        z-index: 4;
        cursor: move;
    }

    .cropMask {
        position: absolute;
        background-color: rgb(0 0 0 / 0.35);
        z-index: 5;
        pointer-events: none;
    }
    .cropMask.top {
        top: 0;
        left: 0;
        right: 0;
    }
    .cropMask.right {
        top: 0;
        right: 0;
        bottom: 0;
    }
    .cropMask.bottom {
        left: 0;
        right: 0;
        bottom: 0;
    }
    .cropMask.left {
        top: 0;
        left: 0;
        bottom: 0;
    }

    .cropHandle {
        position: absolute;
        z-index: 6;
        background-color: rgb(255 255 255 / 0.9);
        border: 0.5px solid rgb(0 0 0 / 0.8);
    }
    .cropHandle.top,
    .cropHandle.bottom {
        left: 50%;
        transform: translateX(-50%);
        width: 50px;
        height: 10px;
        cursor: ns-resize;
    }
    .cropHandle.top {
        transform: translate(-50%, -50%);
    }
    .cropHandle.bottom {
        transform: translate(-50%, 50%);
    }
    .cropHandle.left,
    .cropHandle.right {
        top: 50%;
        transform: translateY(-50%);
        width: 10px;
        height: 50px;
        cursor: ew-resize;
    }
    .cropHandle.left {
        transform: translate(-50%, -50%);
    }
    .cropHandle.right {
        transform: translate(50%, -50%);
    }

    .cropHandle.corner {
        width: 12px;
        height: 12px;
    }
    .cropHandle.corner.topLeft {
        transform: translate(-50%, -50%);
        cursor: nwse-resize;
    }
    .cropHandle.corner.topRight {
        transform: translate(50%, -50%);
        cursor: nesw-resize;
    }
    .cropHandle.corner.bottomRight {
        transform: translate(50%, 50%);
        cursor: nwse-resize;
    }
    .cropHandle.corner.bottomLeft {
        transform: translate(-50%, 50%);
        cursor: nesw-resize;
    }
</style>
