import type { Item } from "../../../../types/Show"

// // get selection and update item object
// export function setItemSelection(items: Item[], style: any[]): Item[] {
//   let selection: null | Selection = window.getSelection()
//   let selected: any = {}
//   let styled: Item[] = []
//   // let globalIndex: null | number[] = null
//   console.log(items)

//   items.forEach((item: Item) => {
//     if (item.text) {
//       if ((selection?.rangeCount || 0 > 0) && selection?.anchorOffset !== selection?.focusOffset) {
//         // console.log(item.text)

//         let parent: Element = selection!.anchorNode!.parentElement!.closest(".edit")!
//         let from: number = selection!.anchorOffset
//         let to: number = selection!.focusOffset
//         let fromIndex: number = 0
//         let toIndex: number = 0

//         // globalIndex = [0, 0]
//         // item.text.forEach(t => {

//         // })
//         ;[...parent.children].forEach((childElem: any, i: number) => {
//           if (childElem === selection!.anchorNode!.parentElement!) fromIndex = i
//           if (childElem === selection!.focusNode!.parentElement!) toIndex = i
//           // if (i > 0 && fromIndex === 0) globalIndex![0] += childElem.innerText.length
//           // if (i > 0 && toIndex === 0) globalIndex![1] += childElem.innerText.length
//         })

//         if (fromIndex === toIndex) {
//           selected.from = { index: fromIndex, pos: Math.min(from, to) }
//           selected.to = { index: toIndex, pos: Math.max(from, to) }
//         } else if (fromIndex <= toIndex) {
//           selected.from = { index: fromIndex, pos: from }
//           selected.to = { index: toIndex, pos: to }
//         } else {
//           selected.from = { index: toIndex, pos: to }
//           selected.to = { index: fromIndex, pos: from }
//         }
//       } else {
//         // no selection
//         selected = { from: { index: 0, pos: 0 }, to: { index: item.text.length - 1, pos: item.text[item.text.length - 1].value.length } }
//       }
//     }
//     styled.push(addStyle(selected, { ...item }, style))
//   })

//   // console.log(globalIndex)

//   return styled
// }

// add new style to text by selection
export function addStyle(selection: any, item: Item, style: any[]): Item {
  // let selections: null | Selection = window.getSelection()
  // let global: null | number[] = null
  let newText: any[] = []
  let count: number = 0
  item.text!.forEach((textItem: any) => {
    // , i: number
    const length: number = textItem.value.length
    if (count <= selection[1] && count + length >= selection[0]) {
      let newStyle: string = addStyleString(textItem.style, style)

      let from: number = selection[0] - count
      let to: number = selection[1] - count

      // let from: number = 0
      // let to: number = length

      // if (count + length >= selection[0]) from = selection[0]
      // if (count <= selection[1]) to = selection[1]

      if (from > 0) newText.push({ value: textItem.value.slice(0, from), style: textItem.style })
      if (to - from > 0) newText.push({ value: textItem.value.slice(from, to), style: newStyle })
      if (to < length) newText.push({ value: textItem.value.slice(to, length), style: textItem.style })
    } else newText.push(textItem)
    count += length

    // if (i >= selection.from.index && i <= selection.to.index) {
    //   let newStyle: string = addStyleString(textItem.style, style)
    //   let from: number = 0
    //   let to: number = textItem.value.length

    //   if (selection.from.index === i) from = selection.from.pos
    //   if (selection.to.index === i) to = selection.to.pos

    //   if (from > 0) newText.push({ value: textItem.value.slice(0, from), style: textItem.style })
    //   if (to - from > 0) newText.push({ value: textItem.value.slice(from, to), style: newStyle })
    //   if (to < textItem.value.length) newText.push({ value: textItem.value.slice(to, textItem.value.length), style: textItem.style })
    // } else {
    //   newText.push(textItem)
    // }

    // ...

    // if ((selections?.rangeCount || 0 > 0) && selections?.anchorOffset !== selections?.focusOffset) {
    //   console.log(selected)

    //   if (!global) global = [selected.from.pos, selected.to.pos]

    //   console.log(i < selected.from.index, textItem.value, textItem.value.length)
    //   // TODO: break chars....

    //   if (i < selected.from.index) global[0] += textItem.value.length
    //   // else if (i === selected.from.index) global[0] += selected.from.pos
    //   if (i < selected.to.index) global[1] += textItem.value.length
    //   console.log(global)
    // }
  })

  // if (selection !== null) addNewSelection(selection)

  item.text = newText
  return combine(item)
}

// // add back selection to new elements
// function addNewSelection(selection: any) {
//   let selections: null | Selection = window.getSelection()
//   let parent: Element = selections!.anchorNode!.parentElement!.closest(".edit")!

//   // TODO: no timeout
//   setTimeout(() => {
//     if (window.getSelection()?.type === "None") {
//       // // console.log(selection)
//       // // console.log(parent.children)
//       // // console.log(global)
//       // // items.forEach((item: Item) => {
//       // // })
//       let count: number = 0
//       let child: any = null
//       ;[...parent.children].forEach((childElem: any) => {
//         count += childElem.innerText.length
//         if (child === null) {
//           if (count >= selection[0]) child = childElem
//           // // // if (pos > global[0]) p2 = childElem
//           // // console.log(selection[0], count, childElem.innerText)

