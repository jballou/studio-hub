# Figma setup ("Choose frames" with thumbnails)

Optional. Without it, people still submit Figma frames by pasting frame links; they just can't browse a file's frames.

1. Use a dedicated Figma account for the app (for example "Brand Creative Hub", not a person's account), so it survives people leaving.
2. In Figma: Settings > Security > Personal access tokens > Generate new token. Give it only the **File content: Read** scope. Pick the longest expiry and put a renewal reminder in the team calendar.
3. Add that account to the files or team spaces people will submit from (view access is enough). The picker can only list files this account can open.
4. Put the token in Vercel yourself (never in chat), then redeploy:
   ```bash
   vercel env add FIGMA_ACCESS_TOKEN production
   ```
5. In the app, paste a Figma file link on Submit for feedback > Figma frame, then **Choose frames from this file**.

Notes
- Any signed-in person can list frames and thumbnails of any file this account can open, if they have the link. Keep the account out of private spaces.
- Thumbnails are temporary Figma image links; they are only used in the picker and the batch list, and are not stored.
- If the token expires, the picker shows a message and people fall back to pasting frame links.
