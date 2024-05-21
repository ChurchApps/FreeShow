import { get } from "svelte/store"
import { alertMessage, activePopup, dictionary } from "./../stores"

export function checkForUpdates(currentVersion: string) {
    fetch("https://api.github.com/repos/vassbo/freeshow/releases")
        .then((response) => response.json())
        .then((a) => {
            if (get(activePopup) !== null) return

            let current = a.filter((a: any) => a.draft === false && a.prerelease === false)[0]
            let newVersion = current.tag_name.slice(1)

            if (currentVersion !== newVersion) {
                alertMessage.set(
                    `<h2>${get(dictionary).about?.new_update || "New update available"}: v${newVersion}</h2>${get(dictionary).about?.download || "Go to freeshow.app to download"}!<br><br><h3>${
                        get(dictionary).about?.changes || "What's new"
                    }</h3>${current.body.replaceAll("\r\n", "<br>")}`
                )
                activePopup.set("alert")
            }
        })
        .catch((error) => {
            console.warn(error)
            return []
        })
}
