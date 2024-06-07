<script lang="ts">
    import { activePopup, selected, shows } from "../../../stores"
    import { history } from "../../helpers/history"
    import Icon from "../../helpers/Icon.svelte"
    import T from "../../helpers/T.svelte"
    import Button from "../../inputs/Button.svelte"

    async function deleteSelected() {
        let shows = $selected.data
        history({ id: "SHOWS", oldData: { data: shows }, location: { page: "drawer" } })

        selected.set({ id: null, data: [] })
        activePopup.set(null)
    }

    function keydown(e: any) {
        if (e.key === "Enter") deleteSelected()
    }
</script>

<svelte:window on:keydown={keydown} />

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
