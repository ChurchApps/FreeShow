<script lang="ts">
  import { activePopup, selected, shows } from "../../../stores"
  import { history } from "../../helpers/history"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
</script>

<p><T id="popup.delete_show_confirmation" />:</p>
<ul style="list-style-position: inside;">
  {#each $selected.data as show}
    <li style="font-weight: bold;">{$shows[show.id]?.name}</li>
  {/each}
</ul>
<Button
  style="height: auto;margin-top: 10px;"
  on:click={() => {
    $selected.data.forEach((a) => {
      history({ id: "deleteShow", oldData: { id: a.id, show: $shows[a.id] } })
    })
    activePopup.set(null)
  }}
  red
  center
>
  <T id="actions.delete" />
</Button>
