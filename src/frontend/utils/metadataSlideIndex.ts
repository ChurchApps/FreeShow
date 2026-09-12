// Pure helper for getMetadata() in components/helpers/output.ts — kept
// dependency-free so it can be unit tested without mocking output.ts's
// (unrelated) store/Electron imports.

export interface SlideRefLike {
    data: { disabled?: boolean }
}

export interface MetadataSlideIndices {
    firstActiveSlideIndex: number
    lastActiveSlideIndex: number
}

// "offset" counts *active* (non-disabled) slides, so e.g. firstOffset = 1
// targets the second active slide, not literally index (first + 1) — a
// disabled slide in between shouldn't shift the count. Offset 0 for both
// reproduces the original first/last-active-slide behavior exactly.
export function getMetadataSlideIndices(ref: SlideRefLike[], firstOffset = 0, lastOffset = 0): MetadataSlideIndices {
    const activeIndices = ref.reduce((indices: number[], a, i) => {
        if (!a.data.disabled) indices.push(i)
        return indices
    }, [])

    const clampedFirstOffset = Math.max(0, Math.floor(Number(firstOffset) || 0))
    const clampedLastOffset = Math.max(0, Math.floor(Number(lastOffset) || 0))

    const firstActiveSlideIndex = activeIndices[Math.min(clampedFirstOffset, activeIndices.length - 1)] ?? -1
    const lastActiveSlideIndex = activeIndices[Math.max(activeIndices.length - 1 - clampedLastOffset, 0)] ?? -1

    return { firstActiveSlideIndex, lastActiveSlideIndex }
}
