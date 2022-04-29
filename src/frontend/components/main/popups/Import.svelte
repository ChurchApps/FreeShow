<script>
  import { IMPORT } from "../../../../types/Channels"
  import { convertText } from "../../../converters/txt"
  import { activePopup, alertMessage } from "../../../stores"
  import { send } from "../../../utils/request"
  import Button from "../../inputs/Button.svelte"

  // TODO: program icons

  const formats = [
    { name: "Clipboard", id: "clipboard" },
    { name: "Text file", extensions: ["txt"], id: "txt" },
    { name: "PDF", extensions: ["pdf"], id: "pdf" },
    { name: "PowerPoint", extensions: ["ppt", "pptx"], id: "powerpoint" },
    { name: "FreeShow", extensions: ["show"], id: "freeshow" }, // show / project
    { tba: true, name: "FreeShow Project", extensions: ["shows"], id: "freeshow" }, // show / project
    { name: "ProPresenter", extensions: ["pro6", "pro7"], id: "propresenter" },
    {
      name: "EasyWorship",
      extensions: ["db"],
      id: "easyworship",
      tutorial: "Import the SongsWords.db file from the Data folder<br>Optionally select Songs.db to import title/metadata)",
    },
    { name: "VideoPsalm", extensions: ["json"], id: "videopsalm", tutorial: "Find the Songbook.vpc file(s)<br>Add .zip to the end<br>Extract it & import the .json file" },
    { name: "OpenLP (OpenLyrics)", extensions: ["xml"], id: "openlp" },
    { name: "OpenSong", extensions: [], id: "opensong" },
  ]
</script>

<!-- TODO: drop area: -->

<div>
  {#each formats as format}
    <Button
      style="width: 100%;"
      on:click={() => {
        if (format.tba) {
          activePopup.set("alert")
          alertMessage.set("Comming soon...")
        } else if (format.extensions) {
          send(IMPORT, [format.id], format)
          if (format.tutorial) {
            alertMessage.set(format.tutorial)
            activePopup.set("alert")
          } else activePopup.set(null)
        } else {
          // clipboard
          navigator.clipboard
            .readText()
            .then((text) => {
              convertText({ text })
            })
            .catch((err) => {
              console.error("Failed to read clipboard contents: ", err)
            })
          activePopup.set(null)
        }
      }}
      center
    >
      {#if format.tba}
        TBA:
      {/if}
      {format.name}
      <!-- {#if format.extensions}
        ({format.extensions.map((a) => "*." + a).join(", ")})
      {/if} -->
    </Button>
  {/each}
</div>
