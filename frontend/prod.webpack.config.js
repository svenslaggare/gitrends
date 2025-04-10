const path = require('path');

module.exports = {
    mode: "production",
    entry: './scripts/gitrends.tsx',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        path: path.resolve(__dirname, 'static'),
        filename: 'gitrends.js'
    }
};