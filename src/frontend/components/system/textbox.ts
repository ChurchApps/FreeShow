import { getStyles } from "./../helpers/style"

type TMouse = { x: number; y: number; left: number; top: number; width: number; height: number; offset: { x: number; y: number; width: number; height: number }; e: any }

const snapDistance = 8
export function moveBox(e: any, mouse: TMouse, ratio: number, active: (number | string)[], lines: [string, number][], styles: { [key: string]: any } = {}) {
    const itemElem = mouse.e.target.closest(".item")
    if (!itemElem?.closest(".slide")) return { styles: {}, lines: [] }

    const isResizing = Object.keys(styles).length > 0
    const squareElem = mouse.e.target.closest(".square")
    const directionId: string = squareElem?.classList[1] || ""

    const mouseLeft = (e.clientX - itemElem.closest(".slide").offsetLeft) / ratio - mouse.offset.x
    const mouseTop = (e.clientY - itemElem.closest(".slide").offsetTop) / ratio - mouse.offset.y

    if (!isResizing) {
        styles.left = mouseLeft
        styles.top = mouseTop
    }

    if (e?.altKey || e?.shiftKey || e?.ctrlKey) lines = []
    else snapBox()

    if (!isResizing && active.length > 1) {
        const slideElem = itemElem.closest(".slide")
        const itemElems = Array.from(slideElem.querySelectorAll(".item, .stage_item")) as HTMLElement[]
        const deltaX = Number(styles.left) - mouse.left
        const deltaY = Number(styles.top) - mouse.top

        styles.__multiPositions = Object.fromEntries(
            active.map((id) => {
                const elem = itemElems.find((el) => el.getAttribute("data-index") === String(id) || el.id === String(id) || el.getAttribute("id") === String(id))
                if (!elem) return [id, { left: 0, top: 0 }]
                const parsed = getStyles(elem.getAttribute("style"))
                const initialLeft = elem === itemElem ? mouse.left : (parseFloat(String(parsed.left)) || elem.offsetLeft || 0)
                const initialTop = elem === itemElem ? mouse.top : (parseFloat(String(parsed.top)) || elem.offsetTop || 0)
                return [id, { left: initialLeft + deltaX, top: initialTop + deltaY }]
            })
        )
    }

    function getItemDims(elem: HTMLElement) {
        const style = getStyles(elem.getAttribute("style"), true)
        const w = parseFloat(String(style.width)), h = parseFloat(String(style.height))
        const l = parseFloat(String(style.left)), t = parseFloat(String(style.top))
        return {
            left: !isNaN(l) ? l : elem.offsetLeft,
            top: !isNaN(t) ? t : elem.offsetTop,
            width: !isNaN(w) && w > 0 ? w : elem.offsetWidth,
            height: !isNaN(h) && h > 0 ? h : elem.offsetHeight
        }
    }

    function snapBox() {
        if (!itemElem.closest(".slide")) return
        lines = []

        const currentDims = getItemDims(itemElem)
        const itemWidth = isResizing ? (Number(styles.width) || currentDims.width) : currentDims.width
        const itemHeight = isResizing ? (Number(styles.height) || currentDims.height) : currentDims.height

        const slideWidth = Math.round(itemElem.closest(".slide").offsetWidth / ratio)
        const slideHeight = Math.round(itemElem.closest(".slide").offsetHeight / ratio)

        const xLines = [0, slideWidth / 2, slideWidth]
        const yLines = [0, slideHeight / 2, slideHeight]
        const xItems = isResizing ? [directionId.includes("e") ? itemWidth : 0] : [0, itemWidth / 2, itemWidth]
        const yItems = isResizing ? [directionId.includes("s") ? itemHeight : 0] : [0, itemHeight / 2, itemHeight]

        // Collect positions from other items
        ;[...(itemElem.closest(".slide").querySelectorAll(".item") || [])]
            .filter((a) => !a.closest(".preview"))
            .forEach((item, i) => {
                const id = item.getAttribute("data-index") ? Number(item.getAttribute("data-index")) : (item.id || i)
                if (active.includes(id) || item === itemElem) return
                const { left, top, width, height } = getItemDims(item)
                if (width && height) {
                    xLines.push(left, left + width / 2, left + width)
                    yLines.push(top, top + height / 2, top + height)
                }
            })

        if (isResizing) {
            if (directionId.includes("e") && mouse.left < slideWidth / 2) xLines.push(slideWidth - mouse.left)
            if (directionId.includes("w") && mouse.left + mouse.width > slideWidth / 2) xLines.push(slideWidth - (mouse.left + mouse.width))
            if (directionId.includes("s") && mouse.top < slideHeight / 2) yLines.push(slideHeight - mouse.top)
            if (directionId.includes("n") && mouse.top + mouse.height > slideHeight / 2) yLines.push(slideHeight - (mouse.top + mouse.height))
        }

        checkMatch(xLines, xItems, "x", snapDistance / ratio, slideWidth / 2, itemWidth / 2)
        checkMatch(yLines, yItems, "y", snapDistance / ratio, slideHeight / 2, itemHeight / 2)
    }

    function checkMatch(allLines: number[], items: number[], id: string, margin: number, centerPos?: number, centerItemOffset?: number) {
        const isX = id.includes("x")
        const side = isX ? "left" : "top"
        const boxPos = Number(styles[side]?.toString().replace(/[^-0-9.]+/g, ""))

        if (isResizing) {
            const posProp = isX ? "left" : "top"
            const sizeProp = isX ? "width" : "height"
            const resizesStart = directionId.includes(isX ? "w" : "n")
            const resizesEnd = directionId.includes(isX ? "e" : "s")
            if (!resizesStart && !resizesEnd) return

            const candidate = resizesEnd ? Number(styles[posProp]) + Number(styles[sizeProp]) : Number(styles[posProp])
            let bestDist = Infinity, bestLine: number | null = null, isBestCenter = false

            allLines.forEach((pos) => {
                const isCenter = centerPos !== undefined && Math.abs(pos - centerPos) < 0.5
                const allowedMargin = isCenter ? (snapDistance * 2) / ratio : margin
                const dist = Math.abs(candidate - pos)
                if (dist < allowedMargin) {
                    if ((isCenter && !isBestCenter) || (isCenter === isBestCenter && dist < bestDist)) {
                        bestDist = dist
                        bestLine = pos
                        isBestCenter = isCenter
                    }
                }
            })

            if (bestLine !== null) {
                if (resizesEnd) {
                    styles[sizeProp] = Math.max(16 / ratio, bestLine - mouse[posProp])
                    styles[posProp] = mouse[posProp]
                } else {
                    const fixedEnd = mouse[posProp] + mouse[sizeProp]
                    const newPos = Math.min(bestLine, fixedEnd - 16 / ratio)
                    styles[posProp] = newPos
                    styles[sizeProp] = fixedEnd - newPos
                }
                const lineId = centerPos !== undefined && Math.abs(bestLine - centerPos) < 0.5 ? id + "c" : id
                if (!lines.some((m) => m[0] === lineId && Math.abs(m[1] - bestLine!) < 0.5)) lines.push([lineId, bestLine])
            }
            return
        }

        const centerMargin = (snapDistance * 2) / ratio
        let bestDist = Infinity, bestSnapPos: number | null = null, isBestCenter = false

        allLines.forEach((linePos) => {
            items.forEach((itemOffset) => {
                const isCenter = centerPos !== undefined && (
                    (centerItemOffset !== undefined && Math.abs(linePos - centerPos) < 0.5 && Math.abs(itemOffset - centerItemOffset) < 0.5) ||
                    Math.abs(linePos - centerPos) < 0.5
                )
                const dist = Math.abs(boxPos + itemOffset - linePos)
                const allowedMargin = isCenter ? centerMargin : margin

                if (dist < allowedMargin) {
                    if ((isCenter && !isBestCenter) || (isCenter === isBestCenter && dist < bestDist)) {
                        bestDist = dist
                        bestSnapPos = linePos - itemOffset
                        isBestCenter = isCenter
                    }
                }
            })
        })

        if (bestSnapPos !== null) {
            styles[side] = bestSnapPos
            allLines.forEach((linePos) => {
                if (items.some((itemOffset) => Math.abs(bestSnapPos! + itemOffset - linePos) < 0.5)) {
                    const lineId = centerPos !== undefined && Math.abs(linePos - centerPos) < 0.5 ? id + "c" : id
                    if (!lines.some((m) => m[0] === lineId && Math.abs(m[1] - linePos) < 0.5)) {
                        lines.push([lineId, linePos])
                    }
                }
            })
        }
    }

    return { styles, lines }
}

