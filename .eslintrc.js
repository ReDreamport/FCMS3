module.exports = {
    "env": {
        "es6": true,
        "node": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "sourceType": "module",
        "ecmaVersion": 8
    },
    "rules": {
        "no-console": 0, // 允许控制台
        "max-len": ["error", { "code": 80, "ignoreComments": true }],
        "indent": ["error", 4],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "semi": [
            "error",
            "never"
        ],
        "space-before-function-paren": "error",
        "object-property-newline": [
            "error", {
                "allowMultiplePropertiesPerLine": true
            }
        ],
        "object-curly-spacing": ["error", "always"],
        "semi": [
            2,
            "never"
        ],
        "indent": [
            "warn",
            4,
            {
                "SwitchCase": 1
            }
        ],
        "no-const-assign": "warn",
        "no-this-before-super": "warn",
        "no-undef": "error",
        "no-unreachable": "warn",
        "no-unused-vars": "warn",
        "constructor-super": "warn",
        "valid-typeof": "warn",
        "no-console": "off",
        "space-before-blocks": "warn",
        "arrow-spacing": "warn",
        "comma-spacing": [
            "warn",
            {
                "before": false,
                "after": true
            }
        ],
        "keyword-spacing": [
            "warn",
            {
                "before": true
            }
        ],
        "key-spacing": [
            "warn",
            {
                "beforeColon": false,
                "afterColon": true
            }
        ],
        "no-multi-spaces": [
            "error"
        ],
        "space-infix-ops": [
            "warn",
            {
                "int32Hint": false
            }
        ],
        "space-before-function-paren": [
            "warn",
            {
                "anonymous": "always",
                "named": "never",
                "asyncArrow": "always"
            }
        ]
    }
}
