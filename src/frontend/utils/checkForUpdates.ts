import { get } from "svelte/store"
import { activePopup, alertUpdates, isDev, popupData, special } from "./../stores"

export function checkForUpdates(currentVersion: string) {
    if (get(isDev) || get(alertUpdates) === false) return
    const includeBeta = currentVersion.includes("-beta") || get(special).betaVersionAlert

    fetch("https://api.github.com/repos/ChurchApps/freeshow/releases")
        .then((response) => response.json())
        .then((data) => {
            if (get(activePopup) !== null) return

            const latestAll = data.filter((a: any) => a.draft === false)[0]
            const latestVersionAll = latestAll.tag_name.slice(1)
            if (currentVersion === latestVersionAll) return

            const latestRelease = data.filter((a: any) => a.draft === false && a.prerelease === false)[0]
            const latestVersion = includeBeta ? latestVersionAll : latestRelease.tag_name.slice(1)
            if (currentVersion === latestVersion) return

            popupData.set({ changelog: latestRelease.body, latestVersion })
            activePopup.set("new_update")
        })
        .catch((error) => {
            console.warn(error)
        })
}
