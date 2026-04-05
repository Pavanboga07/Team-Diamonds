// ============================================================
//  parser.rs — Port of engine/parser.js
//
//  Two-pass: tokens → RPN (shunting-yard) → AST
// ============================================================

use crate::tokenizer::Token;

// ─── AST ────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub enum AstNode {
    NumberLiteral(i64),
    Variable(char),
    UnaryExpr {
        arg: Box<AstNode>,
    },
    BinaryExpr {
        op: char,
        left: Box<AstNode>,
        right: Box<AstNode>,
    },
}

#[derive(Debug, Clone)]
pub struct EquationAst {
    pub left: AstNode,
    pub right: AstNode,
}

// ─── Helpers ────────────────────────────────────────────────

fn is_open(c: char) -> bool {
    c == '(' || c == '['
}

fn matching_open(close: char) -> char {
    match close {
        ')' => '(',
        ']' => '[',
        _ => panic!("Not a close paren"),
    }
}

fn precedence(op: &str) -> i32 {
    match op {
        "u-" => 3,
        "*" | "/" => 2,
        "+" | "-" => 1,
        _ => panic!("Unknown operator: {}", op),
    }
}

fn is_right_assoc(op: &str) -> bool {
    op == "u-"
}

// Represent operators on the stack as a string (to distinguish 'u-' from '-')
#[derive(Debug, Clone)]
enum StackOp {
    Op(String),
    Paren(char),
}

fn rewrite_unary_minus(tokens: &[Token]) -> Vec<Token> {
    let mut out = Vec::with_capacity(tokens.len());

    for (i, t) in tokens.iter().enumerate() {
        if let Token::Op('-') = t {
            let prev = out.last();
            let unary = match prev {
                None => true,
                Some(Token::Op(c)) if *c != ')' => true,
                Some(Token::Paren(p)) if is_open(*p) => true,
                Some(Token::Op('=')) => true,
                _ => false,
            };
            if unary {
                out.push(Token::UnaryMinus);
                continue;
            }
        }
        out.push(t.clone());
    }
    out
}

fn op_label(t: &Token) -> String {
    match t {
        Token::UnaryMinus => "u-".to_string(),
        Token::Op(c) => c.to_string(),
        _ => panic!("Not an op token"),
    }
}

fn to_rpn(tokens: &[Token]) -> Result<Vec<Token>, String> {
    let input = rewrite_unary_minus(tokens);
    let mut output: Vec<Token> = Vec::new();
    let mut ops: Vec<StackOp> = Vec::new();

    for t in &input {
        match t {
            Token::Number(_) | Token::Ident(_) => {
                output.push(t.clone());
            }

            Token::Paren(c) if is_open(*c) => {
                ops.push(StackOp::Paren(*c));
            }

            Token::Paren(close) => {
                let expected = matching_open(*close);
                let mut found = false;

                while let Some(top) = ops.last() {
                    match top {
                        StackOp::Paren(p) if *p == expected => {
                            ops.pop();
                            found = true;
                            break;
                        }
                        StackOp::Paren(_) => {
                            return Err("Mismatched brackets.".to_string());
                        }
                        StackOp::Op(op) => {
                            let tok = if op == "u-" {
                                Token::UnaryMinus
                            } else {
                                Token::Op(op.chars().next().unwrap())
                            };
                            output.push(tok);
                            ops.pop();
                        }
                    }
                }

                if !found {
                    return Err(format!("Mismatched closing bracket '{}'", close));
                }
            }

            Token::Op('=') => {
                return Err("'=' is not allowed inside an expression.".to_string());
            }

            Token::UnaryMinus | Token::Op(_) => {
                let o1 = op_label(t);
                let p1 = precedence(&o1);

                while let Some(top) = ops.last() {
                    match top {
                        StackOp::Paren(_) => break,
                        StackOp::Op(o2) => {
                            let p2 = precedence(o2);
                            let pop = if is_right_assoc(&o1) { p1 < p2 } else { p1 <= p2 };
                            if !pop {
                                break;
                            }
                            let tok = if o2 == "u-" {
                                Token::UnaryMinus
                            } else {
                                Token::Op(o2.chars().next().unwrap())
                            };
                            output.push(tok);
                            ops.pop();
                        }
                    }
                }

                ops.push(StackOp::Op(o1));
            }

            other => {
                return Err(format!("Unexpected token in expression: {:?}", other));
            }
        }
    }

    while let Some(top) = ops.pop() {
        match top {
            StackOp::Paren(_) => return Err("Mismatched opening bracket.".to_string()),
            StackOp::Op(op) => {
                let tok = if op == "u-" {
                    Token::UnaryMinus
                } else {
                    Token::Op(op.chars().next().unwrap())
                };
                output.push(tok);
            }
        }
    }

    Ok(output)
}

fn rpn_to_ast(rpn: &[Token]) -> Result<AstNode, String> {
    let mut stack: Vec<AstNode> = Vec::new();

    for t in rpn {
        match t {
            Token::Number(n) => stack.push(AstNode::NumberLiteral(*n)),
            Token::Ident(c) => stack.push(AstNode::Variable(*c)),

            Token::UnaryMinus => {
                let arg = stack.pop().ok_or("Unary '-' missing operand.")?;
                stack.push(AstNode::UnaryExpr { arg: Box::new(arg) });
            }

            Token::Op(op) if matches!(*op, '+' | '-' | '*' | '/') => {
                let right = stack.pop().ok_or_else(|| format!("Op '{}' missing right operand.", op))?;
                let left  = stack.pop().ok_or_else(|| format!("Op '{}' missing left operand.",  op))?;
                stack.push(AstNode::BinaryExpr {
                    op: *op,
                    left:  Box::new(left),
                    right: Box::new(right),
                });
            }

            other => return Err(format!("Unexpected token in RPN: {:?}", other)),
        }
    }

    if stack.len() != 1 {
        return Err("Invalid expression: leftover operands after parsing.".to_string());
    }

    Ok(stack.pop().unwrap())
}

fn split_on_equals(tokens: &[Token]) -> Result<(&[Token], &[Token]), String> {
    let indexes: Vec<usize> = tokens
        .iter()
        .enumerate()
        .filter(|(_, t)| matches!(t, Token::Op('=')))
        .map(|(i, _)| i)
        .collect();

    if indexes.len() != 1 {
        return Err("Equation must contain exactly one '='.".to_string());
    }

    let idx = indexes[0];
    let left  = &tokens[..idx];
    let right = &tokens[idx + 1..];

    if left.is_empty() || right.is_empty() {
        return Err("Equation must have expressions on both sides of '='.".to_string());
    }

    Ok((left, right))
}

fn parse_expression(tokens: &[Token]) -> Result<AstNode, String> {
    let rpn = to_rpn(tokens)?;
    rpn_to_ast(&rpn)
}

pub fn parse_equation(tokens: &[Token]) -> Result<EquationAst, String> {
    let (left_toks, right_toks) = split_on_equals(tokens)?;
    let left  = parse_expression(left_toks)?;
    let right = parse_expression(right_toks)?;
    Ok(EquationAst { left, right })
}
