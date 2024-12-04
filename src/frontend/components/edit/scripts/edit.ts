import { hexToRgb, splitRgb } from "../../helpers/color"
import type { EditInput } from "../values/boxes"

export function getOriginalValue(boxEdit: { [key: string]: EditInput[] }, key: string): string {
    const values: any[] = []
    Object.values(boxEdit).forEach((inputs: any[]) => {
        inputs.forEach((input: any) => {
            if (input.key === key) values.push(input)
        })
    })

    if (!values.length) return ""
    if (values.length === 1) return values[0].value
    return values
        .sort((a: any, b: any) => (a.valueIndex > b.valueIndex ? 1 : -1))
        .map((a) => a.value + (a.extension || ""))
        .join(" ")
}

export function removeExtension(value: string | number | boolean, extension: string | undefined): string | number | boolean {
    if (!extension || typeof value !== "string") return value
    return value.replace(/[^0-9.-]/g, "")
}

// export function editValue(id: "box" | "media", key: string, value: any) {

// }

// BACKGROUND COLOR (with opacity)

export function setBackgroundColor(input: any, data: any) {
    const backgroundColor = input.key === "background-color" ? input.value || "" : data["background-color"] || "rgb(0 0 0);"
    const rgb = backgroundColor.includes("rgb") ? splitRgb(backgroundColor) : hexToRgb(backgroundColor)
    const opacity = input.id === "background-opacity" ? input.value : getOldOpacity(data)
    const newColor = "rgb(" + [rgb.r, rgb.g, rgb.b].join(" ") + " / " + opacity + ");"

    input.key = "background-color"
    input.value = newColor

    return input
}

function getOldOpacity(data) {
    const backgroundValue = data["background-color"] || ""
    if (!backgroundValue.includes("rgb")) return 1

    const rgb = splitRgb(backgroundValue)
    return rgb.a
}

export function getBackgroundOpacity(itemEditValues, data) {
    const backgroundValue = data["background-color"] || ""
    const boIndex = itemEditValues.style.findIndex((a) => a.id === "background-opacity")
    if (boIndex < 0) return itemEditValues

    if (!backgroundValue.includes("rgb")) {
        itemEditValues.style[boIndex].value = 1
        return itemEditValues
    }

    const rgb = splitRgb(backgroundValue)
    itemEditValues.style[boIndex].value = rgb.a

    return itemEditValues
}
