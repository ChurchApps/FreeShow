<script lang="ts">
  import { OPEN_FILE } from "../../../types/Channels"

  let picked: any = null

  function pickFile() {
    // TODO: open folder
    window.api.send(OPEN_FILE, { title: "Pick Image", filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }] })
  }
  window.api.receive(OPEN_FILE, (message: any) => {
    console.log(message)
    // activeFilePath = message.path;
    picked = message
  })
  $: console.log(picked)
</script>

<input type="file" on:click|preventDefault={pickFile} />

<img src={picked} alt="Nothing" />
