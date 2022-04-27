<script lang="ts">
  import { OUTPUT } from "../../../../types/Channels"

  import { autoOutput, outputPosition } from "../../../stores"
  import { send } from "../../../utils/request"
  import T from "../../helpers/T.svelte"
  import Checkbox from "../../inputs/Checkbox.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import Screens from "../Screens.svelte"

  function setAutoOutput(e: any) {
    autoOutput.set(e.target.checked)
  }
  function changeOutputPosition(e: any, key: string) {
    outputPosition.set({ ...$outputPosition, [key]: Number(e.detail) })
    send(OUTPUT, ["POSITION"], $outputPosition)
  }
</script>

<div style="justify-content: center;"><T id="settings.hide_output_hint" /></div>
<br />
<div>
  <p><T id="settings.auto_output" /></p>
  <Checkbox checked={$autoOutput} on:change={setAutoOutput} />
</div>
<div>
  <p><T id="settings.position" /></p>
  <span style="display: flex;">
    <p style="width: 80px;text-align: right;"><T id="edit.x" /></p>
    <NumberInput value={$outputPosition.x} max={100000} on:change={(e) => changeOutputPosition(e, "x")} />
    <p style="width: 80px;text-align: right;"><T id="edit.y" /></p>
    <NumberInput value={$outputPosition.y} max={100000} on:change={(e) => changeOutputPosition(e, "y")} />
  </span>
</div>
<div>
  <p><T id="edit.size" /></p>
  <span style="display: flex;">
    <p style="width: 80px;text-align: right;"><T id="edit.width" /></p>
    <NumberInput value={$outputPosition.width} max={100000} on:change={(e) => changeOutputPosition(e, "width")} />
    <p style="width: 80px;text-align: right;"><T id="edit.height" /></p>
    <NumberInput value={$outputPosition.height} max={100000} on:change={(e) => changeOutputPosition(e, "height")} />
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
</style>
