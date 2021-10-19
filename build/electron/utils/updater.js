"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_updater_1 = require("electron-updater");
const electron_1 = require("electron");
let notification;
function checkForUpdates() {
    // if produciton
    electron_updater_1.autoUpdater.checkForUpdates().catch((err) => {
        console.error(JSON.stringify(err));
    });
    // autoUpdater.logger = console;
    electron_updater_1.autoUpdater.on("update-available", () => {
        notification = new electron_1.Notification({
            title: "FreeShow",
            body: "Updates are available. Click to download.",
            silent: true,
            // icon: nativeImage.createFromPath(join(__dirname, "..", "assets", "icon.png"),
        });
        notification.show();
        notification.on("click", () => {
            electron_updater_1.autoUpdater.downloadUpdate().catch((err) => {
                console.error(JSON.stringify(err));
            });
        });
    });
    electron_updater_1.autoUpdater.on("update-not-available", () => {
        notification = new electron_1.Notification({
            title: "FreeShow",
            body: "Your software is up to date.",
            silent: true,
            // icon: nativeImage.createFromPath(join(__dirname, "..", "assets", "icon.png"),
        });
        notification.show();
    });
    electron_updater_1.autoUpdater.on("update-downloaded", () => {
        notification = new electron_1.Notification({
            title: "FreeShow",
            body: "The updates are ready. Click to quit and install.",
            silent: true,
            // icon: nativeImage.createFromPath(join(__dirname, "..", "assets", "icon.png"),
        });
        notification.show();
        notification.on("click", () => {
            electron_updater_1.autoUpdater.quitAndInstall();
        });
    });
    electron_updater_1.autoUpdater.on("error", (err) => {
        notification = new electron_1.Notification({
            title: "FreeShow",
            body: JSON.stringify(err),
            // icon: nativeImage.createFromPath(join(__dirname, "..", "assets", "icon.png"),
        });
        notification.show();
    });
}
exports.default = checkForUpdates;
//# sourceMappingURL=updater.js.map