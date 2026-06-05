import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
    ...nextCoreWebVitals,
    {
        rules: {
            'react/react-in-jsx-scope': 'off',
            'react/display-name': 'off',
            'react/no-unescaped-entities': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'prefer-const': 'off',
            'no-var': 'off',
            'react-hooks/exhaustive-deps': 'off',
            'react-hooks/rules-of-hooks': 'off',
            'react-hooks/error-boundaries': 'off',
            'react-hooks/immutability': 'off',
            'react-hooks/purity': 'off',
            'react-hooks/refs': 'off',
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/static-components': 'off',
        },
    },
];

export default config;
