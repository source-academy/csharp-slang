const testcase = 
{
	name: "CS0102 - Duplicated field names in one class",
	codePieces: [
	{
		name: "CodePiece.cs",
		code:
`
using System;

namespace Namespace1 {
    class Class1 {
        public int field1;
        public double field1;
    }
}
`
	}
	],
	expectedError: "CodePiece.cs: [C# Interpreter Error] error CS0102: The type 'Namespace1.Class1' already contains a definition for 'field1'",
}

module.exports = {
    "testcase": testcase
}