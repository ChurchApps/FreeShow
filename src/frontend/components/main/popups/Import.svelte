<script lang="ts">
  import Button from "../../inputs/Button.svelte"

  const formats: any[] = [
    { name: "Clipboard", id: "txt" },
    { name: "Text (.txt)", id: "txt" },
    { name: "PowerPoint (.pptx)", id: "txt" },
    { name: "FreeShow show/project (.json / .show)", id: "txt" },
    { name: "EasyWorship (.ew)", id: "txt" },
    { name: "ProPresenter (.pro)", id: "txt" },
    { name: "VideoPsalm (.vpsa)", id: "txt" },
  ]
</script>

<!-- drop area: -->
TBA:
<br />

<div>
  {#each formats as format}
    <Button style="width: 100%;" center>{format.name}</Button>
  {/each}
</div>
