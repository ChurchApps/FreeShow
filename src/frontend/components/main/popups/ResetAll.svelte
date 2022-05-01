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

<p>Are you sure you want to reset everything?</p>
<p>This will reset the application, but not the shows in your "Shows"-folder</p>

<Button on:click={reset} center>
  <T id="popup.continue" />
</Button>
