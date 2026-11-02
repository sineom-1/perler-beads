# 拼豆图纸生成器

上传任意图片，在浏览器里生成可打印的拼豆底稿和采购清单。图像处理全部发生在本地 Canvas 中，没有服务端接口。

在线使用：<https://sineom-1.github.io/perler-beads/>

## 来源与许可

本仓库是 [Zippland/perler-beads](https://github.com/Zippland/perler-beads) 的**独立衍生作品**，不是 GitHub fork。

- 原始版权归 [Zippland](https://github.com/Zippland)。
- 色号对照（291 色，映射到 MARD / COCO / 漫漫 / 盼盼 / 咪小窝）改编自上游 `src/app/colorSystemMapping.json`。
- 主色提取、相似色区域合并、边缘洪水填充去背景，以及带色号的图纸导出，改编自上游实现。
- 72 / 96 / 120 / 144 色板成员使用上游的套装色号列表。上游把白珠 T1 加进了 96、120、144，所以实际数量是 97、121、145。本仓库不再提供 168 色档：公开色卡没有这一档。MARD 的 T1 是透明豆，自动取色时会跳过它。
- 许可证为 [GNU AGPL-3.0](./LICENSE)。原始项目的版权声明保留在许可证文件顶部。请不要把这些代码包装成闭源商业产品。

## 功能

- 上传 JPG、PNG、GIF、WebP，按网格提取主色或平均色，再映射到所选色板
- 品牌色号：MARD、COCO、漫漫、盼盼、咪小窝
- 色板规格：72 / 96 / 120 / 144 / 291
- 横纵网格可调，默认可锁定图片比例
- 相似色按阈值做四连通区域合并（0 为不合并）
- 从边缘出现最多的颜色做洪水填充，去掉外部背景，可单步撤销
- 排除一种颜色后，把它重映射到仍保留的最接近色号；恢复时按原图重算
- 手动逐格上色、橡皮擦、连通擦除、撤销
- 导出带色号、坐标和网格线的 PNG 图纸，可附带用量表
- 单独导出采购清单 PNG，或复制文本清单
- 色差可选 Oklab（与上游阈值手感一致）或 CIEDE2000
- 界面为简体中文，手机和桌面都可以操作

大图会按行让出主线程，避免页面卡住。当前没有把计算放进 Web Worker。

## 本地开发

```bash
npm install
npm run dev
```

开发服务器带有 `basePath: /perler-beads`，请打开 `http://localhost:3000/perler-beads/`。

```bash
npm run check
npm run build
```

`npm run build` 使用 Next.js `output: 'export'`，静态文件在 `out/`。本地查看导出结果时，需要让站点挂在 `/perler-beads/` 下面，例如把 `out/` 放到某个目录的 `perler-beads/` 子文件夹再启动静态服务器。

## GitHub Pages

推送到 `main` 会运行 `.github/workflows/deploy.yml`（`actions/configure-pages`、`actions/upload-pages-artifact`、`actions/deploy-pages`）。Pages 源应设为 GitHub Actions。`next.config.ts` 固定了 `basePath` 与 `assetPrefix` `/perler-beads`，图片 `unoptimized`，`public/.nojekyll` 会一并导出。
