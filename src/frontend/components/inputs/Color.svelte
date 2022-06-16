<script lang="ts">
  export let value: any = "#FFF"
  export let height: number = 0
</script>

<div style={(height ? "height: " + height + "px;" : "") + "background-color: " + value + ";" + ($$props.style || "")}>
  <input style={height ? "height: " + height + "px;" : ""} type="color" bind:value on:input />
</div>

<style>
  div {
    border: 2px solid var(--primary-darker);
    transition: background-color 0.2s;
  }
  /* div:hover {
    filter: brightness(1.2);
  } */
  input[type="color"] {
    opacity: 0;
    width: 100%;
    border: none;
  }
</style>
