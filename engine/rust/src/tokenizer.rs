// ============================================================
//  tokenizer.rs — Port of engine/tokenizer.js
//
//  Converts an equation string into a flat Vec<Token>.
//  Handles:
//    - integers (multi-digit)
//    - single-letter variables
//    - operators: + - * / =
//    - brackets: ( ) [ ]
//    - implicit multiplication insertion (10x → 10 * x, xy → x * y)
// ============================================================

use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    Number(i64),
    Ident(char),
    Op(char),    // '+' '-' '*' '/' '='
    Paren(char), // '(' ')' '[' ']'
    UnaryMinus,  // synthetic 'u-'
}

impl fmt::Display for Token {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Token::Number(n) => write!(f, "{}", n),
            Token::Ident(c) => write!(f, "{}", c),
            Token::Op(c) => write!(f, "{}", c),
            Token::Paren(c) => write!(f, "{}", c),
            Token::UnaryMinus => write!(f, "u-"),
        }
    }
}

fn is_open_bracket(c: char) -> bool {
    c == '(' || c == '['
}

fn is_close_bracket(c: char) -> bool {
    c == ')' || c == ']'
}

fn is_op(c: char) -> bool {
    matches!(c, '+' | '-' | '*' | '/' | '=')
}

fn is_atom_end(t: &Token) -> bool {
    matches!(t, Token::Number(_) | Token::Ident(_) | Token::Paren(')') | Token::Paren(']'))
}

fn is_atom_start(t: &Token) -> bool {
    matches!(
        t,
        Token::Number(_) | Token::Ident(_) | Token::Paren('(') | Token::Paren('[')
    )
}

fn insert_implicit_mul(tokens: Vec<Token>) -> Vec<Token> {
    let mut out = Vec::with_capacity(tokens.len() * 2);

    for i in 0..tokens.len() {
        let cur = &tokens[i];
        out.push(cur.clone());

        if let Some(next) = tokens.get(i + 1) {
            // Skip if current or next is '='
            if matches!(cur, Token::Op('=')) || matches!(next, Token::Op('=')) {
                continue;
            }
            if is_atom_end(cur) && is_atom_start(next) {
                out.push(Token::Op('*'));
            }
        }
    }
    out
}

pub fn tokenize_equation(input: &str) -> Result<Vec<Token>, String> {
    let chars: Vec<char> = input.chars().collect();
    let mut tokens: Vec<Token> = Vec::new();
    let mut i = 0;

    while i < chars.len() {
        let ch = chars[i];

        if ch.is_whitespace() {
            i += 1;
            continue;
        }

        if is_op(ch) {
            tokens.push(Token::Op(ch));
            i += 1;
            continue;
        }

        if is_open_bracket(ch) || is_close_bracket(ch) {
            tokens.push(Token::Paren(ch));
            i += 1;
            continue;
        }

        if ch.is_ascii_digit() {
            let start = i;
            while i < chars.len() && chars[i].is_ascii_digit() {
                i += 1;
            }
            let raw: String = chars[start..i].iter().collect();
            let value: i64 = raw
                .parse()
                .map_err(|_| format!("Invalid integer literal: {}", raw))?;
            tokens.push(Token::Number(value));
            continue;
        }

        if ch.is_ascii_alphabetic() {
            tokens.push(Token::Ident(ch));
            i += 1;
            continue;
        }

        return Err(format!("Unexpected character '{}' at position {}", ch, i));
    }

    Ok(insert_implicit_mul(tokens))
}
