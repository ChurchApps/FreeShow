import { scriptures, scripturesCache } from "../stores"

export function importFSB(data: any[]) {
    data.forEach(({ content, name }) => {
        let bible: any = null
        try {
            bible = JSON.parse(content)
        } catch (err) {
            console.error(err)
        }

        if (!bible) return

        let id: string = bible[0]
        bible = bible[1]

        scripturesCache.update((a) => {
            a[id] = bible
            return a
        })

        scriptures.update((a) => {
            a[id] = { name: bible.name || name, id }
            return a
        })
    })
}
