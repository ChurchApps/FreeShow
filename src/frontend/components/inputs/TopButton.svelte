<script lang="ts">
    import type { TopViews } from "../../../types/Tabs"
    import { activeEdit, activePage, activeShow, dictionary, editHistory, labelsDisabled, shows, special } from "../../stores"
    import { translateText } from "../../utils/language"
    import Icon from "../helpers/Icon.svelte"
    import T from "../helpers/T.svelte"
    import MaterialButton from "./MaterialButton.svelte"

    export let id: TopViews
    export let red = false
    export let disabled = false
    export let hideLabel: null | boolean = null
    $: label = hideLabel === null ? !$labelsDisabled : !hideLabel

    const keys = { show: 1, edit: 2, stage: 3, draw: 4, settings: 5 }

    function openPage() {
        activePage.set(id)

        if (id === "edit") openActiveShow()
    }

    function openActiveShow() {
        let showIsActive = $activeShow && ($activeShow.type || "show") === "show"
        let noEditSlide = $activeEdit.slide === null || $activeEdit.slide === undefined
        if (showIsActive && !$activeEdit.id) openEdit()
        else if (showIsActive && noEditSlide) updateEditItem()
        else if (showIsActive && $activeEdit.showId && $activeEdit.showId !== $activeShow?.id) openEdit()

        function updateEditItem() {
            return // more annoying than helpful
            // set to show if: media has been opened AND show has not been opened AND it's not locked
            if ($activeEdit.id && (!$editHistory.find((a) => $activeEdit.id === a.edit?.id) || $editHistory.find((a) => $activeShow?.id === a.show?.id))) return
            if ($shows[$activeShow?.id || ""]?.locked) return

            openEdit()
        }

        function openEdit() {
            activeEdit.set({ slide: $activeEdit.slide || 0, items: [], showId: $activeShow?.id })
        }
    }
</script>

<!-- border-top-left-radius: 12px;border-top-right-radius: 12px; -->
<MaterialButton style="border-radius: 0;border-bottom: 2px solid var(--primary);{label ? 'padding: 0.3em 1.2em;' : ''}" title={translateText(`menu._title_${id}${$special.numberKeys ? "" : ` [${keys[id]}]`}`, $dictionary)} isActive={$activePage === id} {disabled} on:click={openPage} {red}>
    <Icon {id} size={1.5} white={$activePage === id} />
    {#if label}<span><T id="menu.{id}" /></span>{/if}
</MaterialButton>

<style>
    /* span {
        font-weight: 700;
    } */

    @media screen and (max-width: 750px) {
        span {
            display: none;
        }
    }
</style>
