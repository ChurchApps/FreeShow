<script lang="ts">
  import type { TransitionType } from "../../../../types/Show"
  import { activeShow, dictionary, fullColors, groupCount, groups, showsCache } from "../../../stores"
  import { getContrast } from "../../helpers/color"
  import { GetLayout, GetLayoutRef } from "../../helpers/get"
  import { history } from "../../helpers/history"
  import Icon from "../../helpers/Icon.svelte"
  import T from "../../helpers/T.svelte"
  import { joinTime, secondsToTime } from "../../helpers/time"
  import Button from "../../inputs/Button.svelte"
  import NumberInput from "../../inputs/NumberInput.svelte"
  import Center from "../../system/Center.svelte"

  $: show = JSON.parse(JSON.stringify($showsCache[$activeShow!.id]))
  $: activeLayout = $showsCache[$activeShow!.id].settings.activeLayout
  $: slides = [GetLayout($activeShow!.id, activeLayout), show.layouts[activeLayout].slides][0]

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
    let value = Number(e.detail)

    if (typeof value === "number") {
      // TODO: get default transition
      let type: TransitionType = "fade"
      history({
        id: "changeLayout",
        newData: { key: "transition", value: { type, duration: value } },
        location: { page: "show", show: $activeShow!, layout: activeLayout, layoutSlide: i },
      })
    }
  }

  function toggleEnd(i: number, toggle: boolean = true) {
    // TODO: more global way of doing this!
    showsCache.update((a: any) => {
      // let ref: any[] = GetLayoutRef()
      let slides = a[$activeShow!.id].layouts[activeLayout].slides
      // remove old
      let currentIndex: number = -1
      slides.forEach((l: any) => {
        currentIndex++
        if (currentIndex === i && l.end !== true) l.end = true
        else if ((toggle || currentIndex !== i) && l.end) delete l.end
        let children: string[] = a[$activeShow!.id].slides[l.id]?.children
        if (children?.length) {
          if (!l.children) l.children = {}
          children.forEach((child) => {
            currentIndex++
            if (currentIndex === i && l.children[child]?.end !== true) {
              if (!l.children[child]) l.children[child] = {}
              l.children[child].end = true
            } else if ((toggle || currentIndex !== i) && l.children[child]?.end) delete l.children[child]?.end
          })
        }
      })
      return a
    })
  }

  // total time
  let total: number = 0
  $: {
    if (slides.length) {
      let temp = 0
      slides.forEach((slide: any) => {
        if (slide.transition && slide.transition.duration > 0) temp += slide.transition.duration
      })
      total = temp
    } else total = 0
  }
  $: totalTime = total ? (total > 59 ? joinTime(secondsToTime(total)) : total + "s") : "0s"

  // apply to all
  let allTime: number = 10
  function changeAll(reset: boolean = false) {
    let value: any = { duration: allTime }
    let globalType = "fade"
    if (reset) value = { type: globalType, duration: 0 }
    history({ id: "changeLayouts", newData: { key: "transition", value, action: "keys" }, location: { page: "show", show: $activeShow!, layout: activeLayout } })
    toggleEnd(slides.length - 1, false)
  }
</script>

{#if slides.length}
  <div class="content">
    <div>
      {#each slides as slide, i}
        <div class="slide">
          <span style="margin: 10px 5px;min-width: 20px;text-align: center;opacity: 0.8;">{i + 1}</span>
          <p class="group" style="{$fullColors ? 'background-' : ''}color: {slide.color || 'unset'};{$fullColors && slide.color ? `color: ${getContrast(slide.color)};` : ''}">
            {show.slides[slide.id].group || ""}{slide.count ? " " + slide.count : ""}
          </p>
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
      <!-- <Button style="height: 100%;">
      <Icon id="transition" />
    </Button> -->
      <NumberInput value={allTime} on:change={(e) => (allTime = Number(e.detail))} />
      <!-- Apply to all / selected -->
      <Button style="flex: 1;" on:click={() => changeAll()} dark center>
        <T id="actions.to_all" />
      </Button>
    </div>
    <div style="display: flex;gap: 5px;">
      <span style="flex: 1;display: flex;align-items: center;justify-content: center;">{totalTime}</span>
      <Button style="flex: 1;" on:click={() => changeAll(true)} center dark>
        <Icon id="reset" />
        <T id="actions.reset" />
      </Button>
    </div>
  </div>
{:else}
  <Center faded>
    <T id="empty.slides" />
  </Center>
{/if}

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

  .group {
    flex: 3;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8em;
    font-weight: bold;
    background-color: var(--primary-lighter);
  }
</style>
