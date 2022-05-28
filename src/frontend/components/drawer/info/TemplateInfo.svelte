<script>
  import { setExampleTemplates } from "../../../utils/createData"
  import Button from "../../inputs/Button.svelte"
</script>

<Button on:click={setExampleTemplates} center dark>Refresh example temlates</Button>
