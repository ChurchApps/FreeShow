<script lang="ts">
  import { uid } from "uid"

  import { OPEN_FOLDER } from "../../../types/Channels"
  import { mediaFolders } from "../../stores"
  import { history } from "../helpers/history"

  function pickFolder() {
    window.api.send(OPEN_FOLDER, "Pick Folder")
  }
  window.api.receive(OPEN_FOLDER, (message: any) => {
    message = message.replaceAll("\\", "/")
    // check if folder already exists
    let exists = false
    Object.values($mediaFolders).forEach((mf) => {
      if (mf.url === message) exists = true
    })
    if (!exists) {
      let id = uid()
      history({
        id: "newMediaFolder",
        oldData: { id: id, data: null },
        newData: { id: id, data: { name: message.split("/").pop(), icon: "folder", url: message } },
        location: { page: "drawer" },
      })
    }
    // TODO: respond!
    // activeFilePath = message.path;
    // mediaFolders.update((mf) => {
    //   mf[uid()] = { name: message.split("/").pop(), icon: "folder", url: message }
    //   return mf
    // })
  })
</script>

<input type="folder" on:click|preventDefault={pickFolder} />
