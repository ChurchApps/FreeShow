import { autoUpdater } from "electron-updater"
import { Notification } from "electron"

let notification: Notification | null

export default function checkForUpdates() {
  // if produciton
  autoUpdater.checkForUpdates().catch((err) => {
    console.error(JSON.stringify(err))
  })

  // autoUpdater.logger = console;

  autoUpdater.on("update-available", () => {
    notification = new Notification({
      title: "FreeShow",
      body: "Updates are available. Click to download.",
      silent: true,
      // icon: nativeImage.createFromPath(join(__dirname, "..", "assets", "icon.png"),
    })
    notification.show()
    notification.on("click", () => {
      autoUpdater.downloadUpdate().catch((err) => {
        console.error(JSON.stringify(err))
      })
    })
  })

  autoUpdater.on("update-not-available", () => {
    notification = new Notification({
      title: "FreeShow",
      body: "Your software is up to date.",
      silent: true,
      // icon: nativeImage.createFromPath(join(__dirname, "..", "assets", "icon.png"),
    })
    notification.show()
  })

  autoUpdater.on("update-downloaded", () => {
    notification = new Notification({
      title: "FreeShow",
      body: "The updates are ready. Click to quit and install.",
      silent: true,
      // icon: nativeImage.createFromPath(join(__dirname, "..", "assets", "icon.png"),
    })
    notification.show()
    notification.on("click", () => {
      autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.on("error", (err) => {
    notification = new Notification({
      title: "FreeShow",
      body: JSON.stringify(err),
      // icon: nativeImage.createFromPath(join(__dirname, "..", "assets", "icon.png"),
    })
    notification.show()
  })
}
