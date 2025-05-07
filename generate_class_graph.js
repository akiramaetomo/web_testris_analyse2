// @ts-nocheck
// generate_class_graph.js
// Fast-glob + Babel を使って JS クラスの依存・継承・インスタンス化・集約を解析し、Mermaid flowchart 形式で出力します。
//本ツールはディレクトリベースのクラスタリングとしている。
const fg = require('fast-glob');
const fs = require('fs');
const pathLib = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// コマンドラインオプション
const args = process.argv.slice(2);
const withImports = args.includes('--with-imports');

(async () => {
  // 対象ファイルパターン
  const files = await fg(['assets/js/**/*.js'], { dot: false });

  const classes = new Set();
  const fileToClasses = {};

  // エッジコレクションと重複排除用セット
  const extendsEdges = [];
  const importEdges = [];
  const instEdges = [];
  const compEdges = [];
  const extendsSet = new Set();
  const importSet = new Set();
  const instSet = new Set();
  const compSet = new Set();

  // 第1パス: クラス定義と継承取得
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf-8');
    const ast = parse(code, { sourceType: 'module', plugins: ['classProperties', 'jsx'] });
    traverse(ast, {
      ClassDeclaration(path) {
        const className = path.node.id.name;
        classes.add(className);
        fileToClasses[file] = fileToClasses[file] || [];
        fileToClasses[file].push(className);
        if (path.node.superClass && path.node.superClass.type === 'Identifier') {
          const superName = path.node.superClass.name;
          const edge = `  ${className} -->|extends| ${superName}`;
          if (!extendsSet.has(edge)) {
            extendsSet.add(edge);
            extendsEdges.push(edge);
          }
        }
      }
    });
  }

  // 第2パス: インポート、new式、クラスプロパティ（集約）取得
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf-8');
    const ast = parse(code, { sourceType: 'module', plugins: ['classProperties', 'jsx'] });
    const myClasses = fileToClasses[file] || [];
    traverse(ast, {
      ImportDeclaration(path) {
        path.node.specifiers.forEach(spec => {
          const importedName = spec.local.name;
          if (classes.has(importedName)) {
            myClasses.forEach(cn => {
              const edge = `  ${cn} -->|imports| ${importedName}`;
              if (!importSet.has(edge)) {
                importSet.add(edge);
                importEdges.push(edge);
              }
            });
          }
        });
      },
      NewExpression(path) {
        if (path.node.callee.type === 'Identifier') {
          const newName = path.node.callee.name;
          if (classes.has(newName)) {
            const clsPath = path.findParent(p => p.isClassDeclaration());
            if (clsPath && clsPath.node.id) {
              const from = clsPath.node.id.name;
              const edge = `  ${from} -->|instantiates| ${newName}`;
              if (!instSet.has(edge)) {
                instSet.add(edge);
                instEdges.push(edge);
              }
            }
          }
        }
      },
      ClassProperty(path) {
        if (
          path.node.value &&
          path.node.value.type === 'NewExpression' &&
          path.node.value.callee.type === 'Identifier'
        ) {
          const compName = path.node.value.callee.name;
          if (classes.has(compName)) {
            const clsPath = path.findParent(p => p.isClassDeclaration());
            if (clsPath && clsPath.node.id) {
              const from = clsPath.node.id.name;
              const edge = `  ${from} -->|composes| ${compName}`;
              if (!compSet.has(edge)) {
                compSet.add(edge);
                compEdges.push(edge);
              }
            }
          }
        }
      }
    });
  }

  // Mermaid flowchart 初期設定
 // let mmd = '%%{init:{"flowchart":{"ranker":"tight-tree","nodeSpacing":100,"rankSpacing":70}}}%%\n';
 // mmd += 'flowchart TB\n';
 const path = require('path');
 const filename = path.basename(__filename);
 
 let mmd = `%% Generated from ${filename} %%\n`;
 mmd += '%%{init:{"flowchart":{"ranker":"tight-tree","nodeSpacing":100,"rankSpacing":70}}}%%\n';
 mmd += 'flowchart TB\n';

  // クラスタ作成 (ディレクトリ単位)
  const groups = {};
  for (const file of files) {
    (fileToClasses[file] || []).forEach(cn => {
      const dir = pathLib.dirname(file).replace(/\\\\/g, '/');
      if (!groups[dir]) groups[dir] = new Set();
      groups[dir].add(cn);
    });
  }
  let idx = 0;
  for (const [dir, clsSet] of Object.entries(groups)) {
    mmd += `  subgraph cluster_${idx}["${dir}"]\n`;
    for (const cn of clsSet) {
      mmd += `    ${cn}\n`;
    }
    mmd += '  end\n';
    idx++;
  }

  // エッジ出力
  const allEdges = [
    ...extendsEdges,
    ...(withImports ? importEdges : []),
    ...instEdges,
    ...compEdges
  ];
  allEdges.forEach(edge => {
    mmd += `${edge}\n`;
  });

  // linkStyle 指定
  let edgeIndex = 0;
  // extends: 赤
  extendsEdges.forEach(() => {
    mmd += `linkStyle ${edgeIndex} stroke:red,stroke-width:2px\n`;
    edgeIndex++;
  });
  // imports: 青
  if (withImports) {
    importEdges.forEach(() => {
      mmd += `linkStyle ${edgeIndex} stroke:blue,stroke-width:2px\n`;
      edgeIndex++;
    });
  }
  // その他はデフォルト

  // ファイル書き込み
  fs.writeFileSync('class_graph2.mmd', mmd, 'utf-8');
  console.log('class_graph2.mmd を flowchart 形式で出力しました。');
})();
