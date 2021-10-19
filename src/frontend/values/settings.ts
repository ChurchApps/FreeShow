import type { Languages, Themes } from "../../types/Settings"

export const themes: Themes[] = [
  {
    name: "themes.dark",
    values: {
      primary: "#2d313b",
      secondary: "#e6349c", // #d02789
      text: "#f0f0ff",
      textInvert: "#131313",
      hover: "rgb(255 255 255 / 20%)",
      active: "rgb(230 52 156 / 50%)",
    },
  },
  {
    name: "themes.light",
    values: {
      primary: "white",
      secondary: "#e6349c",
      text: "#131313",
      textInvert: "#f0f0ff",
      hover: "rgb(0 0 0 / 20%)",
      active: "rgb(230 52 156 / 50%)",
    },
  },
  {
    name: "themes.dark2",
    values: {
      primary: "#2d313b",
      secondary: "rgb(230 73 52)",
      text: "#f0f0ff",
      textInvert: "#131313",
      hover: "rgb(255 255 255 / 20%)",
      active: "rgb(230 73 52 / 50%)",
    },
  },
  {
    name: "themes.black",
    values: {
      primary: "black",
      secondary: "#3ad2ff",
      text: "#f0f0ff",
      textInvert: "#131313",
      hover: "rgb(255 255 255 / 20%)",
      active: "rgb(230 52 156 / 50%)",
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
