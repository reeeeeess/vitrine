// Lists the French texts the interface shows (JSX text, titles, labels, placeholders, notifications,
// and the label/hint/name fields of option lists), for the English dictionary (src/renderer/i18n/en.json)
// and its coverage test. Run: node scripts/i18n-extract.mjs [--missing]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const ATTRIBUTES = new Set(["title", "aria-label", "placeholder", "alt", "label", "hint", "aria-valuetext"]);
const FIELDS = new Set(["label", "hint", "name", "title", "kicker", "reason", "detail"]);
const CALLS = new Set(["notify", "Error", "pauseMessage"]);
/** a capital, an accent or a sentence's punctuation: words, not class names */
const WORDS = /^[A-ZÀ-Ý«]|[À-ÿ]|[…!?.:]$/;

/** a text worth translating: letters, and not code (class names, keys, urls) */
export const isText = (text) => /[A-Za-zÀ-ÿ]{2}/.test(text) && !/^[a-z0-9._:/-]+$/.test(text) && !/^(https?:|vitrine\.|spotify:)/.test(text) && !/^[A-Z0-9_]+$/.test(text) && !/[{}<>]|^\s*[a-z-]+(\[[^\]]*\])?(\s+[a-z-]+(\[[^\]]*\])?)+\s*$/.test(text);
export const clean = (text) => text.replace(/\s+/g, " ").trim();

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    // i18n/: the English itself
    return statSync(path).isDirectory() ? (name === "i18n" ? [] : files(path)) : /\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });
}

export function extract(dirs = ["src/renderer"]) {
  const found = new Map();
  const add = (text, file) => {
    const value = clean(text);
    if (value && isText(value) && !found.has(value)) found.set(value, relative(root, file));
  };
  for (const file of dirs.flatMap((dir) => files(join(root, dir)))) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const strings = (node) => {
      // the plain string parts of an expression: "a", cond ? "a" : "b", `a ${x} b` (the fixed parts)
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text, file);
      else if (ts.isConditionalExpression(node)) [node.whenTrue, node.whenFalse].forEach(strings);
      else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) strings(node.right);
      else if (ts.isParenthesizedExpression(node)) strings(node.expression);
    };
    const visit = (node) => {
      if (ts.isJsxText(node)) add(node.text, file);
      else if (ts.isJsxExpression(node) && node.expression && ts.isJsxElement(node.parent) ) strings(node.expression);
      else if (ts.isJsxAttribute(node) && ATTRIBUTES.has(node.name.getText()) && node.initializer) {
        if (ts.isStringLiteral(node.initializer)) add(node.initializer.text, file);
        else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) strings(node.initializer.expression);
      } else if (ts.isPropertyAssignment(node) && FIELDS.has(node.name.getText().replace(/"/g, ""))) strings(node.initializer);
      else if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && CALLS.has(node.expression.getText()) && node.arguments?.[0]) strings(node.arguments[0]);
      // a text picked by a condition outside JSX ("Traduction…" or "Traduire"), when it reads as a sentence
      else if (ts.isConditionalExpression(node) && !ts.isJsxExpression(node.parent))
        for (const branch of [node.whenTrue, node.whenFalse]) if (ts.isStringLiteral(branch) && WORDS.test(branch.text)) add(branch.text, file);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return found;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const found = extract();
  if (process.argv.includes("--missing")) {
    const dictionary = JSON.parse(readFileSync(join(root, "src/renderer/i18n/en.json"), "utf8"));
    const missing = [...found.keys()].filter((text) => !(text in dictionary));
    console.log(JSON.stringify(missing, null, 1));
    console.error(`${missing.length} missing of ${found.size}`);
  } else {
    console.log(JSON.stringify(Object.fromEntries(found), null, 1));
    console.error(`${found.size} texts`);
  }
}
