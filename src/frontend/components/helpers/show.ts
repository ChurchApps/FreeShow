import { get } from "svelte/store"
import { shows } from "../../stores"

// check if name axists and add number
export function checkName(name: string) {
  let number = 1
  // remove illegal file name characters
  name = name.trim().replace(/[/\\?%*:|"<>]/g, "")
  while (Object.values(get(shows)).find((a: any) => a.name === (number > 1 ? name + " " + number : name))) number++
  return number > 1 ? name + " " + number : name
}
