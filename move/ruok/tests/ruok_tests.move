#[allow(unused_use,lint(public_entry))]
#[test_only]
module ruok::ruok_tests;

use std::string::utf8;
use sui::test_scenario::{Self, Scenario};
use sui::coin::{Self, Coin};
use sui::sui::SUI;
use sui::clock::{Self, Clock};
use sui::test_utils;
use ruok::ruok::{Self, UserStatus};

const OWNER: address = @0xA;
const RECIPIENT: address = @0xB;
const TRIGGER_USER: address = @0xC;

#[test]
fun test_create_user_status() {
    let mut scenario = test_scenario::begin(OWNER);

    // 初始化 Registry
    test_scenario::next_tx(&mut scenario, OWNER);
    ruok::init_registry(test_scenario::ctx(&mut scenario));

    // 创建测试币和用户状态
    test_scenario::next_tx(&mut scenario, OWNER);
    let coin = coin::mint_for_testing<SUI>(1000, test_scenario::ctx(&mut scenario));
    let mut clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    clock::set_for_testing(&mut clock, 1000);
    let mut registry = test_scenario::take_shared<ruok::Registry>(&scenario);

    ruok::create_user_status(
        86400000, // 24小时 (毫秒)
        utf8(b"encrypted_secret_message"),
        RECIPIENT,
        coin,
        &clock,
        &mut registry,
        test_scenario::ctx(&mut scenario)
    );

    test_scenario::return_shared(registry);

    test_scenario::next_tx(&mut scenario, OWNER);

    let user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let (owner, last_check_in, timeout, message, recipient, balance) =
        ruok::get_user_status(&user_status);

    assert!(owner == OWNER, 0);
    assert!(last_check_in > 0, 1);
    assert!(timeout == 86400000, 2);
    assert!(message == utf8(b"encrypted_secret_message"), 3);
    assert!(recipient == RECIPIENT, 4);
    assert!(balance == 1000, 5);

    test_scenario::return_shared(user_status);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

#[test]
fun test_check_in() {
    let mut scenario = test_scenario::begin(OWNER);

    // 初始化 Registry
    test_scenario::next_tx(&mut scenario, OWNER);
    ruok::init_registry(test_scenario::ctx(&mut scenario));

    // 创建用户状态
    test_scenario::next_tx(&mut scenario, OWNER);
    let coin = coin::mint_for_testing<SUI>(1000, test_scenario::ctx(&mut scenario));
    let clock1 = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    let mut registry = test_scenario::take_shared<ruok::Registry>(&scenario);

    ruok::create_user_status(86400000, utf8(b"test"), RECIPIENT, coin, &clock1, &mut registry, test_scenario::ctx(&mut scenario));

    test_scenario::return_shared(registry);
    clock::destroy_for_testing(clock1);

    // 签到
    test_scenario::next_tx(&mut scenario, OWNER);
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let mut clock2 = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    clock::set_for_testing(&mut clock2, 1000);

    ruok::check_in(&mut user_status, &clock2, test_scenario::ctx(&mut scenario));

    let (_, last_check_in, _, _, _, _) = ruok::get_user_status(&user_status);
    assert!(last_check_in == 1000, 0);

    test_scenario::return_shared(user_status);
    clock::destroy_for_testing(clock2);
    test_scenario::end(scenario);
}

#[test]
fun test_trigger() {
    let mut scenario = test_scenario::begin(OWNER);

    // 初始化 Registry
    test_scenario::next_tx(&mut scenario, OWNER);
    ruok::init_registry(test_scenario::ctx(&mut scenario));

    // 创建转账状态
    test_scenario::next_tx(&mut scenario, OWNER);
    let coin = coin::mint_for_testing<SUI>(1000, test_scenario::ctx(&mut scenario));
    let clock1 = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    let mut registry = test_scenario::take_shared<ruok::Registry>(&scenario);

    ruok::create_user_status(1000, utf8(b"secret"), RECIPIENT, coin, &clock1, &mut registry, test_scenario::ctx(&mut scenario));

    test_scenario::return_shared(registry);
    clock::destroy_for_testing(clock1);

    // 签到
    test_scenario::next_tx(&mut scenario, OWNER);
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let mut clock2 = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    clock::set_for_testing(&mut clock2, 500);
    ruok::check_in(&mut user_status, &clock2, test_scenario::ctx(&mut scenario));

    test_scenario::return_shared(user_status);

    // 触发转账
    test_scenario::next_tx(&mut scenario, TRIGGER_USER);
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    clock::set_for_testing(&mut clock2, 2000);

    ruok::trigger(&mut user_status, &clock2, test_scenario::ctx(&mut scenario));

    // 检查余额是否清零
    let (_, _, _, _, _, balance) = ruok::get_user_status(&user_status);
    assert!(balance == 0, 0);

    test_scenario::return_shared(user_status);

    // 检查接收者是否收到币 (应该是 99% = 990)
    test_scenario::next_tx(&mut scenario, RECIPIENT);
    let received_coin = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
    assert!(coin::value(&received_coin) == 990, 1);

    test_scenario::return_to_sender(&scenario, received_coin);

    // 检查触发者是否收到奖励 (1% = 10)
    test_scenario::next_tx(&mut scenario, TRIGGER_USER);
    let reward_coin = test_scenario::take_from_sender<Coin<SUI>>(&scenario);
    assert!(coin::value(&reward_coin) == 10, 2);

    test_scenario::return_to_sender(&scenario, reward_coin);
    clock::destroy_for_testing(clock2);
    test_scenario::end(scenario);
}

#[test]
fun test_add_funds() {
    let mut scenario = test_scenario::begin(OWNER);

    // 初始化 Registry
    test_scenario::next_tx(&mut scenario, OWNER);
    ruok::init_registry(test_scenario::ctx(&mut scenario));

    // 创建用户状态
    test_scenario::next_tx(&mut scenario, OWNER);
    let coin = coin::mint_for_testing<SUI>(1000, test_scenario::ctx(&mut scenario));
    let clock = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    let mut registry = test_scenario::take_shared<ruok::Registry>(&scenario);

    ruok::create_user_status(86400000, utf8(b"test"), RECIPIENT, coin, &clock, &mut registry, test_scenario::ctx(&mut scenario));

    test_scenario::return_shared(registry);

    // 追加资金
    test_scenario::next_tx(&mut scenario, OWNER);
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let additional_coin = coin::mint_for_testing<SUI>(500, test_scenario::ctx(&mut scenario));

    ruok::add_funds(&mut user_status, additional_coin, test_scenario::ctx(&mut scenario));

    let (_, _, _, _, _, balance) = ruok::get_user_status(&user_status);
    assert!(balance == 1500, 0);

    test_scenario::return_shared(user_status);
    clock::destroy_for_testing(clock);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = 1)]
