#!/bin/bash

antlr4 -Dlanguage=TypeScript -o ../../src/common/compileTime/parser/antlr-generated CSharpLexer.g4 CSharpParser.g4