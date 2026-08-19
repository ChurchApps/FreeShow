// AI AUTO SCRIPTURE - COMMAND GRAMMAR
// the spoken vocabulary the scripture voice commands are built from, per language

export type CommandGrammar = {
    imperatives: string[]
    addImperatives: string[] // extend the live selection ("add", "include")
    articles: string[]
    verse: string[]
    chapter: string[]
    next: string[]
    previous: string[]
    translation: string[]
    another: string[]
    rangeTo: string[] // "verses 1 TO 5"
    and: string[] // "verse 1 AND 2"
    restore: string[] // full phrases: put back what was on the output before the AI projected
    back: string[] // full phrases: return to the previously shown passage
    just: string[] // narrowing: "JUST verse 5"
    main: string[] // "the MAIN translation"
    accept: string[] // full phrases: project the newest suggestion ("yes show it")
}

// commands always match against the union of the spoken language & English,
// so English phrases keep working when whisper runs in another language.
// the non-English tables are best-effort everyday church vocabulary - native-speaker corrections are very welcome!
export const COMMAND_GRAMMAR: { [lang: string]: CommandGrammar } = {
    en: {
        imperatives: ["give me", "go to", "go back to", "come back to", "show", "show me", "switch to", "read", "take me to", "put", "put up", "project", "display"],
        addImperatives: ["add", "include"],
        articles: ["the"],
        verse: ["verse", "verses"],
        chapter: ["chapter"],
        next: ["next"],
        previous: ["previous", "last"],
        translation: ["translation", "version", "bible"],
        another: ["another", "a different"],
        rangeTo: ["to", "through", "thru", "till", "until"],
        and: ["and"],
        restore: ["bring it back", "put it back up", "put it back", "restore it", "restore that", "restore the previous"],
        back: ["go back", "take us back", "take me back", "back to the previous passage", "back to the previous scripture", "the previous passage", "back to where we were"],
        just: ["just", "only"],
        main: ["main", "preferred", "primary"],
        accept: ["yes show it", "yes put it up", "project it", "project that", "put it up", "put that up", "show that one", "show the suggestion"]
    },
    es: {
        imperatives: ["dame", "vamos a", "muestra", "cambia a"],
        addImperatives: ["añade", "agrega"],
        articles: ["el", "la", "los"],
        verse: ["versículo", "versículos"],
        chapter: ["capítulo"],
        next: ["siguiente", "próximo"],
        previous: ["anterior"],
        translation: ["traducción", "versión"],
        another: ["otra", "otro"],
        rangeTo: ["a", "al", "hasta"],
        and: ["y"],
        restore: ["restáuralo", "vuelve a lo anterior"],
        back: ["regresa", "vuelve atrás"],
        just: ["solo", "solamente"],
        main: ["principal", "preferida"],
        accept: ["proyéctalo", "muéstralo entonces"]
    },
    pt: {
        imperatives: ["me dá", "vai para", "mostra", "muda para"],
        addImperatives: ["adiciona", "acrescenta"],
        articles: ["o", "a", "os"],
        verse: ["versículo", "versículos"],
        chapter: ["capítulo"],
        next: ["próximo", "seguinte"],
        previous: ["anterior"],
        translation: ["tradução", "versão"],
        another: ["outra", "outro"],
        rangeTo: ["a", "ao", "até"],
        and: ["e"],
        restore: ["restaura isso", "volta ao anterior"],
        back: ["volta", "volta atrás"],
        just: ["só", "somente", "apenas"],
        main: ["principal", "preferida"],
        accept: ["projeta isso", "mostra então"]
    },
    de: {
        imperatives: ["gib mir", "geh zu", "zeige", "zeig mir", "wechsle zu"],
        addImperatives: ["ergänze"],
        articles: ["der", "die", "das", "den"],
        verse: ["vers", "verse"],
        chapter: ["kapitel"],
        next: ["nächster", "nächste", "nächsten"],
        previous: ["vorheriger", "vorherige", "vorherigen", "letzter", "letzten"],
        translation: ["übersetzung", "version"],
        another: ["andere", "anderen"],
        rangeTo: ["bis"],
        and: ["und"],
        restore: ["stell es wieder her"],
        back: ["geh zurück"],
        just: ["nur"],
        main: ["bevorzugte"],
        accept: ["zeig es an", "projiziere es"]
    },
    fr: {
        imperatives: ["donne-moi", "va à", "montre", "montre-moi", "passe à"],
        addImperatives: ["ajoute"],
        articles: ["le", "la", "les"],
        verse: ["verset", "versets"],
        chapter: ["chapitre"],
        next: ["suivant", "prochain"],
        previous: ["précédent", "dernier"],
        translation: ["traduction", "version"],
        another: ["autre"],
        rangeTo: ["à", "jusqu'à", "au"],
        and: ["et"],
        restore: ["remets-le"],
        back: ["reviens en arrière"],
        just: ["juste", "seulement"],
        main: ["principale", "préférée"],
        accept: ["projette-le", "affiche-le donc"]
    },
    no: {
        imperatives: ["gi meg", "gå til", "vis", "bytt til"],
        addImperatives: ["legg til"],
        articles: [],
        verse: ["vers"],
        chapter: ["kapittel"],
        next: ["neste"],
        previous: ["forrige"],
        translation: ["oversettelse", "versjon"],
        another: ["en annen", "et annet"],
        rangeTo: ["til"],
        and: ["og"],
        restore: ["ta det tilbake"],
        back: ["gå tilbake"],
        just: ["bare", "kun"],
        main: ["foretrukne"],
        accept: ["vis det da", "projiser det"]
    }
}
