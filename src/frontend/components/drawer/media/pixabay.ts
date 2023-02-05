import { getExtension } from "../../helpers/media"

// https://pixabay.com/api/docs/

let cache: any = {}

export async function loadFromPixabay(query: string = "", video: boolean = false): Promise<any[]> {
    return new Promise((resolve) => {
        console.log(query)
        if (cache[query + video]) return resolve(cache[query + video])

        let url: string = "https://pixabay.com/api/" + (video ? "videos/" : "") + "?key=11258791-07728519970a70a9ae0664214&safesearch=true&per_page=200&q="
        url += encodeURIComponent(query)
        console.log(url)

        let hits: any = []
        fetch(url)
            .then((response) => response.json())
            .then((data) => {
                console.log("PIXABAY", data)

                // https://pixabay.com/api/?key=11258791-07728519970a70a9ae0664214&q=yellow+flowers&image_type=photo&pretty=true
                hits = data.hits.map((media) => {
                    // previewURL
                    let path = media.largeImageURL
                    if (video) path = media.videos.medium.url
                    return { path, name: media.tags, extension: getExtension(path) }
                })

                cache[query + video] = hits

                // let img = { path, favourite: a.favourite === true, name, extension: p.extension, audio: a.audio === true }
                return resolve(hits)
            })
            .catch((error) => {
                console.log(error)
                return resolve([])
            })
    })
}
