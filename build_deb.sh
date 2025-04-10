#!/bin/bash
set -eo pipefail

pushd frontend
yarn install --dev
./build_js.sh
popd

cargo deb