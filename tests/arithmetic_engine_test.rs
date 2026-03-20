// Integration tests for the arithmetic engine

use rune_runtime::arithmetic::eval_arithmetic;

#[test]
fn test_simple() {
    assert_eq!(eval_arithmetic("1 + 1").unwrap(), 2.0);
    assert_eq!(eval_arithmetic("2 * 3").unwrap(), 6.0);
    assert_eq!(eval_arithmetic("4 / 2").unwrap(), 2.0);
    assert_eq!(eval_arithmetic("5 - 3").unwrap(), 2.0);
}

#[test]
fn test_paren() {
    assert_eq!(eval_arithmetic("2 * (3 + 4)").unwrap(), 14.0);
    assert_eq!(eval_arithmetic("(1 + 2) * 3").unwrap(), 9.0);
}

#[test]
fn test_negative() {
    assert_eq!(eval_arithmetic("-1 + 2").unwrap(), 1.0);
    assert_eq!(eval_arithmetic("-(2 + 3)").unwrap(), -5.0);
}

#[test]
fn test_complex() {
    assert_eq!(eval_arithmetic("1 + 2 * 3 - 4 / 2").unwrap(), 5.0);
    assert_eq!(eval_arithmetic("(1 + 2) * (3 - 4 / 2)").unwrap(), 3.0);
}

