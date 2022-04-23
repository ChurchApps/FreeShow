import { get } from "svelte/store"
import { alertMessage, activePopup, dictionary } from "./../stores"
export function checkForUpdates(currentVersion: string) {
  fetch("https://api.github.com/repos/vassbo/freeshow/releases")
    .then((response) => response.json())
    .then((a) => {
      let current = a.filter((a: any) => a.draft === false)[0]
      let newVersion = current.tag_name.slice(1, current.tag_name.length)

      if (currentVersion !== newVersion) {
        alertMessage.set(
          `<h2>${get(dictionary).about?.new_update || "New update available"}</h2>${
            get(dictionary).about?.download || "Go to freeshow.app to download"
          }<br>${currentVersion} -> ${newVersion}<br><br><h3>${get(dictionary).about?.changes || "What's new"}</h3>${current.body.replaceAll("\r\n", "<br>")}`
        )
        activePopup.set("alert")
      }
    })
    .catch((error) => {
      console.warn(error)
      return []
    })
}
