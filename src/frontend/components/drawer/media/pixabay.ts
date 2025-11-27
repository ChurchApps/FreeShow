import { getKey } from "../../../values/keys"
import { getExtension } from "../../helpers/media"

// https://pixabay.com/api/docs/

const cache: any = {}

export async function loadFromPixabay(query = "", video = false): Promise<any[]> {
    return new Promise(resolve => {
        if (cache[query + video]) return resolve(cache[query + video])

        let url: string = "https://pixabay.com/api/" + (video ? "videos/" : "") + "?key=" + getKey("pixabay") + "&safesearch=true&per_page=80&q="
        url += encodeURIComponent(query)

        let hits: any = []
        fetch(url)
            .then(response => response.json())
            .then(data => {
                // https://pixabay.com/api/?key={API_KEY}&q=yellow+flowers&image_type=photo&pretty=true
                hits = data.hits.map(media => {
                    let path = media.largeImageURL
                    if (video) path = media.videos.medium.url
                    return { path, previewUrl: video ? media.videos.small.thumbnail : media.previewURL, name: media.tags, extension: getExtension(path), credits: getPixabayCredits(media) }
                })

                cache[query + video] = hits

                // let img = { path, favourite: a.favourite === true, name, extension: p.extension, audio: a.audio === true }
                return resolve(hits)
            })
            .catch(error => {
                console.error(error)
                return resolve([])
            })
    })
}

function getPixabayCredits(media) {
    return {
        type: "pixabay",
        photo: media.tags,
        photoUrl: media.pageURL,
        likes: media.likes,
        artist: media.user,
        artistUrl: `https://pixabay.com/users/${media.user}-${media.user_id}/`,
        downloadUrl: media.largeImageURL,
        homepage: "https://pixabay.com/"
    }
}
