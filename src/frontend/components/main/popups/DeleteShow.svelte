<script lang="ts">
    import { activePopup, selected, shows, showsCache } from "../../../stores"
    import { clone } from "../../helpers/array"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import { loadShows } from "../../helpers/setShow"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    async function deleteSelected() {
        let shows = $selected.data

        if (shows.length === 1) {
            await loadShows([shows[0].id])
            history({ id: "UPDATE", newData: { id: shows[0].id }, oldData: { data: clone($showsCache[shows[0].id]) }, location: { page: "drawer", id: "show" } })
        } else {
            history({ id: "SHOWS", oldData: { data: shows }, location: { page: "drawer" } })
        }

        selected.set({ id: null, data: [] })
        activePopup.set(null)
    }
</script>

<p style="font-weight: bold;"><T id="popup.delete_show_confirmation" /> ({$selected.data.length}):</p>
<ul style="list-style-position: inside;">
    {#each $selected.data as show}
        <li>{$shows[show.id]?.name}</li>
    {/each}
</ul>

<br />

<Button style="height: auto;margin-top: 10px;" on:click={deleteSelected} red center>
    <Icon id="delete" right />
    <T id="actions.delete" />
</Button>
