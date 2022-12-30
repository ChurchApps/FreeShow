import { getStyles } from "./style"
import { getItemLines } from "./textStyle"

export function getAutoSize(item: any, styles: any = null): number {
  let size: number = 0

  if (styles === null) styles = getStyles(item.style, true)

  let lines: string[] = item ? getItemLines(item) : []
  if (!lines.length) lines = ["0000000"]
  // length of longest line
  let length: number = lines.sort((a, b) => b.length - a.length)[0].length

  // let textWidth = length * 12
  // let textHeight = lines.length * 50
  // // console.log(textWidth, textHeight)
  // // console.log(styles.width - textWidth, styles.height - textHeight)
  // console.log(styles.width, textWidth, styles.height, textHeight)
  // // console.log(textHeight, styles.height)

  // TODO: letter spacing....?
  // console.log(styles.height / lines.length / styles.width)
  // console.log(length)
  if (styles.height / lines.length / styles.width > 1.8 / length) {
    size = (styles.width / length) * 1.5
  } else {
    size = (styles.height / lines.length) * 0.6
  }

  // if (styles.height / lines.length / styles.width > 1.8 / length) {
  //   size = (styles.width / length) * 1.6
  // } else {
  //   size = (styles.height / lines.length) * 0.9
  // }

  return size
}
