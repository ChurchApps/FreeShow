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
  const input = (e: any) => {
    let newVaule = Math.max(Math.min(e.target.value, max * inputMultiplier), min * inputMultiplier) / inputMultiplier
    dispatch("change", newVaule !== null ? newVaule.toFixed(decimals) : value)
  }

  let timeout: any = null
  let interval: any = null
  function mousedown(e: any) {
    if (e.target.closest("button")) {
      timeout = setTimeout(() => {
        let increase = true
        if (e.target.closest("button").id === "decrement") increase = false
        interval = setInterval(() => {
          if (increase) increment()
          else decrement()
        }, 50)
        // timeout = null
      }, 500)
    }
  }
</script>

<svelte:window
  on:mouseup={() => {
    clearTimeout(timeout)
    clearInterval(interval)
    timeout = null
    interval = null
  }}
/>

<span class="main" on:mousedown={mousedown}>
  <Button id="decrement" on:click={decrement} center style={"flex: 1;"} disabled={Number(value) - step < min}>
    <Icon id="remove" size={1.2} white />
  </Button>
  <span class="input">
    <TextInput value={(value * inputMultiplier).toFixed()} on:change={input} center />
  </span>
  <Button id="increment" on:click={increment} center style={"flex: 1;"} disabled={Number(value) + step > max}>
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
