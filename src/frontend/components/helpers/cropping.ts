import type { Cropping } from "../../../types/Settings"

export type CropType = "clip" | "ppt"
export type CropValues = { top: number; right: number; bottom: number; left: number }

export interface CropState {
    crop: CropValues & { type: CropType }
    cropHasValues: boolean
    showCropOverflowPreview: boolean
    mediaCropGeometry: string
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

function getMediaCropGeometry(crop: CropState["crop"], cropHasValues: boolean) {
    if (cropHasValues && crop.type === "ppt") {
        const visibleWidth = Math.max(0.0001, 100 - crop.left - crop.right)
        const visibleHeight = Math.max(0.0001, 100 - crop.top - crop.bottom)
        const pptWidth = 10000 / visibleWidth
        const pptHeight = 10000 / visibleHeight
        const pptLeft = (-crop.left * 100) / visibleWidth
        const pptTop = (-crop.top * 100) / visibleHeight

        return `width: ${pptWidth}%;height: ${pptHeight}%;left: ${pptLeft}%;top: ${pptTop}%;`
    }

    const clipPath = cropHasValues ? `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)` : "inset(0 0 0 0)"
    return `width: 100%;height: 100%;left: 0;top: 0;${cropHasValues ? `clip-path: ${clipPath};-webkit-clip-path: ${clipPath};` : ""}`
}

export function getCropState(cropping: Partial<Cropping> | undefined, cropPreviewMode: boolean): CropState {
    const crop = toCrop(cropping)
    const cropHasValues = !!(crop.top || crop.right || crop.bottom || crop.left)

    return {
        crop,
        cropHasValues,
        showCropOverflowPreview: cropPreviewMode && cropHasValues && crop.type !== "ppt",
        mediaCropGeometry: getMediaCropGeometry(crop, cropHasValues)
    }
}
