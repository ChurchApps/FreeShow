import { get } from "svelte/store"
import type { Main } from "../../types/Channels"
import type { MainData } from "../../types/Socket"
import { name } from "../stores"

const MAIN: Main = "MAIN"

export function startup() {
  // REQUEST DATA FROM ELECTRON
  if (get(name) === null) window.api.send(MAIN, { channel: "GET_OS" })
  window.api.receive(MAIN, (data: MainData) => {
    if (data.channel === "GET_OS" && get(name) === null) name.set(data.data!)
  })
}
