import axios from "axios"

export type LyricSearchResult = {
    source: "Genius" | "Hymnary" | "Letras"
    key: string
    artist: string
    title: string
    originalQuery?: string
}

const lyricsSearchCache = new Map()
export class LyricSearch {
    static search = async (artist: string, title: string) => {
        const cacheKey = artist + title
        if (lyricsSearchCache.has(cacheKey)) return lyricsSearchCache.get(cacheKey)

        const results = await Promise.all([LyricSearch.searchGenius(artist, title), LyricSearch.searchHymnary(title), LyricSearch.searchLetras(title)])
        const joinedResults: LyricSearchResult[] = results.flat()

        lyricsSearchCache.set(cacheKey, joinedResults)
        return joinedResults
    }

    static get(song: LyricSearchResult) {
        if (song.source === "Genius") return LyricSearch.getGenius(song)
        else if (song.source === "Hymnary") return LyricSearch.getHymnary(song)
        else if (song.source === "Letras") return LyricSearch.getLetras(song)
        return Promise.resolve("")
    }

    //GENIUS
    private static getGeniusClient = () => {
        const Genius = require("genius-lyrics")
        return new Genius.Client()
    }

    private static searchGenius = async (artist: string, title: string) => {
        try {
            const client = this.getGeniusClient()
            const songs = await client.songs.search(title + artist)
            if (songs.length > 3) songs.splice(3, songs.length - 3)
            return songs.map((s: any) => LyricSearch.convertGenuisToResult(s, title + artist))
        } catch (ex) {
            console.log(ex)
            return []
        }
    }

    //Would greatly prefer to just load via url or id, but the api fails often with these methods (malformed json)
    private static getGenius = async (song: LyricSearchResult) => {
        const client = this.getGeniusClient()
        const songs = await client.songs.search(song.originalQuery || "")
        let result = ""
        for (let i = 0; i < songs.length; i++) {
            if (songs[i].id.toString() === song.key) {
                result = await songs[i].lyrics()
                break
            }
        }
        return result
    }

    private static convertGenuisToResult = (geniusResult: any, originalQuery: string) => {
        return {
            source: "Genius",
            key: geniusResult.id.toString(),
            artist: geniusResult.artist.name,
            title: geniusResult.title,
            originalQuery: originalQuery,
        } as LyricSearchResult
    }

    //HYMNARY
    private static searchHymnary = async (title: string) => {
        try {
            const url = `https://hymnary.org/search?qu=%20tuneTitle%3A${encodeURIComponent(title)}%20media%3Atext%20in%3Atexts&export=csv`
            const response = await axios.get(url)
            const csv = await response.data
            const songs = LyricSearch.CSVToArray(csv, ",")
            if (songs.length > 0) songs.splice(0, 1)
            for (let i = songs.length - 1; i >= 0; i--) if (songs[i].length < 7) songs.splice(i, 1)
            if (songs.length > 3) songs.splice(3, songs.length - 3)
            return songs.map((s: any) => LyricSearch.convertHymnaryToResult(s, title))
        } catch (ex) {
            console.log(ex)
            return []
        }
    }

    private static getHymnary = async (song: LyricSearchResult) => {
        const url = `https://hymnary.org/text/${song.key}`
        const response = await axios.get(url)
        const html = await response.data
        return this.getLyricFromHtml(html, /<div property=\"text\">(.*?)<\/div>/gs)
    }

    private static convertHymnaryToResult = (hymnaryResult: any, originalQuery: string) => {
        return {
            source: "Hymnary",
            key: hymnaryResult[4],
            artist: hymnaryResult[6],
            title: hymnaryResult[0],
            originalQuery: originalQuery,
        } as LyricSearchResult
    }

    //Letras
    private static searchLetras = async (title: string) => {
        try {
            const url = `https://solr.sscdn.co/letras/m1/?q=${encodeURIComponent(title)}`
            const response = await axios.get(url)
            const json = JSON.parse(response.data.replace("LetrasSug(", "").slice(0, -2))
            const songs = json.response.docs.filter((d: any) => d.id.startsWith("mus"))
            return songs.map((s: any) => LyricSearch.convertLetrasToResult(s, title))
        } catch (ex) {
            console.log(ex)
            return []
        }
    }

    private static convertLetrasToResult = (letrasResult: any, originalQuery: string) => {
        return {
            source: "Letras",
            key: `${letrasResult.dns}/${letrasResult.url}`,
            artist: letrasResult.art,
            title: letrasResult.txt,
            originalQuery: originalQuery,
        } as LyricSearchResult
    }

    private static getLetras = async (song: LyricSearchResult) => {
        const url = `https://www.letras.mus.br/${song.key}`
        const response = await axios.get(url)
        const html = await response.data
        return this.getLyricFromHtml(html, /<div class=\"lyric-original\">(.*?)<\/div>/gs)
    }

    private static getLyricFromHtml = (songHtml: string, regex: RegExp) => {
        let result = ""
        const match = regex.exec(songHtml)
        if (match) {
            result = match[0]
            result = result.replace(/<br\s*\/?>/gi, "\n")
            result = result.replaceAll("\n\n", "\n").replaceAll("\n\r\n", "\n")
            result = result.replaceAll("</p>", "\n\n")
            result = result.replaceAll("\n\n\n", "\n\n").replaceAll("\n\r\n\n", "\n\n")
            result = result.replace(/<[^>]*>?/gm, "")

            const lines = result.split("\n")
            const newLines: any[] = []
            lines.pop() // remove source
            lines.forEach((line) => {
                let contents = line.replace(/^\d+\s+/gm, "").trim() //remove leading numbers
                newLines.push(contents)
            })
            result = newLines.join("\n").trim()
        }
        return result
    }

    // ref: http://stackoverflow.com/a/1293163/2343
    // This will parse a delimited string into an array of
    // arrays. The default delimiter is the comma, but this
    // can be overriden in the second argument.
    static CSVToArray(strData: string, strDelimiter: string) {
        strDelimiter = strDelimiter || ","

        var objPattern = new RegExp("(\\" + strDelimiter + "|\\r?\\n|\\r|^)" + '(?:"([^"]*(?:""[^"]*)*)"|' + '([^"\\' + strDelimiter + "\\r\\n]*))", "gi")

        var arrData: any[] = [[]]
        var arrMatches = null
        while ((arrMatches = objPattern.exec(strData))) {
            var strMatchedDelimiter = arrMatches[1]
            if (strMatchedDelimiter.length && strMatchedDelimiter !== strDelimiter) {
                arrData.push([])
            }
            var strMatchedValue
            if (arrMatches[2]) strMatchedValue = arrMatches[2].replace(new RegExp('""', "g"), '"')
            else strMatchedValue = arrMatches[3]
            arrData[arrData.length - 1].push(strMatchedValue)
        }
        return arrData
    }
}
