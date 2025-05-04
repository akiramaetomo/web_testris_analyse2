/* eslint.config.js (Flat Config) */
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';

export default [
    js.configs.recommended,

    // グローバル環境を宣言
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                AudioNode: 'readonly',
                performance: 'readonly',
                Image: 'readonly',
                requestAnimationFrame: 'readonly',
                setTimeout: 'readonly',
                HTMLSelectElement: 'readonly'
            }
        },
        plugins: { import: importPlugin },
        rules: {
            'import/no-cycle': 'warn',
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-irregular-whitespace': 'error'
        }
    }
];
