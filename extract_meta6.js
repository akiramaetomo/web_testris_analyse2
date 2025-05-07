// @ts-nocheck
// =============================================================================
//  extract_meta6.js  ―  JS / TS プロジェクトのクラス構造を解析し、
//                     Markdown と Mermaid に分割出力するスクリプト
// -----------------------------------------------------------------------------
//  出力 :
//    - class_relations.md …… ファイル/クラス/継承・生成関係の表
//    - class_graph.mmd    …… Mermaid フローチャート（コードフェンスなし）
//  使い方 :
//    $ node extract_meta6.js               # Global ノードは除外（デフォルト）
//    $ node extract_meta6.js --include-global  # Global ノードも図に含める
//    $ node extract_meta6.js --stack-clusters  # クラスタを依存関係に基づき縦積み配置
// =============================================================================

const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const Graph = require('graphology');
const louvain = require('graphology-communities-louvain');

//------------------------------------------------------------------------------
//  ユーティリティ
//------------------------------------------------------------------------------
/**
 * ディレクトリを再帰走査して .js / .ts ファイルを取得
 * @param {string} dir
 * @param {string[]} files
 * @returns {string[]}
 */
function walk(dir, files = []) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full, files);
        else if (ent.isFile() && /\.(js|ts)$/.test(full)) files.push(full);
    }
    return files;
}

/** Markdown のパイプをエスケープ */
function escapePipe(s) { return String(s).replace(/\|/g, '\\|'); }

//------------------------------------------------------------------------------
//  パラメータ
//------------------------------------------------------------------------------
const omitGlobal = !process.argv.includes('--include-global');
const stackClusters = process.argv.includes('--stack-clusters');
const root = process.cwd();

//------------------------------------------------------------------------------
//  解析対象ファイルの収集
//------------------------------------------------------------------------------
let jsFiles = [];

// 1) ルート直下の .js / .ts
jsFiles.push(
    ...fs.readdirSync(root)
        .filter(f => /\.(js|ts)$/.test(f))
        .map(f => path.join(root, f))
);

// 2) assets/js 以下（任意で変更可）
const assetsDir = path.join(root, 'assets', 'js');
if (fs.existsSync(assetsDir)) jsFiles.push(...walk(assetsDir));

// 重複除去
jsFiles = [...new Set(jsFiles)];

//------------------------------------------------------------------------------
//  ソース解析
//------------------------------------------------------------------------------
const records = [];  // {file, imports, classes, instances}

jsFiles.forEach(file => {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const src = fs.readFileSync(file, 'utf8');

    const importMap = {};   // ローカル名 -> モジュール名
    const classes = [];   // {name, superClass}
    const instances = [];   // {from, to}  new Foo()

    const classStack = [];  // 現在解析中のクラス名（ネスト対応）

    let ast;
    try {
        ast = parser.parse(src, {
            sourceType: 'module',
            plugins: ['jsx', 'classProperties', 'typescript'],
        });
    } catch (e) {
        console.error(`[ParseError] ${rel}: ${e.message}`);
        return;
    }

    traverse(ast, {
        ImportDeclaration({ node }) {
            node.specifiers.forEach(s => {
                importMap[s.local.name] = node.source.value;
            });
        },

        ClassDeclaration: {
            enter(path) {
                const n = path.node.id?.name;
                const s = path.node.superClass?.name || '';
                classStack.push(n);
                if (n) classes.push({ name: n, superClass: s });
            },
            exit() { classStack.pop(); },
        },

        ExportDefaultDeclaration({ node }) {
            if (node.declaration?.type === 'ClassDeclaration') {
                const n = node.declaration.id?.name || 'default';
                const s = node.declaration.superClass?.name || '';
                classes.push({ name: n, superClass: s });
            }
        },

        NewExpression({ node }) {
            if (node.callee.type === 'Identifier') {
                const to = node.callee.name;
                const from = classStack[classStack.length - 1] || 'Global';
                instances.push({ from, to });
            }
        },
    });

    records.push({
        file: rel,
        imports: [...new Set(Object.values(importMap))],
        classes,
        instances,
    });
});

//------------------------------------------------------------------------------
//  グラフ構築（Graphology DirectedGraph）
//------------------------------------------------------------------------------
const graph = new Graph.DirectedGraph();

