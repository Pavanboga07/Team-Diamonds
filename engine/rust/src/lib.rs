// ============================================================
//  lib.rs — WASM entry point
//
//  Exposes one function to JavaScript:
//
//    solve_equation(equation: &str, constraints_json: &str, max_results: u32) -> JsValue
//
//  Returns a JSON string that is either:
//    - An array of solution objects: [{"x":4,"y":2}, ...]
//    - A plain error/message string: "No whole-number solutions exist."
// ============================================================

mod tokenizer;
mod parser;
mod normalizer;
mod constraints;
mod solver;

use std::collections::HashMap;
use wasm_bindgen::prelude::*;

fn gcd(a: i64, b: i64) -> i64 {
    let (mut a, mut b) = (a.abs(), b.abs());
    while b != 0 { let t = a % b; a = b; b = t; }
    a
}

/// Main exported function — mirrors the JS `solveEquation` facade exactly.
#[wasm_bindgen]
pub fn solve_equation(equation: &str, constraints_json: &str, max_results: u32) -> String {
    match solve_inner(equation, constraints_json, max_results as usize) {
        Ok(result) => result,
        Err(e) => format!("Error: {}", e),
    }
}

fn solve_inner(equation: &str, constraints_json: &str, max_results: usize) -> Result<String, String> {
    if equation.trim().is_empty() {
        return Ok("Equation is required.".to_string());
    }

    let constraints = constraints::parse_constraints_json(constraints_json)?;

    // ── Tokenize → Parse → Normalize ─────────────────────────
    let tokens     = tokenizer::tokenize_equation(equation)?;
    let ast        = parser::parse_equation(&tokens)?;
    let mut norm   = normalizer::normalize_equation(&ast)?;

    // ── No variables ─────────────────────────────────────────
    if norm.coefficients.is_empty() {
        return Ok(if norm.constant == 0 {
            "Infinite solutions: the equation is always true (both sides are equal).".to_string()
        } else {
            "No solutions: the equation is a contradiction (e.g. 5 = 3).".to_string()
        });
    }

    // ── Flip signs if constant is negative ───────────────────
    if norm.constant < 0 {
        norm.coefficients = norm.coefficients.into_iter().map(|(k, v)| (k, -v)).collect();
        norm.constant = -norm.constant;
    }

    // ── GCD divisibility pre-check ───────────────────────────
    let coeff_vals: Vec<i64> = norm.coefficients.values().cloned().collect();
    let g = coeff_vals.iter().fold(0i64, |a, &b| gcd(a, b));
    if g > 0 && norm.constant % g != 0 {
        return Ok(format!(
            "No whole-number solutions exist. (The right-hand side {} is not divisible by {}, the GCD of all coefficients.)",
            norm.constant, g
        ));
    }

    // ── Guard: negative coefficients ─────────────────────────
    let neg_vars: Vec<String> = norm.coefficients
        .iter()
        .filter(|(_, &v)| v < 0)
        .map(|(k, _)| k.to_string())
        .collect();

    if !neg_vars.is_empty() {
        return Ok(format!(
            "Unsupported: variables {} have a net negative coefficient after simplification. \
             Try rewriting so all variable terms are on the left side with positive coefficients.",
            neg_vars.join(", ")
        ));
    }

    // ── Solve ─────────────────────────────────────────────────
    let options = solver::SolverOptions { max_results };
    let solutions = solver::solve_normalized(&norm, &constraints, &options);

    if solutions.is_empty() {
        return Ok("No whole-number solutions exist.".to_string());
    }

    let capped: Vec<&HashMap<char, i64>> = solutions.iter().take(max_results).collect();

    // Serialize to JSON: [{"x":4,"y":2}, ...]
    let json = serde_json::to_string(&capped.iter().map(|sol| {
        sol.iter().map(|(k, v)| (k.to_string(), v)).collect::<HashMap<String, &i64>>()
    }).collect::<Vec<_>>())
    .map_err(|e| format!("JSON serialization error: {}", e))?;

    Ok(json)
}
