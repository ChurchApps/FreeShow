# How to add a new language:

1. Fork this repository to make changes
2. Find the language identifier for your country: [https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
3. Create a file in [this directory](.) called "{language id}.json"
4. Copy content from "en.json" to the new file
5. Translate all strings
6. Go to the [languageData.ts](/src/frontend/utils/languageData.ts) file and fill in the missing data
7. Create a new pull request to the "dev" branch

> Thank you :)
