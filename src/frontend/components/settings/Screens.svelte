<script lang="ts">
  import { GET_SCREENS } from "../../../types/Channels"
  import Dropdown from "../inputs/Dropdown.svelte"

  let screens: any[] = []
  window.api.send(GET_SCREENS)
  window.api.receive(GET_SCREENS, (data: any) => {
    screens = data[0]
  })

  let activeScreen: null | string = null
  $: console.log(activeScreen)

  $: console.log(...screens)
</script>

<!-- {screens} -->

{#if screens.length}
  {#key screens}
    <Dropdown value={`${"main"}`} options={screens} on:click={(e) => (activeScreen = e.detail.id)} />
  {/key}
{:else}
  Loading screens
{/if}
