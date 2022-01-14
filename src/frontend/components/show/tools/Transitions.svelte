<script lang="ts">
  import type { TransitionType } from "../../../../types/Show"

  import { activeShow, dictionary, groupCount, groups, shows } from "../../../stores"
  import { GetLayout, GetLayoutRef } from "../../helpers/get"
  import { history } from "../../helpers/history"
  import Icon from "../../helpers/Icon.svelte"
  import Button from "../../inputs/Button.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"

  $: show = JSON.parse(JSON.stringify($shows[$activeShow!.id]))
  let slides: any
  $: activeLayout = $shows[$activeShow!.id].settings.activeLayout
  $: slides = GetLayout($activeShow!.id, activeLayout)

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

  function change(e: any, i: number) {
    // let value = Number(e.target.value)
    let value = Number(e.detail)
    console.log(value)

    if (typeof value === "number") {
      // TODO: get default transition
      let type: TransitionType = "fade"
      history({
        id: "transition",
        newData: { type, duration: value },
        oldData: slides[i].transition || null,
        location: { page: "show", show: $activeShow!, layout: activeLayout, layoutSlide: i },
      })
      slides = GetLayout($activeShow!.id, activeLayout)
    }
  }

  function changeAll(e: any) {
    console.log(e.detail)
  }

  function toggleEnd(i: number) {
    shows.update((a: any) => {
      // let ref: any[] = GetLayoutRef()
      let slides = a[$activeShow!.id].layouts[activeLayout].slides
      // remove old
      let currentIndex: number = -1
      slides.forEach((a: any) => {
        currentIndex++
        if (currentIndex === i && a.end !== true) a.end = true
        else if (a.end) delete a.end
        if (a.children) {
          Object.values(a.children).forEach((b: any) => {
            currentIndex++
            if (currentIndex === i && b.end !== true) b.end = true
            else if (b.end) delete b.end
          })
        }
      })
      // let slide: any
      // if (ref[i].type === "child") slide = slides[ref[i].layoutIndex].children[ref[i].id]
      // else slide = slides[ref[i].index]
      // if (slide.end === true) delete slide.end
      // else slide.end = true
      return a
    })
    slides = GetLayout($activeShow!.id, activeLayout)
  }
</script>

<div class="content">
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
        <NumberInput value={slide.transition?.duration || 0} on:change={(e) => change(e, i)} buttons={false} />
        <!-- <TextInput type="number" style="min-width: 50px;flex: 1;" value={0} on:change={(e) => change(e, i)} center /> -->
        <!-- to beginning -->
        <Button style="height: 100%;" on:click={() => toggleEnd(i)}>
          <Icon id="restart" white={slide.end !== true} />
        </Button>
      </div>
    {/each}
  </div>
</div>
<!-- padding: 5px;gap: 5px; -->
<div class="bottom" style="display: flex;flex-direction: column;">
  <div style="display: flex;gap: 5px;">
    <!-- <TextInput style="flex: 1;" value={10} on:change={() => console.log("change")} center /> -->
    <NumberInput value={10} on:change={changeAll} />
    <!-- Apply to all / selected -->
    <Button style="flex: 1;" dark center>[[[Apply to all]]]</Button>
  </div>
  <Button center dark>
    <Icon id="reset" />
    [[[Reset]]]
  </Button>
</div>

<style>
  .content {
    overflow-y: auto;
    height: 100%;
  }

  .slide {
    height: 25px;
    display: flex;
    align-items: center;
    margin: 10px 0;
  }

  .slide :global(.numberInput),
  .bottom :global(.numberInput) {
    flex: 1;
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
