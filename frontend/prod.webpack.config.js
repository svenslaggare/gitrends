const path = require('path');

module.exports = {
    mode: "production",
    entry: './scripts/gitrends.js',
    output: {
        path: path.resolve(__dirname, 'static'),
        filename: 'gitrends.js'
    }
};