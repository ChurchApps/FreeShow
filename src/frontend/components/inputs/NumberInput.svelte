<script lang="ts">
  import { createEventDispatcher } from "svelte"
  import Icon from "../helpers/Icon.svelte"
  import Button from "./Button.svelte"
  import TextInput from "./TextInput.svelte"

  export let value: number
  export let inputMultiplier: number = 1
  export let decimals: number = 0
  export let step: number = 1
  export let min: number = 0
  export let max: number = 1000

  const dispatch = createEventDispatcher()
  const increment = () => dispatch("change", Math.min(Number(value) + step, max).toFixed(decimals))
  const decrement = () => dispatch("change", Math.max(Number(value) - step, min).toFixed(decimals))
  // TODO: reset if not number....
  const input = (e: any) => dispatch("change", Math.max(Math.min(e.target.value, max), min) / inputMultiplier || value)
</script>

<span class="main">
  <Button on:click={decrement} center style={"flex: 1;"}>
    <Icon id="remove" size={1.2} white />
  </Button>
  <span class="input">
    <TextInput value={(value * inputMultiplier).toFixed(decimals)} on:change={input} center />
  </span>
  <Button on:click={increment} center style={"flex: 1;"}>
    <Icon id="add" size={1.2} white />
  </Button>
</span>

<style>
  .main {
    display: flex;
    align-items: center;
    background-color: var(--primary-darker);
    flex-flow: wrap;
  }

  .input {
    flex: 2;
    height: 100%;
    font-size: 1.5em;
  }
</style>
