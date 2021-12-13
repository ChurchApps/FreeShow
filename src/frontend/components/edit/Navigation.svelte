<script lang="ts">
  import { activeShow } from "../../stores"
  import { history } from "../helpers/history"
  import Icon from "../helpers/Icon.svelte"
  import Button from "../inputs/Button.svelte"
  import Center from "../system/Center.svelte"

  import Slides from "./Slides.svelte"
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
    <Button center on:click={() => history({ id: "newSlide" })}>
      <Icon id="add" />
      [[[Add Slide]]]
    </Button>
  {/if}
{:else}
  <Center faded>[[[Select a show to edit]]]</Center>
{/if}
