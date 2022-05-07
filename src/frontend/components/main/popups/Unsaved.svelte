<script>
  import { MAIN } from "../../../../types/Channels"
  import { activePopup } from "../../../stores"
  import { save } from "../../../utils/save"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
</script>

<div style="display: flex;justify-content: space-around;">
  <Button
    on:click={() => {
      activePopup.set(null)
    }}
  >
    <T id="popup.cancel" />
  </Button>
  <Button
    on:click={() => {
      window.api.send(MAIN, { channel: "CLOSE" })
    }}
  >
    <T id="popup.quit" />
  </Button>
  <Button
    on:click={() => {
      save()
      setTimeout(() => {
        window.api.send(MAIN, { channel: "CLOSE" })
      }, 200)
    }}
    dark
  >
    <T id="popup.save_quit" />
  </Button>
</div>

<style>
  div :global(button) {
    text-transform: uppercase;
  }
</style>
