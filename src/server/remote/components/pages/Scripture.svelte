<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import Loading from "../../../common/components/Loading.svelte"
    import { keysToID } from "../../../common/util/helpers"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { dictionary, isCleared, scriptureCache, scriptures, scriptureViewList } from "../../util/stores"
    import Clear from "../show/Clear.svelte"
    import ScriptureContent from "./ScriptureContent.svelte"

    export let tablet: boolean = false
    export let triggerScriptureSearch: boolean = false

    let collectionId = localStorage.collectionId || ""
    let openedScripture = localStorage.scripture || ""
    $: if (openedScripture && !$scriptureCache[openedScripture]) send("GET_SCRIPTURE", { id: openedScripture })

    function openScripture(id: string, collection: string = "") {
        openedScripture = id
        collectionId = collection
        localStorage.setItem("scripture", id)
        localStorage.setItem("collectionId", collection)
    }

    // WIP collections: remove with API Bibles, get correct ID etc.
    $: sortedBibles = keysToID($scriptures)
        .filter((a) => !a.api && (!a.collection || !$scriptures[a.collection.versions[0]]?.api))
        .map((a: any) => ({ ...a, icon: a.api ? "scripture_alt" : a.collection ? "collection" : "scripture" }))
        .sort((a: any, b: any) => (b.customName || b.name).localeCompare(a.customName || a.name))
        .sort((a: any, b: any) => (a.api === true && b.api !== true ? 1 : -1))
        .sort((a: any, b: any) => (a.collection !== undefined && b.collection === undefined ? -1 : 1))

    let depth = 0

    function next() {
        // WIP change preview index
        send("API:scripture_next")
    }
    function previous() {
        send("API:scripture_previous")
    }
    
    function goBack() {
        if (depth > 0) {
            depth--
        } else {
            openScripture("")
        }
    }

    // SEARCH

    $: if (triggerScriptureSearch) triggerSearch()
    function triggerSearch() {
        openScriptureSearch = true
        triggerScriptureSearch = false
    }

    let openScriptureSearch = false
    let searchValue = ""
    let searchResults = []
    let searchResult = { reference: "", referenceFull: "", verseText: "" }
    $: updateSearch(searchValue, $scriptureCache, openedScripture)

    function formatBookSearch(search: string): string {
        return search
            .toLowerCase()
            .replace(/\s/g, "")
            .replace(/\./g, "")
            .replace(/[áàâã]/g, "a")
            .replace(/[éèê]/g, "e")
            .replace(/[íìî]/g, "i")
            .replace(/[óòôõ]/g, "o")
            .replace(/[úùû]/g, "u")
            .replace(/ç/g, "c")
    }

    function findBook(books: any[], value: string): any {
        const search = formatBookSearch(value)

        // First try exact matches and common abbreviations
        const exactMatch = books.find((book) => {
            const bookName = formatBookSearch(book.name)
            if (bookName === search) return true
            
            // Handle common abbreviations
            const abbreviations = {
                'jh': 'john',
                'jn': 'john', 
                'jo': 'john',
                'gen': 'genesis',
                'ex': 'exodus',
                'exo': 'exodus',
                'lev': 'leviticus',
                'num': 'numbers',
                'deut': 'deuteronomy',
                'dt': 'deuteronomy',
                'josh': 'joshua',
                'judg': 'judges',
                'ru': 'ruth',
                'sam': 'samuel',
                '1sam': '1samuel',
                '2sam': '2samuel',
                'kg': 'kings',
                'kgs': 'kings',
                '1kg': '1kings',
                '1kgs': '1kings',
                '2kg': '2kings',
                '2kgs': '2kings',
                'chr': 'chronicles',
                '1chr': '1chronicles',
                '2chr': '2chronicles',
                'ezr': 'ezra',
                'neh': 'nehemiah',
                'est': 'esther',
                'ps': 'psalms',
                'psa': 'psalms',
                'prov': 'proverbs',
                'pr': 'proverbs',
                'ecc': 'ecclesiastes',
                'eccl': 'ecclesiastes',
                'song': 'songofsongs',
                'ss': 'songofsongs',
                'isa': 'isaiah',
                'is': 'isaiah',
                'jer': 'jeremiah',
                'lam': 'lamentations',
                'ezek': 'ezekiel',
                'ez': 'ezekiel',
                'dan': 'daniel',
                'hos': 'hosea',
                'joe': 'joel',
                'am': 'amos',
                'ob': 'obadiah',
                'jon': 'jonah',
                'mic': 'micah',
                'nah': 'nahum',
                'hab': 'habakkuk',
                'zeph': 'zephaniah',
                'zep': 'zephaniah',
                'hag': 'haggai',
                'zech': 'zechariah',
                'zec': 'zechariah',
                'mal': 'malachi',
                'mt': 'matthew',
                'matt': 'matthew',
                'mk': 'mark',
                'lk': 'luke',
                'luk': 'luke',
                'joh': 'john',
                'act': 'acts',
                'rom': 'romans',
                'cor': 'corinthians',
                '1cor': '1corinthians',
                '2cor': '2corinthians',
                'gal': 'galatians',
                'eph': 'ephesians',
                'phil': 'philippians',
                'php': 'philippians',
                'col': 'colossians',
                'thess': 'thessalonians',
                'thes': 'thessalonians',
                '1thess': '1thessalonians',
                '1thes': '1thessalonians',
                '2thess': '2thessalonians',
                '2thes': '2thessalonians',
                'tim': 'timothy',
                '1tim': '1timothy',
                '2tim': '2timothy',
                'tit': 'titus',
                'philem': 'philemon',
                'phlm': 'philemon',
                'heb': 'hebrews',
                'jas': 'james',
                'jam': 'james',
                'pet': 'peter',
                'pt': 'peter',
                '1pet': '1peter',
                '1pt': '1peter',
                '2pet': '2peter',
                '2pt': '2peter',
                'jude': 'jude',
                'rev': 'revelation',
                'rv': 'revelation'
            }

            const abbreviation = abbreviations[search]
            if (abbreviation && formatBookSearch(book.name).includes(abbreviation)) return true

            return false
        })

        if (exactMatch) return exactMatch

        // Then try partial matches (book name starts with search)
        return books.find((book) => formatBookSearch(book.name).startsWith(search))
    }

    function findChapter(book: any, value: string): any {
        const chapterNumber = parseInt(value)
        if (isNaN(chapterNumber) || chapterNumber < 1) return null
        return book.chapters?.[chapterNumber - 1] || null
    }

    function findVerse(chapter: any, value: string): any {
        const verseNumber = parseInt(value)
        if (isNaN(verseNumber) || verseNumber < 1) return null
        return chapter.verses?.[verseNumber - 1] || null
    }

    function searchInBible(books: any[], searchTerm: string): any[] {
        const results = []
        const searchLower = searchTerm.toLowerCase()

        books.forEach((book) => {
            book.chapters?.forEach((chapter, chapterIndex) => {
                chapter.verses?.forEach((verse, verseIndex) => {
                    if (verse.text.toLowerCase().includes(searchLower)) {
                        results.push({
                            book: book,
                            chapter: chapter,
                            verse: verse,
                            reference: `${book.number}.${chapter.number}.${verse.number}`,
                            referenceFull: `${book.name} ${chapter.number}:${verse.number}`,
                            verseText: verse.text
                        })
                    }
                })
            })
        })

        return results.slice(0, 50) // Limit to 50 results
    }

    function updateSearch(searchVal: string, scriptureCache: any, openedScriptureId: string) {
        if (!searchVal.trim()) {
            searchResults = []
            searchResult = { reference: "", referenceFull: "", verseText: "" }
            return
        }

        const scripture = scriptureCache[openedScriptureId]
        if (!scripture?.books) return

        const books = scripture.books

        // Try to parse as scripture reference first
        const referenceMatch = searchVal.match(/^(.+?)\s+(\d+)(?:[:\.,]\s*(\d+))?(?:-(\d+))?/)
        
        if (referenceMatch) {
            const [, bookPart, chapterPart, versePart] = referenceMatch
            
            const book = findBook(books, bookPart)
            if (book) {
                const chapter = findChapter(book, chapterPart)
                if (chapter) {
                    if (versePart) {
                        // Specific verse
                        const verse = findVerse(chapter, versePart)
                        if (verse) {
                            searchResult = {
                                reference: `${book.number}.${chapter.number}.${verse.number}`,
                                referenceFull: `${book.name} ${chapter.number}:${verse.number}`,
                                verseText: verse.text
                            }
                            searchResults = [searchResult]
                            return
                        }
                    } else {
                        // Whole chapter
                        searchResults = chapter.verses?.map((verse, index) => ({
                            reference: `${book.number}.${chapter.number}.${verse.number}`,
                            referenceFull: `${book.name} ${chapter.number}:${verse.number}`,
                            verseText: verse.text
                        })) || []
                        if (searchResults.length > 0) {
                            searchResult = searchResults[0]
                            return
                        }
                    }
                }
            }
        }

        // If not a valid reference, search for text content
        const textResults = searchInBible(books, searchVal)
        searchResults = textResults
        if (textResults.length > 0) {
            searchResult = textResults[0]
        } else {
            searchResult = { reference: "", referenceFull: "", verseText: "" }
        }
    }
    function playSearchVerse(reference?: string) {
        const ref = reference || searchResult.reference
        if (!ref) return
        
        // Parse the reference to navigate to the verse
        const [bookNumber, chapterNumber, verseNumber] = ref.split('.').map(Number)
        
        // Set depth to verse level (2) and navigate to the specific verse
        depth = 2
        
        // Send the scripture reference to display
        send("API:start_scripture", { id: collectionId || openedScripture, reference: ref })
        
        // Close search after selecting
        openScriptureSearch = false
    }

    function highlightSearchTerm(text: string, searchTerm: string): string {
        if (!searchTerm.trim()) return text
        
        // Don't highlight if it looks like a scripture reference
        const referenceMatch = searchTerm.match(/^(.+?)\s+(\d+)(?:[:\.,]\s*(\d+))?(?:-(\d+))?/)
        if (referenceMatch) return text
        
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
        return text.replace(regex, '<mark style="background-color: #ffeb3b; color: #000; padding: 0 2px;">$1</mark>')
    }
