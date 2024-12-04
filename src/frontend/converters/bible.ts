import { uid } from "uid"
import { formatToFileName } from "../components/helpers/show"
import { drawerTabsData, scriptures, scripturesCache } from "../stores"

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

        scripturesCache.update((a) => {
            a[id] = bible
            return a
        })

        name = formatToFileName(bible.name || name)

        scriptures.update((a) => {
            a[id] = { name, id }
            return a
        })

        setActiveScripture(id)
    })
}

export function setActiveScripture(tabId: string) {
    drawerTabsData.update((a) => {
        a.scripture = { ...a.scripture, activeSubTab: tabId }
        return a
    })
}
