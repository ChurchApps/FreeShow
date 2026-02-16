export function trimPlayerId(id: string, type: "youtube" | "vimeo") {
    if (type === "youtube") {
        if (id.includes("?list")) id = id.slice(0, id.indexOf("?list"))
        if (id.includes("?si")) id = id.slice(0, id.indexOf("?si"))
        id = id.slice(-11)
        return id
    }

    if (type === "vimeo") {
        if (id.includes("?")) id = id.slice(0, id.indexOf("?"))
        let slash = id.lastIndexOf("/")
        id = id.slice(slash >= 0 ? slash + 1 : 0)
        return id
    }

    return id
}

let isLoadingNames: string[] = []
export async function getYouTubeName(id: string) {
    if (!id || id.length < 11) return ""

    if (isLoadingNames.includes(id)) return ""
    isLoadingNames.push(id)

    try {
        const response = await fetch(`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${id}&format=json`)
        if (!response.ok) throw new Error("Failed to fetch video name")
        const data = await response.json()
        return data.title
    } catch (error) {
        console.error("Error fetching YouTube video name:", error)
        return ""
    } finally {
        isLoadingNames = isLoadingNames.filter((loadingId) => loadingId !== id)
    }

    // const elem = document.createElement("div")
    // elem.style.display = "none"
    // document.body.appendChild(elem)

    // let player = YoutubePlayer(elem, {
    //     playerVars: {
    //         autoplay: 0,
    //         controls: 0,
    //         fs: 0,
    //         rel: 0
    //     }
    // })

    // player.on("stateChange", (e) => {
    //     if (e.data === 5) {
    //         // 5 corresponds to the 'CUED' state
    //         console.log("Video cued and ready.")

    //         let videoData = e.target.getVideoData()
    //         console.log(videoData)
    //         if (!videoData?.title) return

    //         if (videoData?.title) data.name = videoData.title
    //         player.destroy()

    //         // remove the iframe element created by YouTube Player
    //         const iframe = elem.querySelector("iframe")
    //         if (iframe && document.body.contains(iframe)) document.body.removeChild(iframe)

    //         player = null // Reset the player instance
    //     }
    // })

    // // player.loadVideoById(id)
    // player.cueVideoById(id)
}

export async function getVimeoName(id: string) {
    if (!id || id.length < 8) return ""

    if (isLoadingNames.includes(id)) return ""
    isLoadingNames.push(id)

    try {
        const vimeoUrl = `https://vimeo.com/${id}`
        const response = await fetch(`https://vimeo.com/api/oembed.json?url=${vimeoUrl}`)
        if (!response.ok) throw new Error("Failed to fetch video name")
        const data = await response.json()
        return data.title
    } catch (error) {
        console.error("Error fetching Vimeo video name:", error)
        return ""
    } finally {
        isLoadingNames = isLoadingNames.filter((loadingId) => loadingId !== id)
    }

    // player.getVideoTitle().then((t) => {
    //     title = t
    // })
}
