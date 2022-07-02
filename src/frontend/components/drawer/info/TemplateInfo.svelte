<script>
  import { setExampleTemplates } from "../../../utils/createData"
  import Button from "../../inputs/Button.svelte"
</script>

<main>
  <Button style="width: 100%;" on:click={setExampleTemplates} center dark>Refresh example temlates</Button>
</main>

<style>
  main {
    padding: 10px;
  }
</style>
