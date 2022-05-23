<script lang="ts">
  import { onMount } from "svelte"
  import { uid } from "uid"
  import { language, scriptures } from "../../../stores"
  import { replace } from "../../../utils/languageData"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Center from "../../system/Center.svelte"
  import Loader from "../Loader.svelte"

  // API.Bible key. Will propably change in the future (Please don't abuse)
  let key: string = "320b5b593fa790ced135a98861de51a9"
  let error: null | string = null
  let bibles: any[] = []

  onMount(fetchBibles)

  async function fetchBibles() {
    const api = "https://api.scripture.api.bible/v1/bibles"
    fetch(api, { headers: { "api-key": key } })
      .then((response) => response.json())
      .then((data) => {
        console.log({ ...data.data })
        bibles = data.data
      })
      .catch((e) => {
        console.log(e)
        error = e
      })
  }

  // get list of bibles in language
  let sortedBibles: any[] = []
  let recommended: any[] = []
  $: {
    if (bibles.length) {
      let langCode = window.navigator.language.slice(-2).toLowerCase()
      sortedBibles = bibles.sort((a, b) => a.name.localeCompare(b.name))
      let newSorted: any[] = []
      sortedBibles.forEach((bible) => {
        newSorted.push(bible)
        let found = false
        bible.countries.forEach((country: any) => {
          replace[$language].forEach((r: any) => {
            r = r.slice(-2)
            if (!found && (country.id.toLowerCase() === r.toLowerCase() || country.id.toLowerCase() === langCode)) {
              found = true
              recommended.push(bible)
              newSorted.pop()
            }
          })
        })
      })
      sortedBibles = newSorted
      recommended = recommended
    }
  }

  function toggleScripture({ id, name }: any) {
    scriptures.update((a: any) => {
      let key: string | null = null
      Object.entries(a).forEach(([sId, value]: any) => {
        if (value.id === id) key = sId
      })

      if (key) delete a[key]
      else a[uid()] = { name, api: true, id }
      return a
    })
  }
</script>

<!-- TODO: search -->

{#if error}
  <T id="error.bible_api" />
{:else}
  <h2>
    <T id="scripture.bibles" />
  </h2>
  <div class="list">
    {#if recommended.length}
      {#each recommended as bible}
        <Button bold={false} on:click={() => toggleScripture(bible)} active={!!Object.values($scriptures).find((a) => a.id === bible.id)}>
          <Icon id="noIcon" right />{bible.nameLocal}
          {#if bible.description && bible.description.toLowerCase() !== "common" && !bible.nameLocal.includes(bible.description)}
            <span class="description" title={bible.description}>({bible.description})</span>
          {/if}
        </Button>
      {/each}
      <hr />
    {/if}
    {#if sortedBibles.length}
      {#each sortedBibles as bible}
        <Button bold={false} on:click={() => toggleScripture(bible)} active={!!Object.values($scriptures).find((a) => a.id === bible.id)}>
          <Icon id="noIcon" right />{bible.name}
          {#if bible.description && bible.description.toLowerCase() !== "common" && !bible.name.includes(bible.description)}
            <span class="description" title={bible.description}>({bible.description})</span>
          {/if}
        </Button>
      {/each}
    {:else}
      <Center>
        <Loader />
      </Center>
    {/if}
  </div>
{/if}

<h2>
  <T id="scripture.custom" />
</h2>

<span>
  (TBA...)
  <!-- TODO: other sources (.ewb, ++) -->
</span>

<style>
  .list {
    display: flex;
    flex-direction: column;
    max-height: 40vh;
    margin: 15px 0;
    overflow: auto;
  }

  .list :global(button) {
    line-height: 1.5em;
    cursor: pointer;
  }

  hr {
    border: 1px solid var(--primary-lighter);
    margin: 10px 0;
  }

  h2 {
    color: var(--text);
  }

  .description {
    opacity: 0.5;
    font-style: italic;
    margin-left: 10px;

    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
