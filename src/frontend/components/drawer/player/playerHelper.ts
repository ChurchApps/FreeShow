export function trimPlayerId(id: string, type: "youtube" | "vimeo") {
    if (type === "youtube") {
        let value = id.trim()

        try {
            const url = new URL(value)
            const host = url.hostname.replace("www.", "")

            if (host === "youtu.be") {
                const shortId = url.pathname.split("/").filter(Boolean)[0]
                if (shortId) return shortId.slice(0, 11)
            }

            if (host.endsWith("youtube.com")) {
                const videoId = url.searchParams.get("v")
                if (videoId) return videoId.slice(0, 11)

                const segments = url.pathname.split("/").filter(Boolean)
                const routeIndex = segments.findIndex((segment) => ["shorts", "embed", "live"].includes(segment))
                if (routeIndex >= 0 && segments[routeIndex + 1]) return segments[routeIndex + 1].slice(0, 11)
            }
        } catch {
            // invalid URL, continue with manual parsing
        }

        const queryMatch = value.match(/[?&]v=([^&]+)/)
        if (queryMatch?.[1]) return queryMatch[1].slice(0, 11)

        const shortMatch = value.match(/youtu\.be\/([^?&/]+)/)
        if (shortMatch?.[1]) return shortMatch[1].slice(0, 11)

        if (value.includes("?")) value = value.slice(0, value.indexOf("?"))
        return value.slice(-11)
    }

    if (type === "vimeo") {
        if (id.includes("?")) id = id.slice(0, id.indexOf("?"))
        let slash = id.lastIndexOf("/")
        id = id.slice(slash >= 0 ? slash + 1 : 0)
        return id
    }

    return id
}

let isLoadingIds: string[] = []

export async function getYouTubeData(id: string): Promise<{ name: string; duration: number }> {
    if (!id || id.length < 11) return { name: "", duration: 0 }

    if (isLoadingIds.includes(id)) return { name: "", duration: 0 }
    isLoadingIds.push(id)

    try {
        let name = ""
        let duration = 0

        const response = await fetch(`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${id}&format=json`)
        if (response.ok) {
            const data = await response.json()
            name = data.title || ""
        }

        const watchResponse = await fetch(`https://www.youtube.com/watch?v=${id}`)
        if (watchResponse.ok) {
            const html = await watchResponse.text()
            const match = html.match(/"lengthSeconds":"(\d+)"/)
            if (match?.[1]) {
                duration = parseInt(match[1], 10) || 0
            }
        }

        return { name, duration }
    } catch (error) {
        console.error("Error fetching YouTube video data:", error)
        return { name: "", duration: 0 }
    } finally {
        isLoadingIds = isLoadingIds.filter((loadingId) => loadingId !== id)
    }
}

export async function getVimeoData(id: string): Promise<{ name: string; duration: number }> {
    if (!id || id.length < 8) return { name: "", duration: 0 }

    if (isLoadingIds.includes(id)) return { name: "", duration: 0 }
    isLoadingIds.push(id)

    try {
        const vimeoUrl = `https://vimeo.com/${id}`
        const response = await fetch(`https://vimeo.com/api/oembed.json?url=${vimeoUrl}`)
        if (!response.ok) throw new Error("Failed to fetch video data")
        const data = await response.json()
        return {
            name: data.title || "",
            duration: data.duration || 0
        }
    } catch (error) {
        console.error("Error fetching Vimeo video data:", error)
        return { name: "", duration: 0 }
    } finally {
        isLoadingIds = isLoadingIds.filter((loadingId) => loadingId !== id)
    }
}
