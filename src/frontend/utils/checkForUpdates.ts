import { get } from "svelte/store"
import { alertMessage, activePopup, dictionary, isDev, alertUpdates, special } from "./../stores"

export function checkForUpdates(currentVersion: string) {
    if (get(isDev) || get(alertUpdates) === false) return
    const includeBeta = currentVersion.includes("beta") || get(special).betaVersionAlert

    fetch("https://api.github.com/repos/ChurchApps/freeshow/releases")
        .then((response) => response.json())
        .then((a) => {
            if (get(activePopup) !== null) return

            let latestAll = a.filter((a: any) => a.draft === false)[0]
            let latestVersionAll = latestAll.tag_name.slice(1)
            if (currentVersion === latestVersionAll) return

            let latestRelease = a.filter((a: any) => a.draft === false && a.prerelease === false)[0]
            let latestVersion = includeBeta ? latestVersionAll : latestRelease.tag_name.slice(1)
            if (currentVersion === latestVersion) return

            alertMessage.set(
                `<h2>${get(dictionary).about?.new_update || "New update available"}: v${latestVersion}</h2>${get(dictionary).about?.download || "Go to freeshow.app to download"}!<br><br><h3>${
                    get(dictionary).about?.changes || "What's new"
                }</h3>${latestRelease.body.replaceAll("\r\n", "<br>")}`
            )
            activePopup.set("alert")
        })
        .catch((error) => {
            console.warn(error)
        })
}
