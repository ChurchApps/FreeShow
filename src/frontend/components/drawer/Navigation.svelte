<script lang="ts">
  import type { Category } from "../../../types/Tabs"

  import { audioFolders, categories, dictionary, drawerTabsData, mediaFolders, overlayCategories, templateCategories, webFavorites } from "../../stores"
  import { keysToID, sortObject } from "../helpers/array"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import FolderPicker from "../inputs/FolderPicker.svelte"
  import HiddenInput from "../inputs/HiddenInput.svelte"
  import SelectElem from "../system/SelectElem.svelte"
  import { getBibleVersions } from "./bible/getBible"

  export let id: string

  interface Button extends Category {
    id: string
    url?: string
  }
  let buttons: Button[] = []
  $: {
    if (id === "shows") {
      buttons = [
        { id: "all", name: "category.all", default: true, icon: "all" },
        ...(sortObject(keysToID($categories), "name") as Button[]),
        { id: "unlabeled", name: "category.unlabeled", default: true, icon: "noIcon" },
      ]
    } else if (id === "backgrounds") {
      buttons = [{ id: "all", name: "category.all", default: true, icon: "all" }, ...(sortObject(keysToID($mediaFolders), "name") as Button[])]
    } else if (id === "overlays") {
      buttons = [{ id: "all", name: "category.all", default: true, icon: "all" }, ...(sortObject(keysToID($overlayCategories), "name") as Button[])]
    } else if (id === "templates") {
      buttons = [{ id: "all", name: "category.all", default: true, icon: "all" }, ...(sortObject(keysToID($templateCategories), "name") as Button[])]
    } else if (id === "audio") {
      buttons = [{ id: "all", name: "category.all", default: true, icon: "all" }, ...(sortObject(keysToID($audioFolders), "name") as Button[])]
    } else if (id === "scripture") {
      buttons = [...keysToID(getBibleVersions())]
    } else if (id === "player") {
      buttons = [{ id: "youtube", name: "YouTube", icon: "youtube" }]
    } else if (id === "web") {
      buttons = [...(sortObject(keysToID($webFavorites), "name") as Button[])]
    } else if (id === "live") {
      buttons = [
        // all: { name: "category.all", default: true, icon: "all" },
        // ...$mediaFolders,
        // id:
        { id: "screens", name: "screens", default: true, icon: "screen" },
        { id: "windows", name: "windows", default: true, icon: "window" },
        // {id: "screen2", name: "second screen", icon: "screen"},
        { id: "cameras", name: "cameras", default: true, icon: "camera" },
        { id: "microphones", name: "microphones", default: true, icon: "microphone" },
      ]
    } else buttons = [{ id: "all", name: "category.all", default: true, icon: "all" }]
  }

  $: console.log(buttons)
  // TODO: scroll down to selected
  $: {
    if ($drawerTabsData[id].activeSubTab === null) {
      // setTab(Object.keys(buttons)[0])
      setTab(buttons[0].id)
    }
  }

  function setTab(tabID: string) {
    drawerTabsData.update((dt) => {
      dt[id].activeSubTab = tabID
      return dt
    })
  }
</script>

<div class="main">
  <div class="categories context #category_{id}">
    {#key buttons}
      {#each buttons as category}
        <SelectElem id="navigation" data={category.id}>
          <!-- TODO: titles -->
          <Button
            class="context #category_{id}_button__category_{id}"
            active={category.id === $drawerTabsData[id].activeSubTab}
            on:click={(e) => {
              if (!e.ctrlKey) setTab(category.id)
            }}
            bold={false}
            title={category.description ? category.description : category.path ? category.path : ""}
          >
            <Icon id={category.icon || "noIcon"} />
            <span id={category.id}>
              {#if category.default}
                <p style="margin: 5px;">
                  <T id={category.name} />
                </p>
              {:else}
                <HiddenInput value={category.name} />
              {/if}
            </span>
          </Button>
        </SelectElem>
      {/each}
    {/key}
  </div>
  {#if id === "shows"}
    <div class="tabs">
      <Button on:click={() => history({ id: "newShowsCategory" })} center title={$dictionary.new?.category}>
        <Icon id="all" style="padding-right: 10px;" />
        <span style="color: var(--secondary);">
          <T id="new.category" />
        </span>
      </Button>
    </div>
  {:else if id === "backgrounds"}
    <!-- <FilePicker /> -->
    <FolderPicker title={$dictionary.new?.category}>
      <Icon id="folder" style="padding-right: 10px;" />
      <span style="color: var(--secondary);">
        <T id="new.folder" />
      </span>
    </FolderPicker>
  {/if}
</div>

<style>
  .main,
  .categories {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
  }

  .main :global(button) {
    width: 100%;
    padding: 0.2em 0.8em;
  }
  .main :global(svg) {
    margin-right: calc(0.8em - 5px);
  }

  .tabs {
    display: flex;
    background-color: var(--primary-darker);
  }

  /* button {
    padding: 10px;
    display: flex;
    border: none;
    background-color: inherit;
    color: inherit;
  } */
</style>
