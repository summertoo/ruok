import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'zh' | 'en';

interface Translations {
  [key: string]: {
    zh: string;
    en: string;
  };
}

const translations: Translations = {
  // App.tsx
  'app.title': { zh: 'OCNetwork', en: 'OCNetwork' },
  'welcome.title': { zh: '欢迎来到 {appName}', en: 'Welcome to {appName}' },
  'welcome.subtitle': { zh: '连接钱包开始交易 OC Bot', en: 'Connect wallet to start trading OC Bots' },
  'welcome.currentNetwork': { zh: '当前网络', en: 'Current Network' },
  'welcome.ensureSameNetwork': { zh: '请确保您的钱包连接到相同的网络', en: 'Please ensure your wallet is connected to the same network' },
  'network.label': { zh: '网络', en: 'Network' },
  'network.mainnet': { zh: '主网', en: 'Mainnet' },
  'network.testnet': { zh: '测试网', en: 'Testnet' },
  'network.devnet': { zh: '开发网', en: 'Devnet' },
  'network.switchConfirm': { zh: '切换到 {network} 将需要重新连接钱包，确定要继续吗？', en: 'Switching to {network} will require reconnecting your wallet, are you sure you want to continue?' },

  // Navigation
  'nav.market': { zh: '市场', en: 'Market' },
  'nav.admin': { zh: '管理', en: 'Admin' },
  'nav.debug': { zh: '调试', en: 'Debug' },

  // ObjectMarketplace.tsx
  'marketplace.tabs.market': { zh: '市场', en: 'Market' },
  'marketplace.tabs.myObjects': { zh: '我的对象', en: 'My Objects' },
  'marketplace.tabs.myListings': { zh: '我的上架管理', en: 'My Listings' },
  'marketplace.marketObjects': { zh: '市场对象', en: 'Market Objects' },
  'marketplace.myObjects': { zh: '我的对象', en: 'My Objects' },
  'marketplace.createNewObject': { zh: '创建新对象', en: 'Create New Object' },
  'marketplace.editObject': { zh: '编辑对象', en: 'Edit Object' },
  'marketplace.noListingPermission': { zh: '暂无上架权限', en: 'No Listing Permission' },
  'marketplace.noListingPermissionDesc': { zh: '您当前没有创建和上架物品的权限，请联系管理员获取权限', en: 'You currently do not have permission to create and list items, please contact administrator for permission' },
  'marketplace.checkingPermission': { zh: '正在检查上架权限...', en: 'Checking listing permission...' },

  // ObjectForm.tsx
  'form.create.title': { zh: '创建新对象', en: 'Create New Object' },
  'form.edit.title': { zh: '编辑对象', en: 'Edit Object' },
  'form.name': { zh: '名称', en: 'Name' },
  'form.name.placeholder': { zh: '输入对象名称', en: 'Enter object name' },
  'form.description': { zh: '描述', en: 'Description' },
  'form.description.placeholder': { zh: '输入对象描述', en: 'Enter object description' },
  'form.price': { zh: '价格', en: 'Price' },
  'form.price.placeholder': { zh: '输入价格', en: 'Enter price' },
  'form.create.button': { zh: '创建对象', en: 'Create Object' },
  'form.update.button': { zh: '更新对象', en: 'Update Object' },
  'form.cancel.button': { zh: '取消', en: 'Cancel' },
  'form.creating': { zh: '创建中...', en: 'Creating...' },
  'form.updating': { zh: '更新中...', en: 'Updating...' },

  // ObjectList.tsx
  'list.no.objects': { zh: '暂无对象', en: 'No objects available' },
  'list.no.objects.desc': { zh: '市场中还没有对象', en: 'No objects in the marketplace yet' },
  'list.my.objects.empty': { zh: '您还没有创建任何对象', en: 'You have not created any objects yet' },
  'list.owner': { zh: '所有者', en: 'Owner' },
  'list.price': { zh: '价格', en: 'Price' },
  'list.actions': { zh: '操作', en: 'Actions' },
  'list.buy': { zh: '购买', en: 'Buy' },
  'list.edit': { zh: '编辑', en: 'Edit' },
  'list.delist': { zh: '下架', en: 'Delist' },
  'list.list': { zh: '上架', en: 'List' },
  'list.buying': { zh: '购买中...', en: 'Buying...' },
  'list.editing': { zh: '编辑中...', en: 'Editing...' },
  'list.delisting': { zh: '下架中...', en: 'Delisting...' },
  'list.listing': { zh: '上架中...', en: 'Listing...' },

  // ObjectWallet.tsx
  'wallet.title': { zh: '对象钱包', en: 'Object Wallet' },
  'wallet.no.wallet': { zh: '该对象还没有钱包', en: 'This object does not have a wallet yet' },
  'wallet.create.button': { zh: '创建钱包', en: 'Create Wallet' },
  'wallet.creating': { zh: '创建中...', en: 'Creating...' },
  'wallet.id': { zh: '钱包ID:', en: 'Wallet ID:' },
  'wallet.created.at': { zh: '创建时间:', en: 'Created At:' },
  'wallet.balance': { zh: '余额', en: 'Balance' },
  'wallet.no.balance': { zh: '暂无余额', en: 'No Balance' },
  'wallet.no.balance.desc': { zh: '存入代币后即可查看余额', en: 'Deposit tokens to view balance' },
  'wallet.token.operations': { zh: '代币操作', en: 'Token Operations' },
  'wallet.deposit': { zh: '存入代币', en: 'Deposit Tokens' },
  'wallet.withdraw': { zh: '提取代币', en: 'Withdraw Tokens' },
  'wallet.amount': { zh: '数量', en: 'Amount' },
  'wallet.deposit.button': { zh: '存入', en: 'Deposit' },
  'wallet.withdraw.button': { zh: '提取', en: 'Withdraw' },
  'wallet.scheduled.transfers': { zh: '定时转账', en: 'Scheduled Transfers' },
  'wallet.create.transfer': { zh: '创建定时转账', en: 'Create Scheduled Transfer' },
  'wallet.to.address': { zh: '接收地址', en: 'Recipient Address' },
  'wallet.execute.time': { zh: '执行时间', en: 'Execute Time' },
  'wallet.create.transfer.button': { zh: '创建转账', en: 'Create Transfer' },
  'wallet.no.transfers': { zh: '暂无定时转账', en: 'No scheduled transfers' },
  'wallet.transfer.to': { zh: '到:', en: 'To:' },
  'wallet.transfer.amount': { zh: '数量:', en: 'Amount:' },
  'wallet.transfer.execute.time': { zh: '执行时间:', en: 'Execute Time:' },
  'wallet.transfer.status': { zh: '状态:', en: 'Status:' },
  'wallet.transfer.executed': { zh: '已执行', en: 'Executed' },
  'wallet.transfer.pending': { zh: '待执行', en: 'Pending' },
  'wallet.execute': { zh: '执行', en: 'Execute' },
  'wallet.cancel': { zh: '取消', en: 'Cancel' },

  // MyListingsPage.tsx
  'myListings.title': { zh: '我的上架管理', en: 'My Listings' },
  'myListings.back': { zh: '← 返回市场', en: '← Back to Market' },
  'myListings.totalObjects': { zh: '共 {count} 个对象', en: 'Total {count} objects' },
  'myListings.noObjects': { zh: '暂无对象', en: 'No Objects' },
  'myListings.noObjectsDesc': { zh: '您还没有创建任何交易对象', en: 'You have not created any trading objects yet' },
  'myListings.createObject': { zh: '去创建对象', en: 'Create Object' },
  'myListings.forSale': { zh: '上架中', en: 'For Sale' },
  'myListings.notForSale': { zh: '未上架', en: 'Not For Sale' },
  'myListings.selling': { zh: '出售中', en: 'Selling' },
  'myListings.blobId': { zh: 'Blob ID:', en: 'Blob ID:' },
  'myListings.currentPrice': { zh: '当前价格:', en: 'Current Price:' },
  'myListings.walletManagement': { zh: '💰 钱包管理', en: '💰 Wallet Management' },
  'myListings.delist': { zh: '下架', en: 'Delist' },
  'myListings.processing': { zh: '处理中...', en: 'Processing...' },
  'myListings.confirmUpdate': { zh: '确认更新', en: 'Confirm Update' },
  'myListings.newPrice': { zh: '新价格', en: 'New Price' },
  'myListings.newPricePlaceholder': { zh: '输入新价格', en: 'Enter new price' },
  'myListings.tokenType': { zh: '代币类型', en: 'Token Type' },
  'myListings.selectToken': { zh: '选择代币', en: 'Select token' },
  'myListings.loadingTokens': { zh: '加载支持的代币...', en: 'Loading supported tokens...' },
  'myListings.walletTitle': { zh: '钱包管理', en: 'Wallet Management' },
  'myListings.confirmDelist': { zh: '确定要下架这个对象吗？', en: 'Are you sure you want to delist this object?' },
  'myListings.delistSuccess': { zh: '对象下架成功！', en: 'Object delisted successfully!' },
  'myListings.delistFailed': { zh: '下架失败: ', en: 'Delist failed: ' },
  'myListings.updatePriceSuccess': { zh: '价格更新成功！', en: 'Price updated successfully!' },
  'myListings.updatePriceFailed': { zh: '更新价格失败: ', en: 'Update price failed: ' },
  'myListings.enterValidPrice': { zh: '请输入有效的价格', en: 'Please enter a valid price' },
  'myListings.onSale': { zh: '出售中', en: 'For Sale' },

  // ObjectForm.tsx
  'form.botName': { zh: '机器人名称', en: 'Bot Name' },
  'form.botName.placeholder': { zh: '输入机器人名称', en: 'Enter bot name' },
  'form.emoji': { zh: '表情包', en: 'Emoji' },
  'form.emoji.placeholder': { zh: '输入表情包 (如: 🤖)', en: 'Enter emoji (e.g.: 🤖)' },
  'form.avatarUrl': { zh: '头像URL', en: 'Avatar URL' },
  'form.avatarUrl.placeholder': { zh: '输入头像图片URL', en: 'Enter avatar image URL' },
  'form.blobId': { zh: 'Walrus Blob ID', en: 'Walrus Blob ID' },
  'form.blobId.placeholder': { zh: '输入Walrus存储的Blob ID', en: 'Enter Walrus storage Blob ID' },
  'form.pricingToken': { zh: '定价代币', en: 'Pricing Token' },
  'form.selectToken': { zh: '选择代币', en: 'Select token' },
  'form.priceWithSymbol': { zh: '价格 ({symbol})', en: 'Price ({symbol})' },
  'form.price.placeholder': { zh: '输入价格', en: 'Enter price' },
  'form.updateObject': { zh: '更新对象', en: 'Update Object' },
  'form.createAndList': { zh: '创建并上架对象', en: 'Create and List Object' },
  'form.connectWallet': { zh: '请先连接钱包', en: 'Please connect wallet first' },
  'form.fillAllFields': { zh: '请填写所有字段，包括选择定价代币', en: 'Please fill all fields, including selecting pricing token' },
  'form.loadingTokens': { zh: '加载支持的代币...', en: 'Loading supported tokens...' },
  'form.checkingPermission': { zh: '正在检查上架权限...', en: 'Checking listing permission...' },
  'form.needConnectWallet': { zh: '需要连接钱包', en: 'Need to connect wallet' },
  'form.connectWalletDesc': { zh: '请先连接您的钱包以使用此功能', en: 'Please connect your wallet first to use this feature' },
  'form.noListingPermission': { zh: '暂无上架权限', en: 'No Listing Permission' },
  'form.noListingPermissionDesc': { zh: '您当前没有上架物品的权限，请联系管理员获取权限', en: 'You currently do not have permission to list items, please contact administrator for permission' },
  'form.howToGetPermission': { zh: '如何获取上架权限？', en: 'How to get listing permission?' },
  'form.permissionStep1': { zh: '联系市场管理员为您分配 ListingCap', en: 'Contact marketplace administrator to assign ListingCap for you' },
  'form.permissionStep2': { zh: '管理员可以通过管理页面创建权限', en: 'Administrator can create permissions through management page' },
  'form.permissionStep3': { zh: '获得权限后即可在此处上架物品', en: 'After getting permission, you can list items here' },
  'form.hasListingPermission': { zh: '您拥有上架权限，可以创建和上架物品', en: 'You have listing permission, you can create and list items' },
  'form.objectUpdateSuccess': { zh: '对象更新成功！', en: 'Object updated successfully!' },
  'form.objectCreateSuccess': { zh: '对象创建并上架成功！', en: 'Object created and listed successfully!' },
  'form.updateFailed': { zh: '更新对象失败: ', en: 'Update object failed: ' },
  'form.createFailed': { zh: '创建对象失败: ', en: 'Create object failed: ' },

  // Common messages
  'common.connect.wallet': { zh: '请先连接钱包', en: 'Please connect wallet first' },
  'common.fill.complete.info': { zh: '请填写完整信息', en: 'Please complete the information' },
  'common.success': { zh: '成功', en: 'Success' },
  'common.error': { zh: '错误', en: 'Error' },
  'common.loading': { zh: '加载中...', en: 'Loading...' },
  'common.confirm': { zh: '确定', en: 'Confirm' },
  'common.cancel': { zh: '取消', en: 'Cancel' },

  // ObjectWallet additional messages
  'wallet.create.success': { zh: '钱包创建成功！', en: 'Wallet created successfully!' },
  'wallet.deposit.success': { zh: '存入成功！', en: 'Deposit successful!' },
  'wallet.withdraw.success': { zh: '提取成功！', en: 'Withdraw successful!' },
  'wallet.transfer.refresh': { zh: '刷新', en: 'Refresh' },
  'wallet.transfer.create.success': { zh: '✅ 定时转账创建成功！\n\n转账将在预定时间自动执行，您也可以在到期后手动执行。', en: '✅ Scheduled transfer created successfully!\n\nThe transfer will be executed automatically at the scheduled time, or you can execute it manually after it expires.' },
  'wallet.transfer.execute.success': { zh: '定时转账执行成功！', en: 'Scheduled transfer executed successfully!' },
  'wallet.transfer.cancel.success': { zh: '✅ 定时转账已成功取消！', en: '✅ Scheduled transfer cancelled successfully!' },
  'wallet.transfer.cancel.confirm': { zh: '⚠️ 确认取消定时转账\n\n取消后，该定时转账将被永久删除，无法恢复。\n\n确定要取消吗？', en: '⚠️ Confirm cancel scheduled transfer\n\nAfter cancellation, this scheduled transfer will be permanently deleted and cannot be recovered.\n\nAre you sure you want to cancel?' },
  'wallet.merge.no.fragments': { zh: '该代币类型没有需要整理的碎片', en: 'This token type has no fragments to organize' },
  'wallet.merge.success': { zh: '代币整理完成！您的钱包中的代币碎片已被合并。', en: 'Token organization completed! Token fragments in your wallet have been merged.' },

  // Additional hardcoded texts that need internationalization
  'object.price': { zh: '价格', en: 'Price' },
  'object.status': { zh: '状态', en: 'Status' },
  'object.owned': { zh: '已拥有', en: 'Owned' },
  'object.viewWallet': { zh: '查看钱包', en: 'View Wallet' },
  'object.zeroFeePromotion': { zh: '0费用促销中', en: '0 Fee Promotion' },
  'object.forSale': { zh: '出售中', en: 'For Sale' },
  'object.buy': { zh: '购买', en: 'Buy' },
  'object.owner': { zh: '拥有者', en: 'Owner' },
  'object.sold': { zh: '已售出', en: 'Sold' },
  'object.buying': { zh: '购买中...', en: 'Buying...' },
  'object.noFee': { zh: '无额外手续费', en: 'No additional fees' },
  'object.walletManagement': { zh: '对象钱包管理', en: 'Object Wallet Management' },
  'object.thisIsYourObject': { zh: '这是你的对象', en: 'This is your object' },
  'object.connectWalletFirst': { zh: '请先连接钱包', en: 'Please connect wallet first' },
  'object.cannotBuyOwnObject': { zh: '不能购买自己的对象！', en: 'Cannot buy your own object!' },
  'object.purchaseSuccess': { zh: '购买成功！', en: 'Purchase successful!' },
  'object.purchaseFailed': { zh: '购买失败', en: 'Purchase failed' },
  'object.noAvailablePaymentToken': { zh: '没有可用的支付代币', en: 'No available payment token' },
  'object.noObjects': { zh: '暂无对象', en: 'No objects' },

  // Admin page
  'admin.title': { zh: '管理员控制台', en: 'Admin Console' },
  'admin.subtitle': { zh: '市场管理和系统配置', en: 'Market Management and System Configuration' },
  'admin.verifyingPermission': { zh: '正在验证管理员权限...', en: 'Verifying admin permission...' },
  'admin.accessDenied': { zh: '访问受限', en: 'Access Denied' },
  'admin.noPermission': { zh: '您没有管理员权限，无法访问此页面', en: 'You do not have admin permission to access this page' },
  'admin.useAdminAccount': { zh: '请使用管理员账户登录后重试', en: 'Please login with admin account and try again' },
  'admin.totalObjects': { zh: '总对象数', en: 'Total Objects' },
  'admin.activeListings': { zh: '活跃上架', en: 'Active Listings' },
  'admin.totalVolume': { zh: '总交易量', en: 'Total Volume' },
  'admin.currentFee': { zh: '当前费用', en: 'Current Fee' },
  'admin.marketControl': { zh: '市场状态控制', en: 'Market Status Control' },
  'admin.marketStatus': { zh: '市场状态', en: 'Market Status' },
  'admin.marketPaused': { zh: '市场已暂停', en: 'Market is paused' },
  'admin.marketRunning': { zh: '市场正常运行', en: 'Market is running normally' },
  'admin.paused': { zh: '已暂停', en: 'Paused' },
  'admin.running': { zh: '运行中', en: 'Running' },
  'admin.resumeMarket': { zh: '恢复市场', en: 'Resume Market' },
  'admin.pauseMarket': { zh: '暂停市场', en: 'Pause Market' },
  'admin.feeSettings': { zh: '市场费用设置', en: 'Market Fee Settings' },
  'admin.currentFeeLabel': { zh: '当前费用:', en: 'Current Fee:' },
  'admin.newFeePlaceholder': { zh: '输入新的费用百分比', en: 'Enter new fee percentage' },
  'admin.feeRange': { zh: '费用范围: 0% - 100%，建议设置在 0.1% - 5% 之间', en: 'Fee range: 0% - 100%, recommended to set between 0.1% - 5%' },
  'admin.updateFee': { zh: '更新费用设置', en: 'Update Fee Settings' },
  'admin.feeDescription': { zh: '费用说明', en: 'Fee Description' },
  'admin.feeNote1': { zh: '• 费用将从每笔交易中收取', en: '• Fee will be charged from each transaction' },
  'admin.feeNote2': { zh: '• 费用将转入市场管理账户', en: '• Fee will be transferred to market management account' },
  'admin.feeNote3': { zh: '• 设置为 0% 表示完全免费交易', en: '• Setting to 0% means completely free trading' },
  'admin.feeNote4': { zh: '• 修改费用将影响新的交易', en: '• Modifying fee will affect new transactions' },
  'admin.adminInfo': { zh: '管理员信息', en: 'Admin Information' },
  'admin.currentAdmin': { zh: '当前管理员:', en: 'Current Admin:' },
  'admin.marketContract': { zh: '市场合约:', en: 'Market Contract:' },
  'admin.lastUpdate': { zh: '最后更新:', en: 'Last Update:' },
  'admin.marketPausedSuccess': { zh: '市场已暂停', en: 'Market has been paused' },
  'admin.marketPauseFailed': { zh: '暂停市场失败', en: 'Failed to pause market' },
  'admin.marketResumedSuccess': { zh: '市场已恢复', en: 'Market has been resumed' },
  'admin.marketResumeFailed': { zh: '恢复市场失败', en: 'Failed to resume market' },
  'admin.feeSetSuccess': { zh: '市场费用已设置为 {fee}%', en: 'Market fee has been set to {fee}%' },
  'admin.feeSetFailed': { zh: '设置市场费用失败', en: 'Failed to set market fee' },
  'admin.invalidFee': { zh: '请输入有效的费用百分比 (0-100)', en: 'Please enter valid fee percentage (0-100)' },

  // TokenSupportManager.tsx
  'token.title': { zh: '代币支持管理', en: 'Token Support Management' },
  'token.currentStatus': { zh: '当前状态', en: 'Current Status' },
  'token.usdcSupportStatus': { zh: 'USDC支持状态:', en: 'USDC Support Status:' },
  'token.supported': { zh: '已支持', en: 'Supported' },
  'token.notSupported': { zh: '未支持', en: 'Not Supported' },
  'token.supportedTokenCount': { zh: '支持的代币数量:', en: 'Supported Token Count:' },
  'token.quickActions': { zh: '快速操作', en: 'Quick Actions' },
  'token.addUSDCSupport': { zh: '添加USDC支持', en: 'Add USDC Support' },
  'token.usdcAlreadySupported': { zh: 'USDC已支持', en: 'USDC Already Supported' },
  'token.refreshStatus': { zh: '刷新状态', en: 'Refresh Status' },
  'token.batchAddCommonTokens': { zh: '批量添加常用代币', en: 'Batch Add Common Tokens' },
  'token.addSelectedTokens': { zh: '添加选中的代币', en: 'Add Selected Tokens' },
  'token.alreadySupported': { zh: ' (已支持)', en: ' (Already Supported)' },
  'token.addCustomToken': { zh: '添加自定义代币', en: 'Add Custom Token' },
  'token.addToken': { zh: '添加代币', en: 'Add Token' },
  'token.currentlySupportedTokens': { zh: '当前支持的代币', en: 'Currently Supported Tokens' },
  'token.noSupportedTokens': { zh: '暂无支持的代币', en: 'No supported tokens' },
  'token.loading': { zh: '加载中...', en: 'Loading...' },
  'token.connectWalletFirst': { zh: '请先连接钱包', en: 'Please connect wallet first' },
  'token.enterTokenType': { zh: '请输入代币类型', en: 'Please enter token type' },
  'token.selectTokensToAdd': { zh: '请选择要添加的代币', en: 'Please select tokens to add' },
  'token.usdcSupportAddSuccess': { zh: 'USDC代币支持添加成功！', en: 'USDC token support added successfully!' },
  'token.usdcSupportAddFailed': { zh: 'USDC代币支持添加失败，请检查控制台日志', en: 'Failed to add USDC token support, please check console logs' },
  'token.addUSDCSupportFailed': { zh: '添加USDC支持失败: ', en: 'Failed to add USDC support: ' },
  'token.supportAddSuccess': { zh: '代币支持添加成功！', en: 'Token support added successfully!' },
  'token.supportAddFailed': { zh: '代币支持添加失败，请检查控制台日志', en: 'Failed to add token support, please check console logs' },
  'token.addCustomTokenSupportFailed': { zh: '添加代币支持失败: ', en: 'Failed to add token support: ' },
  'token.batchAddSuccess': { zh: '批量添加代币支持成功！', en: 'Batch add token support successful!' },
  'token.batchAddFailed': { zh: '批量添加代币支持失败，请检查控制台日志', en: 'Failed to batch add token support, please check console logs' },
  'token.batchAddSupportFailed': { zh: '批量添加代币支持失败: ', en: 'Failed to batch add token support: ' },
  'token.tokenTypePlaceholder': { zh: '输入代币类型，例如: 0x2::sui::SUI', en: 'Enter token type, e.g.: 0x2::sui::SUI' },

  // TestTokenActions.tsx
  'testToken.title': { zh: '测试 USDC 操作', en: 'Test USDC Operations' },
  'testToken.connectWalletFirst': { zh: '请先连接钱包', en: 'Please connect wallet first' },
  'testToken.enterValidMintAmount': { zh: '请输入有效的铸造数量', en: 'Please enter valid mint amount' },
  'testToken.mintAmount': { zh: '铸造数量 (USDC)', en: 'Mint Amount (USDC)' },
  'testToken.mintAmountPlaceholder': { zh: '输入铸造数量', en: 'Enter mint amount' },
  'testToken.minting': { zh: '铸造中...', en: 'Minting...' },
  'testToken.mint': { zh: '铸造', en: 'Mint' },
  'testToken.testNetNote': { zh: '💡 这是测试网 USDC，仅用于测试目的', en: '💡 This is testnet USDC, only for testing purposes' },
  'testToken.contractAddress': { zh: '合约地址: ', en: 'Contract Address: ' },
  'testToken.mintSuccess': { zh: '成功铸造 {amount} USDC', en: 'Successfully minted {amount} USDC' },
  'testToken.mintFailed': { zh: '铸造失败: ', en: 'Mint failed: ' },

  // PurchaseProgress.tsx
  'purchase.title': { zh: '正在购买...', en: 'Purchasing...' },
  'purchase.completed': { zh: '购买完成', en: 'Purchase Complete' },
  'purchase.step': { zh: '步骤', en: 'Step' },
  'purchase.of': { zh: '/', en: '/' },
  'purchase.step1': { zh: '验证购买条件', en: 'Verifying purchase conditions' },
  'purchase.step2': { zh: '检查代币余额', en: 'Checking token balance' },
  'purchase.step3': { zh: '构建交易', en: 'Building transaction' },
  'purchase.step4': { zh: '执行交易', en: 'Executing transaction' },
  'purchase.step5': { zh: '确认交易', en: 'Confirming transaction' },
  'purchase.success': { zh: '购买成功！正在刷新页面...', en: 'Purchase successful! Refreshing page...' },

  // PurchaseConfirmDialog.tsx
  'confirm.title': { zh: '确认购买', en: 'Confirm Purchase' },
  'confirm.subtitle': { zh: '请仔细核对以下购买信息', en: 'Please carefully review the following purchase information' },
  'confirm.owner': { zh: '拥有者:', en: 'Owner:' },
  'confirm.forSale': { zh: '出售中', en: 'For Sale' },
  'confirm.blobId': { zh: 'Blob ID:', en: 'Blob ID:' },
  'confirm.purchasePrice': { zh: '购买价格:', en: 'Purchase Price:' },
  'confirm.fee': { zh: '手续费:', en: 'Fee:' },
  'confirm.total': { zh: '总计:', en: 'Total:' },
  'confirm.yourBalance': { zh: '您的余额:', en: 'Your Balance:' },
  'confirm.insufficientBalance': { zh: '余额不足！还需要 {amount} {symbol}', en: 'Insufficient balance! Need {amount} {symbol} more' },
  'confirm.getMoreTokens': { zh: '请获取更多 {symbol} 代币后再试', en: 'Please get more {symbol} tokens and try again' },
  'confirm.notice': { zh: '购买须知:', en: 'Purchase Notice:' },
  'confirm.notice1': { zh: '• 购买后对象将立即转移到您的钱包', en: '• Object will be transferred to your wallet immediately after purchase' },
  'confirm.notice2': { zh: '• 交易一旦确认，无法撤销', en: '• Transaction cannot be reversed once confirmed' },
  'confirm.notice3': { zh: '• 请确保您有足够的 SUI 支付交易费用', en: '• Please ensure you have enough SUI to pay for transaction fees' },
  'confirm.notice4': { zh: '• 当前为 0 手续费促销期', en: '• Currently in 0 fee promotion period' },
  'confirm.cancel': { zh: '取消', en: 'Cancel' },
  'confirm.confirming': { zh: '确认中...', en: 'Confirming...' },
  'confirm.buy': { zh: '确认购买', en: 'Confirm Purchase' },

  // WalletInfo.tsx
  'wallet.fetchBalanceFailed': { zh: '获取余额失败:', en: 'Failed to fetch balance:' },

  // PermissionDebug.tsx
  'debug.title': { zh: '🔍 权限调试工具', en: '🔍 Permission Debug Tool' },
  'debug.runCheck': { zh: '运行权限检查', en: 'Run Permission Check' },
  'debug.checking': { zh: '检查中...', en: 'Checking...' },
  'debug.error': { zh: '❌ 错误:', en: '❌ Error:' },
  'debug.basicInfo': { zh: '📍 基本信息', en: '📍 Basic Information' },
  'debug.userAddress': { zh: '用户地址:', en: 'User Address:' },
  'debug.packageId': { zh: 'Package ID:', en: 'Package ID:' },
  'debug.marketplaceId': { zh: 'Marketplace ID:', en: 'Marketplace ID:' },
  'debug.network': { zh: '网络:', en: 'Network:' },
  'debug.permissionStatus': { zh: '权限状态:', en: 'Permission Status:' },
  'debug.hasPermission': { zh: '✅ 有权限', en: '✅ Has Permission' },
  'debug.noPermission': { zh: '❌ 无权限', en: '❌ No Permission' },
  'debug.listingCapId': { zh: 'ListingCap ID:', en: 'ListingCap ID:' },
  'debug.notFound': { zh: '未找到', en: 'Not Found' },
  'debug.objectStats': { zh: '📊 对象统计', en: '📊 Object Statistics' },
  'debug.totalObjects': { zh: '总对象数:', en: 'Total Objects:' },
  'debug.relatedObjects': { zh: '相关对象数:', en: 'Related Objects:' },
  'debug.listingCapObjects': { zh: 'ListingCap 对象数:', en: 'ListingCap Objects:' },
  'debug.listingCapDetails': { zh: '🎫 ListingCap 对象详情', en: '🎫 ListingCap Object Details' },
  'debug.objectId': { zh: '对象ID:', en: 'Object ID:' },
  'debug.type': { zh: '类型:', en: 'Type:' },
  'debug.relatedObjectsTitle': { zh: '🔗 相关对象', en: '🔗 Related Objects' },
  'debug.connectWallet': { zh: '需要连接钱包', en: 'Need to connect wallet' },
  'debug.unknownError': { zh: '未知错误', en: 'Unknown error' },

  // Error messages
  'error.invalidWalletAddress': { zh: '钱包地址无效，请重新连接钱包', en: 'Invalid wallet address, please reconnect wallet' },
  'error.objectNotFound': { zh: '找不到要更新的对象', en: 'Object to update not found' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: { [key: string]: string | number }) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    // 从localStorage获取保存的语言设置，默认为中文
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'zh';
  });

  const t = (key: string, params?: { [key: string]: string | number }): string => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Translation key "${key}" not found`);
      return key;
    }

    let text = translation[language];
    
    // 替换参数
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        text = text.replace(`{${param}}`, String(value));
      });
    }

    return text;
  };

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
