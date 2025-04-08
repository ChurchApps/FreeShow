// ----- FreeShow -----
// Options for electron windows
// https://www.electronjs.org/docs/latest/api/browser-window

import type { BrowserWindowConstructorOptions } from "electron"
import { join } from "path"
import { isMac, isProd } from ".."

export const loadingOptions: BrowserWindowConstructorOptions = {
    width: 500,
    height: 300,
    icon: "public/icon.png",
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    frame: false,
    webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
    },
}

export const mainOptions: BrowserWindowConstructorOptions = {
    icon: "public/icon.png",
    backgroundColor: "#292c36",
    titleBarStyle: isMac ? "hidden" : "default",
    trafficLightPosition: { x: 10, y: 12 }, // mac buttons
    show: false,
    webPreferences: {
        preload: join(__dirname, "..", "preload"), // browser - node communication
        devTools: !isProd, // enable dev tools in dev
        webSecurity: isProd, // access local files in dev
        nodeIntegration: !isProd,
        contextIsolation: true,
        allowRunningInsecureContent: false,
        webviewTag: true, // website item
    },
}

export const outputOptions: BrowserWindowConstructorOptions = {
    icon: "public/icon.png",
    backgroundColor: "#000000",
    transparent: true,
    show: false,
    alwaysOnTop: true, // keep window on top of other windows
    resizable: false, // disable resizing on mac and windows
    frame: false, // hide title/buttons
    skipTaskbar: true, // hide from taskbar
    hasShadow: false,
    enableLargerThanScreen: true, //
    titleBarStyle: "default", //On mac, electron uses hiddenInset otherwise, which results in rounded corners.

    // fullscreen: true,
    // type: "toolbar", // hide from taskbar
    // titleBarStyle: "hidden", // hide titlebar
    // kiosk: true, // fixed window over menu bar
    // roundedCorners: false, // disable rounded corners on mac
    // thickFrame: false, // remove window shadow and window animations on Windows
    webPreferences: {
        preload: join(__dirname, "..", "preload"),
        webSecurity: isProd,
        nodeIntegration: !isProd,
        contextIsolation: true,
        allowRunningInsecureContent: false,
        webviewTag: true,
        backgroundThrottling: false,
        autoplayPolicy: "no-user-gesture-required",
    },
}

export const screenIdentifyOptions: BrowserWindowConstructorOptions = {
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    frame: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
        nodeIntegration: !isProd,
        contextIsolation: false,
    },
}

export const exportOptions: BrowserWindowConstructorOptions = {
    // show: !isProd,
    show: false,
    modal: true,
    frame: false,
    webPreferences: {
        preload: join(__dirname, "..", "preload"),
        webSecurity: isProd,
        nodeIntegration: !isProd,
        // contextIsolation: true,
        // enableRemoteModule: false,
        backgroundThrottling: false,
        autoplayPolicy: "no-user-gesture-required",
    },
}

export const captureOptions: BrowserWindowConstructorOptions = {
    show: false,
    backgroundColor: "#000000",
    frame: false,
    skipTaskbar: true,
    webPreferences: {
        preload: join(__dirname, "..", "preload"),
        webSecurity: isProd,
        nodeIntegration: !isProd,
        contextIsolation: true,
        allowRunningInsecureContent: false,
        webviewTag: true,
        backgroundThrottling: false,
        autoplayPolicy: "no-user-gesture-required",
        offscreen: true,
    },
}
