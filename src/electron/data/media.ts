export const videoExtensions = [
    "mp4", // MPEG-4 Video
    "webm", // WebM Video
    "ogv", // Ogg Video
    "mov", // QuickTime Movie
    "m4v", // MPEG-4 Video (iTunes specific)
    "3gp", // 3GPP Video
    "3g2", // 3GPP2 Video
    "avi", // Audio Video Interleave
    "mkv", // Matroska Video
    "flv", // Flash Video
    "ts", // MPEG Transport Stream
    "dvr-ms", // Microsoft Digital Video Recording
    "mpeg", // Moving Picture Experts Group
    "mpg", // Moving Picture Experts Group (alternate extension)
]
// wmv / avchd

export const imageExtensions = [
    "jpg", // JPEG image
    "jpeg", // JPEG image
    "png", // Portable Network Graphics
    "gif", // Graphics Interchange Format
    "bmp", // Bitmap image file
    "svg", // Scalable Vector Graphics
    "webp", // WebP image format
    "tiff", // Tagged Image File Format
    "tif", // Tagged Image File Format (alternate extension)
    "jfif", // JPEG File Interchange Format
    "avif", // AV1 Image File Format
]
// eps

export const audioExtensions = [
    "mp3", // MPEG Audio Layer III
    "wav", // Waveform Audio File Format
    "ogg", // Ogg Vorbis Audio
    "aac", // Advanced Audio Codec
    "m4a", // MPEG-4 Audio
    "flac", // Free Lossless Audio Codec
    "wma", // Windows Media Audio
    "opus", // Opus Audio Codec
    "aiff", // Audio Interchange File Format
    "aif", // Audio Interchange File Format (alternate extension)
    "weba", // WebA Audio
]

export const mimeTypes: { [key: string]: string } = {
    mp4: "video/mp4",
    webm: "video/webm",
    ogv: "video/ogg",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
    "3gp": "video/3gpp",
    "3g2": "video/3gpp2",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
    flv: "video/x-flv",
    ts: "video/mp2t",
    dvrms: "video/dvr-ms",
    mpeg: "video/mpeg",
    mpg: "video/mpeg",
}
