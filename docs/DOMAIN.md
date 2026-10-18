# Getting pokesurvivor.com up and running

The domain is bought on **Cloudflare** and doesn't point anywhere yet.
Everything on the code side is ready: only the steps marked **YOU** are left
(the ones that need your account), plus the final step, which I do when you tell me.

Status as of 10-10-2026:

- [x] Domain bought on Cloudflare (Cloudflare DNS servers active).
- [x] `pokesurvivor.com` and `www.pokesurvivor.com` added to Firebase → authorised
      domains (Google sign-in will work from day one).
- [x] Spanish and English pages, sitemap, robots, 404 and share image,
      generated and tested (Lighthouse: SEO 100, accessibility 100).
      (18-10-2026: the game became English-only; the Spanish pages and the scripts that
      generated the pages, including `tools/activate_domain.sh`, were removed.)
- [x] Final-step script rehearsed: `tools/activate_domain.sh` (since removed).
- [x] Step 1 · DNS on Cloudflare (**YOU**)
- [x] Step 2 · Verify the domain on GitHub (**YOU**, recommended)
- [x] Step 3 · Final step (**ME**): done on 10-10-2026, with HTTPS
- [ ] Step 4 · Google Search Console and Bing (**YOU**)

---

## Step 1 · DNS on Cloudflare (YOU, 5 minutes)

1. Go to <https://dash.cloudflare.com> → choose **pokesurvivor.com** →
   left menu **DNS → Records**.
2. Click **Add record** and create these 9 records. On all of them, the
   **Proxy status** switch must be left on **DNS only** (**grey** cloud, not orange).

   | Type | Name | IPv4 / IPv6 / Target |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | AAAA | `@` | `2606:50c0:8000::153` |
   | AAAA | `@` | `2606:50c0:8001::153` |
   | AAAA | `@` | `2606:50c0:8002::153` |
   | AAAA | `@` | `2606:50c0:8003::153` |
   | CNAME | `www` | `jpter78.github.io` |

   These are the GitHub Pages addresses, which is where the game lives.

> **Why the grey cloud:** with the orange cloud, Cloudflare sits in the middle and
> GitHub can't create the HTTPS certificate (the padlock). Also, with Cloudflare's
> "Flexible" SSL mode the site goes into a redirect loop. With grey everything
> works first time; later on the orange one can be enabled with SSL
> **Full (strict)** if it's ever useful, but it isn't needed.

Optional and free in the same panel:
- **DNSSEC** (DNS menu → Settings → Enable DNSSEC): protects the domain against
  spoofing.
- **Email Routing**: a `contacto@pokesurvivor.com` address that forwards to your Gmail,
  if you want an email address with the game's name.

When it's done, tell me **"the DNS is done"** and I'll check it looks right from outside
(it usually takes from 5 minutes to 1 hour).

## Step 2 · Verify the domain on GitHub (YOU, recommended, 3 minutes)

Protects the domain: stops another GitHub account from using pokesurvivor.com.

1. Go to <https://github.com/settings/pages> (with the JPTER78 account).
2. **Add a domain** → type `pokesurvivor.com` → **Add domain**.
3. GitHub shows you a **TXT** record: a name like
   `_github-pages-challenge-JPTER78` and a long value.
4. On Cloudflare → DNS → Records → **Add record**: Type **TXT**, Name the one GitHub
   gave you (without `.pokesurvivor.com` at the end), Content the long value.
5. Go back to GitHub and click **Verify**. If it says no, wait a few minutes and try again.

## Step 3 · Final step (ME)

Once the DNS works, I do all of it:

1. `bash tools/activate_domain.sh`: builds the game with SEO, regenerates the
   pages, creates the `CNAME` file and prepares the commit (it checks that no
   private data slips in).
2. I push it to GitHub and set the `pokesurvivor.com` domain in GitHub Pages.
3. I wait for GitHub to create the certificate and turn on **Enforce HTTPS**.
4. I check in a real browser: the site, `www.` → without `www`, the old github.io
   address → the new one, English at `/en/`, signing in with an account and with Google,
   the leaderboard and co-op.
5. I set `https://pokesurvivor.com` as the GitHub repository's website.

**Watch out for guest saves:** they are stored in the browser and tied to the
address. Anyone playing as a guest on `jpter78.github.io` won't see that save on
`pokesurvivor.com` (registered accounts will, because they're in the cloud). If anyone
asks: they should create an account before the switch.

## Step 4 · Google Search Console and Bing (YOU, after step 3)

1. <https://search.google.com/search-console> → **Add property** →
   **Domain** → `pokesurvivor.com`.
2. Since the domain is on Cloudflare, Google offers to **verify with Cloudflare**
   automatically: accept and you're done (if not, it gives you a TXT record to add
   as in step 2).
3. **Sitemaps** menu → type `sitemap.xml` → **Submit**.
4. **URL inspection** menu → `https://pokesurvivor.com/` → **Request
   indexing**. Repeat with `https://pokesurvivor.com/en/guide/` and
   `https://pokesurvivor.com/en/pokedex/`.
5. Bing (and with it DuckDuckGo and Ecosia): <https://www.bing.com/webmasters> →
   **Import from Google Search Console**.

Google takes from a few days to a couple of weeks to start showing the site.

## Afterwards

- Change the link in the YouTube trailer's description, on Ko-fi and wherever you
  have shared it.
- What helps rankings most from here on is in [SEO.md](SEO.md),
  section 3 (links from YouTube, itch.io, Reddit, Discord...).
