const path = require('path');

module.exports = {
    mode: "development",
    watch: true,
    entry: './scripts/gitrends.js',
    output: {
        path: path.resolve(__dirname, 'static'),
        filename: 'gitrends.js'
    }
};