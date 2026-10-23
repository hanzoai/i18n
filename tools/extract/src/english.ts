import ts from 'typescript'

import { text } from './jsx.ts'

/**
 * The English a file asks to have translated, where the English IS the key:
 * `t('Pricing')`, `t("Hanzo's Terms")`, `t(`Sign in`)`, `phrase('About Us')`,
 * and both arms of `t(open ? 'Close' : 'Open')`; and the children of the element
 * that translates them, `<T>Pricing</T>` or `<T values={{ n }}>{'{n} tasks'}</T>`,
 * when the file imports it from `@hanzo/i18n/react` (`tags` are the names it is
 * exported under).
 *
 * Read from the syntax tree, not by pattern: a sentence carries apostrophes, colons
 * and both kinds of quote, and a `t('…')` written inside a comment or a doc example
 * is not a request for a translation. What is not a literal — `t(label)` — is not
 * here; the literal is wherever `label` was written, inside `phrase(…)`.
 */
export function english(
  code: string,
  file: string,
  calls: readonly string[] = ['t', 'phrase'],
  tags: readonly string[] = ['T'],
): string[] {
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX : /\.jsx$/.test(file) ? ts.ScriptKind.JSX : /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS
  const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, false, kind)
  const named = new Set(calls)
  const elements = bound(tree, tags)
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.arguments.length > 0 && named.has(callee(node.expression))) {
      found.push(...literals(node.arguments[0]))
    }
    if (ts.isJsxElement(node) && elements.has(tag(node.openingElement.tagName))) {
      found.push(...children(node.children))
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

/** Where the translating element comes from. */
const MODULE = '@hanzo/i18n/react'

/**
 * The names this file gives the module's elements: `T` from `import { T }`, `Say`
 * from `import { T as Say }`, `i18n.T` from `import * as i18n`. An element of the same
 * name the file defines itself, or imports from anywhere else, is not one: hanzo.ai
 * draws syntax tokens with a local `<T k="key">import</T>`.
 */
function bound(tree: ts.SourceFile, tags: readonly string[]): Set<string> {
  const names = new Set<string>()
  for (const statement of tree.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== MODULE) {
      continue
    }
    const clause = statement.importClause
    const bindings = clause?.namedBindings
    if (!clause || clause.isTypeOnly || !bindings) {
      continue
    }
    if (ts.isNamespaceImport(bindings)) {
      tags.forEach((name) => names.add(`${bindings.name.text}.${name}`))
      continue
    }
    for (const element of bindings.elements) {
      if (!element.isTypeOnly && tags.includes((element.propertyName ?? element.name).text)) {
        names.add(element.name.text)
      }
    }
  }
  return names
}

/** `T` in `<T>`, `i18n.T` in `<i18n.T>`. */
function tag(name: ts.JsxTagNameExpression): string {
  if (ts.isIdentifier(name)) {
    return name.text
  }
  if (ts.isPropertyAccessExpression(name) && ts.isIdentifier(name.expression)) {
    return `${name.expression.text}.${name.name.text}`
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
 * The key an element's children make: its JSX text as the compiler hands it over
 * (`text`), or the literal in its one pair of braces. Indentation around a child is
 * no child, nor is a comment in braces; anything else beside it makes the children a
 * list, which is not a key.
 */
function children(nodes: ts.NodeArray<ts.JsxChild>): string[] {
  const kept = nodes.filter((node) => (ts.isJsxText(node) ? text(node.text) !== '' : !ts.isJsxExpression(node) || node.expression !== undefined))
  if (kept.length !== 1) {
    return []
  }
  const [only] = kept
  if (ts.isJsxText(only)) {
    return [text(only.text)]
  }
  return ts.isJsxExpression(only) && only.expression && !only.dotDotDotToken ? literals(only.expression) : []
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
