import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

const root = resolve('src/lib');
const collector = resolve(root, 'telemetry/collector.ts');
const operators = new Set([
  '+',
  '-',
  '*',
  '/',
  '%',
  '**',
  '<',
  '<=',
  '>',
  '>=',
  '===',
  '!==',
]);

export function gameplayTracing(): Plugin {
  const modules = new Set<string>();
  function visit(file: string) {
    if (modules.has(file) || file.includes('/telemetry/')) return;
    modules.add(file);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    for (const statement of source.statements) {
      if (
        (!ts.isImportDeclaration(statement) &&
          !ts.isExportDeclaration(statement)) ||
        !statement.moduleSpecifier ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const specifier = statement.moduleSpecifier.text;
      if (specifier.startsWith('.') && !specifier.endsWith('.json'))
        visit(resolve(dirname(file), `${specifier}.ts`));
    }
  }
  visit(resolve(root, 'game-engine.ts'));
  const build = createHash('sha256');
  build.update(readFileSync(resolve('tools/trace-instrumentation.ts')));
  for (const file of [...modules].sort())
    build.update(relative(root, file)).update(readFileSync(file));
  return {
    name: 'gameplay-tracing',
    enforce: 'pre',
    config: () => ({
      define: {
        'import.meta.env.PUBLIC_ENGINE_BUILD': JSON.stringify(
          build.digest('hex'),
        ),
      },
    }),
    transform(code, id) {
      if (
        !modules.has(id) ||
        id.endsWith('/seeded-text.ts') ||
        id.endsWith('/seeded-rng.ts')
      )
        return;
      const source = ts.createSourceFile(
        id,
        code,
        ts.ScriptTarget.Latest,
        true,
      );
      const edits: Array<{ start: number; end: number; text: string }> = [];
      function rewrite(node: ts.Node): string {
        const start = node.getStart(source);
        const children: Array<{ start: number; end: number; text: string }> =
          [];
        node.forEachChild((child) => {
          children.push({
            start: child.getStart(source),
            end: child.end,
            text: rewrite(child),
          });
        });
        let text = code.slice(start, node.end);
        for (const child of children.reverse())
          text =
            text.slice(0, child.start - start) +
            child.text +
            text.slice(child.end - start);
        const location = source.getLineAndCharacterOfPosition(start);
        const rule = JSON.stringify(
          `${relative(root, id)}:${location.line + 1}:${location.character + 1}`,
        );
        const expression = JSON.stringify(code.slice(start, node.end));
        if (
          ts.isBinaryExpression(node) &&
          ['+=', '-=', '*=', '/=', '%='].includes(
            node.operatorToken.getText(source),
          )
        ) {
          const operator = node.operatorToken.getText(source).slice(0, -1);
          const calculate = (left: string) =>
            `((__left, __right) => __traceCalculation(${rule}, ${expression}, [__left, __right], __left ${operator} __right))(${left}, ${rewrite(node.right)})`;
          if (ts.isIdentifier(node.left))
            return `(${node.left.text} = ${calculate(node.left.text)})`;
          if (ts.isPropertyAccessExpression(node.left))
            return `((__object) => __object.${node.left.name.text} = ${calculate(`__object.${node.left.name.text}`)})(${rewrite(node.left.expression)})`;
          if (ts.isElementAccessExpression(node.left))
            return `((__object, __key) => __object[__key] = ${calculate('__object[__key]')})(${rewrite(node.left.expression)}, ${rewrite(node.left.argumentExpression)})`;
        }
        if (
          ts.isBinaryExpression(node) &&
          operators.has(node.operatorToken.getText(source))
        ) {
          const operator = node.operatorToken.getText(source);
          return `((__left, __right) => __traceCalculation(${rule}, ${expression}, [__left, __right], __left ${operator} __right))(${rewrite(node.left)}, ${rewrite(node.right)})`;
        }
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.getText(source) === 'Math' &&
          !node.arguments.some(ts.isSpreadElement)
        ) {
          const args = node.arguments.map((_, index) => `__arg${index}`);
          return `((${args.join(',')}) => __traceCalculation(${rule}, ${expression}, [${args.join(',')}], ${node.expression.getText(source)}(${args.join(',')})))(${node.arguments.map(rewrite).join(',')})`;
        }
        return text;
      }
      for (const statement of source.statements)
        edits.push({
          start: statement.getStart(source),
          end: statement.end,
          text: rewrite(statement),
        });
      let output = code;
      for (const edit of edits.reverse())
        output =
          output.slice(0, edit.start) + edit.text + output.slice(edit.end);
      return {
        code: `import { calculation as __traceCalculation } from ${JSON.stringify(collector)};\n${output}`,
        map: null,
      };
    },
  };
}
