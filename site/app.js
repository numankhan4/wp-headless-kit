// Uses the library build from ./lib (copied from dist/src by the Pages workflow).
import {
  WPClient,
  WPError,
  toQueryString,
  yoastToMetadata,
  parseBlocks,
  renderBlocks,
  passthroughHtml,
  decodeEntities,
  toExcerpt,
  readingTime,
  escapeHtml,
} from "./lib/index.js";

const REPO = "numankhan4/wp-headless-kit";
const PER_PAGE = 8;
const $ = (sel) => document.querySelector(sel);

/* ---------------- Copy button ---------------- */
document.querySelectorAll("[data-copy]").forEach((btn) =>
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = "Copy"), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }),
);

/* ---------------- Playground ---------------- */
const state = { client: null, page: 1, totalPages: 1, posts: [], selected: null, search: "" };

function iframeDoc(bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank">
<style>body{font:15px/1.65 Georgia,serif;color:#1e293b;margin:18px;max-width:720px}img,video,iframe{max-width:100%;height:auto}
h1,h2,h3{font-family:Inter,system-ui,sans-serif;line-height:1.25}pre{white-space:pre-wrap}figure{margin:1em 0}
.wp-block-columns{display:flex;gap:16px}.wp-block-column{flex:1}.cta{display:inline-block;background:#0369a1;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-family:system-ui}</style>
</head><body>${bodyHtml}</body></html>`;
}

function setCodeLine(baseUrl, params) {
  $("#code-line").innerHTML =
    `<span class="k">GET</span> ${escapeHtml(baseUrl.replace(/\/+$/, ""))}/wp-json/wp/v2/posts${escapeHtml(toQueryString(params))}`;
}

async function loadPosts() {
  const btn = $("#fetch-form button[type=submit]");
  const list = $("#post-list");
  const params = { per_page: PER_PAGE, page: state.page, _embed: true, ...(state.search ? { search: state.search } : {}) };
  setCodeLine($("#site-url").value, params);
  btn.disabled = true;
  list.innerHTML = `<li class="empty">Loading…</li>`;
  try {
    const res = await state.client.getPosts(params);
    state.posts = res.items;
    state.totalPages = res.totalPages;
    $("#pagination").textContent = `${res.total} posts · page ${res.page}/${res.totalPages}`;
    renderList();
    if (res.items[0]) selectPost(res.items[0].id);
  } catch (err) {
    const msg =
      err instanceof WPError
        ? `WordPress returned ${err.status}${err.code ? ` (${err.code})` : ""}: ${err.message}`
        : "Couldn't reach the site. It may block cross-origin requests (CORS), have the REST API disabled, or the URL may be wrong.";
    list.innerHTML = `<li class="error">${escapeHtml(msg)}</li>`;
    $("#pagination").textContent = "";
  } finally {
    btn.disabled = false;
    $("#prev").disabled = state.page <= 1;
    $("#next").disabled = state.page >= state.totalPages;
  }
}

function renderList() {
  const list = $("#post-list");
  if (!state.posts.length) {
    list.innerHTML = `<li class="empty">No posts found.</li>`;
    return;
  }
  list.innerHTML = state.posts
    .map((p) => {
      const date = new Date(p.date).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
      return `<li class="item" data-id="${p.id}"><button type="button">
        <span class="t">${escapeHtml(decodeEntities(p.title.rendered))}</span>
        <span class="m">${date} · ${readingTime(p.content.rendered)} min read</span>
        <span class="e">${escapeHtml(toExcerpt(p.excerpt.rendered, 140))}</span>
      </button></li>`;
    })
    .join("");
  list.querySelectorAll("li.item").forEach((li) => li.addEventListener("click", () => selectPost(Number(li.dataset.id))));
}

function selectPost(id) {
  const post = state.posts.find((p) => p.id === id);
  if (!post) return;
  state.selected = post;
  document.querySelectorAll("#post-list li.item").forEach((li) => li.classList.toggle("sel", Number(li.dataset.id) === id));

  const title = escapeHtml(decodeEntities(post.title.rendered));
  const image = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  const author = post._embedded?.author?.[0]?.name;
  const hero = image ? `<img src="${escapeHtml(image)}" alt="">` : "";
  $("#tab-preview").innerHTML = `
    <h3>${title}</h3>
    <div class="post-meta">${author ? `${escapeHtml(author)} · ` : ""}${readingTime(post.content.rendered)} min read · <a href="${escapeHtml(post.link)}" target="_blank" rel="noopener">${escapeHtml(post.link)}</a></div>
    <iframe sandbox="allow-popups" title="Post preview"></iframe>`;
  $("#tab-preview iframe").srcdoc = iframeDoc(hero + post.content.rendered);

  const meta = yoastToMetadata(post.yoast_head_json, {
    rewriteOrigin: { from: new URL(post.link).origin, to: "https://your-frontend.example" },
  });
  $("#tab-seo").innerHTML = post.yoast_head_json
    ? `<div class="note">Output of <code>yoastToMetadata(post.yoast_head_json, { rewriteOrigin })</code>. You can return this directly from Next.js <code>generateMetadata()</code>. URLs are rewritten to your front-end domain.</div><pre class="json">${escapeHtml(JSON.stringify(meta, null, 2))}</pre>`
    : `<p class="empty">This site doesn't expose <code>yoast_head_json</code> because Yoast SEO isn't installed. Try the <b>Yoast</b> example above.</p>`;

  const { _embedded, _links, content, ...rest } = post;
  const trimmed = { ...rest, content: { rendered: content.rendered.slice(0, 400) + (content.rendered.length > 400 ? "…" : "") } };
  $("#tab-json").innerHTML = `<pre class="json">${escapeHtml(JSON.stringify(trimmed, null, 2))}</pre>`;
}

document.querySelectorAll(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    document.querySelectorAll(".tab-body").forEach((b) => b.classList.toggle("hidden", b.id !== `tab-${tab.dataset.tab}`));
  }),
);

function connect() {
  const url = $("#site-url").value.trim();
  if (!url) return;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.url === url));
  try {
    state.client = new WPClient({ baseUrl: url });
  } catch (err) {
    $("#post-list").innerHTML = `<li class="error">${escapeHtml(String(err.message))}</li>`;
    return;
  }
  state.page = 1;
  state.search = $("#search").value.trim();
  loadPosts();
}

$("#fetch-form").addEventListener("submit", (e) => {
  e.preventDefault();
  connect();
});
document.querySelectorAll(".chip").forEach((chip) =>
  chip.addEventListener("click", () => {
    $("#site-url").value = chip.dataset.url;
    connect();
  }),
);
$("#prev").addEventListener("click", () => {
  if (state.page > 1) { state.page--; loadPosts(); }
});
$("#next").addEventListener("click", () => {
  if (state.page < state.totalPages) { state.page++; loadPosts(); }
});

/* ---------------- Blocks ---------------- */
const SAMPLE = `<!-- wp:heading {"level":2} -->
<h2>Hello from Gutenberg</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>This markup is what WordPress stores in <code>post_content</code>. Edit it and the tree updates live.</p>
<!-- /wp:paragraph -->

<!-- wp:columns -->
<div class="wp-block-columns"><!-- wp:column -->
<div class="wp-block-column"><!-- wp:paragraph -->
<p><strong>Left column</strong>: nested blocks are parsed into a tree.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column"><!-- wp:paragraph -->
<p><strong>Right column</strong>: attributes arrive as JSON.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->

<!-- wp:acme/cta {"href":"https://github.com/numankhan4/wp-headless-kit","label":"Star on GitHub"} /-->`;

function treeHtml(blocks) {
  if (!blocks.length) return "";
  return `<ul>${blocks
    .map((b) => {
      const name = b.blockName
        ? `<span class="bn">${escapeHtml(b.blockName)}</span>`
        : `<span class="bn free">freeform html</span>`;
      const attrs = Object.keys(b.attrs).length ? `<span class="ba">${escapeHtml(JSON.stringify(b.attrs))}</span>` : "";
      return `<li>${name}${attrs}${treeHtml(b.innerBlocks)}</li>`;
    })
    .join("")}</ul>`;
}

function countBlocks(blocks) {
  return blocks.reduce((n, b) => n + (b.blockName ? 1 : 0) + countBlocks(b.innerBlocks), 0);
}

function updateBlocks() {
  const blocks = parseBlocks($("#blocks-input").value);
  $("#block-tree").innerHTML = treeHtml(blocks) || `<p class="empty">No blocks.</p>`;
  $("#block-count").textContent = `${countBlocks(blocks)} blocks`;
  const html = renderBlocks(blocks, {
    renderers: {
      "acme/cta": (b) =>
        `<p><a class="cta" href="${escapeHtml(String(b.attrs.href ?? "#"))}">${escapeHtml(String(b.attrs.label ?? "Learn more"))}</a></p>`,
    },
    fallback: passthroughHtml,
  }).join("");
  $("#blocks-preview").srcdoc = iframeDoc(html);
}