//           // if (count >= selection[0]) {
//           //   child = childElem
//           //   count = selection[0] - count
//           // } else count += childElem.innerText.length
//           // // if (childElem === parent) p2 = childElem
//         }
//       })

//       // let endPos = selection[1] - selection[0] - pos
//       // console.log(pos, endPos)
//       // console.log(child.childNodes)
//       // console.log(child.childNodes[0].textContent.length)

//       // let length = child.childNodes[0].textContent.length
//       // if (pos <= length && endPos <= length) {
//       //   range.setStart(child.childNodes[0], pos)
//       //   range.setEnd(child.childNodes[0], endPos)
//       // }
//       // // range.setStart(parent.children[selected.from.index], selected.from.pos)
//       // // range.setEnd(parent.children[selected.to.index], selected.to.pos)
//       // // range.selectNodeContents(parent)

//       let range: Range = new Range()
//       range.setStart(child.childNodes[0], selection[0])
//       range.setEnd(child.childNodes[0], selection[1])
//       selections?.removeAllRanges()
//       selections?.addRange(range)
//     }
//   }, 10)
// }

// combine duplicate styles
function combine(item: Item): Item {
  // TODO: removed one char....
  // TODO: remove if value === "" ???
  let a = [...item.text!]
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

  item.text = a
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

// // convert node pos to parent pos
// export function getParentPos(elem: any, pos: number, movePos: "right" | "left" = "right"): number[] {
//   let p: number[] = [pos, 0]
//   if (window.getSelection()?.anchorNode) {
//     let parent: Element = window.getSelection()!.anchorNode!.parentElement!.closest(".edit")!

//     let found: boolean = false
//     let textLength: number = 0
//     ;[...parent.children].forEach((childElem: any) => {
//       textLength += childElem.innerText.length
//       if (elem.parentElement === childElem) {
//         if (movePos === "right" && pos === elem.length && p[1] < parent.children.length - 1) p[1]++
//         else if (movePos === "left" && pos === 1 && p[1] > 0) p[1]--
//         found = true
//       } else if (!found) {
//         p[0] += childElem.innerText.length
//         p[1]++
//       }
//     })

//     if (movePos === "right") {
//       if (p[0] < textLength) p[0]++
//     } else if (p[0] > 0) p[0]--
//   }

//   return p
// }

// get selection range start to end or cursor pos
export function getSelectionRange(): [number, number] {
  let selection: null | Selection = window.getSelection()
  let start: null | number = null
  let end: null | number = null

  if (selection?.anchorNode) {
    let parent: Element = selection.anchorNode.parentElement!.closest(".edit")!
    let startNode = selection.anchorNode.parentNode
    let endNode = selection.focusNode?.parentNode
    let startOffset = selection.anchorOffset
    let endOffset = selection.focusOffset

    let count = 0

    if (parent) {
      new Array(...parent.children).forEach((child: any) => {
        if (selection!.containsNode(child, true)) {
          // if start not set & child is start & (child is not end or end is bigger than start)
          if (start === null && child === startNode && (child !== endNode || endOffset > startOffset)) {
            start = count + startOffset
          } else if ((start === null && child === endNode) || (child === startNode && startOffset > endOffset)) {
            start = count + endOffset
            endNode = startNode
            endOffset = startOffset
          }
          if (start !== null) {
            if (selection!.containsNode(child)) {
              if (!end) end = count
              end += child.innerText.length
            } else end = count + endOffset
          }
        }
        count += child.innerText.length
      })
    }
  }

  return [start || 0, end || 0]
}

// return item style at text length pos
export function getItemStyleAtPos(textArray: { value: string; style: string }[], pos: number) {
  let currentPos: number = 0
  let style: string = ""

  textArray.some((text): any => {
    currentPos += text.value.length

    // TODO: \n ....
    if (currentPos >= pos) {
      style = text.style
      return true
    }
  })

  return style
}

// get text of item.text...
export function getItemText(item: Item): string {
  let text: string = ""
  if (item.text) item.text.forEach((content) => (text += content.value))
  return text.replaceAll("<br>", "")
}

// seperate text with breaks
export function getItemLines(item: Item): string[] {
  let text: string = ""
  if (item.text) item.text.forEach((content) => (text += content.value))
  return text.split("<br>")
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
      console.log("CARET: ", range, preCaretRange, caretOffset)
    }
    // } else if ((sel = doc.selection) && sel.type != "Control") {
    //   var textRange = sel.createRange()
    //   var preCaretTextRange = doc.body.createTextRange()
    //   preCaretTextRange.moveToElementText(element)
    //   preCaretTextRange.setEndPoint("EndToEnd", textRange)
    //   caretOffset = preCaretTextRange.text.length
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

  console.log("CREATE RANGE: ", pos, range, node)

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
export function setCurrentCursorPosition(element: any, pos: number) {
  if (pos >= 0) {
    var selection = window.getSelection()

    let range: any = createRange(element, pos)
    // let range: any = createRange(element.childNodes[0], 5)
    // console.log(element, pos, range)

    if (range) {
      range.collapse(false)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }
}
