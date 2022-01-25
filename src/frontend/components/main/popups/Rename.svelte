<script lang="ts">
  import { activePopup, activeShow, selected, shows } from "../../../stores"
  import { GetLayoutRef } from "../../helpers/get"
  import { history } from "../../helpers/history"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

  let list: string[] = []
  $: {
    list = []
    if ($activePopup === "rename") {
      if (($activeShow && $selected.id === "slide") || $selected.id === "group") {
        $selected.data.forEach((a, i) => {
          let slide = a.id || GetLayoutRef()[a.index].id
          let name: string = $shows[$activeShow!.id].slides[slide].group || ""
          list.push(name)
          if (i === 0) groupName = name
        })
        list = [...new Set(list)]
      }
    }
  }

  function rename() {
    $selected.data.forEach((a) => {
      let newData: any = { group: groupName }
      let slide = a.id
      if (!slide) {
        slide = GetLayoutRef()[a.index].id
        // TODO: change layout children & slide parent children
        newData.color = null
      }
      if ($activeShow && $shows[$activeShow.id].slides[slide].globalGroup) newData.globalGroup = null
      history({ id: "changeSlide", newData, location: { page: "show", show: $activeShow || undefined, slide } })
    })
    activePopup.set(null)
    groupName = ""
    selected.set({ id: null, data: [] })
  }

  let groupName: string = ""
  const changeValue = (e: any) => (groupName = e.target.value)
</script>

<p><T id="popup.change_name" />:</p>
<ul style="list-style-position: inside;">
  {#each list as text}
    <li style="font-weight: bold;">{text}</li>
  {/each}
</ul>
<TextInput autofocus value={groupName} on:change={(e) => changeValue(e)} />
<Button style="height: auto;margin-top: 10px;" on:click={rename} center>
  <T id="actions.rename" />
</Button>
