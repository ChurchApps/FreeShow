<script lang="ts">
  import Clock from "../items/Clock.svelte"

  import SlideText from "../items/SlideText.svelte"

  export let show: any
  export let id: string
  export let item: any
  export let slides: any
</script>

<div class="item" style={item.style}>
  {#if show?.settings.labels}
    <div class="label">
      {item.label}
      <!-- <T id="stage.{id.split('#')[1]}" /> -->
    </div>
  {/if}
  <div class="align" style={item.align}>
    <div>
      {#if id.split("#")[0] === "countdowns"}
        <!--  -->
      {:else if id.includes("slide_text")}
        <SlideText {slides} next={id.includes("next")} />
      {:else if id.includes("slide")}
        <span>
          <SlideText {slides} next={id.includes("next")} style />
        </span>
      {:else if id.includes("clock")}
        <Clock />
      {:else}
        {id}
      {/if}
    </div>
  </div>
</div>

<style>
  .align {
    height: 100%;
    display: flex;
    text-align: center;
    align-items: center;
  }

  .align div {
    width: 100%;
    overflow-wrap: break-word;
  }
</style>
