<script lang="ts">
  import { activePopup, alertMessage } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"

  let msg: string = $alertMessage.toString()
</script>

<p>
  {#if msg?.includes(".")}
    <T id={msg} />
  {:else}
    {msg}
  {/if}
</p>

<Button on:click={() => activePopup.set(null)} center>
  <Icon id="check" />
</Button>
