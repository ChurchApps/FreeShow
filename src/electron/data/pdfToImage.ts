import { BrowserWindow, NativeImage } from "electron"
import { writeFile } from "original-fs"
import path from "path"
import { toApp } from ".."
import { MAIN } from "../../types/Channels"
import { dataFolderNames, makeDir } from "../utils/files"
import { captureOptions } from "../utils/windowOptions"

export function convertPDFToImages(data: { dataPath: string; path: string; viewports: { width: number; height: number }[]; pages: number }) {
    createPDFWindow(data)
}

// changing scale will triple the loading time...
const SCALE: number = 1 // 0.25 - 5

let exportWindow: any = null
export function createPDFWindow(data: any) {
    exportWindow = new BrowserWindow(captureOptions)

    let pageIndex = 0

    exportWindow.webContents.on("did-finish-load", () => {
        // give some extra time as PDF loads after content has loaded
        const timeout = Math.ceil(Math.ceil(data.viewports[pageIndex].width * data.viewports[pageIndex].height) * 0.0015) * (SCALE === 1 ? 1 : 3)
        setTimeout(windowLoaded, timeout)
    })

    // this is needed to allow page to properly scroll into view
    const EXTRA_MARGIN = 100

    exportWindow.setSize(Math.floor(data.viewports[0].width) * SCALE + EXTRA_MARGIN, Math.floor(data.viewports[0].height) * SCALE)
    exportWindow.loadFile(data.path, getQuery())

    let images: string[] = []
    const name = path.basename(data.path, ".pdf")
    const SAVE_FOLDER_PATH = path.join(data.dataPath, dataFolderNames.imports, name)
    makeDir(SAVE_FOLDER_PATH)

    function windowLoaded() {
        // remove scroll bar
        let size = exportWindow.getBounds()
        // if (SCALE === 2) size = { x: EXTRA_MARGIN / 2 + 5, y: 4, width: size.width - EXTRA_MARGIN - 18, height: size.height - 12 } // optimized for SCALE 2
        // else size = { x: EXTRA_MARGIN / 2 + 5, y: 3, width: size.width - EXTRA_MARGIN - 16, height: size.height - 9 } // optimized for SCALE 1
        size = { x: EXTRA_MARGIN / 2 + 5, y: 3, width: size.width - EXTRA_MARGIN - 16, height: size.height - 9 }

        exportWindow.webContents.capturePage(size).then((image: NativeImage) => {
            const buffer = image.toPNG()
            const p = path.join(SAVE_FOLDER_PATH, pageIndex + 1 + ".png")

            writeFile(p, buffer, {}, (err) => {
                if (err) console.error("Error writing image file: " + err)
                else images.push(p)

                next()
            })
        })

        function next() {
            pageIndex++
            if (pageIndex >= data.pages) return close()

            exportWindow.setSize(Math.floor(data.viewports[pageIndex].width) * SCALE + EXTRA_MARGIN, Math.floor(data.viewports[pageIndex].height) * SCALE)
            exportWindow.loadFile(data.path, getQuery())

            // window content will not update if this is not set
            setTimeout(() => {
                exportWindow.webContents.reload()
            }, 50)
        }
    }

    function close() {
        exportWindow.destroy()
        if (images.length) toApp(MAIN, { channel: "IMAGES_TO_SHOW", data: { images, name } })
    }

    function getQuery() {
        return { hash: `#toolbar=0&view=fit&page=${pageIndex + 1}&zoom=${SCALE * 100}` }
    }
}
