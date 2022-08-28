import type { ItemType } from "./../../../../types/Show"

export type Box = {
  [key in ItemType]?: {
    name: string
    icon: string
    edit: {
      [key: string]: EditInput[]
    }
  }
}

export type EditInput = {
  name?: string
  id?: string
  key?: string
  input: string
  value?: string | number | boolean
  extension?: string
  disabled?: string
  valueIndex?: number
  values?: any
}

export const boxes: Box = {
  text: {
    name: "settings.text",
    icon: "text",
    edit: {
      font: [
        { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
        { name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
        { name: "size", id: "style", key: "font-size", input: "number", value: 100, extension: "px", disabled: "item.autoSize" },
        { name: "auto_size", id: "auto", input: "checkbox", value: false },
      ],
      style: [
        { input: "font-style" },
        { name: "line_spacing", id: "style", key: "line-height", input: "number", value: 1, values: { max: 10, step: 0.1, decimals: 1, inputMultiplier: 10 }, extension: "em" },
        { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -1000 }, extension: "px" },
        { name: "word_spacing", id: "style", key: "word-spacing", input: "number", value: 0, values: { min: -100 }, extension: "px" },
      ],
      align: [{ input: "align-x" }, { input: "align-y" }],
      outline: [
        { name: "color", id: "style", key: "-webkit-text-stroke-color", input: "color", value: "#000000" },
        { name: "width", id: "style", key: "-webkit-text-stroke-width", input: "number", value: 0, values: { max: 100 }, extension: "px" },
      ],
      shadow: [
        { name: "color", id: "style", key: "text-shadow", valueIndex: 3, input: "color", value: "#000000" },
        { name: "offsetX", id: "style", key: "text-shadow", valueIndex: 0, input: "number", value: 2, values: { min: -1000 }, extension: "px" },
        { name: "offsetY", id: "style", key: "text-shadow", valueIndex: 1, input: "number", value: 2, values: { min: -1000 }, extension: "px" },
        { name: "blur", id: "style", key: "text-shadow", valueIndex: 2, input: "number", value: 10, extension: "px" },
      ],
    },
  },
  media: {
    name: "settings.media",
    icon: "image",
    edit: {
      default: [
        { id: "src", input: "media" },
        {
          name: "fit",
          id: "fit",
          input: "dropdown",
          value: "contain",
          values: {
            options: [
              { id: "contain", name: "Contain" },
              { id: "cover", name: "Cover" },
              { id: "fill", name: "Fill" },
              { id: "scale-down", name: "Scale down" },
            ],
          },
        },
      ],
      // shadow: [
      //   { name: "color", id: "style", key: "text-shadow", valueIndex: 3, input: "color", value: "#000000" },
      //   { name: "offsetX", id: "style", key: "text-shadow", valueIndex: 0, input: "number", value: 2, values: { min: -1000 }, extension: "px" },
      //   { name: "offsetY", id: "style", key: "text-shadow", valueIndex: 1, input: "number", value: 2, values: { min: -1000 }, extension: "px" },
      //   { name: "blur", id: "style", key: "text-shadow", valueIndex: 2, input: "number", value: 10, extension: "px" },
      // ],
    },
  },
  timer: {
    name: "settings.timer",
    icon: "timer",
    edit: {
      default: [{ input: "editTimer" }],
      font: [
        { name: "family", id: "style", key: "font-family", input: "fontDropdown", value: "CMGSans" },
        { name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" },
      ],
      style: [
        { input: "font-style" },
        { name: "letter_spacing", id: "style", key: "letter-spacing", input: "number", value: 0, values: { max: 100, min: -1000 }, extension: "px" },
      ],
      outline: [
        { name: "color", id: "style", key: "-webkit-text-stroke-color", input: "color", value: "#000000" },
        { name: "width", id: "style", key: "-webkit-text-stroke-width", input: "number", value: 0, values: { max: 100 }, extension: "px" },
      ],
      shadow: [
        { name: "color", id: "style", key: "text-shadow", valueIndex: 3, input: "color", value: "#000000" },
        { name: "offsetX", id: "style", key: "text-shadow", valueIndex: 0, input: "number", value: 2, values: { min: -1000 }, extension: "px" },
        { name: "offsetY", id: "style", key: "text-shadow", valueIndex: 1, input: "number", value: 2, values: { min: -1000 }, extension: "px" },
        { name: "blur", id: "style", key: "text-shadow", valueIndex: 2, input: "number", value: 10, extension: "px" },
      ],
    },
  },
  icon: {
    name: "settings.icon",
    icon: "icon",
    edit: {
      default: [{ name: "color", id: "style", key: "color", input: "color", value: "#FFFFFF" }],
    },
  },
}
