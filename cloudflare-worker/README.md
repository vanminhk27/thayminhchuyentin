# Cloudflare Worker - Thầy Minh AI Tutor

Backend bảo mật cho trang `AI Gợi Ý Giải Code`.

## Triển khai
1. `npm install`
2. `npx wrangler login`
3. `npx wrangler secret put GEMINI_API_KEY` và dán **key mới** vào terminal.
4. `npm test`
5. `npm run deploy`

Sau deploy, Cloudflare trả về URL dạng `https://thayminh-ai-tutor.<subdomain>.workers.dev`.
Dùng URL đó trong frontend. Không commit API key vào repository.

Model mặc định: `gemini-3.8-flash`, có thể đổi bằng biến `GEMINI_MODEL`.
CORS mặc định chỉ cho phép `https://thayminhchuyentin.io.vn` và localhost khi phát triển.
