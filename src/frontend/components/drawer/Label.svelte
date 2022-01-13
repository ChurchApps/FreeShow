<script lang="ts">
  import { mediaOptions } from "../../stores"

  import Icon from "../helpers/Icon.svelte"

  export let label: string
  export let icon: null | string = null
  export let color: null | string = null
  export let white: boolean = false
</script>

<div class="label" class:list={!$mediaOptions.grid} style={color ? "background-color:" + color : ""}>
  {#if icon}
    <Icon id={icon} class="icon" size={1.2} {white} />
  {/if}
  <span>{label}</span>
</div>

<style>
  .label {
    position: relative;
    display: flex;
    align-items: center;

    padding: 4px 6px;
    background-color: var(--primary-lighter);
    font-size: 0.8em;
    /* font-weight: bold; */
    height: 25px;
    flex: 1;

    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;

    /* position: absolute;
    bottom: 25px;
    transform: translateY(100%); */
    width: 100%;
    text-align: center;
  }

  div.list {
    height: 100%;
    font-size: inherit;
    padding: 4px 16px;
    background-color: var(--primary);
  }

  div :global(.icon) {
    position: absolute;
  }

  div :global(span) {
    width: 100%;
    margin: 0 24px;
    text-align: center;
    overflow-x: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
