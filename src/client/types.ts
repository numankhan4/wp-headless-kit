/** A field WordPress returns as `{ rendered: string }` (and sometimes `raw` with auth). */
export interface Rendered {
  rendered: string;
  raw?: string;
  protected?: boolean;
}

/** Subset of Yoast SEO's `yoast_head_json` payload that most front ends need. */
export interface YoastHeadJson {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: Record<string, string>;
  og_title?: string;
  og_description?: string;
  og_url?: string;
  og_type?: string;
  og_site_name?: string;
  og_locale?: string;
  og_image?: Array<{ url: string; width?: number; height?: number; type?: string }>;
  twitter_card?: string;
  twitter_title?: string;
  twitter_description?: string;
  twitter_image?: string;
  article_published_time?: string;
  article_modified_time?: string;
  schema?: unknown;
}

export interface WPPost {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: Rendered;
  content: Rendered;
  excerpt: Rendered;
  author: number;
  featured_media: number;
  categories?: number[];
  tags?: number[];
  sticky?: boolean;
  yoast_head_json?: YoastHeadJson;
}

export interface WPPage extends Omit<WPPost, "categories" | "tags" | "sticky"> {
  parent: number;
  menu_order: number;
}

export interface WPTerm {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
  taxonomy: string;
  parent?: number;
}

export interface WPMedia {
  id: number;
  source_url: string;
  alt_text: string;
  media_type: string;
  mime_type: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, { source_url: string; width: number; height: number; mime_type: string }>;
  };
}

/** A WordPress user (author) as returned by `/wp/v2/users`; `avatar_urls` is keyed by pixel size, e.g. `"96"`. */
export interface WPUser {
  id: number;
  name: string;
  url: string;
  description: string;
  link: string;
  slug: string;
  avatar_urls?: Record<string, string>;
}

/** A navigation menu item as returned by `/wp/v2/menu-items`. */
export interface WPMenuItem {
  id: number;
  title: Rendered;
  url: string;
  /** Id of the parent menu item, or `0` for top-level items. */
  parent: number;
  menu_order: number;
  target?: string;
  classes?: string[];
  description?: string;
  object?: string;
  object_id?: number;
  type?: string;
}

/** A menu item with its nested children, built by `buildMenuTree`. */
export type WPMenuTreeNode<T extends WPMenuItem = WPMenuItem> = T & { children: Array<WPMenuTreeNode<T>> };

/** Query parameters accepted by collection endpoints (posts, pages, terms). */
export interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  slug?: string | string[];
  include?: number[];
  exclude?: number[];
  orderby?: string;
  order?: "asc" | "desc";
  categories?: number[];
  tags?: number[];
  _embed?: boolean;
  [key: string]: string | number | boolean | string[] | number[] | undefined;
}

/** A single hit from `/wp/v2/search`. */
export interface WPSearchResult {
  id: number;
  title: string;
  url: string;
  type: "post" | "term" | "post-format" | (string & {});
  subtype: string;
}

/** Options for `WPClient.search`. */
export interface SearchOptions {
  type?: "post" | "term" | "post-format" | (string & {});
  subtype?: string | string[];
  per_page?: number;
  page?: number;
}

/** A page of results plus WordPress's pagination headers. */
export interface Paginated<T> {
  items: T[];
  total: number;
  totalPages: number;
  page: number;
}
