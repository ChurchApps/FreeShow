import { outputDisplay } from "./../stores"
import { get } from "svelte/store"
import { MAIN } from "../../types/Channels"
import type { MainData } from "../../types/Socket"
import { os, outputWindow } from "../stores"
import { listen } from "./messages"

export function startup() {
  // REQUEST DATA FROM ELECTRON
  if (!get(outputWindow)) {
    window.api.send(MAIN, { channel: "OUTPUT" })
    window.api.send(MAIN, { channel: "DISPLAY" })
    if (!get(os).platform) window.api.send(MAIN, { channel: "GET_OS" })
  }
  window.api.receive(MAIN, (msg: MainData) => {
    if (msg.channel === "GET_OS") os.set(msg.data!)
    else if (msg.channel === "DISPLAY") outputDisplay.set(msg.data)
    else if (msg.channel === "OUTPUT") {
      if (msg.data === "true") outputWindow.set(true)
      // LISTEN TO MESSAGES FROM CLIENT/ELECTRON
      listen()
    }
  })
}