// const maxSize = 16
export function resizeBox(e: any, mouse: TMouse, keepAspectRatio: boolean, ratio: number, mirror: boolean, forceSquare = false) {
    const itemElem = mouse.e.target.closest(".item")
    if (!itemElem?.closest(".slide")) return {}

    const styles: any = {}
    const squareElem = mouse.e.target.closest(".square")
    const squareIds = squareElem.classList[1]

    // const mouseLeft = (e.clientX - itemElem.closest(".slide").offsetLeft - itemElem.closest(".editArea").closest(".center").offsetLeft) / ratio
    // const mouseTop = (e.clientY - itemElem.closest(".slide").offsetTop - itemElem.closest(".editArea").closest(".center").offsetTop) / ratio

    if (forceSquare) keepAspectRatio = true
    const width = mouse.width
    const height = mouse.height
    const aspectRatio = forceSquare ? 1 : width / height

    const sx = squareIds.includes("w") ? -1 : squareIds.includes("e") ? 1 : 0
    const sy = squareIds.includes("n") ? -1 : squareIds.includes("s") ? 1 : 0

    const rotation = getResizeRotation(itemElem, mouse)
    const cos = Math.cos(rotation)
    const sin = Math.sin(rotation)

    // Rotated local axes in slide coordinates.
    const u = { x: cos, y: sin }
    const v = { x: -sin, y: cos }

    const slideElem = itemElem.closest(".slide")
    const slideRect = slideElem.getBoundingClientRect()

    const center = { x: mouse.left + width / 2, y: mouse.top + height / 2 }
    const pointer = {
        x: (e.clientX - slideRect.left) / ratio,
        y: (e.clientY - slideRect.top) / ratio
    }

    let anchor = { x: center.x, y: center.y }
    if (!mirror) {
        const ox = sx === 0 ? 0 : -sx
        const oy = sy === 0 ? 0 : -sy
        anchor = {
            x: center.x + ox * (width / 2) * u.x + oy * (height / 2) * v.x,
            y: center.y + ox * (width / 2) * u.y + oy * (height / 2) * v.y
        }
    }

    const rel = { x: pointer.x - anchor.x, y: pointer.y - anchor.y }
    const du = rel.x * u.x + rel.y * u.y
    const dv = rel.x * v.x + rel.y * v.y

    let newWidth = sx === 0 ? width : mirror ? Math.abs(du) * 2 : sx * du
    let newHeight = sy === 0 ? height : mirror ? Math.abs(dv) * 2 : sy * dv

    if (keepAspectRatio) {
        if (sx !== 0 && sy === 0) newHeight = newWidth / aspectRatio
        else if (sx === 0 && sy !== 0) newWidth = newHeight * aspectRatio
        else if (sx !== 0 && sy !== 0) {
            const useWidth = Math.abs(newWidth - width) >= Math.abs(newHeight - height)
            if (useWidth) newHeight = newWidth / aspectRatio
            else newWidth = newHeight * aspectRatio
        }
    }

    const minSize = 16 / ratio
    newWidth = Math.max(minSize, newWidth)
    newHeight = Math.max(minSize, newHeight)

    let newCenter = { ...center }
    if (!mirror) {
        const draggedOffset = {
            x: (sx === 0 ? 0 : sx * newWidth) * u.x + (sy === 0 ? 0 : sy * newHeight) * v.x,
            y: (sx === 0 ? 0 : sx * newWidth) * u.y + (sy === 0 ? 0 : sy * newHeight) * v.y
        }
        const dragged = { x: anchor.x + draggedOffset.x, y: anchor.y + draggedOffset.y }
        newCenter = { x: (anchor.x + dragged.x) / 2, y: (anchor.y + dragged.y) / 2 }
    }

    styles.left = newCenter.x - newWidth / 2
    styles.top = newCenter.y - newHeight / 2
    styles.width = newWidth
    styles.height = newHeight

    return styles
}