// ノード追加
records.forEach(r => {
    r.classes.forEach(c => {
        if (!graph.hasNode(c.name)) graph.addNode(c.name);
    });
});
records.forEach(r => {
    r.instances.forEach(i => {
        if (!graph.hasNode(i.from)) graph.addNode(i.from);
        if (!graph.hasNode(i.to)) graph.addNode(i.to);
    });
});

// エッジ追加（継承・生成）
records.forEach(r => {
    r.classes.forEach(c => {
        if (c.superClass) {
            if (!graph.hasNode(c.superClass)) graph.addNode(c.superClass);
            if (!graph.hasEdge(c.superClass, c.name))
                graph.addEdge(c.superClass, c.name);
        }
    });
    r.instances.forEach(i => {
        if (!graph.hasEdge(i.from, i.to)) graph.addEdge(i.from, i.to);
    });
});

//------------------------------------------------------------------------------
//  Louvain クラスタリング
//------------------------------------------------------------------------------
const clusters = louvain(graph);
const clusterMap = {};
graph.forEachNode(n => {
    const cid = clusters[n];
    if (!clusterMap[cid]) clusterMap[cid] = [];
    clusterMap[cid].push(n);
});

//------------------------------------------------------------------------------
//  optional: Global ノードの完全除去（omitGlobal === true の場合）
//------------------------------------------------------------------------------
if (omitGlobal) {
    Object.values(clusterMap).forEach(arr => {
        const idx = arr.indexOf('Global');
        if (idx > -1) arr.splice(idx, 1);
    });
}

//------------------------------------------------------------------------------
//  Mermaid 生成
//------------------------------------------------------------------------------
/**
 * @param {object[]} recs
 * @param {{direction?:'TB'|'LR', omitGlobal?:boolean, stackClusters?:boolean}} opts
 * @returns {string}  Mermaid 記法（コードフェンスなし）
 */
