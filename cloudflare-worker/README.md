# Cloudflare Worker - Thầy Minh AI Tutor

Backend bảo mật cho trang `AI Gợi Ý Giải Code`.

## Cách dễ nhất: Cloudflare Workers Builds + GitHub

1. Cloudflare Dashboard → **Workers & Pages** → **Create application**.
2. Chọn **Import a repository** và kết nối GitHub.
3. Chọn repo `vanminhk27/thayminhchuyentin`.
4. Worker name: `thayminh-ai-tutor`.
5. Branch tạm để test: `feature/ai-code-tutor`.
6. Root directory: `cloudflare-worker`.
7. Deploy command: `npx wrangler deploy`.
8. Deploy lần đầu để tạo Worker.
9. Vào **Settings → Variables & Secrets → Runtime** và tạo Secret:
   - Name: `GEMINI_API_KEY`
   - Value: API key Gemini **mới**.
10. Redeploy. Kiểm tra `/health` phải trả JSON có `"ok": true`.

Cloudflare sẽ cấp URL dạng:
`https://thayminh-ai-tutor.<subdomain>.workers.dev`

Sau khi có URL này, cập nhật frontend để gọi:
`https://...workers.dev/api/ai-tutor`.

## Chạy bằng Wrangler
```bash
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npm test
npm run deploy
```

Không commit API key vào repository.

Model mặc định: `gemini-3.8-flash`, có thể đổi bằng `GEMINI_MODEL`.
CORS mặc định chỉ cho phép `https://thayminhchuyentin.io.vn` và localhost khi phát triển.
