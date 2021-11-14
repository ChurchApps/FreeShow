import { outputDisplay } from "./../stores"
import { OUTPUT, REMOTE, STAGE } from "./../../types/Channels"
import { shows } from "../stores"
import { get } from "svelte/store"
import { output, name, activeShow, language, activeProject, projects, folders } from "../stores"
import { getOutput } from "../components/helpers/get"
import type { RemoteData, RemoteInitialize, RemoteShow } from "../../types/Socket"

export function listen() {
  window.api.receive(OUTPUT, (message: any) => {
    // window.api.send(MAIN, {message: message})
    if (message.channel === "OUTPUT") output.set(message.data)
    if (message.channel === "DISPLAY") outputDisplay.set(message.data)
    else if (message.channel === "SHOWS") shows.set(message.data)
  })
  // window.api.receive(OPEN_FILE, (message: any) => {
  //   console.log(message)
  //   // activeFilePath = message.path;
  //   activeFilePath.set(message)
  // })
  // window.api.send("OPEN_FILE", {path: 'C:/Users/Kristoffer/Coding/FreeShow/sources.txt'});
  // window.api.send("OPEN_FILE", 'C:/Users/Kristoffer/Coding/FreeShow/sources.txt');
  // window.api.send("OPEN_FILE", {});

  // REMOTE
  window.api.receive(REMOTE, (message: RemoteData) => {
    if (message.channel === "REQUEST") {
      let initialize: RemoteInitialize = {
        id: message.id,
        channel: "DATA",
        data: {
          name: get(name) || "Computer",
          lang: get(language),
          activeShow: get(activeShow),
          activeProject: get(activeProject),
          projects: get(projects),
          folders: get(folders),
        },
      }
      window.api.send(REMOTE, initialize)
    } else if (message.channel === "GET_SHOW") {
      console.log(message)
      let remoteShow: RemoteShow = { id: message.id, channel: "GET_SHOW", data: get(shows)[message.data.id] }
      window.api.send(REMOTE, remoteShow)
    } else {
      console.log("Remote: ", message.id ? message.id + ": " + message.data : message)
    }
  })

  // REQUEST FROM STAGE
  window.api.receive(STAGE, (message: any) => {
    console.log(STAGE, message)
    if (message === "REQUEST") {
      window.api.send(STAGE, { output: getOutput() })
    }
  })

  // TO STAGE
  output.subscribe((message) => {
    if (message !== get(output)) {
      window.api.send(STAGE, { output: getOutput() })
    }
    // TODO: send next slide + countdown + others... / messages
  })
}
