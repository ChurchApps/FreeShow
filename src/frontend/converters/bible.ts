import { uid } from "uid"
import { formatToFileName } from "../components/helpers/show"
import { activePopup, alertMessage, drawerTabsData, scriptures, scripturesCache } from "../stores"
import { translateText } from "../utils/language"
import { convertBebliaBible } from "./bebliaBible"
import { convertOpenSongBible } from "./opensong"
import { convertOSISBible } from "./osisBible"
import { convertZefaniaBible } from "./zefaniaBible"

const bibleTypes = {
    freeshow: { name: "FreeShow", func: importFSB },
    zefania: { name: "Zefania", func: convertZefaniaBible },
    osis: { name: "OSIS", func: convertOSISBible },
    beblia: { name: "Beblia", func: convertBebliaBible },
    opensong: { name: "OpenSong", func: convertOpenSongBible }
}

export function importBibles(data: any[]) {
    alertMessage.set("popup.importing")
    activePopup.set("alert")

    // timeout to allow popup to display
    setTimeout(() => {
        const success: { [key: string]: number } = {}
        const unsupported: { [key: string]: number } = {}

        data.forEach(file => {
            let type = file.type
            if (type === "fsb" || !type) type = "freeshow"

            if (bibleTypes[type]) {
                const name = bibleTypes[type].name
                if (!success[name]) success[name] = 0
                success[name]++
                bibleTypes[type].func([file])
            } else {
                const id = type || file.name
                if (!unsupported[id]) unsupported[id] = 0
                unsupported[id]++
            }
        })

        let message = ""
        if (Object.keys(success).length) {
            message += translateText("✓ actions.imported")
            Object.entries(success).forEach(([key, count]) => {
                message += `<br>• ${key}`
                if (count > 1) message += ` <span style="opacity: 0.5;">(${count})</span>`
            })
        }
        if (Object.keys(unsupported).length) {
            if (Object.keys(success).length) message += "<br><br>"

            message += translateText("✕ error.import")
            Object.entries(unsupported).forEach(([key, count]) => {
                message += `<br>• ${key}`
                if (count > 1) message += ` <span style="opacity: 0.5;">(${count})</span>`
            })

            // add link to Bible Converter
            message += `<br><br>Try another version or use this link#bible-converter!`
        }

        alertMessage.set(message)
    }, 200)
}

export function importFSB(data: any[]) {
    data.forEach(({ content, name }) => {
        let bible: any = null
        try {
            bible = JSON.parse(content)
        } catch (err) {
            console.error(err)
        }

        if (!bible) return

        const id: string = bible[0] || uid()
        bible = bible[1] || bible

        scripturesCache.update(a => {
            a[id] = bible
            return a
        })

        name = formatToFileName(bible.name || name)

        scriptures.update(a => {
            a[id] = { name, id }
            return a
        })

        setActiveScripture(id)
    })
}

export function setActiveScripture(tabId: string) {
    drawerTabsData.update(a => {
        a.scripture = { ...a.scripture, activeSubTab: tabId }
        return a
    })
}
