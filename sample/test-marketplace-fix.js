const { SuiClient, getFullnodeUrl } = require('@mysten/sui/client');

// 配置
const config = {
  network: 'testnet',
  packageId: '0x5f8ca53a2d7422c0c2c0a2c0c2c0c2c0c2c0c2c0c2c0c2c0c2c0c2c0c2c0c2c0c',
  marketplaceId: '0x6f8ca53a2d7422c0c2c0a2c0c2c0c2c0c2c0c2c0c2c0c2c0c2c0c2c0c2c0c2c0c'
};

// 创建客户端
const client = new SuiClient({
  url: getFullnodeUrl(config.network),
});

async function testMarketplaceFix() {
  console.log('🧪 测试市场对象显示修复...\n');

  try {
    // 1. 获取市场对象
    console.log('📦 获取市场对象...');
    const marketplaceResult = await client.getObject({
      id: config.marketplaceId,
      options: {
        showContent: true,
        showType: true
      }
    });

    if (!marketplaceResult.data) {
      console.log('❌ 市场对象不存在');
      return;
    }

    const marketplace = marketplaceResult.data;
    console.log('✅ 市场对象获取成功');
    console.log('📋 市场类型:', marketplace.data?.type);

    // 2. 检查市场内容结构
    const content = marketplace.data?.content;
    if (!content) {
      console.log('❌ 市场内容为空');
      return;
    }

    console.log('\n🔍 检查市场内容结构:');
    console.log('可用字段:', Object.keys(content.fields));

    // 3. 尝试使用修复后的逻辑获取对象
    console.log('\n🎯 使用修复后的逻辑获取对象...');
    
    let objects = [];
    
    // 首先尝试 objects 字段（修复后的逻辑）
    if (content.fields.objects) {
      console.log('✅ 找到 objects 字段');
      objects = content.fields.objects.fields.contents || [];
      console.log(`📊 通过 objects 字段找到 ${objects.length} 个对象`);
    } 
    // 回退到 listed_objects 字段（原有逻辑）
    else if (content.fields.listed_objects) {
      console.log('⚠️ 回退到 listed_objects 字段');
      objects = content.fields.listed_objects.fields.contents || [];
      console.log(`📊 通过 listed_objects 字段找到 ${objects.length} 个对象`);
    } else {
      console.log('❌ 未找到对象字段');
      return;
    }

    // 4. 显示找到的对象
    if (objects.length === 0) {
      console.log('📭 市场中没有对象');
      return;
    }

    console.log('\n🎉 市场对象列表:');
    objects.forEach((item, index) => {
      const obj = item.fields.value.fields;
      console.log(`${index + 1}. 对象ID: ${item.fields.key}`);
      console.log(`   名称: ${obj.name}`);
      console.log(`   价格: ${obj.price} SUI`);
      console.log(`   描述: ${obj.description}`);
      console.log(`   所有者: ${obj.owner}`);
      console.log(`   上架状态: ${obj.is_for_sale ? '在售' : '已下架'}`);
      console.log('');
    });

    // 5. 验证特定对象（之前调试时找到的对象）
    const targetObjectId = '0xd1820420a10cab6471bc7b1135339d9dfd13441b202cd0e8fb4c6fced489e317';
    const targetObject = objects.find(item => item.fields.key === targetObjectId);
    
    if (targetObject) {
      console.log('✅ 找到目标对象:', targetObjectId);
      const obj = targetObject.fields.value.fields;
      console.log(`   名称: ${obj.name}`);
      console.log(`   价格: ${obj.price} SUI`);
      console.log(`   描述: ${obj.description}`);
    } else {
      console.log('❌ 未找到目标对象:', targetObjectId);
    }

    // 6. 测试前端服务逻辑
    console.log('\n🔧 测试前端服务逻辑...');
    
    // 模拟前端 getMarketplaceObjects 函数的逻辑
    function simulateGetMarketplaceObjects() {
      try {
        const objects = content.fields.objects; // 修复后的逻辑
        if (!objects) {
          return [];
        }

        const items = objects.fields.contents || [];
        return items.map(item => {
          const obj = item.fields.value.fields;
          return {
            id: item.fields.key,
            name: obj.name,
            description: obj.description,
            price: obj.price,
            owner: obj.owner,
            profilePicture: obj.profile_picture,
            isForSale: obj.is_for_sale,
            ocid: obj.ocid
          };
        });
      } catch (error) {
        console.error('❌ 前端服务逻辑错误:', error);
        return [];
      }
    }

    const frontendObjects = simulateGetMarketplaceObjects();
    console.log(`📱 前端服务将返回 ${frontendObjects.length} 个对象`);

    if (frontendObjects.length > 0) {
      console.log('✅ 修复成功！前端现在可以正确获取市场对象');
      console.log('🎯 用户应该能在市场上看到已上架的对象');
    } else {
      console.log('❌ 修复失败，前端仍然无法获取对象');
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

// 运行测试
testMarketplaceFix().then(() => {
  console.log('\n🏁 测试完成');
}).catch(error => {
  console.error('💥 测试异常:', error);
});
