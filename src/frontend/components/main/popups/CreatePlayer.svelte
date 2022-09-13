<script lang="ts">
  import { uid } from "uid"
  import { activeDrawerTab, activePopup, dictionary, drawerTabsData, playerVideos } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

  let active: string | null = $drawerTabsData[$activeDrawerTab]?.activeSubTab

  let data: any = { name: "", id: "" }
  function add() {
    // TODO: remove url (keep only id)
    if (!data.id.length) return activePopup.set(null)

    let id = data.id
    if (id.includes("?list")) id = id.slice(0, id.indexOf("?list"))
    id = id.slice(-11)

    let name = data.name
    if (!name) name = id

    playerVideos.update((a) => {
      a[uid()] = { id, name, type: active as any }
      return a
    })

    // setTimeout(() => {
    //   data = { name: "", id: "" }
    // }, 10)

    activePopup.set(null)
  }

  function setValue(e: any, key: string) {
    data[key] = e.target.value
  }

  function keydown(e: any) {
    if (e.key === "Enter") {
      ;(document.activeElement as any).blur()
      add()
    }
  }
</script>

<div style="flex-direction: column;" on:keydown={keydown}>
  <div style="justify-content: space-between;">
    <p><T id="inputs.name" /></p>
    <TextInput style="width: 50%;" value={data.name} on:change={(e) => setValue(e, "name")} placeholder={$dictionary.inputs?.name} />
  </div>
  <div style="justify-content: space-between;">
    <p><T id="inputs.video_id" /></p>
    <TextInput style="width: 50%;" value={data.id} on:change={(e) => setValue(e, "id")} placeholder="X-AJdKty74M" />
  </div>
  <br />
  <Button style="width: 100%;" on:click={add} center dark>
    <Icon id="add" right />
    <span><T id="settings.add" /></span>
  </Button>
</div>

<style>
  div {
    display: flex;
    gap: 5px;
  }
</style>
