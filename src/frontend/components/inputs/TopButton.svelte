<script lang="ts">
    import type { TopViews } from "../../../types/Tabs"
    import { activeEdit, activePage, activeShow, dictionary, editHistory, labelsDisabled, shows, special } from "../../stores"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import Button from "./Button.svelte"

    export let id: TopViews
    export let red: boolean = false
    export let disabled: boolean = false
    export let hideLabel: null | boolean = null
    $: label = hideLabel === null ? !$labelsDisabled : !hideLabel

    const keys = { show: 1, edit: 2, stage: 3, draw: 4, settings: 5 }

    $: title = $dictionary.menu?.["_title_" + id] + ($special.numberKeys ? "" : ` [${keys[id] || ""}]`)

    function openPage() {
        activePage.set(id)

        if (id === "edit") openActiveShow()
    }

    function openActiveShow() {
        let showIsActive = $activeShow && ($activeShow.type || "show") === "show"
        let noEditSlide = $activeEdit.slide === null || $activeEdit.slide === undefined
        if (showIsActive && noEditSlide) updateEditItem()
        else if (showIsActive && $activeEdit.showId && $activeEdit.showId !== $activeShow?.id) openEdit()

        function updateEditItem() {
            // set to show if: media has been opened AND show has not been opened AND it's not locked
            if ($activeEdit.id && (!$editHistory.find((a) => $activeEdit.id === a.edit?.id) || $editHistory.find((a) => $activeShow?.id === a.show?.id))) return
            if ($shows[$activeShow?.id || ""]?.locked) return

            openEdit()
        }

        function openEdit() {
            activeEdit.set({ slide: 0, items: [], showId: $activeShow?.id })
        }
    }
</script>

<div>
    <!-- width: 140px; -->
    <Button style={label ? "padding: 0.3em 1.2em;" : ""} {title} {disabled} active={$activePage === id} {red} on:click={openPage}>
        <Icon {id} size={1.6} right={label} />
        {#if label}
            <span><T id={"menu." + id} /></span>
        {/if}
    </Button>
</div>

<style>
    div :global(button) {
        /* padding: 10px; */
        display: flex;
        /* flex-direction: column; */
        justify-content: center;
        min-width: 60px;
        height: 100%;
    }

    span {
        font-weight: bold;
    }

    @media screen and (max-width: 750px) {
        span {
            display: none;
        }
    }
</style>
