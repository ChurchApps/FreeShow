<script lang="ts">
  import { uid } from "uid"
  import { OPEN_FOLDER } from "../../../types/Channels"
  import { activePopup, alertMessage, audioFolders, exportPath, mediaFolders, showsPath } from "../../stores"
  import { history } from "../helpers/history"
  import Button from "./Button.svelte"

  export let id: string
  export let title: string | undefined = undefined

  function pickFolder() {
    window.api.send(OPEN_FOLDER, { id, title })
  }

  window.api.receive(OPEN_FOLDER, (msg: { id: string; path: any }) => {
    if (id === "media" || id === "audio") {
      // check if folder already exists
      let path: string = msg.path
      let exists = Object.values(id === "media" ? $mediaFolders : $audioFolders).find((a) => a.path === path)
      if (exists) {
        alertMessage.set("error.folder_exists")
        activePopup.set("alert")
        return
      }
      let folderId = uid()
      history({
        id: id === "media" ? "newMediaFolder" : "newAudioFolder",
        oldData: { id: folderId, data: null },
        newData: { id: folderId, data: { name: path.substring(path.lastIndexOf("\\") + 1), icon: "folder", path: path } },
        location: { page: "drawer" },
      })
    } else if (id === "shows") {
      // set new shows folder location
      showsPath.set(msg.path)
    } else if (id === "export") {
      exportPath.set(msg.path)
    }
  })
</script>

<Button on:click={pickFolder} {title} center dark>
  <slot />
  <!-- <input style="display: none;" type="folder" on:click|preventDefault={pickFolder} /> -->
</Button>
