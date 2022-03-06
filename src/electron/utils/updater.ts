import { join } from "path"
import { autoUpdater } from "electron-updater"
import { app, nativeImage, Notification } from "electron"

let notification: Notification | null

export default function checkForUpdates() {
  // if produciton
  autoUpdater.checkForUpdates().catch((err) => {
    console.error(JSON.stringify(err))
  })

  // autoUpdater.logger = console;

  autoUpdater.on("update-available", () => {
    notification = new Notification({
      title: app.getName(),
      body: "Updates are available. Click to download.",
      silent: true,
    })
    notification.show()
    notification.on("click", () => {
      autoUpdater.downloadUpdate().catch((err) => {
        console.error(JSON.stringify(err))
      })
    })
  })

  // autoUpdater.on("update-not-available", () => {
  //   notification = new Notification({
  //     title: app.getName(),
  //     body: "Your software is up to date.",
  //     silent: true,
  //     icon: nativeImage.createFromPath(join(__dirname, "..", "..", "public", "icon.png"))
  //   })
  //   notification.show()
  // })

  autoUpdater.on("update-downloaded", () => {
    notification = new Notification({
      title: app.getName(),
      body: "The updates are ready. Click to quit and install.",
      silent: true,
      icon: nativeImage.createFromPath(join(__dirname, "..", "..", "public", "icon.png")),
    })
    notification.show()
    notification.on("click", () => {
      // TODO: save
      autoUpdater.quitAndInstall()
    })
  })

  autoUpdater.on("error", (err) => {
    notification = new Notification({
      title: app.getName(),
      body: "Error: " + JSON.stringify(err) + "\n" + autoUpdater.getFeedURL(),
      silent: true,
      icon: nativeImage.createFromPath(join(__dirname, "..", "..", "public", "icon.png")),
    })
    notification.show()
  })
}