function buildMermaid(recs, { direction = 'TB', omitGlobal = true, stackClusters = false } = {}) {
    //    let m = '%%{init:{"flowchart":{"ranker":"tight-tree","nodeSpacing":100,"rankSpacing":100}}}%%\n';
    //    m += `flowchart ${direction}\n`;

    const path = require('path');
    const filename = path.basename(__filename);
    let m = `%% Generated from ${filename} %%\n`;
    m += '%%{init:{"flowchart":{"ranker":"tight-tree","nodeSpacing":100,"rankSpacing":70}}}%%\n';
    m += 'flowchart TB\n';


    // --- クラスタ (subgraph) ---
    Object.entries(clusterMap).forEach(([cid, nodes]) => {
        m += `  subgraph cluster_${cid}\n`;
        nodes.forEach(n => {
            if (omitGlobal && n === 'Global') return;
            m += `    ${n}\n`;
        });
        m += '  end\n';
    });

    if (omitGlobal) {
        m += '  classDef globalNode font-weight:bold,color:#888;\n';
        m += '  class Global globalNode;\n';
    }

    // --- エッジ描画 & レイアウト制御用ダミーエッジ ---
    const done = new Set();
    const linkStyles = [];
    let edgeIdx = 0;

    if (stackClusters) {
        // クラスタ間依存関係を抽出
        const clusterDeps = {};
        Object.keys(clusterMap).forEach(cid => { clusterDeps[cid] = new Set(); });
        recs.forEach(r => {
            r.classes.forEach(c => {
                if (!c.superClass) return;
                if (omitGlobal && (c.superClass === 'Global' || c.name === 'Global')) return;
                const fromCid = clusters[c.superClass];
                const toCid = clusters[c.name];
                if (fromCid !== toCid) clusterDeps[fromCid].add(toCid);
            });
            r.instances.forEach(i => {
                if (omitGlobal && (i.from === 'Global' || i.to === 'Global')) return;
                const fromCid = clusters[i.from];
                const toCid = clusters[i.to];
                if (fromCid !== toCid) clusterDeps[fromCid].add(toCid);
            });
        });
        // サイクルエッジを除去
        Object.entries(clusterDeps).forEach(([cid, deps]) => {
            Array.from(deps).forEach(depCid => {
                if (clusterDeps[depCid]?.has(cid)) {
                    deps.delete(depCid);
                    clusterDeps[depCid].delete(cid);
                }
            });
        });
        // トポロジカルソート
        console.log('clusterDeps:', clusterDeps);
        const inDegree = {};
        Object.keys(clusterDeps).forEach(cid => { inDegree[cid] = 0; });
        Object.entries(clusterDeps).forEach(([cid, deps]) => {
            deps.forEach(depCid => { inDegree[depCid]++; });
        });
        const queue = Object.keys(inDegree).filter(cid => inDegree[cid] === 0);
        const orderedClusters = [];
        while (queue.length) {
            const cid = queue.shift();
            orderedClusters.push(cid);
            clusterDeps[cid].forEach(depCid => {
                inDegree[depCid]--;
                if (inDegree[depCid] === 0) queue.push(depCid);
            });
        }
        console.log('orderedClusters:', orderedClusters);
        // サイクル処理後に未処理クラスタを追加
        const allCids = Object.keys(clusterDeps).map(Number).sort((a, b) => a - b).map(String);
        allCids.forEach(cid => {
            if (!orderedClusters.includes(cid)) orderedClusters.push(cid);
        });
        console.log('final orderedClusters:', orderedClusters);
        // 隣接ペアにダミーエッジ追加
        orderedClusters.forEach((cid, idx) => {
            if (idx === orderedClusters.length - 1) return;
            const nextCid = orderedClusters[idx + 1];
            const fromNode = clusterMap[cid].find(n => !(omitGlobal && n === 'Global'));
            const toNode = clusterMap[nextCid].find(n => !(omitGlobal && n === 'Global'));
            if (fromNode && toNode) {
                m += `  ${fromNode} --> ${toNode}\n`;
                linkStyles.push(`  linkStyle ${edgeIdx} stroke:transparent,stroke-width:0,opacity:0`);
                edgeIdx++;
            }
        });
    }

    // 継承
    recs.forEach(r => {
        r.classes.forEach(c => {
            if (!c.superClass) return;
            const key = `${c.superClass}->${c.name}`;
            if (done.has(key)) return;
            done.add(key);
            if (omitGlobal && (c.superClass === 'Global' || c.name === 'Global')) return;
            m += `  ${c.superClass} -->|extends| ${c.name}\n`;
            linkStyles.push(
                `  linkStyle ${edgeIdx} stroke:#d33,stroke-width:2px,color:#d33`
            );
            edgeIdx++;
        });
        // インスタンス生成
        r.instances.forEach(i => {
            const key = `${i.from}->${i.to}`;
            if (done.has(key)) return;
            done.add(key);
            if (omitGlobal && (i.from === 'Global' || i.to === 'Global')) return;
            m += `  ${i.from} -->|instantiates| ${i.to}\n`;
            if (i.from === 'Global') {
                linkStyles.push(
                    `  linkStyle ${edgeIdx} stroke:#888,stroke-width:1px,opacity:0.8,color:#fff`
                );
            }
            edgeIdx++;
        });
    });

    m += linkStyles.join('\n') + '\n';

    return m;
}

//------------------------------------------------------------------------------
//  Markdown 表 & Mermaid 文字列の生成
//------------------------------------------------------------------------------
let md = '| ファイル | Imports | Classes | SuperClasses |\n'
    + '|---|---|---|---|\n';

records.forEach(r => {
    md += `| ${escapePipe(r.file)} | `
        + `${escapePipe(r.imports.join(', '))} | `
        + `${escapePipe(r.classes.map(c => c.name).join(', '))} | `
        + `${escapePipe(r.classes.map(c => c.superClass).filter(Boolean).join(', '))} |\n`;
});

const mmd = buildMermaid(records, { omitGlobal, stackClusters });

//------------------------------------------------------------------------------
//  ファイル出力
//------------------------------------------------------------------------------
const outTable = path.join(root, 'class_relations.md');
const outGraph = path.join(root, 'class_graph.mmd');

fs.writeFileSync(outTable, md, 'utf8');
fs.writeFileSync(outGraph, mmd, 'utf8');

console.log('===============================================');
console.log(`✔  クラス関係表     : ${outTable}`);
console.log(`✔  Mermaid フロー図 : ${outGraph}`);
console.log('===============================================');
