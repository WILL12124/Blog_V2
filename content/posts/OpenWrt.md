---
title: "Intro to OpenWrt"
date: "2026-06-21"
category: "electronics"
excerpt: "An introduction to OpenWrt for home network management"
tags: ["Network", "Router", "OpenWrt","VPN"]
---

![OpenWrt Logo](/images/OpenWrt_Logo.svg.png)

每个设备都要上网，每个设备都要装梯子软件，像ps5这种还根本装不了，家里老人反对在手机上装梯子怎么办？？？一个软路由解君愁！

> **TL;DR** - OpenWrt 是一个开源路由器操作系统，将其装到旧电脑/路由器上即可当路由器用。配合 OpenClash 等插件可以实现**全局翻墙，自动分流**，解决所有设备的翻墙烦恼。

**Reference** - [YouTube: 【从零开始】最详细的新手入门软路由指南](https://www.youtube.com/watch?v=JfSJmPFiL_s)

---

# Table of Contents
1. [What is OpenWrt?](#i-what-is-openwrt)
2. [Hardware Selection](#ii-hardware-selection)
3. [Installation](#iii-installation)
4. [Configuration](#iv-configuration)

## I. What is OpenWrt?
软路由可以理解为**可以安装软件的路由器**，市面上买来的成品路由器，功能相对固定，无法实现分流等复杂功能。而软路由则像电脑一样，可以自由的安装各种软件，实现各种各样的功能。而OpenWrt就是是其中一款开源的路由器操作系统，具有庞大的社区维护。

## II. Hardware Selection

软路由的硬件不局限于带天线的传统路由器，也可以是小主机、开发板，甚至是拥有多网口的闲置笔记本电脑。我选择的是**友善 R3S**，看中它的低功耗和高性价比。

![友善R3S](/images/IMG_2274.jpg)

## III. Installation

由于 OpenWrt 官方软件源较少，我选择了社区维护的第三方版本 **ImmortalWrt**，它在官方基础上预置了更完整的软件源，安装插件更方便。

### 下载固件

前往固件选择页面，根据自己的设备型号选择对应固件：

[ImmortalWrt 固件选择](https://bulianglin.com/g/aHR0cHM6Ly9maXJtd2FyZS1zZWxlY3Rvci5pbW1vcnRhbHdydC5vcmc)

![ImmortalWrt固件选择页面](/images/ImmortalWrt.png)

选择 **SQUASHFS** 格式下载（推荐，支持恢复出厂设置）。

### 使用rufus刷入tf卡

使用 [Rufus](https://bulianglin.com/g/aHR0cHM6Ly9ydWZ1cy5pZQ) 将固件写入 TF 卡：

1. 打开 Rufus，选择下载好的固件镜像
2. 目标设备选择 TF 卡，点击 **Start** 开始写入
3. 写入完成后将 TF 卡插入软路由卡槽

用网线连接电脑与软路由的 **LAN 口**，然后在浏览器访问 **192.168.1.1** 进入管理后台（默认无密码）。

## IV. Configuration

进入 **192.168.1.1** 管理后台后，配置主要分几个部分。

首先是关闭 IPv6，避免透明代理出现兼容问题。然后配置 WAN 口上网方式——光猫桥接模式下需要在 WAN 口填入宽带账号密码进行 PPPoE 拨号；路由模式下直接用 DHCP 自动获取即可。如果 LAN 口和 WAN 口 IP 网段冲突，还需要修改 LAN 口的 IP 地址。

软路由一般没有 WiFi，需要把家里原有的路由器改成 AP 模式（有线中继），接在软路由 LAN 口下面，这样其他设备连接原路由器的 WiFi 也能走软路由。

上网通了之后，在 **System → Software** 里安装代理插件（如 OpenClash），导入订阅节点，配置分流规则，开启后全屋设备自动翻墙，无需每台单独配置。

