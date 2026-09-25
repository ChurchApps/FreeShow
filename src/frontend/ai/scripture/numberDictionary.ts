// Spoken number dictionaries for primary languages: English, French, Spanish, German, Portuguese, Italian, Dutch, Norwegian

export const UNIT_WORDS: Record<string, number> = {
    // English
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,

    // French
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    sept: 7,
    huit: 8,
    neuf: 9,

    // Spanish
    uno: 1,
    una: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,

    // German
    eins: 1,
    ein: 1,
    eine: 1,
    zwei: 2,
    drei: 3,
    vier: 4,
    fünf: 5,
    sechs: 6,
    sieben: 7,
    acht: 8,
    neun: 9,

    // Portuguese
    um: 1,
    uma: 1,
    três: 3,
    quatro: 4,
    sete: 7,
    oito: 8,
    nove: 9,

    // Italian
    tre: 3,
    sei: 6,

    // Dutch
    een: 1,
    één: 1,
    drie: 3,
    vijf: 5,
    zes: 6,
    zeven: 7,
    negen: 9,

    // Norwegian
    en: 1,
    én: 1,
    ett: 1,
    to: 2,
    fire: 4,
    fem: 5,
    seks: 6,
    sju: 7,
    syv: 7,
    åtte: 8,
    ni: 9
}

export const TEEN_WORDS: Record<string, number> = {
    // English
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,

    // French
    dix: 10,
    onze: 11,
    douze: 12,
    treize: 13,
    quatorze: 14,
    quinze: 15,
    seize: 16,
    "dix-sept": 17,
    "dix-huit": 18,
    "dix-neuf": 19,
    "dix sept": 17,
    "dix huit": 18,
    "dix neuf": 19,

    // Spanish
    diez: 10,
    once: 11,
    doce: 12,
    trece: 13,
    catorce: 14,
    quince: 15,
    dieciséis: 16,
    diecisiete: 17,
    dieciocho: 18,
    diecinueve: 19,

    // German
    zehn: 10,
    elf: 11,
    zwölf: 12,
    dreizehn: 13,
    vierzehn: 14,
    fünfzehn: 15,
    sechzehn: 16,
    siebzehn: 17,
    achtzehn: 18,
    neunzehn: 19,

    // Portuguese
    dez: 10,
    treze: 13,
    dezesseis: 16,
    dezessete: 17,
    dezoito: 18,
    dezenove: 19,

    // Italian
    undici: 11,
    dodici: 12,
    tredici: 13,
    quattordici: 14,
    quindici: 15,
    sedici: 16,
    diciassette: 17,
    diciotto: 18,
    diciannove: 19,

    // Dutch
    tien: 10,
    twaalf: 12,
    dertien: 13,
    veertien: 14,
    vijftien: 15,
    zestien: 16,
    zeventien: 17,
    achttien: 18,
    negentien: 19,

    // Norwegian
    ti: 10,
    elleve: 11,
    tolv: 12,
    tretten: 13,
    fjorten: 14,
    femten: 15,
    seksten: 16,
    sytten: 17,
    atten: 18,
    nitten: 19
}

