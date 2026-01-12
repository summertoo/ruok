module ruok::ruok;

use std::string::{String, utf8};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::transfer;
use sui::tx_context::{Self, TxContext};
use sui::object;
use sui::clock::{Self, Clock};
use sui::balance::{Self, Balance};

const E_NOT_OWNER: u64 = 0;
const E_NOT_TIMEOUT: u64 = 1;
const E_INSUFFICIENT_BALANCE: u64 = 2;

// 触发奖励比例（1%）
const TRIGGER_REWARD_PERCENT: u64 = 100;

// 消息对象，用于传递加密提示语
public struct Message has key {
    id: UID,
    content: String,
}

// 用户状态共享对象
public struct UserStatus has key {
    id: UID,
    owner: address,
    last_check_in_ms: u64,
    timeout_threshold_ms: u64,
    encrypted_message: String,
    transfer_recipient: address,
    stored_balance: Balance<SUI>,
}

// 创建用户状态（失联转账 + 加密提示语）
public entry fun create_user_status(
    timeout_threshold_ms: u64,
    encrypted_message: String,
    transfer_recipient: address,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let user_status = UserStatus {
        id: object::new(ctx),
        owner: tx_context::sender(ctx),
        last_check_in_ms: clock::timestamp_ms(clock),
        timeout_threshold_ms,
        encrypted_message,
        transfer_recipient,
        stored_balance: coin::into_balance(payment),
    };
    transfer::share_object(user_status);
}

// 用户点击 OK 更新状态
public entry fun check_in(user_status: &mut UserStatus, clock: &Clock, ctx: &mut TxContext) {
    assert!(tx_context::sender(ctx) == user_status.owner, E_NOT_OWNER);
    user_status.last_check_in_ms = clock::timestamp_ms(clock);
}

// 触发预设事务：发送加密提示语给收款人，转账给收款人，触发者获得奖励
public entry fun trigger(user_status: &mut UserStatus, clock: &Clock, ctx: &mut TxContext) {
    let current_time_ms = clock::timestamp_ms(clock);
    let elapsed_ms = current_time_ms - user_status.last_check_in_ms;
    assert!(elapsed_ms >= user_status.timeout_threshold_ms, E_NOT_TIMEOUT);

    let total_balance = balance::value(&user_status.stored_balance);
    assert!(total_balance > 0, E_INSUFFICIENT_BALANCE);

    // 计算触发奖励（1%）
    let reward_amount = total_balance / TRIGGER_REWARD_PERCENT;
    let transfer_amount = total_balance - reward_amount;

    // 发送加密提示语给收款人
    let message_obj = Message {
        id: object::new(ctx),
        content: user_status.encrypted_message,
    };
    transfer::public_transfer(message_obj, user_status.transfer_recipient);

    // 转账给收款人
    let transfer_coin = coin::from_balance(balance::split(&mut user_status.stored_balance, transfer_amount), ctx);
    transfer::public_transfer(transfer_coin, user_status.transfer_recipient);

    // 给触发者奖励
    let reward_coin = coin::from_balance(balance::withdraw_all(&mut user_status.stored_balance), ctx);
    transfer::public_transfer(reward_coin, tx_context::sender(ctx));
}

// 更新设置
public entry fun update_settings(
    user_status: &mut UserStatus,
    timeout_threshold_ms: u64,
    encrypted_message: String,
    transfer_recipient: address,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == user_status.owner, E_NOT_OWNER);
    user_status.timeout_threshold_ms = timeout_threshold_ms;
    user_status.encrypted_message = encrypted_message;
    user_status.transfer_recipient = transfer_recipient;
}

// 追加资金
public entry fun add_funds(
    user_status: &mut UserStatus,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == user_status.owner, E_NOT_OWNER);
    balance::join(&mut user_status.stored_balance, coin::into_balance(payment));
}

// 获取用户状态信息
public fun get_user_status(
    user_status: &UserStatus,
): (address, u64, u64, String, address, u64) {
    (
        user_status.owner,
        user_status.last_check_in_ms,
        user_status.timeout_threshold_ms,
        user_status.encrypted_message,
        user_status.transfer_recipient,
        balance::value(&user_status.stored_balance),
    )
}

#[test_only]
public fun get_message_content(message: &Message): String {
    message.content
}

