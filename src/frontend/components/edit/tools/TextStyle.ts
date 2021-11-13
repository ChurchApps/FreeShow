import type { Item } from "../../../../types/Show"

// get selection and update item object
export function setItemSelection(items: Item[], style: any[]): Item[] {
  let selection: null | Selection = window.getSelection()
  let selected: any = {}
  let styled: Item[] = []
  // let globalIndex: null | number[] = null
  console.log(items)

  items.forEach((item: Item) => {
    if (item.text) {
      if ((selection?.rangeCount || 0 > 0) && selection?.anchorOffset !== selection?.focusOffset) {
        // console.log(item.text)

        let parent: Element = selection!.anchorNode!.parentElement!.closest(".edit")!
        let from: number = selection!.anchorOffset
        let to: number = selection!.focusOffset
        let fromIndex: number = 0
        let toIndex: number = 0

        // globalIndex = [0, 0]
        // item.text.forEach(t => {

        // })
        ;[...parent.children].forEach((childElem: any, i: number) => {
          if (childElem === selection!.anchorNode!.parentElement!) fromIndex = i
          if (childElem === selection!.focusNode!.parentElement!) toIndex = i
          // if (i > 0 && fromIndex === 0) globalIndex![0] += childElem.innerText.length
          // if (i > 0 && toIndex === 0) globalIndex![1] += childElem.innerText.length
        })

        if (fromIndex === toIndex) {
          selected.from = { index: fromIndex, pos: Math.min(from, to) }
          selected.to = { index: toIndex, pos: Math.max(from, to) }
        } else if (fromIndex <= toIndex) {
          selected.from = { index: fromIndex, pos: from }
          selected.to = { index: toIndex, pos: to }
        } else {
          selected.from = { index: toIndex, pos: to }
          selected.to = { index: fromIndex, pos: from }
        }
      } else {
        // no selection
        selected = { from: { index: 0, pos: 0 }, to: { index: item.text.length - 1, pos: item.text[item.text.length - 1].value.length } }
      }
    }
    styled.push(addStyle(selected, { ...item }, style))
  })

  // console.log(globalIndex)

  return styled
}

// add new style to text by selection
function addStyle(selected: any, item: Item, style: any[]): Item {
  let selection: null | Selection = window.getSelection()
  let global: null | number[] = null
  let newText: any[] = []
  item.text!.forEach((textItem: any, i: number) => {
    if (i >= selected.from.index && i <= selected.to.index) {
      let newStyle: string = addStyleString(textItem.style, style)
      let from: number = 0
      let to: number = textItem.value.length

      if (selected.from.index === i) from = selected.from.pos
      if (selected.to.index === i) to = selected.to.pos

      if (from > 0) newText.push({ value: textItem.value.slice(0, from), style: textItem.style })
      if (to - from > 0) newText.push({ value: textItem.value.slice(from, to), style: newStyle })
      if (to < textItem.value.length) newText.push({ value: textItem.value.slice(to, textItem.value.length), style: textItem.style })
    } else {
      newText.push(textItem)
    }

    if ((selection?.rangeCount || 0 > 0) && selection?.anchorOffset !== selection?.focusOffset) {
      console.log(selected)

      if (!global) global = [selected.from.pos, selected.to.pos]

      console.log(i < selected.from.index, textItem.value, textItem.value.length)
      // TODO: break chars....

      if (i < selected.from.index) global[0] += textItem.value.length
      // else if (i === selected.from.index) global[0] += selected.from.pos
      if (i < selected.to.index) global[1] += textItem.value.length
      console.log(global)
    }
  })

  if (global) addNewSelection(global)

  item.text = newText
  return combine(item)
}

// add back selection to new elements
function addNewSelection(global: any) {
  let selection: null | Selection = window.getSelection()
  let range: Range = new Range()
  let parent: Element = selection!.anchorNode!.parentElement!.closest(".edit")!

  // let selected: any = {}
  // TODO: no timeout
  setTimeout(() => {
    let currentSelection: null | Selection = window.getSelection()
    if (currentSelection?.rangeCount || 0 > 0) {
      console.log(selection)
      console.log(parent.children)
      console.log(global)
      // items.forEach((item: Item) => {
      // })
      let pos: number = 0
      let child: any = null
      ;[...parent.children].forEach((childElem: any) => {
        if (child === null) {
          // if (pos > global[0]) p2 = childElem
          console.log(global[0], pos, childElem.innerText)

          if (pos >= global[0]) {
            child = childElem
            pos = global[0] - pos
          } else pos += childElem.innerText.length
          // if (childElem === parent) p2 = childElem
        }
      })

      let endPos = global[1] - global[0] - pos
      console.log(pos, endPos)
      console.log(child.childNodes)
      console.log(child.childNodes[0].textContent.length)

      let length = child.childNodes[0].textContent.length
      if (pos <= length && endPos <= length) {
        range.setStart(child.childNodes[0], pos)
        range.setEnd(child.childNodes[0], endPos)
      }
      // range.setStart(parent.children[selected.from.index], selected.from.pos)
      // range.setEnd(parent.children[selected.to.index], selected.to.pos)
      // range.selectNodeContents(parent)
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }, 10)
}

// combine duplicate styles
function combine(item: Item): Item {
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
  if (!array[array.length - 1].length) array.pop()
  array.forEach((s, i) => {
    if (s.split(":")[0].includes(style[0]) || !s.length) array.splice(i, 1)
  })

  array.push(style.join(":"))
  let newStyle: string = array.join(";")
  if (newStyle.slice(-1) !== ";") newStyle += ";"
  return newStyle
}

// convert node pos to parent pos
export function getParentPos(elem: any, pos: number, movePos: "right" | "left" = "right"): number[] {
  let parent: Element = window.getSelection()!.anchorNode!.parentElement!.closest(".edit")!
  let p: number[] = [pos, 0]

  let found: boolean = false
  let textLength: number = 0
  ;[...parent.children].forEach((childElem: any) => {
    textLength += childElem.innerText.length
    if (elem.parentElement === childElem) {
      if (movePos === "right" && pos === elem.length && p[1] < parent.children.length - 1) p[1]++
      else if (movePos === "left" && pos === 1 && p[1] > 0) p[1]--
      found = true
    } else if (!found) {
      p[0] += childElem.innerText.length
      p[1]++
    }
  })

  if (movePos === "right") {
    if (p[0] < textLength) p[0]++
  } else if (p[0] > 0) p[0]--

  return p
}