export const TENS_WORDS: Record<string, number> = {
    // English
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,

    // French
    vingt: 20,
    trente: 30,
    quarante: 40,
    cinquante: 50,
    soixante: 60,
    "soixante-dix": 70,
    "soixante dix": 70,
    "quatre-vingts": 80,
    "quatre-vingt": 80,
    "quatre vingts": 80,
    "quatre vingt": 80,
    "quatre-vingt-dix": 90,
    "quatre vingt dix": 90,

    // Spanish
    veinte: 20,
    treinta: 30,
    cuarenta: 40,
    cincuenta: 50,
    sesenta: 60,
    setenta: 70,
    ochenta: 80,
    noventa: 90,

    // German
    zwanzig: 20,
    dreißig: 30,
    dreissig: 30,
    vierzig: 40,
    fünfzig: 50,
    sechzig: 60,
    siebzig: 70,
    achtzig: 80,
    neunzig: 90,

    // Portuguese
    vinte: 20,
    trinta: 30,
    cinquenta: 50,
    sessenta: 60,
    oitenta: 80,

    // Italian
    trenta: 30,
    cinquanta: 50,
    sessanta: 60,
    settanta: 70,
    ottanta: 80,

    // Dutch
    twintig: 20,
    dertig: 30,
    veertig: 40,
    vijftig: 50,
    zestig: 60,
    zeventig: 70,
    tachtig: 80,
    negentig: 90,

    // Norwegian
    tjue: 20,
    tretti: 30,
    tredve: 30,
    førti: 40,
    femti: 50,
    seksti: 60,
    sytti: 70,
    søtti: 70,
    åtti: 80,
    nitti: 90
}

export const ORDINAL_UNIT_WORDS: Record<string, number> = {
    // English
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
    seventh: 7,
    eighth: 8,
    ninth: 9,

    // French
    premier: 1,
    première: 1,
    deuxième: 2,
    seconde: 2,
    troisième: 3,
    quatrième: 4,
    cinquième: 5,
    sixième: 6,
    septième: 7,
    huitième: 8,
    neuvième: 9,

    // Spanish
    primer: 1,
    primero: 1,
    primera: 1,
    segundo: 2,
    segunda: 2,
    tercer: 3,
    tercero: 3,
    tercera: 3,
    cuarto: 4,
    quinto: 5,
    sexto: 6,
    séptimo: 7,
    octavo: 8,
    noveno: 9,

    // German
    erste: 1,
    erster: 1,
    erstes: 1,
    zweite: 2,
    zweiter: 2,
    dritte: 3,
    dritter: 3,
    vierte: 4,
    fünfte: 5,
    sechste: 6,
    siebte: 7,
    achte: 8,
    neunte: 9,

    // Portuguese
    primeiro: 1,
    primeira: 1,
    terceiro: 3,
    terceira: 3,

    // Italian
    primo: 1,
    prima: 1,
    terzo: 3,
    terza: 3,

    // Dutch
    eerste: 1,
    tweede: 2,
    derde: 3,

    // Norwegian
    første: 1,
    forste: 1,
    andre: 2,
    annen: 2,
    tredje: 3,
    fjerde: 4,
    femte: 5,
    sjette: 6,
    syvende: 7,
    sjuende: 7,
    åttende: 8,
    niende: 9
}