function getResizeRotation(itemElem: HTMLElement, mouse: any) {
    const mouseStyles = getStyles(mouse?.item?.style, true)
    const itemStyles = getStyles(itemElem?.getAttribute("style"), true)

    const rotationDeg = Number(mouseStyles.rotate || itemStyles.rotate || 0)
    if (!Number.isFinite(rotationDeg) || rotationDeg === 0) return 0

    return (rotationDeg * Math.PI) / 180
}

export function rotateBox(e: any, mouse: any, ratio: number) {
    const itemElem = mouse.e.target.closest(".item")
    if (!itemElem?.closest(".slide")) return 0

    const slideElem = itemElem.closest(".slide")
    const slideRect = slideElem.getBoundingClientRect()

    // Use the mousedown snapshot in slide coordinates to avoid DOM offset drift.
    const itemCenterX = slideRect.left + (mouse.left + mouse.width / 2) * ratio
    const itemCenterY = slideRect.top + (mouse.top + mouse.height / 2) * ratio

    // mouse pos relative to item center
    const relativeX = e.clientX - itemCenterX
    const relativeY = e.clientY - itemCenterY

    // get angle and make 0° point upwards
    let angle = (Math.atan2(relativeY, relativeX) * (180 / Math.PI) + 450) % 360

    // snap to 0°, 90°, 180°, or 270° if within a margin
    const margin = 5 // degrees
    const snapAngles = [0, 90, 180, 270, 360]
    for (const snapAngle of snapAngles) {
        if (e.altKey) break
        if (Math.abs(angle - snapAngle) < margin || Math.abs(angle - (snapAngle - 360)) < margin) {
            angle = snapAngle % 360 // ensure 360 becomes 0
            break
        }
    }

    return angle

    // // 0 - 90 deg
    // if (relativeY < 0 && relativeX >= 0) {
    //     if (relativeX === 0) return 0
    //     return getAngle(Math.abs(relativeY), relativeX)
    // }

    // // 90 - 180 deg
    // if (relativeY >= 0 && relativeX > 0) {
    //     if (relativeY === 0) return 90
    //     return 90 + getAngle(relativeX, relativeY)
    // }

    // // 180 - 270 deg
    // if (relativeY > 0 && relativeX <= 0) {
    //     if (relativeX === 0) return 180
    //     return 180 + getAngle(relativeY, Math.abs(relativeX))
    // }

    // // 270 - 360 deg
    // if (relativeY <= 0 && relativeX < 0) {
    //     if (relativeY === 0) return 270
    //     return 270 + getAngle(Math.abs(relativeX), Math.abs(relativeY))
    // }

    // console.error("Could not get correct angle!")
    // return 0

    // function getAngle(hypotenuse: number, opposite: number) {
    //     // let isFlipped = hypotenuse < opposite
    //     // const ratio = isFlipped ? hypotenuse / opposite : opposite / hypotenuse
    //     // let angle = 45 * Math.asin(ratio)
    //     // if (isFlipped) angle = 90 - angle
    //     // return angle
    //     return (Math.atan2(opposite, hypotenuse) * (180 / Math.PI) + 360) % 360
    // }
}

const maxRadius = 500
export const radiusSliderOffset = 20
export const radiusSliderRatio = 0.8
export const radiusHandleSize = 6
export function getRadius(e: any, mouse: any, ratio: number) {
    const itemElem = mouse.e.target.closest(".item")
    const slideRect = itemElem?.closest(".slide")?.getBoundingClientRect()
    if (!slideRect) return 0

    const rot = getResizeRotation(itemElem, mouse)
    const dx = (e.clientX - slideRect.left) / ratio - (mouse.left + mouse.width / 2)
    const dy = (e.clientY - slideRect.top) / ratio - (mouse.top + mouse.height / 2)

    const localX = dx * Math.cos(rot) + dy * Math.sin(rot) + mouse.width / 2
    const relativeX = localX - radiusSliderOffset - radiusHandleSize / (2 * ratio)

    return Math.max(0, Math.min(maxRadius, relativeX / radiusSliderRatio))
}
