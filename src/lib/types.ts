import type { Sticker } from "./stickers";

export type FeedItem = {
  id: string;
  bunny_id: string;
  caption: string;
  game: string | null;
  duration_s: number | null;
  width: number | null;
  height: number | null;
  thumbnail_file: string | null;
  likes_count: number;
  comments_count: number;
  views_count: number;
  published_at: string;
  author_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  category: string;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  main_game: string | null;
  main_category: string | null;
  country: string | null;
  followers_count: number;
  following_count: number;
  videos_count: number;
};

export type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  /** Commentaire racine auquel celui-ci répond (toujours un seul niveau). */
  parent_id: string | null;
  kind: "text" | "gift";
  gift: { emoji: string; name: string } | null;
  sticker: Sticker | null;
  author: { username: string; display_name: string; avatar_url: string | null } | null;
};

export const FEED_COLUMNS =
  "id,bunny_id,caption,game,duration_s,width,height,thumbnail_file,likes_count,comments_count,views_count,published_at,author_id,username,display_name,avatar_url,category";

export const COMMENT_COLUMNS =
  "id,body,created_at,author_id,parent_id,kind,gift:tub_gifts(emoji,name),sticker:tub_stickers(id,image_path,caption,source_video_id),author:tub_profiles(username,display_name,avatar_url)";
