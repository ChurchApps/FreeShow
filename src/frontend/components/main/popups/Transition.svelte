<script lang="ts">
  import { get } from "svelte/store"
  import { OUTPUT } from "../../../../types/Channels"

  import type { TransitionType } from "../../../../types/Show"
  import { activeShow, selected, showsCache, transitionData } from "../../../stores"
  import { history } from "../../helpers/history"
  import Icon from "../../helpers/Icon.svelte"
  import { _show } from "../../helpers/shows"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"

  const types: TransitionType[] = ["none", "fade", "blur", "scale", "spin"]

  function changeTransition(id: "text" | "media", key: "type" | "duration", value: any) {
    if (key === "duration") value = Number(value)
    if (slideTransition) {
      history({
        id: "changeLayout",
        newData: { key: "transition", value: { ...(slideTransition || {}), [key]: value } },
        location: { page: "show", show: $activeShow!, layoutSlide: $selected.data[0].index, layout: _show("active").get("settings.activeLayout") },
      })
      slideTransition[key] = value
      setTimeout(() => {
        window.api.send(OUTPUT, { channel: "SHOWS", data: get(showsCache) })
      }, 1000)
    } else {
      transitionData.update((a: any) => {
        a[id][key] = value
        return a
      })
    }
  }

  $: slideTransition = $selected.id === "slide" && $selected.data[0] ? $selected.data[0].transition || { type: "fade", duration: 500 } : null
</script>

<p>
  <T id="transition.text" />{#if slideTransition}&nbsp;<T id="transition.current_slide" />{/if}:
</p>
<NumberInput
  disabled={(slideTransition ? slideTransition.type : $transitionData.text.type) === "none"}
  value={slideTransition ? slideTransition.duration : $transitionData.text.duration}
  max={20000}
  fixed={1}
  decimals={3}
  step={100}
  inputMultiplier={0.001}
  on:change={(e) => changeTransition("text", "duration", e.detail)}
/>
{#each types as type}
  <Button on:click={() => changeTransition("text", "type", type)} active={(slideTransition ? slideTransition.type : $transitionData.text.type) === type} center style={"flex: 1;"}>
    <Icon id={type} size={1.2} right />
    <T id="transition.{type}" />
  </Button>
{/each}

<!-- TODO: media transition -->
