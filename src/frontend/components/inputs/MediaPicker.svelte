<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import { OPEN_FILE } from "../../../types/Channels"
  import Button from "./Button.svelte"

  export let filter: any
  export let multiple: boolean = false

  function pick() {
    // filter: { name: "Text file", extensions: ["txt"], id: "txt" }
    window.api.send(OPEN_FILE, { filter, multiple })
  }

  let dispatch = createEventDispatcher()
  window.api.receive(OPEN_FILE, (msg: { id: string; files: any }) => {
    dispatch("picked", multiple ? msg.files : msg.files[0])
  })
</script>

<Button style={$$props.style || null} on:click={pick} center dark>
  <slot />
</Button>
