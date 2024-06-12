<script lang="ts">
    import { clone } from "../../helpers/array"

    export let items: any[] = []
    export let columns: number = 1

    $: console.log(items)

    // let width: number = 0
    let viewHeight: number = 0

    // get dimensions
    let customCard: any
    let cardWidth = 0
    let cardHeight = 0

    let ready: boolean = false
    let totalScrollHeight: number = 0
    $: if (customCard) initialize()
    function initialize() {
        cardWidth = customCard.offsetWidth
        cardHeight = customCard.offsetHeight
        console.log(cardWidth, cardHeight)
        totalScrollHeight = (cardHeight * items.length) / columns
        console.log(totalScrollHeight)
        console.log("READY")

        ready = true
    }

    let topHeight: number = 0
    let bottomHeight: number = 0
    // WIP DEBUG
    let margin: number = 20 // 100

    let scrollYPos = 0
    let lastUpdate = 0
    function scroll(e) {
        // console.log(e)
        scrollYPos = e.target.scrollTop
        // WIP ending
        // console.log(scrollYPos > totalScrollHeight - viewHeight - 20, scrollYPos, totalScrollHeight - viewHeight)
        if (scrollYPos > totalScrollHeight - viewHeight - 20) return
        console.log("SCROLL", scrollYPos)

        topHeight = Math.max(0, scrollYPos - margin)
        let view = viewHeight + margin * 2
        bottomHeight = Math.max(0, totalScrollHeight - scrollYPos - view)
        console.log("TOP - BOTTOM", topHeight, bottomHeight)

        // update if scrolling more than one card up/down
        if (scrollYPos + cardHeight > lastUpdate || scrollYPos - cardHeight < lastUpdate) {
            lastUpdate = scrollYPos
            updateVisibleItems()
        }
    }

    let visibleItems: any[] = []
    $: if (ready && items && columns) updateVisibleItems(true)

    function updateVisibleItems(updateScrollHeight: boolean = false) {
        if (updateScrollHeight) totalScrollHeight = (cardHeight * items.length) / columns

        // let stackedItems = items.length / columns
        let topItemIndex = Math.floor(topHeight / cardHeight) * columns
        // let firstVisible = stackedItems * columns
        let bottomItemIndex = Math.ceil((totalScrollHeight - bottomHeight) / cardHeight) * columns + columns
        // console.log(topItemIndex, bottomItemIndex)

        let newItems = clone(items)
        visibleItems = newItems.slice(topItemIndex, bottomItemIndex)
        // console.log(visibleItems)
    }
</script>

<div class="grid" on:scroll={scroll} bind:clientHeight={viewHeight}>
    {#if !ready}
        <div class="card invisible" style="width: {100 / columns}%;" bind:this={customCard}>
            <slot item={clone(items[0])} />
        </div>
    {:else}
        <div class="filler topScroll" style="height: {topHeight}px;"></div>
        {#each visibleItems as item}
            <!-- style="width: {width / columns}px;" -->
            <div class="card" style="width: {100 / columns}%;">
                <slot {item} />
            </div>
        {/each}
        <div class="filler bottomScroll" style="height: {bottomHeight}px;"></div>
    {/if}
</div>

<style>
    .grid {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        padding: 5px;

        width: 100%;
        height: 100%;

        overflow-y: auto;
    }

    .card {
        display: flex;
        flex-direction: column;
    }
    .invisible {
        opacity: 0;
    }

    .filler {
        /* WIP DEBUG */
        background-color: red;
        /* width: 100%; */
    }
</style>
