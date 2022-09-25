<script lang="ts">
  import { OPEN_FOLDER } from "../../../types/Channels"
  import Button from "./Button.svelte"

  export let id: string
  export let title: string | undefined = undefined

  function pickFolder() {
    window.api.send(OPEN_FOLDER, { channel: id, title })
  }
</script>

<Button on:click={pickFolder} {title} center dark>
  <slot />
  <!-- <input style="display: none;" type="folder" on:click|preventDefault={pickFolder} /> -->
</Button>
