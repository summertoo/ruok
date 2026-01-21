# 网络切换功能使用说明

## 概述

前端应用现在支持在测试网（Testnet）、主网（Mainnet）和开发网（Devnet）之间自由切换。

The frontend application now supports seamless switching between Testnet, Mainnet, and Devnet. Users can easily switch networks through a dropdown menu located in the top-right corner of the interface.

## 功能特性

1. **网络选择器**：在页面右上角添加了一个下拉菜单，可以选择不同的网络
2. **自动切换**：选择网络后会自动切换所有相关的服务和配置
3. **数据刷新**：切换网络后会自动清空本地状态并重新获取新网络的数据
4. **视觉指示**：网络选择器旁边有一个彩色圆点，指示当前网络类型：
   - 绿色：主网（Mainnet）
   - 黄色：测试网（Testnet）
   - 蓝色：开发网（Devnet）

## 配置要求

在 `.env` 文件中配置不同网络的合约地址：

```env
# Sui Network Configuration
VITE_SUI_NETWORK=testnet

# Contract Configuration
VITE_TESTNET_PACKAGE_ID=0x81baeee9f2bb6b4de75e4f9cae9575f136393482713038b2a443f3a603012b80
VITE_TESTNET_REGISTRY_ID=0xa2b544f345711c5e662891cc0558832c30d9919e6eaf3ec4958a1a2da0c7cce2

VITE_MAINNET_PACKAGE_ID=your_mainnet_package_id
VITE_MAINNET_REGISTRY_ID=your_mainnet_registry_id

VITE_DEVNET_PACKAGE_ID=your_devnet_package_id
VITE_DEVNET_REGISTRY_ID=your_devnet_registry_id
```

## 使用方法

1. 启动应用：`npm run dev`
2. 在页面右上角找到网络选择器（显示当前网络名称和彩色圆点）
3. 点击下拉菜单，选择要切换的网络
4. 应用会自动切换并重新加载数据

## 技术实现

- **NetworkSelector 组件**：`src/components/NetworkSelector.tsx`
  - 提供网络选择下拉菜单
  - 显示当前网络的视觉指示器

- **网络状态管理**：在 `App.tsx` 中
  - 使用 `useState` 管理当前网络状态
  - `handleNetworkChange` 函数处理网络切换逻辑
  - 切换时清空本地状态并重新获取数据

- **服务层更新**：`src/services/contractService.ts`
  - `updateNetwork` 函数更新 SuiClient 和合约配置
  - 所有合约调用都使用正确的网络配置

## 注意事项

1. 切换网络会清空当前的用户状态和余额信息
2. 需要确保钱包也切换到相应的网络
3. 不同网络的合约地址必须正确配置，否则无法正常使用
4. 切换网络后，所有数据都会从新网络重新获取

## 测试

构建命令：
```bash
npm run build
```

开发命令：
```bash
npm run dev
```