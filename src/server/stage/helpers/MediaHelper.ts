import crypto from "crypto";

// Media registry to track allowed media files
const mediaRegistry = new Map<string, string>(); // token -> filePath

// Helper function to register media file and get secure token
export function registerMediaFile(filePath: string): string {
    if (!filePath) return "";

    // If it's already a URL, return as is
    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('data:')) {
        return filePath;
    }

    // Check if this file is already registered
    for (const [token, registeredPath] of mediaRegistry.entries()) {
        if (registeredPath === filePath) {
            return `http://localhost:5511/media/${token}`;
        }
    }

    // Generate a secure token for this file
    const token = crypto.randomBytes(32).toString('hex');
    mediaRegistry.set(token, filePath);

    console.log("REGISTERED MEDIA FILE:", filePath, "->", token);

    return `http://localhost:5511/media/${token}`;
}

// Helper function to get file path from token (for the server)
export function getMediaFileFromToken(token: string): string | null {
    return mediaRegistry.get(token) || null;
}

// Helper function to convert local file path to HTTP URL
export function getMediaUrl(filePath: string): string {
    return registerMediaFile(filePath);
} 