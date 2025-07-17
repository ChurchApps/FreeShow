import { getStyles } from "./../helpers/style"

type TMouse = { left: number; top: number; width: number; height: number; offset: { x: number; y: number; width: number; height: number }; e: any }

const snapDistance = 8
export function moveBox(e: any, mouse: TMouse, ratio: number, active: (number | string)[], lines: [string, number][], styles: { [key: string]: string | number } = {}) {
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

    let gotMatch = false

    if (e?.altKey) lines = []
    else snapBox()

    function snapBox() {
        if (!itemElem.closest(".slide")) return

        const slideWidth = Math.round(itemElem.closest(".slide").offsetWidth / ratio)
        const slideHeight = Math.round(itemElem.closest(".slide").offsetHeight / ratio)

        // slide snap
        const xLines = [0, slideWidth / 2, slideWidth]
        const yLines = [0, slideHeight / 2, slideHeight]
        // item snap
        const xItems = isResizing ? [directionId.includes("e") ? itemElem.offsetWidth : 0] : [0, itemElem.offsetWidth / 2, itemElem.offsetWidth]
        const yItems = isResizing ? [directionId.includes("s") ? itemElem.offsetHeight : 0] : [0, itemElem.offsetHeight / 2, itemElem.offsetHeight]

        // get other items pos
        ;[...(itemElem.closest(".slide").querySelectorAll(".item") || [])].filter((a) => !a.closest(".preview")).forEach(getItemLines)

        function getItemLines(item: HTMLElement, i: number) {
            let id: number | string = i
            if (item.id) id = item.id
            if (active.includes(id)) return

            const style = getStyles(item.getAttribute("style"))
            const styleNumbers: { [key: string]: number } = {}
            Object.entries(style).map((s) => (styleNumbers[s[0]] = Number(s[1].replace(/[^-0-9\.]+/g, ""))))
            xLines.push(styleNumbers.left, styleNumbers.left + styleNumbers.width / 2, styleNumbers.left + styleNumbers.width)
            yLines.push(styleNumbers.top, styleNumbers.top + styleNumbers.height / 2, styleNumbers.top + styleNumbers.height)
        }

        checkMatch(xLines, xItems, "x", snapDistance / ratio)
        checkMatch(yLines, yItems, "y", snapDistance / ratio)

        if (isResizing && gotMatch) return

        // center is easier to snap to
        checkMatch([slideWidth / 2], [itemElem.offsetWidth / 2], "xc", (snapDistance * 2) / ratio, true)
        checkMatch([slideHeight / 2], [itemElem.offsetHeight / 2], "yc", (snapDistance * 2) / ratio, true)
    }

    function checkMatch(allLines: number[], items: number[], id: string, margin: number, isCenter = false) {
        const side = id.includes("x") ? "left" : "top"

        const mousePos =
            side === "left"
                ? (e.clientX - itemElem.closest(".slide")?.offsetLeft - (itemElem.closest(".editArea") || itemElem.closest(".stageArea"))?.closest(".center")?.offsetLeft) / ratio
                : (e.clientY - itemElem.closest(".slide")?.offsetTop - (itemElem.closest(".editArea") || itemElem.closest(".stageArea"))?.closest(".center")?.offsetTop) / ratio

        const getNumber = (pos: any) => Number(pos?.toString().replace(/[^-0-9\.]+/g, ""))
        const boxPos = getNumber(styles[side])

        allLines.forEach((linePos: number) => {
            const mouseMatch = mousePos > linePos - margin && mousePos < linePos + margin
            const boxMatch: undefined | number = items.find((i) => boxPos > linePos - i - margin && boxPos < linePos - i + margin)

            // snapping resize
            if (isResizing && !isCenter && mouseMatch === true) {
                gotMatch = true
                if (side === "left") {
                    if (directionId.includes("e")) styles.width = linePos - mouse.left
                    else if (directionId.includes("w")) {
                        styles.left = linePos
                        styles.width = mouse.width - linePos + mouse.left
                    }
                } else if (side === "top") {
                    if (directionId.includes("s")) styles.height = linePos - mouse.top
                    else if (directionId.includes("n")) {
                        styles.top = linePos
                        styles.height = mouse.height - linePos + mouse.top
                    }
                }
            }
            // snapping move
            if ((!isResizing || isCenter) && boxMatch !== undefined) {
                gotMatch = true
                styles[side] = linePos - boxMatch
            }

            const linesInclude = lines
                .join(".")
                .replaceAll(",", "")
                .includes(id + String(linePos))
            if (boxMatch !== undefined && !linesInclude) lines = [...lines, [id, linePos]]
            else if (boxMatch === undefined && linesInclude) lines = lines.filter((m) => m.join("") !== id + String(linePos))
        })
    }

    // WIP remove duplicate lines (both x and same coords (or less than very simular))

    return { styles, lines }
}

