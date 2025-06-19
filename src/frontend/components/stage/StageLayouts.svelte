<script lang="ts">
    import { activeStage, labelsDisabled, outputs, stageShows } from "../../stores"
    import { keysToID, sortByName } from "../helpers/array"
    import { history } from "../helpers/history"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "../inputs/Button.svelte"
    import Autoscroll from "../system/Autoscroll.svelte"
    import Center from "../system/Center.svelte"
    import StageSlide from "./StageSlide.svelte"

    function addSlide() {
        history({ id: "UPDATE", location: { page: "stage", id: "stage" } })
    }

    $: sortedStageSlides = sortByName(keysToID($stageShows))

    $: if ($activeStage.id === null && Object.keys($stageShows).length) setActiveStage()
    function setActiveStage() {
        let activeStageOutput = Object.values($outputs).find((a) => a.enabled && a.stageOutput)?.stageOutput
        let firstStageLayout = activeStageOutput || sortedStageSlides[0]?.id
        activeStage.set({ id: firstStageLayout, items: [] })
    }

    function keydown(e: KeyboardEvent) {
        if (e.target?.closest(".edit") || e.ctrlKey || e.metaKey) return
        if ($activeStage.items.length) return

        // CHANGE STAGE LAYOUT

        let nextTab = -1
        let currentTabIndex = sortedStageSlides.findIndex((a) => a.id === $activeStage.id)

        if (e.key === "ArrowDown") {
            nextTab = Math.min(sortedStageSlides.length - 1, currentTabIndex + 1)
        } else if (e.key === "ArrowUp") {
            nextTab = Math.max(0, currentTabIndex - 1)
        }

        if (nextTab < 0 || !sortedStageSlides[nextTab]) return
        activeStage.set({ id: sortedStageSlides[nextTab].id, items: [] })
    }

    // Auto scroll
    let scrollElem: HTMLElement | undefined
    let offset = -1
    $: if ($activeStage.id) {
        setTimeout(() => {
            if (!scrollElem) return
            const index = Math.max(
                0,
                [...(scrollElem.querySelector(".grid")?.children || [])].findIndex((a) => a?.classList.contains("active"))
            )
            offset = ((scrollElem.querySelector(".grid")?.children?.[index] as HTMLElement)?.offsetTop || 5) - 80
        }, 10)
    }
</script>

<svelte:window on:keydown={keydown} />

<div class="main">
    {#if sortedStageSlides.length}
        <Autoscroll {offset} bind:scrollElem timeout={150} smoothTimeout={0}>
            <div class="grid">
                {#each sortedStageSlides as show}
                    <StageSlide
                        id={show.id}
                        layout={show}
                        active={$activeStage.id === show.id}
                        on:click={(e) => {
                            if (!e.ctrlKey && !e.metaKey && !document.activeElement?.closest(".edit"))
                                activeStage.update((as) => {
                                    as.id = show.id
                                    return as
                                })
                        }}
                    />
                {/each}
            </div>
        </Autoscroll>
    {:else}
        <Center faded>
            <T id="empty.layouts" />
        </Center>
    {/if}
    <!-- Add -->
    <Button on:click={addSlide} center dark>
        <Icon id="add" right={!$labelsDisabled} />
        {#if !$labelsDisabled}<T id="show.new_layout" />{/if}
    </Button>
</div>

<style>
    .main {
        flex: 1;
        display: flex;
        justify-content: space-between;
        flex-direction: column;
        overflow: auto;
        background-color: var(--primary-darker);
    }

    /* .main :global(button) {
    width: 100%;
    padding: 20px;
  } */

    .grid {
        display: flex;
        flex-wrap: wrap;
        padding: 5px;
        width: 100%;
        height: 100%;
        align-content: flex-start;
    }
</style>