</script>

{#if openScriptureSearch}
    <div style="height: 100%; display: flex; flex-direction: column;">
        <input type="text" class="input" placeholder="Search" autofocus bind:value={searchValue} />

        <div style="flex: 1; overflow-y: auto; margin: 0.5rem 0;">
            {#if searchResults.length > 0}
                {#each searchResults.slice(0, 20) as result}
                    <div class="verse" on:click={() => playSearchVerse(result.reference)} style="margin-bottom: 0.5rem; cursor: pointer; padding: 0.5rem; border: 1px solid #333; border-radius: 0.25rem;">
                        <b style="color: white;">{result.referenceFull}</b>
                        <span style="display: block; margin-top: 0.25rem;">{@html highlightSearchTerm(result.verseText, searchValue)}</span>
                    </div>
                {/each}
                {#if searchResults.length > 20}
                    <p style="text-align: center; color: #666; font-size: 0.8em; margin: 0.5rem 0;">
                        Showing first 20 of {searchResults.length} results
                    </p>
                {/if}
            {:else if searchValue.trim()}
                <p style="text-align: center; color: #666; margin: 2rem 0; white-space: normal;">
                    No results found for "{searchValue}"
                </p>
            {/if}
        </div>

        <Button on:click={() => (openScriptureSearch = false)} style="width: 100%;" center dark>
            <Icon id="back" right />
            <p style="font-size: 0.8em;">{translate("actions.back", $dictionary)}</p>
        </Button>
    </div>
{:else}
    {#if openedScripture}
        <div style="display: flex; align-items: center; margin-bottom: 0.5rem; position: relative; z-index: 100;">
            <Button on:click={goBack} center style="padding: 0.4rem; position: absolute; left: 0; z-index: 101;" dark={depth === 0}>
                <Icon size={1.2} id="back" />
            </Button>
            <h2 class="header" style="flex: 1; text-align: center; margin: 0;">
                {$scriptures[collectionId || openedScripture]?.customName || $scriptures[collectionId || openedScripture]?.name || ""}
            </h2>
            <Button on:click={() => (openScriptureSearch = true)} center style="padding: 0.4rem; position: absolute; right: 0; z-index: 101;" dark={depth === 0}>
                <Icon size={1.2} id="search" />
            </Button>
        </div>
        
        <div class="bible">
            {#if $scriptureCache[openedScripture]}
                <!-- {tablet} -->
                <ScriptureContent id={collectionId || openedScripture} scripture={$scriptureCache[openedScripture]} bind:depth />
            {:else}
                <Loading />
            {/if}
        </div>

        {#if $isCleared.all}
            <div style="display: flex;">
                <Button on:click={() => (depth ? depth-- : openScripture(""))} style="width: 100%;" center dark>
                    <Icon id="back" right />
                    <p style="font-size: 0.8em;">{translate("actions.back", $dictionary)}</p>
                </Button>

                {#if depth === 2}
                    <Button on:click={() => scriptureViewList.set(!$scriptureViewList)} center dark>
                        <Icon id={$scriptureViewList ? "grid" : "list"} white />
                    </Button>
                {/if}
            </div>
        {:else}
            <div class="buttons" style="display: flex;width: 100%;background-color: var(--primary-darker);">
                <Button style="flex: 1;" on:click={previous} center><Icon size={1.8} id="previous" /></Button>
                <Button style="flex: 1;" on:click={next} center><Icon size={1.8} id="next" /></Button>
            </div>
            {#if !tablet}
                <Clear />
            {/if}
        {/if}
    {:else if sortedBibles.length}
        <h2 class="header" style="margin-bottom: 0.5rem;">
            {translate("tabs.scripture", $dictionary)}
        </h2>
        {#each sortedBibles as scripture}
            <Button
                on:click={() => {
                    const collection = $scriptures[scripture.id].collection
                    openScripture(collection ? collection.versions[0] : scripture.id, collection ? scripture.id : "")
                }}
                title={scripture.customName || scripture.name}
                style="padding: 0.5em 0.8em;"
                bold={false}
            >
                <Icon id={scripture.icon} right />
                <p>{scripture.customName || scripture.name}</p>
            </Button>
        {/each}
    {:else}
        <Center faded>{translate("empty.general", $dictionary)}</Center>
    {/if}
{/if}

<style>
    p {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .bible {
        flex: 1;
        overflow-y: hidden;
    }

    .verse {
        display: flex;
        flex-direction: column;
        padding: 10px;

        overflow: auto;
    }
    .verse:hover {
        background-color: var(--primary-darker);
    }

    /* text input */

    .input {
        width: 100%;

        background-color: rgb(0 0 0 / 0.2);
        color: var(--text);
        padding: 10px 18px;
        border: none;
        font-size: inherit;

        border-bottom: 2px solid var(--secondary);
    }
    .input:active,
    .input:focus {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
    }
    .input::placeholder {
        color: inherit;
        opacity: 0.4;
    }
</style>
