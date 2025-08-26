<script lang="ts">
    import { activePopup, selected, shows } from "../../../stores"
    import { history } from "../../helpers/history"
    import T from "../../helpers/T.svelte"
    import MaterialButton from "../../inputs/MaterialButton.svelte"

    function deleteSelected() {
        let shows = $selected.data
        history({ id: "SHOWS", oldData: { data: shows }, location: { page: "drawer" } })

        selected.set({ id: null, data: [] })
        activePopup.set(null)
    }

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") deleteSelected()
    }
</script>

<svelte:window on:keydown={keydown} />

<p style="font-weight: bold;"><T id="popup.delete_show_confirmation" />:</p>

<ul style="list-style-position: inside;margin-bottom: 20px;">
    {#each $selected.data as show}
        <li>{$shows[show.id]?.name}</li>
    {/each}
</ul>

<MaterialButton variant="contained" icon="delete" info={$selected.data.length.toString()} on:click={deleteSelected} white>
    <T id="actions.delete" />
</MaterialButton>
