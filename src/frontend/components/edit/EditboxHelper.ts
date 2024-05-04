import type { Item, Line } from "../../../types/Show"

export class EditboxHelper {
  static determineCaretLine(item:Item, newLines: Line[]) {
    let changeCount = 0
    let lastChangedLine = -1

    if (newLines.length !== item?.lines?.length) {
        for (let i = 0; i < newLines.length; i++) {
            let oldVal = "(blank)"
            if (item?.lines && item.lines.length > i) oldVal = item.lines[i].text[0].value
            console.log("COMPARING", i, newLines[i].text[0].value, "**", oldVal)
            if (newLines[i].text[0].value !== oldVal) {
                changeCount++
                lastChangedLine = i
                console.log("CHANGED LINE", i, newLines[i].text[0].value, "**", oldVal)
                if (changeCount > 1) break
            }
        }
    }
    return lastChangedLine
}

}