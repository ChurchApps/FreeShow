import type { Item } from "../../../../types/Show"
import { getStyles } from "../../helpers/style"
import { getItemLines, getItemText } from "./textStyle"

// TODO: check line length
export function getAutoSize(item: any, styles: any = null, oneLine: boolean = false): number {
    let size: number = 0

    if (styles === null) styles = getStyles(item.style, true)

    let lines: string[] = getItemLines(item)
    if (!lines.length) lines = ["0000000"]

    let itemHeight = styles.height
    let itemWidth = styles.width

    let fullTextLength = getItemText(item).length
    // TODO: this is not much in use:
    if (!oneLine && fullTextLength > 10) {
        // dont ask me how this works

        // this is very hacky, shouldn't be this complicated
        size = ((itemHeight * itemWidth) / 3500000 / (fullTextLength + fullTextLength)) * 14000

        // get low value to multiply by value
        let hmm = Math.max(1.8, fullTextLength / 200)
        // increased by higher values
        let idk = Math.max(220, fullTextLength * hmm)
        // get lower values with higher length
        let inverter = Math.max(1, (1.8 / fullTextLength) * idk)
        // divide on higher values as length grows
        let reducer = Math.max(40, fullTextLength / inverter)
        // slowly increment as text grows
        let divider = Math.max(1, fullTextLength / reducer)

        size *= 1.5 * divider

        return size
    }

    let longestLine: number = lines.sort((a, b) => b.length - a.length)[0].length

    // TODO: letter spacing....?
    if (itemHeight / lines.length / itemWidth > 1.8 / longestLine) {
        size = (itemWidth / longestLine) * 1.5
    } else {
        size = (itemHeight / lines.length) * 0.6
    }

    return size
}

export const MAX_FONT_SIZE = 800
export const MIN_FONT_SIZE = 10
export function getMaxBoxTextSize(elem: any, parentElem: HTMLElement, item: Item | null = null) {
    let maxFontSize = MAX_FONT_SIZE
    let minFontSize = MIN_FONT_SIZE

    let invisibleBox = elem.cloneNode(true)
    invisibleBox.classList.add("invisible")
    parentElem.append(invisibleBox)

    let type = item?.textFit || "shrinkToFit"
    // shrinkToFit: text is set font size by default, but can shrink if the text does not fit in the textbox
    // growToFit: text will grow to fill the entire textbox, but maximum the set font size

    const itemText = item?.lines?.[0]?.text?.filter((a) => a.customType !== "disableTemplate") || []
    let itemFontSize = Number(getStyles(itemText[0]?.style, true)?.["font-size"] || "") || 100
    if (type === "shrinkToFit") {
        let textIsBiggerThanBox = invisibleBox.scrollHeight > invisibleBox.offsetHeight || invisibleBox.scrollWidth > invisibleBox.offsetWidth
        if (textIsBiggerThanBox) {
            // change type if text is bigger than box
            type = "growToFit"
        } else {
            // don't change the font size
            return itemFontSize
        }
    }
    if (type === "growToFit") {
        // set max font size to the current set text font size
        maxFontSize = itemFontSize
    }

    let fontSize = maxFontSize
    addStyleToElemText(fontSize)

    // quick search (double divide)
    let lowestValue = minFontSize
    let highestValue = maxFontSize
    let biggerThanSize = true
    while (highestValue - lowestValue > 3) {
        let difference = (highestValue - lowestValue) / 2
        if (biggerThanSize) {
            highestValue = fontSize
            fontSize -= difference
        } else {
            lowestValue = fontSize
            fontSize += difference
        }

        addStyleToElemText(fontSize)
        biggerThanSize = invisibleBox.scrollHeight > invisibleBox.offsetHeight || invisibleBox.scrollWidth > invisibleBox.offsetWidth
    }
    fontSize = lowestValue // prefer lowest value
    if (fontSize > maxFontSize) fontSize = maxFontSize

    function addStyleToElemText(fontSize) {
        for (let breakElem of invisibleBox.children) {
            for (let txt of breakElem.children) {
                txt.style.fontSize = fontSize + "px"
            }
        }
    }

    invisibleBox.remove()

    return fontSize
}
