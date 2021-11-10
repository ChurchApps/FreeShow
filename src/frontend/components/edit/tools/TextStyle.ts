import type { Item } from "../../../../types/Show"

// get selection and update item object
export function setItemSelection(item: Item, style: any[]) {
  let sel: null | Selection = window.getSelection()

  let selected: any = {}
  if (item.text) {
    if ((sel?.rangeCount || 0 > 0) && sel?.anchorOffset !== sel?.focusOffset) {
      let parent: Element = sel!.anchorNode!.parentElement!.closest(".edit")!
      let from: number = sel!.anchorOffset
      let to: number = sel!.focusOffset
      let fromIndex: number = 0
      let toIndex: number = 0

      ;[...parent.children].forEach((childElem: any, i: number) => {
        if (childElem === sel!.anchorNode!.parentElement!) fromIndex = i
        if (childElem === sel!.focusNode!.parentElement!) toIndex = i
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
  return addStyle(selected, item, style)
}

// add new style to text by selection
function addStyle(selected: any, item: Item, style: any[]): Item {
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
  })

  item.text = newText
  return combine(item)
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
function addStyleString(oldStyle: string, style: any[]): string {
  let array: string[] = oldStyle.split(";")
  if (!array[array.length - 1].length) array.pop()
  array.forEach((s, i) => {
    if (s.split(":")[0].includes(style[0]) || !s.length) array.splice(i, 1)
  })

  array.push(style.join(":"))
  return array.join(";") + ";"
}