// const maxSize = 16
export function resizeBox(e: any, mouse: TMouse, keepAspectRatio: boolean, ratio: number, mirror: boolean, forceSquare = false) {
    const itemElem = mouse.e.target.closest(".item")
    const styles: any = {}
    const squareElem = mouse.e.target.closest(".square")
    const squareIds = squareElem.classList[1]

    // const mouseLeft = (e.clientX - itemElem.closest(".slide").offsetLeft - itemElem.closest(".editArea").closest(".center").offsetLeft) / ratio
    // const mouseTop = (e.clientY - itemElem.closest(".slide").offsetTop - itemElem.closest(".editArea").closest(".center").offsetTop) / ratio

    if (forceSquare) keepAspectRatio = true
    const width = mouse.width
    const height = mouse.height
    const aspectRatio = forceSquare ? 1 : width / height

    const corner = forceSquare || squareIds.length > 1

    // WIP keepAspectRatio corners moving item as well (bottom right working fine)

    if (squareIds.includes("w")) resizeLeft()
    if (squareIds.includes("n")) resizeTop()
    if (squareIds.includes("e")) resizeRight()
    if (squareIds.includes("s")) resizeBottom()

    function resizeLeft() {
        const newLeft: number = (e.clientX - itemElem.closest(".slide").offsetLeft) / ratio - mouse.offset.x
        const newWidth: number = mouse.width - newLeft + mouse.left

        // WIP don't move further than max size / other side
        // if (mouseLeft + maxSize > newLeft + newWidth) {
        //     styles.left = newLeft + newWidth + maxSize
        //     return
        // }
        // if (newWidth < maxSize) return

        styles.left = newLeft
        styles.width = newWidth

        if (mirror) {
            const widthDifference = mouse.width - styles.width
            styles.width -= widthDifference

            if (corner) return
        }

        if (!keepAspectRatio) return

        styles.height = styles.width / aspectRatio

        if (corner) return

        const heightAdjustment = (height - styles.height) / 2
        styles.top = mouse.top + heightAdjustment
    }

    function resizeTop() {
        const newTop: number = (e.clientY - itemElem.closest(".slide").offsetTop) / ratio - mouse.offset.y
        const newHeight: number = mouse.height - newTop + mouse.top

        // if (mouseTop + maxSize > newTop + newHeight) return
        // if (newHeight < maxSize) return

        styles.top = newTop
        styles.height = newHeight

        if (mirror) {
            const heightDifference = mouse.height - styles.height
            styles.height -= heightDifference

            if (corner) return
        }

        if (!keepAspectRatio) return

        styles.width = styles.height * aspectRatio

        if (corner) return

        const widthAdjustment = (width - styles.width) / 2
        styles.left = mouse.left + widthAdjustment
    }

    function resizeRight() {
        styles.width = e.clientX / ratio - mouse.offset.width

        if (mirror) {
            const widthDifference = mouse.width - styles.width
            styles.left = mouse.left + widthDifference
            styles.width -= widthDifference

            if (corner) return
        }

        if (!keepAspectRatio) {
            styles.left = styles.left ?? mouse.left // only for snap
            return
        }

        const newHeight = styles.width / aspectRatio
        // if (!squareIds.includes("n")) styles.height = newHeight
        styles.height = newHeight

        if (corner) return

        const heightAdjustment = (height - newHeight) / 2
        styles.top = mouse.top + heightAdjustment
    }

    function resizeBottom() {
        styles.height = e.clientY / ratio - mouse.offset.height

        if (mirror) {
            const heightDifference = mouse.height - styles.height
            styles.top = mouse.top + heightDifference
            styles.height -= heightDifference

            if (corner) return
        }

        if (!keepAspectRatio) {
            styles.top = styles.top ?? mouse.top // only for snap
            return
        }

        const newWidth = styles.height * aspectRatio
        // if (!squareIds.includes("w")) styles.width = newWidth
        styles.width = newWidth

        if (corner) return

        const widthAdjustment = (width - newWidth) / 2
        styles.left = mouse.left + widthAdjustment
    }

    return styles
}

export function rotateBox(e: any, mouse: any, ratio: number) {
    const itemElem = mouse.e.target.closest(".item")
    if (!itemElem?.closest(".slide")) return 0

    const itemOffsetLeft: number = itemElem.offsetLeft || 0
    const slideOffsetLeft: number = itemElem.closest(".slide").offsetLeft || 0
    const editOffsetLeft: number = (itemElem.closest(".editArea") || itemElem.closest(".stageArea"))?.closest(".center")?.offsetLeft || 0

    const itemOffsetTop: number = itemElem.offsetTop || 0
    const slideOffsetTop: number = itemElem.closest(".slide").offsetTop || 0
    const editOffsetTop: number = (itemElem.closest(".editArea") || itemElem.closest(".stageArea"))?.closest(".center")?.offsetTop || 0

    const itemPosX = itemOffsetLeft * ratio + slideOffsetLeft + editOffsetLeft
    const itemPosY = itemOffsetTop * ratio + slideOffsetTop + editOffsetTop

    const itemCenterX = itemPosX + (itemElem.offsetWidth * ratio) / 2
    const itemCenterY = itemPosY + (itemElem.offsetHeight * ratio) / 2

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
export function getRadius(e: any, mouse: any, ratio: number) {
    const itemElem = mouse.e.target.closest(".item")
    if (!itemElem?.closest(".slide")) return 0

    const sliderStart = radiusSliderOffset
    const sliderLength = maxRadius * radiusSliderRatio

    const itemOffsetLeft: number = itemElem.offsetLeft || 0
    const slideOffsetLeft: number = itemElem.closest(".slide").offsetLeft || 0
    const editOffsetLeft: number = (itemElem.closest(".editArea") || itemElem.closest(".stageArea"))?.closest(".center")?.offsetLeft || 0

    const itemPosX = itemOffsetLeft * ratio + slideOffsetLeft + editOffsetLeft
    const sliderPosStart = itemPosX + sliderStart * ratio
    // const sliderPosEnd = sliderPosStart + sliderLength * ratio

    const relativeX = (e.clientX - sliderPosStart) / ratio
    const percentage = Math.max(0, Math.min(sliderLength, relativeX)) / sliderLength

    return maxRadius * percentage
}
