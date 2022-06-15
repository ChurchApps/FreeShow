<script lang="ts">
  export let value: any = "#FFF"
</script>

<div style={"background-color: " + value + ";" + ($$props.style || "")}>
  <input type="color" bind:value on:input />
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
    /* display: block; */
    /* width: 32px;
    height: 32px; */
    border: none;
  }
</style>
