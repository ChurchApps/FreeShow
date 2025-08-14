import type { Item, Show } from "../../../types/Show"
import { setError, translate } from "./helpers"
import { send } from "./socket"
import { _, _get, _set, _update, currentScriptureState, overlays, scriptures, scriptureCache } from "./stores"

export type ReceiverKey = keyof typeof receiver
export const receiver = {
    PASSWORD: (data: any) => {
        if (data.dictionary) _set("dictionary", data.dictionary)
        let password: boolean = data.password
        _update("password", "required", password)
    },
    ERROR: (data: any) => {
        if (data === "wrongPass") {
            setError(translate("remote.wrong_password"))
            localStorage.removeItem("password")
            _update("password", "required", true)
        } else setError(data)
    },
    LANGUAGE: (data: any) => {
        _.dictionary.update((a) => {
            Object.keys(a).forEach((i) => {
                Object.keys(a[i] || {}).forEach((j) => {
                    if (data.strings[i]?.[j] && a[i]) a[i]![j] = data.strings[i][j]
                })
            })
            return a
        })
    },
    ACCESS: () => {
        if (_get("password").remember && _get("password").stored.length) localStorage.password = _get("password").stored
        _set("isConnected", true)
        
        // Request current output data which should include scripture state
        send("API:get_output")
    },

    /////

    SHOWS: (data: any) => {
        const shows = Object.keys(data).map((id) => ({ id, ...data[id] }))
        _set("shows", shows)
        if (_get("quickPlay")) _set("activeTab", "shows")
    },
    // "SHOWS_CACHE": (data: any) => {
    //   showsCache = data
    //   },
    SHOW: (data: any) => {
        if (!_get("isConnected")) return

        if (!_get("activeShow") && !_get("quickPlay")) _set("activeTab", "show")
        // if (activeTab === "shows" || activeTab === "project" || activeTab === "projects") activeTab = "show"
        // shows[data.id] = data
        // activeShow = data.id

        _set("activeShow", data)
    },
    OUT: (data: any) => {
        if (!_get("isConnected")) return

        // scripture
        if (data.id === "temp") {
            _set("outSlide", 0)
            _set("outLayout", "default")
            const show = getShowFromItems(data.tempItems, data.nextSlides[0])
            _set("outShow", show)

            _update("isCleared", "all", false)
            _update("isCleared", "slide", false)
            return
        }

        // clear
        if (data.slide === undefined) return

        _set("outSlide", data.slide)
        if (data.layout) _set("outLayout", data.layout)
        // if (data.styleRes) _set("styleRes", data.styleRes)
        if (_get("outSlide") === null) _set("outShow", null)
        else if (data.show) {
            _set("outShow", data.show)
            if (!_get("activeShow")) _set("activeTab", "slide")
            if (!_get("activeShow")) _set("activeShow", _get("outShow"))
        } else if (_get("outShow") === null && _get("activeShow")) {
            _set("outShow", _get("activeShow"))
        }
    },
    OUT_DATA: (data: any) => {
        _set("outData", data)
        send("API:get_cleared")
    },
    FOLDERS: (data: any) => {
        if (!_get("isConnected")) return

        _set("folders", data.folders)
        if (!_get("openedFolders").length) _set("openedFolders", data.opened)
        // console.log(folders)
    },
    PROJECTS: (data: any) => {
        if (!_get("isConnected")) return

        _set("projects", data)
        // newest first
        _set(
            "projects",
            _get("projects").sort((a, b) => b.created - a.created)
        )

        const project = data.find((a: any) => a.id === _get("project"))
        if (project) _set("activeProject", project)
    },
    PROJECT: (data: any) => {
        if (!_get("project") && data && _get("isConnected")) {
            _set("project", data)

            const project = _get("projects").find((a: any) => a.id === data)
            if (project) _set("activeProject", project)

            if (!_get("activeShow") && !_get("quickPlay")) _set("activeTab", "project")
        }
    },
    SCRIPTURE: (data: any) => {
        scriptures.set(data)
    },
    ACTIVE_SCRIPTURE: (data: any) => {
        const source: any = data?.api || data?.bible || data || {}
        const scriptureId: string = String(source.scriptureId || source.id || "")

        type NormalizedScriptureState = {
            scriptureId: string
            bookId: number
            chapterId: number
            activeVerses: number[]
        }

        const normalized: NormalizedScriptureState = {
            scriptureId,
            // Treat numeric bookId as zero-based if provided and valid, else -1
            bookId: Number.isInteger(source.bookId) && source.bookId >= 0 ? (source.bookId as number) : -1,
            // Normalize chapterId consistently to zero-based when provided as a string like "book.chapter"
            // If numeric and integer, assume it is already zero-based (upstream contract)
            chapterId: (() => {
                const chapter = source.chapterId
                if (Number.isInteger(chapter)) return chapter as number
                if (typeof chapter === "string") {
                    const parts = chapter.split(".")
                    const num = parseInt(parts[1] ?? parts[0], 10)
                    return Number.isFinite(num) ? num - 1 : -1
                }
                return -1
            })(),
            // Sanitize, dedupe and sort verses to make "latest" deterministic
            activeVerses: (() => {
                const raw = Array.isArray(source.activeVerses) ? source.activeVerses : []
                const nums: number[] = raw
                    .map((v: any) => parseInt(v, 10))
                    .filter((n: number): n is number => Number.isFinite(n) && n > 0)
                return Array.from(new Set<number>(nums)).sort((a: number, b: number) => a - b)
            })(),
        }
        
        currentScriptureState.set(normalized)
    },
    GET_SCRIPTURE: (data: any) => {
        if (!data) return
        
        if (data.bible) {
            _update("scriptureCache", data.id, data.bible)
            return
        }
        
        const update = data.bibleUpdate
        if (!update) return
        
        if (update.kind === "chapters") {
            const { id, bookIndex, chapters } = update
            if (!id || typeof bookIndex !== "number" || !Array.isArray(chapters)) return
            
            scriptureCache.update((cache) => {
                const bible = cache[id] || { books: [] as any[] }
                const books = Array.isArray(bible.books) ? bible.books : []
                const book = books[bookIndex] || {}
                book.chapters = (chapters || []).map((c: any) => ({ 
                    number: c.number, 
                    keyName: c.keyName, 
                    verses: [] 
                }))
                books[bookIndex] = book
                cache[id] = { ...bible, books }
                return cache
            })
            return
        }
        
        if (update.kind === "verses") {
            const { id, bookIndex, chapterIndex, verses } = update
            if (!id || typeof bookIndex !== "number" || typeof chapterIndex !== "number" || !Array.isArray(verses)) return
            
            scriptureCache.update((cache) => {
                const bible = cache[id] || { books: [] as any[] }
                const books = Array.isArray(bible.books) ? bible.books : []
                const book = books[bookIndex] || { chapters: [] as any[] }
                const chaptersArr = Array.isArray(book.chapters) ? book.chapters : []
                const chapter = chaptersArr[chapterIndex] || { verses: [] }
                chapter.verses = (verses || []).map((v: any, i: number) => ({ 
                    number: v.number || i + 1, 
                    text: v.text || v.value || "" 
                }))
                chaptersArr[chapterIndex] = chapter
                book.chapters = chaptersArr
                books[bookIndex] = book
                cache[id] = { ...bible, books }
                return cache
            })
        }
    },
    SCRIPTURE_CHAPTERS: (data: any) => {
        const { id, bookIndex, chapters } = data || {}
        if (!id || typeof bookIndex !== "number" || !Array.isArray(chapters)) return
        
        scriptureCache.update((cache) => {
            const bible = cache[id] || { books: [] as any[] }
            const books = Array.isArray(bible.books) ? bible.books : []
            const book = books[bookIndex] || {}
            book.chapters = (chapters || []).map((c: any) => ({ 
                number: c.number, 
                keyName: c.keyName, 
                verses: [] 
            }))
            books[bookIndex] = book
            cache[id] = { ...bible, books }
            return cache
        })
    },
    
    SCRIPTURE_VERSES: (data: any) => {
        const { id, bookIndex, chapterIndex, verses } = data || {}
        if (!id || typeof bookIndex !== "number" || typeof chapterIndex !== "number" || !Array.isArray(verses)) return
        
        scriptureCache.update((cache) => {
            const bible = cache[id] || { books: [] as any[] }
            const books = Array.isArray(bible.books) ? bible.books : []
            const book = books[bookIndex] || { chapters: [] as any[] }
            const chaptersArr = Array.isArray(book.chapters) ? book.chapters : []
            const chapter = chaptersArr[chapterIndex] || { verses: [] }
            chapter.verses = (verses || []).map((v: any, i: number) => ({ 
                number: v.number || i + 1, 
                text: v.text || v.value || "" 
            }))
            chaptersArr[chapterIndex] = chapter
            book.chapters = chaptersArr
            books[bookIndex] = book
            cache[id] = { ...bible, books }
            return cache
        })
    },
    OVERLAYS: (data: any) => {
        overlays.set(data)
    },

    /////

    "API:get_thumbnail": (data: any) => {
        if (!data.path || !data.thumbnail) return

        _update("mediaCache", data.path, data.thumbnail)
    },
    "API:get_plain_text": (data: any) => {
        _update("textCache", data.id, data.value)
    },
    "API:get_groups": (data: any) => {
        _update("groupsCache", data.id, data.value)
    },
    "API:get_cleared": (data: any) => {
        _set("isCleared", data)
    },

    "API:get_playing_audio_data": (data: any) => {
        _set("playingAudioData", data)
    },
    "API:get_playing_audio_time": (data: any) => {
        _set("playingAudioTime", data)
    },

    "API:get_pdf_thumbnails": (data: { path: string; pages: string[] }) => {
        _update("pdfPages", data.path, data.pages)
    },

    "API:create_show": (data: { show: Show; id: string }) => {
        send("SHOW", data.id)
        _set("active", { id: data.id, type: "show" })
        _set("activeTab", "show")
    },
}

function getShowFromItems(items: Item[], nextSlideItems: Item[] | undefined) {
    const show: Show = {
        name: "",
        settings: {
            activeLayout: "default",
            template: null,
        },
        category: null,
        timestamps: { created: 0, modified: null, used: null },
        meta: {},
        media: {},
        slides: {
            one: {
                group: "",
                color: "",
                settings: {},
                notes: "",
                items: items,
            },
        },
        layouts: { default: { name: "", notes: "", slides: [{ id: "one" }] } },
    }

    if (nextSlideItems) {
        show.slides.two = {
            group: "",
            color: "",
            settings: {},
            notes: "",
            items: nextSlideItems,
        }
        show.layouts.default.slides.push({ id: "two" })
    }

    return show
}
