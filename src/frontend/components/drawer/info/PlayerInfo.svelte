<script>
  import { OUTPUT } from "../../../../types/Channels"
  import { send } from "../../../utils/request"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
</script>

<Button on:click={() => send(OUTPUT, ["CLOSE_AD"])}>
  <T id="inputs.close_ad" />
</Button>

<!-- TODO: change quality / resolution -->
