<script lang="ts">
  import { OUTPUT } from "../../../../types/Channels"

  import { autoOutput, outputPosition, outputScreen } from "../../../stores"
  import { send } from "../../../utils/request"
  import T from "../../helpers/T.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import Screens from "../Screens.svelte"

  function setAutoOutput(e: any) {
    autoOutput.set(e.target.checked)
  }
  function changeOutputPosition(e: any, key: string) {
    outputScreen.set(null)
    outputPosition.set({ ...$outputPosition, [key]: Number(e.detail) })
    send(OUTPUT, ["POSITION"], $outputPosition)
  }
</script>

<div style="justify-content: center;flex-direction: column;font-style: italic;">
  <p><T id="settings.hide_output_hint" /></p>
  <p><T id="settings.show_output_hint" /></p>
  <p><T id="settings.move_output_hint" /></p>
</div>
<br />
<div>
  <p><T id="settings.auto_output" /></p>
  <Checkbox checked={$autoOutput} on:change={setAutoOutput} />
</div>
<div>
  <p><T id="settings.position" /></p>
  <span style="display: flex;gap: 10px;">
    <p style="width: 80px;text-align: right;font-weight: bold;"><T id="edit.x" /></p>
    <NumberInput value={$outputPosition?.x || 0} min={-10000} max={100000} on:change={(e) => changeOutputPosition(e, "x")} buttons={false} outline />
    <p style="width: 80px;text-align: right;font-weight: bold;"><T id="edit.y" /></p>
    <NumberInput value={$outputPosition?.y || 0} min={-10000} max={100000} on:change={(e) => changeOutputPosition(e, "y")} buttons={false} outline />
  </span>
</div>
<div>
  <p><T id="edit.size" /></p>
  <span style="display: flex;gap: 10px;">
    <p style="width: 80px;text-align: right;font-weight: bold;"><T id="edit.width" /></p>
    <NumberInput value={$outputPosition?.width || 0} min={40} max={100000} on:change={(e) => changeOutputPosition(e, "width")} buttons={false} outline />
    <p style="width: 80px;text-align: right;font-weight: bold;"><T id="edit.height" /></p>
    <NumberInput value={$outputPosition?.height || 0} min={40} max={100000} on:change={(e) => changeOutputPosition(e, "height")} buttons={false} outline />
  </span>
</div>
<!-- TODO: display... -->
<div>
  <p><T id="settings.output_screen" /></p>
  <Screens />
</div>

<style>
  div:not(.scroll) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 5px 0;
  }

  div :global(.numberInput) {
    width: 80px;
  }

  p {
    align-self: center;
  }
</style>
