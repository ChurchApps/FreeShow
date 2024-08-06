import { getExtension } from "../../helpers/media"

// https://unsplash.com/documentation

let cache: any = {}

export async function loadFromUnsplash(query: string = ""): Promise<any[]> {
    return new Promise((resolve) => {
        if (cache[query]) return resolve(cache[query])

        let url: string = "https://api.unsplash.com/search/photos/?client_id=CaXvP_plzuAivss1MbiwGU3-rXd3zZphCifOVplX6Cg&content_filter=high&per_page=30&query=" // this is still a demo key, so it should be changed before release
        url += encodeURIComponent(query)

        let results: any = []
        fetch(url)
            .then((response) => response.json())
            .then((data) => {
                results = data.results.map((media) => {
                    let path = media.urls.full
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

function getUnsplashCredits(media) {
    return {
        type: "unsplash",
        photo: media.description,
        photoUrl: media.links.html,
        likes: media.likes,
        artist: media.user.name,
        artistUrl: "https://unsplash.com/@" + media.user.username,
        downloadUrl: media.links.download, // download_location
    }
}
