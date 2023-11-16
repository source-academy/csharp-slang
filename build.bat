@echo off
echo Lint, build src and docs then run tests.
echo:
echo Linting
call ./lint.bat <nul
echo Building src
call ./build_src.bat <nul >nul
echo:
echo Building docs
call ./build_docs.bat <nul >nul
echo:
echo Running tests
call ./run_tests.bat <nul
echo Building src and docs and running tests finished.
pause