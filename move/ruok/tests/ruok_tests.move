#[test_only]
module ruok::ruok_tests;

use std::string::utf8;
use sui::test_scenario::{Self, Scenario};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::clock::{Self, Clock};
use sui::test_utils;
use ruok::ruok::{Self, UserStatus, Message};

const OWNER: address = @0xA;
const RECIPIENT: address = @0xB;
const TRIGGER_USER: address = @0xC;

#[test]
fun test_create_message_status() {
    let mut scenario = test_scenario::begin(OWNER);
    let ctx = test_scenario::ctx(&mut scenario);
    
    ruok::create_message_status(
        86400000, // 24小时 (毫秒)
        utf8(b"encrypted_secret_message"),
        ctx
    );
    
    test_scenario::next_tx(&mut scenario, OWNER);
    
    let user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let (owner, last_check_in, timeout, trigger_type, message, recipient, balance) = 
        ruok::get_user_status(&user_status);
    
    assert!(owner == OWNER, 0);
    assert!(last_check_in == 0, 1);
    assert!(timeout == 86400000, 2);
    assert!(trigger_type == 1, 3);
    assert!(message == utf8(b"encrypted_secret_message"), 4);
    assert!(balance == 0, 5);
    
    test_scenario::return_shared(user_status);
    test_scenario::end(scenario);
}

#[test]
fun test_create_transfer_status() {
    let mut scenario = test_scenario::begin(OWNER);
    
    // 创建测试币
    test_scenario::next_tx(&mut scenario, OWNER);
    let ctx = test_scenario::ctx(&mut scenario);
    let coin = coin::mint_for_testing<SUI>(1000, ctx);
    
    ruok::create_transfer_status(
        86400000, // 24小时
        RECIPIENT,
        coin,
        ctx
    );
    
    test_scenario::next_tx(&mut scenario, OWNER);
    
    let user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let (owner, _, timeout, trigger_type, _, recipient, balance) = 
        ruok::get_user_status(&user_status);
    
    assert!(owner == OWNER, 0);
    assert!(timeout == 86400000, 1);
    assert!(trigger_type == 2, 2);
    assert!(recipient == RECIPIENT, 3);
    assert!(balance == 1000, 4);
    
    test_scenario::return_shared(user_status);
    test_scenario::end(scenario);
}

