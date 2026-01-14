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
    
    const fields = registryObj.data.content.fields;
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
          const userStatusFields = userStatusObj.data.content.fields;
          
          let storedBalance = 0;
          if (userStatusFields.stored_balance) {
            if (typeof userStatusFields.stored_balance === 'number') {
              storedBalance = userStatusFields.stored_balance;
            } else if (userStatusFields.stored_balance.fields?.value) {
              storedBalance = Number(userStatusFields.stored_balance.fields.value);
            } else if (userStatusFields.stored_balance.value) {
              storedBalance = Number(userStatusFields.stored_balance.value);
            }
          }
          
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
    return results.filter((item): item is UserStatusInfo => item !== null);
  } catch (error) {
    console.error('Failed to fetch all user statuses:', error);
    return [];
  }
}
