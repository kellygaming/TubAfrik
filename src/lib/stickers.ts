import { SUPABASE_URL } from "./supabase/env";

// Un sticker: un instant figé d'une vidéo, recadré au carré, avec un
// texte facultatif. Créé par un spectateur, réutilisable par tous.
export type Sticker = {
  id: string;
  image_path: string;
  caption: string | null;
  source_video_id: string | null;
};

export const STICKER_COLUMNS = "id,image_path,caption,source_video_id";
export const STICKER_SIZE = 320;
export const CAPTION_MAX = 40;

export const stickerUrl = (path: string) => `${SUPABASE_URL}/storage/v1/object/public/tub-stickers/${path}`;
