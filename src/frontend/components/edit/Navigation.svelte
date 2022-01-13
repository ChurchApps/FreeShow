<script lang="ts">
  import { activeEdit, activeShow, shows } from "../../stores"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import Button from "../inputs/Button.svelte"
  import Center from "../system/Center.svelte"
  import Slides from "./Slides.svelte"

  function addSlide() {
    let newData: any = {}
    if ($activeEdit) newData.index = $activeEdit.slide
    history({ id: "newSlide", newData, location: { page: "edit", show: $activeShow!, layout: $shows[$activeShow!.id].settings.activeLayout } })
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
      <Icon id="add" />
      [[[Add Slide]]]
    </Button>
  {/if}
{:else}
  <Center faded>[[[Select a show to edit]]]</Center>
{/if}
