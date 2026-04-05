// ============================================================
//  solver.rs — Port of engine/solver.js
//
//  Backtracking solver for a normalized linear equation:
//    a1*x1 + a2*x2 + ... = constant
//
//  - Non-negative whole-number solutions only
//  - Constraint-aware domain pruning
//  - GCD-based divisibility pruning (key performance win)
//  - Variables ordered by descending coefficient (smaller branching)
// ============================================================

use std::collections::HashMap;
use crate::normalizer::LinearForm;
use crate::constraints::{Constraints, domain_for, satisfies_all};

fn gcd(a: i64, b: i64) -> i64 {
    let (mut a, mut b) = (a.abs(), b.abs());
    while b != 0 {
        let t = a % b;
        a = b;
        b = t;
    }
    a
}

fn gcd_all(values: &[i64]) -> i64 {
    values.iter().fold(0, |g, &v| gcd(g, v))
}

/// Solve a 1-variable sub-problem: a*x = c
fn solve_one(var: char, a: i64, c: i64) -> Option<HashMap<char, i64>> {
    if c % a != 0 { return None; }
    let x = c / a;
    if x < 0 { return None; }
    let mut m = HashMap::new();
    m.insert(var, x);
    Some(m)
}

pub struct SolverOptions {
    pub max_results: usize,
}

/// Solve the normalized equation with optional constraints.
/// Returns up to `max_results` solutions.
pub fn solve_normalized(
    eq: &LinearForm,
    constraints: &Constraints,
    options: &SolverOptions,
) -> Vec<HashMap<char, i64>> {
    let max_results = options.max_results;

    // Collect and sort variables: larger coefficient first (smaller branching factor).
    // Tie-break alphabetically for deterministic output.
    let mut variables: Vec<char> = eq.coefficients.keys().cloned().collect();
    variables.sort_by(|&a, &b| {
        let ca = eq.coefficients[&a];
        let cb = eq.coefficients[&b];
        cb.cmp(&ca).then(a.cmp(&b))
    });

    if variables.is_empty() {
        return vec![];
    }

    let coeffs = &eq.coefficients;
    let constant = eq.constant;

    // 1-variable fast path
    if variables.len() == 1 {
        let v = variables[0];
        let a = coeffs[&v];
        match solve_one(v, a, constant) {
            None => return vec![],
            Some(sol) => {
                let dom = domain_for(v, constraints, sol[&v]);
                if sol[&v] < dom.min || sol[&v] > dom.max { return vec![]; }
                if !satisfies_all(&sol, constraints) { return vec![]; }
                return vec![sol];
            }
        }
    }

    let mut solutions: Vec<HashMap<char, i64>> = Vec::new();
    let mut partial: HashMap<char, i64> = HashMap::new();

    backtrack(
        0,
        constant,
        &variables,
        coeffs,
        constraints,
        max_results,
        &mut partial,
        &mut solutions,
    );

    solutions
}

#[allow(clippy::too_many_arguments)]
fn backtrack(
    index: usize,
    remaining: i64,
    variables: &[char],
    coeffs: &HashMap<char, i64>,
    constraints: &Constraints,
    max_results: usize,
    partial: &mut HashMap<char, i64>,
    solutions: &mut Vec<HashMap<char, i64>>,
) {
    if solutions.len() >= max_results { return; }
    if !can_still_solve(index, remaining, variables, coeffs, constraints) { return; }

    let v = variables[index];
    let a = coeffs[&v];

    if index == variables.len() - 1 {
        // Last variable: direct compute
        if remaining % a != 0 { return; }
        let x = remaining / a;
        if x < 0 { return; }
        let mut candidate = partial.clone();
        candidate.insert(v, x);
        if satisfies_all(&candidate, constraints) {
            solutions.push(candidate);
        }
        return;
    }

    let hard_max = remaining / a;   // floor division (both non-negative here)
    let dom = domain_for(v, constraints, hard_max);

    let mut x = dom.min;
    while x <= dom.max {
        if solutions.len() >= max_results { break; }
        let next_remaining = remaining - a * x;
        partial.insert(v, x);
        backtrack(index + 1, next_remaining, variables, coeffs, constraints, max_results, partial, solutions);
        x += dom.step;
    }

    partial.remove(&v);
}

/// Prune: can variables[index..] still sum to `remaining`?
///
/// Checks:
///  1. min-sum > remaining → impossible
///  2. max-sum < remaining → impossible
///  3. (remaining - min-sum) % gcd(coeffs) ≠ 0 → impossible
fn can_still_solve(
    index: usize,
    remaining: i64,
    variables: &[char],
    coeffs: &HashMap<char, i64>,
    constraints: &Constraints,
) -> bool {
    if remaining < 0 { return false; }

    let mut min_sum = 0i64;
    let mut max_sum = 0i64;
    let mut a_list: Vec<i64> = Vec::new();

    for j in index..variables.len() {
        let v = variables[j];
        let a = coeffs[&v];
        a_list.push(a);

        let hard_max = remaining / a;  // approximate upper bound
        let dom = domain_for(v, constraints, hard_max);

        if dom.is_empty() { return false; }

        min_sum += a * dom.min;
        max_sum += a * dom.max;

        if min_sum > remaining { return false; }
    }

    if remaining < min_sum { return false; }
    if remaining > max_sum { return false; }

    let shifted = remaining - min_sum;
    let g = gcd_all(&a_list);
    if g != 0 && shifted % g != 0 { return false; }

    true
}
