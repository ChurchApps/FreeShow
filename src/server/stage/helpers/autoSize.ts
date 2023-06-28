import { getStyles } from "./style"
import { getItemLines, getItemText } from "./textStyle"

export function getAutoSize(item: any, styles: any = null, oneLine: boolean = false): number {
    let size: number = 0

    if (styles === null) styles = getStyles(item.style, true)

    let lines: string[] = getItemLines(item)
    if (!lines.length) lines = ["0000000"]

    let itemHeight = styles.height
    let itemWidth = styles.width

    let fullTextLength = getItemText(item).length
    if (!oneLine && fullTextLength > 10) {
        // dont ask me how this works

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

    if (itemHeight / lines.length / itemWidth > 1.8 / longestLine) {
        size = (itemWidth / longestLine) * 1.5
    } else {
        size = (itemHeight / lines.length) * 0.6
    }

    return size
}
