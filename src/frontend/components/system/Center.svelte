<script lang="ts">
  export let faded: boolean = false
  export let absolute: boolean = false
  export let size: number = 1
</script>

<div style="font-size: {size}em;" class:faded class:absolute>
  <slot />
</div>

<style>
  div {
    display: flex;
    height: 100%;
    width: 100%;
    overflow-y: auto;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }

  .faded {
    opacity: 0.5;
  }

  .absolute {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
</style>
