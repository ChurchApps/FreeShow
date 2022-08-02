<script lang="ts">
  import { backgroundColor, displayMetadata, screen } from "../../../stores"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
  import Color from "../../inputs/Color.svelte"
  import Dropdown from "../../inputs/Dropdown.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"

  const inputs: any = {
    backgroundColor: (e: any) => backgroundColor.set(e.target.value),
  }

  const meta: any[] = [
    { id: "never", name: "$:show_at.never:$" },
    { id: "always", name: "$:show_at.always:$" },
    { id: "first", name: "$:show_at.first:$" },
    { id: "last", name: "$:show_at.last:$" },
    { id: "first_last", name: "$:show_at.first_last:$" },
  ]

  function reset() {
    displayMetadata.set("never")
    backgroundColor.set("#000000")
    screen.set({ resolution: { width: 1920, height: 1080 } })
  }
</script>

<div>
  <p><T id="settings.resolution" /></p>
  <span class="inputs">
    <!-- defaults dropdown -->
    <!-- custom... -->
    <p style="font-weight: bold;"><T id="screen.width" /></p>
    <NumberInput
      value={$screen.resolution.width}
      min={100}
      max={10000}
      buttons={false}
      outline
      on:change={(e) => {
        screen.update((a) => {
          a.resolution.width = e.detail
          return a
        })
      }}
    />
    <p style="font-weight: bold;"><T id="screen.height" /></p>
    <NumberInput
      value={$screen.resolution.height}
      min={100}
      max={10000}
      buttons={false}
      outline
      on:change={(e) => {
        screen.update((a) => {
          a.resolution.height = e.detail
          return a
        })
      }}
    />
  </span>
</div>
<div>
  <p><T id="edit.background_color" /></p>
  <span style="width: 200px;">
    <Color bind:value={$backgroundColor} on:input={inputs.backgroundColor} />
  </span>
</div>
<div>
  <p><T id="settings.display_metadata" /></p>
  <Dropdown
    options={meta}
    value={meta.find((a) => a.id === $displayMetadata)?.name || "—"}
    style="width: 200px;"
    on:click={(e) => {
      displayMetadata.set(e.detail.id)
    }}
  />
</div>

<hr />

<Button style="width: 100%;" on:click={reset} center>
  <Icon id="reset" right />
  <T id="actions.reset" />
</Button>

<style>
  div:not(.scroll) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 5px 0;
    height: 35px;
  }

  .inputs {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .inputs :global(input) {
    width: 80px;
  }

  hr {
    margin: 20px 0;
    border: none;
    height: 2px;
    background-color: var(--primary-lighter);
  }
</style>
