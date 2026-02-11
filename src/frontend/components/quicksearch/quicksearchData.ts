import { get } from "svelte/store"
import { Main } from "../../../types/IPC/Main"
import type { FileFolder } from "../../../types/Main"
import type { ShowList } from "../../../types/Show"
import { requestMain } from "../../IPC/main"
import { drawerTabsData, scriptures, scripturesCache, textCache } from "../../stores"
import { buildBibleIndex, fastBibleSearch } from "../../utils/searchFast"
import { sortByClosestMatch } from "../actions/apiHelper"
import { loadJsonBible } from "../drawer/bible/scripture"
import { getExtension, getMediaType } from "../helpers/media"

export function showResult(show: ShowList, rawSearchValue: string) {
    const cache = get(textCache)[show.id] || ""
    let description = ""
    if (cache && rawSearchValue.length > 2) {
        // Find a snippet containing the search term
        const lowerCache = cache.toLowerCase()
        const lowerSearch = rawSearchValue.toLowerCase()
        const idx = lowerCache.indexOf(lowerSearch)
        if (idx !== -1) {
            const start = Math.max(0, idx - 30)
            const end = Math.min(cache.length, idx + rawSearchValue.length + 50)
            description = (start > 0 ? "..." : "") + cache.slice(start, end).trim() + (end < cache.length ? "..." : "")
        }
    }
    return { ...show, description }
}

let mediaCache = new Map<string, any>()
export async function getMediaResults(searchValue: string, folderPaths: string[]) {
    if (!searchValue || searchValue.length < 2) return []

    const key = `${folderPaths[0]}_${folderPaths.length}`
    let data: { [key: string]: FileFolder } = mediaCache.get(key)
    if (!data) {
        data = await requestMain(Main.READ_FOLDER, { path: folderPaths })
        mediaCache.set(key, data)
    }
    const matches: any[] = []

    for (const [path, item] of Object.entries(data)) {
        if (item.name?.toLowerCase().includes(searchValue)) {
            const type = getMediaType(getExtension(path))

            matches.push({
                id: path,
                name: item.name,
                icon: type === "audio" ? "music" : type === "video" ? "movie" : "image",
                data: {
                    name: item.name,
                    type
                }
            })
        }
    }

    return sortByClosestMatch(matches, searchValue)
}

export async function getBibleResults(searchValue: string) {
    const results: any[] = []
    if (!searchValue || searchValue.length < 2) return results

    const activeBibleId = get(drawerTabsData).scripture?.activeSubTab
    if (!activeBibleId) return results

    const bibleData = await loadJsonBible(activeBibleId)
    if (!bibleData) return results

    // Reference Search
    const bookResult = bibleData.bookSearch(searchValue)
    if (bookResult && bookResult.book) {
        const Book = await bibleData.getBook(bookResult.book)
        const bookName = Book.name
        let name = bookName
        let versePreview = ""

        if (bookResult.chapter) {
            name += " " + bookResult.chapter

            // Try to get verse text preview
            try {
                const Chapter = await Book.getChapter(bookResult.chapter)
                if (bookResult.verses?.length) {
                    // Get first verse text for preview
                    const firstVerse = Chapter.getVerse(bookResult.verses[0])
                    versePreview =
                        firstVerse
                            ?.getHTML()
                            ?.replace(/<[^>]*>/g, "")
                            .slice(0, 100) || ""
                    if (versePreview.length === 100) versePreview += "..."

                    // Format verse range for display
                    const verses = bookResult.verses
                    if (verses.length > 1 && verses[verses.length - 1] === verses[0] + verses.length - 1) {
                        name += ":" + verses[0] + "-" + verses[verses.length - 1]
                    } else {
                        name += ":" + verses.join(",")
                    }
                } else {
                    // Default to first verse of chapter
                    const firstVerse = Chapter.getVerse(1)
                    versePreview =
                        firstVerse
                            ?.getHTML()
                            ?.replace(/<[^>]*>/g, "")
                            .slice(0, 100) || ""
                    if (versePreview.length === 100) versePreview += "..."
                }
            } catch (e) {
                // Ignore errors in preview fetching
            }
        }

        results.push({
            id: activeBibleId, // We use the bible ID, data will contain the reference
            name: name,
            icon: "scripture",
            type: "bible",
            description: versePreview,
            data: {
                reference: {
                    book: bookResult.book,
                    chapter: bookResult.chapter || 1, // Default to chapter 1 if only book is searched
                    verses: bookResult.verses?.length ? [bookResult.verses] : [[1]]
                },
                play: !!bookResult.chapter // Auto-play if specific chapter/verse is found? Or maybe just open
            }
        })
    }

    // Text Search
    // Only search if length > 2 to avoid too many results
    if (searchValue.length > 2) {
        let textResults: any[] = []

        const scriptureData = get(scriptures)[activeBibleId]
        if (!scriptureData?.api) {
            // Local Bible: Use our fast inverted index search
            const rawBible = get(scripturesCache)[activeBibleId]
            if (rawBible) {
                await buildBibleIndex(activeBibleId, rawBible)
                const fastResults = fastBibleSearch(searchValue)
                textResults = fastResults.map((r) => ({
                    reference: r.reference,
                    book: r.book,
                    chapter: r.chapter,
                    verse: { number: r.verse, text: r.text }
                }))
            }
        }

        // Fallback to library search if index search didn't yield results or for API bibles
        if (textResults.length === 0) {
            textResults = (await bibleData.textSearch(searchValue)) || []
        }

        if (textResults) {
            textResults.forEach((res) => {
                results.push({
                    id: activeBibleId,
                    name: res.reference, // e.g. "John 3:16"
                    icon: "scripture",
                    type: "bible",
                    description: res.verse.text, // Show verse text
                    data: {
                        reference: {
                            book: res.book,
                            chapter: res.chapter,
                            verses: [[res.verse.number]]
                        },
                        play: true // Play when selecting specific verse match
                    }
                })
            })
        }
    }

    return results
}
