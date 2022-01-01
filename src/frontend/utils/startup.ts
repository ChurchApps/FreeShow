import { get } from "svelte/store"
import { MAIN } from "../../types/Channels"
import type { MainData } from "../../types/Socket"
import { name, outputWindow } from "../stores"
import { listen } from "./messages"

export function startup() {
  // REQUEST DATA FROM ELECTRON
  if (!get(outputWindow)) {
    window.api.send(MAIN, { channel: "OUTPUT" })
    if (get(name) === null) window.api.send(MAIN, { channel: "GET_OS" })
  }
  window.api.receive(MAIN, (data: MainData) => {
    if (data.channel === "GET_OS" && get(name) === null) name.set(data.data!)
    else if (data.channel === "OUTPUT") {
      if (data.data === "true") outputWindow.set(true)
      // LISTEN TO MESSAGES FROM CLIENT/ELECTRON
      listen()
    }
  })
}
