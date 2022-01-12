<script lang="ts">
  import Icon from "../helpers/Icon.svelte"

  export let icon: string
  export let size: number = 5
</script>

<div style={$$props.style} on:click title={$$props.title}>
  <slot />
  <div class="overlay">
    <Icon id={icon} {size} white />
  </div>
</div>

<style>
  div {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .overlay {
    cursor: pointer;
    position: absolute;
    top: 0;
    opacity: 0;
    transition: 0.2s opacity;
    background-color: rgb(0 0 0 / 0.5);

    display: flex;
    align-items: center;
    justify-content: center;
  }
  .overlay:hover {
    opacity: 0.8;
  }
</style>
