import { xml2json } from "../converters/xml"

// rss: {
//     channel: {
//         title: string
//         item: []
//     }
// }
interface RSSjson {
    title: string
    description: string
    link: string
    // image/img: any
    item: RSSItem[]
}
interface RSSItem {
    title: string
    description: string
    link: string
    pubDate: string // .toGMTString() "Wed, 18 Jun 2025 14:33:44 GMT"
}

const cachedData: { [key: string]: { time: number; data: RSSjson } } = {}
export function getRSS(url: string, updateTime: number | string | undefined): RSSjson | null {
    const queryKey = url

    // don't use cache if it's older than the set interval
    const UPDATE_MS = Number(updateTime || "60") * 60 * 1000
    if (cachedData[queryKey] && Date.now() - cachedData[queryKey].time < UPDATE_MS) {
        return cachedData[queryKey].data
    }

    fetch(url)
        .then((response) => {
            if (!response.ok) {
                console.error(`HTTP error: ${response.status}`)
                return
            }

            return response.text()
        })
        .then((xmlText) => {
            if (!xmlText) return

            // some feeds have all the text content in <![CDATA[ Text ]]> blocks!
            xmlText = xmlText.replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")

            let data = xml2json(xmlText)?.rss?.channel
            if (!data) return

            cachedData[queryKey] = { time: Date.now(), data }
        })
        .catch((error) => {
            console.error("Fetch error:", error)
        })

    return null
}

export function convertRSSToString(data: RSSjson | null, divider?: string, count: number = 5) {
    let items = data?.item
    if (!Array.isArray(items)) return ""

    divider = divider || " | "

    const stringItems = items.slice(0, count).map((a) => `${a.title}: ${a.description}`)
    return stringItems.join(divider)
}
