import type { StringObject } from "../../../types/Main"
export const getStyles = (str: string | null | undefined, removeText: boolean = false) => {
  let styles: StringObject = {}
  if (str?.length) {
    str.split(";").forEach((s) => {
      if (s.length) {
        let key: string = s.slice(0, s.indexOf(":")).trim()
        let style: string = s.slice(s.indexOf(":") + 1, s.length).trim()
        if (
          !key.includes("color") &&
          key !== "text-decoration" &&
          key !== "text-shadow" &&
          key !== "box-shadow" &&
          removeText &&
          style.length > style.replace(/[^0-9.-]/g, "").length &&
          style.replace(/[^0-9.-]/g, "").length > 0
        )
          style = style.replace(/[^0-9.-]/g, "")
        styles[key] = style
      }
    })
  }
  return styles
}
