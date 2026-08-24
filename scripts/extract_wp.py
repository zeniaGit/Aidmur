#!/usr/bin/env python3
import os
import re
import json
import urllib.parse
from html import unescape

SQL_PATH = "/Users/josetorrano/Downloads/WEB AIDMUR/ygpqs39z_aidmur.sql"
OUTPUT_DIR = "/Users/josetorrano/.gemini/antigravity-ide/scratch/aidmur-web/src/data"

os.makedirs(OUTPUT_DIR, exist_ok=True)

def parse_table_rows(sql_text, table_name):
    pattern = rf"INSERT INTO [`\x27]?{table_name}[`\x27]?[^\n]*VALUES\s*(.*?);(?=\s*(?:INSERT|--|/\*|\Z))"
    blocks = re.findall(pattern, sql_text, re.DOTALL | re.IGNORECASE)
    all_rows = []
    
    for val_text in blocks:
        rows = []
        current_row = []
        current_val = []
        in_string = False
        escape = False
        in_row = False
        i = 0
        n = len(val_text)
        while i < n:
            c = val_text[i]
            if not in_row:
                if c == "(":
                    in_row = True
                    current_row = []
                    current_val = []
                    in_string = False
                    escape = False
                i += 1
                continue
            
            if in_string:
                if escape:
                    if c == 'n':
                        current_val.append('\n')
                    elif c == 'r':
                        current_val.append('\r')
                    elif c == 't':
                        current_val.append('\t')
                    elif c == '\\':
                        current_val.append('\\')
                    elif c == "'":
                        current_val.append("'")
                    elif c == '"':
                        current_val.append('"')
                    elif c == '0':
                        current_val.append('\0')
                    else:
                        current_val.append(c)
                    escape = False
                elif c == "\\":
                    escape = True
                elif c == "\x27":
                    if i + 1 < n and val_text[i+1] == "\x27":
                        current_val.append("\x27")
                        i += 1
                    else:
                        in_string = False
                else:
                    current_val.append(c)
            else:
                if c == "\x27":
                    in_string = True
                elif c == ",":
                    val = "".join(current_val).strip()
                    current_row.append(val)
                    current_val = []
                elif c == ")":
                    val = "".join(current_val).strip()
                    current_row.append(val)
                    rows.append(current_row)
                    current_row = []
                    current_val = []
                    in_row = False
                else:
                    current_val.append(c)
            i += 1
        all_rows.extend(rows)
    return all_rows

def clean_html_content(content):
    if not content:
        return ""
    # Normalize image paths
    content = re.sub(r'https?://(?:www\.)?aidmur\.org/wp-content/uploads/', '/uploads/', content)
    content = re.sub(r'/wp-content/uploads/', '/uploads/', content)
    content = re.sub(r'http://aidmur\.com/wp-content/uploads/', '/uploads/', content)
    content = re.sub(r'https?://(?:www\.)?aidmur\.org/\?p=(\d+)', r'/articulo/\1', content)
    return content

def wpautop(text):
    if not text:
        return ""
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    # If the text is purely plain text without paragraphs, format into paragraphs
    blocks = re.split(r'\n\s*\n', text)
    formatted = []
    for b in blocks:
        b = b.strip()
        if not b:
            continue
        # If block starts with HTML block tags, keep as is
        if re.match(r'^\s*<(?:p|div|h[1-6]|ul|ol|table|blockquote|figure|iframe|img|section|article)', b, re.IGNORECASE):
            formatted.append(b)
        else:
            b_clean = b.replace('\n', '<br />')
            formatted.append(f'<p>{b_clean}</p>')
    return '\n\n'.join(formatted)

