<script lang="ts">
  import Icon from "../helpers/Icon.svelte"
  import Button from "./Button.svelte"
</script>

<Button id="icon" on:click title={$$props.title} disabled={$$props.disabled} center style={"flex: 1;"}>
  <Icon id={$$props.icon} size={1.2} white={!$$props.active} />
</Button>
