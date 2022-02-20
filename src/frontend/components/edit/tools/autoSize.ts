import { GetLayout } from "./../../helpers/get"
import { get } from "svelte/store"
import { activeEdit, activeShow } from "../../../stores"
import { _show } from "../../helpers/shows"
import { getStyles } from "../../helpers/style"
import { addStyleString, getItemLines } from "./textStyle"

export function autoSize(items: number[], fullItems: any[], check: boolean = true) {
  let values: any[] = []
  fullItems.forEach((item, i) => {
    if (!check || item.auto) {
      let styles: any = getStyles(item.style)

      let lines = getItemLines(item)
      let length = lines.sort((a, b) => b.length - a.length)[0].length
      console.log(lines)
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
