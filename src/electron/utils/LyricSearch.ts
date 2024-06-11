export type LyricSearchResult = {
    source: string,
    key: string,
    artist: string,
    title: string
    originalQuery?: string
}

export class LyricSearch {

    private static getGeniusClient = () => {
        const Genius = require("genius-lyrics")
        return new Genius.Client()
    }

    static search = async (artist:string, title: string) => {
        const results = await Promise.all([
            LyricSearch.searchGenius(artist, title)
        ])
        return results.flat()
    }

    private static searchGenius = async (artist:string, title: string) => {
        const client = this.getGeniusClient()
        const songs = await client.songs.search(title + artist)
        return songs.map((s:any) => LyricSearch.convertGenuisToResult(s, title + artist));
    }

    static get(song:LyricSearchResult) {
        if(song.source === "Genius") {
            return LyricSearch.getGenius(song)
        }
        return Promise.resolve("")
    }

    //Would greatly prefer to just load via url or id, but the api fails often with these methods (malformed json)
    private static getGenius = async (song:LyricSearchResult) => {
        const client = this.getGeniusClient()
        const songs = await client.songs.search(song.originalQuery || "")
        let result = "";
        for (let i = 0; i < songs.length; i++) {
            if (songs[i].id.toString() === song.key) {
                result = await songs[i].lyrics()
                break
            }
        }
        return result
    }

    private static convertGenuisToResult = (geniusResult:any, originalQuery:string) => {
        return {
            source: "Genius",
            key: geniusResult.id.toString(),
            artist: geniusResult.artist.name,
            title: geniusResult.title,
            originalQuery: originalQuery
        } as LyricSearchResult
    }

}