# 第三方软件声明

## FFmpeg

本软件通过独立子进程调用 FFmpeg，用于在用户设备本地合成 MP4，不会把素材上传到外部服务。

- FFmpeg 版本：6.1.1 essentials build
- 二进制提供方：Gyan Doshi，`https://www.gyan.dev/ffmpeg/builds/`
- FFmpeg 项目：`https://ffmpeg.org/`
- 对应源代码：`https://github.com/FFmpeg/FFmpeg/tree/n6.1.1`
- 打包工具：`ffmpeg-static 5.3.0`，`https://github.com/eugeneware/ffmpeg-static`
- 当前二进制配置包含 GPL 与 GPLv3 组件；再分发时必须遵守对应许可证。

安装包同时附带 `ffmpeg-static` 的 GPLv3 许可证文本。FFmpeg 及其依赖的版权归各自作者所有。