#[test]
fun test_check_in() {
    let mut scenario = test_scenario::begin(OWNER);
    let ctx = test_scenario::ctx(&mut scenario);
    
    ruok::create_message_status(86400000, utf8(b"test"), ctx);
    
    test_scenario::next_tx(&mut scenario, OWNER);
    
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    clock::set_for_testing(&mut clock, 1000);
    
    ruok::check_in(&mut user_status, &clock, test_scenario::ctx(&mut scenario));
    
    let (_, last_check_in, _, _, _, _, _) = ruok::get_user_status(&user_status);
    assert!(last_check_in == 1000, 0);
    
    test_scenario::return_shared(user_status);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

#[test]
fun test_trigger_message() {
    let mut scenario = test_scenario::begin(OWNER);
    let ctx = test_scenario::ctx(&mut scenario);
    
    ruok::create_message_status(1000, utf8(b"secret"), ctx);
    
    test_scenario::next_tx(&mut scenario, OWNER);
    
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    
    // 先签到
    clock::set_for_testing(&mut clock, 500);
    ruok::check_in(&mut user_status, &clock, test_scenario::ctx(&mut scenario));
    
    test_scenario::return_shared(user_status);
    
    // 等待超时后触发
    test_scenario::next_tx(&mut scenario, TRIGGER_USER);
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    clock::set_for_testing(&mut clock, 2000); // 超过超时时间
    
    ruok::trigger(&mut user_status, &clock, test_scenario::ctx(&mut scenario));
    
    test_scenario::return_shared(user_status);
    
    // 检查是否收到消息
    test_scenario::next_tx(&mut scenario, TRIGGER_USER);
    let message = test_scenario::take_from_sender<Message>(&scenario);
    
    test_scenario::return_to_sender(&scenario, message);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

#[test]
fun test_trigger_transfer() {
    let mut scenario = test_scenario::begin(OWNER);
    
    // 创建转账状态
    test_scenario::next_tx(&mut scenario, OWNER);
    let ctx = test_scenario::ctx(&mut scenario);
    let coin = coin::mint_for_testing<SUI>(1000, ctx);
    
    ruok::create_transfer_status(1000, RECIPIENT, coin, ctx);
    
    test_scenario::next_tx(&mut scenario, OWNER);
    
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    
    // 签到
    clock::set_for_testing(&mut clock, 500);
    ruok::check_in(&mut user_status, &clock, test_scenario::ctx(&mut scenario));
    
    test_scenario::return_shared(user_status);
    
    // 触发转账
    test_scenario::next_tx(&mut scenario, TRIGGER_USER);
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    clock::set_for_testing(&mut clock, 2000);
    
    ruok::trigger(&mut user_status, &clock, test_scenario::ctx(&mut scenario));
    
    // 检查余额是否清零
    let (_, _, _, _, _, _, balance) = ruok::get_user_status(&user_status);
    assert!(balance == 0, 0);
    
    test_scenario::return_shared(user_status);
    
    // 检查接收者是否收到币
    test_scenario::next_tx(&mut scenario, RECIPIENT);
    let received_coin = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
    assert!(coin::value(&received_coin) == 1000, 1);
    
    test_scenario::return_to_sender(&scenario, received_coin);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

#[test]
fun test_add_funds() {
    let mut scenario = test_scenario::begin(OWNER);
    
    test_scenario::next_tx(&mut scenario, OWNER);
    let ctx = test_scenario::ctx(&mut scenario);
    let coin = coin::mint_for_testing<SUI>(1000, ctx);
    
    ruok::create_transfer_status(86400000, RECIPIENT, coin, ctx);
    
    test_scenario::next_tx(&mut scenario, OWNER);
    
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let additional_coin = coin::mint_for_testing<SUI>(500, test_scenario::ctx(&mut scenario));
    
    ruok::add_funds(&mut user_status, additional_coin, test_scenario::ctx(&mut scenario));
    
    let (_, _, _, _, _, _, balance) = ruok::get_user_status(&user_status);
    assert!(balance == 1500, 0);
    
    test_scenario::return_shared(user_status);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = ruok::ruok::E_NOT_TIMEOUT)]
fun test_trigger_before_timeout() {
    let mut scenario = test_scenario::begin(OWNER);
    let ctx = test_scenario::ctx(&mut scenario);
    
    ruok::create_message_status(1000, utf8(b"test"), ctx);
    
    test_scenario::next_tx(&mut scenario, OWNER);
    
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    
    clock::set_for_testing(&mut clock, 500);
    ruok::check_in(&mut user_status, &clock, test_scenario::ctx(&mut scenario));
    
    // 尝试在超时前触发 - 应该失败
    clock::set_for_testing(&mut clock, 800);
    ruok::trigger(&mut user_status, &clock, test_scenario::ctx(&mut scenario));
    
    test_scenario::return_shared(user_status);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = ruok::ruok::E_NOT_OWNER)]
fun test_check_in_wrong_owner() {
    let mut scenario = test_scenario::begin(OWNER);
    let ctx = test_scenario::ctx(&mut scenario);
    
    ruok::create_message_status(86400000, utf8(b"test"), ctx);
    
    test_scenario::next_tx(&mut scenario, TRIGGER_USER); // 错误的用户
    
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    
    // 非owner尝试签到 - 应该失败
    ruok::check_in(&mut user_status, &clock, test_scenario::ctx(&mut scenario));
    
    test_scenario::return_shared(user_status);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}