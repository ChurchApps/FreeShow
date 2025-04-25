import { getKey } from "../../../values/keys"
import { getExtension } from "../../helpers/media"

// https://unsplash.com/documentation

const cache: any = {}

export async function loadFromUnsplash(query = ""): Promise<any[]> {
    return new Promise((resolve) => {
        if (cache[query]) return resolve(cache[query])

        let url: string = "https://api.unsplash.com/search/photos/?client_id=" + getKey("unsplash") + "&content_filter=high&per_page=30&query="
        url += encodeURIComponent(query)

        let results: any = []
        fetch(url)
            .then((response) => response.json())
            .then((data) => {
                results = data.results.map((media) => {
                    const path = media.urls.full || media.urls.regular
                    return { path, previewUrl: media.urls.thumb, name: media.alt_description, extension: getExtension(path), credits: getUnsplashCredits(media) }
                })

                cache[query] = results

                // let img = { path, favourite: a.favourite === true, name, extension: p.extension, audio: a.audio === true }
                return resolve(results)
            })
            .catch((error) => {
                console.error(error)
                return resolve([])
            })
    })
}

const UTM = "?utm_source=freeshow&utm_medium=referral"
function getUnsplashCredits(media) {
    return {
        type: "unsplash",
        photo: media.description,
        photoUrl: media.links.html + UTM,
        likes: media.likes,
        artist: media.user.name,
        artistUrl: "https://unsplash.com/@" + media.user.username + UTM,
        downloadUrl: media.links.download,
        trigger_download: media.links.download_location,
        homepage: "https://unsplash.com/" + UTM,
    }
}
