<script lang="ts">
  import { STORE } from "../../../../types/Channels"
  import { activePopup } from "../../../stores"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"

  function reset() {
    window.api.send(STORE, {
      channel: "SAVE",
      data: {
        settings: null,
        shows: {},
        showsCache: {},
        stageShows: {},
        projects: { projects: {}, folders: {} },
        overlays: {},
        templates: {},
        events: {},
        themes: {},
      },
    })

    activePopup.set(null)
  }
</script>

<p><T id="popup.reset_all_confirm" /></p>
<p><T id="popup.reset_all_action" /></p>

<Button on:click={reset} center>
  <T id="popup.continue" />
</Button>
