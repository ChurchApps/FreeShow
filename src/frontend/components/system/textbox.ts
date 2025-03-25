import { getStyles } from "./../helpers/style"

const snapDistance: number = 8
export function moveBox(e: any, mouse: any, ratio: number, active: (number | string)[], lines: [string, number][], styles: { [key: string]: string | number } = {}) {
    let itemElem = mouse.e.target.closest(".item")
    if (!itemElem.closest(".slide")) return { styles: {}, lines: [] }

    let isResizing = Object.keys(styles).length > 0
    let squareElem = mouse.e.target.closest(".square")
    let directionId: string = squareElem?.classList[1] || ""

    let mouseLeft = (e.clientX - itemElem.closest(".slide").offsetLeft) / ratio - mouse.offset.x
    let mouseTop = (e.clientY - itemElem.closest(".slide").offsetTop) / ratio - mouse.offset.y

    if (!isResizing) {
        styles.left = mouseLeft
        styles.top = mouseTop
    }

    let gotMatch = false

    if (e?.altKey) lines = []
    else snapBox()

    function snapBox() {
        let slideWidth = Math.round(itemElem.closest(".slide").offsetWidth / ratio)
        let slideHeight = Math.round(itemElem.closest(".slide").offsetHeight / ratio)

        // slide snap
        let xLines = [0, slideWidth / 2, slideWidth]
        let yLines = [0, slideHeight / 2, slideHeight]
        // item snap
        let xItems = isResizing ? [directionId.includes("e") ? itemElem.offsetWidth : 0] : [0, itemElem.offsetWidth / 2, itemElem.offsetWidth]
        let yItems = isResizing ? [directionId.includes("s") ? itemElem.offsetHeight : 0] : [0, itemElem.offsetHeight / 2, itemElem.offsetHeight]

        // get other items pos
        ;[...itemElem.closest(".slide").querySelectorAll(".item")].filter((a) => !a.closest(".preview")).forEach(getItemLines)

        function getItemLines(item: HTMLElement, i: number) {
            let id: number | string = i
            if (item.id) id = item.id
            if (active.includes(id)) return

            let style: any = getStyles(item.getAttribute("style"))
            Object.entries(style).map((s: any) => (style[s[0]] = Number(s[1].replace(/[^-0-9\.]+/g, ""))))
            xLines.push(style.left, style.left + style.width / 2, style.left + style.width)
            yLines.push(style.top, style.top + style.height / 2, style.top + style.height)
        }

        checkMatch(xLines, xItems, "x", snapDistance / ratio)
        checkMatch(yLines, yItems, "y", snapDistance / ratio)

        if (isResizing && gotMatch) return

        // center is easier to snap to
        checkMatch([slideWidth / 2], [itemElem.offsetWidth / 2], "xc", (snapDistance * 2) / ratio, true)
        checkMatch([slideHeight / 2], [itemElem.offsetHeight / 2], "yc", (snapDistance * 2) / ratio, true)
    }

    function checkMatch(allLines: number[], items: number[], id: string, margin: number, isCenter: boolean = false) {
        const side = id.includes("x") ? "left" : "top"

        const mousePos =
            side === "left"
                ? (e.clientX - itemElem.closest(".slide")?.offsetLeft - (itemElem.closest(".editArea") || itemElem.closest(".stageArea"))?.closest(".center")?.offsetLeft) / ratio
                : (e.clientY - itemElem.closest(".slide")?.offsetTop - (itemElem.closest(".editArea") || itemElem.closest(".stageArea"))?.closest(".center")?.offsetTop) / ratio

        const getNumber = (pos: any) => Number(pos?.toString().replace(/[^-0-9\.]+/g, ""))
        const boxPos = getNumber(styles[side])

        allLines.forEach((linePos: number) => {
            let mouseMatch = mousePos > linePos - margin && mousePos < linePos + margin
            let boxMatch: undefined | number = items.find((i) => boxPos > linePos - i - margin && boxPos < linePos - i + margin)

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

            let linesInclude = lines
                .join(".")
                .replaceAll(",", "")
                .includes(id + linePos)
            if (boxMatch !== undefined && !linesInclude) lines = [...lines, [id, linePos]]
            else if (boxMatch === undefined && linesInclude) lines = lines.filter((m) => m.join("") !== id + linePos)
        })
    }

    // WIP remove duplicate lines (both x and same coords (or less than very simular))

    return { styles, lines }
}

