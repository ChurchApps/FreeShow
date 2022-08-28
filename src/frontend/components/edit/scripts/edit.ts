import type { EditInput } from "../tools/boxes"

export function getOriginalValue(boxEdit: { [key: string]: EditInput[] }, key: string): string {
  let values: any[] = []
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
