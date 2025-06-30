<script lang="ts">
    export let items: any[] = []
    export let columns = 1

    let cardHeight = 0

    let customCard: HTMLDivElement | undefined
    let ready = false
    $: if (customCard && columns) initialize()
    function initialize() {
        if (!customCard) return
        cardHeight = customCard.offsetHeight
        ready = true
    }

    let scrollYPos = 0
    let lastUpdate = 0
    let scrollUpdateFrame: number | null = null
    function scroll(e) {
        scrollYPos = e.target.scrollTop

        // update if scrolling more than 0.4 card up/down
        let extraMargin = cardHeight * 0.4
        if (scrollYPos > lastUpdate + extraMargin || scrollYPos < lastUpdate - extraMargin) {
            lastUpdate = scrollYPos
            
            if (scrollUpdateFrame) cancelAnimationFrame(scrollUpdateFrame)
            scrollUpdateFrame = requestAnimationFrame(() => {
                updateVisibleItems()
                scrollUpdateFrame = null
            })
        }
    }

    const margin = 250

    let viewHeight = 0
    let verticalCardsVisible = 0
    $: verticalCardsVisible = Math.ceil((viewHeight + margin * 2) / cardHeight)

    let firstItemIndex = 0
    let lastItemIndex = 0

    // update on ready, items changed, or columns changed
    $: if (ready && items && columns) updateVisibleItems(true)
    function updateVisibleItems(update = false) {
        let top = Math.max(0, scrollYPos - margin)
        let firstVerticalItemIndex = Math.floor(top / cardHeight)
        let lastVerticalItemIndex = firstVerticalItemIndex + verticalCardsVisible

        let newFirst = firstVerticalItemIndex * columns
        let newLast = lastVerticalItemIndex * columns + columns

        if (update) {
            firstItemIndex = newFirst
            lastItemIndex = newLast
            return
        }

        if (newLast > lastItemIndex) {
            // scrolling down
            firstItemIndex = newFirst
            if (newLast > items.length) {
                lastItemIndex = items.length
                return
            }
            lastItemIndex = newLast - columns

            slowlyChange("last")
            return
        }

        if (newFirst < firstItemIndex) {
            // scrolling up
            lastItemIndex = newLast
            if (newFirst < 1) {
                firstItemIndex = 0
                return
            }
            firstItemIndex = newFirst + columns - 1

            slowlyChange("first")
            return
        }
    }

    let animationFrame: number | null = null
    function slowlyChange(type: "last" | "first", steps: number = columns - 1) {
        if (steps < 1) return
        
        if (animationFrame) cancelAnimationFrame(animationFrame)

        animationFrame = requestAnimationFrame(() => {
            if (type === "last") lastItemIndex++
            else if (type === "first") firstItemIndex--

            if (steps > 1) {
                slowlyChange(type, steps - 1)
            } else {
                animationFrame = null
            }
        })
    }

    let lazyLoader = 0
    let lazyLoadFrame: number | null = null
    $: if (ready && items?.length) lazyLoad(true)
    function lazyLoad(start = false) {
        if (start) {
            lazyLoader = 0
            if (lazyLoadFrame) cancelAnimationFrame(lazyLoadFrame)
        }
        
        lazyLoader++

        if (lazyLoader > lastItemIndex) {
            lazyLoader = items.length
        } else if (lazyLoader < items.length) {
            lazyLoadFrame = requestAnimationFrame(() => lazyLoad())
        }
    }

    // TODO: lagging a bit on scroll when rendering new components
</script>

<div class="grid" on:scroll={scroll} bind:clientHeight={viewHeight}>
    {#each items as item, i}
        {#if i === 0}
            <div bind:this={customCard} class="card" style="width: {100 / columns}%;">
                <slot {item} />
            </div>
        {:else if i > lazyLoader || i < firstItemIndex || i > lastItemIndex}
            <div style="width: {100 / columns}%;height: {cardHeight}px;"></div>
        {:else}
            <!-- WIP fade in -->
            <div class="card" style="width: {100 / columns}%;">
                <slot {item} />
            </div>
        {/if}
    {/each}
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
        overflow-x: hidden;
    }

    .card {
        display: flex;
        flex-direction: column;
    }
</style>