$("#blocks-input").value = SAMPLE;
let t;
$("#blocks-input").addEventListener("input", () => {
  clearTimeout(t);
  t = setTimeout(updateBlocks, 150);
});
updateBlocks();

/* ---------------- Activity (public GitHub API, no auth) ---------------- */
function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  const units = [["year", 31536000], ["month", 2592000], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [u, sec] of units) if (s >= sec) return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-Math.floor(s / sec), u);
  return "just now";
}

async function loadActivity() {
  const list = $("#pr-list");
  try {
    const [prsRes, searchRes, issuesRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${REPO}/pulls?state=all&per_page=8&sort=created&direction=desc`),
      fetch(`https://api.github.com/search/issues?q=repo:${REPO}+is:pr+is:merged&per_page=1`),
      fetch(`https://api.github.com/search/issues?q=repo:${REPO}+is:issue+is:open+label:roadmap&per_page=1`),
    ]);
    if (searchRes.ok) $("#stat-prs").textContent = (await searchRes.json()).total_count;
    if (issuesRes.ok) $("#stat-open").textContent = (await issuesRes.json()).total_count;
    if (!prsRes.ok) throw new Error(String(prsRes.status));
    const prs = await prsRes.json();
    if (!prs.length) {
      list.innerHTML = `<li class="empty">The first automated PR will appear here after the next daily run.</li>`;
      return;
    }
    list.innerHTML = prs
      .map((pr) => {
        const status = pr.merged_at ? "merged" : pr.state === "open" ? "open" : "closed";
        const when = pr.merged_at ?? pr.created_at;
        return `<li class="item"><span class="badge ${status}">${status}</span>
          <a href="${escapeHtml(pr.html_url)}" target="_blank" rel="noopener">${escapeHtml(pr.title)}</a>
          <span class="when">#${pr.number} · ${timeAgo(when)}</span></li>`;
      })
      .join("");
  } catch {
    list.innerHTML = `<li class="empty">Couldn't load activity (GitHub API rate limit). <a href="https://github.com/${REPO}/pulls?q=is%3Apr">View on GitHub →</a></li>`;
  }
}
loadActivity();
connect();
