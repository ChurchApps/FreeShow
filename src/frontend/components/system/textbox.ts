import { getStyles } from "./../helpers/style"

const snapDistance: number = 8
export function moveBox(e: any, mouse: any, ratio: number, active: any, lines: any, styles: any = {}) {
    const itemElem = mouse.e.target.closest(".item")
    if (!itemElem.closest(".slide")) return

    if (e) {
        styles.left = (e.clientX - itemElem.closest(".slide").offsetLeft) / ratio - mouse.offset.x
        styles.top = (e.clientY - itemElem.closest(".slide").offsetTop) / ratio - mouse.offset.y
    }

    if (e?.altKey) lines = []
    else snapBox()

    function snapBox() {
        const slideWidth = Math.round(itemElem.closest(".slide").offsetWidth / ratio)
        const slideHeight = Math.round(itemElem.closest(".slide").offsetHeight / ratio)

        // slide snap
        const xLines = [0, slideWidth / 2, slideWidth]
        const yLines = [0, slideHeight / 2, slideHeight]
        // item snap
        const xItems = [0, itemElem.offsetWidth / 2, itemElem.offsetWidth]
        const yItems = [0, itemElem.offsetHeight / 2, itemElem.offsetHeight]

        // get other items pos
        ;[...itemElem.closest(".slide").querySelectorAll(".item")].filter((a) => !a.closest(".preview")).forEach(getItemLines)

        function getItemLines(item: any, i: number) {
            let id = i
            if (item.id) id = item.id
            if (active.includes(id)) return

            const style: any = getStyles(item.getAttribute("style"))
            Object.entries(style).map((s: any) => (style[s[0]] = Number(s[1].replace(/[^-0-9\.]+/g, ""))))
            xLines.push(style.left, style.left + style.width / 2, style.left + style.width)
            yLines.push(style.top, style.top + style.height / 2, style.top + style.height)
        }

        checkMatch(xLines, xItems, "x", snapDistance / ratio)
        checkMatch(yLines, yItems, "y", snapDistance / ratio)

        // center is easier to snap to
        checkMatch([slideWidth / 2], [itemElem.offsetWidth / 2], "xc", (snapDistance * 2) / ratio)
        checkMatch([slideHeight / 2], [itemElem.offsetHeight / 2], "yc", (snapDistance * 2) / ratio)
    }

    function checkMatch(allLines: number[], items: any[], id: string, margin: any) {
        const side = id.includes("x") ? "left" : "top"

        allLines.forEach((l: number) => {
            const style = Number(styles[side]?.toString().replace(/[^-0-9\.]+/g, ""))
            const match: undefined | number = items.find((i: any) => style > l - i - margin && style < l - i + margin)
            if (match !== undefined) styles[side] = l - match

            const linesInclude = lines
                .join(".")
                .replaceAll(",", "")
                .includes(id + l)
            if (match !== undefined && !linesInclude) lines = [...lines, [id, l]]
            else if (match === undefined && linesInclude) lines = lines.filter((m: any) => m.join("") !== id + l)
        })
    }

    // remove item margin snap when aligned to items
    // WIP make this work and not get stuck
    // let verticalLines = lines.filter((a) => a[0].includes("x"))
    // let centeredLine = lines.find((a) => a[0].includes("xc"))
    // console.log(centeredLine, verticalLines)
    // if (!centeredLine && verticalLines.length > 1) {
    //     styles.left = verticalLines[0][1]
    //     styles.width = (verticalLines[2]?.[1] || verticalLines[1][1]) - verticalLines[0][1]
    // }

    // WIP remove duplicate lines (both x and same coords (or less than very simular))

    return [styles, lines]
}

export function resizeBox(e: any, mouse: any, square: boolean, ratio: number, lines: any) {
    const itemElem = mouse.e.target.closest(".item")
    const styles: any = {}
    let store: null | number = null
    const squareElem = mouse.e.target.closest(".square")

    if (squareElem.classList[1].includes("w")) resizeLeft()
    if (squareElem.classList[1].includes("n")) resizeTop()
    if (squareElem.classList[1].includes("e")) resizeRight()
    if (squareElem.classList[1].includes("s")) resizeBottom()

    function resizeLeft() {
        const newLeft: number = (e.clientX - itemElem.closest(".slide").offsetLeft) / ratio - mouse.offset.x
        styles.left = newLeft
        store = styles.width = mouse.width - newLeft + mouse.left
    }

    function resizeTop() {
        if (square && store !== null) {
            styles.height = store
            return
        }

        const newTop: number = (e.clientY - itemElem.closest(".slide").offsetTop) / ratio - mouse.offset.y
        styles.top = newTop
        store = styles.height = mouse.height - newTop + mouse.top
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

    // WIP snap when resizing!
    console.log(lines)
    // let xSnap = lines.filter((a) => a[0] === "x").map((a) => a[1])
    // let ySnap = lines.filter((a) => a[0] === "y").map((a) => a[1])
    // const margin = 10
    // if (xSnap.length >= 2) {
    //     let newLeft = Math.min(...xSnap)
    //     let newWidth = Math.max(...xSnap)
    //     console.log(styles, newLeft, newWidth)

    //     if (Math.abs(newLeft - styles.left) < margin) styles.left = newLeft
    //     if (Math.abs(newWidth - styles.width) < margin) styles.width = newWidth
    // }
    // if (ySnap.length >= 2) {
    //     let newTop = Math.min(...ySnap)
    //     let newHeight = Math.max(...ySnap)

    //     if (Math.abs(newTop - styles.top) < margin) styles.top = newTop
    //     if (Math.abs(newHeight - styles.height) < margin) styles.height = newHeight
    // }

    return styles
}
