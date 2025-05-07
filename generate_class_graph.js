  
// @ts-nocheck
// generate_class_graph.js
// Fast-glob + Babel を使って JS クラスの依存・継承・インスタンス化・集約を解析し、Mermaid 形式で出力します。

const fg = require('fast-glob');
const fs = require('fs');
const pathLib = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

(async () => {
  // 対象パス
  const pattern = ['assets/js/**/*.js'];
  const files = await fg(pattern, { dot: false });

  const classes = new Set();
  const fileToClasses = {};
  const imports = [];
  const inheritances = [];
  const instantiations = [];
  const compositions = [];

  // 第1パス: クラス定義と継承取得
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf-8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['classProperties', 'jsx']
    });
    traverse(ast, {
      ClassDeclaration(path) {
        const className = path.node.id.name;
        classes.add(className);
        fileToClasses[file] = fileToClasses[file] || [];
        fileToClasses[file].push(className);
        if (path.node.superClass && path.node.superClass.type === 'Identifier') {
          inheritances.push({ subclass: className, superclass: path.node.superClass.name });
        }
      }
    });
  }

  // 第2パス: インポート、new式、クラスプロパティ（集約）取得
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf-8');
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['classProperties', 'jsx']
    });
    const myClasses = fileToClasses[file] || [];
    traverse(ast, {
      ImportDeclaration(path) {
        path.node.specifiers.forEach(spec => {
          const importedName = spec.local.name;
          if (classes.has(importedName)) {
            myClasses.forEach(cn => {
              imports.push({ from: cn, to: importedName });
            });
          }
        });
      },
      NewExpression(path) {
        if (path.node.callee.type === 'Identifier') {
          const newName = path.node.callee.name;
          if (classes.has(newName)) {
            // 所属クラスを探索
            const clsPath = path.findParent(p => p.isClassDeclaration());
            if (clsPath && clsPath.node.id) {
              instantiations.push({ from: clsPath.node.id.name, to: newName });
            }
          }
        }
      },
      ClassProperty(path) {
        if (path.node.value && path.node.value.type === 'NewExpression' && path.node.value.callee.type === 'Identifier') {
          const compName = path.node.value.callee.name;
          if (classes.has(compName)) {
            const clsPath = path.findParent(p => p.isClassDeclaration());
            if (clsPath && clsPath.node.id) {
              compositions.push({ from: clsPath.node.id.name, to: compName });
            }
          }
        }
      }
    });
  }

  // Mermaid 初期設定
let mmd = '%%{init:{"flowchart":{"ranker":"tight-tree","nodeSpacing":100,"rankSpacing":70}}}%%\n';
  mmd += 'flowchart TB\n';

  // クラスタ作成 (ディレクトリ単位)
  const groups = {};
  files.forEach(file => {
    (fileToClasses[file] || []).forEach(cn => {
      const dir = pathLib.dirname(file).replace(/\\\\/g, '/');
      groups[dir] = groups[dir] || [];
      groups[dir].push(cn);
    });
  });
  // 重複クラスを排除
  for (const dir in groups) {
    groups[dir] = [...new Set(groups[dir])];
  }
  let idx = 0;
  for (const [dir, clsList] of Object.entries(groups)) {
  mmd += `  subgraph cluster_${idx}["${dir}"]\n`;
    clsList.forEach(cn => {
      mmd += `    ${cn}\n`;
    });
    mmd += '  end\n';
    idx++;
  }

  // エッジ出力
  imports.forEach(e => {
    mmd += `  ${e.from} --> ${e.to}\n`;
  });
  inheritances.forEach(e => {
    mmd += `  ${e.subclass} --|> ${e.superclass}\n`;
  });
  instantiations.forEach(e => {
    mmd += `  ${e.from} --|instantiates| ${e.to}\n`;
  });
  compositions.forEach(e => {
    mmd += `  ${e.from} *-- ${e.to}\n`;
  });

  // ファイル書き込み
  fs.writeFileSync('class_graph.mmd', mmd, 'utf-8');
  console.log('class_graph.mmd を出力しました。');
})();
