<script lang="ts">
  import { ShowObj } from "../../../classes/Show"
  import { convertText } from "../../../converters/txt"
  import { activePopup, activeProject, categories, dictionary, drawerTabsData } from "../../../stores"
  import { sortObject } from "../../helpers/array"
  import { history } from "../../helpers/history"
  import { checkName } from "../../helpers/show"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import TextArea from "../../inputs/TextArea.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

  function textToShow() {
    let sections = values.text.split("\n\n").filter((a: any) => a.length)

    // let metaData: string = ""
    // if (sections[1] && sections[0]?.split("\n").length < 3) metaData = sections.splice(0, 1)[0]
    let category = selectedCategory.id.length ? selectedCategory.id : null

    if (sections.length) {
      convertText({ name: values.name, category, text: values.text })
    } else {
      let show = new ShowObj(false, category)
      show.name = checkName(values.name)
      history({ id: "newShow", newData: { show }, location: { page: "show", project: $activeProject } })
    }
    values = { name: "", text: "" }
    activePopup.set(null)
  }

  $: console.log(values.text)

  const changeValue = (e: any, key: string = "text") => (values[key] = e.target.value)
  let values: any = {
    text: "",
    name: "",
  }

  function keydown(e: any) {
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return
    ;(document.activeElement as any)?.blur()
    textToShow()
  }

  const cats: any = [
    { id: "", name: "—" },
    ...sortObject(
      Object.keys($categories).map((id) => ({ id, name: "$:" + $categories[id].name + ":$" })),
      "name"
    ),
  ]
  let selectedCategory: any =
    $drawerTabsData.shows.activeSubTab && $categories[$drawerTabsData.shows.activeSubTab] ? cats.find((a: any) => a.id === $drawerTabsData.shows.activeSubTab) : cats[0]
</script>

<svelte:window on:keydown={keydown} />

<div class="section">
  <p><T id="show.name" /></p>
  <TextInput autofocus value={values.name} on:change={(e) => changeValue(e, "name")} style="width: 50%;height: 30px;" />
</div>
<div class="section">
  <p><T id="show.category" /></p>
  <Dropdown options={cats} value={selectedCategory.name} on:click={(e) => (selectedCategory = e.detail)} style="width: 50%;" />
</div>
<br />
<!-- TODO: show example? -->
<span><T id="show.quick_lyrics" /></span>
<TextArea placeholder={$dictionary.main?.quick_example} style="height: 250px;" value={values.text} on:input={(e) => changeValue(e)} />
<Button on:click={textToShow} style="width: 100%;margin-top: 10px;color: var(--secondary);" dark center>
  {#if values.text.trim().length > 0}
    <T id="new.show" />
  {:else}
    <T id="new.empty_show" />
  {/if}
</Button>

<style>
  .section {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .section :global(.dropdown) {
    position: absolute;
    width: 100% !important;
  }
</style>
