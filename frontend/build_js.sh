#!/bin/bash
rm -f static/gitrends.js
yarn webpack --config prod.webpack.config.js