<script lang="ts">
  import { MAIN } from "../../../types/Channels"

  import Button from "../inputs/Button.svelte"

  let version: string = "0.0.0"
  window.api.send(MAIN, { channel: "GET_VERSION" })
  window.api.receive(MAIN, (data: any) => {
    if (data.channel === "GET_VERSION") version = data.data
  })
</script>

<span class="center">
  <h1>FreeShow</h1>
  <p style="padding: 30px">v{version} (Beta)</p>

  <span style="display: flex;">
    <Button>Create Project</Button>
    <Button>Create Show</Button>
  </span>
</span>

<style>
  h1 {
    font-size: 4em;
  }

  p {
    opacity: 0.8;
  }

  .center {
    display: flex;
    height: 100%;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .center :global(button) {
    background-color: var(--secondary);
    color: var(--secondary-text);
    font-size: 1em;
    margin: 10px;
  }
</style>
