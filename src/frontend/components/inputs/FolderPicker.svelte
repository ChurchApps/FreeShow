<script lang="ts">
  import { uid } from "uid"
  import { OPEN_FOLDER } from "../../../types/Channels"
  import { mediaFolders } from "../../stores"
  import { history } from "../helpers/history"
  import Button from "./Button.svelte"

  function pickFolder() {
    window.api.send(OPEN_FOLDER, "Pick Folder")
  }

  window.api.receive(OPEN_FOLDER, (msg: any) => {
    // check if folder already exists
    let exists = Object.values($mediaFolders).find((a) => a.path === msg)
    // TODO: alert exists
    if (!exists) {
      let id = uid()
      history({
        id: "newMediaFolder",
        oldData: { id: id, data: null },
        newData: { id: id, data: { name: msg.substring(msg.lastIndexOf("\\") + 1), icon: "folder", path: msg } },
        location: { page: "drawer" },
      })
    }
  })
</script>

<Button on:click={pickFolder} title={$$props.title} center dark>
  <slot />
  <!-- <input style="display: none;" type="folder" on:click|preventDefault={pickFolder} /> -->
</Button>
