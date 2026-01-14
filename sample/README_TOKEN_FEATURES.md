# 代币功能说明

## 概述

<img src="https://i.imgs.ovh/2025/11/13/CywSrY.jpeg" alt="CywSrY.jpeg" border="0">

## 新增功能

### 1. 余额显示
- **位置**: 页面右上角钱包信息区域
- **显示内容**:
  - 🪙 SUI 余额（4位小数）
  - 💵 USDC 余额（6位小数）
- **功能**: 自动获取余额，支持手动刷新

### 2. 代币操作
- **位置**: 新增"代币操作"标签页
- **功能**:
  - 铸造测试 USDC 代币
  - 显示操作结果（成功/失败消息）
  - 铸造后自动刷新余额

## 技术实现

### 新增文件

1. **`src/services/balanceService.ts`**
   - 余额查询服务
   - 支持 SUI 和 USDC 余额获取
   - 提供格式化函数

2. **`src/config/tokenConfig.ts`**
   - 代币配置文件
   - 包含测试网合约地址
   - 支持主网配置预留

3. **`src/components/TestTokenActions.tsx`**
   - 测试代币操作组件
   - 铸造 USDC 功能
   - 错误处理和用户反馈

### 修改文件

1. **`src/components/WalletInfo.tsx`**
   - 添加余额显示
   - 集成余额服务
   - 添加刷新功能

2. **`src/components/ObjectMarketplace.tsx`**
   - 新增"代币操作"标签页
   - 集成测试代币操作组件

## 配置信息

### 测试网配置
- **包 ID**: `0xa7350b7764187df2f2296d2c6247a32edada3cc3a6361baa8c625e41f1903962`
- **USDC TreasuryCap**: `0xd08ce224e193cfa6999d4d3d5e36af93ddd3bddf479ef8340496910529a0f6f3`
- **USDC 类型**: `0xa7350b7764187df2f2296d2c6247a32edada3cc3a6361baa8c625e41f1903962::test_coin::TEST_COIN`

### 代币信息
- **SUI**: 9位小数
- **USDC**: 6位小数

## 使用说明

1. **连接钱包**: 使用 Sui 钱包连接到测试网
2. **查看余额**: 连接后自动显示 SUI 和 USDC 余额
3. **铸造 USDC**: 
   - 切换到"代币操作"标签页
   - 输入铸造数量
   - 点击"铸造"按钮
   - 等待交易确认
4. **刷新余额**: 点击钱包信息区域的"刷新"按钮

## 注意事项

- 当前仅支持测试网
- USDC 为测试代币，仅用于测试目的
- 铸造功能需要相应的 TreasuryCap 权限
- 余额查询可能有轻微延迟

## 未来扩展

- 支持主网配置
- 添加转账功能
- 添加代币销毁功能
- 支持更多代币类型
- 添加交易历史记录
