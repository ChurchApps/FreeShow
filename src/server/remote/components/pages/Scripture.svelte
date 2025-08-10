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
    let searchResult = { reference: "", referenceFull: "", verseText: "" }
    $: if (searchValue) filterBibleSearch()
    function filterBibleSearch() {
        const formatName = (name: string) => name.toLowerCase()

        const searchBook = formatName(searchValue.split(" ")[0] || "")
        const searchChapter = searchValue.split(" ")[1]?.split(":")[0] || ""
        const searchVerse = searchValue.split(" ")[1]?.split(":")[1] || ""
        if (!searchChapter || !searchValue) return

        const scripture = $scriptureCache[openedScripture]
        const bookIndex = scripture?.books?.findIndex((a) => formatName(a.name) === searchBook)
        if (bookIndex < 0) return

        const book = scripture.books[bookIndex]
        const chapter = book?.chapters?.[Number(searchChapter) - 1]
        const verse = chapter?.verses?.[Number(searchVerse) - 1]
        if (!book || !chapter || !verse) return

        searchResult = {
            reference: `${book.number}.${chapter.number}.${verse.number}`,
            referenceFull: `${scripture.books[bookIndex].name} ${chapter.number}:${verse.number}`,
            verseText: verse.text
        }
    }
    function playSearchVerse() {
        if (!searchResult.reference) return
        send("API:start_scripture", { id: collectionId || openedScripture, reference: searchResult.reference })
    }
</script>

{#if openScriptureSearch}
    <div style="height: 100%;">
        <input type="text" class="input" placeholder="Search... (e.g. Genesis 1:1)" autofocus bind:value={searchValue} />

        <div class="verse" on:click={playSearchVerse}>
            <b>{searchResult.referenceFull}</b>
            <span>{@html searchResult.verseText}</span>
        </div>
    </div>

    <Button on:click={() => (openScriptureSearch = false)} style="width: 100%;" center dark>
        <Icon id="back" right />
        <p style="font-size: 0.8em;">{translate("actions.back", $dictionary)}</p>
    </Button>
{:else}
    {#if openedScripture}
        <div style="display: flex; align-items: center; margin-bottom: 0.5rem; position: relative; z-index: 100;">
            <Button on:click={goBack} center style="padding: 0.4rem; position: absolute; left: 0; z-index: 101;" dark={depth === 0}>
                <Icon size={1.2} id="back" />
            </Button>
            <h2 class="header" style="flex: 1; text-align: center; margin: 0;">
                {$scriptures[collectionId || openedScripture]?.customName || $scriptures[collectionId || openedScripture]?.name || ""}
            </h2>
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

                {#if depth === 0}
                    <Button on:click={() => (openScriptureSearch = true)} center dark>
                        <Icon id="search" />
                    </Button>
                {:else if depth === 2}
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
