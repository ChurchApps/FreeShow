<script lang="ts">
  import { activeShow, dictionary, groupCount, groups, shows } from "../../../stores"
  import { GetLayout, GetLayoutRef } from "../../helpers/get"
  import Icon from "../../helpers/Icon.svelte"
  import Button from "../../inputs/Button.svelte"
  import TextInput from "../../inputs/TextInput.svelte"

  $: show = JSON.parse(JSON.stringify($shows[$activeShow!.id]))
  let slides: any
  $: slides = GetLayout($activeShow!.id)

  $: {
    if (show) {
      let added: any = {}
      Object.values(show.slides).map((slide: any) => {
        if (slide.globalGroup && $groups[slide.globalGroup]) {
          if ($groups[slide.globalGroup].default) slide.group = $dictionary.groups[$groups[slide.globalGroup].name]
          else slide.group = $groups[slide.globalGroup].name
          slide.color = $groups[slide.globalGroup].color
        }

        // check count
        if (slide.group) {
          if (added[slide.group]) {
            added[slide.group]++
            slide.group += " #" + added[slide.group]
          } else added[slide.group] = 1
        }
        return slide
      })

      // same group count
      if ($groupCount) {
        added = {}
        let ref: any = GetLayoutRef()
        slides.forEach((a: any, i: number) => {
          if (ref[i].type === "parent") {
            if (added[a.id]) {
              added[a.id]++
              a.count = added[a.id]
            } else added[a.id] = 1
          }
        })
      }
    }
  }
</script>

<div>
  {#each slides as slide, i}
    <div class="slide">
      <span style="margin: 10px 5px;min-width: 20px;text-align: center;opacity: 0.8;">{i + 1}</span>
      <p style="background-color: {slide.color || 'var(--primary-lighter)'};">{show.slides[slide.id].group || ""}{slide.count ? " " + slide.count : ""}</p>
      <!-- transition -->
      <Button style="height: 100%;">
        <Icon id="transition" />
      </Button>
      <!-- next timer -->
      <!-- empty or 0 === disabled -->
      <TextInput style="min-width: 50px;flex: 1;" value={0} on:change={() => console.log("change")} center />
      <!-- to beginning -->
      <Button style="height: 100%;">
        <Icon id="restart" white={true} />
      </Button>
    </div>
  {/each}
</div>
<div class="bottom">
  <div style="display: flex;align-items: center;padding: 10px;gap: 10px;">
    <TextInput style="min-width: 50px;flex: 1;" value={10} on:change={() => console.log("change")} center />
    <Button style="flex: 3;" dark center>[[[Apply to all / selected]]]</Button>
  </div>
  <Button>
    <Icon id="reset" />
    [[[Reset]]]
  </Button>
</div>

<style>
  .slide {
    height: 25px;
    display: flex;
    align-items: center;
    margin: 10px 0;
  }

  p {
    flex: 3;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8em;
    font-weight: bold;
  }
</style>
