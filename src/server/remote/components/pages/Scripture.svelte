<script lang="ts">
    import Button from "../../../common/components/Button.svelte"
    import Center from "../../../common/components/Center.svelte"
    import Icon from "../../../common/components/Icon.svelte"
    import Loading from "../../../common/components/Loading.svelte"
    import { keysToID } from "../../../common/util/helpers"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { dictionary, isCleared, scriptureCache, scriptures, scriptureViewList, outSlide, outShow } from "../../util/stores"
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
	let scriptureContentRef: any
    let currentBook = ""
    let currentChapter = ""
    let currentVerse = ""

    function next() {
        if ($isCleared.all) {
            // When cleared: if a verse is highlighted, move verse; otherwise move chapter/book
            scriptureContentRef?.forward?.()
        } else {
            // Live: use existing API trigger to advance verse/selection
            send("API:scripture_next")
        }
    }
    function previous() {
        if ($isCleared.all) {
            scriptureContentRef?.backward?.()
        } else {
            send("API:scripture_previous")
        }
    }

    // SEARCH

    $: if (triggerScriptureSearch) triggerSearch()
    function triggerSearch() {
        openScriptureSearch = true
        triggerScriptureSearch = false
    }

    function closeSearch() {
        openScriptureSearch = false
        // Ensure the current scripture is loaded when returning
        if (openedScripture && !$scriptureCache[openedScripture]) {
            send("GET_SCRIPTURE", { id: openedScripture })
        }
    }

	let openScriptureSearch = false
	let searchValue = ""
	type SearchItem = { reference: string; referenceFull: string; verseText: string }
    let searchResults: SearchItem[] = []
    let searchResult: SearchItem = { reference: "", referenceFull: "", verseText: "" }
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
            const abbreviations: Record<string, string> = {
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

    type RawSearchHit = { book: any; chapter: any; verse: any; reference: string; referenceFull: string; verseText: string }
    function searchInBible(books: any[], searchTerm: string): RawSearchHit[] {
        const results: RawSearchHit[] = []
        const searchLower = searchTerm.toLowerCase()

        books.forEach((book) => {
            book.chapters?.forEach((chapter: any) => {
                chapter.verses?.forEach((verse: any) => {
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

        return results.slice(0, 50)
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
                        searchResults = chapter.verses?.map((verse: any) => ({
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
        searchResults = textResults.map((r) => ({ reference: r.reference, referenceFull: r.referenceFull, verseText: r.verseText }))
        if (searchResults.length > 0) {
            searchResult = searchResults[0]
        } else {
            searchResult = { reference: "", referenceFull: "", verseText: "" }
        }
    }
    function playSearchVerse(reference?: string) {
        const ref = reference || searchResult.reference
        if (!ref) return

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
        <div class="search-bar-row">
            <button class="header-action" aria-label="Back" on:click={closeSearch}>
                <Icon id="back" size={1.2} />
            </button>
            <input type="text" class="input search-input" placeholder="Search" autofocus bind:value={searchValue} />
        </div>

        <div class="search-scroll" style="flex: 1; overflow-y: auto; margin: 0.5rem 0;">
            {#if searchResults.length > 0}
                {#each searchResults.slice(0, 20) as result}
                    <div class="verse" role="button" tabindex="0" on:click={() => playSearchVerse(result.reference)} on:keydown={(e) => (e.key === 'Enter' ? playSearchVerse(result.reference) : null)} style="margin-bottom: 0.5rem; cursor: pointer; padding: 0.5rem; border: 1px solid #333; border-radius: 0.25rem;">
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

        
    </div>
{:else}
    {#if openedScripture}
		<div class="header-bar" style="margin-bottom: 0.5rem;" class:has-ref={!!depth}>
			<button class="header-action" aria-label="Back" on:click={() => (depth ? scriptureContentRef?.goBack?.() : openScripture(""))}>
				<Icon id="back" size={1.5} />
			</button>
			<div class="header-center">
				<h2 class="header-title">
					{$scriptures[collectionId || openedScripture]?.customName || $scriptures[collectionId || openedScripture]?.name || ""}
				</h2>
				<div class="header-ref">
					{#if depth}
						{#if currentBook}{currentBook}{/if}
					{#if currentChapter}
						 {currentChapter}{#if +currentVerse > 0}:{currentVerse}{/if}
						{/if}
					{/if}
				</div>
			</div>
			<button class="header-action" aria-label="Search scripture" on:click={() => (openScriptureSearch = true)}>
				<Icon id="search" size={1.5} />
			</button>
		</div>
        
        <div class="bible">
            {#if $scriptureCache[openedScripture]}
                <!-- {tablet} -->
				<ScriptureContent 
                    id={collectionId || openedScripture} 
                    scripture={$scriptureCache[openedScripture]} 
                    bind:depth 
                    bind:currentBook
                    bind:currentChapter
                    bind:currentVerse
					bind:this={scriptureContentRef}
                />
            {:else}
                <Loading />
            {/if}
        </div>

        {#if $isCleared.all}
            {#if depth === 2}
                <div class="cleared-controls" style="display: flex; width: 100%; gap: 8px; background-color: var(--primary-darker);">
                    {#if +currentVerse > 0 || ($outShow && $outSlide !== null)}
                        <Button style="flex: 1;" on:click={previous} center><Icon size={1.8} id="previous" /></Button>
                        <Button style="flex: 1;" on:click={next} center><Icon size={1.8} id="next" /></Button>
                        <Button on:click={() => scriptureViewList.set(!$scriptureViewList)} center dark>
                            <Icon id={$scriptureViewList ? "grid" : "list"} white />
                        </Button>
                    {:else}
                        <Button style="flex: 1;" on:click={() => scriptureViewList.set(!$scriptureViewList)} center dark>
                            <Icon id={$scriptureViewList ? "grid" : "list"} white />
                        </Button>
                    {/if}
                </div>
            {/if}
        {:else}
            <div class="buttons" style="display: flex; width: 100%; gap: 8px; background-color: var(--primary-darker);">
                {#if depth === 2}
                    {#if +currentVerse > 0}
                        <Button style="flex: 1;" on:click={previous} center><Icon size={1.8} id="previous" /></Button>
                        <Button style="flex: 1;" on:click={next} center><Icon size={1.8} id="next" /></Button>
                        <Button on:click={() => scriptureViewList.set(!$scriptureViewList)} center dark>
                            <Icon id={$scriptureViewList ? "grid" : "list"} white />
                        </Button>
                    {:else}
                        <Button style="flex: 1;" on:click={() => scriptureViewList.set(!$scriptureViewList)} center dark>
                            <Icon id={$scriptureViewList ? "grid" : "list"} white />
                        </Button>
                    {/if}
                {:else}
                    <Button style="flex: 1;" on:click={previous} center><Icon size={1.8} id="previous" /></Button>
                    <Button style="flex: 1;" on:click={next} center><Icon size={1.8} id="next" /></Button>
                {/if}
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
        white-space: normal;
        overflow: visible;
        text-overflow: unset;
        word-wrap: break-word;
    }

    .header {
        white-space: normal;
        word-wrap: break-word;
        overflow-wrap: break-word;
        max-width: 100%;
    }

	/* Unified header bar with title, ref and actions */
	.header-bar {
		display: flex;
		align-items: center; /* vertically center icons */
		justify-content: space-between;
		gap: 0.5rem;
		overflow: hidden;
		padding-top: 8px;
		padding-bottom: 8px;
		min-height: 52px; /* larger touch target */
		/* Match the darker show header style */
		background-color: var(--primary-darker);
		border-bottom: 2px solid var(--primary-lighter);
	}
	/* keep same vertical rhythm even when reference exists */
	.header-bar.has-ref { padding-top: 8px; padding-bottom: 8px; }
	.header-center {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		min-width: 0; /* enable ellipsis in children */
		line-height: 1; /* keep block height tight so actions don't shift */
		justify-content: flex-start;
	}
	.header-title {
		margin: 0;
		line-height: 1.1;
		font-weight: 700;
		font-size: clamp(1.15rem, 6vw, 1.6rem);
		max-width: 100%;
		/* let JS autosizer control wrapping and width */
		white-space: nowrap;
		overflow: hidden;
		text-overflow: clip;
		/* Ensure translation label is white like the show header */
		color: var(--text);
	}
	/* When reference is present, allow the title to scale smaller to avoid clipping */
	.header-bar.has-ref .header-title {
		font-size: clamp(0.95rem, 4.5vw, 1.4rem);
	}
	.header-ref {
		margin-top: 0;
		font-size: clamp(0.95rem, 4.5vw, 1.1rem);
		color: var(--text);
		opacity: 0.9;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.header-bar.has-ref .header-ref { margin-top: 6px; }
	/* When no reference, let title use two lines (avoid ellipsis) and hide the ref row */
	.header-bar:not(.has-ref) .header-title {
		white-space: normal;
		text-align: center;
		overflow-wrap: anywhere;
	}
	.header-bar:not(.has-ref) .header-ref { display: none; }
	/* Center the title vertically when no reference line is shown */
	.header-bar:not(.has-ref) .header-center { justify-content: center; }
	.header-action {
		background: transparent;
		border: none;
		padding: 0 12px; /* tall clickable area */
		display: flex;
		align-items: center;
		align-self: stretch; /* fill header height */
		cursor: pointer;
		color: var(--secondary);
		border-radius: 6px;
		margin-top: 0;
		min-width: 44px; /* accessible hit size */
	}
	.header-action:hover {
		background-color: var(--hover);
	}

	/* Slightly larger icon hit area and size */
	.header-action { transform: scale(1.0); }

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
	.search-bar-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.search-input {
		flex: 1;
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

    /* FreeShow UI scrollbar for scripture search (desktop) */
    .search-scroll {
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }
    .search-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
    .search-scroll::-webkit-scrollbar-track,
    .search-scroll::-webkit-scrollbar-corner { background: rgb(255 255 255 / 0.05); }
    .search-scroll::-webkit-scrollbar-thumb { background: rgb(255 255 255 / 0.3); border-radius: 8px; }
    .search-scroll::-webkit-scrollbar-thumb:hover { background: rgb(255 255 255 / 0.5); }
</style>