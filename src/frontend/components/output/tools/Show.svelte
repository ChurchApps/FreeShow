<script lang="ts">
  import { activeShow, showsCache } from "../../../stores"
  import T from "../../helpers/T.svelte"

  export let currentOutput: any

  // $: if (!currentOutput?.out?.slide) {
  //   let outs = getActiveOutputs().map((id) => $outputs[id])
  //   currentOutput = outs.find((output) => output.out?.slide)
  // }

  $: name = currentOutput?.out?.slide && $showsCache[currentOutput?.out?.slide?.id] ? $showsCache[currentOutput.out?.slide?.id].name : "—"

  let length: number = 0
  $: {
    if (currentOutput?.out?.slide?.id) {
      length = 0
      if (currentOutput.out?.slide?.id === "temp") length = 1
      else {
        $showsCache[currentOutput.out?.slide?.id]?.layouts[currentOutput.out?.slide?.layout!]?.slides.forEach((s: any) => {
          length++
          if ($showsCache[currentOutput.out?.slide?.id].slides[s.id].children) length += $showsCache[currentOutput.out.slide.id].slides[s.id].children!.length
        })
      }
    }
  }

  function openShow() {
    if (!currentOutput?.out?.slide) return

    if (currentOutput.out?.slide?.layout)
      showsCache.update((a: any) => {
        a[currentOutput.out?.slide!.id].settings.activeLayout = currentOutput.out?.slide?.layout
        return a
      })

    activeShow.set({ id: currentOutput.out?.slide?.id })
  }
</script>

{#if currentOutput?.out?.slide}
  <span class="name" style="justify-content: space-between;" on:click={openShow}>
    <p>
      {#if name.length}
        {name}
      {:else}
        <T id="main.unnamed" />
      {/if}
    </p>
    <!-- TODO: update -->
    <span style="opacity: 0.6;">{(currentOutput.out?.slide?.index || 0) + 1}/{length}</span>
  </span>
{/if}

<style>
  .name {
    display: flex;
    justify-content: center;
    padding: 10px;
    opacity: 0.8;

    cursor: pointer;
  }

  .name:hover {
    background-color: var(--primary-darker);
  }
</style>
