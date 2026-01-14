import { SuiClient } from '@mysten/sui/client';
import type { NetworkType } from '../config/types';
import { networkConfig } from '../config/networkConfig';
import { getContractConfig } from '../config/contractConfig';

let currentNetwork: NetworkType = 'testnet';
let suiClient = new SuiClient({
  url: networkConfig[currentNetwork]?.url || networkConfig.testnet.url,
});

export function getCurrentNetwork(): NetworkType {
  return currentNetwork;
}

export function getSuiClient(): SuiClient {
  return suiClient;
}

export function updateNetwork(network: NetworkType) {
  currentNetwork = network;
  suiClient = new SuiClient({
    url: networkConfig[network]?.url || networkConfig.testnet.url,
  });
}

export function getPackageId(): string {
  return getContractConfig(currentNetwork).packageId;
}

export function getRegistryId(): string {
  return getContractConfig(currentNetwork).registryId;
}

export interface UserStatusInfo {
  id: string;
  owner: string;
  last_check_in_ms: number;
  timeout_threshold_ms: number;
  encrypted_message: string;
  transfer_recipient: string;
  stored_balance: number;
}

export interface RegistryFields {
  user_status_ids: string[];
}

export interface UserStatusFields {
  owner: string;
  last_check_in_ms: string;
  timeout_threshold_ms: string;
  encrypted_message: string;
  transfer_recipient: string;
  stored_balance: string | { fields?: { value?: string }; value?: string };
}

export async function getAllUserStatuses(): Promise<UserStatusInfo[]> {
  const client = getSuiClient();
  const registryId = getRegistryId();
  
  try {
    // 获取Registry对象
    const registryObj = await client.getObject({
      id: registryId,
      options: {
        showType: true,
        showContent: true,
      },
    });
    
    if (!registryObj.data || !registryObj.data.content) {
      return [];
    }
    
    if (registryObj.data.content.dataType !== 'moveObject') {
      return [];
    }
    
    const fields = registryObj.data.content.fields as unknown as RegistryFields;
    const userStatusIds = fields.user_status_ids || [];
    
    // 并行获取所有UserStatus的详细信息
    const userStatusPromises = userStatusIds.map(async (id: string) => {
      try {
        const userStatusObj = await client.getObject({
          id,
          options: {
            showType: true,
            showContent: true,
          },
        });
        
        if (userStatusObj.data && userStatusObj.data.content && userStatusObj.data.content.dataType === 'moveObject') {
          const userStatusFields = userStatusObj.data.content.fields as unknown as UserStatusFields;
          
          // 调试：打印 stored_balance 的原始结构
          console.log(`UserStatus ${id} 的 stored_balance 原始数据:`, userStatusFields.stored_balance);
          console.log(`stored_balance 类型:`, typeof userStatusFields.stored_balance);
          
          let storedBalance = 0;
          
          // 优先处理字符串类型（Sui API 返回的 Balance 可能是字符串）
          if (typeof userStatusFields.stored_balance === 'string') {
            storedBalance = Number(userStatusFields.stored_balance);
            console.log(`从字符串类型解析:`, storedBalance);
          } else if (typeof userStatusFields.stored_balance === 'number') {
            storedBalance = userStatusFields.stored_balance;
            console.log(`从数字类型解析:`, storedBalance);
          } else if (userStatusFields.stored_balance) {
            // 处理对象类型的情况
            if (userStatusFields.stored_balance.fields?.value) {
              storedBalance = Number(userStatusFields.stored_balance.fields.value);
              console.log(`从 fields.value 解析:`, storedBalance);
            } else if (userStatusFields.stored_balance.value) {
              storedBalance = Number(userStatusFields.stored_balance.value);
              console.log(`从 value 解析:`, storedBalance);
            }
          }
          
          console.log(`最终解析后的 storedBalance:`, storedBalance, `(${(storedBalance / 1_000_000_000).toFixed(4)} SUI)`);
          
          return {
            id,
            owner: userStatusFields.owner,
            last_check_in_ms: Number(userStatusFields.last_check_in_ms),
            timeout_threshold_ms: Number(userStatusFields.timeout_threshold_ms),
            encrypted_message: userStatusFields.encrypted_message,
            transfer_recipient: userStatusFields.transfer_recipient,
            stored_balance: storedBalance,
          };
        }
      } catch (error) {
        console.error(`Failed to fetch user status ${id}:`, error);
      }
      return null;
    });
    
    const results = await Promise.all(userStatusPromises);
    const validResults = results.filter((item): item is UserStatusInfo => item !== null);
    
    // 调试日志：打印所有 UserStatus 的详细信息
    console.log('=== getAllUserStatuses 调试信息 ===');
    console.log('总数量:', validResults.length);
    validResults.forEach((status, index) => {
      console.log(`UserStatus ${index + 1}:`, {
        id: status.id,
        owner: status.owner,
        stored_balance: status.stored_balance,
        stored_balance_SUI: (status.stored_balance / 1_000_000_000).toFixed(4),
        last_check_in_ms: status.last_check_in_ms,
        timeout_threshold_ms: status.timeout_threshold_ms,
      });
    });
    console.log('======================================');
    
    return validResults;
  } catch (error) {
    console.error('Failed to fetch all user statuses:', error);
    return [];
  }
}
