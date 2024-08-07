import macadam from "macadam"

export const bmdDisplayModes = new Map([
    /* SD */
    ["525i59.94 NTSC", macadam.bmdModeNTSC],
    ["525i59.94", macadam.bmdModeNTSC], // extra
    ["525i23.98 NTSC", macadam.bmdModeNTSC2398],
    ["525i2398 NTSC", macadam.bmdModeNTSC2398], // extra
    ["625i50 PAL", macadam.bmdModePAL],
    /* HD (720) */
    ["720p50", macadam.bmdModeHD720p50],
    ["720p5000", macadam.bmdModeHD720p50], // extra
    ["720p59.94", macadam.bmdModeHD720p5994],
    ["720p60", macadam.bmdModeHD720p60],
    /* HD */
    ["1080p23.98", macadam.bmdModeHD1080p2398],
    ["1080p24", macadam.bmdModeHD1080p24],
    ["1080p25", macadam.bmdModeHD1080p25],
    ["1080p29.97", macadam.bmdModeHD1080p2997],
    ["1080p2997", macadam.bmdModeHD1080p2997], // extra
    ["1080p30", macadam.bmdModeHD1080p30],
    ["1080p50", macadam.bmdModeHD1080p50],
    ["1080p5000", macadam.bmdModeHD1080p50], // extra
    // ["1080p59", macadam.bmdModeHD1080p59], // not supported
    ["1080p59.94", macadam.bmdModeHD1080p5994],
    ["1080p60", macadam.bmdModeHD1080p6000],
    ["1080PsF23.98", macadam.bmdModeHD1080p2398],
    ["1080PsF24", macadam.bmdModeHD1080p24],
    ["1080PsF25", macadam.bmdModeHD1080p25],
    ["1080PsF29.97", macadam.bmdModeHD1080p2997],
    ["1080PsF30", macadam.bmdModeHD1080p30],
    ["1080i50", macadam.bmdModeHD1080i50],
    ["1080i5000", macadam.bmdModeHD1080i50], // extra
    ["1080i59.94", macadam.bmdModeHD1080i5994],
    ["1080i5994", macadam.bmdModeHD1080i5994], // extra
    ["1080i60", macadam.bmdModeHD1080i6000],
    /* 2k */
    ["2k23.98", macadam.bmdMode2k2398],
    ["2k2398", macadam.bmdMode2k2398], // extra
    ["2k24", macadam.bmdMode2k24],
    ["2k25", macadam.bmdMode2k25],
    /* 2k (DCI) */
    ["2kDCI23.98", macadam.bmdMode2kDCI2398],
    ["2kDCI24", macadam.bmdMode2kDCI24],
    ["2kDCI25", macadam.bmdMode2kDCI25],
    ["2kDCI29.97", macadam.bmdMode2kDCI2997],
    ["2kDCI30", macadam.bmdMode2kDCI30],
    ["2kDCI50", macadam.bmdMode2kDCI50],
    ["2kDCI59.94", macadam.bmdMode2kDCI5994],
    ["2kDCI60", macadam.bmdMode2kDCI60],
    /* 4k (UHD) */
    ["4K2160p23.98", macadam.bmdMode4K2160p2398],
    ["4K2160p24", macadam.bmdMode4K2160p24],
    ["4K2160p25", macadam.bmdMode4K2160p25],
    ["4K2160p29.97", macadam.bmdMode4K2160p2997],
    ["4K2160p30", macadam.bmdMode4K2160p30],
    ["4K2160p50", macadam.bmdMode4K2160p50],
    ["4K2160p59.94", macadam.bmdMode4K2160p5994],
    ["4K2160p60", macadam.bmdMode4K2160p60],
    /* 4k (DCI) */
    ["4kDCI23.98", macadam.bmdMode4kDCI2398],
    ["4kDCI24", macadam.bmdMode4kDCI24],
    ["4kDCI25", macadam.bmdMode4kDCI25],
    ["4kDCI29.97", macadam.bmdMode4kDCI2997],
    ["4kDCI30", macadam.bmdMode4kDCI30],
    ["4kDCI50", macadam.bmdMode4kDCI50],
    ["4kDCI59.94", macadam.bmdMode4kDCI5994],
    ["4kDCI60", macadam.bmdMode4kDCI60],
    /* 8K (UHD) */
    ["8K4320p23.98", macadam.bmdMode8K4320p2398],
    ["8K4320p24", macadam.bmdMode8K4320p24],
    ["8K4320p25", macadam.bmdMode8K4320p25],
    ["8K4320p29.97", macadam.bmdMode8K4320p2997],
    ["8K4320p30", macadam.bmdMode8K4320p30],
    ["8K4320p50", macadam.bmdMode8K4320p50],
    ["8K4320p59.94", macadam.bmdMode8K4320p5994],
    ["8K4320p60", macadam.bmdMode8K4320p60],
    /* 8K (DCI) */
    ["8kDCI23.98", macadam.bmdMode8kDCI2398],
    ["8kDCI24", macadam.bmdMode8kDCI24],
    ["8kDCI25", macadam.bmdMode8kDCI25],
    ["8kDCI29.97", macadam.bmdMode8kDCI2997],
    ["8kDCI30", macadam.bmdMode8kDCI30],
    ["8kDCI50", macadam.bmdMode8kDCI50],
    ["8kDCI59.94", macadam.bmdMode8kDCI5994],
    ["8kDCI60", macadam.bmdMode8kDCI60],
])

export const bmdPixelFormats = new Map([
    ["8-bit YUV", macadam.bmdFormat8BitYUV],
    ["8BitYUV", macadam.bmdFormat8BitYUV], // extra
    ["10-bit YUV", macadam.bmdFormat10BitYUV],
    ["10BitYUV", macadam.bmdFormat10BitYUV], // extra
    ["8BitARGB", macadam.bmdFormat8BitARGB],
    ["8-bit ARGB", macadam.bmdFormat8BitARGB], // extra
    ["8BitBGRA", macadam.bmdFormat8BitBGRA],
    ["8-bit BGRA", macadam.bmdFormat8BitBGRA], // extra
    ["10BitRGB", macadam.bmdFormat10BitRGB],
    ["10-bit RGB", macadam.bmdFormat10BitRGB], // extra
    ["12BitRGB", macadam.bmdFormat12BitRGB],
    ["12-bit RGB", macadam.bmdFormat12BitRGB], // extra
    ["12BitRGBLE", macadam.bmdFormat12BitRGBLE],
    ["12-bit RGBLE", macadam.bmdFormat12BitRGBLE], // extra
    ["10BitRGBXLE", macadam.bmdFormat10BitRGBXLE],
    ["10-bit RGBXLE", macadam.bmdFormat10BitRGBXLE], // extra
    ["10BitRGBX", macadam.bmdFormat10BitRGBX],
    ["10-bit RGBX", macadam.bmdFormat10BitRGBX], // extra
])