fun test_trigger_before_timeout() {
    let mut scenario = test_scenario::begin(OWNER);

    // 初始化 Registry
    test_scenario::next_tx(&mut scenario, OWNER);
    ruok::init_registry(test_scenario::ctx(&mut scenario));

    // 创建用户状态
    test_scenario::next_tx(&mut scenario, OWNER);
    let coin = coin::mint_for_testing<SUI>(1000, test_scenario::ctx(&mut scenario));
    let clock1 = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    let mut registry = test_scenario::take_shared<ruok::Registry>(&scenario);

    ruok::create_user_status(1000, utf8(b"test"), RECIPIENT, coin, &clock1, &mut registry, test_scenario::ctx(&mut scenario));

    test_scenario::return_shared(registry);
    clock::destroy_for_testing(clock1);

    // 签到
    test_scenario::next_tx(&mut scenario, OWNER);
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let mut clock2 = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    clock::set_for_testing(&mut clock2, 500);
    ruok::check_in(&mut user_status, &clock2, test_scenario::ctx(&mut scenario));

    test_scenario::return_shared(user_status);

    // 尝试在超时前触发 - 应该失败
    test_scenario::next_tx(&mut scenario, TRIGGER_USER);
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    clock::set_for_testing(&mut clock2, 800);
    ruok::trigger(&mut user_status, &clock2, test_scenario::ctx(&mut scenario));

    test_scenario::return_shared(user_status);
    clock::destroy_for_testing(clock2);
    test_scenario::end(scenario);
}

#[test]
#[expected_failure(abort_code = 0)]
fun test_check_in_wrong_owner() {
    let mut scenario = test_scenario::begin(OWNER);

    // 初始化 Registry
    test_scenario::next_tx(&mut scenario, OWNER);
    ruok::init_registry(test_scenario::ctx(&mut scenario));

    // 创建用户状态
    test_scenario::next_tx(&mut scenario, OWNER);
    let coin = coin::mint_for_testing<SUI>(1000, test_scenario::ctx(&mut scenario));
    let clock1 = clock::create_for_testing(test_scenario::ctx(&mut scenario));
    let mut registry = test_scenario::take_shared<ruok::Registry>(&scenario);

    ruok::create_user_status(86400000, utf8(b"test"), RECIPIENT, coin, &clock1, &mut registry, test_scenario::ctx(&mut scenario));

    test_scenario::return_shared(registry);
    clock::destroy_for_testing(clock1);

    // 非owner尝试签到 - 应该失败
    test_scenario::next_tx(&mut scenario, TRIGGER_USER);
    let mut user_status = test_scenario::take_shared<UserStatus>(&scenario);
    let clock2 = clock::create_for_testing(test_scenario::ctx(&mut scenario));

    ruok::check_in(&mut user_status, &clock2, test_scenario::ctx(&mut scenario));

    test_scenario::return_shared(user_status);
    clock::destroy_for_testing(clock2);
    test_scenario::end(scenario);
}