// Spoken irregular compound numbers (French 70-99, Spanish 21-29, Italian contractions)
export const SPECIAL_COMPLEX_NUMBERS: Record<string, number> = {
    // French 71-79
    "soixante-et-onze": 71,
    "soixante et onze": 71,
    "soixante-douze": 72,
    "soixante douze": 72,
    "soixante-treize": 73,
    "soixante treize": 73,
    "soixante-quatorze": 74,
    "soixante quatorze": 74,
    "soixante-quinze": 75,
    "soixante quinze": 75,
    "soixante-seize": 76,
    "soixante seize": 76,
    "soixante-dix-sept": 77,
    "soixante dix sept": 77,
    "soixante-dix-huit": 78,
    "soixante dix huit": 78,
    "soixante-dix-neuf": 79,
    "soixante dix neuf": 79,

    // French 81-89
    "quatre-vingt-un": 81,
    "quatre-vingt-une": 81,
    "quatre vingt un": 81,
    "quatre vingt une": 81,
    "quatre-vingt-deux": 82,
    "quatre vingt deux": 82,
    "quatre-vingt-trois": 83,
    "quatre vingt trois": 83,
    "quatre-vingt-quatre": 84,
    "quatre vingt quatre": 84,
    "quatre-vingt-cinq": 85,
    "quatre vingt cinq": 85,
    "quatre-vingt-six": 86,
    "quatre vingt six": 86,
    "quatre-vingt-sept": 87,
    "quatre vingt sept": 87,
    "quatre-vingt-huit": 88,
    "quatre vingt huit": 88,
    "quatre-vingt-neuf": 89,
    "quatre vingt neuf": 89,

    // French 91-99
    "quatre-vingt-onze": 91,
    "quatre vingt onze": 91,
    "quatre-vingt-douze": 92,
    "quatre vingt douze": 92,
    "quatre-vingt-treize": 93,
    "quatre vingt treize": 93,
    "quatre-vingt-quatorze": 94,
    "quatre vingt quatorze": 94,
    "quatre-vingt-quinze": 95,
    "quatre vingt quinze": 95,
    "quatre-vingt-seize": 96,
    "quatre vingt seize": 96,
    "quatre-vingt-dix-sept": 97,
    "quatre vingt dix sept": 97,
    "quatre-vingt-dix-huit": 98,
    "quatre vingt dix huit": 98,
    "quatre-vingt-dix-neuf": 99,
    "quatre vingt dix neuf": 99,

    // Spanish 21-29
    veintiuno: 21,
    veintiuna: 21,
    veintidós: 22,
    veintitrés: 23,
    veinticuatro: 24,
    veinticinco: 25,
    veintiséis: 26,
    veintisiete: 27,
    veintiocho: 28,
    veintinueve: 29,

    // Italian common contractions
    ventuno: 21,
    ventotto: 28,
    trentuno: 31,
    trentotto: 38
}

export const HUNDREDS_WORDS: Record<string, number> = {
    // English
    hundred: 100,
    hundreds: 100,

    // French
    cent: 100,
    cents: 100,

    // Spanish
    cien: 100,
    ciento: 100,
    doscientos: 200,
    trescientos: 300,
    cuatrocientos: 400,
    quinientos: 500,
    seiscientos: 600,
    setecientos: 700,
    ochocientos: 800,
    novecientos: 900,

    // German
    hundert: 100,

    // Portuguese
    cem: 100,
    cento: 100,
    duzentos: 200,
    trezentos: 300,
    quatrocentos: 400,
    quinhentos: 500,

    // Italian
    duecento: 200,
    trecento: 300,
    quattrocento: 400,
    cinquecento: 500,

    // Dutch
    honderd: 100,

    // Norwegian
    hundre: 100
}

export const MULTILINGUAL_RANGE_WORDS = ["through", "to", "jusqu'à", "hasta", "bis", "tot", "til", "à"]

export const COMPOUND_CONNECTORS = ["and", "et", "y", "und", "e", "en", "og"]

export const REVERSE_COMPOUND_CONNECTORS = ["und", "en", "og"]

export const REVERSE_COMPOUND_UNITS = [
    // German
    "ein",
    "eins",
    "eine",
    "zwei",
    "drei",
    "vier",
    "fünf",
    "sechs",
    "sieben",
    "acht",
    "neun",

    // Dutch
    "een",
    "drie",
    "vijf",
    "zes",
    "zeven",
    "negen",

    // Norwegian
    "en",
    "én",
    "ett",
    "to",
    "tre",
    "fire",
    "fem",
    "seks",
    "sju",
    "syv",
    "åtte",
    "ni"
]

export const REVERSE_COMPOUND_TENS = [
    // German
    "zwanzig",
    "dreißig",
    "dreissig",
    "vierzig",
    "fünfzig",
    "sechzig",
    "siebzig",
    "achtzig",
    "neunzig",

    // Dutch
    "twintig",
    "dertig",
    "veertig",
    "vijftig",
    "zestig",
    "zeventig",
    "tachtig",
    "negentig",

    // Norwegian
    "tjue",
    "tretti",
    "tredve",
    "førti",
    "femti",
    "seksti",
    "sytti",
    "søtti",
    "åtti",
    "nitti"
]
