<script lang="ts">
  import { uid } from "uid"

  import { OPEN_FOLDER } from "../../../types/Channels"
  import { mediaFolders } from "../../stores"

  function pickFolder() {
    window.api.send(OPEN_FOLDER, "Pick Folder")
  }
  window.api.receive(OPEN_FOLDER, (message: any) => {
    message = message.replaceAll("\\", "/")
    // activeFilePath = message.path;
    // TODO: check if url exists
    mediaFolders.update((mf) => {
      mf[uid()] = { name: message.split("/").pop(), icon: "folder", url: message }
      return mf
    })
  })
</script>

<input type="folder" on:click|preventDefault={pickFolder} />
