import { getExtension } from "../../helpers/media"

// https://unsplash.com/documentation

let cache: any = {}

export async function loadFromUnsplash(query: string = ""): Promise<any[]> {
    return new Promise((resolve) => {
        console.log(query)

        let url: string = "https://api.unsplash.com/search/photos/?client_id=CaXvP_plzuAivss1MbiwGU3-rXd3zZphCifOVplX6Cg&content_filter=high&per_page=10&query=" // this is still a demo key, so it should be changed before release
        url += encodeURIComponent(query)
        console.log(url)

        let results: any = []
        fetch(url)
            .then((response) => response.json())
            .then((data) => {
                console.log("UNSPLASH", data)


                results = data.results.map((media) => {
                    // previewURL
                    let path = media.urls.small
                    return { path, name: media.description, extension: getExtension(path) }
                })

                cache[query] = results

                // let img = { path, favourite: a.favourite === true, name, extension: p.extension, audio: a.audio === true }
                return resolve(results)
            })
            .catch((error) => {
                console.log(error)
                return resolve([])
            })
    })
}
