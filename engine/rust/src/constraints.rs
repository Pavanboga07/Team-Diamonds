// ============================================================
//  constraints.rs — Port of engine/constraints.js
//
//  Parses & normalizes the variable constraint map, and
//  provides helpers used by the solver during pruning.
// ============================================================

use std::collections::HashMap;
use serde::Deserialize;

/// Per-variable constraint (all fields optional)
#[derive(Debug, Clone, Default, Deserialize)]
pub struct VarConstraint {
    pub min:  Option<i64>,
    pub max:  Option<i64>,
    pub eq:   Option<i64>,
    pub even: Option<bool>,
}

pub type Constraints = HashMap<char, VarConstraint>;

/// Allowed integer domain for a variable during backtracking.
#[derive(Debug, Clone)]
pub struct Domain {
    pub min:  i64,
    pub max:  i64,
    pub step: i64,
}

impl Domain {
    pub fn is_empty(&self) -> bool {
        self.max < self.min
    }
}

/// Normalize a single variable constraint.
///   - Floors min at 0 (non-negative requirement).
///   - `eq` overrides min & max.
///   - Validates min <= max.
pub fn normalize_var_constraint(c: VarConstraint) -> Result<VarConstraint, String> {
    let mut out = VarConstraint::default();

    // Copy fields
    if let Some(min) = c.min { out.min = Some(min); }
    if let Some(max) = c.max { out.max = Some(max); }
    if let Some(eq)  = c.eq  { out.eq  = Some(eq);  }
    if let Some(even) = c.even { out.even = Some(even); }

    // Non-negative floor
    if out.min.unwrap_or(0) < 0 { out.min = Some(0); }
    if let Some(max) = out.max { if max < 0 { out.max = Some(-1); } }
    if let Some(eq)  = out.eq  { if eq  < 0 { out.eq  = Some(-1); } }

    // eq overrides min/max
    if let Some(eq) = out.eq {
        out.min = Some(eq);
        out.max = Some(eq);
    }

    if let (Some(min), Some(max)) = (out.min, out.max) {
        if min > max {
            return Err(format!("Invalid constraint: min ({}) > max ({}).", min, max));
        }
    }

    Ok(out)
}

/// Parse a JSON string `{"x":{"min":1,"max":10}}` → Constraints.
/// Keys must be single characters.
pub fn parse_constraints_json(json: &str) -> Result<Constraints, String> {
    if json.trim().is_empty() || json.trim() == "{}" || json.trim() == "null" {
        return Ok(HashMap::new());
    }

    let raw: HashMap<String, VarConstraint> = serde_json::from_str(json)
        .map_err(|e| format!("Invalid constraints JSON: {}", e))?;

    let mut out = Constraints::new();
    for (key, val) in raw {
        let ch = key.chars().next().ok_or_else(|| "Empty constraint key.".to_string())?;
        out.insert(ch, normalize_var_constraint(val)?);
    }
    Ok(out)
}

/// Compute the integer domain for `variable` given constraints and a hard upper bound
/// derived from the remaining sum (remaining / coeff).
pub fn domain_for(var: char, constraints: &Constraints, hard_max: i64) -> Domain {
    let c = constraints.get(&var);

    let min = c.and_then(|c| c.min).unwrap_or(0);
    let max = {
        let cmax = c.and_then(|c| c.max);
        match cmax {
            Some(cm) => cm.min(hard_max),
            None => hard_max,
        }
    };

    if max < min {
        return Domain { min: 1, max: 0, step: 1 }; // empty
    }

    let even = c.and_then(|c| c.even).unwrap_or(false);
    if !even {
        return Domain { min, max, step: 1 };
    }

    // Adjust to nearest even min
    let adj_min = if min % 2 != 0 { min + 1 } else { min };
    // Adjust to nearest even max
    let adj_max = if max % 2 != 0 { max - 1 } else { max };

    if adj_max < adj_min {
        return Domain { min: 1, max: 0, step: 2 };
    }
    Domain { min: adj_min, max: adj_max, step: 2 }
}

/// Check whether a fully-assigned solution satisfies all constraints.
pub fn satisfies_all(solution: &HashMap<char, i64>, constraints: &Constraints) -> bool {
    for (var, c) in constraints {
        if let Some(&val) = solution.get(var) {
            if let Some(min) = c.min { if val < min { return false; } }
            if let Some(max) = c.max { if val > max { return false; } }
            if let Some(eq)  = c.eq  { if val != eq  { return false; } }
            if c.even.unwrap_or(false) && val % 2 != 0 { return false; }
        }
    }
    true
}
