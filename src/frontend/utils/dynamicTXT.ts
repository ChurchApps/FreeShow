import { requestMain } from "../IPC/main"
import { Main } from "../../types/IPC/Main"

const cachedData: { [key: string]: { time: number; data: string } } = {}
const isFetching: { [key: string]: boolean } = {}

export function getTXT(url: string, updateTime: number | string | undefined): string | null {
    if (!url) return null
    const queryKey = url

    // default interval is 3 seconds
    const UPDATE_MS = Number(updateTime || "3") * 1000
    if (cachedData[queryKey] && Date.now() - cachedData[queryKey].time < UPDATE_MS) {
        return cachedData[queryKey].data
    }

    if (isFetching[queryKey]) {
        return cachedData[queryKey]?.data ?? null
    }

    const isHttp = url.startsWith("http://") || url.startsWith("https://")
    isFetching[queryKey] = true

    if (isHttp) {
        fetch(url)
            .then((response) => {
                if (!response.ok) {
                    console.error(`HTTP error: ${response.status}`)
                    return
                }
                return response.text()
            })
            .then((text) => {
                if (text === undefined || text === null) return
                cachedData[queryKey] = { time: Date.now(), data: text }
            })
            .catch((error) => {
                console.error("Fetch error:", error)
            })
            .finally(() => {
                delete isFetching[queryKey]
            })
    } else {
        requestMain(Main.READ_FILE, { path: url })
            .then((res) => {
                if (res?.content !== undefined) {
                    cachedData[queryKey] = { time: Date.now(), data: res.content }
                }
            })
            .catch((error) => {
                console.error("Local file read error:", error)
            })
            .finally(() => {
                delete isFetching[queryKey]
            })
    }

    return cachedData[queryKey]?.data ?? null
}

export function convertTXTToString(text: string | null, divider = "<br>"): string | string[] {
    if (text === null || text === undefined) return ""

    // Normalize newlines and remove trailing carriage returns
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    const lines = normalized.split("\n")

    // Joined string when accessed directly ({txt_name})
    const fullText = lines.join(divider)

    // Return array where index 0 is full string (default) and index 1..N are lines 1..N ({txt_name#1} etc.)
    return [fullText, ...lines]
}
