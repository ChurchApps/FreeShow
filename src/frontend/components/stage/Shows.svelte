<script lang="ts">
  // import { STAGE } from "../../../types/Channels"
  import { activeStage, stageShows } from "../../stores"
  import T from "../helpers/T.svelte"
  // import { sendData } from "../../utils/sendData"
  // import Checkbox from "../inputs/Checkbox.svelte"
  import Center from "../system/Center.svelte"
  import StageSlide from "./StageSlide.svelte"
</script>

<div class="main">
  {#if Object.keys($stageShows).length}
    <div class="grid">
      {#each Object.entries($stageShows) as [id, show], index}
        <!-- <div style="display: flex;"> -->
        <!-- <Checkbox
            on:change={() => {
              stageShows.update((s) => {
                s[id].enabled = !s[id].enabled
                sendData(STAGE, { channel: "SHOWS" })
                return s
              })
            }}
            checked={show.enabled}
          /> -->
        <StageSlide
          {show}
          {index}
          active={$activeStage.id === id}
          on:click={(e) => {
            if (!e.ctrlKey)
              activeStage.update((as) => {
                as.id = id
                return as
              })
          }}
        />
        <!-- </div> -->
        <!-- <div style="display: flex;">
      <Checkbox checked={show.enabled} />
      <Button
        on:click={() =>
          activeStage.update((as) => {
            as.id = id
            return as
          })}
        active={$activeStage.id === id}
        bold={false}
      >
        {show.name}
      </Button>
    </div> -->
      {/each}
    </div>
  {:else}
    <Center faded>
      <T id="empty.stage_shows" />
    </Center>
  {/if}
  <!-- Add -->
</div>

<style>
  .main {
    background-color: var(--primary-darker);
    flex: 1;
  }

  /* .main :global(button) {
    width: 100%;
    padding: 20px;
  } */

  .grid {
    display: flex;
    flex-wrap: wrap;
    /* gap: 10px; */
    padding: 5px;
    /* height: 100%; */
    /* align-content: flex-start; */
  }
</style>