def extract_excerpt(content, max_chars=200):
    text = re.sub(r'<[^>]+>', ' ', content)
    text = re.sub(r'\[[^\]]+\]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) > max_chars:
        return text[:max_chars].rsplit(' ', 1)[0] + '...'
    return text

print("Reading SQL file...")
with open(SQL_PATH, "r", encoding="utf-8", errors="ignore") as f:
    sql = f.read()

print("Parsing tables...")
terms_rows = parse_table_rows(sql, "wp_terms")
term_tax_rows = parse_table_rows(sql, "wp_term_taxonomy")
term_rel_rows = parse_table_rows(sql, "wp_term_relationships")
users_rows = parse_table_rows(sql, "wp_users")
posts_rows = parse_table_rows(sql, "wp_posts")
postmeta_rows = parse_table_rows(sql, "wp_postmeta")

# Build terms map
terms_map = {}
for r in terms_rows:
    if len(r) >= 3:
        raw_slug = urllib.parse.unquote(r[2]).strip()
        raw_slug = raw_slug.replace('‐', '-').replace('–', '-').replace('—', '-')
        raw_slug = re.sub(r'[^a-zA-Z0-9\-_]', '-', raw_slug)
        raw_slug = re.sub(r'-+', '-', raw_slug).strip('-')
        terms_map[r[0]] = {"name": unescape(r[1]), "slug": raw_slug or f"term-{r[0]}"}

# term_taxonomy: term_taxonomy_id -> {term_id, taxonomy}
taxonomy_map = {}
for r in term_tax_rows:
    if len(r) >= 3:
        tt_id = r[0]
        term_id = r[1]
        taxonomy = r[2]
        if term_id in terms_map:
            taxonomy_map[tt_id] = {
                "name": terms_map[term_id]["name"],
                "slug": terms_map[term_id]["slug"],
                "taxonomy": taxonomy
            }

# term_relationships: object_id (post_id) -> list of tax items
post_terms_map = {}
for r in term_rel_rows:
    if len(r) >= 2:
        post_id = r[0]
        tt_id = r[1]
        if tt_id in taxonomy_map:
            item = taxonomy_map[tt_id]
            if post_id not in post_terms_map:
                post_terms_map[post_id] = {"categories": [], "tags": []}
            if item["taxonomy"] == "category":
                if item["name"] not in [c["name"] for c in post_terms_map[post_id]["categories"]]:
                    post_terms_map[post_id]["categories"].append({"name": item["name"], "slug": item["slug"]})
            elif item["taxonomy"] == "post_tag":
                if item["name"] not in [t["name"] for t in post_terms_map[post_id]["tags"]]:
                    post_terms_map[post_id]["tags"].append({"name": item["name"], "slug": item["slug"]})

# Users: ID -> display_name
users_map = {}
for r in users_rows:
    if len(r) >= 9:
        user_id = r[0]
        display_name = r[8] if len(r) > 8 else r[1]
        users_map[user_id] = display_name or "AIDMUR"

# Postmeta: post_id -> {_thumbnail_id, ...}
post_thumbnails = {}
for r in postmeta_rows:
    if len(r) >= 4:
        pid = r[1]
        mkey = r[2]
        mval = r[3]
        if mkey == "_thumbnail_id":
            post_thumbnails[pid] = mval

# Attachments: ID -> URL / guid and post_parent -> list of attachments
attachments_map = {}
attachments_by_parent = {}
for r in posts_rows:
    if len(r) >= 21 and r[20] == "attachment":
        att_id = r[0]
        parent_id = r[17]
        guid = clean_html_content(r[18])
        attachments_map[att_id] = guid
        if parent_id not in attachments_by_parent:
            attachments_by_parent[parent_id] = []
        attachments_by_parent[parent_id].append({"id": att_id, "url": guid, "title": unescape(r[5])})

# Function to render gallery shortcodes
def process_gallery_shortcodes(content, post_id):
    def replacer(match):
        shortcode = match.group(0)
        ids_match = re.search(r'ids=["\x27]([\d,]+)["\x27]', shortcode)
        img_urls = []
        if ids_match:
            ids = [i.strip() for i in ids_match.group(1).split(",") if i.strip()]
            for i in ids:
                if i in attachments_map:
                    img_urls.append(attachments_map[i])
        else:
            parent_atts = attachments_by_parent.get(str(post_id), [])
            img_urls = [a["url"] for a in parent_atts]

        if not img_urls:
            return ""

        gallery_html = ['<div class="gallery-container"><div class="gallery-grid">']
        for url in img_urls:
            gallery_html.append(
                f'<div class="gallery-item">'
                f'<a href="{url}" target="_blank" rel="noopener noreferrer">'
                f'<img src="{url}" alt="Galería de imágenes AIDMUR" loading="lazy" />'
                f'</a>'
                f'</div>'
            )
        gallery_html.append('</div></div>')
        return "\n".join(gallery_html)

    return re.sub(r'\[gallery[^\]]*\]', replacer, content)

posts = []
pages = []

for r in posts_rows:
    if len(r) < 21:
        continue
    post_id = r[0]
    author_id = r[1]
    date = r[2]
    content = clean_html_content(r[4])
    title = unescape(r[5])
    excerpt = r[6]
    status = r[7]
    slug = r[11]
    parent = r[17]
    menu_order = r[19]
    post_type = r[20]

    if status != "publish" or not title:
        continue

    # Decode percent-encoded slugs
    if slug:
        slug = urllib.parse.unquote(slug).strip()
        slug = slug.replace('‐', '-').replace('–', '-').replace('—', '-')
        slug = re.sub(r'[^a-zA-Z0-9\-_]', '-', slug)
        slug = re.sub(r'-+', '-', slug).strip('-')

    if not slug:
        slug = f"item-{post_id}"

    # 1. Apply wpautop first on raw text
    content = wpautop(content)
    # 2. Then replace gallery shortcodes with clean HTML block
    content = process_gallery_shortcodes(content, post_id)
    # 3. Clean any accidental <p><div or <div...</p>
    content = re.sub(r'<p>\s*(<div[^>]*>.*?</div>)\s*</p>', r'\1', content, flags=re.DOTALL)
    content = re.sub(r'<p>\s*(<div[^>]*>)', r'\1', content)
    content = re.sub(r'(</div>)\s*</p>', r'\1', content)

    # Get thumbnail
    thumb_url = None
    if post_id in post_thumbnails:
        thumb_id = post_thumbnails[post_id]
        if thumb_id in attachments_map:
            thumb_url = attachments_map[thumb_id]

    if not thumb_url:
        img_match = re.search(r'<img[^>]+src=["\x27](/uploads/[^"\x27]+)["\x27]', content)
        if img_match:
            thumb_url = img_match.group(1)

    cats = post_terms_map.get(post_id, {}).get("categories", [])
    tags = post_terms_map.get(post_id, {}).get("tags", [])

    if not excerpt:
        excerpt = extract_excerpt(content)

    author = users_map.get(author_id, "AIDMUR")

    item = {
        "id": int(post_id),
        "title": title,
        "slug": slug,
        "date": date,
        "author": author,
        "excerpt": excerpt,
        "content": content,
        "categories": cats,
        "tags": tags,
        "featured_image": thumb_url
    }

    if post_type == "post":
        posts.append(item)
    elif post_type == "page":
        item["menu_order"] = int(menu_order) if menu_order.isdigit() else 0
        pages.append(item)

# Ensure unique slugs
seen_post_slugs = set()
for p in posts:
    if p["slug"] in seen_post_slugs:
        p["slug"] = f"{p['slug']}-{p['id']}"
    seen_post_slugs.add(p["slug"])

seen_page_slugs = set()
for p in pages:
    if p["slug"] in seen_page_slugs:
        p["slug"] = f"{p['slug']}-{p['id']}"
    seen_page_slugs.add(p["slug"])

posts.sort(key=lambda x: x["date"], reverse=True)
pages.sort(key=lambda x: x["menu_order"])

category_counts = {}
for p in posts:
    for cat in p["categories"]:
        cslug = cat["slug"]
        if cslug not in category_counts:
            category_counts[cslug] = {"name": cat["name"], "slug": cslug, "count": 0}
        category_counts[cslug]["count"] += 1

categories_list = sorted(category_counts.values(), key=lambda x: x["count"], reverse=True)

with open(os.path.join(OUTPUT_DIR, "posts.json"), "w", encoding="utf-8") as f:
    json.dump(posts, f, ensure_ascii=False, indent=2)

with open(os.path.join(OUTPUT_DIR, "pages.json"), "w", encoding="utf-8") as f:
    json.dump(pages, f, ensure_ascii=False, indent=2)

with open(os.path.join(OUTPUT_DIR, "categories.json"), "w", encoding="utf-8") as f:
    json.dump(categories_list, f, ensure_ascii=False, indent=2)

print(f"Extraction successful!")
print(f"- Exported {len(posts)} posts")
print(f"- Exported {len(pages)} pages")
print(f"- Exported {len(categories_list)} categories")
