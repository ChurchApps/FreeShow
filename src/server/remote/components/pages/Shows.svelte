<script lang="ts">
    import { onMount } from "svelte"
    import Center from "../../../common/components/Center.svelte"
    import Checkbox from "../../../common/components/Checkbox.svelte"
    import { dateToString } from "../../../common/util/time"
    import { translate } from "../../util/helpers"
    import { send } from "../../util/socket"
    import { _set, activeShow, createShow, dictionary, quickPlay, shows, showSearchValue } from "../../util/stores"
    import ShowButton from "../ShowButton.svelte"
    import Button from "../../../common/components/Button.svelte"
    import Icon from "../../../common/components/Icon.svelte"

    export let tablet: boolean = false

    $: searchValue = $showSearchValue
    // sort shows in alphabeticly order
    let showsSorted: any
    $: {
        showsSorted = $shows.filter((s) => s.private !== true).sort((a: any, b: any) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    }
    let filteredShows: any[] = []
    let filteredStored: any
    $: filteredStored = showsSorted

    export let firstMatch: null | string = null
    
    // Performance: Limit visible items to prevent browser crash with large lists
    const MAX_VISIBLE_ITEMS = 500
    let visibleShows: any[] = []
    
    // Debounce search for better performance
    let searchTimeout: number | null = null
    $: {
        if (searchTimeout !== null) clearTimeout(searchTimeout)
        if (searchValue.length > 1) {
            searchTimeout = setTimeout(findMatches, 150) as unknown as number
        } else {
            filteredShows = filteredStored || []
            firstMatch = null
            updateVisibleShows()
        }
    }

    function findMatches() {
        if (!filteredStored) return
        
        filteredShows = []
        filteredStored.forEach((s: any) => {
            let match = search(s)
            if (match) filteredShows.push({ ...s, match })
        })
        // Sort results by match score
        filteredShows = filteredShows.sort((a: any, b: any) => (a.match < b.match ? 1 : a.match > b.match ? -1 : 0))
        firstMatch = filteredShows[0]?.id || null
        updateVisibleShows()
    }
    
    function updateVisibleShows() {
        // Limit visible items to prevent DOM overload
        if (!filteredShows || filteredShows.length === 0) {
            visibleShows = []
            return
        }
        visibleShows = filteredShows.slice(0, MAX_VISIBLE_ITEMS)
    }
    
    $: if (filteredShows !== undefined) updateVisibleShows()

    $: sva = formatSearch(searchValue).split(" ")
    const filter = (s: string) => s.toLowerCase().replace(/[.,\/#!?$%\^&\*;:{}=\-_`~() ]/g, "")
    const searchIncludes = (s: string, sv: string): boolean => filter(s).includes(sv)
    const searchEquals = (s: string, sv: string): boolean => filter(s) === sv

    const specialChars = /[.,\/#!?$%\^&\*;:{}=\-_'"´`~()]/g
    function formatSearch(value: string) {
        return value
            .toLowerCase()
            .replace(specialChars, "")
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
    }

    function search(obj: any): number {
        let match: any[] = []

        sva.forEach((sv: any, i: number) => {
            if (sv.length > 1) {
                match[i] = 0

                if (searchEquals(formatSearch(obj.name), sv)) match[i] = 100
                else if (searchIncludes(formatSearch(obj.name), sv)) match[i] += 25
            }
        })

        let sum = 0
        let hasZero = match.some((m) => {
            sum += m
            return m === 0
        })

        if (hasZero) sum = 0

        return Math.min(sum, 100)
    }

    // shows list
    let searchElem: HTMLInputElement | undefined
    function openShow(id: string) {
        send("SHOW", id)

        if ($quickPlay) {
            send("API:index_select_slide", { showId: id, index: 0 })
            searchElem?.select()
        } else {
            _set("active", { id, type: "show" })
            _set("activeTab", "show")
        }
    }

    function showSearchKeydown(e: any) {
        if (e.key === "Enter" && visibleShows.length > 0) {
            openShow(visibleShows[0].id)
        }
    }

    // show quick play
    function toggleQuickPlay(e: any) {
        let quickPlay = e.target.checked
        localStorage.setItem("quickPlay", quickPlay.toString())
        _set("quickPlay", quickPlay)
    }

    function newShow() {
        // Pre-fill with search value if available
        const initialName = searchValue.trim() || ""
        if (initialName) {
            createShow.set(initialName)
        } else {
            createShow.set(true)
        }
    }

    onMount(() => {
        try {
            _set("quickPlay", localStorage.getItem("quickPlay") === "true")
        } catch (err) {
            console.log("Unable to use LocalStorage!")
        }

        loadingStarted = true
        return () => {
            if (searchTimeout !== null) clearTimeout(searchTimeout)
        }
    })

    // SEARCH

    function updateTextValue(e: any) {
        showSearchValue.set(e.target?.value)
        selected = false
    }

    let selected = false
    function select(e: any) {
        if (selected) return
        e.target?.select()
        selected = true
    }

    // SCROLL

    let scrollElem: HTMLDivElement | undefined
    $: activeShowId = $activeShow?.id
    $: if (activeShowId && scrollElem && scrollElem.scrollTop < 10) {
        let activeElement = [...scrollElem.children].find((a) => a.id === activeShowId) as HTMLDivElement | undefined
        scrollElem.scrollTo(0, (activeElement?.offsetTop || 0) - 50 - 80)
    }

    // open tab instantly before loading content
    let loadingStarted: boolean = false
</script>

<div class="shows-container" class:has-quick-play={!tablet}>
    {#if $shows.length}
        {#if $shows.length < 10 || loadingStarted}
            <input id="showSearch" type="text" class="input" placeholder="Search..." value={searchValue} on:input={updateTextValue} on:keydown={showSearchKeydown} on:click={select} bind:this={searchElem} />
            <div class="scroll-wrap">
                <div class="scroll show-list" bind:this={scrollElem}>
                    {#each visibleShows as show (show.id)}
                        {#if searchValue.length <= 1 || show.match}
                            <ShowButton on:click={(e) => openShow(e.detail)} activeShow={$activeShow} show={show} data={dateToString(show.timestamps?.created, true)} match={show.match || null} />
                        {/if}
                    {/each}
                    {#if filteredShows.length > MAX_VISIBLE_ITEMS}
                        <div class="limit-notice">
                            <p>{translate("remote.showing_first", $dictionary) || "Showing first"} {MAX_VISIBLE_ITEMS} {translate("remote.of", $dictionary) || "of"} {filteredShows.length} {translate("main.shows", $dictionary) || "shows"}</p>
                            {#if searchValue.length > 1}
                                <p style="font-size: 0.9em; opacity: 0.7; margin-top: 4px;">{translate("remote.refine_search", $dictionary) || "Refine your search to see more results"}</p>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>
            {#if searchValue.length > 1 && filteredShows.length === 0}
                <Center faded>{translate("empty.search", $dictionary)}</Center>
            {/if}

            {#if !$createShow}
                <div class="floating-input-container">
                    <Button on:click={newShow} center dark class="floating-add-button" title={translate("new.show", $dictionary)}>
                        <Icon id="add" size={1.2} />
                        <span>{translate("new.show", $dictionary)}</span>
                    </Button>
                </div>
            {/if}

            {#if !tablet}
                <div class="check">
                    <p>{translate("remote.quick_play", $dictionary)}</p>
                    <Checkbox checked={$quickPlay} on:change={toggleQuickPlay} />
                </div>
            {/if}
        {:else}
            <Center faded>{translate("remote.loading", $dictionary)}</Center>
        {/if}
    {:else}
        <Center faded>{translate("empty.shows", $dictionary)}</Center>
    {/if}
</div>

<style>
    /* Main container */
    .shows-container {
        position: relative;
        display: flex;
        flex-direction: column;
        height: 100%;
        flex: 1;
    }

    /* Scroll container */
    .scroll-wrap {
        position: relative;
        display: contents;
    }

    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
        overscroll-behavior: contain;
        padding-bottom: 80px; /* Space for floating input */
        /* FreeShow UI scrollbar */
        scrollbar-width: thin; /* Firefox */
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }
    .scroll::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    .scroll::-webkit-scrollbar-track,
    .scroll::-webkit-scrollbar-corner {
        background: rgb(255 255 255 / 0.05);
    }
    .scroll::-webkit-scrollbar-thumb {
        background: rgb(255 255 255 / 0.3);
        border-radius: 8px;
    }
    .scroll::-webkit-scrollbar-thumb:hover {
        background: rgb(255 255 255 / 0.5);
    }

    /* Show list styling */
    .show-list {
        gap: 1px;
    }

    :global(.show-list) :global(button) {
        padding: 0.6em 1em;
        min-height: 48px;
        font-size: 1.1em;
        align-items: center;
        justify-content: flex-start;
        text-align: left;
        margin: 0;
    }

    :global(.show-list) :global(button) :global(p),
    :global(.show-list) :global(button) :global(span) {
        display: flex;
        align-items: center;
        line-height: 1.2;
        font-size: inherit;
        text-align: left;
    }

    :global(.show-list) :global(button) :global(svg) {
        width: 1.6em;
        height: 1.6em;
        flex-shrink: 0;
    }

    /* Input field */
    .input {
        background-color: rgb(0 0 0 / 0.2);
        color: var(--text);
        padding: 0.75em 1em;
        min-height: 56px;
        border: none;
        font-size: 1.05em;
        border-bottom: 2px solid var(--secondary);
        box-sizing: border-box;
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

    /* Quick play checkbox */
    .check {
        position: sticky;
        bottom: 0;
        display: flex;
        background-color: var(--primary-darkest);
        justify-content: space-between;
        padding: 0.5rem 1rem;
        align-items: center;
        font-size: 0.9em;
        font-weight: 600;
        min-height: auto;
        border-radius: 8px 8px 0 0;
        z-index: 1;
    }

    /* Floating input container */
    .floating-input-container {
        --size: 40px;
        --padding: 12px;
        --background: rgba(25, 25, 35, 0.85);

        position: absolute;
        bottom: 10px;
        right: 15px;
        z-index: 199;
        max-width: calc(100% - 64px);
    }

    .shows-container.has-quick-play .floating-input-container {
        bottom: 50px;
        right: 5px;
    }

    :global(.floating-add-button) {
        font-size: 1em;
        border-radius: 50px !important;
        height: var(--size);
        padding: 0 20px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0.5em;
        background: linear-gradient(var(--background), var(--background)) padding-box,
            linear-gradient(160deg, #8000f0 0%, #9000f0 10%, #b300f0 20%, #d100db 35%, var(--secondary) 100%) border-box !important;
        border: 2px solid transparent !important;
        transition: 0.4s filter ease;
        box-shadow: 1px 1px 6px rgb(0 0 0 / 0.4);
        backdrop-filter: blur(3px);
        overflow: visible !important; /* Prevent clipping of rounded corners */
    }

    :global(.floating-add-button:not(:disabled):hover) {
        background: linear-gradient(var(--background), var(--background)) padding-box,
            linear-gradient(160deg, #8000f0 0%, #9000f0 10%, #b300f0 20%, #d100db 35%, var(--secondary) 100%) border-box !important;
        filter: hue-rotate(15deg);
    }

    :global(.floating-add-button:not(:disabled):active) {
        background: linear-gradient(var(--background), var(--background)) padding-box,
            linear-gradient(160deg, #8000f0 0%, #9000f0 10%, #b300f0 20%, #d100db 35%, var(--secondary) 100%) border-box !important;
        filter: hue-rotate(30deg);
    }

    :global(.floating-add-button) :global(span) {
        white-space: nowrap;
    }

    /* Limit notice */
    .limit-notice {
        padding: 1em;
        text-align: center;
        color: var(--text);
        opacity: 0.8;
        font-size: 0.9em;
        background-color: rgb(0 0 0 / 0.1);
        margin-top: 8px;
        border-radius: 4px;
    }

    /* Mobile styles */
    @media screen and (max-width: 1000px) {
        .input {
            padding: 0.9em 1.2em;
            min-height: 60px;
            font-size: 1.15em;
        }

        .show-list {
            gap: 1px;
        }

        :global(.show-list) :global(button) {
            padding: 0.7em 1.1em;
            min-height: 52px;
            font-size: 1.2em;
        }

        :global(.show-list) :global(button) :global(svg) {
            width: 1.9em;
            height: 1.9em;
        }

        .check {
            padding: 0.5rem 1rem;
            font-size: 0.9em;
        }

        .floating-input-container {
            bottom: 45px; /* Positioned above quick play checkbox on mobile */
            right: 5px;
            max-width: calc(100% - 10px);
            min-width: 150px;
        }
    }
</style>
