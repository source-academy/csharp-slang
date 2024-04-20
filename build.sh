#!/bin/bash

echo "Lint, build src and docs then run tests."
echo ""
echo "Linting"
./lint.sh
echo ""
echo "Building src"
./build_src.sh
echo ""
echo "Building docs"
./build_docs.sh
echo ""
echo "Running tests"
./run_tests.sh
echo ""
echo "Building src and docs and running tests finished."