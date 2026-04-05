// ============================================================
//  normalizer.rs — Port of engine/normalizer.js
//
//  Converts a parsed equation AST into standard linear form:
//    a1*x1 + a2*x2 + ... = constant
//
//  Only linear operations are supported:
//    +, -, unary -, parentheses, scalar*expr, expr/scalar_const
// ============================================================

use std::collections::HashMap;
use crate::parser::{AstNode, EquationAst};

/// Linear form: sum(coeff[v] * v) = constant
#[derive(Debug, Clone)]
pub struct LinearForm {
    pub coefficients: HashMap<char, i64>,
    pub constant: i64,
}

impl LinearForm {
    fn zero() -> Self {
        LinearForm { coefficients: HashMap::new(), constant: 0 }
    }

    fn from_number(n: i64) -> Self {
        LinearForm { coefficients: HashMap::new(), constant: n }
    }

    fn from_variable(v: char) -> Self {
        let mut c = HashMap::new();
        c.insert(v, 1);
        LinearForm { coefficients: c, constant: 0 }
    }

    fn is_constant(&self) -> bool {
        self.coefficients.is_empty()
    }

    fn negate(self) -> Self {
        LinearForm {
            coefficients: self.coefficients.into_iter().map(|(k, v)| (k, -v)).collect(),
            constant: -self.constant,
        }
    }

    fn add(mut self, other: LinearForm) -> Result<LinearForm, String> {
        let constant = self.constant.checked_add(other.constant)
            .ok_or("Integer overflow in constant.")?;
        for (k, v) in other.coefficients {
            let entry = self.coefficients.entry(k).or_insert(0);
            *entry = entry.checked_add(v).ok_or("Integer overflow in coefficient.")?;
            if *entry == 0 {
                self.coefficients.remove(&k);
            }
        }
        Ok(LinearForm { coefficients: self.coefficients, constant })
    }

    fn sub(self, other: LinearForm) -> Result<LinearForm, String> {
        self.add(other.negate())
    }

    fn scale(self, scalar: i64) -> Result<LinearForm, String> {
        let constant = self.constant.checked_mul(scalar)
            .ok_or("Integer overflow in constant.")?;
        let mut coefficients = HashMap::new();
        for (k, v) in self.coefficients {
            let nv = v.checked_mul(scalar)
                .ok_or("Integer overflow in coefficient.")?;
            if nv != 0 { coefficients.insert(k, nv); }
        }
        Ok(LinearForm { coefficients, constant })
    }

    fn mul(self, other: LinearForm) -> Result<LinearForm, String> {
        if self.is_constant() { return other.scale(self.constant); }
        if other.is_constant() { return self.scale(other.constant); }
        Err("Non-linear term: variable × variable.".to_string())
    }

    fn div(self, denom: LinearForm) -> Result<LinearForm, String> {
        if !denom.is_constant() {
            return Err("Division by a variable/expression is not supported.".to_string());
        }
        let d = denom.constant;
        if d == 0 { return Err("Division by zero.".to_string()); }

        if self.constant % d != 0 {
            return Err("Division produces non-integer constant.".to_string());
        }

        let mut coefficients = HashMap::new();
        for (k, v) in &self.coefficients {
            if v % d != 0 {
                return Err(format!("Division produces non-integer coefficient for {}.", k));
            }
            coefficients.insert(*k, v / d);
        }
        Ok(LinearForm { coefficients, constant: self.constant / d })
    }
}

fn ast_to_linear(node: &AstNode) -> Result<LinearForm, String> {
    match node {
        AstNode::NumberLiteral(n) => Ok(LinearForm::from_number(*n)),
        AstNode::Variable(c)     => Ok(LinearForm::from_variable(*c)),

        AstNode::UnaryExpr { arg } => {
            Ok(ast_to_linear(arg)?.negate())
        }

        AstNode::BinaryExpr { op, left, right } => {
            let l = ast_to_linear(left)?;
            let r = ast_to_linear(right)?;
            match op {
                '+' => l.add(r),
                '-' => l.sub(r),
                '*' => l.mul(r),
                '/' => l.div(r),
                _   => Err(format!("Unsupported binary operator '{}'.", op)),
            }
        }
    }
}

/// Normalize a full equation AST.
///
/// Converts left = right into:
///   (left_coeffs - right_coeffs) * vars = right_const - left_const
pub fn normalize_equation(eq: &EquationAst) -> Result<LinearForm, String> {
    let left  = ast_to_linear(&eq.left)?;
    let right = ast_to_linear(&eq.right)?;

    // Move all variable terms to left, all constants to right:
    //   left_v - right_v = right_c - left_c
    let mut coefficients: HashMap<char, i64> = HashMap::new();

    for (k, v) in &left.coefficients {
        *coefficients.entry(*k).or_insert(0) += v;
    }
    for (k, v) in &right.coefficients {
        *coefficients.entry(*k).or_insert(0) -= v;
    }
    // Remove zeros
    coefficients.retain(|_, v| *v != 0);

    let constant = right.constant.checked_sub(left.constant)
        .ok_or("Integer overflow in constant.")?;

    Ok(LinearForm { coefficients, constant })
}
