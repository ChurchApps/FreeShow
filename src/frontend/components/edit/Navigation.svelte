<script lang="ts">
  import { activeEdit, activeShow, showsCache } from "../../stores"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import Center from "../system/Center.svelte"
  import Slides from "./Slides.svelte"

  function addSlide(e: any) {
    let newData: any = {}
    if ($activeEdit?.slide !== null && $activeEdit?.slide !== undefined) newData.index = $activeEdit.slide + 1
    if (e.ctrlKey || e.metaKey) newData.parent = true
    history({ id: "newSlide", newData, location: { page: "edit", show: $activeShow!, layout: $showsCache[$activeShow!.id].settings.activeLayout } })
  }
</script>

{#if $activeShow}
  {#if $activeShow.type === "video"}
    <!--  -->
  {:else if $activeShow.type === "image"}
    <!--  -->
  {:else if $activeShow.type === "audio"}
    <!--  -->
  {:else}
    <Slides />
    <!-- style="background-color: var(--primary-darkest);" -->
    <Button center on:click={addSlide}>
      <Icon id="add" right />
      <T id="new.slide" />
    </Button>
  {/if}
{:else}
  <Center faded>
    <T id="empty.show" />
  </Center>
{/if}
