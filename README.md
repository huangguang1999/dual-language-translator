# Dualingo

一个轻量的双向即时翻译网页。选择左右两种语言后，可以从任意一侧输入，另一侧会自动显示对应翻译。

## 功能

- 左右两侧都可以作为输入端，约 0.5 秒后自动翻译
- 支持 12 种常用语言
- 一键交换语言与文本
- 一键复制和清空
- 适配桌面与移动端
- 输入限制为 500 UTF-8 bytes，与 MyMemory API 的单次请求限制一致

## 本地运行

```bash
npm install
npm run dev
```

运行完整检查：

```bash
npm run check
```

## 技术实现

- React 19 + TypeScript + Vite
- 翻译服务：[MyMemory REST API](https://mymemory.translated.net/doc/spec.php)
- 部署平台：GitHub Pages

## 隐私说明

输入内容会发送给 MyMemory 完成翻译，请勿输入密码、密钥或其他敏感信息。
