export type LyricSearchResult = {
    source: string,
    id: string,
    artist: string,
    title: string
}

export class LyricSearch {

    static searchGenius = async (artist:string, title: string) => {
        const Genius = require("genius-lyrics")
        const client = new Genius.Client()
        const songs = await client.songs.search(title + artist)
        return songs.map(LyricSearch.convertGenuisToResult);
    }

    static getGeniusLyrics = async (id:string) => {
        const Genius = require("genius-lyrics")
        const client = new Genius.Client()
        const song = await client.songs.get(parseInt(id));
        return song ? await song.lyrics() : ""
    }

    static convertGenuisToResult = (geniusResult:any) => {
        return {
            source: "Genius",
            id: geniusResult.id.toString(),
            artist: geniusResult.artist.name,
            title: geniusResult.title
        } as LyricSearchResult
    }

}