// const maxSize = 16
export function resizeBox(e: any, mouse: any, square: boolean, ratio: number) {
    let itemElem = mouse.e.target.closest(".item")
    let styles: any = {}
    let store: null | number = null
    let squareElem = mouse.e.target.closest(".square")

    // const mouseLeft = (e.clientX - itemElem.closest(".slide").offsetLeft - itemElem.closest(".editArea").closest(".center").offsetLeft) / ratio
    // const mouseTop = (e.clientY - itemElem.closest(".slide").offsetTop - itemElem.closest(".editArea").closest(".center").offsetTop) / ratio

    if (squareElem.classList[1].includes("w")) resizeLeft()
    if (squareElem.classList[1].includes("n")) resizeTop()
    if (squareElem.classList[1].includes("e")) resizeRight()
    if (squareElem.classList[1].includes("s")) resizeBottom()

    function resizeLeft() {
        let newLeft: number = (e.clientX - itemElem.closest(".slide").offsetLeft) / ratio - mouse.offset.x
        let newWidth: number = mouse.width - newLeft + mouse.left

        // WIP don't move further than max size / other side
        // if (mouseLeft + maxSize > newLeft + newWidth) {
        //     styles.left = newLeft + newWidth + maxSize
        //     return
        // }
        // if (newWidth < maxSize) return

        styles.left = newLeft
        store = styles.width = newWidth
    }

    function resizeTop() {
        if (square && store !== null) {
            styles.height = store
            return
        }

        let newTop: number = (e.clientY - itemElem.closest(".slide").offsetTop) / ratio - mouse.offset.y
        let newHeight: number = mouse.height - newTop + mouse.top
        // if (mouseTop + maxSize > newTop + newHeight) return
        // if (newHeight < maxSize) return

        styles.top = newTop
        store = styles.height = newHeight
    }

    function resizeRight() {
        if (square && store !== null) {
            styles.width = store
            return
        }

        styles.left = mouse.left // only for snap
        store = styles.width = e.clientX / ratio - mouse.offset.width
    }

    function resizeBottom() {
        if (square && store !== null) {
            styles.height = store
            return
        }

        styles.top = mouse.top // only for snap
        styles.height = e.clientY / ratio - mouse.offset.height
    }

    return styles
}

export function rotateBox(e: any, mouse: any, ratio: number) {
    let itemElem = mouse.e.target.closest(".item")
    if (!itemElem?.closest(".slide")) return 0

    const itemPosX = itemElem.offsetLeft * ratio + itemElem.closest(".slide").offsetLeft + (itemElem.closest(".editArea") || itemElem.closest(".stageArea"))?.closest(".center")?.offsetLeft
    const itemPosY = itemElem.offsetTop * ratio + itemElem.closest(".slide").offsetTop + (itemElem.closest(".editArea") || itemElem.closest(".stageArea"))?.closest(".center")?.offsetTop

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
    for (let snapAngle of snapAngles) {
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
    let itemElem = mouse.e.target.closest(".item")
    if (!itemElem?.closest(".slide")) return 0

    const sliderStart = radiusSliderOffset
    const sliderLength = maxRadius * radiusSliderRatio

    const itemPosX = itemElem.offsetLeft * ratio + itemElem.closest(".slide").offsetLeft + (itemElem.closest(".editArea") || itemElem.closest(".stageArea"))?.closest(".center")?.offsetLeft
    const sliderPosStart = itemPosX + sliderStart * ratio
    // const sliderPosEnd = sliderPosStart + sliderLength * ratio

    const relativeX = (e.clientX - sliderPosStart) / ratio
    const percentage = Math.max(0, Math.min(sliderLength, relativeX)) / sliderLength

    return maxRadius * percentage
}
