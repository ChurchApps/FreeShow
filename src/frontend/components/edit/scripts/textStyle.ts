import type { Item, Line } from "../../../../types/Show"

// add new style to text by selection
export function addStyle(selection: { start: number; end: number }[], item: Item, style: any[]): Item {
  // let selections: null | Selection = window.getSelection()
  // let global: null | number[] = null
  item.lines?.forEach((line, i) => {
    let newText: any[] = []
    let pos: number = 0
    if (selection[i].start !== undefined) {
      line.text!.forEach((text: any) => {
        // , i: number
        // TODO: .replaceAll("<br>", "")
        const length: number = text.value.length
        let from = 0
        let to = length
        if (pos < selection[i].start && pos + length > selection[i].start) from = selection[i].start - pos
        if (pos < selection[i].end && pos + length > selection[i].end) to = selection[i].end - pos

        if (
          (pos < selection[i].start && pos + length > selection[i].start) ||
          (pos < selection[i].end && pos + length > selection[i].end) ||
          (pos >= selection[i].start && pos + length <= selection[i].end)
        ) {
          if (from > 0) newText.push({ value: text.value.slice(0, from), style: text.style })
          if (to - from > 0 && to - from <= length) {
            let newStyle: string = addStyleString(text.style, style)
            newText.push({ value: text.value.slice(from, to), style: newStyle })
          }
          if (to < length) newText.push({ value: text.value.slice(to, length), style: text.style })
        } else newText.push(text)

        pos += length
      })
    } else newText.push(...line.text)

    line.text = newText
  })

  return combine(item)
}

// combine duplicate styles
function combine(item: Item): Item {
  // TODO: removed one char....
  // TODO: remove if value === "" ???
  item.lines?.forEach((line) => {
    let a = [...line.text!]
    for (let i = 0; i < a.length; i++) {
      if (a[i + 1]) {
        let d1: any[] = [],
          d2: any[] = []
        let sameStyles: boolean = false
        if (a[i].style) d1.push(a[i].style)
        if (a[i + 1].style) d2.push(a[i + 1].style)
        if (d1.length === d2.length) {
          d1.sort()
          d2.sort()
          sameStyles = d1.every((val, j) => val.replaceAll(" ", "").replace(";", "") === d2[j].replaceAll(" ", "").replace(";", ""))
        }

        if (sameStyles) {
          a[i].value += a[i + 1].value
          a.splice(i + 1, 1)
          i--
        }
      }
    }

    // item.lines![i].text = a
    line.text = a
  })
  return item
}

// add new style to string and remove old
export function addStyleString(oldStyle: string, style: any[]): string {
  let array: string[] = oldStyle.split(";")
  // remove last if empty
  if (!array[array.length - 1].length) array.pop()
  // remove old styles
  array.forEach((s, i) => {
    if (s.split(":")[0].includes(style[0]) || !s.length) array.splice(i, 1)
  })
  // add new style
  if (style[1] !== null) array.push(style.join(":"))

  let newStyle: string = array.join(";")
  if (newStyle.slice(-1) !== ";") newStyle += ";"
  return newStyle
}

// get selection range start to end or cursor pos
export function getSelectionRange(): { start: number; end: number }[] {
  let selection: null | Selection = window.getSelection()
  let sel: any[] = []
  let start: null | number = null
  let end: null | number = null

  if (selection?.anchorNode) {
    let parent: Element = selection.anchorNode.parentElement!.closest(".edit")!
    let startNode = selection.anchorNode.parentNode
    let endNode = selection.focusNode?.parentNode
    let startOffset = selection.anchorOffset
    let endOffset = selection.focusOffset

    if (parent) {
      new Array(...parent.childNodes).forEach((br: any, line: number) => {
        if (!sel[line]) sel[line] = {}
        let count: number = 0
        new Array(...br.childNodes).forEach((child: any) => {
          if (selection!.containsNode(child, true)) {
            // if start not set & child is start & (child is not end or end is bigger than start)
            if (start === null && child === startNode && (child !== endNode || endOffset > startOffset)) {
              start = count + startOffset
              sel[line].start = start
            } else if ((start === null && child === endNode) || (child === startNode && startOffset > endOffset)) {
              start = count + endOffset
              sel[line].start = start
              endNode = startNode
              startNode = selection!.focusNode?.parentNode!
              endOffset = startOffset
            }
            if (start !== null) {
              if (!sel[line].start) sel[line].start = 0

              if ((child === startNode && child !== endNode) || selection!.containsNode(child)) {
                if (end === null) end = count
                end += child.innerText.length
                sel[line].end = end
              } else {
                end = count + endOffset
                sel[line].end = end
              }
            }
          }
          count += child.innerText.length
        })
      })
    }
  }

  return sel
}

