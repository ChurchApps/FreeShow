import type { Languages, Themes } from "../../types/Settings"

export const themes: Themes[] = [
  {
    name: "themes.dark",
    values: {
      primary: "#2d313b",
      "primary-darker": "#202129",
      text: "#f0f0ff",
      textInvert: "#131313",
      secondary: "#e6349c", // #d02789
      "secondary-opacity": "rgba(230, 52, 156, 0.5)",
      "secondary-text": "#f0f0ff",
      hover: "rgb(255 255 255 / 0.05)",
      focus: "rgb(255 255 255 / 0.1)",
      // active: "rgb(230 52 156 / 0.8)",
    },
  },
  {
    name: "themes.light",
    values: {
      primary: "#ffffff",
      "primary-darker": "#cccccc",
      text: "#131313",
      textInvert: "#f0f0ff",
      secondary: "#e6349c",
      "secondary-text": "#f0f0ff",
      "secondary-opacity": "rgb(230 52 156 / 0.5)",
      hover: "rgb(0 0 0 / 0.05)",
      focus: "rgb(0 0 0 / 0.1)",
      // active: "rgb(230 52 156 / 50%)",
    },
  },
  {
    name: "themes.dark2",
    values: {
      primary: "#2d313b",
      "primary-darker": "#202129",
      text: "#f0f0ff",
      textInvert: "#131313",
      secondary: "rgb(230 73 52)",
      "secondary-text": "#f0f0ff",
      "secondary-opacity": "rgb(230 73 52 / 0.5)",
      hover: "rgb(255 255 255 / 0.05)",
      focus: "rgb(255 255 255 / 0.1)",
      // active: "rgb(230 73 52 / 50%)",
    },
  },
  {
    name: "themes.white",
    values: {
      primary: "#2d313b",
      "primary-darker": "#202129",
      text: "#f0f0ff",
      textInvert: "#131313",
      secondary: "#ffffff",
      "secondary-opacity": "rgba(255, 255, 255, 0.5)",
      "secondary-text": "#131313",
      hover: "rgb(255 255 255 / 0.05)",
      focus: "rgb(255 255 255 / 0.1)",
      // active: "rgb(230 52 156 / 0.8)",
    },
  },
  {
    name: "themes.black",
    values: {
      primary: "#101010",
      "primary-darker": "#000000",
      text: "#cccccc",
      textInvert: "#131313",
      secondary: "#3ad2ff",
      "secondary-text": "#101010",
      "secondary-opacity": "rgb(58 210 255 / 0.5)",
      hover: "rgb(255 255 255 / 0.2)",
      focus: "rgb(255 255 255 / 0.3)",
      // active: "rgb(230 52 156 / 50%)",
    },
  },
]

/* --primary: #333e58;
--primary: #2d313b;
--primary: #c1c7d8;
--primary-text: #f0f0ff;
--primary-text: #131313;
--secondary: #e6349c;
--secondary: #e64934;
--secondary: #34bfe6;
--secondary: #34e6ae;
--secondary: #dae634;
--secondary: #b434e6;
--secondary: #e63434;
--secondary: #3434e6;
--secondary: #34e64f; */

// export const languages = {
//   en: 'language.en (English)',
//   no: 'language.no (Norsk)',
// }
export const languages: Languages = {
  en: "English",
  no: "Norsk",
}

// font family
