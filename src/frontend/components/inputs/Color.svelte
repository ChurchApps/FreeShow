<script lang="ts">
  export let value: any = "#FFF"
</script>

<div style="background-color: {value};">
  <input type="color" bind:value on:input />
</div>

<style>
  div {
    border: 2px solid var(--primary-darker);
    transition: background-color 0.2s;
  }
  input[type="color"] {
    opacity: 0;
    /* display: block; */
    /* width: 32px;
    height: 32px; */
    border: none;
  }
</style>
