export function getStyleResolution(resolution: any, width: any, height: any, fill: "contain" | "fit" | "fill" | "cover" = "contain"): string {
  let style: any = { width: null, height: null }

  if (fill === "fill") style = { width: "100%", height: "100%" }
  else {
    if (resolution.width <= width) {
      if (fill === "fit") style.width = "100%"
      else style.width = resolution.width + "px"
    } else if (width / resolution.width < height / resolution.height) style.width = "100%"
    else style.width = null

    if (resolution.height <= height) {
      if (fill === "fit") style = { width: null, height: "100%" }
      else style.height = resolution.height + "px"
    } else if (height / resolution.height <= width / resolution.width) style = { width: null, height: "100%" }
    else style.height = null
  }

  return style.width ? "width: " + style.width + ";" : "" + style.height ? "height: " + style.height + ";" : ""
}
