<script>
  import { OUTPUT } from "../../../../types/Channels"
  import { requestData } from "../../../utils/request"
  import T from "../../helpers/T.svelte"
  import Button from "../../inputs/Button.svelte"
</script>

<Button on:click={() => requestData(OUTPUT, ["CLOSE_AD"])}>
  <T id="inputs.close_ad" />
</Button>
