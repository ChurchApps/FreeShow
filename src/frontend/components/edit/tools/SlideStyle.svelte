<script lang="ts">
  import { activeEdit, activeShow } from "../../../stores"
  import { GetLayout, getSlide } from "../../helpers/get"
  import { history } from "../../helpers/history"
  import T from "../../helpers/T.svelte"
  import Color from "../../inputs/Color.svelte"

  $: editSlide = $activeEdit.slide !== null ? getSlide($activeShow?.id!, $activeEdit.slide) : null

  $: background = editSlide?.settings.background || false
  $: color = editSlide?.settings.color || "#000000"
  // $: resolution = editSlide?.settings.resolution || []
  // $: transition = editSlide?.settings.transition || {}

  const inputChange = (e: any, key: string) => update(key, e.target.value)

  function update(id: string, value: any) {
    let newData: any = { ...editSlide?.settings }
    newData[id] = value

    history({
      id: "slideStyle",
      oldData: editSlide?.settings,
      newData,
      location: { page: "edit", show: $activeShow!, slide: GetLayout()[$activeEdit.slide!].id },
    })
  }
</script>

<section>
  <h6><T id="edit.style" /></h6>
  <div style="display: flex;gap: 10px;">
    <span class="titles">
      <p><T id="edit.background" /></p>
      <p><T id="edit.color" /></p>
    </span>
    <span style="flex: 1;">
      <input type="checkbox" checked={background} />
      <Color bind:value={color} on:input={(e) => inputChange(e, "background")} />
    </span>
  </div>
  <hr />
  <h6><T id="edit.options" /></h6>
  <div style="display: flex;gap: 10px;">
    <span class="titles">
      <p><T id="edit.resolution" /></p>
      <p><T id="edit.transition" /></p>
    </span>
    <span style="flex: 1;">
      <!-- <input type="checkbox" checked={background} />
      <Color bind:value={color} on:input={colorChange} /> -->
    </span>
  </div>
</section>

<style>
  h6 {
    color: var(--text);
    text-transform: uppercase;
    text-align: center;
    font-size: 0.9em;
    margin: 20px 0;
  }

  .titles {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
  }

  p {
    width: 100%;
    opacity: 0.8;
    align-self: center;
    /* font-weight: bold; */
    /* text-transform: uppercase; */
    font-size: 0.9em;
  }

  hr {
    width: 100%;
    height: 2px;
    background-color: var(--primary-lighter);
    border: none;
    margin: 20px 0;
  }
</style>
