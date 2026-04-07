import type { TimelineAction } from "../../../types/Show"

export interface EasingHandles {
    x1: number
    y1: number
    x2: number
    y2: number
}

const DEFAULT_ACTION_EASING: EasingHandles = {
    // default to ease-in-out when no custom handles are stored.
    x1: 0.58,
    y1: 1,
    x2: 0.42,
    y2: 0
}

export function getActionEasing(action?: TimelineAction | null): EasingHandles {
    const easing = action?.easing
    return {
        // Incoming handle for this keyframe, relative to the previous segment.
        x1: typeof easing?.t1 === "number" ? easing.t1 : DEFAULT_ACTION_EASING.x1,
        y1: typeof easing?.v1 === "number" ? easing.v1 : DEFAULT_ACTION_EASING.y1,
        // Outgoing handle for this keyframe, relative to the next segment.
        x2: typeof easing?.t2 === "number" ? easing.t2 : DEFAULT_ACTION_EASING.x2,
        y2: typeof easing?.v2 === "number" ? easing.v2 : DEFAULT_ACTION_EASING.y2
    }
}

export function toStoredActionEasing(handles: EasingHandles) {
    return {
        t1: handles.x1,
        v1: handles.y1,
        t2: handles.x2,
        v2: handles.y2
    }
}

export function getSegmentCurve(startAction?: TimelineAction | null, endAction?: TimelineAction | null): EasingHandles {
    const start = getActionEasing(startAction)
    const end = getActionEasing(endAction)

    return {
        x1: start.x2,
        y1: start.y2,
        x2: end.x1,
        y2: end.y1
    }
}

export function getSegmentCurvePoints(p1: { x: number; y: number }, p2: { x: number; y: number }, curve: EasingHandles): EasingHandles {
    return {
        x1: p1.x + (p2.x - p1.x) * curve.x1,
        y1: p1.y + (p2.y - p1.y) * curve.y1,
        x2: p1.x + (p2.x - p1.x) * curve.x2,
        y2: p1.y + (p2.y - p1.y) * curve.y2
    }
}

export function evaluateTimelineCurve(progress: number, previous?: TimelineAction | null, next?: TimelineAction | null) {
    const curve = getSegmentCurve(previous, next)
    return solveCubicBezier(progress, curve.x1, curve.y1, curve.x2, curve.y2)
}

export function solveCubicBezier(progress: number, x1: number, y1: number, x2: number, y2: number) {
    if (progress <= 0) return 0
    if (progress >= 1) return 1

    const sampleCurve = (time: number, point1: number, point2: number) => {
        const inverse = 1 - time
        return 3 * inverse * inverse * time * point1 + 3 * inverse * time * time * point2 + time * time * time
    }

    const sampleCurveDerivative = (time: number, point1: number, point2: number) => {
        const inverse = 1 - time
        return 3 * inverse * inverse * point1 + 6 * inverse * time * (point2 - point1) + 3 * time * time * (1 - point2)
    }

    let time = progress
    for (let i = 0; i < 8; i++) {
        const slope = sampleCurveDerivative(time, x1, x2)
        if (Math.abs(slope) < 1e-6) break

        const x = sampleCurve(time, x1, x2) - progress
        time -= x / slope
    }

    let min = 0
    let max = 1
    time = Math.max(0, Math.min(1, time))
    for (let i = 0; i < 10; i++) {
        const x = sampleCurve(time, x1, x2)
        if (Math.abs(x - progress) < 1e-6) break

        if (x < progress) min = time
        else max = time
        time = (min + max) / 2
    }

    return sampleCurve(time, y1, y2)
}
