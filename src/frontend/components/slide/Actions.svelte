<script lang="ts">
  import T from "../helpers/T.svelte"
  import Button from "../inputs/Button.svelte"
  import ActionsView from "./ActionsView.svelte"

  const actionsTabs = {
    slides: { name: "actions.slides", icon: "slides" },
    transitions: { name: "actions.transitions", icon: "transition" },
    timers: { name: "actions.timers", icon: "timers" },
    backgrounds: { name: "actions.backgrounds", icon: "backgrounds" },
    notes: { name: "actions.notes", icon: "notes" },
    props: { name: "actions.props", icon: "props" }, // ??
  }

  let active: string = "slides"
</script>

<div>
  <div style="display: flex;">
    {#each Object.entries(actionsTabs) as tab}
      <Button on:click={() => (active = tab[0])} active={active === tab[0]}>
        <T id={tab[1].name} />
      </Button>
    {/each}
  </div>

  <ActionsView id={active} />
</div>
