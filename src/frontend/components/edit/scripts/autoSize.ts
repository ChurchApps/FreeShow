import { GetLayout } from "../../helpers/get"
import { get } from "svelte/store"
import { activeEdit, activeShow } from "../../../stores"
import { _show } from "../../helpers/shows"
import { getStyles } from "../../helpers/style"
import { addStyleString, getItemLines } from "./textStyle"

// TODO: deprecated function
export function autoSize(items: number[], fullItems: any[], check: boolean = true) {
  let values: any[] = []
  fullItems.forEach((item, i) => {
    if (!check || item.auto) {
      let styles: any = getStyles(item.style)

      let lines = getItemLines(item)
      let length = lines.sort((a, b) => b.length - a.length)[0].length
      // console.log(lines)
      let size: any
      // TODO: letter spacing....?
      if (styles.height.replace(/\D.+/g, "") / lines.length / styles.width.replace(/\D.+/g, "") > 1.8 / length) {
        size = (styles.width.replace(/\D.+/g, "") / length) * 1.4
      } else {
        size = (styles.height.replace(/\D.+/g, "") / lines.length) * 0.8
      }
      values.push([])
      item.lines?.forEach((line: any) => {
        values[i].push(
          line.text.map((a: any) => {
            a.style = addStyleString(a.style, ["font-size", size + "px"])
            return a
          })
        )
      })
    }
  })

  if (values.length) {
    _show([get(activeShow)!.id])
      .slides([GetLayout()[get(activeEdit).slide!].id])
      .items(items)
      .lines()
      .set({ key: "text", values: values })
  }
}

// TODO: check line length
export function getAutoSize(item: any, styles: any = null): number {
  let size: number = 0

  if (styles === null) styles = getStyles(item.style, true)

  let lines: string[] = getItemLines(item)
  if (!lines.length) lines = ["0000000"]
  let length: number = lines.sort((a, b) => b.length - a.length)[0].length

  // TODO: letter spacing....?
  if (styles.height / lines.length / styles.width > 1.8 / length) {
    size = (styles.width / length) * 1.5
  } else {
    size = (styles.height / lines.length) * 0.6
  }

  return size
}
