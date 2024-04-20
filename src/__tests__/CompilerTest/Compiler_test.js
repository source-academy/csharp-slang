const TestConstantsModule = require('../../__tests__util/TestConstants');
const MainModule = require("../../" + TestConstantsModule.BUILD_OUTPUT_DIR_RELATED_TO_SRC + '/common/Main');
const TEST_CASE_PATH = "./TestCases"

const testcases = [];

const numberOfTestCases = 17;

function loadTestCases() {
	const testCasePartialPath = "../../" + TestConstantsModule.TEST_CASES_DIR_RELATED_TO_SRC + "/compiler_testcase_";
	for (let i = 0; i < numberOfTestCases; i++) {
		const testcase = require(testCasePartialPath + i + ".js");
		testcases[i] = testcase.testcase;
	}
}

function runTest(testcase) {
	console.log("test case started");
	function runTestProgram() {
		MainModule.initialize(true); // the compiler needs "getCurrentProgram()" function in "Main.ts" to work, and "getCurrentProgram()" can only work after the "CSharpContext" has been created through "MainModule.initialize(true)".
	                                 // And here we call "MainModule.initialize(true)" before each test case in order to create and use a new "CSharpContext" along with a new "CSharpProgram". 
		const testProgram = MainModule.getCurrentProgram();
		const count = testcase.codePieces.length;
		for (let i = 0; i < count; i++) {
			const codePiece = testcase.codePieces[i];
			testProgram.addCodePiece(codePiece.name, codePiece.code);
		}
		testProgram.compile();
	}
	if (testcase.expectedError === null) { // if expectedError is null, then it means this test case should complete without any errors.
		test("Test compiler: " + testcase.name, runTestProgram);
	}
	else {
		test("Test compiler error: " + testcase.name, () => {
			expect(runTestProgram).toThrow(testcase.expectedError);
		});
	}
}

function runTests() {
	const count = testcases.length;
	for (let i = 0; i < count; i++) {
		const testcase = testcases[i];
		runTest(testcase);
	}
}


loadTestCases();
runTests();