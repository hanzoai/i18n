import ts from 'typescript'

/**
 * The English a file asks to have translated, where the English IS the key:
 * `t('Pricing')`, `t("Hanzo's Terms")`, `t(`Sign in`)`, `phrase('About Us')`,
 * and both arms of `t(open ? 'Close' : 'Open')`.
 *
 * Read from the syntax tree, not by pattern: a sentence carries apostrophes, colons
 * and both kinds of quote, and a `t('…')` written inside a comment or a doc example
 * is not a request for a translation. What is not a literal — `t(label)` — is not
 * here; the literal is wherever `label` was written, inside `phrase(…)`.
 */
export function english(code: string, file: string, calls: readonly string[] = ['t', 'phrase']): string[] {
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX : /\.jsx$/.test(file) ? ts.ScriptKind.JSX : /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS
  const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, false, kind)
  const named = new Set(calls)
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.arguments.length > 0 && named.has(callee(node.expression))) {
      found.push(...literals(node.arguments[0]))
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return found
}

/** `t` in `t(…)`, `i18n.t(…)` and `this.t(…)`. */
function callee(expression: ts.Expression): string {
  if (ts.isIdentifier(expression)) {
    return expression.text
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text
  }
  return ''
}

/** Every literal an argument can be: a string, a template with no substitution, either arm of a choice. */
function literals(node: ts.Expression): string[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return [node.text]
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return literals(node.expression)
  }
  if (ts.isConditionalExpression(node)) {
    return [...literals(node.whenTrue), ...literals(node.whenFalse)]
  }
  if (ts.isBinaryExpression(node) && (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
    return [...literals(node.left), ...literals(node.right)]
  }
  return []
}

/**
 * The English catalog after a scan: every key found, its English its own text.
 *
 * Without `prune`, nothing is removed, so several codebases can be scanned in turn.
 * With it, the catalog is exactly what was found: a scan of EVERY codebase that reads
 * the catalog says what nobody asks for any more.
 */
export function catalogue(existing: Readonly<Record<string, string>>, found: readonly string[], prune: boolean): Record<string, string> {
  const out: Record<string, string> = prune ? {} : { ...existing }
  for (const key of found) {
    out[key] = existing[key] ?? key
  }
  return out
}
