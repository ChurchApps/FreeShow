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
        // removeValues(sortObject(keysToID(s), "name"), "private", true)
    }
    let filteredShows: any[]
    let filteredStored: any
    $: filteredStored = showsSorted
    // $: filteredStored = showsSorted.filter((s: any) => category === "all" || category === s.category || (category === "unlabeled" && s.category === null))
    // $: console.log(filteredStored)

    export let firstMatch: null | string = null
    $: {
        if (searchValue.length > 1) setTimeout(findMatches, 10)
        else {
            filteredShows = filteredStored
            firstMatch = null
        }
    }

    function findMatches() {
        filteredShows = []
        filteredStored.forEach((s: any) => {
            let match = search(s)
            if (match) filteredShows.push({ ...s, match })
        })
        // filteredShows = sortObjectNumbers(filteredShows, "match", true) as ShowId[]
        filteredShows = filteredShows.sort((a: any, b: any) => (a.match < b.match ? 1 : a.match > b.match ? -1 : 0))
        firstMatch = filteredShows[0]?.id || null
    }

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

    let totalMatch: number = 0
    $: totalMatch = searchValue ? 0 : 0
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

        totalMatch += sum
        return Math.min(sum, 100)
    }

    // click on content
    // function click(e: any) {
    //     if (e.clientX < window.innerWidth / 3) previous()
    //     else next()
    // }

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
        if (e.key === "Enter") openShow(filteredShows[0].id)
    }

    // show quick play
    function toggleQuickPlay(e: any) {
        let quickPlay = e.target.checked
        localStorage.setItem("quickPlay", quickPlay.toString())
        _set("quickPlay", quickPlay)
    }

    function newShow() {
        createShow.set(true)
    }

    onMount(() => {
        try {
            _set("quickPlay", localStorage.getItem("quickPlay") === "true")
        } catch (err) {
            console.log("Unable to use LocalStorage!")
        }

        setTimeout(() => (loadingStarted = true), 10)
        // initialize custom scrollbar metrics
        setTimeout(updateScrollbarMetrics, 0)
        window.addEventListener("resize", handleResize)
        return () => {
            window.removeEventListener("resize", handleResize)
            window.removeEventListener("pointermove", onThumbPointerMove)
            if (scrollRaf !== null) cancelAnimationFrame(scrollRaf)
            if (resizeRaf !== null) cancelAnimationFrame(resizeRaf)
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

    // CUSTOM MOBILE SCROLLBAR (visible and draggable)
    let enableCustomScrollbar = false
    let isCoarsePointer = false
    let thumbHeight = 0
    let thumbTop = 0
    let isDragging = false
    let dragOffsetY = 0

    function updateScrollbarMetrics() {
        if (!scrollElem) return
		// Determine if device uses a coarse pointer (touch). Only then use custom scrollbar
		isCoarsePointer = typeof window !== "undefined" ? window.matchMedia("(pointer: coarse)").matches : false
		const scrollHeight = scrollElem.scrollHeight
		const clientHeight = scrollElem.clientHeight
		const scrollable = scrollHeight - clientHeight
		// account for bottom padding reserved for action buttons so track aligns visually
		const paddingBottomStr = getComputedStyle(scrollElem).paddingBottom || "0px"
		const paddingBottom = Number(paddingBottomStr.replace("px", "")) || 0
		const effectiveClientHeight = Math.max(0, clientHeight - paddingBottom)
		enableCustomScrollbar = isCoarsePointer
        if (!enableCustomScrollbar) return

		const minThumb = 36
		thumbHeight = Math.max((effectiveClientHeight / scrollHeight) * effectiveClientHeight, minThumb)
		const maxThumbTop = Math.max(0, effectiveClientHeight - thumbHeight)
		const ratio = scrollable === 0 ? 0 : scrollElem.scrollTop / scrollable
		thumbTop = Math.min(maxThumbTop, Math.max(0, ratio * maxThumbTop))
    }
    let scrollRaf: number | null = null
    function handleScroll() {
        if (scrollRaf !== null) return
        scrollRaf = requestAnimationFrame(() => {
            updateScrollbarMetrics()
            scrollRaf = null
        })
    }
    let resizeRaf: number | null = null
    function handleResize() {
        if (resizeRaf !== null) return
        resizeRaf = requestAnimationFrame(() => {
            updateScrollbarMetrics()
            resizeRaf = null
        })
    }

    function onThumbPointerDown(e: PointerEvent) {
        if (!scrollElem) return
        isDragging = true
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
        const rect = scrollElem.getBoundingClientRect()
        dragOffsetY = e.clientY - (rect.top + thumbTop)
        window.addEventListener("pointermove", onThumbPointerMove)
        window.addEventListener("pointerup", onThumbPointerUp, { once: true })
        window.addEventListener("pointercancel", onThumbPointerUp, { once: true })
    }

    function onThumbPointerMove(e: PointerEvent) {
        if (!isDragging || !scrollElem) return
        const rect = scrollElem.getBoundingClientRect()
		const clientHeight = scrollElem.clientHeight
		const scrollable = scrollElem.scrollHeight - clientHeight
		const paddingBottomStr = getComputedStyle(scrollElem).paddingBottom || "0px"
		const paddingBottom = Number(paddingBottomStr.replace("px", "")) || 0
		const effectiveClientHeight = Math.max(0, clientHeight - paddingBottom)
		const maxThumbTop = Math.max(0, effectiveClientHeight - thumbHeight)
        let y = e.clientY - rect.top - dragOffsetY
        y = Math.min(maxThumbTop, Math.max(0, y))
        thumbTop = y
        const ratio = maxThumbTop === 0 ? 0 : y / maxThumbTop
        scrollElem.scrollTop = ratio * scrollable
    }

    function onThumbPointerUp() {
        isDragging = false
        window.removeEventListener("pointermove", onThumbPointerMove)
    }
</script>

{#if $shows.length}
    {#if $shows.length < 10 || loadingStarted}
        <input id="showSearch" type="text" class="input" placeholder="Search..." value={searchValue} on:input={updateTextValue} on:keydown={showSearchKeydown} on:click={select} bind:this={searchElem} />
        <!-- {#each shows as showObj}
<Button on:click={() => (show = showObj.id)}>{showObj.name}</Button>
{/each} -->
               <div class="scroll-wrap">
                       <div class="scroll" class:hide-native={enableCustomScrollbar} bind:this={scrollElem} on:scroll={handleScroll}>
				{#each filteredShows as show}
					{#if searchValue.length <= 1 || show.match}
						<ShowButton on:click={(e) => openShow(e.detail)} activeShow={$activeShow} show={show} data={dateToString(show.timestamps?.created, true)} match={show.match || null} />
					{/if}
				{/each}
				{#if enableCustomScrollbar}
                <div class="scrollbar" style={`top:${scrollElem?.getBoundingClientRect ? scrollElem.getBoundingClientRect().top + window.scrollY : 0}px; bottom:var(--bottom-actions-height, 96px);`}>
					<div
						class="scrollbar-thumb"
						style={`height:${thumbHeight}px; transform: translateY(${thumbTop}px);`}
						on:pointerdown={onThumbPointerDown}
					/>
				</div>
				{/if}
			</div>
		</div>
        {#if searchValue.length > 1 && totalMatch === 0}
            <Center faded>{translate("empty.search", $dictionary)}</Center>
        {/if}

        {#if searchValue.length < 2}
            <div class="buttons">
                {#if !tablet}
                    <div class="check">
                        <p style="font-size: 0.8em;">{translate("remote.quick_play", $dictionary)}</p>
                        <Checkbox checked={$quickPlay} on:change={toggleQuickPlay} />
                    </div>
                {/if}

                <Button on:click={newShow} style="width: 100%;" center dark>
                    <Icon id="add" right />
                    <p style="font-size: 0.8em;">{translate("new.show", $dictionary)}</p>
                </Button>
            </div>
        {/if}
    {:else}
        <Center faded>{translate("remote.loading", $dictionary)}</Center>
    {/if}
{:else}
    <Center faded>{translate("empty.shows", $dictionary)}</Center>
{/if}

<style>
    :global(:root) {
        --bottom-actions-height: 96px;
    }
    .scroll-wrap { position: relative; display: contents; }
    .scroll {
        display: flex;
        flex-direction: column;
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
        /* ensure content and scrollbar don't sit under the bottom action bar */
        padding-bottom: var(--bottom-actions-height, 96px);
		/* keep room for scrollbar so content isn't underneath */
		scrollbar-gutter: stable both-edges;
		/* mobile/touch improvements */
		-webkit-overflow-scrolling: touch;
		touch-action: pan-y;
		overscroll-behavior: contain;
        /* FreeShow UI scrollbar */
        scrollbar-width: thin;
        scrollbar-color: rgb(255 255 255 / 0.3) rgb(255 255 255 / 0.05);
    }
    /* Hide native scrollbar when custom one is enabled */
    .hide-native {
        scrollbar-width: none; /* Firefox */
    }
    .hide-native::-webkit-scrollbar { width: 0; height: 0; }
    /* WebKit FreeShow UI */
    .scroll::-webkit-scrollbar { width: 8px; height: 8px; }
    .scroll::-webkit-scrollbar-track,
    .scroll::-webkit-scrollbar-corner { background: rgb(255 255 255 / 0.05); }
    .scroll::-webkit-scrollbar-thumb { background: rgb(255 255 255 / 0.3); border-radius: 8px; }
    .scroll::-webkit-scrollbar-thumb:hover { background: rgb(255 255 255 / 0.5); }

	/* Larger, easier scrollbar on touch devices */
	@media (pointer: coarse) {
		.scroll {
			padding-inline-end: 12px;
			scrollbar-width: thick; /* Firefox */
		}
		.scroll::-webkit-scrollbar { width: 18px; height: 18px; }
	}

    /* Custom visible scrollbar track/thumb */
    .scrollbar {
        position: fixed;
        right: 2px;
        width: 10px;
        display: block;
        pointer-events: none; /* let content receive events; thumb will enable on pointerdown */
    }
    .scrollbar-thumb {
        position: absolute;
        right: 0;
        width: 10px;
        border-radius: 8px;
        background: rgb(255 255 255 / 0.35);
        box-shadow: 0 0 0 1px rgb(0 0 0 / 0.2);
        pointer-events: auto; /* thumb is interactive */
        touch-action: none; /* we'll handle dragging */
    }
    .scrollbar-thumb:active { background: rgb(255 255 255 / 0.55); }

    /* quick play */
    .check {
        display: flex;
        background-color: var(--primary-darker);
        justify-content: space-between;
        padding: 10px;
        align-items: center;
    }

    .input {
        background-color: rgb(0 0 0 / 0.2);
        color: var(--text);
        /* font-family: inherit; */
        padding: 10px 18px;
        border: none;
        font-size: inherit;

        border-bottom: 2px solid var(--secondary);
    }
    .input:active,
    .input:focus {
        outline: 2px solid var(--secondary);
        outline-offset: -2px;
        /* background-color: var(--secondary-opacity); */
    }
    .input::placeholder {
        color: inherit;
        opacity: 0.4;
    }

    /* keep bottom actions visually above and separated from the scroll area */
    .buttons {
        position: sticky;
        bottom: 0;
        background-color: var(--primary-darker);
        border-top: 2px solid var(--primary-lighter);
        z-index: 1;
    }
</style>
