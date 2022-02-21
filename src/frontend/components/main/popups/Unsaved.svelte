<script>
  import { MAIN } from "../../../../types/Channels"
  import { activePopup } from "../../../stores"
  import { save } from "../../../utils/save"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
</script>

<T id="popup.unsaved" />
<div style="display: flex;width: 100%;">
  <Button
    on:click={() => {
      activePopup.set(null)
    }}
  >
    <T id="popup.cancel" />
  </Button>
  <Button
    on:click={() => {
      save()
      window.api.send(MAIN, { channel: "CLOSE" })
    }}
  >
    <T id="popup.save_quit" />
  </Button>
  <Button
    on:click={() => {
      window.api.send(MAIN, { channel: "CLOSE" })
    }}
  >
    <T id="popup.quit" />
  </Button>
</div>
