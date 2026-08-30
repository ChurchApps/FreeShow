import type { Cropping } from "../../../types/Settings"
import { getStyles } from "./style"

export type CropType = "clip" | "ppt"
export type CropValues = { top: number; right: number; bottom: number; left: number }

export interface CropState {
    crop: CropValues & { type: CropType }
    cropHasValues: boolean
    showCropOverflowPreview: boolean
    mediaCropGeometry: string
    mediaContainerStyle: string
}

function toCropType(type: Cropping["type"] | undefined): CropType {
    return type === "clip" ? "clip" : "ppt"
}

export function getCropValues(cropping?: Partial<Cropping> | null): CropValues {
    return {
        top: Number(cropping?.top) || 0,
        right: Number(cropping?.right) || 0,
        bottom: Number(cropping?.bottom) || 0,
        left: Number(cropping?.left) || 0
    }
}

function toCrop(cropping?: Partial<Cropping> | null) {
    return {
        ...getCropValues(cropping),
        type: toCropType(cropping?.type)
    }
}

export function isSameCrop(a: CropValues, b: CropValues) {
    return a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left
}

export function clampCrop(crop: CropValues): CropValues {
    const next = {
        top: Math.max(0, Math.min(99, crop.top)),
        right: Math.max(0, Math.min(99, crop.right)),
        bottom: Math.max(0, Math.min(99, crop.bottom)),
        left: Math.max(0, Math.min(99, crop.left))
    }

    const horizontal = next.left + next.right
    if (horizontal > 99) {
        const factor = 99 / horizontal
        next.left *= factor
        next.right *= factor
    }

    const vertical = next.top + next.bottom
    if (vertical > 99) {
        const factor = 99 / vertical
        next.top *= factor
        next.bottom *= factor
    }

    return next
}

export function clampPan(value: number, total: number) {
    const min = Math.max(0, total - 99)
    const max = Math.min(99, total)
    return Math.max(min, Math.min(max, value))
}

export function getCropCenter(crop: CropValues) {
    return {
        x: crop.left + (100 - crop.left - crop.right) / 2,
        y: crop.top + (100 - crop.top - crop.bottom) / 2
    }
}

export function isCroppedItem(item?: { type?: string; cropping?: Partial<Cropping> | null } | null): boolean {
    if (!item || (item.type !== "media" && item.type !== "camera")) return false
    const cropping = item.cropping
    if (!cropping) return false
    return !!(Number(cropping.top) || Number(cropping.right) || Number(cropping.bottom) || Number(cropping.left))
}

export function getMediaContainerStyle(crop: CropState["crop"], cropHasValues: boolean, itemStyle?: string): string {
    if (!cropHasValues) return "position: absolute;left: 0;top: 0;width: 100%;height: 100%;overflow: hidden;"

    const visibleWidth = Math.max(0.0001, 100 - crop.left - crop.right)
    const visibleHeight = Math.max(0.0001, 100 - crop.top - crop.bottom)
    let borderCss = ""

    if (itemStyle) {
        const s = getStyles(itemStyle)
        if (s["border"]) borderCss += `border: ${s["border"]};`
        else if (s["border-width"]) {
            const w = !/[a-z%]/i.test(s["border-width"]) ? `${s["border-width"]}px` : s["border-width"]
            borderCss += `border-width: ${w};border-style: ${s["border-style"] || "solid"};${s["border-color"] ? `border-color: ${s["border-color"]};` : ""}`
        }
        if (s["border-radius"]) borderCss += `border-radius: ${s["border-radius"]};`
        if (s["box-shadow"]) borderCss += `box-shadow: ${s["box-shadow"]};`
        if (borderCss) borderCss += "box-sizing: border-box;"
    }

    return `position: absolute;left: ${crop.left}%;top: ${crop.top}%;width: ${visibleWidth}%;height: ${visibleHeight}%;overflow: hidden;${borderCss}`
}

export function getMediaInnerGeometry(crop: CropState["crop"], cropHasValues: boolean): string {
    if (cropHasValues) {
        const visibleWidth = Math.max(0.0001, 100 - crop.left - crop.right)
        const visibleHeight = Math.max(0.0001, 100 - crop.top - crop.bottom)
        const innerWidth = (10000 / visibleWidth).toFixed(4)
        const innerHeight = (10000 / visibleHeight).toFixed(4)
        const innerLeft = ((-crop.left * 100) / visibleWidth).toFixed(4)
        const innerTop = ((-crop.top * 100) / visibleHeight).toFixed(4)

        return `position: absolute;width: ${innerWidth}%;height: ${innerHeight}%;left: ${innerLeft}%;top: ${innerTop}%;`
    }

    return `position: absolute;width: 100%;height: 100%;left: 0;top: 0;`
}

export function getCropState(cropping: Partial<Cropping> | undefined, cropPreviewMode: boolean, itemStyle?: string): CropState {
    const crop = toCrop(cropping)
    const cropHasValues = !!(crop.top || crop.right || crop.bottom || crop.left)

    return {
        crop,
        cropHasValues,
        showCropOverflowPreview: cropPreviewMode && cropHasValues && crop.type !== "ppt",
        mediaCropGeometry: getMediaInnerGeometry(crop, cropHasValues),
        mediaContainerStyle: getMediaContainerStyle(crop, cropHasValues, itemStyle)
    }
}
