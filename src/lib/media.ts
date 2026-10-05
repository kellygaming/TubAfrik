// Adresses publiques des vidéos, utilisables côté client comme serveur.
const CDN = process.env.NEXT_PUBLIC_BUNNY_CDN_HOSTNAME;

export const playlistUrl = (bunnyId: string) => `https://${CDN}/${bunnyId}/playlist.m3u8`;

export const thumbnailUrl = (bunnyId: string, file?: string | null) =>
  `https://${CDN}/${bunnyId}/${file || "thumbnail.jpg"}`;

export const previewUrl = (bunnyId: string) => `https://${CDN}/${bunnyId}/preview.webp`;
