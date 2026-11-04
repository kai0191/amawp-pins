# Connect AI assistants to Tackly (MCP)

Tackly's engine includes an **MCP server**. MCP (Model Context Protocol) is the open standard AI assistants use to
work with tools. Once connected, your assistant can research Pinterest keywords, read your blog posts, design pins
with Tackly templates, write SEO copy, score pins and schedule them inside the safety limits.

**You need your own Tackly engine first** (free, 5 minutes): see [ENGINE.md](ENGINE.md).

Your MCP URL is shown in Tackly → **Canva & AI → AI assistants**:

```
https://tackly-engine.YOUR-NAME.workers.dev/mcp/YOUR-ENGINE-KEY
```

Keep it private: it contains your engine key. You can also use `https://…/mcp` with the header
`Authorization: Bearer YOUR-ENGINE-KEY`.

## Clients

| Assistant | How to connect |
|---|---|
| **Claude (claude.ai / desktop)** | Settings → Connectors → Add custom connector → paste the MCP URL (no OAuth). |
| **Claude Code** | `claude mcp add --transport http tackly <MCP URL>` |
| **OpenAI Codex CLI** | In `~/.codex/config.toml`: `[mcp_servers.tackly]` `command = "npx"` `args = ["-y", "mcp-remote", "<MCP URL>"]` |
| **ChatGPT (developer mode)** | Settings → Apps & Connectors → Advanced → Developer mode, then create a connector with the MCP URL (no auth). |
| **Cursor / Windsurf / VS Code** | Add `{ "mcpServers": { "tackly": { "url": "<MCP URL>" } } }` to the MCP settings JSON. |
| **Anything else** | Streamable HTTP (JSON-RPC over POST). Stdio-only clients: `npx -y mcp-remote <MCP URL>`. |

## Tools

| Tool | What it does |
|---|---|
| `get_status` | Connected account, pin counts, today's quota and limits |
| `list_boards`, `create_board` | Manage boards (keyword-first names work best) |
| `keyword_research` | Ranked long-tail Pinterest keywords with intent (Pinterest, Google, Bing) |
| `seasonal_ideas` | Seasons whose Pinterest search window is open now |
| `pinterest_seo_tips` | Proven ranking practices |
| `seo_score_pin` | 0–100 Pinterest SEO score with fixes |
| `write_pin_copy` | AI title, description, alt text, board ideas |
| `page_info` | Reads a blog post: title, images, Rich Pins check |
| `generate_image_url` | Free AI image URL (Pollinations) |
| `list_templates` | Tackly templates, palettes and font pairings |
| `create_design_pin` | Pin from a Tackly template (rendered next time you open the Tackly app) |
| `create_image_pin` | Pin from any public image URL (ready to post) |
| `list_pins`, `update_pin`, `delete_pin` | Manage pins |
| `auto_schedule` | Spread drafts at natural times (max 10/day, link spreading, board rotation) |
| `publish_now` | Publish one pin (safety limits apply) |
| `pin_stats` | Impressions, saves, pin clicks, outbound clicks |

## Example prompts

- "Research Pinterest keywords for *budget bathroom makeover* and pick the best 5 long-tail keywords."
- "Read https://myblog.com/post and create 5 different Tackly design pins for it, each with SEO copy scoring 85+,
  then auto-schedule them over the next week at US peak times."
- "What should I pin this month for my home decor niche?"
- "Show my scheduled pins and fix any with a weak SEO score."

Template pins made by AI (`create_design_pin`) need the Tackly web app to turn them into images: just open
Tackly (Schedule page) once and it renders them automatically. Pins made with `create_image_pin` are ready right away.
