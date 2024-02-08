<script lang="ts">
    import { createEventDispatcher } from "svelte"
    import { GetLayout } from "../../helpers/get"
    import Center from "../Center.svelte"
    import Slide from "./ShowSlide.svelte"
    import type { Resolution } from "../../../../types/Settings"

    export let outShow: null | any
    export let activeShow: null | any
    export let outSlide: null | number
    export let styleRes: null | any
    export let dictionary: any
    let resolution: Resolution = styleRes || { width: 1920, height: 1080 }
    let columns: number = 2

    // $: id = $activeShow!.id
    // $: currentShow = $shows[$activeShow!.id]
    // $: layoutSlides = [$shows[$activeShow!.id].layouts[$shows[$activeShow!.id].settings.activeLayout].slides, GetLayout($activeShow!.id)][1]
    $: layoutSlides = GetLayout(activeShow, activeShow?.settings?.activeLayout)

    // auto scroll
    export let scrollElem: any
    let lastScrollId = "-1"
    $: {
        if (scrollElem && outSlide !== null && outShow?.id === activeShow.id) {
            let index = Math.max(0, outSlide)
            if (outShow.id + index !== lastScrollId) {
                lastScrollId = outShow.id + index
                let offset = scrollElem.querySelector(".grid").children[index]?.offsetTop - scrollElem.offsetTop - 4 - 50
                scrollElem.scrollTo(0, offset)
            }
        }
    }

    let dispatch = createEventDispatcher()
    function click(i: number) {
        dispatch("click", i)
    }

    // pinch zoom
    let scaling: boolean = false
    const touchstart = (e: any) => {
        if (e.touches.length === 2) {
            scaling = true
        }
    }

    let prevDist = 0
    const touchmove = (e: any) => {
        if (scaling) {
            e.preventDefault()
            // TODO: pinch zoom
            var dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY)
            if (dist < prevDist) columns = Math.min(4, columns + Math.floor(dist / 200))
            else columns = Math.max(1, columns - Math.floor(dist / 200))
            prevDist = dist
        }
    }
    const touchend = () => (scaling = false)
</script>

<div class="grid" on:touchstart={touchstart} on:touchmove={touchmove} on:touchend={touchend}>
    {#if layoutSlides.length}
        {#each layoutSlides as slide, i}
            <Slide
                {resolution}
                media={activeShow.media}
                layoutSlide={slide}
                slide={activeShow.slides[slide.id]}
                index={i}
                color={slide.color}
                active={outSlide === i && outShow?.id === activeShow.id}
                {columns}
                on:click={() => {
                    // if (!$outLocked && !e.ctrlKey) {
                    //   outSlide.set({ id, index: i })
                    // }
                    click(i)
                }}
            />
        {/each}
    {:else}
        <Center faded>{dictionary.empty.slides}</Center>
    {/if}
</div>

<style>
    /* .scroll {
    padding-bottom: 10px;
  } */

    .grid {
        display: flex;
        flex-wrap: wrap;
        /* gap: 10px; */
        padding: 5px;
        height: 100%;
        align-content: flex-start;
    }
</style>
