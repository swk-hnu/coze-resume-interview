# Vercel Deployment

This project is ready for public deployment through Vercel without exposing your Coze token in the browser.

## 1. Required environment variables

Set these in Vercel Project Settings -> Environment Variables:

- `COZE_WORKFLOW_ID`
- `COZE_WORKFLOW_TOKEN`
- `COZE_ACCESS_TOKEN`
- `COZE_API_BASE` (optional, default: `https://api.coze.cn`)

Notes:

- `COZE_WORKFLOW_ID` should point to your current working workflow.
- `COZE_ACCESS_TOKEN` can reuse the same value as `COZE_WORKFLOW_TOKEN` if your PAT also has file upload permission.

## 2. Deploy

Choose one of these paths:

1. Import the folder/repository into Vercel.
2. Add the environment variables above.
3. Click Deploy.

After deployment, Vercel will give you a public URL like:

- `https://your-project.vercel.app`

## 3. What changed

- The browser now prefers same-origin `/api/*` endpoints when they exist.
- Coze secrets stay on the server side.
- Local direct mode is still preserved for browser-only debugging.

## 4. Public behavior

When deployed with the env vars set:

- visitors do not need to fill in Token fields
- the Coze connection panel is hidden automatically
- resume upload and workflow calls go through the Vercel proxy