// return item style at text length pos
export function getItemStyleAtPos(lines: Line[], pos: null | { start: number; end: number }[]) {
  let currentPos: number = 0
  let style: string = ""

  ;(pos || lines).forEach((_a: any, i: number) => {
    lines[i]?.text.some((text): any => {
      currentPos += text.value.length

      if (pos && currentPos >= pos[i].end) {
        style = text.style
        return true
      }
    })
  })
  if (!style.length) style = lines[lines.length - 1].text[lines[lines.length - 1].text.length - 1].style

  return style
}

// get text of item.text...
export function getItemText(item: Item): string {
  let text: string = ""
  if (item.lines)
    item.lines.forEach((line) => {
      line.text.forEach((content) => {
        text += content.value
      })
    })
  return text
}

export function getLineText(line: any): string {
  let text: string = ""
  line.text?.forEach((content: any) => {
    text += content.value
  })
  return text
}

// seperate text with breaks
export function getItemLines(item: Item): string[] {
  // return (
  //   item.lines?.map((line) => {
  //     let text = ""
  //     line.text.map((content) => (text += content.value))
  //     return text
  //   }) || []
  // )
  let lines: string[] = []
  item.lines?.forEach((line) => {
    let text = ""
    line.text.forEach((content) => (text += content.value))
    lines.push(text)
  })
  return lines
}

// get caret pos (WIP)
// https://stackoverflow.com/questions/4811822/get-a-ranges-start-and-end-offsets-relative-to-its-parent-container/4812022#4812022
export function getCaretCharacterOffsetWithin(element: any) {
  var caretOffset = 0
  var doc = element.ownerDocument || element.document
  var win = doc.defaultView || doc.parentWindow
  var sel
  if (typeof win.getSelection !== "undefined") {
    sel = win.getSelection()
    if (sel.rangeCount > 0) {
      var range = win.getSelection().getRangeAt(0)
      var preCaretRange = range.cloneRange()
      preCaretRange.selectNodeContents(element)
      preCaretRange.setEnd(range.endContainer, range.endOffset)
      caretOffset = preCaretRange.toString().length
    }
  }
  return caretOffset
}

export function setCaret(element: any) {
  var range = document.createRange()
  var sel = window.getSelection()

  range.setStart(element.childNodes[2], 5)
  range.collapse(true)

  sel?.removeAllRanges()
  sel?.addRange(range)
}

// https://stackoverflow.com/questions/6249095/how-to-set-the-caret-cursor-position-in-a-contenteditable-element-div
function createRange(node: any, pos: number, range: any = null) {
  if (!range) {
    range = document.createRange()
    range.selectNode(node)
    range.setStart(node, 0)
  }

  if (pos === 0) {
    range.setEnd(node, pos)
  } else if (node && pos > 0) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.length < pos) {
        pos -= node.textContent.length
      } else {
        range.setEnd(node, pos)
        pos = 0
      }
    } else {
      for (var lp = 0; lp < node.childNodes.length; lp++) {
        range = createRange(node.childNodes[lp], pos, range)

        if (pos === 0) {
          break
        }
      }
    }
  }

  return range
}
export function createRange2(node: any, selection: { start: number; end: number }[], range: any = null) {
  if (!range) {
    range = document.createRange()
    range.selectNode(node)
    range.setEnd(node, 0)
  }

  // console.log("CREATE RANGE: ", selection, range, node)

  let started = false
  let ended = false

  selection.forEach((a, i) => {
    if (a.start !== undefined && (!started || !ended)) {
      let br = node.children[i]
      let pos: null | number = 0
      if (br.childNodes.length) {
        new Array(...br.childNodes).forEach((text: any) => {
          pos += text.innerText.length
          if (!started && pos !== null && pos >= a.start) {
            started = true
            pos = null
            range.setStart(text.firstChild, a.start)
          }
          if (!ended && pos !== null && pos >= a.end) {
            ended = true
            pos = null
            range.setEnd(text.firstChild, a.end)
          }
        })
      }
    }
  })

  return range
}
export function setCurrentCursorPosition(element: any, pos: number) {
  if (pos >= 0) {
    var selection = window.getSelection()

    // pos = 90
    // pos = 142
    let range: any = createRange(element, pos)

    // let range: any = createRange(element.childNodes[0], 5)

    if (range) {
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }
}
