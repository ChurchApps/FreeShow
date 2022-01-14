<script lang="ts">
  import { activeShow, outBackground, shows, videoExtensions } from "../../../stores"
  import MediaLoader from "../../drawer/media/MediaLoader.svelte"
  import Icon from "../../helpers/Icon.svelte"
  import Button from "../../inputs/Button.svelte"
  import HoverButton from "../../inputs/HoverButton.svelte"
  import Center from "../../system/Center.svelte"
  import SelectElem from "../../system/SelectElem.svelte"

  $: show = $shows[$activeShow!.id]
  let layoutBackgrounds: any[] = []
  $: {
    if (show) {
      layoutBackgrounds = []
      Object.values(show.layouts).forEach((a: any) => {
        layoutBackgrounds.push(...a.slides.map((a: any) => a.background).filter((a: any) => a !== undefined))
      })
    }
  }

  let backgrounds: any = {}
  let bgs: any = []

  $: {
    if (layoutBackgrounds.length) {
      backgrounds = []
      bgs = []
      layoutBackgrounds.forEach((a: any) => {
        let id = show.backgrounds[a].path

        let type = "image"
        const [extension] = id.substring(id.lastIndexOf("\\") + 1).match(/\.[0-9a-z]+$/i) || [""]
        if ($videoExtensions.includes(extension.substring(1))) type = "video"

        if (backgrounds[id]) backgrounds[id].count++
        else backgrounds[id] = { id: a, ...show.backgrounds[a], type, count: 1 }
      })
      Object.values(backgrounds).forEach((a) => bgs.push(a))
    } else bgs = []
  }

  function setBG(id: string, key: string, value: boolean) {
    shows.update((a: any) => {
      let bgs = a[$activeShow!.id].backgrounds
      if (value) delete bgs[id][key]
      else bgs[id][key] = value
      return a
    })
  }

  // TODO: check if file exists!!!
</script>

<!-- TODO: transition type & duration -->

<div class="main">
  {#if bgs.length}
    {#each bgs as background}
      <SelectElem id="media" data={{ path: background.path }} draggable>
        <div class="item" title={background.path} class:active={$outBackground?.path === background.path}>
          <HoverButton
            style="flex: 2;height: 50px;"
            icon="play"
            size={3}
            on:click={() => outBackground.set({ path: background.path, muted: background.muted !== false })}
            title="[[[Play video output...]]]"
          >
            <!-- <div style="flex: 2;height: 50px;"> -->
            <MediaLoader name={background.name} path={background.path} type={background.type} />
            <!-- </div> -->
          </HoverButton>
          <p style="flex: 3;">{background.name}</p>
          <span style="color: var(--secondary);">{background.count}</span>
          {#if background.type === "video"}
            <Button style="flex: 0" center title={background.muted !== false ? "Unmute" : "Mute"} on:click={() => setBG(background.id, "muted", background.muted === false)}>
              <Icon id={background.muted !== false ? "muted" : "volume"} size={1.2} />
            </Button>
            <Button style="flex: 0" center title="[[[Loop video]]]" on:click={() => setBG(background.id, "loop", background.loop === false)}>
              <Icon id="loop" white={background.loop === false} size={1.2} />
            </Button>
          {/if}
        </div>
      </SelectElem>
    {/each}
  {:else}
    <Center faded>[[[No backgrounds in show]]]</Center>
  {/if}
</div>

<style>
  .main {
    display: flex;
    flex-direction: column;
    height: 100%;
    /* justify-content: center;
    align-items: center;
    overflow: hidden;
    position: relative; */
  }

  .item {
    display: flex;
    width: 100%;
    height: fit-content;
    /* justify-content: center; */
    align-items: center;
  }
  .item:hover {
    background-color: var(--hover);
  }
  .item:active,
  .item:focus {
    background-color: var(--focus);
  }

  .item.active {
    outline: 2px solid var(--secondary);
    outline-offset: -2px;
  }

  p,
  span {
    padding: 0 10px;
    text-align: center;
  }

  .main :global(img),
  .main :global(canvas) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
  }
</style>
